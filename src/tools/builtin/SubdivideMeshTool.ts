import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class SubdivideMeshTool extends AbstractTool {
  public readonly name = 'modeler_subdivide_mesh';
  public readonly description =
    'Subdivides each triangle of the mesh into 4 smaller subtriangles, increasing geometric resolution uniformly.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to subdivide.',
      },
      iterations: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        description: 'Number of subdivision iterations (default: 1).',
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
    for (let i = 0; i < iters; i++) {
      context.service.subdivideMesh(mesh);
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      iterations: iters,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

