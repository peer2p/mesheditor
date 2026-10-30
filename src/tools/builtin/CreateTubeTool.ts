import { Mesh, MeshBuilder } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateTubeTool extends AbstractTool {
  public readonly name = 'modeler_create_tube';
  public readonly description =
    'Creates a cylindrical tube, pipe, cable, horn, or curved rail along a 3D path of points.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      path: {
        type: 'array',
        description: 'Array of 3D points { x, y, z } defining the tube centerline.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'y', 'z'],
        },
      },
      radius: { type: 'number', description: 'Tube radius (default 0.2).' },
      tessellation: { type: 'number', description: 'Radial segments (default 24).' },
      cap: { type: 'number', description: '0: No cap, 1: Start, 2: End, 3: Both (default 3).' },
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
    required: ['path'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = (args.name || 'tube_mesh').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const path = (args.path || []).map((p: any) => this.parseVec3(p, 0));

    const mesh = MeshBuilder.CreateTube(
      uniqueName,
      {
        path,
        radius: args.radius !== undefined ? Number(args.radius) : 0.2,
        tessellation: args.tessellation !== undefined ? Number(args.tessellation) : 24,
        cap: args.cap !== undefined ? Number(args.cap) : Mesh.CAP_ALL,
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

