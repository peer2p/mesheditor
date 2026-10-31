import { NullEngine, MeshBuilder, Mesh, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorService } from '../../src/MeshEditorService';
import {
  AbstractTool,
  ToolInterface,
  ToolRegistry,
  ToolExecutionContext,
  createDefaultToolRegistry,
  CreatePrimitiveTool,
  GetSceneInfoTool,
} from '../../src/tools';

describe('Modular Tools Architecture (ToolInterface, AbstractTool, ToolRegistry)', () => {
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

  describe('1. ToolInterface & AbstractTool Base Class', () => {
    it('provides standard OpenAI tool definitions from metadata', () => {
      const tool = new GetSceneInfoTool();
      const def = tool.getDefinition();

      expect(def.type).toBe('function');
      expect(def.function.name).toBe('modeler_get_scene_info');
      expect(typeof def.function.description).toBe('string');
      expect(def.function.parameters).toEqual({ type: 'object', properties: {} });
    });

    it('exposes shared vector, color, and mesh helper methods on AbstractTool', () => {
      class TestToolHelper extends AbstractTool {
        public readonly name = 'test_helper_tool';
        public readonly description = 'Test tool for helpers';
        public readonly parameters = { type: 'object', properties: {} };

        public execute(_args: any, _context: ToolExecutionContext): string {
          return 'ok';
        }

        public testVec3(v: any, def?: number): Vector3 {
          return this.parseVec3(v, def);
        }

        public testPolygonPoint(p: any): Vector3 {
          return this.parsePolygonPoint(p);
        }

        public testNormalizeHex(hex: string): string {
          return this.normalizeHex(hex);
        }
      }

      const helper = new TestToolHelper();

      // Test parseVec3
      expect(helper.testVec3([1, 2, 3])).toEqual(new Vector3(1, 2, 3));
      expect(helper.testVec3({ x: 4, y: 5, z: 6 })).toEqual(new Vector3(4, 5, 6));
      expect(helper.testVec3(null, 9)).toEqual(new Vector3(9, 9, 9));

      // Test parsePolygonPoint
      expect(helper.testPolygonPoint([10, 20])).toEqual(new Vector3(10, 0, 20));
      expect(helper.testPolygonPoint([10, 20, 30])).toEqual(new Vector3(10, 20, 30));
      expect(helper.testPolygonPoint({ x: 5, y: 15, z: 25 })).toEqual(new Vector3(5, 15, 25));

      // Test normalizeHex
      expect(helper.testNormalizeHex('#fff')).toBe('#ffffff');
      expect(helper.testNormalizeHex('#123456')).toBe('#123456');
      expect(helper.testNormalizeHex('invalid')).toBe('#58a6ff');
    });
  });

  describe('2. ToolRegistry Management', () => {
    it('initializes default registry with all 18 built-in modeling tools', () => {
      const registry = createDefaultToolRegistry();
      const allTools = registry.getAll();

      expect(allTools.length).toBe(18);
      expect(registry.has('modeler_get_scene_info')).toBe(true);
      expect(registry.has('modeler_create_primitive')).toBe(true);
      expect(registry.has('modeler_extrude_polygon')).toBe(true);
      expect(registry.has('modeler_extrude_shape')).toBe(true);
      expect(registry.has('modeler_create_lathe')).toBe(true);
      expect(registry.has('modeler_create_tube')).toBe(true);
      expect(registry.has('modeler_boolean_operation')).toBe(true);
      expect(registry.has('modeler_create_material')).toBe(true);
      expect(registry.has('modeler_apply_material')).toBe(true);
      expect(registry.has('modeler_auto_uv_mapping')).toBe(true);
      expect(registry.has('modeler_transform_mesh')).toBe(true);
      expect(registry.has('modeler_clone_array')).toBe(true);
      expect(registry.has('modeler_merge_meshes')).toBe(true);
      expect(registry.has('modeler_separate_mesh')).toBe(true);
      expect(registry.has('modeler_delete_mesh')).toBe(true);
      expect(registry.has('modeler_build_voxel_mesh')).toBe(true);
      expect(registry.has('modeler_paint_voxels')).toBe(true);
      expect(registry.has('modeler_execute_babylon_code')).toBe(true);

      const openAiDefs = registry.getOpenAITools();
      expect(openAiDefs.length).toBe(18);
      expect(openAiDefs.every((d) => d.type === 'function' && typeof d.function.name === 'string')).toBe(true);
    });

    it('allows registering, looking up, and unregistering tools dynamically', () => {
      const registry = new ToolRegistry();
      expect(registry.getAll().length).toBe(0);

      const primTool = new CreatePrimitiveTool();
      registry.register(primTool);

      expect(registry.has(primTool.name)).toBe(true);
      expect(registry.get(primTool.name)).toBe(primTool);
      expect(registry.getAll().length).toBe(1);

      const unregistered = registry.unregister(primTool.name);
      expect(unregistered).toBe(true);
      expect(registry.has(primTool.name)).toBe(false);
      expect(registry.getAll().length).toBe(0);
    });

    it('throws when executing an unknown tool name', async () => {
      const registry = new ToolRegistry();
      const ctx = service.aiAgent.createToolContext();

      await expect(registry.execute('modeler_unknown_tool', {}, ctx)).rejects.toThrow(
        'Unknown tool: modeler_unknown_tool'
      );
    });
  });

  describe('3. Rapid Custom Tool Development & Extensibility', () => {
    it('enables quickly authoring a new autarkic tool class extending AbstractTool and registering it', async () => {
      // Define a custom specialized tool in a few lines of code
      class CreatePyramidTool extends AbstractTool {
        public readonly name = 'modeler_create_pyramid';
        public readonly description = 'Creates a 4-sided pyramid in the live Babylon.js scene.';
        public readonly parameters = {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the pyramid' },
            baseSize: { type: 'number', description: 'Base width and depth' },
            height: { type: 'number', description: 'Height of the pyramid' },
            color: { type: 'string', description: 'Hex color string' },
          },
          required: ['name'],
        };

        public execute(args: any, context: ToolExecutionContext): string {
          const baseSize = Number(args.baseSize) || 2;
          const height = Number(args.height) || 2;
          const name = String(args.name || 'custom_pyramid');

          // Cylinder with 4 tessellations and diameterTop=0 forms a 4-sided pyramid
          const pyramid = MeshBuilder.CreateCylinder(
            name,
            {
              height,
              diameterTop: 0,
              diameterBottom: baseSize * Math.SQRT2,
              tessellation: 4,
            },
            context.scene
          );

          pyramid.material = this.getOrCreateMaterial(
            context,
            undefined,
            args.color || '#e0a030',
            0.4,
            0.1,
            name
          );

          this.applyTransform(pyramid, args, context);
          this.registerMesh(pyramid, context);

          return JSON.stringify({
            status: 'ok',
            meshName: pyramid.name,
            vertices: pyramid.getTotalVertices(),
          });
        }
      }

      // Register into live AIAgentService
      const pyramidTool = new CreatePyramidTool();
      service.aiAgent.registerTool(pyramidTool);

      // Verify tool definition appears in agent's OpenAI tool specs
      const tools = service.aiAgent.getOpenAITools();
      const found = tools.find((t) => t.function.name === 'modeler_create_pyramid');
      expect(found).toBeDefined();
      expect(found?.function.description).toContain('4-sided pyramid');

      // Execute custom tool via aiAgent.executeToolCall
      const resultJson = await service.aiAgent.executeToolCall('modeler_create_pyramid', {
        name: 'Giza_Pyramid',
        baseSize: 4,
        height: 3,
        color: '#ffcc00',
        position: { x: 0, y: 1.5, z: 0 },
      });

      const res = JSON.parse(resultJson);
      expect(res.status).toBe('ok');
      expect(res.meshName).toBe('Giza_Pyramid');
      expect(res.vertices).toBeGreaterThan(0);

      // Verify the pyramid exists in the Babylon scene and service tracking
      const mesh = service.importedMeshes.find((m) => m.name === 'Giza_Pyramid');
      expect(mesh).toBeDefined();
      expect(mesh?.position.y).toBe(1.5);
    });
  });
});

