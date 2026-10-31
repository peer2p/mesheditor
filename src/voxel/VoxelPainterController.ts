import {
  Color3,
  Color4,
  LinesMesh,
  Matrix,
  Mesh,
  MeshBuilder,
  Nullable,
  PickingInfo,
  Plane,
  PointerEventTypes,
  PointerInfo,
  Ray,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  Vector4,
} from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import { CustomVoxelMesher } from './CustomVoxelMesher';
import { TextureAtlasManager } from './TextureAtlasManager';
import { TextureAtlasDefinition, VoxelBlock, VoxelData, VoxelPaletteItem } from './types';

export class VoxelPainterController {
  private service: MeshEditorService;
  private scene: Scene;
  private atlasManager: TextureAtlasManager;

  public isActive: boolean = false;
  public mode: 'paint' | 'erase' | 'pick' = 'paint';
  public voxelSize: number = 1.0;
  public paintIntervalMs: number = 150;

  public blocks: Map<string, VoxelBlock> = new Map();
  public palette: Map<string, VoxelPaletteItem> = new Map();
  public currentPaletteId: string = 'stone';
  public currentAtlasId: string | null = null;

  public get currentAtlas(): TextureAtlasDefinition | null {
    if (!this.currentAtlasId) return null;
    return this.atlasManager.getAtlas(this.currentAtlasId) || null;
  }

  // Live preview meshes
  private baseMeshes: Map<string, Mesh> = new Map();
  private highlightBox: Mesh | null = null;
  private isPointerDown: boolean = false;
  private lastPaintedKey: string | null = null;
  private lastPickInfo: Nullable<PickingInfo> = null;
  private paintTimer: ReturnType<typeof setInterval> | null = null;
  private renderDirty: boolean = false;

  // Listeners
  public onPaletteChanged?: (items: VoxelPaletteItem[]) => void;
  public onBlocksChanged?: (count: number) => void;
  public onModeChanged?: (mode: 'paint' | 'erase' | 'pick') => void;
  public onAtlasChanged?: (atlasId: string | null) => void;

  constructor(service: MeshEditorService, atlasManager: TextureAtlasManager) {
    this.service = service;
    this.scene = service.scene;
    this.atlasManager = atlasManager;

    this.initDefaultPalette();
    this.initHighlightBox();
    this.initPointerHandling();
  }

  /**
   * Initializes default voxel palette with standard terrain/block textures.
   */
  private initDefaultPalette(): void {
    const defaults: VoxelPaletteItem[] = [
      { id: 'stone', name: 'Stone', color: '#888c94' },
      { id: 'dirt', name: 'Dirt', color: '#865439' },
      { id: 'grass', name: 'Grass', color: '#4f8a10' },
      { id: 'sand', name: 'Sand', color: '#d9c077' },
      { id: 'wood', name: 'Wood Planks', color: '#966236' },
      { id: 'brick', name: 'Red Bricks', color: '#a64232' },
      { id: 'water', name: 'Water', color: '#2980b9', isLiquid: true },
      { id: 'glass', name: 'Glass', color: '#aed6f1' },
      { id: 'gold', name: 'Gold Block', color: '#f1c40f' },
      { id: 'obsidian', name: 'Obsidian', color: '#201b2d' },
    ];

    for (const item of defaults) {
      this.palette.set(item.id, item);
    }
  }

  /**
   * Creates cursor highlight wireframe box showing active placement target.
   */
  private initHighlightBox(): void {
    if (this.highlightBox) return;

    this.highlightBox = MeshBuilder.CreateBox('editor_voxel_highlight', { size: 1.0 }, this.scene);
    const mat = new StandardMaterial('editor_mat_voxel_highlight', this.scene);
    mat.wireframe = true;
    mat.emissiveColor = new Color3(1, 0.85, 0.1);
    mat.disableLighting = true;
    this.highlightBox.material = mat;
    this.highlightBox.isPickable = false;
    this.highlightBox.isVisible = false;
    (this.highlightBox as any).metadata = { isEditorHelper: true };
    this.highlightBox.scaling.set(this.voxelSize * 1.02, this.voxelSize * 1.02, this.voxelSize * 1.02);
  }

  private initPointerHandling(): void {
    this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      if (!this.isActive) return;

      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERMOVE:
          this.lastPickInfo = pointerInfo.pickInfo;
          this.handlePointerMove(pointerInfo.pickInfo);
          if (this.isPointerDown) {
            this.performAction(pointerInfo.pickInfo);
          }
          break;

        case PointerEventTypes.POINTERDOWN:
          // Left mouse button only for painting
          if (pointerInfo.event.button === 0) {
            this.isPointerDown = true;
            this.lastPaintedKey = null;
            this.lastPickInfo = pointerInfo.pickInfo;
            this.performAction(pointerInfo.pickInfo);

            if (this.paintTimer) clearInterval(this.paintTimer);
            this.paintTimer = setInterval(() => {
              if (this.isPointerDown) {
                this.lastPaintedKey = null;
                this.performAction(this.lastPickInfo);
              }
            }, this.paintIntervalMs);
          }
          break;

        case PointerEventTypes.POINTERUP:
          if (pointerInfo.event.button === 0) {
            this.isPointerDown = false;
            if (this.paintTimer) {
              clearInterval(this.paintTimer);
              this.paintTimer = null;
            }
          }
          break;
      }
    });

    // Check dirty state on render loop
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.renderDirty) {
        this.updateThinInstances();
      }
    });
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (this.highlightBox) {
      this.highlightBox.isVisible = false;
    }
    const canvas = this.service.canvas;
    if (canvas) {
      canvas.style.cursor = active ? 'crosshair' : 'default';
    }
    if (active) {
      this.scene.constantlyUpdateMeshUnderPointer = true;
      this.service.gizmoManager?.attachToMesh(null);
      this.renderDirty = true;
      this.updateThinInstances();
    } else {
      if (this.paintTimer) {
        clearInterval(this.paintTimer);
        this.paintTimer = null;
      }
      this.isPointerDown = false;
    }
  }

  public setMode(mode: 'paint' | 'erase' | 'pick'): void {
    this.mode = mode;
    if (this.highlightBox && this.highlightBox.material instanceof StandardMaterial) {
      if (mode === 'erase') {
        this.highlightBox.material.emissiveColor = new Color3(1, 0.2, 0.2);
      } else if (mode === 'pick') {
        this.highlightBox.material.emissiveColor = new Color3(0.2, 0.7, 1);
      } else {
        this.highlightBox.material.emissiveColor = new Color3(1, 0.85, 0.1);
      }
    }
    this.onModeChanged?.(mode);
  }

  public setVoxelSize(size: number): void {
    this.voxelSize = Math.max(0.1, size);
    if (this.highlightBox) {
      this.highlightBox.scaling.set(this.voxelSize * 1.02, this.voxelSize * 1.02, this.voxelSize * 1.02);
    }
    this.renderDirty = true;
    this.updateThinInstances();
  }

  public setPaletteItem(paletteId: string): void {
    if (this.palette.has(paletteId)) {
      this.currentPaletteId = paletteId;
    }
  }

  public addPaletteItem(item: VoxelPaletteItem): void {
    this.palette.set(item.id, item);
    this.onPaletteChanged?.(Array.from(this.palette.values()));
  }

  /**
   * Adds an individual/normal texture to the voxel palette and selects it.
   */
  public addTexturePaletteItem(name: string, textureUrl: string, texture?: Texture): VoxelPaletteItem {
    const palId = `tex_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
    const item: VoxelPaletteItem = {
      id: palId,
      name,
      color: '#ffffff',
      textureUrl,
      texture,
    };
    this.palette.set(palId, item);
    this.currentPaletteId = palId;
    this.onPaletteChanged?.(Array.from(this.palette.values()));
    this.renderDirty = true;
    this.updateThinInstances();
    return item;
  }

  /**
   * Applies an active TextureAtlas to the Voxel Painter.
   * Loads all atlas frames into the selectable palette!
   */
  public useTextureAtlas(atlasId: string | null): void {
    this.currentAtlasId = atlasId;

    // Dispose old base meshes so new ones with the atlas texture and UVs are built
    for (const m of this.baseMeshes.values()) {
      m.dispose();
    }
    this.baseMeshes.clear();

    if (!atlasId) {
      this.onAtlasChanged?.(null);
      return;
    }

    const atlas = this.atlasManager.getAtlas(atlasId);
    if (!atlas) return;

    for (const frame of atlas.frames) {
      const palId = `atlas_${atlas.id}_${frame.id}`;
      this.palette.set(palId, {
        id: palId,
        name: frame.name,
        color: '#ffffff',
        atlasId: atlas.id,
        atlasTile: frame,
        textureUrl: frame.thumbnailDataUrl,
      });
    }

    // Default to the first tile of this atlas
    if (atlas.frames.length > 0) {
      this.currentPaletteId = `atlas_${atlas.id}_${atlas.frames[0].id}`;
    }

    this.onAtlasChanged?.(atlas.id);
    this.onPaletteChanged?.(Array.from(this.palette.values()));
    this.renderDirty = true;
    this.updateThinInstances();
  }

  /**
   * Ray-cast slab method to find target voxel intersection.
   */
  public getTargetBlock(
    pickInfo?: Nullable<PickingInfo>,
    isErase: boolean = this.mode === 'erase',
    customRay?: Ray
  ): { x: number; y: number; z: number } | null {
    const ray =
      customRay ||
      (this.scene.activeCamera
        ? this.scene.createPickingRay(
            this.scene.pointerX,
            this.scene.pointerY,
            Matrix.Identity(),
            this.scene.activeCamera
          )
        : null);
    if (!ray) return null;

    let closestT = Infinity;
    let closestBlock: VoxelBlock | null = null;
    let closestNormal: { x: number; y: number; z: number } | null = null;

    // 1. Ray-cast against existing voxel blocks
    for (const block of this.blocks.values()) {
      const hit = this.rayBlockIntersect(ray, block.x, block.y, block.z);
      if (hit !== null && hit.t < closestT && hit.t > 0) {
        closestT = hit.t;
        closestBlock = block;
        closestNormal = hit.normal;
      }
    }

    if (closestBlock && closestNormal) {
      if (isErase || this.mode === 'pick') {
        return { x: closestBlock.x, y: closestBlock.y, z: closestBlock.z };
      }
      return {
        x: closestBlock.x + closestNormal.x,
        y: closestBlock.y + closestNormal.y,
        z: closestBlock.z + closestNormal.z,
      };
    }

    // In erase or pick mode, do not target ground or meshes if no voxel block was intersected
    if (isErase || this.mode === 'pick') {
      return null;
    }

    // 2. Check if ray hits an imported 3D mesh in the scene
    const meshPick = this.scene.pickWithRay(
      ray,
      (m) => !this.service.isEditorHelper(m) && m.isPickable && m.isVisible
    );
    if (meshPick && meshPick.hit && meshPick.pickedPoint) {
      const norm = meshPick.getNormal(true) || Vector3.Up();
      const pt = meshPick.pickedPoint.add(norm.scale(this.voxelSize * 0.5));
      return {
        x: Math.round(pt.x / this.voxelSize),
        y: Math.max(0, Math.round(pt.y / this.voxelSize)),
        z: Math.round(pt.z / this.voxelSize),
      };
    }

    // 3. Fallback: mathematical ground plane at Y = 0
    const groundPlane = Plane.FromPositionAndNormal(new Vector3(0, 0, 0), Vector3.Up());
    const dist = ray.intersectsPlane(groundPlane);
    if (dist !== null && dist > 0 && dist < 500) {
      const pt = ray.origin.add(ray.direction.scale(dist));
      return {
        x: Math.round(pt.x / this.voxelSize),
        y: 0,
        z: Math.round(pt.z / this.voxelSize),
      };
    }

    return null;
  }

  /**
   * Slab ray vs AABB block intersection.
   */
  public rayBlockIntersect(
    ray: Ray,
    bx: number,
    by: number,
    bz: number
  ): { t: number; normal: { x: number; y: number; z: number } } | null {
    const s = this.voxelSize;
    const ox = ray.origin.x;
    const oy = ray.origin.y;
    const oz = ray.origin.z;
    const dx = ray.direction.x;
    const dy = ray.direction.y;
    const dz = ray.direction.z;

    let tmin = -Infinity;
    let tmax = Infinity;
    let normalAxis = 0;
    let normalSign = 1;

    const centers = [bx * s, by * s, bz * s];
    const origins = [ox, oy, oz];
    const dirs = [dx, dy, dz];
    const half = s * 0.5;

    for (let i = 0; i < 3; i++) {
      const o = origins[i];
      const d = dirs[i];
      const b = centers[i];

      if (Math.abs(d) < 1e-10) {
        if (o < b - half || o > b + half) return null;
        continue;
      }

      let t1 = (b - half - o) / d;
      let t2 = (b + half - o) / d;

      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }

      if (t1 > tmin) {
        tmin = t1;
        normalAxis = i;
        normalSign = -Math.sign(d);
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    if (tmax < 0 || tmin < 0) return null;

    const normal = { x: 0, y: 0, z: 0 };
    if (normalAxis === 0) normal.x = normalSign;
    else if (normalAxis === 1) normal.y = normalSign;
    else normal.z = normalSign;

    return { t: tmin, normal };
  }

  private handlePointerMove(pickInfo: Nullable<PickingInfo>): void {
    if (!this.highlightBox) return;

    const isErase = this.mode === 'erase';
    const target = this.getTargetBlock(pickInfo, isErase);
    if (!target) {
      this.highlightBox.isVisible = false;
      return;
    }

    this.highlightBox.position.set(
      target.x * this.voxelSize,
      target.y * this.voxelSize,
      target.z * this.voxelSize
    );
    this.highlightBox.isVisible = true;
  }

  private performAction(pickInfo: Nullable<PickingInfo>): void {
    const isErase = this.mode === 'erase';
    const target = this.getTargetBlock(pickInfo, isErase);
    if (!target) return;

    const key = `${target.x},${target.y},${target.z}`;
    if (key === this.lastPaintedKey) return;
    this.lastPaintedKey = key;

    if (this.mode === 'pick') {
      const block = this.blocks.get(key);
      if (block) {
        this.setPaletteItem(block.paletteId);
        this.setMode('paint');
      }
      return;
    }

    if (!isErase) {
      if (!this.blocks.has(key)) {
        this.blocks.set(key, {
          x: target.x,
          y: target.y,
          z: target.z,
          paletteId: this.currentPaletteId,
        });
        this.renderDirty = true;
        this.onBlocksChanged?.(this.blocks.size);
        this.updateThinInstances();
      }
    } else {
      if (this.blocks.has(key)) {
        this.blocks.delete(key);
        this.renderDirty = true;
        this.onBlocksChanged?.(this.blocks.size);
        this.updateThinInstances();
      }
    }
  }

  public setBlock(x: number, y: number, z: number, paletteId?: string): void {
    const palId = paletteId || this.currentPaletteId;
    const key = `${x},${y},${z}`;
    this.blocks.set(key, { x, y, z, paletteId: palId });
    this.renderDirty = true;
    this.onBlocksChanged?.(this.blocks.size);
    this.updateThinInstances();
  }

  public getBlock(x: number, y: number, z: number): VoxelBlock | undefined {
    return this.blocks.get(`${x},${y},${z}`);
  }

  public removeBlock(x: number, y: number, z: number): boolean {
    const key = `${x},${y},${z}`;
    const deleted = this.blocks.delete(key);
    if (deleted) {
      this.renderDirty = true;
      this.onBlocksChanged?.(this.blocks.size);
      this.updateThinInstances();
    }
    return deleted;
  }

  /**
   * Updates Thin Instances live in the scene for 60fps painting.
   */
  public updateThinInstances(): void {
    this.renderDirty = false;

    // Group blocks by palette
    const grouped = new Map<string, VoxelBlock[]>();
    for (const b of this.blocks.values()) {
      let list = grouped.get(b.paletteId);
      if (!list) {
        list = [];
        grouped.set(b.paletteId, list);
      }
      list.push(b);
    }

    const s = this.voxelSize;

    // Build or update base meshes
    for (const [palId, palItem] of this.palette.entries()) {
      let baseMesh = this.baseMeshes.get(palId);

      if (!baseMesh) {
        let faceUV: Vector4[] | undefined;
        const mat = new StandardMaterial(`editor_vox_mat_${palId}`, this.scene);

        if (palItem.atlasTile && palItem.atlasId) {
          const atlas = this.atlasManager.getAtlas(palItem.atlasId);
          if (atlas) {
            mat.diffuseTexture = atlas.texture;
            mat.emissiveColor = new Color3(0.25, 0.25, 0.25);
            const t = palItem.atlasTile;
            const uvVec = new Vector4(t.uMin, t.vMin, t.uMax, t.vMax);
            faceUV = [uvVec, uvVec, uvVec, uvVec, uvVec, uvVec];
          }
        } else if (palItem.texture) {
          mat.diffuseTexture = palItem.texture;
          mat.emissiveColor = new Color3(0.25, 0.25, 0.25);
        } else if (palItem.textureUrl) {
          mat.diffuseTexture = new Texture(palItem.textureUrl, this.scene);
          mat.emissiveColor = new Color3(0.25, 0.25, 0.25);
        } else {
          mat.diffuseColor = Color3.FromHexString(palItem.color || '#888c94');
          mat.emissiveColor = Color3.FromHexString(palItem.color || '#888c94').scale(0.3);
        }

        mat.specularColor = new Color3(0.1, 0.1, 0.1);
        mat.backFaceCulling = false;

        baseMesh = MeshBuilder.CreateBox(
          `editor_vox_base_${palId}`,
          { size: 1.0, faceUV, wrap: true },
          this.scene
        );
        baseMesh.material = mat;
        baseMesh.isPickable = false;
        baseMesh.isVisible = false;
        (baseMesh as any).metadata = { isEditorHelper: true };

        baseMesh.thinInstanceSetBuffer('matrix', new Float32Array(0), 16, false);
        this.baseMeshes.set(palId, baseMesh);
      }

      baseMesh.scaling.set(1, 1, 1);
      baseMesh.position.set(0, 0, 0);

      const list = grouped.get(palId);
      if (!list || list.length === 0) {
        baseMesh.thinInstanceCount = 0;
        baseMesh.isVisible = false;
        continue;
      }

      baseMesh.isVisible = true;
      const matrixData = new Float32Array(list.length * 16);

      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        matrixData[i * 16 + 0] = s;
        matrixData[i * 16 + 5] = s;
        matrixData[i * 16 + 10] = s;
        matrixData[i * 16 + 15] = 1.0;
        matrixData[i * 16 + 12] = b.x * s;
        matrixData[i * 16 + 13] = b.y * s;
        matrixData[i * 16 + 14] = b.z * s;
      }

      baseMesh.thinInstanceSetBuffer('matrix', matrixData, 16, false);
    }
  }

  /**
   * Bakes the painted voxels into an optimized, editable 3D mesh in the active scene.
   */
  public bakeToMesh(name: string = 'Voxel_Model'): Mesh | null {
    if (this.blocks.size === 0) {
      this.service.events.onToast?.('No voxels to bake. Paint some blocks first!', 'warning');
      return null;
    }

    const blocksArray = Array.from(this.blocks.values());
    const atlas = this.currentAtlasId ? this.atlasManager.getAtlas(this.currentAtlasId) : undefined;

    const mesh = CustomVoxelMesher.build(this.scene, blocksArray, this.palette, {
      voxelSize: this.voxelSize,
      meshName: name,
      atlas,
    });

    if (!mesh) {
      this.service.events.onToast?.('Failed to build voxel mesh geometry.', 'error');
      return null;
    }

    this.service.importedMeshes.push(mesh);
    this.service.centerMeshPivot(mesh);
    this.service.selectMesh(mesh);

    // Register Undo / Redo action
    this.service.recordAction({
      name: `Bake Voxel Mesh "${mesh.name}"`,
      undo: () => {
        const idx = this.service.importedMeshes.indexOf(mesh);
        if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
        mesh.dispose();
        this.service.events.onSceneModified?.();
      },
      redo: () => {
        // Re-build
        const recreated = CustomVoxelMesher.build(this.scene, blocksArray, this.palette, {
          voxelSize: this.voxelSize,
          meshName: name,
          atlas,
        });
        if (recreated) {
          this.service.importedMeshes.push(recreated);
          this.service.selectMesh(recreated);
          this.service.events.onSceneModified?.();
        }
      },
    });

    this.service.events.onToast?.(
      `Successfully baked ${this.blocks.size} voxels into mesh "${mesh.name}" (${mesh.getTotalVertices()} vertices).`,
      'success'
    );
    this.service.events.onSceneModified?.();

    return mesh;
  }

  /**
   * Loads voxel data from RLE runs or standard coordinates (platformia3d compatible).
   */
  public loadVoxelData(data: VoxelData | any): number {
    this.clear();

    const filePalette: string[] = data.palette || [];
    const runs: number[] = data.runs || [];

    if (runs.length > 0) {
      // Parse Run-Length Encoded format
      for (let i = 0; i < runs.length; i += 5) {
        const x = runs[i];
        const startY = runs[i + 1];
        const z = runs[i + 2];
        const len = runs[i + 3];
        const palIdx = runs[i + 4];

        const palId = filePalette[palIdx] || this.currentPaletteId;
        for (let y = startY; y < startY + len; y++) {
          this.blocks.set(`${x},${y},${z}`, { x, y, z, paletteId: palId });
        }
      }
    } else if (Array.isArray(data.voxels)) {
      for (const v of data.voxels) {
        const x = Math.round(Number(v.x) || 0);
        const y = Math.round(Number(v.y) || 0);
        const z = Math.round(Number(v.z) || 0);
        const palId = String(v.palette || v.paletteId || this.currentPaletteId);
        this.blocks.set(`${x},${y},${z}`, { x, y, z, paletteId: palId });
      }
    }

    this.renderDirty = true;
    this.onBlocksChanged?.(this.blocks.size);
    return this.blocks.size;
  }

  /**
   * Exports painted blocks into the platformia3d RLE VoxelData JSON format.
   */
  public exportVoxelData(): VoxelData {
    const usedPalette: string[] = [];
    const paletteMap = new Map<string, number>();

    const allBlocks = Array.from(this.blocks.values());
    allBlocks.sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      if (a.z !== b.z) return a.z - b.z;
      return a.y - b.y;
    });

    const runs: number[] = [];
    let currentRun: { x: number; y: number; z: number; len: number; palIdx: number } | null = null;

    for (const b of allBlocks) {
      if (!paletteMap.has(b.paletteId)) {
        paletteMap.set(b.paletteId, usedPalette.length);
        usedPalette.push(b.paletteId);
      }
      const palIdx = paletteMap.get(b.paletteId)!;

      if (
        currentRun &&
        currentRun.x === b.x &&
        currentRun.z === b.z &&
        currentRun.palIdx === palIdx &&
        currentRun.y + currentRun.len === b.y
      ) {
        currentRun.len++;
      } else {
        if (currentRun) {
          runs.push(currentRun.x, currentRun.y, currentRun.z, currentRun.len, currentRun.palIdx);
        }
        currentRun = { x: b.x, y: b.y, z: b.z, len: 1, palIdx };
      }
    }

    if (currentRun) {
      runs.push(currentRun.x, currentRun.y, currentRun.z, currentRun.len, currentRun.palIdx);
    }

    return {
      version: 1,
      palette: usedPalette,
      runs,
    };
  }

  public clear(): void {
    this.blocks.clear();
    for (const base of this.baseMeshes.values()) {
      base.thinInstanceCount = 0;
      base.isVisible = false;
    }
    this.renderDirty = true;
    this.onBlocksChanged?.(0);
  }

  public dispose(): void {
    this.setActive(false);
    this.clear();
    for (const base of this.baseMeshes.values()) {
      base.dispose();
    }
    this.baseMeshes.clear();
    if (this.highlightBox) {
      this.highlightBox.dispose();
      this.highlightBox = null;
    }
  }
}
