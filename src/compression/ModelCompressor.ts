import {
  Engine,
  FilesInputStore,
  FloatArray,
  IndicesArray,
  Mesh,
  Nullable,
  QuadraticErrorSimplification,
  Scene,
  SceneLoader,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import {
  GLTF2Export,
  OBJExport,
  RegisterKHR_draco_mesh_compression,
  STLExport,
} from '@babylonjs/serializers';

// Ensure Draco mesh compression serializer extension is registered once
try {
  RegisterKHR_draco_mesh_compression();
} catch (e) {
  console.warn('[ModelCompressor] Draco serializer registration notice:', e);
}

export type CompressionPreset = 'lossless' | 'draco_balanced' | 'draco_ultra' | 'decimate_50' | 'custom';

export type ExportFormat = 'glb' | 'gltf' | 'obj' | 'stl';

export interface ModelCompressorOptions {
  preset?: CompressionPreset;
  weldVertices?: boolean;
  weldTolerance?: number; // Spatial hash tolerance (e.g. 1e-5)
  preserveHardEdges?: boolean; // Check vertex normals
  checkUVs?: boolean; // Check texture UV coordinates
  checkColors?: boolean; // Check vertex colors
  removeDegenerateFaces?: boolean; // Cull 0-area / collapsed triangles
  removeUnusedVertices?: boolean; // Strip unreferenced vertices from buffers
  simplifyMesh?: boolean; // Mesh decimation
  simplifyRatio?: number; // 0.1 to 1.0 (e.g. 0.5 = 50% target polygon count)
  dracoCompression?: boolean; // Enable KHR_draco_mesh_compression
  dracoLevel?: 'balanced' | 'ultra';
  optimizeTextures?: boolean; // Convert textures to WebP
  textureQuality?: number; // 0.1 to 1.0
  maxTextureResolution?: number; // 512, 1024, 2048
  exportFormat?: ExportFormat;
}

export interface MeshCleanResult {
  meshName: string;
  originalVertices: number;
  optimizedVertices: number;
  originalFaces: number;
  optimizedFaces: number;
  duplicateVerticesRemoved: number;
  degenerateFacesRemoved: number;
  unusedVerticesRemoved: number;
}

export interface ModelCompressorStats {
  meshCount: number;
  originalVertices: number;
  compressedVertices: number;
  originalFaces: number;
  compressedFaces: number;
  duplicateVerticesRemoved: number;
  degenerateFacesRemoved: number;
  unusedVerticesRemoved: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  byteSavingsPercent: number;
  details: MeshCleanResult[];
}

export class ModelCompressor {
  /**
   * Applies preset defaults to the given options object.
   */
  public static resolveOptions(options: Partial<ModelCompressorOptions> = {}): ModelCompressorOptions {
    const preset = options.preset || 'lossless';
    const defaults: ModelCompressorOptions = {
      preset,
      weldVertices: true,
      weldTolerance: 1e-5,
      preserveHardEdges: true,
      checkUVs: true,
      checkColors: true,
      removeDegenerateFaces: true,
      removeUnusedVertices: true,
      simplifyMesh: false,
      simplifyRatio: 0.5,
      dracoCompression: false,
      dracoLevel: 'balanced',
      optimizeTextures: false,
      textureQuality: 0.8,
      maxTextureResolution: 1024,
      exportFormat: 'glb',
    };

    switch (preset) {
      case 'lossless':
        return {
          ...defaults,
          weldVertices: true,
          removeDegenerateFaces: true,
          removeUnusedVertices: true,
          dracoCompression: false,
          simplifyMesh: false,
          ...options,
        };

      case 'draco_balanced':
        return {
          ...defaults,
          weldVertices: true,
          removeDegenerateFaces: true,
          removeUnusedVertices: true,
          dracoCompression: true,
          dracoLevel: 'balanced',
          simplifyMesh: false,
          exportFormat: 'glb',
          ...options,
        };

      case 'draco_ultra':
        return {
          ...defaults,
          weldVertices: true,
          weldTolerance: 1e-4,
          removeDegenerateFaces: true,
          removeUnusedVertices: true,
          dracoCompression: true,
          dracoLevel: 'ultra',
          simplifyMesh: false,
          exportFormat: 'glb',
          ...options,
        };

      case 'decimate_50':
        return {
          ...defaults,
          weldVertices: true,
          removeDegenerateFaces: true,
          removeUnusedVertices: true,
          simplifyMesh: true,
          simplifyRatio: 0.5,
          dracoCompression: true,
          exportFormat: 'glb',
          ...options,
        };

      case 'custom':
      default:
        return {
          ...defaults,
          ...options,
        };
    }
  }

  /**
   * Cleans a single mesh by deduplicating coincident vertices, culling zero-area/degenerate
   * triangles, and purging unreferenced buffer elements.
   * Preserves 100% of valid polygons when simplifyMesh is disabled.
   */
  public static cleanAndDeduplicateMesh(
    mesh: Mesh,
    options: Partial<ModelCompressorOptions> = {}
  ): MeshCleanResult {
    const opts = this.resolveOptions(options);

    const result: MeshCleanResult = {
      meshName: mesh.name,
      originalVertices: mesh.getTotalVertices(),
      optimizedVertices: mesh.getTotalVertices(),
      originalFaces: mesh.getTotalIndices() > 0 ? mesh.getTotalIndices() / 3 : 0,
      optimizedFaces: mesh.getTotalIndices() > 0 ? mesh.getTotalIndices() / 3 : 0,
      duplicateVerticesRemoved: 0,
      degenerateFacesRemoved: 0,
      unusedVerticesRemoved: 0,
    };

    const vertexData = VertexData.ExtractFromMesh(mesh);
    const positions = vertexData.positions;
    if (!positions || positions.length < 3) {
      return result;
    }

    const numVertices = positions.length / 3;
    let rawIndices = vertexData.indices;
    if (!rawIndices || rawIndices.length === 0) {
      rawIndices = new Uint32Array(numVertices);
      for (let i = 0; i < numVertices; i++) {
        (rawIndices as Uint32Array)[i] = i;
      }
    }

    const normals = vertexData.normals;
    const uvs = vertexData.uvs;
    const uvs2 = vertexData.uvs2;
    const colors = vertexData.colors;
    const matrixIndices = vertexData.matricesIndices;
    const matrixWeights = vertexData.matricesWeights;
    const matrixIndicesExtra = vertexData.matricesIndicesExtra;
    const matrixWeightsExtra = vertexData.matricesWeightsExtra;

    const tolerance = opts.weldTolerance || 1e-5;
    const factor = 1 / tolerance;

    // 1. Map each vertex to a canonical index by spatial and attribute key
    const uniqueMap = new Map<string, number>();
    const indexRemap = new Int32Array(numVertices);
    const canonicalPositions: number[] = [];
    const canonicalNormals: number[] = [];
    const canonicalUVs: number[] = [];
    const canonicalUV2s: number[] = [];
    const canonicalColors: number[] = [];
    const canonicalMatIndices: number[] = [];
    const canonicalMatWeights: number[] = [];
    const canonicalMatIndicesExtra: number[] = [];
    const canonicalMatWeightsExtra: number[] = [];

    let nextCanonicalIndex = 0;

    for (let i = 0; i < numVertices; i++) {
      let key: string;

      if (opts.weldVertices) {
        const px = Math.round(positions[i * 3] * factor);
        const py = Math.round(positions[i * 3 + 1] * factor);
        const pz = Math.round(positions[i * 3 + 2] * factor);
        key = `${px}|${py}|${pz}`;

        if (opts.preserveHardEdges && normals && normals.length >= (i + 1) * 3) {
          const nx = Math.round(normals[i * 3] * 100);
          const ny = Math.round(normals[i * 3 + 1] * 100);
          const nz = Math.round(normals[i * 3 + 2] * 100);
          key += `|n:${nx},${ny},${nz}`;
        }

        if (opts.checkUVs && uvs && uvs.length >= (i + 1) * 2) {
          const u = Math.round(uvs[i * 2] * 1000);
          const v = Math.round(uvs[i * 2 + 1] * 1000);
          key += `|u:${u},${v}`;
        }

        if (opts.checkColors && colors && colors.length >= (i + 1) * 4) {
          const r = Math.round(colors[i * 4] * 255);
          const g = Math.round(colors[i * 4 + 1] * 255);
          const b = Math.round(colors[i * 4 + 2] * 255);
          key += `|c:${r},${g},${b}`;
        }
      } else {
        key = String(i);
      }

      if (uniqueMap.has(key)) {
        indexRemap[i] = uniqueMap.get(key)!;
      } else {
        const cIdx = nextCanonicalIndex++;
        uniqueMap.set(key, cIdx);
        indexRemap[i] = cIdx;

        canonicalPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);

        if (normals && normals.length >= (i + 1) * 3) {
          canonicalNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        }
        if (uvs && uvs.length >= (i + 1) * 2) {
          canonicalUVs.push(uvs[i * 2], uvs[i * 2 + 1]);
        }
        if (uvs2 && uvs2.length >= (i + 1) * 2) {
          canonicalUV2s.push(uvs2[i * 2], uvs2[i * 2 + 1]);
        }
        if (colors && colors.length >= (i + 1) * 4) {
          canonicalColors.push(
            colors[i * 4],
            colors[i * 4 + 1],
            colors[i * 4 + 2],
            colors[i * 4 + 3]
          );
        }
        if (matrixIndices && matrixIndices.length >= (i + 1) * 4) {
          canonicalMatIndices.push(
            matrixIndices[i * 4],
            matrixIndices[i * 4 + 1],
            matrixIndices[i * 4 + 2],
            matrixIndices[i * 4 + 3]
          );
        }
        if (matrixWeights && matrixWeights.length >= (i + 1) * 4) {
          canonicalMatWeights.push(
            matrixWeights[i * 4],
            matrixWeights[i * 4 + 1],
            matrixWeights[i * 4 + 2],
            matrixWeights[i * 4 + 3]
          );
        }
        if (matrixIndicesExtra && matrixIndicesExtra.length >= (i + 1) * 4) {
          canonicalMatIndicesExtra.push(
            matrixIndicesExtra[i * 4],
            matrixIndicesExtra[i * 4 + 1],
            matrixIndicesExtra[i * 4 + 2],
            matrixIndicesExtra[i * 4 + 3]
          );
        }
        if (matrixWeightsExtra && matrixWeightsExtra.length >= (i + 1) * 4) {
          canonicalMatWeightsExtra.push(
            matrixWeightsExtra[i * 4],
            matrixWeightsExtra[i * 4 + 1],
            matrixWeightsExtra[i * 4 + 2],
            matrixWeightsExtra[i * 4 + 3]
          );
        }
      }
    }

    // 2. Filter triangles & cull degenerate (zero-area or collapsed line/point) faces
    const filteredIndices: number[] = [];
    const referencedCanonical = new Uint8Array(nextCanonicalIndex);

    for (let f = 0; f < rawIndices.length; f += 3) {
      const a = indexRemap[rawIndices[f]];
      const b = indexRemap[rawIndices[f + 1]];
      const c = indexRemap[rawIndices[f + 2]];

      if (opts.removeDegenerateFaces) {
        if (a === b || b === c || a === c) {
          result.degenerateFacesRemoved++;
          continue;
        }

        // Check for zero-area face
        const ax = canonicalPositions[a * 3];
        const ay = canonicalPositions[a * 3 + 1];
        const az = canonicalPositions[a * 3 + 2];

        const bx = canonicalPositions[b * 3];
        const by = canonicalPositions[b * 3 + 1];
        const bz = canonicalPositions[b * 3 + 2];

        const cx = canonicalPositions[c * 3];
        const cy = canonicalPositions[c * 3 + 1];
        const cz = canonicalPositions[c * 3 + 2];

        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;

        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;

        const crossX = aby * acz - abz * acy;
        const crossY = abz * acx - abx * acz;
        const crossZ = abx * acy - aby * acx;

        const areaSq = crossX * crossX + crossY * crossY + crossZ * crossZ;
        if (areaSq < 1e-14) {
          result.degenerateFacesRemoved++;
          continue;
        }
      }

      filteredIndices.push(a, b, c);
      referencedCanonical[a] = 1;
      referencedCanonical[b] = 1;
      referencedCanonical[c] = 1;
    }

    // 3. Compact buffers by removing unreferenced / orphan vertices
    const finalCanonicalMap = new Int32Array(nextCanonicalIndex);
    finalCanonicalMap.fill(-1);

    const finalPositions: number[] = [];
    const finalNormals: number[] = [];
    const finalUVs: number[] = [];
    const finalUV2s: number[] = [];
    const finalColors: number[] = [];
    const finalMatIndices: number[] = [];
    const finalMatWeights: number[] = [];
    const finalMatIndicesExtra: number[] = [];
    const finalMatWeightsExtra: number[] = [];

    let finalVertexCount = 0;

    for (let c = 0; c < nextCanonicalIndex; c++) {
      if (opts.removeUnusedVertices && referencedCanonical[c] === 0) {
        result.unusedVerticesRemoved++;
        continue;
      }

      finalCanonicalMap[c] = finalVertexCount++;
      finalPositions.push(
        canonicalPositions[c * 3],
        canonicalPositions[c * 3 + 1],
        canonicalPositions[c * 3 + 2]
      );

      if (canonicalNormals.length >= (c + 1) * 3) {
        finalNormals.push(
          canonicalNormals[c * 3],
          canonicalNormals[c * 3 + 1],
          canonicalNormals[c * 3 + 2]
        );
      }
      if (canonicalUVs.length >= (c + 1) * 2) {
        finalUVs.push(canonicalUVs[c * 2], canonicalUVs[c * 2 + 1]);
      }
      if (canonicalUV2s.length >= (c + 1) * 2) {
        finalUV2s.push(canonicalUV2s[c * 2], canonicalUV2s[c * 2 + 1]);
      }
      if (canonicalColors.length >= (c + 1) * 4) {
        finalColors.push(
          canonicalColors[c * 4],
          canonicalColors[c * 4 + 1],
          canonicalColors[c * 4 + 2],
          canonicalColors[c * 4 + 3]
        );
      }
      if (canonicalMatIndices.length >= (c + 1) * 4) {
        finalMatIndices.push(
          canonicalMatIndices[c * 4],
          canonicalMatIndices[c * 4 + 1],
          canonicalMatIndices[c * 4 + 2],
          canonicalMatIndices[c * 4 + 3]
        );
      }
      if (canonicalMatWeights.length >= (c + 1) * 4) {
        finalMatWeights.push(
          canonicalMatWeights[c * 4],
          canonicalMatWeights[c * 4 + 1],
          canonicalMatWeights[c * 4 + 2],
          canonicalMatWeights[c * 4 + 3]
        );
      }
      if (canonicalMatIndicesExtra.length >= (c + 1) * 4) {
        finalMatIndicesExtra.push(
          canonicalMatIndicesExtra[c * 4],
          canonicalMatIndicesExtra[c * 4 + 1],
          canonicalMatIndicesExtra[c * 4 + 2],
          canonicalMatIndicesExtra[c * 4 + 3]
        );
      }
      if (canonicalMatWeightsExtra.length >= (c + 1) * 4) {
        finalMatWeightsExtra.push(
          canonicalMatWeightsExtra[c * 4],
          canonicalMatWeightsExtra[c * 4 + 1],
          canonicalMatWeightsExtra[c * 4 + 2],
          canonicalMatWeightsExtra[c * 4 + 3]
        );
      }
    }

    const finalIndices: number[] = [];
    for (let f = 0; f < filteredIndices.length; f++) {
      const remapped = finalCanonicalMap[filteredIndices[f]];
      if (remapped >= 0) {
        finalIndices.push(remapped);
      }
    }

    // 4. Update the mesh vertex data
    const cleanedVd = new VertexData();
    cleanedVd.positions = finalPositions;
    cleanedVd.indices = finalIndices;

    if (finalNormals.length === finalPositions.length) {
      cleanedVd.normals = finalNormals;
    } else if (finalIndices.length > 0) {
      const computedNormals: number[] = [];
      VertexData.ComputeNormals(finalPositions, finalIndices, computedNormals);
      cleanedVd.normals = computedNormals;
    }

    if (finalUVs.length === (finalPositions.length / 3) * 2) {
      cleanedVd.uvs = finalUVs;
    }
    if (finalUV2s.length === (finalPositions.length / 3) * 2) {
      cleanedVd.uvs2 = finalUV2s;
    }
    if (finalColors.length === (finalPositions.length / 3) * 4) {
      cleanedVd.colors = finalColors;
    }
    if (finalMatIndices.length === (finalPositions.length / 3) * 4) {
      cleanedVd.matricesIndices = finalMatIndices;
    }
    if (finalMatWeights.length === (finalPositions.length / 3) * 4) {
      cleanedVd.matricesWeights = finalMatWeights;
    }
    if (finalMatIndicesExtra.length === (finalPositions.length / 3) * 4) {
      cleanedVd.matricesIndicesExtra = finalMatIndicesExtra;
    }
    if (finalMatWeightsExtra.length === (finalPositions.length / 3) * 4) {
      cleanedVd.matricesWeightsExtra = finalMatWeightsExtra;
    }

    const isUpdatable = mesh.isVertexBufferUpdatable(VertexBuffer.PositionKind);
    cleanedVd.applyToMesh(mesh, isUpdatable);

    result.optimizedVertices = finalVertexCount;
    result.optimizedFaces = finalIndices.length / 3;
    result.duplicateVerticesRemoved = Math.max(0, numVertices - nextCanonicalIndex);

    return result;
  }

  /**
   * Decimates polygon count of a mesh using Quadric Error Metric simplification.
   */
  public static async simplifyMesh(mesh: Mesh, targetRatio: number): Promise<void> {
    if (targetRatio >= 1.0 || targetRatio <= 0.0) return;

    return new Promise<void>((resolve) => {
      try {
        const simplifier = new QuadraticErrorSimplification(mesh);
        simplifier.simplify(
          {
            quality: Math.max(0.05, Math.min(0.95, targetRatio)),
            distance: 0,
            optimizeMesh: true,
          },
          (simplifiedMesh: Mesh) => {
            if (simplifiedMesh && !simplifiedMesh.isDisposed()) {
              const vd = VertexData.ExtractFromMesh(simplifiedMesh);
              vd.applyToMesh(mesh, mesh.isVertexBufferUpdatable(VertexBuffer.PositionKind));
              simplifiedMesh.dispose();
            }
            resolve();
          }
        );
      } catch (err) {
        console.warn(`[ModelCompressor] Simplification warning for ${mesh.name}:`, err);
        resolve();
      }
    });
  }

  /**
   * Calculates the approximate raw vertex geometry memory buffer footprint in bytes.
   */
  public static calculateMeshesBufferBytes(meshes: Mesh[]): number {
    let bytes = 0;
    for (const mesh of meshes) {
      if (!mesh || mesh.isDisposed()) continue;
      const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
      if (pos) bytes += pos.length * 4;
      const nrm = mesh.getVerticesData(VertexBuffer.NormalKind);
      if (nrm) bytes += nrm.length * 4;
      const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
      if (uvs) bytes += uvs.length * 4;
      const col = mesh.getVerticesData(VertexBuffer.ColorKind);
      if (col) bytes += col.length * 4;
      const ind = mesh.getIndices();
      if (ind) bytes += ind.length * (mesh.getTotalVertices() > 65535 ? 4 : 2);
    }
    return bytes;
  }

  /**
   * Optimizes a collection of meshes in-place and returns comprehensive statistics.
   */
  public static async optimizeMeshes(
    meshes: Mesh[],
    options: Partial<ModelCompressorOptions> = {}
  ): Promise<ModelCompressorStats> {
    const opts = this.resolveOptions(options);

    const stats: ModelCompressorStats = {
      meshCount: meshes.length,
      originalVertices: 0,
      compressedVertices: 0,
      originalFaces: 0,
      compressedFaces: 0,
      duplicateVerticesRemoved: 0,
      degenerateFacesRemoved: 0,
      unusedVerticesRemoved: 0,
      originalSizeBytes: this.calculateMeshesBufferBytes(meshes),
      compressedSizeBytes: 0,
      byteSavingsPercent: 0,
      details: [],
    };

    for (const m of meshes) {
      stats.originalVertices += m.getTotalVertices();
      stats.originalFaces += m.getTotalIndices() > 0 ? m.getTotalIndices() / 3 : 0;
    }

    for (const mesh of meshes) {
      if (!mesh || mesh.isDisposed() || mesh.getTotalVertices() === 0) continue;

      // 1. Clean & Deduplicate
      const detail = this.cleanAndDeduplicateMesh(mesh, opts);
      stats.details.push(detail);

      stats.duplicateVerticesRemoved += detail.duplicateVerticesRemoved;
      stats.degenerateFacesRemoved += detail.degenerateFacesRemoved;
      stats.unusedVerticesRemoved += detail.unusedVerticesRemoved;

      // 2. Simplification / Decimation if requested
      if (opts.simplifyMesh && opts.simplifyRatio && opts.simplifyRatio < 1.0) {
        await this.simplifyMesh(mesh, opts.simplifyRatio);
      }

      stats.compressedVertices += mesh.getTotalVertices();
      stats.compressedFaces += mesh.getTotalIndices() > 0 ? mesh.getTotalIndices() / 3 : 0;
    }

    stats.compressedSizeBytes = this.calculateMeshesBufferBytes(meshes);

    if (stats.originalSizeBytes > 0) {
      const diff = stats.originalSizeBytes - stats.compressedSizeBytes;
      stats.byteSavingsPercent = Math.max(
        0,
        Math.min(100, Math.round((diff / stats.originalSizeBytes) * 100))
      );
    }

    return stats;
  }

  /**
   * Compresses the meshes in the given scene and serializes to the chosen format with optional Draco compression.
   */
  public static async exportCompressedModel(
    scene: Scene,
    meshes: Mesh[],
    baseFilename: string,
    options: Partial<ModelCompressorOptions> = {}
  ): Promise<{ blob: Blob; filename: string; size: number }> {
    const opts = this.resolveOptions(options);
    const filename = baseFilename.replace(/\.[^/.]+$/, '');
    const format = opts.exportFormat || 'glb';

    const meshSet = new Set(meshes);
    const shouldExportNode = (node: any) => {
      if (!node) return false;
      return meshSet.has(node) || meshes.some((m) => m === node || node.isDescendantOf?.(m));
    };

    let exportedBlob: Nullable<Blob> = null;
    let fullFilename = `${filename}.${format}`;

    if (format === 'glb') {
      const glb = await GLTF2Export.GLBAsync(scene, filename, {
        shouldExportNode,
        meshCompressionMethod: opts.dracoCompression ? 'Draco' : 'None',
        exportWithoutWaitingForScene: true,
      });

      const fileMap = (glb as any)._glTFData?.files || (glb as any).files;
      if (fileMap) {
        for (const k in fileMap) {
          if (k.endsWith('.glb')) {
            exportedBlob = fileMap[k] as Blob;
            fullFilename = k;
            break;
          }
        }
      }

      if (!exportedBlob) {
        // Fallback interception
        exportedBlob = await new Promise<Blob>((resolve, reject) => {
          const originalCreate = URL.createObjectURL;
          URL.createObjectURL = (b: any) => {
            URL.createObjectURL = originalCreate;
            resolve(b);
            return originalCreate(b);
          };
          try {
            glb.downloadFiles();
          } catch (err) {
            URL.createObjectURL = originalCreate;
            reject(err);
          }
        });
      }
    } else if (format === 'gltf') {
      const gltf = await GLTF2Export.GLTFAsync(scene, filename, {
        shouldExportNode,
        meshCompressionMethod: opts.dracoCompression ? 'Draco' : 'None',
        exportWithoutWaitingForScene: true,
      });

      const fileMap = (gltf as any)._glTFData?.files || (gltf as any).files;
      if (fileMap) {
        for (const k in fileMap) {
          if (k.endsWith('.gltf')) {
            const val = fileMap[k];
            exportedBlob = val instanceof Blob ? val : new Blob([val], { type: 'model/gltf+json' });
            fullFilename = k;
            break;
          }
        }
      }
    } else if (format === 'obj') {
      const validMeshes = meshes.filter((m) => !m.isDisposed());
      const objText = OBJExport.OBJ(validMeshes as any, false, '', true);
      exportedBlob = new Blob([objText], { type: 'text/plain' });
      fullFilename = `${filename}.obj`;
    } else if (format === 'stl') {
      const validMeshes = meshes.filter((m) => !m.isDisposed());
      const stlData = STLExport.CreateSTL(validMeshes, false, filename, true, true);
      exportedBlob = new Blob([stlData as any], { type: 'application/sla' });
      fullFilename = `${filename}.stl`;
    }

    if (!exportedBlob) {
      throw new Error(`Failed to generate compressed export blob for format ${format}`);
    }

    return {
      blob: exportedBlob,
      filename: fullFilename,
      size: exportedBlob.size,
    };
  }

  /**
   * Loads an arbitrary 3D model file (.glb, .gltf, .obj, .stl, .ply, .fbx) into an isolated memory scene for compression.
   */
  public static async loadModelFromFile(
    file: File,
    engine: Engine
  ): Promise<{ scene: Scene; meshes: Mesh[]; filename: string; fileSize: number; dispose: () => void }> {
    const tempScene = new Scene(engine);
    tempScene.autoClear = false;

    FilesInputStore.FilesToLoad[file.name.toLowerCase()] = file;
    const result = await SceneLoader.ImportMeshAsync('', 'file:', file, tempScene);

    const meshes = (result.meshes || []).filter((m) => m instanceof Mesh) as Mesh[];

    return {
      scene: tempScene,
      meshes,
      filename: file.name,
      fileSize: file.size,
      dispose: () => {
        try {
          tempScene.dispose();
          delete FilesInputStore.FilesToLoad[file.name.toLowerCase()];
        } catch (e) {
          console.warn('[ModelCompressor] Error disposing temp scene:', e);
        }
      },
    };
  }
}
