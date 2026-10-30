import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class BooleanOperationTool extends AbstractTool {
  public readonly name = 'modeler_boolean_operation';
  public readonly description =
    'Performs a CSG (Constructive Solid Geometry) boolean operation (union, subtract, intersect) between baseMeshName and toolMeshName.';

  public readonly parameters = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['union', 'subtract', 'intersect'] },
      baseMeshName: {
        type: 'string',
        description: 'Name (or ID) of the base/target mesh in the scene.',
      },
      toolMeshName: {
        type: 'string',
        description: 'Name (or ID) of the tool/cutter mesh in the scene.',
      },
      newName: {
        type: 'string',
        description: 'Optional name for the resulting mesh.',
      },
      keepToolMesh: {
        type: 'boolean',
        description: 'If true, keeps the tool mesh in the scene instead of disposing it (default false).',
      },
    },
    required: ['operation', 'baseMeshName', 'toolMeshName'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const baseId = args.baseMeshName || args.baseMeshId;
    const toolId = args.toolMeshName || args.toolMeshId;
    const op = (args.operation || 'subtract') as 'union' | 'subtract' | 'intersect';
    const keepTool = !!args.keepToolMesh;

    const baseMesh = context.findMeshByNameOrId(baseId);
    const toolMesh = context.findMeshByNameOrId(toolId);

    if (!baseMesh) {
      throw new Error(`Base mesh "${baseId}" not found in scene.`);
    }
    if (!toolMesh) {
      throw new Error(`Tool mesh "${toolId}" not found in scene.`);
    }

    const resultMesh = await context.service.performCSGOperation(baseMesh, toolMesh, op, keepTool);
    if (!resultMesh) {
      throw new Error(`CSG ${op} failed between "${baseMesh.name}" and "${toolMesh.name}".`);
    }

    if (args.newName && typeof args.newName === 'string') {
      resultMesh.name = args.newName.replace(/\s+/g, '_');
    }

    return JSON.stringify({
      status: 'ok',
      operation: op,
      resultMeshName: resultMesh.name,
      vertices: resultMesh.getTotalVertices(),
    });
  }
}

