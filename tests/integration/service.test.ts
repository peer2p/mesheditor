import { NullEngine, Vector3, VertexBuffer } from '@babylonjs/core';
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

    it('merges selected meshes into a single combined mesh with multiMultiMaterials and undo/redo support', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', name: 'MeshA' }));
      const sphere = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Sphere', name: 'MeshB' }));
      sphere.position.x = 5;

      // When fewer than 2 meshes are selected, returns null and triggers warning
      service.selectMesh(box);
      expect(service.mergeSelectedMeshes()).toBeNull();

      // Select both meshes
      service.selectNodes([box, sphere]);
      expect(service.selectedNodes.length).toBe(2);

      const merged = service.mergeSelectedMeshes();
      expect(merged).not.toBeNull();
      expect(merged?.name).toBe(`${box.name}_merged`);
      expect(service.importedMeshes).toContain(merged);
      expect(service.importedMeshes).not.toContain(box);
      expect(service.importedMeshes).not.toContain(sphere);
      expect(box.isEnabled()).toBe(false);
      expect(sphere.isEnabled()).toBe(false);
      expect(service.selectedMesh).toBe(merged);

      // Undo merge
      service.undo();
      expect(service.importedMeshes).not.toContain(merged);
      expect(merged?.isEnabled()).toBe(false);
      expect(service.importedMeshes).toContain(box);
      expect(service.importedMeshes).toContain(sphere);
      expect(box.isEnabled()).toBe(true);
      expect(sphere.isEnabled()).toBe(true);
      expect(service.selectedNodes).toContain(box);
      expect(service.selectedNodes).toContain(sphere);

      // Redo merge
      service.redo();
      expect(service.importedMeshes).toContain(merged);
      expect(merged?.isEnabled()).toBe(true);
      expect(box.isEnabled()).toBe(false);
      expect(sphere.isEnabled()).toBe(false);
      expect(service.selectedMesh).toBe(merged);
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

      // Inset face
      const vBeforeInset = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.insetSelectedFacet(0.2);
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeInset);

      // Subdivide face
      const vBeforeSubdiv = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.subdivideSelectedFacet();
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeSubdiv);

      // Solidify face
      const vBeforeSolidify = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.solidifyMeshOrFacet(0.2, true);
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeSolidify);

      // Bevel face
      service.selectedFaceId = 0;
      service.bevelSelectedFacet(0.1);

      // Arc face
      const vBeforeArc = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.arcSelectedFacet(3, 0.5);
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeArc);

      // Knife split face
      const vBeforeKnife = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.knifeSplitFacet();
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeKnife);

      // Relax face
      service.selectedFaceId = 0;
      service.relaxSelectedFacet();

      // Array duplicate face
      const vBeforeArray = box.getTotalVertices();
      service.selectedFaceId = 0;
      service.arraySelectedFacetOrMesh(2, 0.5, 0, 0);
      expect(box.getTotalVertices()).toBeGreaterThan(vBeforeArray);

      // Delete face 0
      const indicesBeforeDelete = box.getTotalIndices();
      service.selectedFaceId = 0;
      service.deleteSelectedFacet();
      expect(box.getTotalIndices()).toBeLessThan(indicesBeforeDelete);

      service.toggleFacetEditor(false);
      expect(service.facetEditorActive).toBe(false);
    });

    it('detects quad faces on cubes and supports quad inset and vertex translation with undo', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', width: 2, height: 2, depth: 2 }));
      service.selectMesh(box);
      service.toggleFacetEditor(true);

      // Verify quad detection on face 0
      const quad = service.getQuadFaceInfo(box, 0);
      expect(quad).not.toBeNull();
      expect(quad!.quadPositions.length).toBe(4);
      expect(quad!.faceIds.length).toBe(2);

      // Inset the quad face of the cube
      const initialVertices = box.getTotalVertices();
      const initialIndices = box.getTotalIndices();
      service.selectedFaceId = 0;
      service.insetSelectedFacet(0.25);

      // Insetting a quad adds 4 inner vertices and 8 quad skirt triangles (24 indices)
      expect(box.getTotalVertices()).toBe(initialVertices + 4);
      expect(box.getTotalIndices()).toBe(initialIndices + 24);

      // Verify all newly generated face triangles maintain correct outward normal winding
      const positions = box.getVerticesData(VertexBuffer.PositionKind)!;
      const indices = box.getIndices()!;
      // Check the triangles of the inner quad and skirt quads on the +Z face
      for (let t = 0; t < 10; t++) {
        const triFaceId = t === 0 ? 0 : (t === 1 ? quad!.faceIds[1] : Math.floor((initialIndices + (t - 2) * 3) / 3));
        const i0 = indices[triFaceId * 3];
        const i1 = indices[triFaceId * 3 + 1];
        const i2 = indices[triFaceId * 3 + 2];
        const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
        const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
        const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();
        // Since all triangles are on the +Z face (z ~ 0.5), normal.z must be positive (~ 1.0)
        expect(normal.z).toBeGreaterThan(0.9);
      }

      // Switch to Vertex Mode
      service.setFacetEditMode('vertex');
      expect(service.facetEditMode).toBe('vertex');

      // Select vertex and move it
      service.selectVertex(0);
      expect(service.selectedVertexIndex).toBe(0);
      expect(service.selectedVertexIndices.length).toBeGreaterThan(0);

      const oldPos = service.getSelectedVertexPosition()!;
      expect(oldPos).toBeDefined();

      service.setVertexPosition(5.0, 5.0, 5.0);
      const newPos = service.getSelectedVertexPosition()!;
      expect(newPos.x).toBeCloseTo(5.0);
      expect(newPos.y).toBeCloseTo(5.0);
      expect(newPos.z).toBeCloseTo(5.0);

      // Undo vertex position change
      expect(service.canUndo()).toBe(true);
      service.undo();
      const restoredPos = service.getSelectedVertexPosition()!;
      expect(restoredPos.x).toBeCloseTo(oldPos.x);

      // Redo vertex position change
      service.redo();
      const redonePos = service.getSelectedVertexPosition()!;
      expect(redonePos.x).toBeCloseTo(5.0);

      service.toggleFacetEditor(false);
      expect(service.facetEditorActive).toBe(false);
    });

    it('subdivides entire mesh and applies Sub-D smoothing and mesh solidification', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);
      const initialIndices = box.getTotalIndices();

      service.subdivideMesh(box);
      expect(box.getTotalIndices()).toBe(initialIndices * 4);

      service.subDSmoothMeshOrFacet(1);
      expect(box.getTotalIndices()).toBeGreaterThan(initialIndices * 4);

      const beforeSolidify = box.getTotalVertices();
      service.solidifyMeshOrFacet(0.1, false);
      expect(box.getTotalVertices()).toBeGreaterThan(beforeSolidify);
    });

    it('toggles mesh wireframe and manages material isolation', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);

      expect(service.isMeshWireframe(box)).toBe(false);
      service.setMeshWireframe(box, true);
      expect(service.isMeshWireframe(box)).toBe(true);

      service.toggleMeshWireframe(box);
      expect(service.isMeshWireframe(box)).toBe(false);

      const toggled = service.toggleSelectedWireframe();
      expect(toggled).toBe(true);
      expect(service.isMeshWireframe(box)).toBe(true);
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

    it('supports materials with transparent textures and configurable alpha settings', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);
      service.createNewMaterialForSelected('TranslucentMat');

      service.setTextureAlpha(true);
      service.setMaterialTransparencyMode(3);
      service.setMaterialTwoSided(true);
      service.setMaterialAlphaCutOff(0.4);

      const info = service.getMaterialTransparencyInfo();
      expect(info.twoSided).toBe(true);
      expect(info.mode).toBe(3);
      expect(info.alphaCutOff).toBe(0.4);
    });

    it('supports bump and normal mapping with intensity level and axis inversion', () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);
      const mat = service.createNewMaterialForSelected('BumpMat');
      expect(mat).toBeDefined();

      const dummyNormalDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';
      const applied = service.applyBumpTextureToSelectedMaterial(dummyNormalDataUrl, 'stone_normal.png');
      expect(applied).toBe(true);

      let bumpInfo = service.getMaterialBumpInfo();
      expect(bumpInfo.hasBump).toBe(true);
      expect(bumpInfo.name).toBe('stone_normal.png');
      expect(bumpInfo.level).toBe(1.0);
      expect(bumpInfo.invertX).toBe(false);
      expect(bumpInfo.invertY).toBe(false);

      service.setBumpLevel(2.5);
      service.setInvertNormalMapX(true);
      service.setInvertNormalMapY(true);

      bumpInfo = service.getMaterialBumpInfo();
      expect(bumpInfo.level).toBe(2.5);
      expect(bumpInfo.invertX).toBe(true);
      expect(bumpInfo.invertY).toBe(true);

      const removed = service.removeBumpTextureFromSelectedMaterial();
      expect(removed).toBe(true);
      expect(service.getMaterialBumpInfo().hasBump).toBe(false);
    });

    it('automatically recognizes dropped normal/bump map textures and assigns them to bumpTexture', async () => {
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box' }));
      service.selectMesh(box);
      service.createNewMaterialForSelected('WallMat');

      const normalFile = new File(['fake normal bytes'], 'WallMat_normal.png', { type: 'image/png' });
      await service.applyDroppedTextures([normalFile]);

      const bumpInfo = service.getMaterialBumpInfo();
      expect(bumpInfo.hasBump).toBe(true);
      expect(bumpInfo.name).toBe('WallMat_normal.png');
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

  describe('10. Babylon Scene & Project State Serialization', () => {
    it('exports clean .babylon project JSON excluding helper meshes and preserving tool metadata', async () => {
      // 1. Create a user mesh
      const box = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', name: 'UserBox' }));
      expect(box).toBeDefined();

      // 2. Add some voxels into VoxelPainter without baking
      service.voxelPainter.setVoxelSize(1.5);
      service.voxelPainter.setPaletteItem('stone');
      service.voxelPainter.blocks.set('0,0,0', { x: 0, y: 0, z: 0, paletteId: 'stone' });
      service.voxelPainter.blocks.set('0,1,0', { x: 0, y: 1, z: 0, paletteId: 'stone' });
      service.voxelPainter.blocks.set('1,0,0', { x: 1, y: 0, z: 0, paletteId: 'wood' });
      expect(service.voxelPainter.blocks.size).toBe(3);

      let exportedBlob: Blob | null = null;
      let exportedFilename = '';
      let exportedFormat = '';

      service.events.onExportModel = async (blob, filename, format) => {
        exportedBlob = blob;
        exportedFilename = filename;
        exportedFormat = format;
        return true;
      };

      await service.exportCurrentModel({ format: 'babylon', filename: 'my_project' });

      expect(exportedFormat).toBe('babylon');
      expect(exportedFilename).toBe('my_project');
      expect(exportedBlob).not.toBeNull();

      // Read back exported JSON
      const jsonText = await (exportedBlob as unknown as Blob).text();
      const parsed = JSON.parse(jsonText);

      // Verify metadata
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.meshEditor).toBeDefined();
      expect(parsed.metadata.meshEditor.version).toBe(1);
      expect(parsed.metadata.meshEditor.tools.voxelPainter).toBeDefined();
      expect(parsed.metadata.meshEditor.tools.voxelPainter.voxelSize).toBe(1.5);
      expect(parsed.metadata.meshEditor.tools.voxelPainter.paletteId).toBe('stone');
      expect(parsed.metadata.meshEditor.tools.voxelPainter.voxelData.runs.length).toBeGreaterThan(0);

      // Verify helper meshes are excluded
      const exportedMeshNames = (parsed.meshes || []).map((m: any) => m.name);
      expect(exportedMeshNames).not.toContain('editor_ground_grid');
      expect(exportedMeshNames).not.toContain('editor_voxel_highlight');

      // 3. Test clearModel resets voxel state
      service.clearModel();
      expect(service.voxelPainter.blocks.size).toBe(0);

      // 4. Test restoreProjectState restores voxel blocks and configuration
      service.restoreProjectState(parsed.metadata.meshEditor);
      expect(service.voxelPainter.blocks.size).toBe(3);
      expect(service.voxelPainter.voxelSize).toBe(1.5);
      expect(service.voxelPainter.currentPaletteId).toBe('stone');
      expect(service.voxelPainter.blocks.has('0,0,0')).toBe(true);
      expect(service.voxelPainter.blocks.has('0,1,0')).toBe(true);
      expect(service.voxelPainter.blocks.has('1,0,0')).toBe(true);
    });

    it('excludes deleted meshes when exporting GLTF/GLB and restores them on undo', async () => {
      service.clearModel();

      const boxA = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', name: 'MeshAlpha' }));
      const boxB = service.createPrimitive(defaultPrimitiveConfig({ shape: 'Box', name: 'MeshBeta' }));

      expect(service.importedMeshes).toContain(boxA);
      expect(service.importedMeshes).toContain(boxB);

      // Delete boxB
      service.selectMesh(boxB);
      service.deleteSelected();

      expect(service.importedMeshes).not.toContain(boxB);
      expect(boxB.isEnabled()).toBe(false);

      let exportedBlob: Blob | null = null;
      let exportedFormat = '';
      service.events.onExportModel = async (blob, filename, format) => {
        exportedBlob = blob;
        exportedFormat = format;
        return true;
      };

      // Export as GLTF to inspect JSON node graph
      await service.exportCurrentModel({ format: 'gltf', filename: 'clean_export' });

      expect(exportedFormat).toBe('gltf');
      expect(exportedBlob).not.toBeNull();

      const jsonText = await (exportedBlob as unknown as Blob).text();
      const parsed = JSON.parse(jsonText);
      const nodeNames = (parsed.nodes || []).map((n: any) => n.name);

      expect(nodeNames).toContain(boxA.name);
      expect(nodeNames).not.toContain(boxB.name);

      // Verify shouldExportNode directly
      expect(service.shouldExportNode(boxA)).toBe(true);
      expect(service.shouldExportNode(boxB)).toBe(false);

      // Undo deletion and verify boxB is restored
      service.undo();
      expect(service.importedMeshes).toContain(boxB);
      expect(boxB.isEnabled()).toBe(true);
      expect(service.shouldExportNode(boxB)).toBe(true);

      exportedBlob = null;
      await service.exportCurrentModel({ format: 'gltf', filename: 'restored_export' });
      const jsonRestored = JSON.parse(await (exportedBlob as unknown as Blob).text());
      const restoredNodeNames = (jsonRestored.nodes || []).map((n: any) => n.name);
      expect(restoredNodeNames).toContain(boxA.name);
      expect(restoredNodeNames).toContain(boxB.name);

      // Verify selectedOnly scope
      service.selectNodes([boxA]);
      expect(service.shouldExportNode(boxA, true)).toBe(true);
      expect(service.shouldExportNode(boxB, true)).toBe(false);

      exportedBlob = null;
      await service.exportCurrentModel({ format: 'gltf', filename: 'selected_only', selectedOnly: true });
      const jsonSelected = JSON.parse(await (exportedBlob as unknown as Blob).text());
      const selectedNodeNames = (jsonSelected.nodes || []).map((n: any) => n.name);
      expect(selectedNodeNames).toContain(boxA.name);
      expect(selectedNodeNames).not.toContain(boxB.name);
    });
  });
});
