import {
  FloatArray,
  IndicesArray,
  Mesh,
  SubMesh,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';

export interface BevelModifierOptions {
  /** Bevel width / radius in world units (0 = disabled, e.g. 0.01 to 0.5) */
  width: number;
  /** Number of bevel segments (1 = flat chamfer, 2..4 = rounded fillet) */
  segments: number;
  /** Minimum dihedral angle in degrees between adjacent faces to consider an edge sharp (default 30) */
  angleThresholdDeg?: number;
  /** Whether non-destructive base geometry should be preserved on the mesh */
  nonDestructive?: boolean;
}

export interface SerializedVertexSnapshot {
  positions: number[];
  indices: number[];
  normals?: number[];
  uvs?: number[];
  colors?: number[];
  subMeshes?: Array<{
    materialIndex: number;
    verticesStart: number;
    verticesCount: number;
    indexStart: number;
    indexCount: number;
  }>;
}

export interface NonDestructiveCSGMetadata {
  isNonDestructive: boolean;
  operation?: 'subtract' | 'union' | 'intersect' | 'bevel_only';
  targetMeshName?: string;
  toolMeshName?: string;
  /** Snapshot of the original target mesh before the boolean / modifier */
  originalTargetSnapshot?: SerializedVertexSnapshot;
  /** Snapshot of the un-beveled boolean result (or original mesh if bevel_only) */
  unbeveledBaseSnapshot: SerializedVertexSnapshot;
  /** Active bevel modifier parameters */
  bevel: {
    enabled: boolean;
    width: number;
    segments: number;
    angleThresholdDeg: number;
    sharpEdgeCount: number;
  };
}

/**
 * Captures a serializable deep copy of a mesh's VertexData and SubMesh layout.
 */
export function captureMeshSnapshot(mesh: Mesh): SerializedVertexSnapshot {
  const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
  const indices = Array.from(mesh.getIndices() || []);
  const normalsRaw = mesh.getVerticesData(VertexBuffer.NormalKind);
  const uvsRaw = mesh.getVerticesData(VertexBuffer.UVKind);
  const colorsRaw = mesh.getVerticesData(VertexBuffer.ColorKind);

  const subMeshes =
    mesh.subMeshes && mesh.subMeshes.length > 0
      ? mesh.subMeshes.map((sm) => ({
          materialIndex: sm.materialIndex,
          verticesStart: sm.verticesStart,
          verticesCount: sm.verticesCount,
          indexStart: sm.indexStart,
          indexCount: sm.indexCount,
        }))
      : undefined;

  return {
    positions,
    indices,
    normals: normalsRaw ? Array.from(normalsRaw) : undefined,
    uvs: uvsRaw ? Array.from(uvsRaw) : undefined,
    colors: colorsRaw ? Array.from(colorsRaw) : undefined,
    subMeshes,
  };
}

/**
 * Restores a captured VertexData and SubMesh snapshot onto a target mesh in-place.
 */
export function restoreMeshSnapshot(mesh: Mesh, snapshot: SerializedVertexSnapshot): void {
  const vd = new VertexData();
  vd.positions = snapshot.positions.slice();
  vd.indices = snapshot.indices.slice();

  if (snapshot.normals && snapshot.normals.length === snapshot.positions.length) {
    vd.normals = snapshot.normals.slice();
  } else {
    const computedNormals: number[] = [];
    VertexData.ComputeNormals(vd.positions, vd.indices, computedNormals);
    vd.normals = computedNormals;
  }

  if (snapshot.uvs && snapshot.uvs.length === (snapshot.positions.length / 3) * 2) {
    vd.uvs = snapshot.uvs.slice();
  }
  if (snapshot.colors && snapshot.colors.length === (snapshot.positions.length / 3) * 4) {
    vd.colors = snapshot.colors.slice();
  }

  vd.applyToMesh(mesh, true);

  if (snapshot.subMeshes && snapshot.subMeshes.length > 1) {
    mesh.subMeshes = [];
    for (const sm of snapshot.subMeshes) {
      new SubMesh(
        sm.materialIndex,
        sm.verticesStart,
        sm.verticesCount,
        sm.indexStart,
        sm.indexCount,
        mesh
      );
    }
  }
  mesh.refreshBoundingInfo();
}

/**
 * Computes topological sharp edges and applies a non-destructive Chamfer / Fillet Bevel modifier
 * to a mesh snapshot, returning a new SerializedVertexSnapshot and the detected sharpEdgeCount.
 */
export function computeBeveledSnapshot(
  baseSnapshot: SerializedVertexSnapshot,
  options: BevelModifierOptions
): { snapshot: SerializedVertexSnapshot; sharpEdgeCount: number } {
  const width = Math.max(0, Math.min(options.width || 0, 1.0));
  const segments = Math.max(1, Math.min(Math.round(options.segments || 1), 4));
  const angleThresholdDeg = options.angleThresholdDeg ?? 30;

  if (width <= 0.0001 || baseSnapshot.positions.length < 9 || baseSnapshot.indices.length < 3) {
    return {
      snapshot: {
        positions: baseSnapshot.positions.slice(),
        indices: baseSnapshot.indices.slice(),
        normals: baseSnapshot.normals ? baseSnapshot.normals.slice() : undefined,
        uvs: baseSnapshot.uvs ? baseSnapshot.uvs.slice() : undefined,
        colors: baseSnapshot.colors ? baseSnapshot.colors.slice() : undefined,
        subMeshes: baseSnapshot.subMeshes ? baseSnapshot.subMeshes.map((s) => ({ ...s })) : undefined,
      },
      sharpEdgeCount: 0,
    };
  }

  // Step 1: Weld spatial vertices to build topological connectivity
  const pos = baseSnapshot.positions;
  const ind = baseSnapshot.indices;
  const uvs = baseSnapshot.uvs;
  const colors = baseSnapshot.colors;

  const quantScale = 10000;
  const canonMap = new Map<string, number>();
  const canonPositions: Vector3[] = [];
  const vertToCanon = new Int32Array(pos.length / 3);

  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const key = `${Math.round(x * quantScale)},${Math.round(y * quantScale)},${Math.round(z * quantScale)}`;
    let cIdx = canonMap.get(key);
    if (cIdx === undefined) {
      cIdx = canonPositions.length;
      canonMap.set(key, cIdx);
      canonPositions.push(new Vector3(x, y, z));
    }
    vertToCanon[i] = cIdx;
  }

  const numTris = Math.floor(ind.length / 3);
  const faceNormals: Vector3[] = new Array(numTris);
  const faceCenters: Vector3[] = new Array(numTris);
  const edgeToFaces = new Map<string, number[]>();

  const makeEdgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  for (let f = 0; f < numTris; f++) {
    const i0 = ind[f * 3];
    const i1 = ind[f * 3 + 1];
    const i2 = ind[f * 3 + 2];

    const c0 = vertToCanon[i0];
    const c1 = vertToCanon[i1];
    const c2 = vertToCanon[i2];

    const p0 = canonPositions[c0];
    const p1 = canonPositions[c1];
    const p2 = canonPositions[c2];

    const e1 = p1.subtract(p0);
    const e2 = p2.subtract(p0);
    const n = Vector3.Cross(e1, e2);
    if (n.lengthSquared() > 1e-12) {
      n.normalize();
    } else {
      n.set(0, 1, 0);
    }
    faceNormals[f] = n;
    faceCenters[f] = p0.add(p1).add(p2).scaleInPlace(1 / 3);

    if (c0 !== c1 && c1 !== c2 && c2 !== c0) {
      const k01 = makeEdgeKey(c0, c1);
      const k12 = makeEdgeKey(c1, c2);
      const k20 = makeEdgeKey(c2, c0);
      if (!edgeToFaces.has(k01)) edgeToFaces.set(k01, []);
      if (!edgeToFaces.has(k12)) edgeToFaces.set(k12, []);
      if (!edgeToFaces.has(k20)) edgeToFaces.set(k20, []);
      edgeToFaces.get(k01)!.push(f);
      edgeToFaces.get(k12)!.push(f);
      edgeToFaces.get(k20)!.push(f);
    }
  }

  // Step 2: Detect sharp edges based on dihedral angle threshold
  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180);
  const sharpEdges = new Set<string>();
  const sharpCanonVerts = new Set<number>();
  const canonAdjSharpNormals = new Map<number, Vector3[]>();

  for (const [edgeKey, faces] of edgeToFaces.entries()) {
    if (faces.length >= 2) {
      const nA = faceNormals[faces[0]];
      const nB = faceNormals[faces[1]];
      const dot = Vector3.Dot(nA, nB);
      if (dot <= cosThreshold) {
        sharpEdges.add(edgeKey);
        const [aStr, bStr] = edgeKey.split('_');
        const ca = Number(aStr);
        const cb = Number(bStr);
        sharpCanonVerts.add(ca);
        sharpCanonVerts.add(cb);

        if (!canonAdjSharpNormals.has(ca)) canonAdjSharpNormals.set(ca, []);
        if (!canonAdjSharpNormals.has(cb)) canonAdjSharpNormals.set(cb, []);
        canonAdjSharpNormals.get(ca)!.push(nA, nB);
        canonAdjSharpNormals.get(cb)!.push(nA, nB);
      }
    }
  }

  const sharpEdgeCount = sharpEdges.size;
  if (sharpEdgeCount === 0) {
    return {
      snapshot: {
        positions: baseSnapshot.positions.slice(),
        indices: baseSnapshot.indices.slice(),
        normals: baseSnapshot.normals ? baseSnapshot.normals.slice() : undefined,
        uvs: baseSnapshot.uvs ? baseSnapshot.uvs.slice() : undefined,
        colors: baseSnapshot.colors ? baseSnapshot.colors.slice() : undefined,
        subMeshes: baseSnapshot.subMeshes ? baseSnapshot.subMeshes.map((s) => ({ ...s })) : undefined,
      },
      sharpEdgeCount: 0,
    };
  }

  // Step 3: Build chamfered / beveled geometry along sharp edges & corners
  // For each face that touches at least one sharp edge or sharp vertex, we inset its corner vertices
  // slightly toward the face center and bridge the chamfer gap with smooth fillet strips!
  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUVs: number[] = [];
  const outColors: number[] = [];
  const outIndices: number[] = [];

  const hasUVs = !!(uvs && uvs.length >= (pos.length / 3) * 2);
  const hasColors = !!(colors && colors.length >= (pos.length / 3) * 4);

  // Compute average sharp normal per canonical vertex for smooth fillet normal blending
  const canonSmoothNormal = new Map<number, Vector3>();
  for (const [cIdx, nList] of canonAdjSharpNormals.entries()) {
    const avg = new Vector3(0, 0, 0);
    for (const n of nList) avg.addInPlace(n);
    if (avg.lengthSquared() > 1e-8) {
      avg.normalize();
    } else {
      avg.set(0, 1, 0);
    }
    canonSmoothNormal.set(cIdx, avg);
  }

  // Compute canonical vertex neighbor centroids along sharp edges for tangential rounding
  const canonNeighbors = new Map<number, Set<number>>();
  for (const edgeKey of sharpEdges) {
    const [aStr, bStr] = edgeKey.split('_');
    const ca = Number(aStr);
    const cb = Number(bStr);
    if (!canonNeighbors.has(ca)) canonNeighbors.set(ca, new Set());
    if (!canonNeighbors.has(cb)) canonNeighbors.set(cb, new Set());
    canonNeighbors.get(ca)!.add(cb);
    canonNeighbors.get(cb)!.add(ca);
  }

  const pushVertex = (
    p: Vector3,
    n: Vector3,
    u: number,
    v: number,
    r: number,
    g: number,
    b: number,
    a: number
  ): number => {
    const idx = outPositions.length / 3;
    outPositions.push(p.x, p.y, p.z);
    outNormals.push(n.x, n.y, n.z);
    if (hasUVs) outUVs.push(u, v);
    if (hasColors) outColors.push(r, g, b, a);
    return idx;
  };

  for (let f = 0; f < numTris; f++) {
    const i0 = ind[f * 3];
    const i1 = ind[f * 3 + 1];
    const i2 = ind[f * 3 + 2];
    const origVerts = [i0, i1, i2];
    const cVerts = [vertToCanon[i0], vertToCanon[i1], vertToCanon[i2]];
    const fNormal = faceNormals[f];
    const fCenter = faceCenters[f];

    const touchesSharp =
      sharpCanonVerts.has(cVerts[0]) ||
      sharpCanonVerts.has(cVerts[1]) ||
      sharpCanonVerts.has(cVerts[2]);

    const getUV = (vi: number): [number, number] =>
      hasUVs ? [uvs![vi * 2], uvs![vi * 2 + 1]] : [0, 0];
    const getCol = (vi: number): [number, number, number, number] =>
      hasColors
        ? [colors![vi * 4], colors![vi * 4 + 1], colors![vi * 4 + 2], colors![vi * 4 + 3]]
        : [1, 1, 1, 1];

    if (!touchesSharp) {
      const newTri: number[] = [];
      for (let k = 0; k < 3; k++) {
        const vi = origVerts[k];
        const p = new Vector3(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
        const [u, v] = getUV(vi);
        const [r, g, b, a] = getCol(vi);
        newTri.push(pushVertex(p, fNormal, u, v, r, g, b, a));
      }
      outIndices.push(newTri[0], newTri[1], newTri[2]);
      continue;
    }

    // Face touches at least one sharp edge:
    // Create inset inner triangle + N-segment rounded bevel transition rings to the shared sharp boundary
    const ringCount = segments;
    const rings: number[][] = [];

    // Ring 0 = outer boundary (smoothed onto the fillet crest)
    // Ring `ringCount` = inner flat face boundary
    for (let s = 0; s <= ringCount; s++) {
      const t = s / ringCount; // 0 = outer crest, 1 = inner flat face
      const ringIndices: number[] = [];

      for (let k = 0; k < 3; k++) {
        const vi = origVerts[k];
        const cIdx = cVerts[k];
        const baseP = canonPositions[cIdx];
        const [u0, v0] = getUV(vi);
        const [r, g, b, a] = getCol(vi);

        if (!sharpCanonVerts.has(cIdx)) {
          // Non-sharp vertex stays anchored on the flat face
          ringIndices.push(pushVertex(baseP, fNormal, u0, v0, r, g, b, a));
          continue;
        }

        const smoothN = canonSmoothNormal.get(cIdx) || fNormal;
        const toCenter = fCenter.subtract(baseP);
        const edgeLen = toCenter.length();
        const maxInset = Math.min(width, edgeLen * 0.42);
        const insetDir = edgeLen > 1e-6 ? toCenter.scale(1 / edgeLen) : new Vector3(0, 0, 0);

        // Compute neighbor-averaged crest point for smooth corner rounding
        let crestP = baseP.subtract(smoothN.scale(maxInset * 0.32));
        const nbrs = canonNeighbors.get(cIdx);
        if (nbrs && nbrs.size > 0) {
          const nbrAvg = new Vector3(0, 0, 0);
          for (const nIdx of nbrs) {
            nbrAvg.addInPlace(canonPositions[nIdx]);
          }
          nbrAvg.scaleInPlace(1 / nbrs.size);
          crestP = Vector3.Lerp(crestP, nbrAvg, Math.min(0.35, width * 0.8));
        }

        // Inner point on the flat face
        const innerP = baseP.add(insetDir.scale(maxInset));

        // Circular arc / quadratic Bezier interpolation between crestP (s=0) and innerP (s=1)
        // Control point is baseP lifted slightly along blended normal for rounded fillet profile
        const filletLift = segments > 1 ? Math.sin(t * Math.PI) * maxInset * 0.22 : 0;
        const blendedN = Vector3.Lerp(smoothN, fNormal, t).normalize();
        const posOnArc = Vector3.Lerp(crestP, innerP, t).addInPlace(blendedN.scale(filletLift));

        // Interpolate UV slightly toward face UV centroid
        const [uc0, vc0] = getUV(origVerts[0]);
        const [uc1, vc1] = getUV(origVerts[1]);
        const [uc2, vc2] = getUV(origVerts[2]);
        const uCenter = (uc0 + uc1 + uc2) / 3;
        const vCenter = (vc0 + vc1 + vc2) / 3;
        const uvInsetFactor = edgeLen > 1e-6 ? (maxInset / edgeLen) * t * 0.5 : 0;
        const u = u0 + (uCenter - u0) * uvInsetFactor;
        const v = v0 + (vCenter - v0) * uvInsetFactor;

        ringIndices.push(pushVertex(posOnArc, blendedN, u, v, r, g, b, a));
      }

      rings.push(ringIndices);
    }

    // Stitch consecutive rings with quad strips (2 triangles per edge per ring step)
    for (let s = 0; s < ringCount; s++) {
      const outerRing = rings[s];
      const innerRing = rings[s + 1];
      for (let k = 0; k < 3; k++) {
        const kNext = (k + 1) % 3;
        const o0 = outerRing[k];
        const o1 = outerRing[kNext];
        const in0 = innerRing[k];
        const in1 = innerRing[kNext];

        if (o0 !== in0 || o1 !== in1) {
          outIndices.push(o0, o1, in1);
          outIndices.push(o0, in1, in0);
        }
      }
    }

    // Emit the innermost flat triangle
    const coreRing = rings[ringCount];
    outIndices.push(coreRing[0], coreRing[1], coreRing[2]);
  }

  return {
    snapshot: {
      positions: outPositions,
      indices: outIndices,
      normals: outNormals,
      uvs: hasUVs ? outUVs : undefined,
      colors: hasColors ? outColors : undefined,
      // Single unified geometry buffer after beveling
      subMeshes: undefined,
    },
    sharpEdgeCount,
  };
}

