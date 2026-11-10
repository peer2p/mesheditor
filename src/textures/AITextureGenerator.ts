import {
  Color3,
  Mesh,
  PBRMaterial,
  Texture,
} from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import { generateNormalMapFromCanvas } from '../tools/textureUtils';
import { ImageGeneratorBackendId } from '../types';
import { ExternalImageGeneratorService } from './ExternalImageGeneratorService';

export type TextureStylePreset =
  | 'auto'
  | 'stone'
  | 'cobblestone'
  | 'brick'
  | 'wood'
  | 'metal'
  | 'rust'
  | 'scifi'
  | 'marble'
  | 'lava'
  | 'moss'
  | 'fabric'
  | 'scales'
  | 'runes'
  | 'decal';

export interface AITextureGenerationOptions {
  prompt: string;
  name?: string;
  style?: TextureStylePreset;
  size?: number;
  seamless?: boolean;
  generateNormalMap?: boolean;
  normalStrength?: number;
  seed?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  roughness?: number;
  metallic?: number;
  uvScale?: number;
  embedInScene?: boolean;
  applyToMesh?: string;
  useAI?: boolean;
  backend?: ImageGeneratorBackendId | 'procedural' | 'auto';
  enhancePrompt?: boolean;
  fallbackToProcedural?: boolean;
}

export interface GeneratedTextureItem {
  id: string;
  name: string;
  prompt: string;
  style: Exclude<TextureStylePreset, 'auto'>;
  size: number;
  seed: number;
  seamless: boolean;
  albedoDataUrl: string;
  normalDataUrl?: string;
  roughness: number;
  metallic: number;
  normalStrength: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  createdAt: number;
  embeddedAlbedoName?: string;
  embeddedNormalName?: string;
  generatorBackend?: string;
  isAI?: boolean;
}

interface ResolvedTextureRecipe {
  style: Exclude<TextureStylePreset, 'auto'>;
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  accentColor: [number, number, number];
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  roughness: number;
  metallic: number;
  normalStrength: number;
  scale: number;
  seed: number;
  hasAlpha: boolean;
}

export interface QuickTexturePreset {
  label: string;
  prompt: string;
  style: Exclude<TextureStylePreset, 'auto'>;
}

export const QUICK_TEXTURE_PRESETS: QuickTexturePreset[] = [
  {
    label: 'Dungeon Cobblestone',
    prompt: 'Weathered dark dungeon cobblestone floor with mossy crevices',
    style: 'cobblestone',
  },
  {
    label: 'Ancient Red Brick',
    prompt: 'Aged red clay brick wall with warm mortar joints',
    style: 'brick',
  },
  {
    label: 'Oak Wood Planks',
    prompt: 'Warm medieval oak wood planks with natural grain and knots',
    style: 'wood',
  },
  {
    label: 'Sci-Fi Hull Panels',
    prompt: 'Futuristic dark titanium sci-fi hull plating with glowing cyan energy seams',
    style: 'scifi',
  },
  {
    label: 'Rusted Industrial Metal',
    prompt: 'Corroded industrial iron sheet metal with orange rust patches and scratches',
    style: 'rust',
  },
  {
    label: 'Volcanic Magma Rock',
    prompt: 'Cracked black basalt volcanic rock with glowing orange lava veins',
    style: 'lava',
  },
  {
    label: 'Royal White Marble',
    prompt: 'Polished white Carrara marble with subtle grey and gold mineral veins',
    style: 'marble',
  },
  {
    label: 'Arcane Glowing Runes',
    prompt: 'Ancient obsidian stone tablet engraved with glowing arcane violet runes',
    style: 'runes',
  },
  {
    label: 'Dragon Scales',
    prompt: 'Overlapping emerald green dragon scales with metallic gold highlights',
    style: 'scales',
  },
  {
    label: 'Forest Moss Ground',
    prompt: 'Lush organic forest moss and lichen ground cover with dark soil',
    style: 'moss',
  },
  {
    label: 'Weathered Stone Decal',
    prompt: 'Cracked stone emblem decal with transparent edges',
    style: 'decal',
  },
];

// Fallback 1x1 PNG data URL for headless environments without canvas context
const FALLBACK_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export class AITextureGenerator {
  private service: MeshEditorService;
  private history: GeneratedTextureItem[] = [];
  private counter = 1;
  public externalImageGenerator: ExternalImageGeneratorService;
  public onHistoryChanged?: (history: GeneratedTextureItem[]) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
    this.externalImageGenerator = new ExternalImageGeneratorService();
  }

  public getHistory(): GeneratedTextureItem[] {
    return [...this.history];
  }

  public getTextureById(id: string): GeneratedTextureItem | undefined {
    return this.history.find((item) => item.id === id || item.name === id || item.embeddedAlbedoName === id);
  }

  public getLatestTexture(): GeneratedTextureItem | undefined {
    return this.history[0];
  }

  public removeTexture(id: string): boolean {
    const idx = this.history.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.history.splice(idx, 1);
    this.onHistoryChanged?.(this.getHistory());
    return true;
  }

  public clearHistory(): void {
    this.history = [];
    this.onHistoryChanged?.([]);
  }

  /**
   * Generates a new texture from a natural language prompt, embeds it in the scene,
   * and optionally applies it to a mesh. Uses an external AI image generator if configured,
   * or falls back to the built-in procedural synthesizer.
   */
  public async generateTexture(options: AITextureGenerationOptions): Promise<GeneratedTextureItem> {
    const prompt = (options.prompt || 'Seamless stone texture').trim();
    const size = this.clampSize(options.size ?? 512);
    const seamless = options.seamless !== false;
    const generateNormal = options.generateNormalMap !== false;

    // Check whether an external AI Image Generator should be used
    const configuredBackend = this.externalImageGenerator.getActiveBackend();
    const explicitBackend = options.backend;
    const shouldUseAI =
      (explicitBackend !== undefined && explicitBackend !== 'procedural') ||
      (options.useAI !== false && (configuredBackend !== 'procedural' || explicitBackend === 'auto' || options.useAI === true));

    if (shouldUseAI) {
      try {
        const targetBackend =
          explicitBackend && explicitBackend !== 'auto' && explicitBackend !== 'procedural'
            ? explicitBackend
            : configuredBackend !== 'procedural'
              ? configuredBackend
              : 'pollinations';

        const genResult = await this.externalImageGenerator.generateImage({
          backend: targetBackend as any,
          prompt,
          size,
          seamless,
          seed: options.seed,
          enhancePrompt: options.enhancePrompt,
        });

        const normalStrength = typeof options.normalStrength === 'number' ? options.normalStrength : 2.2;
        const cleanBaseName = this.sanitizeName(options.name || this.deriveNameFromPrompt(prompt, 'stone'));
        const uniqueName = `${cleanBaseName}_${this.counter++}`;

        // Compute normal map from the generated AI image canvas
        let normalDataUrl: string | undefined;
        let actualWidth = size;
        let actualHeight = size;

        if (generateNormal && typeof document !== 'undefined') {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve) => {
              const timer = setTimeout(() => resolve(), 200);
              img.onload = () => {
                clearTimeout(timer);
                resolve();
              };
              img.onerror = () => {
                clearTimeout(timer);
                resolve();
              };
              img.src = genResult.dataUrl;
            });
            actualWidth = img.naturalWidth || size;
            actualHeight = img.naturalHeight || size;
            const canvas = document.createElement('canvas');
            canvas.width = actualWidth;
            canvas.height = actualHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              normalDataUrl = this.renderNormalMap(canvas, normalStrength);
            }
          } catch {
            normalDataUrl = undefined;
          }
        }

        const item: GeneratedTextureItem = {
          id: `ai_tex_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: uniqueName,
          prompt,
          style: (options.style && options.style !== 'auto' ? options.style : 'stone') as any,
          size: Math.max(actualWidth, actualHeight),
          seed: options.seed ?? 0,
          seamless,
          albedoDataUrl: genResult.dataUrl,
          normalDataUrl,
          roughness: options.roughness ?? 0.7,
          metallic: options.metallic ?? 0.1,
          normalStrength,
          primaryColor: options.primaryColor || '#888888',
          secondaryColor: options.secondaryColor || '#444444',
          accentColor: options.accentColor || '#222222',
          createdAt: Date.now(),
          generatorBackend: genResult.providerId,
          isAI: true,
        };

        if (options.embedInScene !== false) {
          const albedoEmbedName = `${uniqueName}_albedo.png`;
          this.service.addTextureFromDataUrl(albedoEmbedName, genResult.dataUrl);
          item.embeddedAlbedoName = albedoEmbedName;

          if (normalDataUrl) {
            const normalEmbedName = `${uniqueName}_normal.png`;
            this.service.addTextureFromDataUrl(normalEmbedName, normalDataUrl);
            item.embeddedNormalName = normalEmbedName;
          }
        }

        this.history.unshift(item);
        this.onHistoryChanged?.(this.getHistory());

        if (options.applyToMesh) {
          this.applyTextureToMesh(item.id, options.applyToMesh, options.uvScale ?? 1);
        }

        return item;
      } catch (err: any) {
        if (options.fallbackToProcedural === false) {
          throw err;
        }
        console.warn(`External AI generation failed (${err?.message}), falling back to procedural synthesizer.`);
      }
    }

    const recipe = this.analyzePrompt(prompt, options);
    const cleanBaseName = this.sanitizeName(options.name || this.deriveNameFromPrompt(prompt, recipe.style));
    const uniqueName = `${cleanBaseName}_${this.counter++}`;

    // Render Albedo Canvas & Data URL
    const { canvas: albedoCanvas, dataUrl: albedoDataUrl } = this.renderProceduralTexture(size, recipe, seamless);

    // Render Normal Map if enabled
    let normalDataUrl: string | undefined;
    if (generateNormal) {
      normalDataUrl = this.renderNormalMap(albedoCanvas, recipe.normalStrength);
    }

    const item: GeneratedTextureItem = {
      id: `ai_tex_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: uniqueName,
      prompt,
      style: recipe.style,
      size,
      seed: recipe.seed,
      seamless,
      albedoDataUrl,
      normalDataUrl,
      roughness: recipe.roughness,
      metallic: recipe.metallic,
      normalStrength: recipe.normalStrength,
      primaryColor: recipe.primaryHex,
      secondaryColor: recipe.secondaryHex,
      accentColor: recipe.accentHex,
      createdAt: Date.now(),
      generatorBackend: 'procedural',
      isAI: false,
    };

    // Embed in scene texture registry by default so Materials and Decals can use it immediately
    if (options.embedInScene !== false) {
      const albedoEmbedName = `${uniqueName}_albedo.png`;
      this.service.addTextureFromDataUrl(albedoEmbedName, albedoDataUrl);
      item.embeddedAlbedoName = albedoEmbedName;

      if (normalDataUrl) {
        const normalEmbedName = `${uniqueName}_normal.png`;
        this.service.addTextureFromDataUrl(normalEmbedName, normalDataUrl);
        item.embeddedNormalName = normalEmbedName;
      }
    }

    this.history.unshift(item);
    this.onHistoryChanged?.(this.getHistory());

    if (options.applyToMesh) {
      this.applyTextureToMesh(item.id, options.applyToMesh, options.uvScale ?? 1);
    }

    return item;
  }

  /**
   * Imports an external or AI-generated texture image (PNG, JPEG, WebP data URL or image URL),
   * automatically computes its tangent-space normal map, embeds it in the scene, and adds it to history.
   */
  public async addExternalTexture(
    name: string,
    albedoDataUrl: string,
    prompt: string = 'Imported Texture',
    normalStrength: number = 2.2,
  ): Promise<GeneratedTextureItem> {
    const cleanBaseName = this.sanitizeName(name);
    const uniqueName = `${cleanBaseName}_${this.counter++}`;

    let normalDataUrl: string | undefined;
    let width = 512;
    let height = 512;

    if (typeof document !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => resolve(), 200);
          img.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          img.src = albedoDataUrl;
        });

        width = img.naturalWidth || 512;
        height = img.naturalHeight || 512;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          normalDataUrl = this.renderNormalMap(canvas, normalStrength);
        }
      } catch {
        normalDataUrl = undefined;
      }
    }

    const item: GeneratedTextureItem = {
      id: `ai_tex_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: uniqueName,
      prompt,
      style: 'stone',
      size: Math.max(width, height),
      seed: 0,
      seamless: true,
      albedoDataUrl,
      normalDataUrl,
      roughness: 0.7,
      metallic: 0.1,
      normalStrength,
      primaryColor: '#888888',
      secondaryColor: '#444444',
      accentColor: '#222222',
      createdAt: Date.now(),
      embeddedAlbedoName: `${uniqueName}_albedo.png`,
      embeddedNormalName: normalDataUrl ? `${uniqueName}_normal.png` : undefined,
    };

    this.service.addTextureFromDataUrl(item.embeddedAlbedoName, albedoDataUrl);
    if (normalDataUrl && item.embeddedNormalName) {
      this.service.addTextureFromDataUrl(item.embeddedNormalName, normalDataUrl);
    }

    this.history.unshift(item);
    this.onHistoryChanged?.(this.getHistory());
    return item;
  }

  /**
   * Applies a generated texture to a specific mesh, the currently selected mesh, or all scene meshes.
   */
  public applyTextureToMesh(
    textureIdOrName: string,
    targetMeshName: string = 'selected',
    uvScale: number = 1,
  ): { appliedTo: string[]; materialName: string } {
    const item = this.getTextureById(textureIdOrName);
    if (!item) {
      throw new Error(`Generated texture "${textureIdOrName}" not found.`);
    }

    const meshes = this.resolveTargetMeshes(targetMeshName);
    if (meshes.length === 0) {
      throw new Error(
        targetMeshName === 'selected'
          ? 'No mesh selected. Please select a mesh in the scene first or specify a target mesh name.'
          : `Target mesh "${targetMeshName}" not found in scene.`,
      );
    }

    const previousMaterials = meshes.map((m) => ({ mesh: m, material: m.material }));

    const matName = `Mat_${item.name}`;
    let pbr = this.service.scene.getMaterialByName(matName) as PBRMaterial | null;
    if (!pbr || !(pbr instanceof PBRMaterial)) {
      pbr = new PBRMaterial(matName, this.service.scene);
    }

    pbr.albedoColor = Color3.White();
    pbr.roughness = item.roughness;
    pbr.metallic = item.metallic;

    let albedoTex = this.service.scene.textures.find(
      (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === item.albedoDataUrl
    );
    if (!albedoTex) {
      albedoTex = new Texture(
        item.albedoDataUrl,
        this.service.scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE,
        null,
        null,
        item.albedoDataUrl,
        true,
      );
      albedoTex.name = item.embeddedAlbedoName || `${item.name}_albedo.png`;
    }
    albedoTex.uScale = uvScale;
    albedoTex.vScale = uvScale;
    if (item.style === 'decal') {
      albedoTex.hasAlpha = true;
      pbr.useAlphaFromAlbedoTexture = true;
      pbr.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    }
    pbr.albedoTexture = albedoTex;

    if (item.normalDataUrl) {
      let normalTex = this.service.scene.textures.find(
        (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === item.normalDataUrl
      );
      if (!normalTex) {
        normalTex = new Texture(
          item.normalDataUrl,
          this.service.scene,
          false,
          false,
          Texture.TRILINEAR_SAMPLINGMODE,
          null,
          null,
          item.normalDataUrl,
          true,
        );
        normalTex.name = item.embeddedNormalName || `${item.name}_normal.png`;
      }
      normalTex.uScale = uvScale;
      normalTex.vScale = uvScale;
      normalTex.level = Math.max(0.1, Math.min(3.0, item.normalStrength / 2.0));
      pbr.bumpTexture = normalTex;
    }

    const appliedTo: string[] = [];
    for (const mesh of meshes) {
      mesh.material = pbr;
      appliedTo.push(mesh.name);
    }

    const targetMat = pbr;
    this.service.recordAction({
      name: `Apply AI Texture (${item.name})`,
      undo: () => {
        for (const entry of previousMaterials) {
          if (!entry.mesh.isDisposed()) {
            entry.mesh.material = entry.material;
          }
        }
        this.service.events.onSceneModified?.();
      },
      redo: () => {
        for (const entry of previousMaterials) {
          if (!entry.mesh.isDisposed()) {
            entry.mesh.material = targetMat;
          }
        }
        this.service.events.onSceneModified?.();
      },
    });

    this.service.events.onSceneModified?.();
    return { appliedTo, materialName: pbr.name };
  }

  /**
   * Triggers a browser download of the generated texture PNG (albedo or normal map).
   */
  public downloadTexture(textureIdOrName: string, mapType: 'albedo' | 'normal' = 'albedo'): boolean {
    const item = this.getTextureById(textureIdOrName);
    if (!item) return false;

    const dataUrl = mapType === 'normal' ? item.normalDataUrl : item.albedoDataUrl;
    if (!dataUrl || typeof document === 'undefined') return false;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${item.name}_${mapType}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  private resolveTargetMeshes(targetMeshName: string): Mesh[] {
    const validSceneMeshes = this.service.scene.meshes.filter(
      (m): m is Mesh =>
        m instanceof Mesh &&
        m.getTotalVertices() > 0 &&
        !this.service.isEditorHelper(m) &&
        !m.name.startsWith('decal_preview'),
    );

    if (!targetMeshName || targetMeshName === 'selected') {
      const selected = this.service.selectedMesh || this.service.selectedNodes[0] || null;
      if (selected && selected instanceof Mesh && selected.getTotalVertices() > 0) {
        return [selected];
      }
      if (selected) {
        const childMeshes = selected.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
        if (childMeshes.length > 0) return childMeshes;
      }
      return validSceneMeshes.length === 1 ? [validSceneMeshes[0]] : [];
    }

    if (targetMeshName === 'all' || targetMeshName === '*') {
      return validSceneMeshes;
    }

    const exact = validSceneMeshes.find((m) => m.name === targetMeshName);
    if (exact) return [exact];

    const lower = targetMeshName.toLowerCase();
    return validSceneMeshes.filter((m) => m.name.toLowerCase().includes(lower));
  }

  private clampSize(size: number): number {
    if (size <= 256) return 256;
    if (size <= 512) return 512;
    if (size <= 1024) return 1024;
    return 2048;
  }

  private sanitizeName(raw: string): string {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28);
    return cleaned || 'ai_texture';
  }

  private deriveNameFromPrompt(prompt: string, style: string): string {
    const stopWords = new Set(['a', 'an', 'the', 'with', 'and', 'of', 'in', 'on', 'for', 'to', 'texture', 'seamless', 'tileable']);
    const words = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .slice(0, 3);
    if (words.length === 0) return `tex_${style}`;
    return words.join('_');
  }

  public analyzePrompt(prompt: string, options: AITextureGenerationOptions): ResolvedTextureRecipe {
    const lower = prompt.toLowerCase();

    // 1. Determine style
    let style: Exclude<TextureStylePreset, 'auto'> = 'stone';
    if (options.style && options.style !== 'auto') {
      style = options.style;
    } else if (/(decal|sticker|badge|splatter|bullet|emblem|graffiti|stain|crack\s+overlay)/i.test(lower)) {
      style = 'decal';
    } else if (/(cobble|paver|flagstone|dungeon\s+floor|pavement)/i.test(lower)) {
      style = 'cobblestone';
    } else if (/(brick|masonry|terracotta\s+wall)/i.test(lower)) {
      style = 'brick';
    } else if (/(wood|plank|timber|oak|pine|mahogany|bark|birch|walnut|board)/i.test(lower)) {
      style = 'wood';
    } else if (/(lava|magma|volcan|molten|hellfire|ember)/i.test(lower)) {
      style = 'lava';
    } else if (/(scifi|sci-fi|cyber|futur|hull|panel|hex|tech|circuit|neon)/i.test(lower)) {
      style = 'scifi';
    } else if (/(rune|arcane|magic|glyph|sigil|enchant)/i.test(lower)) {
      style = 'runes';
    } else if (/(rust|corrod|oxidiz|weathered\s+iron|scrap)/i.test(lower)) {
      style = 'rust';
    } else if (/(metal|steel|iron|titanium|chrome|aluminum|brass|copper|gold|silver|armor|plate)/i.test(lower)) {
      style = 'metal';
    } else if (/(marble|alabaster|travertine|quartzite|onyx)/i.test(lower)) {
      style = 'marble';
    } else if (/(scale|dragon|reptil|snake|fish\s+scale|chainmail)/i.test(lower)) {
      style = 'scales';
    } else if (/(fabric|cloth|linen|canvas|weave|carpet|velvet|leather|denim)/i.test(lower)) {
      style = 'fabric';
    } else if (/(moss|grass|lichen|jungle|forest\s+floor|turf|foliage|dirt|mud)/i.test(lower)) {
      style = 'moss';
    } else {
      style = 'stone';
    }

    // 2. Default palettes per style
    const defaultPalettes: Record<
      Exclude<TextureStylePreset, 'auto'>,
      { primary: string; secondary: string; accent: string; roughness: number; metallic: number; normalStrength: number }
    > = {
      stone: { primary: '#6e737b', secondary: '#3d4147', accent: '#9aa0a8', roughness: 0.85, metallic: 0.05, normalStrength: 2.2 },
      cobblestone: { primary: '#5e6368', secondary: '#25282c', accent: '#4b6043', roughness: 0.82, metallic: 0.05, normalStrength: 2.8 },
      brick: { primary: '#9c4132', secondary: '#3b3532', accent: '#c4bfb6', roughness: 0.85, metallic: 0.02, normalStrength: 2.5 },
      wood: { primary: '#8b5a2b', secondary: '#4a2e14', accent: '#b87d4b', roughness: 0.68, metallic: 0.0, normalStrength: 1.6 },
      metal: { primary: '#8c969e', secondary: '#495159', accent: '#c4cdd6', roughness: 0.32, metallic: 0.88, normalStrength: 1.5 },
      rust: { primary: '#5a6065', secondary: '#8c3b1b', accent: '#c85a24', roughness: 0.72, metallic: 0.55, normalStrength: 2.4 },
      scifi: { primary: '#2b323b', secondary: '#14181d', accent: '#00e5ff', roughness: 0.35, metallic: 0.8, normalStrength: 2.2 },
      marble: { primary: '#eceae4', secondary: '#b8b4ac', accent: '#6d6a63', roughness: 0.2, metallic: 0.05, normalStrength: 0.9 },
      lava: { primary: '#232023', secondary: '#110f12', accent: '#ff5500', roughness: 0.78, metallic: 0.08, normalStrength: 2.6 },
      moss: { primary: '#3e6b2c', secondary: '#283618', accent: '#6a994e', roughness: 0.9, metallic: 0.0, normalStrength: 2.3 },
      fabric: { primary: '#3d5a80', secondary: '#293241', accent: '#98c1d9', roughness: 0.88, metallic: 0.0, normalStrength: 1.4 },
      scales: { primary: '#2d6a4f', secondary: '#1b4332', accent: '#d4af37', roughness: 0.42, metallic: 0.35, normalStrength: 2.4 },
      runes: { primary: '#2b2836', secondary: '#16141c', accent: '#a855f7', roughness: 0.65, metallic: 0.2, normalStrength: 2.4 },
      decal: { primary: '#4a4e54', secondary: '#22252a', accent: '#d97706', roughness: 0.7, metallic: 0.1, normalStrength: 2.0 },
    };

    const base = { ...defaultPalettes[style] };

    // 3. Override colors from prompt keywords if not explicitly provided
    const keywordColors: Array<{ regex: RegExp; hex: string }> = [
      { regex: /\b(crimson|blood|scarlet)\b/i, hex: '#991b1b' },
      { regex: /\b(red|ruby)\b/i, hex: '#b91c1c' },
      { regex: /\b(orange|amber|copper)\b/i, hex: '#d97706' },
      { regex: /\b(gold|golden|brass|yellow)\b/i, hex: '#d4af37' },
      { regex: /\b(emerald|green|jade|lime)\b/i, hex: '#15803d' },
      { regex: /\b(cyan|turquoise|aqua|ice|frost)\b/i, hex: '#06b6d4' },
      { regex: /\b(blue|sapphire|cobalt|navy|azure)\b/i, hex: '#1d4ed8' },
      { regex: /\b(purple|violet|amethyst|arcane|magenta)\b/i, hex: '#7e22ce' },
      { regex: /\b(pink|rose)\b/i, hex: '#db2777' },
      { regex: /\b(white|snow|ivory|pearl)\b/i, hex: '#f3f4f6' },
      { regex: /\b(black|obsidian|charcoal|ebony|dark)\b/i, hex: '#1f2937' },
      { regex: /\b(sand|desert|sandstone|beige|tan)\b/i, hex: '#d6b37c' },
      { regex: /\b(brown|chocolate|mud|walnut)\b/i, hex: '#6b4226' },
    ];

    const matchedHexes: string[] = [];
    for (const kc of keywordColors) {
      if (kc.regex.test(lower)) {
        matchedHexes.push(kc.hex);
      }
    }

    let primaryHex = options.primaryColor || base.primary;
    let secondaryHex = options.secondaryColor || base.secondary;
    let accentHex = options.accentColor || base.accent;

    if (!options.primaryColor && matchedHexes.length >= 1) {
      if (style === 'lava' || style === 'scifi' || style === 'runes') {
        accentHex = matchedHexes[0];
        if (matchedHexes.length >= 2) primaryHex = matchedHexes[1];
      } else {
        primaryHex = matchedHexes[0];
        if (matchedHexes.length >= 2) accentHex = matchedHexes[1];
      }
    }

    // Material modifiers from prompt
    let roughness = options.roughness ?? base.roughness;
    let metallic = options.metallic ?? base.metallic;
    if (options.roughness === undefined) {
      if (/\b(polished|glossy|shiny|wet|mirror|smooth)\b/i.test(lower)) roughness = Math.max(0.08, roughness - 0.35);
      if (/\b(rough|matte|coarse|weathered|dry|dusty)\b/i.test(lower)) roughness = Math.min(0.98, roughness + 0.15);
    }
    if (options.metallic === undefined) {
      if (/\b(metallic|chrome|gold|silver|steel|iron|brass|copper)\b/i.test(lower)) metallic = Math.max(0.75, metallic);
    }

    const seed = options.seed ?? this.hashPromptToSeed(prompt);
    const normalStrength = options.normalStrength ?? base.normalStrength;

    return {
      style,
      primaryColor: this.hexToRgb(primaryHex),
      secondaryColor: this.hexToRgb(secondaryHex),
      accentColor: this.hexToRgb(accentHex),
      primaryHex,
      secondaryHex,
      accentHex,
      roughness,
      metallic,
      normalStrength,
      scale: 8,
      seed,
      hasAlpha: style === 'decal',
    };
  }

  private hashPromptToSeed(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0) || 1337;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16) || 128,
        parseInt(clean[1] + clean[1], 16) || 128,
        parseInt(clean[2] + clean[2], 16) || 128,
      ];
    }
    const num = parseInt(clean.slice(0, 6), 16);
    if (Number.isNaN(num)) return [128, 128, 128];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // Deterministic 2D hash with periodic wrapping for 100% seamless tiling
  private hash2D(ix: number, iy: number, periodX: number, periodY: number, seed: number): number {
    const wx = ((ix % periodX) + periodX) % periodX;
    const wy = ((iy % periodY) + periodY) % periodY;
    let n = Math.imul(wx, 374761393) + Math.imul(wy, 668265263) + Math.imul(seed, 1442695041);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  private valueNoiseSeamless(u: number, v: number, freq: number, seed: number): number {
    const x = u * freq;
    const y = v * freq;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.hash2D(ix, iy, freq, freq, seed);
    const n10 = this.hash2D(ix + 1, iy, freq, freq, seed);
    const n01 = this.hash2D(ix, iy + 1, freq, freq, seed);
    const n11 = this.hash2D(ix + 1, iy + 1, freq, freq, seed);

    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
  }

  private fbmSeamless(u: number, v: number, baseFreq: number, octaves: number, seed: number): number {
    let total = 0;
    let amp = 0.5;
    let maxAmp = 0;
    let freq = baseFreq;
    for (let i = 0; i < octaves; i++) {
      total += this.valueNoiseSeamless(u, v, freq, seed + i * 101) * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return total / (maxAmp || 1);
  }

  private voronoiSeamless(
    u: number,
    v: number,
    gridCount: number,
    seed: number,
  ): { f1: number; f2: number; edgeDist: number; cellId: number } {
    const gx = u * gridCount;
    const gy = v * gridCount;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);

    let f1 = 10.0;
    let f2 = 10.0;
    let cellId = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const jx = this.hash2D(cx, cy, gridCount, gridCount, seed + 17);
        const jy = this.hash2D(cx, cy, gridCount, gridCount, seed + 53);
        const px = cx + 0.15 + jx * 0.7;
        const py = cy + 0.15 + jy * 0.7;
        const dist = Math.hypot(gx - px, gy - py);
        if (dist < f1) {
          f2 = f1;
          f1 = dist;
          cellId = this.hash2D(cx, cy, gridCount, gridCount, seed + 99);
        } else if (dist < f2) {
          f2 = dist;
        }
      }
    }

    return { f1, f2, edgeDist: f2 - f1, cellId };
  }

  private lerpColor(
    c1: [number, number, number],
    c2: [number, number, number],
    t: number,
  ): [number, number, number] {
    const k = Math.max(0, Math.min(1, t));
    return [
      c1[0] + (c2[0] - c1[0]) * k,
      c1[1] + (c2[1] - c1[1]) * k,
      c1[2] + (c2[2] - c1[2]) * k,
    ];
  }

  private renderProceduralTexture(
    size: number,
    recipe: ResolvedTextureRecipe,
    _seamless: boolean,
  ): { canvas: HTMLCanvasElement | null; dataUrl: string } {
    if (typeof document === 'undefined') {
      return { canvas: null, dataUrl: FALLBACK_PNG_DATA_URL };
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { canvas, dataUrl: FALLBACK_PNG_DATA_URL };
    }

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const { primaryColor, secondaryColor, accentColor, seed, style } = recipe;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;

        let rgb: [number, number, number] = [primaryColor[0], primaryColor[1], primaryColor[2]];
        let alpha = 255;

        const detailNoise = this.fbmSeamless(u, v, 8, 4, seed);
        const microNoise = this.valueNoiseSeamless(u, v, 32, seed + 777) - 0.5;

        switch (style) {
          case 'cobblestone': {
            const warpU = u + (detailNoise - 0.5) * 0.04;
            const warpV = v + (this.fbmSeamless(u, v, 8, 3, seed + 33) - 0.5) * 0.04;
            const vor = this.voronoiSeamless(warpU, warpV, 6, seed);
            const mortarMask = Math.max(0, Math.min(1, (vor.edgeDist - 0.07) / 0.08));
            const stoneShade = 0.75 + vor.cellId * 0.4 + (detailNoise - 0.5) * 0.35;
            const stoneColor: [number, number, number] = [
              primaryColor[0] * stoneShade,
              primaryColor[1] * stoneShade,
              primaryColor[2] * stoneShade,
            ];
            const mortarColor = this.lerpColor(secondaryColor, accentColor, detailNoise * 0.7);
            rgb = this.lerpColor(mortarColor, stoneColor, mortarMask);
            break;
          }

          case 'brick': {
            const rows = 8;
            const cols = 4;
            const row = Math.floor(v * rows);
            const offset = (row % 2) * 0.5;
            const bu = (u * cols + offset) % 1;
            const bv = (v * rows) % 1;
            const warp = (detailNoise - 0.5) * 0.03;
            const edgeX = Math.min(bu + warp, 1 - (bu + warp));
            const edgeY = Math.min(bv + warp, 1 - (bv + warp));
            const mortar = edgeX < 0.045 || edgeY < 0.07 ? 0 : 1;
            const brickId = this.hash2D(Math.floor(u * cols + offset), row, cols, rows, seed);
            const brickBase = this.lerpColor(primaryColor, secondaryColor, brickId * 0.45);
            const brickTextured: [number, number, number] = [
              brickBase[0] * (0.82 + detailNoise * 0.35),
              brickBase[1] * (0.82 + detailNoise * 0.35),
              brickBase[2] * (0.82 + detailNoise * 0.35),
            ];
            rgb = mortar > 0.5 ? brickTextured : this.lerpColor(accentColor, secondaryColor, detailNoise * 0.4);
            break;
          }

          case 'wood': {
            const planks = 4;
            const plankIdx = Math.floor(u * planks);
            const plankU = (u * planks) % 1;
            const plankGap = plankU < 0.02 || plankU > 0.98 ? 0.25 : 1.0;
            const grainShift = this.fbmSeamless(u, v, 4, 3, seed + plankIdx * 19) * 0.25;
            const rings = Math.sin((u * 24 + grainShift * 12 + plankIdx * 1.7) * Math.PI * 2) * 0.5 + 0.5;
            const fineStreak = this.valueNoiseSeamless(u * 4, v * 0.5, 16, seed + 55);
            const t = rings * 0.65 + fineStreak * 0.35;
            const woodCol = this.lerpColor(secondaryColor, primaryColor, t);
            rgb = [woodCol[0] * plankGap, woodCol[1] * plankGap, woodCol[2] * plankGap];
            break;
          }

          case 'scifi': {
            const grid = 4;
            const gu = (u * grid) % 1;
            const gv = (v * grid) % 1;
            const bevelDist = Math.min(gu, 1 - gu, gv, 1 - gv);
            const seam = bevelDist < 0.03;
            const glowSeam = bevelDist >= 0.03 && bevelDist < 0.055 && ((Math.floor(u * grid) + Math.floor(v * grid)) % 2 === 0);
            const panelId = this.hash2D(Math.floor(u * grid), Math.floor(v * grid), grid, grid, seed);
            const panelCol = this.lerpColor(primaryColor, secondaryColor, panelId * 0.5 + detailNoise * 0.2);
            if (glowSeam) {
              rgb = accentColor;
            } else if (seam) {
              rgb = [secondaryColor[0] * 0.4, secondaryColor[1] * 0.4, secondaryColor[2] * 0.4];
            } else {
              rgb = panelCol;
            }
            break;
          }

          case 'rust': {
            const rustMask = Math.max(0, Math.min(1, (detailNoise - 0.42) * 3.2));
            const metalStreak = this.fbmSeamless(u * 2, v * 0.5, 8, 3, seed + 88);
            const baseMetal = this.lerpColor(primaryColor, [primaryColor[0] * 0.6, primaryColor[1] * 0.6, primaryColor[2] * 0.6], metalStreak);
            const rustCol = this.lerpColor(secondaryColor, accentColor, detailNoise);
            rgb = this.lerpColor(baseMetal, rustCol, rustMask);
            break;
          }

          case 'metal': {
            const brushed = this.valueNoiseSeamless(u * 6, v * 0.5, 16, seed) * 0.25 + detailNoise * 0.2;
            rgb = this.lerpColor(secondaryColor, this.lerpColor(primaryColor, accentColor, brushed), 0.6 + brushed);
            break;
          }

          case 'marble': {
            const turb = this.fbmSeamless(u, v, 4, 5, seed);
            const vein = Math.pow(Math.abs(Math.sin((u * 3 + v * 2 + turb * 2.8) * Math.PI)), 0.35);
            rgb = this.lerpColor(accentColor, this.lerpColor(secondaryColor, primaryColor, vein), vein);
            break;
          }

          case 'lava': {
            const warpU = u + (detailNoise - 0.5) * 0.08;
            const warpV = v + (this.fbmSeamless(u, v, 6, 3, seed + 41) - 0.5) * 0.08;
            const vor = this.voronoiSeamless(warpU, warpV, 5, seed);
            const crackGlow = Math.max(0, 1 - vor.edgeDist * 9.0);
            const rockCol = this.lerpColor(secondaryColor, primaryColor, detailNoise);
            const hotCol: [number, number, number] = [
              Math.min(255, accentColor[0] * 1.25),
              Math.min(255, accentColor[1] * (0.6 + crackGlow * 0.6)),
              accentColor[2] * crackGlow,
            ];
            rgb = this.lerpColor(rockCol, hotCol, Math.pow(crackGlow, 1.5));
            break;
          }

          case 'runes': {
            const rockBase = this.lerpColor(secondaryColor, primaryColor, detailNoise);
            const grid = 4;
            const gu = (u * grid) % 1;
            const gv = (v * grid) % 1;
            const cellHash = this.hash2D(Math.floor(u * grid), Math.floor(v * grid), grid, grid, seed);
            const cx = Math.abs(gu - 0.5);
            const cy = Math.abs(gv - 0.5);
            const ring = Math.abs(Math.hypot(gu - 0.5, gv - 0.5) - (0.18 + cellHash * 0.12));
            const glyphStroke =
              (cx < 0.28 && cy < 0.28 && (ring < 0.035 || (Math.abs(cx - cy) < 0.03 && cellHash > 0.3))) ? 1 : 0;
            rgb = glyphStroke > 0 ? accentColor : rockBase;
            break;
          }

          case 'scales': {
            const scaleRows = 8;
            const sy = v * scaleRows;
            const row = Math.floor(sy);
            const sx = (u * scaleRows + (row % 2) * 0.5) % 1;
            const fy = sy % 1;
            const dist = Math.hypot(sx - 0.5, fy * 0.85);
            const edge = Math.max(0, Math.min(1, (0.52 - dist) * 6));
            const highlight = Math.max(0, 1 - Math.abs(dist - 0.38) * 8);
            const baseScale = this.lerpColor(secondaryColor, primaryColor, edge * (0.7 + detailNoise * 0.3));
            rgb = this.lerpColor(baseScale, accentColor, highlight * 0.45);
            break;
          }

          case 'fabric': {
            const weaveFreq = 32;
            const wx = Math.sin(u * weaveFreq * Math.PI * 2);
            const wy = Math.sin(v * weaveFreq * Math.PI * 2);
            const pattern = (wx * wy * 0.5 + 0.5) * 0.35 + detailNoise * 0.35;
            rgb = this.lerpColor(secondaryColor, this.lerpColor(primaryColor, accentColor, pattern), 0.5 + pattern * 0.5);
            break;
          }

          case 'moss': {
            const patch = this.fbmSeamless(u, v, 6, 5, seed);
            const lush = Math.max(0, Math.min(1, (patch - 0.35) * 2.2));
            const soilCol = this.lerpColor(secondaryColor, [secondaryColor[0] * 0.7, secondaryColor[1] * 0.7, secondaryColor[2] * 0.7], detailNoise);
            const mossCol = this.lerpColor(primaryColor, accentColor, this.valueNoiseSeamless(u, v, 24, seed + 12));
            rgb = this.lerpColor(soilCol, mossCol, lush);
            break;
          }

          case 'decal': {
            const dx = u - 0.5;
            const dy = v - 0.5;
            const radial = Math.hypot(dx, dy) * 2.0;
            const ragged = radial + (detailNoise - 0.5) * 0.38;
            if (ragged > 0.88) {
              alpha = 0;
            } else {
              alpha = Math.round(Math.max(0, Math.min(1, (0.88 - ragged) * 5)) * 255);
            }
            const ringAccent = Math.abs(ragged - 0.55) < 0.08 ? 1 : 0;
            const innerBase = this.lerpColor(secondaryColor, primaryColor, detailNoise);
            rgb = ringAccent ? this.lerpColor(innerBase, accentColor, 0.75) : innerBase;
            break;
          }

          case 'stone':
          default: {
            const cracks = this.voronoiSeamless(u, v, 4, seed).edgeDist;
            const crackDarken = Math.max(0.45, Math.min(1, cracks * 6));
            const baseStone = this.lerpColor(secondaryColor, primaryColor, detailNoise);
            const specStone = this.lerpColor(baseStone, accentColor, Math.max(0, (detailNoise - 0.6) * 2));
            rgb = [
              specStone[0] * crackDarken,
              specStone[1] * crackDarken,
              specStone[2] * crackDarken,
            ];
            break;
          }
        }

        data[idx] = Math.max(0, Math.min(255, Math.round(rgb[0] + microNoise * 14)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(rgb[1] + microNoise * 14)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(rgb[2] + microNoise * 14)));
        data[idx + 3] = alpha;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return { canvas, dataUrl: canvas.toDataURL('image/png') };
  }

  private renderNormalMap(sourceCanvas: HTMLCanvasElement | null, strength: number): string {
    if (!sourceCanvas) return FALLBACK_PNG_DATA_URL;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return FALLBACK_PNG_DATA_URL;
    try {
      return generateNormalMapFromCanvas(sourceCanvas, strength);
    } catch {
      return FALLBACK_PNG_DATA_URL;
    }
  }
}
