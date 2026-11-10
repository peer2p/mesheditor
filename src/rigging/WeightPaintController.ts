import {
  Bone,
  Color3,
  FloatArray,
  LinesMesh,
  Matrix,
  Mesh,
  MeshBuilder,
  Node,
  Nullable,
  PointerEventTypes,
  PointerInfo,
  Quaternion,
  Scene,
  Skeleton,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { MeshEditorService } from '../MeshEditorService';

export type WeightBrushMode = 'add' | 'subtract' | 'smooth' | 'replace';
export type AutoRigPreset = 'humanoid' | 'chibi' | 'quadruped' | 'spine_chain';

export interface BoneNodeSpec {
  name: string;
  parentIndex: number; // -1 for root
  headWorldPos: Vector3;
  tailWorldPos: Vector3;
}

export interface WeightStats {
  meshName: string;
  hasSkeleton: boolean;
  boneCount: number;
  activeBoneName: string;
  activeBoneIndex: number;
  influencedVertexCount: number;
  averageActiveWeight: number;
}

/**
 * Controller for Skeleton Auto-Rigging, Envelope Skinning, Interactive 3D Weight Painting,
 * Weight Heatmap Visualization, and Real-Time Bone Pose Testing.
 */
export class WeightPaintController {
  public service: MeshEditorService;
  public scene: Scene;

  public isActive: boolean = false;
  public brushMode: WeightBrushMode = 'add';
  public radius: number = 0.35;
  public strength: number = 0.5;
  public targetWeight: number = 1.0;
  public symmetryX: boolean = true;
  public showHeatmap: boolean = true;
  public showBoneOverlay: boolean = true;
  public activeBoneIndex: number = 0;

  private isPainting: boolean = false;
  private activeMesh: Nullable<Mesh> = null;
  private strokePreStates: Map<Mesh, { indices: number[]; weights: number[] }> = new Map();

  private cursorRing: Nullable<Mesh> = null;
  public boneOverlayMesh: Nullable<LinesMesh> = null;
  public activeBoneMarker: Nullable<Mesh> = null;

  private originalColorsMap: Map<Mesh, Nullable<number[]>> = new Map();
  private originalVertexColorFlag: Map<Mesh, boolean> = new Map();
  private originalMaterialMap: Map<Mesh, any> = new Map();
  private heatmapMaterial: Nullable<StandardMaterial> = null;

  public onStateChanged?: (isActive: boolean) => void;
  public onWeightsModified?: (mesh: Mesh, stats: WeightStats) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
    this.scene = service.scene;
    this.initCursor();
    this.initPointerHandling();
  }

  private initCursor(): void {
    if (this.cursorRing) return;
    this.cursorRing = MeshBuilder.CreateDisc(
      'editor_weight_paint_cursor',
      { radius: this.radius, tessellation: 36 },
      this.scene
    );
    const mat = new StandardMaterial('editor_weight_paint_cursor_mat', this.scene);
    mat.diffuseColor = new Color3(1.0, 0.55, 0.15);
    mat.emissiveColor = new Color3(1.0, 0.55, 0.15);
    mat.wireframe = true;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    this.cursorRing.material = mat;
    this.cursorRing.isPickable = false;
    this.cursorRing.isVisible = false;
  }

  public setRadius(newRadius: number): void {
    this.radius = Math.max(0.02, Math.min(newRadius, 3.0));
    const scale = this.radius / 0.35;
    if (this.cursorRing && !this.cursorRing.isDisposed()) {
      this.cursorRing.scaling.set(scale, scale, scale);
    }
  }

  public setStrength(newStrength: number): void {
    this.strength = Math.max(0.02, Math.min(newStrength, 1.0));
  }

  public setBrushMode(mode: WeightBrushMode): void {
    this.brushMode = mode;
  }

  public setActiveBoneIndex(index: number): void {
    this.activeBoneIndex = Math.max(0, index);
    const mesh = this.getActiveTargetMesh();
    if (mesh) {
      const targets = this.getTargetMeshes(mesh);
      if (this.showHeatmap && this.isActive) {
        for (const t of targets) {
          this.updateWeightHeatmap(t);
        }
      }
      if (this.showBoneOverlay && this.isActive) {
        this.refreshBoneOverlay(mesh);
      }
      this.onWeightsModified?.(mesh, this.analyzeWeights(mesh));
    }
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (this.cursorRing) this.cursorRing.isVisible = false;

    const canvas = this.service.canvas;
    if (canvas) {
      canvas.style.cursor = active ? 'crosshair' : 'default';
    }

    const mesh = this.getActiveTargetMesh();
    const targets = this.getTargetMeshes(mesh);

    if (active) {
      if (this.service.sculptController?.isActive) {
        this.service.sculptController.setActive(false);
      }
      if (this.service.voxelPainter?.isActive) {
        this.service.voxelPainter.setActive(false);
      }
      if (this.service.pathExtrusion?.isActive) {
        this.service.pathExtrusion.setActive(false);
      }
      if ((this.service as any).uvUnwrapController?.isActive) {
        (this.service as any).uvUnwrapController.setActive(false);
      }
      this.service.gizmoManager?.attachToNode(null);
      if (this.service.highlightLayer) {
        this.service.highlightLayer.removeAllMeshes();
      }
      for (const t of targets) {
        if (this.showHeatmap) this.updateWeightHeatmap(t);
      }
      if (mesh && this.showBoneOverlay) this.refreshBoneOverlay(mesh);
    } else {
      if (this.isPainting) {
        this.endPaintStroke();
      }
      const meshesToRestore = new Set<Mesh>([
        ...targets,
        ...this.originalColorsMap.keys(),
        ...this.originalMaterialMap.keys(),
      ]);
      for (const m of meshesToRestore) {
        if (!m.isDisposed()) this.restoreOriginalVertexColors(m);
      }
      this.clearBoneOverlay();
      if (this.service.selectedMesh && !this.service.isGizmoMesh(this.service.selectedMesh)) {
        this.service.gizmoManager?.attachToNode(this.service.selectedMesh);
      }
    }

    this.onStateChanged?.(active);
  }

  public getActiveTargetMesh(): Nullable<Mesh> {
    if (
      this.service.selectedMesh &&
      !this.service.isEditorHelper(this.service.selectedMesh) &&
      !this.service.selectedMesh.isDisposed() &&
      this.service.selectedMesh.getTotalVertices() > 0
    ) {
      return this.service.selectedMesh;
    }
    const first = this.service.importedMeshes.find(
      (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && m.getTotalVertices() > 0
    );
    return first || null;
  }

  /**
   * Returns all meshes in the scene that share the same skeleton or character group as `primaryMesh`.
   * Essential for multi-part models (e.g. Mario cap, head, body, hands, boots) so heatmaps,
   * bone influence stats, and weight painting operate simultaneously across the entire character!
   */
  public getTargetMeshes(primaryMesh?: Nullable<Mesh>): Mesh[] {
    const root = primaryMesh || this.getActiveTargetMesh();
    if (!root || root.isDisposed()) return [];

    const scene = root.getScene() || this.scene;
    if (root.skeleton) {
      const skel = root.skeleton;
      const skinnedMeshes = scene.meshes.filter(
        (m): m is Mesh =>
          m instanceof Mesh &&
          !m.isDisposed() &&
          !this.service.isEditorHelper(m) &&
          !this.service.isGizmoMesh(m) &&
          m !== this.service.gridMesh &&
          m.skeleton === skel &&
          m.getTotalVertices() > 0
      );
      if (skinnedMeshes.length > 0) return skinnedMeshes;
    }

    if (this.service.selectedNodes.length > 1) {
      const selected = this.service.selectedNodes.filter(
        (m): m is Mesh =>
          m instanceof Mesh &&
          !m.isDisposed() &&
          !this.service.isEditorHelper(m) &&
          !this.service.isGizmoMesh(m) &&
          m.getTotalVertices() > 0
      );
      if (selected.includes(root)) return selected;
    }

    if (root.parent) {
      const siblings = (root.parent.getChildMeshes() || []).filter(
        (m): m is Mesh =>
          m instanceof Mesh &&
          !m.isDisposed() &&
          !this.service.isEditorHelper(m) &&
          !this.service.isGizmoMesh(m) &&
          m !== this.service.gridMesh &&
          m.getTotalVertices() > 0
      );
      if (siblings.length > 1) return siblings;
    }

    const visibleMeshes = this.service.importedMeshes.filter(
      (m) =>
        m instanceof Mesh &&
        !this.service.isEditorHelper(m) &&
        !this.service.isGizmoMesh(m) &&
        !m.isDisposed() &&
        m.isVisible &&
        m.getTotalVertices() > 0
    );
    if (visibleMeshes.length > 1 && visibleMeshes.includes(root)) {
      return visibleMeshes;
    }

    return [root];
  }

  /**
   * Generates a complete hierarchical game-ready Skeleton fitted to `mesh`'s bounding box
   * and binds smooth capsule envelope weights (4 bone influences per vertex).
   */
  public createAutoRig(mesh: Mesh, preset: AutoRigPreset = 'humanoid'): Skeleton {
    const targets = this.getTargetMeshes(mesh);
    let minW = new Vector3(Infinity, Infinity, Infinity);
    let maxW = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const t of targets) {
      t.computeWorldMatrix(true);
      t.refreshBoundingInfo();
      const b = t.getBoundingInfo().boundingBox;
      minW = Vector3.Minimize(minW, b.minimumWorld);
      maxW = Vector3.Maximize(maxW, b.maximumWorld);
    }

    const width = Math.max(0.2, maxW.x - minW.x);
    const height = Math.max(0.2, maxW.y - minW.y);
    const depth = Math.max(0.2, maxW.z - minW.z);
    const cx = (minW.x + maxW.x) * 0.5;
    const cz = (minW.z + maxW.z) * 0.5;
    const bottomY = minW.y;

    const specs: BoneNodeSpec[] = [];

    const addBone = (
      name: string,
      parentName: string | null,
      hx: number,
      hy: number,
      hz: number,
      tx: number,
      ty: number,
      tz: number
    ) => {
      const parentIndex = parentName ? specs.findIndex((s) => s.name === parentName) : -1;
      specs.push({
        name,
        parentIndex,
        headWorldPos: new Vector3(cx + hx * width * 0.5, bottomY + hy * height, cz + hz * depth * 0.5),
        tailWorldPos: new Vector3(cx + tx * width * 0.5, bottomY + ty * height, cz + tz * depth * 0.5),
      });
    };

    if (preset === 'humanoid') {
      // 20-Bone Unreal / Unity Standard Humanoid Skeleton Hierarchy
      addBone('Root', null, 0, 0.0, 0, 0, 0.48, 0);
      addBone('Hips', 'Root', 0, 0.48, 0, 0, 0.56, 0);
      addBone('Spine', 'Hips', 0, 0.56, 0, 0, 0.68, 0);
      addBone('Chest', 'Spine', 0, 0.68, 0, 0, 0.80, 0);
      addBone('Neck', 'Chest', 0, 0.80, 0, 0, 0.86, 0);
      addBone('Head', 'Neck', 0, 0.86, 0, 0, 0.99, 0);

      // Left Arm
      addBone('Shoulder_L', 'Chest', 0.08, 0.78, 0, 0.24, 0.78, 0);
      addBone('UpperArm_L', 'Shoulder_L', 0.24, 0.78, 0, 0.55, 0.76, 0);
      addBone('ForeArm_L', 'UpperArm_L', 0.55, 0.76, 0, 0.82, 0.75, 0);
      addBone('Hand_L', 'ForeArm_L', 0.82, 0.75, 0, 0.96, 0.75, 0);

      // Right Arm
      addBone('Shoulder_R', 'Chest', -0.08, 0.78, 0, -0.24, 0.78, 0);
      addBone('UpperArm_R', 'Shoulder_R', -0.24, 0.78, 0, -0.55, 0.76, 0);
      addBone('ForeArm_R', 'UpperArm_R', -0.55, 0.76, 0, -0.82, 0.75, 0);
      addBone('Hand_R', 'ForeArm_R', -0.82, 0.75, 0, -0.96, 0.75, 0);

      // Left Leg
      addBone('UpLeg_L', 'Hips', 0.18, 0.48, 0, 0.19, 0.26, 0);
      addBone('Leg_L', 'UpLeg_L', 0.19, 0.26, 0, 0.19, 0.05, 0);
      addBone('Foot_L', 'Leg_L', 0.19, 0.05, 0, 0.19, 0.01, 0.25);

      // Right Leg
      addBone('UpLeg_R', 'Hips', -0.18, 0.48, 0, -0.19, 0.26, 0);
      addBone('Leg_R', 'UpLeg_R', -0.19, 0.26, 0, -0.19, 0.05, 0);
      addBone('Foot_R', 'Leg_R', -0.19, 0.05, 0, -0.19, 0.01, 0.25);
    } else if (preset === 'chibi') {
      // 20-Bone Chibi / Cartoon / Stylized Biped (Large Head, Low Shoulder/Arm Axis, Short Legs)
      // Perfectly proportioned for Mario, mascot figures, dwarfs & stylized heroes
      addBone('Root', null, 0, 0.0, 0, 0, 0.36, 0);
      addBone('Hips', 'Root', 0, 0.36, 0, 0, 0.44, 0);
      addBone('Spine', 'Hips', 0, 0.44, 0, 0, 0.52, 0);
      addBone('Chest', 'Spine', 0, 0.52, 0, 0, 0.59, 0);
      addBone('Neck', 'Chest', 0, 0.59, 0, 0, 0.65, 0);
      addBone('Head', 'Neck', 0, 0.65, 0, 0, 0.99, 0);

      // Left Arm (horizontal line through sleeves at ~0.58-0.59)
      addBone('Shoulder_L', 'Chest', 0.08, 0.59, 0, 0.22, 0.58, 0);
      addBone('UpperArm_L', 'Shoulder_L', 0.22, 0.58, 0, 0.52, 0.58, 0);
      addBone('ForeArm_L', 'UpperArm_L', 0.52, 0.58, 0, 0.78, 0.57, 0);
      addBone('Hand_L', 'ForeArm_L', 0.78, 0.57, 0, 0.95, 0.57, 0);

      // Right Arm
      addBone('Shoulder_R', 'Chest', -0.08, 0.59, 0, -0.22, 0.58, 0);
      addBone('UpperArm_R', 'Shoulder_R', -0.22, 0.58, 0, -0.52, 0.58, 0);
      addBone('ForeArm_R', 'UpperArm_R', -0.52, 0.58, 0, -0.78, 0.57, 0);
      addBone('Hand_R', 'ForeArm_R', -0.78, 0.57, 0, -0.95, 0.57, 0);

      // Left Leg
      addBone('UpLeg_L', 'Hips', 0.18, 0.36, 0, 0.19, 0.20, 0);
      addBone('Leg_L', 'UpLeg_L', 0.19, 0.20, 0, 0.19, 0.05, 0);
      addBone('Foot_L', 'Leg_L', 0.19, 0.05, 0, 0.19, 0.01, 0.25);

      // Right Leg
      addBone('UpLeg_R', 'Hips', -0.18, 0.36, 0, -0.19, 0.20, 0);
      addBone('Leg_R', 'UpLeg_R', -0.19, 0.20, 0, -0.19, 0.05, 0);
      addBone('Foot_R', 'Leg_R', -0.19, 0.05, 0, -0.19, 0.01, 0.25);
    } else if (preset === 'quadruped') {
      addBone('Root', null, 0, 0.0, 0, 0, 0.55, -0.4);
      addBone('Pelvis', 'Root', 0, 0.55, -0.4, 0, 0.58, -0.1);
      addBone('Spine1', 'Pelvis', 0, 0.58, -0.1, 0, 0.60, 0.25);
      addBone('Chest', 'Spine1', 0, 0.60, 0.25, 0, 0.64, 0.55);
      addBone('Neck', 'Chest', 0, 0.64, 0.55, 0, 0.78, 0.75);
      addBone('Head', 'Neck', 0, 0.78, 0.75, 0, 0.82, 0.96);
      addBone('Tail', 'Pelvis', 0, 0.55, -0.4, 0, 0.45, -0.95);

      // Front & Back Legs
      addBone('FrontLeg_L', 'Chest', 0.35, 0.55, 0.45, 0.35, 0.02, 0.48);
      addBone('FrontLeg_R', 'Chest', -0.35, 0.55, 0.45, -0.35, 0.02, 0.48);
      addBone('BackLeg_L', 'Pelvis', 0.35, 0.55, -0.40, 0.35, 0.02, -0.42);
      addBone('BackLeg_R', 'Pelvis', -0.35, 0.55, -0.40, -0.35, 0.02, -0.42);
    } else {
      // 5-Bone Articulated Spine / Prop Chain
      addBone('Root', null, 0, 0.0, 0, 0, 0.2, 0);
      addBone('Segment_1', 'Root', 0, 0.2, 0, 0, 0.45, 0);
      addBone('Segment_2', 'Segment_1', 0, 0.45, 0, 0, 0.7, 0);
      addBone('Segment_3', 'Segment_2', 0, 0.7, 0, 0, 0.9, 0);
      addBone('Tip', 'Segment_3', 0, 0.9, 0, 0, 1.0, 0);
    }

    const skeleton = new Skeleton(`${mesh.name}_Skeleton`, `${mesh.name}_skel_id`, this.scene);
    const createdBones: Bone[] = [];
    const createdNodes: TransformNode[] = [];

    const rootParent = mesh.parent as Nullable<Node>;
    let invParentMat: Nullable<Matrix> = null;
    if (rootParent && 'getWorldMatrix' in rootParent) {
      (rootParent as any).computeWorldMatrix(true);
      invParentMat = Matrix.Invert((rootParent as any).getWorldMatrix());
    }

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const parentBone = spec.parentIndex >= 0 ? createdBones[spec.parentIndex] : null;
      const parentNode =
        spec.parentIndex >= 0 ? createdNodes[spec.parentIndex] : rootParent;
      const localOffset =
        spec.parentIndex >= 0
          ? spec.headWorldPos.subtract(specs[spec.parentIndex].headWorldPos)
          : invParentMat
          ? Vector3.TransformCoordinates(spec.headWorldPos, invParentMat)
          : spec.headWorldPos.clone();
      const localMat = Matrix.Translation(localOffset.x, localOffset.y, localOffset.z);
      const bone = new Bone(spec.name, skeleton, parentBone, localMat, localMat.clone());

      const tNode = new TransformNode(spec.name, this.scene);
      if (parentNode) {
        tNode.parent = parentNode;
      }
      tNode.position.copyFrom(localOffset);
      tNode.metadata = { isBoneNode: true, skeletonId: skeleton.id };
      bone.linkTransformNode(tNode);

      createdBones.push(bone);
      createdNodes.push(tNode);
    }

    const serializedSpecs = specs.map((s) => ({
      name: s.name,
      parentIndex: s.parentIndex,
      head: [s.headWorldPos.x, s.headWorldPos.y, s.headWorldPos.z],
      tail: [s.tailWorldPos.x, s.tailWorldPos.y, s.tailWorldPos.z],
      rotationDeg: [0, 0, 0],
    }));

    for (const t of targets) {
      t.skeleton = skeleton;
      if (!t.metadata) t.metadata = {};
      t.metadata.rigBoneSpecs = serializedSpecs;
      const rawPos = t.getVerticesData(VertexBuffer.PositionKind);
      if (rawPos) {
        t.metadata.bindPosePositions = Array.from(rawPos);
      }
    }

    this.autoBindSkinWeights(mesh, skeleton);
    this.activeBoneIndex = Math.min(1, specs.length - 1);

    if (this.isActive) {
      for (const t of targets) {
        if (this.showHeatmap) this.updateWeightHeatmap(t);
      }
      if (this.showBoneOverlay) this.refreshBoneOverlay(mesh);
    }

    this.onWeightsModified?.(mesh, this.analyzeWeights(mesh));
    return skeleton;
  }

  /**
   * Computes automatic smooth envelope skin weights (4 influences per vertex, normalized to 1.0)
   * across all target meshes sharing `mesh`'s character skeleton.
   */
  public autoBindSkinWeights(mesh: Mesh, skeleton?: Nullable<Skeleton>): void {
    const targets = this.getTargetMeshes(mesh);
    const skel = skeleton || mesh.skeleton;
    for (const t of targets) {
      this.bindSingleMeshSkinWeights(t, t.skeleton || skel);
    }
  }

  /**
   * Binds skin weights to an individual mesh based on distance from world-space vertices
   * to bone capsule segments.
   */
  public bindSingleMeshSkinWeights(mesh: Mesh, skeleton?: Nullable<Skeleton>): void {
    const skel = skeleton || mesh.skeleton;
    if (!skel) return;

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const specs = this.getBoneSegments(mesh, skel);
    if (specs.length === 0) return;

    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();

    const numVerts = Math.floor(positions.length / 3);
    const matrixIndices = new Float32Array(numVerts * 4);
    const matrixWeights = new Float32Array(numVerts * 4);

    const vLocal = new Vector3();
    const vPos = new Vector3();
    for (let i = 0; i < numVerts; i++) {
      vLocal.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      Vector3.TransformCoordinatesToRef(vLocal, worldMat, vPos);

      // Calculate inverse-distance-fourth weights to all bones
      const influences: Array<{ boneIdx: number; weight: number }> = [];
      for (let b = 0; b < specs.length; b++) {
        const seg = specs[b];
        const dist = this.distancePointToSegment(vPos, seg.headWorldPos, seg.tailWorldPos);
        const w = 1.0 / Math.pow(dist + 0.04, 3.2);
        influences.push({ boneIdx: b, weight: w });
      }

      // Sort descending and pick top 4 bone influences
      influences.sort((a, b) => b.weight - a.weight);
      const top4 = influences.slice(0, 4);
      while (top4.length < 4) {
        top4.push({ boneIdx: 0, weight: 0 });
      }

      const sum = top4[0].weight + top4[1].weight + top4[2].weight + top4[3].weight || 1;
      for (let k = 0; k < 4; k++) {
        matrixIndices[i * 4 + k] = top4[k].boneIdx;
        matrixWeights[i * 4 + k] = top4[k].weight / sum;
      }
    }

    this.setMeshMatrixIndices(mesh, matrixIndices);
    mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, matrixWeights, true);

    if (this.isActive && this.showHeatmap) {
      this.updateWeightHeatmap(mesh);
    }
  }

  public getBoneSegments(mesh: Mesh, skeleton?: Nullable<Skeleton>): BoneNodeSpec[] {
    const skel = skeleton || mesh.skeleton;
    if (!skel) return [];

    if (Array.isArray(mesh.metadata?.rigBoneSpecs) && mesh.metadata.rigBoneSpecs.length === skel.bones.length) {
      return mesh.metadata.rigBoneSpecs.map((s: any) => ({
        name: s.name,
        parentIndex: s.parentIndex,
        headWorldPos: new Vector3(s.head[0], s.head[1], s.head[2]),
        tailWorldPos: new Vector3(s.tail[0], s.tail[1], s.tail[2]),
      }));
    }

    // Check if any sibling mesh sharing this skeleton has stored rigBoneSpecs
    const scene = mesh.getScene() || this.scene;
    const siblingWithSpecs = scene.meshes.find(
      (m): m is Mesh =>
        m instanceof Mesh &&
        m.skeleton === skel &&
        Array.isArray(m.metadata?.rigBoneSpecs) &&
        m.metadata.rigBoneSpecs.length === skel.bones.length
    );
    if (siblingWithSpecs) {
      return siblingWithSpecs.metadata.rigBoneSpecs.map((s: any) => ({
        name: s.name,
        parentIndex: s.parentIndex,
        headWorldPos: new Vector3(s.head[0], s.head[1], s.head[2]),
        tailWorldPos: new Vector3(s.tail[0], s.tail[1], s.tail[2]),
      }));
    }

    // Fallback for imported GLTF skeletons
    const bones = skel.bones;
    const specs: BoneNodeSpec[] = [];
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const pIdx = b.getParent() ? bones.indexOf(b.getParent()!) : -1;
      const tNode = b.getTransformNode();
      const pos = tNode ? tNode.getAbsolutePosition().clone() : b.getAbsolutePosition();
      const child = bones.find((c) => c.getParent() === b);
      const childTNode = child?.getTransformNode();
      const tail = childTNode
        ? childTNode.getAbsolutePosition().clone()
        : child
        ? child.getAbsolutePosition()
        : pos.add(new Vector3(0, 0.15, 0));
      specs.push({
        name: b.name || `Bone_${i}`,
        parentIndex: pIdx,
        headWorldPos: pos.clone(),
        tailWorldPos: tail.clone(),
      });
    }
    return specs;
  }

  private distancePointToSegment(p: Vector3, a: Vector3, b: Vector3): number {
    const ab = b.subtract(a);
    const lenSq = ab.lengthSquared();
    if (lenSq < 1e-10) return Vector3.Distance(p, a);
    const t = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / lenSq));
    const proj = a.add(ab.scale(t));
    return Vector3.Distance(p, proj);
  }

  /**
   * Returns the effective weight [0, 1] of `boneIndex` at vertex `vertexIndex`.
   */
  public getVertexBoneWeight(
    indicesData: FloatArray,
    weightsData: FloatArray,
    vertexIndex: number,
    boneIndex: number
  ): number {
    let total = 0;
    const base = vertexIndex * 4;
    for (let k = 0; k < 4; k++) {
      if (Math.round(indicesData[base + k]) === boneIndex) {
        total += weightsData[base + k];
      }
    }
    return Math.max(0, Math.min(1, total));
  }

  /**
   * Sets the weight of `boneIndex` on vertex `vertexIndex` to `newWeight` and automatically
   * normalizes all 4 bone weights on that vertex so their sum equals 1.0.
   */
  public setVertexBoneWeightNormalized(
    indicesData: Float32Array | number[],
    weightsData: Float32Array | number[],
    vertexIndex: number,
    boneIndex: number,
    newWeight: number
  ): void {
    const clampedTarget = Math.max(0, Math.min(1, newWeight));
    const base = vertexIndex * 4;

    // Collect existing 4 slots
    const slots: Array<{ bone: number; weight: number }> = [];
    let targetSlotIdx = -1;

    for (let k = 0; k < 4; k++) {
      const b = Math.round(indicesData[base + k]);
      const w = Math.max(0, weightsData[base + k]);
      if (b === boneIndex && targetSlotIdx === -1) {
        targetSlotIdx = k;
      }
      slots.push({ bone: b, weight: w });
    }

    if (targetSlotIdx === -1) {
      // Replace the slot with the smallest weight
      let minIdx = 0;
      for (let k = 1; k < 4; k++) {
        if (slots[k].weight < slots[minIdx].weight) {
          minIdx = k;
        }
      }
      targetSlotIdx = minIdx;
      slots[targetSlotIdx].bone = boneIndex;
    }

    slots[targetSlotIdx].weight = clampedTarget;

    // Normalize the remaining 3 slots so total sum = 1.0
    let otherSum = 0;
    for (let k = 0; k < 4; k++) {
      if (k !== targetSlotIdx) otherSum += slots[k].weight;
    }

    const remainder = Math.max(0, 1.0 - clampedTarget);
    if (otherSum > 1e-6) {
      const scale = remainder / otherSum;
      for (let k = 0; k < 4; k++) {
        if (k !== targetSlotIdx) {
          slots[k].weight *= scale;
        }
      }
    } else if (remainder > 1e-6) {
      // Assign remaining weight to root bone (0) or another slot
      const fallbackSlot = targetSlotIdx === 0 ? 1 : 0;
      if (slots[fallbackSlot].bone === boneIndex) {
        slots[fallbackSlot].bone = boneIndex === 0 ? 1 : 0;
      }
      slots[fallbackSlot].weight = remainder;
    }

    for (let k = 0; k < 4; k++) {
      indicesData[base + k] = slots[k].bone;
      weightsData[base + k] = slots[k].weight;
    }
  }

  /**
   * Applies a 3D Weight Paint brush stroke (Add, Subtract, Smooth, or Replace) at `worldHitPoint`.
   * Automatically targets all parts of the character sharing the skeleton so painting seamlessly
   * deforms vertices across mesh seams without borders.
   */
  public applyWeightBrushStroke(
    mesh: Mesh,
    worldHitPoint: Vector3,
    boneIndex: number = this.activeBoneIndex
  ): number {
    const targets = this.getTargetMeshes(mesh);
    let totalModified = 0;

    for (const target of targets) {
      totalModified += this.paintSingleMesh(target, worldHitPoint, boneIndex);
    }

    if (this.showHeatmap) {
      for (const target of targets) {
        this.updateSingleMeshHeatmap(target, boneIndex);
      }
    }

    this.onWeightsModified?.(mesh, this.analyzeWeights(mesh));
    return totalModified;
  }

  private paintSingleMesh(
    mesh: Mesh,
    worldHitPoint: Vector3,
    boneIndex: number
  ): number {
    if (!mesh.skeleton) {
      const skel = this.getActiveTargetMesh()?.skeleton;
      if (skel) mesh.skeleton = skel;
      else this.createAutoRig(mesh, 'humanoid');
    }

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    let mIndices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
    let mWeights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!positions) return 0;

    if (!mIndices || !mWeights) {
      this.bindSingleMeshSkinWeights(mesh, mesh.skeleton);
      mIndices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
      mWeights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    }
    if (!mIndices || !mWeights) return 0;

    const indicesArr = new Float32Array(mIndices);
    const weightsArr = new Float32Array(mWeights);

    mesh.computeWorldMatrix(true);
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const localHit = Vector3.TransformCoordinates(worldHitPoint, invWorld);

    const row0 = mesh.getWorldMatrix().getRow(0);
    const worldScale = row0 ? Math.max(0.001, Math.sqrt(row0.x * row0.x + row0.y * row0.y + row0.z * row0.z)) : 1.0;
    const localRadius = this.radius / worldScale;
    const localRadiusSq = localRadius * localRadius;

    // Quick bounding box check: if localHit is far outside this mesh's bounding box, skip it
    const bbox = mesh.getBoundingInfo().boundingBox;
    if (
      localHit.x < bbox.minimum.x - localRadius ||
      localHit.x > bbox.maximum.x + localRadius ||
      localHit.y < bbox.minimum.y - localRadius ||
      localHit.y > bbox.maximum.y + localRadius ||
      localHit.z < bbox.minimum.z - localRadius ||
      localHit.z > bbox.maximum.z + localRadius
    ) {
      return 0;
    }

    // Identify mirrored bone index if symmetryX is enabled (e.g. UpperArm_L <-> UpperArm_R)
    let mirrorBoneIndex = boneIndex;
    if (this.symmetryX && mesh.skeleton) {
      const activeBoneName = mesh.skeleton.bones[boneIndex]?.name || '';
      let mirrorName = '';
      if (activeBoneName.endsWith('_L')) {
        mirrorName = activeBoneName.slice(0, -2) + '_R';
      } else if (activeBoneName.endsWith('_R')) {
        mirrorName = activeBoneName.slice(0, -2) + '_L';
      }
      if (mirrorName) {
        const foundIdx = mesh.skeleton.bones.findIndex((b) => b.name === mirrorName);
        if (foundIdx !== -1) mirrorBoneIndex = foundIdx;
      }
    }

    const numVerts = Math.floor(positions.length / 3);
    let modifiedCount = 0;

    const paintAroundLocalPoint = (center: Vector3, targetBone: number) => {
      // Precompute average weight in brush radius if mode === 'smooth'
      let avgBrushWeight = 0;
      let inRadiusCount = 0;

      if (this.brushMode === 'smooth') {
        for (let i = 0; i < numVerts; i++) {
          const dx = positions[i * 3] - center.x;
          const dy = positions[i * 3 + 1] - center.y;
          const dz = positions[i * 3 + 2] - center.z;
          if (dx * dx + dy * dy + dz * dz <= localRadiusSq) {
            avgBrushWeight += this.getVertexBoneWeight(indicesArr, weightsArr, i, targetBone);
            inRadiusCount++;
          }
        }
        if (inRadiusCount > 0) avgBrushWeight /= inRadiusCount;
      }

      for (let i = 0; i < numVerts; i++) {
        const dx = positions[i * 3] - center.x;
        const dy = positions[i * 3 + 1] - center.y;
        const dz = positions[i * 3 + 2] - center.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > localRadiusSq) continue;

        const dist = Math.sqrt(distSq);
        const falloff = 0.5 * (1.0 + Math.cos((dist / localRadius) * Math.PI));
        const currW = this.getVertexBoneWeight(indicesArr, weightsArr, i, targetBone);

        let nextW = currW;
        const delta = Math.min(1.0, this.strength * falloff * 0.8);

        if (this.brushMode === 'add') {
          nextW = Math.min(1.0, currW + delta);
        } else if (this.brushMode === 'subtract') {
          nextW = Math.max(0.0, currW - delta);
        } else if (this.brushMode === 'replace') {
          nextW = currW + (this.targetWeight - currW) * Math.min(1.0, this.strength * falloff);
        } else if (this.brushMode === 'smooth') {
          nextW = currW + (avgBrushWeight - currW) * Math.min(1.0, this.strength * falloff * 0.75);
        }

        this.setVertexBoneWeightNormalized(indicesArr, weightsArr, i, targetBone, nextW);
        modifiedCount++;
      }
    };

    paintAroundLocalPoint(localHit, boneIndex);

    if (this.symmetryX && Math.abs(localHit.x) > 0.02) {
      const symLocalHit = new Vector3(-localHit.x, localHit.y, localHit.z);
      paintAroundLocalPoint(symLocalHit, mirrorBoneIndex);
    }

    if (modifiedCount > 0) {
      this.setMeshMatrixIndices(mesh, indicesArr);
      mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, weightsArr, true);
    }

    return modifiedCount;
  }

  public getOrCreateHeatmapMaterial(targetScene: Scene = this.scene): StandardMaterial {
    if (targetScene !== this.scene) {
      const mat = new StandardMaterial('editor_weight_heatmap_mat', targetScene);
      mat.disableLighting = true;
      mat.emissiveColor = new Color3(1, 1, 1);
      mat.diffuseColor = new Color3(1, 1, 1);
      mat.backFaceCulling = false;
      return mat;
    }
    if (!this.heatmapMaterial || (this.heatmapMaterial as any)._isDisposed) {
      this.heatmapMaterial = new StandardMaterial('editor_weight_heatmap_mat', this.scene);
      this.heatmapMaterial.disableLighting = true;
      this.heatmapMaterial.emissiveColor = new Color3(1, 1, 1);
      this.heatmapMaterial.diffuseColor = new Color3(1, 1, 1);
      this.heatmapMaterial.backFaceCulling = false;
    }
    return this.heatmapMaterial;
  }

  /**
   * Updates the real-time Vertex Color Weight Heatmap (Blue 0.0 -> Cyan -> Green -> Yellow -> Red 1.0)
   * on all target meshes for `activeBoneIndex`.
   */
  public updateWeightHeatmap(mesh?: Mesh, boneIndex: number = this.activeBoneIndex): void {
    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      this.updateSingleMeshHeatmap(t, boneIndex);
    }
  }

  private updateSingleMeshHeatmap(mesh: Mesh, boneIndex: number): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const mIndices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const mWeights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!positions) return;

    if (!this.originalColorsMap.has(mesh)) {
      const existingColors = mesh.getVerticesData(VertexBuffer.ColorKind);
      this.originalColorsMap.set(mesh, existingColors ? Array.from(existingColors) : null);
      this.originalVertexColorFlag.set(mesh, mesh.useVertexColors);
    }

    if (!this.originalMaterialMap.has(mesh) && mesh.material) {
      this.originalMaterialMap.set(mesh, mesh.material);
    }

    // Switch to pure unlit vertex color heatmap material so dark textures never turn black
    mesh.material = this.getOrCreateHeatmapMaterial(mesh.getScene() || this.scene);

    // Remove selection highlight glow so it does not drown out the heatmap colors with bright blue
    if (this.service.highlightLayer) {
      this.service.highlightLayer.removeMesh(mesh);
    }

    const numVerts = Math.floor(positions.length / 3);
    const colors = new Float32Array(numVerts * 4);

    for (let i = 0; i < numVerts; i++) {
      const w =
        mIndices && mWeights
          ? this.getVertexBoneWeight(mIndices, mWeights, i, boneIndex)
          : 0;
      const [r, g, b] = this.weightToHeatmapRGB(w);
      colors[i * 4] = r;
      colors[i * 4 + 1] = g;
      colors[i * 4 + 2] = b;
      colors[i * 4 + 3] = 1.0;
    }

    mesh.setVerticesData(VertexBuffer.ColorKind, colors, true);
    mesh.useVertexColors = true;
  }

  public restoreOriginalVertexColors(mesh?: Mesh): void {
    const targets = mesh ? this.getTargetMeshes(mesh) : Array.from(this.originalMaterialMap.keys());
    for (const t of targets) {
      this.restoreSingleMeshVertexColors(t);
    }
  }

  private restoreSingleMeshVertexColors(mesh: Mesh): void {
    if (this.originalMaterialMap.has(mesh)) {
      mesh.material = this.originalMaterialMap.get(mesh);
      this.originalMaterialMap.delete(mesh);
    }

    if (this.originalColorsMap.has(mesh)) {
      const orig = this.originalColorsMap.get(mesh);
      const origFlag = this.originalVertexColorFlag.get(mesh) ?? false;
      if (orig) {
        mesh.setVerticesData(VertexBuffer.ColorKind, orig, true);
      } else {
        mesh.removeVerticesData(VertexBuffer.ColorKind);
      }
      mesh.useVertexColors = origFlag;
      this.originalColorsMap.delete(mesh);
      this.originalVertexColorFlag.delete(mesh);
    }

    if (this.service.selectedMesh === mesh && this.service.highlightLayer && !this.isActive) {
      this.service.highlightLayer.addMesh(mesh, new Color3(0.2, 0.6, 1.0));
    }
  }

  private weightToHeatmapRGB(w: number): [number, number, number] {
    const t = Math.max(0, Math.min(1, w));
    if (t < 0.25) {
      const k = t / 0.25;
      return [0.08 * (1 - k) + 0.05 * k, 0.20 * (1 - k) + 0.78 * k, 0.85 * (1 - k) + 0.92 * k];
    } else if (t < 0.5) {
      const k = (t - 0.25) / 0.25;
      return [0.05 * (1 - k) + 0.15 * k, 0.78 * (1 - k) + 0.88 * k, 0.92 * (1 - k) + 0.20 * k];
    } else if (t < 0.75) {
      const k = (t - 0.5) / 0.25;
      return [0.15 * (1 - k) + 0.96 * k, 0.88 * (1 - k) + 0.86 * k, 0.20 * (1 - k) + 0.08 * k];
    } else {
      const k = (t - 0.75) / 0.25;
      return [0.96 * (1 - k) + 0.96 * k, 0.86 * (1 - k) + 0.14 * k, 0.08 * (1 - k) + 0.10 * k];
    }
  }

  /**
   * Rotates the active bone (and its descendant bone chain) by `(pitchDeg, yawDeg, rollDeg)` and
   * deforms all target character meshes using Linear Blend Skinning (LBS) so the artist can test joint deformation!
   */
  public poseActiveBone(
    mesh: Mesh,
    pitchDeg: number,
    yawDeg: number = 0,
    rollDeg: number = 0
  ): void {
    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      this.poseSingleMeshActiveBone(t, pitchDeg, yawDeg, rollDeg);
    }
  }

  private poseSingleMeshActiveBone(
    mesh: Mesh,
    pitchDeg: number,
    yawDeg: number = 0,
    rollDeg: number = 0
  ): void {
    if (!mesh.skeleton) return;
    const specs = this.getBoneSegments(mesh, mesh.skeleton);
    if (specs.length === 0 || this.activeBoneIndex >= specs.length) return;

    const rawPos = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!rawPos) return;
    if (!mesh.metadata) mesh.metadata = {};
    if (!mesh.metadata.bindPosePositions || mesh.metadata.bindPosePositions.length !== rawPos.length) {
      mesh.metadata.bindPosePositions = Array.from(rawPos);
    }

    const bindPos: number[] = mesh.metadata.bindPosePositions;
    const mIndices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const mWeights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!mIndices || !mWeights) return;

    // Find all descendant bones of activeBoneIndex (including activeBoneIndex itself)
    const affectedBones = new Set<number>([this.activeBoneIndex]);
    let added = true;
    while (added) {
      added = false;
      for (let i = 0; i < specs.length; i++) {
        if (!affectedBones.has(i) && specs[i].parentIndex >= 0 && affectedBones.has(specs[i].parentIndex)) {
          affectedBones.add(i);
          added = true;
        }
      }
    }

    mesh.computeWorldMatrix(true);
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const pivot = Vector3.TransformCoordinates(specs[this.activeBoneIndex].headWorldPos, invWorld);

    const quat = Quaternion.FromEulerAngles(
      (pitchDeg * Math.PI) / 180,
      (yawDeg * Math.PI) / 180,
      (rollDeg * Math.PI) / 180
    );
    const rotMat = new Matrix();
    quat.toRotationMatrix(rotMat);

    const numVerts = Math.floor(bindPos.length / 3);
    const deformed = new Float32Array(bindPos.length);
    const pOrig = new Vector3();
    const pRot = new Vector3();

    for (let i = 0; i < numVerts; i++) {
      pOrig.set(bindPos[i * 3], bindPos[i * 3 + 1], bindPos[i * 3 + 2]);

      let affectedWeight = 0;
      const base = i * 4;
      for (let k = 0; k < 4; k++) {
        const bIdx = Math.round(mIndices[base + k]);
        if (affectedBones.has(bIdx)) {
          affectedWeight += mWeights[base + k];
        }
      }

      if (affectedWeight <= 1e-5) {
        deformed[i * 3] = pOrig.x;
        deformed[i * 3 + 1] = pOrig.y;
        deformed[i * 3 + 2] = pOrig.z;
      } else {
        const rel = pOrig.subtract(pivot);
        Vector3.TransformCoordinatesToRef(rel, rotMat, pRot);
        pRot.addInPlace(pivot);
        const blended = Vector3.Lerp(pOrig, pRot, Math.min(1, affectedWeight));
        deformed[i * 3] = blended.x;
        deformed[i * 3 + 1] = blended.y;
        deformed[i * 3 + 2] = blended.z;
      }
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, deformed, true);
    const indices = mesh.getIndices();
    if (indices) {
      const norms: number[] = [];
      VertexData.ComputeNormals(deformed, indices, norms);
      mesh.setVerticesData(VertexBuffer.NormalKind, norms, true);
    }
    mesh.refreshBoundingInfo();
  }

  /**
   * Restores all target character meshes back to clean Bind Pose (T-Pose / rest pose).
   */
  public resetBindPose(mesh: Mesh): void {
    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      this.resetSingleMeshBindPose(t);
    }
  }

  private resetSingleMeshBindPose(mesh: Mesh): void {
    const bindPos: number[] | undefined = mesh.metadata?.bindPosePositions;
    if (!bindPos) return;

    mesh.setVerticesData(VertexBuffer.PositionKind, bindPos.slice(), true);
    const indices = mesh.getIndices();
    if (indices) {
      const norms: number[] = [];
      VertexData.ComputeNormals(bindPos, indices, norms);
      mesh.setVerticesData(VertexBuffer.NormalKind, norms, true);
    }
    mesh.refreshBoundingInfo();
  }

  /**
   * Dynamically adjusts the heights of the arms/shoulders and hips/legs across the skeleton
   * and automatically re-binds envelope skin weights so the rig matches any stylized character!
   */
  public adjustBoneHeights(mesh: Mesh, armRatio: number, hipRatio: number): void {
    if (!mesh || !mesh.skeleton) return;
    const specs = this.getBoneSegments(mesh, mesh.skeleton);
    if (specs.length === 0) return;

    const targets = this.getTargetMeshes(mesh);
    let minW = new Vector3(Infinity, Infinity, Infinity);
    let maxW = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const t of targets) {
      t.computeWorldMatrix(true);
      t.refreshBoundingInfo();
      const b = t.getBoundingInfo().boundingBox;
      minW = Vector3.Minimize(minW, b.minimumWorld);
      maxW = Vector3.Maximize(maxW, b.maximumWorld);
    }
    const height = Math.max(0.2, maxW.y - minW.y);
    const bottomY = minW.y;

    const armY = bottomY + armRatio * height;
    const hipY = bottomY + hipRatio * height;
    const chestY = bottomY + (hipRatio + (armRatio - hipRatio) * 0.75) * height;
    const neckY = bottomY + Math.min(0.95, armRatio + 0.06) * height;

    for (const s of specs) {
      if (s.name.includes('Arm') || s.name.includes('Shoulder') || s.name.includes('Hand')) {
        s.headWorldPos.y = armY;
        s.tailWorldPos.y = armY;
      } else if (s.name === 'Chest') {
        s.headWorldPos.y = chestY;
        s.tailWorldPos.y = armY;
      } else if (s.name === 'Neck') {
        s.headWorldPos.y = armY;
        s.tailWorldPos.y = neckY;
      } else if (s.name === 'Head') {
        s.headWorldPos.y = neckY;
      } else if (s.name === 'Hips') {
        s.headWorldPos.y = hipY;
        s.tailWorldPos.y = chestY;
      } else if (s.name === 'Root') {
        s.tailWorldPos.y = hipY;
      } else if (s.name.includes('UpLeg')) {
        s.headWorldPos.y = hipY;
        s.tailWorldPos.y = bottomY + hipRatio * 0.5 * height;
      } else if (s.name.includes('Leg_')) {
        s.headWorldPos.y = bottomY + hipRatio * 0.5 * height;
      }
    }

    this.syncBonesWithSpecs(mesh, specs);

    if (this.showBoneOverlay) {
      this.refreshBoneOverlay(mesh);
    }

    for (const t of targets) {
      this.bindSingleMeshSkinWeights(t, t.skeleton || mesh.skeleton);
      if (this.showHeatmap && this.isActive) {
        this.updateSingleMeshHeatmap(t, this.activeBoneIndex);
      }
    }
    this.onWeightsModified?.(mesh, this.analyzeWeights(mesh));
  }

  /**
   * Nudges the active joint/bone position by a world delta vector and recalculates weights.
   */
  public nudgeActiveBone(mesh: Mesh, delta: Vector3): void {
    if (!mesh || !mesh.skeleton) return;
    const specs = this.getBoneSegments(mesh, mesh.skeleton);
    const idx = Math.min(this.activeBoneIndex, specs.length - 1);
    if (!specs[idx]) return;

    specs[idx].headWorldPos.addInPlace(delta);
    specs[idx].tailWorldPos.addInPlace(delta);

    this.syncBonesWithSpecs(mesh, specs);

    if (this.showBoneOverlay) {
      this.refreshBoneOverlay(mesh);
    }

    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      this.bindSingleMeshSkinWeights(t, t.skeleton || mesh.skeleton);
      if (this.showHeatmap && this.isActive) {
        this.updateSingleMeshHeatmap(t, this.activeBoneIndex);
      }
    }
    this.onWeightsModified?.(mesh, this.analyzeWeights(mesh));
  }

  /**
   * Synchronizes bone local matrices and linked TransformNodes with updated specs.
   */
  public syncBonesWithSpecs(mesh: Mesh, customSpecs?: BoneNodeSpec[]): void {
    if (!mesh || !mesh.skeleton) return;
    const specs = customSpecs || this.getBoneSegments(mesh, mesh.skeleton);
    const bones = mesh.skeleton.bones;
    const rootParent = mesh.parent as Nullable<Node>;
    let invParentMat: Nullable<Matrix> = null;
    if (rootParent && 'getWorldMatrix' in rootParent) {
      (rootParent as any).computeWorldMatrix(true);
      invParentMat = Matrix.Invert((rootParent as any).getWorldMatrix());
    }

    for (let i = 0; i < specs.length && i < bones.length; i++) {
      const spec = specs[i];
      const bone = bones[i];
      const pIdx = spec.parentIndex;
      const headPos = spec.headWorldPos;
      const parentHeadPos =
        pIdx >= 0 && specs[pIdx]
          ? specs[pIdx].headWorldPos
          : Vector3.Zero();
      const localOffset =
        pIdx >= 0
          ? headPos.subtract(parentHeadPos)
          : invParentMat
          ? Vector3.TransformCoordinates(headPos, invParentMat)
          : headPos.clone();
      const localMat = Matrix.Translation(localOffset.x, localOffset.y, localOffset.z);
      bone.updateMatrix(localMat);
      bone.getBaseMatrix().copyFrom(localMat);

      let tNode = bone.getTransformNode();
      if (!tNode) {
        const pBone = bone.getParent();
        const pNode = pBone ? pBone.getTransformNode() : rootParent;
        tNode = new TransformNode(spec.name, this.scene);
        if (pNode) tNode.parent = pNode;
        tNode.metadata = { isBoneNode: true, skeletonId: mesh.skeleton.id };
        bone.linkTransformNode(tNode);
      }
      tNode.position.copyFrom(localOffset);
    }

    const serializedSpecs = specs.map((s) => ({
      name: s.name,
      parentIndex: s.parentIndex,
      head: [s.headWorldPos.x, s.headWorldPos.y, s.headWorldPos.z],
      tail: [s.tailWorldPos.x, s.tailWorldPos.y, s.tailWorldPos.z],
      rotationDeg: [0, 0, 0],
    }));

    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      if (!t.metadata) t.metadata = {};
      t.metadata.rigBoneSpecs = serializedSpecs;
    }
  }

  /**
   * Ensures every bone in skeleton has a linked TransformNode so GLTF2Export writes out skins & joints.
   */
  public ensureSkeletonLinkedTransformNodes(skeleton: Skeleton, mesh: Mesh): void {
    for (const bone of skeleton.bones) {
      if (!bone.getTransformNode()) {
        const parentBone = bone.getParent();
        const parentNode = parentBone ? parentBone.getTransformNode() : (mesh.parent as Nullable<Node>);
        const tNode = new TransformNode(bone.name || 'Bone', this.scene);
        if (parentNode) {
          tNode.parent = parentNode;
        }
        tNode.metadata = { isBoneNode: true, skeletonId: skeleton.id };
        const localMat = bone.getLocalMatrix();
        const scaling = new Vector3();
        const rot = new Quaternion();
        const trans = new Vector3();
        localMat.decompose(scaling, rot, trans);
        tNode.position.copyFrom(trans);
        tNode.rotationQuaternion = rot;
        tNode.scaling.copyFrom(scaling);
        bone.linkTransformNode(tNode);
      }
    }
  }

  /**
   * Prepares all meshes in the scene for clean GLTF/GLB/OBJ export by restoring
   * original materials, removing temporary weight heatmap vertex colors,
   * resetting pose tests, and ensuring all bones have linked transform nodes.
   */
  public prepareMeshesForExport(): void {
    // 1. Reset any active pose bend test to bind pose
    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh && mesh.metadata?.bindPosePositions) {
        this.resetBindPose(mesh);
      }
    }

    // 2. Restore all original materials and vertex colors
    const meshesWithHeatmap = new Set<Mesh>([
      ...this.originalMaterialMap.keys(),
      ...this.originalColorsMap.keys(),
    ]);

    for (const mesh of meshesWithHeatmap) {
      if (mesh.isDisposed()) continue;
      this.restoreOriginalVertexColors(mesh);
    }

    // Double check any mesh that might still have heatmap material or temporary colors
    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh) {
        if (mesh.material && mesh.material.name === 'editor_weight_heatmap_mat') {
          if (this.originalMaterialMap.has(mesh)) {
            mesh.material = this.originalMaterialMap.get(mesh);
          } else {
            mesh.material = null;
          }
        }
      }
    }

    // 3. Ensure all skeletons on meshes have linked transform nodes so GLTF2Export writes skins & joints
    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh && mesh.skeleton) {
        this.ensureSkeletonLinkedTransformNodes(mesh.skeleton, mesh);
      }
    }

    // 4. Ensure joint matrices indices are stored as UNSIGNED_BYTE (or UNSIGNED_SHORT) vertex buffers
    // to prevent Babylon GLTF exporter from calculating mismatched byte offsets across submeshes
    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh && mesh.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind)) {
        const vb = mesh.getVertexBuffer(VertexBuffer.MatricesIndicesKind);
        if (vb && vb.type === VertexBuffer.FLOAT) {
          const raw = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
          if (raw) {
            this.setMeshMatrixIndices(mesh, raw);
          }
        }
      }
    }
  }

  /**
   * Sets MatricesIndicesKind as an UNSIGNED_BYTE (or UNSIGNED_SHORT) vertex buffer.
   * Standard glTF requires integer types (UNSIGNED_BYTE / UNSIGNED_SHORT) for JOINTS_0.
   * If stored as floats in Babylon, the glTF serializer converts the buffer to bytes but
   * incorrectly computes submesh accessor byteOffsets using the float byteStride (16),
   * causing bufferView overflow and corrupt GLB files!
   */
  public setMeshMatrixIndices(mesh: Mesh, indices: ArrayLike<number>): void {
    const numIndices = indices.length;
    let maxIdx = 0;
    for (let i = 0; i < numIndices; i++) {
      if (indices[i] > maxIdx) maxIdx = indices[i];
    }

    if (maxIdx < 256) {
      const uint8Arr = indices instanceof Uint8Array ? indices : new Uint8Array(numIndices);
      if (!(indices instanceof Uint8Array)) {
        for (let i = 0; i < numIndices; i++) {
          uint8Arr[i] = Math.round(indices[i]);
        }
      }
      const vb = new VertexBuffer(
        mesh.getEngine(),
        uint8Arr,
        VertexBuffer.MatricesIndicesKind,
        false,
        false,
        4,
        false,
        0,
        4,
        VertexBuffer.UNSIGNED_BYTE
      );
      mesh.setVerticesBuffer(vb);
    } else {
      const uint16Arr = indices instanceof Uint16Array ? indices : new Uint16Array(numIndices);
      if (!(indices instanceof Uint16Array)) {
        for (let i = 0; i < numIndices; i++) {
          uint16Arr[i] = Math.round(indices[i]);
        }
      }
      const vb = new VertexBuffer(
        mesh.getEngine(),
        uint16Arr,
        VertexBuffer.MatricesIndicesKind,
        false,
        false,
        4,
        false,
        0,
        4,
        VertexBuffer.UNSIGNED_SHORT
      );
      mesh.setVerticesBuffer(vb);
    }
  }

  /**
   * Re-activates the weight heatmap and bone overlay after an export completes.
   */
  public restoreMeshesAfterExport(): void {
    const mesh = this.activeMesh || this.getActiveTargetMesh();
    if (this.isActive && mesh && !mesh.isDisposed()) {
      if (this.showHeatmap) {
        this.updateWeightHeatmap(mesh);
      }
      if (this.showBoneOverlay) {
        this.refreshBoneOverlay(mesh);
      }
    }
  }

  /**
   * Renders a 3D bone wireframe overlay and active joint sphere in the viewport.
   */
  public refreshBoneOverlay(mesh: Mesh): void {
    this.clearBoneOverlay();
    if (!mesh || mesh.isDisposed() || !mesh.skeleton) return;

    const specs = this.getBoneSegments(mesh, mesh.skeleton);
    if (specs.length === 0) return;

    const lines: Vector3[][] = [];
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      lines.push([s.headWorldPos.clone(), s.tailWorldPos.clone()]);
    }

    this.boneOverlayMesh = MeshBuilder.CreateLineSystem(
      'editor_rig_bone_helpers',
      { lines },
      this.scene
    );
    this.boneOverlayMesh.color = new Color3(0.25, 0.88, 0.98);
    this.boneOverlayMesh.isPickable = false;
    this.boneOverlayMesh.renderingGroupId = 2;

    const activeSpec = specs[Math.min(this.activeBoneIndex, specs.length - 1)];
    if (activeSpec) {
      this.activeBoneMarker = MeshBuilder.CreateSphere(
        'editor_rig_active_bone_marker',
        { diameter: 0.08, segments: 10 },
        this.scene
      );
      this.activeBoneMarker.position.copyFrom(activeSpec.headWorldPos);
      const mat = new StandardMaterial('editor_rig_active_marker_mat', this.scene);
      mat.emissiveColor = new Color3(1.0, 0.35, 0.1);
      mat.disableLighting = true;
      this.activeBoneMarker.material = mat;
      this.activeBoneMarker.isPickable = false;
      this.activeBoneMarker.renderingGroupId = 2;
    }
  }

  public clearBoneOverlay(): void {
    if (this.boneOverlayMesh) {
      this.boneOverlayMesh.dispose();
      this.boneOverlayMesh = null;
    }
    if (this.activeBoneMarker) {
      if (this.activeBoneMarker.material) this.activeBoneMarker.material.dispose();
      this.activeBoneMarker.dispose();
      this.activeBoneMarker = null;
    }
  }

  public analyzeWeights(primaryMesh?: Nullable<Mesh>): WeightStats {
    const root = primaryMesh || this.getActiveTargetMesh();
    if (!root || root.isDisposed() || !root.skeleton) {
      return {
        meshName: root?.name || 'None',
        hasSkeleton: false,
        boneCount: 0,
        activeBoneName: 'None',
        activeBoneIndex: 0,
        influencedVertexCount: 0,
        averageActiveWeight: 0,
      };
    }

    const targets = this.getTargetMeshes(root);
    const bones = root.skeleton.bones;
    const boneIdx = Math.min(this.activeBoneIndex, Math.max(0, bones.length - 1));
    const activeBoneName = bones[boneIdx]?.name || `Bone_${boneIdx}`;

    let influencedVertexCount = 0;
    let sumWeight = 0;

    for (const m of targets) {
      const mIndices = m.getVerticesData(VertexBuffer.MatricesIndicesKind);
      const mWeights = m.getVerticesData(VertexBuffer.MatricesWeightsKind);
      const numVerts = m.getTotalVertices();

      if (mIndices && mWeights && numVerts > 0) {
        for (let i = 0; i < numVerts; i++) {
          const w = this.getVertexBoneWeight(mIndices, mWeights, i, boneIdx);
          if (w > 0.01) {
            influencedVertexCount++;
            sumWeight += w;
          }
        }
      }
    }

    const meshDisplayName =
      targets.length > 1
        ? `${root.name} (+${targets.length - 1} parts)`
        : root.name;

    return {
      meshName: meshDisplayName,
      hasSkeleton: true,
      boneCount: bones.length,
      activeBoneName,
      activeBoneIndex: boneIdx,
      influencedVertexCount,
      averageActiveWeight:
        influencedVertexCount > 0 ? Math.round((sumWeight / influencedVertexCount) * 100) / 100 : 0,
    };
  }

  private initPointerHandling(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', () => {
        if (this.isActive && this.isPainting) {
          this.endPaintStroke();
        }
      });
    }

    this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      if (!this.isActive) return;
      const evt = pointerInfo.event as MouseEvent;
      const isLeft = evt ? evt.button === 0 : true;

      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (isLeft) this.handlePointerDown(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this.handlePointerMove(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          if (isLeft && this.isPainting) this.endPaintStroke();
          break;
      }
    });
  }

  private handlePointerDown(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;
    if (
      !pick ||
      !pick.hit ||
      !pick.pickedPoint ||
      !(pick.pickedMesh instanceof Mesh) ||
      this.service.isGizmoMesh(pick.pickedMesh) ||
      this.service.isEditorHelper(pick.pickedMesh) ||
      pick.pickedMesh === this.service.gridMesh
    ) {
      return;
    }

    const mesh = pick.pickedMesh;
    this.activeMesh = mesh;
    this.isPainting = true;

    if (this.scene.activeCamera) {
      this.scene.activeCamera.detachControl();
    }

    this.strokePreStates.clear();
    const targets = this.getTargetMeshes(mesh);
    for (const t of targets) {
      const preW = t.getVerticesData(VertexBuffer.MatricesWeightsKind);
      const preI = t.getVerticesData(VertexBuffer.MatricesIndicesKind);
      if (preW && preI) {
        this.strokePreStates.set(t, {
          weights: Array.from(preW),
          indices: Array.from(preI),
        });
      }
    }

    this.applyWeightBrushStroke(mesh, pick.pickedPoint, this.activeBoneIndex);
  }

  private handlePointerMove(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;
    if (
      pick &&
      pick.hit &&
      pick.pickedPoint &&
      pick.pickedMesh instanceof Mesh &&
      !this.service.isGizmoMesh(pick.pickedMesh) &&
      !this.service.isEditorHelper(pick.pickedMesh) &&
      pick.pickedMesh !== this.service.gridMesh
    ) {
      if (this.cursorRing) {
        this.cursorRing.isVisible = true;
        this.cursorRing.position.copyFrom(pick.pickedPoint);
        const normal = pick.getNormal(true) || Vector3.Up();
        this.cursorRing.lookAt(pick.pickedPoint.add(normal));
      }
      if (this.isPainting && this.activeMesh) {
        this.applyWeightBrushStroke(this.activeMesh, pick.pickedPoint, this.activeBoneIndex);
      }
    } else if (this.cursorRing) {
      this.cursorRing.isVisible = false;
    }
  }

  private endPaintStroke(): void {
    this.isPainting = false;
    if (this.scene.activeCamera && this.service.canvas) {
      this.scene.activeCamera.attachControl(this.service.canvas, true);
    }

    const modifiedMeshes: Array<{
      mesh: Mesh;
      preW: number[];
      preI: number[];
      postW: number[];
      postI: number[];
    }> = [];

    for (const [m, pre] of this.strokePreStates.entries()) {
      if (m.isDisposed()) continue;
      const postW = Array.from(m.getVerticesData(VertexBuffer.MatricesWeightsKind) || []);
      const postI = Array.from(m.getVerticesData(VertexBuffer.MatricesIndicesKind) || []);
      let changed = false;
      if (postW.length !== pre.weights.length) {
        changed = true;
      } else {
        for (let i = 0; i < postW.length; i++) {
          if (Math.abs(postW[i] - pre.weights[i]) > 1e-4) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        modifiedMeshes.push({ mesh: m, preW: pre.weights, preI: pre.indices, postW, postI });
      }
    }

    if (modifiedMeshes.length > 0) {
      this.service.recordAction({
        name: `Weight Paint (${modifiedMeshes.map((x) => x.mesh.name).join(', ')})`,
        undo: () => {
          for (const item of modifiedMeshes) {
            if (!item.mesh.isDisposed()) {
              this.setMeshMatrixIndices(item.mesh, item.preI);
              item.mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, item.preW, true);
              if (this.showHeatmap && this.isActive) this.updateWeightHeatmap(item.mesh);
            }
          }
          this.onWeightsModified?.(modifiedMeshes[0].mesh, this.analyzeWeights(modifiedMeshes[0].mesh));
        },
        redo: () => {
          for (const item of modifiedMeshes) {
            if (!item.mesh.isDisposed()) {
              this.setMeshMatrixIndices(item.mesh, item.postI);
              item.mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, item.postW, true);
              if (this.showHeatmap && this.isActive) this.updateWeightHeatmap(item.mesh);
            }
          }
          this.onWeightsModified?.(modifiedMeshes[0].mesh, this.analyzeWeights(modifiedMeshes[0].mesh));
        },
      });
    }

    this.strokePreStates.clear();
    this.activeMesh = null;
  }

  public dispose(): void {
    this.setActive(false);
    this.clearBoneOverlay();
    if (this.cursorRing) {
      if (this.cursorRing.material) this.cursorRing.material.dispose();
      this.cursorRing.dispose();
      this.cursorRing = null;
    }
  }
}
