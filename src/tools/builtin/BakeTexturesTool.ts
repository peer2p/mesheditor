import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class BakeTexturesTool extends AbstractTool {
  public readonly name = 'modeler_bake_textures';
  public readonly description =
    'Bakes High-Poly surface detail onto a Low-Poly game mesh as a Tangent-Space Normal Map and Ambient Occlusion (AO) Map using an automatic extruded Projection Cage.';

  public readonly parameters = {
    type: 'object',
    properties: {
      lowPolyMeshName: {
        type: 'string',
        description: 'Name or ID of the Low-Poly target mesh in the scene.',
      },
      highPolyMeshName: {
        type: 'string',
        description:
          'Optional name or ID of the High-Poly source mesh. If omitted, bakes self-detail and cavity/bevel normals.',
      },
      resolution: {
        type: 'integer',
        enum: [128, 256, 512, 1024, 2048],
        description: 'Baked map resolution in pixels (default 512).',
      },
      cageExtrusion: {
        type: 'number',
        description:
          'Projection cage extrusion distance along smooth vertex normals in meters (default auto-calculated or 0.04).',
      },
      paddingPx: {
        type: 'integer',
        description: 'UV island border dilation padding in pixels (default 4).',
      },
      flipNormalY: {
        type: 'boolean',
        description: 'If true, flips Green (-Y) channel for DirectX convention (default false = OpenGL).',
      },
      applyToMaterial: {
        type: 'boolean',
        description: 'If true (default), assigns the baked Normal and AO maps directly to the Low-Poly material.',
      },
    },
    required: ['lowPolyMeshName'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const lowName = String(args.lowPolyMeshName || '').trim();
    const lowMesh = context.findMeshByNameOrId(lowName);
    if (!lowMesh || !(lowMesh instanceof Mesh)) {
      throw new Error(`Low-poly mesh "${lowName}" not found in scene.`);
    }

    let highMesh: Mesh | null = null;
    if (args.highPolyMeshName) {
      const found = context.findMeshByNameOrId(String(args.highPolyMeshName).trim());
      if (found instanceof Mesh) highMesh = found;
    }

    const baker = context.service.textureBaker;
    const cageExtrusion =
      args.cageExtrusion !== undefined
        ? Number(args.cageExtrusion)
        : baker.computeAutoCageDistance(lowMesh, highMesh);

    const resolution = (Number(args.resolution) || 512) as 128 | 256 | 512 | 1024 | 2048;
    const paddingPx = args.paddingPx !== undefined ? Number(args.paddingPx) : 4;
    const flipNormalY = !!args.flipNormalY;
    const applyToMaterial = args.applyToMaterial !== false;

    const result = await baker.bakeTextures({
      lowPolyMesh: lowMesh,
      highPolyMesh: highMesh,
      resolution,
      cageExtrusion,
      paddingPx,
      flipNormalY,
      applyToMaterial,
    });

    return JSON.stringify({
      status: 'ok',
      lowPolyMeshName: result.lowPolyMeshName,
      highPolyMeshName: result.highPolyMeshName,
      resolution: result.resolution,
      cageExtrusion: result.cageExtrusion,
      rayHitCount: result.rayHitCount,
      coveragePercent: result.coveragePercent,
      appliedToMaterial: result.appliedToMaterial,
    });
  }
}

