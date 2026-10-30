import { Mesh, MeshBuilder } from '@babylonjs/core';
import earcut from 'earcut';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class ExtrudePolygonTool extends AbstractTool {
  public readonly name = 'modeler_extrude_polygon';
  public readonly description =
    'Extrudes a 2D polygon contour (defined in the XZ plane with y=0) along the Y axis by depth, supporting optional interior holes.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      shape: {
        type: 'array',
        description: 'Array of contour points { x, y: 0, z } in the XZ plane.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'z'],
        },
      },
      depth: { type: 'number', description: 'Extrusion depth along Y.' },
      holes: {
        type: 'array',
        description: 'Optional array of holes, where each hole is an array of { x, y: 0, z } points.',
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          },
        },
      },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotation: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      color: { type: 'string' },
      roughness: { type: 'number' },
      metallic: { type: 'number' },
      materialName: { type: 'string' },
    },
    required: ['shape', 'depth'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = (args.name || 'extruded_polygon').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const shape = (args.shape || []).map((p: any) => context.parsePolygonPoint(p));
    const holes = Array.isArray(args.holes)
      ? args.holes.map((h: any[]) => h.map((p: any) => context.parsePolygonPoint(p)))
      : undefined;
    const depth = Math.max(0.01, Number(args.depth) || 1);

    const mesh = MeshBuilder.ExtrudePolygon(
      uniqueName,
      {
        shape,
        depth,
        holes,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      context.scene,
      earcut
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

