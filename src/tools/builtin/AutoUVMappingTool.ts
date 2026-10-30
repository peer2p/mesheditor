import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class AutoUVMappingTool extends AbstractTool {
  public readonly name = 'modeler_auto_uv_mapping';
  public readonly description =
    'Applies automatic box/triplanar UV mapping (or planar projection) to a mesh so textures tile cleanly after CSG or extrusions without breaking subMeshes.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: { type: 'string', description: 'Name of the mesh (or "*" for all meshes).' },
      projection: {
        type: 'string',
        enum: ['triplanar', 'top', 'front', 'side'],
        description: 'Projection mode (default "triplanar").',
      },
      scale: { type: 'number', description: 'UV tiling scale factor (default 1.0).' },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const meshTarget = String(args.meshName || args.meshId || '*');
    const projection = args.projection || 'triplanar';
    const scale = args.scale !== undefined ? Number(args.scale) : 1.0;

    const targets =
      meshTarget === '*'
        ? context.service.importedMeshes.filter((m) => !context.service.isEditorHelper(m) && !m.isDisposed())
        : [context.findMeshByNameOrId(meshTarget)].filter((m): m is Mesh => !!m);

    if (targets.length === 0) {
      throw new Error(`Mesh "${meshTarget}" not found for UV mapping.`);
    }

    const prevSelected = context.service.selectedMesh;
    for (const m of targets) {
      context.service.selectedMesh = m;
      if (projection === 'top' || projection === 'front' || projection === 'side') {
        context.service.applyPlanarUVs(projection, scale);
      } else {
        context.service.applyTriplanarUVs(scale);
      }
    }
    context.service.selectedMesh = prevSelected;

    return JSON.stringify({
      status: 'ok',
      mappedMeshes: targets.map((m) => m.name),
      projection,
    });
  }
}

