import {
  Neural3DBackendId,
  Neural3DProtocol,
  Neural3DProviderConfig,
  Neural3DProvidersMap,
} from './types';

export interface Neural3DProtocolPreset {
  endpointUrl: string;
  modelId: string;
  requiresKey: boolean;
}

export const NEURAL_3D_PROTOCOL_DEFAULTS: Record<
  Neural3DBackendId,
  Record<Neural3DProtocol, Neural3DProtocolPreset>
> = {
  trellis: {
    omlx: {
      endpointUrl: 'http://localhost:8000/v1/3d/generations',
      modelId: 'mlx-community/TRELLIS.2-4B',
      requiresKey: false,
    },
    local_rest: {
      endpointUrl: 'http://localhost:8080/generate',
      modelId: 'microsoft/TRELLIS.2-4B',
      requiresKey: false,
    },
    gradio: {
      endpointUrl: 'http://localhost:7860',
      modelId: 'microsoft/TRELLIS-image-large',
      requiresKey: false,
    },
    fal: {
      endpointUrl: 'https://fal.run/fal-ai/trellis',
      modelId: 'fal-ai/trellis',
      requiresKey: true,
    },
    replicate: {
      endpointUrl: 'https://api.replicate.com/v1/predictions',
      modelId: 'firtoz/trellis',
      requiresKey: true,
    },
  },
  hunyuan3d: {
    omlx: {
      endpointUrl: 'http://localhost:8000/v1/3d/generations',
      modelId: 'mlx-community/Hunyuan3D-2.1',
      requiresKey: false,
    },
    local_rest: {
      endpointUrl: 'http://localhost:8081/generate',
      modelId: 'tencent/Hunyuan3D-2.1',
      requiresKey: false,
    },
    gradio: {
      endpointUrl: 'http://localhost:7861',
      modelId: 'tencent/Hunyuan3D-2',
      requiresKey: false,
    },
    fal: {
      endpointUrl: 'https://fal.run/fal-ai/hunyuan3d-v2',
      modelId: 'fal-ai/hunyuan3d-v2',
      requiresKey: true,
    },
    replicate: {
      endpointUrl: 'https://api.replicate.com/v1/predictions',
      modelId: 'tencent/hunyuan3d-2',
      requiresKey: true,
    },
  },
  hi3d: {
    omlx: {
      endpointUrl: 'http://localhost:8000/v1/3d/generations',
      modelId: 'mlx-community/Hi3D-V3.0',
      requiresKey: false,
    },
    local_rest: {
      endpointUrl: 'http://localhost:8082/generate',
      modelId: 'Hi3D-V3.0',
      requiresKey: false,
    },
    gradio: {
      endpointUrl: 'http://localhost:7862',
      modelId: 'Hi3D-V3.0',
      requiresKey: false,
    },
    fal: {
      endpointUrl: 'https://fal.run/fal-ai/hi3d',
      modelId: 'fal-ai/hi3d',
      requiresKey: true,
    },
    replicate: {
      endpointUrl: 'https://api.replicate.com/v1/predictions',
      modelId: 'hi3d/hi3d-v3',
      requiresKey: true,
    },
  },
};

export function createDefaultNeural3DProviders(): Neural3DProvidersMap {
  return {
    trellis: {
      id: 'trellis',
      name: 'TRELLIS 2 / TRELLIS',
      enabled: false,
      protocol: 'omlx',
      endpointUrl: NEURAL_3D_PROTOCOL_DEFAULTS.trellis.omlx.endpointUrl,
      apiKey: '',
      modelId: NEURAL_3D_PROTOCOL_DEFAULTS.trellis.omlx.modelId,
    },
    hunyuan3d: {
      id: 'hunyuan3d',
      name: 'Hunyuan3D',
      enabled: false,
      protocol: 'omlx',
      endpointUrl: NEURAL_3D_PROTOCOL_DEFAULTS.hunyuan3d.omlx.endpointUrl,
      apiKey: '',
      modelId: NEURAL_3D_PROTOCOL_DEFAULTS.hunyuan3d.omlx.modelId,
    },
    hi3d: {
      id: 'hi3d',
      name: 'Hi3D (V1.0–V3.0)',
      enabled: false,
      protocol: 'omlx',
      endpointUrl: NEURAL_3D_PROTOCOL_DEFAULTS.hi3d.omlx.endpointUrl,
      apiKey: '',
      modelId: NEURAL_3D_PROTOCOL_DEFAULTS.hi3d.omlx.modelId,
    },
  };
}

export function normalizeNeural3DProviders(
  raw?: Partial<Record<Neural3DBackendId, Partial<Neural3DProviderConfig>>>
): Neural3DProvidersMap {
  const defaults = createDefaultNeural3DProviders();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const ids: Neural3DBackendId[] = ['trellis', 'hunyuan3d', 'hi3d'];
  for (const id of ids) {
    const item = raw[id];
    if (item && typeof item === 'object') {
      const protocol: Neural3DProtocol =
        item.protocol && ['omlx', 'local_rest', 'gradio', 'fal', 'replicate'].includes(item.protocol)
          ? item.protocol
          : defaults[id].protocol;
      const preset = NEURAL_3D_PROTOCOL_DEFAULTS[id][protocol];
      defaults[id] = {
        id,
        name: defaults[id].name,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : false,
        protocol,
        endpointUrl:
          typeof item.endpointUrl === 'string' && item.endpointUrl.trim()
            ? item.endpointUrl.trim()
            : preset.endpointUrl,
        apiKey: typeof item.apiKey === 'string' ? item.apiKey : '',
        modelId:
          typeof item.modelId === 'string' && item.modelId.trim()
            ? item.modelId.trim()
            : preset.modelId,
      };
    }
  }
  return defaults;
}

export interface Neural3DGenerationRequest {
  backend?: Neural3DBackendId | 'auto';
  prompt: string;
  imageUrl?: string;
  generateTextures?: boolean;
  highResPrint?: boolean;
  octreeResolution?: number;
  seed?: number;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

export interface Neural3DGenerationResult {
  providerId: Neural3DBackendId;
  providerName: string;
  modelId: string;
  format: 'glb' | 'obj' | 'stl' | 'json_mesh';
  /** Binary buffer (for glb/obj/stl) or UTF-8 encoded JSON/OBJ bytes */
  data: Uint8Array;
  /** Optional text representation when format is obj or json_mesh */
  textData?: string;
  /** Optional raw JSON mesh payload if returned directly by server */
  jsonMesh?: {
    positions: number[];
    indices: number[];
    normals?: number[];
    uvs?: number[];
    colors?: number[];
  };
  sourceUrl?: string;
}

/**
 * Service handling communication with local (oMLX, FastAPI, Gradio) and cloud BYO-key
 * (Fal.ai, Replicate) Neural 3D Generators: TRELLIS 2, Hunyuan3D, and Hi3D.
 */
export class Neural3DGeneratorService {
  /**
   * Selects the best enabled provider for a given 3D generation request.
   */
  public static selectBestProvider(
    providers: Neural3DProvidersMap,
    request: Neural3DGenerationRequest
  ): Neural3DProviderConfig {
    const enabledList = (['trellis', 'hunyuan3d', 'hi3d'] as Neural3DBackendId[])
      .map((id) => providers[id])
      .filter((p): p is Neural3DProviderConfig => !!p && p.enabled);

    if (enabledList.length === 0) {
      throw new Error(
        'No Neural 3D Generator (TRELLIS 2, Hunyuan3D, or Hi3D) is currently enabled. Enable at least one generator in AI Agent Settings.'
      );
    }

    // 1. Explicit backend request if enabled
    if (request.backend && request.backend !== 'auto') {
      const explicit = providers[request.backend];
      if (explicit && explicit.enabled) {
        return explicit;
      }
    }

    // 2. Heuristic auto-selection among enabled providers:
    // - If 3D printing / high-res 2K untextured geometry is requested -> prefer Hi3D
    if (request.highResPrint || request.generateTextures === false) {
      if (providers.hi3d?.enabled) return providers.hi3d;
    }

    // - If an input reference image is provided -> prefer TRELLIS 2 (best image-to-3D & topology), then Hunyuan3D
    if (request.imageUrl) {
      if (providers.trellis?.enabled) return providers.trellis;
      if (providers.hunyuan3d?.enabled) return providers.hunyuan3d;
    }

    // - If textured object generation from text -> prefer Hunyuan3D or TRELLIS 2
    if (request.generateTextures !== false) {
      if (providers.trellis?.enabled) return providers.trellis;
      if (providers.hunyuan3d?.enabled) return providers.hunyuan3d;
    }

    return enabledList[0];
  }

  /**
   * Generates a 3D mesh from the selected Neural 3D Generator provider.
   */
  public static async generateMesh(
    providers: Neural3DProvidersMap,
    request: Neural3DGenerationRequest,
    customFetch?: typeof fetch | null
  ): Promise<Neural3DGenerationResult> {
    const provider = this.selectBestProvider(providers, request);
    const fetchFn = customFetch || globalThis.fetch.bind(globalThis);

    request.onStatus?.(
      `Delegating 3D generation to ${provider.name} (${provider.protocol})...`
    );

    switch (provider.protocol) {
      case 'gradio':
        return await this.executeGradioRequest(provider, request, fetchFn);
      case 'fal':
        return await this.executeFalRequest(provider, request, fetchFn);
      case 'replicate':
        return await this.executeReplicateRequest(provider, request, fetchFn);
      case 'omlx':
      case 'local_rest':
      default:
        return await this.executeRestOrOmlxRequest(provider, request, fetchFn);
    }
  }

  /**
   * Resolves the generation endpoint URL for oMLX or local REST servers.
   */
  public static resolveRestUrl(endpointUrl: string, protocol: Neural3DProtocol): string {
    const clean = (endpointUrl || '').trim().replace(/\/+$/, '');
    if (!clean) {
      return protocol === 'omlx'
        ? 'http://localhost:8000/v1/3d/generations'
        : 'http://localhost:8080/generate';
    }
    if (protocol === 'omlx') {
      if (clean.endsWith('/v1')) {
        return `${clean}/3d/generations`;
      }
      if (/^https?:\/\/[^/]+$/i.test(clean)) {
        return `${clean}/v1/3d/generations`;
      }
    }
    return clean;
  }

  private static async executeRestOrOmlxRequest(
    provider: Neural3DProviderConfig,
    request: Neural3DGenerationRequest,
    fetchFn: typeof fetch
  ): Promise<Neural3DGenerationResult> {
    const primaryUrl = this.resolveRestUrl(provider.endpointUrl, provider.protocol);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, model/gltf-binary, application/octet-stream',
    };
    if (provider.apiKey && provider.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
    }

    const generateTextures =
      request.generateTextures !== undefined
        ? request.generateTextures
        : provider.id !== 'hi3d';
    const octreeRes =
      request.octreeResolution || (provider.id === 'hi3d' || request.highResPrint ? 512 : 256);

    const payload: Record<string, any> = {
      model: provider.modelId || provider.id,
      backend: provider.id,
      prompt: request.prompt,
      text: request.prompt,
      texture: generateTextures,
      generate_textures: generateTextures,
      high_res_print: !!request.highResPrint || provider.id === 'hi3d',
      octree_resolution: octreeRes,
      format: 'glb',
      response_format: 'glb',
    };

    if (request.imageUrl) {
      payload.image = request.imageUrl;
      payload.image_url = request.imageUrl;
      const base64Clean = request.imageUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      payload.image_base64 = base64Clean;
    }
    if (typeof request.seed === 'number') {
      payload.seed = request.seed;
    }

    let res = await fetchFn(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    // If oMLX /v1/3d/generations returns 404, try /generate on the same host
    if (res.status === 404 && primaryUrl.endsWith('/v1/3d/generations')) {
      const fallbackUrl = primaryUrl.replace(/\/v1\/3d\/generations$/, '/generate');
      res = await fetchFn(fallbackUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: request.signal,
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `${provider.name} endpoint error (${res.status}): ${errText || res.statusText}`
      );
    }

    return await this.parseHttpResponseToMeshResult(res, provider, primaryUrl, fetchFn, request.signal);
  }

  private static async executeGradioRequest(
    provider: Neural3DProviderConfig,
    request: Neural3DGenerationRequest,
    fetchFn: typeof fetch
  ): Promise<Neural3DGenerationResult> {
    const baseUrl = provider.endpointUrl.trim().replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (provider.apiKey && provider.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${provider.apiKey.trim()}`;
    }

    const explicitPredictSuffix = /\/(gradio_api\/)?(api|run)\/predict$/i.test(baseUrl);
    const rootUrl = baseUrl
      .replace(/\/(gradio_api\/)?(api|run|call)\/.*$/i, '')
      .replace(/\/(gradio_api\/)?(info|config)$/i, '')
      .replace(/\/+$/, '');

    // 1. Try inspecting Gradio /config first (supported across Gradio 3, 4, and 5 even when show_api=False)
    if (!explicitPredictSuffix) {
      try {
        const cfgRes = await fetchFn(`${rootUrl}/config`, {
          method: 'GET',
          headers: { Accept: 'application/json', ...(headers.Authorization ? { Authorization: headers.Authorization } : {}) },
          signal: request.signal,
        });
        if (cfgRes && cfgRes.ok) {
          const cfgText = await this.readResponseText(cfgRes);
          const cfgJson = JSON.parse(cfgText);
          if (cfgJson && Array.isArray(cfgJson.dependencies)) {
            return await this.executeGradioWithConfig(
              provider,
              request,
              rootUrl,
              cfgJson,
              headers,
              fetchFn
            );
          }
        }
      } catch (err: any) {
        // Re-throw if it's a deliberate user-facing error from executeGradioWithConfig or abort
        if (
          err?.name === 'AbortError' ||
          (err instanceof Error && err.message.startsWith(`${provider.name} Gradio`))
        ) {
          throw err;
        }
        // Otherwise fall back to legacy /api/predict -> /run/predict calls
      }
    }

    // 2. Fallback: Direct /api/predict, /run/predict, or /gradio_api/run/predict
    const body = {
      data: [
        request.imageUrl || request.prompt,
        request.prompt,
        request.seed ?? 42,
        request.generateTextures !== false,
      ],
      fn_index: 0,
    };

    const candidateUrls = explicitPredictSuffix
      ? [baseUrl]
      : [
          `${rootUrl}/api/predict`,
          `${rootUrl}/run/predict`,
          `${rootUrl}/gradio_api/run/predict`,
          `${rootUrl}/gradio_api/api/predict`,
        ];

    let lastRes: Response | null = null;
    for (const predictUrl of candidateUrls) {
      lastRes = await fetchFn(predictUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (lastRes.status !== 404) {
        break;
      }
    }

    if (!lastRes || !lastRes.ok) {
      const errText = lastRes ? await lastRes.text().catch(() => '') : '';
      throw new Error(
        `${provider.name} Gradio error (${lastRes?.status || 'Network'}): ${errText || lastRes?.statusText || 'Failed'}`
      );
    }

    return await this.parseHttpResponseToMeshResult(
      lastRes,
      provider,
      rootUrl,
      fetchFn,
      request.signal,
      request.generateTextures !== false
    );
  }

  /**
   * Executes a single-stage or multi-stage 3D generation workflow (such as TRELLIS
   * preprocess_image -> image_to_3d -> extract_glb or Hunyuan3D generation_all)
   * using the live Gradio /config schema across Gradio 3, 4, and 5.
   */
  private static async executeGradioWithConfig(
    provider: Neural3DProviderConfig,
    request: Neural3DGenerationRequest,
    rootUrl: string,
    config: any,
    headers: Record<string, string>,
    fetchFn: typeof fetch
  ): Promise<Neural3DGenerationResult> {
    const apiPrefix =
      typeof config.api_prefix === 'string' && config.api_prefix.trim()
        ? '/' + config.api_prefix.trim().replace(/^\/+|\/+$/g, '')
        : '';
    const isGradio3 = String(config.version || '').trim().startsWith('3.');
    const sessionHash = Math.random().toString(36).substring(2, 13);

    const componentsMap = new Map<number, any>();
    if (Array.isArray(config.components)) {
      for (const comp of config.components) {
        if (comp && typeof comp.id === 'number') {
          componentsMap.set(comp.id, comp);
        }
      }
    }

    const rawDeps: any[] = Array.isArray(config.dependencies) ? config.dependencies : [];
    const deps = rawDeps.map((d, idx) => ({
      raw: d,
      fnIndex: typeof d?.id === 'number' ? d.id : idx,
      apiName:
        typeof d?.api_name === 'string' && d.api_name.trim()
          ? d.api_name.trim().replace(/^\/+/, '')
          : null,
      inputs: Array.isArray(d?.inputs) ? (d.inputs as number[]) : [],
      outputs: Array.isArray(d?.outputs) ? (d.outputs as number[]) : [],
      backendFn: d?.backend_fn !== false,
      queue: d?.queue,
    }));

    const backendDeps = deps.filter((d) => d.backendFn);

    // 1. Find primary generation dependency (and optional 2-stage extract_glb dependency)
    let mainDep =
      (!request.imageUrl
        ? backendDeps.find((d) =>
            ['text_to_3d', 'text2mesh', 'txt2mesh'].includes((d.apiName || '').toLowerCase())
          )
        : undefined) ||
      (request.generateTextures !== false
        ? backendDeps.find((d) => (d.apiName || '').toLowerCase() === 'generation_all')
        : undefined) ||
      backendDeps.find((d) =>
        [
          'image_to_3d',
          'img_to_3d',
          'shape_generation',
          'generation_all',
          'text_to_3d',
          'generate_3d',
          'generate_mesh',
          'generate',
          'predict',
          'run',
        ].includes((d.apiName || '').toLowerCase())
      );

    let extractDep = backendDeps.find((d) =>
      ['extract_glb', 'extract_mesh', 'export_glb', 'export_mesh'].includes(
        (d.apiName || '').toLowerCase()
      )
    );

    const isMeshOutputComp = (id: number) => {
      const t = (componentsMap.get(id)?.type || '').toLowerCase();
      return t === 'model3d' || t === 'file' || t === 'downloadbutton';
    };
    const isInputPromptComp = (id: number) => {
      const t = (componentsMap.get(id)?.type || '').toLowerCase();
      return t === 'image' || t === 'textbox' || t === 'text';
    };

    // Component-graph discovery if api_name is unnamed/custom
    if (!mainDep) {
      // Look for 1-stage: (image/textbox) -> (model3d/file/downloadbutton)
      mainDep = backendDeps.find(
        (d) => d.inputs.some(isInputPromptComp) && d.outputs.some(isMeshOutputComp)
      );
    }

    if (!mainDep) {
      // Look for 2-stage (like TRELLIS when api_name is unnamed):
      // Stage 1: (image/textbox) -> state(S), Stage 2: state(S) -> (model3d/file/downloadbutton)
      for (const candidate of backendDeps) {
        if (!candidate.inputs.some(isInputPromptComp)) continue;
        const stateOutIds = candidate.outputs.filter(
          (id) => (componentsMap.get(id)?.type || '').toLowerCase() === 'state'
        );
        if (stateOutIds.length > 0) {
          const matchingExtract = backendDeps.find(
            (d2) =>
              d2 !== candidate &&
              stateOutIds.some((sid) => d2.inputs.includes(sid)) &&
              d2.outputs.some(isMeshOutputComp)
          );
          if (matchingExtract) {
            mainDep = candidate;
            if (!extractDep) extractDep = matchingExtract;
            break;
          }
        }
      }
    }

    if (!mainDep) {
      mainDep = backendDeps[0] || deps[0];
    }

    if (!mainDep) {
      throw new Error(`${provider.name} Gradio error: No callable dependencies found in /config.`);
    }

    // If mainDep outputs a state component and doesn't directly output a model3d, locate matching extractor
    if (!extractDep && !mainDep.outputs.some(isMeshOutputComp)) {
      const stateOutIds = mainDep.outputs.filter(
        (id) => (componentsMap.get(id)?.type || '').toLowerCase() === 'state'
      );
      if (stateOutIds.length > 0) {
        extractDep = backendDeps.find(
          (d2) =>
            d2 !== mainDep &&
            stateOutIds.some((sid) => d2.inputs.includes(sid)) &&
            d2.outputs.some(isMeshOutputComp)
        );
      }
    }

    // Verify if mainDep strictly requires an input image (Image-to-3D only) when no image was provided
    const hasImageInput = mainDep.inputs.some(
      (id) => (componentsMap.get(id)?.type || '').toLowerCase() === 'image'
    );
    const hasTextInput = mainDep.inputs.some((id) =>
      ['textbox', 'text'].includes((componentsMap.get(id)?.type || '').toLowerCase())
    );

    if (hasImageInput && !hasTextInput && !request.imageUrl) {
      throw new Error(
        `${provider.name} Gradio server at ${rootUrl} is running an Image-to-3D pipeline (${mainDep.apiName || 'image_to_3d'}) and requires an input image. Please attach a reference image (Image button) or enable '+ 3D View' in the AI Mesh Agent.`
      );
    }

    const stateByComponentId = new Map<number, any>();

    // 2. Upload input image if provided
    let uploadedImageInput: any = null;
    if (request.imageUrl) {
      request.onStatus?.(`Uploading reference image to ${provider.name} (Gradio)...`);
      uploadedImageInput = await this.uploadGradioImage(
        rootUrl,
        apiPrefix,
        request.imageUrl,
        isGradio3,
        sessionHash,
        headers,
        fetchFn,
        request.signal
      );
    }

    // 3. Optional start_session step (used by TRELLIS to create session tmp dir)
    const startSessionDep = backendDeps.find(
      (d) => (d.apiName || '').toLowerCase() === 'start_session' && d.inputs.length === 0
    );
    if (startSessionDep) {
      try {
        await this.callGradioDependency(
          rootUrl,
          apiPrefix,
          startSessionDep,
          [],
          sessionHash,
          isGradio3,
          provider.name,
          headers,
          fetchFn,
          request.signal
        );
      } catch {
        // Ignore non-fatal start_session errors
      }
    }

    // 4. Optional preprocess_image step (used by TRELLIS to remove background before image_to_3d)
    const primaryImageCompId = mainDep.inputs.find(
      (id) => (componentsMap.get(id)?.type || '').toLowerCase() === 'image'
    );
    if (uploadedImageInput && primaryImageCompId !== undefined) {
      stateByComponentId.set(primaryImageCompId, uploadedImageInput);
      const preprocessDep = backendDeps.find(
        (d) =>
          d !== mainDep &&
          ((d.apiName || '').toLowerCase() === 'preprocess_image' ||
            (d.inputs.length === 1 &&
              d.outputs.length === 1 &&
              d.inputs[0] === primaryImageCompId &&
              d.outputs[0] === primaryImageCompId))
      );
      if (preprocessDep) {
        try {
          request.onStatus?.(`${provider.name}: preprocessing reference image...`);
          const prepOut = await this.callGradioDependency(
            rootUrl,
            apiPrefix,
            preprocessDep,
            [uploadedImageInput],
            sessionHash,
            isGradio3,
            provider.name,
            headers,
            fetchFn,
            request.signal,
            request.onStatus
          );
          if (prepOut?.data?.[0]) {
            stateByComponentId.set(primaryImageCompId, prepOut.data[0]);
          }
        } catch {
          // Keep original uploaded image if preprocess_image is optional or fails
        }
      }
    }

    // 5. Build inputs for mainDep and execute 3D generation
    const mainInputs = this.buildGradioInputsForDependency(
      mainDep.inputs,
      componentsMap,
      stateByComponentId,
      request,
      uploadedImageInput
    );

    request.onStatus?.(
      `${provider.name}: running ${mainDep.apiName || '3D generation'} on Gradio...`
    );
    const mainOut = await this.callGradioDependency(
      rootUrl,
      apiPrefix,
      mainDep,
      mainInputs,
      sessionHash,
      isGradio3,
      provider.name,
      headers,
      fetchFn,
      request.signal,
      request.onStatus
    );

    if (Array.isArray(mainOut?.data)) {
      mainDep.outputs.forEach((outCompId, idx) => {
        if (idx < mainOut.data.length && mainOut.data[idx] !== undefined) {
          stateByComponentId.set(outCompId, mainOut.data[idx]);
        }
      });
    }

    // Check if mainOut already returned a 3D mesh URL/file (e.g. Hunyuan3D or 1-stage TRELLIS)
    const directUrl = this.extractModelUrlFromJson(
      mainOut,
      rootUrl,
      apiPrefix,
      request.generateTextures !== false
    );

    let finalJsonPayload = mainOut;

    // 6. If no 3D mesh file yet and extractDep exists (e.g. TRELLIS extract_glb), execute Stage 2!
    if (!directUrl && extractDep) {
      request.onStatus?.(`${provider.name}: extracting GLB mesh (${extractDep.apiName || 'extract_glb'})...`);
      const extractInputs = this.buildGradioInputsForDependency(
        extractDep.inputs,
        componentsMap,
        stateByComponentId,
        request,
        uploadedImageInput
      );
      finalJsonPayload = await this.callGradioDependency(
        rootUrl,
        apiPrefix,
        extractDep,
        extractInputs,
        sessionHash,
        isGradio3,
        provider.name,
        headers,
        fetchFn,
        request.signal,
        request.onStatus
      );
    }

    const syntheticRes = new Response(JSON.stringify(finalJsonPayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    return await this.parseHttpResponseToMeshResult(
      syntheticRes,
      provider,
      rootUrl,
      fetchFn,
      request.signal,
      request.generateTextures !== false,
      apiPrefix
    );
  }

  private static buildGradioInputsForDependency(
    inputIds: number[],
    componentsMap: Map<number, any>,
    stateByComponentId: Map<number, any>,
    request: Neural3DGenerationRequest,
    uploadedImageInput: any
  ): any[] {
    let primaryImageAssigned = false;
    let primaryTextAssigned = false;

    return inputIds.map((compId) => {
      if (stateByComponentId.has(compId)) {
        return stateByComponentId.get(compId);
      }

      const comp = componentsMap.get(compId);
      if (!comp) return null;

      const type = String(comp.type || '').toLowerCase();
      const props = comp.props || {};
      const label = String(props.label || props.name || '').toLowerCase();

      if (type === 'state') {
        return props.value ?? null;
      }

      if (type === 'image') {
        const isSecondaryMultiView = /\b(back|left|right|bottom|top)\b/i.test(label);
        if (!primaryImageAssigned && !isSecondaryMultiView && uploadedImageInput) {
          primaryImageAssigned = true;
          return uploadedImageInput;
        }
        return null;
      }

      if (type === 'gallery') {
        return Array.isArray(props.value) ? props.value : [];
      }

      if (type === 'textbox' || type === 'text') {
        if (!primaryTextAssigned || /prompt|caption|description|text/i.test(label)) {
          primaryTextAssigned = true;
          return request.prompt || props.value || '';
        }
        return props.value ?? '';
      }

      if (type === 'number' || type === 'slider') {
        if (label.includes('seed')) {
          return typeof request.seed === 'number' ? request.seed : (props.value ?? 42);
        }
        if (label.includes('octree')) {
          return request.octreeResolution || props.value || 256;
        }
        return props.value !== undefined && props.value !== null
          ? props.value
          : (props.minimum ?? 1);
      }

      if (type === 'checkbox') {
        if (label.includes('random') && label.includes('seed')) {
          return typeof request.seed === 'number' ? false : (props.value ?? true);
        }
        if (label.includes('texture')) {
          return request.generateTextures !== false;
        }
        return props.value !== undefined ? Boolean(props.value) : true;
      }

      if (type === 'radio' || type === 'dropdown') {
        if (props.value !== undefined && props.value !== null) {
          return props.value;
        }
        if (Array.isArray(props.choices) && props.choices.length > 0) {
          const first = props.choices[0];
          return Array.isArray(first) ? first[1] : first;
        }
        return null;
      }

      return props.value ?? null;
    });
  }

  private static async uploadGradioImage(
    rootUrl: string,
    apiPrefix: string,
    imageUrl: string,
    isGradio3: boolean,
    uploadId: string,
    headers: Record<string, string>,
    fetchFn: typeof fetch,
    signal?: AbortSignal
  ): Promise<any> {
    if (isGradio3 && imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    try {
      let bytes: Uint8Array;
      let mimeType = 'image/png';

      if (imageUrl.startsWith('data:')) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          mimeType = match[1] || 'image/png';
          bytes = this.decodeBase64(match[2]);
        } else {
          return imageUrl;
        }
      } else {
        const imgRes = await fetchFn(imageUrl, { method: 'GET', signal });
        if (!imgRes.ok) return imageUrl;
        mimeType = imgRes.headers?.get?.('content-type') || 'image/png';
        bytes = new Uint8Array(await imgRes.arrayBuffer());
      }

      if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
        return imageUrl;
      }

      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
      const fileName = `input.${ext}`;
      const formData = new FormData();
      formData.append('files', new Blob([bytes as unknown as BlobPart], { type: mimeType }), fileName);

      const uploadHeaders: Record<string, string> = {};
      if (headers.Authorization) {
        uploadHeaders.Authorization = headers.Authorization;
      }

      const uploadCandidates = apiPrefix
        ? [`${rootUrl}${apiPrefix}/upload?upload_id=${uploadId}`, `${rootUrl}/upload?upload_id=${uploadId}`]
        : [`${rootUrl}/upload?upload_id=${uploadId}`, `${rootUrl}/gradio_api/upload?upload_id=${uploadId}`];

      for (const uploadUrl of uploadCandidates) {
        const upRes = await fetchFn(uploadUrl, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData as any,
          signal,
        });
        if (upRes && upRes.ok) {
          const upText = await this.readResponseText(upRes);
          const upJson = JSON.parse(upText);
          const uploadedItem = Array.isArray(upJson) ? upJson[0] : upJson;
          const uploadedPath =
            typeof uploadedItem === 'string' ? uploadedItem : uploadedItem?.path || uploadedItem?.name;
          if (typeof uploadedPath === 'string' && uploadedPath.trim()) {
            return {
              path: uploadedPath,
              url: `${rootUrl}${apiPrefix}/file=${uploadedPath}`,
              orig_name: fileName,
              size: bytes.byteLength,
              mime_type: mimeType,
              is_stream: false,
              meta: { _type: 'gradio.FileData' },
            };
          }
        }
        if (upRes && upRes.status !== 404) {
          break;
        }
      }
    } catch {
      // Fall back to passing imageUrl directly
    }

    return imageUrl;
  }

  private static async callGradioDependency(
    rootUrl: string,
    apiPrefix: string,
    dep: { fnIndex: number; apiName: string | null; queue?: boolean },
    data: any[],
    sessionHash: string,
    isGradio3: boolean,
    providerName: string,
    headers: Record<string, string>,
    fetchFn: typeof fetch,
    signal?: AbortSignal,
    onStatus?: (status: string) => void
  ): Promise<{ data: any[] }> {
    const payload = {
      data,
      event_data: null,
      fn_index: dep.fnIndex,
      session_hash: sessionHash,
    };

    // 1. Gradio 4 / 5 /call/<apiName> SSE endpoint (preferred when apiName is known and queue !== false)
    if (!isGradio3 && dep.apiName && dep.queue !== false) {
      const callUrl = `${rootUrl}${apiPrefix}/call/${dep.apiName}`;
      const callRes = await fetchFn(callUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
      if (callRes && callRes.ok) {
        const callText = await this.readResponseText(callRes);
        const callJson = JSON.parse(callText);
        if (callJson?.event_id) {
          const streamUrl = `${rootUrl}${apiPrefix}/call/${dep.apiName}/${callJson.event_id}`;
          const streamRes = await fetchFn(streamUrl, {
            method: 'GET',
            headers: {
              Accept: 'text/event-stream',
              ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
            },
            signal,
          });
          if (!streamRes.ok) {
            const errText = await this.readResponseText(streamRes).catch(() => '');
            throw new Error(
              `${providerName} Gradio stream error (${streamRes.status}): ${errText || streamRes.statusText}`
            );
          }
          return await this.readGradioSseStream(streamRes, providerName, onStatus);
        }
        if (Array.isArray(callJson?.data)) {
          return callJson;
        }
      }
    }

    // 2. Gradio 3 / 4 / 5 /queue/join + /queue/data SSE endpoint (works even when apiName is null/false or show_api=False)
    if (dep.queue !== false) {
      const joinUrl = `${rootUrl}${apiPrefix}/queue/join`;
      const joinRes = await fetchFn(joinUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
      if (joinRes && joinRes.ok) {
        const streamUrl = `${rootUrl}${apiPrefix}/queue/data?session_hash=${encodeURIComponent(sessionHash)}`;
        const streamRes = await fetchFn(streamUrl, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
          },
          signal,
        });
        if (streamRes && streamRes.ok) {
          return await this.readGradioSseStream(streamRes, providerName, onStatus);
        }
      }
    }

    // 3. Synchronous /run/<apiName>, /run/predict, /api/predict fallback
    const syncUrls: string[] = [];
    if (dep.apiName) {
      syncUrls.push(`${rootUrl}${apiPrefix}/run/${dep.apiName}`);
    }
    syncUrls.push(`${rootUrl}${apiPrefix}/run/predict`);
    syncUrls.push(`${rootUrl}${apiPrefix}/api/predict`);
    if (apiPrefix) {
      syncUrls.push(`${rootUrl}/run/predict`);
      syncUrls.push(`${rootUrl}/api/predict`);
    }

    let lastRes: Response | null = null;
    for (const url of syncUrls) {
      lastRes = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
      if (lastRes && lastRes.status !== 404) {
        break;
      }
    }

    if (!lastRes || !lastRes.ok) {
      const errText = lastRes ? await this.readResponseText(lastRes).catch(() => '') : '';
      throw new Error(
        `${providerName} Gradio error (${lastRes?.status || 'Network'}): ${errText || lastRes?.statusText || 'Failed'}`
      );
    }

    const syncText = await this.readResponseText(lastRes);
    const syncJson = JSON.parse(syncText);
    return Array.isArray(syncJson?.data) ? syncJson : { data: Array.isArray(syncJson) ? syncJson : [syncJson] };
  }

  private static async readGradioSseStream(
    res: Response,
    providerName: string,
    onStatus?: (status: string) => void
  ): Promise<{ data: any[] }> {
    const parseEvents = (
      rawSse: string
    ): { done: boolean; result?: { data: any[] }; error?: string } => {
      const lines = rawSse.split(/\r?\n/);
      let currentEvent = '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          currentEvent = '';
          continue;
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          if (currentEvent === 'error') {
            let errMsg = dataStr;
            try {
              const parsedErr = JSON.parse(dataStr);
              errMsg =
                typeof parsedErr === 'string'
                  ? parsedErr
                  : parsedErr?.error || parsedErr?.message || JSON.stringify(parsedErr);
            } catch {
              // keep raw string
            }
            return { done: true, error: `${providerName} Gradio error: ${errMsg}` };
          }

          if (currentEvent === 'complete') {
            try {
              const parsed = JSON.parse(dataStr);
              return {
                done: true,
                result: { data: Array.isArray(parsed) ? parsed : [parsed] },
              };
            } catch {
              // wait for full JSON line
            }
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              if (parsed.msg === 'process_starts') {
                onStatus?.(`${providerName}: processing in Gradio...`);
              } else if (
                parsed.msg === 'progress' &&
                Array.isArray(parsed.progress_data) &&
                parsed.progress_data[0]
              ) {
                const p = parsed.progress_data[0];
                if (typeof p.index === 'number' && typeof p.length === 'number') {
                  onStatus?.(
                    `${providerName}: step ${p.index}/${p.length} ${p.unit || ''}...`.trim()
                  );
                }
              } else if (parsed.msg === 'process_completed') {
                if (parsed.success === false || parsed.output?.error) {
                  return {
                    done: true,
                    error: `${providerName} Gradio error: ${parsed.output?.error || 'Process failed'}`,
                  };
                }
                if (Array.isArray(parsed.output?.data)) {
                  return { done: true, result: { data: parsed.output.data } };
                }
              } else if (Array.isArray(parsed.data)) {
                return { done: true, result: { data: parsed.data } };
              }
            }
          } catch {
            // Ignore partial chunk lines
          }
        }
      }
      return { done: false };
    };

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const check = parseEvents(accumulated);
          if (check.done) {
            await reader.cancel().catch(() => {});
            if (check.error) throw new Error(check.error);
            if (check.result) return check.result;
          }
        }
        accumulated += decoder.decode();
      } finally {
        reader.releaseLock?.();
      }
      const finalCheck = parseEvents(accumulated);
      if (finalCheck.error) throw new Error(finalCheck.error);
      if (finalCheck.result) return finalCheck.result;
      throw new Error(`${providerName} Gradio stream ended without returning completion data.`);
    }

    const fullText = await this.readResponseText(res);
    const check = parseEvents(fullText);
    if (check.error) throw new Error(check.error);
    if (check.result) return check.result;
    throw new Error(`${providerName} Gradio stream ended without returning completion data.`);
  }

  private static async readResponseText(res: Response): Promise<string> {
    if (typeof res.text === 'function') {
      return await res.text();
    }
    if (typeof res.arrayBuffer === 'function') {
      const ab = await res.arrayBuffer();
      return new TextDecoder().decode(new Uint8Array(ab));
    }
    return '';
  }

  private static async executeFalRequest(
    provider: Neural3DProviderConfig,
    request: Neural3DGenerationRequest,
    fetchFn: typeof fetch
  ): Promise<Neural3DGenerationResult> {
    const url = provider.endpointUrl.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (provider.apiKey && provider.apiKey.trim()) {
      const key = provider.apiKey.trim();
      headers['Authorization'] = key.startsWith('Key ') || key.startsWith('Bearer ') ? key : `Key ${key}`;
    }

    const payload: Record<string, any> = {
      prompt: request.prompt,
      texture: request.generateTextures !== false,
    };
    if (request.imageUrl) {
      payload.image_url = request.imageUrl;
    }
    if (typeof request.seed === 'number') {
      payload.seed = request.seed;
    }

    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${provider.name} (Fal.ai) error (${res.status}): ${errText || res.statusText}`);
    }

    return await this.parseHttpResponseToMeshResult(res, provider, url, fetchFn, request.signal);
  }

  private static async executeReplicateRequest(
    provider: Neural3DProviderConfig,
    request: Neural3DGenerationRequest,
    fetchFn: typeof fetch
  ): Promise<Neural3DGenerationResult> {
    const url = provider.endpointUrl.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'wait',
    };
    if (provider.apiKey && provider.apiKey.trim()) {
      const key = provider.apiKey.trim();
      headers['Authorization'] = key.startsWith('Bearer ') || key.startsWith('Token ') ? key : `Bearer ${key}`;
    }

    const payload = {
      version: provider.modelId || provider.id,
      model: provider.modelId || provider.id,
      input: {
        prompt: request.prompt,
        image: request.imageUrl,
        generate_model: true,
        texture: request.generateTextures !== false,
      },
    };

    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `${provider.name} (Replicate) error (${res.status}): ${errText || res.statusText}`
      );
    }

    return await this.parseHttpResponseToMeshResult(res, provider, url, fetchFn, request.signal);
  }

  /**
   * Inspects an HTTP response (binary GLB/OBJ/STL or JSON with base64 / file URL / raw mesh data)
   * and normalizes it into a Neural3DGenerationResult.
   */
  public static async parseHttpResponseToMeshResult(
    res: Response,
    provider: Neural3DProviderConfig,
    baseEndpointUrl: string,
    fetchFn: typeof fetch,
    signal?: AbortSignal,
    preferTextured: boolean = true,
    gradioApiPrefix: string = ''
  ): Promise<Neural3DGenerationResult> {
    const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();

    // 1. Direct binary response (model/gltf-binary, application/octet-stream, model/stl, model/obj)
    if (
      contentType.includes('model/gltf-binary') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('model/stl') ||
      contentType.includes('model/obj')
    ) {
      const ab = await res.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const format = this.detectBinaryFormat(bytes, contentType);
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format,
        data: bytes,
      };
    }

    // Read arrayBuffer first so we can handle both binary responses missing Content-Type and JSON/text
    const rawBuffer = await res.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    // Check for glTF binary magic header "glTF" (0x67, 0x6C, 0x54, 0x46)
    if (
      rawBytes.length >= 4 &&
      rawBytes[0] === 0x67 &&
      rawBytes[1] === 0x6c &&
      rawBytes[2] === 0x54 &&
      rawBytes[3] === 0x46
    ) {
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format: 'glb',
        data: rawBytes,
      };
    }

    const text = new TextDecoder().decode(rawBytes).trim();

    // Check if response is raw Wavefront OBJ text
    if (
      (text.startsWith('#') || text.startsWith('v ') || text.startsWith('o ')) &&
      /\nv\s+[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+/.test('\n' + text)
    ) {
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format: 'obj',
        data: rawBytes,
        textData: text,
      };
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `Unexpected non-JSON, non-binary response from ${provider.name}: ${text.slice(0, 180)}`
      );
    }

    // 2. Direct JSON mesh vertices/indices representation
    const meshDataObj = json?.mesh_data || json?.geometry || (Array.isArray(json?.positions) || Array.isArray(json?.vertices) ? json : null);
    if (
      meshDataObj &&
      (Array.isArray(meshDataObj.positions) || Array.isArray(meshDataObj.vertices)) &&
      (Array.isArray(meshDataObj.indices) || Array.isArray(meshDataObj.faces))
    ) {
      const rawPositions = meshDataObj.positions || meshDataObj.vertices;
      const positions: number[] = Array.isArray(rawPositions[0])
        ? rawPositions.flat().map(Number)
        : rawPositions.map(Number);

      const rawIndices = meshDataObj.indices || meshDataObj.faces;
      const indices: number[] = Array.isArray(rawIndices[0])
        ? rawIndices.flat().map(Number)
        : rawIndices.map(Number);

      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format: 'json_mesh',
        data: rawBytes,
        textData: text,
        jsonMesh: {
          positions,
          indices,
          normals: Array.isArray(meshDataObj.normals) ? meshDataObj.normals.flat().map(Number) : undefined,
          uvs: Array.isArray(meshDataObj.uvs) ? meshDataObj.uvs.flat().map(Number) : undefined,
          colors: Array.isArray(meshDataObj.colors) ? meshDataObj.colors.flat().map(Number) : undefined,
        },
      };
    }

    // 3. Wavefront OBJ text inside JSON
    const objText = json?.obj || json?.obj_text || json?.data?.[0]?.obj;
    if (typeof objText === 'string' && objText.includes('v ')) {
      const encoded = new TextEncoder().encode(objText);
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format: 'obj',
        data: encoded,
        textData: objText,
      };
    }

    // 4. Base64-encoded GLB/OBJ/STL inside JSON
    const b64Candidate =
      json?.glb_base64 ||
      json?.b64_glb ||
      json?.mesh_base64 ||
      json?.model_base64 ||
      json?.file_base64 ||
      json?.b64_json ||
      json?.data?.[0]?.b64_glb ||
      json?.data?.[0]?.b64_json ||
      json?.data?.[0]?.glb_base64;

    if (typeof b64Candidate === 'string' && b64Candidate.trim().length > 0) {
      const cleanB64 = b64Candidate
        .trim()
        .replace(/^data:[^;]+;base64,/, '');
      const decodedBytes = this.decodeBase64(cleanB64);
      const format = this.detectBinaryFormat(decodedBytes, json?.format || 'glb');
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format,
        data: decodedBytes,
        textData: format === 'obj' ? new TextDecoder().decode(decodedBytes) : undefined,
      };
    }

    // 5. URL reference inside JSON (Fal.ai, Replicate, Gradio, oMLX file URL)
    const extractedUrl = this.extractModelUrlFromJson(
      json,
      baseEndpointUrl,
      gradioApiPrefix,
      preferTextured
    );
    if (extractedUrl) {
      let fileRes = await fetchFn(extractedUrl, {
        method: 'GET',
        signal,
      });

      // Fallback for Gradio 5 /gradio_api/file= vs Gradio 3/4 /file=
      if (fileRes.status === 404 && extractedUrl.includes('/file=')) {
        const altUrl = extractedUrl.includes('/gradio_api/file=')
          ? extractedUrl.replace('/gradio_api/file=', '/file=')
          : extractedUrl.replace('/file=', '/gradio_api/file=');
        const altRes = await fetchFn(altUrl, {
          method: 'GET',
          signal,
        });
        if (altRes.ok) {
          fileRes = altRes;
        }
      }

      if (!fileRes.ok) {
        throw new Error(
          `Failed to download generated 3D model from ${extractedUrl} (HTTP ${fileRes.status})`
        );
      }
      const fileBuf = await fileRes.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuf);
      const format = this.detectBinaryFormat(fileBytes, extractedUrl);
      return {
        providerId: provider.id,
        providerName: provider.name,
        modelId: provider.modelId || provider.id,
        format,
        data: fileBytes,
        textData: format === 'obj' ? new TextDecoder().decode(fileBytes) : undefined,
        sourceUrl: extractedUrl,
      };
    }

    throw new Error(
      `Could not extract 3D mesh (GLB/OBJ/STL) from ${provider.name} response.`
    );
  }

  public static extractModelUrlFromJson(
    json: any,
    baseEndpointUrl: string,
    gradioApiPrefix: string = '',
    preferTextured: boolean = true
  ): string | null {
    if (!json || typeof json !== 'object') return null;

    const isNonMeshMediaUrl = (s: string) =>
      /\.(mp4|webm|mov|avi|png|jpg|jpeg|webp|gif|svg|html|json)(\?.*)?$/i.test(s.trim());
    const isMeshExtension = (s: string) =>
      /\.(glb|gltf|obj|stl|ply)(\?.*)?$/i.test(s.trim());

    const rawCandidates: string[] = [];
    const pushCandidate = (val: any, isGradioFilePath: boolean = false) => {
      if (typeof val !== 'string' || !val.trim()) return;
      const trimmed = val.trim();
      if (trimmed.startsWith('<') || isNonMeshMediaUrl(trimmed)) return;
      if (isGradioFilePath) {
        rawCandidates.push(
          this.resolveGradioFileUrl(baseEndpointUrl, trimmed, gradioApiPrefix)
        );
      } else {
        rawCandidates.push(trimmed);
      }
    };

    pushCandidate(json.url);
    pushCandidate(json.glb_url);
    pushCandidate(json.mesh_url);
    pushCandidate(json.model_url);
    pushCandidate(json.model_mesh?.url);
    pushCandidate(json.mesh?.url);
    pushCandidate(json.glb?.url);
    pushCandidate(json.output?.model);
    pushCandidate(json.output?.glb);
    pushCandidate(json.output?.mesh);
    if (typeof json.output === 'string') {
      pushCandidate(json.output);
    } else if (Array.isArray(json.output)) {
      const meshOut =
        json.output.find((item: any) => typeof item === 'string' && isMeshExtension(item)) ||
        json.output[0];
      pushCandidate(meshOut);
    }

    // Inspect all elements of json.data (Gradio outputs array)
    if (Array.isArray(json.data)) {
      const gradioUrls: string[] = [];
      const extractFromGradioItem = (item: any) => {
        if (!item) return;
        if (typeof item === 'string') {
          const s = item.trim();
          if (!s || s.startsWith('<') || isNonMeshMediaUrl(s)) return;
          if (
            s.startsWith('http://') ||
            s.startsWith('https://') ||
            s.startsWith('data:') ||
            s.startsWith('/file=') ||
            s.startsWith('/gradio_api/file=')
          ) {
            gradioUrls.push(s);
          } else if (
            isMeshExtension(s) ||
            /^(\/|[a-zA-Z]:\\)/.test(s)
          ) {
            gradioUrls.push(
              this.resolveGradioFileUrl(baseEndpointUrl, s, gradioApiPrefix)
            );
          }
          return;
        }
        if (typeof item === 'object') {
          // Handle gr.update(value=...) wrapper
          if (item.value !== undefined && item.value !== null && item.value !== item) {
            extractFromGradioItem(item.value);
          }
          if (typeof item.url === 'string' && item.url.trim() && !isNonMeshMediaUrl(item.url)) {
            gradioUrls.push(item.url.trim());
          } else if (
            typeof item.path === 'string' &&
            item.path.trim() &&
            !isNonMeshMediaUrl(item.path)
          ) {
            gradioUrls.push(
              this.resolveGradioFileUrl(baseEndpointUrl, item.path.trim(), gradioApiPrefix)
            );
          } else if (
            typeof item.name === 'string' &&
            item.name.trim() &&
            !isNonMeshMediaUrl(item.name)
          ) {
            gradioUrls.push(
              this.resolveGradioFileUrl(baseEndpointUrl, item.name.trim(), gradioApiPrefix)
            );
          }
        }
      };

      for (const item of json.data) {
        extractFromGradioItem(item);
      }

      if (gradioUrls.length > 0) {
        // Prefer explicitly textured mesh URL when preferTextured is true (e.g. Hunyuan3D [white_mesh.glb, textured_mesh.glb])
        if (preferTextured && gradioUrls.length > 1) {
          const texturedMatch = gradioUrls.find((u) => /textured|paint|color/i.test(u));
          if (texturedMatch) {
            rawCandidates.push(texturedMatch);
          }
        }
        for (const u of gradioUrls) {
          rawCandidates.push(u);
        }
      }
    }

    for (const c of rawCandidates) {
      if (typeof c === 'string' && c.trim()) {
        const val = c.trim();
        if (
          val.startsWith('http://') ||
          val.startsWith('https://') ||
          val.startsWith('data:') ||
          val.startsWith('/')
        ) {
          if (val.startsWith('/') && /^https?:\/\//i.test(baseEndpointUrl)) {
            try {
              const u = new URL(baseEndpointUrl);
              return `${u.origin}${val}`;
            } catch {
              return val;
            }
          }
          return val;
        }
      }
    }
    return null;
  }

  private static resolveGradioFileUrl(
    baseEndpointUrl: string,
    filePath: string,
    gradioApiPrefix: string = ''
  ): string {
    const cleanBase = baseEndpointUrl
      .replace(/\/(gradio_api\/)?(api|run|call)\/.*$/i, '')
      .replace(/\/+$/, '');
    const prefix = gradioApiPrefix
      ? '/' + gradioApiPrefix.replace(/^\/+|\/+$/g, '')
      : '';
    // Preserve leading slash for absolute Unix paths (/tmp/..., /var/..., /Users/...) required by Gradio /file=
    const normalizedPath = filePath.trim();
    return `${cleanBase}${prefix}/file=${normalizedPath}`;
  }

  public static detectBinaryFormat(bytes: Uint8Array, hint: string = ''): 'glb' | 'obj' | 'stl' {
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x67 &&
      bytes[1] === 0x6c &&
      bytes[2] === 0x54 &&
      bytes[3] === 0x46
    ) {
      return 'glb';
    }
    const lowerHint = (hint || '').toLowerCase();
    if (lowerHint.includes('.obj') || lowerHint.includes('model/obj') || lowerHint === 'obj') {
      return 'obj';
    }
    if (lowerHint.includes('.stl') || lowerHint.includes('model/stl') || lowerHint === 'stl') {
      return 'stl';
    }
    // Check if ASCII text looks like Wavefront OBJ
    if (bytes.length > 4 && bytes.length < 50_000_000) {
      const head = new TextDecoder().decode(bytes.subarray(0, Math.min(256, bytes.length)));
      if ((head.startsWith('#') || head.startsWith('v ') || head.startsWith('o ')) && head.includes('v ')) {
        return 'obj';
      }
    }
    return 'glb';
  }

  public static decodeBase64(b64: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const binStr = atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Tests connectivity to a configured Neural 3D Generator endpoint.
   */
  public static async testProviderConnection(
    provider: Neural3DProviderConfig,
    customFetch?: typeof fetch | null
  ): Promise<{ ok: boolean; message: string }> {
    const fetchFn = customFetch || globalThis.fetch.bind(globalThis);
    const rawUrl = (provider.endpointUrl || '').trim();
    if (!rawUrl) {
      return { ok: false, message: 'Endpoint URL is empty.' };
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (provider.apiKey && provider.apiKey.trim()) {
      const key = provider.apiKey.trim();
      headers['Authorization'] =
        provider.protocol === 'fal' && !key.startsWith('Key ')
          ? `Key ${key}`
          : key.startsWith('Bearer ') || key.startsWith('Key ')
            ? key
            : `Bearer ${key}`;
    }

    // Build ordered candidate probe URLs based on protocol
    const probeUrls: string[] = [];
    try {
      const parsed = new URL(rawUrl);
      if (provider.protocol === 'omlx') {
        probeUrls.push(`${parsed.origin}/v1/models`, `${parsed.origin}/health`, rawUrl);
      } else if (provider.protocol === 'gradio') {
        const cleanGradioBase = rawUrl
          .replace(/\/(gradio_api\/)?(api|run|call)\/.*$/i, '')
          .replace(/\/(gradio_api\/)?(info|config)$/i, '')
          .replace(/\/+$/, '');
        // /config is always available across Gradio 3, 4, and 5 (even when show_api=False)
        probeUrls.push(
          `${cleanGradioBase}/config`,
          `${cleanGradioBase}/gradio_api/info`,
          `${cleanGradioBase}/info`,
          `${cleanGradioBase}/`
        );
      } else if (provider.protocol === 'local_rest') {
        probeUrls.push(`${parsed.origin}/health`, `${parsed.origin}/docs`, rawUrl);
      } else {
        probeUrls.push(rawUrl);
      }
    } catch {
      probeUrls.push(rawUrl);
    }

    let lastStatus = 0;
    let lastStatusText = '';
    for (const probeUrl of probeUrls) {
      try {
        const res = await fetchFn(probeUrl, {
          method: 'GET',
          headers,
        });
        lastStatus = res.status;
        lastStatusText = res.statusText || '';

        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            message: `${provider.name} reachable, but authentication failed (HTTP ${res.status}). Check API Key.`,
          };
        }

        // For POST-only endpoints (like /generate or fal.run), 405 Method Not Allowed or 422 means the server is alive and reachable
        if (res.ok || res.status === 405 || res.status === 422) {
          if (provider.protocol === 'gradio' && probeUrl.endsWith('/config') && res.ok) {
            try {
              const cfgText = await this.readResponseText(res);
              const cfgJson = JSON.parse(cfgText);
              if (cfgJson && (cfgJson.version || Array.isArray(cfgJson.dependencies))) {
                const ver = cfgJson.version ? ` v${cfgJson.version}` : '';
                const epCount = Array.isArray(cfgJson.dependencies)
                  ? `, ${cfgJson.dependencies.length} endpoints`
                  : '';
                return {
                  ok: true,
                  message: `${provider.name} reachable (Gradio${ver}${epCount}).`,
                };
              }
            } catch {
              // Fall through to standard success message
            }
          }
          return {
            ok: true,
            message: `${provider.name} reachable (${provider.protocol}, HTTP ${res.status}).`,
          };
        }

        // If 404, try the next candidate probe URL
        if (res.status === 404) {
          continue;
        }
      } catch (err: any) {
        if (probeUrl === probeUrls[probeUrls.length - 1]) {
          return {
            ok: false,
            message: `Could not reach ${provider.name} at ${rawUrl}: ${err?.message || String(err)}`,
          };
        }
      }
    }

    return {
      ok: false,
      message: `${provider.name} returned HTTP ${lastStatus || 404} (${lastStatusText || 'Not Found'}).`,
    };
  }
}

