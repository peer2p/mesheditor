import {
  FilesInputStore,
  Mesh,
  Scene,
  SceneLoader,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';
import {
  createDefaultNeural3DProviders,
  Neural3DGenerationResult,
  Neural3DGeneratorService,
} from '../../Neural3DGeneratorService';
import { Neural3DBackendId } from '../../types';

export class GenerateNeuralMeshTool extends AbstractTool {
  public readonly name = 'modeler_generate_neural_mesh';
  public readonly description =
    'Delegates full or partial 3D asset generation of complex organic shapes, statues, characters, creatures, or detailed props to a configured Neural 3D Generator (TRELLIS 2, Hunyuan3D, or Hi3D), imports the resulting mesh into the Babylon.js scene, normalizes its scale and bottom-alignment (Y = 0), and optionally retopologizes it to the polygon budget.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Descriptive name for the imported 3D mesh (e.g. "dragon_statue", "ornate_gargoyle_head").',
      },
      backend: {
        type: 'string',
        enum: ['auto', 'trellis', 'hunyuan3d', 'hi3d'],
        description:
          'Which Neural 3D Generator backend to use: "trellis" (TRELLIS 2: best image-to-3D & clean mesh structure), "hunyuan3d" (Hunyuan3D: fast textured 3D objects), "hi3d" (Hi3D V1-V3: high-resolution 2K watertight meshes for 3D printing), or "auto" (automatically selects the best enabled generator).',
      },
      prompt: {
        type: 'string',
        description:
          'Detailed English visual description of the isolated 3D object or sub-part to generate (e.g. "A detailed weathered stone gargoyle statue sitting with folded wings, neutral front-facing pose").',
      },
      imageIndex: {
        type: 'integer',
        minimum: 0,
        description:
          'Optional 0-based index of a user-attached reference image to condition Image-to-3D generation.',
      },
      useAttachedImage: {
        type: 'boolean',
        description:
          'Whether to automatically use the first attached reference image (if present) for Image-to-3D conditioning (default: true).',
      },
      useViewportSnapshot: {
        type: 'boolean',
        description:
          'Optional: Set true to capture a snapshot of the current 3D viewport and pass it as the input reference image to Image-to-3D generators (such as TRELLIS Gradio image_to_3d) when no image was attached.',
      },
      targetHeight: {
        type: 'number',
        description:
          'Target height (Y dimension in meters) of the imported mesh in the scene (default: 1.5). The mesh is uniformly scaled to match this height.',
      },
      targetSize: {
        type: 'object',
        description:
          'Optional explicit bounding-box dimensions { x, y, z } in meters (overrides targetHeight if provided).',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
      },
      position: {
        type: 'object',
        description:
          'World position { x, y, z } in meters. The mesh is automatically bottom-aligned (min.y = 0) before positioning, so position.y places the base directly on that height (e.g. on a pedestal).',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
      },
      rotationDegrees: {
        type: 'object',
        description: 'Rotation { x, y, z } in degrees.',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
      },
      generateTextures: {
        type: 'boolean',
        description:
          'Whether to request baked PBR textures from the generator (default: true for TRELLIS/Hunyuan3D, false for Hi3D 3D-print mode).',
      },
      highResPrint: {
        type: 'boolean',
        description:
          'Set true when generating high-resolution 2K watertight geometry intended for 3D printing (routes to Hi3D if enabled and preserves full triangle density).',
      },
      targetTriangles: {
        type: 'integer',
        minimum: 0,
        description:
          'Optional triangle budget to decimate/retopologize the imported mesh to via Quadric Error Metrics. Set 0 or omit when highResPrint is true.',
      },
      color: {
        type: 'string',
        description:
          'Fallback PBR hex color (e.g. "#c2b280") applied if the imported mesh is untextured.',
      },
      roughness: {
        type: 'number',
        description: 'Fallback PBR roughness (0.0 to 1.0, default: 0.55).',
      },
      metallic: {
        type: 'number',
        description: 'Fallback PBR metallic (0.0 to 1.0, default: 0.05).',
      },
      materialName: {
        type: 'string',
        description: 'Optional material name if assigning a custom PBR material.',
      },
    },
    required: ['name', 'prompt'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const meshName = String(args.name || 'neural_mesh').trim() || 'neural_mesh';
    const prompt = String(args.prompt || '').trim();
    if (!prompt) {
      throw new Error('Parameter "prompt" is required for modeler_generate_neural_mesh.');
    }

    const backendArg = String(args.backend || 'auto').toLowerCase();
    const backend: Neural3DBackendId | 'auto' = ['trellis', 'hunyuan3d', 'hi3d'].includes(backendArg)
      ? (backendArg as Neural3DBackendId)
      : 'auto';

    const providers =
      context.aiAgent?.config?.neural3DProviders || createDefaultNeural3DProviders();

    // Resolve optional reference image from context.attachedImages or explicit args.imageUrl
    let imageUrl: string | undefined =
      typeof args.imageUrl === 'string' && args.imageUrl.trim() ? args.imageUrl.trim() : undefined;

    if (!imageUrl && args.useAttachedImage !== false && Array.isArray(context.attachedImages) && context.attachedImages.length > 0) {
      const idx =
        typeof args.imageIndex === 'number' && args.imageIndex >= 0 && args.imageIndex < context.attachedImages.length
          ? Math.floor(args.imageIndex)
          : 0;
      imageUrl = context.attachedImages[idx];
    }

    if (!imageUrl && args.useViewportSnapshot && typeof context.aiAgent?.captureViewportDataUrl === 'function') {
      const snap = context.aiAgent.captureViewportDataUrl();
      if (snap) {
        imageUrl = snap;
      }
    }

    const highResPrint = Boolean(args.highResPrint) || backend === 'hi3d';
    const generateTextures =
      typeof args.generateTextures === 'boolean'
        ? args.generateTextures
        : !highResPrint && context.aiAgent?.config?.createTextures !== false;

    const genResult = await Neural3DGeneratorService.generateMesh(
      providers,
      {
        backend,
        prompt,
        imageUrl,
        generateTextures,
        highResPrint,
        seed: typeof args.seed === 'number' ? args.seed : undefined,
        signal: context.signal,
        onStatus: context.onStatus,
      },
      context.aiAgent?.customFetch
    );

    const mesh = await this.buildMeshFromGenerationResult(meshName, genResult, context.scene);

    // Normalize scale & bottom-align to Y = 0
    this.normalizeAndGroundMeshGeometry(mesh, args);

    // Apply fallback or requested PBR material if mesh has no material or explicit color/materialName was given
    if (!mesh.material || args.color || args.materialName) {
      mesh.material = this.getOrCreateMaterial(
        context,
        args.materialName,
        args.color || '#b8b2a6',
        args.roughness !== undefined ? Number(args.roughness) : 0.55,
        args.metallic !== undefined ? Number(args.metallic) : 0.05,
        meshName
      );
    }

    // Apply world position and rotation
    this.applyTransform(mesh, args, context);
    this.registerMesh(mesh, context);

    const originalTriangles = Math.floor(mesh.getTotalIndices() / 3);
    let finalTriangles = originalTriangles;
    let retopologized = false;

    // Optional QEM retopology if targetTriangles is specified and mesh exceeds it
    const targetTriangles =
      typeof args.targetTriangles === 'number' && args.targetTriangles > 0
        ? Math.floor(args.targetTriangles)
        : 0;

    if (targetTriangles >= 100 && originalTriangles > targetTriangles && !highResPrint) {
      try {
        context.onStatus?.(
          `Retopologizing ${mesh.name} (${originalTriangles.toLocaleString()} -> ${targetTriangles.toLocaleString()} tris)...`
        );
        const analysis = await context.service.sculptController.retopologizeMesh(
          mesh,
          targetTriangles
        );
        finalTriangles = analysis.triangleCount;
        retopologized = true;
      } catch (err) {
        console.warn('[GenerateNeuralMeshTool] Retopology skipped:', err);
      }
    }

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    const bb = mesh.getBoundingInfo()?.boundingBox;

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      provider: genResult.providerId,
      providerName: genResult.providerName,
      modelId: genResult.modelId,
      format: genResult.format,
      vertices: mesh.getTotalVertices(),
      originalTriangles,
      triangles: finalTriangles,
      retopologized,
      bounds: bb
        ? {
            min: {
              x: Number(bb.minimumWorld.x.toFixed(3)),
              y: Number(bb.minimumWorld.y.toFixed(3)),
              z: Number(bb.minimumWorld.z.toFixed(3)),
            },
            max: {
              x: Number(bb.maximumWorld.x.toFixed(3)),
              y: Number(bb.maximumWorld.y.toFixed(3)),
              z: Number(bb.maximumWorld.z.toFixed(3)),
            },
            size: {
              x: Number((bb.maximumWorld.x - bb.minimumWorld.x).toFixed(3)),
              y: Number((bb.maximumWorld.y - bb.minimumWorld.y).toFixed(3)),
              z: Number((bb.maximumWorld.z - bb.minimumWorld.z).toFixed(3)),
            },
          }
        : undefined,
    });
  }

  /**
   * Builds a Babylon.js Mesh from a Neural3DGenerationResult (supporting json_mesh, obj, glb, and stl).
   */
  private async buildMeshFromGenerationResult(
    meshName: string,
    result: Neural3DGenerationResult,
    scene: Scene
  ): Promise<Mesh> {
    // 1. Direct JSON mesh payload
    if (result.format === 'json_mesh' && result.jsonMesh) {
      const mesh = new Mesh(meshName, scene);
      const vd = new VertexData();
      const positions = result.jsonMesh.positions;
      const indices = result.jsonMesh.indices;
      const normals =
        result.jsonMesh.normals && result.jsonMesh.normals.length === positions.length
          ? result.jsonMesh.normals
          : [];
      if (normals.length === 0) {
        VertexData.ComputeNormals(positions, indices, normals);
      }
      vd.positions = positions;
      vd.indices = indices;
      vd.normals = normals;
      if (result.jsonMesh.uvs && result.jsonMesh.uvs.length > 0) {
        vd.uvs = result.jsonMesh.uvs;
      }
      if (result.jsonMesh.colors && result.jsonMesh.colors.length > 0) {
        vd.colors = result.jsonMesh.colors;
      }
      vd.applyToMesh(mesh, true);
      return mesh;
    }

    // 2. Wavefront OBJ text
    if (result.format === 'obj') {
      const objText = result.textData || new TextDecoder().decode(result.data);
      const parsed = this.parseWavefrontObjToMesh(meshName, objText, scene);
      if (parsed && parsed.getTotalVertices() > 0) {
        return parsed;
      }
    }

    // 3. Binary GLB / STL (or fallback OBJ via SceneLoader)
    const ext = result.format === 'stl' ? 'stl' : result.format === 'obj' ? 'obj' : 'glb';
    const mimeType =
      ext === 'glb'
        ? 'model/gltf-binary'
        : ext === 'stl'
          ? 'model/stl'
          : 'text/plain';
    const tempFilename = `${meshName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;

    const file = new File([result.data as any], tempFilename, { type: mimeType });
    FilesInputStore.FilesToLoad[tempFilename.toLowerCase()] = file;

    try {
      const importRes = await SceneLoader.ImportMeshAsync('', 'file:', file, scene);
      const validMeshes: Mesh[] = [];
      const containerNodes: any[] = [];

      for (const m of importRes.meshes) {
        if (m instanceof Mesh && m.name !== '__root__' && m.getTotalVertices() > 0) {
          m.computeWorldMatrix(true);
          m.setParent(null);
          m.bakeCurrentTransformIntoVertices();
          validMeshes.push(m);
        } else {
          containerNodes.push(m);
        }
      }

      for (const c of containerNodes) {
        if (c && typeof c.dispose === 'function' && !c.isDisposed()) {
          c.dispose(true, false);
        }
      }

      if (validMeshes.length === 0) {
        throw new Error(`Imported ${ext.toUpperCase()} contained no valid 3D vertices.`);
      }

      let finalMesh: Mesh;
      if (validMeshes.length === 1) {
        finalMesh = validMeshes[0];
        finalMesh.name = meshName;
      } else {
        const merged = Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true);
        if (!merged) {
          finalMesh = validMeshes[0];
        } else {
          finalMesh = merged;
        }
        finalMesh.name = meshName;
      }

      if (!finalMesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
        finalMesh.createNormals(true);
      }

      return finalMesh;
    } finally {
      delete FilesInputStore.FilesToLoad[tempFilename.toLowerCase()];
    }
  }

  /**
   * Lightweight synchronous Wavefront OBJ parser for direct mesh creation.
   */
  public parseWavefrontObjToMesh(meshName: string, objText: string, scene: Scene): Mesh | null {
    const rawVerts: Array<[number, number, number]> = [];
    const rawUVs: Array<[number, number]> = [];
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const lines = objText.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          rawVerts.push([
            parseFloat(parts[1]) || 0,
            parseFloat(parts[2]) || 0,
            parseFloat(parts[3]) || 0,
          ]);
        }
      } else if (line.startsWith('vt ')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          rawUVs.push([parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0]);
        }
      } else if (line.startsWith('f ')) {
        const parts = line.split(/\s+/).slice(1);
        if (parts.length < 3) continue;

        const faceVertIndices: number[] = [];
        for (const token of parts) {
          const sub = token.split('/');
          let vIdx = parseInt(sub[0], 10);
          if (isNaN(vIdx)) continue;
          if (vIdx < 0) vIdx = rawVerts.length + vIdx;
          else vIdx = vIdx - 1;

          const v = rawVerts[vIdx] || [0, 0, 0];
          const newIndex = positions.length / 3;
          positions.push(v[0], v[1], v[2]);

          if (sub[1]) {
            let vtIdx = parseInt(sub[1], 10);
            if (!isNaN(vtIdx)) {
              if (vtIdx < 0) vtIdx = rawUVs.length + vtIdx;
              else vtIdx = vtIdx - 1;
              const uv = rawUVs[vtIdx] || [0, 0];
              uvs.push(uv[0], uv[1]);
            }
          }
          faceVertIndices.push(newIndex);
        }

        // Fan triangulation for triangles, quads, and n-gons
        for (let i = 1; i + 1 < faceVertIndices.length; i++) {
          indices.push(faceVertIndices[0], faceVertIndices[i], faceVertIndices[i + 1]);
        }
      }
    }

    if (positions.length === 0 || indices.length === 0) {
      return null;
    }

    const mesh = new Mesh(meshName, scene);
    const vd = new VertexData();
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    if (uvs.length === (positions.length / 3) * 2) {
      vd.uvs = uvs;
    }
    vd.applyToMesh(mesh, true);
    return mesh;
  }

  /**
   * Scales the mesh to match targetSize or targetHeight (default 1.5m)
   * and shifts vertices so the horizontal center is at X=0, Z=0 and the base rests at Y=0.
   */
  private normalizeAndGroundMeshGeometry(mesh: Mesh, args: any): void {
    const rawPositions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!rawPositions || rawPositions.length < 3) return;

    const positions = Array.from(rawPositions);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const sizeX = Math.max(1e-5, maxX - minX);
    const sizeY = Math.max(1e-5, maxY - minY);
    const sizeZ = Math.max(1e-5, maxZ - minZ);
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;

    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;

    if (args.targetSize && typeof args.targetSize === 'object') {
      const tx = Number(args.targetSize.x);
      const ty = Number(args.targetSize.y);
      const tz = Number(args.targetSize.z);
      if (tx > 0 && ty > 0 && tz > 0) {
        scaleX = tx / sizeX;
        scaleY = ty / sizeY;
        scaleZ = tz / sizeZ;
      } else if (ty > 0) {
        const uniform = ty / sizeY;
        scaleX = uniform;
        scaleY = uniform;
        scaleZ = uniform;
      }
    } else {
      const targetHeight =
        typeof args.targetHeight === 'number' && args.targetHeight > 0
          ? args.targetHeight
          : 1.5;
      const uniform = targetHeight / sizeY;
      scaleX = uniform;
      scaleY = uniform;
      scaleZ = uniform;
    }

    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (positions[i] - centerX) * scaleX;
      positions[i + 1] = (positions[i + 1] - minY) * scaleY;
      positions[i + 2] = (positions[i + 2] - centerZ) * scaleZ;
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    const indices = mesh.getIndices();
    if (indices && indices.length > 0) {
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    }
    mesh.refreshBoundingInfo();
  }
}

