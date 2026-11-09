import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointerEventTypes,
  PointerInfo,
  Quaternion,
  Vector3,
} from '@babylonjs/core';
import type { Nullable, Observer } from '@babylonjs/core';
import earcut from 'earcut';
import type { MeshEditorService } from '../MeshEditorService';
import kenneyFutureFont from '../assets/fonts/Kenney_Future_Regular.json';
import droidSansBoldFont from '../assets/fonts/Droid_Sans_Bold.json';
import droidSansRegularFont from '../assets/fonts/Droid_Sans_Regular.json';

export interface FontOption {
  id: string;
  name: string;
  url: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  { id: 'kenney_future', name: 'Kenney Future', url: 'assets/fonts/Kenney_Future_Regular.json' },
  { id: 'droid_sans_bold', name: 'Droid Sans Bold', url: 'assets/fonts/Droid_Sans_Bold.json' },
  { id: 'droid_sans_regular', name: 'Droid Sans Regular', url: 'assets/fonts/Droid_Sans_Regular.json' },
];

const BUNDLED_FONT_DATA: Record<string, any> = {
  'assets/fonts/Kenney_Future_Regular.json': kenneyFutureFont,
  'assets/fonts/Droid_Sans_Bold.json': droidSansBoldFont,
  'assets/fonts/Droid_Sans_Regular.json': droidSansRegularFont,
  kenney_future: kenneyFutureFont,
  droid_sans_bold: droidSansBoldFont,
  droid_sans_regular: droidSansRegularFont,
};

export interface TextMeshConfig {
  text: string;
  fontUrl: string;
  size: number;
  depth: number;
  resolution: number;
  color: string;
  emissiveColor: string;
  emissiveIntensity: number;
  roughness: number;
  metallic: number;
  bevel?: boolean;
}

export interface CreateTextMeshOptions extends Partial<TextMeshConfig> {
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler angles in degrees
  scale?: [number, number, number];
  selectAfterCreate?: boolean;
}

export class TextMeshController {
  private service: MeshEditorService;
  private fontCache: Map<string, any> = new Map();
  private counter = 1;
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;
  public isSurfacePlacementActive = false;

  public currentConfig: TextMeshConfig = {
    text: 'Hello 3D',
    fontUrl: AVAILABLE_FONTS[0].url,
    size: 1.0,
    depth: 0.25,
    resolution: 8,
    color: '#3b82f6',
    emissiveColor: '#000000',
    emissiveIntensity: 0,
    roughness: 0.35,
    metallic: 0.2,
  };

  public onMeshCreated?: (mesh: Mesh) => void;
  public onMeshUpdated?: (mesh: Mesh) => void;

  constructor(service: MeshEditorService) {
    this.service = service;
  }

  public setSurfacePlacementActive(active: boolean): void {
    if (this.isSurfacePlacementActive === active) return;
    this.isSurfacePlacementActive = active;
    if (active) {
      this.attachPointerObserver();
    } else {
      this.detachPointerObserver();
    }
  }

  private attachPointerObserver(): void {
    this.detachPointerObserver();
    this.pointerObserver = this.service.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isSurfacePlacementActive) return;
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
      const evt = pointerInfo.event as PointerEvent;
      if (evt.button !== 0 || !evt.shiftKey) return;

      const pickInfo = this.service.scene.pick(
        this.service.scene.pointerX,
        this.service.scene.pointerY,
        (m) => m.isPickable && m.isEnabled() && !this.service.isEditorHelper(m),
      );

      let position: [number, number, number] = [0, 0, 0];
      let rotationDeg: [number, number, number] = [0, 0, 0];

      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        const pt = pickInfo.pickedPoint;
        position = [pt.x, pt.y, pt.z];
        const normal = pickInfo.getNormal(true, true);
        if (normal && Math.abs(normal.y) < 0.85) {
          const yawRad = Math.atan2(-normal.x, -normal.z);
          rotationDeg = [0, (yawRad * 180) / Math.PI, 0];
        }
      }

      void this.createTextMesh({
        ...this.currentConfig,
        position,
        rotation: rotationDeg,
        selectAfterCreate: true,
      });
    });
  }

  private detachPointerObserver(): void {
    if (this.pointerObserver) {
      this.service.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
  }

  public resolveFontUrl(fontNameOrUrl?: string): string {
    if (!fontNameOrUrl) return AVAILABLE_FONTS[0].url;
    const lower = fontNameOrUrl.toLowerCase().trim();
    const match = AVAILABLE_FONTS.find(
      (f) =>
        f.id === lower ||
        f.name.toLowerCase() === lower ||
        f.url.toLowerCase() === lower ||
        f.name.toLowerCase().includes(lower),
    );
    if (match) return match.url;
    if (fontNameOrUrl.endsWith('.json')) return fontNameOrUrl;
    return AVAILABLE_FONTS[0].url;
  }

  public async loadFontData(fontUrl: string): Promise<any> {
    const resolvedUrl = this.resolveFontUrl(fontUrl);
    if (this.fontCache.has(resolvedUrl)) {
      return this.fontCache.get(resolvedUrl);
    }

    // 1. Check built-in bundled typeface JSON fonts first (instant, works offline & without dev-server restart)
    const bundled = BUNDLED_FONT_DATA[resolvedUrl] || BUNDLED_FONT_DATA[fontUrl];
    if (bundled && bundled.glyphs) {
      this.fontCache.set(resolvedUrl, bundled);
      return bundled;
    }

    // 2. Try browser fetch for custom external font URLs
    if (typeof fetch === 'function') {
      try {
        const res = await fetch(resolvedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && data.glyphs) {
            this.fontCache.set(resolvedUrl, data);
            return data;
          }
        }
      } catch {
        // Ignore network errors and fall back to bundled Droid Sans Regular
      }
    }

    // 3. Fallback to bundled Droid Sans Regular so real typography is always used
    this.fontCache.set(resolvedUrl, droidSansRegularFont);
    return droidSansRegularFont;
  }

  public isTextMesh(mesh: any): mesh is Mesh {
    return Boolean(mesh && mesh instanceof Mesh && mesh.metadata && mesh.metadata.isTextMesh);
  }

  public getTextConfig(mesh: Mesh): TextMeshConfig | null {
    if (!this.isTextMesh(mesh)) return null;
    return {
      ...this.currentConfig,
      ...(mesh.metadata.textConfig || {}),
    };
  }

  /**
   * Creates a new 3D extruded text mesh in the scene.
   */
  public async createTextMesh(options: CreateTextMeshOptions = {}): Promise<Mesh> {
    const text = (options.text ?? this.currentConfig.text).trim() || 'Text';
    const fontUrl = this.resolveFontUrl(options.fontUrl ?? this.currentConfig.fontUrl);
    const size = Math.max(0.05, Math.min(20, options.size ?? this.currentConfig.size));
    const depth = Math.max(0.01, Math.min(10, options.depth ?? this.currentConfig.depth));
    const resolution = Math.max(1, Math.min(32, Math.round(options.resolution ?? this.currentConfig.resolution)));
    const color = options.color ?? this.currentConfig.color;
    const emissiveColor = options.emissiveColor ?? this.currentConfig.emissiveColor;
    const emissiveIntensity = Math.max(0, Math.min(5, options.emissiveIntensity ?? this.currentConfig.emissiveIntensity));
    const roughness = Math.max(0, Math.min(1, options.roughness ?? this.currentConfig.roughness));
    const metallic = Math.max(0, Math.min(1, options.metallic ?? this.currentConfig.metallic));

    const config: TextMeshConfig = {
      text,
      fontUrl,
      size,
      depth,
      resolution,
      color,
      emissiveColor,
      emissiveIntensity,
      roughness,
      metallic,
    };
    this.currentConfig = { ...config };

    const fontData = await this.loadFontData(fontUrl);

    const cleanName =
      options.name ||
      `text_${text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 16) || 'mesh'}_${this.counter++}`;

    const builtMesh = this.buildBabylonTextMesh(cleanName, config, fontData);

    if (options.position) {
      builtMesh.position.set(options.position[0], options.position[1], options.position[2]);
    } else {
      builtMesh.position.set(0, 0, 0);
    }

    if (options.rotation) {
      builtMesh.rotationQuaternion = null;
      builtMesh.rotation.set(
        (options.rotation[0] * Math.PI) / 180,
        (options.rotation[1] * Math.PI) / 180,
        (options.rotation[2] * Math.PI) / 180,
      );
    }

    if (options.scale) {
      builtMesh.scaling.set(options.scale[0], options.scale[1], options.scale[2]);
    }

    this.applyTextMaterial(builtMesh, config);
    this.attachMetadata(builtMesh, config);

    if (!this.service.importedMeshes.includes(builtMesh)) {
      this.service.importedMeshes.push(builtMesh);
    }

    this.service.recordAction({
      name: `Create 3D Text "${text}"`,
      undo: () => {
        if (!builtMesh.isDisposed()) {
          builtMesh.setEnabled(false);
          const idx = this.service.importedMeshes.indexOf(builtMesh);
          if (idx !== -1) this.service.importedMeshes.splice(idx, 1);
          if (this.service.selectedMesh === builtMesh) {
            this.service.selectMesh(null);
          }
          this.service.updateStats();
          this.service.events.onSceneModified?.();
        }
      },
      redo: () => {
        if (!builtMesh.isDisposed()) {
          builtMesh.setEnabled(true);
          if (!this.service.importedMeshes.includes(builtMesh)) {
            this.service.importedMeshes.push(builtMesh);
          }
          this.service.selectMesh(builtMesh);
          this.service.updateStats();
          this.service.events.onSceneModified?.();
        }
      },
    });

    if (options.selectAfterCreate !== false) {
      this.service.selectMesh(builtMesh);
    }
    this.service.updateStats();
    this.service.events.onSceneModified?.();

    this.onMeshCreated?.(builtMesh);
    return builtMesh;
  }

  /**
   * Updates an existing 3D text mesh in-place with new text, font, geometry, or material settings.
   */
  public async updateTextMesh(mesh: Mesh, updates: Partial<CreateTextMeshOptions>): Promise<Mesh> {
    const existingConfig = this.getTextConfig(mesh) || { ...this.currentConfig };
    const nextConfig: TextMeshConfig = {
      text: (updates.text ?? existingConfig.text).trim() || 'Text',
      fontUrl: this.resolveFontUrl(updates.fontUrl ?? existingConfig.fontUrl),
      size: Math.max(0.05, Math.min(20, updates.size ?? existingConfig.size)),
      depth: Math.max(0.01, Math.min(10, updates.depth ?? existingConfig.depth)),
      resolution: Math.max(1, Math.min(32, Math.round(updates.resolution ?? existingConfig.resolution))),
      color: updates.color ?? existingConfig.color,
      emissiveColor: updates.emissiveColor ?? existingConfig.emissiveColor,
      emissiveIntensity: Math.max(0, Math.min(5, updates.emissiveIntensity ?? existingConfig.emissiveIntensity)),
      roughness: Math.max(0, Math.min(1, updates.roughness ?? existingConfig.roughness)),
      metallic: Math.max(0, Math.min(1, updates.metallic ?? existingConfig.metallic)),
    };
    this.currentConfig = { ...nextConfig };

    const geometryChanged =
      nextConfig.text !== existingConfig.text ||
      nextConfig.fontUrl !== existingConfig.fontUrl ||
      nextConfig.size !== existingConfig.size ||
      nextConfig.depth !== existingConfig.depth ||
      nextConfig.resolution !== existingConfig.resolution ||
      !this.isTextMesh(mesh);

    let resultMesh = mesh;

    if (geometryChanged) {
      const fontData = await this.loadFontData(nextConfig.fontUrl);
      const pos = mesh.position.clone();
      const rot = mesh.rotation.clone();
      const rotQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null;
      const scale = mesh.scaling.clone();
      const parent = mesh.parent;
      const meshName = updates.name || mesh.name;

      const wasSelected = this.service.selectedMesh === mesh;
      if (wasSelected) {
        this.service.selectMesh(null);
      }

      const oldIdx = this.service.importedMeshes.indexOf(mesh);
      mesh.dispose(false, false);

      resultMesh = this.buildBabylonTextMesh(meshName, nextConfig, fontData);
      resultMesh.parent = parent;
      resultMesh.position.copyFrom(pos);
      if (rotQuat) {
        resultMesh.rotationQuaternion = rotQuat;
      } else {
        resultMesh.rotation.copyFrom(rot);
      }
      resultMesh.scaling.copyFrom(scale);

      if (oldIdx !== -1) {
        this.service.importedMeshes.splice(oldIdx, 1, resultMesh);
      } else if (!this.service.importedMeshes.includes(resultMesh)) {
        this.service.importedMeshes.push(resultMesh);
      }
    }

    if (updates.position) {
      resultMesh.position.set(updates.position[0], updates.position[1], updates.position[2]);
    }
    if (updates.rotation) {
      resultMesh.rotationQuaternion = null;
      resultMesh.rotation.set(
        (updates.rotation[0] * Math.PI) / 180,
        (updates.rotation[1] * Math.PI) / 180,
        (updates.rotation[2] * Math.PI) / 180,
      );
    }
    if (updates.scale) {
      resultMesh.scaling.set(updates.scale[0], updates.scale[1], updates.scale[2]);
    }

    this.applyTextMaterial(resultMesh, nextConfig);
    this.attachMetadata(resultMesh, nextConfig);

    this.service.selectMesh(resultMesh);
    this.service.updateStats();
    this.service.events.onSceneModified?.();

    this.onMeshUpdated?.(resultMesh);
    return resultMesh;
  }

  /**
   * Duplicates an existing 3D text mesh with a small offset.
   */
  public async duplicateTextMesh(mesh: Mesh): Promise<Mesh> {
    const config = this.getTextConfig(mesh) || { ...this.currentConfig };
    const pos = mesh.position;
    const rotDeg: [number, number, number] = mesh.rotationQuaternion
      ? (() => {
          const euler = mesh.rotationQuaternion.toEulerAngles();
          return [(euler.x * 180) / Math.PI, (euler.y * 180) / Math.PI, (euler.z * 180) / Math.PI];
        })()
      : [(mesh.rotation.x * 180) / Math.PI, (mesh.rotation.y * 180) / Math.PI, (mesh.rotation.z * 180) / Math.PI];

    return this.createTextMesh({
      ...config,
      position: [pos.x + 0.5, pos.y, pos.z + 0.5],
      rotation: rotDeg,
      scale: [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z],
      selectAfterCreate: true,
    });
  }

  private buildBabylonTextMesh(name: string, config: TextMeshConfig, fontData: any): Mesh {
    let textMesh: Nullable<Mesh> = null;
    try {
      textMesh = MeshBuilder.CreateText(
        name,
        config.text,
        fontData,
        {
          size: config.size,
          resolution: config.resolution,
          depth: config.depth,
          sideOrientation: Mesh.DOUBLESIDE,
        },
        this.service.scene,
        earcut,
      );
    } catch {
      textMesh = null;
    }

    // Fallback if CreateText returned null (e.g. unsupported charactersonly)
    if (!textMesh || textMesh.getTotalVertices() === 0) {
      textMesh?.dispose();
      textMesh = MeshBuilder.CreateBox(
        name,
        {
          width: Math.max(0.4, config.text.length * config.size * 0.55),
          height: config.size,
          depth: config.depth,
        },
        this.service.scene,
      );
    }

    // Center pivot horizontally (X, Z) and align bottom to Y = 0
    textMesh.computeWorldMatrix(true);
    textMesh.refreshBoundingInfo();
    const bounds = textMesh.getBoundingInfo().boundingBox;
    const centerOffset = bounds.center;
    const minY = bounds.minimum.y;

    const positions = textMesh.getVerticesData('position');
    if (positions) {
      const updated = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        updated[i] = positions[i] - centerOffset.x;
        updated[i + 1] = positions[i + 1] - minY;
        updated[i + 2] = positions[i + 2] - centerOffset.z;
      }
      textMesh.setVerticesData('position', updated, true);
      textMesh.refreshBoundingInfo();
    }

    textMesh.isPickable = true;
    return textMesh;
  }

  private applyTextMaterial(mesh: Mesh, config: TextMeshConfig): void {
    const matName = `Mat_Text_${mesh.name}`;
    let pbr = this.service.scene.getMaterialByName(matName) as PBRMaterial | null;
    if (!pbr || !(pbr instanceof PBRMaterial)) {
      pbr = new PBRMaterial(matName, this.service.scene);
    }

    try {
      pbr.albedoColor = Color3.FromHexString(config.color || '#3b82f6');
    } catch {
      pbr.albedoColor = new Color3(0.23, 0.51, 0.96);
    }

    pbr.roughness = config.roughness;
    pbr.metallic = config.metallic;

    if (config.emissiveIntensity > 0 && config.emissiveColor && config.emissiveColor !== '#000000') {
      try {
        const em = Color3.FromHexString(config.emissiveColor);
        pbr.emissiveColor = em.scale(config.emissiveIntensity);
      } catch {
        pbr.emissiveColor = Color3.Black();
      }
    } else {
      pbr.emissiveColor = Color3.Black();
    }

    mesh.material = pbr;
  }

  private attachMetadata(mesh: Mesh, config: TextMeshConfig): void {
    mesh.metadata = {
      ...(mesh.metadata || {}),
      isTextMesh: true,
      textConfig: { ...config },
    };
  }
}
