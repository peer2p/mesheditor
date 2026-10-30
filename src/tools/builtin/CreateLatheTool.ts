import { Mesh, MeshBuilder } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateLatheTool extends AbstractTool {
  public readonly name = 'modeler_create_lathe';
  public readonly description =
    'Creates a rotationally symmetric 3D mesh (vase, goblet, pillar, bottle, chess piece, dome, wheel) by revolving a 2D profile in the XY plane (x >= 0 as radius, y as height) around the Y axis.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      shape: {
        type: 'array',
        description: 'Profile points { x, y, z: 0 } where x is radius from center and y is height.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'y'],
        },
      },
      radius: { type: 'number', description: 'Overall radius multiplier (default 1).' },
      tessellation: { type: 'number', description: 'Radial segments around Y axis (default 32).' },
      arc: { type: 'number', description: 'Portion of circumference 0.0 to 1.0 (default 1.0).' },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      color: { type: 'string' },
      roughness: { type: 'number' },
      metallic: { type: 'number' },
      materialName: { type: 'string' },
    },
    required: ['shape'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = (args.name || 'lathe_mesh').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const shape = (args.shape || []).map((p: any) => this.parseVec3(p, 0));

    const mesh = MeshBuilder.CreateLathe(
      uniqueName,
      {
        shape,
        radius: args.radius !== undefined ? Number(args.radius) : 1,
        tessellation: args.tessellation !== undefined ? Number(args.tessellation) : 32,
        arc: args.arc !== undefined ? Number(args.arc) : 1,
        cap: Mesh.CAP_ALL,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      context.scene
    );

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color,
      args.roughness,
      args.metallic,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      vertices: mesh.getTotalVertices(),
    });
  }
}

