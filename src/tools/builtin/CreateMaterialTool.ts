import { Color3, PBRMaterial, Texture } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';
import { generateProceduralTextureDataUrl, generateProceduralNormalMapDataUrl } from '../textureUtils';

export class CreateMaterialTool extends AbstractTool {
  public readonly name = 'modeler_create_material';
  public readonly description =
    'Creates or updates a PBRMaterial with color, roughness, metallic, emissiveColor, alpha, normal maps, and optional procedural texture (wood, stone, marble, brick, metal, checker, grid, noise, gradient).';

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
      bumpLevel: { type: 'number', description: 'Bump / normal map intensity (0.0 to 5.0, default 1.0).' },
      invertNormalMapX: { type: 'boolean', description: 'Invert normal map X axis.' },
      invertNormalMapY: { type: 'boolean', description: 'Invert normal map Y axis (DirectX standard).' },
      textureUrl: {
        type: 'string',
        description: 'Optional URL or data:image base64 URI for diffuse/albedo texture (from image generator or web asset).',
      },
      normalMapUrl: {
        type: 'string',
        description: 'Optional URL or data:image base64 URI for normal map texture (alias for bumpTextureUrl).',
      },
      bumpTextureUrl: {
        type: 'string',
        description: 'Optional URL or data:image base64 URI for normal/bump map texture.',
      },
      useParallax: {
        type: 'boolean',
        description: 'Enable parallax mapping (uses height encoded in alpha channel of normal map).',
      },
      useParallaxOcclusion: {
        type: 'boolean',
        description: 'Enable deep parallax occlusion mapping.',
      },
      parallaxScaleBias: {
        type: 'number',
        description: 'Scale bias for parallax depth (default: 0.05).',
      },
      proceduralNormalMap: {
        type: 'boolean',
        description: 'Generate or disable automatic procedural normal map when proceduralTexture is used.',
      },
      uScale: { type: 'number', description: 'Horizontal texture tiling multiplier (default: 1.0).' },
      vScale: { type: 'number', description: 'Vertical texture tiling multiplier (default: 1.0).' },
      proceduralTexture: {
        type: 'object',
        description: 'Optional generated procedural surface texture.',
        properties: {
          type: {
            type: 'string',
            enum: [
              'wood',
              'stone',
              'sand',
              'tiles',
              'grass',
              'fabric',
              'marble',
              'brick',
              'metal',
              'checker',
              'grid',
              'noise',
              'gradient',
            ],
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
    if (args.invertNormalMapX !== undefined) {
      mat.invertNormalMapX = !!args.invertNormalMapX;
    }
    if (args.invertNormalMapY !== undefined) {
      mat.invertNormalMapY = !!args.invertNormalMapY;
    }
    if (args.useParallax !== undefined) {
      mat.useParallax = !!args.useParallax;
    }
    if (args.useParallaxOcclusion !== undefined) {
      mat.useParallaxOcclusion = !!args.useParallaxOcclusion;
      if (mat.useParallaxOcclusion) mat.useParallax = true;
    }
    if (args.parallaxScaleBias !== undefined) {
      mat.parallaxScaleBias = Number(args.parallaxScaleBias);
    }
    mat.backFaceCulling = false;

    const createTexturesEnabled = context.aiAgent?.config?.createTextures !== false;
    const createNormalMapsEnabled = context.aiAgent?.config?.createNormalMaps !== false && createTexturesEnabled;

    if ((args.textureUrl || args.albedoTextureUrl) && createTexturesEnabled) {
      const url = String(args.textureUrl || args.albedoTextureUrl);
      const tex = new Texture(url, context.scene, false, false);
      tex.hasAlpha = false;
      mat.useAlphaFromAlbedoTexture = false;
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
      tex.uScale = typeof args.uScale === 'number' ? args.uScale : 1;
      tex.vScale = typeof args.vScale === 'number' ? args.vScale : 1;
      mat.albedoTexture = tex;
      if (!args.albedoColor) {
        mat.albedoColor = new Color3(1, 1, 1);
      }
    }

    const rawNormalUrl = args.normalMapUrl || args.bumpTextureUrl;
    if (rawNormalUrl && createNormalMapsEnabled) {
      const url = String(rawNormalUrl);
      const tex = new Texture(url, context.scene, false, false);
      tex.hasAlpha = false;
      tex.uScale = typeof args.uScale === 'number' ? args.uScale : 1;
      tex.vScale = typeof args.vScale === 'number' ? args.vScale : 1;
      mat.bumpTexture = tex;
      if (args.bumpLevel !== undefined) {
        tex.level = Number(args.bumpLevel);
      }
    }

    if (args.proceduralTexture && createTexturesEnabled) {
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
        tex.hasAlpha = false;
        mat.useAlphaFromAlbedoTexture = false;
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
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

        // Automatically generate matching procedural normal map if enabled and not already provided
        if (createNormalMapsEnabled && !mat.bumpTexture && args.proceduralNormalMap !== false) {
          const normalDataUrl = generateProceduralNormalMapDataUrl({
            type: proc.type,
            scale: proc.scale,
            strength: typeof args.bumpLevel === 'number' ? args.bumpLevel * 2.0 : 2.0,
            invertY: !!args.invertNormalMapY,
          });
          const normTex = new Texture(normalDataUrl, context.scene, false, false);
          normTex.name = `${matName}_${proc.type}_normal.png`;
          normTex.hasAlpha = false;
          normTex.uScale = tex.uScale;
          normTex.vScale = tex.vScale;
          mat.bumpTexture = normTex;
          if (args.bumpLevel !== undefined) {
            normTex.level = Number(args.bumpLevel);
          }
        }
      }
    }

    if (args.bumpLevel !== undefined && mat.bumpTexture) {
      mat.bumpTexture.level = Number(args.bumpLevel);
    }

    return JSON.stringify({
      status: 'ok',
      materialName: mat.name,
    });
  }
}

