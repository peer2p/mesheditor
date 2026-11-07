import { Mesh, Scene, Vector3, VertexData } from '@babylonjs/core';

export interface RoundedBoxOptions {
  width?: number;
  height?: number;
  depth?: number;
  size?: number;
  radius?: number;
  segments?: number;
}

/**
 * Generates an indexed VertexData for a beveled / rounded box where flat faces remain minimal quads
 * and only edges and corners are subdivided with smooth bevel rings.
 */
export function createRoundedBoxVertexData(options: RoundedBoxOptions = {}): VertexData {
  const baseSize = options.size ?? 1.0;
  const width = Math.max(0.002, Number(options.width ?? baseSize));
  const height = Math.max(0.002, Number(options.height ?? baseSize));
  const depth = Math.max(0.002, Number(options.depth ?? baseSize));

  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;

  const maxRadius = Math.min(hx, hy, hz) * 0.999;
  const rawRadius = options.radius !== undefined ? Number(options.radius) : Math.min(hx, hy, hz) * 0.1;
  const radius = Math.max(0, Math.min(maxRadius, rawRadius));
  const segments = radius > 1e-5 ? Math.max(1, Math.min(12, Math.round(options.segments ?? 3))) : 0;

  // Build 1D parameter grid along [-1, 1] where bevels live near the ends and the middle is a single span
  // Using integer-indexed grid over (2 * segments + 2) steps if radius > 0, or 2 steps if radius == 0
  const buildAxisCoords = (halfExtent: number): { pos: number[]; inner: number } => {
    const inner = Math.max(0, halfExtent - radius);
    if (segments === 0 || radius <= 1e-5) {
      return { pos: [-halfExtent, halfExtent], inner: halfExtent };
    }
    const coords: number[] = [];
    // Negative bevel: angle from PI to PI/2
    for (let i = 0; i <= segments; i++) {
      const theta = (Math.PI * 0.5 * i) / segments;
      coords.push(-inner - Math.cos(theta) * radius);
    }
    // Positive bevel: angle from PI/2 to 0
    for (let i = 0; i <= segments; i++) {
      const theta = (Math.PI * 0.5 * i) / segments;
      coords.push(inner + Math.sin(theta) * radius);
    }
    return { pos: coords, inner };
  };

  const xGrid = buildAxisCoords(hx);
  const yGrid = buildAxisCoords(hy);
  const zGrid = buildAxisCoords(hz);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const projectPointAndNormal = (
    x: number,
    y: number,
    z: number,
    fallbackNx: number,
    fallbackNy: number,
    fallbackNz: number
  ): { px: number; py: number; pz: number; nx: number; ny: number; nz: number } => {
    if (segments === 0 || radius <= 1e-5) {
      return { px: x, py: y, pz: z, nx: fallbackNx, ny: fallbackNy, nz: fallbackNz };
    }
    const cx = Math.max(-xGrid.inner, Math.min(xGrid.inner, x));
    const cy = Math.max(-yGrid.inner, Math.min(yGrid.inner, y));
    const cz = Math.max(-zGrid.inner, Math.min(zGrid.inner, z));
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-7) {
      return {
        px: cx + fallbackNx * radius,
        py: cy + fallbackNy * radius,
        pz: cz + fallbackNz * radius,
        nx: fallbackNx,
        ny: fallbackNy,
        nz: fallbackNz,
      };
    }
    const nx = dx / len;
    const ny = dy / len;
    const nz = dz / len;
    return {
      px: cx + nx * radius,
      py: cy + ny * radius,
      pz: cz + nz * radius,
      nx,
      ny,
      nz,
    };
  };

  const addPatch = (
    uCoords: number[],
    vCoords: number[],
    uSpan: number,
    vSpan: number,
    evalRaw: (u: number, v: number) => [number, number, number],
    faceNormal: [number, number, number],
    flipWinding: boolean
  ) => {
    const nu = uCoords.length;
    const nv = vCoords.length;
    const baseVert = positions.length / 3;

    for (let iv = 0; iv < nv; iv++) {
      const vVal = vCoords[iv];
      for (let iu = 0; iu < nu; iu++) {
        const uVal = uCoords[iu];
        const [rx, ry, rz] = evalRaw(uVal, vVal);
        const p = projectPointAndNormal(rx, ry, rz, faceNormal[0], faceNormal[1], faceNormal[2]);
        positions.push(p.px, p.py, p.pz);
        normals.push(p.nx, p.ny, p.nz);
        uvs.push(uVal / uSpan + 0.5, vVal / vSpan + 0.5);
      }
    }

    for (let iv = 0; iv < nv - 1; iv++) {
      for (let iu = 0; iu < nu - 1; iu++) {
        const i00 = baseVert + iv * nu + iu;
        const i10 = baseVert + iv * nu + (iu + 1);
        const i01 = baseVert + (iv + 1) * nu + iu;
        const i11 = baseVert + (iv + 1) * nu + (iu + 1);
        // Note: in Babylon ComputeNormals, triangle (A, B, C) has normal (B-A) x_RH (C-A)
        if (flipWinding) {
          indices.push(i00, i10, i11, i00, i11, i01);
        } else {
          indices.push(i00, i11, i10, i00, i01, i11);
        }
      }
    }
  };

  // +Z face: u = X (+right), v = Y (+up); (B-A)=+X, (C-A)=+Y -> +X x_RH +Y = +Z -> flipWinding = true
  addPatch(xGrid.pos, yGrid.pos, width, height, (u, v) => [u, v, hz], [0, 0, 1], true);
  // -Z face: u = X, v = Y; normal -Z -> flipWinding = false
  addPatch(xGrid.pos, yGrid.pos, width, height, (u, v) => [u, v, -hz], [0, 0, -1], false);
  // +X face: u = Z, v = Y; +Z x_RH +Y = -X -> for +X normal use flipWinding = false
  addPatch(zGrid.pos, yGrid.pos, depth, height, (u, v) => [hx, v, u], [1, 0, 0], false);
  // -X face: u = Z, v = Y; normal -X -> flipWinding = true
  addPatch(zGrid.pos, yGrid.pos, depth, height, (u, v) => [-hx, v, u], [-1, 0, 0], true);
  // +Y face: u = X, v = Z; +X x_RH +Z = -Y -> for +Y normal use flipWinding = false
  addPatch(xGrid.pos, zGrid.pos, width, depth, (u, v) => [u, hy, v], [0, 1, 0], false);
  // -Y face: u = X, v = Z; normal -Y -> flipWinding = true
  addPatch(xGrid.pos, zGrid.pos, width, depth, (u, v) => [u, -hy, v], [0, -1, 0], true);

  const vd = new VertexData();
  vd.positions = new Float32Array(positions);
  vd.normals = new Float32Array(normals);
  vd.uvs = new Float32Array(uvs);
  vd.indices = indices;
  return vd;
}

export function createRoundedBoxMesh(
  name: string,
  options: RoundedBoxOptions,
  scene: Scene
): Mesh {
  const mesh = new Mesh(name, scene);
  const vd = createRoundedBoxVertexData(options);
  vd.applyToMesh(mesh, true);
  return mesh;
}

