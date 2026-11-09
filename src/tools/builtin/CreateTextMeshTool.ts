import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateTextMeshTool extends AbstractTool {
  public readonly name = 'modeler_create_text_mesh';
  public readonly description =
    'Creates or updates an extruded 3D text mesh with customizable font ("kenney_future", "droid_sans_bold", "droid_sans_regular"), size, extrusion depth, curve resolution, transform, and PBR material.';

  public readonly parameters = {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text string to extrude in 3D (e.g. "LEVEL 1", "SHOP", "DANGER").',
      },
      name: {
        type: 'string',
        description: 'Optional unique name for the created 3D text mesh.',
      },
      targetMesh: {
        type: 'string',
        description: 'Optional name of an existing 3D text mesh to update in-place instead of creating a new mesh.',
      },
      font: {
        type: 'string',
        enum: ['kenney_future', 'droid_sans_bold', 'droid_sans_regular'],
        description: 'Font family to use for 3D extrusion (default: "kenney_future").',
      },
      size: {
        type: 'number',
        description: 'Character height in world units (default: 1.0).',
      },
      depth: {
        type: 'number',
        description: '3D extrusion thickness/depth in world units (default: 0.25).',
      },
      resolution: {
        type: 'number',
        description: 'Curve subdivision resolution from 1 to 24 (default: 8).',
      },
      color: {
        type: 'string',
        description: 'Hex base color of the 3D text (default: "#3b82f6").',
      },
      emissiveColor: {
        type: 'string',
        description: 'Optional hex emissive glow color (e.g. "#00ffcc").',
      },
      emissiveIntensity: {
        type: 'number',
        description: 'Emissive glow intensity from 0.0 to 5.0 (default: 0).',
      },
      roughness: {
        type: 'number',
        description: 'PBR roughness from 0.0 to 1.0 (default: 0.35).',
      },
      metallic: {
        type: 'number',
        description: 'PBR metallic from 0.0 to 1.0 (default: 0.2).',
      },
      materialName: {
        type: 'string',
        description: 'Optional name of a material from modeler_create_material / modeler_generate_texture to assign.',
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        description: '[x, y, z] world position (default: [0, 0, 0]).',
      },
      rotation: {
        type: 'array',
        items: { type: 'number' },
        description: '[rx, ry, rz] Euler rotation in radians.',
      },
      rotationDegrees: {
        type: 'array',
        items: { type: 'number' },
        description: '[rx, ry, rz] Euler rotation in degrees.',
      },
      scale: {
        type: 'array',
        items: { type: 'number' },
        description: '[sx, sy, sz] scaling factors (default: [1, 1, 1]).',
      },
    },
    required: ['text'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const controller = context.service.textMeshController;
    const text = String(args.text ?? '3D Text').trim() || '3D Text';

    let existingMesh = args.targetMesh ? context.findMeshByNameOrId(String(args.targetMesh)) : undefined;
    let mesh;

    const commonOpts = {
      name: args.name,
      text,
      fontUrl: args.font,
      size: typeof args.size === 'number' ? args.size : undefined,
      depth: typeof args.depth === 'number' ? args.depth : undefined,
      resolution: typeof args.resolution === 'number' ? args.resolution : undefined,
      color: args.color ? this.normalizeHex(String(args.color)) : undefined,
      emissiveColor: args.emissiveColor ? this.normalizeHex(String(args.emissiveColor)) : undefined,
      emissiveIntensity:
        typeof args.emissiveIntensity === 'number'
          ? args.emissiveIntensity
          : args.emissiveColor
            ? 1.0
            : undefined,
      roughness: typeof args.roughness === 'number' ? args.roughness : undefined,
      metallic: typeof args.metallic === 'number' ? args.metallic : undefined,
      selectAfterCreate: true,
    };

    if (existingMesh) {
      mesh = await controller.updateTextMesh(existingMesh, commonOpts);
    } else {
      mesh = await controller.createTextMesh(commonOpts);
    }

    if (args.position || args.rotation || args.rotationDegrees || args.scale) {
      context.applyTransformArgs(mesh, args);
    }

    if (args.materialName) {
      const mat = context.materialRegistry.get(String(args.materialName));
      if (mat) {
        mesh.material = mat;
      }
    }

    context.registerCreatedMesh(mesh);

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      text,
      vertices: mesh.getTotalVertices(),
      faces: Math.floor(mesh.getTotalIndices() / 3),
    });
  }
}

