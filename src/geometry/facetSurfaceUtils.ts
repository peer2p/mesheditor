import {
  Material,
  Mesh,
  MultiMaterial,
  PBRMaterial,
  SubMesh,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';

export interface FacetCornerUV {
  vertexIndex: number;
  u: number;
  v: number;
}

export interface FacetUVInfo {
  faceIds: number[];
  isQuad: boolean;
  corners: FacetCornerUV[];
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  hasUVs: boolean;
}

export interface FacetMaterialInfo {
  materialIndex: number;
  material: Material | null;
  materialName: string;
  totalSlots: number;
  subMeshIndex: number;
}

export interface SubMeshDescriptor {
  materialIndex: number;
  verticesStart: number;
  verticesCount: number;
  indexStart: number;
  indexCount: number;
}

export interface MeshSurfaceSnapshot {
  buffers: Record<string, number[]>;
  indices: number[];
  material: Material | null;
  multiSubMaterials?: (Material | null)[];
  subMeshes: SubMeshDescriptor[];
}

export interface FacetUVProjectionOptions {
  uMin?: number;
  uMax?: number;
  vMin?: number;
  vMax?: number;
  scaleU?: number;
  scaleV?: number;
  offsetU?: number;
  offsetV?: number;
  rotationDeg?: number;
  flipU?: boolean;
  flipV?: boolean;
}

export interface FacetUVTransformOptions {
  rotateDeg?: number;
  flipU?: boolean;
  flipV?: boolean;
  scaleU?: number;
  scaleV?: number;
  offsetU?: number;
  offsetV?: number;
}

const KNOWN_VERTEX_KINDS: string[] = [
  VertexBuffer.PositionKind,
  VertexBuffer.NormalKind,
  VertexBuffer.UVKind,
  VertexBuffer.UV2Kind,
  VertexBuffer.ColorKind,
  VertexBuffer.TangentKind,
  VertexBuffer.MatricesIndicesKind,
  VertexBuffer.MatricesWeightsKind,
];

function getPresentVertexKinds(mesh: Mesh): string[] {
  const kinds = new Set<string>(mesh.getVerticesDataKinds?.() || []);
  for (const k of KNOWN_VERTEX_KINDS) {
    if (mesh.isVerticesDataPresent(k)) {
      kinds.add(k);
    }
  }
  return Array.from(kinds);
}

function getKindStride(mesh: Mesh, kind: string): number {
  const vb = mesh.getVertexBuffer(kind);
  if (vb) {
    const stride = vb.getStrideSize();
    if (stride > 0) return stride;
  }
  switch (kind) {
    case VertexBuffer.UVKind:
    case VertexBuffer.UV2Kind:
      return 2;
    case VertexBuffer.ColorKind:
    case VertexBuffer.TangentKind:
    case VertexBuffer.MatricesIndicesKind:
    case VertexBuffer.MatricesWeightsKind:
      return 4;
    default:
      return 3;
  }
}

function snapshotSubMeshes(mesh: Mesh): SubMeshDescriptor[] {
  if (!mesh.subMeshes || mesh.subMeshes.length === 0) return [];
  return mesh.subMeshes.map((sm) => ({
    materialIndex: sm.materialIndex,
    verticesStart: sm.verticesStart,
    verticesCount: sm.verticesCount,
    indexStart: sm.indexStart,
    indexCount: sm.indexCount,
  }));
}

function restoreSubMeshes(mesh: Mesh, descriptors: SubMeshDescriptor[], totalVerts?: number): void {
  mesh.subMeshes = [];
  const vertCount = totalVerts ?? mesh.getTotalVertices();
  for (const d of descriptors) {
    new SubMesh(
      d.materialIndex,
      d.verticesStart,
      totalVerts !== undefined ? vertCount : d.verticesCount,
      d.indexStart,
      d.indexCount,
      mesh
    );
  }
}

/**
 * Captures a complete geometry, UV, material, and SubMesh snapshot for Undo/Redo.
 */
export function captureMeshSurfaceSnapshot(mesh: Mesh): MeshSurfaceSnapshot {
  const buffers: Record<string, number[]> = {};
  for (const kind of getPresentVertexKinds(mesh)) {
    const data = mesh.getVerticesData(kind);
    if (data) {
      buffers[kind] = Array.from(data);
    }
  }

  const indices = Array.from(mesh.getIndices() || []);
  const material = mesh.material;
  const multiSubMaterials =
    material instanceof MultiMaterial ? [...material.subMaterials] : undefined;

  return {
    buffers,
    indices,
    material,
    multiSubMaterials,
    subMeshes: snapshotSubMeshes(mesh),
  };
}

/**
 * Restores a previously captured geometry, UV, material, and SubMesh snapshot.
 */
export function restoreMeshSurfaceSnapshot(mesh: Mesh, snap: MeshSurfaceSnapshot): void {
  const existingKinds = getPresentVertexKinds(mesh);
  for (const kind of existingKinds) {
    if (!snap.buffers[kind]) {
      mesh.removeVerticesData(kind);
    }
  }
  for (const [kind, data] of Object.entries(snap.buffers)) {
    mesh.setVerticesData(kind, [...data], true);
  }
  mesh.setIndices([...snap.indices]);
  mesh.material = snap.material;
  if (snap.material instanceof MultiMaterial && snap.multiSubMaterials) {
    snap.material.subMaterials = [...snap.multiSubMaterials];
  }
  if (snap.subMeshes.length > 0) {
    restoreSubMeshes(mesh, snap.subMeshes);
  }
  mesh.refreshBoundingInfo();
}

/**
 * Returns the SubMesh materialIndex per triangle for the given mesh.
 */
export function getFaceTriangleMaterialIndices(mesh: Mesh): number[] {
  const indices = mesh.getIndices();
  if (!indices || indices.length < 3) return [];
  const triCount = Math.floor(indices.length / 3);
  const result = new Array<number>(triCount).fill(0);
  if (!mesh.subMeshes || mesh.subMeshes.length === 0) return result;

  for (const sm of mesh.subMeshes) {
    const startTri = Math.max(0, Math.floor(sm.indexStart / 3));
    const endTri = Math.min(triCount, Math.ceil((sm.indexStart + sm.indexCount) / 3));
    for (let t = startTri; t < endTri; t++) {
      result[t] = sm.materialIndex;
    }
  }
  return result;
}

/**
 * Resolves the SubMesh slot and active Material assigned to a specific triangle faceId.
 */
export function getFacetMaterialInfo(mesh: Mesh, faceId: number): FacetMaterialInfo {
  const subMeshes = mesh.subMeshes || [];
  const indexOffset = faceId * 3;
  let subMeshIndex = 0;
  let materialIndex = 0;
  let matchedSubMesh: SubMesh | null = null;

  for (let i = 0; i < subMeshes.length; i++) {
    const sm = subMeshes[i];
    if (indexOffset >= sm.indexStart && indexOffset < sm.indexStart + sm.indexCount) {
      subMeshIndex = i;
      materialIndex = sm.materialIndex;
      matchedSubMesh = sm;
      break;
    }
  }

  let material: Material | null = null;
  let totalSlots = 1;
  if (mesh.material instanceof MultiMaterial) {
    totalSlots = Math.max(1, mesh.material.subMaterials.length);
    material =
      mesh.material.subMaterials[materialIndex] ??
      matchedSubMesh?.getMaterial() ??
      null;
  } else {
    material = mesh.material;
  }

  return {
    materialIndex,
    material,
    materialName: material?.name || 'Default Material',
    totalSlots,
    subMeshIndex,
  };
}

/**
 * Resolves the active material list indexed by slot on the mesh.
 */
export function getMeshSlotMaterials(mesh: Mesh): (Material | null)[] {
  if (mesh.material instanceof MultiMaterial) {
    return [...mesh.material.subMaterials];
  }
  return [mesh.material];
}

/**
 * Rebuilds mesh indices and SubMeshes grouped by material slot, compacting unused slots
 * and collapsing back to a single Material when only one material remains.
 */
export function rebuildMeshSubMeshes(
  mesh: Mesh,
  triMaterials: number[],
  slotMaterials: (Material | null)[],
  preserveSingleOrder: boolean = true
): { faceIdMap: Int32Array; collapsedToSingle: boolean } {
  const indices = Array.from(mesh.getIndices() || []);
  const triCount = Math.floor(indices.length / 3);
  const faceIdMap = new Int32Array(triCount);

  if (triCount === 0) {
    return { faceIdMap, collapsedToSingle: true };
  }

  const scene = mesh.getScene();

  // Group triangles by resolved Material instance (or null fallback key) in first-seen slot order
  const groups: Array<{ key: string; material: Material | null; triangles: number[] }> = [];
  const keyToGroupIdx = new Map<string, number>();
  const matIds = new Map<Material, string>();
  let nextMatUid = 0;

  for (let t = 0; t < triCount; t++) {
    const slotIdx = triMaterials[t] ?? 0;
    const mat = slotMaterials[slotIdx] ?? slotMaterials[0] ?? null;
    let key = '__null__';
    if (mat) {
      let mid = matIds.get(mat);
      if (!mid) {
        mid = `m_${nextMatUid++}`;
        matIds.set(mat, mid);
      }
      key = mid;
    }

    let grpIdx = keyToGroupIdx.get(key);
    if (grpIdx === undefined) {
      grpIdx = groups.length;
      keyToGroupIdx.set(key, grpIdx);
      groups.push({ key, material: mat, triangles: [] });
    }
    groups[grpIdx].triangles.push(t);
  }

  if (groups.length <= 1) {
    const singleMat = groups[0]?.material ?? null;
    if (!preserveSingleOrder) {
      mesh.setIndices(indices);
    }
    for (let t = 0; t < triCount; t++) faceIdMap[t] = t;
    mesh.material = singleMat;
    mesh.subMeshes = [];
    new SubMesh(0, 0, mesh.getTotalVertices(), 0, indices.length, mesh);
    return { faceIdMap, collapsedToSingle: true };
  }

  const newIndices: number[] = [];
  const subMeshRanges: Array<{ materialIndex: number; indexStart: number; indexCount: number }> = [];
  const compactedMaterials: (Material | null)[] = [];
  let nextTri = 0;

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const grp = groups[gIdx];
    compactedMaterials.push(grp.material);
    const rangeStart = newIndices.length;

    for (const oldTri of grp.triangles) {
      faceIdMap[oldTri] = nextTri++;
      newIndices.push(
        indices[oldTri * 3],
        indices[oldTri * 3 + 1],
        indices[oldTri * 3 + 2]
      );
    }

    const rangeCount = newIndices.length - rangeStart;
    subMeshRanges.push({
      materialIndex: gIdx,
      indexStart: rangeStart,
      indexCount: rangeCount,
    });
  }

  const multiMat = new MultiMaterial(`${mesh.name}_MultiMat`, scene);
  multiMat.subMaterials = compactedMaterials;

  mesh.setIndices(newIndices);
  mesh.material = multiMat;
  mesh.subMeshes = [];
  const totalVerts = mesh.getTotalVertices();
  for (const r of subMeshRanges) {
    new SubMesh(r.materialIndex, 0, totalVerts, r.indexStart, r.indexCount, mesh);
  }

  return { faceIdMap, collapsedToSingle: false };
}

/**
 * Ensures any vertices shared between targetFaceIds and other faces are duplicated
 * so facet-level UV modifications never distort neighboring faces.
 * Also initializes UVKind if missing on the mesh.
 */
export function isolateFacetVertices(mesh: Mesh, targetFaceIds: number[]): void {
  const indices = Array.from(mesh.getIndices() || []);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || indices.length < 3 || targetFaceIds.length === 0) return;

  const triCount = Math.floor(indices.length / 3);
  const targetFaceSet = new Set<number>(targetFaceIds);
  const targetVertSet = new Set<number>();
  const outsideVertSet = new Set<number>();

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    if (targetFaceSet.has(t)) {
      targetVertSet.add(i0);
      targetVertSet.add(i1);
      targetVertSet.add(i2);
    } else {
      outsideVertSet.add(i0);
      outsideVertSet.add(i1);
      outsideVertSet.add(i2);
    }
  }

  let vertCount = positions.length / 3;
  const presentKinds = getPresentVertexKinds(mesh);
  const buffers = new Map<string, { stride: number; data: number[] }>();

  for (const kind of presentKinds) {
    const raw = mesh.getVerticesData(kind);
    if (raw) {
      buffers.set(kind, {
        stride: getKindStride(mesh, kind),
        data: Array.from(raw),
      });
    }
  }

  // Ensure UVKind exists
  if (!buffers.has(VertexBuffer.UVKind)) {
    buffers.set(VertexBuffer.UVKind, {
      stride: 2,
      data: new Array<number>(vertCount * 2).fill(0),
    });
  }

  const remap = new Map<number, number>();
  for (const v of targetVertSet) {
    if (outsideVertSet.has(v)) {
      const newV = vertCount++;
      for (const [, buf] of buffers) {
        const s = buf.stride;
        for (let k = 0; k < s; k++) {
          buf.data.push(buf.data[v * s + k] ?? 0);
        }
      }
      remap.set(v, newV);
    }
  }

  if (remap.size === 0) {
    // Still ensure UVKind buffer was attached if previously missing
    if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
      const uvBuf = buffers.get(VertexBuffer.UVKind)!;
      mesh.setVerticesData(VertexBuffer.UVKind, uvBuf.data, true);
    }
    return;
  }

  for (const f of targetFaceIds) {
    if (f * 3 + 2 >= indices.length) continue;
    for (let k = 0; k < 3; k++) {
      const oldV = indices[f * 3 + k];
      const mapped = remap.get(oldV);
      if (mapped !== undefined) {
        indices[f * 3 + k] = mapped;
      }
    }
  }

  const prevSubMeshes = snapshotSubMeshes(mesh);

  for (const [kind, buf] of buffers) {
    mesh.setVerticesData(kind, buf.data, true);
  }
  mesh.setIndices(indices);
  if (prevSubMeshes.length > 0) {
    restoreSubMeshes(mesh, prevSubMeshes, vertCount);
  }
  mesh.refreshBoundingInfo();
}

/**
 * Computes an orthonormal tangent/bitangent basis on a facet plane from its outward normal.
 */
export function computeFacetLocalBasis(normal: Vector3): {
  tangentU: Vector3;
  bitangentV: Vector3;
} {
  const n = normal.lengthSquared() > 1e-8 ? normal.clone().normalize() : new Vector3(0, 1, 0);
  const refUp = Math.abs(n.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  let tangentU = Vector3.Cross(n, refUp);
  if (tangentU.lengthSquared() < 1e-8) {
    tangentU = Vector3.Cross(n, new Vector3(1, 0, 0));
  }
  tangentU.normalize();
  const bitangentV = Vector3.Cross(tangentU, n).normalize();
  return { tangentU, bitangentV };
}

function collectFacetUniqueVertices(indices: ArrayLike<number>, faceIds: number[]): number[] {
  const set = new Set<number>();
  for (const f of faceIds) {
    if (f * 3 + 2 >= indices.length) continue;
    set.add(indices[f * 3]);
    set.add(indices[f * 3 + 1]);
    set.add(indices[f * 3 + 2]);
  }
  return Array.from(set);
}

/**
 * Reads corner UVs and overall UV bounds for a target triangle or quad facet.
 */
export function getFacetUVInfo(
  mesh: Mesh,
  faceIds: number[],
  orderedCornerPositions: Vector3[],
  isQuad: boolean
): FacetUVInfo | null {
  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!indices || !positions || faceIds.length === 0) return null;

  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  const hasUVs = !!(uvs && uvs.length >= (positions.length / 3) * 2);
  const uniqueVerts = collectFacetUniqueVertices(indices, faceIds);
  if (uniqueVerts.length === 0) return null;

  const corners: FacetCornerUV[] = [];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;

  for (const cornerPos of orderedCornerPositions) {
    let bestV = uniqueVerts[0];
    let bestDistSq = Infinity;
    for (const v of uniqueVerts) {
      const dx = positions[v * 3] - cornerPos.x;
      const dy = positions[v * 3 + 1] - cornerPos.y;
      const dz = positions[v * 3 + 2] - cornerPos.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestV = v;
      }
    }
    const u = hasUVs ? uvs![bestV * 2] ?? 0 : 0;
    const vCoord = hasUVs ? uvs![bestV * 2 + 1] ?? 0 : 0;
    corners.push({ vertexIndex: bestV, u, v: vCoord });
    if (u < uMin) uMin = u;
    if (u > uMax) uMax = u;
    if (vCoord < vMin) vMin = vCoord;
    if (vCoord > vMax) vMax = vCoord;
  }

  return {
    faceIds: [...faceIds],
    isQuad,
    corners,
    uMin: Number.isFinite(uMin) ? uMin : 0,
    uMax: Number.isFinite(uMax) ? uMax : 1,
    vMin: Number.isFinite(vMin) ? vMin : 0,
    vMax: Number.isFinite(vMax) ? vMax : 1,
    hasUVs,
  };
}

/**
 * Projects UV coordinates onto a facet using either normalized '[0..1]' Fit or world-scale Planar mapping.
 */
export function applyFacetUVProjection(
  mesh: Mesh,
  faceIds: number[],
  normal: Vector3,
  mode: 'fit' | 'planar',
  options: FacetUVProjectionOptions = {}
): void {
  isolateFacetVertices(mesh, faceIds);
  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!indices || !positions) return;

  const vertCount = positions.length / 3;
  const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
  const uvs = rawUVs ? Array.from(rawUVs) : new Array<number>(vertCount * 2).fill(0);
  const targetVerts = collectFacetUniqueVertices(indices, faceIds);
  if (targetVerts.length === 0) return;

  if (mode === 'planar') {
    mesh.computeWorldMatrix(true);
    const wm = mesh.getWorldMatrix();
    const worldNormal = Vector3.TransformNormal(normal, wm);
    const { tangentU, bitangentV } = computeFacetLocalBasis(worldNormal);
    const scaleU = options.scaleU ?? 1;
    const scaleV = options.scaleV ?? 1;
    const offsetU = options.offsetU ?? 0;
    const offsetV = options.offsetV ?? 0;

    for (const v of targetVerts) {
      const localPos = new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const worldPos = Vector3.TransformCoordinates(localPos, wm);
      let u = Vector3.Dot(worldPos, tangentU) * scaleU + offsetU;
      let vCoord = Vector3.Dot(worldPos, bitangentV) * scaleV + offsetV;
      if (options.flipU) u = -u;
      if (options.flipV) vCoord = -vCoord;
      uvs[v * 2] = u;
      uvs[v * 2 + 1] = vCoord;
    }
  } else {
    const { tangentU, bitangentV } = computeFacetLocalBasis(normal);
    const projected = new Map<number, { u: number; v: number }>();
    let minRawU = Infinity;
    let maxRawU = -Infinity;
    let minRawV = Infinity;
    let maxRawV = -Infinity;

    for (const v of targetVerts) {
      const p = new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const ru = Vector3.Dot(p, tangentU);
      const rv = Vector3.Dot(p, bitangentV);
      projected.set(v, { u: ru, v: rv });
      if (ru < minRawU) minRawU = ru;
      if (ru > maxRawU) maxRawU = ru;
      if (rv < minRawV) minRawV = rv;
      if (rv > maxRawV) maxRawV = rv;
    }

    const spanU = Math.max(1e-6, maxRawU - minRawU);
    const spanV = Math.max(1e-6, maxRawV - minRawV);
    const uMin = options.uMin ?? 0;
    const uMax = options.uMax ?? 1;
    const vMin = options.vMin ?? 0;
    const vMax = options.vMax ?? 1;
    const rotRad = ((options.rotationDeg ?? 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    for (const v of targetVerts) {
      const raw = projected.get(v)!;
      let nu = (raw.u - minRawU) / spanU;
      let nv = (raw.v - minRawV) / spanV;

      if (rotRad !== 0) {
        const du = nu - 0.5;
        const dv = nv - 0.5;
        nu = 0.5 + du * cosR - dv * sinR;
        nv = 0.5 + du * sinR + dv * cosR;
      }
      if (options.flipU) nu = 1 - nu;
      if (options.flipV) nv = 1 - nv;

      uvs[v * 2] = uMin + nu * (uMax - uMin);
      uvs[v * 2 + 1] = vMin + nv * (vMax - vMin);
    }
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

/**
 * Remaps the facet's existing UV bounding box (or planar fit if degenerate) into [targetUMin..targetUMax, targetVMin..targetVMax].
 */
export function remapFacetUVRect(
  mesh: Mesh,
  faceIds: number[],
  normal: Vector3,
  targetUMin: number,
  targetUMax: number,
  targetVMin: number,
  targetVMax: number
): void {
  isolateFacetVertices(mesh, faceIds);
  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!indices || !positions) return;

  const targetVerts = collectFacetUniqueVertices(indices, faceIds);
  if (targetVerts.length === 0) return;

  const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!rawUVs) {
    applyFacetUVProjection(mesh, faceIds, normal, 'fit', {
      uMin: targetUMin,
      uMax: targetUMax,
      vMin: targetVMin,
      vMax: targetVMax,
    });
    return;
  }

  const uvs = Array.from(rawUVs);
  let curMinU = Infinity;
  let curMaxU = -Infinity;
  let curMinV = Infinity;
  let curMaxV = -Infinity;

  for (const v of targetVerts) {
    const u = uvs[v * 2] ?? 0;
    const vc = uvs[v * 2 + 1] ?? 0;
    if (u < curMinU) curMinU = u;
    if (u > curMaxU) curMaxU = u;
    if (vc < curMinV) curMinV = vc;
    if (vc > curMaxV) curMaxV = vc;
  }

  const spanU = curMaxU - curMinU;
  const spanV = curMaxV - curMinV;
  if (spanU < 1e-5 || spanV < 1e-5) {
    applyFacetUVProjection(mesh, faceIds, normal, 'fit', {
      uMin: targetUMin,
      uMax: targetUMax,
      vMin: targetVMin,
      vMax: targetVMax,
    });
    return;
  }

  for (const v of targetVerts) {
    const nu = ((uvs[v * 2] ?? 0) - curMinU) / spanU;
    const nv = ((uvs[v * 2 + 1] ?? 0) - curMinV) / spanV;
    uvs[v * 2] = targetUMin + nu * (targetUMax - targetUMin);
    uvs[v * 2 + 1] = targetVMin + nv * (targetVMax - targetVMin);
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

/**
 * Applies rotation, flip, scale, or offset transforms to a facet's isolated UVs around its UV center.
 */
export function transformFacetUVs(
  mesh: Mesh,
  faceIds: number[],
  options: FacetUVTransformOptions
): void {
  isolateFacetVertices(mesh, faceIds);
  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!indices || !positions) return;

  const targetVerts = collectFacetUniqueVertices(indices, faceIds);
  if (targetVerts.length === 0) return;

  const vertCount = positions.length / 3;
  const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
  const uvs = rawUVs ? Array.from(rawUVs) : new Array<number>(vertCount * 2).fill(0);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const v of targetVerts) {
    const u = uvs[v * 2] ?? 0;
    const vc = uvs[v * 2 + 1] ?? 0;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (vc < minV) minV = vc;
    if (vc > maxV) maxV = vc;
  }

  const cu = (minU + maxU) * 0.5;
  const cv = (minV + maxV) * 0.5;
  const rotRad = ((options.rotateDeg ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const scaleU = options.scaleU ?? 1;
  const scaleV = options.scaleV ?? 1;
  const offsetU = options.offsetU ?? 0;
  const offsetV = options.offsetV ?? 0;

  for (const v of targetVerts) {
    let du = (uvs[v * 2] ?? 0) - cu;
    let dv = (uvs[v * 2 + 1] ?? 0) - cv;

    if (options.flipU) du = -du;
    if (options.flipV) dv = -dv;

    if (rotRad !== 0) {
      const ru = du * cosR - dv * sinR;
      const rv = du * sinR + dv * cosR;
      du = ru;
      dv = rv;
    }

    du *= scaleU;
    dv *= scaleV;

    uvs[v * 2] = cu + du + offsetU;
    uvs[v * 2 + 1] = cv + dv + offsetV;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

/**
 * Sets explicit UV coordinates for each ordered corner of the target facet.
 */
export function setFacetCornerUVs(
  mesh: Mesh,
  faceIds: number[],
  cornerPositions: Vector3[],
  cornerUVs: Array<{ u: number; v: number }>
): void {
  if (cornerPositions.length === 0 || cornerUVs.length === 0) return;
  isolateFacetVertices(mesh, faceIds);

  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!indices || !positions) return;

  const vertCount = positions.length / 3;
  const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
  const uvs = rawUVs ? Array.from(rawUVs) : new Array<number>(vertCount * 2).fill(0);

  const targetVerts = collectFacetUniqueVertices(indices, faceIds);
  for (const v of targetVerts) {
    const vx = positions[v * 3];
    const vy = positions[v * 3 + 1];
    const vz = positions[v * 3 + 2];

    let bestCorner = 0;
    let bestDistSq = Infinity;
    for (let c = 0; c < cornerPositions.length && c < cornerUVs.length; c++) {
      const cp = cornerPositions[c];
      const dx = vx - cp.x;
      const dy = vy - cp.y;
      const dz = vz - cp.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestCorner = c;
      }
    }

    uvs[v * 2] = cornerUVs[bestCorner].u;
    uvs[v * 2 + 1] = cornerUVs[bestCorner].v;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

/**
 * Ensures a mesh has a valid base material before multi-material splitting.
 */
export function ensureBaseMaterial(mesh: Mesh): Material {
  if (mesh.material && !(mesh.material instanceof MultiMaterial)) {
    return mesh.material;
  }
  if (mesh.material instanceof MultiMaterial && mesh.material.subMaterials[0]) {
    return mesh.material.subMaterials[0];
  }
  const mat = new PBRMaterial(`${mesh.name}_BaseMat`, mesh.getScene());
  mat.roughness = 0.5;
  mat.metallic = 0.0;
  mesh.material = mat;
  return mat;
}

