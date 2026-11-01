import {
  Color3,
  Mesh,
  MeshBuilder,
  Observer,
  PBRMaterial,
  PointerEventTypes,
  PointerInfo,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import { PathFactory } from './PathFactory';
import { PathExtrusionItem, PathPointData, ShapeConfig, SolidShape } from './types';

export class PathExtrusionController {
  public isActive = false;
  public paths: PathExtrusionItem[] = [];
  public activePathId: string | null = null;
  public selectedPointIndex: number | null = null;

  // Compatibility getters/setters for legacy references
  public get pathways(): PathExtrusionItem[] {
    return this.paths;
  }
  public set pathways(v: PathExtrusionItem[]) {
    this.paths = v;
  }
  public get activePathwayId(): string | null {
    return this.activePathId;
  }
  public set activePathwayId(v: string | null) {
    this.activePathId = v;
  }
  public get activePathway(): PathExtrusionItem | null {
    return this.activePath;
  }

  // Visual in-scene helper meshes
  private markerMeshes: Mesh[] = [];
  private previewMesh: Mesh | null = null;
  private previewMaterial: PBRMaterial | null = null;

  // Pointer & Gizmo observers
  private pointerObserver: Observer<PointerInfo> | null = null;
  private gizmoObserver: Observer<any> | null = null;

  // Callbacks for UI updates
  public onStateChanged?: () => void;

  constructor(private service: MeshEditorService) {
    // Initialized without default paths so activating the tool keeps the scene clean.
  }

  public get activePath(): PathExtrusionItem | null {
    if (!this.activePathId) return null;
    return this.paths.find((p) => p.id === this.activePathId) || null;
  }

  public getActivePathway(): PathExtrusionItem | undefined {
    return this.activePath || undefined;
  }

  public getActivePathwayIndex(): number {
    if (!this.activePathId) return -1;
    return this.paths.findIndex((p) => p.id === this.activePathId);
  }

  public selectPathwayIndex(index: number): void {
    if (index >= 0 && index < this.paths.length) {
      this.selectPath(this.paths[index].id);
    }
  }

  public initDefaultPath(): void {
    if (this.paths.length === 0) {
      const defaultItem: PathExtrusionItem = {
        id: 'path_extrusion_1',
        name: 'Path Extrusion 1',
        points: [
          { x: -3, y: 0.1, z: 0 },
          { x: -1, y: 0.8, z: 2 },
          { x: 1, y: 0.8, z: 2 },
          { x: 3, y: 0.1, z: 0 },
        ],
        shapeConfig: {
          shapeType: 'pipe',
          radius: 1.5,
          width: 3.0,
          height: 0.5,
          thickness: 0.2,
          segments: 16,
          scale: 1,
          twist: 0,
          smoothSteps: 12,
          cap: 3,
          color: '#38bdf8',
          roughness: 0.4,
          metallic: 0.1,
        },
      };
      // Initialize shape points
      defaultItem.shape = PathFactory.shapePipe(16, 1.5, 0.2);
      this.paths.push(defaultItem);
      this.activePathId = defaultItem.id;
    }
  }

  public initDefaultPathway(): void {
    this.initDefaultPath();
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      if (this.service.voxelPainter?.isActive) {
        this.service.voxelPainter.setActive(false);
      }
      this.setupPointerEvents();
      this.setupGizmoEvents();
      this.refreshScene();
    } else {
      this.cleanupObservers();
      this.clearMarkers();
      this.service.gizmoManager.attachToMesh(null);
    }
    this.onStateChanged?.();
  }

  public selectPath(id: string): void {
    this.activePathId = id;
    this.selectedPointIndex = null;
    this.service.gizmoManager.attachToMesh(null);
    this.refreshScene();
    this.onStateChanged?.();
  }

  public selectPathway(id: string): void {
    this.selectPath(id);
  }

  public addNewPath(name?: string): PathExtrusionItem {
    const id = `path_extrusion_${Date.now().toString().slice(-4)}`;
    const newItem: PathExtrusionItem = {
      id,
      name: name || `Path Extrusion ${this.paths.length + 1}`,
      points: [
        { x: -2, y: 0.1, z: 0 },
        { x: 0, y: 0.6, z: 1.5 },
        { x: 2, y: 0.1, z: 0 },
      ],
      shapeConfig: {
        shapeType: 'pipe',
        radius: 1.5,
        width: 3.0,
        height: 0.5,
        thickness: 0.2,
        segments: 16,
        scale: 1,
        twist: 0,
        smoothSteps: 10,
        cap: 3,
        color: '#38bdf8',
        roughness: 0.4,
        metallic: 0.1,
      },
    };
    newItem.shape = PathFactory.shapePipe(16, 1.5, 0.2);
    this.paths.push(newItem);
    this.activePathId = id;
    this.selectedPointIndex = null;
    this.refreshScene();
    this.onStateChanged?.();
    return newItem;
  }

  public addNewPathway(name?: string): PathExtrusionItem {
    return this.addNewPath(name);
  }

  public deletePath(id: string): void {
    const idx = this.paths.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.paths.splice(idx, 1);
      if (this.activePathId === id) {
        this.activePathId = this.paths.length > 0 ? this.paths[0].id : null;
      }
      this.selectedPointIndex = null;
      this.refreshScene();
      this.onStateChanged?.();
    }
  }

  public deletePathway(id: string): void {
    this.deletePath(id);
  }

  public deleteActivePathway(): void {
    if (this.activePathId) {
      this.deletePath(this.activePathId);
    }
  }

  public duplicatePath(id: string): PathExtrusionItem | null {
    const item = this.paths.find((p) => p.id === id);
    if (!item) return null;

    const dupId = `path_extrusion_${Date.now().toString().slice(-4)}`;
    const dup: PathExtrusionItem = {
      id: dupId,
      name: `${item.name} (Copy)`,
      points: item.points.map((pt) => ({ x: pt.x + 1.0, y: pt.y, z: pt.z + 1.0 })),
      shapeConfig: { ...item.shapeConfig },
      shape: item.shape ? item.shape.map((p) => p.clone()) : undefined,
    };
    this.paths.push(dup);
    this.activePathId = dupId;
    this.selectedPointIndex = null;
    this.refreshScene();
    this.onStateChanged?.();
    return dup;
  }

  public duplicatePathway(id: string): PathExtrusionItem | null {
    return this.duplicatePath(id);
  }

  public duplicateActivePathway(): PathExtrusionItem | null {
    return this.activePathId ? this.duplicatePath(this.activePathId) : null;
  }

  public addPoint(pos: Vector3): void {
    const pathItem = this.activePath;
    if (!pathItem) return;

    pathItem.points.push({ x: pos.x, y: pos.y, z: pos.z });
    this.selectedPointIndex = pathItem.points.length - 1;
    this.refreshScene();
    this.onStateChanged?.();
  }

  public removeSelectedPoint(): void {
    const pathItem = this.activePath;
    if (!pathItem || this.selectedPointIndex === null) return;
    if (this.selectedPointIndex >= 0 && this.selectedPointIndex < pathItem.points.length) {
      pathItem.points.splice(this.selectedPointIndex, 1);
      this.selectedPointIndex = null;
      this.service.gizmoManager.attachToMesh(null);
      this.refreshScene();
      this.onStateChanged?.();
    }
  }

  public clearPoints(): void {
    const pathItem = this.activePath;
    if (!pathItem) return;
    pathItem.points = [];
    this.selectedPointIndex = null;
    this.service.gizmoManager.attachToMesh(null);
    this.refreshScene();
    this.onStateChanged?.();
  }

  public updateShapeConfig(config: Partial<ShapeConfig>): void {
    const pathItem = this.activePath;
    if (!pathItem) return;
    Object.assign(pathItem.shapeConfig, config);
    // If shapeType is not custom, update the shape geometry
    if (config.shapeType && config.shapeType !== 'custom') {
      pathItem.shape = PathFactory.getShapePoints(pathItem.shapeConfig);
    }
    this.updatePreviewMesh();
    this.onStateChanged?.();
  }

  public rebuildActivePathway(): void {
    this.updatePreviewMesh();
    this.onStateChanged?.();
  }

  public rebuildAll(): void {
    this.refreshScene();
    this.onStateChanged?.();
  }

  /**
   * Bakes the current path extrusion into a permanent scene mesh.
   */
  public bakeMesh(pathId?: string): Mesh | null {
    const id = pathId || this.activePathId;
    const pathItem = this.paths.find((p) => p.id === id);
    if (!pathItem || pathItem.points.length < 2) {
      this.service.events.onToast?.('Need at least 2 points to bake a path extrusion.', 'warning');
      return null;
    }

    const vecPoints = pathItem.points.map((p) => new Vector3(p.x, p.y, p.z));
    const splinePoints = PathFactory.computeSpline(vecPoints, pathItem.shapeConfig.smoothSteps ?? 10);
    const shape = pathItem.shape || PathFactory.getShapePoints(pathItem.shapeConfig);

    const baseName = (pathItem.name || 'path_extrusion_mesh').replace(/\s+/g, '_').toLowerCase();
    const uniqueName = `${baseName}_${Date.now().toString().slice(-4)}`;

    const mesh = PathFactory.createPathMeshWithShape(
      uniqueName,
      splinePoints,
      shape,
      this.service.scene,
      pathItem.shapeConfig.yOffset ?? 0,
      pathItem.shapeConfig.solidHalfCount ?? (shape as SolidShape).solidHalfCount ?? 0,
      pathItem.shapeConfig.capEnds ?? true,
      pathItem.shapeConfig.closedShape ?? (shape as SolidShape).closedShape ?? true
    );

    const mat = new PBRMaterial(`mat_${uniqueName}`, this.service.scene);
    mat.albedoColor = Color3.FromHexString(pathItem.shapeConfig.color || '#38bdf8');
    mat.roughness = pathItem.shapeConfig.roughness ?? 0.4;
    mat.metallic = pathItem.shapeConfig.metallic ?? 0.1;
    mesh.material = mat;

    this.service.importedMeshes.push(mesh);
    this.service.recordAction({
      name: `Bake Path Extrusion "${pathItem.name}"`,
      undo: () => {
        mesh.dispose();
        const idx = this.service.importedMeshes.indexOf(mesh);
        if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
        this.service.selectNodes([]);
      },
      redo: () => {
        // Redo re-registers
      },
    });

    pathItem.bakedMeshName = uniqueName;
    this.service.selectMesh(mesh);
    this.service.events.onSceneModified?.();
    this.service.events.onToast?.(`Path Extrusion baked as mesh "${uniqueName}"!`, 'success');
    return mesh;
  }

  // ─── Visual Markers & Preview ──────────────────────────────────────────

  public refreshScene(): void {
    if (!this.isActive) return;
    this.rebuildMarkers();
    this.updatePreviewMesh();
  }

  private clearMarkers(): void {
    for (const m of this.markerMeshes) {
      if (!m.isDisposed()) m.dispose();
    }
    this.markerMeshes = [];
  }

  private rebuildMarkers(): void {
    this.clearMarkers();
    const pathItem = this.activePath;
    if (!pathItem) return;

    for (let i = 0; i < pathItem.points.length; i++) {
      const pt = pathItem.points[i];
      const marker = MeshBuilder.CreateSphere(
        `editor_path_marker_${i}`,
        { diameter: 0.35, segments: 12 },
        this.service.scene
      );
      marker.position.set(pt.x, pt.y, pt.z);
      (marker as any).metadata = { isEditorHelper: true, pathPointIndex: i };
      marker.doNotSerialize = true;
      marker.isPickable = true;

      const mat = new StandardMaterial(`editor_mat_marker_${i}`, this.service.scene);
      mat.disableLighting = true;

      if (i === this.selectedPointIndex) {
        mat.emissiveColor = new Color3(1, 0.9, 0.1); // Bright yellow for selected
      } else if (i === 0) {
        mat.emissiveColor = new Color3(0.1, 0.9, 0.4); // Green for start
      } else if (i === pathItem.points.length - 1) {
        mat.emissiveColor = new Color3(0.9, 0.2, 0.2); // Red for end
      } else {
        mat.emissiveColor = new Color3(0.2, 0.7, 1.0); // Cyan for intermediate
      }

      marker.material = mat;
      this.markerMeshes.push(marker);

      if (i === this.selectedPointIndex) {
        this.service.gizmoManager.attachToMesh(marker);
      }
    }
  }

  public updatePreviewMesh(): void {
    const pathItem = this.activePath;
    if (!pathItem || pathItem.points.length < 2) {
      if (this.previewMesh) {
        this.previewMesh.dispose();
        this.previewMesh = null;
      }
      return;
    }

    const vecPoints = pathItem.points.map((p) => new Vector3(p.x, p.y, p.z));
    const splinePoints = PathFactory.computeSpline(vecPoints, pathItem.shapeConfig.smoothSteps ?? 10);
    const shape = pathItem.shape || PathFactory.getShapePoints(pathItem.shapeConfig);

    try {
      if (this.previewMesh && !this.previewMesh.isDisposed()) {
        this.previewMesh.dispose();
        this.previewMesh = null;
      }

      this.previewMesh = PathFactory.createPathMeshWithShape(
        'editor_path_preview',
        splinePoints,
        shape,
        this.service.scene,
        pathItem.shapeConfig.yOffset ?? 0,
        pathItem.shapeConfig.solidHalfCount ?? (shape as SolidShape).solidHalfCount ?? 0,
        pathItem.shapeConfig.capEnds ?? false,
        pathItem.shapeConfig.closedShape ?? (shape as SolidShape).closedShape ?? true
      );

      (this.previewMesh as any).metadata = { isEditorHelper: true };
      this.previewMesh.doNotSerialize = true;
      this.previewMesh.isPickable = false;

      if (!this.previewMaterial || (this.previewMaterial as any)._isDisposed) {
        this.previewMaterial = new PBRMaterial('editor_mat_path_preview', this.service.scene);
      }
      this.previewMaterial.albedoColor = Color3.FromHexString(pathItem.shapeConfig.color || '#38bdf8');
      this.previewMaterial.roughness = pathItem.shapeConfig.roughness ?? 0.4;
      this.previewMaterial.metallic = pathItem.shapeConfig.metallic ?? 0.1;

      this.previewMesh.material = this.previewMaterial;
    } catch (err) {
      console.warn('Error updating path extrusion preview mesh:', err);
    }
  }

  // ─── Pointer & Gizmo Handling ──────────────────────────────────────────

  private setupPointerEvents(): void {
    if (this.pointerObserver) return;

    this.pointerObserver = this.service.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isActive) return;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
        const pick = pointerInfo.pickInfo;
        const evt = pointerInfo.event as MouseEvent;

        // Shift+Click: Append or place point
        if (evt.shiftKey && pick && pick.hit && pick.pickedPoint) {
          const pt = pick.pickedPoint;
          this.addPoint(new Vector3(Math.round(pt.x * 10) / 10, pt.y + 0.05, Math.round(pt.z * 10) / 10));
          return;
        }

        // Click marker: Select point for Gizmo manipulation
        if (pick && pick.hit && pick.pickedMesh) {
          const mesh = pick.pickedMesh as Mesh;
          const meta = (mesh as any).metadata;
          if (meta && meta.pathPointIndex !== undefined) {
            this.selectedPointIndex = meta.pathPointIndex;
            this.rebuildMarkers();
            this.onStateChanged?.();
          }
        }
      }
    });
  }

  private setupGizmoEvents(): void {
    if (this.gizmoObserver) return;

    const posGizmo = this.service.gizmoManager.gizmos.positionGizmo;
    if (posGizmo) {
      this.gizmoObserver = posGizmo.onDragObservable.add(() => {
        if (!this.isActive || this.selectedPointIndex === null) return;
        const pathItem = this.activePath;
        if (!pathItem) return;

        const marker = this.markerMeshes[this.selectedPointIndex];
        if (marker && !marker.isDisposed()) {
          pathItem.points[this.selectedPointIndex] = {
            x: marker.position.x,
            y: marker.position.y,
            z: marker.position.z,
          };
          this.updatePreviewMesh();
        }
      });
    }
  }

  private cleanupObservers(): void {
    if (this.pointerObserver) {
      this.service.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
    if (this.gizmoObserver && this.service.gizmoManager.gizmos.positionGizmo) {
      this.service.gizmoManager.gizmos.positionGizmo.onDragObservable.remove(this.gizmoObserver);
      this.gizmoObserver = null;
    }
  }

  // ─── Project State Persistence ─────────────────────────────────────────

  public exportState(): PathExtrusionItem[] {
    return JSON.parse(JSON.stringify(this.paths));
  }

  public loadState(items: PathExtrusionItem[]): void {
    if (!Array.isArray(items)) return;
    this.paths = JSON.parse(JSON.stringify(items));
    // Restore Vector3 instances for shape points
    for (const p of this.paths) {
      if (p.shape && Array.isArray(p.shape)) {
        p.shape = p.shape.map((pt: any) => new Vector3(pt._x ?? pt.x ?? 0, pt._y ?? pt.y ?? 0, pt._z ?? pt.z ?? 0));
      } else {
        p.shape = PathFactory.getShapePoints(p.shapeConfig);
      }
    }
    if (this.paths.length > 0) {
      this.activePathId = this.paths[0].id;
    } else {
      this.activePathId = null;
    }
    this.selectedPointIndex = null;
    if (this.isActive) {
      this.refreshScene();
    }
    this.onStateChanged?.();
  }

  public clear(): void {
    this.clearMarkers();
    if (this.previewMesh) {
      this.previewMesh.dispose();
      this.previewMesh = null;
    }
    this.paths = [];
    this.activePathId = null;
    this.selectedPointIndex = null;
    this.service.gizmoManager.attachToMesh(null);
    this.onStateChanged?.();
  }
}
