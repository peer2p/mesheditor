import { NullEngine, MeshBuilder, Mesh, PBRMaterial } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';
import {
  ExternalImageGeneratorService,
  createDefaultImageGeneratorProviders,
  normalizeImageGeneratorProviders,
  IMAGE_GENERATOR_PROTOCOL_DEFAULTS,
} from '../../src/textures/ExternalImageGeneratorService';
import { AITextureGenerator } from '../../src/textures/AITextureGenerator';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABNJREFUCB1j/M/A8J+BgYGBgQEAEPsB/921hJ8AAAAASUVORK5CYII=';

describe('External AI Image Generator & AI Texture Generator Integration', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    localStorage.clear();
    originalFetch = globalThis.fetch;
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (service) service.dispose();
    if (engine) engine.dispose();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. ExternalImageGeneratorService Configuration & Protocols', () => {
    it('initializes with default provider configurations and procedural active backend', () => {
      const generator = new ExternalImageGeneratorService();
      expect(generator.getActiveBackend()).toBe('procedural');

      const providers = generator.getProviders();
      expect(providers.pollinations).toBeDefined();
      expect(providers.pollinations.name).toContain('Pollinations.ai');
      expect(providers.openai).toBeDefined();
      expect(providers.openai.name).toContain('OpenAI');
      expect(providers.sd_webui).toBeDefined();
      expect(providers.sd_webui.name).toContain('Stable Diffusion');
      expect(providers.fal).toBeDefined();
      expect(providers.replicate).toBeDefined();
      expect(providers.custom).toBeDefined();
    });

    it('enhances prompts for seamless tileable texture synthesis', () => {
      const generator = new ExternalImageGeneratorService();
      const enhanced = generator.enhancePromptForTexture('old mossy dungeon stone wall', true);

      expect(enhanced).toContain('seamless tileable texture');
      expect(enhanced).toContain('old mossy dungeon stone wall');
      expect(enhanced).toContain('top-down orthogonal view');
      expect(enhanced).toContain('diffused even studio lighting');
      expect(enhanced).toContain('continuous repeating pattern');
    });

    it('persists and loads active backend and provider overrides in localStorage', () => {
      const generator = new ExternalImageGeneratorService();
      generator.setActiveBackend('openai');
      generator.updateProvider('openai', {
        apiKey: 'sk-test-key-12345',
        modelId: 'dall-e-3-custom',
      });

      const reloaded = new ExternalImageGeneratorService();
      expect(reloaded.getActiveBackend()).toBe('openai');
      const openaiProv = reloaded.getProvider('openai');
      expect(openaiProv.apiKey).toBe('sk-test-key-12345');
      expect(openaiProv.modelId).toBe('dall-e-3-custom');
    });

    it('tests connection to Pollinations.ai and returns status result', async () => {
      const generator = new ExternalImageGeneratorService();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const result = await generator.testProvider('pollinations');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('Connected to Pollinations.ai');
    });

    it('requires API key when testing OpenAI connection without credentials', async () => {
      const generator = new ExternalImageGeneratorService();
      generator.updateProvider('openai', { apiKey: '' });

      const result = await generator.testProvider('openai');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('API key is required');
    });

    it('tests connection to Stable Diffusion WebUI / Automatic1111', async () => {
      const generator = new ExternalImageGeneratorService();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ sd_model_checkpoint: 'v1-5-pruned' }),
      } as any);

      const result = await generator.testProvider('sd_webui');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('Connected to Stable Diffusion WebUI');
      expect(result.message).toContain('v1-5-pruned');
    });

    it('tests connection to Draw Things local API server and extracts active model', async () => {
      const generator = new ExternalImageGeneratorService();
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/sdapi/v1/options') || url.endsWith('/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ model: 'sd_v2.1_f16.ckpt', sampler: 'UniPC AYS' }),
          } as any);
        }
        return Promise.resolve({ ok: false, status: 404 } as any);
      });

      const result = await generator.testProvider('sd_webui');
      expect(result.ok).toBe(true);
      expect(result.message).toContain('sd_v2.1_f16.ckpt');
    });
  });

  describe('2. Image Generation Protocol Dispatches', () => {
    it('generates an image via Pollinations.ai and returns data URL', async () => {
      const generator = new ExternalImageGeneratorService();
      const mockBlob = new Blob(['mock-png-data'], { type: 'image/png' });

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('pollinations.ai');
        expect(url).toContain('dungeon');
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(mockBlob),
        } as any);
      });

      const res = await generator.generateImage({
        backend: 'pollinations',
        prompt: 'dungeon cobblestone',
        size: 512,
        seamless: true,
      });

      expect(res.providerId).toBe('pollinations');
      expect(res.dataUrl).toContain('data:');
      expect(res.width).toBe(512);
      expect(res.height).toBe(512);
    });

    it('generates an image via OpenAI endpoint with b64_json format', async () => {
      const generator = new ExternalImageGeneratorService();
      generator.updateProvider('openai', { apiKey: 'sk-mock-key' });

      let capturedBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        expect(url).toContain('/images/generations');
        expect(options.headers.Authorization).toBe('Bearer sk-mock-key');
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAA=' }],
            }),
        } as any);
      });

      const res = await generator.generateImage({
        backend: 'openai',
        prompt: 'futuristic metallic floor panels',
        size: 1024,
      });

      expect(res.providerId).toBe('openai');
      expect(res.dataUrl).toContain('data:image/png;base64,');
      expect(capturedBody.model).toBe('dall-e-3');
      expect(capturedBody.response_format).toBe('b64_json');
      expect(capturedBody.prompt).toContain('futuristic metallic floor panels');
    });

    it('generates an image via Google Imagen 3 / Banana Pro API with generateContent format', async () => {
      const generator = new ExternalImageGeneratorService();
      generator.updateProvider('imagen', { apiKey: 'mock-gemini-key' });

      let capturedBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        expect(url).toContain('key=mock-gemini-key');
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'image/png',
                          data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAA=',
                        },
                      },
                    ],
                  },
                },
              ],
            }),
        } as any);
      });

      const res = await generator.generateImage({
        backend: 'imagen',
        prompt: 'ancient golden aztec glyph tiles',
        size: 512,
      });

      expect(res.providerId).toBe('imagen');
      expect(res.dataUrl).toContain('data:image/png;base64,');
      expect(capturedBody.contents[0].parts[0].text).toContain('ancient golden aztec glyph tiles');
    });

    it('generates an image via Stable Diffusion WebUI with native tiling: true', async () => {
      const generator = new ExternalImageGeneratorService();

      let capturedBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        expect(url).toContain('/sdapi/v1/txt2img');
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              images: ['iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAA='],
            }),
        } as any);
      });

      const res = await generator.generateImage({
        backend: 'sd_webui',
        prompt: 'weathered medieval oak wood planks',
        size: 512,
        seamless: true,
      });

      expect(res.providerId).toBe('sd_webui');
      expect(res.dataUrl).toContain('data:image/png;base64,');
      expect(capturedBody.tiling).toBe(true);
      expect(capturedBody.prompt).toContain('weathered medieval oak wood planks');
    });

    it('generates an image via Draw Things with automatic tiled_diffusion fallback when tiling key is rejected', async () => {
      const generator = new ExternalImageGeneratorService();

      let callCount = 0;
      let lastBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, options: any) => {
        callCount++;
        const parsed = JSON.parse(options.body);
        lastBody = parsed;
        if ('tiling' in parsed) {
          // Draw Things rejects 'tiling' with HTTP 422
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () => Promise.resolve({ detail: 'Unrecognized keys: ["tiling"]' }),
          } as any);
        }
        // Draw Things accepts tiled_diffusion
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              images: ['iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAA='],
            }),
        } as any);
      });

      const res = await generator.generateImage({
        backend: 'sd_webui',
        prompt: 'mossy cobblestone floor',
        size: 512,
        seamless: true,
      });

      expect(callCount).toBe(2);
      expect(lastBody.tiled_diffusion).toBe(true);
      expect(lastBody.tiling).toBeUndefined();
      expect(res.dataUrl).toContain('data:image/png;base64,');
    });
  });

  describe('3. AITextureGenerator Integration with External Providers', () => {
    it('generates texture procedurally when backend is procedural', async () => {
      const item = await service.aiTextureGenerator.generateTexture({
        prompt: 'Weathered stone brick wall',
        style: 'brick',
        size: 256,
        backend: 'procedural',
      });

      expect(item).toBeDefined();
      expect(item.id).toContain('ai_tex_');
      expect(item.albedoDataUrl).toContain('data:image/png;base64,');
      expect(item.normalDataUrl).toBeDefined();
      expect(item.isAI).toBe(false);
      expect(item.generatorBackend).toBe('procedural');
      expect(service.aiTextureGenerator.getHistory().length).toBe(1);
    });

    it('delegates texture generation to external AI provider when specified', async () => {
      const mockBlob = new Blob(['mock-bytes'], { type: 'image/png' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
      } as any);

      const item = await service.aiTextureGenerator.generateTexture({
        prompt: 'Ancient red clay bricks',
        backend: 'pollinations',
        size: 256,
      });

      expect(item).toBeDefined();
      expect(item.isAI).toBe(true);
      expect(item.generatorBackend).toBe('pollinations');
      expect(item.albedoDataUrl).toContain('data:');
      expect(item.embeddedAlbedoName).toContain('albedo.png');
    });

    it('falls back to procedural synthesizer when external provider fails and fallback is enabled', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const item = await service.aiTextureGenerator.generateTexture({
        prompt: 'Dark obsidian runes',
        backend: 'pollinations',
        size: 256,
        fallbackToProcedural: true,
      });

      expect(item).toBeDefined();
      expect(item.isAI).toBe(false);
      expect(item.generatorBackend).toBe('procedural');
      expect(item.albedoDataUrl).toBeDefined();
    });

    it('applies generated texture and normal map to a mesh in the scene', async () => {
      const box = MeshBuilder.CreateBox('test_box', { size: 2 }, service.scene);
      service.selectMesh(box);

      const item = await service.aiTextureGenerator.generateTexture({
        prompt: 'Rusted industrial iron metal sheet',
        style: 'rust',
        size: 256,
        backend: 'procedural',
        applyToMesh: 'selected',
        uvScale: 2.0,
      });

      expect(box.material).toBeDefined();
      expect(box.material instanceof PBRMaterial).toBe(true);
      const pbr = box.material as PBRMaterial;
      expect(pbr.name).toContain(item.name);
      expect(pbr.albedoTexture).toBeDefined();
      expect((pbr.albedoTexture as any)?.uScale).toBe(2.0);
    });
  });

  describe('4. AI Agent modeler_generate_texture Tool Execution', () => {
    it('executes modeler_generate_texture with external AI backend and returns metadata', async () => {
      const mockBlob = new Blob(['mock-bytes'], { type: 'image/png' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
      } as any);

      const sphere = MeshBuilder.CreateSphere('planet_sphere', { diameter: 2 }, service.scene);

      const resStr = await service.aiAgent.executeToolCall('modeler_generate_texture', {
        prompt: 'Alien volcanic magma crust',
        backend: 'pollinations',
        applyToMesh: 'planet_sphere',
        size: 512,
        uvScale: 1.5,
      });

      const res = JSON.parse(resStr);
      expect(res.status).toBe('ok');
      expect(res.textureId).toBeDefined();
      expect(res.generatorBackend).toBe('pollinations');
      expect(res.isAI).toBe(true);
      expect(res.appliedToMeshes).toContain('planet_sphere');
      expect(sphere.material).toBeDefined();
    });
  });

  describe('5. AIAgentService Configuration Synchronization', () => {
    it('synchronizes external image generator settings with AIAgentService config', () => {
      service.aiAgent.saveConfig({
        imageGeneratorEnabled: true,
        imageGeneratorActiveBackend: 'openai',
        imageGeneratorProviders: normalizeImageGeneratorProviders({
          openai: {
            apiKey: 'sk-sync-key',
            modelId: 'dall-e-3',
          },
        }),
      });

      expect(service.externalImageGenerator.getActiveBackend()).toBe('openai');
      const prov = service.externalImageGenerator.getProvider('openai');
      expect(prov.apiKey).toBe('sk-sync-key');
    });
  });
});
