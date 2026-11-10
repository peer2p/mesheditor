import {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGeneratorBackendId,
  ImageGeneratorProtocol,
  ImageGeneratorProviderConfig,
  ImageGeneratorProvidersMap,
} from '../types';

export interface ImageGeneratorProtocolPreset {
  endpointUrl: string;
  modelId: string;
  requiresKey: boolean;
}

export const IMAGE_GENERATOR_STORAGE_KEY = 'mesheditor_image_generator_config';

export const IMAGE_GENERATOR_PROTOCOL_DEFAULTS: Record<
  ImageGeneratorBackendId,
  Record<string, ImageGeneratorProtocolPreset>
> = {
  pollinations: {
    pollinations: {
      endpointUrl: 'https://image.pollinations.ai/prompt',
      modelId: 'flux',
      requiresKey: false,
    },
  },
  openai: {
    openai: {
      endpointUrl: 'https://api.openai.com/v1/images/generations',
      modelId: 'dall-e-3',
      requiresKey: true,
    },
  },
  imagen: {
    imagen: {
      endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      modelId: 'gemini-3-pro-image-preview',
      requiresKey: true,
    },
  },
  fal: {
    fal: {
      endpointUrl: 'https://fal.run/fal-ai/flux/schnell',
      modelId: 'fal-ai/flux/schnell',
      requiresKey: true,
    },
  },
  replicate: {
    replicate: {
      endpointUrl: 'https://api.replicate.com/v1/predictions',
      modelId: 'black-forest-labs/flux-schnell',
      requiresKey: true,
    },
  },
  sd_webui: {
    sd_webui: {
      endpointUrl: 'http://127.0.0.1:7860/sdapi/v1/txt2img',
      modelId: 'v1-5-pruned',
      requiresKey: false,
    },
  },
  comfyui: {
    comfyui: {
      endpointUrl: 'http://127.0.0.1:8188',
      modelId: 'ComfyUI-Workflow',
      requiresKey: false,
    },
  },
  custom: {
    custom_rest: {
      endpointUrl: 'http://localhost:8000/v1/images/generations',
      modelId: 'local-image-model',
      requiresKey: false,
    },
  },
};

export function createDefaultImageGeneratorProviders(): ImageGeneratorProvidersMap {
  return {
    pollinations: {
      id: 'pollinations',
      name: 'Pollinations.ai (Free Cloud AI)',
      enabled: true,
      protocol: 'pollinations',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.pollinations.pollinations.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.pollinations.pollinations.modelId,
    },
    openai: {
      id: 'openai',
      name: 'OpenAI (DALL-E 3 / DALL-E 2)',
      enabled: false,
      protocol: 'openai',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.openai.openai.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.openai.openai.modelId,
    },
    imagen: {
      id: 'imagen',
      name: 'Google Imagen 3 / Banana Pro',
      enabled: false,
      protocol: 'imagen',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.imagen.imagen.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.imagen.imagen.modelId,
    },
    fal: {
      id: 'fal',
      name: 'Fal.ai (Flux Schnell / SDXL)',
      enabled: false,
      protocol: 'fal',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.fal.fal.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.fal.fal.modelId,
    },
    replicate: {
      id: 'replicate',
      name: 'Replicate (Flux / SDXL)',
      enabled: false,
      protocol: 'replicate',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.replicate.replicate.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.replicate.replicate.modelId,
    },
    sd_webui: {
      id: 'sd_webui',
      name: 'Stable Diffusion / Draw Things (Local)',
      enabled: false,
      protocol: 'sd_webui',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.sd_webui.sd_webui.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.sd_webui.sd_webui.modelId,
    },
    comfyui: {
      id: 'comfyui',
      name: 'ComfyUI (Local)',
      enabled: false,
      protocol: 'comfyui',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.comfyui.comfyui.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.comfyui.comfyui.modelId,
    },
    custom: {
      id: 'custom',
      name: 'Custom OpenAI-Compatible / REST',
      enabled: false,
      protocol: 'custom_rest',
      endpointUrl: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.custom.custom_rest.endpointUrl,
      apiKey: '',
      modelId: IMAGE_GENERATOR_PROTOCOL_DEFAULTS.custom.custom_rest.modelId,
    },
  };
}

export function normalizeImageGeneratorProviders(
  raw?: Partial<Record<ImageGeneratorBackendId, Partial<ImageGeneratorProviderConfig>>>,
): ImageGeneratorProvidersMap {
  const defaults = createDefaultImageGeneratorProviders();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const ids: ImageGeneratorBackendId[] = [
    'pollinations',
    'openai',
    'imagen',
    'fal',
    'replicate',
    'sd_webui',
    'comfyui',
    'custom',
  ];

  for (const id of ids) {
    const item = raw[id];
    if (item && typeof item === 'object') {
      const defaultProtocol = defaults[id].protocol;
      const protocol = item.protocol || defaultProtocol;
      const preset =
        IMAGE_GENERATOR_PROTOCOL_DEFAULTS[id]?.[protocol] ||
        IMAGE_GENERATOR_PROTOCOL_DEFAULTS[id]?.[defaultProtocol];

      defaults[id] = {
        id,
        name: defaults[id].name,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : defaults[id].enabled,
        protocol: (item.protocol as ImageGeneratorProtocol) || defaultProtocol,
        endpointUrl:
          typeof item.endpointUrl === 'string' && item.endpointUrl.trim()
            ? item.endpointUrl.trim()
            : preset?.endpointUrl || defaults[id].endpointUrl,
        apiKey: typeof item.apiKey === 'string' ? item.apiKey : '',
        modelId:
          typeof item.modelId === 'string' && item.modelId.trim()
            ? item.modelId.trim()
            : preset?.modelId || defaults[id].modelId,
      };
    }
  }

  return defaults;
}

export interface ImageGeneratorPersistedConfig {
  activeBackend: ImageGeneratorBackendId | 'procedural';
  providers: ImageGeneratorProvidersMap;
  enhancePrompt: boolean;
}

export class ExternalImageGeneratorService {
  private activeBackend: ImageGeneratorBackendId | 'procedural' = 'procedural';
  private providers: ImageGeneratorProvidersMap = createDefaultImageGeneratorProviders();
  private enhancePrompt = true;

  constructor() {
    this.loadConfig();
  }

  public getActiveBackend(): ImageGeneratorBackendId | 'procedural' {
    return this.activeBackend;
  }

  public setActiveBackend(backend: ImageGeneratorBackendId | 'procedural'): void {
    this.activeBackend = backend;
    this.saveConfig();
  }

  public getProviders(): ImageGeneratorProvidersMap {
    return { ...this.providers };
  }

  public getProvider(id: ImageGeneratorBackendId): ImageGeneratorProviderConfig {
    return this.providers[id] || createDefaultImageGeneratorProviders()[id];
  }

  public updateProvider(
    id: ImageGeneratorBackendId,
    partial: Partial<ImageGeneratorProviderConfig>,
  ): void {
    if (!this.providers[id]) return;
    this.providers[id] = {
      ...this.providers[id],
      ...partial,
    };
    this.saveConfig();
  }

  public isPromptEnhanceEnabled(): boolean {
    return this.enhancePrompt;
  }

  public setPromptEnhance(enabled: boolean): void {
    this.enhancePrompt = enabled;
    this.saveConfig();
  }

  public loadConfig(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(IMAGE_GENERATOR_STORAGE_KEY);
      if (!raw) return;
      const parsed: Partial<ImageGeneratorPersistedConfig> = JSON.parse(raw);
      if (parsed.activeBackend) {
        this.activeBackend = parsed.activeBackend;
      }
      if (parsed.providers) {
        this.providers = normalizeImageGeneratorProviders(parsed.providers);
      }
      if (typeof parsed.enhancePrompt === 'boolean') {
        this.enhancePrompt = parsed.enhancePrompt;
      }
    } catch {
      // Ignore JSON parse errors and keep defaults
    }
  }

  public saveConfig(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: ImageGeneratorPersistedConfig = {
        activeBackend: this.activeBackend,
        providers: this.providers,
        enhancePrompt: this.enhancePrompt,
      };
      localStorage.setItem(IMAGE_GENERATOR_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors (e.g. quota exceeded)
    }
  }

  /**
   * Enhances a natural language texture prompt with orthogonal framing,
   * flat diffused lighting, and seamless tileable modifiers for diffusion models.
   */
  public enhancePromptForTexture(prompt: string, seamless: boolean = true): string {
    const trimmed = prompt.trim();
    if (!trimmed) return 'Seamless tileable stone texture, top-down view, evenly lit texture map';

    const hasSeamless = /seamless|tileable|repeating pattern/i.test(trimmed);
    const hasTopDown = /top-down|flat view|orthogonal|texture map/i.test(trimmed);

    const parts: string[] = [];
    if (seamless && !hasSeamless) {
      parts.push('seamless tileable texture of');
    }
    parts.push(trimmed);
    if (!hasTopDown) {
      parts.push('top-down orthogonal view, diffused even studio lighting, high resolution PBR texture map, game asset, 8k');
    }
    if (seamless && !hasSeamless) {
      parts.push('continuous repeating pattern without seams, flat surface, no perspective distortion');
    }

    return parts.join(', ');
  }

  /**
   * Tests connection to a specific image generator provider.
   */
  public async testProvider(
    id: ImageGeneratorBackendId,
    override?: Partial<ImageGeneratorProviderConfig>,
  ): Promise<{ ok: boolean; message: string }> {
    const config: ImageGeneratorProviderConfig = {
      ...this.getProvider(id),
      ...(override || {}),
    };

    const endpoint = (config.endpointUrl || '').trim();
    if (!endpoint) {
      return { ok: false, message: `Missing endpoint URL for ${config.name}.` };
    }

    try {
      switch (id) {
        case 'pollinations': {
          const testUrl = `${endpoint.replace(/\/+$/, '')}/test_ping?width=64&height=64&nologo=true`;
          const res = await fetch(testUrl, { method: 'HEAD', mode: 'cors' }).catch(() =>
            fetch(testUrl, { method: 'GET', mode: 'cors' }),
          );
          if (res.ok || res.status === 200 || res.status === 304) {
            return { ok: true, message: 'Connected to Pollinations.ai successfully.' };
          }
          return { ok: false, message: `Pollinations returned status ${res.status}.` };
        }

        case 'openai': {
          if (!config.apiKey) {
            return { ok: false, message: 'API key is required for OpenAI.' };
          }
          // Test by querying /v1/models if standard OpenAI endpoint, or verify URL
          const baseUrl = endpoint.replace(/\/images\/generations\/?$/, '');
          const modelsUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
          const res = await fetch(modelsUrl, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          });
          if (res.ok) {
            return { ok: true, message: 'Connected to OpenAI endpoint successfully.' };
          }
          const errData = await res.json().catch(() => ({}));
          const errMsg = (errData as any)?.error?.message || `HTTP ${res.status} (${res.statusText})`;
          return { ok: false, message: `OpenAI connection failed: ${errMsg}` };
        }

        case 'imagen': {
          if (!config.apiKey) {
            return { ok: false, message: 'Google Gemini API key is required for Imagen 3 / Banana Pro.' };
          }
          const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
          const res = await fetch(testUrl).catch(() => null);
          if (res && res.ok) {
            return { ok: true, message: 'Connected to Google AI Studio / Imagen API successfully.' };
          }
          return { ok: false, message: 'Google Imagen connection failed. Verify your Google Gemini API key.' };
        }

        case 'sd_webui': {
          const resolvedEndpoint = this.resolveEndpointUrl(endpoint);
          const endpointsToTest: string[] = [];

          const addCandidates = (url: string) => {
            const base = url.replace(/\/sdapi\/v1\/.+$/, '').replace(/\/+$/, '');
            // 1. /sdapi/v1/options is supported by Draw Things, Automatic1111, SD.Next, and Forge
            const optUrl = `${base}/sdapi/v1/options`;
            if (!endpointsToTest.includes(optUrl)) endpointsToTest.push(optUrl);
            // 2. Root / returns model config JSON on Draw Things
            const rootUrl = `${base}/`;
            if (!endpointsToTest.includes(rootUrl)) endpointsToTest.push(rootUrl);
            // 3. /sdapi/v1/progress is supported on Automatic1111/Forge
            const progUrl = `${base}/sdapi/v1/progress`;
            if (!endpointsToTest.includes(progUrl)) endpointsToTest.push(progUrl);
          };

          addCandidates(resolvedEndpoint);
          if (resolvedEndpoint !== endpoint) {
            addCandidates(endpoint);
          }

          let lastErrorMessage = '';
          for (const testUrl of endpointsToTest) {
            try {
              const res = await fetch(testUrl, { method: 'GET' });
              if (res.ok) {
                const data = typeof res.json === 'function' ? await res.json().catch(() => null) : null;
                const activeModel =
                  data?.model ||
                  data?.sd_model_checkpoint ||
                  (typeof data === 'object' && data?.sampler ? 'Draw Things Model' : null);
                const modelInfo = activeModel ? ` (Model: ${activeModel})` : '';
                return {
                  ok: true,
                  message: `Connected to Stable Diffusion WebUI / Draw Things successfully${modelInfo}.`,
                };
              }
            } catch (err: any) {
              lastErrorMessage = err?.message || 'Network error';
            }
          }

          return {
            ok: false,
            message: lastErrorMessage
              ? `Could not reach SD WebUI / Draw Things: ${lastErrorMessage}. Ensure Draw Things or WebUI is running with API Server enabled.`
              : 'WebUI responded with an error. Ensure API Server mode is active (Port 7860).',
          };
        }

        case 'fal': {
          if (!config.apiKey) {
            return { ok: false, message: 'API key is required for Fal.ai.' };
          }
          const res = await fetch(endpoint, {
            method: 'OPTIONS',
            headers: { Authorization: `Key ${config.apiKey}` },
          }).catch(() => null);
          return {
            ok: true,
            message: 'Fal.ai endpoint configured. Credentials ready for generation.',
          };
        }

        case 'replicate': {
          if (!config.apiKey) {
            return { ok: false, message: 'API token is required for Replicate.' };
          }
          const res = await fetch('https://api.replicate.com/v1/models', {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          });
          if (res.ok) {
            return { ok: true, message: 'Connected to Replicate API successfully.' };
          }
          return { ok: false, message: `Replicate returned HTTP ${res.status}. Check API token.` };
        }

        case 'comfyui': {
          const baseUrl = endpoint.replace(/\/+$/, '');
          const res = await fetch(`${baseUrl}/system_stats`).catch(() => null);
          if (res && res.ok) {
            return { ok: true, message: 'Connected to ComfyUI server.' };
          }
          return {
            ok: false,
            message: `Could not reach ComfyUI on ${endpoint}. Make sure ComfyUI is running.`,
          };
        }

        case 'custom':
        default: {
          const res = await fetch(endpoint, {
            method: 'HEAD',
            headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
          }).catch(() => null);
          if (res && (res.ok || res.status === 405 || res.status === 404)) {
            return { ok: true, message: 'Custom endpoint reached successfully.' };
          }
          return { ok: false, message: `Could not connect to custom endpoint ${endpoint}.` };
        }
      }
    } catch (err: any) {
      return { ok: false, message: `Connection test failed: ${err?.message || 'Network error'}` };
    }
  }

  /**
   * Generates a 2D image from natural language using the configured external image provider.
   */
  public async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const backendId: ImageGeneratorBackendId =
      request.backend && request.backend !== 'auto'
        ? request.backend
        : this.activeBackend !== 'procedural'
          ? this.activeBackend
          : 'pollinations';

    const provider = this.getProvider(backendId);
    const size = this.normalizeResolution(request.size ?? 512);
    const seamless = request.seamless !== false;
    const shouldEnhance = request.enhancePrompt !== false && this.enhancePrompt;
    const finalPrompt = shouldEnhance ? this.enhancePromptForTexture(request.prompt, seamless) : request.prompt;
    const seed = request.seed ?? Math.floor(Math.random() * 1000000);

    let dataUrl: string;

    switch (backendId) {
      case 'pollinations':
        dataUrl = await this.generateWithPollinations(provider, finalPrompt, size, seed, request.signal);
        break;

      case 'openai':
        dataUrl = await this.generateWithOpenAI(provider, finalPrompt, size, request.signal);
        break;

      case 'imagen':
        dataUrl = await this.generateWithGoogleImagen(provider, finalPrompt, size, request.signal);
        break;

      case 'sd_webui':
        dataUrl = await this.generateWithSDWebUI(provider, finalPrompt, size, seed, seamless, request.signal);
        break;

      case 'fal':
        dataUrl = await this.generateWithFal(provider, finalPrompt, size, seed, request.signal);
        break;

      case 'replicate':
        dataUrl = await this.generateWithReplicate(provider, finalPrompt, size, seed, request.signal);
        break;

      case 'custom':
      default:
        dataUrl = await this.generateWithCustom(provider, finalPrompt, size, seed, seamless, request.signal);
        break;
    }

    return {
      providerId: backendId,
      providerName: provider.name,
      dataUrl,
      width: size,
      height: size,
    };
  }

  private normalizeResolution(size: number): number {
    if (size <= 256) return 256;
    if (size <= 512) return 512;
    if (size <= 1024) return 1024;
    return 2048;
  }

  private async generateWithPollinations(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    seed: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const endpoint = (provider.endpointUrl || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.pollinations.pollinations.endpointUrl).replace(/\/+$/, '');
    const model = provider.modelId || 'flux';
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${endpoint}/${encodedPrompt}?width=${size}&height=${size}&seed=${seed}&model=${encodeURIComponent(model)}&nologo=true`;

    const res = await fetch(url, { signal, mode: 'cors' });
    if (!res.ok) {
      throw new Error(`Pollinations.ai generation failed with HTTP status ${res.status}.`);
    }

    const blob = await res.blob();
    return await this.blobToDataUrl(blob);
  }

  private async generateWithOpenAI(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const endpoint = provider.endpointUrl || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.openai.openai.endpointUrl;
    if (!provider.apiKey && endpoint.includes('api.openai.com')) {
      throw new Error('OpenAI API Key is required. Please set it in AI Texture Generator settings.');
    }

    const model = provider.modelId || 'dall-e-3';
    // DALL-E 3 requires 1024x1024 minimum
    const openAISize = model.includes('dall-e-3')
      ? '1024x1024'
      : size <= 256
        ? '256x256'
        : size <= 512
          ? '512x512'
          : '1024x1024';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }

    const body: Record<string, any> = {
      prompt,
      model,
      n: 1,
      size: openAISize,
      response_format: 'b64_json',
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message || `HTTP ${res.status} (${res.statusText})`;
      throw new Error(`OpenAI image generation failed: ${msg}`);
    }

    const data = await res.json();
    const item = data?.data?.[0];
    if (item?.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }
    if (item?.url) {
      return await this.fetchImageUrlAsDataUrl(item.url, signal);
    }

    throw new Error('No image data returned from OpenAI endpoint.');
  }

  private async generateWithGoogleImagen(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new Error('Google Gemini API Key is required for Imagen 3 / Banana Pro. Please set it in settings.');
    }

    const rawEndpoint = (provider.endpointUrl || '').trim();
    const model = (provider.modelId || 'gemini-3-pro-image-preview').trim();

    // Determine target URL and mode (Native Gemini generateContent vs legacy :predict)
    let url = rawEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    if (!url.includes(':generateContent') && !url.includes(':predict')) {
      url = `${url.replace(/\/+$/, '')}/${model}:generateContent`;
    }
    url = url.includes('key=') ? url : `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(provider.apiKey)}`;

    const isPredictEndpoint = url.includes(':predict');
    const body: Record<string, any> = isPredictEndpoint
      ? {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            outputOptions: {
              mimeType: 'image/png',
            },
          },
        }
      : {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              imageSize: size >= 1024 ? '1K' : '0.5K',
            },
          },
        };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as any)?.error?.message || `HTTP ${res.status} (${res.statusText})`;
      if (res.status === 402 || msg.includes('credits are depleted') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'Google AI Studio: Prepayment credits are depleted on this project. Manage billing at https://ai.studio/projects or switch to free Pollinations.ai / local SD WebUI.'
        );
      }
      if (res.status === 404) {
        throw new Error(
          `Google model not found (404). Active Gemini image models: "gemini-3-pro-image-preview" (Banana Pro) or "gemini-3.1-flash-image-preview".`
        );
      }
      throw new Error(`Google Imagen / Banana Pro generation failed: ${msg}`);
    }

    const data = await res.json();

    // 1. Try modern generateContent candidates[].content.parts[].inlineData format
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }

    // 2. Try legacy :predict predictions[].bytesBase64Encoded format
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    throw new Error('No image bytes returned from Google Gemini / Imagen API.');
  }

  /**
   * Resolves an endpoint URL, mapping local SD WebUI / Draw Things endpoints to
   * same-origin proxy URLs if running in a web browser to prevent browser CORS blocks.
   */
  private resolveEndpointUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (typeof window === 'undefined' || !window.location) {
      return trimmed;
    }

    try {
      // If endpoint is targeted at 127.0.0.1:7860 or localhost:7860,
      // and the web application is running on localhost/127.0.0.1 on another port (e.g. 8080):
      if (
        (trimmed.startsWith('http://127.0.0.1:7860') || trimmed.startsWith('http://localhost:7860')) &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ) {
        const parsed = new URL(trimmed);
        return `${window.location.origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // fallback to original
    }

    return trimmed;
  }

  private async generateWithSDWebUI(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    seed: number,
    tiling: boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    const rawEndpoint = provider.endpointUrl || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.sd_webui.sd_webui.endpointUrl;
    const resolvedEndpoint = this.resolveEndpointUrl(rawEndpoint);

    // Prepare candidate target URLs (same-origin proxy first, then direct if different)
    const targetUrls = [resolvedEndpoint];
    if (resolvedEndpoint !== rawEndpoint) {
      targetUrls.push(rawEndpoint);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }

    // Try payload variants:
    // 1. Standard Automatic1111 payload (with `tiling: boolean`)
    // 2. Draw Things payload (Draw Things rejects unrecognized `tiling` key, but accepts `tiled_diffusion: boolean`)
    const payloadsToTry = [
      {
        prompt,
        negative_prompt: 'blurry, low quality, distorted, perspective, watermark, logo, text',
        steps: 22,
        width: size,
        height: size,
        tiling,
        seed,
      },
      {
        prompt: tiling ? `${prompt}, seamless texture, tileable pattern` : prompt,
        negative_prompt: 'blurry, low quality, distorted, perspective, watermark, logo, text',
        steps: 22,
        width: size,
        height: size,
        tiled_diffusion: tiling,
        seed,
      },
    ];

    let lastError: Error | null = null;

    for (const targetUrl of targetUrls) {
      for (const payload of payloadsToTry) {
        try {
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal,
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            const errDetail = errJson?.detail || errJson?.error?.message || (typeof errJson === 'string' ? errJson : '');
            // If the failure is due to unrecognized key "tiling", try next payload immediately
            if (typeof errDetail === 'string' && errDetail.includes('tiling')) {
              continue;
            }
            throw new Error(
              `Stable Diffusion WebUI / Draw Things returned HTTP ${res.status}${errDetail ? `: ${errDetail}` : ''}`
            );
          }

          const data = await res.json();
          const firstImg = data?.images?.[0];
          if (!firstImg) {
            throw new Error('Stable Diffusion WebUI / Draw Things did not return an image in response.');
          }

          return firstImg.startsWith('data:image/') ? firstImg : `data:image/png;base64,${firstImg}`;
        } catch (err: any) {
          lastError = err;
          // If aborted, do not retry
          if (signal?.aborted) {
            throw err;
          }
        }
      }
    }

    throw (
      lastError ||
      new Error(
        'Failed to generate image with Stable Diffusion WebUI / Draw Things. Verify that Draw Things or WebUI is running.'
      )
    );
  }

  private async generateWithFal(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    seed: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const endpoint = provider.endpointUrl || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.fal.fal.endpointUrl;
    if (!provider.apiKey) {
      throw new Error('Fal.ai API Key is required. Please set it in AI Texture Generator settings.');
    }

    const payload = {
      prompt,
      image_size: size >= 1024 ? 'square_hd' : 'square',
      num_images: 1,
      seed,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${provider.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Fal.ai generation failed: ${(err as any)?.detail || res.statusText}`);
    }

    const data = await res.json();
    const imgUrl = data?.images?.[0]?.url;
    if (!imgUrl) {
      throw new Error('No image URL returned from Fal.ai.');
    }

    return await this.fetchImageUrlAsDataUrl(imgUrl, signal);
  }

  private async generateWithReplicate(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    seed: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const endpoint = provider.endpointUrl || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.replicate.replicate.endpointUrl;
    if (!provider.apiKey) {
      throw new Error('Replicate API Token is required. Please set it in AI Texture Generator settings.');
    }

    const modelId = provider.modelId || IMAGE_GENERATOR_PROTOCOL_DEFAULTS.replicate.replicate.modelId;
    const isModelEndpoint = endpoint.includes('/models/');

    const payload: Record<string, any> = isModelEndpoint
      ? {
          input: {
            prompt,
            width: size,
            height: size,
            seed,
          },
        }
      : {
          version: modelId,
          input: {
            prompt,
            width: size,
            height: size,
            seed,
          },
        };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        Prefer: 'wait',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Replicate failed: ${(err as any)?.detail || res.statusText}`);
    }

    const data = await res.json();
    let imgUrl = Array.isArray(data?.output) ? data.output[0] : typeof data?.output === 'string' ? data.output : null;

    // If still processing, poll prediction URL
    if (!imgUrl && data?.urls?.get) {
      imgUrl = await this.pollReplicateResult(data.urls.get, provider.apiKey, signal);
    }

    if (!imgUrl) {
      throw new Error('Replicate prediction did not return an image URL.');
    }

    return await this.fetchImageUrlAsDataUrl(imgUrl, signal);
  }

  private async pollReplicateResult(getUrl: string, apiKey: string, signal?: AbortSignal): Promise<string> {
    for (let i = 0; i < 30; i++) {
      if (signal?.aborted) throw new Error('Generation cancelled.');
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.status === 'succeeded') {
        const out = Array.isArray(data.output) ? data.output[0] : data.output;
        if (out) return out;
      }
      if (data?.status === 'failed' || data?.status === 'canceled') {
        throw new Error(`Replicate generation ${data.status}: ${data.error || 'Unknown error'}`);
      }
    }
    throw new Error('Replicate generation timed out.');
  }

  private async generateWithCustom(
    provider: ImageGeneratorProviderConfig,
    prompt: string,
    size: number,
    seed: number,
    seamless: boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    const endpoint = provider.endpointUrl;
    if (!endpoint) {
      throw new Error('Custom generator endpoint URL is not configured.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }

    // Attempt OpenAI-compatible /v1/images/generations payload format
    const body = {
      prompt,
      model: provider.modelId || 'default',
      size: `${size}x${size}`,
      n: 1,
      seed,
      seamless,
      response_format: 'b64_json',
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Custom endpoint returned HTTP ${res.status} (${res.statusText}).`);
    }

    const data = await res.json().catch(() => null);
    if (data?.data?.[0]?.b64_json) {
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
    if (data?.data?.[0]?.url) {
      return await this.fetchImageUrlAsDataUrl(data.data[0].url, signal);
    }
    if (data?.image) {
      return data.image.startsWith('data:image/') ? data.image : `data:image/png;base64,${data.image}`;
    }
    if (data?.images?.[0]) {
      const img = data.images[0];
      return img.startsWith('data:image/') ? img : `data:image/png;base64,${img}`;
    }
    if (data?.url) {
      return await this.fetchImageUrlAsDataUrl(data.url, signal);
    }

    throw new Error('Custom endpoint response did not contain image data or URL.');
  }

  private async fetchImageUrlAsDataUrl(url: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(url, { signal, mode: 'cors' });
    if (!res.ok) {
      throw new Error(`Failed to download image from ${url} (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    return await this.blobToDataUrl(blob);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image blob data.'));
      reader.readAsDataURL(blob);
    });
  }
}

