import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class FacetInsetTool extends AbstractTool {
  public readonly name = 'modeler_facet_inset';
  public readonly description =
    'Shrinks a face or quad inward towards its centroid, surrounded by connecting quads, with optional depth/bevel recessing. Ideal for window frames, door portals, beveled panels, and edge loops.';

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
        description: 'Direction of the face to inset (default: "top").',
      },
      faceId: {
        type: 'number',
        description: 'Optional explicit face index instead of direction.',
      },
      insetAmount: {
        type: 'number',
        description: 'Amount to shrink perimeter edges inward (default: 0.25).',
      },
      depth: {
        type: 'number',
        description: 'Depth offset along normal: positive raises outward (bevel), negative depresses inward (window/door recess). Default: 0.0.',
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
    const insetAmount = typeof args.insetAmount === 'number' ? args.insetAmount : 0.25;
    const depth = typeof args.depth === 'number' ? args.depth : 0.0;

    const success = context.service.insetFacet(mesh, { direction, faceId: args.faceId }, insetAmount, depth);
    if (!success) {
      throw new Error(`Failed to inset facet on "${mesh.name}".`);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      faceDirection: direction,
      insetAmount,
      depth,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

