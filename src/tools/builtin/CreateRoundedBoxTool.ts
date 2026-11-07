import { createRoundedBoxMesh } from '../../geometry/roundedBox';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateRoundedBoxTool extends AbstractTool {
  public readonly name = 'modeler_create_rounded_box';
  public readonly description =
    'Creates a beveled / rounded 3D box mesh where flat faces remain clean low-poly quads and edges/corners have smooth specular bevel rings. Essential for realistic hard-surface props, furniture, blocks, pedestals, and architectural masonry so edges catch light instead of looking razor-sharp and artificial.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the rounded box.' },
      width: { type: 'number', description: 'Width along X-axis in meters (default: 1.0).' },
      height: { type: 'number', description: 'Height along Y-axis in meters (default: 1.0).' },
      depth: { type: 'number', description: 'Depth along Z-axis in meters (default: 1.0).' },
      size: { type: 'number', description: 'Uniform size if width/height/depth are omitted.' },
      radius: {
        type: 'number',
        description: 'Bevel/fillet rounding radius in meters (default: 0.06). Clamped automatically to half the smallest dimension.',
      },
      segments: {
        type: 'integer',
        minimum: 1,
        maximum: 8,
        description: 'Bevel subdivision rings (1 = 45-degree chamfer, 3 = smooth rounded fillet). Default: 3.',
      },
      position: {
        type: 'object',
        description: 'Center position { x, y, z } in meters.',
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
      color: { type: 'string', description: 'Hex color string, e.g. "#94a3b8".' },
      roughness: { type: 'number', description: 'PBR roughness (0.0 to 1.0).' },
      metallic: { type: 'number', description: 'PBR metallic (0.0 to 1.0).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'rounded_box').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = createRoundedBoxMesh(
      uniqueName,
      {
        width: args.width,
        height: args.height,
        depth: args.depth,
        size: args.size,
        radius: args.radius,
        segments: args.segments,
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

