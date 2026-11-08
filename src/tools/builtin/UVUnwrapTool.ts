import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class UVUnwrapTool extends AbstractTool {
  public readonly name = 'modeler_uv_unwrap';
  public readonly description =
    'Performs Smart Seam Marking, LSCM/Angle-Based UV Unwrapping, Texel Density Normalization (px/m), and 2D UV Island Bin-Packing on a mesh.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the target mesh in the scene.',
      },
      action: {
        type: 'string',
        enum: ['unwrap', 'mark_seams', 'normalize_texel_density', 'pack_islands'],
        description:
          'UV action to perform (default "unwrap", which marks smart seams, unwraps, equalizes texel density, and packs islands).',
      },
      method: {
        type: 'string',
        enum: ['smart_seams', 'angle_project', 'cylindrical'],
        description: 'Unwrap projection method (default "smart_seams").',
      },
      angleThresholdDeg: {
        type: 'number',
        description: 'Seam crease angle threshold in degrees (default 60).',
      },
      targetTexelDensity: {
        type: 'number',
        description: 'Target Texel Density in pixels per meter (px/m), e.g. 512 or 1024.',
      },
      textureResolution: {
        type: 'integer',
        enum: [512, 1024, 2048, 4096],
        description: 'Target texture map resolution in pixels (default 1024).',
      },
      marginPx: {
        type: 'integer',
        description: 'Island padding margin in pixels to prevent mipmap bleeding (default 6).',
      },
      rotateOptimal: {
        type: 'boolean',
        description: 'Whether to allow 90-degree island rotation for optimal bin-packing (default true).',
      },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const meshName = String(args.meshName || '').trim();
    const mesh = context.findMeshByNameOrId(meshName);
    if (!mesh || !(mesh instanceof Mesh)) {
      throw new Error(`Mesh "${meshName}" not found in scene.`);
    }

    const action = args.action || 'unwrap';
    const uvCtrl = context.service.uvUnwrapController;
    const angleThresholdDeg = Number(args.angleThresholdDeg) || 60;
    const textureResolution = Number(args.textureResolution) || 1024;
    const marginPx = args.marginPx !== undefined ? Number(args.marginPx) : 6;
    const rotateOptimal = args.rotateOptimal !== false;
    const targetTexelDensity = Number(args.targetTexelDensity) || 0;

    if (action === 'mark_seams') {
      const res = uvCtrl.markSmartSeams(mesh, angleThresholdDeg);
      const stats = uvCtrl.analyzeUVs(mesh, textureResolution);
      return JSON.stringify({
        status: 'ok',
        action: 'mark_seams',
        meshName: mesh.name,
        seamEdgeCount: res.seamEdgeCount,
        ...stats,
      });
    }

    if (action === 'normalize_texel_density') {
      const density = targetTexelDensity || 512;
      const stats = uvCtrl.normalizeTexelDensity(mesh, density, textureResolution, false);
      return JSON.stringify({
        status: 'ok',
        action: 'normalize_texel_density',
        ...stats,
      });
    }

    if (action === 'pack_islands') {
      const stats = uvCtrl.packUVIslands(mesh, {
        marginPx,
        textureResolution,
        rotateOptimal,
        normalizeScale: true,
      });
      return JSON.stringify({
        status: 'ok',
        action: 'pack_islands',
        ...stats,
      });
    }

    const stats = uvCtrl.unwrapMesh(mesh, {
      method: args.method || 'smart_seams',
      angleThresholdDeg,
      marginPx,
      textureResolution,
      targetTexelDensity: targetTexelDensity > 0 ? targetTexelDensity : undefined,
      rotateOptimal,
    });

    return JSON.stringify({
      status: 'ok',
      action: 'unwrap',
      ...stats,
    });
  }
}

