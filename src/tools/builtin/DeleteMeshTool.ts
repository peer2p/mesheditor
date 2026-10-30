import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class DeleteMeshTool extends AbstractTool {
  public readonly name = 'modeler_delete_mesh';
  public readonly description = 'Deletes one or more meshes from the scene by name.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of mesh names to delete.',
      },
    },
    required: ['meshNames'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const names: string[] = Array.isArray(args.meshNames) ? args.meshNames : [];
    const deleted: string[] = [];
    for (const name of names) {
      const m = context.findMeshByNameOrId(name);
      if (m) {
        const idx = context.service.importedMeshes.indexOf(m);
        if (idx !== -1) context.service.importedMeshes.splice(idx, 1);
        context.service.highlightLayer?.removeMesh(m);
        deleted.push(m.name);
        m.dispose();
      }
    }
    return JSON.stringify({
      status: 'ok',
      deleted,
    });
  }
}

