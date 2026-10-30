import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class SeparateMeshTool extends AbstractTool {
  public readonly name = 'modeler_separate_mesh';
  public readonly description =
    'Separates a mesh into disconnected loose parts or splits it by subMeshes so individual components can be edited separately.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: { type: 'string' },
      mode: {
        type: 'string',
        enum: ['loose_parts', 'submeshes'],
        description: 'Separation mode (default "loose_parts").',
      },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const mesh = context.findMeshByNameOrId(args.meshName);
    if (!mesh) {
      throw new Error(`Mesh "${args.meshName}" not found.`);
    }
    context.service.selectMesh(mesh);
    const parts =
      args.mode === 'submeshes'
        ? context.service.separateSelectedSubMeshes()
        : context.service.separateSelectedLooseParts();
    return JSON.stringify({
      status: 'ok',
      parts: parts.map((p) => p.name),
    });
  }
}

