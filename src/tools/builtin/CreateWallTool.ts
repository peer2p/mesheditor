import { buildWallMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateWallTool extends AbstractTool {
  public readonly name = 'modeler_create_wall';
  public readonly description =
    'Creates a parametric architectural wall standing on Y = 0 (bottom-aligned) with cleanly cut rectangular, arched, or circular window and door openings, optional beveled window/door frames, base plinth, and top cornice.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the wall mesh.' },
      width: { type: 'number', description: 'Wall length along X-axis in meters (default: 4.0).' },
      height: { type: 'number', description: 'Wall height along Y-axis in meters (default: 3.0).' },
      thickness: { type: 'number', description: 'Wall thickness along Z-axis in meters (default: 0.25).' },
      openings: {
        type: 'array',
        description:
          'Array of door or window openings cut through the wall. Coordinates are relative to the wall: x is horizontal offset from wall center (0 = centered), y is bottom sill height from wall base (0 = floor-level door, e.g. 0.9 = window sill).',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['rect', 'arch', 'round'],
              description: 'Opening shape: "rect", "arch" (rounded top), or "round" (rose/porthole window). Default: "rect".',
            },
            x: { type: 'number', description: 'Horizontal center offset along wall X (0 = center).' },
            y: { type: 'number', description: 'Sill height from bottom of wall (0 = door).' },
            width: { type: 'number', description: 'Opening width in meters (default: 0.9).' },
            height: { type: 'number', description: 'Opening height in meters (default: 1.4).' },
            archRise: { type: 'number', description: 'Arch rise height for type="arch".' },
            frame: { type: 'boolean', description: 'Whether to add a 3D beveled frame around the opening (default: true).' },
            frameWidth: { type: 'number', description: 'Frame trim width in meters (default: 0.06).' },
          },
        },
      },
      plinthHeight: {
        type: 'number',
        description: 'Optional height of a protruding base plinth band in meters (e.g. 0.25).',
      },
      corniceHeight: {
        type: 'number',
        description: 'Optional height of a protruding top cornice band in meters (e.g. 0.15).',
      },
      position: {
        type: 'object',
        description: 'Base center position { x, y, z } in meters (at y: 0, the wall rests on the ground).',
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
      color: { type: 'string', description: 'Hex color string, e.g. "#d6d3cd".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.75).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.02).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
      texturePrompt: {
        type: 'string',
        description:
          'Optional natural language prompt to generate and apply an AI PBR texture (e.g. "Ancient limestone ashlar masonry", "Weathered medieval stone wall").',
      },
      uvScale: {
        type: 'number',
        description: 'Texture UV tiling scale factor (default: 2.0).',
      },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'arch_wall').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildWallMesh(context.scene, uniqueName, {
      width: args.width,
      height: args.height,
      thickness: args.thickness,
      openings: args.openings,
      plinthHeight: args.plinthHeight,
      corniceHeight: args.corniceHeight,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#d6d3cd',
      args.roughness ?? 0.75,
      args.metallic ?? 0.02,
      uniqueName
    );
    context.applyTransformArgs(mesh, args);
    context.registerCreatedMesh(mesh);

    if (args.texturePrompt && context.service.aiTextureGenerator) {
      context.service.aiTextureGenerator
        .generateTexture({
          prompt: args.texturePrompt,
          applyToMesh: mesh.name,
          uvScale: typeof args.uvScale === 'number' ? args.uvScale : 2.0,
          useAI: true,
          fallbackToProcedural: true,
        })
        .catch((err: any) => {
          console.warn(`Texture generation for ${mesh.name} failed:`, err);
        });
    }

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      vertices: mesh.getTotalVertices(),
      triangles: Math.floor(mesh.getTotalIndices() / 3),
      openingsCount: Array.isArray(args.openings) ? args.openings.length : 0,
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

