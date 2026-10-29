import { NullEngine } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_AGENT_SKILLS, discoverSkills, parseSkillMarkdown } from '../../src/builtInSkills';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';

describe('AI Mesh Agent (Text-to-Mesh, Image-to-Mesh & Mesh Update) Integration Tests', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
  });

  afterEach(() => {
    service.dispose();
    canvas.remove();
  });

  describe('1. OpenAI-Compatible Endpoint Configuration & Built-in Skills', () => {
    it('saves and persists OpenAI-compatible endpoint config and resolves URLs', () => {
      const updated = service.aiAgent.saveConfig({
        baseUrl: 'https://openrouter.ai/api/v1/',
        apiKey: 'sk-or-test-12345',
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.15,
      });

      expect(updated.baseUrl).toBe('https://openrouter.ai/api/v1/');
      expect(updated.apiKey).toBe('sk-or-test-12345');
      expect(updated.model).toBe('anthropic/claude-3.5-sonnet');
      expect(service.aiAgent.getChatCompletionsUrl()).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(service.aiAgent.getModelsUrl()).toBe('https://openrouter.ai/api/v1/models');

      const stored = JSON.parse(localStorage.getItem('mesheditor_ai_agent_config') || '{}');
      expect(stored.model).toBe('anthropic/claude-3.5-sonnet');
      expect(stored.apiKey).toBe('sk-or-test-12345');

      // Verify Gemini endpoint normalizes deprecated gemini-2.5-pro and shorthand flash aliases to gemini-3-flash-preview
      const geminiCfg = service.aiAgent.saveConfig({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-pro',
      });
      expect(geminiCfg.model).toBe('gemini-3-flash-preview');

      const flashAliasCfg = service.aiAgent.saveConfig({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-3.8-flash',
      });
      expect(flashAliasCfg.model).toBe('gemini-3-flash-preview');

      const proAliasCfg = service.aiAgent.saveConfig({
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'models/gemini-3.1-pro-preview',
      });
      expect(proAliasCfg.model).toBe('gemini-3.1-pro-preview');
    });

    it('fetches available models from OpenAI-compatible /models endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'o3-mini' }],
        }),
      });
      service.aiAgent.customFetch = mockFetch as any;

      const models = await service.aiAgent.fetchAvailableModels({
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'test-key',
      });

      expect(models).toEqual(['gpt-4o', 'gpt-4o-mini', 'o3-mini']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
    });

    it('includes built-in Babylon.js procedural-modeler, voxel-painter, mesh-updater, and image-to-mesh skills', () => {
      const skills = service.aiAgent.getSkills();
      expect(skills.length).toBe(BUILT_IN_AGENT_SKILLS.length);
      expect(skills.map((s) => s.id)).toEqual([
        'procedural-modeler',
        'voxel-painter',
        'mesh-updater',
        'image-to-mesh',
      ]);

      const sysPrompt = service.aiAgent.buildSystemPrompt();
      expect(sysPrompt).toContain('Procedural Modeler (MeshBuilder, CSG2, Extrude, Lathe)');
      expect(sysPrompt).toContain('Voxel & Block Modeler');
      expect(sysPrompt).toContain('Mesh Updater & Scene Sculptor');
      expect(sysPrompt).toContain('Image to 3D Mesh Vision Analyzer');

      // Disable voxel-painter and verify system prompt updates
      service.aiAgent.setSkillEnabled('voxel-painter', false);
      const updatedPrompt = service.aiAgent.buildSystemPrompt();
      expect(updatedPrompt).not.toContain('Voxel & Block Modeler');
    });

    it('discovers skills from /skills directory and parses markdown with YAML frontmatter', () => {
      const skills = discoverSkills();
      expect(skills.length).toBeGreaterThanOrEqual(4);
      expect(skills.some((s) => s.id === 'procedural-modeler')).toBe(true);

      // Test parsing frontmatter
      const sampleMd = `---
id: custom-terrain
name: Procedural Terrain Modeler
description: Generates heightmap terrains and noise landscapes.
enabled: false
---
# Terrain Generation
Use simplex noise to deform planes.`;

      const parsed = parseSkillMarkdown(sampleMd, 'fallback-id');
      expect(parsed.id).toBe('custom-terrain');
      expect(parsed.name).toBe('Procedural Terrain Modeler');
      expect(parsed.description).toBe('Generates heightmap terrains and noise landscapes.');
      expect(parsed.enabled).toBe(false);
      expect(parsed.instructions).toContain('Use simplex noise to deform planes.');

      // Test parsing pure markdown without frontmatter
      const pureMd = `# Low Poly Trees
Build low-poly trees using cylinder trunks and icosphere foliage.`;
      const parsedPure = parseSkillMarkdown(pureMd, 'low-poly-tree');
      expect(parsedPure.id).toBe('low-poly-tree');
      expect(parsedPure.name).toBe('Low Poly Trees');
      expect(parsedPure.description).toContain('Build low-poly trees');
      expect(parsedPure.enabled).toBe(true);

      // Register skill into agent service
      service.aiAgent.registerSkill(parsed);
      expect(service.aiAgent.getSkills().some((s) => s.id === 'custom-terrain')).toBe(true);

      // Register skill from markdown directly
      service.aiAgent.registerSkillFromMarkdown(pureMd, 'low-poly-tree');
      expect(service.aiAgent.getSkills().some((s) => s.id === 'low-poly-tree')).toBe(true);
    });
  });

  describe('2. Built-in Babylon.js Modeling Tools Execution', () => {
    it('executes primitive, extrude_polygon, lathe, tube, material, UV, and array cloning tools', async () => {
      // 1. Create Material with procedural marble texture
      const matRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_create_material', {
          materialName: 'Mat_Marble',
          albedoColor: '#f2efe9',
          roughness: 0.35,
          metallic: 0.05,
          proceduralTexture: 'marble',
          uScale: 2,
          vScale: 2,
        })
      );
      expect(matRes.status).toBe('ok');

      // 2. Extrude Polygon with hole (e.g. temple base frame)
      const polyRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_extrude_polygon', {
          name: 'Temple_Frame',
          shape: [
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
          ],
          holes: [
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ],
          ],
          depth: 0.5,
          position: [0, 0.5, 0],
          materialName: 'Mat_Marble',
        })
      );
      expect(polyRes.status).toBe('ok');
      expect(polyRes.vertices).toBeGreaterThan(0);

      // 3. Create Lathe (column)
      const latheRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_create_lathe', {
          name: 'Doric_Column',
          shape: [
            [0.35, 0, 0],
            [0.3, 1.5, 0],
            [0.25, 3.0, 0],
            [0.4, 3.2, 0],
          ],
          tessellation: 16,
          position: [-1.5, 0.5, -1.5],
          materialName: 'Mat_Marble',
        })
      );
      expect(latheRes.status).toBe('ok');
      expect(latheRes.vertices).toBeGreaterThan(20);

      // 4. Clone Array of columns and merge
      const cloneRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_clone_array', {
          sourceMeshName: 'Doric_Column',
          mode: 'linear',
          count: 3,
          offset: [1.5, 0, 0],
          mergeResult: true,
          newName: 'Colonnade_Row',
        })
      );
      expect(cloneRes.status).toBe('ok');
      expect(cloneRes.mergedMeshName).toBe('Colonnade_Row');

      // 5. Auto UV Mapping
      const uvRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_auto_uv_mapping', {
          meshName: 'Colonnade_Row',
          projection: 'box',
          uScale: 2,
          vScale: 2,
        })
      );
      expect(uvRes.status).toBe('ok');

      expect(service.importedMeshes.some((m) => m.name === 'Temple_Frame')).toBe(true);
      expect(service.importedMeshes.some((m) => m.name === 'Colonnade_Row')).toBe(true);
    });

    it('builds optimized multi-material voxel meshes with interior face culling', async () => {
      const voxRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_build_voxel_mesh', {
          name: 'Voxel_Tree',
          voxelSize: 0.25,
          palette: {
            trunk: { color: '#6b4423', roughness: 0.85 },
            leaves: { color: '#2e8b57', roughness: 0.65 },
          },
          boxes: [
            { start: [0, 0, 0], end: [0, 2, 0], type: 'trunk' },
            { start: [-1, 3, -1], end: [1, 4, 1], type: 'leaves' },
          ],
        })
      );

      expect(voxRes.status).toBe('ok');
      expect(voxRes.meshName).toBe('Voxel_Tree');
      expect(voxRes.solidVoxels).toBeGreaterThan(0);
      expect(voxRes.culledInteriorVoxels).toBeGreaterThanOrEqual(0);

      const treeMesh = service.importedMeshes.find((m) => m.name === 'Voxel_Tree');
      expect(treeMesh).toBeDefined();
      expect(treeMesh!.getTotalVertices()).toBeGreaterThan(0);
    });

    it('executes custom procedural Babylon.js code via modeler_execute_babylon_code', async () => {
      const codeRes = JSON.parse(
        await service.aiAgent.executeToolCall('modeler_execute_babylon_code', {
          description: 'Build a procedural crystal cluster',
          code: `
            const mat = createPBRMaterial('Mat_Crystal', '#38bdf8', 0.15, 0.2, '#0284c7');
            const shards = [];
            for (let i = 0; i < 4; i++) {
              const s = MeshBuilder.CreateCylinder('Shard_' + i, {
                height: 1.5 + i * 0.3,
                diameterBottom: 0.5,
                diameterTop: 0,
                tessellation: 6
              }, scene);
              s.position.set((i - 1.5) * 0.3, 0.75, 0);
              s.material = mat;
              shards.push(s);
            }
            const merged = Mesh.MergeMeshes(shards, true, true, undefined, false, true);
            merged.name = 'Crystal_Cluster';
            registerMesh(merged);
            return { created: merged.name, vertices: merged.getTotalVertices() };
          `,
        })
      );

      expect(codeRes.status).toBe('ok');
      expect(codeRes.result.created).toBe('Crystal_Cluster');
      expect(service.importedMeshes.some((m) => m.name === 'Crystal_Cluster')).toBe(true);
    });
  });

  describe('3. End-to-End Multi-Turn Agent Loop (Text-to-Mesh, Image-to-Mesh, Mesh Update & Undo/Redo)', () => {
    it('runs Text-to-Mesh and Text-to-Mesh Update against a mocked OpenAI endpoint with single-step Undo/Redo', async () => {
      let callCount = 0;
      service.aiAgent.customFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        callCount++;
        const body = JSON.parse(String(init?.body || '{}'));

        if (callCount === 1) {
          // Verify tools and system prompt are passed
          expect(body.tools.length).toBeGreaterThanOrEqual(13);
          expect(body.messages[0].role).toBe('system');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_1',
                        type: 'function',
                        function: {
                          name: 'modeler_create_primitive',
                          arguments: JSON.stringify({
                            shape: 'Box',
                            name: 'AI_Pedestal',
                            width: 2,
                            height: 1,
                            depth: 2,
                            position: [0, 0.5, 0],
                            color: '#94a3b8',
                          }),
                        },
                      },
                      {
                        id: 'call_2',
                        type: 'function',
                        function: {
                          name: 'modeler_create_primitive',
                          arguments: JSON.stringify({
                            shape: 'Sphere',
                            name: 'AI_Orb',
                            diameter: 1.2,
                            position: [0, 1.6, 0],
                            color: '#38bdf8',
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Created AI_Pedestal and AI_Orb on top of it.',
                },
              },
            ],
          }),
        };
      });

      const steps: string[] = [];
      const response = await service.aiAgent.runPrompt({
        prompt: 'Create a stone pedestal with a glowing blue orb on top',
        onStep: (step) => steps.push(step.toolName),
      });

      expect(response.content).toContain('AI_Pedestal');
      expect(steps).toEqual(['modeler_create_primitive', 'modeler_create_primitive']);
      expect(service.importedMeshes.map((m) => m.name)).toContain('AI_Pedestal');
      expect(service.importedMeshes.map((m) => m.name)).toContain('AI_Orb');

      // Verify single-step Undo reverts the entire AI generation turn
      service.undo();
      expect(service.importedMeshes.some((m) => m.name === 'AI_Pedestal')).toBe(false);
      expect(service.importedMeshes.some((m) => m.name === 'AI_Orb')).toBe(false);

      // Verify Redo restores the AI-generated meshes
      service.redo();
      expect(service.importedMeshes.some((m) => m.name === 'AI_Pedestal')).toBe(true);
      expect(service.importedMeshes.some((m) => m.name === 'AI_Orb')).toBe(true);
    });

    it('sends multimodal image_url payload for Image-to-Mesh requests and wires UI dialog', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = new MeshEditorApp({
        container,
        engine,
        layoutMode: 'floating',
      });

      let capturedRequestBody: any = null;
      app.service.aiAgent.customFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedRequestBody = JSON.parse(String(init?.body || '{}'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Reconstructed 3D asset from reference image.',
                },
              },
            ],
          }),
        };
      });

      // Open AI Agent dialog via toolbar button
      const btnToolbarAI = container.querySelector('#btnToolbarAIAgent') as HTMLButtonElement | null;
      const aiDialog = container.querySelector('#dialog-ai-agent') as HTMLElement | null;
      expect(btnToolbarAI).not.toBeNull();
      expect(aiDialog).not.toBeNull();
      btnToolbarAI?.click();
      expect(aiDialog?.style.display).toBe('flex');

      // Run Image-to-Mesh via service with a data URL image
      const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      await app.service.aiAgent.runPrompt({
        prompt: 'Build this low-poly shield from the image',
        images: [sampleDataUrl],
      });

      expect(capturedRequestBody).not.toBeNull();
      const userMessage = capturedRequestBody.messages[capturedRequestBody.messages.length - 1];
      expect(Array.isArray(userMessage.content)).toBe(true);
      expect(userMessage.content[0].type).toBe('text');
      expect(userMessage.content[1].type).toBe('image_url');
      expect(userMessage.content[1].image_url.url).toBe(sampleDataUrl);

      app.dispose();
      container.remove();
    });
  });
});

