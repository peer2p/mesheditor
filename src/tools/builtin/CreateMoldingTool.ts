import { buildMoldingMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateMoldingTool extends AbstractTool {
  public readonly name = 'modeler_create_molding';
  public readonly description =
    'Sweeps a classical architectural molding profile (cornice, ogee, cove, torus, baseboard, cyma_recta, stepped, or custom 2D points) along a 3D polyline path with exact mitered corners so room perimeters, building rooflines, and decorative frames turn sharply without twisting.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the molding mesh.' },
      path: {
        type: 'array',
        description: 'Ordered 3D polyline points [{x,y,z}, ...] or [[x,y,z], ...] along which the profile is swept.',
        items: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
        },
      },
      profile: {
        type: 'string',
        enum: ['cornice', 'ogee', 'cove', 'torus', 'baseboard', 'cyma_recta', 'stepped', 'custom'],
        description: 'Molding cross-section preset (default: "cornice").',
      },
      profilePoints: {
        type: 'array',
        description: 'Optional custom 2D profile points [[projectionX, heightY], ...] when profile="custom".',
        items: {
          type: 'array',
          items: { type: 'number' },
        },
      },
      width: { type: 'number', description: 'Horizontal outward projection width in meters (default: 0.15).' },
      height: { type: 'number', description: 'Vertical profile height in meters (default: 0.18).' },
      closed: { type: 'boolean', description: 'Whether the path forms a closed perimeter loop (default: false).' },
      position: {
        type: 'object',
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
      color: { type: 'string', description: 'Hex color string, e.g. "#e2ddd5".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.6).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.02).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
    },
    required: ['path'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'arch_molding').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildMoldingMesh(context.scene, uniqueName, {
      path: args.path,
      profile: args.profile,
      profilePoints: args.profilePoints,
      width: args.width,
      height: args.height,
      closed: args.closed,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#e2ddd5',
      args.roughness ?? 0.6,
      args.metallic ?? 0.02,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      profile: args.profile || 'cornice',
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

