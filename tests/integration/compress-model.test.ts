import { Mesh, MeshBuilder, NullEngine, Scene, VertexBuffer, VertexData } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';
import {
  CompressModelEditorTool,
  ModelCompressor,
  ModelCompressorOptions,
} from '../../src';

describe('Compress Model & In-Browser 3D Optimizer', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;
  let scene: Scene;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
    scene = service.scene;
  });

  afterEach(() => {
    service.dispose();
    canvas.remove();
  });

  describe('1. ModelCompressor Geometry Optimization & Lossless Deduplication', () => {
    it('welds duplicate vertices from unindexed triangle meshes while preserving all polygons', () => {
      // Create a mesh with 12 duplicate triangles (simulating unindexed STL/OBJ imports)
      // 12 triangles * 3 vertices = 36 vertices, but all sharing the same 3 positions: (0,0,0), (1,0,0), (1,1,0)
      const mesh = new Mesh('rawTriangles', scene);
      const positions: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i < 12; i++) {
        positions.push(0, 0, 0, 1, 0, 0, 1, 1, 0);
        indices.push(i * 3, i * 3 + 1, i * 3 + 2);
      }

      const vd = new VertexData();
      vd.positions = positions;
      vd.indices = indices;
      vd.applyToMesh(mesh);

      expect(mesh.getTotalVertices()).toBe(36);
      expect(mesh.getTotalIndices()).toBe(36);

      const result = ModelCompressor.cleanAndDeduplicateMesh(mesh, {
        preset: 'lossless',
        weldVertices: true,
      });

      // 36 duplicate vertices welded down to 3 unique vertices
      expect(result.originalVertices).toBe(36);
      expect(result.optimizedVertices).toBe(3);
      expect(result.duplicateVerticesRemoved).toBe(33);

      // All 12 valid polygons are 100% preserved
      expect(result.originalFaces).toBe(12);
      expect(result.optimizedFaces).toBe(12);
      expect(result.degenerateFacesRemoved).toBe(0);

      expect(mesh.getTotalVertices()).toBe(3);
      expect(mesh.getTotalIndices()).toBe(36);
    });

    it('identifies and removes degenerate zero-area and collapsed line/point triangles', () => {
      const mesh = new Mesh('degenerateMesh', scene);
      const positions = [
        0, 0, 0,  1, 0, 0,  1, 1, 0, // Valid face 1
        2, 0, 0,  2, 0, 0,  3, 1, 0, // Collapsed edge face (a === b)
        4, 0, 0,  5, 0, 0,  6, 0, 0, // Collinear / zero-area face
        0, 1, 0,  1, 1, 0,  0, 2, 0, // Valid face 2
      ];
      const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

      const vd = new VertexData();
      vd.positions = positions;
      vd.indices = indices;
      vd.applyToMesh(mesh);

      expect(mesh.getTotalVertices()).toBe(12);
      expect(mesh.getTotalIndices()).toBe(12);

      const result = ModelCompressor.cleanAndDeduplicateMesh(mesh, {
        removeDegenerateFaces: true,
        removeUnusedVertices: true,
      });

      expect(result.degenerateFacesRemoved).toBe(2);
      expect(result.optimizedFaces).toBe(2);
    });

    it('purges unreferenced/orphan vertices that are not indexed in any face', () => {
      const mesh = new Mesh('orphanMesh', scene);
      // 5 vertices, but indices only reference vertices 0, 1, 2. Vertices 3 & 4 are orphans.
      const positions = [
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        10, 10, 10, // Orphan
        20, 20, 20, // Orphan
      ];
      const indices = [0, 1, 2];

      const vd = new VertexData();
      vd.positions = positions;
      vd.indices = indices;
      vd.applyToMesh(mesh);

      expect(mesh.getTotalVertices()).toBe(5);

      const result = ModelCompressor.cleanAndDeduplicateMesh(mesh, {
        removeUnusedVertices: true,
      });

      expect(result.unusedVerticesRemoved).toBe(2);
      expect(result.optimizedVertices).toBe(3);
      expect(mesh.getTotalVertices()).toBe(3);
    });

    it('simplifies mesh polygon count when decimation is requested', async () => {
      const sphere = MeshBuilder.CreateSphere('sphere', { segments: 16 }, scene);
      const initialVerts = sphere.getTotalVertices();
      const initialFaces = sphere.getTotalIndices() / 3;

      expect(initialVerts).toBeGreaterThan(300);

      await ModelCompressor.simplifyMesh(sphere, 0.5);

      const simplifiedVerts = sphere.getTotalVertices();
      expect(simplifiedVerts).toBeLessThan(initialVerts);
    });
  });

  describe('2. MeshEditorService Model Compression & Undo History', () => {
    it('compresses active scene meshes in-place with undo and redo support', async () => {
      const box1 = MeshBuilder.CreateBox('box1', { size: 1 }, scene);
      service.importedMeshes = [box1];
      service.selectMesh(box1);

      const initialVerts = box1.getTotalVertices();
      expect(initialVerts).toBe(24);

      const stats = await service.compressActiveModel({ preset: 'lossless' });
      expect(stats.meshCount).toBe(1);
      expect(service.canUndo()).toBe(true);

      // Trigger undo
      service.undo();
      expect(box1.getTotalVertices()).toBe(initialVerts);

      // Trigger redo
      service.redo();
      expect(box1.getTotalVertices()).toBe(stats.compressedVertices);
    });

    it('exports compressed active model to format blob', async () => {
      const sphere = MeshBuilder.CreateSphere('exportSphere', { diameter: 1 }, scene);
      service.importedMeshes = [sphere];
      service.selectMesh(sphere);

      const exported = await service.exportCompressedActiveModel({
        exportFormat: 'obj',
      });

      expect(exported.filename).toBe('model.obj');
      expect(exported.blob).toBeInstanceOf(Blob);
      expect(exported.size).toBeGreaterThan(0);
    });
  });

  describe('3. CompressModelEditorTool UI Integration', () => {
    let app: MeshEditorApp;

    beforeEach(() => {
      app = new MeshEditorApp({ engine });
    });

    afterEach(() => {
      app.dispose();
    });

    it('registers the Compress Model tool in the dynamic menu and tools list', () => {
      const tool = app.getToolByName('compress_model');
      expect(tool).toBeDefined();
      expect(tool!.dialogId).toBe('dialog-compress-model');
      expect(tool!.menuLabel).toBe('Compress Model');
      expect(tool!.icon).toBe('file-archive');
      expect(tool!.description).toContain('file size');
      expect(tool!.helpText).toContain('100% client-side');
    });

    it('opens and minimizes the Compress Model floating dialog cleanly', () => {
      const dialogId = 'dialog-compress-model';
      expect(app.isDialogOpen(dialogId)).toBe(false);

      app.toggleDialog(dialogId, true);
      expect(app.isDialogOpen(dialogId)).toBe(true);

      const dialogEl = document.getElementById(dialogId);
      expect(dialogEl).not.toBeNull();
      expect(dialogEl?.querySelector('#compressPresetSelect')).not.toBeNull();
      expect(dialogEl?.querySelector('#btnCompressDownload')).not.toBeNull();
      expect(dialogEl?.querySelector('#btnCompressApplyScene')).not.toBeNull();
    });

    it('updates metric displays when switching compression presets', () => {
      app.toggleDialog('dialog-compress-model', true);

      const presetSelect = document.getElementById('compressPresetSelect') as HTMLSelectElement;
      expect(presetSelect).not.toBeNull();

      presetSelect.value = 'draco_balanced';
      presetSelect.dispatchEvent(new Event('change'));

      const desc = document.getElementById('compressPresetDesc');
      expect(desc?.textContent).toContain('Khronos Draco');

      presetSelect.value = 'custom';
      presetSelect.dispatchEvent(new Event('change'));

      const advanced = document.getElementById('compressAdvancedSection');
      expect(advanced?.style.display).not.toBe('none');
    });
  });
});

