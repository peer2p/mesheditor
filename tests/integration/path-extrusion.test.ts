import { NullEngine, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';
import { PathExtrusionController, PathExtrusionStudio, PathFactory } from '../../src/pathExtrusion';

describe('Path Extrusion & Spline Extrusion Integration Tests', () => {
  let engine: NullEngine;
  let service: MeshEditorService;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-container">
        <canvas id="renderCanvas"></canvas>
      </div>
    `;
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    engine = new NullEngine({
      renderWidth: 512,
      renderHeight: 512,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    });
    service = new MeshEditorService(canvas, {}, engine);
  });

  describe('1. PathFactory 2D Shapes & 3D Splines', () => {
    it('generates valid 2D cross-section points for all shape presets', () => {
      const pipe = PathFactory.shapePipe(16, 0.75, 0);
      expect(pipe.length).toBe(16);

      const hollowPipe = PathFactory.shapePipe(16, 1.0, 0.2);
      expect(hollowPipe.length).toBe(32); // Outer + inner ring

      const flat = PathFactory.shapeFlat(2.0, 0.1);
      expect(flat.length).toBe(4);

      const uprofile = PathFactory.shapeUProfile(1.5, 0.8, 0.25);
      expect(uprofile.length).toBe(8);

      const rect = PathFactory.shapeRectangle(1.2, 0.6);
      expect(rect.length).toBe(4);

      const star = PathFactory.shapeStar(5, 1.0, 0.4);
      expect(star.length).toBe(10);

      const triangle = PathFactory.shapeTriangle(1.0, 1.0);
      expect(triangle.length).toBe(3);
    });

    it('interpolates smooth 3D Catmull-Rom splines through control points', () => {
      const controlPoints = [
        new Vector3(-5, 0, 0),
        new Vector3(-2, 2, 3),
        new Vector3(2, 1, 3),
        new Vector3(5, 0, 0),
      ];

      const spline = PathFactory.computeSpline(controlPoints, 8);
      expect(spline.length).toBeGreaterThan(controlPoints.length);
      expect(spline[0].x).toBeCloseTo(-5, 1);
      expect(spline[spline.length - 1].x).toBeCloseTo(5, 1);
    });
  });

  describe('2. PathExtrusionController Management & Baking', () => {
    it('manages multiple paths, adds points, updates parameters, and bakes to mesh', () => {
      const controller = service.pathExtrusion;
      expect(controller).toBeDefined();
      // Does not create a path automatically on activation
      expect(controller.paths.length).toBe(0);
      controller.setActive(true);
      expect(controller.isActive).toBe(true);
      expect(controller.paths.length).toBe(0);

      // Explicitly initialize or add a path
      controller.initDefaultPath();
      expect(controller.paths.length).toBe(1);

      // Add a point
      controller.addPoint(new Vector3(4, 1.5, 1));
      expect(controller.activePath?.points.length).toBe(5);

      // Add new path
      const newPath = controller.addNewPath('Bridge Arch');
      expect(controller.paths.length).toBe(2);
      expect(controller.activePathId).toBe(newPath.id);

      // Update shape parameters
      controller.updateShapeConfig({
        shapeType: 'uprofile',
        width: 1.8,
        height: 0.6,
        twist: 0.2,
      });
      expect(controller.activePath?.shapeConfig.shapeType).toBe('uprofile');
      expect(controller.activePath?.shapeConfig.width).toBe(1.8);

      // Activate tool: creates helper markers and preview mesh
      controller.setActive(true);
      expect(controller.isActive).toBe(true);

      // Bake to mesh
      const bakedMesh = controller.bakeMesh();
      expect(bakedMesh).not.toBeNull();
      expect(service.importedMeshes).toContain(bakedMesh);
      expect(service.selectedMesh).toBe(bakedMesh);

      // Test Undo: deleting baked mesh
      expect(service.canUndo()).toBe(true);
      service.undo();
      expect(service.importedMeshes).not.toContain(bakedMesh);
    });
  });

  describe('3. Babylon Scene Project State Persistence for Path Extrusion', () => {
    it('serializes path extrusion into .babylon project state and restores them on load', async () => {
      const controller = service.pathExtrusion;
      controller.clear();
      expect(controller.paths.length).toBe(0);

      // Create a unique path
      const active = controller.addNewPath('Castle Road');
      expect(controller.paths.length).toBe(1);
      active.points = [
        { x: -10, y: 0.5, z: 0 },
        { x: -5, y: 1.0, z: 4 },
        { x: 5, y: 1.0, z: 4 },
        { x: 10, y: 0.5, z: 0 },
      ];
      active.shapeConfig.shapeType = 'flat';
      active.shapeConfig.width = 2.5;
      active.shapeConfig.color = '#eab308';

      // Export as .babylon
      let exportedBlob: Blob | null = null;
      service.events.onExportModel = async (blob, filename, format) => {
        exportedBlob = blob;
        return true;
      };

      await service.exportCurrentModel({ format: 'babylon', filename: 'path_extrusion_project' });
      expect(exportedBlob).not.toBeNull();

      const jsonText = await (exportedBlob as unknown as Blob).text();
      const parsed = JSON.parse(jsonText);

      // Verify pathExtrusion in metadata
      const tools = parsed.metadata?.meshEditor?.tools;
      expect(tools?.pathExtrusion).toBeDefined();
      expect(tools.pathExtrusion.length).toBe(1);
      expect(tools.pathExtrusion[0].name).toBe('Castle Road');
      expect(tools.pathExtrusion[0].points.length).toBe(4);
      expect(tools.pathExtrusion[0].shapeConfig.shapeType).toBe('flat');
      expect(tools.pathExtrusion[0].shapeConfig.width).toBe(2.5);

      // Clear model
      service.clearModel();
      expect(controller.paths.length).toBe(0);

      // Restore project state
      service.restoreProjectState(parsed.metadata.meshEditor);
      expect(controller.paths.length).toBe(1);
      expect(controller.paths[0].name).toBe('Castle Road');
      expect(controller.paths[0].points.length).toBe(4);
      expect(controller.paths[0].shapeConfig.shapeType).toBe('flat');
      expect(controller.paths[0].shapeConfig.color).toBe('#eab308');
    });
  });

  describe('4. MeshEditorApp UI Wiring for Path Extrusion', () => {
    it('toggles dialog-path-extrusion, updates presets, and bakes mesh via UI', () => {
      document.body.innerHTML = '';
      const testContainer = document.createElement('div');
      testContainer.id = 'test-container';
      document.body.appendChild(testContainer);

      const app = new MeshEditorApp({
        container: testContainer,
        engine,
      });

      const pathDialog = testContainer.querySelector('#dialog-path-extrusion') as HTMLElement;
      expect(pathDialog).not.toBeNull();
      expect(pathDialog.style.display).toBe('none');

      // Open Path Extrusion via dynamic Tools menu button
      const btnMenu = testContainer.querySelector('#btnTogglePathExtrusion') as HTMLButtonElement;
      expect(btnMenu).not.toBeNull();
      btnMenu.click();

      expect(pathDialog.style.display).not.toBe('none');
      expect(app.service.pathExtrusion.isActive).toBe(true);
      expect(app.service.pathExtrusion.paths.length).toBe(0);

      // Add a path explicitly
      const btnAddPath = testContainer.querySelector('#btnPathExtrusionAdd') as HTMLButtonElement;
      if (btnAddPath) {
        btnAddPath.click();
      } else {
        app.service.pathExtrusion.addNewPath();
      }
      expect(app.service.pathExtrusion.paths.length).toBe(1);

      // Open Studio via dialog button
      const btnOpenStudio = testContainer.querySelector('#btnOpenPathExtrusionStudio') as HTMLButtonElement;
      expect(btnOpenStudio).not.toBeNull();
      btnOpenStudio.click();
      expect(PathExtrusionStudio.isOpen()).toBe(true);

      app.service.pathExtrusion.updateShapeConfig({ shapeType: 'star' });
      expect(app.service.pathExtrusion.activePath?.shapeConfig.shapeType).toBe('star');

      // Click Bake to Scene Mesh
      const btnBake = testContainer.querySelector('#btnPathExtrusionBakeMesh') as HTMLButtonElement;
      expect(btnBake).not.toBeNull();
      btnBake.click();

      expect(app.service.importedMeshes.length).toBeGreaterThan(0);
      PathExtrusionStudio.close();
    });
  });

  describe('5. PathExtrusionStudio & PathFactory Cross-Section Presets', () => {
    it('generates all ported presets from platformia3d PathFactory', () => {
      const flatPipe = PathFactory.shapeFlatPipe(16, 2, 0.5, 0.1);
      expect(flatPipe.length).toBe(32);
      expect(flatPipe.solidHalfCount).toBe(16);

      const halfpipe = PathFactory.shapeHalfpipe(2, 0.4, 0.4, 0.1);
      expect(halfpipe.length).toBe(10);
      expect(halfpipe.solidHalfCount).toBe(5);

      const halfCircle = PathFactory.shapeHalfCircle(8, 1.5);
      expect(halfCircle.length).toBe(9);

      const ellipse = PathFactory.shapeEllipse(16, 2, 1, 0.2);
      expect(ellipse.length).toBe(32);

      const hLine = PathFactory.shapeHorizontalLine(4, 6);
      expect(hLine.length).toBe(6);

      const vLine = PathFactory.shapeVerticalLine(3, 5);
      expect(vLine.length).toBe(5);
    });

    it('creates zero-twist, manifold 3D meshes using createPathMeshWithShape', () => {
      const path = [
        new Vector3(0, 0, 0),
        new Vector3(0, 2, 5),
        new Vector3(3, 4, 10),
        new Vector3(6, 4, 15),
      ];
      const pipeShape = PathFactory.shapePipe(12, 0.8, 0.15);
      const mesh = PathFactory.createPathMeshWithShape(
        'test_pipe_mesh',
        path,
        pipeShape,
        service.scene,
        0,
        pipeShape.solidHalfCount,
        true,
        true
      );

      expect(mesh).not.toBeNull();
      const positions = mesh.getVerticesData('position');
      const indices = mesh.getIndices();
      const normals = mesh.getVerticesData('normal');

      expect(positions).not.toBeNull();
      expect(positions!.length).toBeGreaterThan(0);
      expect(indices).not.toBeNull();
      expect(indices!.length).toBeGreaterThan(0);
      expect(normals).not.toBeNull();
      expect(normals!.length).toBeGreaterThan(0);
    });

    it('opens and manages PathExtrusionStudio with 2D canvas and tabs', () => {
      const controller = service.pathExtrusion;
      controller.clear();

      const studio = PathExtrusionStudio.open(service, controller);
      expect(PathExtrusionStudio.isOpen()).toBe(true);

      const studioDialog = document.getElementById('pathExtrusionStudioDialog');
      expect(studioDialog).not.toBeNull();

      // Check header title
      const title = studioDialog!.querySelector('.pes-header-title');
      expect(title?.textContent).toContain('Path Extrusion Studio');

      // Check tabs
      const tabs = studioDialog!.querySelectorAll('.pes-tab');
      expect(tabs.length).toBe(3);

      // Create first path extrusion via studio button
      const btnCreateFirst = studioDialog!.querySelector('#pesCreateFirstBtn') as HTMLElement;
      expect(btnCreateFirst).not.toBeNull();
      btnCreateFirst.click();
      expect(controller.paths.length).toBe(1);

      // Check canvas rendered for active path
      const canvas = studioDialog!.querySelector('.pes-canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Adding points via controller updates preview mesh dynamically
      controller.addPoint(new Vector3(5, 2, 5));
      expect(controller.activePath?.points.length).toBe(4);

      // Close studio
      studio.close();
      expect(PathExtrusionStudio.isOpen()).toBe(false);
      expect(document.getElementById('pathExtrusionStudioDialog')).toBeNull();
    });
  });
});

