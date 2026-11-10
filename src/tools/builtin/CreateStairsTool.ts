import { buildStairsMesh } from '../../geometry/architecture';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CreateStairsTool extends AbstractTool {
  public readonly name = 'modeler_create_stairs';
  public readonly description =
    'Creates a straight or spiral staircase standing on Y = 0 with beveled step treads, front nosing overhang, risers/center column, and optional balusters and tubular handrails.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Descriptive name for the stairs mesh.' },
      style: {
        type: 'string',
        enum: ['straight', 'spiral'],
        description: 'Staircase layout: "straight" (climbs along +Z from Z=0) or "spiral" (revolves around Y-axis). Default: "straight".',
      },
      steps: { type: 'integer', minimum: 2, maximum: 80, description: 'Number of steps (default: 10).' },
      width: { type: 'number', description: 'Step width in meters (default: 1.2).' },
      stepRise: { type: 'number', description: 'Height per step in meters (default: 0.18).' },
      stepRun: { type: 'number', description: 'Depth per step in meters for straight stairs (default: 0.28).' },
      height: { type: 'number', description: 'Optional total climb height in meters (overrides stepRise).' },
      length: { type: 'number', description: 'Optional total horizontal run length in meters (overrides stepRun).' },
      nosing: { type: 'number', description: 'Tread nosing overhang in meters (default: 0.025).' },
      railing: {
        type: 'string',
        enum: ['none', 'left', 'right', 'both'],
        description: 'Handrail placement: "none", "left", "right", or "both" (default: "none").',
      },
      railingHeight: { type: 'number', description: 'Handrail height above treads in meters (default: 0.9).' },
      innerRadius: { type: 'number', description: 'Center column radius in meters for style="spiral" (default: 0.2).' },
      totalAngleDegrees: { type: 'number', description: 'Total rotation angle in degrees for style="spiral" (default: 270).' },
      position: {
        type: 'object',
        description: 'Base position { x, y, z } in meters.',
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
      color: { type: 'string', description: 'Hex color string, e.g. "#b8afa3".' },
      roughness: { type: 'number', description: 'PBR roughness (default: 0.65).' },
      metallic: { type: 'number', description: 'PBR metallic (default: 0.05).' },
      materialName: { type: 'string', description: 'Optional existing material name.' },
      texturePrompt: {
        type: 'string',
        description:
          'Optional natural language prompt to generate and apply an AI PBR texture (e.g. "Weathered ancient stone slabs", "Aged marble steps").',
      },
      uvScale: {
        type: 'number',
        description: 'Texture UV tiling scale factor (default: 2.0).',
      },
    },
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const baseName = String(args.name || 'staircase').replace(/\s+/g, '_');
    const uniqueName = context.findMeshByNameOrId(baseName)
      ? `${baseName}_${Date.now().toString().slice(-4)}`
      : baseName;

    const mesh = buildStairsMesh(context.scene, uniqueName, {
      style: args.style,
      steps: args.steps,
      width: args.width,
      stepRise: args.stepRise,
      stepRun: args.stepRun,
      height: args.height,
      length: args.length,
      nosing: args.nosing,
      stringers: args.stringers,
      railing: args.railing,
      railingHeight: args.railingHeight,
      innerRadius: args.innerRadius,
      totalAngleDegrees: args.totalAngleDegrees,
    });

    mesh.material = context.getOrCreateMaterial(
      args.materialName,
      args.color || '#b8afa3',
      args.roughness ?? 0.65,
      args.metallic ?? 0.05,
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
      style: args.style || 'straight',
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

