import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Color3,
  Engine,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  NullEngine,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';

describe('Scene Hierarchy Tree, Selection-Aware Operations & Loose Parts Separation', () => {
  let engine: Engine;
  let service: MeshEditorService;
  let app: MeshEditorApp;
  let container: HTMLDivElement;

  beforeEach(() => {
    engine = new NullEngine({
      renderWidth: 800,
      renderHeight: 600,
      textureSize: 256,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    });

    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });
    service = app.service;
  });

  afterEach(() => {
    app.dispose();
    engine.dispose();
    container.remove();
  });

  describe('1. Separate Loose Parts: Geometry Connectivity & Material Preservation', () => {
    it('does NOT disassemble a continuous mesh that contains UV seams or duplicate vertices', () => {
      // Create a cylinder or sphere mesh (which naturally has UV seams and duplicate vertices along the seam)
      const cylinder = MeshBuilder.CreateCylinder('SeamedCylinder', { height: 2, diameter: 1, tessellation: 16 }, service.scene);
      service.importedMeshes.push(cylinder);
      service.selectMesh(cylinder);

      const parts = service.separateSelectedLooseParts();
      // Continuous cylinder must remain 1 piece and not be shredded along UV seams
      expect(parts.length).toBe(1);
      expect(parts[0]).toBe(cylinder);
      expect(cylinder.isEnabled()).toBe(true);
    });

    it('separates physically disconnected loose parts into distinct meshes', () => {
      // Create two disconnected cubes and combine their geometry into one mesh
      const box1 = MeshBuilder.CreateBox('B1', { size: 1 }, service.scene);
      box1.position.x = -5;
      const box2 = MeshBuilder.CreateBox('B2', { size: 1 }, service.scene);
      box2.position.x = 5;

      const merged = Mesh.MergeMeshes([box1, box2], true, true, undefined, false, true)!;
      merged.name = 'TwoLooseCubes';
      service.importedMeshes.push(merged);
      service.selectMesh(merged);

      const parts = service.separateSelectedLooseParts();
      expect(parts.length).toBe(2);
      expect(service.importedMeshes).toContain(parts[0]);
      expect(service.importedMeshes).toContain(parts[1]);
      expect(service.importedMeshes).not.toContain(merged);
      expect(merged.isEnabled()).toBe(false);

      // Verify each part has valid geometry
      expect(parts[0].getTotalVertices()).toBeGreaterThan(0);
      expect(parts[1].getTotalVertices()).toBeGreaterThan(0);
    });

    it('preserves distinct submaterials when separating loose parts from a MultiMaterial mesh', () => {
      const matRed = new StandardMaterial('matRed', service.scene);
      matRed.diffuseColor = new Color3(1, 0, 0);

      const matBlue = new StandardMaterial('matBlue', service.scene);
      matBlue.diffuseColor = new Color3(0, 0, 1);

      const boxRed = MeshBuilder.CreateBox('BoxRed', { size: 1 }, service.scene);
      boxRed.position.x = -4;
      boxRed.material = matRed;

      const boxBlue = MeshBuilder.CreateBox('BoxBlue', { size: 1 }, service.scene);
      boxBlue.position.x = 4;
      boxBlue.material = matBlue;

      // Merge with multiMultiMaterials = true creates MultiMaterial with subMeshes
      const mergedWithMaterials = Mesh.MergeMeshes([boxRed, boxBlue], true, true, undefined, false, true)!;
      mergedWithMaterials.name = 'CompoundMesh';
      service.importedMeshes.push(mergedWithMaterials);
      service.selectMesh(mergedWithMaterials);

      expect(mergedWithMaterials.material instanceof MultiMaterial).toBe(true);

      const parts = service.separateSelectedLooseParts();
      expect(parts.length).toBe(2);

      // Loose parts should receive their respective individual materials without losing them
      const partMaterials = parts.map((p) => p.material);
      expect(partMaterials).toContain(matRed);
      expect(partMaterials).toContain(matBlue);
    });
  });

  describe('2. Selection-Aware Loose Parts & Merge Operations', () => {
    it('executes separateSelectedLooseParts on the selected node in the hierarchy', () => {
      const parent = new TransformNode('CharacterRoot', service.scene);
      const b1 = MeshBuilder.CreateBox('b1', { size: 1 }, service.scene);
      b1.position.x = -3;
      const b2 = MeshBuilder.CreateBox('b2', { size: 1 }, service.scene);
      b2.position.x = 3;
      const compound = Mesh.MergeMeshes([b1, b2], true, true)!;
      compound.name = 'LooseCompound';
      compound.parent = parent;
      service.importedMeshes.push(compound);

      // Select specific compound mesh in hierarchy
      service.selectNodes([compound]);
      expect(service.selectedMesh).toBe(compound);

      const parts = service.separateSelectedLooseParts();
      expect(parts.length).toBe(2);
      expect(service.getNodeLogicalParent(parts[0])).toBe(parent);
      expect(service.getNodeLogicalParent(parts[1])).toBe(parent);
    });

    it('executes mergeSelectedMeshes when a parent node containing child meshes is selected in the hierarchy', () => {
      const parentGroup = new TransformNode('ParentGroup', service.scene);
      (parentGroup as any).metadata = { isEditorGroup: true };
      service.groups.push(parentGroup);

      const m1 = MeshBuilder.CreateBox('M1', { size: 1 }, service.scene);
      m1.position.x = -2;
      m1.parent = parentGroup;
      service.importedMeshes.push(m1);

      const m2 = MeshBuilder.CreateBox('M2', { size: 1 }, service.scene);
      m2.position.x = 2;
      m2.parent = parentGroup;
      service.importedMeshes.push(m2);

      // Select parent node in hierarchy
      service.selectNodes([parentGroup]);

      const merged = service.mergeSelectedMeshes();
      expect(merged).not.toBeNull();
      expect(merged?.parent).toBe(parentGroup);
      expect(service.importedMeshes).toContain(merged);
      expect(service.importedMeshes).not.toContain(m1);
      expect(service.importedMeshes).not.toContain(m2);
    });
  });

  describe('3. Scene Objects Outliner Tree View & Node Actions', () => {
    it('renders a hierarchical tree with nested indentation and chevrons for parent and child nodes', () => {
      const rootNode = new TransformNode('RootModel', service.scene);
      const childMeshA = MeshBuilder.CreateBox('ChildMeshA', { size: 1 }, service.scene);
      childMeshA.parent = rootNode;
      service.importedMeshes.push(childMeshA);

      const childMeshB = MeshBuilder.CreateSphere('ChildMeshB', { diameter: 1 }, service.scene);
      childMeshB.parent = rootNode;
      service.importedMeshes.push(childMeshB);

      app.updateOutliner();

      const outliner = container.querySelector('#outlinerTreeContainer');
      expect(outliner).not.toBeNull();
      expect(outliner?.textContent).toContain('RootModel');
      expect(outliner?.textContent).toContain('ChildMeshA');
      expect(outliner?.textContent).toContain('ChildMeshB');

      // Parent node should have a chevron toggle for expanding/collapsing
      const chevrons = outliner?.querySelectorAll('.outliner-chevron');
      expect(chevrons?.length).toBeGreaterThan(0);

      // Child meshes should have greater indentation than parent root
      const items = Array.from(outliner?.querySelectorAll('.outliner-item') || []) as HTMLElement[];
      const rootItem = items.find((el) => el.textContent?.includes('RootModel'));
      const childItem = items.find((el) => el.textContent?.includes('ChildMeshA'));

      expect(rootItem).toBeDefined();
      expect(childItem).toBeDefined();

      const rootPadding = parseInt(rootItem!.style.paddingLeft || '0', 10);
      const childPadding = parseInt(childItem!.style.paddingLeft || '0', 10);
      expect(childPadding).toBeGreaterThan(rootPadding);
    });

    it('deleting a parent node in the hierarchy also deletes all its children and descendants', () => {
      const parentNode = new TransformNode('ParentArmature', service.scene);
      const torso = MeshBuilder.CreateBox('Torso', { size: 2 }, service.scene);
      torso.parent = parentNode;
      service.importedMeshes.push(torso);

      const limb = MeshBuilder.CreateBox('Limb', { size: 1 }, service.scene);
      limb.parent = torso;
      service.importedMeshes.push(limb);

      expect(service.importedMeshes).toContain(torso);
      expect(service.importedMeshes).toContain(limb);

      // Select and delete parent node
      service.selectNodes([parentNode]);
      service.deleteSelected();

      // Parent and all descendants must be disabled and removed from active scene meshes
      expect(service.importedMeshes).not.toContain(torso);
      expect(service.importedMeshes).not.toContain(limb);
      expect(torso.isEnabled()).toBe(false);
      expect(limb.isEnabled()).toBe(false);

      // Scene Objects Outliner tree must NOT contain deleted nodes
      const outliner = container.querySelector('#outlinerTreeContainer');
      expect(outliner?.textContent).not.toContain('ParentArmature');
      expect(outliner?.textContent).not.toContain('Torso');
      expect(outliner?.textContent).not.toContain('Limb');

      // Undo restores parent and all children in both service and Outliner
      service.undo();
      expect(service.importedMeshes).toContain(torso);
      expect(service.importedMeshes).toContain(limb);
      expect(torso.isEnabled()).toBe(true);
      expect(limb.isEnabled()).toBe(true);
      expect(outliner?.textContent).toContain('ParentArmature');
      expect(outliner?.textContent).toContain('Torso');
      expect(outliner?.textContent).toContain('Limb');
    });

    it('filters hierarchy tree with search input and auto-expands branches with matching objects', () => {
      const parent = new TransformNode('Character', service.scene);
      const sword = MeshBuilder.CreateBox('GoldenSword', { size: 1 }, service.scene);
      sword.parent = parent;
      service.importedMeshes.push(sword);

      const shield = MeshBuilder.CreateBox('IronShield', { size: 1 }, service.scene);
      shield.parent = parent;
      service.importedMeshes.push(shield);

      const searchInput = container.querySelector('#outlinerSearch') as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      // Filter by 'Sword'
      searchInput.value = 'Sword';
      searchInput.dispatchEvent(new Event('input'));

      const outliner = container.querySelector('#outlinerTreeContainer');
      expect(outliner?.textContent).toContain('GoldenSword');
      expect(outliner?.textContent).toContain('Character'); // Parent included to display hierarchy branch
      expect(outliner?.textContent).not.toContain('IronShield');
    });

    it('toggles mesh visibility immediately on consecutive clicks of the eye icon without requiring clicking another icon', () => {
      const box = MeshBuilder.CreateBox('ToggleEyeBox', { size: 1 }, service.scene);
      service.importedMeshes.push(box);
      app.updateOutliner();

      expect(box.isVisible).toBe(true);

      const outliner = container.querySelector('#outlinerTreeContainer') as HTMLElement;
      const getEyeBtn = () => {
        const rows = Array.from(outliner.querySelectorAll('.outliner-item'));
        const row = rows.find((r) => r.textContent?.includes('ToggleEyeBox'));
        return row?.querySelector('.outliner-item-actions .outliner-btn') as HTMLButtonElement | null;
      };

      // 1st click: hides the mesh
      let eyeBtn = getEyeBtn();
      expect(eyeBtn).not.toBeNull();
      eyeBtn!.click();
      expect(box.isVisible).toBe(false);

      // 2nd consecutive click on the same eye icon: immediately makes mesh visible again
      eyeBtn = getEyeBtn();
      expect(eyeBtn).not.toBeNull();
      eyeBtn!.click();
      expect(box.isVisible).toBe(true);

      // 3rd consecutive click: hides it again
      eyeBtn = getEyeBtn();
      expect(eyeBtn).not.toBeNull();
      eyeBtn!.click();
      expect(box.isVisible).toBe(false);
    });
  });
});
