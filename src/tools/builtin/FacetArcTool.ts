import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class FacetArcTool extends AbstractTool {
  public readonly name = 'modeler_facet_arc';
  public readonly description =
    'Extrudes a polygonal face along a curved, segmented circular arch. Ideal for bridges, arched doorways, tunnels, curved handles, horns, and curved pipes.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh to edit.',
      },
      direction: {
        type: 'string',
        enum: ['top', 'bottom', 'front', 'back', 'left', 'right'],
        description: 'Direction of the face to arc extrude (default: "top").',
      },
      faceId: {
        type: 'number',
        description: 'Optional explicit face index instead of direction.',
      },
      segments: {
        type: 'integer',
        minimum: 2,
        maximum: 16,
        description: 'Number of curve segments in the arch (default: 4).',
      },
      height: {
        type: 'number',
        description: 'Arc height / radius (default: 0.5).',
      },
    },
    required: ['meshName'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const meshName = String(args.meshName || '').trim();
    const mesh = context.findMeshByNameOrId(meshName);
    if (!mesh) {
      throw new Error(`Mesh "${meshName}" not found in scene.`);
    }

    const direction = args.direction || (args.faceId === undefined ? 'top' : undefined);
    const segments = Math.max(2, Math.min(Number(args.segments) || 4, 16));
    const height = typeof args.height === 'number' ? args.height : 0.5;

    const success = context.service.arcFacet(mesh, { direction, faceId: args.faceId }, segments, height);
    if (!success) {
      throw new Error(`Failed to arc facet on "${mesh.name}".`);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      faceDirection: direction,
      segments,
      height,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

