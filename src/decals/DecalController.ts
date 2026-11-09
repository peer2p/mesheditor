import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  PBRMaterial,
  PointerEventTypes,
  PointerInfo,
  Quaternion,
  Ray,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import type { AbstractMesh, Nullable, Observer } from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import { DECAL_ASSET_DATA_URLS } from './decalAssetUrls';

export interface DecalTextureOption {
  id: string;
  name: string;
  url: string;
  category: 'builtin' | 'asset' | 'scene';
  previewDataUrl?: string;
}

export interface DecalPlacementConfig {
  textureUrl: string;
  textureName: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  angle: number; // radians
  opacity: number;
  tintColor: string;
  cullBackFaces: boolean;
  localMode: boolean;
  zOffset: number;
  normalOffset: number;
}

export interface PlaceDecalOptions {
  targetMesh?: Mesh | string;
  position?: [number, number, number];
  normal?: [number, number, number];
  face?: 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';
  textureUrl?: string;
  textureName?: string;
  size?: number | [number, number, number];
  angleDeg?: number;
  opacity?: number;
  tintColor?: string;
  cullBackFaces?: boolean;
  localMode?: boolean;
  mergeImmediately?: boolean;
}

export interface DecalRecord {
  id: string;
  mesh: Mesh;
  targetMeshName: string;
  textureName: string;
  textureUrl: string;
  position: [number, number, number];
  normal: [number, number, number];
  size: [number, number, number];
  angle: number;
}

export const ASSET_DECAL_TEXTURES: DecalTextureOption[] = [
  { id: 'ivy_leaves', name: 'Ivy Leaves', url: DECAL_ASSET_DATA_URLS['decal_ivy_leaves.png'], category: 'asset' },
  { id: 'flowers_colorful_lg', name: 'Colorful Flowers (Large)', url: DECAL_ASSET_DATA_URLS['decal_flowers_colorful_large.png'], category: 'asset' },
  { id: 'flowers_colorful_sm', name: 'Colorful Flowers (Small)', url: DECAL_ASSET_DATA_URLS['decal_flowers_colorful_small.png'], category: 'asset' },
  { id: 'flowers_white_lg', name: 'Wild Flowers (Large)', url: DECAL_ASSET_DATA_URLS['decal_flowers_large.png'], category: 'asset' },
  { id: 'flowers_white_sm', name: 'Wild Flowers (Small)', url: DECAL_ASSET_DATA_URLS['decal_flowers_small.png'], category: 'asset' },
  { id: 'bush', name: 'Foliage Bush', url: DECAL_ASSET_DATA_URLS['decal_bush.png'], category: 'asset' },
  { id: 'vines', name: 'Hanging Vines', url: DECAL_ASSET_DATA_URLS['decal_vines.png'], category: 'asset' },
  { id: 'old_stones', name: 'Old Stones', url: DECAL_ASSET_DATA_URLS['decal_old_stones.png'], category: 'asset' },
  { id: 'stony_path', name: 'Stony Path', url: DECAL_ASSET_DATA_URLS['decal_stony_path.png'], category: 'asset' },
  { id: 'water_puddle', name: 'Water Puddle', url: DECAL_ASSET_DATA_URLS['decal_water_puddle.png'], category: 'asset' },
  { id: 'sand_yellow', name: 'Desert Sand Patch', url: DECAL_ASSET_DATA_URLS['decal_sand_yellow.png'], category: 'asset' },
  { id: 'sand_red', name: 'Red Canyon Dirt', url: DECAL_ASSET_DATA_URLS['decal_sand_red.png'], category: 'asset' },
  { id: 'dust_brown', name: 'Mud & Dust Patch', url: DECAL_ASSET_DATA_URLS['decal_dust_brown.png'], category: 'asset' },
];

export type ProceduralDecalKind =
  | 'bullet_hole'
  | 'cracks'
  | 'rust_stain'
  | 'splatter'
  | 'glowing_rune'
  | 'hazard_stripes'
  | 'rivets_plate'
  | 'star_emblem';

export const PROCEDURAL_DECAL_SPECS: Array<{ id: ProceduralDecalKind; name: string }> = [
  { id: 'bullet_hole', name: 'Bullet Impact & Scorch' },
  { id: 'cracks', name: 'Stone Cracks' },
  { id: 'rust_stain', name: 'Rust & Grime Stain' },
  { id: 'splatter', name: 'Paint / Blood Splatter' },
  { id: 'glowing_rune', name: 'Arcane Rune Seal' },
  { id: 'hazard_stripes', name: 'Hazard Warning Badge' },
  { id: 'rivets_plate', name: 'Riveted Armor Patch' },
  { id: 'star_emblem', name: 'Star Emblem Badge' },
];

const FALLBACK_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export class DecalController {
  private service: MeshEditorService;
  public isActive = false;

  public config: DecalPlacementConfig = {
    textureUrl: '',
    textureName: 'Bullet Impact & Scorch',
    sizeX: 0.6,
    sizeY: 0.6,
    sizeZ: 0.6,
    angle: 0,
    opacity: 1.0,
    tintColor: '#ffffff',
    cullBackFaces: true,
    localMode: true,
    zOffset: -2,
    normalOffset: 0.0012,
  };

  private proceduralTextures: Map<ProceduralDecalKind, string> = new Map();
  private decalMaterialCache: Map<string, PBRMaterial> = new Map();
  private projectorBox: Nullable<Mesh> = null;
  private previewDecal: Nullable<Mesh> = null;
  private previewMaterial: Nullable<StandardMaterial> = null;
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastPickedMesh: Nullable<Mesh> = null;
  private lastPickedPoint: Nullable<Vector3> = null;
  private lastPickedNormal: Nullable<Vector3> = null;
  private rightMouseDownPos: { x: number; y: number } | null = null;
  private decalCounter = 1;

  public onDecalsChanged?: () => void;
  public onConfigChanged?: (config: DecalPlacementConfig) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
    const defaultUrl = this.getOrCreateProceduralDecalUrl('bullet_hole');
    this.config.textureUrl = defaultUrl;
  }

  /**
   * Returns all available decal textures (built-in procedural decals, asset PNG decals, and scene/AI textures).
   */
  public getAvailableTextures(): DecalTextureOption[] {
    const list: DecalTextureOption[] = [];

    // 1. Procedural decals (always available with data URLs)
    for (const spec of PROCEDURAL_DECAL_SPECS) {
      const dataUrl = this.getOrCreateProceduralDecalUrl(spec.id);
      list.push({
        id: `proc_${spec.id}`,
        name: spec.name,
        url: dataUrl,
        category: 'builtin',
        previewDataUrl: dataUrl,
      });
    }

    // 2. Asset PNG decals
    for (const asset of ASSET_DECAL_TEXTURES) {
      list.push({
        ...asset,
        previewDataUrl: asset.url,
      });
    }

    // 3. Embedded / AI-generated scene textures
    const aiHistory = this.service.aiTextureGenerator?.getHistory() || [];
    const seenUrls = new Set<string>();
    for (const item of aiHistory) {
      if (item.albedoDataUrl && !seenUrls.has(item.albedoDataUrl)) {
        seenUrls.add(item.albedoDataUrl);
        list.push({
          id: `ai_${item.id}`,
          name: `[AI] ${item.name}`,
          url: item.albedoDataUrl,
          category: 'scene',
          previewDataUrl: item.albedoDataUrl,
        });
      }
    }

    const sceneTextures = this.service.getEmbeddedTexturesInfo?.() || [];
    for (const tex of sceneTextures) {
      if (tex.url && !seenUrls.has(tex.url) && !tex.isAtlas) {
        seenUrls.add(tex.url);
        list.push({
          id: `scene_${tex.name}`,
          name: `[Scene] ${tex.name}`,
          url: tex.url,
          category: 'scene',
          previewDataUrl: tex.url,
        });
      }
    }

    return list;
  }

  public resolveTextureOption(nameOrIdOrUrl?: string): { url: string; name: string } {
    if (!nameOrIdOrUrl) {
      return { url: this.config.textureUrl, name: this.config.textureName };
    }
    if (nameOrIdOrUrl.startsWith('data:image/') || nameOrIdOrUrl.startsWith('blob:') || nameOrIdOrUrl.includes('/')) {
      const available = this.getAvailableTextures();
      const found = available.find((t) => t.url === nameOrIdOrUrl);
      return { url: nameOrIdOrUrl, name: found ? found.name : 'Custom Decal' };
    }

    const lower = nameOrIdOrUrl.toLowerCase().trim();
    const available = this.getAvailableTextures();
    const match =
      available.find((t) => t.id.toLowerCase() === lower || t.name.toLowerCase() === lower) ||
      available.find((t) => t.id.toLowerCase().includes(lower) || t.name.toLowerCase().includes(lower));

    if (match) {
      return { url: match.url, name: match.name };
    }

    return { url: this.config.textureUrl, name: this.config.textureName };
  }

  public setActive(active: boolean): void {
    if (this.isActive === active) return;
    this.isActive = active;

    if (active) {
      this.createProjectorBox();
      this.attachEvents();
    } else {
      this.detachEvents();
      this.disposePreviewAndProjector();
    }
    this.onConfigChanged?.(this.config);
  }

  public setTexture(url: string, name?: string): void {
    this.config.textureUrl = url;
    if (name) {
      this.config.textureName = name;
    }
    if (this.previewMaterial) {
      this.previewMaterial.dispose();
      this.previewMaterial = null;
    }
    this.onConfigChanged?.(this.config);
  }

  public setUniformSize(size: number): void {
    const clamped = Math.max(0.05, Math.min(20, size));
    this.config.sizeX = clamped;
    this.config.sizeY = clamped;
    this.config.sizeZ = clamped;
    this.onConfigChanged?.(this.config);
  }

  public setAngleDegrees(deg: number): void {
    const normalized = ((deg % 360) + 360) % 360;
    this.config.angle = (normalized * Math.PI) / 180;
    this.onConfigChanged?.(this.config);
  }

  public getAngleDegrees(): number {
    return Math.round(((this.config.angle * 180) / Math.PI) % 360);
  }

  public isDecalMesh(mesh: any): boolean {
    return Boolean(mesh && mesh instanceof Mesh && mesh.metadata && mesh.metadata.isDecalMesh);
  }

  public isDecalHelperMesh(mesh: AbstractMesh): boolean {
    return mesh.name === 'decal_projector_box' || mesh.name === 'decal_preview_mesh';
  }

  /**
   * Lists all currently unmerged decal meshes in the scene.
   */
  public getUnmergedDecals(targetMeshName?: string): Mesh[] {
    return this.service.scene.meshes.filter((m): m is Mesh => {
      if (!this.isDecalMesh(m) || m.isDisposed()) return false;
      if (targetMeshName && m.metadata?.targetMeshName !== targetMeshName) return false;
      return true;
    });
  }

  /**
   * Places a decal onto a target mesh either via explicit coordinates or by projecting onto a face of the mesh.
   */
  public placeDecal(options: PlaceDecalOptions = {}): Mesh {
    const targetMesh = this.resolveTargetMesh(options.targetMesh);
    if (!targetMesh) {
      throw new Error('No valid target mesh found for decal placement. Select or create a mesh first.');
    }

    const resolvedTex = options.textureUrl
      ? this.resolveTextureOption(options.textureUrl)
      : options.textureName
        ? this.resolveTextureOption(options.textureName)
        : { url: this.config.textureUrl, name: this.config.textureName };

    let sizeVec = new Vector3(this.config.sizeX, this.config.sizeY, this.config.sizeZ);
    if (typeof options.size === 'number') {
      const s = Math.max(0.05, options.size);
      sizeVec = new Vector3(s, s, s);
    } else if (Array.isArray(options.size) && options.size.length === 3) {
      sizeVec = new Vector3(
        Math.max(0.05, options.size[0]),
        Math.max(0.05, options.size[1]),
        Math.max(0.05, options.size[2]),
      );
    }

    const angleRad =
      options.angleDeg !== undefined ? (options.angleDeg * Math.PI) / 180 : this.config.angle;
    const opacity = options.opacity ?? this.config.opacity;
    const tintColor = options.tintColor ?? this.config.tintColor;
    const cullBackFaces = options.cullBackFaces ?? this.config.cullBackFaces;
    const localMode = options.localMode ?? this.config.localMode;

    const { position, normal } = this.resolveSurfacePointAndNormal(targetMesh, options);

    const decalName = `decal_${targetMesh.name}_${this.decalCounter++}`;
    const decalMesh = MeshBuilder.CreateDecal(decalName, targetMesh, {
      position,
      normal,
      size: sizeVec,
      angle: angleRad,
      cullBackFaces,
      localMode,
    });

    const mat = this.getOrCreateDecalMaterial(resolvedTex.url, resolvedTex.name, opacity, tintColor);
    decalMesh.material = mat;
    decalMesh.isPickable = true;
    decalMesh.parent = targetMesh;

    decalMesh.metadata = {
      isDecalMesh: true,
      targetMeshName: targetMesh.name,
      decalConfig: {
        textureUrl: resolvedTex.url,
        textureName: resolvedTex.name,
        position: [position.x, position.y, position.z],
        normal: [normal.x, normal.y, normal.z],
        size: [sizeVec.x, sizeVec.y, sizeVec.z],
        angle: angleRad,
        opacity,
        tintColor,
      },
    };

    if (!this.service.importedMeshes.includes(decalMesh)) {
      this.service.importedMeshes.push(decalMesh);
    }

    if (options.mergeImmediately) {
      const merged = this.mergeDecalsIntoMesh(targetMesh, { recordUndo: true });
      this.onDecalsChanged?.();
      this.service.updateStats();
      this.service.events.onSceneModified?.();
      return merged || targetMesh;
    }

    this.service.recordAction({
      name: `Place Decal (${resolvedTex.name})`,
      undo: () => {
        if (!decalMesh.isDisposed()) {
          decalMesh.setEnabled(false);
          const idx = this.service.importedMeshes.indexOf(decalMesh);
          if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
          this.onDecalsChanged?.();
          this.service.updateStats();
          this.service.events.onSceneModified?.();
        }
      },
      redo: () => {
        if (!decalMesh.isDisposed()) {
          decalMesh.setEnabled(true);
          if (!this.service.importedMeshes.includes(decalMesh)) {
            this.service.importedMeshes.push(decalMesh);
          }
          this.onDecalsChanged?.();
          this.service.updateStats();
          this.service.events.onSceneModified?.();
        }
      },
    });

    this.onDecalsChanged?.();
    this.service.updateStats();
    this.service.events.onSceneModified?.();
    return decalMesh;
  }

  /**
   * Deletes a single unmerged decal mesh by name or reference.
   */
  public removeDecal(decalOrName: Mesh | string): boolean {
    const decal =
      typeof decalOrName === 'string'
        ? this.getUnmergedDecals().find((d) => d.name === decalOrName)
        : decalOrName;
    if (!decal || !this.isDecalMesh(decal)) return false;

    const idx = this.service.importedMeshes.indexOf(decal);
    if (idx !== -1) {
      this.service.importedMeshes.splice(idx, 1);
    }
    decal.dispose(false, false);
    this.onDecalsChanged?.();
    this.service.updateStats();
    this.service.events.onSceneModified?.();
    return true;
  }

  /**
   * Removes all unmerged decals from the scene (or from a specific target mesh).
   */
  public clearUnmergedDecals(targetMeshName?: string): number {
    const decals = this.getUnmergedDecals(targetMeshName);
    if (decals.length === 0) return 0;

    for (const d of decals) {
      const idx = this.service.importedMeshes.indexOf(d);
      if (idx !== -1) {
        this.service.importedMeshes.splice(idx, 1);
      }
      d.dispose(false, false);
    }
    this.onDecalsChanged?.();
    this.service.updateStats();
    this.service.events.onSceneModified?.();
    return decals.length;
  }

  /**
   * Permanently merges/fuses all decals attached to a specific target mesh into that mesh.
   * Offsets decal vertices slightly along their vertex normals so exported meshes (GLB/OBJ/STL)
   * render decals cleanly without z-fighting, and preserves materials via MultiMaterial submeshes.
   */
  public mergeDecalsIntoMesh(
    targetMeshOrName?: Mesh | string,
    _options: { recordUndo?: boolean } = {},
  ): Mesh | null {
    const targetMesh = this.resolveTargetMesh(targetMeshOrName);
    if (!targetMesh) return null;

    const decals = this.getUnmergedDecals(targetMesh.name);
    if (decals.length === 0) return targetMesh;

    const validDecals = decals.filter((d) => d.getTotalVertices() > 0 && d.getTotalIndices() > 0);
    if (validDecals.length === 0) {
      for (const d of decals) {
        const idx = this.service.importedMeshes.indexOf(d);
        if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
        d.dispose(false, false);
      }
      this.onDecalsChanged?.();
      return targetMesh;
    }

    const originalName = targetMesh.name;
    const originalParent = targetMesh.parent;
    const originalMetadata = { ...(targetMesh.metadata || {}) };
    const wasSelected = this.service.selectedMesh === targetMesh;
    const targetIndexInImported = this.service.importedMeshes.indexOf(targetMesh);

    if (wasSelected) {
      this.service.selectMesh(null);
    }

    // Remove decals from importedMeshes before merging
    for (const decal of decals) {
      const dIdx = this.service.importedMeshes.indexOf(decal);
      if (dIdx !== -1) {
        this.service.importedMeshes.splice(dIdx, 1);
      }
    }

    // Detach decals from parent before baking/merging so world transforms are consistent
    for (const decal of validDecals) {
      decal.setParent(null);
      decal.computeWorldMatrix(true);
      this.offsetMeshAlongNormals(decal, this.config.normalOffset);
    }

    // Ensure target mesh has a material
    if (!targetMesh.material) {
      const defaultMat = new PBRMaterial(`Mat_${originalName}`, this.service.scene);
      defaultMat.albedoColor = new Color3(0.8, 0.8, 0.8);
      defaultMat.roughness = 0.6;
      defaultMat.metallic = 0.1;
      targetMesh.material = defaultMat;
    }

    // Normalize vertex attributes across targetMesh and all validDecals so MergeMeshes always succeeds
    const allMeshes = [targetMesh, ...validDecals];
    this.normalizeVertexAttributesForMerge(allMeshes);

    let merged: Nullable<Mesh> = null;
    try {
      merged = Mesh.MergeMeshes(
        allMeshes,
        true, // disposeSource
        true, // allow32BitsIndices
        undefined,
        false,
        true, // multiMultiMaterial: preserve submeshes & materials
      );
    } catch (err) {
      console.warn('DecalController: Mesh.MergeMeshes failed, keeping decals parented:', err);
      return targetMesh;
    }

    if (!merged) {
      return targetMesh;
    }

    merged.name = originalName;
    merged.parent = originalParent;
    merged.metadata = {
      ...originalMetadata,
      mergedDecalCount: ((originalMetadata.mergedDecalCount as number) || 0) + validDecals.length,
    };
    merged.isPickable = true;
    merged.refreshBoundingInfo();

    // Update importedMeshes so exportCurrentModel exports the merged mesh
    const oldTargetIdx = this.service.importedMeshes.indexOf(targetMesh);
    if (oldTargetIdx !== -1) {
      this.service.importedMeshes.splice(oldTargetIdx, 1, merged);
    } else if (targetIndexInImported !== -1 && targetIndexInImported <= this.service.importedMeshes.length) {
      this.service.importedMeshes.splice(targetIndexInImported, 0, merged);
    } else if (!this.service.importedMeshes.includes(merged)) {
      this.service.importedMeshes.push(merged);
    }

    if (wasSelected) {
      this.service.selectMesh(merged);
    }

    this.onDecalsChanged?.();
    this.service.updateStats();
    this.service.events.onSceneModified?.();
    return merged;
  }

  /**
   * Merges all unmerged decals across the entire scene into their respective target meshes.
   * Called automatically before exporting a model so decals are always fused with the exported mesh.
   */
  public mergeAllDecalsIntoMeshes(_options: { recordUndo?: boolean } = {}): {
    mergedDecalCount: number;
    affectedMeshes: string[];
  } {
    const allDecals = this.getUnmergedDecals();
    if (allDecals.length === 0) {
      return { mergedDecalCount: 0, affectedMeshes: [] };
    }

    const targetNames = Array.from(
      new Set(allDecals.map((d) => d.metadata?.targetMeshName).filter((n): n is string => Boolean(n))),
    );

    let totalMerged = 0;
    const affectedMeshes: string[] = [];

    for (const targetName of targetNames) {
      const targetDecals = this.getUnmergedDecals(targetName);
      const count = targetDecals.length;
      if (count === 0) continue;

      const merged = this.mergeDecalsIntoMesh(targetName, { recordUndo: false });
      if (merged) {
        totalMerged += count;
        affectedMeshes.push(merged.name);
      }
    }

    // Clean up any orphaned decals whose target mesh was previously deleted
    const remaining = this.getUnmergedDecals();
    for (const orphan of remaining) {
      const oIdx = this.service.importedMeshes.indexOf(orphan);
      if (oIdx !== -1) this.service.importedMeshes.splice(oIdx, 1);
      orphan.dispose(false, false);
    }

    this.onDecalsChanged?.();
    this.service.updateStats();
    this.service.events.onSceneModified?.();
    return { mergedDecalCount: totalMerged, affectedMeshes };
  }

  private offsetMeshAlongNormals(mesh: Mesh, offset: number): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    let normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    const indices = mesh.getIndices();
    if (!positions) return;

    if (!normals || normals.length !== positions.length) {
      normals = new Float32Array(positions.length);
      if (indices) {
        VertexData.ComputeNormals(positions, indices, normals);
      }
    }

    const displaced = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const nx = normals[i] || 0;
      const ny = normals[i + 1] || 1;
      const nz = normals[i + 2] || 0;
      displaced[i] = positions[i] + nx * offset;
      displaced[i + 1] = positions[i + 1] + ny * offset;
      displaced[i + 2] = positions[i + 2] + nz * offset;
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, displaced, true);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    mesh.refreshBoundingInfo();
  }

  /**
   * Ensures all meshes passed to Mesh.MergeMeshes share the exact same set of vertex buffer kinds
   * (PositionKind, NormalKind, UVKind) and removes mismatched extra channels so Babylon's
   * VertexData.Merge never throws an attribute mismatch error.
   */
  private normalizeVertexAttributesForMerge(meshes: Mesh[]): void {
    const requiredKinds = new Set<string>([
      VertexBuffer.PositionKind,
      VertexBuffer.NormalKind,
      VertexBuffer.UVKind,
    ]);

    for (const mesh of meshes) {
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
      if (!positions) continue;
      const vertexCount = positions.length / 3;

      // Ensure NormalKind
      if (!mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
        const normals = new Float32Array(positions.length);
        const indices = mesh.getIndices();
        if (indices) {
          VertexData.ComputeNormals(positions, indices, normals);
        } else {
          for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
        }
        mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
      }

      // Ensure UVKind
      if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
        const uvs = new Float32Array(vertexCount * 2);
        for (let i = 0; i < vertexCount; i++) {
          uvs[i * 2] = positions[i * 3] * 0.5 + 0.5;
          uvs[i * 2 + 1] = positions[i * 3 + 2] * 0.5 + 0.5;
        }
        mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
      }

      // Remove optional non-universal kinds (e.g. tangent, color, uv2) if not shared by all meshes
      const presentKinds = mesh.getVerticesDataKinds();
      for (const kind of presentKinds) {
        if (!requiredKinds.has(kind)) {
          mesh.removeVerticesData(kind);
        }
      }
    }
  }

  private resolveTargetMesh(targetMeshOrName?: Mesh | string): Mesh | null {
    if (targetMeshOrName instanceof Mesh) {
      return targetMeshOrName;
    }

    const validMeshes = this.service.scene.meshes.filter(
      (m): m is Mesh =>
        m instanceof Mesh &&
        m.getTotalVertices() > 0 &&
        !this.service.isEditorHelper(m) &&
        !this.isDecalHelperMesh(m) &&
        !this.isDecalMesh(m),
    );

    if (typeof targetMeshOrName === 'string' && targetMeshOrName !== 'selected') {
      const exact = validMeshes.find((m) => m.name === targetMeshOrName);
      if (exact) return exact;
      const lower = targetMeshOrName.toLowerCase();
      const partial = validMeshes.find((m) => m.name.toLowerCase().includes(lower));
      if (partial) return partial;
    }

    const selected = this.service.selectedMesh || this.service.selectedNodes[0] || null;
    if (selected instanceof Mesh && !this.isDecalMesh(selected) && selected.getTotalVertices() > 0) {
      return selected;
    }
    if (selected instanceof Mesh && this.isDecalMesh(selected) && selected.metadata?.targetMeshName) {
      const parentTarget = validMeshes.find((m) => m.name === selected.metadata.targetMeshName);
      if (parentTarget) return parentTarget;
    }
    if (selected instanceof TransformNode) {
      const child = selected.getChildMeshes(false).find(
        (m): m is Mesh => m instanceof Mesh && !this.isDecalMesh(m) && m.getTotalVertices() > 0,
      );
      if (child) return child;
    }

    return validMeshes[0] || null;
  }

  private resolveSurfacePointAndNormal(
    targetMesh: Mesh,
    options: PlaceDecalOptions,
  ): { position: Vector3; normal: Vector3 } {
    targetMesh.computeWorldMatrix(true);
    targetMesh.refreshBoundingInfo();
    const bbox = targetMesh.getBoundingInfo().boundingBox;
    const center = bbox.centerWorld.clone();
    const extend = bbox.extendSizeWorld;

    if (options.position && options.normal) {
      return {
        position: new Vector3(options.position[0], options.position[1], options.position[2]),
        normal: new Vector3(options.normal[0], options.normal[1], options.normal[2]).normalize(),
      };
    }

    // Determine ray direction from face or explicit position
    const face = options.face || 'front';
    const faceNormals: Record<string, Vector3> = {
      front: new Vector3(0, 0, -1),
      back: new Vector3(0, 0, 1),
      top: new Vector3(0, 1, 0),
      bottom: new Vector3(0, -1, 0),
      right: new Vector3(1, 0, 0),
      left: new Vector3(-1, 0, 0),
    };

    const outwardNormal = faceNormals[face] || new Vector3(0, 0, -1);

    if (options.position) {
      const pos = new Vector3(options.position[0], options.position[1], options.position[2]);
      const dirToCenter = center.subtract(pos);
      if (dirToCenter.lengthSquared() > 0.0001) {
        const rayDir = dirToCenter.normalize();
        const rayOrigin = pos.subtract(rayDir.scale(2.0));
        const ray = new Ray(rayOrigin, rayDir, 10.0);
        const pick = ray.intersectsMesh(targetMesh, false);
        if (pick.hit && pick.pickedPoint) {
          const n = pick.getNormal(true, true) || rayDir.scale(-1);
          return { position: pick.pickedPoint, normal: n.normalize() };
        }
      }
      return { position: pos, normal: outwardNormal };
    }

    // Cast ray from outside the selected face toward the mesh center
    const maxDim = Math.max(extend.x, extend.y, extend.z, 1) * 3;
    const rayOrigin = center.add(outwardNormal.scale(maxDim));
    const rayDir = outwardNormal.scale(-1);
    const ray = new Ray(rayOrigin, rayDir, maxDim * 2);
    const pick = ray.intersectsMesh(targetMesh, false);
    if (pick.hit && pick.pickedPoint) {
      const n = pick.getNormal(true, true) || outwardNormal;
      return { position: pick.pickedPoint, normal: n.normalize() };
    }

    // Fallback to bounding box surface point
    const fallbackPos = new Vector3(
      center.x + outwardNormal.x * extend.x,
      center.y + outwardNormal.y * extend.y,
      center.z + outwardNormal.z * extend.z,
    );
    return { position: fallbackPos, normal: outwardNormal };
  }

  private getOrCreateDecalMaterial(
    textureUrl: string,
    textureName: string,
    opacity: number,
    tintHex: string,
  ): PBRMaterial {
    const cacheKey = `${textureUrl}_${opacity.toFixed(2)}_${tintHex}`;
    const existing = this.decalMaterialCache.get(cacheKey);
    if (existing && this.service.scene.materials.includes(existing)) {
      return existing;
    }

    const mat = new PBRMaterial(`DecalMat_${textureName.replace(/[^a-zA-Z0-9]/g, '_')}_${this.decalCounter}`, this.service.scene);
    const tex = new Texture(
      textureUrl,
      this.service.scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      null,
      null,
      textureUrl.startsWith('data:') ? textureUrl : undefined,
      true,
    );
    tex.hasAlpha = true;
    mat.albedoTexture = tex;
    mat.useAlphaFromAlbedoTexture = true;
    mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    mat.alpha = Math.max(0.05, Math.min(1.0, opacity));
    try {
      mat.albedoColor = Color3.FromHexString(tintHex || '#ffffff');
    } catch {
      mat.albedoColor = Color3.White();
    }
    mat.roughness = 0.65;
    mat.metallic = 0.05;
    mat.zOffset = this.config.zOffset;
    mat.backFaceCulling = this.config.cullBackFaces;

    this.decalMaterialCache.set(cacheKey, mat);
    return mat;
  }

  private createProjectorBox(): void {
    this.disposePreviewAndProjector();
    this.projectorBox = MeshBuilder.CreateBox('decal_projector_box', { size: 1 }, this.service.scene);
    const mat = new StandardMaterial('decal_projector_mat', this.service.scene);
    mat.emissiveColor = new Color3(0.2, 0.85, 1.0);
    mat.disableLighting = true;
    mat.wireframe = true;
    this.projectorBox.material = mat;
    this.projectorBox.isPickable = false;
    this.projectorBox.setEnabled(false);
  }

  private disposePreviewAndProjector(): void {
    if (this.previewDecal) {
      this.previewDecal.dispose(false, false);
      this.previewDecal = null;
    }
    if (this.previewMaterial) {
      this.previewMaterial.dispose(false, true);
      this.previewMaterial = null;
    }
    if (this.projectorBox) {
      this.projectorBox.dispose(false, true);
      this.projectorBox = null;
    }
  }

  private attachEvents(): void {
    this.detachEvents();

    this.pointerObserver = this.service.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isActive) return;

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        this.handlePointerMove();
      } else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event as PointerEvent;
        if (evt.button === 0) {
          this.handleLeftClick();
        } else if (evt.button === 2) {
          this.rightMouseDownPos = { x: this.service.scene.pointerX, y: this.service.scene.pointerY };
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        const evt = pointerInfo.event as PointerEvent;
        if (evt.button === 2 && this.rightMouseDownPos) {
          const dx = Math.abs(this.service.scene.pointerX - this.rightMouseDownPos.x);
          const dy = Math.abs(this.service.scene.pointerY - this.rightMouseDownPos.y);
          this.rightMouseDownPos = null;
          if (dx < 5 && dy < 5) {
            this.handleRightClickDelete();
          }
        }
      }
    });

    if (typeof window !== 'undefined') {
      this.keyDownHandler = (e: KeyboardEvent) => {
        if (!this.isActive) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        if (e.key === 'q' || e.key === 'Q') {
          this.setAngleDegrees(this.getAngleDegrees() - 15);
          this.refreshLivePreview();
        } else if (e.key === 'e' || e.key === 'E') {
          this.setAngleDegrees(this.getAngleDegrees() + 15);
          this.refreshLivePreview();
        } else if (e.key === '[') {
          this.setUniformSize(Math.max(0.1, Number((this.config.sizeX - 0.1).toFixed(2))));
          this.refreshLivePreview();
        } else if (e.key === ']') {
          this.setUniformSize(Math.min(10, Number((this.config.sizeX + 0.1).toFixed(2))));
          this.refreshLivePreview();
        }
      };
      window.addEventListener('keydown', this.keyDownHandler);
    }
  }

  private detachEvents(): void {
    if (this.pointerObserver) {
      this.service.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
    if (this.keyDownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }
  }

  private handlePointerMove(): void {
    const pickInfo = this.service.scene.pick(
      this.service.scene.pointerX,
      this.service.scene.pointerY,
      (m) =>
        m instanceof Mesh &&
        m.isPickable &&
        m.isEnabled() &&
        m.getTotalVertices() > 0 &&
        !this.service.isEditorHelper(m) &&
        !this.isDecalHelperMesh(m) &&
        !this.isDecalMesh(m),
    );

    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint && pickInfo.pickedMesh instanceof Mesh) {
      const normal = pickInfo.getNormal(true, true) || Vector3.Up();
      this.lastPickedMesh = pickInfo.pickedMesh;
      this.lastPickedPoint = pickInfo.pickedPoint.clone();
      this.lastPickedNormal = normal.clone();
      this.refreshLivePreview();
    } else {
      this.lastPickedMesh = null;
      this.lastPickedPoint = null;
      this.lastPickedNormal = null;
      if (this.projectorBox) this.projectorBox.setEnabled(false);
      if (this.previewDecal) {
        this.previewDecal.dispose(false, false);
        this.previewDecal = null;
      }
    }
  }

  private refreshLivePreview(): void {
    if (!this.lastPickedMesh || !this.lastPickedPoint || !this.lastPickedNormal) return;

    if (this.projectorBox) {
      this.projectorBox.setEnabled(true);
      this.projectorBox.position.copyFrom(this.lastPickedPoint);
      this.projectorBox.scaling.set(this.config.sizeX, this.config.sizeY, this.config.sizeZ);

      const forward = this.lastPickedNormal.scale(-1).normalize();
      let up = Vector3.Up();
      if (Math.abs(Vector3.Dot(forward, up)) > 0.99) {
        up = Vector3.Forward();
      }
      const right = Vector3.Cross(up, forward).normalize();
      const orthoUp = Vector3.Cross(forward, right).normalize();
      const rotMat = Matrix.Identity();
      Matrix.FromXYZAxesToRef(right, orthoUp, forward, rotMat);
      const baseRot = Quaternion.FromRotationMatrix(rotMat);
      const rollQuat = Quaternion.RotationAxis(forward, this.config.angle);
      this.projectorBox.rotationQuaternion = rollQuat.multiply(baseRot);
    }

    if (this.previewDecal) {
      this.previewDecal.dispose(false, false);
      this.previewDecal = null;
    }

    try {
      this.previewDecal = MeshBuilder.CreateDecal('decal_preview_mesh', this.lastPickedMesh, {
        position: this.lastPickedPoint,
        normal: this.lastPickedNormal,
        size: new Vector3(this.config.sizeX, this.config.sizeY, this.config.sizeZ),
        angle: this.config.angle,
        cullBackFaces: this.config.cullBackFaces,
        localMode: this.config.localMode,
      });
      this.previewDecal.isPickable = false;

      if (!this.previewMaterial) {
        this.previewMaterial = new StandardMaterial('decal_preview_mat', this.service.scene);
        const tex = new Texture(
          this.config.textureUrl,
          this.service.scene,
          false,
          false,
          Texture.TRILINEAR_SAMPLINGMODE,
          null,
          null,
          this.config.textureUrl.startsWith('data:') ? this.config.textureUrl : undefined,
          true,
        );
        tex.hasAlpha = true;
        this.previewMaterial.diffuseTexture = tex;
        this.previewMaterial.useAlphaFromDiffuseTexture = true;
        this.previewMaterial.zOffset = this.config.zOffset - 1;
        this.previewMaterial.alpha = 0.75;
      }
      this.previewDecal.material = this.previewMaterial;
    } catch {
      // Ignore transient preview errors
    }
  }

  private handleLeftClick(): void {
    if (!this.lastPickedMesh || !this.lastPickedPoint || !this.lastPickedNormal) return;

    this.placeDecal({
      targetMesh: this.lastPickedMesh,
      position: [this.lastPickedPoint.x, this.lastPickedPoint.y, this.lastPickedPoint.z],
      normal: [this.lastPickedNormal.x, this.lastPickedNormal.y, this.lastPickedNormal.z],
    });
  }

  private handleRightClickDelete(): void {
    const pickInfo = this.service.scene.pick(
      this.service.scene.pointerX,
      this.service.scene.pointerY,
      (m) => this.isDecalMesh(m),
    );
    if (pickInfo && pickInfo.hit && pickInfo.pickedMesh && this.isDecalMesh(pickInfo.pickedMesh)) {
      this.removeDecal(pickInfo.pickedMesh as Mesh);
    }
  }

  /**
   * Generates a crisp 256x256 transparent PNG decal data URL for built-in procedural decal types.
   */
  public getOrCreateProceduralDecalUrl(kind: ProceduralDecalKind): string {
    const cached = this.proceduralTextures.get(kind);
    if (cached) return cached;

    if (typeof document === 'undefined') {
      this.proceduralTextures.set(kind, FALLBACK_PNG_DATA_URL);
      return FALLBACK_PNG_DATA_URL;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.proceduralTextures.set(kind, FALLBACK_PNG_DATA_URL);
      return FALLBACK_PNG_DATA_URL;
    }

    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    switch (kind) {
      case 'bullet_hole': {
        // Outer scorch halo
        const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 95);
        grad.addColorStop(0, 'rgba(10, 10, 12, 0.98)');
        grad.addColorStop(0.28, 'rgba(38, 36, 35, 0.92)');
        grad.addColorStop(0.6, 'rgba(65, 60, 55, 0.5)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 95, 0, Math.PI * 2);
        ctx.fill();

        // Radial impact cracks
        ctx.strokeStyle = 'rgba(20, 20, 22, 0.85)';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.15;
          const len = 45 + (i % 4) * 16;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * len * 0.5, cy + Math.sin(angle + 0.12) * len * 0.5);
          ctx.lineTo(cx + Math.cos(angle - 0.08) * len, cy + Math.sin(angle) * len);
          ctx.stroke();
        }
        break;
      }

      case 'cracks': {
        ctx.strokeStyle = 'rgba(22, 20, 18, 0.92)';
        const branches = 9;
        for (let b = 0; b < branches; b++) {
          let x = cx;
          let y = cy;
          let ang = (b / branches) * Math.PI * 2 + 0.2;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let step = 0; step < 6; step++) {
            ang += ((b + step) % 2 === 0 ? 1 : -1) * 0.28;
            x += Math.cos(ang) * 16;
            y += Math.sin(ang) * 16;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }

      case 'rust_stain': {
        const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 108);
        grad.addColorStop(0, 'rgba(135, 52, 20, 0.9)');
        grad.addColorStop(0.5, 'rgba(168, 72, 26, 0.68)');
        grad.addColorStop(0.85, 'rgba(110, 45, 16, 0.25)');
        grad.addColorStop(1, 'rgba(90, 35, 10, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 108, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'splatter': {
        ctx.fillStyle = 'rgba(185, 24, 32, 0.92)';
        ctx.beginPath();
        ctx.arc(cx, cy, 44, 0, Math.PI * 2);
        ctx.fill();
        const drops = [
          [cx - 52, cy - 28, 16],
          [cx + 58, cy - 18, 14],
          [cx - 34, cy + 56, 18],
          [cx + 46, cy + 48, 12],
          [cx + 15, cy - 66, 10],
          [cx - 68, cy + 14, 11],
          [cx + 76, cy + 20, 8],
        ];
        for (const [dx, dy, r] of drops) {
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'glowing_rune': {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
        ctx.shadowColor = 'rgba(14, 165, 233, 0.9)';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 74, 0, Math.PI * 2);
        ctx.stroke();

        // Hexagram inside circle
        for (let offset = 0; offset < 2; offset++) {
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const ang = (i / 3) * Math.PI * 2 + (offset * Math.PI) / 3 - Math.PI / 2;
            const px = cx + Math.cos(ang) * 72;
            const py = cy + Math.sin(ang) * 72;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }

      case 'hazard_stripes': {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(24, 56, 208, 144, 16);
        ctx.clip();
        ctx.fillStyle = '#eab308';
        ctx.fillRect(24, 56, 208, 144);
        ctx.fillStyle = '#18181b';
        for (let x = -140; x < 320; x += 36) {
          ctx.beginPath();
          ctx.moveTo(x, 56);
          ctx.lineTo(x + 20, 56);
          ctx.lineTo(x + 120, 200);
          ctx.lineTo(x + 100, 200);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 6;
        ctx.strokeRect(26, 58, 204, 140);
        break;
      }

      case 'rivets_plate': {
        ctx.fillStyle = 'rgba(82, 91, 102, 0.94)';
        ctx.strokeStyle = 'rgba(30, 35, 42, 0.98)';
        ctx.lineWidth = 5;
        ctx.fillRect(28, 28, 200, 200);
        ctx.strokeRect(28, 28, 200, 200);

        const rivetCoords = [
          [48, 48],
          [128, 48],
          [208, 48],
          [48, 128],
          [208, 128],
          [48, 208],
          [128, 208],
          [208, 208],
        ];
        for (const [rx, ry] of rivetCoords) {
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(rx, ry, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        break;
      }

      case 'star_emblem': {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.95)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const spikes = 5;
        const outerR = 96;
        const innerR = 42;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const ang = (i * Math.PI) / spikes - Math.PI / 2;
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }

    const url = canvas.toDataURL('image/png');
    this.proceduralTextures.set(kind, url);
    return url;
  }
}
