import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class RetopologizeMeshTool extends AbstractTool {
  public readonly name = 'modeler_retopologize_mesh';
  public readonly description =
    'Retopologizes and decimates a high-poly sculpt into a game-ready real-time mesh using Quadric Error Metrics, preserving silhouette, boundary contours, and volume while recalculating smooth vertex normals.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to retopologize.',
      },
      targetFaces: {
        type: 'integer',
        minimum: 300,
        maximum: 100000,
        description:
          'Target polygon/triangle budget (e.g. 4000 for mobile/WebGL, 15000 for standard game character, 32000 for hero asset). Default: 15000.',
      },
    },
    required: ['meshName'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const meshName = String(args.meshName || '').trim();
    const mesh = context.findMeshByNameOrId(meshName);
    if (!mesh || !(mesh instanceof Mesh)) {
      throw new Error(`Mesh "${meshName}" not found in scene.`);
    }

    const targetFaces = Math.max(300, Math.min(Number(args.targetFaces) || 15000, 100000));
    const sculptCtrl = context.service.sculptController;

    const analysis = await sculptCtrl.retopologizeMesh(mesh, targetFaces);

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      originalTriangles: analysis.triangleCount,
      targetFaces,
      totalVertices: analysis.vertexCount,
      totalTriangles: analysis.triangleCount,
      gameReadiness: analysis.gameReadiness,
    });
  }
}

