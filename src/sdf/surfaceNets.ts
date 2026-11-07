import { Color3, Vector3, VertexData } from '@babylonjs/core';
import {
  CompiledSdfPart,
  computeSdfNormal,
  evaluateSdfColor,
  evaluateSdfScene,
} from './sdfPrimitives';

export interface SurfaceNetsOptions {
  resolution?: number;
  smoothIterations?: number;
  defaultColor?: string;
  computeVertexColors?: boolean;
}

export interface SurfaceNetsResult {
  vertexData: VertexData;
  resolution: { nx: number; ny: number; nz: number; cellSize: number };
  bounds: { min: Vector3; max: Vector3; size: Vector3 };
  hasVertexColors: boolean;
}

const CUBE_CORNERS: ReadonlyArray<[number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];

const CUBE_EDGES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7], // X-aligned edges
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7], // Y-aligned edges
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7], // Z-aligned edges
];

/**
 * Extracts a crack-free, watertight indexed triangle mesh from compiled SDF primitives
 * using Surface Nets with Newton isosurface projection, Taubin/Laplacian smoothing,
 * analytical SDF gradient normals, and box/triplanar UVs.
 */
export function extractSdfSurfaceNets(
  parts: CompiledSdfPart[],
  options: SurfaceNetsOptions = {}
): SurfaceNetsResult {
  if (!parts || parts.length === 0) {
    throw new Error('Cannot extract SDF mesh: no SDF parts provided.');
  }

  // 1. Compute overall bounding box from union/intersect parts (or all parts if none are union)
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const positiveParts = parts.filter((p) => p.op !== 'subtract');
  const boundSource = positiveParts.length > 0 ? positiveParts : parts;

  for (const p of boundSource) {
    if (p.shape === 'plane') continue;
    minX = Math.min(minX, p.boundsMin.x);
    minY = Math.min(minY, p.boundsMin.y);
    minZ = Math.min(minZ, p.boundsMin.z);
    maxX = Math.max(maxX, p.boundsMax.x);
    maxY = Math.max(maxY, p.boundsMax.y);
    maxZ = Math.max(maxZ, p.boundsMax.z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    minX = -1;
    minY = -1;
    minZ = -1;
    maxX = 1;
    maxY = 1;
    maxZ = 1;
  }

  const spanX = Math.max(0.05, maxX - minX);
  const spanY = Math.max(0.05, maxY - minY);
  const spanZ = Math.max(0.05, maxZ - minZ);
  const maxSpan = Math.max(spanX, spanY, spanZ);

  const longestAxisCells = Math.max(16, Math.min(128, Math.round(options.resolution || 56)));
  const cellSize = maxSpan / longestAxisCells;

  // Add 2-cell margin on each side so the zero-isosurface is strictly enclosed
  const margin = cellSize * 2.2;
  const originX = minX - margin;
  const originY = minY - margin;
  const originZ = minZ - margin;

  const totalX = spanX + margin * 2;
  const totalY = spanY + margin * 2;
  const totalZ = spanZ + margin * 2;

  const nx = Math.max(6, Math.min(136, Math.ceil(totalX / cellSize)));
  const ny = Math.max(6, Math.min(136, Math.ceil(totalY / cellSize)));
  const nz = Math.max(6, Math.min(136, Math.ceil(totalZ / cellSize)));

  const gxCount = nx + 1;
  const gyCount = ny + 1;
  const gzCount = nz + 1;
  const strideY = gxCount;
  const strideZ = gxCount * gyCount;

  // 2. Sample SDF on grid corners
  const grid = new Float32Array(gxCount * gyCount * gzCount);
  for (let iz = 0; iz < gzCount; iz++) {
    const wz = originZ + iz * cellSize;
    const zOff = iz * strideZ;
    for (let iy = 0; iy < gyCount; iy++) {
      const wy = originY + iy * cellSize;
      const yzOff = zOff + iy * strideY;
      for (let ix = 0; ix < gxCount; ix++) {
        const wx = originX + ix * cellSize;
        grid[yzOff + ix] = evaluateSdfScene(parts, wx, wy, wz);
      }
    }
  }

  // 3. Identify active cells with sign changes and place dual vertices
  const cellStrideY = nx;
  const cellStrideZ = nx * ny;
  const cellVertIndex = new Int32Array(nx * ny * nz);
  cellVertIndex.fill(-1);

  const posArray: number[] = [];
  const cornerVals = new Float32Array(8);
  const cornerX = new Float32Array(8);
  const cornerY = new Float32Array(8);
  const cornerZ = new Float32Array(8);
  const eps = Math.max(1e-4, cellSize * 0.25);

  for (let cz = 0; cz < nz; cz++) {
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = CUBE_CORNERS[c];
          const gx = cx + dx;
          const gy = cy + dy;
          const gz = cz + dz;
          const val = grid[gz * strideZ + gy * strideY + gx];
          cornerVals[c] = val;
          if (val < 0) {
            mask |= 1 << c;
          }
        }

        if (mask === 0 || mask === 255) {
          continue;
        }

        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = CUBE_CORNERS[c];
          cornerX[c] = originX + (cx + dx) * cellSize;
          cornerY[c] = originY + (cy + dy) * cellSize;
          cornerZ[c] = originZ + (cz + dz) * cellSize;
        }

        // Average all sign-changing edge intersections
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let crossings = 0;

        for (let e = 0; e < 12; e++) {
          const [c0, c1] = CUBE_EDGES[e];
          const v0 = cornerVals[c0];
          const v1 = cornerVals[c1];
          if ((v0 < 0) !== (v1 < 0)) {
            const denom = v0 - v1;
            const t = Math.abs(denom) > 1e-8 ? Math.max(0, Math.min(1, v0 / denom)) : 0.5;
            sumX += cornerX[c0] + (cornerX[c1] - cornerX[c0]) * t;
            sumY += cornerY[c0] + (cornerY[c1] - cornerY[c0]) * t;
            sumZ += cornerZ[c0] + (cornerZ[c1] - cornerZ[c0]) * t;
            crossings++;
          }
        }

        let vx = crossings > 0 ? sumX / crossings : originX + (cx + 0.5) * cellSize;
        let vy = crossings > 0 ? sumY / crossings : originY + (cy + 0.5) * cellSize;
        let vz = crossings > 0 ? sumZ / crossings : originZ + (cz + 0.5) * cellSize;

        // Project 1 damped Newton step onto exact SDF zero-isosurface, clamped to cell bounds
        const dVal = evaluateSdfScene(parts, vx, vy, vz);
        if (Math.abs(dVal) < cellSize * 0.85) {
          const n = computeSdfNormal(parts, vx, vy, vz, eps);
          const step = Math.max(-cellSize * 0.4, Math.min(cellSize * 0.4, dVal * 0.75));
          vx -= n.x * step;
          vy -= n.y * step;
          vz -= n.z * step;
        }

        const vIdx = posArray.length / 3;
        posArray.push(vx, vy, vz);
        cellVertIndex[cz * cellStrideZ + cy * cellStrideY + cx] = vIdx;
      }
    }
  }

  // 4. Emit quads across interior grid edges where sign changes
  const indices: number[] = [];
  const getCellVert = (cx: number, cy: number, cz: number): number =>
    cellVertIndex[cz * cellStrideZ + cy * cellStrideY + cx];

  const emitQuad = (v0: number, v1: number, v2: number, v3: number, flip: boolean) => {
    if (v0 < 0 || v1 < 0 || v2 < 0 || v3 < 0) return;
    if (flip) {
      indices.push(v0, v2, v1, v0, v3, v2);
    } else {
      indices.push(v0, v1, v2, v0, v2, v3);
    }
  };

  // X-aligned edges: between (ix, iy, iz) and (ix+1, iy, iz), surrounded by 4 cells in (iy-1..iy, iz-1..iz)
  for (let iz = 1; iz < nz; iz++) {
    for (let iy = 1; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const s0 = grid[iz * strideZ + iy * strideY + ix];
        const s1 = grid[iz * strideZ + iy * strideY + (ix + 1)];
        if ((s0 < 0) !== (s1 < 0)) {
          const v0 = getCellVert(ix, iy - 1, iz - 1);
          const v1 = getCellVert(ix, iy, iz - 1);
          const v2 = getCellVert(ix, iy, iz);
          const v3 = getCellVert(ix, iy - 1, iz);
          // (v1-v0) is +Y, (v2-v0) is +Y+Z => (v1-v0)x(v2-v0) points in +X
          // If s0 < 0 and s1 >= 0, outward gradient is +X, so flip = false
          emitQuad(v0, v1, v2, v3, s0 >= 0);
        }
      }
    }
  }

  // Y-aligned edges: between (ix, iy, iz) and (ix, iy+1, iz), surrounded by 4 cells in (ix-1..ix, iz-1..iz)
  for (let iz = 1; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 1; ix < nx; ix++) {
        const s0 = grid[iz * strideZ + iy * strideY + ix];
        const s1 = grid[iz * strideZ + (iy + 1) * strideY + ix];
        if ((s0 < 0) !== (s1 < 0)) {
          const v0 = getCellVert(ix - 1, iy, iz - 1);
          const v1 = getCellVert(ix - 1, iy, iz);
          const v2 = getCellVert(ix, iy, iz);
          const v3 = getCellVert(ix, iy, iz - 1);
          // (v1-v0) is +Z, (v2-v0) is +X+Z => (v1-v0)x(v2-v0) points in +Y
          emitQuad(v0, v1, v2, v3, s0 >= 0);
        }
      }
    }
  }

  // Z-aligned edges: between (ix, iy, iz) and (ix, iy, iz+1), surrounded by 4 cells in (ix-1..ix, iy-1..iy)
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 1; iy < ny; iy++) {
      for (let ix = 1; ix < nx; ix++) {
        const s0 = grid[iz * strideZ + iy * strideY + ix];
        const s1 = grid[(iz + 1) * strideZ + iy * strideY + ix];
        if ((s0 < 0) !== (s1 < 0)) {
          const v0 = getCellVert(ix - 1, iy - 1, iz);
          const v1 = getCellVert(ix, iy - 1, iz);
          const v2 = getCellVert(ix, iy, iz);
          const v3 = getCellVert(ix - 1, iy, iz);
          // (v1-v0) is +X, (v2-v0) is +X+Y => (v1-v0)x(v2-v0) points in +Z
          emitQuad(v0, v1, v2, v3, s0 >= 0);
        }
      }
    }
  }

  const vertCount = posArray.length / 3;
  let positions = new Float32Array(posArray);

  // 5. Optional Taubin / Laplacian surface smoothing + SDF re-projection
  const smoothIterations = Math.max(0, Math.min(5, options.smoothIterations ?? 1));
  if (smoothIterations > 0 && vertCount > 0 && indices.length > 0) {
    const adjOffsets = new Int32Array(vertCount + 1);
    const degCounts = new Int32Array(vertCount);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      degCounts[a] += 2;
      degCounts[b] += 2;
      degCounts[c] += 2;
    }
    for (let v = 0; v < vertCount; v++) {
      adjOffsets[v + 1] = adjOffsets[v] + degCounts[v];
    }
    const adjList = new Int32Array(adjOffsets[vertCount]);
    const cursor = new Int32Array(adjOffsets);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      adjList[cursor[a]++] = b;
      adjList[cursor[a]++] = c;
      adjList[cursor[b]++] = a;
      adjList[cursor[b]++] = c;
      adjList[cursor[c]++] = a;
      adjList[cursor[c]++] = b;
    }

    const nextPositions = new Float32Array(positions.length);
    const lambda = 0.35;
    for (let iter = 0; iter < smoothIterations; iter++) {
      for (let v = 0; v < vertCount; v++) {
        const start = adjOffsets[v];
        const end = adjOffsets[v + 1];
        const count = end - start;
        const idx = v * 3;
        if (count === 0) {
          nextPositions[idx] = positions[idx];
          nextPositions[idx + 1] = positions[idx + 1];
          nextPositions[idx + 2] = positions[idx + 2];
          continue;
        }
        let ax = 0;
        let ay = 0;
        let az = 0;
        for (let k = start; k < end; k++) {
          const nb = adjList[k] * 3;
          ax += positions[nb];
          ay += positions[nb + 1];
          az += positions[nb + 2];
        }
        ax /= count;
        ay /= count;
        az /= count;

        let nxPos = positions[idx] + (ax - positions[idx]) * lambda;
        let nyPos = positions[idx + 1] + (ay - positions[idx + 1]) * lambda;
        let nzPos = positions[idx + 2] + (az - positions[idx + 2]) * lambda;

        // Re-project toward exact SDF surface so volume never shrinks
        const dVal = evaluateSdfScene(parts, nxPos, nyPos, nzPos);
        if (Math.abs(dVal) < cellSize) {
          const n = computeSdfNormal(parts, nxPos, nyPos, nzPos, eps);
          nxPos -= n.x * dVal * 0.6;
          nyPos -= n.y * dVal * 0.6;
          nzPos -= n.z * dVal * 0.6;
        }

        nextPositions[idx] = nxPos;
        nextPositions[idx + 1] = nyPos;
        nextPositions[idx + 2] = nzPos;
      }
      positions.set(nextPositions);
    }
  }

  // 6. Compute analytical SDF normals, UVs, bounds, and optional vertex colors
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const hasPartColors =
    options.computeVertexColors !== false && parts.some((p) => p.color !== null);
  const colors = hasPartColors ? new Float32Array(vertCount * 4) : null;
  const fallbackColor = Color3.FromHexString(
    options.defaultColor && /^#[0-9a-fA-F]{6}$/.test(options.defaultColor)
      ? options.defaultColor
      : '#d9b38c'
  );

  let actualMinX = Infinity;
  let actualMinY = Infinity;
  let actualMinZ = Infinity;
  let actualMaxX = -Infinity;
  let actualMaxY = -Infinity;
  let actualMaxZ = -Infinity;

  for (let v = 0; v < vertCount; v++) {
    const idx = v * 3;
    const vx = positions[idx];
    const vy = positions[idx + 1];
    const vz = positions[idx + 2];

    if (vx < actualMinX) actualMinX = vx;
    if (vy < actualMinY) actualMinY = vy;
    if (vz < actualMinZ) actualMinZ = vz;
    if (vx > actualMaxX) actualMaxX = vx;
    if (vy > actualMaxY) actualMaxY = vy;
    if (vz > actualMaxZ) actualMaxZ = vz;

    const n = computeSdfNormal(parts, vx, vy, vz, eps);
    normals[idx] = n.x;
    normals[idx + 1] = n.y;
    normals[idx + 2] = n.z;

    // Dominant-axis triplanar UV projection
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    const uvIdx = v * 2;
    if (ay >= ax && ay >= az) {
      uvs[uvIdx] = (vx - minX) / spanX;
      uvs[uvIdx + 1] = (vz - minZ) / spanZ;
    } else if (ax >= ay && ax >= az) {
      uvs[uvIdx] = (vz - minZ) / spanZ;
      uvs[uvIdx + 1] = (vy - minY) / spanY;
    } else {
      uvs[uvIdx] = (vx - minX) / spanX;
      uvs[uvIdx + 1] = (vy - minY) / spanY;
    }

    if (colors) {
      const c = evaluateSdfColor(parts, vx, vy, vz, fallbackColor);
      const cIdx = v * 4;
      colors[cIdx] = c.r;
      colors[cIdx + 1] = c.g;
      colors[cIdx + 2] = c.b;
      colors[cIdx + 3] = 1.0;
    }
  }

  if (!Number.isFinite(actualMinX)) {
    actualMinX = 0;
    actualMinY = 0;
    actualMinZ = 0;
    actualMaxX = 0;
    actualMaxY = 0;
    actualMaxZ = 0;
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  if (colors) {
    vertexData.colors = colors;
  }

  const bMin = new Vector3(actualMinX, actualMinY, actualMinZ);
  const bMax = new Vector3(actualMaxX, actualMaxY, actualMaxZ);

  return {
    vertexData,
    resolution: { nx, ny, nz, cellSize },
    bounds: {
      min: bMin,
      max: bMax,
      size: bMax.subtract(bMin),
    },
    hasVertexColors: !!colors,
  };
}

