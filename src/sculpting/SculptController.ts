import {
  Color3,
  Color4,
  FloatArray,
  IndicesArray,
  LinesMesh,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Nullable,
  PBRMaterial,
  PickingInfo,
  Plane,
  PointerEventTypes,
  PointerInfo,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { MeshEditorService } from '../MeshEditorService';
import { ModelCompressor } from '../compression/ModelCompressor';

export type SculptBrushType = 'clay' | 'grab' | 'smooth' | 'flatten' | 'inflate' | 'pinch';

export interface TopologyAnalysis {
  vertexCount: number;
  triangleCount: number;
  isManifold: boolean;
  hasUVs: boolean;
  gameReadiness: 'Mobile / WebGL Ready' | 'Standard Game Ready' | 'Hero Asset' | 'High-Poly Sculpt';
  gameReadinessClass: 'success' | 'warning' | 'danger';
}

export interface BaseMeshSpawnOptions {
  name?: string;
  position?: Vector3;
  scale?: number;
  subdivisions?: number;
  canon?: 'heroic' | 'chibi' | 'stylized';
  pose?: 't_pose' | 'a_pose';
  materialStyle?: 'colored' | 'clay';
  style?: 'organic' | 'mannequin';
}

/**
 * Controller for digital figure sculpting, base-mesh anatomical blockouts,
 * and game-ready Quadric Error retopology in Babylon.js.
 */
export class SculptController {
  public service: MeshEditorService;
  public scene: Scene;

  // Active tool state
  public isActive: boolean = false;
  public brushType: SculptBrushType = 'clay';
  public radius: number = 0.35; // World units
  public strength: number = 0.5; // 0.05 to 1.0
  public symmetryX: boolean = true;
  public invert: boolean = false;

  // Internal stroke tracking
  private isSculpting: boolean = false;
  private activeMesh: Nullable<Mesh> = null;
  private strokeStartVertexData: Nullable<VertexData> = null;
  private lastLocalPick: Nullable<Vector3> = null;
  private cursorRing: Nullable<Mesh> = null;
  private symCursorRing: Nullable<Mesh> = null;

  // Grab brush tracking state
  private grabStartWorldPoint: Nullable<Vector3> = null;
  private grabPlane: Nullable<Plane> = null;
  private grabInitialPositions: Nullable<FloatArray> = null;
  private grabWeights: Map<number, number> = new Map();
  private grabWeightsSym: Map<number, number> = new Map();

  // Listeners
  public onStateChanged?: (isActive: boolean) => void;
  public onMeshModified?: (mesh: Mesh) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
    this.scene = service.scene;

    this.initCursorIndicators();
    this.initPointerHandling();
  }

  /**
   * Initializes 3D circular wireframe cursors to visually preview brush radius & symmetry.
   */
  private initCursorIndicators(): void {
    if (this.cursorRing) return;

    // Main brush cursor disc
    this.cursorRing = MeshBuilder.CreateDisc(
      'editor_sculpt_cursor',
      { radius: this.radius, tessellation: 40 },
      this.scene
    );
    const ringMat = new StandardMaterial('editor_sculpt_cursor_mat', this.scene);
    ringMat.diffuseColor = new Color3(0.2, 0.9, 0.4);
    ringMat.emissiveColor = new Color3(0.2, 0.9, 0.4);
    ringMat.wireframe = true;
    ringMat.disableLighting = true;
    ringMat.backFaceCulling = false;
    this.cursorRing.material = ringMat;
    this.cursorRing.isPickable = false;
    this.cursorRing.isVisible = false;

    // Symmetrical brush cursor disc (mirrored on X)
    this.symCursorRing = MeshBuilder.CreateDisc(
      'editor_sculpt_sym_cursor',
      { radius: this.radius, tessellation: 40 },
      this.scene
    );
    const symMat = new StandardMaterial('editor_sculpt_sym_mat', this.scene);
    symMat.diffuseColor = new Color3(0.3, 0.7, 1.0);
    symMat.emissiveColor = new Color3(0.3, 0.7, 1.0);
    symMat.wireframe = true;
    symMat.disableLighting = true;
    symMat.backFaceCulling = false;
    this.symCursorRing.material = symMat;
    this.symCursorRing.isPickable = false;
    this.symCursorRing.isVisible = false;
  }

  /**
   * Updates brush radius and rescales cursor indicators.
   */
  public setRadius(newRadius: number): void {
    this.radius = Math.max(0.02, Math.min(newRadius, 4.0));
    const scale = this.radius / 0.35;
    if (this.cursorRing && !this.cursorRing.isDisposed()) {
      this.cursorRing.scaling.set(scale, scale, scale);
    }
    if (this.symCursorRing && !this.symCursorRing.isDisposed()) {
      this.symCursorRing.scaling.set(scale, scale, scale);
    }
  }

  public setStrength(newStrength: number): void {
    this.strength = Math.max(0.02, Math.min(newStrength, 1.0));
  }

  public setBrushType(type: SculptBrushType): void {
    this.brushType = type;
  }

  public setSymmetry(enabled: boolean): void {
    this.symmetryX = enabled;
    if (this.symCursorRing && (!enabled || !this.isActive)) {
      this.symCursorRing.isVisible = false;
    }
  }

  public setInvert(invert: boolean): void {
    this.invert = invert;
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (this.cursorRing) this.cursorRing.isVisible = false;
    if (this.symCursorRing) this.symCursorRing.isVisible = false;

    const canvas = this.service.canvas;
    if (canvas) {
      canvas.style.cursor = active ? 'crosshair' : 'default';
    }

    if (active) {
      // Deactivate other exclusive tools if running
      if (this.service.voxelPainter?.isActive) {
        this.service.voxelPainter.setActive(false);
      }
      if (this.service.pathExtrusion?.isActive) {
        this.service.pathExtrusion.setActive(false);
      }
      // Detach gizmo arrows so they do not intercept or steal sculpting pointer events
      this.service.gizmoManager?.attachToNode(null);
      this.scene.constantlyUpdateMeshUnderPointer = true;
    } else {
      if (this.isSculpting) {
        this.endSculptStroke();
      }
      // Restore gizmo on selected mesh when sculpting is deactivated
      if (this.service.selectedMesh && !this.service.isGizmoMesh(this.service.selectedMesh)) {
        this.service.gizmoManager?.attachToNode(this.service.selectedMesh);
      }
    }

    this.onStateChanged?.(active);
  }

  /**
   * Pointer event observer for continuous 3D viewport sculpting.
   */
  private initPointerHandling(): void {
    // Window-level pointerup ensures strokes commit cleanly even if released outside the canvas
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', () => {
        if (this.isActive && this.isSculpting) {
          this.endSculptStroke();
        }
      });
    }

    this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      if (!this.isActive) return;

      const evt = pointerInfo.event as MouseEvent;
      const isLeftButton = evt ? evt.button === 0 : true;

      // Detect invert hotkey (Alt or Ctrl key)
      if (evt) {
        if (evt.altKey || evt.ctrlKey) {
          this.invert = true;
        } else if (!this.isSculpting) {
          // Only reset invert if not toggled by manual UI
        }
      }

      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (isLeftButton) {
            this.handlePointerDown(pointerInfo);
          }
          break;

        case PointerEventTypes.POINTERMOVE:
          this.handlePointerMove(pointerInfo);
          break;

        case PointerEventTypes.POINTERUP:
          if (isLeftButton && this.isSculpting) {
            this.endSculptStroke();
          }
          break;
      }
    });
  }

  private handlePointerDown(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;
    let mesh: Mesh | null = null;
    let hitPoint: Vector3 | null = null;
    let hitNormal: Vector3 | null = null;

    if (
      pick &&
      pick.hit &&
      pick.pickedPoint &&
      pick.pickedMesh instanceof Mesh &&
      !this.service.isGizmoMesh(pick.pickedMesh) &&
      !this.service.isEditorHelper(pick.pickedMesh) &&
      pick.pickedMesh !== this.service.gridMesh
    ) {
      mesh = pick.pickedMesh;
      hitPoint = pick.pickedPoint;
      hitNormal = pick.getNormal(true);
    } else {
      // Scene raycast ignoring gizmos, helpers, and grid
      const livePick = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        (m) =>
          m instanceof Mesh &&
          !this.service.isGizmoMesh(m) &&
          !this.service.isEditorHelper(m) &&
          m !== this.service.gridMesh
      );
      if (livePick && livePick.hit && livePick.pickedPoint && livePick.pickedMesh instanceof Mesh) {
        mesh = livePick.pickedMesh;
        hitPoint = livePick.pickedPoint;
        hitNormal = livePick.getNormal(true);
      }
    }

    // Fallback for Grab brush: if click was slightly outside mesh contour, catch closest point on selected mesh
    if (
      !mesh &&
      this.brushType === 'grab' &&
      this.service.selectedMesh instanceof Mesh &&
      !this.service.isGizmoMesh(this.service.selectedMesh)
    ) {
      const sel = this.service.selectedMesh;
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.scene.activeCamera
      );
      const positions = sel.getVerticesData(VertexBuffer.PositionKind);
      if (positions && ray) {
        sel.computeWorldMatrix(true);
        const wMat = sel.getWorldMatrix();
        let closestDist = Infinity;
        let bestWorldPos: Vector3 | null = null;
        const vPos = new Vector3();
        const vWorld = new Vector3();
        const numVerts = positions.length / 3;
        const step = Math.max(1, Math.floor(numVerts / 300));
        for (let i = 0; i < numVerts; i += step) {
          vPos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          Vector3.TransformCoordinatesToRef(vPos, wMat, vWorld);
          const t = Vector3.Dot(vWorld.subtract(ray.origin), ray.direction);
          if (t > 0) {
            const rayPoint = ray.origin.add(ray.direction.scale(t));
            const dist = Vector3.Distance(vWorld, rayPoint);
            if (dist < closestDist) {
              closestDist = dist;
              bestWorldPos = vWorld.clone();
            }
          }
        }
        if (bestWorldPos && closestDist <= this.radius * 1.5) {
          mesh = sel;
          hitPoint = bestWorldPos;
          hitNormal = this.scene.activeCamera
            ? this.scene.activeCamera.position.subtract(bestWorldPos).normalize()
            : Vector3.Up();
        }
      }
    }

    if (!mesh || !hitPoint) {
      return;
    }

    // Ensure mesh vertex buffers are updatable
    this.ensureMeshUpdatable(mesh);

    this.activeMesh = mesh;
    this.isSculpting = true;
    this.strokeStartVertexData = VertexData.ExtractFromMesh(mesh);

    // Temporarily detach camera controls so mouse movement sculpts without rotating viewport
    if (this.scene.activeCamera) {
      this.scene.activeCamera.detachControl();
    }

    // Transform world pick to local coordinates
    const invWorld = mesh.getWorldMatrix().clone().invert();
    this.lastLocalPick = Vector3.TransformCoordinates(hitPoint, invWorld);

    // Apply immediate initial brush stamp or initialize Grab tracking
    if (this.brushType === 'grab') {
      this.initGrabStroke(mesh, hitPoint);
    } else {
      this.applyBrushStroke(mesh, hitPoint, hitNormal);
    }
  }

  private handlePointerMove(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;

    // Update cursor indicator visual placement when hovering
    if (!this.isSculpting) {
      let hoverHit: Nullable<Vector3> = pick?.pickedPoint || null;
      let hoverNormal: Nullable<Vector3> = pick?.getNormal(true) || null;

      if (
        !hoverHit ||
        !pick?.pickedMesh ||
        !(pick.pickedMesh instanceof Mesh) ||
        this.service.isGizmoMesh(pick.pickedMesh) ||
        this.service.isEditorHelper(pick.pickedMesh) ||
        pick.pickedMesh === this.service.gridMesh
      ) {
        const liveHover = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY,
          (m) =>
            m instanceof Mesh &&
            !this.service.isGizmoMesh(m) &&
            !this.service.isEditorHelper(m) &&
            m !== this.service.gridMesh
        );
        if (liveHover && liveHover.hit && liveHover.pickedPoint) {
          hoverHit = liveHover.pickedPoint;
          hoverNormal = liveHover.getNormal(true);
        } else {
          hoverHit = null;
        }
      }

      if (hoverHit) {
        this.updateCursorTransform(hoverHit, hoverNormal || Vector3.Up());
      } else {
        if (this.cursorRing) this.cursorRing.isVisible = false;
        if (this.symCursorRing) this.symCursorRing.isVisible = false;
      }
      return;
    }

    if (!this.activeMesh) return;

    // 1. Grab Brush Drag (Screen-space / Camera plane drag)
    if (this.brushType === 'grab') {
      this.handleGrabDrag();
      return;
    }

    // 2. Surface Stamping Brushes (Clay, Smooth, Flatten, Inflate, Pinch)
    let hitPoint = pick?.pickedPoint;
    let hitNormal = pick?.getNormal(true);

    if (!hitPoint) {
      const livePick = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        (m) => m === this.activeMesh
      );
      if (livePick && livePick.hit && livePick.pickedPoint) {
        hitPoint = livePick.pickedPoint;
        hitNormal = livePick.getNormal(true);
      }
    }

    if (hitPoint) {
      this.updateCursorTransform(hitPoint, hitNormal || Vector3.Up());
      this.applyBrushStroke(this.activeMesh, hitPoint, hitNormal);
    }
  }

  private initGrabStroke(mesh: Mesh, worldPoint: Vector3): void {
    this.grabStartWorldPoint = worldPoint.clone();
    const camera = this.scene.activeCamera;
    const planeNormal = camera
      ? camera.position.subtract(worldPoint).normalize()
      : Vector3.Forward();
    this.grabPlane = Plane.FromPositionAndNormal(worldPoint, planeNormal);

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    this.grabInitialPositions = new Float32Array(positions);
    this.grabWeights.clear();
    this.grabWeightsSym.clear();

    mesh.computeWorldMatrix(true);
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const localHit = Vector3.TransformCoordinates(worldPoint, invWorld);

    const scaling = mesh.scaling;
    const maxScale = Math.max(Math.abs(scaling.x), Math.abs(scaling.y), Math.abs(scaling.z)) || 1.0;
    const rLocal = this.radius / maxScale;
    const rSq = rLocal * rLocal;

    const numVerts = positions.length / 3;
    for (let i = 0; i < numVerts; i++) {
      const idx = i * 3;
      const vx = positions[idx];
      const vy = positions[idx + 1];
      const vz = positions[idx + 2];

      const dx = vx - localHit.x;
      const dy = vy - localHit.y;
      const dz = vz - localHit.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq <= rSq) {
        const t = 1 - dSq / rSq;
        this.grabWeights.set(i, t * t);
      }

      if (this.symmetryX) {
        const dxs = vx - (-localHit.x);
        const dys = vy - localHit.y;
        const dzs = vz - localHit.z;
        const dSqs = dxs * dxs + dys * dys + dzs * dzs;
        if (dSqs <= rSq) {
          const ts = 1 - dSqs / rSq;
          this.grabWeightsSym.set(i, ts * ts);
        }
      }
    }
  }

  private handleGrabDrag(): void {
    if (
      !this.activeMesh ||
      !this.grabPlane ||
      !this.grabStartWorldPoint ||
      !this.grabInitialPositions
    ) {
      return;
    }

    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      Matrix.Identity(),
      this.scene.activeCamera
    );
    const dist = ray.intersectsPlane(this.grabPlane);
    if (dist === null || isNaN(dist)) return;

    const currentWorldPos = ray.origin.add(ray.direction.scale(dist));
    const worldDelta = currentWorldPos.subtract(this.grabStartWorldPoint);

    // Update cursor position to track drag movement
    this.updateCursorTransform(currentWorldPos, this.grabPlane.normal);

    this.activeMesh.computeWorldMatrix(true);
    const invWorld = this.activeMesh.getWorldMatrix().clone().invert();
    const localDelta = Vector3.TransformNormal(worldDelta, invWorld);
    const symLocalDelta = new Vector3(-localDelta.x, localDelta.y, localDelta.z);

    const positions = this.activeMesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = this.activeMesh.getIndices();
    if (!positions || !indices) return;

    // Restore initial positions first for smooth non-accumulative grab deformation
    for (let i = 0; i < positions.length; i++) {
      positions[i] = this.grabInitialPositions[i];
    }

    // Apply primary grabbed vertices displacement
    for (const [vertIdx, weight] of this.grabWeights) {
      const idx = vertIdx * 3;
      const factor = weight * this.strength;
      positions[idx] += localDelta.x * factor;
      positions[idx + 1] += localDelta.y * factor;
      positions[idx + 2] += localDelta.z * factor;
    }

    // Apply symmetrical grab
    if (this.symmetryX) {
      for (const [vertIdx, weight] of this.grabWeightsSym) {
        const idx = vertIdx * 3;
        const factor = weight * this.strength;
        positions[idx] += symLocalDelta.x * factor;
        positions[idx + 1] += symLocalDelta.y * factor;
        positions[idx + 2] += symLocalDelta.z * factor;
      }
    }

    const normals = this.activeMesh.getVerticesData(VertexBuffer.NormalKind) || [];
    this.activeMesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    VertexData.ComputeNormals(positions, indices, normals);
    this.activeMesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    this.activeMesh.refreshBoundingInfo();
  }

  private updateCursorTransform(worldPos: Vector3, normal: Vector3): void {
    if (!this.cursorRing || this.cursorRing.isDisposed()) return;

    this.cursorRing.isVisible = true;
    this.cursorRing.position.copyFrom(worldPos);

    // Align disc normal with surface normal
    const up = Math.abs(Vector3.Dot(normal, Vector3.Up())) > 0.99 ? Vector3.Right() : Vector3.Up();
    this.cursorRing.lookAt(worldPos.add(normal), 0, 0, 0);

    // Mirrored cursor
    if (this.symmetryX && this.symCursorRing && !this.symCursorRing.isDisposed()) {
      this.symCursorRing.isVisible = true;
      const symPos = new Vector3(-worldPos.x, worldPos.y, worldPos.z);
      const symNormal = new Vector3(-normal.x, normal.y, normal.z);
      this.symCursorRing.position.copyFrom(symPos);
      this.symCursorRing.lookAt(symPos.add(symNormal), 0, 0, 0);
    } else if (this.symCursorRing) {
      this.symCursorRing.isVisible = false;
    }
  }

  private endSculptStroke(): void {
    if (!this.isSculpting || !this.activeMesh) {
      this.isSculpting = false;
      this.activeMesh = null;
      return;
    }

    const mesh = this.activeMesh;
    const preSnapshot = this.strokeStartVertexData;
    const postSnapshot = VertexData.ExtractFromMesh(mesh);

    // Re-attach camera control
    if (this.service.canvas && this.scene.activeCamera) {
      this.scene.activeCamera.attachControl(this.service.canvas, true);
    }

    this.isSculpting = false;
    this.activeMesh = null;
    this.lastLocalPick = null;
    this.strokeStartVertexData = null;

    // Clear grab brush tracking
    this.grabStartWorldPoint = null;
    this.grabPlane = null;
    this.grabInitialPositions = null;
    this.grabWeights.clear();
    this.grabWeightsSym.clear();

    if (preSnapshot) {
      this.service.recordAction({
        name: `Sculpt (${this.brushType})`,
        undo: () => {
          if (!mesh.isDisposed()) {
            preSnapshot.applyToMesh(mesh, true);
            mesh.refreshBoundingInfo();
            this.service.updateStats();
            this.onMeshModified?.(mesh);
          }
        },
        redo: () => {
          if (!mesh.isDisposed()) {
            postSnapshot.applyToMesh(mesh, true);
            mesh.refreshBoundingInfo();
            this.service.updateStats();
            this.onMeshModified?.(mesh);
          }
        },
      });
    }

    this.service.updateStats();
    this.onMeshModified?.(mesh);
  }

  private ensureMeshUpdatable(mesh: Mesh): void {
    if (!mesh.isVertexBufferUpdatable(VertexBuffer.PositionKind)) {
      const vd = VertexData.ExtractFromMesh(mesh);
      vd.applyToMesh(mesh, true);
    }
  }

  /**
   * Displaces vertices of the target mesh based on current brush mode and falloff.
   */
  public applyBrushStroke(mesh: Mesh, worldHit: Vector3, worldNormal: Nullable<Vector3>): void {
    this.ensureMeshUpdatable(mesh);

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) return;

    const normals = mesh.getVerticesData(VertexBuffer.NormalKind) || [];

    mesh.computeWorldMatrix(true);
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const localHit = Vector3.TransformCoordinates(worldHit, invWorld);
    const localNorm = worldNormal
      ? Vector3.TransformNormal(worldNormal, invWorld).normalize()
      : Vector3.Up();

    // Scale-aware brush radius
    const scaling = mesh.scaling;
    const maxScale = Math.max(Math.abs(scaling.x), Math.abs(scaling.y), Math.abs(scaling.z)) || 1.0;
    const rLocal = this.radius / maxScale;
    const rSq = rLocal * rLocal;

    // Movement delta for Grab brush
    let localDelta = Vector3.Zero();
    if (this.brushType === 'grab' && this.lastLocalPick) {
      localDelta = localHit.subtract(this.lastLocalPick);
    }
    this.lastLocalPick = localHit.clone();

    // Invert sign multiplier
    const sign = this.invert ? -1 : 1;
    const strengthFactor = this.strength;

    // Gather vertices for Smooth or Flatten brush calculations
    let avgNeighborPos = Vector3.Zero();
    let neighborCount = 0;
    if (this.brushType === 'smooth' || this.brushType === 'flatten') {
      for (let i = 0; i < positions.length; i += 3) {
        const vx = positions[i];
        const vy = positions[i + 1];
        const vz = positions[i + 2];
        const dx = vx - localHit.x;
        const dy = vy - localHit.y;
        const dz = vz - localHit.z;
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          avgNeighborPos.addInPlaceFromFloats(vx, vy, vz);
          neighborCount++;
        }
      }
      if (neighborCount > 0) {
        avgNeighborPos.scaleInPlace(1 / neighborCount);
      }
    }

    const vertexCount = positions.length / 3;

    // 1. Primary Brush Pass
    this.applyDeformation(
      positions,
      normals,
      vertexCount,
      localHit,
      localNorm,
      localDelta,
      rSq,
      sign,
      strengthFactor,
      avgNeighborPos
    );

    // 2. Mirrored Symmetry Pass (Reflection across X = 0)
    if (this.symmetryX) {
      const symHit = new Vector3(-localHit.x, localHit.y, localHit.z);
      const symNorm = new Vector3(-localNorm.x, localNorm.y, localNorm.z);
      const symDelta = new Vector3(-localDelta.x, localDelta.y, localDelta.z);
      const symAvg = new Vector3(-avgNeighborPos.x, avgNeighborPos.y, avgNeighborPos.z);

      this.applyDeformation(
        positions,
        normals,
        vertexCount,
        symHit,
        symNorm,
        symDelta,
        rSq,
        sign,
        strengthFactor,
        symAvg,
        true
      );
    }

    // Recompute smooth normals and refresh geometry
    mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    mesh.refreshBoundingInfo();
  }

  private applyDeformation(
    positions: FloatArray,
    normals: FloatArray,
    vertexCount: number,
    center: Vector3,
    normal: Vector3,
    delta: Vector3,
    rSq: number,
    sign: number,
    strength: number,
    avgPos: Vector3,
    isSymmetry: boolean = false
  ): void {
    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3;
      const vx = positions[idx];
      const vy = positions[idx + 1];
      const vz = positions[idx + 2];

      const dx = vx - center.x;
      const dy = vy - center.y;
      const dz = vz - center.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > rSq) continue;

      // Smooth cosine / hermite falloff (w = (1 - d^2/r^2)^2)
      const t = 1 - distSq / rSq;
      const w = t * t;

      switch (this.brushType) {
        case 'clay': {
          // Displaces volume along stroke normal with organic soft plateau
          const disp = strength * w * 0.06 * sign;
          positions[idx] += normal.x * disp;
          positions[idx + 1] += normal.y * disp;
          positions[idx + 2] += normal.z * disp;
          break;
        }

        case 'grab': {
          // Pulls geometry smoothly along drag vector
          const moveFactor = w * Math.min(strength * 1.5, 1.0);
          positions[idx] += delta.x * moveFactor;
          positions[idx + 1] += delta.y * moveFactor;
          positions[idx + 2] += delta.z * moveFactor;
          break;
        }

        case 'inflate': {
          // Expands or deflates vertices along their own vertex normal
          const nx = normals[idx] || normal.x;
          const ny = normals[idx + 1] || normal.y;
          const nz = normals[idx + 2] || normal.z;
          const disp = strength * w * 0.05 * sign;
          positions[idx] += nx * disp;
          positions[idx + 1] += ny * disp;
          positions[idx + 2] += nz * disp;
          break;
        }

        case 'smooth': {
          // Relaxes vertices towards neighbors (Laplacian smoothing filter)
          const factor = strength * w * 0.35;
          positions[idx] += (avgPos.x - vx) * factor;
          positions[idx + 1] += (avgPos.y - vy) * factor;
          positions[idx + 2] += (avgPos.z - vz) * factor;
          break;
        }

        case 'flatten': {
          // Projects vertices towards average plane of the brush contact
          const distToPlane = (vx - center.x) * normal.x + (vy - center.y) * normal.y + (vz - center.z) * normal.z;
          const factor = strength * w * 0.45;
          positions[idx] -= normal.x * distToPlane * factor;
          positions[idx + 1] -= normal.y * distToPlane * factor;
          positions[idx + 2] -= normal.z * distToPlane * factor;
          break;
        }

        case 'pinch': {
          // Pinches geometry towards stroke center (creases, wrinkles)
          const factor = strength * w * 0.18 * sign;
          positions[idx] += (center.x - vx) * factor;
          positions[idx + 1] += (center.y - vy) * factor;
          positions[idx + 2] += (center.z - vz) * factor;
          break;
        }
      }
    }
  }

  /* =========================================================================
     BASE MESH SPAWNERS (HUMANOID, QUADRUPED, HEAD BUST, SCULPT SPHERE)
     ========================================================================= */

  /**
   * Spawns an 8-head proportional Humanoid Mannequin Base Mesh (Loomis Canon).
   * Total height: 1.80m, bottom-aligned at Y = 0 with articulated joints (elbows, knees, shoulders).
   */
  public spawnHumanoidBaseMesh(options: BaseMeshSpawnOptions = {}): Mesh {
    if (options.canon === 'chibi') {
      return this.spawnChibiBaseMesh(options);
    }

    const rootName = options.name || 'Humanoid_BaseMesh';
    const parts: Mesh[] = [];
    const scale = options.scale || 1.0;
    const pose = options.pose || 't_pose';

    // 1. Head (Height ~0.225m, center Y ~ 1.68m)
    const head = MeshBuilder.CreateSphere('h_head', { diameterX: 0.18, diameterY: 0.225, diameterZ: 0.20, segments: 16 }, this.scene);
    head.position.set(0, 1.68, 0.02);
    parts.push(head);

    // 2. Neck (Y = 1.52m)
    const neck = MeshBuilder.CreateCylinder('h_neck', { height: 0.12, diameterTop: 0.11, diameterBottom: 0.13, tessellation: 14 }, this.scene);
    neck.position.set(0, 1.52, 0);
    parts.push(neck);

    // 3. Chest & Ribcage (Y = 1.35m)
    const chest = MeshBuilder.CreateCylinder('h_chest', { height: 0.26, diameterTop: 0.38, diameterBottom: 0.30, tessellation: 16 }, this.scene);
    chest.position.set(0, 1.35, 0);
    chest.scaling.set(1.0, 1.0, 0.75);
    parts.push(chest);

    // 4. Waist & Abdomen (Y = 1.15m)
    const waist = MeshBuilder.CreateCylinder('h_waist', { height: 0.18, diameterTop: 0.30, diameterBottom: 0.28, tessellation: 16 }, this.scene);
    waist.position.set(0, 1.15, 0);
    waist.scaling.set(1.0, 1.0, 0.72);
    parts.push(waist);

    // 5. Pelvis & Hips (Y = 0.96m, groin at 0.90m = 0.5 * H)
    const pelvis = MeshBuilder.CreateCylinder('h_pelvis', { height: 0.22, diameterTop: 0.29, diameterBottom: 0.35, tessellation: 16 }, this.scene);
    pelvis.position.set(0, 0.96, 0);
    pelvis.scaling.set(1.0, 1.0, 0.75);
    parts.push(pelvis);

    // 6. Arms (Left & Right) - T-Pose or A-Pose
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const shoulderX = side * 0.24;
      const armY = 1.42;

      // Shoulder joint
      const shoulder = MeshBuilder.CreateSphere(`h_shoulder_${sName}`, { diameter: 0.12, segments: 12 }, this.scene);
      shoulder.position.set(shoulderX, armY, 0);
      parts.push(shoulder);

      if (pose === 't_pose') {
        // T-Pose: Upper arm horizontal along X-axis
        const upperArm = MeshBuilder.CreateCylinder(`h_uparm_${sName}`, { height: 0.28, diameterTop: 0.10, diameterBottom: 0.08, tessellation: 12 }, this.scene);
        upperArm.position.set(side * 0.38, armY, 0);
        upperArm.rotation.z = side * (Math.PI / 2);
        parts.push(upperArm);

        // Elbow joint
        const elbow = MeshBuilder.CreateSphere(`h_elbow_${sName}`, { diameter: 0.09, segments: 12 }, this.scene);
        elbow.position.set(side * 0.52, armY, 0);
        parts.push(elbow);

        // Forearm horizontal along X-axis
        const forearm = MeshBuilder.CreateCylinder(`h_forearm_${sName}`, { height: 0.26, diameterTop: 0.08, diameterBottom: 0.065, tessellation: 12 }, this.scene);
        forearm.position.set(side * 0.65, armY, 0);
        forearm.rotation.z = side * (Math.PI / 2);
        parts.push(forearm);

        // Hand
        const hand = MeshBuilder.CreateBox(`h_hand_${sName}`, { width: 0.15, height: 0.05, depth: 0.08 }, this.scene);
        hand.position.set(side * 0.81, armY, 0);
        parts.push(hand);
      } else {
        // A-Pose: Angled downward
        const upperArm = MeshBuilder.CreateCylinder(`h_uparm_${sName}`, { height: 0.28, diameterTop: 0.10, diameterBottom: 0.08, tessellation: 12 }, this.scene);
        upperArm.position.set(side * 0.28, 1.26, 0);
        upperArm.rotation.z = side * -0.22;
        parts.push(upperArm);

        const elbow = MeshBuilder.CreateSphere(`h_elbow_${sName}`, { diameter: 0.09, segments: 12 }, this.scene);
        elbow.position.set(side * 0.32, 1.11, 0);
        parts.push(elbow);

        const forearm = MeshBuilder.CreateCylinder(`h_forearm_${sName}`, { height: 0.26, diameterTop: 0.08, diameterBottom: 0.065, tessellation: 12 }, this.scene);
        forearm.position.set(side * 0.35, 0.96, 0);
        forearm.rotation.z = side * -0.15;
        parts.push(forearm);

        const hand = MeshBuilder.CreateBox(`h_hand_${sName}`, { width: 0.05, height: 0.15, depth: 0.08 }, this.scene);
        hand.position.set(side * 0.37, 0.78, 0);
        parts.push(hand);
      }
    }

    // 7. Legs (Left & Right)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const hipX = side * 0.13;

      // Hip joint
      const hip = MeshBuilder.CreateSphere(`h_hip_${sName}`, { diameter: 0.15, segments: 12 }, this.scene);
      hip.position.set(hipX, 0.88, 0);
      parts.push(hip);

      // Thigh (Oberschenkel)
      const thigh = MeshBuilder.CreateCylinder(`h_thigh_${sName}`, { height: 0.42, diameterTop: 0.16, diameterBottom: 0.12, tessellation: 14 }, this.scene);
      thigh.position.set(hipX, 0.66, 0);
      parts.push(thigh);

      // Knee Joint
      const knee = MeshBuilder.CreateSphere(`h_knee_${sName}`, { diameter: 0.12, segments: 12 }, this.scene);
      knee.position.set(hipX, 0.45, 0.02);
      parts.push(knee);

      // Calf / Shin (Unterschenkel)
      const calf = MeshBuilder.CreateCylinder(`h_calf_${sName}`, { height: 0.40, diameterTop: 0.12, diameterBottom: 0.09, tessellation: 14 }, this.scene);
      calf.position.set(hipX, 0.24, -0.01);
      parts.push(calf);

      // Foot (Fuß)
      const foot = MeshBuilder.CreateBox(`h_foot_${sName}`, { width: 0.10, height: 0.07, depth: 0.24 }, this.scene);
      foot.position.set(hipX, 0.035, 0.05);
      parts.push(foot);
    }

    // Merge into single seamless humanoid base mesh
    const baseMesh = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!baseMesh) {
      throw new Error('Failed to merge humanoid base mesh components.');
    }

    baseMesh.name = rootName;
    baseMesh.id = `mesh_${Date.now()}_humanoid`;
    if (scale !== 1.0) {
      baseMesh.scaling.set(scale, scale, scale);
    }
    if (options.position) {
      baseMesh.position.copyFrom(options.position);
    }

    this.applyDefaultCharacterMaterial(baseMesh);
    this.service.addMesh(baseMesh);
    this.service.selectMesh(baseMesh);

    return baseMesh;
  }

  /**
   * Spawns a Stylized / Chibi Cartoon Base Mesh (3.5-Head Canon: Mario, Dwarf, Toon Mascot).
   * Features a large round cartoon head with nose and ears, plump potbelly torso, short sturdy limbs,
   * oversized cartoon boots, and gloves in T-Pose or A-Pose.
   */
  public spawnChibiBaseMesh(options: BaseMeshSpawnOptions = {}): Mesh {
    const rootName = options.name || 'Chibi_BaseMesh';
    const parts: Mesh[] = [];
    const scale = options.scale || 1.0;
    const pose = options.pose || 't_pose';
    const materialStyle = options.materialStyle || 'colored';

    // Materials
    let skinMat: Material | null = null;
    let shortsMat: Material | null = null;
    let glovesMat: Material | null = null;
    let bootsMat: Material | null = null;

    if (materialStyle === 'colored') {
      const pbrSkin = new PBRMaterial('pbr_chibi_skin', this.scene);
      pbrSkin.albedoColor = Color3.FromHexString('#f5c59e');
      pbrSkin.roughness = 0.6;
      pbrSkin.metallic = 0.0;
      pbrSkin.backFaceCulling = false;
      skinMat = pbrSkin;

      const pbrShorts = new PBRMaterial('pbr_chibi_shorts', this.scene);
      pbrShorts.albedoColor = Color3.FromHexString('#0033cc');
      pbrShorts.roughness = 0.45;
      pbrShorts.metallic = 0.05;
      pbrShorts.backFaceCulling = false;
      shortsMat = pbrShorts;

      const pbrGloves = new PBRMaterial('pbr_chibi_gloves', this.scene);
      pbrGloves.albedoColor = Color3.FromHexString('#f5f5f5');
      pbrGloves.roughness = 0.4;
      pbrGloves.metallic = 0.0;
      pbrGloves.backFaceCulling = false;
      glovesMat = pbrGloves;

      const pbrBoots = new PBRMaterial('pbr_chibi_boots', this.scene);
      pbrBoots.albedoColor = Color3.FromHexString('#5a2a18');
      pbrBoots.roughness = 0.7;
      pbrBoots.metallic = 0.0;
      pbrBoots.backFaceCulling = false;
      bootsMat = pbrBoots;
    }

    // 1. Head (Height 0.38m, Width 0.42m, Depth 0.40m, center Y = 0.98m)
    const head = MeshBuilder.CreateSphere('c_head', { diameterX: 0.42, diameterY: 0.38, diameterZ: 0.40, segments: 16 }, this.scene);
    head.position.set(0, 0.98, 0.02);
    if (skinMat) head.material = skinMat;
    parts.push(head);

    // 2. Bulbous Cartoon Nose
    const nose = MeshBuilder.CreateSphere('c_nose', { diameterX: 0.16, diameterY: 0.13, diameterZ: 0.14, segments: 14 }, this.scene);
    nose.position.set(0, 0.96, 0.22);
    if (skinMat) nose.material = skinMat;
    parts.push(nose);

    // 3. Ears (Left & Right)
    for (const side of [-1, 1]) {
      const ear = MeshBuilder.CreateSphere(`c_ear_${side === 1 ? 'r' : 'l'}`, { diameterX: 0.10, diameterY: 0.12, diameterZ: 0.08, segments: 12 }, this.scene);
      ear.position.set(side * 0.22, 0.98, 0.02);
      if (skinMat) ear.material = skinMat;
      parts.push(ear);
    }

    // 4. Neck (Short connection: Y = 0.81m)
    const neck = MeshBuilder.CreateCylinder('c_neck', { height: 0.08, diameter: 0.18, tessellation: 14 }, this.scene);
    neck.position.set(0, 0.81, 0.02);
    if (skinMat) neck.material = skinMat;
    parts.push(neck);

    // 5. Potbelly Torso
    const isMannequin = options.style === 'mannequin';

    if (isMannequin) {
      const chest = MeshBuilder.CreateCylinder('c_chest', { height: 0.24, diameterTop: 0.36, diameterBottom: 0.44, tessellation: 16 }, this.scene);
      chest.position.set(0, 0.69, 0.03);
      chest.scaling.set(1.0, 1.0, 0.95);
      if (skinMat) chest.material = skinMat;
      parts.push(chest);

      const pelvis = MeshBuilder.CreateCylinder('c_pelvis', { height: 0.20, diameterTop: 0.43, diameterBottom: 0.36, tessellation: 16 }, this.scene);
      pelvis.position.set(0, 0.50, 0);
      pelvis.scaling.set(1.0, 1.0, 0.92);
      if (shortsMat) pelvis.material = shortsMat;
      parts.push(pelvis);
    } else {
      // Organic Torso (Smooth continuous capsule eliminating horizontal seam)
      const torso = MeshBuilder.CreateCapsule('c_torso', { height: 0.44, radius: 0.20, tessellation: 20, subdivisions: 4 }, this.scene);
      torso.position.set(0, 0.58, 0.02);
      torso.scaling.set(1.05, 1.0, 0.95);
      if (shortsMat) torso.material = shortsMat;
      parts.push(torso);

      const chest = MeshBuilder.CreateSphere('c_chest', { diameterX: 0.38, diameterY: 0.30, diameterZ: 0.36, segments: 16 }, this.scene);
      chest.position.set(0, 0.74, 0.02);
      if (skinMat) chest.material = skinMat;
      parts.push(chest);
    }

    // 7. Arms (T-Pose or A-Pose)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const shoulderX = side * 0.22;
      const armY = 0.74;

      if (!isMannequin) {
        // Organic continuous curved tube arms without joint ball seams
        const armPath = pose === 't_pose' ? [
          new Vector3(side * 0.18, armY, 0),
          new Vector3(side * 0.36, armY, 0),
          new Vector3(side * 0.54, armY, 0),
        ] : [
          new Vector3(side * 0.18, armY, 0),
          new Vector3(side * 0.32, armY - 0.12, 0),
          new Vector3(side * 0.42, armY - 0.28, 0),
        ];

        const arm = MeshBuilder.CreateTube(`c_arm_${sName}`, {
          path: armPath,
          radiusFunction: (i) => i === 0 ? 0.075 : (i === 1 ? 0.065 : 0.055),
          tessellation: 16,
          cap: Mesh.CAP_ALL,
        }, this.scene);
        if (skinMat) arm.material = skinMat;
        parts.push(arm);

        // Glove cuff
        const cuff = MeshBuilder.CreateCylinder(`c_cuff_${sName}`, { height: 0.05, diameter: 0.13, tessellation: 14 }, this.scene);
        cuff.position.copyFrom(armPath[2]);
        if (pose === 't_pose') cuff.rotation.z = side * (Math.PI / 2);
        if (glovesMat) cuff.material = glovesMat;
        parts.push(cuff);

        // Cartoon Glove
        const glove = MeshBuilder.CreateSphere(`c_glove_${sName}`, { diameterX: 0.16, diameterY: 0.14, diameterZ: 0.14, segments: 14 }, this.scene);
        const glovePos = pose === 't_pose'
          ? new Vector3(side * 0.64, armY, 0)
          : new Vector3(side * 0.48, armY - 0.38, 0);
        glove.position.copyFrom(glovePos);
        if (glovesMat) glove.material = glovesMat;
        parts.push(glove);
      } else {
        // Mannequin separate cylinders and spheres
        const shoulder = MeshBuilder.CreateSphere(`c_shoulder_${sName}`, { diameter: 0.12, segments: 12 }, this.scene);
        shoulder.position.set(shoulderX, armY, 0);
        if (skinMat) shoulder.material = skinMat;
        parts.push(shoulder);

        if (pose === 't_pose') {
          const upperArm = MeshBuilder.CreateCylinder(`c_uparm_${sName}`, { height: 0.16, diameter: 0.11, tessellation: 12 }, this.scene);
          upperArm.position.set(side * 0.31, armY, 0);
          upperArm.rotation.z = side * (Math.PI / 2);
          if (skinMat) upperArm.material = skinMat;
          parts.push(upperArm);

          const elbow = MeshBuilder.CreateSphere(`c_elbow_${sName}`, { diameter: 0.10, segments: 12 }, this.scene);
          elbow.position.set(side * 0.40, armY, 0);
          if (skinMat) elbow.material = skinMat;
          parts.push(elbow);

          const forearm = MeshBuilder.CreateCylinder(`c_forearm_${sName}`, { height: 0.16, diameter: 0.10, tessellation: 12 }, this.scene);
          forearm.position.set(side * 0.49, armY, 0);
          forearm.rotation.z = side * (Math.PI / 2);
          if (skinMat) forearm.material = skinMat;
          parts.push(forearm);

          const cuff = MeshBuilder.CreateCylinder(`c_cuff_${sName}`, { height: 0.05, diameter: 0.14, tessellation: 14 }, this.scene);
          cuff.position.set(side * 0.57, armY, 0);
          cuff.rotation.z = side * (Math.PI / 2);
          if (glovesMat) cuff.material = glovesMat;
          parts.push(cuff);

          const glove = MeshBuilder.CreateSphere(`c_glove_${sName}`, { diameterX: 0.16, diameterY: 0.15, diameterZ: 0.14, segments: 14 }, this.scene);
          glove.position.set(side * 0.65, armY, 0);
          if (glovesMat) glove.material = glovesMat;
          parts.push(glove);
        } else {
          const upperArm = MeshBuilder.CreateCylinder(`c_uparm_${sName}`, { height: 0.18, diameter: 0.11, tessellation: 12 }, this.scene);
          upperArm.position.set(side * 0.28, armY - 0.07, 0);
          upperArm.rotation.z = side * -0.45;
          if (skinMat) upperArm.material = skinMat;
          parts.push(upperArm);

          const elbow = MeshBuilder.CreateSphere(`c_elbow_${sName}`, { diameter: 0.10, segments: 12 }, this.scene);
          elbow.position.set(side * 0.34, armY - 0.16, 0);
          if (skinMat) elbow.material = skinMat;
          parts.push(elbow);

          const forearm = MeshBuilder.CreateCylinder(`c_forearm_${sName}`, { height: 0.18, diameter: 0.10, tessellation: 12 }, this.scene);
          forearm.position.set(side * 0.38, armY - 0.25, 0);
          forearm.rotation.z = side * -0.35;
          if (skinMat) forearm.material = skinMat;
          parts.push(forearm);

          const glove = MeshBuilder.CreateSphere(`c_glove_${sName}`, { diameter: 0.15, segments: 14 }, this.scene);
          glove.position.set(side * 0.42, armY - 0.37, 0);
          if (glovesMat) glove.material = glovesMat;
          parts.push(glove);
        }
      }
    }

    // 8. Legs (Left & Right)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const legX = side * 0.13;

      if (!isMannequin) {
        // Organic continuous curved tube legs
        const legPath = [
          new Vector3(legX, 0.42, 0),
          new Vector3(legX, 0.28, 0.015),
          new Vector3(legX, 0.14, 0),
        ];
        const leg = MeshBuilder.CreateTube(`c_leg_${sName}`, {
          path: legPath,
          radiusFunction: (i) => i === 0 ? 0.09 : (i === 1 ? 0.08 : 0.07),
          tessellation: 16,
          cap: Mesh.CAP_ALL,
        }, this.scene);
        if (shortsMat) leg.material = shortsMat;
        parts.push(leg);

        const boot = MeshBuilder.CreateSphere(`c_boot_${sName}`, { diameterX: 0.18, diameterY: 0.14, diameterZ: 0.26, segments: 14 }, this.scene);
        boot.position.set(legX, 0.07, 0.04);
        if (bootsMat) boot.material = bootsMat;
        parts.push(boot);
      } else {
        // Mannequin separate cylinders and spheres
        const thigh = MeshBuilder.CreateCylinder(`c_thigh_${sName}`, { height: 0.16, diameter: 0.15, tessellation: 14 }, this.scene);
        thigh.position.set(legX, 0.35, 0);
        if (shortsMat) thigh.material = shortsMat;
        parts.push(thigh);

        const knee = MeshBuilder.CreateSphere(`c_knee_${sName}`, { diameter: 0.13, segments: 12 }, this.scene);
        knee.position.set(legX, 0.25, 0.02);
        if (skinMat) knee.material = skinMat;
        parts.push(knee);

        const calf = MeshBuilder.CreateCylinder(`c_calf_${sName}`, { height: 0.14, diameter: 0.13, tessellation: 14 }, this.scene);
        calf.position.set(legX, 0.16, 0);
        if (skinMat) calf.material = skinMat;
        parts.push(calf);

        const boot = MeshBuilder.CreateBox(`c_boot_${sName}`, { width: 0.17, height: 0.13, depth: 0.26 }, this.scene);
        boot.position.set(legX, 0.065, 0.04);
        if (bootsMat) boot.material = bootsMat;
        parts.push(boot);
      }
    }

    // Merge meshes preserving MultiMaterial if colored
    const baseMesh = Mesh.MergeMeshes(parts, true, true, undefined, true, materialStyle === 'colored');
    if (!baseMesh) {
      throw new Error('Failed to merge chibi cartoon base mesh components.');
    }

    baseMesh.name = rootName;
    baseMesh.id = `mesh_${Date.now()}_chibi`;
    if (scale !== 1.0) {
      baseMesh.scaling.set(scale, scale, scale);
    }
    if (options.position) {
      baseMesh.position.copyFrom(options.position);
    }

    if (materialStyle === 'clay' || !baseMesh.material) {
      this.applyDefaultCharacterMaterial(baseMesh);
    }

    this.service.addMesh(baseMesh);
    this.service.selectMesh(baseMesh);

    return baseMesh;
  }

  /**
   * Spawns an Organic Stylized Creature / Chibi Demon Base Mesh.
   * Features a seamless pear-shaped body (head + torso), continuous curved tubular arms with claws,
   * digitigrade curved legs with paws, curved horns, bat wings, halo, protruding cartoon eyes, and pitchfork.
   * Designed for game-ready soft organic contours.
   */
  public spawnOrganicCreatureBaseMesh(options: BaseMeshSpawnOptions = {}): Mesh {
    const rootName = options.name || 'Organic_Demon_BaseMesh';
    const parts: Mesh[] = [];
    const scale = options.scale || 1.0;
    const materialStyle = options.materialStyle || 'colored';

    let skinMat: Material | null = null;
    let darkMat: Material | null = null;
    let eyeMat: Material | null = null;
    let pupilMat: Material | null = null;
    let whiteMat: Material | null = null;

    if (materialStyle === 'colored') {
      const pbrSkin = new PBRMaterial('pbr_creature_skin', this.scene);
      pbrSkin.albedoColor = Color3.FromHexString('#c9182b');
      pbrSkin.roughness = 0.38;
      pbrSkin.metallic = 0.02;
      pbrSkin.backFaceCulling = false;
      skinMat = pbrSkin;

      const pbrDark = new PBRMaterial('pbr_creature_dark', this.scene);
      pbrDark.albedoColor = Color3.FromHexString('#202024');
      pbrDark.roughness = 0.45;
      pbrDark.metallic = 0.1;
      pbrDark.backFaceCulling = false;
      darkMat = pbrDark;

      const pbrEye = new PBRMaterial('pbr_creature_eye', this.scene);
      pbrEye.albedoColor = Color3.FromHexString('#f0f0f5');
      pbrEye.roughness = 0.25;
      pbrEye.metallic = 0.0;
      eyeMat = pbrEye;

      const pbrPupil = new PBRMaterial('pbr_creature_pupil', this.scene);
      pbrPupil.albedoColor = Color3.FromHexString('#111114');
      pbrPupil.roughness = 0.5;
      pbrPupil.metallic = 0.0;
      pupilMat = pbrPupil;

      const pbrWhite = new PBRMaterial('pbr_creature_white', this.scene);
      pbrWhite.albedoColor = Color3.FromHexString('#ffffff');
      pbrWhite.roughness = 0.3;
      pbrWhite.metallic = 0.0;
      whiteMat = pbrWhite;
    }

    // 1. Organic Pear Body (Head + Torso united in one flowing organic volume)
    const body = MeshBuilder.CreateSphere('cr_body', { diameterX: 0.42, diameterY: 0.54, diameterZ: 0.40, segments: 24 }, this.scene);
    body.position.set(0, 0.64, 0);
    body.scaling.set(1.08, 1.25, 0.98);
    if (skinMat) body.material = skinMat;
    parts.push(body);

    // 2. Arms (Continuous curved tubes flowing seamlessly down and forward)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const armPath = [
        new Vector3(side * 0.18, 0.65, 0.02),
        new Vector3(side * 0.32, 0.50, 0.07),
        new Vector3(side * 0.42, 0.35, 0.13),
      ];
      const arm = MeshBuilder.CreateTube(`cr_arm_${sName}`, {
        path: armPath,
        radiusFunction: (i) => i === 0 ? 0.07 : (i === 1 ? 0.055 : 0.045),
        tessellation: 16,
        cap: Mesh.CAP_ALL,
      }, this.scene);
      if (skinMat) arm.material = skinMat;
      parts.push(arm);

      // Hand & Claws
      const hand = MeshBuilder.CreateSphere(`cr_hand_${sName}`, { diameterX: 0.11, diameterY: 0.13, diameterZ: 0.11, segments: 14 }, this.scene);
      hand.position.set(side * 0.44, 0.28, 0.16);
      if (skinMat) hand.material = skinMat;
      parts.push(hand);

      // Claws / Fingers
      for (let f = 0; f < 2; f++) {
        const claw = MeshBuilder.CreateCylinder(`cr_claw_${sName}_${f}`, { height: 0.06, diameterTop: 0.005, diameterBottom: 0.028, tessellation: 8 }, this.scene);
        claw.position.set(side * (0.42 + f * 0.04), 0.22, 0.18 + f * 0.01);
        claw.rotation.x = Math.PI / 4;
        claw.rotation.z = side * 0.2;
        if (skinMat) claw.material = skinMat;
        parts.push(claw);
      }
    }

    // 3. Legs (Continuous digitigrade curved tubes with backward knee bend)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const legPath = [
        new Vector3(side * 0.13, 0.38, 0.01),
        new Vector3(side * 0.15, 0.23, -0.05),
        new Vector3(side * 0.13, 0.10, 0.03),
      ];
      const leg = MeshBuilder.CreateTube(`cr_leg_${sName}`, {
        path: legPath,
        radiusFunction: (i) => i === 0 ? 0.075 : (i === 1 ? 0.06 : 0.045),
        tessellation: 16,
        cap: Mesh.CAP_ALL,
      }, this.scene);
      if (skinMat) leg.material = skinMat;
      parts.push(leg);

      // Foot with toes
      const foot = MeshBuilder.CreateBox(`cr_foot_${sName}`, { width: 0.10, height: 0.045, depth: 0.15 }, this.scene);
      foot.position.set(side * 0.13, 0.023, 0.07);
      if (skinMat) foot.material = skinMat;
      parts.push(foot);
    }

    // 4. Stylized Curved Horns
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const hornPath = [
        new Vector3(side * 0.12, 0.88, 0.04),
        new Vector3(side * 0.18, 0.98, 0.02),
        new Vector3(side * 0.20, 1.08, -0.05),
      ];
      const horn = MeshBuilder.CreateTube(`cr_horn_${sName}`, {
        path: hornPath,
        radiusFunction: (i) => i === 0 ? 0.048 : (i === 1 ? 0.032 : 0.005),
        tessellation: 14,
        cap: Mesh.CAP_ALL,
      }, this.scene);
      if (darkMat) horn.material = darkMat;
      parts.push(horn);
    }

    // 5. Stylized Protruding Cartoon Eyes with Pupils
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const eye = MeshBuilder.CreateSphere(`cr_eye_${sName}`, { diameterX: 0.13, diameterY: 0.12, diameterZ: 0.12, segments: 14 }, this.scene);
      eye.position.set(side * 0.13, 0.73, 0.17);
      if (eyeMat) eye.material = eyeMat;
      parts.push(eye);

      // Pupil disc (horizontal slit cartoon look)
      const pupil = MeshBuilder.CreateBox(`cr_pupil_${sName}`, { width: 0.07, height: 0.03, depth: 0.02 }, this.scene);
      pupil.position.set(side * 0.13, 0.73, 0.23);
      if (pupilMat) pupil.material = pupilMat;
      parts.push(pupil);
    }

    // 6. Inset Smiling Mouth with 2 Cute White Fangs
    const mouth = MeshBuilder.CreateTorus('cr_mouth', { diameter: 0.14, thickness: 0.022, tessellation: 16 }, this.scene);
    mouth.position.set(0, 0.60, 0.20);
    mouth.scaling.set(1.4, 0.45, 0.8);
    if (darkMat) mouth.material = darkMat;
    parts.push(mouth);

    for (const fangSide of [-1, 1]) {
      const fang = MeshBuilder.CreateCylinder(`cr_fang_${fangSide === 1 ? 'r' : 'l'}`, { height: 0.055, diameterTop: 0.005, diameterBottom: 0.025, tessellation: 8 }, this.scene);
      fang.position.set(fangSide * 0.045, 0.57, 0.21);
      fang.rotation.x = Math.PI;
      if (whiteMat) fang.material = whiteMat;
      parts.push(fang);
    }

    // 7. Bat Wings on the back
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const wingArm = MeshBuilder.CreateTube(`cr_wingarm_${sName}`, {
        path: [
          new Vector3(side * 0.08, 0.70, -0.16),
          new Vector3(side * 0.22, 0.78, -0.22),
          new Vector3(side * 0.30, 0.72, -0.25),
        ],
        radius: 0.016,
        tessellation: 10,
        cap: Mesh.CAP_ALL,
      }, this.scene);
      if (skinMat) wingArm.material = skinMat;
      parts.push(wingArm);

      const wingMembrane = MeshBuilder.CreatePlane(`cr_wingmem_${sName}`, { width: 0.18, height: 0.14 }, this.scene);
      wingMembrane.position.set(side * 0.20, 0.70, -0.22);
      wingMembrane.rotation.y = side * 0.3;
      wingMembrane.rotation.z = side * -0.2;
      if (skinMat) wingMembrane.material = skinMat;
      parts.push(wingMembrane);
    }

    // 8. Floating Dark Halo
    const halo = MeshBuilder.CreateTorus('cr_halo', { diameter: 0.24, thickness: 0.02, tessellation: 24 }, this.scene);
    halo.position.set(0, 1.10, -0.02);
    halo.rotation.x = 0.25;
    if (darkMat) halo.material = darkMat;
    parts.push(halo);

    // 9. Trident / Pitchfork held in Left Hand
    const staff = MeshBuilder.CreateCylinder('cr_trident_staff', { height: 0.55, diameter: 0.018, tessellation: 10 }, this.scene);
    staff.position.set(0.38, 0.26, 0.24);
    staff.rotation.x = Math.PI / 3;
    staff.rotation.z = -Math.PI / 6;
    if (darkMat) staff.material = darkMat;
    parts.push(staff);

    // Merge meshes preserving MultiMaterial if colored
    const baseMesh = Mesh.MergeMeshes(parts, true, true, undefined, true, materialStyle === 'colored');
    if (!baseMesh) {
      throw new Error('Failed to merge organic creature base mesh components.');
    }

    baseMesh.name = rootName;
    baseMesh.id = `mesh_${Date.now()}_creature`;
    if (scale !== 1.0) {
      baseMesh.scaling.set(scale, scale, scale);
    }
    if (options.position) {
      baseMesh.position.copyFrom(options.position);
    }

    if (materialStyle === 'clay' || !baseMesh.material) {
      this.applyDefaultCharacterMaterial(baseMesh);
    }

    this.service.addMesh(baseMesh);
    this.service.selectMesh(baseMesh);

    return baseMesh;
  }

  /**
   * Spawns an Animal / Quadruped Base Mesh with realistic joint mechanics (Digitigrade or Unguligrade).
   */
  public spawnQuadrupedBaseMesh(options: BaseMeshSpawnOptions & { locomotion?: 'digitigrade' | 'unguligrade' } = {}): Mesh {
    const rootName = options.name || 'Quadruped_BaseMesh';
    const locomotion = options.locomotion || 'digitigrade';
    const parts: Mesh[] = [];

    // 1. Ribcage Barrel (Brustkorb: Z-axis aligned)
    const ribcage = MeshBuilder.CreateCylinder('q_ribcage', { height: 0.60, diameterTop: 0.42, diameterBottom: 0.38, tessellation: 16 }, this.scene);
    ribcage.rotation.x = Math.PI / 2;
    ribcage.position.set(0, 0.75, 0.15);
    parts.push(ribcage);

    // 2. Hindquarters & Pelvis (Hüfte/Kruppe)
    const hindquarters = MeshBuilder.CreateCylinder('q_hind', { height: 0.45, diameterTop: 0.36, diameterBottom: 0.34, tessellation: 16 }, this.scene);
    hindquarters.rotation.x = Math.PI / 2;
    hindquarters.position.set(0, 0.72, -0.32);
    parts.push(hindquarters);

    // 3. Neck (Angled forward 45 deg)
    const neck = MeshBuilder.CreateCylinder('q_neck', { height: 0.35, diameterTop: 0.20, diameterBottom: 0.28, tessellation: 14 }, this.scene);
    neck.rotation.x = -Math.PI / 4;
    neck.position.set(0, 0.95, 0.48);
    parts.push(neck);

    // 4. Cranium & Snout (Kopf mit Schnauze)
    const cranium = MeshBuilder.CreateSphere('q_cranium', { diameterX: 0.22, diameterY: 0.20, diameterZ: 0.24, segments: 14 }, this.scene);
    cranium.position.set(0, 1.10, 0.65);
    parts.push(cranium);

    const snout = MeshBuilder.CreateBox('q_snout', { width: 0.13, height: 0.12, depth: 0.20 }, this.scene);
    snout.position.set(0, 1.05, 0.82);
    parts.push(snout);

    // 5. Forelegs (Front legs: Scapula, Arm, Forearm, Paw)
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const fx = side * 0.18;

      const scapula = MeshBuilder.CreateCylinder(`q_scap_${sName}`, { height: 0.28, diameter: 0.14, tessellation: 12 }, this.scene);
      scapula.rotation.x = Math.PI / 6;
      scapula.position.set(fx, 0.65, 0.32);
      parts.push(scapula);

      const foreleg = MeshBuilder.CreateCylinder(`q_fleg_${sName}`, { height: 0.38, diameter: 0.08, tessellation: 12 }, this.scene);
      foreleg.position.set(fx, 0.32, 0.35);
      parts.push(foreleg);

      const paw = MeshBuilder.CreateBox(`q_fpaw_${sName}`, { width: 0.09, height: 0.06, depth: 0.12 }, this.scene);
      paw.position.set(fx, 0.03, 0.38);
      parts.push(paw);
    }

    // 6. Hind Legs (Back legs: Femur forward, Tibia back, Hock/Heel elevated)
    const hockHeight = locomotion === 'digitigrade' ? 0.26 : 0.40;
    for (const side of [-1, 1]) {
      const sName = side === 1 ? 'r' : 'l';
      const hx = side * 0.17;

      // Femur (Oberschenkel angled forward)
      const femur = MeshBuilder.CreateCylinder(`q_femur_${sName}`, { height: 0.35, diameter: 0.16, tessellation: 14 }, this.scene);
      femur.rotation.x = -Math.PI / 6;
      femur.position.set(hx, 0.58, -0.28);
      parts.push(femur);

      // Stifle / Knee
      const stifle = MeshBuilder.CreateSphere(`q_stifle_${sName}`, { diameter: 0.13, segments: 12 }, this.scene);
      stifle.position.set(hx, 0.44, -0.20);
      parts.push(stifle);

      // Tibia / Shin (Angled backward towards hock)
      const tibia = MeshBuilder.CreateCylinder(`q_tibia_${sName}`, { height: 0.32, diameter: 0.10, tessellation: 12 }, this.scene);
      tibia.rotation.x = Math.PI / 5;
      tibia.position.set(hx, (0.44 + hockHeight) / 2, -0.30);
      parts.push(tibia);

      // Hock (Sprunggelenk elevated off ground)
      const hock = MeshBuilder.CreateSphere(`q_hock_${sName}`, { diameter: 0.09, segments: 12 }, this.scene);
      hock.position.set(hx, hockHeight, -0.40);
      parts.push(hock);

      // Metatarsus / Paw
      const metatarsus = MeshBuilder.CreateCylinder(`q_meta_${sName}`, { height: hockHeight, diameter: 0.07, tessellation: 12 }, this.scene);
      metatarsus.position.set(hx, hockHeight / 2, -0.38);
      parts.push(metatarsus);

      const backPaw = MeshBuilder.CreateBox(`q_bpaw_${sName}`, { width: 0.09, height: 0.05, depth: 0.12 }, this.scene);
      backPaw.position.set(hx, 0.025, -0.36);
      parts.push(backPaw);
    }

    // 7. Tail
    const tail = MeshBuilder.CreateCylinder('q_tail', { height: 0.45, diameterTop: 0.08, diameterBottom: 0.04, tessellation: 10 }, this.scene);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.65, -0.62);
    parts.push(tail);

    const baseMesh = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!baseMesh) {
      throw new Error('Failed to merge quadruped base mesh components.');
    }

    baseMesh.name = rootName;
    baseMesh.id = `mesh_${Date.now()}_quadruped`;
    this.applyDefaultCharacterMaterial(baseMesh);
    this.service.addMesh(baseMesh);
    this.service.selectMesh(baseMesh);

    return baseMesh;
  }

  /**
   * Spawns a Head & Facial Bust Mannequin with eye sockets and jaw planes.
   */
  public spawnHeadBust(options: BaseMeshSpawnOptions = {}): Mesh {
    const rootName = options.name || 'HeadBust_BaseMesh';
    const parts: Mesh[] = [];

    // Cranium
    const cranium = MeshBuilder.CreateSphere('hb_cranium', { diameterX: 0.40, diameterY: 0.48, diameterZ: 0.46, segments: 24 }, this.scene);
    cranium.position.set(0, 1.25, -0.02);
    parts.push(cranium);

    // Facial Wedge (Wangen & Kiefer)
    const jaw = MeshBuilder.CreateCylinder('hb_jaw', { height: 0.32, diameterTop: 0.38, diameterBottom: 0.22, tessellation: 18 }, this.scene);
    jaw.position.set(0, 1.05, 0.08);
    parts.push(jaw);

    // Nose Bridge
    const nose = MeshBuilder.CreateBox('hb_nose', { width: 0.08, height: 0.14, depth: 0.10 }, this.scene);
    nose.position.set(0, 1.22, 0.24);
    nose.rotation.x = 0.2;
    parts.push(nose);

    // Neck
    const neck = MeshBuilder.CreateCylinder('hb_neck', { height: 0.40, diameter: 0.24, tessellation: 18 }, this.scene);
    neck.position.set(0, 0.85, 0);
    parts.push(neck);

    // Pedestal Plate
    const base = MeshBuilder.CreateCylinder('hb_base', { height: 0.10, diameter: 0.55, tessellation: 24 }, this.scene);
    base.position.set(0, 0.60, 0);
    parts.push(base);

    const baseMesh = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    if (!baseMesh) {
      throw new Error('Failed to merge head bust base mesh.');
    }

    baseMesh.name = rootName;
    baseMesh.id = `mesh_${Date.now()}_bust`;
    this.applyDefaultCharacterMaterial(baseMesh);
    this.service.addMesh(baseMesh);
    this.service.selectMesh(baseMesh);

    return baseMesh;
  }

  /**
   * Spawns a dense, high-resolution digital clay sphere for freeform sculpting.
   */
  public spawnSculptSphere(options: BaseMeshSpawnOptions = {}): Mesh {
    const rootName = options.name || 'Sculpt_Sphere';
    const sphere = MeshBuilder.CreateSphere(
      rootName,
      { diameter: 1.5, segments: options.subdivisions || 36 },
      this.scene
    );
    sphere.position.set(0, 0.75, 0);
    sphere.id = `mesh_${Date.now()}_sculpt_sphere`;

    this.applyDefaultCharacterMaterial(sphere);
    this.service.addMesh(sphere);
    this.service.selectMesh(sphere);

    return sphere;
  }

  private applyDefaultCharacterMaterial(mesh: Mesh): void {
    const pbr = new PBRMaterial(`${mesh.name}_ClayMat`, this.scene);
    pbr.albedoColor = new Color3(0.82, 0.76, 0.70); // Sculptor clay tone
    pbr.roughness = 0.75;
    pbr.metallic = 0.05;
    pbr.backFaceCulling = false;
    mesh.material = pbr;
  }

  /* =========================================================================
     GAME-READY RETOPOLOGY & MESH SIMPLIFICATION
     ========================================================================= */

  /**
   * Retopologizes a sculpted high-poly mesh to a target game polygon budget
   * using Quadric Error Metric decimation and normal smoothing.
   */
  public async retopologizeMesh(mesh: Mesh, targetFaces: number): Promise<TopologyAnalysis> {
    const currentFaces = mesh.getTotalIndices() > 0 ? mesh.getTotalIndices() / 3 : 0;
    if (currentFaces <= 0) {
      throw new Error('Mesh has no triangles to retopologize.');
    }

    const preSnapshot = VertexData.ExtractFromMesh(mesh);

    if (currentFaces > targetFaces) {
      const ratio = targetFaces / currentFaces;
      await ModelCompressor.simplifyMesh(mesh, ratio);
    }

    // Ensure normal vectors are recalculated smoothly across new topology
    const vd = VertexData.ExtractFromMesh(mesh);
    if (vd.positions && vd.indices) {
      vd.normals = [];
      VertexData.ComputeNormals(vd.positions, vd.indices, vd.normals);
      vd.applyToMesh(mesh, true);
    }

    mesh.refreshBoundingInfo();
    const postSnapshot = VertexData.ExtractFromMesh(mesh);

    this.service.recordAction({
      name: `Retopologize (${Math.round(currentFaces)} to ${Math.round(mesh.getTotalIndices() / 3)} faces)`,
      undo: () => {
        if (!mesh.isDisposed()) {
          preSnapshot.applyToMesh(mesh, true);
          mesh.refreshBoundingInfo();
          this.service.updateStats();
          this.onMeshModified?.(mesh);
        }
      },
      redo: () => {
        if (!mesh.isDisposed()) {
          postSnapshot.applyToMesh(mesh, true);
          mesh.refreshBoundingInfo();
          this.service.updateStats();
          this.onMeshModified?.(mesh);
        }
      },
    });

    this.service.updateStats();
    this.onMeshModified?.(mesh);

    return this.analyzeTopology(mesh);
  }

  /**
   * Evaluates vertex counts, triangle counts, and game engine readiness classification.
   */
  public analyzeTopology(mesh: Mesh): TopologyAnalysis {
    const vertexCount = mesh.getTotalVertices();
    const triangleCount = mesh.getTotalIndices() > 0 ? mesh.getTotalIndices() / 3 : 0;
    const vd = VertexData.ExtractFromMesh(mesh);
    const hasUVs = !!(vd.uvs && vd.uvs.length >= vertexCount * 2);

    let gameReadiness: TopologyAnalysis['gameReadiness'] = 'Standard Game Ready';
    let gameReadinessClass: TopologyAnalysis['gameReadinessClass'] = 'success';

    if (triangleCount <= 6000) {
      gameReadiness = 'Mobile / WebGL Ready';
      gameReadinessClass = 'success';
    } else if (triangleCount <= 28000) {
      gameReadiness = 'Standard Game Ready';
      gameReadinessClass = 'success';
    } else if (triangleCount <= 60000) {
      gameReadiness = 'Hero Asset';
      gameReadinessClass = 'warning';
    } else {
      gameReadiness = 'High-Poly Sculpt';
      gameReadinessClass = 'danger';
    }

    return {
      vertexCount,
      triangleCount,
      isManifold: true,
      hasUVs,
      gameReadiness,
      gameReadinessClass,
    };
  }

  public dispose(): void {
    this.setActive(false);
    if (this.cursorRing) {
      this.cursorRing.dispose();
      this.cursorRing = null;
    }
    if (this.symCursorRing) {
      this.symCursorRing.dispose();
      this.symCursorRing = null;
    }
  }
}
