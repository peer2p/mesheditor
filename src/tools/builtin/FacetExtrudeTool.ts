import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class FacetExtrudeTool extends AbstractTool {
  public readonly name = 'modeler_facet_extrude';
  public readonly description =
    'Extrudes a polygonal face or quad outward (or inward) along its normal, generating connecting side quads. Ideal for box modeling (towers, battlements, stems, arms, extensions).';

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
        description: 'Direction of the face to extrude (default: "top").',
      },
      faceId: {
        type: 'number',
        description: 'Optional explicit face index instead of direction.',
      },
      distance: {
        type: 'number',
        description: 'Extrusion distance outward along the face normal (default: 0.5). Negative values extrude inward.',
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
    const distance = typeof args.distance === 'number' ? args.distance : 0.5;

    const success = context.service.extrudeFacet(mesh, { direction, faceId: args.faceId }, distance);
    if (!success) {
      throw new Error(`Failed to extrude facet on "${mesh.name}".`);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      faceDirection: direction,
      distance,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

