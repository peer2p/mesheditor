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

    it('includes built-in Babylon.js procedural-modeler, voxel-painter, mesh-updater, image-to-mesh, and figure-sculptor skills', () => {
      const skills = service.aiAgent.getSkills();
      expect(skills.length).toBe(BUILT_IN_AGENT_SKILLS.length);
      expect(skills.map((s) => s.id)).toEqual([
        'procedural-modeler',
        'voxel-painter',
        'mesh-updater',
        'image-to-mesh',
        'figure-sculptor',
      ]);

      const sysPrompt = service.aiAgent.buildSystemPrompt();
      expect(sysPrompt).toContain('Procedural Modeler (MeshBuilder, CSG2, Extrude, Lathe)');
      expect(sysPrompt).toContain('Voxel & Block Modeler');
      expect(sysPrompt).toContain('Mesh Updater & Scene Sculptor');
      expect(sysPrompt).toContain('Image to 3D Mesh Vision Analyzer');
      expect(sysPrompt).toContain('Figure Sculptor & Game Retopology');

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

      // Open AI Agent dialog via dynamic Tools menu button
      const btnToggleAI = container.querySelector('#btnToggleAIAgent') as HTMLButtonElement | null;
      const aiDialog = container.querySelector('#dialog-ai-agent') as HTMLElement | null;
      expect(btnToggleAI).not.toBeNull();
      expect(aiDialog).not.toBeNull();
      btnToggleAI?.click();
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

      // Verify AI chat log empty state & reset behavior
      const chatLog = container.querySelector('#aiChatLog') as HTMLElement | null;
      const btnClearChat = container.querySelector('#btnAIClearChat') as HTMLButtonElement | null;
      expect(chatLog).not.toBeNull();
      expect(btnClearChat).not.toBeNull();

      // Initially, chat log should contain the initial empty-state text
      expect(chatLog?.querySelector('.ai-chat-empty')).not.toBeNull();
      expect(chatLog?.textContent).toContain('Text / Image to 3D Mesh & Update');

      // Click clear chat to verify the exact initial text is restored
      btnClearChat?.click();
      expect(chatLog?.querySelector('.ai-chat-empty')).not.toBeNull();
      expect(chatLog?.textContent).toContain('Text / Image to 3D Mesh & Update');
      expect(chatLog?.querySelector('.ai-chat-welcome')).toBeNull();

      app.dispose();
      container.remove();
    });

    it('renders ai-msg-text in Markdown using marked and records prompt via Speech-to-Text', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const nullEngine = new NullEngine();
      const app = new MeshEditorApp({
        container,
        engine: nullEngine,
      });

      const aiDialog = container.querySelector('#dialog-ai-agent') as HTMLElement | null;
      expect(aiDialog).not.toBeNull();
      expect(aiDialog?.style.width).toBe('380px');

      const btnRecordSpeech = container.querySelector('#btnAIRecordSpeech') as HTMLButtonElement | null;
      expect(btnRecordSpeech).not.toBeNull();
      expect(btnRecordSpeech?.title).toContain('Voice');

      // 1. Mock OpenAI endpoint that returns rich markdown response
      const markdownReply = '### Pillar Created\n\n- Height: **4.0**\n- Radius: `0.8`\n\n```ts\nmesh.position.y = 2;\n```';
      (globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-test-md',
          choices: [
            {
              message: {
                role: 'assistant',
                content: markdownReply,
                tool_calls: [],
              },
            },
          ],
        }),
      });

      const promptInput = container.querySelector('#aiPromptInput') as HTMLTextAreaElement | null;
      const btnGenerate = container.querySelector('#btnAIGenerate') as HTMLButtonElement | null;
      const chatLog = container.querySelector('#aiChatLog') as HTMLElement | null;
      expect(promptInput).not.toBeNull();
      expect(btnGenerate).not.toBeNull();
      expect(chatLog).not.toBeNull();

      if (promptInput) {
        promptInput.value = '**Make a Roman Pillar** with _fluting_';
      }

      await app.runAIAgentPrompt();

      // Verify user message is rendered in markdown
      const userMsgText = chatLog?.querySelector('.ai-msg-user .ai-msg-text') as HTMLElement | null;
      expect(userMsgText).not.toBeNull();
      expect(userMsgText?.innerHTML).toContain('<strong>Make a Roman Pillar</strong>');
      expect(userMsgText?.innerHTML).toContain('<em>fluting</em>');

      // Verify assistant message is rendered in markdown
      const assistantMsgText = chatLog?.querySelector('.ai-msg-assistant .ai-msg-text') as HTMLElement | null;
      expect(assistantMsgText).not.toBeNull();
      expect(assistantMsgText?.innerHTML).toContain('<h3>Pillar Created</h3>');
      expect(assistantMsgText?.innerHTML).toContain('<li>Height: <strong>4.0</strong></li>');
      expect(assistantMsgText?.innerHTML).toContain('<code>0.8</code>');
      expect(assistantMsgText?.innerHTML).toContain('mesh.position.y = 2;');

      // 2. Test Speech-to-Text Recording
      class MockSpeechRecognition {
        public continuous = false;
        public interimResults = false;
        public lang = 'en-US';
        public onstart: (() => void) | null = null;
        public onresult: ((e: any) => void) | null = null;
        public onerror: ((e: any) => void) | null = null;
        public onend: (() => void) | null = null;

        public start(): void {
          setTimeout(() => this.onstart?.(), 0);
        }

        public stop(): void {
          setTimeout(() => this.onend?.(), 0);
        }

        public simulateTranscript(text: string, isFinal: boolean = true): void {
          this.onresult?.({
            results: [
              [
                { transcript: text },
              ],
            ],
          });
          if (this.onresult) {
            (this.onresult as any)({
              results: {
                length: 1,
                0: Object.assign([{ transcript: text }], { isFinal }),
              },
            });
          }
        }
      }

      let activeMockRecognition: MockSpeechRecognition | null = null;
      (window as any).SpeechRecognition = function () {
        activeMockRecognition = new MockSpeechRecognition();
        return activeMockRecognition;
      };

      // Click record button to start voice recording
      btnRecordSpeech?.click();
      await new Promise((r) => setTimeout(r, 10));

      expect(btnRecordSpeech?.classList.contains('btn-recording')).toBe(true);
      expect(btnRecordSpeech?.title).toContain('Listening...');

      // Simulate incoming speech transcript
      activeMockRecognition?.simulateTranscript('Create a crystal dragon', true);
      expect(promptInput?.value).toBe('Create a crystal dragon');

      // Click again to stop
      btnRecordSpeech?.click();
      await new Promise((r) => setTimeout(r, 10));

      expect(btnRecordSpeech?.classList.contains('btn-recording')).toBe(false);
      expect(btnRecordSpeech?.title).toContain('Voice');

      // Cleanup
      delete (window as any).SpeechRecognition;
      app.dispose();
      container.remove();
    });

    it('manages polygon constraints (min/max) and texture generation toggle in config and UI', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const nullEngine = new NullEngine();
      const app = new MeshEditorApp({ container, engine: nullEngine });

      // Verify default values in service config
      const defaultCfg = app.service.aiAgent.getConfig();
      expect(defaultCfg.minPolygons).toBe(200);
      expect(defaultCfg.maxPolygons).toBe(5000);
      expect(defaultCfg.createTextures).toBe(true);
      expect(defaultCfg.createNormalMaps).toBe(true);

      // Verify default system prompt reflects constraints
      const defaultPrompt = app.service.aiAgent.buildSystemPrompt();
      expect(defaultPrompt).toContain('200 to 5,000 triangles');
      expect(defaultPrompt).toContain('Colors & Materials');
      expect(defaultPrompt).toContain('Normal maps are ENABLED');

      // Verify UI controls exist in DOM
      const minPolyInput = container.querySelector('#aiMinPolyInput') as HTMLInputElement | null;
      const minPolyVal = container.querySelector('#aiMinPolyVal') as HTMLElement | null;
      const maxPolyInput = container.querySelector('#aiMaxPolyInput') as HTMLInputElement | null;
      const maxPolyVal = container.querySelector('#aiMaxPolyVal') as HTMLElement | null;
      const createTexturesCheck = container.querySelector('#aiCreateTexturesCheck') as HTMLInputElement | null;
      const createTexturesCheckQuick = container.querySelector('#aiCreateTexturesCheckQuick') as HTMLInputElement | null;
      const createNormalMapsCheck = container.querySelector('#aiCreateNormalMapsCheck') as HTMLInputElement | null;
      const createNormalMapsCheckQuick = container.querySelector('#aiCreateNormalMapsCheckQuick') as HTMLInputElement | null;

      expect(minPolyInput).not.toBeNull();
      expect(minPolyInput?.value).toBe('200');
      expect(minPolyVal?.textContent).toBe('200');

      expect(maxPolyInput).not.toBeNull();
      expect(maxPolyInput?.value).toBe('5000');
      expect(maxPolyVal?.textContent).toBe('5,000');

      expect(createTexturesCheck?.checked).toBe(true);
      expect(createTexturesCheckQuick?.checked).toBe(true);
      expect(createNormalMapsCheck?.checked).toBe(true);
      expect(createNormalMapsCheckQuick?.checked).toBe(true);

      // Change sliders and save settings
      minPolyInput!.value = '400';
      minPolyInput!.dispatchEvent(new Event('input'));
      expect(minPolyVal?.textContent).toBe('400');

      maxPolyInput!.value = '8000';
      maxPolyInput!.dispatchEvent(new Event('input'));
      expect(maxPolyVal?.textContent).toBe('8,000');

      createTexturesCheck!.checked = false;
      createNormalMapsCheck!.checked = false;
      const btnSave = container.querySelector('#btnSaveAISettings') as HTMLButtonElement | null;
      btnSave?.click();

      // Check updated config
      const updatedCfg = app.service.aiAgent.getConfig();
      expect(updatedCfg.minPolygons).toBe(400);
      expect(updatedCfg.maxPolygons).toBe(8000);
      expect(updatedCfg.createTextures).toBe(false);
      expect(updatedCfg.createNormalMaps).toBe(false);

      // Check updated prompt
      const updatedPrompt = app.service.aiAgent.buildSystemPrompt();
      expect(updatedPrompt).toContain('400 to 8,000 triangles');
      expect(updatedPrompt).toContain('Textures DISABLED');

      // Check quick checkbox sync
      expect(createTexturesCheckQuick?.checked).toBe(false);
      createTexturesCheckQuick?.click();
      expect(app.service.aiAgent.getConfig().createTextures).toBe(true);
      expect(createTexturesCheck?.checked).toBe(true);

      expect(createNormalMapsCheckQuick?.checked).toBe(false);
      createNormalMapsCheckQuick?.click();
      expect(app.service.aiAgent.getConfig().createNormalMaps).toBe(true);
      expect(createNormalMapsCheck?.checked).toBe(true);

      app.dispose();
      container.remove();
    });

    it('toggles exclusively between Settings panel and Operative Agent GUI and displays all skills without scrollbox limit', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const nullEngine = new NullEngine();
      const app = new MeshEditorApp({ container, engine: nullEngine });

      const settingsPanel = container.querySelector('#aiSettingsPanel') as HTMLElement | null;
      const agentBody = container.querySelector('#aiAgentBody') as HTMLElement | null;
      const btnToggle = container.querySelector('#btnAISettingsToggle') as HTMLButtonElement | null;
      const btnCancel = container.querySelector('#btnCancelAISettings') as HTMLButtonElement | null;
      const titleText = container.querySelector('#aiDialogTitleText') as HTMLElement | null;
      const skillsList = container.querySelector('#aiSkillsList') as HTMLElement | null;

      expect(settingsPanel).not.toBeNull();
      expect(agentBody).not.toBeNull();
      expect(btnToggle).not.toBeNull();
      expect(btnCancel).not.toBeNull();

      // Initially: operative GUI is shown, settings are hidden
      expect(settingsPanel?.style.display).toBe('none');
      expect(agentBody?.style.display).not.toBe('none');
      expect(titleText?.textContent).toBe('AI Mesh Agent');

      // 1. Switch to Settings
      btnToggle?.click();
      expect(settingsPanel?.style.display).toBe('flex');
      expect(agentBody?.style.display).toBe('none');
      expect(titleText?.textContent).toBe('AI Agent Settings');

      // Verify all built-in skills are rendered with name and description
      const skillItems = skillsList?.querySelectorAll('.ai-skill-item');
      expect(skillItems?.length).toBe(app.service.aiAgent.getSkills().length);
      expect(skillItems?.length).toBeGreaterThanOrEqual(4);

      // Verify each skill item contains name and description text
      skillItems?.forEach((item) => {
        const nameEl = item.querySelector('.ai-skill-name');
        const descEl = item.querySelector('.ai-skill-desc');
        expect(nameEl?.textContent).toBeTruthy();
        expect(descEl?.textContent).toBeTruthy();
      });

      // 2. Click Cancel/Back to switch back to operative GUI
      btnCancel?.click();
      expect(settingsPanel?.style.display).toBe('none');
      expect(agentBody?.style.display).toBe('flex');
      expect(titleText?.textContent).toBe('AI Mesh Agent');

      // 3. Test inline "Configure" link opens settings exclusively
      const btnConfigureInline = container.querySelector('#btnOpenAISettingsInline') as HTMLButtonElement | null;
      btnConfigureInline?.click();
      expect(settingsPanel?.style.display).toBe('flex');
      expect(agentBody?.style.display).toBe('none');

      // 4. Test Maximum Polygons up to 1,000,000 and budget chips
      const maxPolyInput = container.querySelector('#aiMaxPolyInput') as HTMLInputElement | null;
      const maxPolyVal = container.querySelector('#aiMaxPolyVal') as HTMLElement | null;
      expect(maxPolyInput?.max).toBe('1000000');

      // Test preset chip for 1M (1,000,000)
      const chip1M = container.querySelector('#aiMaxPolyChips button[data-poly="1000000"]') as HTMLButtonElement | null;
      expect(chip1M).toBeTruthy();
      chip1M?.click();
      expect(maxPolyInput?.value).toBe('1000000');
      expect(maxPolyVal?.textContent).toContain('1');

      // 5. Save settings closes settings exclusively and persists 1,000,000 max polygons
      const btnSave = container.querySelector('#btnSaveAISettings') as HTMLButtonElement | null;
      btnSave?.click();
      expect(settingsPanel?.style.display).toBe('none');
      expect(agentBody?.style.display).toBe('flex');
      expect(app.service.aiAgent.getConfig().maxPolygons).toBe(1000000);

      // Verify endpoint summary badge reflects 1Mp ceiling
      const endpointSummary = container.querySelector('#aiEndpointSummaryBar') as HTMLElement | null;
      expect(endpointSummary?.textContent).toContain('1Mp');

      // 6. Test Model selector dropdown and custom input toggle
      const modelSelect = container.querySelector('#aiModelSelect') as HTMLSelectElement | null;
      const modelInput = container.querySelector('#aiModelInput') as HTMLInputElement | null;
      const btnToggleCustom = container.querySelector('#btnToggleCustomModel') as HTMLButtonElement | null;
      expect(modelSelect).toBeTruthy();
      expect(modelInput).toBeTruthy();
      expect(btnToggleCustom).toBeTruthy();

      // Test changing model in select updates config and modelInput
      if (modelSelect) {
        modelSelect.value = 'gemini-4-argon-medium';
        modelSelect.dispatchEvent(new Event('change'));
        expect(modelInput?.value).toBe('gemini-4-argon-medium');
        expect(app.service.aiAgent.getConfig().model).toBe('gemini-4-argon-medium');
      }

      // Test toggling custom input view
      btnToggleCustom?.click();
      expect(modelInput?.style.display).toBe('inline-block');
      expect(modelSelect?.style.display).toBe('none');
      btnToggleCustom?.click();
      expect(modelInput?.style.display).toBe('none');
      expect(modelSelect?.style.display).toBe('inline-block');

      // 7. Test Copy Button on messages and instant skills/thinking indicators
      const chatLog = container.querySelector('#aiChatLog') as HTMLElement;
      expect(chatLog).toBeTruthy();

      // Mock runPrompt endpoint
      app.service.aiAgent.customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'I built a test stone pillar with fluted columns.',
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'modeler_create_primitive',
                      arguments: JSON.stringify({ shape: 'box', name: 'pillar_base' }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      }) as any;

      const promptInput = container.querySelector('#aiPromptInput') as HTMLTextAreaElement;
      promptInput.value = 'Build a stone pillar';
      await app.runAIAgentPrompt();

      // Verify user message has header, role, and copy button
      const userBubble = chatLog.querySelector('.ai-msg.ai-msg-user');
      expect(userBubble).toBeTruthy();
      const userCopyBtn = userBubble?.querySelector('.ai-msg-copy-btn') as HTMLButtonElement;
      expect(userCopyBtn).toBeTruthy();
      expect(userCopyBtn.title).toBe('Copy prompt');

      // Verify assistant message has header, live timer, active skills bar, tool step, and copy button
      const assistantBubble = chatLog.querySelector('.ai-msg.ai-msg-assistant');
      expect(assistantBubble).toBeTruthy();
      const assistantCopyBtn = assistantBubble?.querySelector('.ai-msg-copy-btn') as HTMLButtonElement;
      expect(assistantCopyBtn).toBeTruthy();
      expect(assistantCopyBtn.title).toBe('Copy response');

      const skillsBar = assistantBubble?.querySelector('.ai-active-skills-bar');
      expect(skillsBar).toBeTruthy();
      expect(skillsBar?.textContent).toContain('Skills:');

      const toolStep = assistantBubble?.querySelector('.ai-tool-step.is-success');
      expect(toolStep).toBeTruthy();
      expect(toolStep?.textContent).toContain('create_primitive');

      // Test clipboard copy execution
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy,
        },
      });

      userCopyBtn.click();
      expect(writeTextSpy).toHaveBeenCalledWith('Build a stone pillar');

      assistantCopyBtn.click();
      expect(writeTextSpy).toHaveBeenCalledWith('I built a test stone pillar with fluted columns.');

      app.dispose();
      container.remove();
    });
  });
});

