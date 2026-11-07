import { Color3, Mesh } from '@babylonjs/core';
import {
  compileSdfParts,
  extractSdfSurfaceNets,
  SdfPartDefinition,
} from '../../sdf';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateSdfMeshTool extends AbstractTool {
  public readonly name = 'modeler_create_sdf_mesh';
  public readonly description =
    'Creates a seamless, watertight organic 3D clay/metaball mesh using Signed Distance Fields (SDF) and smooth polynomial blending (smooth union, smooth subtract, smooth intersect). Ideal for characters, heads, torsos, limbs, muscles, creatures, soft cushions, boulders, and clay sculpting workflows without harsh seams between parts.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Descriptive name for the generated organic SDF mesh.',
      },
      parts: {
        type: 'array',
        description:
          'Ordered list of SDF primitives to blend together. Coordinates use meters (Y is up, X is right, Z is forward; base typically rests on Y = 0).',
        items: {
          type: 'object',
          properties: {
            shape: {
              type: 'string',
              enum: [
                'sphere',
                'ellipsoid',
                'box',
                'capsule',
                'round_cone',
                'cylinder',
                'torus',
                'cone',
                'plane',
              ],
              description:
                'Primitive SDF shape. Use "round_cone" or "capsule" with start/end/radius/endRadius for tapered limbs, necks, fingers, tails, and horns; "ellipsoid" or "sphere" for craniums, ribcages, cheeks, and bellies; "box" with "rounding" for soft bevelled volumes.',
            },
            op: {
              type: 'string',
              enum: ['union', 'subtract', 'intersect'],
              description:
                'Boolean operation: "union" (smoothly adds clay mass), "subtract" (smoothly carves eye sockets, mouths, cavities), or "intersect". Default: "union".',
            },
            blend: {
              type: 'number',
              description:
                'Smooth blending radius in meters (e.g. 0.04 to 0.15 for seamless muscle/skin transitions, 0.015 for crisp creases, 0 for sharp boolean). Default: 0.05.',
            },
            center: {
              type: 'object',
              description: 'Center position { x, y, z } in meters.',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            size: {
              type: 'object',
              description: 'Full extents { x, y, z } in meters for "box" or "ellipsoid".',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            radius: {
              type: 'number',
              description: 'Primary radius in meters (or start radius for capsule/round_cone, major radius for torus, bottom radius for cone).',
            },
            endRadius: {
              type: 'number',
              description: 'End/top radius in meters for tapered "capsule", "round_cone", or "cone".',
            },
            thickness: {
              type: 'number',
              description: 'Minor tube radius in meters for "torus".',
            },
            height: {
              type: 'number',
              description: 'Total height in meters for "cylinder", "cone", or vertical "capsule".',
            },
            rounding: {
              type: 'number',
              description: 'Edge rounding radius in meters for "box" or "cylinder".',
            },
            start: {
              type: 'object',
              description: 'Start point { x, y, z } for segment-based "capsule" or "round_cone".',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            end: {
              type: 'object',
              description: 'End point { x, y, z } for segment-based "capsule" or "round_cone".',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            rotationDegrees: {
              type: 'object',
              description: 'Local Euler rotation { x, y, z } in degrees.',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            color: {
              type: 'string',
              description:
                'Optional hex color for this part (e.g. "#e0ac69"). When parts specify colors, vertex colors are smoothly blended across part transitions.',
            },
            mirrorX: {
              type: 'boolean',
              description: 'Override symmetryX for this specific part.',
            },
          },
          required: ['shape'],
        },
      },
      symmetryX: {
        type: 'boolean',
        description:
          'When true, automatically mirrors any off-center part (x != 0) across the X = 0 symmetry plane (ideal for bilateral characters, creatures, eyes, arms, legs). Default: false.',
      },
      resolution: {
        type: 'integer',
        minimum: 16,
        maximum: 128,
        description:
          'Voxel grid resolution along the longest axis (e.g. 40 for low/mid-poly props, 64 for detailed organic characters, 84 for high detail). Automatically scaled to the polygon budget if omitted.',
      },
      targetTriangles: {
        type: 'integer',
        minimum: 200,
        maximum: 100000,
        description:
          'Optional target triangle count. If the extracted SDF surface exceeds this target, Quadric Error Metric retopology is applied automatically.',
      },
      smoothIterations: {
        type: 'integer',
        minimum: 0,
        maximum: 5,
        description: 'Surface relaxation iterations with SDF re-projection (default: 2).',
      },
      color: {
        type: 'string',
        description: 'Base PBR hex color (default: "#d9b38c").',
      },
      roughness: {
        type: 'number',
        description: 'PBR roughness (0.0 to 1.0, default: 0.6).',
      },
      metallic: {
        type: 'number',
        description: 'PBR metallic (0.0 to 1.0, default: 0.05).',
      },
      materialName: {
        type: 'string',
        description: 'Optional existing material name.',
      },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      scaling: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
    },
    required: ['parts'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const rawParts: SdfPartDefinition[] = Array.isArray(args.parts) ? args.parts : [];
    if (rawParts.length === 0) {
      throw new Error('modeler_create_sdf_mesh requires a non-empty "parts" array.');
    }

    const baseName = String(args.name || 'sdf_clay_mesh').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const symmetryX = !!args.symmetryX;
    const compiledParts = compileSdfParts(rawParts, symmetryX);

    // Budget-aware default resolution
    const maxBudget = context.aiAgent?.config?.maxPolygons || 5000;
    let defaultRes = 48;
    if (maxBudget <= 1500) defaultRes = 28;
    else if (maxBudget <= 3500) defaultRes = 38;
    else if (maxBudget <= 8000) defaultRes = 52;
    else if (maxBudget <= 25000) defaultRes = 68;
    else defaultRes = 80;

    const resolution = args.resolution !== undefined ? Number(args.resolution) : defaultRes;
    const smoothIterations = args.smoothIterations !== undefined ? Number(args.smoothIterations) : 2;
    const defaultHex = context.normalizeHex(args.color || '#d9b38c');

    const extracted = extractSdfSurfaceNets(compiledParts, {
      resolution,
      smoothIterations,
      defaultColor: defaultHex,
      computeVertexColors: true,
    });

    const mesh = new Mesh(uniqueName, context.scene);
    extracted.vertexData.applyToMesh(mesh, true);

    const mat = context.getOrCreateMaterial(
      args.materialName,
      extracted.hasVertexColors ? '#ffffff' : defaultHex,
      args.roughness ?? 0.6,
      args.metallic ?? 0.05,
      uniqueName
    );
    if (extracted.hasVertexColors) {
      mesh.useVertexColors = true;
      mat.albedoColor = Color3.White();
    }
    mesh.material = mat;

    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    // Optional QEM decimation if targetTriangles is specified and exceeded
    let decimated = false;
    const currentTris = Math.floor(mesh.getTotalIndices() / 3);
    const targetTriangles =
      args.targetTriangles !== undefined ? Math.max(200, Number(args.targetTriangles)) : undefined;

    if (
      targetTriangles !== undefined &&
      currentTris > targetTriangles * 1.15 &&
      context.service.sculptController
    ) {
      await context.service.sculptController.retopologizeMesh(mesh, targetTriangles);
      decimated = true;
    }

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    const bb = mesh.getBoundingInfo().boundingBox;

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      partCount: compiledParts.length,
      resolution: extracted.resolution.nx,
      vertices: mesh.getTotalVertices(),
      triangles: Math.floor(mesh.getTotalIndices() / 3),
      hasVertexColors: extracted.hasVertexColors,
      decimated,
      bounds: {
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
      },
    });
  }
}

