import { buildRoofMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateRoofTool extends AbstractTool {
  public readonly name = 'modeler_create_roof';
  public readonly description =
    'Creates a parametric architectural roof (gable, hip, pyramid, shed, or dome) with real fascia slab thickness, eaves overhang, ridge cap beam, and triangular gable end walls. Base sits at local Y = 0, so set position.y to the wall top height.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the roof mesh.' },
      style: {
        type: 'string',
        enum: ['gable', 'hip', 'pyramid', 'shed', 'dome'],
        description: 'Roof style: "gable" (pitched with triangular gable ends), "hip" (4-sloped), "pyramid", "shed" (single slope), or "dome". Default: "gable".',
      },
      width: { type: 'number', description: 'Building footprint width along X-axis in meters (default: 4.0).' },
      depth: { type: 'number', description: 'Building footprint depth along Z-axis in meters (default: 4.0).' },
      height: { type: 'number', description: 'Roof peak height above the eaves in meters (default: 1.4).' },
      pitchDegrees: { type: 'number', description: 'Optional slope pitch angle in degrees (5 to 75) if height is omitted.' },
      overhang: { type: 'number', description: 'Eaves overhang beyond the walls in meters (default: 0.25).' },
      thickness: { type: 'number', description: 'Roof slab / fascia thickness in meters (default: 0.14).' },
      ridgeCap: { type: 'boolean', description: 'Whether to include a ridge cap beam along the apex (default: true).' },
      gableWall: { type: 'boolean', description: 'Whether to include triangular gable infill walls for style="gable" (default: true).' },
      position: {
        type: 'object',
        description: 'Eaves base center position { x, y, z } in meters (set y equal to the wall height).',
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
      color: { type: 'string', description: 'Hex color string, e.g. "#8b3a2b".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.75).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.05).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'arch_roof').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildRoofMesh(context.scene, uniqueName, {
      style: args.style,
      width: args.width,
      depth: args.depth,
      height: args.height,
      pitchDegrees: args.pitchDegrees,
      overhang: args.overhang,
      thickness: args.thickness,
      ridgeCap: args.ridgeCap,
      gableWall: args.gableWall,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#8b3a2b',
      args.roughness ?? 0.75,
      args.metallic ?? 0.05,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      style: args.style || 'gable',
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

