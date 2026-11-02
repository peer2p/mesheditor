import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class SubDSmoothTool extends AbstractTool {
  public readonly name = 'modeler_subd_smooth';
  public readonly description =
    'Applies organic subdivision surface (Sub-D) smoothing using midpoint subdivision and Laplacian vertex relaxation. Turns low-poly blockout cages into smooth, rounded shapes (rocks, cushions, organic assets, curved bodies).';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to smooth.',
      },
      iterations: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        description: 'Smoothing iterations (default: 1, max: 3).',
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

    const iters = Math.max(1, Math.min(Number(args.iterations) || 1, 3));
    context.service.subDSmoothMeshOrFacet(iters, mesh);

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      iterations: iters,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

