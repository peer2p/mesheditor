import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class FacetCutThroughTool extends AbstractTool {
  public readonly name = 'modeler_facet_cut_through';
  public readonly description =
    'Punches an open through-hole or deep recessed portal through a mesh along face normal. Ideal for doorways, tunnels, window portals, and hollow openings.';

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
        description: 'Direction of the face to cut through (default: "front").',
      },
      faceId: {
        type: 'number',
        description: 'Optional explicit face index instead of direction.',
      },
      depth: {
        type: 'number',
        description: 'Depth to tunnel inward through the mesh (default: 1.0).',
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

    const direction = args.direction || (args.faceId === undefined ? 'front' : undefined);
    const depth = typeof args.depth === 'number' ? args.depth : 1.0;

    const success = context.service.cutThroughFacet(mesh, { direction, faceId: args.faceId }, depth);
    if (!success) {
      throw new Error(`Failed to cut through facet on "${mesh.name}".`);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      faceDirection: direction,
      depth,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

