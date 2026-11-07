import { Mesh, MeshBuilder } from '@babylonjs/core';
import { createRoundedBoxMesh } from '../../geometry/roundedBox';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

/**
 * Computes size-adaptive and budget-aware segment/tessellation counts when not explicitly provided.
 * Prevents tiny tertiary details (such as eyeballs, buttons, or bolts) from consuming more polygons
 * than primary structural volumes (such as a torso or hull).
 */
export function computeAdaptiveTessellation(
  shapeType: string,
  maxWorldDimension: number,
  maxPolygonBudget = 5000,
  detailTier?: string
): number {
  const tier = (detailTier || '').toLowerCase();
  const budgetScale = maxPolygonBudget >= 20000 ? 1.35 : maxPolygonBudget <= 1500 ? 0.75 : 1.0;

  if (shapeType === 'sphere') {
    let baseSegs: number;
    if (tier === 'tertiary' || maxWorldDimension <= 0.08) {
      baseSegs = 4; // 144 triangles for tiny eyeballs, rivets, beads
    } else if (maxWorldDimension <= 0.18) {
      baseSegs = 6; // 256 triangles for small spheres/joints
    } else if (tier === 'secondary' || maxWorldDimension <= 0.45) {
      baseSegs = 12; // 784 triangles for medium volumes (heads, shoulders)
    } else {
      baseSegs = 16; // 1,296 triangles for large primary volumes
    }
    return Math.max(4, Math.min(32, Math.round(baseSegs * budgetScale)));
  }

  if (shapeType === 'torus' || shapeType === 'disc') {
    let baseTess: number;
    if (tier === 'tertiary' || maxWorldDimension <= 0.12) {
      baseTess = 12;
    } else if (tier === 'secondary' || maxWorldDimension <= 0.45) {
      baseTess = 18;
    } else {
      baseTess = 24;
    }
    return Math.max(8, Math.min(48, Math.round(baseTess * budgetScale)));
  }

  // cylinder, cone, capsule
  let baseTess: number;
  if (tier === 'tertiary' || maxWorldDimension <= 0.1) {
    baseTess = 8;
  } else if (maxWorldDimension <= 0.25) {
    baseTess = 12;
  } else if (tier === 'secondary' || maxWorldDimension <= 0.6) {
    baseTess = 16;
  } else {
    baseTess = 20;
  }
  return Math.max(6, Math.min(36, Math.round(baseTess * budgetScale)));
}

export class CreatePrimitiveTool extends AbstractTool {
  public readonly name = 'modeler_create_primitive';
  public readonly description =
    'Creates a 3D primitive mesh (box, sphere, cylinder, cone, capsule, torus, torusKnot, plane, disc, ground, polyhedron) in the live Babylon.js scene. Automatically adapts segment density to part size and polygon budget so tiny details (like eyes or bolts) stay lightweight while primary volumes stay smooth. Supports optional bevelRadius on boxes.';

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
      detailTier: {
        type: 'string',
        enum: ['primary', 'secondary', 'tertiary'],
        description:
          'Optional hierarchy tier: "primary" (torso, main body, building shell), "secondary" (limbs, medium parts), or "tertiary" (eyes, buttons, rivets, small trim). Controls automatic segment allocation.',
      },
      bevelRadius: {
        type: 'number',
        description:
          'Optional edge bevel/rounding radius in meters for type="box" (e.g. 0.03) so edges catch specular highlights instead of looking razor-sharp.',
      },
      options: {
        type: 'object',
        description:
          'Babylon.js MeshBuilder options: width, height, depth, size, diameter, diameterTop, diameterBottom, thickness, tessellation, segments, subdivisions, polyType (0-4), arc, slice, bevelRadius.',
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
          bevelRadius: { type: 'number' },
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

    // Determine effective world scale to drive size-adaptive tessellation
    const sc = args.scaling
      ? Array.isArray(args.scaling)
        ? [Number(args.scaling[0] ?? 1) || 1, Number(args.scaling[1] ?? 1) || 1, Number(args.scaling[2] ?? 1) || 1]
        : [Number(args.scaling.x ?? 1) || 1, Number(args.scaling.y ?? 1) || 1, Number(args.scaling.z ?? 1) || 1]
      : [1, 1, 1];
    const maxScale = Math.max(Math.abs(sc[0]), Math.abs(sc[1]), Math.abs(sc[2]));
    const budget = context.aiAgent?.config?.maxPolygons ?? 5000;
    const detailTier = opts.detailTier;

    let mesh: Mesh;
    switch (type) {
      case 'sphere': {
        const diam = opts.diameter ?? opts.size ?? 1;
        const dx = opts.width ?? diam;
        const dy = opts.height ?? diam;
        const dz = opts.depth ?? diam;
        const maxWorldDim = Math.max(dx * Math.abs(sc[0]), dy * Math.abs(sc[1]), dz * Math.abs(sc[2]));
        const adaptiveSegs = computeAdaptiveTessellation('sphere', maxWorldDim, budget, detailTier);
        mesh = MeshBuilder.CreateSphere(
          uniqueName,
          {
            diameter: diam,
            diameterX: opts.width,
            diameterY: opts.height,
            diameterZ: opts.depth,
            segments: opts.segments ?? opts.tessellation ?? adaptiveSegs,
            arc: opts.arc,
            slice: opts.slice,
          },
          context.scene
        );
        break;
      }
      case 'cylinder': {
        const diam = opts.diameter ?? opts.size ?? 1;
        const dTop = opts.diameterTop ?? diam;
        const dBot = opts.diameterBottom ?? diam;
        const maxRadiusDim = Math.max(dTop, dBot) * maxScale;
        const adaptiveTess = computeAdaptiveTessellation('cylinder', maxRadiusDim, budget, detailTier);
        mesh = MeshBuilder.CreateCylinder(
          uniqueName,
          {
            height: opts.height ?? 2,
            diameter: diam,
            diameterTop: opts.diameterTop,
            diameterBottom: opts.diameterBottom,
            tessellation: opts.tessellation ?? opts.segments ?? adaptiveTess,
            arc: opts.arc,
          },
          context.scene
        );
        break;
      }
      case 'cone': {
        const dBot = opts.diameterBottom ?? opts.diameter ?? opts.size ?? 1;
        const adaptiveTess = computeAdaptiveTessellation('cone', dBot * maxScale, budget, detailTier);
        mesh = MeshBuilder.CreateCylinder(
          uniqueName,
          {
            height: opts.height ?? 2,
            diameterTop: opts.diameterTop ?? 0,
            diameterBottom: dBot,
            tessellation: opts.tessellation ?? opts.segments ?? adaptiveTess,
          },
          context.scene
        );
        break;
      }
      case 'capsule': {
        const diam = opts.diameter ?? opts.size ?? 1;
        const adaptiveTess = computeAdaptiveTessellation('capsule', diam * maxScale, budget, detailTier);
        mesh = MeshBuilder.CreateCapsule(
          uniqueName,
          {
            height: opts.height ?? 2,
            radius: diam * 0.5,
            tessellation: opts.tessellation ?? opts.segments ?? adaptiveTess,
          },
          context.scene
        );
        break;
      }
      case 'torus': {
        const diam = opts.diameter ?? opts.size ?? 1;
        const adaptiveTess = computeAdaptiveTessellation('torus', diam * maxScale, budget, detailTier);
        mesh = MeshBuilder.CreateTorus(
          uniqueName,
          {
            diameter: diam,
            thickness: opts.thickness ?? diam * 0.25,
            tessellation: opts.tessellation ?? opts.segments ?? adaptiveTess,
          },
          context.scene
        );
        break;
      }
      case 'torusknot':
        mesh = MeshBuilder.CreateTorusKnot(
          uniqueName,
          {
            radius: (opts.diameter ?? opts.size ?? 1) * 0.4,
            tube: opts.thickness ?? 0.12,
            radialSegments: opts.tessellation ?? 48,
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
      case 'disc': {
        const diam = opts.diameter ?? opts.size ?? 1;
        const adaptiveTess = computeAdaptiveTessellation('disc', diam * maxScale, budget, detailTier);
        mesh = MeshBuilder.CreateDisc(
          uniqueName,
          {
            radius: diam * 0.5,
            tessellation: opts.tessellation ?? opts.segments ?? adaptiveTess,
          },
          context.scene
        );
        break;
      }
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
      default: {
        const bevelRadius = Number(opts.bevelRadius ?? opts.rounding ?? 0);
        if (bevelRadius > 0) {
          mesh = createRoundedBoxMesh(
            uniqueName,
            {
              width: opts.width ?? opts.size ?? 1,
              height: opts.height ?? opts.size ?? 1,
              depth: opts.depth ?? opts.size ?? 1,
              radius: bevelRadius,
              segments: opts.segments ?? 2,
            },
            context.scene
          );
        } else {
          mesh = MeshBuilder.CreateBox(
            uniqueName,
            {
              width: opts.width ?? opts.size ?? 1,
              height: opts.height ?? opts.size ?? 1,
              depth: opts.depth ?? opts.size ?? 1,
            },
            context.scene
          );
        }
        break;
      }
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
      vertices: mesh.getTotalVertices(),
      triangles: Math.floor(mesh.getTotalIndices() / 3),
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
