import { NullEngine, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshEditorService } from '../../src/MeshEditorService';
import { PrimitiveConfig } from '../../src/types';

function defaultPrimitiveConfig(overrides: Partial<PrimitiveConfig> = {}): PrimitiveConfig {
  return {
    shape: 'Box',
    name: 'TestMesh',
    size: 2,
    width: 2,
    height: 2,
    depth: 2,
    diameter: 2,
    thickness: 0.4,
    subdivisions: 2,
    tessellation: 16,
    color: '#4f8cf6',
    roughness: 0.4,
    metallic: 0.1,
    ...overrides,
  };
}

describe('MeshEditorService Integration Tests (Babylon NullEngine)', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    document.body.appendChild(canvas);

    engine = new NullEngine();
    service = new MeshEditorService(
      canvas,
      {
        onSelectionChanged: vi.fn(),
        onSceneModified: vi.fn(),
        onHistoryChanged: vi.fn(),
        onToast: vi.fn(),
        onStatsUpdated: vi.fn(),
      },
      engine
    );
  });

  afterEach(() => {
    service.dispose();
    canvas.remove();
  });

  describe('1. Scene & Engine Initialization', () => {
    it('initializes scene, camera, lights, and ground grid', () => {
      expect(service.getScene()).toBeDefined();
      expect(service.getEngine()).toBe(engine);
      expect(service.getCamera()).toBeDefined();
      expect(service.ambientLight).toBeDefined();
      expect(service.sunLight).toBeDefined();
      expect(service.gridMesh).toBeDefined();
      expect(service.isEditorHelper(service.gridMesh)).toBe(true);
    });

    it('updates scene settings (clearColor, grid, lighting, camera speed)', () => {
      service.setClearColor('#223344');
      expect(service.sceneParams.clearColor).toBe('#223344');

      service.setGridVisible(false);
      expect(service.gridMesh.isEnabled()).toBe(false);
      service.setGridVisible(true);
      expect(service.gridMesh.isEnabled()).toBe(true);

      service.setAmbientIntensity(0.5);
      expect(service.ambientLight.intensity).toBe(0.5);

      service.setSunIntensity(2.0);
      expect(service.sunLight.intensity).toBe(2.0);

      service.setCameraSpeed(1.2);
      expect(service.camera.speed).toBe(1.2);
    });
  });

  describe('2. Primitive Creation & Sample Model', () => {
    it('creates various primitive shapes with valid geometry and PBRMaterial', () => {
      const shapes: PrimitiveConfig['shape'][] = [
        'Box',
        'Sphere',
        'Cylinder',
        'Cone',
        'Capsule',
        'Torus',
        'Plane',
        'Ground',
        'Polyhedron',
      ];

      for (const shape of shapes) {
        const mesh = service.createPrimitive(defaultPrimitiveConfig({ shape, name: `My_${shape}` }));
        expect(mesh).toBeDefined();
        expect(mesh.name).toContain(`My_${shape}`);
        expect(mesh.getTotalVertices()).toBeGreaterThan(0);
        expect(mesh.material).toBeDefined();
        expect(service.importedMeshes).toContain(mesh);
        expect(service.selectedMesh).toBe(mesh);
      }
      expect(service.importedMeshes.length).toBe(shapes.length);
    });

    it('loads sample model and clears model cleanly', () => {
      service.loadSampleModel();
      expect(service.importedMeshes.length).toBeGreaterThan(0);

      service.clearModel();
      expect(service.importedMeshes.length).toBe(0);
      expect(service.selectedNodes.length).toBe(0);
      expect(service.selectedMesh).toBeNull();
    });
  });

  describe('3. Selection & Multi-Selection Proxy', () => {
    it('selects single mesh, toggles selection, and builds multi-selection proxy', () => {
      const box1 = service.createPrimitive(defaultPrimitiveConfig({ name: 'BoxA' }));
      const box2 = service.createPrimitive(defaultPrimitiveConfig({ name: 'BoxB' }));
      const box3 = service.createPrimitive(defaultPrimitiveConfig({ name: 'BoxC' }));

      service.selectMesh(box1);
      expect(service.selectedNodes).toEqual([box1]);
      expect(service.selectedMesh).toBe(box1);

      // Toggle second node into selection
      service.toggleNodeSelection(box2);
      expect(service.selectedNodes).toEqual([box1, box2]);
      expect(service.selectedMesh).toBeNull(); // multi-selection sets selectedMesh to null

      // Toggle box1 off
      service.toggleNodeSelection(box1);
      expect(service.selectedNodes).toEqual([box2]);
      expect(service.selectedMesh).toBe(box2);

      // Select all 3 via selectNodes
      service.selectNodes([box1, box2, box3]);
      expect(service.selectedNodes.length).toBe(3);

      // Clear selection
      service.selectMesh(null);
      expect(service.selectedNodes.length).toBe(0);
      expect(service.selectedMesh).toBeNull();
    });

    it('performs range selection across visible outliner nodes', () => {
      const box1 = service.createPrimitive(defaultPrimitiveConfig({ name: 'Range1' }));
      const box2 = service.createPrimitive(defaultPrimitiveConfig({ name: 'Range2' }));
      const box3 = service.createPrimitive(defaultPrimitiveConfig({ name: 'Range3' }));

      service.selectNodes([box1]);
      service.rangeSelectNodes(box3);
      expect(service.selectedNodes).toContain(box1);
      expect(service.selectedNodes).toContain(box2);
      expect(service.selectedNodes).toContain(box3);
    });
  });

  describe('4. Grouping & Ungrouping with Undo/Redo', () => {
    it('groups selected meshes under a TransformNode and ungroups them', () => {
      const m1 = service.createPrimitive(defaultPrimitiveConfig({ name: 'Part1' }));
      const m2 = service.createPrimitive(defaultPrimitiveConfig({ name: 'Part2' }));

      m1.position.set(-2, 0, 0);
      m2.position.set(2, 0, 0);

      service.selectNodes([m1, m2]);
      const group = service.groupSelected();

      expect(group).not.toBeNull();
      expect(service.isGroupNode(group)).toBe(true);
      expect(m1.parent).toBe(group);
      expect(m2.parent).toBe(group);

      // Undo grouping
      expect(service.canUndo()).toBe(true);
      service.undo();
      expect(group!.isEnabled()).toBe(false);
      service.selectMesh(null);
      expect(m1.parent).toBeNull();
      expect(m2.parent).toBeNull();

      // Redo grouping
      expect(service.canRedo()).toBe(true);
      service.redo();
      expect(group!.isEnabled()).toBe(true);
      expect(m1.parent).toBe(group);
      expect(m2.parent).toBe(group);

      // Ungroup
      service.selectNodes([group!]);
      service.ungroupSelected();
      service.selectMesh(null);
      expect(m1.parent).toBeNull();
      expect(m2.parent).toBeNull();
    });
  });

  describe('5. Copy, Paste, Duplicate & Delete with Undo/Redo', () => {
    it('duplicates a selected mesh', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ name: 'OrigBox' }));
      expect(service.importedMeshes.length).toBe(1);

      service.selectMesh(box);
      service.duplicateSelectedMesh();

      expect(service.importedMeshes.length).toBe(2);
      expect(service.selectedMesh).not.toBe(box);
    });

    it('copies and pastes selected nodes with undo/redo support', () => {
      const sphere = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Sphere', name: 'CopySphere' }));
      service.selectMesh(sphere);

      service.copySelected();
      expect(service.clipboardNodes.length).toBe(1);

      const pasted = service.pasteAtCursor();
      expect(pasted.length).toBe(1);
      expect(service.importedMeshes.length).toBe(2);

      // Undo paste
      service.undo();
      expect(service.importedMeshes.length).toBe(1);

      // Redo paste
      service.redo();
      expect(service.importedMeshes.length).toBe(2);
    });

    it('deletes selected meshes and restores them via undo', () => {
      const m1 = service.createPrimitive(defaultPrimitiveConfig({ name: 'DeleteMe' }));
      expect(service.importedMeshes).toContain(m1);

      service.selectMesh(m1);
      service.deleteSelected();
      expect(service.importedMeshes).not.toContain(m1);
      expect(m1.isEnabled()).toBe(false);

      // Undo deletion
      service.undo();
      expect(service.importedMeshes).toContain(m1);
      expect(m1.isEnabled()).toBe(true);

      // Redo deletion
      service.redo();
      expect(service.importedMeshes).not.toContain(m1);
    });
  });

  describe('6. Transform, Pivot, Alignment & Rotation Utilities', () => {
    it('snaps selected mesh to ground (Y >= 0) and centers to origin', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', height: 2 }));
      box.position.set(5, 10, -4);
      box.computeWorldMatrix(true);

      service.selectMesh(box);
      service.snapSelectedToGround();
      box.computeWorldMatrix(true);
      const minY = box.getBoundingInfo().boundingBox.minimumWorld.y;
      expect(minY).toBeCloseTo(0, 3);

      service.centerSelectedToOrigin();
      expect(box.position.x).toBeCloseTo(0, 3);
      expect(box.position.z).toBeCloseTo(0, 3);
    });

    it('sets and gets mesh rotation in degrees and bakes transform', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);

      service.setMeshRotationDegrees(box, 'y', 90);
      const rot = service.getMeshRotationDegrees(box);
      expect(rot.y).toBeCloseTo(90, 1);

      box.scaling.set(2, 2, 2);
      service.bakeSelectedTransform();
      expect(box.scaling.x).toBeCloseTo(1, 3);
      expect(box.scaling.y).toBeCloseTo(1, 3);
      expect(box.scaling.z).toBeCloseTo(1, 3);
    });
  });

  describe('7. Facet & Vertex Editing Operations', () => {
    it('toggles facet editor and extrudes, flips, or deletes a selected facet', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);

      const initialVerts = box.getTotalVertices();
      const initialIndices = box.getTotalIndices();

      const active = service.toggleFacetEditor(true);
      expect(active).toBe(true);

      // Select face 0 and extrude
      service.selectedFaceId = 0;
      service.extrudeSelectedFacet(0.5);
      expect(box.getTotalVertices()).toBeGreaterThan(initialVerts);
      expect(box.getTotalIndices()).toBeGreaterThan(initialIndices);

      // Flip normal on face 0
      service.selectedFaceId = 0;
      service.flipSelectedFacetNormal();

      // Delete face 0
      const indicesBeforeDelete = box.getTotalIndices();
      service.selectedFaceId = 0;
      service.deleteSelectedFacet();
      expect(box.getTotalIndices()).toBeLessThan(indicesBeforeDelete);

      service.toggleFacetEditor(false);
      expect(service.facetEditorActive).toBe(false);
    });
  });

  describe('8. Materials & UV Mapping', () => {
    it('creates a new material for selected mesh and applies UV projections', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);

      const newMat = service.createNewMaterialForSelected('CustomPBR');
      expect(newMat).not.toBeNull();
      expect(service.getSelectedMaterial()).toBe(newMat);

      service.applyTriplanarUVs(2.0);
      service.applyPlanarUVs('top', 1.5);
      service.applyPlanarUVs('front', 1.5);
      service.applyPlanarUVs('side', 1.5);

      const uvs = box.getVerticesData('uv');
      expect(uvs).toBeDefined();
      expect(uvs!.length).toBeGreaterThan(0);
    });
  });

  describe('9. Camera Focus & Reset', () => {
    it('focuses on selected mesh, focuses on all, and resets camera', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      box.position.set(10, 5, 10);
      service.selectMesh(box);

      service.focusOnSelected();
      service.focusOnAll();
      service.resetCamera();
      expect(service.camera.position).toEqual(new Vector3(0, 2.5, -6));
    });
  });
});
