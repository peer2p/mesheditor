import {
  Mesh,
  MeshBuilder,
  Scene,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import earcut from 'earcut';
import { createRoundedBoxMesh } from './roundedBox';

export interface WallOpening {
  type?: 'rect' | 'arch' | 'round';
  x?: number; // Horizontal center offset from wall center (X = 0)
  y?: number; // Sill / bottom height from wall base (Y = 0); 0 for doors
  width?: number;
  height?: number;
  archRise?: number;
  frame?: boolean;
  frameWidth?: number;
  frameDepth?: number;
}

export interface WallBuildOptions {
  width?: number;
  height?: number;
  thickness?: number;
  openings?: WallOpening[];
  plinthHeight?: number;
  corniceHeight?: number;
  bevelRadius?: number;
}

export interface ArchBuildOptions {
  style?: 'round' | 'pointed' | 'segmental' | 'horseshoe' | 'flat';
  span?: number;
  pierHeight?: number;
  pierWidth?: number;
  rise?: number;
  thickness?: number;
  depth?: number;
  segments?: number;
  keystone?: boolean;
  impostCap?: boolean;
}

export interface ColumnBuildOptions {
  order?: 'doric' | 'tuscan' | 'ionic' | 'corinthian' | 'modern';
  height?: number;
  radius?: number;
  taper?: number;
  entasis?: number;
  flutes?: number;
  fluteDepth?: number;
  radialSegments?: number;
}

export type MoldingProfilePreset =
  | 'cornice'
  | 'ogee'
  | 'cove'
  | 'torus'
  | 'baseboard'
  | 'cyma_recta'
  | 'stepped'
  | 'custom';

export interface MoldingBuildOptions {
  path: Array<{ x?: number; y?: number; z?: number } | [number, number, number]>;
  profile?: MoldingProfilePreset;
  profilePoints?: Array<[number, number] | { x: number; y: number }>;
  width?: number;
  height?: number;
  closed?: boolean;
}

export interface StairsBuildOptions {
  style?: 'straight' | 'spiral' | 'l_shaped';
  steps?: number;
  width?: number;
  stepRise?: number;
  stepRun?: number;
  height?: number;
  length?: number;
  nosing?: number;
  stringers?: boolean;
  railing?: 'none' | 'left' | 'right' | 'both' | boolean;
  railingHeight?: number;
  innerRadius?: number;
  totalAngleDegrees?: number;
}

export interface RoofBuildOptions {
  style?: 'gable' | 'hip' | 'shed' | 'pyramid' | 'mansard' | 'gambrel' | 'dome';
  width?: number;
  depth?: number;
  height?: number;
  pitchDegrees?: number;
  overhang?: number;
  thickness?: number;
  ridgeCap?: boolean;
  gableWall?: boolean;
}

function makeUpdatableMerged(parts: Mesh[], name: string, scene: Scene): Mesh {
  const valid = parts.filter((p) => p && !p.isDisposed() && p.getTotalVertices() > 0);
  if (valid.length === 0) {
    return MeshBuilder.CreateBox(name, { size: 0.1, updatable: true }, scene);
  }
  for (const p of valid) {
    p.computeWorldMatrix(true);
  }
  const merged =
    valid.length === 1
      ? valid[0]
      : Mesh.MergeMeshes(valid, true, true, undefined, false, false);
  if (!merged) {
    return valid[0];
  }
  merged.name = name;
  const vd = VertexData.ExtractFromMesh(merged);
  vd.applyToMesh(merged, true);
  return merged;
}

/**
 * Generates 2D contour points (x, z in ExtrudePolygon's XZ plane, mapping to wall X and wall Y)
 * for a window/door opening.
 */
function buildOpeningContour2D(
  op: WallOpening,
  wallW: number,
  wallH: number
): Vector3[] {
  const type = (op.type || 'rect').toLowerCase();
  const w = Math.max(0.1, Math.min(wallW - 0.1, Number(op.width ?? 0.9)));
  const h = Math.max(0.1, Math.min(wallH - 0.05, Number(op.height ?? 1.4)));
  const cx = Math.max(-wallW * 0.5 + w * 0.5 + 0.03, Math.min(wallW * 0.5 - w * 0.5 - 0.03, Number(op.x ?? 0)));
  const y0 = Math.max(0.005, Math.min(wallH - h - 0.03, Number(op.y ?? 0)));

  const hw = w * 0.5;
  const pts: Vector3[] = [];

  if (type === 'round') {
    const r = Math.min(hw, h * 0.5);
    const cy = y0 + h * 0.5;
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new Vector3(cx + Math.cos(a) * r, 0, cy + Math.sin(a) * r));
    }
    return pts;
  }

  if (type === 'arch') {
    const archRise = Math.min(h * 0.6, Number(op.archRise ?? hw));
    const springY = y0 + Math.max(0.05, h - archRise);
    pts.push(new Vector3(cx - hw, 0, y0));
    pts.push(new Vector3(cx + hw, 0, y0));
    pts.push(new Vector3(cx + hw, 0, springY));
    const segs = 12;
    for (let i = 1; i < segs; i++) {
      const t = (i / segs) * Math.PI;
      pts.push(new Vector3(cx + Math.cos(t) * hw, 0, springY + Math.sin(t) * archRise));
    }
    pts.push(new Vector3(cx - hw, 0, springY));
    return pts;
  }

  // Rectangular opening
  pts.push(new Vector3(cx - hw, 0, y0));
  pts.push(new Vector3(cx + hw, 0, y0));
  pts.push(new Vector3(cx + hw, 0, y0 + h));
  pts.push(new Vector3(cx - hw, 0, y0 + h));
  return pts;
}

/**
 * Builds a parametric architectural wall standing on Y = 0, centered on X = 0, Z = 0,
 * with cleanly cut openings, optional window/door frames, plinth, and cornice.
 */
export function buildWallMesh(scene: Scene, name: string, opts: WallBuildOptions = {}): Mesh {
  const width = Math.max(0.2, Number(opts.width ?? 4.0));
  const height = Math.max(0.2, Number(opts.height ?? 3.0));
  const thickness = Math.max(0.05, Number(opts.thickness ?? 0.25));
  const openings = Array.isArray(opts.openings) ? opts.openings : [];
  const parts: Mesh[] = [];

  if (openings.length === 0) {
    const bevel = opts.bevelRadius !== undefined ? Number(opts.bevelRadius) : Math.min(thickness * 0.08, 0.02);
    const box = createRoundedBoxMesh(
      `${name}_body`,
      { width, height, depth: thickness, radius: bevel, segments: 2 },
      scene
    );
    box.position.set(0, height * 0.5, 0);
    box.bakeCurrentTransformIntoVertices();
    parts.push(box);
  } else {
    const hw = width * 0.5;
    const outer: Vector3[] = [
      new Vector3(-hw, 0, 0),
      new Vector3(hw, 0, 0),
      new Vector3(hw, 0, height),
      new Vector3(-hw, 0, height),
    ];
    const holes: Vector3[][] = openings.map((op) => buildOpeningContour2D(op, width, height));

    // ExtrudePolygon extrudes downward along -Y in local space from Y=0 to Y=-depth
    const poly = MeshBuilder.ExtrudePolygon(
      `${name}_poly`,
      {
        shape: outer,
        holes,
        depth: thickness,
        sideOrientation: Mesh.DOUBLESIDE,
        updatable: true,
      },
      scene,
      earcut
    );
    // Rotate -90 deg around X so local Z (0..height) maps to world +Y (0..height),
    // and local Y (-thickness..0) maps to world Z (-thickness/2..+thickness/2)
    poly.rotation.x = -Math.PI / 2;
    poly.position.set(0, 0, -thickness * 0.5);
    poly.bakeCurrentTransformIntoVertices();
    parts.push(poly);

    // Optional frames around openings
    for (let i = 0; i < openings.length; i++) {
      const op = openings[i];
      if (op.frame === false) continue;
      const contour = holes[i];
      if (!contour || contour.length < 3) continue;
      const fw = Math.max(0.02, Number(op.frameWidth ?? 0.06));
      const fd = Math.max(thickness + 0.02, Number(op.frameDepth ?? thickness + 0.05));

      for (let j = 0; j < contour.length; j++) {
        const p0 = contour[j];
        const p1 = contour[(j + 1) % contour.length];
        // Skip bottom sill for doors touching ground (y <= 0.02)
        if (Math.abs(p0.z) < 0.02 && Math.abs(p1.z) < 0.02) continue;
        const yStart = p0.z < 0.02 ? fw * 0.25 : p0.z;
        const yEnd = p1.z < 0.02 ? fw * 0.25 : p1.z;
        const dx = p1.x - p0.x;
        const dy = yEnd - yStart;
        const segLen = Math.hypot(dx, dy);
        if (segLen < 1e-3) continue;
        const bar = MeshBuilder.CreateBox(
          `${name}_frame_${i}_${j}`,
          { width: segLen + fw * 0.4, height: fw, depth: fd },
          scene
        );
        bar.rotation.z = Math.atan2(dy, dx);
        bar.position.set((p0.x + p1.x) * 0.5, (yStart + yEnd) * 0.5, 0);
        bar.bakeCurrentTransformIntoVertices();
        parts.push(bar);
      }
    }
  }

  // Optional plinth band at base
  const plinthH = Number(opts.plinthHeight ?? 0);
  if (plinthH > 0.01 && openings.every((o) => (o.y ?? 1) > plinthH)) {
    const plinth = createRoundedBoxMesh(
      `${name}_plinth`,
      { width: width + 0.06, height: plinthH, depth: thickness + 0.06, radius: 0.015, segments: 2 },
      scene
    );
    plinth.position.set(0, plinthH * 0.5, 0);
    plinth.bakeCurrentTransformIntoVertices();
    parts.push(plinth);
  }

  // Optional cornice band at top
  const corniceH = Number(opts.corniceHeight ?? 0);
  if (corniceH > 0.01) {
    const cornice = createRoundedBoxMesh(
      `${name}_cornice`,
      { width: width + 0.1, height: corniceH, depth: thickness + 0.1, radius: 0.02, segments: 2 },
      scene
    );
    cornice.position.set(0, height - corniceH * 0.5, 0);
    cornice.bakeCurrentTransformIntoVertices();
    parts.push(cornice);
  }

  return makeUpdatableMerged(parts, name, scene);
}

/**
 * Builds a freestanding architectural arch / portal standing on Y = 0.
 */
export function buildArchMesh(scene: Scene, name: string, opts: ArchBuildOptions = {}): Mesh {
  const style = (opts.style || 'round').toLowerCase();
  const span = Math.max(0.3, Number(opts.span ?? 2.0));
  const halfSpan = span * 0.5;
  const pierHeight = Math.max(0, Number(opts.pierHeight ?? 1.8));
  const pierWidth = Math.max(0.1, Number(opts.pierWidth ?? 0.35));
  const thickness = Math.max(0.08, Number(opts.thickness ?? pierWidth));
  const depth = Math.max(0.1, Number(opts.depth ?? 0.4));
  const rise = Math.max(
    0.1,
    Number(opts.rise ?? (style === 'pointed' ? span * 0.65 : style === 'segmental' ? span * 0.28 : halfSpan))
  );
  const segs = Math.max(6, Math.min(48, Math.round(opts.segments ?? 16)));
  const parts: Mesh[] = [];

  // 1. Left and Right Piers + Plinth Bases + Impost Caps
  if (pierHeight > 0.02) {
    for (const side of [-1, 1]) {
      const px = side * (halfSpan + pierWidth * 0.5);
      const pier = createRoundedBoxMesh(
        `${name}_pier_${side}`,
        { width: pierWidth, height: pierHeight, depth, radius: Math.min(0.02, pierWidth * 0.08), segments: 2 },
        scene
      );
      pier.position.set(px, pierHeight * 0.5, 0);
      pier.bakeCurrentTransformIntoVertices();
      parts.push(pier);

      // Base plinth
      const baseH = Math.min(0.16, pierHeight * 0.12);
      const base = createRoundedBoxMesh(
        `${name}_pier_base_${side}`,
        { width: pierWidth + 0.08, height: baseH, depth: depth + 0.08, radius: 0.018, segments: 2 },
        scene
      );
      base.position.set(px, baseH * 0.5, 0);
      base.bakeCurrentTransformIntoVertices();
      parts.push(base);

      // Impost cap at spring line
      if (opts.impostCap !== false) {
        const capH = Math.min(0.12, pierHeight * 0.08 + 0.04);
        const cap = createRoundedBoxMesh(
          `${name}_impost_${side}`,
          { width: pierWidth + 0.08, height: capH, depth: depth + 0.08, radius: 0.018, segments: 2 },
          scene
        );
        cap.position.set(px, pierHeight - capH * 0.5, 0);
        cap.bakeCurrentTransformIntoVertices();
        parts.push(cap);
      }
    }
  }

  // 2. Arch Ring (voussoir band above pierHeight)
  const evalInnerArch = (t: number): { x: number; y: number; nx: number; ny: number } => {
    if (style === 'flat') {
      const x = halfSpan * (1 - 2 * t);
      return { x, y: pierHeight, nx: 0, ny: 1 };
    }
    if (style === 'pointed') {
      // Gothic lancet arch: two intersecting arcs meeting at apex (t = 0.5)
      if (t <= 0.5) {
        const u = t * 2; // 0 (right spring) to 1 (apex)
        const angle = (u * Math.PI) / 2;
        const x = halfSpan * Math.cos(angle);
        const y = pierHeight + rise * Math.sin(angle);
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        return { x, y, nx, ny };
      } else {
        const u = (1 - t) * 2; // 1 (apex) to 0 (left spring)
        const angle = (u * Math.PI) / 2;
        const x = -halfSpan * Math.cos(angle);
        const y = pierHeight + rise * Math.sin(angle);
        const nx = -Math.cos(angle);
        const ny = Math.sin(angle);
        return { x, y, nx, ny };
      }
    }
    if (style === 'horseshoe') {
      const startAngle = -0.22 * Math.PI;
      const endAngle = 1.22 * Math.PI;
      const angle = startAngle + t * (endAngle - startAngle);
      const x = Math.cos(angle) * halfSpan;
      const y = pierHeight + rise * 0.35 + Math.sin(angle) * rise;
      return { x, y, nx: Math.cos(angle), ny: Math.sin(angle) };
    }
    // Round or segmental arch
    const angle = t * Math.PI;
    const x = Math.cos(angle) * halfSpan;
    const y = pierHeight + Math.sin(angle) * rise;
    const len = Math.hypot(Math.cos(angle) / halfSpan, Math.sin(angle) / rise) || 1;
    const nx = Math.cos(angle) / halfSpan / len;
    const ny = Math.sin(angle) / rise / len;
    return { x, y, nx, ny };
  };

  const innerPts: Vector3[] = [];
  const outerPts: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = evalInnerArch(t);
    innerPts.push(new Vector3(p.x, 0, p.y));
    outerPts.push(new Vector3(p.x + p.nx * thickness, 0, p.y + p.ny * thickness));
  }
  const ringContour: Vector3[] = [...innerPts, ...outerPts.reverse()];
  const ringMesh = MeshBuilder.ExtrudePolygon(
    `${name}_ring`,
    {
      shape: ringContour,
      depth,
      sideOrientation: Mesh.DOUBLESIDE,
      updatable: true,
    },
    scene,
    earcut
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(0, 0, -depth * 0.5);
  ringMesh.bakeCurrentTransformIntoVertices();
  parts.push(ringMesh);

  // 3. Optional Keystone at apex
  if (opts.keystone !== false) {
    const apex = evalInnerArch(0.5);
    const keyH = thickness * 1.22;
    const keyW = Math.max(0.1, span * 0.11);
    const keystone = createRoundedBoxMesh(
      `${name}_keystone`,
      { width: keyW, height: keyH, depth: depth + 0.06, radius: 0.015, segments: 2 },
      scene
    );
    keystone.position.set(0, apex.y + thickness * 0.52, 0);
    keystone.bakeCurrentTransformIntoVertices();
    parts.push(keystone);
  }

  return makeUpdatableMerged(parts, name, scene);
}

/**
 * Builds a classical or modern column standing on Y = 0 up to Y = height,
 * with plinth, torus base, fluted + entasis shaft, necking ring, echinus capital, and abacus.
 */
export function buildColumnMesh(scene: Scene, name: string, opts: ColumnBuildOptions = {}): Mesh {
  const order = (opts.order || 'doric').toLowerCase();
  const totalHeight = Math.max(0.4, Number(opts.height ?? 3.2));
  const baseRadius = Math.max(0.05, Number(opts.radius ?? 0.24));
  const taper = Math.max(0.5, Math.min(1.0, Number(opts.taper ?? (order === 'modern' ? 1.0 : 0.85))));
  const entasis = Math.max(0, Math.min(0.15, Number(opts.entasis ?? (order === 'modern' ? 0 : 0.025))));
  const defaultFlutes = order === 'tuscan' || order === 'modern' ? 0 : order === 'doric' ? 20 : 24;
  const flutes = Math.max(0, Math.min(40, Math.round(opts.flutes ?? defaultFlutes)));
  const fluteDepth = Math.max(0, Number(opts.fluteDepth ?? baseRadius * 0.065));
  const radialSegs = Math.max(
    16,
    Math.min(96, flutes > 0 ? flutes * 4 : Math.round(opts.radialSegments ?? 28))
  );

  const parts: Mesh[] = [];

  const hasPlinth = order !== 'modern';
  const baseHeight = hasPlinth ? totalHeight * 0.09 : 0;
  const capHeight = order !== 'modern' ? totalHeight * 0.1 : 0;
  const shaftY0 = baseHeight;
  const shaftY1 = totalHeight - capHeight;
  const shaftHeight = Math.max(0.1, shaftY1 - shaftY0);

  // 1. Plinth & Molded Base
  if (hasPlinth) {
    const plinthH = baseHeight * 0.45;
    const plinthW = baseRadius * 2.65;
    const plinth = createRoundedBoxMesh(
      `${name}_plinth`,
      { width: plinthW, height: plinthH, depth: plinthW, radius: 0.015, segments: 2 },
      scene
    );
    plinth.position.set(0, plinthH * 0.5, 0);
    plinth.bakeCurrentTransformIntoVertices();
    parts.push(plinth);

    const torusBaseProfile: Vector3[] = [
      new Vector3(baseRadius * 1.25, plinthH, 0),
      new Vector3(baseRadius * 1.32, plinthH + baseHeight * 0.2, 0),
      new Vector3(baseRadius * 1.15, plinthH + baseHeight * 0.4, 0),
      new Vector3(baseRadius * 1.20, plinthH + baseHeight * 0.65, 0),
      new Vector3(baseRadius, shaftY0, 0),
    ];
    const baseLathe = MeshBuilder.CreateLathe(
      `${name}_base_torus`,
      { shape: torusBaseProfile, tessellation: Math.min(36, radialSegs), sideOrientation: Mesh.FRONTSIDE },
      scene
    );
    parts.push(baseLathe);
  }

  // 2. Parametric Fluted & Entasis Shaft
  const vSegs = 24;
  const shaftPos: number[] = [];
  const shaftNorm: number[] = [];
  const shaftUV: number[] = [];
  const shaftIdx: number[] = [];

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    const y = shaftY0 + v * shaftHeight;
    // Classical entasis peaks around 1/3 up the shaft
    const entasisBulge = Math.sin(v * Math.PI) * entasis * baseRadius;
    const ringR = baseRadius * (1 - (1 - taper) * v) + entasisBulge;
    // Fade flutes out smoothly at bottom and top 8% with smoothstep
    const fade = 0.08;
    let fluteEnvelope = 1.0;
    if (v < fade) {
      const t = v / fade;
      fluteEnvelope = t * t * (3 - 2 * t);
    } else if (v > 1 - fade) {
      const t = (1 - v) / fade;
      fluteEnvelope = t * t * (3 - 2 * t);
    }
    if (flutes === 0) fluteEnvelope = 0;

    for (let iu = 0; iu <= radialSegs; iu++) {
      const u = iu / radialSegs;
      const theta = u * Math.PI * 2;
      let r = ringR;
      if (flutes > 0) {
        const fluteWave = Math.pow(Math.max(0, Math.sin(theta * flutes)), 0.65);
        r -= fluteDepth * fluteEnvelope * fluteWave;
      }
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      shaftPos.push(x, y, z);
      shaftUV.push(u, v);
    }
  }

  const stride = radialSegs + 1;
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < radialSegs; iu++) {
      const i00 = iv * stride + iu;
      const i10 = iv * stride + (iu + 1);
      const i01 = (iv + 1) * stride + iu;
      const i11 = (iv + 1) * stride + (iu + 1);
      // Correct outward normal winding:
      shaftIdx.push(i00, i10, i11, i00, i11, i01);
    }
  }

  const shaftMesh = new Mesh(`${name}_shaft`, scene);
  const shaftVD = new VertexData();
  const shaftNormalsComputed = new Float32Array(shaftPos.length);
  VertexData.ComputeNormals(shaftPos, shaftIdx, shaftNormalsComputed);
  shaftVD.positions = shaftPos;
  shaftVD.indices = shaftIdx;
  shaftVD.normals = shaftNormalsComputed;
  shaftVD.uvs = shaftUV;
  shaftVD.applyToMesh(shaftMesh, true);
  parts.push(shaftMesh);

  // 3. Capital (Astragal necking + Echinus flare + Abacus slab + Order ornaments)
  if (capHeight > 0) {
    const topR = baseRadius * taper;
    const abacusH = capHeight * 0.35;
    const echinusTopY = totalHeight - abacusH;

    const capProfile: Vector3[] = [
      new Vector3(topR * 1.05, shaftY1, 0),
      new Vector3(topR * 1.02, shaftY1 + capHeight * 0.15, 0),
      new Vector3(topR * 1.25, shaftY1 + capHeight * 0.45, 0),
      new Vector3(topR * (order === 'corinthian' ? 1.45 : 1.35), echinusTopY, 0),
    ];
    const echinus = MeshBuilder.CreateLathe(
      `${name}_echinus`,
      { shape: capProfile, tessellation: Math.min(36, radialSegs), sideOrientation: Mesh.FRONTSIDE },
      scene
    );
    parts.push(echinus);

    const abacusW = topR * 2.85;
    const abacus = createRoundedBoxMesh(
      `${name}_abacus`,
      { width: abacusW, height: abacusH, depth: abacusW, radius: 0.015, segments: 2 },
      scene
    );
    abacus.position.set(0, totalHeight - abacusH * 0.5, 0);
    abacus.bakeCurrentTransformIntoVertices();
    parts.push(abacus);

    if (order === 'ionic') {
      // Proportional Ionic volute scroll discs under the abacus
      const voluteR = capHeight * 0.32;
      const voluteThick = topR * 0.45;
      for (const sx of [-1, 1]) {
        const volute = MeshBuilder.CreateCylinder(
          `${name}_volute_${sx}`,
          {
            height: voluteThick,
            diameter: voluteR * 2,
            tessellation: 24,
          },
          scene
        );
        volute.rotation.x = Math.PI / 2;
        volute.position.set(sx * (topR * 1.05), echinusTopY - voluteR * 0.65, 0);
        volute.bakeCurrentTransformIntoVertices();
        parts.push(volute);
      }
    }
  }

  return makeUpdatableMerged(parts, name, scene);
}

/**
 * Generates 2D cross-section profile points (x = outward projection, y = vertical height) for moldings.
 */
function getMoldingProfilePoints(
  preset: MoldingProfilePreset,
  width: number,
  height: number,
  custom?: Array<[number, number] | { x: number; y: number }>
): Array<[number, number]> {
  if (custom && custom.length >= 3) {
    return custom.map((p) =>
      Array.isArray(p) ? [Number(p[0]) || 0, Number(p[1]) || 0] : [Number(p.x) || 0, Number(p.y) || 0]
    );
  }
  const w = width;
  const h = height;
  switch (preset) {
    case 'cove':
      return [
        [0, 0],
        [w * 0.3, 0],
        [w * 0.45, h * 0.35],
        [w * 0.72, h * 0.68],
        [w, h * 0.85],
        [w, h],
        [0, h],
      ];
    case 'torus':
      return [
        [0, 0],
        [w * 0.65, 0],
        [w * 0.92, h * 0.25],
        [w, h * 0.5],
        [w * 0.92, h * 0.75],
        [w * 0.65, h],
        [0, h],
      ];
    case 'baseboard':
      return [
        [0, 0],
        [w, 0],
        [w, h * 0.7],
        [w * 0.8, h * 0.85],
        [w * 0.5, h * 0.94],
        [0, h],
      ];
    case 'stepped':
      return [
        [0, 0],
        [w * 0.4, 0],
        [w * 0.4, h * 0.35],
        [w * 0.7, h * 0.35],
        [w * 0.7, h * 0.7],
        [w, h * 0.7],
        [w, h],
        [0, h],
      ];
    case 'ogee':
    case 'cyma_recta':
    case 'cornice':
    default:
      return [
        [0, 0],
        [w * 0.35, 0],
        [w * 0.35, h * 0.2],
        [w * 0.62, h * 0.38],
        [w * 0.82, h * 0.65],
        [w, h * 0.82],
        [w, h],
        [0, h],
      ];
  }
}

/**
 * Sweeps a 2D molding profile along a 3D polyline with exact tangent-bisector mitered corners
 * so rectangular frames, room baseboards, and roof cornices have sharp, distortion-free corners.
 */
export function buildMoldingMesh(scene: Scene, name: string, opts: MoldingBuildOptions): Mesh {
  const rawPath = Array.isArray(opts.path) ? opts.path : [];
  const pathPts: Vector3[] = rawPath.map((p) =>
    Array.isArray(p)
      ? new Vector3(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0)
      : new Vector3(Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0)
  );
  if (pathPts.length < 2) {
    throw new Error('modeler_create_molding requires at least 2 path points.');
  }

  const closed = !!opts.closed;
  const width = Math.max(0.01, Number(opts.width ?? 0.15));
  const height = Math.max(0.01, Number(opts.height ?? 0.18));
  const profile = getMoldingProfilePoints(opts.profile || 'cornice', width, height, opts.profilePoints);
  const profCount = profile.length;
  const nPts = pathPts.length;

  // Compute segment tangents and outward horizontal normals
  const segTangents: Vector3[] = [];
  const segCount = closed ? nPts : nPts - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = pathPts[i];
    const p1 = pathPts[(i + 1) % nPts];
    const dir = p1.subtract(p0);
    if (dir.lengthSquared() < 1e-8) {
      segTangents.push(new Vector3(1, 0, 0));
    } else {
      segTangents.push(dir.normalize());
    }
  }

  const up = Vector3.Up();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let accumLen = 0;
  for (let i = 0; i < nPts; i++) {
    if (i > 0) {
      accumLen += Vector3.Distance(pathPts[i - 1], pathPts[i]);
    }
    const tPrev = closed ? segTangents[(i - 1 + segCount) % segCount] : segTangents[Math.max(0, i - 1)];
    const tNext = closed ? segTangents[i % segCount] : segTangents[Math.min(segCount - 1, i)];

    // Outward right-hand normal in XZ plane: (t.z, 0, -t.x) or up x tangent
    let nPrev = Vector3.Cross(up, tPrev);
    if (nPrev.lengthSquared() < 1e-6) nPrev = new Vector3(1, 0, 0);
    else nPrev.normalize();

    let nNext = Vector3.Cross(up, tNext);
    if (nNext.lengthSquared() < 1e-6) nNext = new Vector3(1, 0, 0);
    else nNext.normalize();

    let miter = nPrev.add(nNext);
    if (miter.lengthSquared() < 1e-6) {
      miter = nNext.clone();
    } else {
      miter.normalize();
    }
    const dot = Math.max(0.25, Vector3.Dot(miter, nNext));
    const miterScale = Math.min(2.5, 1.0 / dot);
    const outVec = miter.scale(miterScale);

    const pt = pathPts[i];
    for (let j = 0; j < profCount; j++) {
      const [px, py] = profile[j];
      const vx = pt.x + outVec.x * px;
      const vy = pt.y + py;
      const vz = pt.z + outVec.z * px;
      positions.push(vx, vy, vz);
      uvs.push(accumLen, j / profCount);
    }
  }

  const ringCount = closed ? nPts : nPts - 1;
  for (let i = 0; i < ringCount; i++) {
    const r0 = i * profCount;
    const r1 = ((i + 1) % nPts) * profCount;
    for (let j = 0; j < profCount; j++) {
      const jNext = (j + 1) % profCount;
      const a = r0 + j;
      const b = r1 + j;
      const c = r1 + jNext;
      const d = r0 + jNext;
      indices.push(a, c, b, a, d, c);
    }
  }

  // Cap open ends
  if (!closed && profCount >= 3) {
    const startBase = 0;
    const endBase = (nPts - 1) * profCount;
    for (let j = 1; j < profCount - 1; j++) {
      indices.push(startBase, startBase + j + 1, startBase + j);
      indices.push(endBase, endBase + j, endBase + j + 1);
    }
  }

  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  const normals = new Float32Array(positions.length);
  VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.applyToMesh(mesh, true);
  return mesh;
}

/**
 * Builds straight, spiral, or L-shaped staircases standing on Y = 0, with beveled treads,
 * stringers/risers, and optional railings.
 */
export function buildStairsMesh(scene: Scene, name: string, opts: StairsBuildOptions = {}): Mesh {
  const style = (opts.style || 'straight').toLowerCase();
  const steps = Math.max(2, Math.min(80, Math.round(opts.steps ?? 10)));
  const width = Math.max(0.3, Number(opts.width ?? 1.2));
  const stepRise =
    opts.stepRise !== undefined
      ? Math.max(0.05, Number(opts.stepRise))
      : opts.height !== undefined
        ? Math.max(0.05, Number(opts.height) / steps)
        : 0.18;
  const stepRun =
    opts.stepRun !== undefined
      ? Math.max(0.08, Number(opts.stepRun))
      : opts.length !== undefined
        ? Math.max(0.08, Number(opts.length) / steps)
        : 0.28;
  const nosing = Math.max(0, Number(opts.nosing ?? 0.025));
  const railingOpt =
    opts.railing === true
      ? 'both'
      : opts.railing === false || !opts.railing
        ? 'none'
        : String(opts.railing).toLowerCase();
  const railingHeight = Math.max(0.4, Number(opts.railingHeight ?? 0.9));

  const parts: Mesh[] = [];

  if (style === 'spiral') {
    const innerR = Math.max(0.08, Number(opts.innerRadius ?? 0.2));
    const outerR = innerR + width;
    const totalAngleRad = ((Number(opts.totalAngleDegrees ?? 270) || 270) * Math.PI) / 180;
    const dAngle = totalAngleRad / steps;
    const totalH = steps * stepRise;

    // Central column
    const centerPole = MeshBuilder.CreateCylinder(
      `${name}_center_pole`,
      { height: totalH + railingHeight, diameter: innerR * 2, tessellation: 20 },
      scene
    );
    centerPole.position.set(0, (totalH + railingHeight) * 0.5, 0);
    centerPole.bakeCurrentTransformIntoVertices();
    parts.push(centerPole);

    const railPath: Vector3[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i + 0.5) * dAngle;
      const yTop = (i + 1) * stepRise;
      const midR = (innerR + outerR) * 0.5;
      const arcChord = Math.max(0.12, midR * Math.abs(dAngle) + nosing);
      const treadH = Math.min(0.06, stepRise * 0.4);

      const tread = createRoundedBoxMesh(
        `${name}_spiral_tread_${i}`,
        { width: outerR - innerR, height: treadH, depth: arcChord, radius: 0.01, segments: 2 },
        scene
      );
      tread.rotation.y = -a;
      tread.position.set(Math.cos(a) * midR, yTop - treadH * 0.5, Math.sin(a) * midR);
      tread.bakeCurrentTransformIntoVertices();
      parts.push(tread);

      if (railingOpt !== 'none') {
        const rx = Math.cos(a) * (outerR - 0.05);
        const rz = Math.sin(a) * (outerR - 0.05);
        const post = MeshBuilder.CreateCylinder(
          `${name}_spiral_post_${i}`,
          { height: railingHeight, diameter: 0.035, tessellation: 10 },
          scene
        );
        post.position.set(rx, yTop + railingHeight * 0.5, rz);
        post.bakeCurrentTransformIntoVertices();
        parts.push(post);
        railPath.push(new Vector3(rx, yTop + railingHeight, rz));
      }
    }

    if (railPath.length >= 2) {
      const handrail = MeshBuilder.CreateTube(
        `${name}_spiral_rail`,
        { path: railPath, radius: 0.028, tessellation: 12 },
        scene
      );
      parts.push(handrail);
    }

    return makeUpdatableMerged(parts, name, scene);
  }

  // Straight staircase along +Z (from z = 0 to z = steps * stepRun, y = 0 to y = steps * stepRise)
  const treadThickness = Math.min(0.055, stepRise * 0.35);
  const includeSolidSteps = opts.stringers !== false;

  for (let i = 0; i < steps; i++) {
    const yTop = (i + 1) * stepRise;
    const zCenter = (i + 0.5) * stepRun;

    // Beveled tread with front nosing overhang
    const tread = createRoundedBoxMesh(
      `${name}_tread_${i}`,
      {
        width: width + nosing,
        height: treadThickness,
        depth: stepRun + nosing,
        radius: Math.min(0.012, treadThickness * 0.35),
        segments: 2,
      },
      scene
    );
    tread.position.set(0, yTop - treadThickness * 0.5, zCenter - nosing * 0.5);
    tread.bakeCurrentTransformIntoVertices();
    parts.push(tread);

    // Riser / step body
    if (includeSolidSteps) {
      const bodyH = yTop - treadThickness;
      if (bodyH > 0.01) {
        const riserBox = MeshBuilder.CreateBox(
          `${name}_riser_${i}`,
          { width, height: bodyH, depth: stepRun },
          scene
        );
        riserBox.position.set(0, bodyH * 0.5, zCenter);
        riserBox.bakeCurrentTransformIntoVertices();
        parts.push(riserBox);
      }
    }
  }

  // Optional Railings (left: -X, right: +X, or both)
  const sides: number[] = [];
  if (railingOpt === 'left' || railingOpt === 'both') sides.push(-1);
  if (railingOpt === 'right' || railingOpt === 'both') sides.push(1);

  for (const side of sides) {
    const rx = side * (width * 0.5 - 0.04);
    const railPts: Vector3[] = [];
    for (let i = 0; i < steps; i++) {
      const yTop = (i + 1) * stepRise;
      const rz = (i + 0.5) * stepRun;
      const isEndPost = i === 0 || i === steps - 1;
      const post = MeshBuilder.CreateCylinder(
        `${name}_post_${side}_${i}`,
        {
          height: railingHeight,
          diameter: isEndPost ? 0.065 : 0.032,
          tessellation: 10,
        },
        scene
      );
      post.position.set(rx, yTop + railingHeight * 0.5, rz);
      post.bakeCurrentTransformIntoVertices();
      parts.push(post);
      railPts.push(new Vector3(rx, yTop + railingHeight, rz));
    }
    if (railPts.length >= 2) {
      const rail = MeshBuilder.CreateTube(
        `${name}_handrail_${side}`,
        { path: railPts, radius: 0.028, tessellation: 12, cap: Mesh.CAP_ALL },
        scene
      );
      parts.push(rail);
    }
  }

  return makeUpdatableMerged(parts, name, scene);
}

/**
 * Builds a parametric architectural roof standing on Y = 0 with eaves overhang,
 * real fascia slab thickness, ridge cap, and gable end walls.
 */
export function buildRoofMesh(scene: Scene, name: string, opts: RoofBuildOptions = {}): Mesh {
  const style = (opts.style || 'gable').toLowerCase();
  const width = Math.max(0.4, Number(opts.width ?? 4.0));
  const depth = Math.max(0.4, Number(opts.depth ?? 4.0));
  const overhang = Math.max(0, Number(opts.overhang ?? 0.25));
  const thickness = Math.max(0.04, Number(opts.thickness ?? 0.14));

  const pitchRad = opts.pitchDegrees
    ? (Math.max(5, Math.min(75, Number(opts.pitchDegrees))) * Math.PI) / 180
    : Math.atan2(1.4, width * 0.5);
  const height =
    opts.height !== undefined
      ? Math.max(0.15, Number(opts.height))
      : Math.max(0.2, width * 0.5 * Math.tan(pitchRad));

  const totalW = width + overhang * 2;
  const totalD = depth + overhang * 2;
  const hw = totalW * 0.5;
  const hd = totalD * 0.5;

  const parts: Mesh[] = [];

  if (style === 'dome') {
    const dome = MeshBuilder.CreateSphere(
      `${name}_dome`,
      {
        diameterX: totalW,
        diameterY: height * 2,
        diameterZ: totalD,
        slice: 0.5,
        segments: 24,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene
    );
    const vd = VertexData.ExtractFromMesh(dome);
    vd.applyToMesh(dome, true);
    return dome;
  }

  if (style === 'pyramid' || style === 'hip') {
    const ridgeHalfLen = style === 'pyramid' ? 0 : Math.max(0, hd - hw);
    const positions = [
      // Bottom perimeter (0..3)
      -hw, 0, -hd,
      hw, 0, -hd,
      hw, 0, hd,
      -hw, 0, hd,
      // Ridge endpoints (4, 5)
      0, height, -ridgeHalfLen,
      0, height, ridgeHalfLen,
    ];
    const indices = [
      // Bottom quad
      0, 1, 2, 0, 2, 3,
      // Front slope (-Z)
      0, 4, 1,
      // Back slope (+Z)
      2, 5, 3,
      // Right slope (+X)
      1, 4, 5, 1, 5, 2,
      // Left slope (-X)
      3, 5, 4, 3, 4, 0,
    ];
    // Convert to flat-shaded crisp architectural faces by unsharing vertices per triangle
    const flatPos: number[] = [];
    const flatIdx: number[] = [];
    const flatUV: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3;
      const b = indices[i + 1] * 3;
      const c = indices[i + 2] * 3;
      const baseV = flatPos.length / 3;
      flatPos.push(
        positions[a], positions[a + 1], positions[a + 2],
        positions[b], positions[b + 1], positions[b + 2],
        positions[c], positions[c + 1], positions[c + 2]
      );
      flatUV.push(0, 0, 1, 0, 0.5, 1);
      flatIdx.push(baseV, baseV + 1, baseV + 2);
    }
    const hipMesh = new Mesh(`${name}_hip`, scene);
    const vd = new VertexData();
    const normals = new Float32Array(flatPos.length);
    VertexData.ComputeNormals(flatPos, flatIdx, normals);
    vd.positions = flatPos;
    vd.indices = flatIdx;
    vd.normals = normals;
    vd.uvs = flatUV;
    vd.applyToMesh(hipMesh, true);
    parts.push(hipMesh);

    // Fascia eave trim band around base
    const fascia = createRoundedBoxMesh(
      `${name}_fascia`,
      { width: totalW, height: thickness, depth: totalD, radius: 0.01, segments: 1 },
      scene
    );
    fascia.position.set(0, thickness * 0.5, 0);
    fascia.bakeCurrentTransformIntoVertices();
    parts.push(fascia);
    return makeUpdatableMerged(parts, name, scene);
  }

  if (style === 'shed') {
    const slopeLen = Math.hypot(totalW, height);
    const angle = Math.atan2(height, totalW);
    const slab = createRoundedBoxMesh(
      `${name}_shed_slab`,
      { width: slopeLen, height: thickness, depth: totalD, radius: 0.012, segments: 2 },
      scene
    );
    slab.rotation.z = angle;
    slab.position.set(0, height * 0.5 + thickness * 0.5, 0);
    slab.bakeCurrentTransformIntoVertices();
    parts.push(slab);
    return makeUpdatableMerged(parts, name, scene);
  }

  // Gable, Gambrel, or Mansard roof
  const slopeRun = hw;
  const slopeLen = Math.hypot(slopeRun, height);
  const slopeAngle = Math.atan2(height, slopeRun);

  for (const side of [-1, 1]) {
    const slab = createRoundedBoxMesh(
      `${name}_slope_${side}`,
      { width: slopeLen + thickness * 0.5, height: thickness, depth: totalD, radius: 0.012, segments: 2 },
      scene
    );
    slab.rotation.z = -side * slopeAngle;
    slab.position.set(side * (slopeRun * 0.5), height * 0.5 + thickness * 0.4, 0);
    slab.bakeCurrentTransformIntoVertices();
    parts.push(slab);
  }

  // Optional Ridge Cap beam along the peak
  if (opts.ridgeCap !== false) {
    const ridge = createRoundedBoxMesh(
      `${name}_ridge_cap`,
      { width: thickness * 1.6, height: thickness * 1.2, depth: totalD + 0.04, radius: 0.015, segments: 2 },
      scene
    );
    ridge.position.set(0, height + thickness * 0.45, 0);
    ridge.bakeCurrentTransformIntoVertices();
    parts.push(ridge);
  }

  // Optional Gable Triangular End Walls (inward of overhang)
  if (opts.gableWall !== false) {
    const gw = width * 0.5;
    const gableShape: Vector3[] = [
      new Vector3(-gw, 0, 0),
      new Vector3(gw, 0, 0),
      new Vector3(0, 0, height),
    ];
    const gableMesh = MeshBuilder.ExtrudePolygon(
      `${name}_gable_core`,
      { shape: gableShape, depth, sideOrientation: Mesh.DOUBLESIDE, updatable: true },
      scene,
      earcut
    );
    gableMesh.rotation.x = -Math.PI / 2;
    gableMesh.position.set(0, 0, -depth * 0.5);
    gableMesh.bakeCurrentTransformIntoVertices();
    parts.push(gableMesh);
  }

  return makeUpdatableMerged(parts, name, scene);
}
