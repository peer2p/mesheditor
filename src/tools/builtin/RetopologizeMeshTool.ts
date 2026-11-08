import { Mesh, Vector3 } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class RetopologizeMeshTool extends AbstractTool {
  public readonly name = 'modeler_retopologize_mesh';
  public readonly description =
    'Retopologizes a high-poly sculpt into a game-ready low-poly mesh via Quadric Error Decimation, Shrinkwrap Surface Projection, Quad-Flow Cage generation, or Quad-Draw Strips.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to retopologize.',
      },
      mode: {
        type: 'string',
        enum: ['decimate', 'shrinkwrap', 'quad_cage', 'quad_strip'],
        description:
          'Retopology mode: "decimate" (Quadric Error simplification), "shrinkwrap" (project low-poly mesh onto targetHighPolyMeshName), "quad_cage" (generate structured quad-flow cage wrapped onto meshName), or "quad_strip" (draw a surface-snapped quad strip along stroke points). Default: "decimate".',
      },
      targetFaces: {
        type: 'integer',
        minimum: 300,
        maximum: 100000,
        description:
          'Target polygon/triangle budget for decimate mode (e.g. 4000 for mobile/WebGL, 15000 for standard game character, 32000 for hero asset). Default: 15000.',
      },
      targetHighPolyMeshName: {
        type: 'string',
        description: 'Name of the high-poly sculpt target mesh when mode is "shrinkwrap".',
      },
      surfaceOffset: {
        type: 'number',
        description: 'Normal offset distance above the high-poly surface (default 0.004).',
      },
      stripWidth: {
        type: 'number',
        description: 'Width of the quad strip in meters when mode is "quad_strip" (default 0.25).',
      },
      strokePoints: {
        type: 'array',
        description: 'Array of [x, y, z] world points for drawing a quad strip when mode is "quad_strip".',
        items: {
          type: 'array',
          items: { type: 'number' },
        },
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

    const mode = args.mode || 'decimate';
    const surfaceOffset = args.surfaceOffset !== undefined ? Number(args.surfaceOffset) : 0.004;
    const sculptCtrl = context.service.sculptController;

    if (mode === 'shrinkwrap') {
      const targetName = String(args.targetHighPolyMeshName || meshName).trim();
      const highPoly = context.findMeshByNameOrId(targetName) || mesh;
      const analysis = sculptCtrl.shrinkwrapMesh(mesh, highPoly, {
        offset: surfaceOffset,
        mode: 'nearest',
        smoothIterations: 1,
      });
      return JSON.stringify({
        status: 'ok',
        mode: 'shrinkwrap',
        meshName: mesh.name,
        targetHighPolyMeshName: highPoly.name,
        totalVertices: analysis.vertexCount,
        totalTriangles: analysis.triangleCount,
        gameReadiness: analysis.gameReadiness,
      });
    }

    if (mode === 'quad_cage') {
      const cage = sculptCtrl.generateQuadFlowCage(mesh, 14, 16, surfaceOffset);
      const analysis = sculptCtrl.analyzeTopology(cage);
      return JSON.stringify({
        status: 'ok',
        mode: 'quad_cage',
        sourceMeshName: mesh.name,
        resultMeshName: cage.name,
        totalVertices: analysis.vertexCount,
        totalTriangles: analysis.triangleCount,
        gameReadiness: analysis.gameReadiness,
      });
    }

    if (mode === 'quad_strip') {
      const rawPoints: any[] = Array.isArray(args.strokePoints) ? args.strokePoints : [];
      const worldPts = rawPoints.map((p) => this.parseVec3(p, 0));
      const stripWidth = Number(args.stripWidth) || 0.25;
      const quadMesh = sculptCtrl.drawQuadStripOnMesh(mesh, worldPts, stripWidth, surfaceOffset);
      const analysis = sculptCtrl.analyzeTopology(quadMesh);
      return JSON.stringify({
        status: 'ok',
        mode: 'quad_strip',
        sourceMeshName: mesh.name,
        resultMeshName: quadMesh.name,
        totalVertices: analysis.vertexCount,
        totalTriangles: analysis.triangleCount,
        gameReadiness: analysis.gameReadiness,
      });
    }

    const targetFaces = Math.max(300, Math.min(Number(args.targetFaces) || 15000, 100000));
    const analysis = await sculptCtrl.retopologizeMesh(mesh, targetFaces);

    return JSON.stringify({
      status: 'ok',
      mode: 'decimate',
      meshName: mesh.name,
      originalTriangles: analysis.triangleCount,
      targetFaces,
      totalVertices: analysis.vertexCount,
      totalTriangles: analysis.triangleCount,
      gameReadiness: analysis.gameReadiness,
    });
  }
}
