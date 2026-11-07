import { Color3, Matrix, Quaternion, Vector3 } from '@babylonjs/core';

export type SdfShapeType =
  | 'sphere'
  | 'ellipsoid'
  | 'box'
  | 'capsule'
  | 'round_cone'
  | 'cylinder'
  | 'torus'
  | 'cone'
  | 'plane';

export type SdfOperationType = 'union' | 'subtract' | 'intersect';

export interface SdfVec3Input {
  x?: number;
  y?: number;
  z?: number;
}

export interface SdfPartDefinition {
  shape: SdfShapeType;
  op?: SdfOperationType;
  blend?: number;
  center?: SdfVec3Input | [number, number, number];
  size?: SdfVec3Input | [number, number, number];
  radius?: number;
  endRadius?: number;
  thickness?: number;
  height?: number;
  rounding?: number;
  start?: SdfVec3Input | [number, number, number];
  end?: SdfVec3Input | [number, number, number];
  rotationDegrees?: SdfVec3Input | [number, number, number];
  color?: string;
  mirrorX?: boolean;
}

export interface CompiledSdfPart {
  shape: SdfShapeType;
  op: SdfOperationType;
  blend: number;
  center: Vector3;
  halfSize: Vector3;
  radius: number;
  endRadius: number;
  thickness: number;
  height: number;
  rounding: number;
  start: Vector3;
  end: Vector3;
  hasLocalTransform: boolean;
  invRotation: Matrix;
  boundsMin: Vector3;
  boundsMax: Vector3;
  color: Color3 | null;
}

export function parseSdfVec3(v: any, defX = 0, defY = 0, defZ = 0): Vector3 {
  if (Array.isArray(v)) {
    return new Vector3(
      Number.isFinite(Number(v[0])) ? Number(v[0]) : defX,
      Number.isFinite(Number(v[1])) ? Number(v[1]) : defY,
      Number.isFinite(Number(v[2])) ? Number(v[2]) : defZ
    );
  }
  if (v && typeof v === 'object') {
    return new Vector3(
      Number.isFinite(Number(v.x)) ? Number(v.x) : defX,
      Number.isFinite(Number(v.y)) ? Number(v.y) : defY,
      Number.isFinite(Number(v.z)) ? Number(v.z) : defZ
    );
  }
  return new Vector3(defX, defY, defZ);
}

/**
 * Polynomial smooth minimum (Inigo Quilez) returning both blended distance and interpolation factor h in [0, 1].
 */
export function smoothMin(a: number, b: number, k: number): { dist: number; weightB: number } {
  if (k <= 1e-6) {
    return b < a ? { dist: b, weightB: 1 } : { dist: a, weightB: 0 };
  }
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  const m = h * h * 0.25;
  const dist = Math.min(a, b) - m * k;
  const weightB = a < b ? m * 2.0 : 1.0 - m * 2.0;
  return { dist, weightB };
}

/**
 * Smooth subtraction of shape d2 from shape d1 with blend radius k.
 */
export function smoothSubtract(d1: number, d2: number, k: number): { dist: number; weightB: number } {
  if (k <= 1e-6) {
    return -d2 > d1 ? { dist: -d2, weightB: 1 } : { dist: d1, weightB: 0 };
  }
  const h = Math.max(0.5 - (0.5 * (d2 + d1)) / k, 0.0);
  const clampedH = Math.min(h, 1.0);
  const dist = d1 + (-d2 - d1) * clampedH + k * clampedH * (1.0 - clampedH);
  return { dist, weightB: clampedH };
}

/**
 * Smooth intersection of shape d1 and shape d2 with blend radius k.
 */
export function smoothIntersect(d1: number, d2: number, k: number): { dist: number; weightB: number } {
  if (k <= 1e-6) {
    return d2 > d1 ? { dist: d2, weightB: 1 } : { dist: d1, weightB: 0 };
  }
  const h = Math.max(0.5 - (0.5 * (d2 - d1)) / k, 0.0);
  const clampedH = Math.min(h, 1.0);
  const dist = d2 + (d1 - d2) * clampedH + k * clampedH * (1.0 - clampedH);
  return { dist, weightB: clampedH };
}

/* =========================================================================
   EXACT / ANALYTICAL SIGNED DISTANCE FUNCTIONS (Inigo Quilez)
   ========================================================================= */

export function sdSphere(px: number, py: number, pz: number, r: number): number {
  return Math.hypot(px, py, pz) - r;
}

export function sdEllipsoid(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number
): number {
  const safeRx = Math.max(1e-4, rx);
  const safeRy = Math.max(1e-4, ry);
  const safeRz = Math.max(1e-4, rz);
  const k0 = Math.hypot(px / safeRx, py / safeRy, pz / safeRz);
  if (k0 < 1e-8) {
    return -Math.min(safeRx, safeRy, safeRz);
  }
  const k1 = Math.hypot(
    px / (safeRx * safeRx),
    py / (safeRy * safeRy),
    pz / (safeRz * safeRz)
  );
  return (k0 * (k0 - 1.0)) / k1;
}

export function sdRoundBox(
  px: number,
  py: number,
  pz: number,
  hx: number,
  hy: number,
  hz: number,
  r: number
): number {
  const maxR = Math.min(hx, hy, hz);
  const rad = Math.max(0, Math.min(r, maxR));
  const qx = Math.abs(px) - (hx - rad);
  const qy = Math.abs(py) - (hy - rad);
  const qz = Math.abs(pz) - (hz - rad);
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inDist = Math.min(Math.max(qx, qy, qz), 0);
  return outDist + inDist - rad;
}

export function sdCapsule(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r: number
): number {
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const baDot = bax * bax + bay * bay + baz * baz;
  const h = baDot > 1e-8 ? Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / baDot)) : 0;
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

/**
 * Tapered capsule / round cone from point A (radius r1) to point B (radius r2).
 */
export function sdRoundCone(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r1: number,
  r2: number
): number {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  if (l2 < 1e-8) {
    return sdSphere(px - ax, py - ay, pz - az, Math.max(r1, r2));
  }
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  if (a2 <= 1e-8) {
    return sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, Math.max(r1, r2));
  }
  const il2 = 1.0 / l2;

  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xox = pax * l2 - bax * y;
  const xoy = pay * l2 - bay * y;
  const xoz = paz * l2 - baz * y;
  const x2 = (xox * xox + xoy * xoy + xoz * xoz) * il2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;

  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) {
    return Math.sqrt(x2 + z2) * il2 - r2;
  }
  if (Math.sign(y) * a2 * y2 < k) {
    return Math.sqrt(x2 + y2) * il2 - r1;
  }
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

export function sdCappedCylinder(
  px: number,
  py: number,
  pz: number,
  halfHeight: number,
  radius: number,
  rounding = 0
): number {
  const rad = Math.max(0, Math.min(rounding, Math.min(halfHeight, radius)));
  const dx = Math.hypot(px, pz) - (radius - rad);
  const dy = Math.abs(py) - (halfHeight - rad);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - rad;
}

export function sdCappedCone(
  px: number,
  py: number,
  pz: number,
  halfHeight: number,
  rBottom: number,
  rTop: number
): number {
  const qx = Math.hypot(px, pz);
  const qy = py;
  const k1x = rTop;
  const k1y = halfHeight;
  const k2x = rTop - rBottom;
  const k2y = 2.0 * halfHeight;
  const cax = qx - Math.min(qx, qy < 0.0 ? rBottom : rTop);
  const cay = Math.abs(qy) - halfHeight;
  const denom = k2x * k2x + k2y * k2y;
  const t = denom > 1e-8 ? Math.max(0, Math.min(1, ((k1x - qx) * k2x + (k1y - qy) * k2y) / denom)) : 0;
  const cbx = qx - k1x + k2x * t;
  const cby = qy - k1y + k2y * t;
  const s = cbx < 0.0 && cay < 0.0 ? -1.0 : 1.0;
  return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}

export function sdTorus(
  px: number,
  py: number,
  pz: number,
  majorRadius: number,
  minorRadius: number
): number {
  const qx = Math.hypot(px, pz) - majorRadius;
  return Math.hypot(qx, py) - minorRadius;
}

function normalizeColorHex(hex?: string): Color3 | null {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) clean = '#' + clean;
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    clean =
      '#' +
      clean
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('');
  }
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return Color3.FromHexString(clean);
  }
  return null;
}

function compileSinglePart(part: SdfPartDefinition): CompiledSdfPart {
  const shape = (part.shape || 'sphere').toLowerCase() as SdfShapeType;
  const op: SdfOperationType =
    part.op === 'subtract' || part.op === 'intersect' ? part.op : 'union';
  const defaultBlend = op === 'union' ? 0.05 : 0.02;
  const blend = Math.max(0, Math.min(2.0, Number.isFinite(Number(part.blend)) ? Number(part.blend) : defaultBlend));

  const center = parseSdfVec3(part.center, 0, 0, 0);
  const rawSize = parseSdfVec3(part.size, 0.5, 0.5, 0.5);
  const halfSize = new Vector3(
    Math.max(0.005, Math.abs(rawSize.x) * 0.5),
    Math.max(0.005, Math.abs(rawSize.y) * 0.5),
    Math.max(0.005, Math.abs(rawSize.z) * 0.5)
  );

  const radius = Math.max(0.005, Number.isFinite(Number(part.radius)) ? Number(part.radius) : 0.25);
  const endRadius = Math.max(
    0.002,
    Number.isFinite(Number(part.endRadius)) ? Number(part.endRadius) : radius
  );
  const thickness = Math.max(
    0.005,
    Number.isFinite(Number(part.thickness)) ? Number(part.thickness) : radius * 0.35
  );
  const height = Math.max(
    0.01,
    Number.isFinite(Number(part.height)) ? Number(part.height) : rawSize.y || radius * 2
  );
  const rounding = Math.max(0, Number.isFinite(Number(part.rounding)) ? Number(part.rounding) : 0);

  const hasStart = part.start !== undefined;
  const hasEnd = part.end !== undefined;
  const start = hasStart
    ? parseSdfVec3(part.start, center.x, center.y - height * 0.5, center.z)
    : new Vector3(center.x, center.y - height * 0.5, center.z);
  const end = hasEnd
    ? parseSdfVec3(part.end, center.x, center.y + height * 0.5, center.z)
    : new Vector3(center.x, center.y + height * 0.5, center.z);

  const rotDeg = parseSdfVec3(part.rotationDegrees, 0, 0, 0);
  const hasRot = Math.abs(rotDeg.x) > 1e-4 || Math.abs(rotDeg.y) > 1e-4 || Math.abs(rotDeg.z) > 1e-4;
  let invRotation = Matrix.Identity();
  if (hasRot) {
    const q = Quaternion.FromEulerAngles(
      (rotDeg.x * Math.PI) / 180,
      (rotDeg.y * Math.PI) / 180,
      (rotDeg.z * Math.PI) / 180
    );
    Matrix.FromQuaternionToRef(q.invert(), invRotation);
  }

  // Compute generous world-space AABB for fast distance culling
  let boundsMin: Vector3;
  let boundsMax: Vector3;
  if ((shape === 'capsule' || shape === 'round_cone') && (hasStart || hasEnd)) {
    const maxR = Math.max(radius, endRadius) + blend + 0.05;
    boundsMin = new Vector3(
      Math.min(start.x, end.x) - maxR,
      Math.min(start.y, end.y) - maxR,
      Math.min(start.z, end.z) - maxR
    );
    boundsMax = new Vector3(
      Math.max(start.x, end.x) + maxR,
      Math.max(start.y, end.y) + maxR,
      Math.max(start.z, end.z) + maxR
    );
  } else {
    let maxExtent = radius;
    if (shape === 'box' || shape === 'ellipsoid') {
      maxExtent = hasRot
        ? Math.hypot(halfSize.x, halfSize.y, halfSize.z)
        : Math.max(halfSize.x, halfSize.y, halfSize.z);
    } else if (shape === 'cylinder' || shape === 'cone') {
      maxExtent = Math.hypot(Math.max(radius, endRadius), height * 0.5);
    } else if (shape === 'torus') {
      maxExtent = radius + thickness;
    } else if (shape === 'capsule' || shape === 'round_cone') {
      maxExtent = height * 0.5 + Math.max(radius, endRadius);
    }
    const pad = maxExtent + blend + 0.05;
    boundsMin = new Vector3(center.x - pad, center.y - pad, center.z - pad);
    boundsMax = new Vector3(center.x + pad, center.y + pad, center.z + pad);
  }

  return {
    shape,
    op,
    blend,
    center,
    halfSize,
    radius,
    endRadius,
    thickness,
    height,
    rounding,
    start,
    end,
    hasLocalTransform: hasRot,
    invRotation,
    boundsMin,
    boundsMax,
    color: normalizeColorHex(part.color),
  };
}

/**
 * Compiles raw part definitions into fast-evaluatable SDF primitives, optionally mirroring across X = 0.
 */
export function compileSdfParts(parts: SdfPartDefinition[], symmetryX = false): CompiledSdfPart[] {
  const compiled: CompiledSdfPart[] = [];
  for (const p of parts) {
    const base = compileSinglePart(p);
    compiled.push(base);

    const shouldMirror = p.mirrorX !== undefined ? p.mirrorX : symmetryX;
    if (shouldMirror) {
      const isOffCenter =
        Math.abs(base.center.x) > 1e-4 ||
        Math.abs(base.start.x) > 1e-4 ||
        Math.abs(base.end.x) > 1e-4;
      if (isOffCenter) {
        const rotDeg = parseSdfVec3(p.rotationDegrees, 0, 0, 0);
        const mirroredDef: SdfPartDefinition = {
          ...p,
          center: { x: -base.center.x, y: base.center.y, z: base.center.z },
          start: { x: -base.start.x, y: base.start.y, z: base.start.z },
          end: { x: -base.end.x, y: base.end.y, z: base.end.z },
          rotationDegrees: { x: rotDeg.x, y: -rotDeg.y, z: -rotDeg.z },
          mirrorX: false,
        };
        compiled.push(compileSinglePart(mirroredDef));
      }
    }
  }
  return compiled;
}

/**
 * Evaluates a single compiled SDF primitive at world point (wx, wy, wz).
 */
export function evaluateCompiledPart(part: CompiledSdfPart, wx: number, wy: number, wz: number): number {
  if (part.shape === 'capsule' || part.shape === 'round_cone') {
    if (!part.hasLocalTransform) {
      if (Math.abs(part.radius - part.endRadius) > 1e-4 || part.shape === 'round_cone') {
        return sdRoundCone(
          wx,
          wy,
          wz,
          part.start.x,
          part.start.y,
          part.start.z,
          part.end.x,
          part.end.y,
          part.end.z,
          part.radius,
          part.endRadius
        );
      }
      return sdCapsule(
        wx,
        wy,
        wz,
        part.start.x,
        part.start.y,
        part.start.z,
        part.end.x,
        part.end.y,
        part.end.z,
        part.radius
      );
    }
  }

  let lx = wx - part.center.x;
  let ly = wy - part.center.y;
  let lz = wz - part.center.z;

  if (part.hasLocalTransform) {
    const m = part.invRotation.m;
    const rx = lx * m[0] + ly * m[4] + lz * m[8];
    const ry = lx * m[1] + ly * m[5] + lz * m[9];
    const rz = lx * m[2] + ly * m[6] + lz * m[10];
    lx = rx;
    ly = ry;
    lz = rz;
  }

  switch (part.shape) {
    case 'sphere':
      return sdSphere(lx, ly, lz, part.radius);
    case 'ellipsoid':
      return sdEllipsoid(lx, ly, lz, part.halfSize.x, part.halfSize.y, part.halfSize.z);
    case 'box':
      return sdRoundBox(lx, ly, lz, part.halfSize.x, part.halfSize.y, part.halfSize.z, part.rounding);
    case 'cylinder':
      return sdCappedCylinder(lx, ly, lz, part.height * 0.5, part.radius, part.rounding);
    case 'cone':
      return sdCappedCone(lx, ly, lz, part.height * 0.5, part.radius, part.endRadius);
    case 'torus':
      return sdTorus(lx, ly, lz, part.radius, part.thickness);
    case 'capsule':
    case 'round_cone':
      return sdRoundCone(lx, ly, lz, 0, -part.height * 0.5, 0, 0, part.height * 0.5, 0, part.radius, part.endRadius);
    case 'plane':
      return ly;
    default:
      return sdSphere(lx, ly, lz, part.radius);
  }
}

/**
 * Evaluates the composite SDF scene at (wx, wy, wz).
 */
export function evaluateSdfScene(parts: CompiledSdfPart[], wx: number, wy: number, wz: number): number {
  let d = 1e6;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    // Fast AABB distance lower bound check for union parts when already near surface
    if (p.op === 'union' && d < 1e5) {
      const dx = wx < p.boundsMin.x ? p.boundsMin.x - wx : wx > p.boundsMax.x ? wx - p.boundsMax.x : 0;
      const dy = wy < p.boundsMin.y ? p.boundsMin.y - wy : wy > p.boundsMax.y ? wy - p.boundsMax.y : 0;
      const dz = wz < p.boundsMin.z ? p.boundsMin.z - wz : wz > p.boundsMax.z ? wz - p.boundsMax.z : 0;
      if (dx > d + p.blend || dy > d + p.blend || dz > d + p.blend) {
        continue;
      }
    }

    const pd = evaluateCompiledPart(p, wx, wy, wz);
    if (i === 0) {
      d = pd;
      continue;
    }

    if (p.op === 'union') {
      d = smoothMin(d, pd, p.blend).dist;
    } else if (p.op === 'subtract') {
      d = smoothSubtract(d, pd, p.blend).dist;
    } else {
      d = smoothIntersect(d, pd, p.blend).dist;
    }
  }
  return d;
}

/**
 * Evaluates composite SDF color at a surface point using smooth blend weights.
 */
export function evaluateSdfColor(
  parts: CompiledSdfPart[],
  wx: number,
  wy: number,
  wz: number,
  defaultColor: Color3
): Color3 {
  let d = 1e6;
  let r = defaultColor.r;
  let g = defaultColor.g;
  let b = defaultColor.b;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const pd = evaluateCompiledPart(p, wx, wy, wz);
    const pc = p.color || defaultColor;

    if (i === 0) {
      d = pd;
      r = pc.r;
      g = pc.g;
      b = pc.b;
      continue;
    }

    let res: { dist: number; weightB: number };
    if (p.op === 'union') {
      res = smoothMin(d, pd, p.blend);
    } else if (p.op === 'subtract') {
      res = smoothSubtract(d, pd, p.blend);
    } else {
      res = smoothIntersect(d, pd, p.blend);
    }
    d = res.dist;
    const w = res.weightB;
    r = r * (1 - w) + pc.r * w;
    g = g * (1 - w) + pc.g * w;
    b = b * (1 - w) + pc.b * w;
  }

  return new Color3(r, g, b);
}

/**
 * Computes analytical SDF gradient normal via central differences.
 */
export function computeSdfNormal(
  parts: CompiledSdfPart[],
  wx: number,
  wy: number,
  wz: number,
  eps = 0.002
): Vector3 {
  const dx = evaluateSdfScene(parts, wx + eps, wy, wz) - evaluateSdfScene(parts, wx - eps, wy, wz);
  const dy = evaluateSdfScene(parts, wx, wy + eps, wz) - evaluateSdfScene(parts, wx, wy - eps, wz);
  const dz = evaluateSdfScene(parts, wx, wy, wz + eps) - evaluateSdfScene(parts, wx, wy, wz - eps);
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) {
    return new Vector3(0, 1, 0);
  }
  return new Vector3(dx / len, dy / len, dz / len);
}

