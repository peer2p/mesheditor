import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class SolidifyMeshTool extends AbstractTool {
  public readonly name = 'modeler_solidify_mesh';
  public readonly description =
    'Gives real physical wall thickness to an open surface sheet or hollow mesh (ideal for hollow vessels, cups, bowls, helmets, armor, pipes, or architectural walls).';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to solidify.',
      },
      thickness: {
        type: 'number',
        description: 'Thickness of the wall (default: 0.2).',
      },
      direction: {
        type: 'string',
        enum: ['top', 'bottom', 'front', 'back', 'left', 'right'],
        description: 'Optional: If specified, solidifies only the facet facing this direction instead of the whole mesh.',
      },
      faceId: {
        type: 'number',
        description: 'Optional: Specific face index to solidify (if solidifying single facet).',
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

    const thickness = typeof args.thickness === 'number' ? args.thickness : 0.2;
    const isSingleFace = args.direction !== undefined || args.faceId !== undefined;

    if (isSingleFace) {
      const fid = context.service.selectFaceByQuery(mesh, {
        direction: args.direction,
        faceId: args.faceId,
      });
      if (fid === null) {
        throw new Error(`Could not find specified face on mesh "${mesh.name}".`);
      }
      context.service.solidifyMeshOrFacet(thickness, true, mesh);
    } else {
      context.service.solidifyMeshOrFacet(thickness, false, mesh);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      thickness,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

