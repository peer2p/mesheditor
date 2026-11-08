import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class BooleanOperationTool extends AbstractTool {
  public readonly name = 'modeler_boolean_operation';
  public readonly description =
    'Performs a CSG (Constructive Solid Geometry) boolean operation (union, subtract, intersect) between baseMeshName and toolMeshName, with optional non-destructive mode and edge Bevel Modifier (chamfer/fillet).';

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
      nonDestructive: {
        type: 'boolean',
        description:
          'If true (default true), preserves the underlying base mesh snapshot so bevels and boolean cuts can be adjusted or reverted non-destructively.',
      },
      bevelWidth: {
        type: 'number',
        description:
          'Optional bevel radius/width in meters (e.g. 0.03) to round sharp boolean intersection edges non-destructively.',
      },
      bevelSegments: {
        type: 'integer',
        minimum: 1,
        maximum: 4,
        description: 'Number of bevel segments (1 = chamfer, 2..4 = smooth rounded fillet). Default 2.',
      },
      angleThresholdDeg: {
        type: 'number',
        description: 'Minimum crease angle in degrees to bevel (default 30).',
      },
    },
    required: ['operation', 'baseMeshName', 'toolMeshName'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const baseId = args.baseMeshName || args.baseMeshId;
    const toolId = args.toolMeshName || args.toolMeshId;
    const op = (args.operation || 'subtract') as 'union' | 'subtract' | 'intersect';
    const keepTool = !!args.keepToolMesh;
    const nonDestructive = args.nonDestructive !== false;
    const bevelWidth = Number(args.bevelWidth) || 0;
    const bevelSegments = Number(args.bevelSegments) || 2;
    const angleThresholdDeg = Number(args.angleThresholdDeg) || 30;

    const baseMesh = context.findMeshByNameOrId(baseId);
    const toolMesh = context.findMeshByNameOrId(toolId);

    if (!baseMesh) {
      throw new Error(`Base mesh "${baseId}" not found in scene.`);
    }
    if (!toolMesh) {
      throw new Error(`Tool mesh "${toolId}" not found in scene.`);
    }

    const resultMesh = await context.service.performCSGOperation(
      baseMesh,
      toolMesh,
      op,
      keepTool,
      {
        nonDestructive,
        bevelWidth,
        bevelSegments,
        angleThresholdDeg,
      }
    );
    if (!resultMesh) {
      throw new Error(`CSG ${op} failed between "${baseMesh.name}" and "${toolMesh.name}".`);
    }

    if (args.newName && typeof args.newName === 'string') {
      resultMesh.name = args.newName.replace(/\s+/g, '_');
    }

    const ndMeta = resultMesh.metadata?.nonDestructiveCSG;

    return JSON.stringify({
      status: 'ok',
      operation: op,
      resultMeshName: resultMesh.name,
      vertices: resultMesh.getTotalVertices(),
      nonDestructive: !!ndMeta?.isNonDestructive,
      bevelApplied: bevelWidth > 0,
      sharpEdgeCount: ndMeta?.bevel?.sharpEdgeCount || 0,
    });
  }
}
