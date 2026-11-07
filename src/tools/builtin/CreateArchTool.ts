import { buildArchMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateArchTool extends AbstractTool {
  public readonly name = 'modeler_create_arch';
  public readonly description =
    'Creates a freestanding architectural arch or portal standing on Y = 0 (bottom-aligned), complete with side piers, plinth bases, impost capitals, curved voussoir arch ring, and protruding keystone. Supports Roman round, Gothic pointed, segmental, horseshoe, and flat styles.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the arch mesh.' },
      style: {
        type: 'string',
        enum: ['round', 'pointed', 'segmental', 'horseshoe', 'flat'],
        description: 'Arch profile style: "round" (Roman semicircle), "pointed" (Gothic lancet), "segmental" (shallow), "horseshoe" (Moorish), or "flat". Default: "round".',
      },
      span: { type: 'number', description: 'Inner clear opening width between piers in meters (default: 2.0).' },
      pierHeight: { type: 'number', description: 'Height of vertical side piers up to the arch spring line in meters (default: 1.8; set 0 for arch ring only).' },
      pierWidth: { type: 'number', description: 'Width of each side pier in meters (default: 0.35).' },
      rise: { type: 'number', description: 'Arch height above the pier spring line in meters (default: span/2 for round, 0.65*span for pointed).' },
      thickness: { type: 'number', description: 'Radial thickness of the arch ring in meters (default: 0.35).' },
      depth: { type: 'number', description: 'Depth of the arch along Z-axis in meters (default: 0.4).' },
      segments: { type: 'integer', minimum: 6, maximum: 48, description: 'Curve segments along the arch ring (default: 16).' },
      keystone: { type: 'boolean', description: 'Whether to add a protruding keystone at the crown (default: true).' },
      impostCap: { type: 'boolean', description: 'Whether to add molded impost capitals at the top of the piers (default: true).' },
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
      color: { type: 'string', description: 'Hex color string, e.g. "#cbbba0".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.7).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.02).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'stone_arch').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildArchMesh(context.scene, uniqueName, {
      style: args.style,
      span: args.span,
      pierHeight: args.pierHeight,
      pierWidth: args.pierWidth,
      rise: args.rise,
      thickness: args.thickness,
      depth: args.depth,
      segments: args.segments,
      keystone: args.keystone,
      impostCap: args.impostCap,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#cbbba0',
      args.roughness ?? 0.7,
      args.metallic ?? 0.02,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      style: args.style || 'round',
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

