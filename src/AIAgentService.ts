import {
  Color3,
  Color4,
  CSG,
  CSG2,
  DynamicTexture,
  IsCSG2Ready,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  PBRMaterial,
  Quaternion,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import earcut from 'earcut';
import { MeshEditorService } from './MeshEditorService';
import {
  AIAgentChatMessage,
  AIAgentEndpointConfig,
  AIAgentRequestOptions,
  AIAgentSkillDefinition,
  AIAgentToolExecutionStep,
} from './types';

// Ensure earcut is available globally for Babylon.js PolygonMeshBuilder / ExtrudePolygon
if (typeof globalThis !== 'undefined') {
  (globalThis as any).earcut = earcut;
}

export const AI_AGENT_STORAGE_KEY = 'mesheditor_ai_agent_config';

export const DEFAULT_AI_AGENT_CONFIG: AIAgentEndpointConfig = {
  baseUrl: '/api/antigravity/v1',
  apiKey: '',
  model: 'gemini-3.8-flash-medium',
  temperature: 0.2,
  maxIterations: 12,
};

export interface EndpointPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
}

export const AI_ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: 'antigravity',
    label: 'Antigravity (Local Account)',
    baseUrl: '/api/antigravity/v1',
    defaultModel: 'gemini-3.8-flash-medium',
    requiresKey: false,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    requiresKey: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    requiresKey: true,
  },
  {
    id: 'gemini',
    label: 'Gemini 3 Flash (OpenAI API)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3-flash-preview',
    requiresKey: true,
  },
  {
    id: 'gemini-pro',
    label: 'Gemini 3.1 Pro (OpenAI API)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.1-pro-preview',
    requiresKey: true,
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5-coder:14b',
    requiresKey: false,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    requiresKey: false,
  },
];

/* =========================================================================
   BUILT-IN BABYLON.JS MODELING SKILLS (Adapted from platformia3d/.agents/skills)
   ========================================================================= */
export const BUILT_IN_AGENT_SKILLS: AIAgentSkillDefinition[] = [
  {
    id: 'procedural-modeler',
    name: 'Procedural Modeler (MeshBuilder, CSG2, Extrude, Lathe)',
    description:
      'Guidance for building 3D meshes procedurally using Babylon.js primitives, CSG boolean operations, polygon/path extrusions, lathes, PBR materials, and triplanar UV mapping.',
    enabled: true,
    instructions: `
# Procedural Modeler Skill (Babylon.js Live Scene)

Use this skill whenever requested to create or extend 3D models, assets, or geometries (such as pipes, columns, gears, furniture, swords, vehicles, buildings, or organic/mechanical objects).

## Core Workflow Rules
1. **Think procedurally**: Decompose complex objects into geometric primitives (boxes, cylinders, spheres, cones, capsules, tori, polygons, lathes, tubes).
2. **Coordinate system**: Babylon.js uses a left-handed coordinate system:
   - **Y is up** (height), **X is right** (width), **Z is forward** (depth).
   - Align the base of standing objects to **Y = 0** (Bottom-Aligned: A box with \`height: 2\` stands on ground \`Y = 0\` when \`position.y = 1\`).
3. **Step-by-step workflow**:
   - Inspect scene if updating existing meshes (\`modeler_get_scene_info\`).
   - Create base meshes (\`modeler_create_primitive\`, \`modeler_extrude_polygon\`, \`modeler_extrude_shape\`, \`modeler_create_lathe\`, \`modeler_create_tube\`).
   - Apply materials before or after CSG operations (\`modeler_create_material\`, \`modeler_apply_material\`).
   - Combine or carve shapes using CSG (\`modeler_boolean_operation\`: \`union\`, \`subtract\`, \`intersect\`).
   - Apply \`modeler_auto_uv_mapping\` to CSG or extruded meshes so textures project cleanly.

## Best Practices & Guidelines
1. **Clean up intermediate meshes**:
   - In \`modeler_boolean_operation\`, input meshes are removed by default (\`keepToolMesh: false\`), leaving only the clean CSG result.
   - When using \`modeler_execute_babylon_code\` for complex parametric loops, always dispose temporary intermediate tool meshes.
2. **Multi-materials in CSG & Merge**:
   - If an object needs multiple materials (e.g. wooden walls with a brick roof), apply materials **before** boolean operations or before \`modeler_merge_meshes\`.
   - Do not overwrite a merged multi-material mesh with a single material afterwards.
3. **Extrusions (\`modeler_extrude_polygon\` & \`modeler_extrude_shape\`)**:
   - \`modeler_extrude_polygon\` expects 2D points in the **XZ plane** (\`y: 0\`) clockwise without self-intersection and extrudes along Y. To stand a profile upright, rotate by \`rotationDegrees: { x: -90, y: 0, z: 0 }\`.
   - \`modeler_extrude_shape\` extrudes a 2D profile along a 3D path.
4. **Rotational Bodies (\`modeler_create_lathe\`)**:
   - Ideal for vases, chalices, pillar bases, bottles, chess pieces, domes, or lamp shades. Define profile in the XY plane (\`x >= 0\` radius, \`y\` height).
5. **Metallic & filigree structures**:
   - Use thin cylinders or \`modeler_create_tube\` for railings, frames, pipes, and cables. For realistic metal use \`metallic: 0.8\`, \`roughness: 0.25\`.
`.trim(),
  },
  {
    id: 'voxel-painter',
    name: 'Voxel & Block Modeler (3D Voxel Grids & 2D-to-3D Extrusion)',
    description:
      'Guidance for generating 3D voxel models, blocky characters, pixel-art extrusions, and modular terrain blocks using palette-based voxel runs or box regions.',
    enabled: true,
    instructions: `
# Voxel & Block Modeler Skill

Use this skill when generating voxel models, blocky characters, retro 3D sprites, or converting 2D pixel art into 3D voxel meshes.

## Workflow with \`modeler_build_voxel_mesh\`
1. **Define Palette**:
   - Define named palette entries with hex color, roughness, and metallic (e.g. \`stone: { color: "#7d8491", roughness: 0.85 }\`, \`gold: { color: "#f5c542", metallic: 0.85, roughness: 0.2 }\`, \`wood: { color: "#8b5a2b", roughness: 0.7 }\`).
2. **Efficient Box Regions (\`boxes\`) & Voxel Lists (\`voxels\`)**:
   - Use the \`boxes\` array for solid cuboids/walls/platforms: \`{ minX, minY, minZ, maxX, maxY, maxZ, paletteKey }\`.
   - Add fine details with the \`voxels\` array: \`{ x, y, z, paletteKey }\`.
   - Interior hidden voxels are culled automatically, and solid voxels of the same palette key are merged into optimized multi-material meshes.
3. **2D Image to 3D Voxel Conversion**:
   - Map X (width) and Y (height) of the image, extruding depth along the Z axis (typically 3 to 8 voxels deep).
`.trim(),
  },
  {
    id: 'mesh-updater',
    name: 'Mesh Updater & Scene Sculptor (Text/Image to Mesh Update)',
    description:
      'Guidance for inspecting, modifying, transforming, carving, extending, recoloring, or restructuring existing meshes in the active 3D scene.',
    enabled: true,
    instructions: `
# Mesh Updater & Scene Sculptor Skill

Use this skill when meshes already exist in the scene and the user wants to adapt, extend, repair, recolor, hollow out, or rebuild an existing model ("Text to Mesh Update" / "Image to Mesh Update").

## Rules for Updating Existing Meshes
1. **Check Scene & Selection**:
   - Inspect active meshes via context or \`modeler_get_scene_info\` for exact bounding boxes (\`min\`, \`max\`, \`center\`, \`size\`).
2. **Accurate Placement relative to existing meshes**:
   - Use the bounding box of existing meshes to accurately position additions (e.g. roof on a house, handle on a cup, wheels on a vehicle, battlements on a tower).
3. **Modifying Existing Meshes**:
   - **Transform**: Use \`modeler_transform_mesh\` to move, rotate, scale, rename, snap to ground (\`snapToGround: true\`), or center pivot (\`centerPivot: true\`).
   - **Carve / Bore Holes / Fuse**: Create a cutter tool mesh and call \`modeler_boolean_operation\` (\`subtract\`, \`union\`, \`intersect\`) with the target mesh as \`baseMeshName\`.
   - **Change Material & Texture**: Use \`modeler_create_material\` (including procedural textures: \`wood\`, \`stone\`, \`brick\`, \`marble\`, \`metal\`, etc.) and \`modeler_apply_material\`.
   - **Patterns & Repetition**: Use \`modeler_clone_array\` (\`linear\` or \`radial\`) to repeat parts along an axis or in a circle (pillars, gear teeth, fence posts, stairs).
   - **Separate / Merge**: Use \`modeler_separate_mesh\` to break loose parts into separate meshes or \`modeler_merge_meshes\` to fuse parts.
`.trim(),
  },
  {
    id: 'image-to-mesh',
    name: 'Image to 3D Mesh Vision Analyzer',
    description:
      'Guidance for reconstructing 3D meshes or updating existing 3D models from user-provided reference images or viewport screenshots.',
    enabled: true,
    instructions: `
# Image to 3D Mesh Vision Skill

When a user provides a reference image (concept art, photo, icon, screenshot, or 2D sprite):
1. **Proportional Decomposition**:
   - Analyze main dimensions (width X, height Y, estimated depth Z).
   - Deconstruct visible object into primary shapes, secondary features, and detail trims.
2. **Symmetry & Repetition**:
   - Detect rotational symmetry (use \`modeler_create_lathe\`), mirror symmetry, and radial/linear repetition (\`modeler_clone_array\`).
3. **Colors & Materials**:
   - Extract hex colors and surface properties (\`roughness\`, \`metallic\`, procedural textures) and apply them to parts.
`.trim(),
  },
];

/* =========================================================================
   PROCEDURAL IN-MEMORY TEXTURE GENERATOR
   ========================================================================= */
export type ProceduralTextureType =
  | 'wood'
  | 'stone'
  | 'marble'
  | 'brick'
  | 'metal'
  | 'checker'
  | 'grid'
  | 'noise'
  | 'gradient';

export interface ProceduralTextureOptions {
  type: ProceduralTextureType;
  primaryColor?: string;
  secondaryColor?: string;
  scale?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#888888').replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '8');
  const num = parseInt(full.slice(0, 6), 16) || 0x888888;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Simple deterministic pseudo-random noise helper
function pseudoNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = pseudoNoise(ix, iy);
  const b = pseudoNoise(ix + 1, iy);
  const c = pseudoNoise(ix, iy + 1);
  const d = pseudoNoise(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function generateProceduralTextureDataUrl(opts: ProceduralTextureOptions): string {
  const FALLBACK_1X1_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

  if (typeof document === 'undefined') {
    return FALLBACK_1X1_PNG;
  }

  try {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK_1X1_PNG;

    const defaults: Record<ProceduralTextureType, [string, string]> = {
      wood: ['#8b5a2b', '#5c3a1b'],
      stone: ['#888c94', '#585c64'],
      marble: ['#f0eee9', '#9aa0a8'],
      brick: ['#a64232', '#c8c2b8'],
      metal: ['#9aa2ad', '#626a75'],
      checker: ['#e6edf3', '#2d333b'],
      grid: ['#1f242c', '#58a6ff'],
      noise: ['#999999', '#444444'],
      gradient: ['#58a6ff', '#1f6feb'],
    };

    const [defPrimary, defSecondary] = defaults[opts.type] || ['#cccccc', '#666666'];
    const c1 = hexToRgb(opts.primaryColor || defPrimary);
    const c2 = hexToRgb(opts.secondaryColor || defSecondary);
    const scale = Math.max(0.25, opts.scale || 1.0);

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let t = 0.5;
        const nx = (x / size) * scale;
        const ny = (y / size) * scale;

        switch (opts.type) {
          case 'wood': {
            const n = smoothNoise(nx * 8, ny * 2) * 0.35;
            t = 0.5 + 0.5 * Math.sin((nx * 18 + n * 6) * Math.PI * 2);
            break;
          }
          case 'stone':
          case 'noise': {
            const n1 = smoothNoise(nx * 12, ny * 12) * 0.6;
            const n2 = smoothNoise(nx * 28, ny * 28) * 0.3;
            const n3 = pseudoNoise(x, y) * 0.1;
            t = Math.min(1, Math.max(0, n1 + n2 + n3));
            break;
          }
          case 'marble': {
            const turb =
              smoothNoise(nx * 6, ny * 6) * 0.5 +
              smoothNoise(nx * 12, ny * 12) * 0.25 +
              smoothNoise(nx * 24, ny * 24) * 0.125;
            t = Math.pow(0.5 + 0.5 * Math.sin((nx * 6 + ny * 4 + turb * 5) * Math.PI), 0.65);
            break;
          }
          case 'brick': {
            const rows = Math.round(8 * scale);
            const cols = Math.round(4 * scale);
            const rowH = size / rows;
            const colW = size / cols;
            const rowIdx = Math.floor(y / rowH);
            const offsetX = (rowIdx % 2) * (colW * 0.5);
            const localY = y % rowH;
            const localX = (x + offsetX) % colW;
            const mortar = localY < 3 || localX < 3;
            const n = (smoothNoise(x * 0.15, y * 0.15) - 0.5) * 0.18;
            t = mortar ? 1.0 : Math.min(0.85, Math.max(0, 0.15 + n));
            break;
          }
          case 'metal': {
            const streak = smoothNoise(x * 0.03, y * 0.8) * 0.6 + pseudoNoise(0, y) * 0.25;
            const spec = 0.5 + 0.5 * Math.sin((nx * 2 + ny * 0.5) * Math.PI * 2);
            t = Math.min(1, Math.max(0, streak * 0.6 + spec * 0.4));
            break;
          }
          case 'checker': {
            const cells = Math.max(2, Math.round(8 * scale));
            const cx = Math.floor((x / size) * cells);
            const cy = Math.floor((y / size) * cells);
            t = (cx + cy) % 2 === 0 ? 0 : 1;
            break;
          }
          case 'grid': {
            const cells = Math.max(2, Math.round(8 * scale));
            const cellSize = size / cells;
            const isLine = x % cellSize < 2 || y % cellSize < 2;
            t = isLine ? 1 : 0;
            break;
          }
          case 'gradient':
          default: {
            t = y / (size - 1);
            break;
          }
        }

        const idx = (y * size + x) * 4;
        data[idx] = Math.round(c1[0] * (1 - t) + c2[0] * t);
        data[idx + 1] = Math.round(c1[1] * (1 - t) + c2[1] * t);
        data[idx + 2] = Math.round(c1[2] * (1 - t) + c2[2] * t);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl && dataUrl.startsWith('data:image') ? dataUrl : FALLBACK_1X1_PNG;
  } catch {
    return FALLBACK_1X1_PNG;
  }
}

/* =========================================================================
   AI AGENT SERVICE
   ========================================================================= */
export class AIAgentService {
  public service: MeshEditorService;
  public config: AIAgentEndpointConfig;
  public skills: AIAgentSkillDefinition[];
  public chatHistory: AIAgentChatMessage[] = [];
  private materialRegistry: Map<string, PBRMaterial> = new Map();
  public customFetch: typeof fetch | null = null;

  constructor(
    service: MeshEditorService,
    initialConfig?: Partial<AIAgentEndpointConfig>,
    customFetch?: typeof fetch
  ) {
    this.service = service;
    this.customFetch = customFetch || null;
    this.skills = BUILT_IN_AGENT_SKILLS.map((s) => ({ ...s }));
    this.config = {
      ...DEFAULT_AI_AGENT_CONFIG,
      ...this.loadSavedConfig(),
      ...initialConfig,
    };
  }

  public normalizeModelName(model: string, baseUrl?: string): string {
    let m = (model || DEFAULT_AI_AGENT_CONFIG.model).trim();
    const url = (baseUrl ?? this.config?.baseUrl ?? '').toLowerCase();

    if (url.includes('/api/antigravity') || url.includes('localhost:8787') || url.includes('127.0.0.1:8787')) {
      const lower = m.toLowerCase();
      if (lower === 'gemini-3.8-flash' || lower === 'gemini-3-flash-preview' || lower === 'gemini-3-flash' || lower === 'gemini-2.5-pro') {
        return 'gemini-3.8-flash-medium';
      }
      if (lower === 'gemini-3.1-pro-preview' || lower === 'gemini-4-argon') {
        return 'gemini-4-argon-medium';
      }
      return m;
    }

    if (url.includes('generativelanguage.googleapis.com')) {
      m = m.replace(/^models\//i, '');
      const lower = m.toLowerCase();
      if (lower === 'gemini-2.5-pro') {
        return 'gemini-3-flash-preview';
      }
      if (lower === 'gemini-3.1-pro' || lower === 'gemini-3-pro') {
        return 'gemini-3.1-pro-preview';
      }
      if (
        lower === 'gemini-3-flash' ||
        lower === 'gemini-3.0-flash' ||
        lower === 'gemini-3.8-flash' ||
        lower === 'gemini-flash'
      ) {
        return 'gemini-3-flash-preview';
      }
    }
    return m;
  }

  public loadSavedConfig(): Partial<AIAgentEndpointConfig> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(AI_AGENT_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_AI_AGENT_CONFIG.baseUrl;
      const rawModel = typeof parsed.model === 'string' ? parsed.model : DEFAULT_AI_AGENT_CONFIG.model;
      return {
        baseUrl,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_AGENT_CONFIG.apiKey,
        model: this.normalizeModelName(rawModel, baseUrl),
        temperature:
          typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_AI_AGENT_CONFIG.temperature,
        maxIterations:
          typeof parsed.maxIterations === 'number' ? parsed.maxIterations : DEFAULT_AI_AGENT_CONFIG.maxIterations,
      };
    } catch {
      return {};
    }
  }

  public saveConfig(newConfig: Partial<AIAgentEndpointConfig>): AIAgentEndpointConfig {
    const mergedBaseUrl = newConfig.baseUrl !== undefined ? newConfig.baseUrl : this.config.baseUrl;
    const mergedModel =
      newConfig.model !== undefined
        ? this.normalizeModelName(newConfig.model, mergedBaseUrl)
        : this.normalizeModelName(this.config.model, mergedBaseUrl);

    this.config = {
      ...this.config,
      ...newConfig,
      baseUrl: mergedBaseUrl,
      model: mergedModel,
    };
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(AI_AGENT_STORAGE_KEY, JSON.stringify(this.config));
      } catch (e) {
        console.warn('[AIAgentService] Failed to persist config to localStorage:', e);
      }
    }
    return this.config;
  }

  public getConfig(): AIAgentEndpointConfig {
    return { ...this.config };
  }

  public getSkills(): AIAgentSkillDefinition[] {
    return this.skills;
  }

  public setSkillEnabled(skillId: string, enabled: boolean): void {
    const skill = this.skills.find((s) => s.id === skillId);
    if (skill) {
      skill.enabled = enabled;
    }
  }

  public clearChatHistory(): void {
    this.chatHistory = [];
  }

  /**
   * Resolves the OpenAI-compatible chat completions URL from a user-provided baseUrl.
   */
  public getChatCompletionsUrl(baseUrl?: string): string {
    const raw = (baseUrl ?? this.config.baseUrl ?? DEFAULT_AI_AGENT_CONFIG.baseUrl).trim().replace(/\/+$/, '');
    if (raw.endsWith('/chat/completions')) {
      return raw;
    }
    return `${raw}/chat/completions`;
  }

  /**
   * Resolves the OpenAI-compatible models list URL from a user-provided baseUrl.
   */
  public getModelsUrl(baseUrl?: string): string {
    const raw = (baseUrl ?? this.config.baseUrl ?? DEFAULT_AI_AGENT_CONFIG.baseUrl).trim().replace(/\/+$/, '');
    if (raw.endsWith('/chat/completions')) {
      return raw.replace(/\/chat\/completions$/, '/models');
    }
    if (raw.endsWith('/models')) {
      return raw;
    }
    return `${raw}/models`;
  }

  /**
   * Queries GET {baseUrl}/models to discover available models on the OpenAI-compatible endpoint.
   */
  public async fetchAvailableModels(overrideConfig?: Partial<AIAgentEndpointConfig>): Promise<string[]> {
    const cfg = { ...this.config, ...overrideConfig };
    const url = this.getModelsUrl(cfg.baseUrl);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (cfg.apiKey && cfg.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
    }

    const fetchFn = this.customFetch || globalThis.fetch.bind(globalThis);
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'GET',
        headers,
      });
      if (!res.ok && url.startsWith('/api/antigravity/v1')) {
        res = await fetchFn(url.replace(/^\/api\/antigravity\/v1/, 'http://localhost:8787/v1'), {
          method: 'GET',
          headers,
        });
      }
    } catch (err) {
      if (url.startsWith('/api/antigravity/v1')) {
        res = await fetchFn(url.replace(/^\/api\/antigravity\/v1/, 'http://localhost:8787/v1'), {
          method: 'GET',
          headers,
        });
      } else {
        throw err;
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
    }

    const json = await res.json();
    const list: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    const isGeminiEndpoint = url.toLowerCase().includes('generativelanguage.googleapis.com');
    const ids = list
      .map((item) => {
        const rawId = typeof item === 'string' ? item : item?.id || item?.name || '';
        return isGeminiEndpoint ? String(rawId).replace(/^models\//i, '') : String(rawId);
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    return Array.from(new Set(ids));
  }

  /**
   * Captures a PNG data URL snapshot of the current 3D Babylon canvas for vision-assisted mesh updates.
   */
  public captureViewportDataUrl(): string | null {
    try {
      this.service.scene.render();
      if (this.service.canvas && typeof this.service.canvas.toDataURL === 'function') {
        const dataUrl = this.service.canvas.toDataURL('image/png');
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          return dataUrl;
        }
      }
    } catch (err) {
      console.warn('[AIAgentService] Could not capture canvas screenshot:', err);
    }
    return null;
  }

  /* =========================================================================
     SYSTEM PROMPT & SCENE CONTEXT BUILDER
     ========================================================================= */
  public buildSceneSummary(): Record<string, any> {
    const validMeshes = this.service.importedMeshes.filter(
      (m) => !this.service.isEditorHelper(m) && !m.isDisposed()
    );

    const meshes = validMeshes.map((m) => {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo()?.boundingBox;
      const min = bb?.minimumWorld || Vector3.Zero();
      const max = bb?.maximumWorld || Vector3.Zero();
      const size = max.subtract(min);
      const center = bb?.centerWorld || m.position;
      const rotDeg = this.service.getMeshRotationDegrees(m);
      const mat = m.material;

      let matSummary: Record<string, any> | null = null;
      if (mat instanceof PBRMaterial) {
        matSummary = {
          name: mat.name,
          type: 'PBRMaterial',
          albedoColor: mat.albedoColor?.toHexString?.() || '#ffffff',
          roughness: mat.roughness,
          metallic: mat.metallic,
          alpha: mat.alpha,
        };
      } else if (mat instanceof StandardMaterial) {
        matSummary = {
          name: mat.name,
          type: 'StandardMaterial',
          diffuseColor: mat.diffuseColor?.toHexString?.() || '#ffffff',
          alpha: mat.alpha,
        };
      } else if (mat instanceof MultiMaterial) {
        matSummary = {
          name: mat.name,
          type: 'MultiMaterial',
          subMaterialsCount: mat.subMaterials?.length || 0,
        };
      }

      return {
        name: m.name,
        visible: m.isVisible,
        isSelected: this.service.selectedNodes.includes(m) || this.service.selectedMesh === m,
        parentGroup: m.parent && this.service.isGroupNode(m.parent) ? m.parent.name : null,
        vertices: m.getTotalVertices(),
        triangles: Math.floor(m.getTotalIndices() / 3),
        subMeshesCount: m.subMeshes?.length || 1,
        position: {
          x: Number(m.position.x.toFixed(3)),
          y: Number(m.position.y.toFixed(3)),
          z: Number(m.position.z.toFixed(3)),
        },
        rotationDegrees: {
          x: Number(rotDeg.x.toFixed(1)),
          y: Number(rotDeg.y.toFixed(1)),
          z: Number(rotDeg.z.toFixed(1)),
        },
        scaling: {
          x: Number(m.scaling.x.toFixed(3)),
          y: Number(m.scaling.y.toFixed(3)),
          z: Number(m.scaling.z.toFixed(3)),
        },
        worldBounds: {
          min: { x: Number(min.x.toFixed(3)), y: Number(min.y.toFixed(3)), z: Number(min.z.toFixed(3)) },
          max: { x: Number(max.x.toFixed(3)), y: Number(max.y.toFixed(3)), z: Number(max.z.toFixed(3)) },
          size: { x: Number(size.x.toFixed(3)), y: Number(size.y.toFixed(3)), z: Number(size.z.toFixed(3)) },
          center: { x: Number(center.x.toFixed(3)), y: Number(center.y.toFixed(3)), z: Number(center.z.toFixed(3)) },
        },
        material: matSummary,
      };
    });

    const groups = this.service.groups
      .filter((g) => !g.isDisposed())
      .map((g) => ({
        name: g.name,
        childMeshes: g
          .getChildMeshes()
          .filter((cm) => !this.service.isEditorHelper(cm))
          .map((cm) => cm.name),
      }));

    return {
      totalMeshes: meshes.length,
      selectedMeshNames: this.service.selectedNodes.map((n) => n.name),
      activeMeshName: this.service.selectedMesh?.name || null,
      groups,
      meshes,
    };
  }

  public buildSystemPrompt(): string {
    const activeSkillsText = this.skills
      .filter((s) => s.enabled)
      .map((s) => `--- SKILL: ${s.name} (${s.id}) ---\n${s.instructions}`)
      .join('\n\n');

    const sceneStateJson = JSON.stringify(this.buildSceneSummary(), null, 2);

    return `You are the built-in 3D AI Mesh Agent in **Mesh Editor (Babylon.js 3D Studio)**.
Your mission is to procedurally build high-quality 3D meshes or accurately update existing meshes directly in the active Babylon.js 3D scene from text prompts and/or reference images ("Text-to-Mesh", "Image-to-Mesh", "Text/Image-to-Mesh Update").

You have built-in Babylon.js modeling tools (\`modeler_*\`) and the following built-in skills available:

${activeSkillsText}

## Current 3D Scene State
\`\`\`json
${sceneStateJson}
\`\`\`

## Key Execution Rules
1. **Actively call the provided tools** to create or modify geometry in the scene! Never reply with text alone when the user requests a 3D model or modification.
2. **Descriptive Naming**: Give every created mesh and material a meaningful name (e.g., \`"stone_pillar_base"\`, \`"gear_wheel"\`, \`"oak_wood_mat"\`).
3. **Colors & Materials**: Assign appropriate PBR colors (\`color\` / \`albedoColor\`, \`roughness\`, \`metallic\`) or procedural textures (\`proceduralTexture\` in \`modeler_create_material\`) to each created part so the model looks detailed and polished right away.
4. **Complex Geometries**: For complex, parametric, or multi-loop models (e.g. gears, multi-column temples, stairs, detailed furniture/castles/vehicles), you can either combine multiple tool calls or use \`modeler_execute_babylon_code\`.
5. **Concise Summary at the End**: When all tool calls are completed, explain concisely to the user what you built or updated.`;
  }

  /* =========================================================================
     OPENAI-COMPATIBLE TOOL DEFINITIONS
     ========================================================================= */
  public getOpenAITools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'modeler_get_scene_info',
          description:
            'Returns detailed information about all meshes, groups, materials, selections, and world bounding boxes currently in the 3D scene.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_create_primitive',
          description:
            'Creates a 3D primitive mesh (box, sphere, cylinder, cone, capsule, torus, torusKnot, plane, disc, ground, polyhedron) in the live Babylon.js scene.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Descriptive name for the mesh.' },
              type: {
                type: 'string',
                enum: [
                  'box',
                  'sphere',
                  'cylinder',
                  'cone',
                  'capsule',
                  'torus',
                  'torusKnot',
                  'plane',
                  'disc',
                  'ground',
                  'polyhedron',
                ],
                description: 'Primitive geometry type.',
              },
              options: {
                type: 'object',
                description:
                  'Babylon.js MeshBuilder options: width, height, depth, size, diameter, diameterTop, diameterBottom, thickness, tessellation, segments, subdivisions, polyType (0-4), arc, slice.',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' },
                  depth: { type: 'number' },
                  size: { type: 'number' },
                  diameter: { type: 'number' },
                  diameterTop: { type: 'number' },
                  diameterBottom: { type: 'number' },
                  thickness: { type: 'number' },
                  tessellation: { type: 'number' },
                  segments: { type: 'number' },
                  subdivisions: { type: 'number' },
                  polyType: { type: 'number' },
                  arc: { type: 'number' },
                  slice: { type: 'number' },
                },
              },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotationDegrees: {
                type: 'object',
                description: 'Rotation in degrees { x, y, z }.',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotation: {
                type: 'object',
                description: 'Optional rotation in radians { x, y, z } if rotationDegrees is not used.',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              scaling: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              color: { type: 'string', description: 'Hex color string, e.g. "#4f8cf6".' },
              roughness: { type: 'number', description: 'PBR roughness (0.0 to 1.0).' },
              metallic: { type: 'number', description: 'PBR metallic (0.0 to 1.0).' },
              materialName: {
                type: 'string',
                description: 'Optional name of an existing material created via modeler_create_material.',
              },
            },
            required: ['type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_extrude_polygon',
          description:
            'Extrudes a 2D polygon contour (defined in the XZ plane with y=0) along the Y axis by depth, supporting optional interior holes.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              shape: {
                type: 'array',
                description: 'Array of contour points { x, y: 0, z } in the XZ plane.',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                  required: ['x', 'z'],
                },
              },
              depth: { type: 'number', description: 'Extrusion depth along Y.' },
              holes: {
                type: 'array',
                description: 'Optional array of holes, where each hole is an array of { x, y: 0, z } points.',
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                  },
                },
              },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotationDegrees: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotation: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              color: { type: 'string' },
              roughness: { type: 'number' },
              metallic: { type: 'number' },
              materialName: { type: 'string' },
            },
            required: ['shape', 'depth'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_extrude_shape',
          description:
            'Extrudes a 2D profile shape (defined in the XY plane with z=0) along a 3D path of Vector3 points.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              shape: {
                type: 'array',
                description: '2D profile points { x, y, z: 0 }.',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                },
              },
              path: {
                type: 'array',
                description: '3D path points { x, y, z } along which the shape is extruded.',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                },
              },
              scale: { type: 'number', description: 'Scale factor along the path (default 1).' },
              rotation: { type: 'number', description: 'Twist rotation step in radians along the path (default 0).' },
              cap: { type: 'number', description: '0: No cap, 1: Cap start, 2: Cap end, 3: Cap both (default 3).' },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotationDegrees: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              color: { type: 'string' },
              roughness: { type: 'number' },
              metallic: { type: 'number' },
              materialName: { type: 'string' },
            },
            required: ['shape', 'path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_create_lathe',
          description:
            'Creates a rotationally symmetric 3D mesh (vase, goblet, pillar, bottle, chess piece, dome, wheel) by revolving a 2D profile in the XY plane (x >= 0 as radius, y as height) around the Y axis.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              shape: {
                type: 'array',
                description: 'Profile points { x, y, z: 0 } where x is radius from center and y is height.',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                  required: ['x', 'y'],
                },
              },
              radius: { type: 'number', description: 'Overall radius multiplier (default 1).' },
              tessellation: { type: 'number', description: 'Radial segments around Y axis (default 32).' },
              arc: { type: 'number', description: 'Portion of circumference 0.0 to 1.0 (default 1.0).' },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotationDegrees: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              color: { type: 'string' },
              roughness: { type: 'number' },
              metallic: { type: 'number' },
              materialName: { type: 'string' },
            },
            required: ['shape'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_create_tube',
          description: 'Creates a cylindrical tube, pipe, cable, horn, or curved rail along a 3D path of points.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: {
                type: 'array',
                description: 'Array of 3D points { x, y, z } defining the tube centerline.',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
                  required: ['x', 'y', 'z'],
                },
              },
              radius: { type: 'number', description: 'Tube radius (default 0.2).' },
              tessellation: { type: 'number', description: 'Radial segments (default 24).' },
              cap: { type: 'number', description: '0: No cap, 1: Start, 2: End, 3: Both (default 3).' },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              rotationDegrees: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              color: { type: 'string' },
              roughness: { type: 'number' },
              metallic: { type: 'number' },
              materialName: { type: 'string' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_boolean_operation',
          description:
            'Performs a CSG (Constructive Solid Geometry) boolean operation (union, subtract, intersect) between baseMeshName and toolMeshName.',
          parameters: {
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['union', 'subtract', 'intersect'] },
              baseMeshName: {
                type: 'string',
                description: 'Name (or ID) of the base/target mesh in the scene.',
              },
              toolMeshName: {
                type: 'string',
                description: 'Name (or ID) of the tool/cutter mesh in the scene.',
              },
              newName: {
                type: 'string',
                description: 'Optional name for the resulting mesh.',
              },
              keepToolMesh: {
                type: 'boolean',
                description: 'If true, keeps the tool mesh in the scene instead of disposing it (default false).',
              },
            },
            required: ['operation', 'baseMeshName', 'toolMeshName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_create_material',
          description:
            'Creates or updates a PBRMaterial with color, roughness, metallic, emissiveColor, alpha, and optional procedural texture (wood, stone, marble, brick, metal, checker, grid, noise, gradient).',
          parameters: {
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
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_apply_material',
          description: 'Applies a created material (or inline color/PBR settings) to one or more meshes by name.',
          parameters: {
            type: 'object',
            properties: {
              meshName: {
                type: 'string',
                description: 'Target mesh name (or comma-separated names, or "*" for all meshes).',
              },
              materialName: {
                type: 'string',
                description: 'Name of the material created with modeler_create_material.',
              },
              albedoColor: { type: 'string', description: 'Optional direct hex color if creating inline material.' },
              roughness: { type: 'number' },
              metallic: { type: 'number' },
              alpha: { type: 'number' },
            },
            required: ['meshName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_auto_uv_mapping',
          description:
            'Applies automatic box/triplanar UV mapping (or planar projection) to a mesh so textures tile cleanly after CSG or extrusions without breaking subMeshes.',
          parameters: {
            type: 'object',
            properties: {
              meshName: { type: 'string', description: 'Name of the mesh (or "*" for all meshes).' },
              projection: {
                type: 'string',
                enum: ['triplanar', 'top', 'front', 'side'],
                description: 'Projection mode (default "triplanar").',
              },
              scale: { type: 'number', description: 'UV tiling scale factor (default 1.0).' },
            },
            required: ['meshName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_transform_mesh',
          description:
            'Updates an existing mesh in the scene: position, rotationDegrees, scaling, name, visibility, snapToGround, centerPivot, or bakeTransform.',
          parameters: {
            type: 'object',
            properties: {
              meshName: { type: 'string', description: 'Name of the existing mesh to update.' },
              newName: { type: 'string', description: 'Optional new name for the mesh.' },
              position: {
                type: 'object',
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
              visible: { type: 'boolean' },
              snapToGround: {
                type: 'boolean',
                description: 'If true, shifts the mesh vertically so its lowest point sits on Y=0.',
              },
              centerPivot: {
                type: 'boolean',
                description: 'If true, centers the mesh pivot to its visual bounding box center.',
              },
              bakeTransform: {
                type: 'boolean',
                description: 'If true, bakes current position/rotation/scale into vertex coordinates.',
              },
            },
            required: ['meshName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_clone_array',
          description:
            'Clones an existing mesh in a linear or radial array pattern (e.g. pillars, gear teeth, stairs, fence posts, windows) and optionally merges them.',
          parameters: {
            type: 'object',
            properties: {
              sourceMeshName: { type: 'string', description: 'Name of the mesh to clone.' },
              mode: { type: 'string', enum: ['linear', 'radial'], description: 'Array pattern mode.' },
              count: { type: 'number', description: 'Total number of items in the array (2 to 64).' },
              offset: {
                type: 'object',
                description: 'For linear mode: step offset { x, y, z } between each clone.',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              radius: {
                type: 'number',
                description: 'For radial mode: distance from center in the XZ plane.',
              },
              center: {
                type: 'object',
                description: 'For radial mode: center point { x, y, z } (default {0,0,0}).',
                properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
              },
              arcDegrees: {
                type: 'number',
                description: 'For radial mode: total angle span in degrees (default 360).',
              },
              rotateWithAngle: {
                type: 'boolean',
                description: 'For radial mode: rotate each clone around Y to face outward/inward (default true).',
              },
              mergeResult: {
                type: 'boolean',
                description: 'If true, merges all clones (and source) into a single mesh.',
              },
              mergedName: { type: 'string' },
            },
            required: ['sourceMeshName', 'mode', 'count'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_merge_meshes',
          description:
            'Merges multiple meshes into a single combined mesh while preserving their individual materials as subMeshes.',
          parameters: {
            type: 'object',
            properties: {
              meshNames: {
                type: 'array',
                items: { type: 'string' },
                description: 'Names of the meshes to merge (or ["*"] to merge all scene meshes).',
              },
              newName: { type: 'string', description: 'Name for the merged mesh.' },
              disposeSources: {
                type: 'boolean',
                description: 'Whether to remove the original source meshes after merging (default true).',
              },
            },
            required: ['meshNames'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_separate_mesh',
          description:
            'Separates a mesh into disconnected loose parts or splits it by subMeshes so individual components can be edited separately.',
          parameters: {
            type: 'object',
            properties: {
              meshName: { type: 'string' },
              mode: {
                type: 'string',
                enum: ['loose_parts', 'submeshes'],
                description: 'Separation mode (default "loose_parts").',
              },
            },
            required: ['meshName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_delete_mesh',
          description: 'Deletes one or more meshes from the scene by name.',
          parameters: {
            type: 'object',
            properties: {
              meshNames: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of mesh names to delete.',
              },
            },
            required: ['meshNames'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_build_voxel_mesh',
          description:
            'Builds a 3D voxel model from a material palette, box regions, and/or individual voxel coordinates, automatically merging blocks by material.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the resulting voxel mesh.' },
              voxelSize: { type: 'number', description: 'World size of 1 voxel cube (default 0.5).' },
              palette: {
                type: 'object',
                description:
                  'Map of paletteKey -> { color: "#hex", roughness?: number, metallic?: number } (e.g. { "stone": { "color": "#888888" } }).',
              },
              boxes: {
                type: 'array',
                description:
                  'Filled rectangular box regions of voxels: { minX, minY, minZ, maxX, maxY, maxZ, paletteKey }.',
                items: {
                  type: 'object',
                  properties: {
                    minX: { type: 'number' },
                    minY: { type: 'number' },
                    minZ: { type: 'number' },
                    maxX: { type: 'number' },
                    maxY: { type: 'number' },
                    maxZ: { type: 'number' },
                    paletteKey: { type: 'string' },
                  },
                  required: ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ', 'paletteKey'],
                },
              },
              voxels: {
                type: 'array',
                description: 'Individual voxel coordinates: { x, y, z, paletteKey }.',
                items: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' },
                    paletteKey: { type: 'string' },
                  },
                  required: ['x', 'y', 'z', 'paletteKey'],
                },
              },
            },
            required: ['name', 'palette'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'modeler_execute_babylon_code',
          description:
            'Executes custom procedural Babylon.js JavaScript code directly against the live scene. Ideal for complex parametric models with loops, math curves, CSG2 chains, or custom VertexData.',
          parameters: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Short summary of what this script builds or updates.' },
              code: {
                type: 'string',
                description:
                  'JavaScript function body (supports async/await). Available variables in scope: scene, service, MeshBuilder, Mesh, Vector3, Color3, Color4, Quaternion, Matrix, PBRMaterial, StandardMaterial, MultiMaterial, Texture, DynamicTexture, VertexData, VertexBuffer, CSG, CSG2, earcut, registerMesh(mesh), createMaterial(name, hexColor, roughness, metallic), autoUV(mesh, scale), booleanOp(baseMesh, toolMesh, op, newName, keepTool). Return a summary string or created mesh(es).',
              },
            },
            required: ['code'],
          },
        },
      },
    ];
  }

  /* =========================================================================
     TOOL EXECUTION ENGINE
     ========================================================================= */
  private findMeshByNameOrId(identifier: string): Mesh | undefined {
    if (!identifier) return undefined;
    const clean = identifier.trim();
    const valid = this.service.importedMeshes.filter((m) => !this.service.isEditorHelper(m) && !m.isDisposed());
    let found = valid.find((m) => m.name === clean);
    if (!found) {
      found = valid.find((m) => m.name.toLowerCase() === clean.toLowerCase());
    }
    if (!found) {
      found = valid.find((m) => m.name.toLowerCase().includes(clean.toLowerCase()));
    }
    return found;
  }

  private getOrCreateMaterial(
    materialName?: string,
    colorHex?: string,
    roughness?: number,
    metallic?: number,
    fallbackName: string = 'Mat'
  ): PBRMaterial {
    if (materialName) {
      const existing =
        this.materialRegistry.get(materialName) ||
        (this.service.scene.materials.find(
          (m) => m instanceof PBRMaterial && m.name.toLowerCase() === materialName.toLowerCase()
        ) as PBRMaterial | undefined);
      if (existing) {
        if (colorHex) existing.albedoColor = Color3.FromHexString(this.normalizeHex(colorHex));
        if (roughness !== undefined) existing.roughness = roughness;
        if (metallic !== undefined) existing.metallic = metallic;
        return existing;
      }
    }

    const name = materialName || `${fallbackName}_mat_${Date.now().toString().slice(-4)}`;
    const mat = new PBRMaterial(name, this.service.scene);
    mat.albedoColor = Color3.FromHexString(this.normalizeHex(colorHex || '#58a6ff'));
    mat.roughness = roughness !== undefined ? roughness : 0.45;
    mat.metallic = metallic !== undefined ? metallic : 0.1;
    mat.backFaceCulling = false;
    this.materialRegistry.set(name, mat);
    return mat;
  }

  private normalizeHex(hex: string): string {
    if (!hex || typeof hex !== 'string') return '#58a6ff';
    const trimmed = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      return (
        '#' +
        trimmed
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      );
    }
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return '#' + trimmed;
    return '#58a6ff';
  }

  private parseVec3(v: any, defaultVal: number = 0): Vector3 {
    if (Array.isArray(v)) {
      return new Vector3(
        Number(v[0] ?? defaultVal) || 0,
        Number(v[1] ?? defaultVal) || 0,
        Number(v[2] ?? defaultVal) || 0
      );
    }
    return new Vector3(
      Number(v?.x ?? defaultVal) || 0,
      Number(v?.y ?? defaultVal) || 0,
      Number(v?.z ?? defaultVal) || 0
    );
  }

  private parsePolygonPoint(p: any): Vector3 {
    if (Array.isArray(p)) {
      if (p.length === 2) {
        return new Vector3(Number(p[0]) || 0, 0, Number(p[1]) || 0);
      }
      return new Vector3(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0);
    }
    return new Vector3(Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0);
  }

  private applyTransformArgs(mesh: Mesh, args: any): void {
    if (args.position) {
      mesh.position.copyFrom(this.parseVec3(args.position, 0));
    }
    if (args.rotationDegrees) {
      mesh.rotationQuaternion = null;
      const deg = this.parseVec3(args.rotationDegrees, 0);
      mesh.rotation.set(
        (deg.x * Math.PI) / 180,
        (deg.y * Math.PI) / 180,
        (deg.z * Math.PI) / 180
      );
    } else if (args.rotation && typeof args.rotation === 'object') {
      mesh.rotationQuaternion = null;
      mesh.rotation.copyFrom(this.parseVec3(args.rotation, 0));
    } else if (args.meshRotation && typeof args.meshRotation === 'object') {
      mesh.rotationQuaternion = null;
      mesh.rotation.copyFrom(this.parseVec3(args.meshRotation, 0));
    }
    if (args.scaling) {
      const sc = Array.isArray(args.scaling)
        ? new Vector3(
            Number(args.scaling[0] ?? 1) || 1,
            Number(args.scaling[1] ?? 1) || 1,
            Number(args.scaling[2] ?? 1) || 1
          )
        : new Vector3(
            Number(args.scaling.x ?? 1) || 1,
            Number(args.scaling.y ?? 1) || 1,
            Number(args.scaling.z ?? 1) || 1
          );
      mesh.scaling.copyFrom(sc);
    }
    mesh.computeWorldMatrix(true);
  }

  private registerCreatedMesh(mesh: Mesh): void {
    mesh.isPickable = true;
    if (mesh.material) {
      mesh.material.backFaceCulling = false;
    }
    if (!this.service.importedMeshes.includes(mesh)) {
      this.service.importedMeshes.push(mesh);
    }
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
  }

  public async executeToolCall(toolName: string, rawArgs: any): Promise<string> {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
    const scene = this.service.scene;

    switch (toolName) {
      case 'modeler_get_scene_info': {
        return JSON.stringify(this.buildSceneSummary());
      }

      case 'modeler_create_primitive': {
        const type = String(args.type || args.shape || 'box').toLowerCase();
        const opts = { ...args, ...(args.options || {}) };
        const baseName = (args.name || type).replace(/\s+/g, '_');
        const uniqueName = this. findMeshByNameOrId(baseName)
          ? `${baseName}_${Date.now().toString().slice(-4)}`
          : baseName;

        let mesh: Mesh;
        switch (type) {
          case 'sphere':
            mesh = MeshBuilder.CreateSphere(
              uniqueName,
              {
                diameter: opts.diameter ?? opts.size ?? 1,
                diameterX: opts.width,
                diameterY: opts.height,
                diameterZ: opts.depth,
                segments: opts.segments ?? opts.tessellation ?? 24,
                arc: opts.arc,
                slice: opts.slice,
              },
              scene
            );
            break;
          case 'cylinder':
            mesh = MeshBuilder.CreateCylinder(
              uniqueName,
              {
                height: opts.height ?? 2,
                diameter: opts.diameter ?? opts.size ?? 1,
                diameterTop: opts.diameterTop,
                diameterBottom: opts.diameterBottom,
                tessellation: opts.tessellation ?? opts.segments ?? 24,
                arc: opts.arc,
              },
              scene
            );
            break;
          case 'cone':
            mesh = MeshBuilder.CreateCylinder(
              uniqueName,
              {
                height: opts.height ?? 2,
                diameterTop: opts.diameterTop ?? 0,
                diameterBottom: opts.diameterBottom ?? opts.diameter ?? opts.size ?? 1,
                tessellation: opts.tessellation ?? 24,
              },
              scene
            );
            break;
          case 'capsule':
            mesh = MeshBuilder.CreateCapsule(
              uniqueName,
              {
                height: opts.height ?? 2,
                radius: (opts.diameter ?? opts.size ?? 1) * 0.5,
                tessellation: opts.tessellation ?? 24,
              },
              scene
            );
            break;
          case 'torus':
            mesh = MeshBuilder.CreateTorus(
              uniqueName,
              {
                diameter: opts.diameter ?? opts.size ?? 1,
                thickness: opts.thickness ?? (opts.diameter ?? 1) * 0.25,
                tessellation: opts.tessellation ?? 32,
              },
              scene
            );
            break;
          case 'torusknot':
            mesh = MeshBuilder.CreateTorusKnot(
              uniqueName,
              {
                radius: (opts.diameter ?? opts.size ?? 1) * 0.4,
                tube: opts.thickness ?? 0.12,
                radialSegments: opts.tessellation ?? 64,
              },
              scene
            );
            break;
          case 'plane':
            mesh = MeshBuilder.CreatePlane(
              uniqueName,
              {
                width: opts.width ?? opts.size ?? 1,
                height: opts.height ?? opts.size ?? 1,
              },
              scene
            );
            break;
          case 'disc':
            mesh = MeshBuilder.CreateDisc(
              uniqueName,
              {
                radius: (opts.diameter ?? opts.size ?? 1) * 0.5,
                tessellation: opts.tessellation ?? 32,
              },
              scene
            );
            break;
          case 'ground':
            mesh = MeshBuilder.CreateGround(
              uniqueName,
              {
                width: opts.width ?? opts.size ?? 4,
                height: opts.depth ?? opts.height ?? opts.size ?? 4,
                subdivisions: opts.subdivisions ?? 4,
              },
              scene
            );
            break;
          case 'polyhedron':
            mesh = MeshBuilder.CreatePolyhedron(
              uniqueName,
              {
                type: opts.polyType ?? 1,
                size: (opts.size ?? opts.diameter ?? 1) * 0.5,
              },
              scene
            );
            break;
          case 'box':
          default:
            mesh = MeshBuilder.CreateBox(
              uniqueName,
              {
                width: opts.width ?? opts.size ?? 1,
                height: opts.height ?? opts.size ?? 1,
                depth: opts.depth ?? opts.size ?? 1,
              },
              scene
            );
            break;
        }

        mesh.material = this.getOrCreateMaterial(
          args.materialName,
          args.color,
          args.roughness,
          args.metallic,
          uniqueName
        );
        this.applyTransformArgs(mesh, args);
        this.registerCreatedMesh(mesh);

        const bb = mesh.getBoundingInfo().boundingBox;
        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          bounds: {
            min: { x: Number(bb.minimumWorld.x.toFixed(3)), y: Number(bb.minimumWorld.y.toFixed(3)), z: Number(bb.minimumWorld.z.toFixed(3)) },
            max: { x: Number(bb.maximumWorld.x.toFixed(3)), y: Number(bb.maximumWorld.y.toFixed(3)), z: Number(bb.maximumWorld.z.toFixed(3)) },
          },
        });
      }

      case 'modeler_extrude_polygon': {
        const baseName = (args.name || 'extruded_polygon').replace(/\s+/g, '_');
        const uniqueName = this.findMeshByNameOrId(baseName)
          ? `${baseName}_${Date.now().toString().slice(-4)}`
          : baseName;

        const shape = (args.shape || []).map((p: any) => this.parsePolygonPoint(p));
        const holes = Array.isArray(args.holes)
          ? args.holes.map((h: any[]) => h.map((p: any) => this.parsePolygonPoint(p)))
          : undefined;
        const depth = Math.max(0.01, Number(args.depth) || 1);

        const mesh = MeshBuilder.ExtrudePolygon(
          uniqueName,
          {
            shape,
            depth,
            holes,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene,
          earcut
        );

        mesh.material = this.getOrCreateMaterial(
          args.materialName,
          args.color,
          args.roughness,
          args.metallic,
          uniqueName
        );
        this.applyTransformArgs(mesh, args);
        this.registerCreatedMesh(mesh);

        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          vertices: mesh.getTotalVertices(),
        });
      }

      case 'modeler_extrude_shape': {
        const baseName = (args.name || 'extruded_shape').replace(/\s+/g, '_');
        const uniqueName = this.findMeshByNameOrId(baseName)
          ? `${baseName}_${Date.now().toString().slice(-4)}`
          : baseName;

        const shape = (args.shape || []).map((p: any) => this.parseVec3(p, 0));
        const path = (args.path || []).map((p: any) => this.parseVec3(p, 0));

        const mesh = MeshBuilder.ExtrudeShape(
          uniqueName,
          {
            shape,
            path,
            scale: args.scale !== undefined ? Number(args.scale) : 1,
            rotation: args.rotation !== undefined && typeof args.rotation === 'number' ? args.rotation : 0,
            cap: args.cap !== undefined ? Number(args.cap) : Mesh.CAP_ALL,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene
        );

        mesh.material = this.getOrCreateMaterial(
          args.materialName,
          args.color,
          args.roughness,
          args.metallic,
          uniqueName
        );
        this.applyTransformArgs(mesh, args);
        this.registerCreatedMesh(mesh);

        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          vertices: mesh.getTotalVertices(),
        });
      }

      case 'modeler_create_lathe': {
        const baseName = (args.name || 'lathe_mesh').replace(/\s+/g, '_');
        const uniqueName = this.findMeshByNameOrId(baseName)
          ? `${baseName}_${Date.now().toString().slice(-4)}`
          : baseName;

        const shape = (args.shape || []).map((p: any) => this.parseVec3(p, 0));

        const mesh = MeshBuilder.CreateLathe(
          uniqueName,
          {
            shape,
            radius: args.radius !== undefined ? Number(args.radius) : 1,
            tessellation: args.tessellation !== undefined ? Number(args.tessellation) : 32,
            arc: args.arc !== undefined ? Number(args.arc) : 1,
            cap: Mesh.CAP_ALL,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene
        );

        mesh.material = this.getOrCreateMaterial(
          args.materialName,
          args.color,
          args.roughness,
          args.metallic,
          uniqueName
        );
        this.applyTransformArgs(mesh, args);
        this.registerCreatedMesh(mesh);

        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          vertices: mesh.getTotalVertices(),
        });
      }

      case 'modeler_create_tube': {
        const baseName = (args.name || 'tube_mesh').replace(/\s+/g, '_');
        const uniqueName = this.findMeshByNameOrId(baseName)
          ? `${baseName}_${Date.now().toString().slice(-4)}`
          : baseName;

        const path = (args.path || []).map((p: any) => this.parseVec3(p, 0));

        const mesh = MeshBuilder.CreateTube(
          uniqueName,
          {
            path,
            radius: args.radius !== undefined ? Number(args.radius) : 0.2,
            tessellation: args.tessellation !== undefined ? Number(args.tessellation) : 24,
            cap: args.cap !== undefined ? Number(args.cap) : Mesh.CAP_ALL,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          scene
        );

        mesh.material = this.getOrCreateMaterial(
          args.materialName,
          args.color,
          args.roughness,
          args.metallic,
          uniqueName
        );
        this.applyTransformArgs(mesh, args);
        this.registerCreatedMesh(mesh);

        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          vertices: mesh.getTotalVertices(),
        });
      }

      case 'modeler_boolean_operation': {
        const baseId = args.baseMeshName || args.baseMeshId;
        const toolId = args.toolMeshName || args.toolMeshId;
        const op = (args.operation || 'subtract') as 'union' | 'subtract' | 'intersect';
        const keepTool = !!args.keepToolMesh;

        const baseMesh = this.findMeshByNameOrId(baseId);
        const toolMesh = this.findMeshByNameOrId(toolId);

        if (!baseMesh) {
          throw new Error(`Base mesh "${baseId}" not found in scene.`);
        }
        if (!toolMesh) {
          throw new Error(`Tool mesh "${toolId}" not found in scene.`);
        }

        const resultMesh = await this.service.performCSGOperation(baseMesh, toolMesh, op, keepTool);
        if (!resultMesh) {
          throw new Error(`CSG ${op} failed between "${baseMesh.name}" and "${toolMesh.name}".`);
        }

        if (args.newName && typeof args.newName === 'string') {
          resultMesh.name = args.newName.replace(/\s+/g, '_');
        }

        return JSON.stringify({
          status: 'ok',
          operation: op,
          resultMeshName: resultMesh.name,
          vertices: resultMesh.getTotalVertices(),
        });
      }

      case 'modeler_create_material': {
        const matName = (args.materialName || `Mat_${Date.now().toString().slice(-4)}`).trim();
        let mat = this.materialRegistry.get(matName);
        if (!mat || !scene.materials.includes(mat)) {
          mat = new PBRMaterial(matName, scene);
          this.materialRegistry.set(matName, mat);
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
            const tex = new Texture(dataUrl, scene, false, false);
            tex.name = `${matName}_${proc.type}.png`;
            tex.uScale = proc.uScale !== undefined ? Number(proc.uScale) : args.uScale !== undefined ? Number(args.uScale) : 1;
            tex.vScale = proc.vScale !== undefined ? Number(proc.vScale) : args.vScale !== undefined ? Number(args.vScale) : 1;
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

      case 'modeler_apply_material': {
        const meshTarget = String(args.meshName || args.meshId || '');
        const matName = args.materialName || args.materialId;

        const targetMeshes =
          meshTarget === '*'
            ? this.service.importedMeshes.filter((m) => !this.service.isEditorHelper(m) && !m.isDisposed())
            : meshTarget
                .split(',')
                .map((n) => this.findMeshByNameOrId(n.trim()))
                .filter((m): m is Mesh => !!m);

        if (targetMeshes.length === 0) {
          throw new Error(`No mesh matching "${meshTarget}" found.`);
        }

        const mat = this.getOrCreateMaterial(
          matName,
          args.albedoColor,
          args.roughness,
          args.metallic,
          targetMeshes[0].name
        );
        if (args.alpha !== undefined) {
          mat.alpha = Number(args.alpha);
        }

        for (const m of targetMeshes) {
          m.material = mat;
        }

        return JSON.stringify({
          status: 'ok',
          appliedTo: targetMeshes.map((m) => m.name),
          materialName: mat.name,
        });
      }

      case 'modeler_auto_uv_mapping': {
        const meshTarget = String(args.meshName || args.meshId || '*');
        const projection = args.projection || 'triplanar';
        const scale = args.scale !== undefined ? Number(args.scale) : 1.0;

        const targets =
          meshTarget === '*'
            ? this.service.importedMeshes.filter((m) => !this.service.isEditorHelper(m) && !m.isDisposed())
            : [this.findMeshByNameOrId(meshTarget)].filter((m): m is Mesh => !!m);

        if (targets.length === 0) {
          throw new Error(`Mesh "${meshTarget}" not found for UV mapping.`);
        }

        const prevSelected = this.service.selectedMesh;
        for (const m of targets) {
          this.service.selectedMesh = m;
          if (projection === 'top' || projection === 'front' || projection === 'side') {
            this.service.applyPlanarUVs(projection, scale);
          } else {
            this.service.applyTriplanarUVs(scale);
          }
        }
        this.service.selectedMesh = prevSelected;

        return JSON.stringify({
          status: 'ok',
          mappedMeshes: targets.map((m) => m.name),
          projection,
        });
      }

      case 'modeler_transform_mesh': {
        const mesh = this.findMeshByNameOrId(args.meshName);
        if (!mesh) {
          throw new Error(`Mesh "${args.meshName}" not found.`);
        }

        if (args.newName && typeof args.newName === 'string') {
          mesh.name = args.newName.replace(/\s+/g, '_');
        }
        if (args.visible !== undefined) {
          mesh.isVisible = !!args.visible;
        }
        this.applyTransformArgs(mesh, args);

        if (args.centerPivot) {
          this.service.centerMeshPivot(mesh);
        }
        if (args.snapToGround) {
          mesh.computeWorldMatrix(true);
          const lowestY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
          mesh.position.y -= lowestY;
          mesh.computeWorldMatrix(true);
        }
        if (args.bakeTransform) {
          mesh.bakeCurrentTransformIntoVertices();
          mesh.refreshBoundingInfo();
        }

        return JSON.stringify({
          status: 'ok',
          meshName: mesh.name,
          position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        });
      }

      case 'modeler_clone_array': {
        const source = this.findMeshByNameOrId(args.sourceMeshName);
        if (!source) {
          throw new Error(`Source mesh "${args.sourceMeshName}" not found.`);
        }
        const count = Math.max(2, Math.min(64, Math.round(Number(args.count) || 2)));
        const mode = args.mode === 'radial' ? 'radial' : 'linear';
        const createdClones: Mesh[] = [source];

        if (mode === 'linear') {
          const offVec = this.parseVec3(args.offset, 0);
          const ox = offVec.x;
          const oy = offVec.y;
          const oz = offVec.z;

          for (let i = 1; i < count; i++) {
            const clone = source.clone(`${source.name}_arr_${i}`, source.parent);
            if (clone) {
              clone.position.set(
                source.position.x + ox * i,
                source.position.y + oy * i,
                source.position.z + oz * i
              );
              this.registerCreatedMesh(clone);
              createdClones.push(clone);
            }
          }
        } else {
          const radius = args.radius !== undefined ? Number(args.radius) : 2.0;
          const centerVec = args.center ? this.parseVec3(args.center, 0) : new Vector3(0, source.position.y, 0);
          const cx = centerVec.x;
          const cy = centerVec.y;
          const cz = centerVec.z;
          const totalDeg = Number(args.arcDegrees) || 360;
          const rotateWithAngle = args.rotateWithAngle !== false;

          // Position source at index 0 on the circle
          source.position.set(cx + radius, cy, cz);
          if (rotateWithAngle) {
            source.rotationQuaternion = null;
            source.rotation.y = 0;
          }
          source.computeWorldMatrix(true);

          for (let i = 1; i < count; i++) {
            const angleRad = (((totalDeg / count) * i) * Math.PI) / 180;
            const clone = source.clone(`${source.name}_rad_${i}`, source.parent);
            if (clone) {
              clone.position.set(cx + Math.cos(angleRad) * radius, cy, cz + Math.sin(angleRad) * radius);
              if (rotateWithAngle) {
                clone.rotationQuaternion = null;
                clone.rotation.y = -angleRad;
              }
              this.registerCreatedMesh(clone);
              createdClones.push(clone);
            }
          }
        }

        if (args.mergeResult && createdClones.length > 1) {
          const merged = Mesh.MergeMeshes(createdClones, true, true, undefined, false, true);
          if (merged) {
            merged.name = (args.mergedName || args.newName || `${source.name}_array`).replace(/\s+/g, '_');
            for (const c of createdClones) {
              const idx = this.service.importedMeshes.indexOf(c);
              if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
            }
            this.registerCreatedMesh(merged);
            return JSON.stringify({
              status: 'ok',
              mergedMeshName: merged.name,
              count,
            });
          }
        }

        return JSON.stringify({
          status: 'ok',
          createdMeshes: createdClones.map((m) => m.name),
        });
      }

      case 'modeler_merge_meshes': {
        const names: string[] = Array.isArray(args.meshNames) ? args.meshNames : [];
        const disposeSources = args.disposeSources !== false;

        const meshesToMerge =
          names.includes('*')
            ? this.service.importedMeshes.filter(
                (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && m.getTotalVertices() > 0
              )
            : names
                .map((n) => this.findMeshByNameOrId(n))
                .filter((m): m is Mesh => !!m && m.getTotalVertices() > 0);

        if (meshesToMerge.length < 2) {
          throw new Error('At least 2 valid meshes are required to merge.');
        }

        for (const m of meshesToMerge) {
          m.computeWorldMatrix(true);
        }

        const merged = Mesh.MergeMeshes(meshesToMerge, disposeSources, true, undefined, false, true);
        if (!merged) {
          throw new Error('Mesh.MergeMeshes failed.');
        }

        merged.name = (args.newName || `${meshesToMerge[0].name}_merged`).replace(/\s+/g, '_');
        if (disposeSources) {
          for (const m of meshesToMerge) {
            const idx = this.service.importedMeshes.indexOf(m);
            if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
          }
        }
        this.registerCreatedMesh(merged);
        this.service.centerMeshPivot(merged);

        return JSON.stringify({
          status: 'ok',
          mergedMeshName: merged.name,
          vertices: merged.getTotalVertices(),
        });
      }

      case 'modeler_separate_mesh': {
        const mesh = this.findMeshByNameOrId(args.meshName);
        if (!mesh) {
          throw new Error(`Mesh "${args.meshName}" not found.`);
        }
        this.service.selectMesh(mesh);
        const parts =
          args.mode === 'submeshes'
            ? this.service.separateSelectedSubMeshes()
            : this.service.separateSelectedLooseParts();
        return JSON.stringify({
          status: 'ok',
          parts: parts.map((p) => p.name),
        });
      }

      case 'modeler_delete_mesh': {
        const names: string[] = Array.isArray(args.meshNames) ? args.meshNames : [];
        const deleted: string[] = [];
        for (const name of names) {
          const m = this.findMeshByNameOrId(name);
          if (m) {
            const idx = this.service.importedMeshes.indexOf(m);
            if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
            this.service.highlightLayer?.removeMesh(m);
            deleted.push(m.name);
            m.dispose();
          }
        }
        return JSON.stringify({
          status: 'ok',
          deleted,
        });
      }

      case 'modeler_build_voxel_mesh': {
        const meshName = (args.name || 'voxel_model').replace(/\s+/g, '_');
        const voxelSize = Math.max(0.05, Number(args.voxelSize) || 0.5);
        const paletteObj: Record<string, { color: string; roughness?: number; metallic?: number }> =
          args.palette || { default: { color: '#58a6ff' } };

        // Map coordinate "x,y,z" -> paletteKey so overlapping definitions overwrite cleanly
        const grid = new Map<string, string>();

        if (Array.isArray(args.boxes)) {
          for (const b of args.boxes) {
            const sVec = b.start ? this.parseVec3(b.start, 0) : null;
            const eVec = b.end ? this.parseVec3(b.end, 0) : null;
            const x1 = sVec ? sVec.x : Number(b.minX) || 0;
            const x2 = eVec ? eVec.x : Number(b.maxX) || 0;
            const y1 = sVec ? sVec.y : Number(b.minY) || 0;
            const y2 = eVec ? eVec.y : Number(b.maxY) || 0;
            const z1 = sVec ? sVec.z : Number(b.minZ) || 0;
            const z2 = eVec ? eVec.z : Number(b.maxZ) || 0;

            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2);
            const maxY = Math.max(y1, y2);
            const minZ = Math.min(z1, z2);
            const maxZ = Math.max(z1, z2);
            const key = String(b.paletteKey || b.type || Object.keys(paletteObj)[0] || 'default');

            for (let x = minX; x <= maxX; x++) {
              for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                  if (grid.size > 15000) break;
                  grid.set(`${x},${y},${z}`, key);
                }
              }
            }
          }
        }

        if (Array.isArray(args.voxels)) {
          for (const v of args.voxels) {
            if (grid.size > 15000) break;
            const x = Math.round(Number(v.x ?? v.pos?.[0]) || 0);
            const y = Math.round(Number(v.y ?? v.pos?.[1]) || 0);
            const z = Math.round(Number(v.z ?? v.pos?.[2]) || 0);
            const key = String(v.paletteKey || v.type || Object.keys(paletteObj)[0] || 'default');
            grid.set(`${x},${y},${z}`, key);
          }
        }

        if (grid.size === 0) {
          throw new Error('No voxels or box regions provided for modeler_build_voxel_mesh.');
        }

        // Group voxel meshes by paletteKey
        const byPalette = new Map<string, Array<[number, number, number]>>();
        let culledInteriorVoxels = 0;
        for (const [coord, palKey] of grid.entries()) {
          // Cull completely interior hidden voxels that have all 6 neighbors occupied
          const [x, y, z] = coord.split(',').map(Number);
          const isInterior =
            grid.has(`${x + 1},${y},${z}`) &&
            grid.has(`${x - 1},${y},${z}`) &&
            grid.has(`${x},${y + 1},${z}`) &&
            grid.has(`${x},${y - 1},${z}`) &&
            grid.has(`${x},${y},${z + 1}`) &&
            grid.has(`${x},${y},${z - 1}`);
          if (isInterior) {
            culledInteriorVoxels++;
            continue;
          }

          let list = byPalette.get(palKey);
          if (!list) {
            list = [];
            byPalette.set(palKey, list);
          }
          list.push([x, y, z]);
        }

        const paletteMeshes: Mesh[] = [];
        for (const [palKey, coords] of byPalette.entries()) {
          const palDef = paletteObj[palKey] || { color: '#58a6ff' };
          const mat = this.getOrCreateMaterial(
            `vox_${meshName}_${palKey}`,
            palDef.color,
            palDef.roughness ?? 0.65,
            palDef.metallic ?? 0.05
          );

          const cubes: Mesh[] = [];
          for (const [vx, vy, vz] of coords) {
            const c = MeshBuilder.CreateBox('v', { size: voxelSize }, scene);
            c.position.set(vx * voxelSize, (vy + 0.5) * voxelSize, vz * voxelSize);
            c.computeWorldMatrix(true);
            cubes.push(c);
          }

          if (cubes.length > 0) {
            const palMerged = Mesh.MergeMeshes(cubes, true, true);
            if (palMerged) {
              palMerged.name = `${meshName}_${palKey}`;
              palMerged.material = mat;
              paletteMeshes.push(palMerged);
            }
          }
        }

        let finalVoxelMesh: Mesh | null = null;
        if (paletteMeshes.length === 1) {
          finalVoxelMesh = paletteMeshes[0];
          finalVoxelMesh.name = meshName;
        } else if (paletteMeshes.length > 1) {
          finalVoxelMesh = Mesh.MergeMeshes(paletteMeshes, true, true, undefined, false, true);
          if (finalVoxelMesh) {
            finalVoxelMesh.name = meshName;
          }
        }

        if (!finalVoxelMesh) {
          throw new Error('Failed to merge voxel geometry.');
        }

        this.registerCreatedMesh(finalVoxelMesh);
        this.service.centerMeshPivot(finalVoxelMesh);
        // Align bottom to Y = 0
        finalVoxelMesh.computeWorldMatrix(true);
        const minY = finalVoxelMesh.getBoundingInfo().boundingBox.minimumWorld.y;
        finalVoxelMesh.position.y -= minY;
        finalVoxelMesh.computeWorldMatrix(true);

        return JSON.stringify({
          status: 'ok',
          meshName: finalVoxelMesh.name,
          voxelCount: grid.size,
          solidVoxels: grid.size - culledInteriorVoxels,
          culledInteriorVoxels,
          vertices: finalVoxelMesh.getTotalVertices(),
        });
      }

      case 'modeler_execute_babylon_code': {
        const code = String(args.code || '');
        if (!code.trim()) {
          throw new Error('Empty code passed to modeler_execute_babylon_code.');
        }

        const meshesBefore = new Set(this.service.scene.meshes);
        const explicitlyRegistered: Mesh[] = [];

        const registerMesh = (m: Mesh) => {
          if (m && m instanceof Mesh && !m.isDisposed()) {
            this.registerCreatedMesh(m);
            explicitlyRegistered.push(m);
          }
          return m;
        };

        const createMaterial = (
          name: string,
          hexColor: string = '#58a6ff',
          roughness: number = 0.45,
          metallic: number = 0.1,
          emissiveHex?: string
        ) => {
          const mat = this.getOrCreateMaterial(name, hexColor, roughness, metallic);
          if (emissiveHex) {
            mat.emissiveColor = Color3.FromHexString(this.normalizeHex(emissiveHex));
          }
          return mat;
        };

        const autoUV = (m: Mesh, scale: number = 1.0) => {
          if (m && m instanceof Mesh && !m.isDisposed()) {
            const prev = this.service.selectedMesh;
            this.service.selectedMesh = m;
            this.service.applyTriplanarUVs(scale);
            this.service.selectedMesh = prev;
          }
          return m;
        };

        const booleanOp = async (
          baseMesh: Mesh,
          toolMesh: Mesh,
          op: 'union' | 'subtract' | 'intersect' = 'subtract',
          newName?: string,
          keepTool: boolean = false
        ) => {
          const res = await this.service.performCSGOperation(baseMesh, toolMesh, op, keepTool);
          if (res && newName) res.name = newName;
          return res;
        };

        const BABYLON_NS = {
          MeshBuilder,
          Mesh,
          Vector3,
          Color3,
          Color4,
          Quaternion,
          Matrix,
          PBRMaterial,
          StandardMaterial,
          MultiMaterial,
          Texture,
          DynamicTexture,
          VertexData,
          VertexBuffer,
          CSG,
          CSG2,
        };

        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFunction(
          'scene',
          'service',
          'BABYLON',
          'MeshBuilder',
          'Mesh',
          'Vector3',
          'Color3',
          'Color4',
          'Quaternion',
          'Matrix',
          'PBRMaterial',
          'StandardMaterial',
          'MultiMaterial',
          'Texture',
          'DynamicTexture',
          'VertexData',
          'VertexBuffer',
          'CSG',
          'CSG2',
          'earcut',
          'registerMesh',
          'createMaterial',
          'createPBRMaterial',
          'autoUV',
          'booleanOp',
          code
        );

        const returnVal = await fn(
          scene,
          this.service,
          BABYLON_NS,
          MeshBuilder,
          Mesh,
          Vector3,
          Color3,
          Color4,
          Quaternion,
          Matrix,
          PBRMaterial,
          StandardMaterial,
          MultiMaterial,
          Texture,
          DynamicTexture,
          VertexData,
          VertexBuffer,
          CSG,
          CSG2,
          earcut,
          registerMesh,
          createMaterial,
          createMaterial,
          autoUV,
          booleanOp
        );

        // Automatically register any new non-disposed meshes added to the scene during script execution
        const newlyAdded: string[] = [];
        for (const m of this.service.scene.meshes) {
          if (
            !meshesBefore.has(m) &&
            m instanceof Mesh &&
            !m.isDisposed() &&
            !this.service.isEditorHelper(m) &&
            m.getTotalVertices() > 0
          ) {
            this.registerCreatedMesh(m);
            newlyAdded.push(m.name);
          }
        }

        // Remove any disposed meshes from importedMeshes
        this.service.importedMeshes = this.service.importedMeshes.filter((m) => !m.isDisposed());

        return JSON.stringify({
          status: 'ok',
          createdMeshes: Array.from(new Set([...explicitlyRegistered.map((m) => m.name), ...newlyAdded])),
          result: returnVal !== undefined ? returnVal : undefined,
        });
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /* =========================================================================
     FALLBACK PARSER FOR ENDPOINTS WITHOUT NATIVE TOOL CALLING
     ========================================================================= */
  private extractFallbackToolCallsFromText(content: string): Array<{ name: string; arguments: any }> {
    const calls: Array<{ name: string; arguments: any }> = [];
    if (!content) return calls;

    // 1. Check for ```json ... ``` blocks containing tool calls
    const jsonFenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonFenceRegex.exec(content)) !== null) {
      const block = match[1].trim();
      try {
        const parsed = JSON.parse(block);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item && typeof item.name === 'string' && item.name.startsWith('modeler_')) {
            calls.push({ name: item.name, arguments: item.arguments || item.args || item.parameters || {} });
          } else if (item && typeof item.tool === 'string' && item.tool.startsWith('modeler_')) {
            calls.push({ name: item.tool, arguments: item.arguments || item.args || item.parameters || {} });
          }
        }
      } catch {
        // Not a JSON tool block
      }
    }

    if (calls.length > 0) return calls;

    // 2. Check for ```javascript / ```ts / ```babylon code blocks that use MeshBuilder
    const codeFenceRegex = /```(?:javascript|js|typescript|ts|babylon)\s*([\s\S]*?)```/gi;
    while ((match = codeFenceRegex.exec(content)) !== null) {
      const code = match[1].trim();
      if (code.includes('MeshBuilder.') || code.includes('CSG') || code.includes('new Mesh')) {
        calls.push({
          name: 'modeler_execute_babylon_code',
          arguments: {
            description: 'Execute generated Babylon.js code block',
            code,
          },
        });
      }
    }

    return calls;
  }

  /* =========================================================================
     AGENT EXECUTION LOOP (Text-to-Mesh, Image-to-Mesh, Mesh-Update)
     ========================================================================= */
  public async runPrompt(options: AIAgentRequestOptions): Promise<AIAgentChatMessage> {
    const prompt = (options.prompt || '').trim();
    const images = [...(options.images || [])];

    if (options.includeViewportSnapshot) {
      const snap = this.captureViewportDataUrl();
      if (snap) images.push(snap);
    }

    if (!prompt && images.length === 0) {
      throw new Error('Please provide a prompt or attach an image.');
    }

    if (options.mode === 'replace_scene') {
      this.service.clearModel();
    }

    // Record user message in history
    const userMsg: AIAgentChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt || '(Image-to-Mesh generation)',
      images: images.length > 0 ? images : undefined,
      timestamp: Date.now(),
    };
    this.chatHistory.push(userMsg);

    // Build OpenAI messages payload
    const apiMessages: any[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
    ];

    // Include up to last 6 conversational turns for context
    const recentHistory = this.chatHistory.slice(-7, -1);
    for (const h of recentHistory) {
      if (h.role === 'user') {
        apiMessages.push({ role: 'user', content: h.content });
      } else if (h.role === 'assistant') {
        apiMessages.push({ role: 'assistant', content: h.content });
      }
    }

    // Current user message (multimodal if images are attached)
    if (images.length > 0) {
      const contentParts: any[] = [
        {
          type: 'text',
          text:
            prompt ||
            'Analyze this reference image and recreate the corresponding 3D model in detail using the Babylon.js Modeler tools in the scene.',
        },
      ];
      for (const imgUrl of images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: imgUrl },
        });
      }
      apiMessages.push({
        role: 'user',
        content: contentParts,
      });
    } else {
      apiMessages.push({
        role: 'user',
        content: prompt,
      });
    }

    // Snapshot scene meshes before agent execution for 1-click Undo/Redo support
    const meshesBeforeRun = new Set(
      this.service.importedMeshes.filter((m) => !this.service.isEditorHelper(m) && !m.isDisposed())
    );
    const preRunTransforms = new Map<
      Mesh,
      { pos: Vector3; rot: Vector3; scale: Vector3; mat: Material | null; visible: boolean; enabled: boolean }
    >();
    for (const m of meshesBeforeRun) {
      preRunTransforms.set(m, {
        pos: m.position.clone(),
        rot: m.rotation.clone(),
        scale: m.scaling.clone(),
        mat: m.material,
        visible: m.isVisible,
        enabled: m.isEnabled(),
      });
    }

    const executedSteps: AIAgentToolExecutionStep[] = [];
    const maxIterations = Math.max(1, Math.min(25, this.config.maxIterations || 12));
    let finalAssistantText = '';
    let toolsSupported = true;

    this.service.events.onStatusChanged?.('AI Agent working...', true);

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (options.signal?.aborted) {
          throw new Error('Generation cancelled by user.');
        }

        options.onStatus?.(
          iteration === 0
            ? 'Sending request to AI endpoint...'
            : `AI Agent modeling (step ${iteration + 1})...`
        );

        const responseData = await this.callChatCompletions(apiMessages, toolsSupported, options.signal);

        // If endpoint rejected `tools` parameter, retry without native tools
        if (responseData.__retryWithoutTools) {
          toolsSupported = false;
          iteration--;
          continue;
        }

        const choice = responseData?.choices?.[0];
        const message = choice?.message;
        if (!message) {
          throw new Error('Invalid response from OpenAI-compatible endpoint (no message in choices[0]).');
        }

        const assistantContent =
          typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
              ? message.content.map((p: any) => p?.text || '').join('\n')
              : '';

        if (assistantContent) {
          finalAssistantText = assistantContent;
        }

        const nativeToolCalls: any[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];

        // Support legacy function_call if returned by some endpoints
        if (nativeToolCalls.length === 0 && message.function_call && message.function_call.name) {
          nativeToolCalls.push({
            id: `call_legacy_${iteration}`,
            type: 'function',
            function: {
              name: message.function_call.name,
              arguments: message.function_call.arguments || '{}',
            },
          });
        }

        if (nativeToolCalls.length > 0) {
          apiMessages.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: nativeToolCalls,
          });

          for (const tc of nativeToolCalls) {
            if (options.signal?.aborted) {
              throw new Error('Generation cancelled by user.');
            }

            const fnName = tc.function?.name || '';
            const rawArgs = tc.function?.arguments || '{}';
            let parsedArgs: Record<string, any> = {};
            try {
              parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
            } catch {
              parsedArgs = { raw: rawArgs };
            }

            options.onStatus?.(`Executing tool: ${fnName}...`);
            const startTime = Date.now();
            let toolResultStr = '';
            let isError = false;

            try {
              toolResultStr = await this.executeToolCall(fnName, parsedArgs);
            } catch (err: any) {
              isError = true;
              toolResultStr = JSON.stringify({ error: err?.message || String(err) });
            }

            const step: AIAgentToolExecutionStep = {
              id: tc.id || `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              toolName: fnName,
              args: parsedArgs,
              result: toolResultStr,
              isError,
              durationMs: Date.now() - startTime,
            };
            executedSteps.push(step);
            options.onStep?.(step);

            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: fnName,
              content: toolResultStr,
            });
          }

          // Update viewport after each batch of tool calls
          this.service.updateStats();
          this.service.events.onSceneModified?.();
          continue;
        }

        // Check fallback code/JSON blocks if no native tool_calls were emitted
        const fallbackCalls = this.extractFallbackToolCallsFromText(assistantContent);
        if (fallbackCalls.length > 0 && executedSteps.length === 0) {
          for (const fc of fallbackCalls) {
            const startTime = Date.now();
            let toolResultStr = '';
            let isError = false;
            try {
              toolResultStr = await this.executeToolCall(fc.name, fc.arguments);
            } catch (err: any) {
              isError = true;
              toolResultStr = JSON.stringify({ error: err?.message || String(err) });
            }
            const step: AIAgentToolExecutionStep = {
              id: `step_fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              toolName: fc.name,
              args: fc.arguments,
              result: toolResultStr,
              isError,
              durationMs: Date.now() - startTime,
            };
            executedSteps.push(step);
            options.onStep?.(step);
          }
          this.service.updateStats();
          this.service.events.onSceneModified?.();
        }

        // No more tool calls -> finished!
        break;
      }

      // Finalize scene state, selection, camera focus, and Undo/Redo action
      this.service.importedMeshes = this.service.importedMeshes.filter(
        (m) => !this.service.isEditorHelper(m) && !m.isDisposed()
      );

      const meshesAfterRun = new Set(this.service.importedMeshes);
      const newlyCreatedMeshes = Array.from(meshesAfterRun).filter((m) => !meshesBeforeRun.has(m));

      if (newlyCreatedMeshes.length > 0) {
        this.service.selectNodes(newlyCreatedMeshes);
        this.service.focusOnAll();
      }

      if (executedSteps.length > 0) {
        this.registerUndoRedoRecord(prompt, meshesBeforeRun, preRunTransforms, newlyCreatedMeshes);
      }

      this.service.updateStats();
      this.service.events.onSceneModified?.();
      this.service.events.onStatusChanged?.('Ready', false);
      this.service.events.onToast?.(
        `AI Agent finished (${executedSteps.length} modeling steps executed)!`,
        'success'
      );

      const assistantMsg: AIAgentChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content:
          finalAssistantText ||
          (executedSteps.length > 0
            ? `${executedSteps.length} 3D modeling operation(s) successfully executed in the scene.`
            : 'Request completed.'),
        toolSteps: executedSteps,
        timestamp: Date.now(),
      };
      this.chatHistory.push(assistantMsg);
      return assistantMsg;
    } catch (err: any) {
      this.service.events.onStatusChanged?.('Ready', false);
      this.service.events.onToast?.(`AI Agent error: ${err?.message || err}`, 'error');
      throw err;
    }
  }

  private registerUndoRedoRecord(
    prompt: string,
    meshesBeforeRun: Set<Mesh>,
    preRunTransforms: Map<
      Mesh,
      { pos: Vector3; rot: Vector3; scale: Vector3; mat: Material | null; visible: boolean; enabled: boolean }
    >,
    newlyCreatedMeshes: Mesh[]
  ): void {
    const postRunTransforms = new Map<
      Mesh,
      { pos: Vector3; rot: Vector3; scale: Vector3; mat: Material | null; visible: boolean; enabled: boolean }
    >();
    for (const m of meshesBeforeRun) {
      if (!m.isDisposed()) {
        postRunTransforms.set(m, {
          pos: m.position.clone(),
          rot: m.rotation.clone(),
          scale: m.scaling.clone(),
          mat: m.material,
          visible: m.isVisible,
          enabled: m.isEnabled(),
        });
      }
    }

    const shortPrompt = prompt.length > 28 ? prompt.slice(0, 28) + '...' : prompt || 'AI Mesh Generation';
    this.service.recordAction({
      name: `AI Agent: ${shortPrompt}`,
      undo: () => {
        this.service.clearSelectionProxy();
        for (const m of newlyCreatedMeshes) {
          if (!m.isDisposed()) {
            m.setEnabled(false);
            const idx = this.service.importedMeshes.indexOf(m);
            if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
          }
        }
        for (const [m, state] of preRunTransforms.entries()) {
          if (!m.isDisposed()) {
            m.position.copyFrom(state.pos);
            m.rotation.copyFrom(state.rot);
            m.scaling.copyFrom(state.scale);
            m.material = state.mat;
            m.isVisible = state.visible;
            m.setEnabled(state.enabled);
            if (state.enabled && !this.service.importedMeshes.includes(m)) {
              this.service.importedMeshes.push(m);
            }
          }
        }
        this.service.selectNodes([]);
        this.service.events.onSceneModified?.();
      },
      redo: () => {
        this.service.clearSelectionProxy();
        for (const m of newlyCreatedMeshes) {
          if (!m.isDisposed()) {
            m.setEnabled(true);
            if (!this.service.importedMeshes.includes(m)) {
              this.service.importedMeshes.push(m);
            }
          }
        }
        for (const [m, state] of postRunTransforms.entries()) {
          if (!m.isDisposed()) {
            m.position.copyFrom(state.pos);
            m.rotation.copyFrom(state.rot);
            m.scaling.copyFrom(state.scale);
            m.material = state.mat;
            m.isVisible = state.visible;
            m.setEnabled(state.enabled);
          }
        }
        this.service.selectNodes(newlyCreatedMeshes);
        this.service.events.onSceneModified?.();
      },
    });
  }

  private async callChatCompletions(messages: any[], includeTools: boolean, signal?: AbortSignal): Promise<any> {
    const url = this.getChatCompletionsUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.apiKey && this.config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey.trim()}`;
    }

    const activeModel = this.normalizeModelName(this.config.model || DEFAULT_AI_AGENT_CONFIG.model, url);
    const body: Record<string, any> = {
      model: activeModel,
      messages,
      temperature: this.config.temperature ?? 0.2,
    };

    if (includeTools) {
      body.tools = this.getOpenAITools();
      body.tool_choice = 'auto';
    }

    const fetchFn = this.customFetch || globalThis.fetch.bind(globalThis);
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 404 && url.startsWith('/api/antigravity/v1')) {
        res = await fetchFn(url.replace(/^\/api\/antigravity\/v1/, 'http://localhost:8787/v1'), {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });
      }
    } catch (err) {
      if (url.startsWith('/api/antigravity/v1')) {
        res = await fetchFn(url.replace(/^\/api\/antigravity\/v1/, 'http://localhost:8787/v1'), {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });
      } else {
        throw err;
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');

      // Auto-switch to local Antigravity Bridge if Google AI Studio returns 402 (depleted prepayment credits)
      if (res.status === 402 && url.toLowerCase().includes('generativelanguage.googleapis.com')) {
        const agyModel = 'gemini-3.8-flash-medium';
        this.saveConfig({ baseUrl: '/api/antigravity/v1', model: agyModel });
        body.model = agyModel;
        try {
          res = await fetchFn('/api/antigravity/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
            signal,
          });
          if (!res.ok) {
            res = await fetchFn('http://localhost:8787/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(body),
              signal,
            });
          }
          if (res.ok) {
            return await res.json();
          }
        } catch {
          // Fall through to error reporting if local bridge is unreachable
        }
      }

      // Auto-recover if Gemini endpoint reports a deprecated model and suggests a replacement model
      if (res.status === 404 && url.toLowerCase().includes('generativelanguage.googleapis.com')) {
        const suggestedMatch = errText.match(/use\s+models\/([a-zA-Z0-9._-]+)/i);
        const fallbackModel = suggestedMatch ? suggestedMatch[1] : 'gemini-3-flash-preview';
        if (fallbackModel && fallbackModel !== body.model) {
          this.saveConfig({ model: fallbackModel });
          body.model = fallbackModel;
          res = await fetchFn(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal,
          });
          if (res.ok) {
            return await res.json();
          }
        }
      }

      // If the model/endpoint does not support tool calling (HTTP 400 mentioning tools/functions), retry once without tools
      if (
        includeTools &&
        res.status === 400 &&
        /tool|function/i.test(errText)
      ) {
        return { __retryWithoutTools: true };
      }
      let friendlyError = errText || res.statusText;
      try {
        const parsedErr = JSON.parse(errText);
        const errObj = Array.isArray(parsedErr) ? parsedErr[0]?.error : parsedErr?.error;
        if (errObj?.message) {
          friendlyError = errObj.message;
        }
      } catch {
        // Keep raw text
      }
      throw new Error(`Endpoint error (${res.status}): ${friendlyError}`);
    }

    return await res.json();
  }
}
