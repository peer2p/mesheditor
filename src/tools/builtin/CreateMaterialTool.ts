import { Color3, PBRMaterial, Texture } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';
import { generateProceduralTextureDataUrl } from '../textureUtils';

export class CreateMaterialTool extends AbstractTool {
  public readonly name = 'modeler_create_material';
  public readonly description =
    'Creates or updates a PBRMaterial with color, roughness, metallic, emissiveColor, alpha, and optional procedural texture (wood, stone, marble, brick, metal, checker, grid, noise, gradient).';

  public readonly parameters = {
    type: 'object',
    properties: {
      materialName: { type: 'string', description: 'Unique name of the material.' },
      albedoColor: { type: 'string', description: 'Hex color string, e.g. "#d4af37".' },
      emissiveColor: { type: 'string', description: 'Optional glowing emissive hex color, e.g. "#00ffcc".' },
      roughness: { type: 'number', description: '0.0 (mirror smooth) to 1.0 (matte rough).' },
      metallic: { type: 'number', description: '0.0 (dielectric/wood/stone) to 1.0 (pure metal).' },
      alpha: { type: 'number', description: 'Opacity 0.0 to 1.0 (default 1.0).' },
      wireframe: { type: 'boolean' },
      proceduralTexture: {
        type: 'object',
        description: 'Optional generated procedural surface texture.',
        properties: {
          type: {
            type: 'string',
            enum: ['wood', 'stone', 'marble', 'brick', 'metal', 'checker', 'grid', 'noise', 'gradient'],
          },
          primaryColor: { type: 'string' },
          secondaryColor: { type: 'string' },
          scale: { type: 'number' },
          uScale: { type: 'number' },
          vScale: { type: 'number' },
        },
        required: ['type'],
      },
    },
    required: ['materialName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const matName = (args.materialName || `Mat_${Date.now().toString().slice(-4)}`).trim();
    let mat = context.materialRegistry.get(matName);
    if (!mat || !context.scene.materials.includes(mat)) {
      mat = new PBRMaterial(matName, context.scene);
      context.materialRegistry.set(matName, mat);
    }

    if (args.albedoColor) {
      mat.albedoColor = Color3.FromHexString(this.normalizeHex(args.albedoColor));
    } else if (!mat.albedoColor) {
      mat.albedoColor = new Color3(0.85, 0.85, 0.85);
    }
    if (args.emissiveColor) {
      mat.emissiveColor = Color3.FromHexString(this.normalizeHex(args.emissiveColor));
    }
    mat.roughness = args.roughness !== undefined ? Number(args.roughness) : 0.5;
    mat.metallic = args.metallic !== undefined ? Number(args.metallic) : 0.1;
    if (args.alpha !== undefined) {
      mat.alpha = Number(args.alpha);
    }
    if (args.wireframe !== undefined) {
      mat.wireframe = !!args.wireframe;
    }
    mat.backFaceCulling = false;

    if (args.proceduralTexture) {
      const proc =
        typeof args.proceduralTexture === 'string'
          ? { type: args.proceduralTexture, uScale: args.uScale, vScale: args.vScale }
          : args.proceduralTexture;
      if (proc.type) {
        const dataUrl = generateProceduralTextureDataUrl({
          type: proc.type,
          primaryColor: proc.primaryColor || args.albedoColor,
          secondaryColor: proc.secondaryColor,
          scale: proc.scale,
        });
        const tex = new Texture(dataUrl, context.scene, false, false);
        tex.name = `${matName}_${proc.type}.png`;
        tex.uScale =
          proc.uScale !== undefined
            ? Number(proc.uScale)
            : args.uScale !== undefined
            ? Number(args.uScale)
            : 1;
        tex.vScale =
          proc.vScale !== undefined
            ? Number(proc.vScale)
            : args.vScale !== undefined
            ? Number(args.vScale)
            : 1;
        mat.albedoTexture = tex;
        if (!args.albedoColor) {
          mat.albedoColor = new Color3(1, 1, 1);
        }
      }
    }

    return JSON.stringify({
      status: 'ok',
      materialName: mat.name,
    });
  }
}

