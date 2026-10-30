import { Mesh, MeshBuilder } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class ExtrudeShapeTool extends AbstractTool {
  public readonly name = 'modeler_extrude_shape';
  public readonly description =
    'Extrudes a 2D profile shape (defined in the XY plane with z=0) along a 3D path of Vector3 points.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      shape: {
        type: 'array',
        description: '2D profile points { x, y, z: 0 }.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
        },
      },
      path: {
        type: 'array',
        description: '3D path points { x, y, z } along which the shape is extruded.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
        },
      },
      scale: { type: 'number', description: 'Scale factor along the path (default 1).' },
      rotation: { type: 'number', description: 'Twist rotation step in radians along the path (default 0).' },
      cap: { type: 'number', description: '0: No cap, 1: Cap start, 2: Cap end, 3: Cap both (default 3).' },
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
    required: ['shape', 'path'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = (args.name || 'extruded_shape').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const shape = (args.shape || []).map((p: any) => this.parseVec3(p, 0));
    const path = (args.path || []).map((p: any) => this.parseVec3(p, 0));

    const mesh = MeshBuilder.ExtrudeShape(
      uniqueName,
      {
        shape,
        path,
        scale: args.scale !== undefined ? Number(args.scale) : 1,
        rotation: args.rotation !== undefined && typeof args.rotation === 'number' ? args.rotation : 0,
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

