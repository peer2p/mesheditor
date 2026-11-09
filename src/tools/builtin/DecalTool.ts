import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class DecalTool extends AbstractTool {
  public readonly name = 'modeler_decal';
  public readonly description =
    'Projects and paints a 2D decal onto a 3D mesh surface (or merges/clears decals). Supports built-in decals (bullet_hole, cracks, rust_stain, splatter, glowing_rune, hazard_stripes, rivets_plate, star_emblem, ivy_leaves, vines, bush, flowers_colorful_lg, old_stones, water_puddle), scene textures, or custom AI-generated decals via prompt. Unmerged decals are automatically fused into the mesh on export or when action="merge" / mergeIntoMesh=true.';

  public readonly parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['place', 'merge', 'clear'],
        description:
          '"place" stamps a decal onto targetMesh (default); "merge" fuses all decals into their target meshes; "clear" removes unmerged decals.',
      },
      targetMesh: {
        type: 'string',
        description: 'Name of the target mesh to receive the decal (defaults to the currently selected mesh).',
      },
      decalType: {
        type: 'string',
        description:
          'Decal texture preset or name: "bullet_hole", "cracks", "rust_stain", "splatter", "glowing_rune", "hazard_stripes", "rivets_plate", "star_emblem", "ivy_leaves", "vines", "bush", "flowers_colorful_lg", "flowers_colorful_sm", "old_stones", "stony_path", "water_puddle", "sand_yellow", "sand_red", "dust_brown", or any scene texture name/URL.',
      },
      prompt: {
        type: 'string',
        description:
          'Optional text prompt to synthesize a custom alpha decal texture with the AI Texture Generator before stamping it onto the mesh.',
      },
      face: {
        type: 'string',
        enum: ['front', 'back', 'top', 'bottom', 'left', 'right'],
        description:
          'Surface side of the target mesh to project onto when explicit position/normal are omitted (default: "front").',
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional [x, y, z] world coordinates on the mesh surface where the decal should be projected.',
      },
      normal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional [nx, ny, nz] surface normal vector at the projection point.',
      },
      size: {
        description: 'Decal projection size as a single uniform number (e.g. 0.6) or [width, height, depth] array.',
        oneOf: [
          { type: 'number' },
          { type: 'array', items: { type: 'number' } },
        ],
      },
      angleDegrees: {
        type: 'number',
        description: 'Roll rotation angle of the decal in degrees (0 to 360, default: 0).',
      },
      opacity: {
        type: 'number',
        description: 'Decal opacity from 0.1 to 1.0 (default: 1.0).',
      },
      tintColor: {
        type: 'string',
        description: 'Optional hex color tint multiplied with the decal texture (default: "#ffffff").',
      },
      mergeIntoMesh: {
        type: 'boolean',
        description:
          'If true, immediately merges/fuses the placed decal into the target mesh geometry (default: false; note that all decals are also automatically merged upon model export).',
      },
    },
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const controller = context.service.decalController;
    const action = String(args.action || 'place').toLowerCase();

    if (action === 'merge') {
      if (args.targetMesh && args.targetMesh !== 'all') {
        const merged = controller.mergeDecalsIntoMesh(String(args.targetMesh));
        return JSON.stringify({
          status: 'ok',
          action: 'merge',
          targetMesh: merged ? merged.name : args.targetMesh,
        });
      }
      const res = controller.mergeAllDecalsIntoMeshes();
      return JSON.stringify({
        status: 'ok',
        action: 'merge',
        mergedDecalCount: res.mergedDecalCount,
        affectedMeshes: res.affectedMeshes,
      });
    }

    if (action === 'clear') {
      const removed = controller.clearUnmergedDecals(args.targetMesh ? String(args.targetMesh) : undefined);
      return JSON.stringify({
        status: 'ok',
        action: 'clear',
        removedCount: removed,
      });
    }

    let textureUrl: string | undefined;
    let textureName: string | undefined;

    if (args.prompt) {
      const generated = await context.service.aiTextureGenerator.generateTexture({
        prompt: String(args.prompt),
        style: 'decal',
        size: 256,
        generateNormalMap: false,
        embedInScene: true,
      });
      textureUrl = generated.albedoDataUrl;
      textureName = generated.name;
    } else if (args.decalType) {
      const resolved = controller.resolveTextureOption(String(args.decalType));
      textureUrl = resolved.url;
      textureName = resolved.name;
    }

    const pos =
      Array.isArray(args.position) && args.position.length >= 3
        ? ([Number(args.position[0]), Number(args.position[1]), Number(args.position[2])] as [number, number, number])
        : undefined;

    const norm =
      Array.isArray(args.normal) && args.normal.length >= 3
        ? ([Number(args.normal[0]), Number(args.normal[1]), Number(args.normal[2])] as [number, number, number])
        : undefined;

    const sizeArg =
      typeof args.size === 'number'
        ? args.size
        : Array.isArray(args.size) && args.size.length >= 3
          ? ([Number(args.size[0]), Number(args.size[1]), Number(args.size[2])] as [number, number, number])
          : undefined;

    const resultMesh = controller.placeDecal({
      targetMesh: args.targetMesh ? String(args.targetMesh) : undefined,
      position: pos,
      normal: norm,
      face: args.face,
      textureUrl,
      textureName,
      size: sizeArg,
      angleDeg: typeof args.angleDegrees === 'number' ? args.angleDegrees : undefined,
      opacity: typeof args.opacity === 'number' ? args.opacity : undefined,
      tintColor: args.tintColor ? this.normalizeHex(String(args.tintColor)) : undefined,
      mergeImmediately: Boolean(args.mergeIntoMesh),
    });

    return JSON.stringify({
      status: 'ok',
      action: 'place',
      meshName: resultMesh.name,
      mergedIntoMesh: Boolean(args.mergeIntoMesh),
      vertices: resultMesh.getTotalVertices(),
    });
  }
}

