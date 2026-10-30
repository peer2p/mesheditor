import { Mesh, MeshBuilder } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreatePrimitiveTool extends AbstractTool {
  public readonly name = 'modeler_create_primitive';
  public readonly description =
    'Creates a 3D primitive mesh (box, sphere, cylinder, cone, capsule, torus, torusKnot, plane, disc, ground, polyhedron) in the live Babylon.js scene.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the mesh.' },
      type: {
        type: 'string',
        enum: [
          'box',
          'sphere',
          'cylinder',
          'cone',
          'capsule',
          'torus',
          'torusKnot',
          'plane',
          'disc',
          'ground',
          'polyhedron',
        ],
        description: 'Primitive geometry type.',
      },
      options: {
        type: 'object',
        description:
          'Babylon.js MeshBuilder options: width, height, depth, size, diameter, diameterTop, diameterBottom, thickness, tessellation, segments, subdivisions, polyType (0-4), arc, slice.',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          depth: { type: 'number' },
          size: { type: 'number' },
          diameter: { type: 'number' },
          diameterTop: { type: 'number' },
          diameterBottom: { type: 'number' },
          thickness: { type: 'number' },
          tessellation: { type: 'number' },
          segments: { type: 'number' },
          subdivisions: { type: 'number' },
          polyType: { type: 'number' },
          arc: { type: 'number' },
          slice: { type: 'number' },
        },
      },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        description: 'Rotation in degrees { x, y, z }.',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotation: {
        type: 'object',
        description: 'Optional rotation in radians { x, y, z } if rotationDegrees is not used.',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      scaling: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      color: { type: 'string', description: 'Hex color string, e.g. "#4f8cf6".' },
      roughness: { type: 'number', description: 'PBR roughness (0.0 to 1.0).' },
      metallic: { type: 'number', description: 'PBR metallic (0.0 to 1.0).' },
      materialName: {
        type: 'string',
        description: 'Optional name of an existing material created via modeler_create_material.',
      },
    },
    required: ['type'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const type = String(args.type || args.shape || 'box').toLowerCase();
    const opts = { ...args, ...(args.options || {}) };
    const baseName = (args.name || type).replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    let mesh: Mesh;
    switch (type) {
      case 'sphere':
        mesh = MeshBuilder.CreateSphere(
          uniqueName,
          {
            diameter: opts.diameter ?? opts.size ?? 1,
            diameterX: opts.width,
            diameterY: opts.height,
            diameterZ: opts.depth,
            segments: opts.segments ?? opts.tessellation ?? 24,
            arc: opts.arc,
            slice: opts.slice,
          },
          context.scene
        );
        break;
      case 'cylinder':
        mesh = MeshBuilder.CreateCylinder(
          uniqueName,
          {
            height: opts.height ?? 2,
            diameter: opts.diameter ?? opts.size ?? 1,
            diameterTop: opts.diameterTop,
            diameterBottom: opts.diameterBottom,
            tessellation: opts.tessellation ?? opts.segments ?? 24,
            arc: opts.arc,
          },
          context.scene
        );
        break;
      case 'cone':
        mesh = MeshBuilder.CreateCylinder(
          uniqueName,
          {
            height: opts.height ?? 2,
            diameterTop: opts.diameterTop ?? 0,
            diameterBottom: opts.diameterBottom ?? opts.diameter ?? opts.size ?? 1,
            tessellation: opts.tessellation ?? 24,
          },
          context.scene
        );
        break;
      case 'capsule':
        mesh = MeshBuilder.CreateCapsule(
          uniqueName,
          {
            height: opts.height ?? 2,
            radius: (opts.diameter ?? opts.size ?? 1) * 0.5,
            tessellation: opts.tessellation ?? 24,
          },
          context.scene
        );
        break;
      case 'torus':
        mesh = MeshBuilder.CreateTorus(
          uniqueName,
          {
            diameter: opts.diameter ?? opts.size ?? 1,
            thickness: opts.thickness ?? (opts.diameter ?? 1) * 0.25,
            tessellation: opts.tessellation ?? 32,
          },
          context.scene
        );
        break;
      case 'torusknot':
        mesh = MeshBuilder.CreateTorusKnot(
          uniqueName,
          {
            radius: (opts.diameter ?? opts.size ?? 1) * 0.4,
            tube: opts.thickness ?? 0.12,
            radialSegments: opts.tessellation ?? 64,
          },
          context.scene
        );
        break;
      case 'plane':
        mesh = MeshBuilder.CreatePlane(
          uniqueName,
          {
            width: opts.width ?? opts.size ?? 1,
            height: opts.height ?? opts.size ?? 1,
          },
          context.scene
        );
        break;
      case 'disc':
        mesh = MeshBuilder.CreateDisc(
          uniqueName,
          {
            radius: (opts.diameter ?? opts.size ?? 1) * 0.5,
            tessellation: opts.tessellation ?? 32,
          },
          context.scene
        );
        break;
      case 'ground':
        mesh = MeshBuilder.CreateGround(
          uniqueName,
          {
            width: opts.width ?? opts.size ?? 4,
            height: opts.depth ?? opts.height ?? opts.size ?? 4,
            subdivisions: opts.subdivisions ?? 4,
          },
          context.scene
        );
        break;
      case 'polyhedron':
        mesh = MeshBuilder.CreatePolyhedron(
          uniqueName,
          {
            type: opts.polyType ?? 1,
            size: (opts.size ?? opts.diameter ?? 1) * 0.5,
          },
          context.scene
        );
        break;
      case 'box':
      default:
        mesh = MeshBuilder.CreateBox(
          uniqueName,
          {
            width: opts.width ?? opts.size ?? 1,
            height: opts.height ?? opts.size ?? 1,
            depth: opts.depth ?? opts.size ?? 1,
          },
          context.scene
        );
        break;
    }

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color,
      args.roughness,
      args.metallic,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      bounds: {
        min: {
          x: Number(bb.minimumWorld.x.toFixed(3)),
          y: Number(bb.minimumWorld.y.toFixed(3)),
          z: Number(bb.minimumWorld.z.toFixed(3)),
        },
        max: {
          x: Number(bb.maximumWorld.x.toFixed(3)),
          y: Number(bb.maximumWorld.y.toFixed(3)),
          z: Number(bb.maximumWorld.z.toFixed(3)),
        },
      },
    });
  }
}

