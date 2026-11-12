import {
  Color3,
  FloatArray,
  IndicesArray,
  Matrix,
  Mesh,
  Nullable,
  PBRMaterial,
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { MeshEditorService } from '../MeshEditorService';

export interface BakeOptions {
  lowPolyMesh: Mesh;
  highPolyMesh?: Nullable<Mesh>;
  resolution?: 128 | 256 | 512 | 1024 | 2048;
  cageExtrusion?: number;
  bakeNormalMap?: boolean;
  bakeAO?: boolean;
  flipNormalY?: boolean;
  paddingPx?: number;
  applyToMaterial?: boolean;
  autoUnwrapIfOverlapping?: boolean;
}

export interface BakeResult {
  lowPolyMeshName: string;
  highPolyMeshName: string;
  resolution: number;
  cageExtrusion: number;
  rayHitCount: number;
  coveragePercent: number;
  normalMapBuffer: Uint8Array;
  aoMapBuffer: Uint8Array;
  normalMapDataUrl: string;
  aoMapDataUrl: string;
  appliedToMaterial: boolean;
}

interface HighPolyTriangle {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  n0: Vector3;
  n1: Vector3;
  n2: Vector3;
  faceNormal: Vector3;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * High-Poly to Low-Poly Raycast Texture Baker & Automatic Projection Cage Generator.
 * Bakes Tangent-Space Normal Maps and Ambient Occlusion (AO) Maps with UV seam dilation.
 */
export class TextureBaker {
  public service: MeshEditorService;
  public scene: Scene;

  public resolution: 128 | 256 | 512 | 1024 | 2048 = 512;
  public cageExtrusion: number = 0.04;
  public paddingPx: number = 4;
  public flipNormalY: boolean = false;
  public showCagePreview: boolean = false;

  private cagePreviewMesh: Nullable<Mesh> = null;
  public lastBakeResult: Nullable<BakeResult> = null;

  constructor(service: MeshEditorService) {
    this.service = service;
    this.scene = service.scene;
  }

  /**
   * Computes welded smooth vertex normals for a mesh so the extruded projection cage
   * has zero gaps or splits along hard UV/smoothing seams.
   */
  public computeSmoothCageNormals(positions: FloatArray, indices: IndicesArray): Float32Array {
    const quant = 10000;
    const posMap = new Map<string, Vector3>();
    const numVerts = Math.floor(positions.length / 3);
    const keys: string[] = new Array(numVerts);

    for (let i = 0; i < numVerts; i++) {
      const k = `${Math.round(positions[i * 3] * quant)},${Math.round(positions[i * 3 + 1] * quant)},${Math.round(positions[i * 3 + 2] * quant)}`;
      keys[i] = k;
      if (!posMap.has(k)) {
        posMap.set(k, new Vector3(0, 0, 0));
      }
    }

    const numTris = Math.floor(indices.length / 3);
    for (let f = 0; f < numTris; f++) {
      const i0 = indices[f * 3];
      const i1 = indices[f * 3 + 1];
      const i2 = indices[f * 3 + 2];
      const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
      const fn = Vector3.Cross(p1.subtract(p0), p2.subtract(p0));
      posMap.get(keys[i0])!.addInPlace(fn);
      posMap.get(keys[i1])!.addInPlace(fn);
      posMap.get(keys[i2])!.addInPlace(fn);
    }

    for (const vec of posMap.values()) {
      if (vec.lengthSquared() > 1e-12) vec.normalize();
      else vec.set(0, 1, 0);
    }

    const out = new Float32Array(positions.length);
    for (let i = 0; i < numVerts; i++) {
      const n = posMap.get(keys[i])!;
      out[i * 3] = n.x;
      out[i * 3 + 1] = n.y;
      out[i * 3 + 2] = n.z;
    }
    return out;
  }

  /**
   * Generates or updates a 3D wireframe Projection Cage around `lowPolyMesh` inflated by `extrusion`.
   */
  public updateCagePreview(
    lowPolyMesh: Nullable<Mesh>,
    extrusion: number = this.cageExtrusion,
    visible: boolean = this.showCagePreview
  ): Nullable<Mesh> {
    this.clearCagePreview();
    this.cageExtrusion = Math.max(0.001, Math.min(extrusion, 2.0));
    this.showCagePreview = visible;

    if (!visible || !lowPolyMesh || lowPolyMesh.isDisposed()) {
      return null;
    }

    const positions = lowPolyMesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = lowPolyMesh.getIndices();
    if (!positions || !indices || positions.length < 9) return null;

    const smoothNormals = this.computeSmoothCageNormals(positions, indices);
    const cagePositions = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      cagePositions[i] = positions[i] + smoothNormals[i] * this.cageExtrusion;
      cagePositions[i + 1] = positions[i + 1] + smoothNormals[i + 1] * this.cageExtrusion;
      cagePositions[i + 2] = positions[i + 2] + smoothNormals[i + 2] * this.cageExtrusion;
    }

    const cageMesh = new Mesh('editor_bake_cage_preview', this.scene);
    const vd = new VertexData();
    vd.positions = cagePositions;
    vd.indices = Array.from(indices);
    vd.normals = smoothNormals;
    vd.applyToMesh(cageMesh, true);

    lowPolyMesh.computeWorldMatrix(true);
    cageMesh.position.copyFrom(lowPolyMesh.position);
    cageMesh.rotation.copyFrom(lowPolyMesh.rotation);
    if (lowPolyMesh.rotationQuaternion) {
      cageMesh.rotationQuaternion = lowPolyMesh.rotationQuaternion.clone();
    }
    cageMesh.scaling.copyFrom(lowPolyMesh.scaling);
    cageMesh.parent = lowPolyMesh.parent;

    const cageMat = new StandardMaterial('editor_bake_cage_mat', this.scene);
    cageMat.diffuseColor = new Color3(0.22, 0.74, 0.97);
    cageMat.emissiveColor = new Color3(0.15, 0.65, 0.95);
    cageMat.wireframe = true;
    cageMat.disableLighting = true;
    cageMat.alpha = 0.65;
    cageMesh.material = cageMat;
    cageMesh.isPickable = false;

    this.cagePreviewMesh = cageMesh;
    return cageMesh;
  }

  public clearCagePreview(): void {
    if (this.cagePreviewMesh) {
      if (this.cagePreviewMesh.material) {
        this.cagePreviewMesh.material.dispose();
      }
      this.cagePreviewMesh.dispose();
      this.cagePreviewMesh = null;
    }
  }

  /**
   * Automatically calculates an optimal cage extrusion distance based on the bounding distance
   * between the High-Poly mesh and Low-Poly mesh.
   */
  public computeAutoCageDistance(lowPolyMesh: Mesh, highPolyMesh?: Nullable<Mesh>): number {
    lowPolyMesh.computeWorldMatrix(true);
    lowPolyMesh.refreshBoundingInfo();
    const lowBounds = lowPolyMesh.getBoundingInfo().boundingBox;
    const diag = Vector3.Distance(lowBounds.minimumWorld, lowBounds.maximumWorld);

    if (!highPolyMesh || highPolyMesh === lowPolyMesh) {
      this.cageExtrusion = Math.max(0.01, Math.min(0.25, Math.round(diag * 0.025 * 1000) / 1000));
      return this.cageExtrusion;
    }

    highPolyMesh.computeWorldMatrix(true);
    highPolyMesh.refreshBoundingInfo();
    const highBounds = highPolyMesh.getBoundingInfo().boundingBox;

    const maxDiff = Math.max(
      Math.abs(highBounds.maximumWorld.x - lowBounds.maximumWorld.x),
      Math.abs(highBounds.maximumWorld.y - lowBounds.maximumWorld.y),
      Math.abs(highBounds.maximumWorld.z - lowBounds.maximumWorld.z),
      Math.abs(highBounds.minimumWorld.x - lowBounds.minimumWorld.x),
      Math.abs(highBounds.minimumWorld.y - lowBounds.minimumWorld.y),
      Math.abs(highBounds.minimumWorld.z - lowBounds.minimumWorld.z)
    );

    this.cageExtrusion = Math.max(
      0.01,
      Math.min(0.5, Math.round(Math.max(maxDiff * 1.35, diag * 0.025) * 1000) / 1000)
    );
    return this.cageExtrusion;
  }

  /**
   * Executes raycast Tangent-Space Normal Map and Ambient Occlusion baking from High-Poly to Low-Poly.
   */
  public async bakeTextures(options: BakeOptions): Promise<BakeResult> {
    const lowPoly = options.lowPolyMesh;
    const highPoly = options.highPolyMesh || lowPoly;
    const res = options.resolution || this.resolution;
    const cageDist = options.cageExtrusion ?? this.cageExtrusion;
    const flipY = options.flipNormalY ?? this.flipNormalY;
    const paddingPx = options.paddingPx ?? this.paddingPx;
    const applyToMaterial = options.applyToMaterial ?? true;
    const autoUnwrapIfOverlapping = options.autoUnwrapIfOverlapping ?? false;

    // Ensure low-poly mesh has valid UVs
    let lowUVs = lowPoly.getVerticesData(VertexBuffer.UVKind);
    const lowPos = lowPoly.getVerticesData(VertexBuffer.PositionKind);
    const lowInd = lowPoly.getIndices();
    if (!lowPos || !lowInd || lowInd.length < 3) {
      throw new Error(`Low-poly mesh "${lowPoly.name}" has no valid geometry to bake.`);
    }

    if (!lowUVs || lowUVs.length < (lowPos.length / 3) * 2) {
      this.service.uvUnwrapController?.unwrapMesh(lowPoly);
      lowUVs = lowPoly.getVerticesData(VertexBuffer.UVKind);
    } else if (autoUnwrapIfOverlapping && this.service.uvUnwrapController) {
      const stats = this.service.uvUnwrapController.analyzeUVs(lowPoly);
      if (stats.overlapDetected) {
        this.service.uvUnwrapController.unwrapMesh(lowPoly);
        lowUVs = lowPoly.getVerticesData(VertexBuffer.UVKind);
      }
    }

    const finalLowPos = lowPoly.getVerticesData(VertexBuffer.PositionKind)!;
    const finalLowInd = lowPoly.getIndices()!;
    const finalLowUVs = lowPoly.getVerticesData(VertexBuffer.UVKind)!;
    let finalLowNorms = lowPoly.getVerticesData(VertexBuffer.NormalKind);
    if (!finalLowNorms || finalLowNorms.length !== finalLowPos.length) {
      const comp: number[] = [];
      VertexData.ComputeNormals(finalLowPos, finalLowInd, comp);
      finalLowNorms = comp;
    }

    const cageSmoothNormals = this.computeSmoothCageNormals(finalLowPos, finalLowInd);

    lowPoly.computeWorldMatrix(true);
    highPoly.computeWorldMatrix(true);
    const lowWorldMat = lowPoly.getWorldMatrix();
    const highWorldMat = highPoly.getWorldMatrix();

    // Prepare High-Poly world triangles with smooth normals for raycast projection
    const highTris = this.extractHighPolyTriangles(highPoly, highWorldMat);

    const pixelCount = res * res;
    const normalBuffer = new Uint8Array(pixelCount * 4);
    const aoBuffer = new Uint8Array(pixelCount * 4);
    const coverageMask = new Uint8Array(pixelCount);

    // Initialize default flat tangent-space normal [128, 128, 255, 255] and white AO [245, 245, 245, 255]
    for (let i = 0; i < pixelCount; i++) {
      normalBuffer[i * 4] = 128;
      normalBuffer[i * 4 + 1] = 128;
      normalBuffer[i * 4 + 2] = 255;
      normalBuffer[i * 4 + 3] = 255;

      aoBuffer[i * 4] = 242;
      aoBuffer[i * 4 + 1] = 242;
      aoBuffer[i * 4 + 2] = 242;
      aoBuffer[i * 4 + 3] = 255;
    }

    let rayHitCount = 0;
    let coveredTexelCount = 0;
    const numLowTris = Math.floor(finalLowInd.length / 3);
    const maxRayDist = Math.max(cageDist * 3.5, 0.25);

    // For Self-Bake mode: precompute face normals and crease flags so internal coplanar edges (e.g. quad diagonals) are not beveled
    const triEdgeCrease = new Uint8Array(numLowTris * 3);
    if (highPoly === lowPoly || highTris.length === 0) {
      const quant = 10000;
      const getCanonKey = (idx: number) =>
        `${Math.round(finalLowPos[idx * 3] * quant)},${Math.round(finalLowPos[idx * 3 + 1] * quant)},${Math.round(finalLowPos[idx * 3 + 2] * quant)}`;

      const faceNormals: Vector3[] = new Array(numLowTris);
      for (let f = 0; f < numLowTris; f++) {
        const i0 = finalLowInd[f * 3];
        const i1 = finalLowInd[f * 3 + 1];
        const i2 = finalLowInd[f * 3 + 2];
        const p0 = new Vector3(finalLowPos[i0 * 3], finalLowPos[i0 * 3 + 1], finalLowPos[i0 * 3 + 2]);
        const p1 = new Vector3(finalLowPos[i1 * 3], finalLowPos[i1 * 3 + 1], finalLowPos[i1 * 3 + 2]);
        const p2 = new Vector3(finalLowPos[i2 * 3], finalLowPos[i2 * 3 + 1], finalLowPos[i2 * 3 + 2]);
        const fn = Vector3.Cross(p1.subtract(p0), p2.subtract(p0));
        if (fn.lengthSquared() > 1e-12) fn.normalize();
        else fn.set(0, 1, 0);
        faceNormals[f] = fn;
      }

      const edgeMap = new Map<string, { tri: number; edge: number }[]>();
      for (let f = 0; f < numLowTris; f++) {
        const k0 = getCanonKey(finalLowInd[f * 3]);
        const k1 = getCanonKey(finalLowInd[f * 3 + 1]);
        const k2 = getCanonKey(finalLowInd[f * 3 + 2]);

        const edges = [
          k0 < k1 ? `${k0}_${k1}` : `${k1}_${k0}`,
          k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`,
          k2 < k0 ? `${k2}_${k0}` : `${k0}_${k2}`,
        ];

        for (let e = 0; e < 3; e++) {
          const ek = edges[e];
          let list = edgeMap.get(ek);
          if (!list) {
            list = [];
            edgeMap.set(ek, list);
          }
          list.push({ tri: f, edge: e });
        }
      }

      for (let f = 0; f < numLowTris; f++) {
        const k0 = getCanonKey(finalLowInd[f * 3]);
        const k1 = getCanonKey(finalLowInd[f * 3 + 1]);
        const k2 = getCanonKey(finalLowInd[f * 3 + 2]);

        const edges = [
          k0 < k1 ? `${k0}_${k1}` : `${k1}_${k0}`,
          k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`,
          k2 < k0 ? `${k2}_${k0}` : `${k0}_${k2}`,
        ];

        for (let e = 0; e < 3; e++) {
          const sharing = edgeMap.get(edges[e]);
          let isCoplanar = false;
          if (sharing && sharing.length > 1) {
            for (const other of sharing) {
              if (other.tri !== f) {
                const dot = Vector3.Dot(faceNormals[f], faceNormals[other.tri]);
                if (dot > 0.85) {
                  isCoplanar = true;
                  break;
                }
              }
            }
          }
          triEdgeCrease[f * 3 + e] = isCoplanar ? 0 : 1;
        }
      }
    }

    for (let f = 0; f < numLowTris; f++) {
      const i0 = finalLowInd[f * 3];
      const i1 = finalLowInd[f * 3 + 1];
      const i2 = finalLowInd[f * 3 + 2];

      const u0 = finalLowUVs[i0 * 2];
      const v0 = finalLowUVs[i0 * 2 + 1];
      const u1 = finalLowUVs[i1 * 2];
      const v1 = finalLowUVs[i1 * 2 + 1];
      const u2 = finalLowUVs[i2 * 2];
      const v2 = finalLowUVs[i2 * 2 + 1];

      const wp0 = Vector3.TransformCoordinates(
        new Vector3(finalLowPos[i0 * 3], finalLowPos[i0 * 3 + 1], finalLowPos[i0 * 3 + 2]),
        lowWorldMat
      );
      const wp1 = Vector3.TransformCoordinates(
        new Vector3(finalLowPos[i1 * 3], finalLowPos[i1 * 3 + 1], finalLowPos[i1 * 3 + 2]),
        lowWorldMat
      );
      const wp2 = Vector3.TransformCoordinates(
        new Vector3(finalLowPos[i2 * 3], finalLowPos[i2 * 3 + 1], finalLowPos[i2 * 3 + 2]),
        lowWorldMat
      );

      const wn0 = Vector3.TransformNormal(
        new Vector3(finalLowNorms[i0 * 3], finalLowNorms[i0 * 3 + 1], finalLowNorms[i0 * 3 + 2]),
        lowWorldMat
      ).normalize();
      const wn1 = Vector3.TransformNormal(
        new Vector3(finalLowNorms[i1 * 3], finalLowNorms[i1 * 3 + 1], finalLowNorms[i1 * 3 + 2]),
        lowWorldMat
      ).normalize();
      const wn2 = Vector3.TransformNormal(
        new Vector3(finalLowNorms[i2 * 3], finalLowNorms[i2 * 3 + 1], finalLowNorms[i2 * 3 + 2]),
        lowWorldMat
      ).normalize();

      const cn0 = Vector3.TransformNormal(
        new Vector3(cageSmoothNormals[i0 * 3], cageSmoothNormals[i0 * 3 + 1], cageSmoothNormals[i0 * 3 + 2]),
        lowWorldMat
      ).normalize();
      const cn1 = Vector3.TransformNormal(
        new Vector3(cageSmoothNormals[i1 * 3], cageSmoothNormals[i1 * 3 + 1], cageSmoothNormals[i1 * 3 + 2]),
        lowWorldMat
      ).normalize();
      const cn2 = Vector3.TransformNormal(
        new Vector3(cageSmoothNormals[i2 * 3], cageSmoothNormals[i2 * 3 + 1], cageSmoothNormals[i2 * 3 + 2]),
        lowWorldMat
      ).normalize();

      // Compute triangle tangent basis (T, B) from UV derivatives
      const edge1 = wp1.subtract(wp0);
      const edge2 = wp2.subtract(wp0);
      const du1 = u1 - u0;
      const dv1 = v1 - v0;
      const du2 = u2 - u0;
      const dv2 = v2 - v0;
      const det = du1 * dv2 - du2 * dv1;

      let tangent: Vector3;
      let bitangent: Vector3;
      if (Math.abs(det) > 1e-8) {
        const invDet = 1.0 / det;
        tangent = edge1.scale(dv2 * invDet).subtract(edge2.scale(dv1 * invDet)).normalize();
        bitangent = edge2.scale(du1 * invDet).subtract(edge1.scale(du2 * invDet)).normalize();
      } else {
        const up = Math.abs(wn0.y) < 0.9 ? Vector3.Up() : Vector3.Right();
        tangent = Vector3.Cross(up, wn0).normalize();
        bitangent = Vector3.Cross(wn0, tangent).normalize();
      }

      // Bounding box in pixel coordinates [0, res - 1]
      const x0 = u0 * res;
      const y0 = (1 - v0) * res;
      const x1 = u1 * res;
      const y1 = (1 - v1) * res;
      const x2 = u2 * res;
      const y2 = (1 - v2) * res;

      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const maxX = Math.min(res - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const maxY = Math.min(res - 1, Math.ceil(Math.max(y0, y1, y2)));

      const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(denom) < 1e-8) continue;
      const invDenom = 1.0 / denom;

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const sx = px + 0.5;
          const sy = py + 0.5;

          const w0 = ((y1 - y2) * (sx - x2) + (x2 - x1) * (sy - y2)) * invDenom;
          const w1 = ((y2 - y0) * (sx - x2) + (x0 - x2) * (sy - y2)) * invDenom;
          const w2 = 1.0 - w0 - w1;

          if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;

          const cw0 = Math.max(0, w0);
          const cw1 = Math.max(0, w1);
          const cw2 = Math.max(0, w2);
          const wSum = cw0 + cw1 + cw2 || 1;
          const b0 = cw0 / wSum;
          const b1 = cw1 / wSum;
          const b2 = cw2 / wSum;

          const pIdx = py * res + px;
          if (coverageMask[pIdx] === 0) {
            coverageMask[pIdx] = 1;
            coveredTexelCount++;
          }

          // Interpolated Low-Poly position, surface normal, and cage ray origin
          const lowPoint = new Vector3(
            wp0.x * b0 + wp1.x * b1 + wp2.x * b2,
            wp0.y * b0 + wp1.y * b1 + wp2.y * b2,
            wp0.z * b0 + wp1.z * b1 + wp2.z * b2
          );
          const lowNormal = new Vector3(
            wn0.x * b0 + wn1.x * b1 + wn2.x * b2,
            wn0.y * b0 + wn1.y * b1 + wn2.y * b2,
            wn0.z * b0 + wn1.z * b1 + wn2.z * b2
          ).normalize();
          const cageNormal = new Vector3(
            cn0.x * b0 + cn1.x * b1 + cn2.x * b2,
            cn0.y * b0 + cn1.y * b1 + cn2.y * b2,
            cn0.z * b0 + cn1.z * b1 + cn2.z * b2
          ).normalize();

          const rayOrigin = lowPoint.add(cageNormal.scale(cageDist));
          const rayDir = cageNormal.scale(-1);

          // Sample High-Poly normal & cavity depth via raycast from Cage inward
          let sampledNormal = cageNormal;
          let hitDepthRatio = 0.0;

          if (highPoly !== lowPoly && highTris.length > 0) {
            const hit = this.raycastHighPoly(rayOrigin, rayDir, maxRayDist, highTris);
            if (hit) {
              sampledNormal = hit.normal;
              hitDepthRatio = Math.abs(hit.distance - cageDist) / Math.max(0.001, cageDist);
              rayHitCount++;
            }
          } else {
            // Self-baking: blend smooth cage normal with bevel edge relief near sharp/boundary edges only
            // Edge 0 (i0->i1) is opposite vertex 2 (b2 -> 0)
            // Edge 1 (i1->i2) is opposite vertex 0 (b0 -> 0)
            // Edge 2 (i2->i0) is opposite vertex 1 (b1 -> 0)
            const isCrease0 = triEdgeCrease[f * 3] === 1;
            const isCrease1 = triEdgeCrease[f * 3 + 1] === 1;
            const isCrease2 = triEdgeCrease[f * 3 + 2] === 1;

            const dist0 = isCrease1 ? b0 : 1.0;
            const dist1 = isCrease2 ? b1 : 1.0;
            const dist2 = isCrease0 ? b2 : 1.0;
            const edgeMinBary = Math.min(dist0, dist1, dist2) * 3.0;
            const bevelBlend = Math.min(1.0, edgeMinBary * 2.2);
            sampledNormal = Vector3.Lerp(cageNormal, lowNormal, bevelBlend).normalize();
            hitDepthRatio = (1.0 - bevelBlend) * 0.35;
            rayHitCount++;
          }

          // Orthonormalize TBN at this texel
          const N = lowNormal;
          const T = tangent.subtract(N.scale(Vector3.Dot(tangent, N))).normalize();
          const B = bitangent.subtract(N.scale(Vector3.Dot(bitangent, N))).normalize();

          const tsX = Vector3.Dot(sampledNormal, T);
          const tsY = Vector3.Dot(sampledNormal, B) * (flipY ? -1 : 1);
          const tsZ = Math.max(0.05, Vector3.Dot(sampledNormal, N));
          const tsLen = Math.sqrt(tsX * tsX + tsY * tsY + tsZ * tsZ) || 1;

          const rNorm = Math.round(((tsX / tsLen) * 0.5 + 0.5) * 255);
          const gNorm = Math.round(((tsY / tsLen) * 0.5 + 0.5) * 255);
          const bNorm = Math.round(((tsZ / tsLen) * 0.5 + 0.5) * 255);

          normalBuffer[pIdx * 4] = Math.max(0, Math.min(255, rNorm));
          normalBuffer[pIdx * 4 + 1] = Math.max(0, Math.min(255, gNorm));
          normalBuffer[pIdx * 4 + 2] = Math.max(0, Math.min(255, bNorm));
          normalBuffer[pIdx * 4 + 3] = 255;

          // Compute Ambient Occlusion (cavity + normal alignment occlusion)
          const normalAlignment = Math.max(0, Vector3.Dot(sampledNormal, cageNormal));
          const aoFactor = Math.max(
            0.18,
            Math.min(1.0, (0.55 + 0.45 * normalAlignment) * (1.0 - Math.min(0.45, hitDepthRatio * 0.4)))
          );
          const aoByte = Math.round(aoFactor * 255);
          aoBuffer[pIdx * 4] = aoByte;
          aoBuffer[pIdx * 4 + 1] = aoByte;
          aoBuffer[pIdx * 4 + 2] = aoByte;
          aoBuffer[pIdx * 4 + 3] = 255;
        }
      }
    }

    // Apply UV island border dilation (padding) so mipmaps never bleed along seams
    if (paddingPx > 0) {
      this.dilateBuffers(normalBuffer, aoBuffer, coverageMask, res, paddingPx);
    }

    const normalMapDataUrl = this.rgbaBufferToDataURL(normalBuffer, res, res);
    const aoMapDataUrl = this.rgbaBufferToDataURL(aoBuffer, res, res);

    if (applyToMaterial) {
      this.applyBakedTexturesToMesh(lowPoly, normalBuffer, aoBuffer, res);
    }

    const coveragePercent = Math.round((coveredTexelCount / pixelCount) * 1000) / 10;

    const result: BakeResult = {
      lowPolyMeshName: lowPoly.name,
      highPolyMeshName: highPoly.name,
      resolution: res,
      cageExtrusion: cageDist,
      rayHitCount,
      coveragePercent,
      normalMapBuffer: normalBuffer,
      aoMapBuffer: aoBuffer,
      normalMapDataUrl,
      aoMapDataUrl,
      appliedToMaterial: applyToMaterial,
    };

    this.lastBakeResult = result;
    return result;
  }

  private extractHighPolyTriangles(highPoly: Mesh, worldMat: Matrix): HighPolyTriangle[] {
    const pos = highPoly.getVerticesData(VertexBuffer.PositionKind);
    const ind = highPoly.getIndices();
    if (!pos || !ind || ind.length < 3) return [];

    const smoothNorms = this.computeSmoothCageNormals(pos, ind);
    const numTris = Math.floor(ind.length / 3);
    // Cap triangle step if ultra dense so baking completes in <200ms in JS
    const step = Math.max(1, Math.floor(numTris / 4000));
    const tris: HighPolyTriangle[] = [];

    for (let f = 0; f < numTris; f += step) {
      const i0 = ind[f * 3];
      const i1 = ind[f * 3 + 1];
      const i2 = ind[f * 3 + 2];

      const p0 = Vector3.TransformCoordinates(
        new Vector3(pos[i0 * 3], pos[i0 * 3 + 1], pos[i0 * 3 + 2]),
        worldMat
      );
      const p1 = Vector3.TransformCoordinates(
        new Vector3(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]),
        worldMat
      );
      const p2 = Vector3.TransformCoordinates(
        new Vector3(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]),
        worldMat
      );

      const n0 = Vector3.TransformNormal(
        new Vector3(smoothNorms[i0 * 3], smoothNorms[i0 * 3 + 1], smoothNorms[i0 * 3 + 2]),
        worldMat
      ).normalize();
      const n1 = Vector3.TransformNormal(
        new Vector3(smoothNorms[i1 * 3], smoothNorms[i1 * 3 + 1], smoothNorms[i1 * 3 + 2]),
        worldMat
      ).normalize();
      const n2 = Vector3.TransformNormal(
        new Vector3(smoothNorms[i2 * 3], smoothNorms[i2 * 3 + 1], smoothNorms[i2 * 3 + 2]),
        worldMat
      ).normalize();

      const faceNormal = Vector3.Cross(p1.subtract(p0), p2.subtract(p0)).normalize();

      tris.push({
        p0,
        p1,
        p2,
        n0,
        n1,
        n2,
        faceNormal,
        minX: Math.min(p0.x, p1.x, p2.x),
        maxX: Math.max(p0.x, p1.x, p2.x),
        minY: Math.min(p0.y, p1.y, p2.y),
        maxY: Math.max(p0.y, p1.y, p2.y),
        minZ: Math.min(p0.z, p1.z, p2.z),
        maxZ: Math.max(p0.z, p1.z, p2.z),
      });
    }

    return tris;
  }

  /**
   * Möller–Trumbore ray-triangle intersection with barycentric smooth normal interpolation.
   */
  private raycastHighPoly(
    origin: Vector3,
    dir: Vector3,
    maxDist: number,
    tris: HighPolyTriangle[]
  ): Nullable<{ distance: number; normal: Vector3 }> {
    let bestT = maxDist;
    let bestNormal: Nullable<Vector3> = null;

    const rMinX = Math.min(origin.x, origin.x + dir.x * maxDist) - 0.05;
    const rMaxX = Math.max(origin.x, origin.x + dir.x * maxDist) + 0.05;
    const rMinY = Math.min(origin.y, origin.y + dir.y * maxDist) - 0.05;
    const rMaxY = Math.max(origin.y, origin.y + dir.y * maxDist) + 0.05;
    const rMinZ = Math.min(origin.z, origin.z + dir.z * maxDist) - 0.05;
    const rMaxZ = Math.max(origin.z, origin.z + dir.z * maxDist) + 0.05;

    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      if (
        t.maxX < rMinX ||
        t.minX > rMaxX ||
        t.maxY < rMinY ||
        t.minY > rMaxY ||
        t.maxZ < rMinZ ||
        t.minZ > rMaxZ
      ) {
        continue;
      }

      const e1x = t.p1.x - t.p0.x;
      const e1y = t.p1.y - t.p0.y;
      const e1z = t.p1.z - t.p0.z;
      const e2x = t.p2.x - t.p0.x;
      const e2y = t.p2.y - t.p0.y;
      const e2z = t.p2.z - t.p0.z;

      const hx = dir.y * e2z - dir.z * e2y;
      const hy = dir.z * e2x - dir.x * e2z;
      const hz = dir.x * e2y - dir.y * e2x;

      const a = e1x * hx + e1y * hy + e1z * hz;
      if (a > -1e-7 && a < 1e-7) continue;

      const f = 1.0 / a;
      const sx = origin.x - t.p0.x;
      const sy = origin.y - t.p0.y;
      const sz = origin.z - t.p0.z;

      const u = f * (sx * hx + sy * hy + sz * hz);
      if (u < 0.0 || u > 1.0) continue;

      const qx = sy * e1z - sz * e1y;
      const qy = sz * e1x - sx * e1z;
      const qz = sx * e1y - sy * e1x;

      const v = f * (dir.x * qx + dir.y * qy + dir.z * qz);
      if (v < 0.0 || u + v > 1.0) continue;

      const dist = f * (e2x * qx + e2y * qy + e2z * qz);
      if (dist >= 0 && dist < bestT) {
        bestT = dist;
        const w = 1.0 - u - v;
        bestNormal = new Vector3(
          t.n0.x * w + t.n1.x * u + t.n2.x * v,
          t.n0.y * w + t.n1.y * u + t.n2.y * v,
          t.n0.z * w + t.n1.z * u + t.n2.z * v
        ).normalize();
      }
    }

    if (!bestNormal) return null;
    return { distance: bestT, normal: bestNormal };
  }

  /**
   * Dilates baked pixels outward by `passes` pixels to eliminate UV seam mipmap bleeding.
   */
  private dilateBuffers(
    normalBuf: Uint8Array,
    aoBuf: Uint8Array,
    mask: Uint8Array,
    res: number,
    passes: number
  ): void {
    const nextMask = new Uint8Array(mask.length);
    const offsets = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (let p = 0; p < passes; p++) {
      nextMask.set(mask);
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const idx = y * res + x;
          if (mask[idx] !== 0) continue;

          let rN = 0,
            gN = 0,
            bN = 0,
            aoSum = 0,
            count = 0;

          for (const [dx, dy] of offsets) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < res && ny >= 0 && ny < res) {
              const nIdx = ny * res + nx;
              if (mask[nIdx] !== 0) {
                rN += normalBuf[nIdx * 4];
                gN += normalBuf[nIdx * 4 + 1];
                bN += normalBuf[nIdx * 4 + 2];
                aoSum += aoBuf[nIdx * 4];
                count++;
              }
            }
          }

          if (count > 0) {
            normalBuf[idx * 4] = Math.round(rN / count);
            normalBuf[idx * 4 + 1] = Math.round(gN / count);
            normalBuf[idx * 4 + 2] = Math.round(bN / count);
            const aoVal = Math.round(aoSum / count);
            aoBuf[idx * 4] = aoVal;
            aoBuf[idx * 4 + 1] = aoVal;
            aoBuf[idx * 4 + 2] = aoVal;
            nextMask[idx] = 1;
          }
        }
      }
      mask.set(nextMask);
    }
  }

  /**
   * Applies the baked Normal Map and Ambient Occlusion Map directly onto the Low-Poly mesh's material.
   */
  public applyBakedTexturesToMesh(
    mesh: Mesh,
    normalBuffer: Uint8Array,
    aoBuffer: Uint8Array,
    res: number
  ): void {
    const normalTex = RawTexture.CreateRGBATexture(
      normalBuffer,
      res,
      res,
      this.scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE
    );
    normalTex.name = `${mesh.name}_BakedNormalMap`;

    const aoTex = RawTexture.CreateRGBATexture(
      aoBuffer,
      res,
      res,
      this.scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE
    );
    aoTex.name = `${mesh.name}_BakedAOMap`;

    let mat = mesh.material;
    if (!mat || (!(mat instanceof PBRMaterial) && !(mat instanceof StandardMaterial))) {
      const pbr = new PBRMaterial(`${mesh.name}_BakedPBR`, this.scene);
      pbr.albedoColor = new Color3(0.78, 0.8, 0.84);
      pbr.metallic = 0.1;
      pbr.roughness = 0.55;
      mesh.material = pbr;
      mat = pbr;
    }

    if (mat instanceof PBRMaterial) {
      mat.bumpTexture = normalTex;
      mat.ambientTexture = aoTex;
      mat.ambientTextureStrength = 0.85;
    } else if (mat instanceof StandardMaterial) {
      mat.bumpTexture = normalTex;
      mat.ambientTexture = aoTex;
    }
  }

  /**
   * Renders either the baked Normal Map or AO Map into a 2D preview <canvas>.
   */
  public renderBakePreviewToCanvas(
    canvas: HTMLCanvasElement,
    channel: 'normal' | 'ao' = 'normal'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.lastBakeResult) {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const res = this.lastBakeResult.resolution;
    const src =
      channel === 'normal'
        ? this.lastBakeResult.normalMapBuffer
        : this.lastBakeResult.aoMapBuffer;

    if (typeof ImageData !== 'undefined') {
      try {
        const clamped = new Uint8ClampedArray(src);
        const imgData = new ImageData(clamped as any, res, res);
        const offscreen = document.createElement('canvas');
        offscreen.width = res;
        offscreen.height = res;
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.putImageData(imgData, 0, 0);
          ctx.drawImage(offscreen, 0, 0, w, h);
          return;
        }
      } catch {
        // Fallback below for headless jsdom
      }
    }

    ctx.fillStyle = channel === 'normal' ? '#8080ff' : '#e5e7eb';
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Converts an RGBA Uint8Array buffer into a valid image DataURL (with BMP fallback in headless jsdom).
   */
  private rgbaBufferToDataURL(buffer: Uint8Array, width: number, height: number): string {
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx && typeof ImageData !== 'undefined') {
          const clamped = new Uint8ClampedArray(buffer);
          ctx.putImageData(new ImageData(clamped as any, width, height), 0, 0);
          const url = canvas.toDataURL('image/png');
          if (url && url.startsWith('data:image/')) {
            return url;
          }
        }
      } catch {
        // Fallback to lightweight 24-bit BMP base64 encoding for headless test environments
      }
    }

    // Minimal valid 24-bit BMP header + pixel data encoded as base64
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    const bmp = new Uint8Array(fileSize);
    const view = new DataView(bmp.buffer);
    bmp[0] = 0x42; // 'B'
    bmp[1] = 0x4d; // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, -height, true); // top-down
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, pixelArraySize, true);

    for (let y = 0; y < height; y++) {
      const rowOffset = 54 + y * rowSize;
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = rowOffset + x * 3;
        bmp[dstIdx] = buffer[srcIdx + 2]; // B
        bmp[dstIdx + 1] = buffer[srcIdx + 1]; // G
        bmp[dstIdx + 2] = buffer[srcIdx]; // R
      }
    }

    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bmp.length; i += chunk) {
      binary += String.fromCharCode(...bmp.subarray(i, i + chunk));
    }
    const nodeBuffer = (globalThis as unknown as { Buffer?: { from(data: Uint8Array): { toString(enc: string): string } } }).Buffer;
    const b64 =
      typeof btoa === 'function'
        ? btoa(binary)
        : nodeBuffer
          ? nodeBuffer.from(bmp).toString('base64')
          : '';
    return `data:image/bmp;base64,${b64}`;
  }

  public dispose(): void {
    this.clearCagePreview();
  }
}
