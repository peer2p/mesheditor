import { NullEngine, MeshBuilder, Mesh, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';
import {
  AbstractTool,
  ToolInterface,
  ToolRegistry,
  ToolExecutionContext,
  createDefaultToolRegistry,
  CreatePrimitiveTool,
  GetSceneInfoTool,
  getBuiltinEditorTools,
  createBuiltinEditorTools,
  OutlinerEditorTool,
  CreatePrimitiveEditorTool,
  CSGEditorTool,
  FacetEditorTool,
  TextureOptimizerEditorTool,
  CompressModelEditorTool,
  VoxelPainterEditorTool,
  PathExtrusionEditorTool,
  AIAgentEditorTool,
  MeshPropertiesEditorTool,
  MaterialEditorTool,
  SceneEnvironmentEditorTool,
  AnimationPlayerEditorTool,
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
    it('initializes default registry with all 25 built-in modeling tools', () => {
      const registry = createDefaultToolRegistry();
      const allTools = registry.getAll();

      expect(allTools.length).toBe(25);
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
      expect(registry.has('modeler_solidify_mesh')).toBe(true);
      expect(registry.has('modeler_subdivide_mesh')).toBe(true);
      expect(registry.has('modeler_subd_smooth')).toBe(true);
      expect(registry.has('modeler_facet_extrude')).toBe(true);
      expect(registry.has('modeler_facet_inset')).toBe(true);
      expect(registry.has('modeler_facet_arc')).toBe(true);
      expect(registry.has('modeler_facet_cut_through')).toBe(true);

      const openAiDefs = registry.getOpenAITools();
      expect(openAiDefs.length).toBe(25);
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

  describe('4. Tool Abstraction, In-App Help Guides & Dialog Wiring', () => {
    it('provides unified ToolInterface metadata and comprehensive English help text for all 13 editor tools', () => {
      const editorTools = getBuiltinEditorTools();
      expect(editorTools.length).toBe(13);

      const requiredTools = [
        'scene_outliner',
        'create_primitive',
        'csg_sculpting',
        'facet_editor',
        'texture_optimizer',
        'compress_model',
        'voxel_painter',
        'path_extrusion',
        'ai_agent',
        'mesh_properties',
        'material_uv',
        'scene_environment',
        'animation_player',
      ];

      for (const name of requiredTools) {
        const tool = editorTools.find((t) => t.name === name);
        expect(tool, `Tool ${name} should be registered`).toBeDefined();
        expect(tool!.dialogId).toBeDefined();
        expect(tool!.triggerButtonId).toBeDefined();
        expect(tool!.icon).toBeDefined();
        expect(tool!.description).toBeDefined();
        expect(tool!.helpText).toBeDefined();
        expect(tool!.helpText!.length).toBeGreaterThan(100);
        // Ensure help text is strictly in English (not German)
        expect(tool!.helpText).not.toMatch(/Benutzer|Möglichkeiten|Einstellungen|Werkzeug/i);
      }
    });

    it('renders a help (?) button directly to the left of the minimize button in dialog headers and opens help modal', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.id = 'app-test-container';
      document.body.appendChild(container);

      const app = new MeshEditorApp({
        container,
        engine,
      });

      // Verify that every floating dialog header has a .btn-help before .btn-min
      for (const tool of app.editorTools) {
        if (!tool.dialogId) continue;
        const dialog = container.querySelector(`#${tool.dialogId}`) as HTMLElement | null;
        expect(dialog, `Dialog #${tool.dialogId} should exist`).not.toBeNull();

        const btnMin = dialog!.querySelector('.btn-min') as HTMLElement | null;
        const btnHelp = dialog!.querySelector('.btn-help') as HTMLElement | null;
        expect(btnMin, `btn-min in ${tool.dialogId} should exist`).not.toBeNull();
        expect(btnHelp, `btn-help in ${tool.dialogId} should exist`).not.toBeNull();

        // Check DOM ordering: btn-help must precede btn-min
        const actions = dialog!.querySelector('.dialog-actions')!;
        const children = Array.from(actions.children);
        const helpIndex = children.indexOf(btnHelp!);
        const minIndex = children.indexOf(btnMin!);
        expect(helpIndex).toBeLessThan(minIndex);
      }

      // Test opening help modal via the Voxel Painter ? button
      const voxelDlg = container.querySelector('#dialog-voxel-painter') as HTMLElement;
      const btnVoxelHelp = voxelDlg.querySelector('.btn-help') as HTMLButtonElement;
      btnVoxelHelp.click();

      const helpModal = container.querySelector('#toolHelpModal') as HTMLElement;
      expect(helpModal).not.toBeNull();
      expect(helpModal.classList.contains('active')).toBe(true);

      const titleEl = container.querySelector('#toolHelpTitle');
      expect(titleEl?.textContent).toContain('Voxel Painter');

      const bodyEl = container.querySelector('#toolHelpBody');
      expect(bodyEl?.innerHTML).toContain('Left Click');

      // Test closing via close button
      const btnClose = container.querySelector('#btnCloseToolHelp') as HTMLButtonElement;
      btnClose.click();
      expect(helpModal.classList.contains('active')).toBe(false);

      // Reopen and test closing via "Got it!" button
      btnVoxelHelp.click();
      expect(helpModal.classList.contains('active')).toBe(true);

      const btnDone = container.querySelector('#btnDoneToolHelp') as HTMLButtonElement;
      btnDone.click();
      expect(helpModal.classList.contains('active')).toBe(false);
    });

    it('abstracts tool lifecycle hooks: handles open, close, minimize, maximize, and exclusive 3D tool deactivation', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.id = 'app-test-container-lifecycle';
      document.body.appendChild(container);

      const app = new MeshEditorApp({
        container,
        engine,
      });

      // 1. Open Voxel Painter: sets active = true
      app.toggleDialog('dialog-voxel-painter', true);
      expect(app.service.voxelPainter.isActive).toBe(true);
      expect(app.service.pathExtrusion.isActive).toBe(false);

      // 2. Open Path Extrusion: deactivates 3D editing of Voxel Painter WITHOUT closing its dialog
      app.toggleDialog('dialog-path-extrusion', true);
      expect(app.service.pathExtrusion.isActive).toBe(true);
      expect(app.service.voxelPainter.isActive).toBe(false);
      const voxelDlg = container.querySelector('#dialog-voxel-painter') as HTMLElement;
      const pathDlg = container.querySelector('#dialog-path-extrusion') as HTMLElement;
      expect(voxelDlg.style.display).not.toBe('none');
      expect(pathDlg.style.display).not.toBe('none');

      // 3. Focusing / clicking Voxel Painter dialog reactivates Voxel Painter and deactivates Path Extrusion
      app.bringDialogToFront(voxelDlg);
      expect(app.service.voxelPainter.isActive).toBe(true);
      expect(app.service.pathExtrusion.isActive).toBe(false);
      expect(voxelDlg.style.display).not.toBe('none');
      expect(pathDlg.style.display).not.toBe('none');

      // Reactivate Path Extrusion for subsequent tests
      app.bringDialogToFront(pathDlg);
      expect(app.service.pathExtrusion.isActive).toBe(true);
      expect(app.service.voxelPainter.isActive).toBe(false);

      // 4. Path Extrusion does NOT create a path automatically on activation
      expect(app.service.pathExtrusion.paths.length).toBe(0);

      // 5. Minimize Path Extrusion: deactivates path extrusion tool
      app.toggleDialogMinimize(pathDlg, true);
      expect(pathDlg.classList.contains('minimized')).toBe(true);
      expect(app.service.pathExtrusion.isActive).toBe(false);

      // 6. Maximize Path Extrusion: reactivates path extrusion tool
      app.toggleDialogMinimize(pathDlg, false);
      expect(pathDlg.classList.contains('minimized')).toBe(false);
      expect(app.service.pathExtrusion.isActive).toBe(true);

      // 7. Close Path Extrusion
      app.toggleDialog('dialog-path-extrusion', false);
      expect(app.service.pathExtrusion.isActive).toBe(false);

      // 8. Switching to standard transform gizmo deactivates active exclusive 3D tools without closing dialogs
      app.toggleDialog('dialog-voxel-painter', true);
      app.bringDialogToFront(voxelDlg);
      expect(app.service.voxelPainter.isActive).toBe(true);
      expect(voxelDlg.style.display).toBe('flex');

      container.querySelector('#btnGizmoTranslate')?.dispatchEvent(new MouseEvent('click'));
      expect(app.service.voxelPainter.isActive).toBe(false);
      expect(voxelDlg.style.display).toBe('flex');

      // 9. Switching to a standard panel (e.g. Create Mesh) does not close open exclusive 3D tool dialogs
      app.toggleDialog('dialog-create-primitive', true);
      expect(voxelDlg.style.display).toBe('flex');
    });

    it('instantiates all decentralized editor tool classes with self-contained configurations and help guides', () => {
      const tools = createBuiltinEditorTools();
      expect(tools.length).toBe(13);

      const outliner = new OutlinerEditorTool();
      expect(outliner.name).toBe('scene_outliner');
      expect(outliner.dialogId).toBe('dialog-outliner');
      expect(outliner.helpText).toContain('Scene Objects Outliner');

      const createMesh = new CreatePrimitiveEditorTool();
      expect(createMesh.name).toBe('create_primitive');
      expect(createMesh.dialogId).toBe('dialog-create-primitive');
      expect(createMesh.helpText).toContain('Create Mesh');

      const csg = new CSGEditorTool();
      expect(csg.name).toBe('csg_sculpting');
      expect(csg.dialogId).toBe('dialog-csg');
      expect(csg.helpText).toContain('Constructive Solid Geometry');

      const facet = new FacetEditorTool();
      expect(facet.name).toBe('facet_editor');
      expect(facet.dialogId).toBe('dialog-facet');

      const tex = new TextureOptimizerEditorTool();
      expect(tex.name).toBe('texture_optimizer');
      expect(tex.dialogId).toBe('dialog-textures');

      const compressTool = new CompressModelEditorTool();
      expect(compressTool.name).toBe('compress_model');
      expect(compressTool.dialogId).toBe('dialog-compress-model');
      expect(compressTool.helpText).toContain('Compress Model');

      const voxel = new VoxelPainterEditorTool();
      expect(voxel.name).toBe('voxel_painter');
      expect(voxel.isExclusive3DTool).toBe(true);

      const path = new PathExtrusionEditorTool();
      expect(path.name).toBe('path_extrusion');
      expect(path.isExclusive3DTool).toBe(true);

      const ai = new AIAgentEditorTool();
      expect(ai.name).toBe('ai_agent');
      expect(ai.dialogId).toBe('dialog-ai-agent');

      const props = new MeshPropertiesEditorTool();
      expect(props.name).toBe('mesh_properties');

      const mat = new MaterialEditorTool();
      expect(mat.name).toBe('material_uv');

      const scene = new SceneEnvironmentEditorTool();
      expect(scene.name).toBe('scene_environment');

      const anim = new AnimationPlayerEditorTool();
      expect(anim.name).toBe('animation_player');

      // Verify each decentralized tool is an instance of ToolInterface with complete metadata
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.menuLabel).toBeTruthy();
        expect(t.icon).toBeTruthy();
        expect(t.dialogId).toBeTruthy();
        expect(t.helpText).toBeTruthy();
        expect(t.description).toBeTruthy();

        // Verify each tool brings its own decentralized view template
        const viewTemplate = t.getViewTemplate?.();
        expect(viewTemplate).toBeTruthy();
        expect(viewTemplate).toContain(`id="${t.dialogId}"`);
        expect(viewTemplate).toContain('class="floating-dialog');
        expect(viewTemplate).toContain('class="dialog-header"');
      }
    });

    it('mounts decentralized tool views dynamically into container when missing from DOM', () => {
      const container = document.createElement('div');
      container.id = 'customContainer';
      document.body.appendChild(container);

      const voxelTool = new VoxelPainterEditorTool();
      expect(voxelTool.dialogId).toBe('dialog-voxel-painter');

      // Clean up any lingering dialog from previous tests
      document.getElementById('dialog-voxel-painter')?.remove();

      // Ensure dialog is not yet in DOM
      expect(document.getElementById('dialog-voxel-painter')).toBeNull();

      // Render view dynamically
      const renderedElement = voxelTool.renderView(container);
      expect(renderedElement).not.toBeNull();
      expect(renderedElement?.id).toBe('dialog-voxel-painter');
      expect(container.contains(renderedElement!)).toBe(true);

      // Subsequent call returns existing element without duplicating
      const secondCall = voxelTool.renderView(container);
      expect(secondCall).toBe(renderedElement);
      expect(container.querySelectorAll('#dialog-voxel-painter').length).toBe(1);

      container.remove();
    });

    it('dynamically builds the Tools dropdown menu from ToolInterface instances without hardcoding in EJS', () => {
      document.body.innerHTML = '';
      const container = document.createElement('div');
      container.id = 'app-test-container-dynamic-menu';
      document.body.appendChild(container);

      const app = new MeshEditorApp({
        container,
        engine,
      });

      const menuTools = container.querySelector('#menuTools');
      expect(menuTools).not.toBeNull();

      // Verify that all 12 editor tools have dynamically generated menu items
      for (const tool of app.editorTools) {
        if (!tool.triggerButtonId) continue;
        const btn = menuTools!.querySelector(`#${tool.triggerButtonId}`) as HTMLButtonElement | null;
        expect(btn, `Button #${tool.triggerButtonId} should be dynamically rendered`).not.toBeNull();
        expect(btn?.getAttribute('data-tool-name')).toBe(tool.name);
        expect(btn?.textContent).toContain(tool.menuLabel);
      }

      // Verify that NO quick-toggle buttons exist in the top toolbar
      const quickToolbarToggles = container.querySelectorAll(
        '#btnToolbarAIAgent, #btnToolbarVoxelPainter, #btnToolbarPathExtrusion, .ai-toolbar-group, .voxel-toolbar-group, .path-extrusion-toolbar-group'
      );
      expect(quickToolbarToggles.length).toBe(0);

      // Verify registering a new tool dynamically appends it to #menuTools
      const customTool = {
        name: 'custom_procedural_tool',
        menuLabel: 'Procedural Generator',
        triggerButtonId: 'btnToggleCustomProceduralTool',
        dialogId: 'dialog-custom-procedural',
        icon: 'sparkles',
        order: 99,
        description: 'Dynamically registered procedural tool',
      };

      app.registerEditorTool(customTool as any);

      const customBtn = menuTools!.querySelector('#btnToggleCustomProceduralTool') as HTMLButtonElement | null;
      expect(customBtn).not.toBeNull();
      expect(customBtn?.textContent).toContain('Procedural Generator');
    });
  });

  describe('5. Facet & Box Modeling Builtin AI Tools', () => {
    it('solidifies an open mesh sheet with real physical wall thickness', async () => {
      // Create a test box
      const box = MeshBuilder.CreateBox('test_box', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_solidify_mesh', {
        meshName: 'test_box',
        thickness: 0.15,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.meshName).toBe('test_box');
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
      expect(parsed.thickness).toBe(0.15);
    });

    it('subdivides mesh faces into equilateral subtriangles', async () => {
      const box = MeshBuilder.CreateBox('subdiv_box', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialIndices = box.getTotalIndices(); // 36 indices = 12 triangles

      const result = await service.aiAgent.executeToolCall('modeler_subdivide_mesh', {
        meshName: 'subdiv_box',
        iterations: 1,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.totalIndices).toBe(initialIndices * 4); // 48 triangles = 144 indices
    });

    it('applies Sub-D smoothing with midpoint subdivision and Laplacian relaxation', async () => {
      const box = MeshBuilder.CreateBox('smooth_cage', { size: 2 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_subd_smooth', {
        meshName: 'smooth_cage',
        iterations: 2,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.meshName).toBe('smooth_cage');
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
    });

    it('extrudes a facet along normal with connecting side quads', async () => {
      const box = MeshBuilder.CreateBox('extrude_tower', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_facet_extrude', {
        meshName: 'extrude_tower',
        direction: 'top',
        distance: 0.8,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.faceDirection).toBe('top');
      expect(parsed.distance).toBe(0.8);
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
    });

    it('insets a facet toward centroid with depth offset', async () => {
      const box = MeshBuilder.CreateBox('inset_window', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_facet_inset', {
        meshName: 'inset_window',
        direction: 'front',
        insetAmount: 0.2,
        depth: -0.1,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.faceDirection).toBe('front');
      expect(parsed.insetAmount).toBe(0.2);
      expect(parsed.depth).toBe(-0.1);
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
    });

    it('extrudes a facet along a curved circular arch', async () => {
      const box = MeshBuilder.CreateBox('arch_bridge', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_facet_arc', {
        meshName: 'arch_bridge',
        direction: 'top',
        segments: 4,
        height: 0.6,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.segments).toBe(4);
      expect(parsed.height).toBe(0.6);
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
    });

    it('punches a cut-through portal into a mesh', async () => {
      const box = MeshBuilder.CreateBox('portal_wall', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      const initialVerts = box.getTotalVertices();

      const result = await service.aiAgent.executeToolCall('modeler_facet_cut_through', {
        meshName: 'portal_wall',
        direction: 'front',
        depth: 0.5,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.depth).toBe(0.5);
      expect(parsed.totalVertices).toBeGreaterThan(initialVerts);
    });

    it('generates seamless sand procedural texture and sets up tiling', async () => {
      const result = await service.aiAgent.executeToolCall('modeler_create_material', {
        materialName: 'DesertSandMat',
        roughness: 0.9,
        metallic: 0.0,
        uScale: 3,
        vScale: 3,
        proceduralTexture: {
          type: 'sand',
          primaryColor: '#c2b280',
          secondaryColor: '#9c8c5a',
          scale: 1.5,
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');
      expect(parsed.materialName).toBe('DesertSandMat');

      const mat = service.scene.getMaterialByName('DesertSandMat') as any;
      expect(mat).toBeDefined();
      expect(mat.roughness).toBe(0.9);
      expect(mat.albedoTexture).toBeDefined();
      expect(mat.albedoTexture.uScale).toBe(3);
      expect(mat.albedoTexture.vScale).toBe(3);
    });

    it('applies direct image texture URL and tiling to PBR material', async () => {
      const fakeDataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

      const result = await service.aiAgent.executeToolCall('modeler_create_material', {
        materialName: 'AiGeneratedSandMat',
        textureUrl: fakeDataUrl,
        uScale: 5,
        vScale: 5,
        roughness: 0.95,
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('ok');

      const mat = service.scene.getMaterialByName('AiGeneratedSandMat') as any;
      expect(mat).toBeDefined();
      expect(mat.albedoTexture).toBeDefined();
      expect(mat.albedoTexture.uScale).toBe(5);
      expect(mat.albedoTexture.vScale).toBe(5);
    });
  });
});

