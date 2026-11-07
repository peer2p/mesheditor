import { buildColumnMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateColumnTool extends AbstractTool {
  public readonly name = 'modeler_create_column';
  public readonly description =
    'Creates a classical or modern architectural column standing on Y = 0 up to Y = height, featuring a square plinth, torus/scotia molded base, tapered shaft with classical entasis curvature and carved vertical flutes, necking ring, echinus capital, and square abacus (plus Ionic volutes when order="ionic").';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the column mesh.' },
      order: {
        type: 'string',
        enum: ['doric', 'tuscan', 'ionic', 'corinthian', 'modern'],
        description: 'Architectural order: "doric" (20 flutes), "tuscan" (smooth classical), "ionic" (24 flutes + volute scrolls), "corinthian" (24 flutes + tall flared capital), or "modern" (clean cylindrical pillar). Default: "doric".',
      },
      height: { type: 'number', description: 'Total column height from base (Y=0) to top of abacus in meters (default: 3.2).' },
      radius: { type: 'number', description: 'Lower shaft radius in meters (default: 0.24).' },
      taper: { type: 'number', description: 'Top-to-bottom shaft radius ratio (default: 0.85).' },
      entasis: { type: 'number', description: 'Convex mid-shaft bulge factor (default: 0.025).' },
      flutes: { type: 'integer', minimum: 0, maximum: 40, description: 'Number of carved vertical concave flutes (0 for smooth shaft, 20 for Doric, 24 for Ionic/Corinthian).' },
      fluteDepth: { type: 'number', description: 'Depth of each carved flute in meters (default: auto from radius).' },
      position: {
        type: 'object',
        description: 'Base center position { x, y, z } in meters.',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      scaling: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      color: { type: 'string', description: 'Hex color string, e.g. "#e8e4dc".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.55).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.02).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'classical_column').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildColumnMesh(context.scene, uniqueName, {
      order: args.order,
      height: args.height,
      radius: args.radius,
      taper: args.taper,
      entasis: args.entasis,
      flutes: args.flutes,
      fluteDepth: args.fluteDepth,
      radialSegments: args.radialSegments,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#e8e4dc',
      args.roughness ?? 0.55,
      args.metallic ?? 0.02,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      order: args.order || 'doric',
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
        size: {
          x: Number((bb.maximumWorld.x - bb.minimumWorld.x).toFixed(3)),
          y: Number((bb.maximumWorld.y - bb.minimumWorld.y).toFixed(3)),
          z: Number((bb.maximumWorld.z - bb.minimumWorld.z).toFixed(3)),
        },
      },
    });
  }
}

