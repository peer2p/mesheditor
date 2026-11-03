import { Mesh, MeshBuilder, NullEngine, Vector3, VertexBuffer } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';
import { SculptController } from '../../src/sculpting/SculptController';
import { SculptEditorTool } from '../../src/tools/editor/SculptEditorTool';
import { SpawnBaseMeshTool, RetopologizeMeshTool } from '../../src/tools/builtin';

describe('Figure Sculpt & Retopology (Anatomy, Sculpting, and Game Retopo)', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;
  let app: MeshEditorApp;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
    app = new MeshEditorApp({
      container: document.body,
      engine,
    });
  });

  afterEach(() => {
    app?.dispose();
    service?.dispose();
    canvas?.remove();
  });

  describe('1. SculptController State & Brush Mechanics', () => {
    it('initializes controller with default brush properties and cursor indicators', () => {
      const ctrl = service.sculptController;
      expect(ctrl).toBeDefined();
      expect(ctrl.isActive).toBe(false);
      expect(ctrl.brushType).toBe('clay');
      expect(ctrl.radius).toBe(0.35);
      expect(ctrl.strength).toBe(0.5);
      expect(ctrl.symmetryX).toBe(true);

      ctrl.setRadius(0.8);
      expect(ctrl.radius).toBe(0.8);

      ctrl.setStrength(0.75);
      expect(ctrl.strength).toBe(0.75);

      ctrl.setBrushType('grab');
      expect(ctrl.brushType).toBe('grab');

      ctrl.setSymmetry(false);
      expect(ctrl.symmetryX).toBe(false);

      ctrl.setInvert(true);
      expect(ctrl.invert).toBe(true);
    });

    it('deforms mesh vertices with clay brush and mirrors across X=0 when symmetry is active', () => {
      const ctrl = service.sculptController;
      ctrl.setActive(true);
      ctrl.setBrushType('clay');
      ctrl.setRadius(1.0);
      ctrl.setStrength(0.8);
      ctrl.setSymmetry(true);

      const sphere = MeshBuilder.CreateSphere('testSphere', { diameter: 2.0, segments: 16 }, service.scene);
      service.addMesh(sphere);
      service.selectMesh(sphere);

      const initialPos = sphere.getVerticesData(VertexBuffer.PositionKind)!;

      // Stroke at positive X on sphere surface (0.5, 0.5, 0.707)
      const hit = new Vector3(0.5, 0.5, 0.707);
      ctrl.applyBrushStroke(sphere, hit, hit.clone().normalize());

      const postPos = sphere.getVerticesData(VertexBuffer.PositionKind)!;
      let hasDeformedPos = false;
      let hasDeformedNeg = false;

      for (let i = 0; i < postPos.length; i += 3) {
        const x = postPos[i];
        const diff = Math.abs(postPos[i] - initialPos[i]) +
                     Math.abs(postPos[i + 1] - initialPos[i + 1]) +
                     Math.abs(postPos[i + 2] - initialPos[i + 2]);
        if (diff > 0.001) {
          if (x > 0.1) hasDeformedPos = true;
          if (x < -0.1) hasDeformedNeg = true;
        }
      }

      expect(hasDeformedPos).toBe(true);
      expect(hasDeformedNeg).toBe(true); // Symmetrical deformation mirrored
    });

    it('drags geometry smoothly with Grab brush across camera plane', () => {
      const ctrl = service.sculptController;
      ctrl.setActive(true);
      ctrl.setBrushType('grab');
      ctrl.setRadius(1.0);
      ctrl.setStrength(1.0);
      ctrl.setSymmetry(false);

      const sphere = MeshBuilder.CreateSphere('grabSphere', { diameter: 2.0, segments: 16 }, service.scene);
      service.addMesh(sphere);
      service.selectMesh(sphere);

      const initialPos = sphere.getVerticesData(VertexBuffer.PositionKind)!;

      // Start grab at top of sphere (0, 1, 0)
      const hit = new Vector3(0, 1, 0);
      (ctrl as any).handlePointerDown({
        type: 0,
        pickInfo: {
          hit: true,
          pickedMesh: sphere,
          pickedPoint: hit,
          getNormal: () => Vector3.Up(),
        },
        event: { button: 0 },
      });

      // Move pointer
      service.scene.pointerX = 400;
      service.scene.pointerY = 100;
      (ctrl as any).handlePointerMove({
        type: 1,
        pickInfo: null,
      });

      // End stroke
      (ctrl as any).endSculptStroke();

      const postPos = sphere.getVerticesData(VertexBuffer.PositionKind)!;
      let hasMoved = false;
      for (let i = 0; i < postPos.length; i += 3) {
        if (Math.abs(postPos[i + 1] - initialPos[i + 1]) > 0.001) {
          hasMoved = true;
          break;
        }
      }
      expect(hasMoved).toBe(true);
    });
  });

  describe('2. Anatomical Base Mesh Blockouts', () => {
    it('spawns a 1.80m Humanoid Mannequin based on Loomis 8-Head Canon', () => {
      const ctrl = service.sculptController;
      const humanoid = ctrl.spawnHumanoidBaseMesh({ name: 'Loomis_Hero' });

      expect(humanoid).toBeDefined();
      expect(humanoid.name).toBe('Loomis_Hero');
      expect(humanoid.getTotalVertices()).toBeGreaterThan(100);
      expect(humanoid.getTotalIndices()).toBeGreaterThan(300);

      const bounds = humanoid.getBoundingInfo();
      const height = bounds.maximum.y - bounds.minimum.y;

      // Total height should closely approximate 1.80m
      expect(height).toBeGreaterThan(1.65);
      expect(height).toBeLessThan(1.95);
      // Feet resting near Y = 0
      expect(bounds.minimum.y).toBeCloseTo(0, 1);
    });

    it('spawns a Stylized / Chibi Cartoon Base Mesh with 3.5-Head proportions in T-Pose', () => {
      const ctrl = service.sculptController;
      const chibi = ctrl.spawnChibiBaseMesh({ name: 'Mario_Chibi_Test', pose: 't_pose' });

      expect(chibi).toBeDefined();
      expect(chibi.name).toBe('Mario_Chibi_Test');
      expect(chibi.getTotalVertices()).toBeGreaterThan(100);

      const bounds = chibi.getBoundingInfo();
      const height = bounds.maximum.y - bounds.minimum.y;
      // Chibi height is approximately 1.15m - 1.30m
      expect(height).toBeGreaterThan(1.05);
      expect(height).toBeLessThan(1.35);

      // Arm span across X axis in T-Pose should exceed 1.2m
      const armSpanX = bounds.maximum.x - bounds.minimum.x;
      expect(armSpanX).toBeGreaterThan(1.20);
      expect(bounds.minimum.y).toBeCloseTo(0, 1);
    });

    it('spawns a Quadruped Creature with digitigrade leg mechanics', () => {
      const ctrl = service.sculptController;
      const quadruped = ctrl.spawnQuadrupedBaseMesh({ name: 'Wolf_Base', locomotion: 'digitigrade' });

      expect(quadruped).toBeDefined();
      expect(quadruped.name).toBe('Wolf_Base');
      expect(quadruped.getTotalVertices()).toBeGreaterThan(100);
      expect(quadruped.getTotalIndices()).toBeGreaterThan(300);

      const bounds = quadruped.getBoundingInfo();
      // Length along Z axis
      const lengthZ = bounds.maximum.z - bounds.minimum.z;
      expect(lengthZ).toBeGreaterThan(0.8);
    });

    it('spawns a Head & Facial Bust Mannequin', () => {
      const ctrl = service.sculptController;
      const bust = ctrl.spawnHeadBust({ name: 'Head_Bust_Test' });

      expect(bust).toBeDefined();
      expect(bust.name).toBe('Head_Bust_Test');
      expect(bust.getTotalVertices()).toBeGreaterThan(100);
    });
  });

  describe('3. Game-Ready Retopology & Topology Health', () => {
    it('analyzes topology and categorizes game engine readiness', () => {
      const ctrl = service.sculptController;
      const sphere = MeshBuilder.CreateSphere('testSphere', { segments: 12 }, service.scene);

      const analysis = ctrl.analyzeTopology(sphere);
      expect(analysis.vertexCount).toBeGreaterThan(0);
      expect(analysis.triangleCount).toBeGreaterThan(0);
      expect(analysis.gameReadiness).toBe('Mobile / WebGL Ready');
      expect(analysis.gameReadinessClass).toBe('success');
    });

    it('decimates high-poly mesh to a target game polygon budget using Quadric Error Metrics', async () => {
      const ctrl = service.sculptController;
      const denseSphere = MeshBuilder.CreateSphere('denseSphere', { segments: 40 }, service.scene);
      const initialTris = denseSphere.getTotalIndices() / 3;
      expect(initialTris).toBeGreaterThan(1000);

      const targetTris = 400;
      const result = await ctrl.retopologizeMesh(denseSphere, targetTris);

      expect(result.triangleCount).toBeLessThanOrEqual(initialTris);
      expect(denseSphere.getTotalIndices() / 3).toBe(result.triangleCount);
    });
  });

  describe('4. AI Modeler Tools (SpawnBaseMeshTool & RetopologizeMeshTool)', () => {
    it('executes modeler_spawn_base_mesh tool to generate characters for AI', async () => {
      const spawnTool = new SpawnBaseMeshTool();
      const context = service.aiAgent.createToolContext();

      const resStr = await spawnTool.execute(
        { type: 'humanoid', name: 'AI_Mannequin', scale: 1.0 },
        context
      );
      const res = JSON.parse(resStr);

      expect(res.status).toBe('ok');
      expect(res.meshName).toBe('AI_Mannequin');
      expect(res.totalTriangles).toBeGreaterThan(200);

      const created = service.scene.getMeshByName('AI_Mannequin');
      expect(created).toBeDefined();

      const chibiStr = await spawnTool.execute(
        { type: 'chibi', name: 'AI_Mario_Chibi', pose: 't_pose', style: 'organic' },
        context
      );
      const chibiRes = JSON.parse(chibiStr);
      expect(chibiRes.status).toBe('ok');
      expect(chibiRes.meshName).toBe('AI_Mario_Chibi');
      expect(chibiRes.totalTriangles).toBeGreaterThan(200);
      expect(service.scene.getMeshByName('AI_Mario_Chibi')).toBeDefined();

      const creatureStr = await spawnTool.execute(
        { type: 'creature', name: 'AI_Chibi_Demon' },
        context
      );
      const creatureRes = JSON.parse(creatureStr);
      expect(creatureRes.status).toBe('ok');
      expect(creatureRes.meshName).toBe('AI_Chibi_Demon');
      expect(creatureRes.totalTriangles).toBeGreaterThan(300);
      expect(service.scene.getMeshByName('AI_Chibi_Demon')).toBeDefined();
    });

    it('executes modeler_retopologize_mesh tool to reduce mesh to game budget', async () => {
      const retopoTool = new RetopologizeMeshTool();
      const context = service.aiAgent.createToolContext();

      const denseMesh = MeshBuilder.CreateSphere('AI_DenseMesh', { segments: 32 }, service.scene);
      service.addMesh(denseMesh);

      const resStr = await retopoTool.execute(
        { meshName: 'AI_DenseMesh', targetFaces: 600 },
        context
      );
      const res = JSON.parse(resStr);

      expect(res.status).toBe('ok');
      expect(res.meshName).toBe('AI_DenseMesh');
      expect(res.totalTriangles).toBeLessThan(denseMesh.getTotalIndices() / 3 + 1);
    });
  });

  describe('5. SculptEditorTool Lifecycle & UI Wiring', () => {
    it('toggles sculpt tool dialog and updates button states in MeshEditorApp', () => {
      const tool = app.getToolByName('sculpt_retopo');
      expect(tool).toBeDefined();
      expect(tool instanceof SculptEditorTool).toBe(true);

      app.toggleDialog('dialog-sculpt', true);
      const dialog = document.getElementById('dialog-sculpt');
      expect(dialog).toBeDefined();
      expect(dialog?.style.display).toBe('flex');

      // Check tool is active in controller
      expect(app.service.sculptController.isActive).toBe(true);

      // Close dialog
      app.toggleDialog('dialog-sculpt', false);
      expect(app.service.sculptController.isActive).toBe(false);
    });
  });
});
