import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class ApplyMaterialTool extends AbstractTool {
  public readonly name = 'modeler_apply_material';
  public readonly description =
    'Applies a created material (or inline color/PBR settings) to one or more meshes by name.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Target mesh name (or comma-separated names, or "*" for all meshes).',
      },
      materialName: {
        type: 'string',
        description: 'Name of the material created with modeler_create_material.',
      },
      albedoColor: { type: 'string', description: 'Optional direct hex color if creating inline material.' },
      roughness: { type: 'number' },
      metallic: { type: 'number' },
      alpha: { type: 'number' },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const meshTarget = String(args.meshName || args.meshId || '');
    const matName = args.materialName || args.materialId;

    const targetMeshes =
      meshTarget === '*'
        ? context.service.importedMeshes.filter((m) => !context.service.isEditorHelper(m) && !m.isDisposed())
        : meshTarget
            .split(',')
            .map((n) => context.findMeshByNameOrId(n.trim()))
            .filter((m): m is Mesh => !!m);

    if (targetMeshes.length === 0) {
      throw new Error(`No mesh matching "${meshTarget}" found.`);
    }

    const mat = context.getOrCreateMaterial(
      matName,
      args.albedoColor,
      args.roughness,
      args.metallic,
      targetMeshes[0].name
    );
    if (args.alpha !== undefined) {
      mat.alpha = Number(args.alpha);
    }

    for (const m of targetMeshes) {
      m.material = mat;
    }

    return JSON.stringify({
      status: 'ok',
      appliedTo: targetMeshes.map((m) => m.name),
      materialName: mat.name,
    });
  }
}

