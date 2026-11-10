import { Color3, PBRMaterial, Texture } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';
import { TextureStylePreset } from '../../textures/AITextureGenerator';

export class GenerateTextureTool extends AbstractTool {
  public readonly name = 'modeler_generate_texture';
  public readonly description =
    'Generates a seamless 2D PBR texture and normal map from a text prompt using the AI Texture Generator, embeds it in the scene, registers a PBRMaterial, and optionally applies it to a target mesh.';

  public readonly parameters = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          'Natural language description of the texture to generate (e.g. "Weathered dungeon cobblestone floor with mossy crevices", "Futuristic dark sci-fi hull plating with glowing cyan seams").',
      },
      name: {
        type: 'string',
        description: 'Optional base name for the generated texture.',
      },
      materialName: {
        type: 'string',
        description:
          'Optional PBR material name to create/update in the material registry using the generated texture so meshes can reference it.',
      },
      style: {
        type: 'string',
        enum: [
          'auto',
          'stone',
          'cobblestone',
          'brick',
          'wood',
          'metal',
          'rust',
          'scifi',
          'marble',
          'lava',
          'moss',
          'fabric',
          'scales',
          'runes',
          'decal',
        ],
        description: 'Optional pattern style override (defaults to "auto" inferred from prompt).',
      },
      size: {
        type: 'number',
        description: 'Texture resolution in pixels: 256, 512, or 1024 (default: 512).',
      },
      seamless: {
        type: 'boolean',
        description: 'Whether the generated texture should be seamlessly tileable (default: true).',
      },
      generateNormalMap: {
        type: 'boolean',
        description: 'Whether to generate a matching tangent-space normal map (default: true).',
      },
      normalStrength: {
        type: 'number',
        description: 'Normal map depth strength from 0.5 to 5.0 (default: 2.2).',
      },
      primaryColor: {
        type: 'string',
        description: 'Optional primary hex color override, e.g. "#5e6368".',
      },
      secondaryColor: {
        type: 'string',
        description: 'Optional secondary hex color override, e.g. "#25282c".',
      },
      accentColor: {
        type: 'string',
        description: 'Optional accent hex color override, e.g. "#00e5ff".',
      },
      roughness: {
        type: 'number',
        description: 'Optional PBR roughness override (0.0 to 1.0).',
      },
      metallic: {
        type: 'number',
        description: 'Optional PBR metallic override (0.0 to 1.0).',
      },
      uvScale: {
        type: 'number',
        description: 'UV tiling scale multiplier (default: 1.0).',
      },
      applyToMesh: {
        type: 'string',
        description:
          'Optional mesh name (or "selected" / "all") to immediately apply the generated texture material to.',
      },
      imageUrl: {
        type: 'string',
        description:
          'Optional image URL, workspace file path, or base64 data URI (e.g. from an AI image generator tool or artifact). When provided, uses this AI image and automatically computes a tangent-space normal map; otherwise falls back to the built-in procedural synthesizer.',
      },
      useAI: {
        type: 'boolean',
        description:
          'Whether to synthesize the texture using the configured external AI Image Generator (e.g. Draw Things, Stable Diffusion WebUI, Google Imagen 3 / Banana Pro, Pollinations.ai, OpenAI DALL-E, Fal.ai) instead of the procedural synthesizer. Defaults to true.',
      },
      backend: {
        type: 'string',
        enum: ['auto', 'procedural', 'pollinations', 'openai', 'imagen', 'fal', 'replicate', 'sd_webui', 'comfyui', 'custom'],
        description:
          'Optional image generation backend engine to use ("auto", "procedural", "pollinations", "openai", "imagen", "fal", "replicate", "sd_webui", "comfyui", "custom"). Defaults to "auto".',
      },
    },
    required: ['prompt'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const prompt = String(args.prompt || 'Seamless stone texture').trim();
    const uvScale = typeof args.uvScale === 'number' ? args.uvScale : 1;
    const imageUrl = args.imageUrl || args.imagePath || args.dataUrl;

    let item: any;
    if (imageUrl) {
      item = await context.service.aiTextureGenerator.addExternalTexture(
        args.name || 'ai_texture',
        imageUrl,
        prompt,
        typeof args.normalStrength === 'number' ? args.normalStrength : 2.2,
      );
    } else {
      item = await context.service.aiTextureGenerator.generateTexture({
        prompt,
        name: args.name,
        style: (args.style as TextureStylePreset) || 'auto',
        size: typeof args.size === 'number' ? args.size : 512,
        seamless: args.seamless !== false,
        generateNormalMap: args.generateNormalMap !== false,
        normalStrength: typeof args.normalStrength === 'number' ? args.normalStrength : undefined,
        primaryColor: args.primaryColor,
        secondaryColor: args.secondaryColor,
        accentColor: args.accentColor,
        roughness: typeof args.roughness === 'number' ? args.roughness : undefined,
        metallic: typeof args.metallic === 'number' ? args.metallic : undefined,
        uvScale,
        embedInScene: true,
        useAI: typeof args.useAI === 'boolean' ? args.useAI : true,
        backend: args.backend,
        fallbackToProcedural: true,
      });
    }

    // Also register a PBRMaterial in context.materialRegistry so AI tools can reference materialName
    const matName = (args.materialName || `Mat_${item.name}`).trim();
    let mat = context.materialRegistry.get(matName);
    if (!mat || !context.scene.materials.includes(mat)) {
      mat = new PBRMaterial(matName, context.scene);
      context.materialRegistry.set(matName, mat);
    }

    const isDecal = item.style === 'decal';
    mat.roughness = item.roughness;
    mat.metallic = item.metallic;

    let albedoTex = context.scene.textures.find(
      (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === item.albedoDataUrl
    );
    if (!albedoTex) {
      albedoTex = new Texture(
        item.albedoDataUrl,
        context.scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE,
      );
      albedoTex.name = item.embeddedAlbedoName || `${item.name}_albedo.png`;
    }
    albedoTex.uScale = uvScale;
    albedoTex.vScale = uvScale;
    albedoTex.hasAlpha = isDecal;
    if (isDecal) {
      albedoTex.onLoadObservable.addOnce(() => {
        albedoTex.hasAlpha = true;
      });
    }

    mat.useAlphaFromAlbedoTexture = isDecal;
    mat.transparencyMode = isDecal ? PBRMaterial.PBRMATERIAL_ALPHABLEND : PBRMaterial.PBRMATERIAL_OPAQUE;
    mat.backFaceCulling = !isDecal;
    mat.albedoTexture = albedoTex;

    // Prevent blinding white flash while texture is decoding asynchronously
    if (albedoTex.isReady()) {
      mat.albedoColor = Color3.White();
    } else {
      try {
        mat.albedoColor = Color3.FromHexString(item.primaryColor || '#888888');
      } catch {
        mat.albedoColor = new Color3(0.5, 0.5, 0.5);
      }
      albedoTex.onLoadObservable.addOnce(() => {
        mat.albedoColor = Color3.White();
      });
    }

    if (item.normalDataUrl) {
      let normTex = context.scene.textures.find(
        (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === item.normalDataUrl
      );
      if (!normTex) {
        normTex = new Texture(
          item.normalDataUrl,
          context.scene,
          false,
          false,
          Texture.TRILINEAR_SAMPLINGMODE,
        );
        normTex.name = item.embeddedNormalName || `${item.name}_normal.png`;
      }
      normTex.uScale = uvScale;
      normTex.vScale = uvScale;
      normTex.hasAlpha = false;
      normTex.level = Math.max(0.1, Math.min(3.0, item.normalStrength / 2.0));
      mat.bumpTexture = normTex;
    }

    let appliedMeshes: string[] = [];
    if (args.applyToMesh) {
      const targetMesh = context.findMeshByNameOrId(args.applyToMesh);
      if (targetMesh) {
        targetMesh.material = mat;
        appliedMeshes = [targetMesh.name];
      } else {
        try {
          const res = context.service.aiTextureGenerator.applyTextureToMesh(item.id, args.applyToMesh, uvScale);
          appliedMeshes = res.appliedTo;
        } catch {
          // Ignore if mesh not found
        }
      }
    }

    return JSON.stringify({
      status: 'ok',
      textureId: item.id,
      textureName: item.name,
      generatorBackend: item.generatorBackend || 'procedural',
      isAI: !!item.isAI,
      embeddedAlbedoName: item.embeddedAlbedoName,
      embeddedNormalName: item.embeddedNormalName,
      materialName: mat.name,
      style: item.style,
      size: item.size,
      appliedToMeshes: appliedMeshes,
    });
  }
}

