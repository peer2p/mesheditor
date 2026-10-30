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
import {
  ToolRegistry,
  ToolInterface,
  ToolExecutionContext,
  createDefaultToolRegistry,
} from './tools';

export {
  ProceduralTextureType,
  ProceduralTextureOptions,
  generateProceduralTextureDataUrl,
} from './tools/textureUtils';

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
   BUILT-IN BABYLON.JS MODELING SKILLS (Loaded from /skills directory)
   ========================================================================= */
export { BUILT_IN_AGENT_SKILLS, discoverSkills, parseSkillMarkdown } from './builtInSkills';
import { BUILT_IN_AGENT_SKILLS, discoverSkills, parseSkillMarkdown } from './builtInSkills';

/* =========================================================================
   AI AGENT SERVICE
   ========================================================================= */
export class AIAgentService {
  public service: MeshEditorService;
  public config: AIAgentEndpointConfig;
  public skills: AIAgentSkillDefinition[];
  public chatHistory: AIAgentChatMessage[] = [];
  public toolRegistry: ToolRegistry;
  private materialRegistry: Map<string, PBRMaterial> = new Map();
  public customFetch: typeof fetch | null = null;

  constructor(
    service: MeshEditorService,
    initialConfig?: Partial<AIAgentEndpointConfig>,
    customFetch?: typeof fetch
  ) {
    this.service = service;
    this.customFetch = customFetch || null;
    this.skills = discoverSkills();
    this.toolRegistry = createDefaultToolRegistry();
    this.config = {
      ...DEFAULT_AI_AGENT_CONFIG,
      ...this.loadSavedConfig(),
      ...initialConfig,
    };
  }

  /**
   * Registers a custom modeling tool into the agent registry.
   */
  public registerTool(tool: ToolInterface): void {
    this.toolRegistry.register(tool);
  }

  /**
   * Builds the execution context provided to tools during dispatch.
   */
  public createToolContext(): ToolExecutionContext {
    return {
      service: this.service,
      scene: this.service.scene,
      aiAgent: this,
      materialRegistry: this.materialRegistry,
      findMeshByNameOrId: (id: string) => this.findMeshByNameOrId(id),
      getOrCreateMaterial: (materialName, colorHex, roughness, metallic, fallbackName) =>
        this.getOrCreateMaterial(materialName, colorHex, roughness, metallic, fallbackName),
      applyTransformArgs: (mesh, args) => this.applyTransformArgs(mesh, args),
      registerCreatedMesh: (mesh) => this.registerCreatedMesh(mesh),
      normalizeHex: (hex) => this.normalizeHex(hex),
      parseVec3: (v, defaultVal) => this.parseVec3(v, defaultVal),
      parsePolygonPoint: (p) => this.parsePolygonPoint(p),
      buildSceneSummary: () => this.buildSceneSummary(),
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

  /**
   * Registers or updates an AI agent skill definition.
   */
  public registerSkill(skill: AIAgentSkillDefinition): void {
    const existingIndex = this.skills.findIndex((s) => s.id === skill.id);
    if (existingIndex >= 0) {
      this.skills[existingIndex] = { ...skill };
    } else {
      this.skills.push({ ...skill });
    }
  }

  /**
   * Parses and registers a skill directly from raw Markdown content (with optional YAML frontmatter).
   */
  public registerSkillFromMarkdown(content: string, fallbackId: string = 'custom-skill'): AIAgentSkillDefinition {
    const skill = parseSkillMarkdown(content, fallbackId);
    this.registerSkill(skill);
    return skill;
  }

  /**
   * Reloads skills discovered from the /skills directory, preserving user checkbox states.
   */
  public reloadSkills(): AIAgentSkillDefinition[] {
    const existingStates = new Map<string, boolean>();
    for (const s of this.skills) {
      existingStates.set(s.id, s.enabled);
    }
    const freshSkills = discoverSkills();
    for (const fresh of freshSkills) {
      if (existingStates.has(fresh.id)) {
        fresh.enabled = existingStates.get(fresh.id)!;
      }
    }
    this.skills = freshSkills;
    return this.skills;
  }

  /**
   * Optionally fetches dynamically discovered skills from the local dev server or bridge API (/api/skills).
   */
  public async fetchSkillsFromApi(apiUrl: string = '/api/skills'): Promise<AIAgentSkillDefinition[]> {
    try {
      const fetchFn = this.customFetch || (typeof fetch !== 'undefined' ? fetch : null);
      if (!fetchFn) return this.skills;
      const res = await fetchFn(apiUrl);
      if (!res.ok) return this.skills;
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.id && item.instructions) {
            this.registerSkill(item);
          }
        }
      }
    } catch {
      // Ignore network errors and keep currently loaded skills
    }
    return this.skills;
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
    return this.toolRegistry.getOpenAITools();
  }

  /* =========================================================================
     TOOL EXECUTION ENGINE
     ========================================================================= */
  public findMeshByNameOrId(identifier: string): Mesh | undefined {
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

  public getOrCreateMaterial(
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

  public normalizeHex(hex: string): string {
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

  public parseVec3(v: any, defaultVal: number = 0): Vector3 {
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

  public parsePolygonPoint(p: any): Vector3 {
    if (Array.isArray(p)) {
      if (p.length === 2) {
        return new Vector3(Number(p[0]) || 0, 0, Number(p[1]) || 0);
      }
      return new Vector3(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0);
    }
    return new Vector3(Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0);
  }

  public applyTransformArgs(mesh: Mesh, args: any): void {
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

  public registerCreatedMesh(mesh: Mesh): void {
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
    const context = this.createToolContext();
    return await this.toolRegistry.execute(toolName, rawArgs, context);
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
