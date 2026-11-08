import {
  Color3,
  DynamicTexture,
  FloatArray,
  IndicesArray,
  LinesMesh,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Nullable,
  PBRMaterial,
  PointerEventTypes,
  PointerInfo,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { MeshEditorService } from '../MeshEditorService';

export interface UVAnalysisResult {
  meshName: string;
  islandCount: number;
  seamEdgeCount: number;
  worldSurfaceAreaM2: number;
  uvSurfaceArea: number;
  texelDensityPxPerMeter: number;
  uvCoveragePercent: number;
  overlapDetected: boolean;
  textureResolution: number;
}

export interface UVUnwrapOptions {
  method?: 'smart_seams' | 'angle_project' | 'cubic' | 'cylindrical';
  angleThresholdDeg?: number;
  marginPx?: number;
  textureResolution?: number;
  targetTexelDensity?: number;
  rotateOptimal?: boolean;
}

interface UVIsland {
  id: number;
  faceIndices: number[];
  vertexIndices: Set<number>;
  worldArea: number;
  uvArea: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  widthU: number;
  heightV: number;
}

/**
 * Controller for Smart Seam Marking, LSCM/Angle-Based UV Unwrapping,
 * Texel Density Normalization (px/m), and 2D UV Island Bin-Packing.
 */
export class UVUnwrapController {
  public service: MeshEditorService;
  public scene: Scene;

  public isActive: boolean = false;
  public seamPickMode: boolean = false;
  public angleThresholdDeg: number = 60;
  public textureResolution: number = 1024;
  public targetTexelDensity: number = 512; // px / meter
  public marginPx: number = 6;
  public rotateOptimal: boolean = true;
  public checkerPreviewActive: boolean = false;

  private seamOverlayMesh: Nullable<LinesMesh> = null;
  private savedMaterials: WeakMap<Mesh, Nullable<Material>> = new WeakMap();
  private checkerMaterial: Nullable<StandardMaterial> = null;

  public onStateChanged?: (isActive: boolean) => void;
  public onUVModified?: (mesh: Mesh, stats: UVAnalysisResult) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
    this.scene = service.scene;
    this.initPointerHandling();
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (!active) {
      this.seamPickMode = false;
      this.clearSeamOverlay();
    } else {
      // Deactivate other exclusive 3D tools
      if (this.service.sculptController?.isActive) {
        this.service.sculptController.setActive(false);
      }
      if (this.service.voxelPainter?.isActive) {
        this.service.voxelPainter.setActive(false);
      }
      if (this.service.pathExtrusion?.isActive) {
        this.service.pathExtrusion.setActive(false);
      }
      if ((this.service as any).weightPaintController?.isActive) {
        (this.service as any).weightPaintController.setActive(false);
      }
      const mesh = this.getActiveTargetMesh();
      if (mesh) {
        this.refreshSeamOverlay(mesh);
      }
    }
    this.onStateChanged?.(active);
  }

  public getActiveTargetMesh(): Nullable<Mesh> {
    if (
      this.service.selectedMesh &&
      !this.service.isEditorHelper(this.service.selectedMesh) &&
      !this.service.selectedMesh.isDisposed() &&
      this.service.selectedMesh.getTotalVertices() > 0
    ) {
      return this.service.selectedMesh;
    }
    const first = this.service.importedMeshes.find(
      (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && m.getTotalVertices() > 0
    );
    return first || null;
  }

  /**
   * Interactive 3D viewport click handler for manual seam edge marking.
   */
  private initPointerHandling(): void {
    this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      if (!this.isActive || !this.seamPickMode) return;
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
      const evt = pointerInfo.event as MouseEvent;
      if (evt && evt.button !== 0) return;

      const pick = pointerInfo.pickInfo;
      if (
        pick &&
        pick.hit &&
        pick.pickedPoint &&
        pick.pickedMesh instanceof Mesh &&
        !this.service.isGizmoMesh(pick.pickedMesh) &&
        !this.service.isEditorHelper(pick.pickedMesh) &&
        pick.pickedMesh !== this.service.gridMesh
      ) {
        this.toggleNearestEdgeSeam(pick.pickedMesh, pick.pickedPoint, pick.faceId);
      }
    });
  }

  /**
   * Builds canonical vertex mapping so split vertices at identical 3D positions share topological edges.
   */
  private buildCanonicalVertices(positions: FloatArray): {
    canonPositions: Vector3[];
    vertToCanon: Int32Array;
  } {
    const quant = 10000;
    const map = new Map<string, number>();
    const canonPositions: Vector3[] = [];
    const count = Math.floor(positions.length / 3);
    const vertToCanon = new Int32Array(count);

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const key = `${Math.round(x * quant)},${Math.round(y * quant)},${Math.round(z * quant)}`;
      let c = map.get(key);
      if (c === undefined) {
        c = canonPositions.length;
        map.set(key, c);
        canonPositions.push(new Vector3(x, y, z));
      }
      vertToCanon[i] = c;
    }

    return { canonPositions, vertToCanon };
  }

  private makeEdgeKey(a: number, b: number): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  /**
   * Toggles the seam state of the triangle edge closest to `worldHitPoint`.
   */
  public toggleNearestEdgeSeam(mesh: Mesh, worldHitPoint: Vector3, faceId?: number): boolean {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) return false;

    const { canonPositions, vertToCanon } = this.buildCanonicalVertices(positions);
    mesh.computeWorldMatrix(true);
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const localHit = Vector3.TransformCoordinates(worldHitPoint, invWorld);

    let bestEdgeKey: string | null = null;
    let bestDist = Infinity;

    const checkTriangle = (triIdx: number) => {
      const i0 = indices[triIdx * 3];
      const i1 = indices[triIdx * 3 + 1];
      const i2 = indices[triIdx * 3 + 2];
      const c0 = vertToCanon[i0];
      const c1 = vertToCanon[i1];
      const c2 = vertToCanon[i2];
      const pairs: Array<[number, number]> = [
        [c0, c1],
        [c1, c2],
        [c2, c0],
      ];
      for (const [ca, cb] of pairs) {
        if (ca === cb) continue;
        const pa = canonPositions[ca];
        const pb = canonPositions[cb];
        const ab = pb.subtract(pa);
        const lenSq = ab.lengthSquared();
        const t = lenSq > 1e-10 ? Math.max(0, Math.min(1, Vector3.Dot(localHit.subtract(pa), ab) / lenSq)) : 0;
        const proj = pa.add(ab.scale(t));
        const d = Vector3.Distance(localHit, proj);
        if (d < bestDist) {
          bestDist = d;
          bestEdgeKey = this.makeEdgeKey(ca, cb);
        }
      }
    };

    if (faceId !== undefined && faceId >= 0 && faceId * 3 + 2 < indices.length) {
      checkTriangle(faceId);
    } else {
      const numTris = Math.floor(indices.length / 3);
      for (let t = 0; t < numTris; t++) {
        checkTriangle(t);
      }
    }

    if (!bestEdgeKey) return false;

    if (!mesh.metadata) mesh.metadata = {};
    if (!Array.isArray(mesh.metadata.uvSeams)) {
      mesh.metadata.uvSeams = [];
    }
    const seamSet = new Set<string>(mesh.metadata.uvSeams);
    let added = false;
    if (seamSet.has(bestEdgeKey)) {
      seamSet.delete(bestEdgeKey);
    } else {
      seamSet.add(bestEdgeKey);
      added = true;
    }
    mesh.metadata.uvSeams = Array.from(seamSet);
    this.refreshSeamOverlay(mesh);
    this.onUVModified?.(mesh, this.analyzeUVs(mesh, this.textureResolution));
    return added;
  }

  /**
   * Automatically detects and marks Smart UV Seams along sharp crease angles, open boundaries,
   * and cylindrical longitudinal seams.
   */
  public markSmartSeams(
    mesh: Mesh,
    angleThresholdDeg: number = this.angleThresholdDeg
  ): { seamEdgeCount: number; seamKeys: string[] } {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices || indices.length < 3) {
      return { seamEdgeCount: 0, seamKeys: [] };
    }

    const { canonPositions, vertToCanon } = this.buildCanonicalVertices(positions);
    const numTris = Math.floor(indices.length / 3);
    const faceNormals: Vector3[] = new Array(numTris);
    const edgeToFaces = new Map<string, number[]>();

    for (let f = 0; f < numTris; f++) {
      const c0 = vertToCanon[indices[f * 3]];
      const c1 = vertToCanon[indices[f * 3 + 1]];
      const c2 = vertToCanon[indices[f * 3 + 2]];

      const p0 = canonPositions[c0];
      const p1 = canonPositions[c1];
      const p2 = canonPositions[c2];
      const n = Vector3.Cross(p1.subtract(p0), p2.subtract(p0));
      if (n.lengthSquared() > 1e-12) n.normalize();
      else n.set(0, 1, 0);
      faceNormals[f] = n;

      if (c0 !== c1 && c1 !== c2 && c2 !== c0) {
        const edges = [
          this.makeEdgeKey(c0, c1),
          this.makeEdgeKey(c1, c2),
          this.makeEdgeKey(c2, c0),
        ];
        for (const ek of edges) {
          let list = edgeToFaces.get(ek);
          if (!list) {
            list = [];
            edgeToFaces.set(ek, list);
          }
          list.push(f);
        }
      }
    }

    const cosThresh = Math.cos((angleThresholdDeg * Math.PI) / 180);
    const seamKeys = new Set<string>();

    for (const [edgeKey, faces] of edgeToFaces.entries()) {
      if (faces.length === 1) {
        // Open boundary edge is always a seam
        seamKeys.add(edgeKey);
      } else if (faces.length >= 2) {
        const nA = faceNormals[faces[0]];
        const nB = faceNormals[faces[1]];
        if (Vector3.Dot(nA, nB) <= cosThresh) {
          seamKeys.add(edgeKey);
        }
      }
    }

    // Also add a longitudinal back-seam for smooth closed surfaces (like spheres/cylinders/organic limbs)
    // that otherwise have 0 sharp edges
    if (seamKeys.size < 3 && canonPositions.length >= 6) {
      for (const [edgeKey] of edgeToFaces.entries()) {
        const [aStr, bStr] = edgeKey.split('_');
        const pa = canonPositions[Number(aStr)];
        const pb = canonPositions[Number(bStr)];
        // Back-center meridian (X near 0, Z <= 0)
        if (Math.abs(pa.x) < 0.08 && Math.abs(pb.x) < 0.08 && pa.z <= 0 && pb.z <= 0) {
          seamKeys.add(edgeKey);
        }
      }
    }

    const resultKeys = Array.from(seamKeys);
    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.uvSeams = resultKeys;

    this.refreshSeamOverlay(mesh);
    return { seamEdgeCount: resultKeys.length, seamKeys: resultKeys };
  }

  public clearSeams(mesh: Mesh): void {
    if (mesh.metadata) {
      mesh.metadata.uvSeams = [];
    }
    this.clearSeamOverlay();
  }

  public clearSeamOverlay(): void {
    if (this.seamOverlayMesh) {
      this.seamOverlayMesh.dispose();
      this.seamOverlayMesh = null;
    }
  }

  /**
   * Renders marked UV seams as a bright orange-red 3D wireframe overlay in the viewport.
   */
  public refreshSeamOverlay(mesh: Mesh): void {
    this.clearSeamOverlay();
    if (!mesh || mesh.isDisposed()) return;

    const seamKeys: string[] = mesh.metadata?.uvSeams || [];
    if (seamKeys.length === 0) return;

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const { canonPositions } = this.buildCanonicalVertices(positions);
    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();

    const lines: Vector3[][] = [];
    for (const key of seamKeys) {
      const [aStr, bStr] = key.split('_');
      const ca = Number(aStr);
      const cb = Number(bStr);
      if (ca < canonPositions.length && cb < canonPositions.length) {
        const wa = Vector3.TransformCoordinates(canonPositions[ca], worldMat);
        const wb = Vector3.TransformCoordinates(canonPositions[cb], worldMat);
        lines.push([wa, wb]);
      }
    }

    if (lines.length === 0) return;

    this.seamOverlayMesh = MeshBuilder.CreateLineSystem(
      'editor_uv_seam_lines',
      { lines },
      this.scene
    );
    this.seamOverlayMesh.color = new Color3(1.0, 0.28, 0.15);
    this.seamOverlayMesh.isPickable = false;
    this.seamOverlayMesh.renderingGroupId = 1;
  }

  /**
   * Performs Seam-Aware Chart Unwrapping, Texel Density Normalization, and 2D UV Island Bin-Packing.
   */
  public unwrapMesh(mesh: Mesh, options: UVUnwrapOptions = {}): UVAnalysisResult {
    const method = options.method || 'smart_seams';
    const angleThresholdDeg = options.angleThresholdDeg ?? this.angleThresholdDeg;
    const textureResolution = options.textureResolution ?? this.textureResolution;
    const marginPx = options.marginPx ?? this.marginPx;
    const rotateOptimal = options.rotateOptimal ?? this.rotateOptimal;

    const prePositions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const preIndices = Array.from(mesh.getIndices() || []);
    const preNormals = Array.from(mesh.getVerticesData(VertexBuffer.NormalKind) || []);
    const preUVs = mesh.getVerticesData(VertexBuffer.UVKind)
      ? Array.from(mesh.getVerticesData(VertexBuffer.UVKind)!)
      : null;

    if (prePositions.length < 9 || preIndices.length < 3) {
      return this.analyzeUVs(mesh, textureResolution);
    }

    // Ensure smart seams are marked if using smart_seams and none are present yet
    if (
      method === 'smart_seams' &&
      (!mesh.metadata?.uvSeams || mesh.metadata.uvSeams.length === 0)
    ) {
      this.markSmartSeams(mesh, angleThresholdDeg);
    }

    const seamSet = new Set<string>(mesh.metadata?.uvSeams || []);
    const { canonPositions, vertToCanon } = this.buildCanonicalVertices(prePositions);
    const numTris = Math.floor(preIndices.length / 3);

    // Compute triangle normals and adjacency across non-seam edges
    const faceNormals: Vector3[] = new Array(numTris);
    const edgeToTris = new Map<string, number[]>();

    for (let f = 0; f < numTris; f++) {
      const c0 = vertToCanon[preIndices[f * 3]];
      const c1 = vertToCanon[preIndices[f * 3 + 1]];
      const c2 = vertToCanon[preIndices[f * 3 + 2]];
      const p0 = canonPositions[c0];
      const p1 = canonPositions[c1];
      const p2 = canonPositions[c2];
      const n = Vector3.Cross(p1.subtract(p0), p2.subtract(p0));
      if (n.lengthSquared() > 1e-12) n.normalize();
      else n.set(0, 1, 0);
      faceNormals[f] = n;

      const edges = [
        this.makeEdgeKey(c0, c1),
        this.makeEdgeKey(c1, c2),
        this.makeEdgeKey(c2, c0),
      ];
      for (const ek of edges) {
        if (!edgeToTris.has(ek)) edgeToTris.set(ek, []);
        edgeToTris.get(ek)!.push(f);
      }
    }

    // Flood-fill triangles into connected UV Charts (Islands) stopping at marked seams and sharp angle breaks
    const cosAngleLimit = Math.cos((angleThresholdDeg * Math.PI) / 180);
    const triVisited = new Uint8Array(numTris);
    const charts: number[][] = [];

    for (let f = 0; f < numTris; f++) {
      if (triVisited[f]) continue;
      const chart: number[] = [];
      const seedNormal = faceNormals[f].clone();
      const queue: number[] = [f];
      triVisited[f] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        chart.push(curr);

        const c0 = vertToCanon[preIndices[curr * 3]];
        const c1 = vertToCanon[preIndices[curr * 3 + 1]];
        const c2 = vertToCanon[preIndices[curr * 3 + 2]];
        const edges = [
          this.makeEdgeKey(c0, c1),
          this.makeEdgeKey(c1, c2),
          this.makeEdgeKey(c2, c0),
        ];

        for (const ek of edges) {
          if (seamSet.has(ek)) continue; // Stop at marked seam!
          const nbrs = edgeToTris.get(ek) || [];
          for (const nb of nbrs) {
            if (triVisited[nb]) continue;
            // Check dihedral angle and chart normal fold prevention
            const dotAdj = Vector3.Dot(faceNormals[curr], faceNormals[nb]);
            const dotSeed = Vector3.Dot(seedNormal, faceNormals[nb]);
            if (dotAdj >= cosAngleLimit && dotSeed >= -0.15) {
              triVisited[nb] = 1;
              queue.push(nb);
            }
          }
        }
      }
      charts.push(chart);
    }

    // Build unindexed/chart-isolated vertices so UV seams have independent UV coordinates cleanly
    const hasColors = !!mesh.getVerticesData(VertexBuffer.ColorKind);
    const rawColors = mesh.getVerticesData(VertexBuffer.ColorKind);

    const newPositions: number[] = [];
    const newNormals: number[] = [];
    const newColors: number[] = [];
    const newUVs: number[] = [];
    const newIndices: number[] = [];

    for (let cIdx = 0; cIdx < charts.length; cIdx++) {
      const tris = charts[cIdx];
      // Compute area-weighted average normal of the chart
      const avgNormal = new Vector3(0, 0, 0);
      for (const f of tris) {
        avgNormal.addInPlace(faceNormals[f]);
      }
      if (avgNormal.lengthSquared() > 1e-8) avgNormal.normalize();
      else avgNormal.set(0, 1, 0);

      // Construct orthonormal tangent plane basis (tangentU, bitangentV) for chart flattening
      const upRef = Math.abs(avgNormal.y) < 0.9 ? Vector3.Up() : Vector3.Right();
      const tangentU = Vector3.Cross(upRef, avgNormal).normalize();
      const bitangentV = Vector3.Cross(avgNormal, tangentU).normalize();

      // Map canonical vertex -> local chart vertex index so vertices WITHIN the same island are shared
      const chartVertMap = new Map<number, number>();
      const chartLocalVerts: number[] = [];

      for (const f of tris) {
        for (let k = 0; k < 3; k++) {
          const origV = preIndices[f * 3 + k];
          const canonV = vertToCanon[origV];
          // Share within chart if normals are close
          const key = canonV;
          let localV = chartVertMap.get(key);
          if (localV === undefined) {
            localV = newPositions.length / 3;
            chartVertMap.set(key, localV);
            chartLocalVerts.push(localV);

            const px = prePositions[origV * 3];
            const py = prePositions[origV * 3 + 1];
            const pz = prePositions[origV * 3 + 2];
            newPositions.push(px, py, pz);

            if (preNormals.length >= (origV + 1) * 3) {
              newNormals.push(
                preNormals[origV * 3],
                preNormals[origV * 3 + 1],
                preNormals[origV * 3 + 2]
              );
            } else {
              newNormals.push(avgNormal.x, avgNormal.y, avgNormal.z);
            }

            if (hasColors && rawColors) {
              newColors.push(
                rawColors[origV * 4],
                rawColors[origV * 4 + 1],
                rawColors[origV * 4 + 2],
                rawColors[origV * 4 + 3]
              );
            }

            const pVec = new Vector3(px, py, pz);
            let u = 0;
            let v = 0;
            if (method === 'cylindrical') {
              const angle = Math.atan2(pVec.x, pVec.z);
              u = (angle + Math.PI) / (2 * Math.PI);
              v = pVec.y;
            } else {
              u = Vector3.Dot(pVec, tangentU);
              v = Vector3.Dot(pVec, bitangentV);
            }
            newUVs.push(u, v);
          }
          newIndices.push(localV);
        }
      }

      // Perform 2 passes of interior UV harmonic relaxation on charts with > 4 vertices to reduce distortion
      if (chartLocalVerts.length > 4 && tris.length > 2) {
        const boundarySet = new Set<number>();
        const chartEdgeCounts = new Map<string, number>();
        const localNeighbors = new Map<number, Set<number>>();

        for (let t = 0; t < tris.length; t++) {
          const baseIdx = newIndices.length - (tris.length - t) * 3;
          const v0 = newIndices[baseIdx];
          const v1 = newIndices[baseIdx + 1];
          const v2 = newIndices[baseIdx + 2];
          const pairs: Array<[number, number]> = [
            [v0, v1],
            [v1, v2],
            [v2, v0],
          ];
          for (const [va, vb] of pairs) {
            const ek = this.makeEdgeKey(va, vb);
            chartEdgeCounts.set(ek, (chartEdgeCounts.get(ek) || 0) + 1);
            if (!localNeighbors.has(va)) localNeighbors.set(va, new Set());
            if (!localNeighbors.has(vb)) localNeighbors.set(vb, new Set());
            localNeighbors.get(va)!.add(vb);
            localNeighbors.get(vb)!.add(va);
          }
        }
        for (const [ek, count] of chartEdgeCounts.entries()) {
          if (count === 1) {
            const [a, b] = ek.split('_').map(Number);
            boundarySet.add(a);
            boundarySet.add(b);
          }
        }

        for (let iter = 0; iter < 2; iter++) {
          for (const lv of chartLocalVerts) {
            if (boundarySet.has(lv)) continue;
            const nbrs = localNeighbors.get(lv);
            if (!nbrs || nbrs.size === 0) continue;
            let sumU = 0;
            let sumV = 0;
            for (const nb of nbrs) {
              sumU += newUVs[nb * 2];
              sumV += newUVs[nb * 2 + 1];
            }
            newUVs[lv * 2] = newUVs[lv * 2] * 0.65 + (sumU / nbrs.size) * 0.35;
            newUVs[lv * 2 + 1] = newUVs[lv * 2 + 1] * 0.65 + (sumV / nbrs.size) * 0.35;
          }
        }
      }
    }

    // Apply unwrapped buffers to mesh
    const vd = new VertexData();
    vd.positions = newPositions;
    vd.indices = newIndices;
    vd.normals = newNormals;
    vd.uvs = newUVs;
    if (hasColors && newColors.length > 0) {
      vd.colors = newColors;
    }
    vd.applyToMesh(mesh, true);

    // Pack the UV islands with uniform texel density and margin padding
    const packAnalysis = this.packUVIslands(mesh, {
      marginPx,
      textureResolution,
      rotateOptimal,
      normalizeScale: true,
    });

    if (options.targetTexelDensity && options.targetTexelDensity > 0) {
      this.normalizeTexelDensity(mesh, options.targetTexelDensity, textureResolution, false);
    }

    const postPositions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const postIndices = Array.from(mesh.getIndices() || []);
    const postNormals = Array.from(mesh.getVerticesData(VertexBuffer.NormalKind) || []);
    const postUVs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    this.service.recordAction({
      name: `UV Unwrap (${mesh.name})`,
      undo: () => {
        if (!mesh.isDisposed()) {
          const uVd = new VertexData();
          uVd.positions = prePositions;
          uVd.indices = preIndices;
          uVd.normals = preNormals;
          if (preUVs) uVd.uvs = preUVs;
          uVd.applyToMesh(mesh, true);
          this.onUVModified?.(mesh, this.analyzeUVs(mesh, textureResolution));
        }
      },
      redo: () => {
        if (!mesh.isDisposed()) {
          const rVd = new VertexData();
          rVd.positions = postPositions;
          rVd.indices = postIndices;
          rVd.normals = postNormals;
          rVd.uvs = postUVs;
          rVd.applyToMesh(mesh, true);
          this.onUVModified?.(mesh, this.analyzeUVs(mesh, textureResolution));
        }
      },
    });

    this.refreshSeamOverlay(mesh);
    this.onUVModified?.(mesh, packAnalysis);
    return packAnalysis;
  }

  /**
   * Extracts connected 2D UV islands from the mesh's current UV buffer.
   */
  private extractUVIslands(
    positions: FloatArray,
    indices: IndicesArray,
    uvs: FloatArray,
    worldMatrix: Matrix
  ): UVIsland[] {
    const numTris = Math.floor(indices.length / 3);
    const uvQuant = 100000;
    const uvEdgeToTris = new Map<string, number[]>();

    const getUVKey = (vi: number): string => {
      const u = Math.round(uvs[vi * 2] * uvQuant);
      const v = Math.round(uvs[vi * 2 + 1] * uvQuant);
      return `${u}:${v}`;
    };

    for (let f = 0; f < numTris; f++) {
      const i0 = indices[f * 3];
      const i1 = indices[f * 3 + 1];
      const i2 = indices[f * 3 + 2];
      const k0 = getUVKey(i0);
      const k1 = getUVKey(i1);
      const k2 = getUVKey(i2);
      const edges = [
        k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`,
        k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`,
        k2 < k0 ? `${k2}|${k0}` : `${k0}|${k2}`,
      ];
      for (const ek of edges) {
        if (!uvEdgeToTris.has(ek)) uvEdgeToTris.set(ek, []);
        uvEdgeToTris.get(ek)!.push(f);
      }
    }

    const visited = new Uint8Array(numTris);
    const islands: UVIsland[] = [];

    for (let f = 0; f < numTris; f++) {
      if (visited[f]) continue;
      const faceIndices: number[] = [];
      const vertexIndices = new Set<number>();
      const queue: number[] = [f];
      visited[f] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        faceIndices.push(curr);
        const i0 = indices[curr * 3];
        const i1 = indices[curr * 3 + 1];
        const i2 = indices[curr * 3 + 2];
        vertexIndices.add(i0);
        vertexIndices.add(i1);
        vertexIndices.add(i2);

        const k0 = getUVKey(i0);
        const k1 = getUVKey(i1);
        const k2 = getUVKey(i2);
        const edges = [
          k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`,
          k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`,
          k2 < k0 ? `${k2}|${k0}` : `${k0}|${k2}`,
        ];
        for (const ek of edges) {
          const nbrs = uvEdgeToTris.get(ek) || [];
          for (const nb of nbrs) {
            if (!visited[nb]) {
              visited[nb] = 1;
              queue.push(nb);
            }
          }
        }
      }

      let worldArea = 0;
      let uvArea = 0;
      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;

      for (const tri of faceIndices) {
        const i0 = indices[tri * 3];
        const i1 = indices[tri * 3 + 1];
        const i2 = indices[tri * 3 + 2];

        const p0 = Vector3.TransformCoordinates(
          new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]),
          worldMatrix
        );
        const p1 = Vector3.TransformCoordinates(
          new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]),
          worldMatrix
        );
        const p2 = Vector3.TransformCoordinates(
          new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]),
          worldMatrix
        );

        worldArea += Vector3.Cross(p1.subtract(p0), p2.subtract(p0)).length() * 0.5;

        const u0 = uvs[i0 * 2];
        const v0 = uvs[i0 * 2 + 1];
        const u1 = uvs[i1 * 2];
        const v1 = uvs[i1 * 2 + 1];
        const u2 = uvs[i2 * 2];
        const v2 = uvs[i2 * 2 + 1];

        uvArea += Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) * 0.5;
      }

      for (const vi of vertexIndices) {
        const u = uvs[vi * 2];
        const v = uvs[vi * 2 + 1];
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }

      islands.push({
        id: islands.length,
        faceIndices,
        vertexIndices,
        worldArea,
        uvArea,
        minU,
        maxU,
        minV,
        maxV,
        widthU: Math.max(1e-5, maxU - minU),
        heightV: Math.max(1e-5, maxV - minV),
      });
    }

    return islands;
  }

  /**
   * Normalizes Texel Density so all UV islands match a target Pixels-Per-Meter (px/m) resolution.
   */
  public normalizeTexelDensity(
    mesh: Mesh,
    targetPxPerMeter: number = this.targetTexelDensity,
    textureResolution: number = this.textureResolution,
    fitInsideZeroOne: boolean = false
  ): UVAnalysisResult {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
    if (!positions || !indices || !rawUVs) {
      return this.analyzeUVs(mesh, textureResolution);
    }

    const uvs = Array.from(rawUVs);
    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();

    const islands = this.extractUVIslands(positions, indices, uvs, worldMat);
    const desiredRatio = Math.max(0.01, targetPxPerMeter / Math.max(64, textureResolution));

    for (const island of islands) {
      if (island.worldArea <= 1e-8 || island.uvArea <= 1e-10) continue;
      const currentLinearRatio = Math.sqrt(island.uvArea / island.worldArea);
      const scaleFactor = desiredRatio / currentLinearRatio;
      const centerU = (island.minU + island.maxU) * 0.5;
      const centerV = (island.minV + island.maxV) * 0.5;

      for (const vi of island.vertexIndices) {
        uvs[vi * 2] = centerU + (uvs[vi * 2] - centerU) * scaleFactor;
        uvs[vi * 2 + 1] = centerV + (uvs[vi * 2 + 1] - centerV) * scaleFactor;
      }
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);

    if (fitInsideZeroOne) {
      return this.packUVIslands(mesh, {
        marginPx: this.marginPx,
        textureResolution,
        rotateOptimal: this.rotateOptimal,
        normalizeScale: false,
      });
    }

    const stats = this.analyzeUVs(mesh, textureResolution);
    this.onUVModified?.(mesh, stats);
    return stats;
  }

  /**
   * Packs 2D UV islands into the [0, 1] x [0, 1] UV square using a Shelf / Skyline 2D Bin-Packer
   * with pixel padding and optional 90-degree rotation optimization.
   */
  public packUVIslands(
    mesh: Mesh,
    options?: {
      marginPx?: number;
      textureResolution?: number;
      rotateOptimal?: boolean;
      normalizeScale?: boolean;
    }
  ): UVAnalysisResult {
    const marginPx = options?.marginPx ?? this.marginPx;
    const textureResolution = options?.textureResolution ?? this.textureResolution;
    const rotateOptimal = options?.rotateOptimal ?? this.rotateOptimal;
    const normalizeScale = options?.normalizeScale ?? true;

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const rawUVs = mesh.getVerticesData(VertexBuffer.UVKind);
    if (!positions || !indices || !rawUVs || rawUVs.length === 0) {
      return this.analyzeUVs(mesh, textureResolution);
    }

    const uvs = Array.from(rawUVs);
    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();

    const islands = this.extractUVIslands(positions, indices, uvs, worldMat);
    if (islands.length === 0) {
      return this.analyzeUVs(mesh, textureResolution);
    }

    // Step 1: Equalize relative texel density across islands so face & armor have uniform density
    if (normalizeScale) {
      let totalWorldArea = 0;
      for (const isl of islands) totalWorldArea += isl.worldArea;
      const avgDensity = totalWorldArea > 1e-8 ? 1.0 / Math.sqrt(totalWorldArea) : 1.0;

      for (const isl of islands) {
        if (isl.worldArea > 1e-8 && isl.uvArea > 1e-10) {
          const currRatio = Math.sqrt(isl.uvArea / isl.worldArea);
          const scale = avgDensity / currRatio;
          for (const vi of isl.vertexIndices) {
            uvs[vi * 2] = (uvs[vi * 2] - isl.minU) * scale;
            uvs[vi * 2 + 1] = (uvs[vi * 2 + 1] - isl.minV) * scale;
          }
          isl.widthU *= scale;
          isl.heightV *= scale;
          isl.minU = 0;
          isl.minV = 0;
          isl.maxU = isl.widthU;
          isl.maxV = isl.heightV;
        }
      }
    } else {
      // Shift each island local origin to (0,0)
      for (const isl of islands) {
        for (const vi of isl.vertexIndices) {
          uvs[vi * 2] -= isl.minU;
          uvs[vi * 2 + 1] -= isl.minV;
        }
        isl.maxU = isl.widthU;
        isl.maxV = isl.heightV;
        isl.minU = 0;
        isl.minV = 0;
      }
    }

    // Step 2: Optional 90-degree rotation so taller islands lay horizontally for denser shelf packing
    if (rotateOptimal) {
      for (const isl of islands) {
        if (isl.heightV > isl.widthU * 1.15) {
          const oldW = isl.widthU;
          const oldH = isl.heightV;
          for (const vi of isl.vertexIndices) {
            const u = uvs[vi * 2];
            const v = uvs[vi * 2 + 1];
            uvs[vi * 2] = v;
            uvs[vi * 2 + 1] = oldW - u;
          }
          isl.widthU = oldH;
          isl.heightV = oldW;
          isl.maxU = isl.widthU;
          isl.maxV = isl.heightV;
        }
      }
    }

    // Step 3: Sort islands by height descending for Skyline/Shelf bin-packing
    const sortedIslands = islands.slice().sort((a, b) => b.heightV - a.heightV);

    let totalBoxArea = 0;
    let maxIslandWidth = 0;
    for (const isl of sortedIslands) {
      totalBoxArea += isl.widthU * isl.heightV;
      if (isl.widthU > maxIslandWidth) maxIslandWidth = isl.widthU;
    }

    const padUV = Math.max(0.002, marginPx / Math.max(128, textureResolution));
    const targetBinWidth = Math.max(
      maxIslandWidth + padUV * 2,
      Math.sqrt(totalBoxArea * 1.22) + padUV * Math.sqrt(sortedIslands.length)
    );

    let cursorX = padUV;
    let cursorY = padUV;
    let shelfHeight = 0;
    let maxPackedX = 0;
    let maxPackedY = 0;

    for (const isl of sortedIslands) {
      if (cursorX + isl.widthU + padUV > targetBinWidth && cursorX > padUV) {
        cursorX = padUV;
        cursorY += shelfHeight + padUV;
        shelfHeight = 0;
      }

      for (const vi of isl.vertexIndices) {
        uvs[vi * 2] += cursorX;
        uvs[vi * 2 + 1] += cursorY;
      }

      cursorX += isl.widthU + padUV;
      if (isl.heightV > shelfHeight) shelfHeight = isl.heightV;
      if (cursorX > maxPackedX) maxPackedX = cursorX;
      if (cursorY + isl.heightV + padUV > maxPackedY) {
        maxPackedY = cursorY + isl.heightV + padUV;
      }
    }

    // Step 4: Uniformly scale the packed bin into [padUV, 1 - padUV] so it fits [0, 1] UV space cleanly
    const extent = Math.max(1e-5, Math.max(maxPackedX, maxPackedY));
    if (normalizeScale || extent > 1.0) {
      const globalFitScale = (1.0 - padUV * 2) / extent;
      for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = padUV + (uvs[i] - padUV) * globalFitScale;
        uvs[i + 1] = padUV + (uvs[i + 1] - padUV) * globalFitScale;
      }
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
    const stats = this.analyzeUVs(mesh, textureResolution);
    this.onUVModified?.(mesh, stats);
    return stats;
  }

  /**
   * Computes comprehensive UV & Texel Density metrics for a mesh.
   */
  public analyzeUVs(mesh: Mesh, textureResolution: number = this.textureResolution): UVAnalysisResult {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    const seamEdgeCount = Array.isArray(mesh.metadata?.uvSeams) ? mesh.metadata.uvSeams.length : 0;

    if (!positions || !indices || !uvs || uvs.length === 0) {
      return {
        meshName: mesh?.name || 'None',
        islandCount: 0,
        seamEdgeCount,
        worldSurfaceAreaM2: 0,
        uvSurfaceArea: 0,
        texelDensityPxPerMeter: 0,
        uvCoveragePercent: 0,
        overlapDetected: false,
        textureResolution,
      };
    }

    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();
    const islands = this.extractUVIslands(positions, indices, uvs, worldMat);

    let worldSurfaceAreaM2 = 0;
    let uvSurfaceArea = 0;

    for (const isl of islands) {
      worldSurfaceAreaM2 += isl.worldArea;
      uvSurfaceArea += isl.uvArea;
    }

    const texelDensityPxPerMeter =
      worldSurfaceAreaM2 > 1e-6
        ? Math.round(Math.sqrt(uvSurfaceArea / worldSurfaceAreaM2) * textureResolution)
        : 0;

    const uvCoveragePercent = Math.min(100, Math.round(uvSurfaceArea * 1000) / 10);

    return {
      meshName: mesh.name,
      islandCount: islands.length,
      seamEdgeCount,
      worldSurfaceAreaM2: Math.round(worldSurfaceAreaM2 * 100) / 100,
      uvSurfaceArea: Math.round(uvSurfaceArea * 1000) / 1000,
      texelDensityPxPerMeter,
      uvCoveragePercent,
      overlapDetected: uvSurfaceArea > 1.05,
      textureResolution,
    };
  }

  /**
   * Toggles a high-contrast numbered UV Checkerboard preview material on the selected mesh.
   */
  public toggleCheckerPreview(mesh: Mesh, forceState?: boolean): boolean {
    const targetState = forceState !== undefined ? forceState : !this.checkerPreviewActive;
    this.checkerPreviewActive = targetState;

    if (targetState) {
      if (!this.savedMaterials.has(mesh)) {
        this.savedMaterials.set(mesh, mesh.material);
      }
      if (!this.checkerMaterial || this.checkerMaterial.getScene() !== this.scene) {
        this.checkerMaterial = this.createCheckerboardMaterial();
      }
      mesh.material = this.checkerMaterial;
    } else {
      if (this.savedMaterials.has(mesh)) {
        mesh.material = this.savedMaterials.get(mesh) || null;
        this.savedMaterials.delete(mesh);
      }
    }
    return this.checkerPreviewActive;
  }

  private createCheckerboardMaterial(): StandardMaterial {
    const mat = new StandardMaterial('editor_uv_checker_mat', this.scene);
    const texSize = 512;
    const dynTex = new DynamicTexture('editor_uv_checker_tex', texSize, this.scene, false);
    const ctx = dynTex.getContext();
    if (ctx) {
      const cells = 8;
      const cellSize = texSize / cells;
      const palette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

      for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
          const isEven = (x + y) % 2 === 0;
          ctx.fillStyle = isEven ? '#1e293b' : '#0f172a';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          ctx.strokeStyle = palette[(x + y) % palette.length];
          ctx.lineWidth = 2;
          ctx.strokeRect(x * cellSize + 2, y * cellSize + 2, cellSize - 4, cellSize - 4);
        }
      }
      dynTex.update();
    }
    mat.diffuseTexture = dynTex;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    mat.backFaceCulling = false;
    return mat;
  }

  /**
   * Renders the 2D UV map wireframe, islands, and grid into a <canvas> element.
   */
  public renderUVLayoutToCanvas(mesh: Nullable<Mesh>, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw dark background & UV grid
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    const gridSteps = 8;
    for (let i = 1; i < gridSteps; i++) {
      const pos = (i / gridSteps) * w;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(w, pos);
      ctx.stroke();
    }

    // Draw [0, 1] border
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.35)';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    if (!mesh || mesh.isDisposed()) return;
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    const indices = mesh.getIndices();
    if (!uvs || !indices || uvs.length === 0) return;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.78)';
    ctx.lineWidth = 1;

    const numTris = Math.floor(indices.length / 3);
    for (let t = 0; t < numTris; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];

      const x0 = uvs[i0 * 2] * w;
      const y0 = (1 - uvs[i0 * 2 + 1]) * h;
      const x1 = uvs[i1 * 2] * w;
      const y1 = (1 - uvs[i1 * 2 + 1]) * h;
      const x2 = uvs[i2 * 2] * w;
      const y2 = (1 - uvs[i2 * 2 + 1]) * h;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  public dispose(): void {
    this.setActive(false);
    this.clearSeamOverlay();
    if (this.checkerMaterial) {
      this.checkerMaterial.dispose();
      this.checkerMaterial = null;
    }
  }
}
