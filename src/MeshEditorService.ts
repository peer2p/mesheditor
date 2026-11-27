import {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Color4,
  CSG,
  CSG2,
  DirectionalLight,
  Engine,
  FilesInputStore,
  GizmoManager,
  HemisphericLight,
  HighlightLayer,
  InitializeCSG2Async,
  IsCSG2Ready,
  LinesMesh,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  Nullable,
  Observer,
  PBRMaterial,
  Plane,
  PointerEventTypes,
  PointerInfo,
  Quaternion,
  Scene,
  SceneLoader,
  SceneSerializer,
  StandardMaterial,
  SubMesh,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector2,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import {
  applyFacetUVProjection,
  captureMeshSurfaceSnapshot,
  ensureBaseMaterial,
  FacetMaterialInfo,
  FacetUVInfo,
  FacetUVProjectionOptions,
  FacetUVTransformOptions,
  getFaceTriangleMaterialIndices,
  getFacetMaterialInfo,
  getFacetUVInfo,
  getMeshSlotMaterials,
  isolateFacetVertices,
  MeshSurfaceSnapshot,
  rebuildMeshSubMeshes,
  remapFacetUVRect,
  restoreMeshSurfaceSnapshot,
  setFacetCornerUVs,
  transformFacetUVs,
} from './geometry/facetSurfaceUtils';
import { subdivideCatmullClarkMesh } from './geometry/organicGeometry';
import { ColladaConverter } from './loaders/ColladaConverter';
import { createProceduralEnvironmentTexture } from './utils/proceduralEnvironment';
import { GridMaterial, TerrainMaterial } from '@babylonjs/materials';
import { GLTF2Export, OBJExport, RegisterEXT_texture_webp, STLExport } from '@babylonjs/serializers';
import { DataWriter } from '@babylonjs/serializers/glTF/2.0/dataWriter';

// Ensure cross-realm typed arrays (e.g. jsdom testing / iframes) are compatible with DataWriter
if (DataWriter && DataWriter.prototype) {
  const origWriteTypedArray = DataWriter.prototype.writeTypedArray;
  DataWriter.prototype.writeTypedArray = function (this: any, value: any): void {
    try {
      origWriteTypedArray.call(this, value);
    } catch {
      this._checkGrowBuffer(value.byteLength);
      const typeName = value?.constructor?.name;
      const isLittleEndian = true;
      for (let i = 0; i < value.length; i++) {
        const v = value[i];
        switch (typeName) {
          case 'Uint8Array':
          case 'Uint8ClampedArray':
            this._dataView.setUint8(this._byteOffset, v);
            break;
          case 'Int8Array':
            this._dataView.setInt8(this._byteOffset, v);
            break;
          case 'Uint16Array':
            this._dataView.setUint16(this._byteOffset, v, isLittleEndian);
            break;
          case 'Int16Array':
            this._dataView.setInt16(this._byteOffset, v, isLittleEndian);
            break;
          case 'Uint32Array':
            this._dataView.setUint32(this._byteOffset, v, isLittleEndian);
            break;
          case 'Int32Array':
            this._dataView.setInt32(this._byteOffset, v, isLittleEndian);
            break;
          case 'Float32Array':
            this._dataView.setFloat32(this._byteOffset, v, isLittleEndian);
            break;
          case 'Float64Array':
            this._dataView.setFloat64(this._byteOffset, v, isLittleEndian);
            break;
        }
        this._byteOffset += value.BYTES_PER_ELEMENT;
      }
    }
  };
}
import { AIAgentService } from './AIAgentService';
import {
  TextureAtlasManager,
  TextureAtlasDefinition,
  VoxelPainterController,
  EmbeddedTextureInfo,
} from './voxel';
import { PathExtrusionController } from './pathExtrusion';
import { SculptController } from './sculpting/SculptController';
import { UVUnwrapController } from './uv/UVUnwrapController';
import { TextureBaker } from './baking/TextureBaker';
import { WeightPaintController } from './rigging/WeightPaintController';
import { AITextureGenerator } from './textures/AITextureGenerator';
import { TextMeshController } from './textMesh/TextMeshController';
import { DecalController } from './decals/DecalController';
import { TexturePaintController } from './painting/TexturePaintController';
import { HeightmapController } from './heightmap';
import {
  GaussianSplatController,
  isGaussianSplatMesh,
  isGaussianSplatProxyMesh,
} from './splatting';
import { MiniCadController } from './minicad/MiniCadController';
import {
  BevelModifierOptions,
  NonDestructiveCSGMetadata,
  captureMeshSnapshot,
  computeBeveledSnapshot,
  restoreMeshSnapshot,
} from './geometry/bevelModifier';
import { generateNormalMapFromCanvas } from './tools/textureUtils';
import {
  ModelCompressor,
  ModelCompressorOptions,
  ModelCompressorStats,
} from './compression/ModelCompressor';
import {
  ActionRecord,
  ActiveMaterialTexturesInfo,
  ActiveTextureSlotInfo,
  CSGOperationType,
  ExportOptions,
  MeshEditorProjectData,
  MeshEditorServiceEvents,
  PrimitiveConfig,
  ScreenshotCaptureResult,
  ScreenshotMode,
  TextureOptimizationInfo,
  TransformSnapshot,
} from './types';
import { createZipArchive, ZipEntryInput } from './utils/zipBuilder';

// Register WebP extension for GLTF serializer
RegisterEXT_texture_webp();

export class MeshEditorService {
  // Babylon Core
  public canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;
  public camera: UniversalCamera;
  public ambientLight: HemisphericLight;
  public sunLight: DirectionalLight;
  public gridMesh: Mesh;
  public gridMaterial: GridMaterial;
  public highlightLayer: HighlightLayer;
  public gizmoManager: GizmoManager;
  public aiAgent: AIAgentService;
  public textureAtlasManager: TextureAtlasManager;
  public voxelPainter: VoxelPainterController;
  public pathExtrusion: PathExtrusionController;
  public sculptController: SculptController;
  public uvUnwrapController: UVUnwrapController;
  public textureBaker: TextureBaker;
  public weightPaintController: WeightPaintController;
  public aiTextureGenerator: AITextureGenerator;
  public get externalImageGenerator() {
    return this.aiTextureGenerator.externalImageGenerator;
  }
  public textMeshController: TextMeshController;
  public decalController: DecalController;
  public texturePaintController: TexturePaintController;
  public heightmapController: HeightmapController;
  public gaussianSplatController: GaussianSplatController;
  public miniCadController: MiniCadController;
  public get pathWays(): PathExtrusionController {
    return this.pathExtrusion;
  }

  // Model & Selection state
  public currentModelRoot: TransformNode | null = null;
  public importedMeshes: Mesh[] = [];
  public selectedNodes: TransformNode[] = [];
  public groups: TransformNode[] = [];
  private groupCounter: number = 0;
  private lastClickedNode: TransformNode | null = null;
  public selectionProxyNode: Nullable<TransformNode> = null;
  public selectionProxyActive: boolean = false;
  private selectionProxyMap: Map<TransformNode, Nullable<any>> = new Map();
  public clipboardNodes: TransformNode[] = [];
  public selectedMesh: Mesh | null = null;
  public selectedSubMeshId: number | null = null;
  public currentFilename: string = 'model.glb';
  public clipboardMesh: Mesh | null = null;
  public isPlaceModeActive: boolean = false;
  private pendingPlacementConfig: PrimitiveConfig | null = null;
  public lastPointerX: number = 0;
  public lastPointerY: number = 0;

  // In-memory files cache for drag-and-drop & blob tracking
  private inMemoryFiles: Map<string, File> = new Map();
  private objectUrls: Set<string> = new Set();

  // Undo / Redo History state
  public undoStack: ActionRecord[] = [];
  public redoStack: ActionRecord[] = [];
  private readonly maxHistorySteps: number = 100;
  private historySuppressionDepth: number = 0;
  private capturedActionBatches: ActionRecord[][] = [];
  private preDragSnapshots: Map<TransformNode, TransformSnapshot> = new Map();

  // CSG2 Boolean Sculpting state
  public csg2Initialized: boolean = false;

  // Animation state
  public animationGroups: AnimationGroup[] = [];
  public activeAnimationGroup: AnimationGroup | null = null;
  public isAnimPlaying: boolean = false;
  public animFrameCurrent: number = 0;

  // Facet & Vertex Editor state
  public facetEditorActive: boolean = false;
  public facetEditMode: 'face' | 'vertex' = 'face';
  public facetSingleTriangleMode: boolean = false;
  public selectedFaceId: number | null = null;
  public selectedFaceIsQuad: boolean = false;
  public facetHighlightMesh: Nullable<LinesMesh> = null;
  public selectedVertexIndex: number | null = null;
  public selectedVertexIndices: number[] = [];
  public vertexHandles: Mesh[] = [];
  public activeVertexHandle: Mesh | null = null;
  public vertexGizmoNode: TransformNode | null = null;
  public isDraggingVertex: boolean = false;
  private vertexPreDragPos: Vector3 = Vector3.Zero();

  // Marquee selection state
  public isGizmoDragging: boolean = false;
  public isMarqueeCandidate: boolean = false;
  public isMarqueeActive: boolean = false;
  public marqueeStartPointer: { x: number; y: number } = { x: 0, y: 0 };
  public marqueeStartClient: { x: number; y: number } = { x: 0, y: 0 };
  private marqueeElement: HTMLElement | null = null;
  private onWindowPointerUpHandler: ((e: PointerEvent) => void) | null = null;
  private onWindowPointerCancelHandler: ((e: PointerEvent) => void) | null = null;
  private onWindowKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastMarqueeEscapeEvent: KeyboardEvent | null = null;

  // Touch camera & gesture state (separates single-tap selection from 1-finger orbit & 2-finger pinch/pan)
  public touchOrbitTarget: Vector3 = new Vector3(0, 1, 0);
  public touchDragMode: 'orbit' | 'marquee' = 'orbit';
  public touchMultiSelectActive: boolean = false;
  public touchSnapActive: boolean = false;
  private activeTouchPointers: Map<number, { clientX: number; clientY: number }> = new Map();
  private touchOrbitActive: boolean = false;
  private touchTapEligible: boolean = false;
  private touchLastSingleClient: { x: number; y: number } | null = null;
  private touchLastPinchState: { midX: number; midY: number; dist: number } | null = null;

  public setTouchDragMode(mode: 'orbit' | 'marquee'): void {
    this.touchDragMode = mode;
    if (mode !== 'marquee') {
      this.isMarqueeCandidate = false;
      this.isMarqueeActive = false;
      this.hideMarqueeVisual();
    }
  }

  public setTouchMultiSelectActive(active: boolean): void {
    this.touchMultiSelectActive = active;
  }

  public setTouchSnapActive(active: boolean): void {
    this.touchSnapActive = active;
    this.setSnapModifierActive(active);
  }

  // Events listener
  public events: MeshEditorServiceEvents = {};

  // Parameters
  public sceneParams = {
    clearColor: '#141820',
    grid: true,
    gridSize: 20,
    gridLineColor: '#3299fd',
    gridFillColor: '#ffffff',
    gridFillTransparent: true,
    ambientLight: 1.0,
    sunLight: 1.2,
    cameraSpeed: 0.4,
    translateSnap: 0.1,
    rotateSnap: 5,
    meshSelectionColor: '#3399ff',
    faceSelectionColor: '#ffcc33',
    vertexColor: '#00d9ff',
    vertexSelectionColor: '#ffa61a',
    voxelToolColor: '#ffd91a',
  };
  public isSnapModifierActive: boolean = false;
  public isSceneInteractionLocked: boolean = false;
  public gizmoMode: 'translate' | 'rotate' | 'scale' | 'bounds' = 'translate';
  public ensureGizmoDragEvents: () => void = () => {};

  public exportParams: ExportOptions = {
    format: 'glb',
    filename: 'model_edited',
    selectedOnly: false,
  };

  // Asset Resolution & Loader Interceptors
  private loaderObserver: Nullable<Observer<any>> = null;
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, events: MeshEditorServiceEvents = {}, customEngine?: Engine) {
    this.canvas = canvas;
    this.events = events;
    this.initBabylon(customEngine);
    this.initGizmosAndPicking();
    this.aiAgent = new AIAgentService(this);
    this.textureAtlasManager = new TextureAtlasManager(this.scene);
    this.textureAtlasManager.createProceduralTerrainAtlas('Default Terrain Atlas');
    this.voxelPainter = new VoxelPainterController(this, this.textureAtlasManager);
    this.pathExtrusion = new PathExtrusionController(this);
    this.sculptController = new SculptController(this);
    this.uvUnwrapController = new UVUnwrapController(this);
    this.textureBaker = new TextureBaker(this);
    this.weightPaintController = new WeightPaintController(this);
    this.aiTextureGenerator = new AITextureGenerator(this);
    this.aiAgent.syncExternalImageGenerator();
    this.textMeshController = new TextMeshController(this);
    this.decalController = new DecalController(this);
    this.texturePaintController = new TexturePaintController(this);
    this.heightmapController = new HeightmapController(this);
    this.gaussianSplatController = new GaussianSplatController(this);
    this.miniCadController = new MiniCadController(this);
    const defaultAtlas = this.textureAtlasManager.getAtlases()[0];
    if (defaultAtlas) {
      this.voxelPainter.useTextureAtlas(defaultAtlas.id);
    }
  }

  /* =========================================================================
     1. BABYLON INITIALIZATION
     ========================================================================= */
  private initBabylon(customEngine?: Engine): void {
    this.engine =
      customEngine ||
      new Engine(this.canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
      });

    // Custom Babylon.js Loading Screen Hook
    this.engine.loadingScreen = {
      displayLoadingUI: () => {
        this.events.onStatusChanged?.(
          this.engine.loadingScreen.loadingUIText || 'Initializing Babylon 3D Scene...',
          true
        );
      },
      hideLoadingUI: () => {
        this.events.onStatusChanged?.('Ready', false);
      },
      loadingUIBackgroundColor: '#0f1218',
      loadingUIText: 'Initializing Babylon 3D Scene...',
    };

    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString(this.sceneParams.clearColor + 'ff');

    this.camera = new UniversalCamera('editorCamera', new Vector3(0, 2.5, -6), this.scene);
    this.camera.setTarget(new Vector3(0, 1, 0));
    this.camera.attachControl(this.canvas, true);

    // Only right click (button 2) rotates camera on desktop; touch uses custom orbit/pinch/pan
    if (this.camera.inputs?.attached?.mouse) {
      (this.camera.inputs.attached.mouse as any).buttons = [2];
    }
    this.camera.inputs?.removeByType('FreeCameraTouchInput');

    // Configure navigation keys: Arrow keys + WASD
    this.camera.keysUp = [38, 87]; // Up Arrow & W
    this.camera.keysDown = [40, 83]; // Down Arrow & S
    this.camera.keysLeft = [37, 65]; // Left Arrow & A
    this.camera.keysRight = [39, 68]; // Right Arrow & D
    this.camera.speed = this.sceneParams.cameraSpeed;
    this.camera.angularSensibility = 2000;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 50000;

    // Ensure canvas is focusable and captures keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener('pointerdown', () => {
      this.canvas.focus();
    });
    try {
      this.canvas.focus();
    } catch {
      // Ignore in headless/SSR environments
    }

    // Prevent default context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.isPlaceModeActive) {
        this.cancelPlacementMode();
      }
    });

    // Use traditional Maya/Blender orbit navigation with Alt or Right click
    this.ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = this.sceneParams.ambientLight;
    this.ambientLight.groundColor = new Color3(0.2, 0.22, 0.25);

    this.sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, 1), this.scene);
    this.sunLight.intensity = this.sceneParams.sunLight;

    // Provide a procedural daytime IBL environment map so PBR glass, water, and metals show crisp reflections
    const hasGpuContext = Boolean((this.engine as any)?._gl || (this.engine as any)?._device);
    if (hasGpuContext) {
      try {
        this.scene.environmentTexture = createProceduralEnvironmentTexture(this.scene);
        this.scene.environmentIntensity = 1.35;
      } catch {
        // Ignore in headless environments without full texture support
      }
    }

    this.gridMaterial = new GridMaterial('gridMat', this.scene);
    this.gridMaterial.majorUnitFrequency = 5;
    this.gridMaterial.minorUnitVisibility = 0.45;
    this.gridMaterial.gridRatio = 1;
    this.gridMaterial.backFaceCulling = false;

    this.gridMesh = MeshBuilder.CreateGround(
      'editor_ground_grid',
      { width: this.sceneParams.gridSize, height: this.sceneParams.gridSize },
      this.scene
    );
    this.gridMesh.material = this.gridMaterial;
    this.gridMesh.position.y = -0.001;
    this.gridMesh.isPickable = true;
    (this.gridMesh as any).metadata = { isEditorHelper: true };
    this.applyGridAppearance();

    this.highlightLayer = new HighlightLayer('editor_highlight', this.scene);
    this.highlightLayer.innerGlow = true;
    this.highlightLayer.outerGlow = true;

    // CSG2 Async Init
    InitializeCSG2Async()
      .then(() => {
        this.csg2Initialized = true;
      })
      .catch((err) => {
        console.warn('CSG2 WebAssembly initialization deferred:', err);
      });

    // Render Loop
    this.engine.runRenderLoop(() => {
      this.updateLiveAnimationProgress();
      this.scene.render();
    });

    this.resizeHandler = () => {
      this.engine?.resize();
    };
    window.addEventListener('resize', this.resizeHandler);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.engine?.resize();
      });
      this.resizeObserver.observe(this.canvas);
    }

    if (typeof window !== 'undefined') {
      const cleanupTouchPointer = (e?: PointerEvent) => {
        if (e && e.pointerType === 'touch' && typeof e.pointerId === 'number') {
          this.activeTouchPointers.delete(e.pointerId);
          if (this.activeTouchPointers.size < 2) {
            this.touchLastPinchState = null;
          }
          if (this.activeTouchPointers.size === 0) {
            this.touchOrbitActive = false;
            this.touchLastSingleClient = null;
            this.touchTapEligible = false;
          }
        }
      };
      this.onWindowPointerUpHandler = (e: PointerEvent) => {
        cleanupTouchPointer(e);
        if (this.isMarqueeActive || this.isMarqueeCandidate) {
          this.isMarqueeActive = false;
          this.isMarqueeCandidate = false;
          this.hideMarqueeVisual();
        }
      };
      this.onWindowPointerCancelHandler = (e: PointerEvent) => {
        cleanupTouchPointer(e);
        if (this.isMarqueeActive || this.isMarqueeCandidate) {
          this.isMarqueeActive = false;
          this.isMarqueeCandidate = false;
          this.hideMarqueeVisual();
        }
      };
      this.onWindowKeyDownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && (this.isMarqueeActive || this.isMarqueeCandidate)) {
          this.isMarqueeActive = false;
          this.isMarqueeCandidate = false;
          this.hideMarqueeVisual();
          this.lastMarqueeEscapeEvent = e;
        }
      };
      window.addEventListener('pointerup', this.onWindowPointerUpHandler);
      window.addEventListener('pointercancel', this.onWindowPointerCancelHandler);
      window.addEventListener('keydown', this.onWindowKeyDownHandler);
    }

    this.setupLoaderInterceptors();
  }

  public resize(): void {
    if (this.engine) this.engine.resize();
  }

  public dispose(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.onWindowPointerUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.onWindowPointerUpHandler);
      this.onWindowPointerUpHandler = null;
    }
    if (this.onWindowPointerCancelHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointercancel', this.onWindowPointerCancelHandler);
      this.onWindowPointerCancelHandler = null;
    }
    if (this.onWindowKeyDownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onWindowKeyDownHandler);
      this.onWindowKeyDownHandler = null;
    }
    if (this.loaderObserver) {
      SceneLoader.OnPluginActivatedObservable.remove(this.loaderObserver);
      this.loaderObserver = null;
    }
    this.voxelPainter?.dispose();
    this.sculptController?.dispose();
    this.uvUnwrapController?.dispose();
    this.textureBaker?.dispose();
    this.weightPaintController?.dispose();
    this.decalController?.setActive(false);
    this.texturePaintController?.dispose();
    this.textMeshController?.setSurfacePlacementActive(false);
    this.miniCadController?.dispose();
    if (this.engine) {
      this.engine.stopRenderLoop();
      this.engine.dispose();
    }
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getEngine(): Engine {
    return this.engine;
  }

  public getCamera(): UniversalCamera {
    return this.camera;
  }

  public getGizmoManager(): GizmoManager {
    return this.gizmoManager;
  }

  /* =========================================================================
     2. GIZMOS & SELECTION
     ========================================================================= */
  private initGizmosAndPicking(): void {
    this.gizmoManager = new GizmoManager(this.scene);
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
    this.gizmoManager.usePointerToAttachGizmos = false;

    // Track pre-drag transform state for robust multi-selection undo/redo
    const capturePreDrag = () => {
      this.preDragSnapshots.clear();
      const nodesToRecord =
        this.selectionProxyActive && this.selectionProxyNode
          ? this.selectedNodes
          : this.selectedNodes.length > 0
          ? this.selectedNodes
          : this.selectedMesh
          ? [this.selectedMesh]
          : [];

      for (const node of nodesToRecord) {
        if (!node || node.isDisposed()) continue;
        this.preDragSnapshots.set(node, {
          position: node.position.clone(),
          rotation: node.rotation.clone(),
          rotationQuaternion: node.rotationQuaternion ? node.rotationQuaternion.clone() : null,
          scaling: node.scaling.clone(),
        });
      }
    };

    const commitPostDrag = (gizmoName: string) => {
      if (this.preDragSnapshots.size === 0) return;

      const entries: Array<{
        node: TransformNode;
        before: TransformSnapshot;
        after: TransformSnapshot;
      }> = [];

      for (const [node, before] of this.preDragSnapshots.entries()) {
        if (!node || node.isDisposed()) continue;
        const after: TransformSnapshot = {
          position: node.position.clone(),
          rotation: node.rotation.clone(),
          rotationQuaternion: node.rotationQuaternion ? node.rotationQuaternion.clone() : null,
          scaling: node.scaling.clone(),
        };

        const posChanged = Vector3.DistanceSquared(before.position, after.position) > 0.000001;
        const scaleChanged = Vector3.DistanceSquared(before.scaling, after.scaling) > 0.000001;
        let rotChanged = Vector3.DistanceSquared(before.rotation, after.rotation) > 0.000001;
        if (before.rotationQuaternion && after.rotationQuaternion) {
          rotChanged =
            Math.abs(Quaternion.Dot(before.rotationQuaternion, after.rotationQuaternion)) < 0.999999;
        }

        if (posChanged || rotChanged || scaleChanged) {
          entries.push({ node, before, after });
        }
      }

      if (entries.length > 0) {
        this.recordAction({
          name: `${gizmoName} ${entries.length} object(s)`,
          undo: () => {
            this.clearSelectionProxy();
            for (const item of entries) {
              if (item.node.isDisposed()) continue;
              item.node.position.copyFrom(item.before.position);
              item.node.scaling.copyFrom(item.before.scaling);
              if (item.before.rotationQuaternion) {
                if (!item.node.rotationQuaternion) item.node.rotationQuaternion = Quaternion.Identity();
                item.node.rotationQuaternion.copyFrom(item.before.rotationQuaternion);
              } else {
                item.node.rotation.copyFrom(item.before.rotation);
              }
            }
            this.selectNodes(this.selectedNodes);
          },
          redo: () => {
            this.clearSelectionProxy();
            for (const item of entries) {
              if (item.node.isDisposed()) continue;
              item.node.position.copyFrom(item.after.position);
              item.node.scaling.copyFrom(item.after.scaling);
              if (item.after.rotationQuaternion) {
                if (!item.node.rotationQuaternion) item.node.rotationQuaternion = Quaternion.Identity();
                item.node.rotationQuaternion.copyFrom(item.after.rotationQuaternion);
              } else {
                item.node.rotation.copyFrom(item.after.rotation);
              }
            }
            this.selectNodes(this.selectedNodes);
          },
        });
      }
      this.preDragSnapshots.clear();
      this.events.onSceneModified?.();
    };

    // Attach drag start/end hooks
    this.ensureGizmoDragEvents = () => {
      if (!this.gizmoManager || !this.gizmoManager.gizmos) return;
      const gizmoConfigs: Array<{ gizmo: any; name: string }> = [
        { gizmo: this.gizmoManager.gizmos.positionGizmo, name: 'Move' },
        { gizmo: this.gizmoManager.gizmos.rotationGizmo, name: 'Rotate' },
        { gizmo: this.gizmoManager.gizmos.scaleGizmo, name: 'Scale' },
        { gizmo: this.gizmoManager.gizmos.boundingBoxGizmo, name: 'Bounds' },
      ];

      for (const { gizmo, name } of gizmoConfigs) {
        if (!gizmo) continue;
        ['xGizmo', 'yGizmo', 'zGizmo', 'uniformGizmo', 'planeGizmo', 'xPlaneGizmo', 'yPlaneGizmo', 'zPlaneGizmo'].forEach((partName) => {
          const part = (gizmo as any)[partName];
          if (part && part.dragBehavior && !(part.dragBehavior as any)._editorDragHooked) {
            (part.dragBehavior as any)._editorDragHooked = true;
            part.dragBehavior.onDragStartObservable.add(() => {
              this.isGizmoDragging = true;
              this.updateGizmoSnapping();
              if (
                name === 'Move' &&
                this.facetEditorActive &&
                this.facetEditMode === 'vertex' &&
                this.selectedVertexIndex !== null &&
                this.vertexGizmoNode
              ) {
                this.onVertexDragStart();
              } else {
                capturePreDrag();
              }
            });
            if (name === 'Move') {
              part.dragBehavior.onDragObservable.add(() => {
                if (
                  this.facetEditorActive &&
                  this.facetEditMode === 'vertex' &&
                  this.selectedVertexIndex !== null &&
                  this.vertexGizmoNode
                ) {
                  this.handleVertexGizmoDrag();
                }
              });
            }
            part.dragBehavior.onDragEndObservable.add(() => {
              this.isGizmoDragging = false;
              if (
                name === 'Move' &&
                this.facetEditorActive &&
                this.facetEditMode === 'vertex' &&
                this.selectedVertexIndex !== null
              ) {
                this.onVertexDragEnd();
              } else {
                commitPostDrag(name);
              }
            });
          }
        });
      }
    };

    this.ensureGizmoDragEvents();

    // Pointer Picking for Mesh Selection & Facet Editing
    let pointerDownPos = { x: 0, y: 0 };
    let touchDownClient = { x: 0, y: 0 };
    const getTouchCanvasPoint = (evt: PointerEvent): { x: number; y: number } => {
      if (this.scene.pointerX !== 0 || this.scene.pointerY !== 0) {
        return { x: this.scene.pointerX, y: this.scene.pointerY };
      }
      const rect = this.canvas?.getBoundingClientRect?.();
      if (rect && rect.width > 0) {
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
      }
      return { x: evt.clientX ?? 0, y: evt.clientY ?? 0 };
    };
    const isMarqueeAllowed = (): boolean =>
      !this.isPlaceModeActive &&
      !this.facetEditorActive &&
      !this.voxelPainter?.isActive &&
      !this.pathExtrusion?.isActive &&
      !this.decalController?.isActive &&
      !this.textMeshController?.isSurfacePlacementActive &&
      !this.isSculptModeActive() &&
      !this.isWeightPaintModeActive() &&
      !this.isTexturePaintModeActive() &&
      !this.miniCadController?.isActive;

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (this.isSceneInteractionLocked) {
        return;
      }
      const rawEvt = pointerInfo.event as PointerEvent | MouseEvent | undefined;
      const isTouch = (rawEvt as PointerEvent | undefined)?.pointerType === 'touch';

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        pointerDownPos = { x: this.scene.pointerX, y: this.scene.pointerY };
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;

        const evt = rawEvt as PointerEvent | undefined;
        if (evt) {
          const isSnapKey = this.touchSnapActive || !!(evt.metaKey || evt.ctrlKey);
          if (this.isSnapModifierActive !== isSnapKey) {
            this.setSnapModifierActive(isSnapKey);
          }
        }
        const isLeftButton = evt ? evt.button === 0 : true;
        const pick = pointerInfo.pickInfo;
        const isGizmoHit = this.isGizmoMesh(pick?.pickedMesh);

        if (isTouch && evt) {
          const pid = typeof evt.pointerId === 'number' ? evt.pointerId : 0;
          const cx = evt.clientX ?? this.scene.pointerX;
          const cy = evt.clientY ?? this.scene.pointerY;
          this.activeTouchPointers.set(pid, { clientX: cx, clientY: cy });

          if (this.activeTouchPointers.size > 1) {
            this.isMarqueeCandidate = false;
            this.isMarqueeActive = false;
            this.hideMarqueeVisual();
            this.touchTapEligible = false;
            this.touchOrbitActive = false;
            this.touchLastSingleClient = null;
            this.touchLastPinchState = this.getTouchPinchState();
          } else {
            touchDownClient = { x: cx, y: cy };
            this.touchTapEligible = !isGizmoHit;
            const useTouchMarquee = this.touchDragMode === 'marquee' && !isGizmoHit && isMarqueeAllowed();
            if (useTouchMarquee) {
              this.isMarqueeCandidate = true;
              this.isMarqueeActive = false;
              this.marqueeStartPointer = getTouchCanvasPoint(evt);
              this.marqueeStartClient = { x: cx, y: cy };
              this.touchOrbitActive = false;
            } else {
              this.isMarqueeCandidate = false;
              this.isMarqueeActive = false;
              this.hideMarqueeVisual();
              this.touchOrbitActive = !isGizmoHit && !this.voxelPainter?.isActive;
            }
            this.touchLastSingleClient = { x: cx, y: cy };
            this.touchLastPinchState = null;
          }
          return;
        }

        if (isLeftButton && !isGizmoHit && isMarqueeAllowed()) {
          this.isMarqueeCandidate = true;
          this.isMarqueeActive = false;
          this.marqueeStartPointer = { x: this.scene.pointerX, y: this.scene.pointerY };
          this.marqueeStartClient = {
            x: evt?.clientX ?? this.scene.pointerX,
            y: evt?.clientY ?? this.scene.pointerY,
          };
        } else {
          this.isMarqueeCandidate = false;
          this.isMarqueeActive = false;
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;

        const evt = rawEvt as PointerEvent | undefined;
        if (evt) {
          const isSnapKey = this.touchSnapActive || !!(evt.metaKey || evt.ctrlKey);
          if (this.isSnapModifierActive !== isSnapKey) {
            this.setSnapModifierActive(isSnapKey);
          }
        }

        if (isTouch && evt) {
          const pid = typeof evt.pointerId === 'number' ? evt.pointerId : 0;
          const cx = evt.clientX ?? this.scene.pointerX;
          const cy = evt.clientY ?? this.scene.pointerY;
          if (this.activeTouchPointers.has(pid)) {
            this.activeTouchPointers.set(pid, { clientX: cx, clientY: cy });
          }

          if (this.activeTouchPointers.size >= 2) {
            this.isMarqueeCandidate = false;
            this.isMarqueeActive = false;
            this.hideMarqueeVisual();
            this.touchTapEligible = false;
            if (!this.isAnyGizmoDragging()) {
              const nextPinch = this.getTouchPinchState();
              if (nextPinch && this.touchLastPinchState) {
                this.zoomAndPanTouchCamera(
                  nextPinch.dist - this.touchLastPinchState.dist,
                  nextPinch.midX - this.touchLastPinchState.midX,
                  nextPinch.midY - this.touchLastPinchState.midY
                );
              }
              this.touchLastPinchState = nextPinch;
            }
          } else if (this.activeTouchPointers.size === 1) {
            const touchDist = Math.hypot(cx - touchDownClient.x, cy - touchDownClient.y);
            if (touchDist > 10) {
              this.touchTapEligible = false;
            }
            if (
              this.isMarqueeCandidate &&
              this.touchDragMode === 'marquee' &&
              !this.isAnyGizmoDragging() &&
              !this.isSculptModeActive() &&
              !this.isWeightPaintModeActive() &&
              !this.isTexturePaintModeActive()
            ) {
              if (touchDist > 8) {
                this.isMarqueeActive = true;
                this.updateMarqueeVisual(
                  this.marqueeStartClient.x,
                  this.marqueeStartClient.y,
                  cx,
                  cy
                );
              }
            } else if (
              this.touchOrbitActive &&
              this.touchLastSingleClient &&
              !this.isAnyGizmoDragging() &&
              !this.voxelPainter?.isActive &&
              !this.sculptController?.isStrokeActive &&
              !this.weightPaintController?.isStrokeActive &&
              !this.texturePaintController?.isStrokeActive
            ) {
              this.orbitTouchCamera(
                cx - this.touchLastSingleClient.x,
                cy - this.touchLastSingleClient.y
              );
            }
            this.touchLastSingleClient = { x: cx, y: cy };
          }
          return;
        }

        if (
          this.isMarqueeCandidate &&
          !this.isAnyGizmoDragging() &&
          !this.isSculptModeActive() &&
          !this.isWeightPaintModeActive() &&
          !this.isTexturePaintModeActive()
        ) {
          const dist = Math.hypot(
            this.scene.pointerX - this.marqueeStartPointer.x,
            this.scene.pointerY - this.marqueeStartPointer.y
          );
          if (dist > 6) {
            this.isMarqueeActive = true;
            this.updateMarqueeVisual(
              this.marqueeStartClient.x,
              this.marqueeStartClient.y,
              evt?.clientX ?? this.scene.pointerX,
              evt?.clientY ?? this.scene.pointerY
            );
          }
        }
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;

        const evt = rawEvt as PointerEvent | undefined;
        if (evt) {
          const isSnapKey = this.touchSnapActive || !!(evt.metaKey || evt.ctrlKey);
          if (this.isSnapModifierActive !== isSnapKey) {
            this.setSnapModifierActive(isSnapKey);
          }
        }

        const wasMarquee = this.isMarqueeActive;
        const startPointer = { ...this.marqueeStartPointer };
        this.isMarqueeCandidate = false;
        this.isMarqueeActive = false;
        this.hideMarqueeVisual();

        let dist = Math.hypot(
          this.scene.pointerX - pointerDownPos.x,
          this.scene.pointerY - pointerDownPos.y
        );

        let touchEndPoint: { x: number; y: number } | null = null;
        if (isTouch && evt) {
          const pid = typeof evt.pointerId === 'number' ? evt.pointerId : 0;
          const cx = evt.clientX ?? this.scene.pointerX;
          const cy = evt.clientY ?? this.scene.pointerY;
          dist = Math.hypot(cx - touchDownClient.x, cy - touchDownClient.y);
          touchEndPoint = getTouchCanvasPoint(evt);
          this.activeTouchPointers.delete(pid);
          if (this.activeTouchPointers.size < 2) {
            this.touchLastPinchState = null;
          }
          const allowTouchTap = this.touchTapEligible && dist <= 10;
          const allowTouchMarquee = wasMarquee && this.touchDragMode === 'marquee' && dist > 8;
          if (this.activeTouchPointers.size === 0) {
            this.touchOrbitActive = false;
            this.touchLastSingleClient = null;
            this.touchTapEligible = false;
          }
          if (!allowTouchTap && !allowTouchMarquee) {
            return;
          }
        }

        // If placement mode is active
        if (this.isPlaceModeActive) {
          this.handlePlacementPointer(pointerInfo);
          return;
        }

        // If facet editor is active
        if (this.facetEditorActive) {
          this.handleFacetPointer(pointerInfo);
          return;
        }

        // If voxel painter, path extrusion, decal painter, text surface placement, sculpt tool or weight paint is active, ignore default mesh selection
        if (
          this.voxelPainter?.isActive ||
          this.pathExtrusion?.isActive ||
          this.decalController?.isActive ||
          this.textMeshController?.isSurfacePlacementActive ||
          this.isSculptModeActive() ||
          this.isWeightPaintModeActive() ||
          this.isTexturePaintModeActive() ||
          this.miniCadController?.isActive
        ) {
          return;
        }

        const isAdditive =
          !!(evt && (evt.shiftKey || evt.metaKey || evt.ctrlKey)) ||
          (isTouch && this.touchMultiSelectActive);

        // If a marquee selection rectangle was dragged (> 6px desktop or > 8px touch marquee mode)
        if (wasMarquee && ((isTouch && dist > 8) || (!isTouch && dist > 6))) {
          const endPt = touchEndPoint ?? { x: this.scene.pointerX, y: this.scene.pointerY };
          const minX = Math.min(startPointer.x, endPt.x);
          const maxX = Math.max(startPointer.x, endPt.x);
          const minY = Math.min(startPointer.y, endPt.y);
          const maxY = Math.max(startPointer.y, endPt.y);

          this.selectMeshesInScreenRect(minX, minY, maxX, maxY, isAdditive);
          return;
        }

        if (!isTouch && dist > 6) return; // Camera orbit or drag, ignore click

        const pick = pointerInfo.pickInfo;

        if (pick && pick.hit && pick.pickedMesh) {
          const mesh = pick.pickedMesh as Mesh;
          if (this.isGizmoMesh(mesh)) {
            return;
          }
          if (this.isEditorHelper(mesh) || mesh === this.gridMesh) {
            if (!isAdditive) {
              this.selectNodes([]);
            }
            return;
          }

          let targetNode: TransformNode = mesh;
          if (mesh.parent && this.isGroupNode(mesh.parent)) {
            targetNode = mesh.parent as TransformNode;
          }

          if (isAdditive) {
            this.toggleNodeSelection(targetNode);
          } else {
            this.selectNodes([targetNode], false, pick.subMeshId);
          }
        } else {
          if (!isAdditive) {
            this.selectNodes([]);
          }
        }
      }
    });
  }

  private getTouchPinchState(): { midX: number; midY: number; dist: number } | null {
    if (this.activeTouchPointers.size < 2) return null;
    const pts = Array.from(this.activeTouchPointers.values());
    const p1 = pts[0];
    const p2 = pts[1];
    return {
      midX: (p1.clientX + p2.clientX) * 0.5,
      midY: (p1.clientY + p2.clientY) * 0.5,
      dist: Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY),
    };
  }

  private orbitTouchCamera(dx: number, dy: number): void {
    if (!this.camera || (dx === 0 && dy === 0)) return;
    const offset = this.camera.position.subtract(this.touchOrbitTarget);
    const radius = Math.max(0.1, offset.length());

    const rotSpeed = 0.0055;
    let theta = Math.atan2(offset.x, offset.z) + dx * rotSpeed;
    let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) - dy * rotSpeed;
    phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));

    const sinPhi = Math.sin(phi);
    this.camera.position.set(
      this.touchOrbitTarget.x + radius * sinPhi * Math.sin(theta),
      this.touchOrbitTarget.y + radius * Math.cos(phi),
      this.touchOrbitTarget.z + radius * sinPhi * Math.cos(theta)
    );
    this.camera.rotationQuaternion = null;
    this.camera.setTarget(this.touchOrbitTarget);
  }

  private zoomAndPanTouchCamera(dPinch: number, dMidX: number, dMidY: number): void {
    if (!this.camera) return;

    if (dMidX !== 0 || dMidY !== 0) {
      this.camera.computeWorldMatrix();
      const worldMat = this.camera.getWorldMatrix();
      const right = Vector3.TransformNormal(Vector3.Right(), worldMat).normalize();
      const up = Vector3.TransformNormal(Vector3.Up(), worldMat).normalize();
      const dist = Math.max(0.5, Vector3.Distance(this.camera.position, this.touchOrbitTarget));
      const panScale = dist * 0.0018;
      const panDelta = right.scale(-dMidX * panScale).addInPlace(up.scale(dMidY * panScale));
      this.camera.position.addInPlace(panDelta);
      this.touchOrbitTarget.addInPlace(panDelta);
    }

    if (dPinch !== 0) {
      const toCam = this.camera.position.subtract(this.touchOrbitTarget);
      const currentDist = Math.max(0.1, toCam.length());
      const zoomFactor = Math.max(0.5, Math.min(2.0, 1 - dPinch * 0.005));
      const nextDist = Math.max(0.15, Math.min(5000, currentDist * zoomFactor));
      toCam.normalize().scaleInPlace(nextDist);
      this.camera.position.copyFrom(this.touchOrbitTarget).addInPlace(toCam);
    }

    this.camera.rotationQuaternion = null;
    this.camera.setTarget(this.touchOrbitTarget);
  }

  public isGroupNode(node: any): boolean {
    if (!node) return false;
    if (this.groups.includes(node)) return true;
    return !!(node.metadata && node.metadata.isEditorGroup);
  }

  public getNodeLogicalParent(node: TransformNode | AbstractMesh): TransformNode | AbstractMesh | null {
    if (this.selectionProxyActive && node.parent === this.selectionProxyNode) {
      return this.selectionProxyMap.get(node as any) || null;
    }
    return (node.parent as any) || null;
  }

  public isEditorHelper(mesh: AbstractMesh | TransformNode): boolean {
    if (!mesh) return false;
    if ((mesh as any).metadata?.isBoneNode) return false;
    if (mesh === this.gridMesh || mesh === this.facetHighlightMesh) return true;
    const name = mesh.name || '';
    if (
      name.startsWith('editor_') ||
      name.startsWith('gizmo') ||
      name.startsWith('Lines') ||
      name === 'decal_projector_box' ||
      name === 'decal_preview_mesh'
    ) {
      return true;
    }
    return !!((mesh as any).metadata && (mesh as any).metadata.isEditorHelper);
  }

  public isInternalHelperMesh(mesh: AbstractMesh | TransformNode): boolean {
    return this.isEditorHelper(mesh);
  }

  public isAnyGizmoDragging(): boolean {
    if (this.isGizmoDragging) return true;
    const gm = this.gizmoManager;
    if (!gm || !gm.gizmos) return false;
    const gizmoList = [gm.gizmos.positionGizmo, gm.gizmos.rotationGizmo, gm.gizmos.scaleGizmo, gm.gizmos.boundingBoxGizmo];
    for (const g of gizmoList) {
      if (!g) continue;
      for (const partName of ['xGizmo', 'yGizmo', 'zGizmo', 'uniformGizmo', 'planeGizmo']) {
        const part = (g as any)[partName];
        if (part?.dragBehavior?.dragging) return true;
      }
    }
    return false;
  }

  public deactivateOtherInteractive3DTools(
    activeTool: 'facet' | 'sculpt' | 'decal' | 'voxel' | 'path' | 'uv' | 'weight' | 'text_place' | 'texture_paint' | 'minicad' | 'none'
  ): void {
    if (activeTool !== 'facet' && this.facetEditorActive) {
      this.toggleFacetEditor(false);
    }
    if (activeTool !== 'sculpt' && this.sculptController?.isActive) {
      this.sculptController.setActive(false);
    }
    if (activeTool !== 'decal' && this.decalController?.isActive) {
      this.decalController.setActive(false);
    }
    if (activeTool !== 'voxel' && this.voxelPainter?.isActive) {
      this.voxelPainter.setActive(false);
    }
    if (activeTool !== 'path' && this.pathExtrusion?.isActive) {
      this.pathExtrusion.setActive(false);
    }
    if (activeTool !== 'uv' && this.uvUnwrapController?.isActive) {
      this.uvUnwrapController.setActive(false);
    }
    if (activeTool !== 'weight' && this.weightPaintController?.isActive) {
      this.weightPaintController.setActive(false);
    }
    if (activeTool !== 'text_place' && this.textMeshController?.isSurfacePlacementActive) {
      this.textMeshController.setSurfacePlacementActive(false);
    }
    if (activeTool !== 'texture_paint' && this.texturePaintController?.isActive) {
      this.texturePaintController.setActive(false);
    }
    if (activeTool !== 'minicad' && this.miniCadController?.isActive) {
      this.miniCadController.setActive(false);
    }
  }

  public isSculptModeActive(): boolean {
    return Boolean(this.sculptController?.isActive) && !this.isSceneInteractionLocked;
  }

  public isWeightPaintModeActive(): boolean {
    return Boolean(this.weightPaintController?.isActive) && !this.isSceneInteractionLocked;
  }

  public isTexturePaintModeActive(): boolean {
    return Boolean(this.texturePaintController?.isActive) && !this.isSceneInteractionLocked;
  }

  public isGizmoMesh(mesh: Nullable<AbstractMesh | TransformNode>): boolean {
    if (!mesh) return false;
    if (mesh === this.gridMesh || mesh === this.facetHighlightMesh) return false;
    if (this.selectedNodes.includes(mesh as any)) return false;
    let curr: Nullable<any> = mesh;
    while (curr) {
      if (curr === this.selectionProxyNode) {
        return false;
      }
      const name = curr.name || '';
      if (
        name.toLowerCase().includes('gizmo') ||
        name.startsWith('Lines') ||
        curr.metadata?.isGizmo ||
        curr._isGizmo
      ) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  }

  public getMarqueeElement(): HTMLElement | null {
    if (!this.marqueeElement && typeof document !== 'undefined') {
      let el = document.getElementById('selectionMarquee');
      if (!el && this.canvas && this.canvas.parentElement) {
        el = document.createElement('div');
        el.id = 'selectionMarquee';
        el.className = 'selection-marquee';
        el.style.display = 'none';
        this.canvas.parentElement.appendChild(el);
      }
      this.marqueeElement = el;
    }
    return this.marqueeElement;
  }

  public updateMarqueeVisual(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number
  ): void {
    const el = this.getMarqueeElement();
    if (!el || !this.canvas) return;

    const parent = this.canvas.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect ? parent.getBoundingClientRect() : { left: 0, top: 0 };

    const x1 = startX - (parentRect.left || 0);
    const y1 = startY - (parentRect.top || 0);
    const x2 = currentX - (parentRect.left || 0);
    const y2 = currentY - (parentRect.top || 0);

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.display = 'block';
  }

  public hideMarqueeVisual(): void {
    const el = this.getMarqueeElement();
    if (el) {
      el.style.display = 'none';
    }
  }

  public getMeshesInScreenRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): TransformNode[] {
    const foundNodes = new Set<TransformNode>();
    if (!this.scene || !this.camera) return [];

    const vp = this.camera.viewport.toGlobal(
      this.engine.getRenderWidth(),
      this.engine.getRenderHeight()
    );
    const tm = this.scene.getTransformMatrix();
    const identity = Matrix.Identity();

    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof Mesh)) continue;
      if (mesh.isDisposed() || !mesh.isVisible || !mesh.isEnabled()) continue;
      if (this.isEditorHelper(mesh) || mesh === this.gridMesh || mesh === this.facetHighlightMesh) continue;
      if (mesh.getTotalVertices() === 0) continue;

      mesh.computeWorldMatrix(true);
      const bb = mesh.getBoundingInfo().boundingBox;

      let screenMinX = Infinity;
      let screenMaxX = -Infinity;
      let screenMinY = Infinity;
      let screenMaxY = -Infinity;
      let hasValidPoint = false;

      const points = [...bb.vectorsWorld, bb.centerWorld];
      for (const pt of points) {
        const proj = Vector3.Project(pt, identity, tm, vp);
        if (proj.z >= 0 && proj.z <= 1) {
          hasValidPoint = true;
          screenMinX = Math.min(screenMinX, proj.x);
          screenMaxX = Math.max(screenMaxX, proj.x);
          screenMinY = Math.min(screenMinY, proj.y);
          screenMaxY = Math.max(screenMaxY, proj.y);
        }
      }

      if (!hasValidPoint) continue;

      const overlaps = !(
        screenMaxX < minX ||
        screenMinX > maxX ||
        screenMaxY < minY ||
        screenMinY > maxY
      );

      if (overlaps) {
        let target: TransformNode = mesh;
        if (mesh.parent && this.isGroupNode(mesh.parent)) {
          target = mesh.parent as TransformNode;
        }
        foundNodes.add(target);
      }
    }

    return Array.from(foundNodes);
  }

  public selectMeshesInScreenRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    additive: boolean = false
  ): void {
    const nodesInRect = this.getMeshesInScreenRect(minX, minY, maxX, maxY);
    if (additive) {
      const merged = [...this.selectedNodes];
      for (const node of nodesInRect) {
        if (!merged.includes(node)) {
          merged.push(node);
        }
      }
      this.selectNodes(merged);
    } else {
      this.selectNodes(nodesInRect);
    }
  }

  public clearSelectionProxy(): void {
    if (!this.selectionProxyActive || !this.selectionProxyNode) return;
    this.selectionProxyNode.computeWorldMatrix(true);

    for (const [node, originalParent] of this.selectionProxyMap.entries()) {
      if (!node.isDisposed()) {
        node.setParent(originalParent ?? null);
      }
    }
    this.selectionProxyMap.clear();
    this.gizmoManager.attachToNode(null);
    this.selectionProxyNode.dispose();
    this.selectionProxyNode = null;
    this.selectionProxyActive = false;
  }

  public setupSelectionProxy(): void {
    this.clearSelectionProxy();
    const validNodes = this.selectedNodes.filter((n) => !n.isDisposed());
    if (validNodes.length <= 1) return;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const node of validNodes) {
      if (node instanceof AbstractMesh) {
        node.computeWorldMatrix(true);
        const bb = node.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
      } else if (node instanceof TransformNode) {
        for (const childMesh of node.getChildMeshes()) {
          childMesh.computeWorldMatrix(true);
          const bb = childMesh.getBoundingInfo().boundingBox;
          min = Vector3.Minimize(min, bb.minimumWorld);
          max = Vector3.Maximize(max, bb.maximumWorld);
        }
      }
    }

    const center = min.x !== Infinity ? min.add(max).scale(0.5) : Vector3.Zero();

    this.selectionProxyNode = new TransformNode('editor_selection_proxy', this.scene);
    (this.selectionProxyNode as any).metadata = { isEditorHelper: true };
    this.selectionProxyNode.position.copyFrom(center);
    this.selectionProxyNode.computeWorldMatrix(true);

    this.selectionProxyMap.clear();
    for (const node of validNodes) {
      this.selectionProxyMap.set(node, node.parent);
      node.setParent(this.selectionProxyNode);
    }

    this.selectionProxyActive = true;
    this.gizmoManager.attachToNode(this.isSceneInteractionLocked ? null : this.selectionProxyNode);
  }

  public consumeMarqueeEscape(e: KeyboardEvent): boolean {
    if (this.lastMarqueeEscapeEvent === e) {
      this.lastMarqueeEscapeEvent = null;
      return true;
    }
    return false;
  }

  private normalizeHexColor(hex: string, fallback: string): string {
    if (typeof hex !== 'string') return fallback;
    const trimmed = hex.trim();
    const match6 = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
    if (match6) return `#${match6[1].toLowerCase()}`;
    const match3 = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
    if (match3) {
      const [r, g, b] = match3[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
  }

  public getGridLineColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.gridLineColor, '#3299fd'));
  }

  public getGridFillColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.gridFillColor, '#ffffff'));
  }

  private applyGridAppearance(): void {
    if (!this.gridMaterial) return;
    const lineColor = this.getGridLineColor3();
    const fillColor = this.getGridFillColor3();
    const transparentFill = !!this.sceneParams.gridFillTransparent;
    this.gridMaterial.lineColor = lineColor;
    this.gridMaterial.linesOnly = transparentFill;
    if (transparentFill) {
      // In linesOnly mode, GridMaterial still mixes mainColor with lineColor on minor lines (0.45)
      // and antialiased edges, so matching mainColor to lineColor keeps all grid lines pure.
      this.gridMaterial.mainColor = lineColor.clone();
      this.gridMaterial.opacity = 1.0;
    } else {
      this.gridMaterial.mainColor = fillColor;
      this.gridMaterial.opacity = 0.65;
    }
    if (this.gridMesh && !this.gridMesh.isDisposed()) {
      this.gridMesh.alphaIndex = transparentFill ? -10 : Number.MAX_VALUE;
    }
  }

  public getMeshSelectionColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.meshSelectionColor, '#3399ff'));
  }

  public getFaceSelectionColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.faceSelectionColor, '#ffcc33'));
  }

  public getVertexColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.vertexColor, '#00d9ff'));
  }

  public getVertexSelectionColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.vertexSelectionColor, '#ffa61a'));
  }

  public getVoxelToolColor3(): Color3 {
    return Color3.FromHexString(this.normalizeHexColor(this.sceneParams.voxelToolColor, '#ffd91a'));
  }

  private applySelectionHighlights(): void {
    this.highlightLayer.removeAllMeshes();
    if (this.isWeightPaintModeActive()) return;
    const meshColor = this.getMeshSelectionColor3();
    const childColor = new Color3(
      Math.min(1, meshColor.r + 0.2),
      Math.min(1, meshColor.g + 0.2),
      Math.min(1, meshColor.b + 0.2)
    );
    for (const node of this.selectedNodes) {
      if (node.isDisposed()) continue;
      if (node instanceof Mesh) {
        if (!this.isEditorHelper(node) && !isGaussianSplatMesh(node)) {
          this.highlightLayer.addMesh(node, meshColor);
        }
      } else if (node instanceof TransformNode) {
        for (const child of node.getChildMeshes()) {
          if (!this.isEditorHelper(child) && child instanceof Mesh && !isGaussianSplatMesh(child)) {
            this.highlightLayer.addMesh(child, childColor);
          }
        }
      }
    }
  }

  public refreshVertexHandleColors(): void {
    const unselectedColor = this.getVertexColor3();
    const selectedColor = this.getVertexSelectionColor3();
    for (const handle of this.vertexHandles) {
      if (handle.isDisposed() || !(handle.material instanceof StandardMaterial)) continue;
      const indices: number[] = (handle as any).metadata?.vertexIndices || [];
      const isSelected =
        this.selectedVertexIndex !== null && indices.includes(this.selectedVertexIndex);
      handle.material.emissiveColor = (isSelected ? selectedColor : unselectedColor).clone();
    }
  }

  public selectNodes(nodes: TransformNode[], preserveSelection: boolean = false, subMeshId?: number | null): void {
    if (!preserveSelection) {
      this.clearSelectionProxy();
      this.highlightLayer.removeAllMeshes();
      this.selectedNodes = [];
    }

    for (const node of nodes) {
      if (node && !node.isDisposed() && !this.selectedNodes.includes(node)) {
        this.selectedNodes.push(node);
      }
    }

    if (nodes.length > 0) {
      this.lastClickedNode = nodes[nodes.length - 1];
    }

    this.applySelectionHighlights();

    if (this.selectedNodes.length === 0) {
      this.selectedMesh = null;
      this.selectedSubMeshId = null;
      this.gizmoManager.attachToNode(null);
      if (this.facetEditorActive) {
        this.clearVertexSelection();
        this.disposeVertexHandles();
        if (this.facetHighlightMesh) {
          this.facetHighlightMesh.dispose();
          this.facetHighlightMesh = null;
        }
        this.selectedFaceId = null;
        this.events.onFaceSelected?.(null);
      }
    } else if (this.selectedNodes.length === 1) {
      const single = this.selectedNodes[0];
      if (single instanceof Mesh) {
        this.selectedMesh = single;
        this.selectedSubMeshId = subMeshId !== undefined ? subMeshId : null;
      } else {
        this.selectedMesh = null;
        this.selectedSubMeshId = null;
      }
      if (this.facetEditorActive && this.facetEditMode === 'vertex') {
        this.refreshVertexHandles();
        if (this.selectedVertexIndex !== null && !this.isSceneInteractionLocked) {
          this.attachVertexGizmo();
        } else {
          this.gizmoManager.attachToNode(null);
        }
      } else {
        this.gizmoManager.attachToNode(this.isSceneInteractionLocked ? null : single);
      }
    } else {
      this.selectedMesh = null;
      this.selectedSubMeshId = null;
      this.setupSelectionProxy();
    }

    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
  }

  public selectMesh(mesh: Mesh | null, subMeshId?: number | null): void {
    if (mesh) {
      this.selectNodes([mesh], false, subMeshId);
    } else {
      this.selectNodes([]);
    }
  }

  public addMesh(mesh: Mesh): void {
    mesh.isPickable = true;
    if (mesh.material) {
      mesh.material.backFaceCulling = false;
    }
    if (!this.importedMeshes.includes(mesh)) {
      this.importedMeshes.push(mesh);
    }
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    this.selectMesh(mesh);
    this.updateStats();
    this.events.onSceneModified?.();
  }

  public toggleNodeSelection(node: TransformNode): void {
    const idx = this.selectedNodes.indexOf(node);
    if (idx !== -1) {
      const next = [...this.selectedNodes];
      next.splice(idx, 1);
      this.selectNodes(next);
    } else {
      this.selectNodes([...this.selectedNodes, node]);
    }
  }

  public rangeSelectNodes(node: TransformNode): void {
    if (!this.lastClickedNode || this.lastClickedNode === node) {
      this.selectNodes([node]);
      return;
    }
    const allVisible = this.getVisibleOutlinerNodes();
    const idxA = allVisible.indexOf(this.lastClickedNode);
    const idxB = allVisible.indexOf(node);
    if (idxA === -1 || idxB === -1) {
      this.selectNodes([node]);
      return;
    }
    const start = Math.min(idxA, idxB);
    const end = Math.max(idxA, idxB);
    const range = allVisible.slice(start, end + 1);
    this.selectNodes(range);
  }

  public getVisibleOutlinerNodes(): TransformNode[] {
    const list: TransformNode[] = [];
    for (const g of this.groups) {
      if (g.isDisposed()) continue;
      if (typeof g.isEnabled === 'function' && !g.isEnabled()) continue;
      list.push(g);
      for (const m of g.getChildren()) {
        if (m instanceof Mesh && !this.isEditorHelper(m) && (!m.isEnabled || m.isEnabled())) list.push(m);
      }
    }
    for (const m of this.importedMeshes) {
      if (!this.isEditorHelper(m) && !m.isDisposed() && (!m.isEnabled || m.isEnabled()) && (!m.parent || !this.isGroupNode(m.parent))) {
        list.push(m);
      }
    }
    return list;
  }

  /* =========================================================================
     3. UNDO / REDO HISTORY
     ========================================================================= */
  public isRecordingSuppressed(): boolean {
    return this.historySuppressionDepth > 0;
  }

  public runWithoutRecording<T>(fn: () => T): T {
    this.historySuppressionDepth++;
    try {
      return fn();
    } finally {
      this.historySuppressionDepth = Math.max(0, this.historySuppressionDepth - 1);
    }
  }

  public async runWithoutRecordingAsync<T>(fn: () => Promise<T>): Promise<T> {
    this.historySuppressionDepth++;
    try {
      return await fn();
    } finally {
      this.historySuppressionDepth = Math.max(0, this.historySuppressionDepth - 1);
    }
  }

  /**
   * Begins capturing any recorded actions into a temporary batch instead of
   * pushing them individually to the main undo stack.
   */
  public beginActionCapture(): void {
    this.capturedActionBatches.push([]);
  }

  /**
   * Ends the most recent action capture and returns all captured sub-actions.
   */
  public endActionCapture(): ActionRecord[] {
    return this.capturedActionBatches.pop() ?? [];
  }

  public recordAction(action: ActionRecord): void {
    if (this.historySuppressionDepth > 0) return;
    if (this.capturedActionBatches.length > 0) {
      this.capturedActionBatches[this.capturedActionBatches.length - 1].push(action);
      return;
    }
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistorySteps) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.events.onHistoryChanged?.(this.canUndo(), this.canRedo());
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop()!;
    this.runWithoutRecording(() => {
      action.undo();
    });
    this.redoStack.push(action);
    this.events.onHistoryChanged?.(this.canUndo(), this.canRedo());
    this.events.onToast?.(`Undo: ${action.name}`, 'info');
    this.updateStats();
    this.events.onSceneModified?.();
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop()!;
    this.runWithoutRecording(() => {
      action.redo();
    });
    this.undoStack.push(action);
    this.events.onHistoryChanged?.(this.canUndo(), this.canRedo());
    this.events.onToast?.(`Redo: ${action.name}`, 'info');
    this.updateStats();
    this.events.onSceneModified?.();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /* =========================================================================
     4. GROUPING & HIERARCHY
     ========================================================================= */
  public groupSelected(): TransformNode | null {
    const validTargets = this.selectedNodes.filter((n) => !n.isDisposed());
    if (validTargets.length <= 1) {
      this.events.onToast?.('Select at least 2 meshes or groups to group them.', 'info');
      return null;
    }

    this.clearSelectionProxy();
    this.groupCounter++;
    const groupName = `Group_${this.groupCounter}`;
    const group = new TransformNode(groupName, this.scene);
    (group as any).metadata = { isEditorGroup: true };

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const node of validTargets) {
      if (node instanceof AbstractMesh) {
        node.computeWorldMatrix(true);
        const bb = node.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
      } else if (node instanceof TransformNode) {
        for (const childMesh of node.getChildMeshes()) {
          childMesh.computeWorldMatrix(true);
          const bb = childMesh.getBoundingInfo().boundingBox;
          min = Vector3.Minimize(min, bb.minimumWorld);
          max = Vector3.Maximize(max, bb.maximumWorld);
        }
      }
    }

    const center = min.x !== Infinity ? min.add(max).scale(0.5) : Vector3.Zero();
    group.position.copyFrom(center);

    const oldParents = new Map<TransformNode, Nullable<any>>();
    for (const node of validTargets) {
      oldParents.set(node, node.parent);
      node.setParent(group);
    }

    this.groups.push(group);

    this.recordAction({
      name: `Create ${groupName}`,
      undo: () => {
        this.clearSelectionProxy();
        for (const [node, originalParent] of oldParents.entries()) {
          node.setParent(originalParent ?? null);
        }
        const idx = this.groups.indexOf(group);
        if (idx !== -1) this.groups.splice(idx, 1);
        group.setEnabled(false);
        this.selectNodes(validTargets);
      },
      redo: () => {
        this.clearSelectionProxy();
        group.setEnabled(true);
        if (!this.groups.includes(group)) this.groups.push(group);
        for (const node of validTargets) {
          node.setParent(group);
        }
        this.selectNodes([group]);
      },
    });

    this.selectNodes([group]);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Grouped ${validTargets.length} objects into "${groupName}"!`, 'success');
    return group;
  }

  public ungroupSelected(): void {
    const groupsToUngroup = this.selectedNodes.filter((n) => this.isGroupNode(n)) as TransformNode[];
    if (groupsToUngroup.length === 0) {
      this.events.onToast?.('Please select a group to ungroup.', 'info');
      return;
    }

    this.clearSelectionProxy();
    const unpackedAll: TransformNode[] = [];

    for (const group of groupsToUngroup) {
      const childList = group.getChildren().filter((c): c is TransformNode => c instanceof TransformNode);
      const parent = group.parent;

      for (const child of childList) {
        (child as any).setParent(parent ?? null);
        unpackedAll.push(child);
      }

      const idx = this.groups.indexOf(group);
      if (idx !== -1) this.groups.splice(idx, 1);
      group.setEnabled(false);

      this.recordAction({
        name: `Ungroup ${group.name}`,
        undo: () => {
          this.clearSelectionProxy();
          group.setEnabled(true);
          if (!this.groups.includes(group)) this.groups.push(group);
          for (const child of childList) {
            (child as any).setParent(group);
          }
          this.selectNodes([group]);
        },
        redo: () => {
          this.clearSelectionProxy();
          for (const child of childList) {
            (child as any).setParent(parent ?? null);
          }
          const gIdx = this.groups.indexOf(group);
          if (gIdx !== -1) this.groups.splice(gIdx, 1);
          group.setEnabled(false);
          this.selectNodes(childList);
        },
      });
    }

    this.selectNodes(unpackedAll);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Ungrouped ${groupsToUngroup.length} group(s)!`, 'success');
  }

  /* =========================================================================
     5. CLIPBOARD & DUPLICATE
     ========================================================================= */
  public copySelected(): void {
    const targets = this.selectedNodes.length > 0 ? this.selectedNodes : this.selectedMesh ? [this.selectedMesh] : [];
    if (targets.length === 0) {
      this.events.onToast?.('No mesh or group selected to copy.', 'info');
      return;
    }
    this.clipboardNodes = [...targets];
    const label = targets.length === 1 ? `"${targets[0].name}"` : `${targets.length} objects`;
    this.events.onToast?.(`Copied ${label} to clipboard (Cmd+V to paste at cursor)`, 'info');
  }

  public pasteAtCursor(pointerX?: number, pointerY?: number): TransformNode[] {
    if (this.clipboardNodes.length === 0) {
      if (this.clipboardMesh && !this.clipboardMesh.isDisposed()) {
        this.clipboardNodes = [this.clipboardMesh];
      } else {
        this.events.onToast?.('Clipboard is empty. Copy something first (Cmd+C).', 'warning');
        return [];
      }
    }

    this.clearSelectionProxy();

    const px = pointerX !== undefined ? pointerX : this.lastPointerX || this.scene.pointerX;
    const py = pointerY !== undefined ? pointerY : this.lastPointerY || this.scene.pointerY;

    const pick = this.scene.pick(px, py, (m) => m === this.gridMesh || (!this.isEditorHelper(m) && m.isPickable));

    let targetPos: Vector3;
    if (pick && pick.hit && pick.pickedPoint) {
      targetPos = pick.pickedPoint.clone();
    } else {
      const ray = this.scene.createPickingRay(px, py, Matrix.Identity(), this.camera);
      const groundPlane = Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up());
      const dist = ray.intersectsPlane(groundPlane);
      if (dist !== null && dist > 0 && isFinite(dist)) {
        targetPos = ray.origin.add(ray.direction.scale(dist));
      } else {
        targetPos = new Vector3(1, 0, 1);
      }
    }

    // Compute center of clipboard items
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const node of this.clipboardNodes) {
      if (node instanceof AbstractMesh) {
        node.computeWorldMatrix(true);
        const bb = node.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
      } else if (node instanceof TransformNode) {
        for (const cm of node.getChildMeshes()) {
          cm.computeWorldMatrix(true);
          const bb = cm.getBoundingInfo().boundingBox;
          min = Vector3.Minimize(min, bb.minimumWorld);
          max = Vector3.Maximize(max, bb.maximumWorld);
        }
      }
    }
    const clipCenter = min.x !== Infinity ? min.add(max).scale(0.5) : Vector3.Zero();
    const delta = targetPos.subtract(clipCenter);

    const pastedNodes: TransformNode[] = [];
    const pastedMeshes: Mesh[] = [];
    const pastedGroups: TransformNode[] = [];

    const makeMeshHierarchyGeometryUnique = (rootMesh: Mesh): void => {
      rootMesh.makeGeometryUnique();
      for (const childMesh of rootMesh.getChildMeshes()) {
        if (childMesh instanceof Mesh) {
          childMesh.makeGeometryUnique();
        }
      }
    };

    const cloneGroupForPaste = (
      sourceGroup: TransformNode,
      parentNode: Nullable<any>,
      worldDelta?: Vector3
    ): TransformNode => {
      const groupCloneName = `${sourceGroup.name}_copy_${Date.now().toString().slice(-4)}`;
      const groupClone = new TransformNode(groupCloneName, this.scene);
      (groupClone as any).metadata = { isEditorGroup: true };
      groupClone.parent = parentNode ?? null;
      groupClone.position.copyFrom(sourceGroup.position);
      if (sourceGroup.rotationQuaternion) {
        groupClone.rotationQuaternion = sourceGroup.rotationQuaternion.clone();
      } else {
        groupClone.rotation.copyFrom(sourceGroup.rotation);
      }
      groupClone.scaling.copyFrom(sourceGroup.scaling);

      if (worldDelta) {
        sourceGroup.computeWorldMatrix(true);
        groupClone.computeWorldMatrix(true);
        groupClone.setAbsolutePosition(sourceGroup.getAbsolutePosition().add(worldDelta));
      }

      for (const child of sourceGroup.getChildren()) {
        if (this.isGroupNode(child)) {
          const subClone = cloneGroupForPaste(child as TransformNode, groupClone);
          this.groups.push(subClone);
          pastedGroups.push(subClone);
        } else if (child instanceof Mesh) {
          const childClone = child.clone(`${child.name}_copy_${Date.now().toString().slice(-4)}`, groupClone);
          if (childClone) {
            makeMeshHierarchyGeometryUnique(childClone);
            this.importedMeshes.push(childClone);
            pastedMeshes.push(childClone);
          }
        }
      }
      return groupClone;
    };

    for (const item of this.clipboardNodes) {
      if (item.isDisposed()) continue;

      if (this.isGroupNode(item)) {
        const groupClone = cloneGroupForPaste(item, item.parent, delta);
        this.groups.push(groupClone);
        pastedGroups.push(groupClone);
        pastedNodes.push(groupClone);
      } else if (item instanceof Mesh) {
        const uniqueName = `${item.name}_copy_${Date.now().toString().slice(-4)}`;
        const isSplat = isGaussianSplatMesh(item);
        const cloned = isSplat ? (item.clone(uniqueName) as Mesh) : item.clone(uniqueName, item.parent);
        if (cloned) {
          if (isSplat) {
            cloned.parent = item.parent ?? null;
          } else {
            // Detach cloned geometry from the original mesh before centering pivot or editing vertices.
            makeMeshHierarchyGeometryUnique(cloned);
          }
          item.computeWorldMatrix(true);
          cloned.computeWorldMatrix(true);
          cloned.setAbsolutePosition(item.getAbsolutePosition().add(delta));
          this.importedMeshes.push(cloned);
          if (!isSplat) {
            this.centerMeshPivot(cloned);
          }
          pastedMeshes.push(cloned);
          pastedNodes.push(cloned);
        }
      }
    }

    if (pastedNodes.length === 0) {
      this.events.onToast?.('Could not paste items.', 'error');
      return [];
    }

    this.recordAction({
      name: `Paste ${pastedNodes.length} object(s)`,
      undo: () => {
        this.clearSelectionProxy();
        for (const m of pastedMeshes) {
          const idx = this.importedMeshes.indexOf(m);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
          m.setEnabled(false);
        }
        for (const g of pastedGroups) {
          const idx = this.groups.indexOf(g);
          if (idx !== -1) this.groups.splice(idx, 1);
          g.setEnabled(false);
        }
        this.selectNodes([]);
      },
      redo: () => {
        this.clearSelectionProxy();
        for (const m of pastedMeshes) {
          if (!this.importedMeshes.includes(m)) this.importedMeshes.push(m);
          m.setEnabled(true);
        }
        for (const g of pastedGroups) {
          if (!this.groups.includes(g)) this.groups.push(g);
          g.setEnabled(true);
        }
        this.selectNodes(pastedNodes);
      },
    });

    this.selectNodes(pastedNodes);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Pasted ${pastedNodes.length} object(s) at cursor!`, 'success');
    return pastedNodes;
  }

  public duplicateSelectedMesh(): void {
    if (this.selectedNodes.length > 0) {
      this.clipboardNodes = [...this.selectedNodes];
      this.pasteAtCursor(this.scene.pointerX + 30, this.scene.pointerY + 30);
    } else if (this.selectedMesh) {
      this.clipboardNodes = [this.selectedMesh];
      this.pasteAtCursor(this.scene.pointerX + 30, this.scene.pointerY + 30);
    } else {
      this.events.onToast?.('Please select a mesh to duplicate.', 'info');
    }
  }

  public collectNodeAndDescendants(node: TransformNode | AbstractMesh): { meshes: Mesh[]; transformNodes: TransformNode[] } {
    const meshes: Mesh[] = [];
    const transformNodes: TransformNode[] = [];

    const recurse = (current: any) => {
      if (!current || this.isEditorHelper(current) || current.isDisposed()) return;
      if (current instanceof Mesh) {
        if (!meshes.includes(current)) meshes.push(current);
      } else if (current instanceof TransformNode) {
        if (!transformNodes.includes(current)) transformNodes.push(current);
      }
      const children = current.getChildren ? current.getChildren() : [];
      for (const c of children) {
        recurse(c);
      }
    };
    recurse(node);
    return { meshes, transformNodes };
  }

  public deleteSelected(): void {
    const nodesToDelete =
      this.selectedNodes.length > 0
        ? [...this.selectedNodes]
        : this.selectedMesh
        ? [this.selectedMesh]
        : [];

    if (nodesToDelete.length === 0) {
      this.events.onToast?.('No mesh or group selected to delete.', 'info');
      return;
    }

    this.clearSelectionProxy();

    const affectedMeshes: Mesh[] = [];
    const affectedTransformNodes: TransformNode[] = [];

    for (const node of nodesToDelete) {
      const { meshes, transformNodes } = this.collectNodeAndDescendants(node);
      for (const m of meshes) {
        if (!affectedMeshes.includes(m)) affectedMeshes.push(m);
      }
      for (const tn of transformNodes) {
        if (!affectedTransformNodes.includes(tn)) affectedTransformNodes.push(tn);
      }
    }

    for (const m of affectedMeshes) {
      m.setEnabled(false);
      const idx = this.importedMeshes.indexOf(m);
      if (idx !== -1) this.importedMeshes.splice(idx, 1);
    }
    for (const tn of affectedTransformNodes) {
      tn.setEnabled(false);
      const idx = this.groups.indexOf(tn);
      if (idx !== -1) this.groups.splice(idx, 1);
    }

    this.selectNodes([]);

    this.recordAction({
      name: `Delete ${nodesToDelete.length} object(s)`,
      undo: () => {
        for (const m of affectedMeshes) {
          m.setEnabled(true);
          if (!this.importedMeshes.includes(m)) this.importedMeshes.push(m);
        }
        for (const tn of affectedTransformNodes) {
          tn.setEnabled(true);
          if (this.isGroupNode(tn) && !this.groups.includes(tn)) this.groups.push(tn);
        }
        this.selectNodes(nodesToDelete);
      },
      redo: () => {
        this.clearSelectionProxy();
        for (const m of affectedMeshes) {
          m.setEnabled(false);
          const idx = this.importedMeshes.indexOf(m);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
        }
        for (const tn of affectedTransformNodes) {
          tn.setEnabled(false);
          const idx = this.groups.indexOf(tn);
          if (idx !== -1) this.groups.splice(idx, 1);
        }
        this.selectNodes([]);
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Deleted ${nodesToDelete.length} object(s).`, 'success');
  }

  /* =========================================================================
     6. TRANSFORMS & PIVOTS
     ========================================================================= */
  public snapSelectedToGround(): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Select a mesh to snap to ground.', 'info');
      return;
    }
    const mesh = this.selectedMesh;
    const prevY = mesh.position.y;
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    const lowestY = bounds.minimumWorld.y;
    const nextY = prevY - lowestY;
    mesh.position.y = nextY;

    if (Math.abs(nextY - prevY) > 1e-6) {
      this.recordAction({
        name: `Snap "${mesh.name}" to Ground`,
        undo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.y = prevY;
          mesh.computeWorldMatrix(true);
        },
        redo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.y = nextY;
          mesh.computeWorldMatrix(true);
        },
      });
    }

    this.events.onSceneModified?.();
    this.events.onToast?.('Snapped mesh to ground plane.', 'success');
  }

  public centerSelectedToOrigin(): void {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const prevPos = mesh.position.clone();
    mesh.position.set(0, 0, 0);

    if (prevPos.lengthSquared() > 1e-10) {
      this.recordAction({
        name: `Center "${mesh.name}" to Origin`,
        undo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.copyFrom(prevPos);
          mesh.computeWorldMatrix(true);
        },
        redo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.set(0, 0, 0);
          mesh.computeWorldMatrix(true);
        },
      });
    }

    this.events.onSceneModified?.();
    this.events.onToast?.('Moved mesh to world origin (0, 0, 0).', 'info');
  }

  public centerMeshPivot(mesh: Mesh): void {
    if (!mesh || mesh.isDisposed() || isGaussianSplatMesh(mesh)) return;
    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const center = bb.centerWorld.clone();

    const delta = center.subtract(mesh.getAbsolutePosition());
    if (delta.lengthSquared() < 1e-10) return;

    mesh.makeGeometryUnique();
    mesh.setAbsolutePosition(center);

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const invMat = Matrix.Invert(mesh.getWorldMatrix());
      const localDelta = Vector3.TransformNormal(delta, invMat);

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] -= localDelta.x;
        positions[i + 1] -= localDelta.y;
        positions[i + 2] -= localDelta.z;
      }
      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
    }
  }

  public centerSelectedPivot(): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const beforePos = mesh.position.clone();
    const beforeVerts = mesh.getVerticesData(VertexBuffer.PositionKind);
    const beforeVertsCopy = beforeVerts ? Array.from(beforeVerts) : null;

    this.centerMeshPivot(mesh);

    const afterPos = mesh.position.clone();
    const afterVerts = mesh.getVerticesData(VertexBuffer.PositionKind);
    const afterVertsCopy = afterVerts ? Array.from(afterVerts) : null;

    if (Vector3.DistanceSquared(beforePos, afterPos) > 1e-10) {
      this.recordAction({
        name: `Center Pivot "${mesh.name}"`,
        undo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.copyFrom(beforePos);
          if (beforeVertsCopy) mesh.setVerticesData(VertexBuffer.PositionKind, [...beforeVertsCopy], true);
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo();
        },
        redo: () => {
          if (mesh.isDisposed()) return;
          mesh.position.copyFrom(afterPos);
          if (afterVertsCopy) mesh.setVerticesData(VertexBuffer.PositionKind, [...afterVertsCopy], true);
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo();
        },
      });
    }

    this.selectMesh(mesh);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Pivot centered to visual geometry for "${mesh.name}".`, 'success');
  }

  public centerAllMeshPivots(): void {
    const entries: Array<{
      mesh: Mesh;
      beforePos: Vector3;
      beforeVerts: number[] | null;
      afterPos: Vector3;
      afterVerts: number[] | null;
    }> = [];

    let count = 0;
    for (const mesh of this.importedMeshes) {
      if (!this.isEditorHelper(mesh) && !mesh.isDisposed()) {
        const beforePos = mesh.position.clone();
        const bv = mesh.getVerticesData(VertexBuffer.PositionKind);
        const beforeVerts = bv ? Array.from(bv) : null;

        this.centerMeshPivot(mesh);
        count++;

        const afterPos = mesh.position.clone();
        const av = mesh.getVerticesData(VertexBuffer.PositionKind);
        const afterVerts = av ? Array.from(av) : null;

        if (Vector3.DistanceSquared(beforePos, afterPos) > 1e-10) {
          entries.push({ mesh, beforePos, beforeVerts, afterPos, afterVerts });
        }
      }
    }

    if (entries.length > 0) {
      this.recordAction({
        name: `Center All Pivots (${entries.length} meshes)`,
        undo: () => {
          for (const e of entries) {
            if (e.mesh.isDisposed()) continue;
            e.mesh.position.copyFrom(e.beforePos);
            if (e.beforeVerts) e.mesh.setVerticesData(VertexBuffer.PositionKind, [...e.beforeVerts], true);
            e.mesh.computeWorldMatrix(true);
            e.mesh.refreshBoundingInfo();
          }
        },
        redo: () => {
          for (const e of entries) {
            if (e.mesh.isDisposed()) continue;
            e.mesh.position.copyFrom(e.afterPos);
            if (e.afterVerts) e.mesh.setVerticesData(VertexBuffer.PositionKind, [...e.afterVerts], true);
            e.mesh.computeWorldMatrix(true);
            e.mesh.refreshBoundingInfo();
          }
        },
      });
    }

    this.selectNodes(this.selectedNodes);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Centered pivots for ${count} meshes in scene!`, 'success');
  }

  public bakeSelectedTransform(): void {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const beforeTransform: TransformSnapshot = {
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
      scaling: mesh.scaling.clone(),
    };

    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();

    const afterSnap = captureMeshSurfaceSnapshot(mesh);
    const afterTransform: TransformSnapshot = {
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
      scaling: mesh.scaling.clone(),
    };

    const applyTransform = (t: TransformSnapshot) => {
      mesh.position.copyFrom(t.position);
      mesh.rotation.copyFrom(t.rotation);
      mesh.rotationQuaternion = t.rotationQuaternion ? t.rotationQuaternion.clone() : null;
      mesh.scaling.copyFrom(t.scaling);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
    };

    this.recordAction({
      name: `Bake Transform "${mesh.name}"`,
      undo: () => {
        if (mesh.isDisposed()) return;
        restoreMeshSurfaceSnapshot(mesh, beforeSnap);
        applyTransform(beforeTransform);
      },
      redo: () => {
        if (mesh.isDisposed()) return;
        restoreMeshSurfaceSnapshot(mesh, afterSnap);
        applyTransform(afterTransform);
      },
    });

    this.events.onSceneModified?.();
    this.events.onToast?.('Current transforms baked into mesh geometry.', 'success');
  }

  /* =========================================================================
     WIREFRAME UTILITIES
     ========================================================================= */
  public isMeshWireframe(mesh: Mesh): boolean {
    if (!mesh || mesh.isDisposed()) return false;
    if (mesh.material) {
      return !!(mesh.material as any).wireframe;
    }
    return false;
  }

  public setMeshWireframe(mesh: Mesh, wireframe: boolean): void {
    if (!mesh || mesh.isDisposed() || isGaussianSplatMesh(mesh)) return;
    const prevMat = mesh.material;
    const prevWireframe = this.isMeshWireframe(mesh);
    if (prevMat && prevWireframe === wireframe) return;

    if (!mesh.material) {
      const mat = new StandardMaterial(`${mesh.name}_wiremat`, this.scene);
      mat.diffuseColor = new Color3(0.85, 0.85, 0.85);
      mesh.material = mat;
    } else {
      const sharing = this.importedMeshes.filter((m) => m !== mesh && m.material === mesh.material);
      if (sharing.length > 0) {
        mesh.material = mesh.material.clone(`${mesh.name}_wireframe_mat`);
      }
    }
    const nextMat = mesh.material;
    (nextMat as any).wireframe = wireframe;

    this.recordAction({
      name: `${wireframe ? 'Enable' : 'Disable'} Wireframe "${mesh.name}"`,
      undo: () => {
        if (mesh.isDisposed()) return;
        mesh.material = prevMat;
        if (prevMat) (prevMat as any).wireframe = prevWireframe;
      },
      redo: () => {
        if (mesh.isDisposed()) return;
        mesh.material = nextMat;
        if (nextMat) (nextMat as any).wireframe = wireframe;
      },
    });

    this.events.onSceneModified?.();
  }

  public toggleMeshWireframe(mesh: Mesh): boolean {
    const next = !this.isMeshWireframe(mesh);
    this.setMeshWireframe(mesh, next);
    return next;
  }

  public toggleSelectedWireframe(): boolean {
    const targets: Mesh[] = [];
    for (const node of this.selectedNodes) {
      if (node instanceof Mesh && !this.isEditorHelper(node)) {
        targets.push(node);
      } else {
        for (const child of node.getChildMeshes()) {
          if (child instanceof Mesh && !this.isEditorHelper(child)) {
            targets.push(child);
          }
        }
      }
    }
    if (targets.length === 0 && this.selectedMesh) {
      targets.push(this.selectedMesh);
    }
    if (targets.length === 0) {
      this.events.onToast?.('Please select a mesh first to toggle wireframe.', 'warning');
      return false;
    }

    const anyNotWireframe = targets.some((m) => !this.isMeshWireframe(m));
    const entries = targets.map((m) => ({
      mesh: m,
      prevMat: m.material,
      prevWireframe: this.isMeshWireframe(m),
      nextMat: m.material as Material | null,
    }));

    this.runWithoutRecording(() => {
      for (const e of entries) {
        this.setMeshWireframe(e.mesh, anyNotWireframe);
        e.nextMat = e.mesh.material;
      }
    });

    this.recordAction({
      name: `${anyNotWireframe ? 'Enable' : 'Disable'} Wireframe (${targets.length} mesh${targets.length === 1 ? '' : 'es'})`,
      undo: () => {
        for (const e of entries) {
          if (e.mesh.isDisposed()) continue;
          e.mesh.material = e.prevMat;
          if (e.prevMat) (e.prevMat as any).wireframe = e.prevWireframe;
        }
      },
      redo: () => {
        for (const e of entries) {
          if (e.mesh.isDisposed()) continue;
          e.mesh.material = e.nextMat;
          if (e.nextMat) (e.nextMat as any).wireframe = anyNotWireframe;
        }
      },
    });

    this.events.onToast?.(`Wireframe ${anyNotWireframe ? 'enabled' : 'disabled'} for ${targets.length} mesh(es)`, 'info');
    this.events.onSceneModified?.();
    return anyNotWireframe;
  }

  public setMeshRotationDegrees(mesh: Mesh, axis: 'x' | 'y' | 'z', degrees: number): void {
    const rad = (degrees * Math.PI) / 180;
    if (mesh.rotationQuaternion) {
      const euler = mesh.rotationQuaternion.toEulerAngles();
      euler[axis] = rad;
      mesh.rotationQuaternion = Quaternion.FromEulerVector(euler);
    } else {
      mesh.rotation[axis] = rad;
    }
  }

  public getMeshRotationDegrees(mesh: Mesh): Vector3 {
    if (mesh.rotationQuaternion) {
      const euler = mesh.rotationQuaternion.toEulerAngles();
      return new Vector3(
        (euler.x * 180) / Math.PI,
        (euler.y * 180) / Math.PI,
        (euler.z * 180) / Math.PI
      );
    }
    return new Vector3(
      (mesh.rotation.x * 180) / Math.PI,
      (mesh.rotation.y * 180) / Math.PI,
      (mesh.rotation.z * 180) / Math.PI
    );
  }

  /* =========================================================================
     7. SUBMESHES & LOOSE PARTS
     ========================================================================= */
  public separateMeshLooseParts(sourceMesh: Mesh): Mesh[] {
    if (!sourceMesh || sourceMesh.isDisposed()) return [];

    const positions = sourceMesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = sourceMesh.getIndices();

    if (!positions || !indices || indices.length < 3) {
      return [sourceMesh];
    }

    const normals = sourceMesh.getVerticesData(VertexBuffer.NormalKind);
    const uvs = sourceMesh.getVerticesData(VertexBuffer.UVKind);
    const uv2s = sourceMesh.getVerticesData(VertexBuffer.UV2Kind);
    const tangents = sourceMesh.getVerticesData(VertexBuffer.TangentKind);
    const colors = sourceMesh.getVerticesData(VertexBuffer.ColorKind);

    const vertexCount = positions.length / 3;
    const triangleCount = indices.length / 3;

    // Disjoint-set union-find for connected triangle clusters
    const parent = new Int32Array(triangleCount);
    for (let i = 0; i < triangleCount; i++) parent[i] = i;

    const find = (i: number): number => {
      let root = i;
      while (root !== parent[root]) root = parent[root];
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    };

    const union = (i: number, j: number) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    // Quantize 3D positions to bridge split normals, UV seams, and color seams
    const vertToPosId = new Int32Array(vertexCount);
    const posMap = new Map<string, number>();

    for (let v = 0; v < vertexCount; v++) {
      const x = Math.round(positions[v * 3] * 10000);
      const y = Math.round(positions[v * 3 + 1] * 10000);
      const z = Math.round(positions[v * 3 + 2] * 10000);
      const key = `${x}_${y}_${z}`;
      let pid = posMap.get(key);
      if (pid === undefined) {
        pid = posMap.size;
        posMap.set(key, pid);
      }
      vertToPosId[v] = pid;
    }

    // Connect triangles that share an edge in 3D space
    const edgeToTriangles = new Map<string, number[]>();
    for (let t = 0; t < triangleCount; t++) {
      const p0 = vertToPosId[indices[t * 3]];
      const p1 = vertToPosId[indices[t * 3 + 1]];
      const p2 = vertToPosId[indices[t * 3 + 2]];

      const e0 = p0 < p1 ? `${p0}_${p1}` : `${p1}_${p0}`;
      const e1 = p1 < p2 ? `${p1}_${p2}` : `${p2}_${p1}`;
      const e2 = p2 < p0 ? `${p2}_${p0}` : `${p0}_${p2}`;

      for (const edgeKey of [e0, e1, e2]) {
        let arr = edgeToTriangles.get(edgeKey);
        if (!arr) {
          arr = [];
          edgeToTriangles.set(edgeKey, arr);
        }
        arr.push(t);
      }
    }

    for (const [, triList] of edgeToTriangles) {
      const first = triList[0];
      for (let k = 1; k < triList.length; k++) {
        union(first, triList[k]);
      }
    }

    const clusters = new Map<number, number[]>();
    for (let t = 0; t < triangleCount; t++) {
      const root = find(t);
      let arr = clusters.get(root);
      if (!arr) {
        arr = [];
        clusters.set(root, arr);
      }
      arr.push(t);
    }

    if (clusters.size <= 1) {
      return [sourceMesh];
    }

    const separatedMeshes: Mesh[] = [];
    const baseName = sourceMesh.name.replace(/_part\d+$/, '');
    let partNum = 1;

    // Submesh & Material mapping
    const sourceSubMeshes = sourceMesh.subMeshes || [];
    const isMultiMat = sourceMesh.material instanceof MultiMaterial;
    const multiMat = isMultiMat ? (sourceMesh.material as MultiMaterial) : null;

    const getTriangleMaterialInfo = (t: number): { materialIndex: number; material: Material | null } => {
      const offset = t * 3;
      if (sourceSubMeshes.length > 0) {
        for (const sm of sourceSubMeshes) {
          if (offset >= sm.indexStart && offset < sm.indexStart + sm.indexCount) {
            const matIdx = sm.materialIndex;
            const mat = (multiMat ? multiMat.subMaterials[matIdx] : null) || sm.getMaterial() || sourceMesh.material;
            return { materialIndex: matIdx, material: mat };
          }
        }
      }
      return { materialIndex: 0, material: sourceMesh.material };
    };

    for (const [, triList] of clusters) {
      // Analyze materials used in this cluster
      const matGroups = new Map<number, { material: Material | null; triangles: number[] }>();
      for (const t of triList) {
        const { materialIndex, material } = getTriangleMaterialInfo(t);
        let group = matGroups.get(materialIndex);
        if (!group) {
          group = { material, triangles: [] };
          matGroups.set(materialIndex, group);
        }
        group.triangles.push(t);
      }

      const hasMultipleMaterials = matGroups.size > 1;
      const newIndices: number[] = [];
      const newPositions: number[] = [];
      const newNormals: number[] = normals ? [] : [];
      const newUVs: number[] = uvs ? [] : [];
      const newUV2s: number[] = uv2s ? [] : [];
      const newTangents: number[] = tangents ? [] : [];
      const newColors: number[] = colors ? [] : [];

      const oldToNewVertMap = new Map<number, number>();
      const subMeshRanges: { materialIndex: number; indexStart: number; indexCount: number }[] = [];

      for (const [matIdx, group] of matGroups) {
        const rangeStart = newIndices.length;

        for (const t of group.triangles) {
          for (let j = 0; j < 3; j++) {
            const oldV = indices[t * 3 + j];
            let newV = oldToNewVertMap.get(oldV);
            if (newV === undefined) {
              newV = newPositions.length / 3;
              oldToNewVertMap.set(oldV, newV);

              newPositions.push(positions[oldV * 3], positions[oldV * 3 + 1], positions[oldV * 3 + 2]);
              if (normals) {
                newNormals.push(normals[oldV * 3], normals[oldV * 3 + 1], normals[oldV * 3 + 2]);
              }
              if (uvs) {
                newUVs.push(uvs[oldV * 2], uvs[oldV * 2 + 1]);
              }
              if (uv2s) {
                newUV2s.push(uv2s[oldV * 2], uv2s[oldV * 2 + 1]);
              }
              if (tangents) {
                newTangents.push(tangents[oldV * 4], tangents[oldV * 4 + 1], tangents[oldV * 4 + 2], tangents[oldV * 4 + 3]);
              }
              if (colors) {
                newColors.push(colors[oldV * 4], colors[oldV * 4 + 1], colors[oldV * 4 + 2], colors[oldV * 4 + 3]);
              }
            }
            newIndices.push(newV);
          }
        }

        const rangeCount = newIndices.length - rangeStart;
        subMeshRanges.push({ materialIndex: matIdx, indexStart: rangeStart, indexCount: rangeCount });
      }

      const partMesh = new Mesh(`${baseName}_part${partNum++}`, this.scene, sourceMesh.parent);
      const vd = new VertexData();
      vd.positions = newPositions;
      vd.indices = newIndices;
      if (normals) vd.normals = newNormals;
      if (uvs) vd.uvs = newUVs;
      if (uv2s) vd.uvs2 = newUV2s;
      if (tangents) vd.tangents = newTangents;
      if (colors) vd.colors = newColors;

      vd.applyToMesh(partMesh, true);

      if (colors) {
        partMesh.hasVertexAlpha = sourceMesh.hasVertexAlpha;
        if ((sourceMesh as any).useVertexColors !== undefined) {
          (partMesh as any).useVertexColors = (sourceMesh as any).useVertexColors;
        }
      }

      if (!hasMultipleMaterials) {
        const singleMat = [...matGroups.values()][0]?.material || sourceMesh.material;
        partMesh.material = singleMat;
        partMesh.subMeshes = [new SubMesh(0, 0, newPositions.length / 3, 0, newIndices.length, partMesh)];
      } else {
        partMesh.material = sourceMesh.material;
        partMesh.subMeshes = [];
        const totalVerts = newPositions.length / 3;
        for (const range of subMeshRanges) {
          new SubMesh(range.materialIndex, 0, totalVerts, range.indexStart, range.indexCount, partMesh);
        }
      }

      partMesh.position.copyFrom(sourceMesh.position);
      if (sourceMesh.rotationQuaternion) {
        partMesh.rotationQuaternion = sourceMesh.rotationQuaternion.clone();
      } else {
        partMesh.rotation.copyFrom(sourceMesh.rotation);
      }
      partMesh.scaling.copyFrom(sourceMesh.scaling);

      this.centerMeshPivot(partMesh);
      separatedMeshes.push(partMesh);
    }

    return separatedMeshes;
  }

  public separateSelectedLooseParts(): Mesh[] {
    const targetMeshes: Mesh[] = [];
    const nodes = this.selectedNodes.length > 0 ? this.selectedNodes : this.selectedMesh ? [this.selectedMesh] : [];

    for (const node of nodes) {
      if (node instanceof Mesh && !this.isEditorHelper(node) && !node.isDisposed() && node.getTotalVertices() > 0) {
        if (!targetMeshes.includes(node)) targetMeshes.push(node);
      }
      const children = node.getChildMeshes ? node.getChildMeshes() : [];
      for (const cm of children) {
        if (cm instanceof Mesh && !this.isEditorHelper(cm) && !cm.isDisposed() && cm.getTotalVertices() > 0) {
          if (!targetMeshes.includes(cm)) targetMeshes.push(cm);
        }
      }
    }

    if (targetMeshes.length === 0) {
      this.events.onToast?.('Please select a mesh to separate.', 'warning');
      return [];
    }

    this.events.onStatusChanged?.('Analyzing connected geometry components...', true);

    const allNewParts: Mesh[] = [];
    const sourcesReplaced: Mesh[] = [];

    for (const sourceMesh of targetMeshes) {
      const parts = this.separateMeshLooseParts(sourceMesh);
      if (parts.length > 1) {
        sourcesReplaced.push(sourceMesh);
        for (const p of parts) {
          allNewParts.push(p);
          this.importedMeshes.push(p);
        }
        const origIdx = this.importedMeshes.indexOf(sourceMesh);
        if (origIdx !== -1) this.importedMeshes.splice(origIdx, 1);
        sourceMesh.setEnabled(false);
      }
    }

    if (allNewParts.length === 0) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(
        targetMeshes.length === 1
          ? 'Mesh is already a single unified piece (no separate parts detected).'
          : 'Selected meshes are already unified pieces (no separate parts detected).',
        'info'
      );
      return targetMeshes;
    }

    this.recordAction({
      name: `Separate Loose Parts (${allNewParts.length} parts)`,
      undo: () => {
        for (const p of allNewParts) {
          const idx = this.importedMeshes.indexOf(p);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
          p.setEnabled(false);
        }
        for (const sm of sourcesReplaced) {
          if (!this.importedMeshes.includes(sm)) this.importedMeshes.push(sm);
          sm.setEnabled(true);
        }
        this.selectNodes(sourcesReplaced);
      },
      redo: () => {
        for (const sm of sourcesReplaced) {
          const idx = this.importedMeshes.indexOf(sm);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
          sm.setEnabled(false);
        }
        for (const p of allNewParts) {
          if (!this.importedMeshes.includes(p)) this.importedMeshes.push(p);
          p.setEnabled(true);
        }
        this.selectNodes(allNewParts);
      },
    });

    this.selectNodes(allNewParts);
    this.updateStats();
    this.events.onStatusChanged?.('Ready', false);
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Separated into ${allNewParts.length} individual parts!`,
      'success'
    );
    return allNewParts;
  }

  public mergeSelectedMeshes(): Mesh | null {
    const selected =
      this.selectedNodes.length > 0
        ? [...this.selectedNodes]
        : this.selectedMesh
        ? [this.selectedMesh]
        : [];

    const meshesToMerge: Mesh[] = [];
    const affectedParentNodes: TransformNode[] = [];

    for (const node of selected) {
      if (node instanceof Mesh && !this.isEditorHelper(node) && !node.isDisposed() && node.getTotalVertices() > 0) {
        if (!meshesToMerge.includes(node)) meshesToMerge.push(node);
      } else if (node instanceof TransformNode && !this.isEditorHelper(node) && !node.isDisposed()) {
        if (!affectedParentNodes.includes(node)) affectedParentNodes.push(node);
      }
      const children = node.getChildMeshes ? node.getChildMeshes() : [];
      for (const cm of children) {
        if (cm instanceof Mesh && !this.isEditorHelper(cm) && !cm.isDisposed() && cm.getTotalVertices() > 0) {
          if (!meshesToMerge.includes(cm)) meshesToMerge.push(cm);
        }
      }
    }

    if (meshesToMerge.length < 2) {
      this.events.onToast?.(
        meshesToMerge.length === 1
          ? 'Only 1 mesh found in selection. Need at least 2 meshes to merge.'
          : 'Please select at least 2 meshes (or a parent node containing multiple meshes) to merge.',
        'warning'
      );
      return null;
    }

    this.events.onStatusChanged?.('Merging meshes...', true);
    this.clearSelectionProxy();

    for (const m of meshesToMerge) {
      m.computeWorldMatrix(true);
    }

    const firstMesh = meshesToMerge[0];
    const targetParent = firstMesh.parent;

    // Merge meshes into a single mesh; multiMultiMaterials preserves individual materials as subMeshes
    const merged = Mesh.MergeMeshes(
      meshesToMerge,
      false,
      true,
      undefined,
      false,
      true
    );

    if (!merged) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.('Failed to merge meshes.', 'error');
      return null;
    }

    const baseName = meshesToMerge[0].name.replace(/_merged(_\d+)?$/, '');
    merged.name = `${baseName}_merged`;
    merged.parent = targetParent;
    this.importedMeshes.push(merged);

    // Deselect source meshes before disabling them
    this.selectNodes([]);

    for (const m of meshesToMerge) {
      m.setEnabled(false);
      const idx = this.importedMeshes.indexOf(m);
      if (idx !== -1) this.importedMeshes.splice(idx, 1);
    }

    for (const g of affectedParentNodes) {
      g.setEnabled(false);
      const idx = this.groups.indexOf(g);
      if (idx !== -1) this.groups.splice(idx, 1);
    }

    this.recordAction({
      name: `Merge Meshes (${meshesToMerge.length} meshes)`,
      undo: () => {
        this.clearSelectionProxy();
        const idx = this.importedMeshes.indexOf(merged);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        merged.setEnabled(false);

        for (const m of meshesToMerge) {
          if (!this.importedMeshes.includes(m)) this.importedMeshes.push(m);
          m.setEnabled(true);
        }
        for (const g of affectedParentNodes) {
          g.setEnabled(true);
          if (this.isGroupNode(g) && !this.groups.includes(g)) this.groups.push(g);
        }
        this.selectNodes(meshesToMerge);
      },
      redo: () => {
        this.clearSelectionProxy();
        for (const m of meshesToMerge) {
          const idx = this.importedMeshes.indexOf(m);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
          m.setEnabled(false);
        }
        for (const g of affectedParentNodes) {
          g.setEnabled(false);
          const idx = this.groups.indexOf(g);
          if (idx !== -1) this.groups.splice(idx, 1);
        }
        if (!this.importedMeshes.includes(merged)) this.importedMeshes.push(merged);
        merged.setEnabled(true);
        this.selectMesh(merged);
      },
    });

    this.selectMesh(merged);
    this.updateStats();
    this.events.onStatusChanged?.('Ready', false);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Merged ${meshesToMerge.length} meshes into "${merged.name}"!`, 'success');
    return merged;
  }

  public separateSelectedSubMeshes(): Mesh[] {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh with submeshes to separate.', 'warning');
      return [];
    }
    const sourceMesh = this.selectedMesh;
    if (!sourceMesh.subMeshes || sourceMesh.subMeshes.length <= 1) {
      this.events.onToast?.('Selected mesh has only 1 submesh. Trying loose parts separation instead.', 'info');
      return this.separateSelectedLooseParts();
    }
    return this.splitAllSubMeshesOnSelected();
  }

  public splitAllSubMeshesOnSelected(): Mesh[] {
    if (!this.selectedMesh) return [];
    const sourceMesh = this.selectedMesh;
    const subMeshes = sourceMesh.subMeshes;
    if (!subMeshes || subMeshes.length <= 1) return [sourceMesh];

    const newMeshes: Mesh[] = [];
    this.runWithoutRecording(() => {
      for (let i = 0; i < subMeshes.length; i++) {
        const part = this.extractSelectedSubMesh(i, false);
        if (part) newMeshes.push(part);
      }
    });

    const origIdx = this.importedMeshes.indexOf(sourceMesh);
    if (origIdx !== -1) this.importedMeshes.splice(origIdx, 1);
    sourceMesh.setEnabled(false);

    this.recordAction({
      name: `Split SubMeshes "${sourceMesh.name}" (${newMeshes.length})`,
      undo: () => {
        this.clearSelectionProxy();
        for (const p of newMeshes) {
          if (!p.isDisposed()) p.setEnabled(false);
          const idx = this.importedMeshes.indexOf(p);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
        }
        if (!sourceMesh.isDisposed()) {
          sourceMesh.setEnabled(true);
          if (!this.importedMeshes.includes(sourceMesh)) this.importedMeshes.push(sourceMesh);
          this.selectMesh(sourceMesh);
        }
      },
      redo: () => {
        this.clearSelectionProxy();
        if (!sourceMesh.isDisposed()) sourceMesh.setEnabled(false);
        const idx = this.importedMeshes.indexOf(sourceMesh);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        for (const p of newMeshes) {
          if (!p.isDisposed()) {
            p.setEnabled(true);
            if (!this.importedMeshes.includes(p)) this.importedMeshes.push(p);
          }
        }
        this.selectNodes(newMeshes);
      },
    });

    this.selectNodes(newMeshes);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Split mesh into ${newMeshes.length} submesh pieces!`, 'success');
    return newMeshes;
  }

  public extractSelectedSubMesh(subMeshIndex?: number, selectResult: boolean = true): Mesh | null {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return null;
    }
    const sourceMesh = this.selectedMesh;
    const targetIdx = subMeshIndex !== undefined ? subMeshIndex : this.selectedSubMeshId || 0;
    const subMesh = sourceMesh.subMeshes?.[targetIdx];
    if (!subMesh) {
      this.events.onToast?.('No submesh found at this index.', 'warning');
      return null;
    }

    const indices = sourceMesh.getIndices();
    const positions = sourceMesh.getVerticesData(VertexBuffer.PositionKind);
    if (!indices || !positions) return null;

    const normals = sourceMesh.getVerticesData(VertexBuffer.NormalKind);
    const uvs = sourceMesh.getVerticesData(VertexBuffer.UVKind);

    const subIndices = indices.slice(subMesh.indexStart, subMesh.indexStart + subMesh.indexCount);
    const newPositions: number[] = [];
    const newNormals: number[] = normals ? [] : [];
    const newUVs: number[] = uvs ? [] : [];
    const newIndices: number[] = [];

    const map = new Map<number, number>();
    for (let i = 0; i < subIndices.length; i++) {
      const oldIdx = subIndices[i];
      let newIdx = map.get(oldIdx);
      if (newIdx === undefined) {
        newIdx = newPositions.length / 3;
        map.set(oldIdx, newIdx);
        newPositions.push(positions[oldIdx * 3], positions[oldIdx * 3 + 1], positions[oldIdx * 3 + 2]);
        if (normals) {
          newNormals.push(normals[oldIdx * 3], normals[oldIdx * 3 + 1], normals[oldIdx * 3 + 2]);
        }
        if (uvs) {
          newUVs.push(uvs[oldIdx * 2], uvs[oldIdx * 2 + 1]);
        }
      }
      newIndices.push(newIdx);
    }

    const partMesh = new Mesh(`${sourceMesh.name}_submesh_${targetIdx}`, this.scene, sourceMesh.parent);
    const vd = new VertexData();
    vd.positions = newPositions;
    vd.indices = newIndices;
    if (normals) vd.normals = newNormals;
    if (uvs) vd.uvs = newUVs;
    vd.applyToMesh(partMesh, true);

    const mat = subMesh.getMaterial();
    partMesh.material = mat || sourceMesh.material;
    partMesh.position.copyFrom(sourceMesh.position);
    if (sourceMesh.rotationQuaternion) {
      partMesh.rotationQuaternion = sourceMesh.rotationQuaternion.clone();
    } else {
      partMesh.rotation.copyFrom(sourceMesh.rotation);
    }
    partMesh.scaling.copyFrom(sourceMesh.scaling);

    this.centerMeshPivot(partMesh);
    this.importedMeshes.push(partMesh);

    this.recordAction({
      name: `Extract SubMesh "${partMesh.name}"`,
      undo: () => {
        this.clearSelectionProxy();
        if (!partMesh.isDisposed()) partMesh.setEnabled(false);
        const idx = this.importedMeshes.indexOf(partMesh);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        if (!sourceMesh.isDisposed()) this.selectMesh(sourceMesh, targetIdx);
      },
      redo: () => {
        this.clearSelectionProxy();
        if (!partMesh.isDisposed()) {
          partMesh.setEnabled(true);
          if (!this.importedMeshes.includes(partMesh)) this.importedMeshes.push(partMesh);
          if (selectResult) this.selectMesh(partMesh);
        }
      },
    });

    if (selectResult) {
      this.selectMesh(partMesh);
      this.events.onToast?.(`Extracted submesh as "${partMesh.name}"!`, 'success');
      this.events.onSceneModified?.();
    }
    return partMesh;
  }

  public deleteSelectedSubMesh(): void {
    if (!this.selectedMesh || this.selectedSubMeshId === null) {
      this.events.onToast?.('Please pick a specific submesh first to delete it.', 'warning');
      return;
    }
    const sourceMesh = this.selectedMesh;
    const subMeshId = this.selectedSubMeshId;
    const subMesh = sourceMesh.subMeshes?.[subMeshId];
    if (!subMesh) return;

    const indices = sourceMesh.getIndices();
    if (!indices) return;

    const beforeSnap = captureMeshSurfaceSnapshot(sourceMesh);

    const nextIndices = [
      ...indices.slice(0, subMesh.indexStart),
      ...indices.slice(subMesh.indexStart + subMesh.indexCount),
    ];

    sourceMesh.setIndices(nextIndices);
    sourceMesh.subMeshes.splice(subMeshId, 1);
    this.selectedSubMeshId = null;

    const afterSnap = captureMeshSurfaceSnapshot(sourceMesh);
    this.recordAction({
      name: `Delete SubMesh ${subMeshId} from "${sourceMesh.name}"`,
      undo: () => {
        if (sourceMesh.isDisposed()) return;
        restoreMeshSurfaceSnapshot(sourceMesh, beforeSnap);
        this.selectMesh(sourceMesh, subMeshId);
      },
      redo: () => {
        if (sourceMesh.isDisposed()) return;
        restoreMeshSurfaceSnapshot(sourceMesh, afterSnap);
        this.selectMesh(sourceMesh, null);
      },
    });

    this.events.onSceneModified?.();
    this.events.onToast?.(`Deleted submesh ${subMeshId} from "${sourceMesh.name}".`, 'success');
  }

  /* =========================================================================
     8. PRIMITIVES & SPAWNING
     ========================================================================= */
  public createPrimitive(config: PrimitiveConfig): Mesh {
    const baseName = (config.name?.trim() || config.shape).replace(/\s+/g, '_');
    const uniqueName = `${baseName}_${Date.now().toString().slice(-4)}`;
    let mesh: Mesh;

    const diameter = config.diameter !== undefined ? config.diameter : config.size;
    const tess = config.tessellation || 24;
    const subs = config.subdivisions || 2;

    switch (config.shape) {
      case 'Sphere':
        mesh = MeshBuilder.CreateSphere(uniqueName, { diameter, segments: subs || tess }, this.scene);
        break;
      case 'Cylinder':
        mesh = MeshBuilder.CreateCylinder(uniqueName, { height: config.height, diameter, tessellation: tess }, this.scene);
        break;
      case 'Cone':
        mesh = MeshBuilder.CreateCylinder(uniqueName, { height: config.height, diameterTop: 0, diameterBottom: diameter, tessellation: tess }, this.scene);
        break;
      case 'Capsule':
        mesh = MeshBuilder.CreateCapsule(uniqueName, { height: config.height, radius: diameter * 0.5, tessellation: tess }, this.scene);
        break;
      case 'Torus':
        mesh = MeshBuilder.CreateTorus(uniqueName, { diameter, thickness: config.thickness || (diameter * 0.25), tessellation: tess }, this.scene);
        break;
      case 'TorusKnot':
        mesh = MeshBuilder.CreateTorusKnot(uniqueName, { radius: diameter * 0.4, tube: config.thickness || 0.1, radialSegments: tess }, this.scene);
        break;
      case 'Plane':
        mesh = MeshBuilder.CreatePlane(uniqueName, { width: config.width || config.size, height: config.height || config.size }, this.scene);
        break;
      case 'Disc':
        mesh = MeshBuilder.CreateDisc(uniqueName, { radius: diameter * 0.5, tessellation: tess }, this.scene);
        break;
      case 'Ground':
        mesh = MeshBuilder.CreateGround(uniqueName, { width: config.width || config.size, height: config.depth || config.size, subdivisions: subs }, this.scene);
        break;
      case 'Polyhedron':
        mesh = MeshBuilder.CreatePolyhedron(uniqueName, { type: config.polyType ?? 1, size: (config.size || 1) * 0.5 }, this.scene);
        break;
      case 'Box':
      default:
        mesh = MeshBuilder.CreateBox(uniqueName, { width: config.width, height: config.height, depth: config.depth }, this.scene);
        break;
    }

    const mat = new PBRMaterial(`${uniqueName}_mat`, this.scene);
    mat.albedoColor = Color3.FromHexString(config.color || '#4f8cf6');
    mat.roughness = config.roughness !== undefined ? config.roughness : 0.4;
    mat.metallic = config.metallic !== undefined ? config.metallic : 0.1;
    mat.backFaceCulling = false;
    mesh.material = mat;

    // Center pivot
    const prevSelected = [...this.selectedNodes];
    this.centerMeshPivot(mesh);
    this.importedMeshes.push(mesh);
    this.selectMesh(mesh);

    this.recordAction({
      name: `Create ${config.shape} "${mesh.name}"`,
      undo: () => {
        this.clearSelectionProxy();
        if (!mesh.isDisposed()) mesh.setEnabled(false);
        const idx = this.importedMeshes.indexOf(mesh);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        this.selectNodes(prevSelected.filter((n) => !n.isDisposed()));
      },
      redo: () => {
        this.clearSelectionProxy();
        if (!mesh.isDisposed()) {
          mesh.setEnabled(true);
          if (!this.importedMeshes.includes(mesh)) this.importedMeshes.push(mesh);
          this.selectMesh(mesh);
        }
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Created ${config.shape} "${mesh.name}"!`, 'success');
    return mesh;
  }

  public startPlacementMode(config?: PrimitiveConfig): void {
    this.isPlaceModeActive = true;
    this.pendingPlacementConfig = config || null;
    this.events.onToast?.('Click anywhere in scene to place mesh (Esc to cancel).', 'info');
  }

  public cancelPlacementMode(): void {
    this.isPlaceModeActive = false;
    this.pendingPlacementConfig = null;
    this.events.onToast?.('Placement mode cancelled.', 'info');
  }

  public handlePlacementPointer(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;
    if (pick && pick.hit && pick.pickedPoint) {
      this.isPlaceModeActive = false;
      const cfg = this.pendingPlacementConfig || {
        shape: 'Box' as const,
        size: 1,
        width: 1,
        height: 1,
        depth: 1,
        subdivisions: 1,
        tessellation: 24,
        color: '#4f8cf6',
      };
      this.pendingPlacementConfig = null;
      const mesh = this.createPrimitive(cfg);
      mesh.position.copyFrom(pick.pickedPoint);
      this.selectMesh(mesh);
    }
  }

  /* =========================================================================
     9. CSG2 BOOLEAN SCULPTING
     ========================================================================= */
  public async initCSG2(): Promise<boolean> {
    if (this.csg2Initialized) return true;
    try {
      await InitializeCSG2Async();
      this.csg2Initialized = true;
      return true;
    } catch (err) {
      console.warn('CSG2 wasm init failed:', err);
      return false;
    }
  }

  public addQuickCutter(shape: 'Box' | 'Cylinder' | 'Sphere', targetMeshName?: string): Mesh {
    let target: Mesh | undefined;
    if (targetMeshName && targetMeshName !== 'None') {
      target = this.importedMeshes.find((m) => m.name === targetMeshName);
    }
    if (!target && this.selectedMesh && !this.isEditorHelper(this.selectedMesh) && this.selectedMesh.getTotalVertices() > 0) {
      target = this.selectedMesh;
    }
    if (!target) {
      target = this.importedMeshes.find((m) => !this.isEditorHelper(m) && m.name !== '__root__' && m.getTotalVertices() > 0);
    }

    const uniqueId = Date.now().toString().slice(-4);
    const cutterName = `Cutter_${shape}_${uniqueId}`;
    let cutterMesh: Mesh;

    let pos = new Vector3(0, 1, 0);
    let scaleDim = 1.0;
    if (target) {
      target.computeWorldMatrix(true);
      const bbox = target.getBoundingInfo().boundingBox;
      pos = bbox.centerWorld.clone();
      const ext = bbox.extendSizeWorld;
      scaleDim = Math.max(0.4, Math.min(ext.x, ext.y, ext.z) * 1.2);
    }

    if (shape === 'Box') {
      cutterMesh = MeshBuilder.CreateBox(cutterName, { size: scaleDim }, this.scene);
    } else if (shape === 'Cylinder') {
      cutterMesh = MeshBuilder.CreateCylinder(cutterName, { height: scaleDim * 1.5, diameter: scaleDim, tessellation: 24 }, this.scene);
    } else {
      cutterMesh = MeshBuilder.CreateSphere(cutterName, { diameter: scaleDim * 1.2, segments: 24 }, this.scene);
    }

    // Translucent glowing sculpting cutter material
    const cutterMat = new PBRMaterial(`${cutterName}_mat`, this.scene);
    cutterMat.albedoColor = new Color3(1.0, 0.4, 0.1);
    cutterMat.emissiveColor = new Color3(0.9, 0.3, 0.05);
    cutterMat.alpha = 0.65;
    cutterMat.roughness = 0.3;
    cutterMat.metallic = 0.1;
    cutterMat.backFaceCulling = false;
    cutterMesh.material = cutterMat;

    const prevSelected = [...this.selectedNodes];
    cutterMesh.position.copyFrom(pos);
    cutterMesh.computeWorldMatrix(true);
    this.centerMeshPivot(cutterMesh);

    this.importedMeshes.push(cutterMesh);
    this.selectMesh(cutterMesh);

    this.recordAction({
      name: `Add ${shape} Cutter "${cutterName}"`,
      undo: () => {
        this.clearSelectionProxy();
        if (!cutterMesh.isDisposed()) cutterMesh.setEnabled(false);
        const idx = this.importedMeshes.indexOf(cutterMesh);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        this.selectNodes(prevSelected.filter((n) => !n.isDisposed()));
      },
      redo: () => {
        this.clearSelectionProxy();
        if (!cutterMesh.isDisposed()) {
          cutterMesh.setEnabled(true);
          if (!this.importedMeshes.includes(cutterMesh)) this.importedMeshes.push(cutterMesh);
          this.selectMesh(cutterMesh);
        }
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Added ${shape} cutter "${cutterName}". Transform it into place, then click Subtract / Cut!`, 'success');

    return cutterMesh;
  }

  public ensureMeshHasCSGGeometry(mesh: Mesh | string | null | undefined): Mesh | null {
    if (!mesh) return null;
    if (typeof mesh === 'string') {
      const found =
        this.importedMeshes.find((m) => m.name === mesh && !m.isDisposed()) ||
        (this.scene?.getMeshByName(mesh) as Mesh | null);
      if (!found) return null;
      mesh = found;
    }
    if (typeof mesh !== 'object') return null;
    if (typeof (mesh as any).isDisposed === 'function' && (mesh as any).isDisposed()) return null;

    const hasVertexApi =
      typeof (mesh as any).getTotalVertices === 'function' &&
      typeof (mesh as any).isVerticesDataPresent === 'function';

    // If mesh has 0 vertices, no positions, or is a TransformNode container, check child geometry
    if (!hasVertexApi || mesh.getTotalVertices() === 0 || !mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) {
      if (typeof (mesh as any).getChildMeshes !== 'function') return null;
      const childMeshes = (mesh as any).getChildMeshes(
        false,
        (c: any) =>
          c instanceof Mesh &&
          typeof c.isDisposed === 'function' &&
          !c.isDisposed() &&
          c.getTotalVertices() > 0 &&
          c.isVerticesDataPresent(VertexBuffer.PositionKind)
      ) as Mesh[];
      if (childMeshes.length === 1) {
        return childMeshes[0];
      }
      if (childMeshes.length > 1) {
        const merged = Mesh.MergeMeshes(childMeshes, false, true, undefined, false, true);
        if (merged) {
          for (const cm of childMeshes) {
            if (!cm.isDisposed()) cm.setEnabled(false);
          }
          merged.name = mesh.name || 'Merged_CSG_Source';
          const idx = this.importedMeshes.indexOf(mesh);
          if (idx !== -1) {
            this.importedMeshes.splice(idx, 1, merged);
          } else {
            this.importedMeshes.push(merged);
          }
          return merged;
        }
      }
      return null;
    }

    // Ensure indices exist for CSG/CSG2
    const indices = mesh.getIndices();
    if (!indices || indices.length === 0) {
      const vertexCount = mesh.getTotalVertices();
      const newIndices: number[] = new Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        newIndices[i] = i;
      }
      mesh.setIndices(newIndices);
    }

    // Ensure normals exist
    if (!mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
      mesh.createNormals(true);
    }

    return mesh;
  }

  public async performCSGOperation(
    targetMesh: Mesh | string | Promise<Mesh | null>,
    toolMesh: Mesh | string | Promise<Mesh | null>,
    op: 'subtract' | 'union' | 'intersect',
    keepToolMesh: boolean = false,
    options?: {
      nonDestructive?: boolean;
      bevelWidth?: number;
      bevelSegments?: number;
      angleThresholdDeg?: number;
    }
  ): Promise<Mesh | null> {
    const resolvedTarget = await Promise.resolve(targetMesh as any);
    const resolvedTool = await Promise.resolve(toolMesh as any);

    if (!resolvedTarget || !resolvedTool) {
      this.events.onToast?.('Please specify both a target mesh and a cutter mesh.', 'warning');
      return null;
    }
    if (resolvedTarget === resolvedTool) {
      this.events.onToast?.('Target mesh and tool mesh cannot be the same mesh.', 'warning');
      return null;
    }

    const targetLabel = typeof resolvedTarget === 'string' ? resolvedTarget : resolvedTarget?.name || 'Target';
    const toolLabel = typeof resolvedTool === 'string' ? resolvedTool : resolvedTool?.name || 'Tool';

    const validTarget = this.ensureMeshHasCSGGeometry(resolvedTarget);
    if (!validTarget) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(`Target mesh "${targetLabel}" has no 3D vertices/geometry. Please select a valid solid mesh.`, 'warning');
      return null;
    }

    const validTool = this.ensureMeshHasCSGGeometry(resolvedTool);
    if (!validTool) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(`Tool mesh "${toolLabel}" has no 3D vertices/geometry. Please select a valid solid mesh.`, 'warning');
      return null;
    }

    if (validTarget === validTool) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.('Target mesh and tool mesh cannot be the same mesh.', 'warning');
      return null;
    }

    this.events.onStatusChanged?.(`Executing CSG ${op}...`, true);

    validTarget.computeWorldMatrix(true);
    validTool.computeWorldMatrix(true);

    const originalTargetSnapshot =
      options?.nonDestructive !== false ? captureMeshSnapshot(validTarget) : undefined;
    const origTargetName = validTarget.name;
    const origToolName = validTool.name;

    const targetMat = validTarget.material;
    const targetParent = validTarget.parent;
    const newName = `${validTarget.name}_${op}_${Date.now().toString().slice(-4)}`;

    let resultMesh: Mesh | null = null;

    // Attempt CSG2 (fast Manifold wasm engine) first if ready
    if (this.csg2Initialized || (typeof IsCSG2Ready === 'function' && IsCSG2Ready())) {
      try {
        const targetCSG2 = CSG2.FromMesh(validTarget, false);
        const toolCSG2 = CSG2.FromMesh(validTool, false);
        let resCSG2: CSG2;

        if (op === 'subtract') {
          resCSG2 = targetCSG2.subtract(toolCSG2);
        } else if (op === 'union') {
          resCSG2 = targetCSG2.add(toolCSG2);
        } else {
          resCSG2 = targetCSG2.intersect(toolCSG2);
        }

        resultMesh = resCSG2.toMesh(newName, this.scene);
        resCSG2.dispose();
        targetCSG2.dispose();
        toolCSG2.dispose();
      } catch (err) {
        console.warn('CSG2 operation note (trying legacy CSG fallback):', err);
        resultMesh = null;
      }
    }

    // Fallback to legacy CSG
    if (!resultMesh) {
      try {
        const targetCSG = CSG.FromMesh(validTarget);
        const toolCSG = CSG.FromMesh(validTool);
        let resCSG: CSG;

        if (op === 'subtract') {
          resCSG = targetCSG.subtract(toolCSG);
        } else if (op === 'union') {
          resCSG = targetCSG.union(toolCSG);
        } else {
          resCSG = targetCSG.intersect(toolCSG);
        }

        resultMesh = resCSG.toMesh(newName, targetMat, this.scene);
      } catch (errLegacy: any) {
        console.error('CSG operation failed completely:', errLegacy);
        this.events.onStatusChanged?.('Ready', false);
        this.events.onToast?.(`CSG ${op} failed: ${errLegacy?.message || 'Invalid or non-manifold geometry'}`, 'error');
        return null;
      }
    }

    if (!resultMesh) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(`CSG ${op} failed to produce a valid mesh.`, 'error');
      return null;
    }

    // Preserve material and hierarchy
    if (targetMat && !resultMesh.material) {
      resultMesh.material = targetMat;
    }
    if (resultMesh.material) {
      resultMesh.material.backFaceCulling = false;
    }
    resultMesh.parent = targetParent;
    resultMesh.computeWorldMatrix(true);
    this.centerMeshPivot(resultMesh);

    // Store Non-Destructive CSG & Bevel Modifier metadata on resultMesh
    const unbeveledBaseSnapshot = captureMeshSnapshot(resultMesh);
    const nonDestructiveMeta: NonDestructiveCSGMetadata = {
      isNonDestructive: options?.nonDestructive !== false,
      operation: op,
      targetMeshName: origTargetName,
      toolMeshName: origToolName,
      originalTargetSnapshot,
      unbeveledBaseSnapshot,
      bevel: {
        enabled: (options?.bevelWidth || 0) > 0,
        width: options?.bevelWidth || 0,
        segments: options?.bevelSegments || 2,
        angleThresholdDeg: options?.angleThresholdDeg ?? 30,
        sharpEdgeCount: 0,
      },
    };
    if (!resultMesh.metadata) resultMesh.metadata = {};
    resultMesh.metadata.nonDestructiveCSG = nonDestructiveMeta;

    if (options?.bevelWidth && options.bevelWidth > 0) {
      this.runWithoutRecording(() => {
        this.applyNonDestructiveBevel(resultMesh!, {
          width: options.bevelWidth!,
          segments: options.bevelSegments || 2,
          angleThresholdDeg: options.angleThresholdDeg ?? 30,
          nonDestructive: nonDestructiveMeta.isNonDestructive,
        });
      });
    }

    const targetMeshObj = resolvedTarget instanceof Mesh ? resolvedTarget : validTarget;
    const toolMeshObj = resolvedTool instanceof Mesh ? resolvedTool : validTool;

    // Detach gizmos and highlights from target before disabling
    this.clearSelectionProxy();
    this.gizmoManager.attachToMesh(null);
    if (this.selectedMesh === validTarget || this.selectedMesh === targetMeshObj) {
      this.highlightLayer.removeMesh(validTarget);
      if (validTarget !== targetMeshObj) this.highlightLayer.removeMesh(targetMeshObj);
      this.selectedMesh = null;
    }

    // Track meshes disabled/removed so Undo can restore them cleanly
    const removedMeshes: Mesh[] = [];
    const removedFromImported: Mesh[] = [];
    const disableAndTrack = (m: Mesh) => {
      if (m.isDisposed()) return;
      if (!removedMeshes.includes(m)) removedMeshes.push(m);
      const idx = this.importedMeshes.indexOf(m);
      if (idx !== -1) {
        this.importedMeshes.splice(idx, 1);
        if (!removedFromImported.includes(m)) removedFromImported.push(m);
      }
      m.setEnabled(false);
    };

    // Replace target in importedMeshes
    const targetIdx = this.importedMeshes.indexOf(validTarget);
    if (targetIdx !== -1) {
      this.importedMeshes.splice(targetIdx, 1, resultMesh);
      removedFromImported.push(validTarget);
      removedMeshes.push(validTarget);
      validTarget.setEnabled(false);
    } else {
      const origIdx = this.importedMeshes.indexOf(targetMeshObj);
      if (origIdx !== -1) {
        this.importedMeshes.splice(origIdx, 1, resultMesh);
        removedFromImported.push(targetMeshObj);
        removedMeshes.push(targetMeshObj);
        targetMeshObj.setEnabled(false);
      } else {
        this.importedMeshes.push(resultMesh);
      }
    }
    if (targetMeshObj !== validTarget) {
      disableAndTrack(targetMeshObj);
    }
    if (!removedMeshes.includes(validTarget) && !validTarget.isDisposed()) {
      removedMeshes.push(validTarget);
      validTarget.setEnabled(false);
    }

    // Soft-disable tool mesh unless user toggled 'keepToolMesh'
    if (!keepToolMesh) {
      if (this.selectedMesh === validTool || this.selectedMesh === toolMeshObj) {
        this.highlightLayer.removeMesh(validTool);
        if (validTool !== toolMeshObj) this.highlightLayer.removeMesh(toolMeshObj);
        this.selectedMesh = null;
      }
      disableAndTrack(validTool);
      if (toolMeshObj !== validTool) {
        disableAndTrack(toolMeshObj);
      }
    }

    const finalResultMesh = resultMesh;
    this.recordAction({
      name: `CSG ${op} "${origTargetName}"`,
      undo: () => {
        this.clearSelectionProxy();
        if (!finalResultMesh.isDisposed()) finalResultMesh.setEnabled(false);
        const resIdx = this.importedMeshes.indexOf(finalResultMesh);
        if (resIdx !== -1) this.importedMeshes.splice(resIdx, 1);

        for (const m of removedMeshes) {
          if (!m.isDisposed()) m.setEnabled(true);
        }
        for (const m of removedFromImported) {
          if (!m.isDisposed() && !this.importedMeshes.includes(m)) {
            this.importedMeshes.push(m);
          }
        }
        const restoreSelection = [validTarget, ...(keepToolMesh ? [] : [validTool])].filter((m) => !m.isDisposed());
        this.selectNodes(restoreSelection);
      },
      redo: () => {
        this.clearSelectionProxy();
        for (const m of removedMeshes) {
          if (!m.isDisposed()) m.setEnabled(false);
          const idx = this.importedMeshes.indexOf(m);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
        }
        if (!finalResultMesh.isDisposed()) {
          finalResultMesh.setEnabled(true);
          if (!this.importedMeshes.includes(finalResultMesh)) {
            this.importedMeshes.push(finalResultMesh);
          }
          this.selectMesh(finalResultMesh);
        }
      },
    });

    this.selectMesh(resultMesh);
    this.updateStats();
    this.events.onStatusChanged?.('Ready', false);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Constructive Solid Geometry ${op} successful: Created "${resultMesh.name}"!`, 'success');

    return resultMesh;
  }

  public async applyCSGOperation(op: CSGOperationType): Promise<Mesh | null> {
    if (this.selectedNodes.length < 2) {
      this.events.onToast?.('Please select at least 2 meshes for sculpting (first selected is base).', 'warning');
      return null;
    }

    const meshes = this.selectedNodes.filter((n): n is Mesh => n instanceof Mesh && !this.isEditorHelper(n));
    if (meshes.length < 2) {
      this.events.onToast?.('Constructive Solid Geometry requires at least 2 valid meshes.', 'warning');
      return null;
    }

    return this.performCSGOperation(meshes[0], meshes[1], op as 'subtract' | 'union' | 'intersect');
  }

  /**
   * Applies or updates a Non-Destructive Bevel Modifier (Chamfer / Fillet) on `mesh`
   * without destroying the underlying base mesh geometry.
   */
  public applyNonDestructiveBevel(
    mesh: Mesh,
    options: BevelModifierOptions
  ): { mesh: Mesh; sharpEdgeCount: number } {
    if (!mesh || mesh.isDisposed()) {
      return { mesh, sharpEdgeCount: 0 };
    }

    if (!mesh.metadata) mesh.metadata = {};
    let ndMeta: NonDestructiveCSGMetadata | undefined = mesh.metadata.nonDestructiveCSG;
    if (!ndMeta || !ndMeta.unbeveledBaseSnapshot) {
      const snap = captureMeshSnapshot(mesh);
      ndMeta = {
        isNonDestructive: options.nonDestructive !== false,
        operation: 'bevel_only',
        targetMeshName: mesh.name,
        originalTargetSnapshot: snap,
        unbeveledBaseSnapshot: snap,
        bevel: {
          enabled: true,
          width: options.width,
          segments: options.segments,
          angleThresholdDeg: options.angleThresholdDeg ?? 30,
          sharpEdgeCount: 0,
        },
      };
      mesh.metadata.nonDestructiveCSG = ndMeta;
    }

    const preBevelSnap = captureMeshSnapshot(mesh);
    const { snapshot: beveledSnap, sharpEdgeCount } = computeBeveledSnapshot(
      ndMeta.unbeveledBaseSnapshot,
      options
    );

    restoreMeshSnapshot(mesh, beveledSnap);
    ndMeta.bevel = {
      enabled: options.width > 0,
      width: options.width,
      segments: options.segments,
      angleThresholdDeg: options.angleThresholdDeg ?? 30,
      sharpEdgeCount,
    };

    this.recordAction({
      name: `Bevel Modifier (${mesh.name}, w=${options.width.toFixed(2)})`,
      undo: () => {
        if (!mesh.isDisposed()) {
          restoreMeshSnapshot(mesh, preBevelSnap);
          this.updateStats();
          this.events.onSceneModified?.();
        }
      },
      redo: () => {
        if (!mesh.isDisposed()) {
          restoreMeshSnapshot(mesh, beveledSnap);
          this.updateStats();
          this.events.onSceneModified?.();
        }
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    return { mesh, sharpEdgeCount };
  }

  /**
   * Non-destructively reverts `mesh` back to its un-beveled base (or pre-CSG original base).
   */
  public revertNonDestructiveMesh(mesh: Mesh, restorePreCSG: boolean = false): boolean {
    if (!mesh || mesh.isDisposed()) return false;
    const ndMeta: NonDestructiveCSGMetadata | undefined = mesh.metadata?.nonDestructiveCSG;
    if (!ndMeta) return false;

    const targetSnap =
      restorePreCSG && ndMeta.originalTargetSnapshot
        ? ndMeta.originalTargetSnapshot
        : ndMeta.unbeveledBaseSnapshot;
    if (!targetSnap) return false;

    const preRevertSnap = captureMeshSnapshot(mesh);
    restoreMeshSnapshot(mesh, targetSnap);
    ndMeta.bevel.enabled = false;
    ndMeta.bevel.width = 0;

    this.recordAction({
      name: `Revert Non-Destructive Base (${mesh.name})`,
      undo: () => {
        if (!mesh.isDisposed()) {
          restoreMeshSnapshot(mesh, preRevertSnap);
          this.updateStats();
          this.events.onSceneModified?.();
        }
      },
      redo: () => {
        if (!mesh.isDisposed()) {
          restoreMeshSnapshot(mesh, targetSnap);
          this.updateStats();
          this.events.onSceneModified?.();
        }
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    return true;
  }

  /* =========================================================================
     10. FACET & VERTEX EDITING
     ========================================================================= */
  public toggleFacetEditor(active?: boolean): boolean {
    const nextActive = active !== undefined ? active : !this.facetEditorActive;
    if (nextActive === this.facetEditorActive) {
      return this.facetEditorActive;
    }
    if (nextActive) {
      this.deactivateOtherInteractive3DTools('facet');
    }
    this.facetEditorActive = nextActive;
    if (!this.facetEditorActive) {
      if (this.facetHighlightMesh) {
        this.facetHighlightMesh.dispose();
        this.facetHighlightMesh = null;
      }
      this.selectedFaceId = null;
      this.selectedFaceIsQuad = false;
      this.clearVertexSelection();
      this.disposeVertexHandles();
      this.detachVertexGizmo();
      this.events.onFaceSelected?.(null);
      this.events.onVertexSelected?.(null);
      this.refreshGizmoAttachment();
    } else {
      if (this.facetEditMode === 'vertex') {
        if (this.selectedMesh) {
          this.refreshVertexHandles();
        }
      } else {
        if (this.selectedMesh && this.selectedFaceId !== null) {
          this.highlightFace(this.selectedMesh, this.selectedFaceId);
        }
      }
      this.refreshGizmoAttachment();
    }
    this.events.onFacetEditorStateChanged?.(this.facetEditorActive);
    this.events.onToast?.(
      this.facetEditorActive
        ? `Facet & Vertex Editor enabled (${this.facetEditMode === 'vertex' ? 'Vertex' : 'Face'} Mode).`
        : 'Facet & Vertex Editor disabled.',
      'info'
    );
    return this.facetEditorActive;
  }

  public setFacetEditMode(mode: 'face' | 'vertex'): void {
    this.facetEditMode = mode;
    if (mode === 'vertex') {
      if (this.selectedMesh) {
        this.refreshVertexHandles();
      }
      if (this.selectedVertexIndex !== null) {
        this.attachVertexGizmo();
      }
    } else {
      this.disposeVertexHandles();
      this.detachVertexGizmo();
      if (this.selectedMesh && this.selectedFaceId !== null) {
        this.highlightFace(this.selectedMesh, this.selectedFaceId);
      }
    }
    this.events.onFacetEditModeChanged?.(mode);
    this.events.onToast?.(`Switched to ${mode === 'vertex' ? 'Vertex' : 'Face'} Mode.`, 'info');
  }

  public handleFacetPointer(pointerInfo: PointerInfo): void {
    const pick = pointerInfo.pickInfo;
    if (!pick || !pick.hit || !pick.pickedMesh) return;
    const picked = pick.pickedMesh as Mesh;

    // Check if clicked an interactive vertex handle directly
    if (this.isEditorHelper(picked) && (picked as any).metadata?.vertexIndex !== undefined) {
      this.selectVertex((picked as any).metadata.vertexIndex);
      return;
    }

    if (this.isEditorHelper(picked) || picked === this.gridMesh) return;

    if (!this.selectedMesh || this.selectedMesh !== picked) {
      this.selectMesh(picked);
    }

    if (this.facetEditMode === 'vertex') {
      if (pick.pickedPoint) {
        this.selectClosestVertex(picked, pick.pickedPoint, pick.faceId);
      }
    } else {
      if (pick.faceId !== undefined) {
        this.selectedFaceId = pick.faceId;
        this.highlightFace(picked, pick.faceId);
        const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(picked, pick.faceId);
        const matInfo = getFacetMaterialInfo(picked, pick.faceId);
        if (this.selectedSubMeshId !== matInfo.subMeshIndex) {
          this.selectedSubMeshId = matInfo.subMeshIndex;
          this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
        }
        this.events.onFaceSelected?.(pick.faceId, !!quad);
        const desc = quad ? `Quad Face #${pick.faceId} & #${quad.faceIds[1]}` : `Face #${pick.faceId}`;
        this.events.onToast?.(`${desc} selected on "${picked.name}".`, 'info');
      }
    }
  }

  public selectVertex(vertexIndex: number): void {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions || vertexIndex * 3 + 2 >= positions.length) return;

    this.selectedVertexIndex = vertexIndex;
    const targetPos = new Vector3(
      positions[vertexIndex * 3],
      positions[vertexIndex * 3 + 1],
      positions[vertexIndex * 3 + 2]
    );

    // Collect all coincident vertices sharing the exact same spatial position
    this.selectedVertexIndices = [];
    const totalVerts = positions.length / 3;
    for (let i = 0; i < totalVerts; i++) {
      const d2 =
        (positions[i * 3] - targetPos.x) ** 2 +
        (positions[i * 3 + 1] - targetPos.y) ** 2 +
        (positions[i * 3 + 2] - targetPos.z) ** 2;
      if (d2 < 0.0001) {
        this.selectedVertexIndices.push(i);
      }
    }

    mesh.computeWorldMatrix(true);
    const worldPos = Vector3.TransformCoordinates(targetPos, mesh.getWorldMatrix());

    this.attachVertexGizmo(worldPos);
    this.refreshVertexHandles();
    this.events.onVertexSelected?.(vertexIndex, worldPos);
    this.events.onToast?.(
      `Vertex #${vertexIndex} selected (${this.selectedVertexIndices.length} linked). Drag 3D gizmo to move.`,
      'info'
    );
  }

  public selectClosestVertex(mesh: Mesh, worldPoint: Vector3, faceId?: number): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions) return;

    mesh.computeWorldMatrix(true);
    const invMat = mesh.getWorldMatrix().clone().invert();
    const localPoint = Vector3.TransformCoordinates(worldPoint, invMat);

    let candidateIndices: number[] = [];
    if (faceId !== undefined && indices && faceId * 3 + 2 < indices.length) {
      const quad = this.getQuadFaceInfo(mesh, faceId);
      if (quad) {
        candidateIndices = [...quad.quadIndices];
      } else {
        candidateIndices = [indices[faceId * 3], indices[faceId * 3 + 1], indices[faceId * 3 + 2]];
      }
    } else {
      const total = positions.length / 3;
      for (let i = 0; i < total; i++) candidateIndices.push(i);
    }

    let closestIdx = candidateIndices[0];
    let minDistSq = Infinity;
    for (const idx of candidateIndices) {
      const d2 =
        (positions[idx * 3] - localPoint.x) ** 2 +
        (positions[idx * 3 + 1] - localPoint.y) ** 2 +
        (positions[idx * 3 + 2] - localPoint.z) ** 2;
      if (d2 < minDistSq) {
        minDistSq = d2;
        closestIdx = idx;
      }
    }

    if (closestIdx !== undefined) {
      this.selectVertex(closestIdx);
    }
  }

  public clearVertexSelection(): void {
    this.selectedVertexIndex = null;
    this.selectedVertexIndices = [];
    this.detachVertexGizmo();
    this.events.onVertexSelected?.(null);
  }

  public refreshVertexHandles(): void {
    this.disposeVertexHandles();
    if (!this.selectedMesh || this.selectedMesh.isDisposed()) return;
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    mesh.computeWorldMatrix(true);
    const wm = mesh.getWorldMatrix();

    // Determine target vertex indices to show
    const targetIndices = new Set<number>();
    if (this.selectedFaceId !== null) {
      const quad = this.getQuadFaceInfo(mesh, this.selectedFaceId);
      if (quad) {
        quad.quadIndices.forEach((i) => targetIndices.add(i));
      } else {
        const indices = mesh.getIndices();
        if (indices && this.selectedFaceId * 3 + 2 < indices.length) {
          targetIndices.add(indices[this.selectedFaceId * 3]);
          targetIndices.add(indices[this.selectedFaceId * 3 + 1]);
          targetIndices.add(indices[this.selectedFaceId * 3 + 2]);
        }
      }
    } else {
      const totalVerts = positions.length / 3;
      const limit = Math.min(totalVerts, 500);
      for (let i = 0; i < limit; i++) {
        targetIndices.add(i);
      }
    }

    // Group coincident vertices
    const spatialMap = new Map<
      string,
      { worldPos: Vector3; localPos: Vector3; indices: number[]; primaryIndex: number }
    >();

    for (const idx of targetIndices) {
      const lx = positions[idx * 3];
      const ly = positions[idx * 3 + 1];
      const lz = positions[idx * 3 + 2];
      const key = `${lx.toFixed(3)},${ly.toFixed(3)},${lz.toFixed(3)}`;
      if (!spatialMap.has(key)) {
        const localPos = new Vector3(lx, ly, lz);
        const worldPos = Vector3.TransformCoordinates(localPos, wm);
        spatialMap.set(key, { worldPos, localPos, indices: [idx], primaryIndex: idx });
      } else {
        spatialMap.get(key)!.indices.push(idx);
      }
    }

    const ext = mesh.getBoundingInfo().boundingBox.extendSize;
    const diag = Math.max(ext.x, ext.y, ext.z);
    const diameter = Math.max(0.06, Math.min(0.24, diag * 0.05));

    for (const group of spatialMap.values()) {
      const isSelected =
        this.selectedVertexIndex !== null && group.indices.includes(this.selectedVertexIndex);

      const handle = MeshBuilder.CreateSphere(
        `editor_vertex_handle_${group.primaryIndex}`,
        { diameter: isSelected ? diameter * 1.35 : diameter, segments: 8 },
        this.scene
      );
      handle.position.copyFrom(group.worldPos);
      handle.isPickable = true;

      const mat = new StandardMaterial(`editor_vh_mat_${group.primaryIndex}`, this.scene);
      mat.disableLighting = true;
      mat.emissiveColor = (isSelected ? this.getVertexSelectionColor3() : this.getVertexColor3()).clone();
      handle.material = mat;

      (handle as any).metadata = {
        isEditorHelper: true,
        vertexIndex: group.primaryIndex,
        vertexIndices: group.indices,
        localPos: group.localPos,
      };

      if (isSelected) {
        this.activeVertexHandle = handle;
      }
      this.vertexHandles.push(handle);
    }
  }

  public disposeVertexHandles(): void {
    for (const h of this.vertexHandles) {
      if (!h.isDisposed()) {
        if (h.material) h.material.dispose();
        h.dispose();
      }
    }
    this.vertexHandles = [];
    this.activeVertexHandle = null;
  }

  public attachVertexGizmo(worldPos?: Vector3): void {
    if (!this.vertexGizmoNode) {
      this.vertexGizmoNode = new TransformNode('editor_vertex_gizmo_node', this.scene);
      (this.vertexGizmoNode as any).metadata = { isEditorHelper: true };
    }
    if (worldPos) {
      this.vertexGizmoNode.position.copyFrom(worldPos);
    }
    this.gizmoManager.attachToNode(this.vertexGizmoNode);
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
  }

  public detachVertexGizmo(): void {
    if (this.gizmoManager.gizmos.positionGizmo?.attachedNode === this.vertexGizmoNode) {
      this.gizmoManager.attachToNode(null);
    }
    if (this.vertexGizmoNode && !this.vertexGizmoNode.isDisposed()) {
      this.vertexGizmoNode.dispose();
      this.vertexGizmoNode = null;
    }
  }

  public onVertexDragStart(): void {
    if (this.selectedVertexIndex === null || !this.selectedMesh || !this.vertexGizmoNode) return;
    const positions = this.selectedMesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    this.isDraggingVertex = true;
    this.vertexPreDragPos = new Vector3(
      positions[this.selectedVertexIndex * 3],
      positions[this.selectedVertexIndex * 3 + 1],
      positions[this.selectedVertexIndex * 3 + 2]
    );
  }

  public handleVertexGizmoDrag(): void {
    if (this.selectedVertexIndex === null || !this.selectedMesh || !this.vertexGizmoNode) return;
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    mesh.computeWorldMatrix(true);
    const invMat = mesh.getWorldMatrix().clone().invert();
    const localTarget = Vector3.TransformCoordinates(this.vertexGizmoNode.position, invMat);

    const posArray = Array.from(positions);
    for (const idx of this.selectedVertexIndices) {
      posArray[idx * 3] = localTarget.x;
      posArray[idx * 3 + 1] = localTarget.y;
      posArray[idx * 3 + 2] = localTarget.z;
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, posArray);
    const indices = Array.from(mesh.getIndices() || []);
    const normals: number[] = [];
    VertexData.ComputeNormals(posArray, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    if (this.activeVertexHandle) {
      this.activeVertexHandle.position.copyFrom(this.vertexGizmoNode.position);
    }
    if (this.selectedFaceId !== null) {
      this.highlightFace(mesh, this.selectedFaceId);
    }
    this.events.onVertexSelected?.(this.selectedVertexIndex, this.vertexGizmoNode.position);
  }

  public onVertexDragEnd(): void {
    if (!this.isDraggingVertex || this.selectedVertexIndex === null || !this.selectedMesh || !this.vertexGizmoNode) {
      this.isDraggingVertex = false;
      return;
    }
    this.isDraggingVertex = false;

    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const beforePos = this.vertexPreDragPos.clone();
    const afterPos = new Vector3(
      positions[this.selectedVertexIndex * 3],
      positions[this.selectedVertexIndex * 3 + 1],
      positions[this.selectedVertexIndex * 3 + 2]
    );

    if (Vector3.DistanceSquared(beforePos, afterPos) < 1e-6) return;

    const indicesToRestore = [...this.selectedVertexIndices];
    const targetMesh = mesh;
    const vertexIdx = this.selectedVertexIndex;

    this.recordAction({
      name: `Move Vertex #${vertexIdx}`,
      undo: () => {
        if (targetMesh.isDisposed()) return;
        const pos = Array.from(targetMesh.getVerticesData(VertexBuffer.PositionKind) || []);
        for (const i of indicesToRestore) {
          pos[i * 3] = beforePos.x;
          pos[i * 3 + 1] = beforePos.y;
          pos[i * 3 + 2] = beforePos.z;
        }
        targetMesh.setVerticesData(VertexBuffer.PositionKind, pos);
        const norm: number[] = [];
        VertexData.ComputeNormals(pos, Array.from(targetMesh.getIndices() || []), norm);
        targetMesh.setVerticesData(VertexBuffer.NormalKind, norm);
        targetMesh.refreshBoundingInfo();
        if (this.facetEditorActive && this.facetEditMode === 'vertex') {
          this.refreshVertexHandles();
          if (this.selectedVertexIndex === vertexIdx && this.vertexGizmoNode) {
            targetMesh.computeWorldMatrix(true);
            this.vertexGizmoNode.position.copyFrom(
              Vector3.TransformCoordinates(beforePos, targetMesh.getWorldMatrix())
            );
            this.events.onVertexSelected?.(vertexIdx, this.vertexGizmoNode.position);
          }
        }
        this.events.onSceneModified?.();
      },
      redo: () => {
        if (targetMesh.isDisposed()) return;
        const pos = Array.from(targetMesh.getVerticesData(VertexBuffer.PositionKind) || []);
        for (const i of indicesToRestore) {
          pos[i * 3] = afterPos.x;
          pos[i * 3 + 1] = afterPos.y;
          pos[i * 3 + 2] = afterPos.z;
        }
        targetMesh.setVerticesData(VertexBuffer.PositionKind, pos);
        const norm: number[] = [];
        VertexData.ComputeNormals(pos, Array.from(targetMesh.getIndices() || []), norm);
        targetMesh.setVerticesData(VertexBuffer.NormalKind, norm);
        targetMesh.refreshBoundingInfo();
        if (this.facetEditorActive && this.facetEditMode === 'vertex') {
          this.refreshVertexHandles();
          if (this.selectedVertexIndex === vertexIdx && this.vertexGizmoNode) {
            targetMesh.computeWorldMatrix(true);
            this.vertexGizmoNode.position.copyFrom(
              Vector3.TransformCoordinates(afterPos, targetMesh.getWorldMatrix())
            );
            this.events.onVertexSelected?.(vertexIdx, this.vertexGizmoNode.position);
          }
        }
        this.events.onSceneModified?.();
      },
    });

    this.events.onSceneModified?.();
    this.events.onToast?.(`Vertex #${vertexIdx} moved.`, 'info');
  }

  public setVertexPosition(x: number, y: number, z: number): void {
    if (this.selectedVertexIndex === null || !this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const beforePos = new Vector3(
      positions[this.selectedVertexIndex * 3],
      positions[this.selectedVertexIndex * 3 + 1],
      positions[this.selectedVertexIndex * 3 + 2]
    );

    mesh.computeWorldMatrix(true);
    const invMat = mesh.getWorldMatrix().clone().invert();
    const localTarget = Vector3.TransformCoordinates(new Vector3(x, y, z), invMat);

    const afterPos = localTarget.clone();
    const posArray = Array.from(positions);
    for (const idx of this.selectedVertexIndices) {
      posArray[idx * 3] = localTarget.x;
      posArray[idx * 3 + 1] = localTarget.y;
      posArray[idx * 3 + 2] = localTarget.z;
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, posArray);
    const indices = Array.from(mesh.getIndices() || []);
    const normals: number[] = [];
    VertexData.ComputeNormals(posArray, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    if (this.vertexGizmoNode) {
      this.vertexGizmoNode.position.set(x, y, z);
    }
    if (this.activeVertexHandle) {
      this.activeVertexHandle.position.set(x, y, z);
    }
    if (this.selectedFaceId !== null) {
      this.highlightFace(mesh, this.selectedFaceId);
    }

    const indicesToRestore = [...this.selectedVertexIndices];
    const targetMesh = mesh;
    const vertexIdx = this.selectedVertexIndex;

    this.recordAction({
      name: `Set Vertex #${vertexIdx} Position`,
      undo: () => {
        if (targetMesh.isDisposed()) return;
        const pos = Array.from(targetMesh.getVerticesData(VertexBuffer.PositionKind) || []);
        for (const i of indicesToRestore) {
          pos[i * 3] = beforePos.x;
          pos[i * 3 + 1] = beforePos.y;
          pos[i * 3 + 2] = beforePos.z;
        }
        targetMesh.setVerticesData(VertexBuffer.PositionKind, pos);
        const norm: number[] = [];
        VertexData.ComputeNormals(pos, Array.from(targetMesh.getIndices() || []), norm);
        targetMesh.setVerticesData(VertexBuffer.NormalKind, norm);
        targetMesh.refreshBoundingInfo();
        this.refreshVertexHandles();
        this.events.onSceneModified?.();
      },
      redo: () => {
        if (targetMesh.isDisposed()) return;
        const pos = Array.from(targetMesh.getVerticesData(VertexBuffer.PositionKind) || []);
        for (const i of indicesToRestore) {
          pos[i * 3] = afterPos.x;
          pos[i * 3 + 1] = afterPos.y;
          pos[i * 3 + 2] = afterPos.z;
        }
        targetMesh.setVerticesData(VertexBuffer.PositionKind, pos);
        const norm: number[] = [];
        VertexData.ComputeNormals(pos, Array.from(targetMesh.getIndices() || []), norm);
        targetMesh.setVerticesData(VertexBuffer.NormalKind, norm);
        targetMesh.refreshBoundingInfo();
        this.refreshVertexHandles();
        this.events.onSceneModified?.();
      },
    });

    this.events.onSceneModified?.();
    this.events.onVertexSelected?.(this.selectedVertexIndex, new Vector3(x, y, z));
  }

  public getSelectedVertexPosition(): Vector3 | null {
    if (this.selectedVertexIndex === null || !this.selectedMesh) return null;
    const positions = this.selectedMesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions || this.selectedVertexIndex * 3 + 2 >= positions.length) return null;
    const local = new Vector3(
      positions[this.selectedVertexIndex * 3],
      positions[this.selectedVertexIndex * 3 + 1],
      positions[this.selectedVertexIndex * 3 + 2]
    );
    this.selectedMesh.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(local, this.selectedMesh.getWorldMatrix());
  }

  public getQuadFaceInfo(
    mesh: Mesh,
    faceId: number
  ): {
    faceIds: [number, number];
    quadIndices: [number, number, number, number];
    quadPositions: [Vector3, Vector3, Vector3, Vector3];
    quadUVs: [Vector2, Vector2, Vector2, Vector2] | null;
    normal: Vector3;
    centroid: Vector3;
  } | null {
    const indices = mesh.getIndices();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    if (!indices || !positions || faceId * 3 + 2 >= indices.length) return null;

    const numTriangles = indices.length / 3;
    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    const triPositions = [p0, p1, p2];
    const triIndices = [i0, i1, i2];

    const nA = Vector3.Cross(p2.subtract(p0), p1.subtract(p0));
    const lenA = nA.length();
    if (lenA < 1e-6) return null;
    const normalA = nA.scale(1 / lenA);
    const triMats = mesh.subMeshes && mesh.subMeshes.length > 1 ? getFaceTriangleMaterialIndices(mesh) : null;
    const matA = triMats ? (triMats[faceId] ?? 0) : 0;

    for (let f = 0; f < numTriangles; f++) {
      if (f === faceId) continue;
      if (triMats && (triMats[f] ?? 0) !== matA) continue;
      const j0 = indices[f * 3];
      const j1 = indices[f * 3 + 1];
      const j2 = indices[f * 3 + 2];

      const q0 = new Vector3(positions[j0 * 3], positions[j0 * 3 + 1], positions[j0 * 3 + 2]);
      const q1 = new Vector3(positions[j1 * 3], positions[j1 * 3 + 1], positions[j1 * 3 + 2]);
      const q2 = new Vector3(positions[j2 * 3], positions[j2 * 3 + 1], positions[j2 * 3 + 2]);

      const nB = Vector3.Cross(q2.subtract(q0), q1.subtract(q0));
      const lenB = nB.length();
      if (lenB < 1e-6) continue;
      const normalB = nB.scale(1 / lenB);

      // Must be coplanar with same orientation
      if (Vector3.Dot(normalA, normalB) < 0.99) continue;

      // Must lie on the same plane
      if (Math.abs(Vector3.Dot(q0.subtract(p0), normalA)) > 0.002) continue;

      const otherPositions = [q0, q1, q2];
      const otherIndices = [j0, j1, j2];

      const sharedInA: number[] = [];
      const sharedInB: number[] = [];
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          if (Vector3.DistanceSquared(triPositions[a], otherPositions[b]) < 0.0001) {
            sharedInA.push(a);
            sharedInB.push(b);
            break;
          }
        }
      }

      if (sharedInA.length === 2) {
        const unsharedA = [0, 1, 2].find((idx) => !sharedInA.includes(idx))!;
        const s1A = (unsharedA + 1) % 3;
        const s2A = (unsharedA + 2) % 3;

        const unsharedB = [0, 1, 2].find((idx) => !sharedInB.includes(idx))!;

        const V0 = triPositions[unsharedA];
        const V1 = triPositions[s1A];
        const V2 = otherPositions[unsharedB];
        const V3 = triPositions[s2A];

        const idx0 = triIndices[unsharedA];
        const idx1 = triIndices[s1A];
        const idx2 = otherIndices[unsharedB];
        const idx3 = triIndices[s2A];

        // Convexity check around perimeter
        const e01 = V1.subtract(V0);
        const e12 = V2.subtract(V1);
        const e23 = V3.subtract(V2);
        const e30 = V0.subtract(V3);

        const c0 = Vector3.Dot(Vector3.Cross(e01, e30), normalA);
        const c1 = Vector3.Dot(Vector3.Cross(e12, e01), normalA);
        const c2 = Vector3.Dot(Vector3.Cross(e23, e12), normalA);
        const c3 = Vector3.Dot(Vector3.Cross(e30, e23), normalA);

        if (c0 > 0 && c1 > 0 && c2 > 0 && c3 > 0) {
          const centroid = V0.add(V1).add(V2).add(V3).scale(0.25);
          let quadUVs: [Vector2, Vector2, Vector2, Vector2] | null = null;
          if (uvs && uvs.length > 0) {
            quadUVs = [
              new Vector2(uvs[idx0 * 2] ?? 0, uvs[idx0 * 2 + 1] ?? 0),
              new Vector2(uvs[idx1 * 2] ?? 0, uvs[idx1 * 2 + 1] ?? 0),
              new Vector2(uvs[idx2 * 2] ?? 0, uvs[idx2 * 2 + 1] ?? 0),
              new Vector2(uvs[idx3 * 2] ?? 0, uvs[idx3 * 2 + 1] ?? 0),
            ];
          }

          return {
            faceIds: [faceId, f],
            quadIndices: [idx0, idx1, idx2, idx3],
            quadPositions: [V0, V1, V2, V3],
            quadUVs,
            normal: normalA,
            centroid,
          };
        }
      }
    }

    return null;
  }

  public highlightFace(mesh: Mesh, faceId: number): void {
    if (this.facetHighlightMesh) {
      this.facetHighlightMesh.dispose();
      this.facetHighlightMesh = null;
    }

    mesh.computeWorldMatrix(true);
    const wm = mesh.getWorldMatrix();

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);
    if (quad) {
      this.selectedFaceIsQuad = true;
      const [p0, p1, p2, p3] = quad.quadPositions;
      const w0 = Vector3.TransformCoordinates(p0, wm);
      const w1 = Vector3.TransformCoordinates(p1, wm);
      const w2 = Vector3.TransformCoordinates(p2, wm);
      const w3 = Vector3.TransformCoordinates(p3, wm);

      this.facetHighlightMesh = MeshBuilder.CreateLines(
        'editor_facet_highlight',
        { points: [w0, w1, w2, w3, w0] },
        this.scene
      );
    } else {
      this.selectedFaceIsQuad = false;
      const indices = mesh.getIndices();
      const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
      if (!indices || !positions || faceId * 3 + 2 >= indices.length) return;

      const i0 = indices[faceId * 3];
      const i1 = indices[faceId * 3 + 1];
      const i2 = indices[faceId * 3 + 2];

      const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      const w0 = Vector3.TransformCoordinates(p0, wm);
      const w1 = Vector3.TransformCoordinates(p1, wm);
      const w2 = Vector3.TransformCoordinates(p2, wm);

      this.facetHighlightMesh = MeshBuilder.CreateLines(
        'editor_facet_highlight',
        { points: [w0, w1, w2, w0] },
        this.scene
      );
    }

    this.facetHighlightMesh.color = this.getFaceSelectionColor3();
    (this.facetHighlightMesh as any).metadata = { isEditorHelper: true };

    if (this.facetEditMode === 'vertex') {
      this.refreshVertexHandles();
    }
  }

  private orientTriangle(
    p0: Vector3,
    p1: Vector3,
    p2: Vector3,
    expectedNormal: Vector3,
    i0: number,
    i1: number,
    i2: number
  ): [number, number, number] {
    const p1p0 = p1.subtract(p0);
    const p2p0 = p2.subtract(p0);
    const calculated = Vector3.Cross(p2p0, p1p0);
    if (Vector3.Dot(calculated, expectedNormal) < 0) {
      return [i0, i2, i1];
    }
    return [i0, i1, i2];
  }

  public selectFace(mesh: Mesh, faceId: number): boolean {
    const indices = mesh.getIndices();
    if (!indices || faceId < 0 || faceId * 3 + 2 >= indices.length) return false;
    this.selectMesh(mesh);
    this.selectedFaceId = faceId;
    this.highlightFace(mesh, faceId);
    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);
    const matInfo = getFacetMaterialInfo(mesh, faceId);
    if (this.selectedSubMeshId !== matInfo.subMeshIndex) {
      this.selectedSubMeshId = matInfo.subMeshIndex;
      this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    }
    this.events.onFaceSelected?.(faceId, !!quad);
    return true;
  }

  public setFacetSingleTriangleMode(enabled: boolean): void {
    this.facetSingleTriangleMode = !!enabled;
    if (this.selectedMesh && this.selectedFaceId !== null) {
      const indices = this.selectedMesh.getIndices();
      if (indices && this.selectedFaceId * 3 + 2 < indices.length) {
        this.highlightFace(this.selectedMesh, this.selectedFaceId);
        const quad = this.facetSingleTriangleMode
          ? null
          : this.getQuadFaceInfo(this.selectedMesh, this.selectedFaceId);
        this.events.onFaceSelected?.(this.selectedFaceId, !!quad);
      }
    }
  }

  private resolveTargetFacet(
    mesh: Mesh,
    faceId: number
  ): {
    faceIds: number[];
    isQuad: boolean;
    normal: Vector3;
    cornerPositions: Vector3[];
  } | null {
    const indices = mesh.getIndices();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!indices || !positions || faceId < 0 || faceId * 3 + 2 >= indices.length) return null;

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);
    if (quad) {
      return {
        faceIds: [...quad.faceIds],
        isQuad: true,
        normal: quad.normal.clone(),
        cornerPositions: quad.quadPositions.map((p) => p.clone()),
      };
    }

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];
    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
    const n = Vector3.Cross(p2.subtract(p0), p1.subtract(p0));
    const normal = n.lengthSquared() > 1e-12 ? n.normalize() : new Vector3(0, 1, 0);

    return {
      faceIds: [faceId],
      isQuad: false,
      normal,
      cornerPositions: [p0, p1, p2],
    };
  }

  private capturePreEditSubMeshContext(mesh: Mesh): {
    triMaterials: number[];
    slotMaterials: (Material | null)[];
    origTriCount: number;
  } | null {
    const isMultiMat = mesh.material instanceof MultiMaterial;
    const hasMultipleSubMeshes = !!(mesh.subMeshes && mesh.subMeshes.length > 1);
    if (!isMultiMat && !hasMultipleSubMeshes) {
      return null;
    }
    const indices = mesh.getIndices();
    return {
      triMaterials: getFaceTriangleMaterialIndices(mesh),
      slotMaterials: getMeshSlotMaterials(mesh),
      origTriCount: Math.floor((indices?.length || 0) / 3),
    };
  }

  private finalizeSubMeshesAfterTopologyEdit(
    mesh: Mesh,
    ctx: { triMaterials: number[]; slotMaterials: (Material | null)[]; origTriCount: number } | null,
    sourceMaterialIndex: number,
    deletedFaceIds?: Set<number>,
    explicitTriMaterials?: number[]
  ): Int32Array | null {
    if (!ctx) return null;
    const indices = mesh.getIndices();
    const newTriCount = Math.floor((indices?.length || 0) / 3);
    let nextTriMats: number[];

    if (explicitTriMaterials) {
      nextTriMats = explicitTriMaterials;
    } else if (deletedFaceIds && deletedFaceIds.size > 0) {
      nextTriMats = [];
      for (let t = 0; t < ctx.origTriCount; t++) {
        if (!deletedFaceIds.has(t)) {
          nextTriMats.push(ctx.triMaterials[t] ?? 0);
        }
      }
      while (nextTriMats.length < newTriCount) {
        nextTriMats.push(sourceMaterialIndex);
      }
    } else {
      nextTriMats = new Array<number>(newTriCount);
      for (let t = 0; t < newTriCount; t++) {
        nextTriMats[t] = t < ctx.origTriCount ? (ctx.triMaterials[t] ?? 0) : sourceMaterialIndex;
      }
    }

    const { faceIdMap } = rebuildMeshSubMeshes(mesh, nextTriMats, ctx.slotMaterials, true);
    if (this.selectedFaceId !== null && this.selectedFaceId >= 0 && this.selectedFaceId < faceIdMap.length) {
      this.selectedFaceId = faceIdMap[this.selectedFaceId];
      const matInfo = getFacetMaterialInfo(mesh, this.selectedFaceId);
      this.selectedSubMeshId = matInfo.subMeshIndex;
    }
    return faceIdMap;
  }

  private recordMeshSurfaceEdit(
    mesh: Mesh,
    actionName: string,
    beforeSnap: MeshSurfaceSnapshot,
    faceIdBefore: number | null,
    faceIdAfter: number | null
  ): void {
    const afterSnap = captureMeshSurfaceSnapshot(mesh);
    const applySurfaceState = (snap: MeshSurfaceSnapshot, targetFaceId: number | null) => {
      restoreMeshSurfaceSnapshot(mesh, snap);
      if (this.selectedMesh === mesh) {
        const indices = mesh.getIndices();
        const validFace = targetFaceId !== null && !!indices && targetFaceId >= 0 && targetFaceId * 3 + 2 < indices.length;
        this.selectedFaceId = validFace ? targetFaceId : null;
        if (validFace && targetFaceId !== null) {
          this.highlightFace(mesh, targetFaceId);
          const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, targetFaceId);
          const matInfo = getFacetMaterialInfo(mesh, targetFaceId);
          this.selectedSubMeshId = matInfo.subMeshIndex;
          this.events.onFaceSelected?.(targetFaceId, !!quad);
        } else {
          if (this.facetHighlightMesh) {
            this.facetHighlightMesh.dispose();
            this.facetHighlightMesh = null;
          }
          this.selectedFaceIsQuad = false;
          this.events.onFaceSelected?.(null, false);
        }
      }
      this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
      this.events.onSceneModified?.();
    };

    this.recordAction({
      name: actionName,
      undo: () => applySurfaceState(beforeSnap, faceIdBefore),
      redo: () => applySurfaceState(afterSnap, faceIdAfter),
    });
  }

  public findFaceId(
    mesh: Mesh,
    query: {
      faceId?: number;
      direction?: string;
      normal?: { x: number; y: number; z: number } | [number, number, number];
      point?: { x: number; y: number; z: number } | [number, number, number];
    }
  ): number | null {
    const indices = mesh.getIndices();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!indices || !positions || indices.length < 3) return null;

    if (query.faceId !== undefined && query.faceId !== null) {
      const fid = Math.floor(Number(query.faceId));
      if (fid >= 0 && fid * 3 + 2 < indices.length) return fid;
    }

    mesh.computeWorldMatrix(true);
    const wm = mesh.getWorldMatrix();
    const triCount = Math.floor(indices.length / 3);

    // If query by point
    if (query.point) {
      const p = Array.isArray(query.point)
        ? new Vector3(query.point[0], query.point[1], query.point[2])
        : new Vector3(query.point.x, query.point.y, query.point.z);

      let closestFid = 0;
      let minDistSq = Infinity;

      for (let t = 0; t < triCount; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];
        const p0 = Vector3.TransformCoordinates(
          new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]),
          wm
        );
        const p1 = Vector3.TransformCoordinates(
          new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]),
          wm
        );
        const p2 = Vector3.TransformCoordinates(
          new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]),
          wm
        );
        const centroid = p0.add(p1).add(p2).scale(1 / 3);
        const dSq = Vector3.DistanceSquared(centroid, p);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestFid = t;
        }
      }
      return closestFid;
    }

    // Target normal resolution
    let targetNormal: Vector3 | null = null;
    if (query.normal) {
      targetNormal = Array.isArray(query.normal)
        ? new Vector3(query.normal[0], query.normal[1], query.normal[2]).normalize()
        : new Vector3(query.normal.x, query.normal.y, query.normal.z).normalize();
    } else if (query.direction) {
      const dir = String(query.direction).trim().toLowerCase();
      if (dir === 'top' || dir === '+y' || dir === 'up') targetNormal = new Vector3(0, 1, 0);
      else if (dir === 'bottom' || dir === '-y' || dir === 'down') targetNormal = new Vector3(0, -1, 0);
      else if (dir === 'front' || dir === '+z' || dir === 'forward' || dir === 'north') targetNormal = new Vector3(0, 0, 1);
      else if (dir === 'back' || dir === '-z' || dir === 'backward' || dir === 'south') targetNormal = new Vector3(0, 0, -1);
      else if (dir === 'right' || dir === '+x' || dir === 'east') targetNormal = new Vector3(1, 0, 0);
      else if (dir === 'left' || dir === '-x' || dir === 'west') targetNormal = new Vector3(-1, 0, 0);
    }

    if (!targetNormal) return 0; // Default to first face if unspecified

    let bestFid = 0;
    let bestScore = -Infinity;

    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      const p0 = Vector3.TransformCoordinates(
        new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]),
        wm
      );
      const p1 = Vector3.TransformCoordinates(
        new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]),
        wm
      );
      const p2 = Vector3.TransformCoordinates(
        new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]),
        wm
      );

      const cross = Vector3.Cross(p2.subtract(p0), p1.subtract(p0));
      const len = cross.length();
      if (len < 1e-6) continue;
      const normal = cross.scale(1 / len);
      const centroid = p0.add(p1).add(p2).scale(1 / 3);

      const alignment = Vector3.Dot(normal, targetNormal);
      const distAlong = Vector3.Dot(centroid, targetNormal);
      const score = alignment * 1000 + distAlong;

      if (score > bestScore) {
        bestScore = score;
        bestFid = t;
      }
    }

    return bestFid;
  }

  public selectFaceByQuery(
    mesh: Mesh,
    query: {
      faceId?: number;
      direction?: string;
      normal?: { x: number; y: number; z: number } | [number, number, number];
      point?: { x: number; y: number; z: number } | [number, number, number];
    }
  ): number | null {
    const fid = this.findFaceId(mesh, query);
    if (fid !== null) {
      this.selectFace(mesh, fid);
      return fid;
    }
    return null;
  }

  public extrudeFacet(
    mesh: Mesh,
    faceQuery?: { faceId?: number; direction?: string; normal?: any; point?: any },
    distance: number = 0.5
  ): boolean {
    if (faceQuery) {
      const fid = this.selectFaceByQuery(mesh, faceQuery);
      if (fid === null) return false;
    } else if (this.selectedMesh !== mesh || this.selectedFaceId === null) {
      const fid = this.selectFaceByQuery(mesh, { direction: 'top' });
      if (fid === null) return false;
    }
    this.extrudeSelectedFacet(distance);
    return true;
  }

  public insetFacet(
    mesh: Mesh,
    faceQuery?: { faceId?: number; direction?: string; normal?: any; point?: any },
    insetAmount: number = 0.25,
    depth: number = 0.0
  ): boolean {
    if (faceQuery) {
      const fid = this.selectFaceByQuery(mesh, faceQuery);
      if (fid === null) return false;
    } else if (this.selectedMesh !== mesh || this.selectedFaceId === null) {
      const fid = this.selectFaceByQuery(mesh, { direction: 'top' });
      if (fid === null) return false;
    }
    this.insetSelectedFacet(insetAmount, depth);
    return true;
  }

  public arcFacet(
    mesh: Mesh,
    faceQuery?: { faceId?: number; direction?: string; normal?: any; point?: any },
    segments: number = 4,
    height: number = 0.5
  ): boolean {
    if (faceQuery) {
      const fid = this.selectFaceByQuery(mesh, faceQuery);
      if (fid === null) return false;
    } else if (this.selectedMesh !== mesh || this.selectedFaceId === null) {
      const fid = this.selectFaceByQuery(mesh, { direction: 'top' });
      if (fid === null) return false;
    }
    this.arcSelectedFacet(segments, height);
    return true;
  }

  public cutThroughFacet(
    mesh: Mesh,
    faceQuery?: { faceId?: number; direction?: string; normal?: any; point?: any },
    depth: number = 1.0
  ): boolean {
    if (faceQuery) {
      const fid = this.selectFaceByQuery(mesh, faceQuery);
      if (fid === null) return false;
    } else if (this.selectedMesh !== mesh || this.selectedFaceId === null) {
      const fid = this.selectFaceByQuery(mesh, { direction: 'front' });
      if (fid === null) return false;
    }
    this.cutThroughSelectedFacet(depth);
    return true;
  }

  public extrudeSelectedFacet(distance: number = 0.5): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);

    if (quad) {
      const [V0, V1, V2, V3] = quad.quadPositions;
      const [idx0, idx1, idx2, idx3] = quad.quadIndices;
      const [fA, fB] = quad.faceIds;
      const normal = quad.normal;
      const offset = normal.scale(distance);

      const q0 = V0.add(offset);
      const q1 = V1.add(offset);
      const q2 = V2.add(offset);
      const q3 = V3.add(offset);

      const v0 = positions.length / 3;
      positions.push(q0.x, q0.y, q0.z);
      const v1 = positions.length / 3;
      positions.push(q1.x, q1.y, q1.z);
      const v2 = positions.length / 3;
      positions.push(q2.x, q2.y, q2.z);
      const v3 = positions.length / 3;
      positions.push(q3.x, q3.y, q3.z);

      if (uvs.length > 0 && quad.quadUVs) {
        const [u0, u1, u2, u3] = quad.quadUVs;
        uvs.push(u0.x, u0.y, u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
      }

      // Update top quad face (2 triangles)
      const topTri1 = this.orientTriangle(q0, q1, q2, normal, v0, v1, v2);
      const topTri2 = this.orientTriangle(q0, q2, q3, normal, v0, v2, v3);
      indices[fA * 3] = topTri1[0];
      indices[fA * 3 + 1] = topTri1[1];
      indices[fA * 3 + 2] = topTri1[2];

      indices[fB * 3] = topTri2[0];
      indices[fB * 3 + 1] = topTri2[1];
      indices[fB * 3 + 2] = topTri2[2];

      // 4 side quads (8 triangles)
      const nSide0 = Vector3.Cross(normal, V1.subtract(V0)).normalize();
      const nSide1 = Vector3.Cross(normal, V2.subtract(V1)).normalize();
      const nSide2 = Vector3.Cross(normal, V3.subtract(V2)).normalize();
      const nSide3 = Vector3.Cross(normal, V0.subtract(V3)).normalize();

      const side0A = this.orientTriangle(V0, V1, q1, nSide0, idx0, idx1, v1);
      const side0B = this.orientTriangle(V0, q1, q0, nSide0, idx0, v1, v0);
      const side1A = this.orientTriangle(V1, V2, q2, nSide1, idx1, idx2, v2);
      const side1B = this.orientTriangle(V1, q2, q1, nSide1, idx1, v2, v1);
      const side2A = this.orientTriangle(V2, V3, q3, nSide2, idx2, idx3, v3);
      const side2B = this.orientTriangle(V2, q3, q2, nSide2, idx2, v3, v2);
      const side3A = this.orientTriangle(V3, V0, q0, nSide3, idx3, idx0, v0);
      const side3B = this.orientTriangle(V3, q0, q3, nSide3, idx3, v0, v3);

      indices.push(
        ...side0A, ...side0B,
        ...side1A, ...side1B,
        ...side2A, ...side2B,
        ...side3A, ...side3B
      );

      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.setIndices(indices);
      if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
      mesh.refreshBoundingInfo();

      this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
      const nextFaceId = this.selectedFaceId ?? fA;
      this.recordMeshSurfaceEdit(mesh, `Extrude Quad Face (${distance})`, beforeSnap, faceId, nextFaceId);
      this.highlightFace(mesh, nextFaceId);
      this.events.onSceneModified?.();
      this.events.onToast?.(`Extruded Quad Face by ${distance}!`, 'success');
      return;
    }

    if (faceId * 3 + 2 >= indices.length) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    // Face normal
    const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();
    const offset = normal.scale(distance);

    const n0 = p0.add(offset);
    const n1 = p1.add(offset);
    const n2 = p2.add(offset);

    const newV0 = positions.length / 3;
    positions.push(n0.x, n0.y, n0.z);
    const newV1 = positions.length / 3;
    positions.push(n1.x, n1.y, n1.z);
    const newV2 = positions.length / 3;
    positions.push(n2.x, n2.y, n2.z);

    if (uvs.length > 0) {
      uvs.push(uvs[i0 * 2] ?? 0, uvs[i0 * 2 + 1] ?? 0);
      uvs.push(uvs[i1 * 2] ?? 0, uvs[i1 * 2 + 1] ?? 0);
      uvs.push(uvs[i2 * 2] ?? 0, uvs[i2 * 2 + 1] ?? 0);
    }

    // Update top face
    const topTri = this.orientTriangle(n0, n1, n2, normal, newV0, newV1, newV2);
    indices[faceId * 3] = topTri[0];
    indices[faceId * 3 + 1] = topTri[1];
    indices[faceId * 3 + 2] = topTri[2];

    // Create side quads (2 triangles each)
    const nSide0 = Vector3.Cross(normal, p1.subtract(p0)).normalize();
    const nSide1 = Vector3.Cross(normal, p2.subtract(p1)).normalize();
    const nSide2 = Vector3.Cross(normal, p0.subtract(p2)).normalize();

    const s0A = this.orientTriangle(p0, p1, n1, nSide0, i0, i1, newV1);
    const s0B = this.orientTriangle(p0, n1, n0, nSide0, i0, newV1, newV0);
    const s1A = this.orientTriangle(p1, p2, n2, nSide1, i1, i2, newV2);
    const s1B = this.orientTriangle(p1, n2, n1, nSide1, i1, newV2, newV1);
    const s2A = this.orientTriangle(p2, p0, n0, nSide2, i2, i0, newV0);
    const s2B = this.orientTriangle(p2, n0, n2, nSide2, i2, newV0, newV2);

    indices.push(...s0A, ...s0B, ...s1A, ...s1B, ...s2A, ...s2B);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, `Extrude Face (${distance})`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Extruded face by ${distance}!`, 'success');
  }

  public insetSelectedFacet(insetAmount: number = 0.25, depth: number = 0.0, actionLabel?: string): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to inset.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);

    if (quad) {
      const [V0, V1, V2, V3] = quad.quadPositions;
      const [idx0, idx1, idx2, idx3] = quad.quadIndices;
      const [fA, fB] = quad.faceIds;
      const centroid = quad.centroid;
      const normal = quad.normal;

      let ratio = insetAmount;
      if (ratio > 1) {
        const avgDist =
          (Vector3.Distance(V0, centroid) +
            Vector3.Distance(V1, centroid) +
            Vector3.Distance(V2, centroid) +
            Vector3.Distance(V3, centroid)) /
          4;
        ratio = Math.min(insetAmount / Math.max(avgDist, 0.001), 0.85);
      }
      ratio = Math.min(Math.max(ratio, 0.05), 0.95);

      const q0 = V0.add(centroid.subtract(V0).scale(ratio)).add(normal.scale(depth));
      const q1 = V1.add(centroid.subtract(V1).scale(ratio)).add(normal.scale(depth));
      const q2 = V2.add(centroid.subtract(V2).scale(ratio)).add(normal.scale(depth));
      const q3 = V3.add(centroid.subtract(V3).scale(ratio)).add(normal.scale(depth));

      const v0 = positions.length / 3;
      positions.push(q0.x, q0.y, q0.z);
      const v1 = positions.length / 3;
      positions.push(q1.x, q1.y, q1.z);
      const v2 = positions.length / 3;
      positions.push(q2.x, q2.y, q2.z);
      const v3 = positions.length / 3;
      positions.push(q3.x, q3.y, q3.z);

      if (uvs.length > 0 && quad.quadUVs) {
        const [u0, u1, u2, u3] = quad.quadUVs;
        const cu = (u0.x + u1.x + u2.x + u3.x) / 4;
        const cv = (u0.y + u1.y + u2.y + u3.y) / 4;
        uvs.push(u0.x + (cu - u0.x) * ratio, u0.y + (cv - u0.y) * ratio);
        uvs.push(u1.x + (cu - u1.x) * ratio, u1.y + (cv - u1.y) * ratio);
        uvs.push(u2.x + (cu - u2.x) * ratio, u2.y + (cv - u2.y) * ratio);
        uvs.push(u3.x + (cu - u3.x) * ratio, u3.y + (cv - u3.y) * ratio);
      }

      // Replace original 2 triangles with inner quad (2 triangles)
      const inTri1 = this.orientTriangle(q0, q1, q2, normal, v0, v1, v2);
      const inTri2 = this.orientTriangle(q0, q2, q3, normal, v0, v2, v3);
      indices[fA * 3] = inTri1[0];
      indices[fA * 3 + 1] = inTri1[1];
      indices[fA * 3 + 2] = inTri1[2];

      indices[fB * 3] = inTri2[0];
      indices[fB * 3 + 1] = inTri2[1];
      indices[fB * 3 + 2] = inTri2[2];

      // Add 4 quad skirts around perimeter (8 triangles)
      const skirt0A = this.orientTriangle(V0, q0, q1, normal, idx0, v0, v1);
      const skirt0B = this.orientTriangle(V0, q1, V1, normal, idx0, v1, idx1);
      const skirt1A = this.orientTriangle(V1, q1, q2, normal, idx1, v1, v2);
      const skirt1B = this.orientTriangle(V1, q2, V2, normal, idx1, v2, idx2);
      const skirt2A = this.orientTriangle(V2, q2, q3, normal, idx2, v2, v3);
      const skirt2B = this.orientTriangle(V2, q3, V3, normal, idx2, v3, idx3);
      const skirt3A = this.orientTriangle(V3, q3, q0, normal, idx3, v3, v0);
      const skirt3B = this.orientTriangle(V3, q0, V0, normal, idx3, v0, idx0);

      indices.push(
        ...skirt0A, ...skirt0B,
        ...skirt1A, ...skirt1B,
        ...skirt2A, ...skirt2B,
        ...skirt3A, ...skirt3B
      );

      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.setIndices(indices);
      if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
      mesh.refreshBoundingInfo();

      this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
      const nextFaceId = this.selectedFaceId ?? fA;
      this.recordMeshSurfaceEdit(mesh, actionLabel || `Inset Quad Face (${ratio.toFixed(2)})`, beforeSnap, faceId, nextFaceId);
      this.highlightFace(mesh, nextFaceId);
      this.events.onSceneModified?.();
      this.events.onToast?.(`Inset Quad Face #${fA} & #${fB} (factor ${ratio.toFixed(2)})!`, 'success');
      return;
    }

    if (faceId * 3 + 2 >= indices.length) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    const centroid = p0.add(p1).add(p2).scale(1 / 3);
    const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();

    let ratio = insetAmount;
    if (ratio > 1) {
      const avgDist =
        (Vector3.Distance(p0, centroid) + Vector3.Distance(p1, centroid) + Vector3.Distance(p2, centroid)) / 3;
      ratio = Math.min(insetAmount / Math.max(avgDist, 0.001), 0.85);
    }
    ratio = Math.min(Math.max(ratio, 0.05), 0.95);

    const q0 = p0.add(centroid.subtract(p0).scale(ratio)).add(normal.scale(depth));
    const q1 = p1.add(centroid.subtract(p1).scale(ratio)).add(normal.scale(depth));
    const q2 = p2.add(centroid.subtract(p2).scale(ratio)).add(normal.scale(depth));

    const v0 = positions.length / 3;
    positions.push(q0.x, q0.y, q0.z);
    const v1 = positions.length / 3;
    positions.push(q1.x, q1.y, q1.z);
    const v2 = positions.length / 3;
    positions.push(q2.x, q2.y, q2.z);

    if (uvs.length > 0) {
      const u0 = uvs[i0 * 2] ?? 0;
      const v_0 = uvs[i0 * 2 + 1] ?? 0;
      const u1 = uvs[i1 * 2] ?? 0;
      const v_1 = uvs[i1 * 2 + 1] ?? 0;
      const u2 = uvs[i2 * 2] ?? 0;
      const v_2 = uvs[i2 * 2 + 1] ?? 0;
      const cu = (u0 + u1 + u2) / 3;
      const cv = (v_0 + v_1 + v_2) / 3;
      uvs.push(u0 + (cu - u0) * ratio, v_0 + (cv - v_0) * ratio);
      uvs.push(u1 + (cu - u1) * ratio, v_1 + (cv - v_1) * ratio);
      uvs.push(u2 + (cu - u2) * ratio, v_2 + (cv - v_2) * ratio);
    }

    // Replace original face with inset face
    const inTri = this.orientTriangle(q0, q1, q2, normal, v0, v1, v2);
    indices[faceId * 3] = inTri[0];
    indices[faceId * 3 + 1] = inTri[1];
    indices[faceId * 3 + 2] = inTri[2];

    // Perimeter connecting quads
    const s0A = this.orientTriangle(p0, q0, q1, normal, i0, v0, v1);
    const s0B = this.orientTriangle(p0, q1, p1, normal, i0, v1, i1);
    const s1A = this.orientTriangle(p1, q1, q2, normal, i1, v1, v2);
    const s1B = this.orientTriangle(p1, q2, p2, normal, i1, v2, i2);
    const s2A = this.orientTriangle(p2, q2, q0, normal, i2, v2, v0);
    const s2B = this.orientTriangle(p2, q0, p0, normal, i2, v0, i0);

    indices.push(...s0A, ...s0B, ...s1A, ...s1B, ...s2A, ...s2B);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, actionLabel || `Inset Face (${ratio.toFixed(2)})`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Inset face #${faceId} (factor ${ratio.toFixed(2)})!`, 'success');
  }

  public subdivideSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      if (this.selectedMesh) {
        this.subdivideMesh(this.selectedMesh);
        return;
      }
      this.events.onToast?.('Please pick a face or select a mesh to subdivide.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    if (faceId * 3 + 2 >= indices.length) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    const m01 = p0.add(p1).scale(0.5);
    const m12 = p1.add(p2).scale(0.5);
    const m20 = p2.add(p0).scale(0.5);

    const v01 = positions.length / 3;
    positions.push(m01.x, m01.y, m01.z);
    const v12 = positions.length / 3;
    positions.push(m12.x, m12.y, m12.z);
    const v20 = positions.length / 3;
    positions.push(m20.x, m20.y, m20.z);

    if (uvs.length > 0) {
      const u0 = uvs[i0 * 2] ?? 0;
      const v_0 = uvs[i0 * 2 + 1] ?? 0;
      const u1 = uvs[i1 * 2] ?? 0;
      const v_1 = uvs[i1 * 2 + 1] ?? 0;
      const u2 = uvs[i2 * 2] ?? 0;
      const v_2 = uvs[i2 * 2 + 1] ?? 0;
      uvs.push((u0 + u1) * 0.5, (v_0 + v_1) * 0.5);
      uvs.push((u1 + u2) * 0.5, (v_1 + v_2) * 0.5);
      uvs.push((u2 + u0) * 0.5, (v_2 + v_0) * 0.5);
    }

    // Replace original face with corner triangle
    indices[faceId * 3] = i0;
    indices[faceId * 3 + 1] = v01;
    indices[faceId * 3 + 2] = v20;

    // Remaining 3 subtriangles
    indices.push(v01, i1, v12);
    indices.push(v20, v12, i2);
    indices.push(v01, v12, v20);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, `Subdivide Face #${faceId}`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Subdivided face #${faceId} into 4 facets!`, 'success');
  }

  public subdivideMesh(targetMesh?: Mesh): void {
    const mesh = targetMesh || this.selectedMesh;
    if (!mesh) {
      this.events.onToast?.('Please select a mesh to subdivide.', 'warning');
      return;
    }
    const faceIdBefore = this.selectedMesh === mesh ? this.selectedFaceId : null;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const edgeMap = new Map<string, number>();
    const getOrAddMidpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (edgeMap.has(key)) return edgeMap.get(key)!;
      const midIdx = positions.length / 3;
      const mx = (positions[a * 3] + positions[b * 3]) * 0.5;
      const my = (positions[a * 3 + 1] + positions[b * 3 + 1]) * 0.5;
      const mz = (positions[a * 3 + 2] + positions[b * 3 + 2]) * 0.5;
      positions.push(mx, my, mz);
      if (uvs.length > 0) {
        uvs.push(
          ((uvs[a * 2] ?? 0) + (uvs[b * 2] ?? 0)) * 0.5,
          ((uvs[a * 2 + 1] ?? 0) + (uvs[b * 2 + 1] ?? 0)) * 0.5
        );
      }
      edgeMap.set(key, midIdx);
      return midIdx;
    };

    const newIndices: number[] = [];
    const triCount = Math.floor(indices.length / 3);
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];

      const m01 = getOrAddMidpoint(i0, i1);
      const m12 = getOrAddMidpoint(i1, i2);
      const m20 = getOrAddMidpoint(i2, i0);

      newIndices.push(i0, m01, m20);
      newIndices.push(m01, i1, m12);
      newIndices.push(m20, m12, i2);
      newIndices.push(m01, m12, m20);
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(newIndices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    // If mesh has multiple submeshes (MultiMaterial), scale their index ranges proportionally
    if (mesh.subMeshes && mesh.subMeshes.length > 1) {
      const oldSubMeshes = mesh.subMeshes.slice();
      mesh.subMeshes = [];
      const totalVerts = positions.length / 3;
      for (const sm of oldSubMeshes) {
        new SubMesh(
          sm.materialIndex,
          0,
          totalVerts,
          sm.indexStart * 4,
          sm.indexCount * 4,
          mesh
        );
      }
    }

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, newIndices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    if (this.selectedFaceId !== null) {
      this.selectedFaceId = null;
      if (this.facetHighlightMesh) {
        this.facetHighlightMesh.dispose();
        this.facetHighlightMesh = null;
      }
      this.events.onFaceSelected?.(null);
    }

    this.recordMeshSurfaceEdit(mesh, `Subdivide Mesh "${mesh.name}"`, beforeSnap, faceIdBefore, null);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Subdivided "${mesh.name}" (${triCount * 4} triangles)!`, 'success');
  }

  public subDSmoothMeshOrFacet(iterations: number = 1, targetMesh?: Mesh): void {
    const mesh = targetMesh || this.selectedMesh;
    if (!mesh) {
      this.events.onToast?.('Please select a mesh to apply Sub-D smoothing.', 'warning');
      return;
    }
    this.selectMesh(mesh);

    const faceIdBefore = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const clampedIterations = Math.min(3, Math.max(1, Math.round(iterations)));
    const result = subdivideCatmullClarkMesh(mesh, clampedIterations, true);

    if (this.selectedFaceId !== null) {
      this.selectedFaceId = null;
      if (this.facetHighlightMesh) {
        this.facetHighlightMesh.dispose();
        this.facetHighlightMesh = null;
      }
      this.events.onFaceSelected?.(null);
    }

    this.recordMeshSurfaceEdit(mesh, `Sub-D Smooth "${mesh.name}" (${clampedIterations}x)`, beforeSnap, faceIdBefore, null);
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Applied Catmull-Clark Sub-D smoothing (${clampedIterations}x, ${result.vertexCount} verts) to "${mesh.name}"!`,
      'success'
    );
  }

  public solidifyMeshOrFacet(thickness: number = 0.2, selectedOnly: boolean = false, targetMesh?: Mesh): void {
    const mesh = targetMesh || this.selectedMesh;
    if (!mesh) {
      this.events.onToast?.('Please select a mesh to solidify.', 'warning');
      return;
    }
    this.selectMesh(mesh);
    const faceIdBefore = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    // If selected face only
    if (selectedOnly && this.selectedFaceId !== null && this.selectedFaceId * 3 + 2 < indices.length) {
      const faceId = this.selectedFaceId;
      const preCtx = this.capturePreEditSubMeshContext(mesh);
      const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
      const i0 = indices[faceId * 3];
      const i1 = indices[faceId * 3 + 1];
      const i2 = indices[faceId * 3 + 2];

      const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();
      const offset = normal.scale(-thickness);

      const q0 = p0.add(offset);
      const q1 = p1.add(offset);
      const q2 = p2.add(offset);

      const v0 = positions.length / 3;
      positions.push(q0.x, q0.y, q0.z);
      const v1 = positions.length / 3;
      positions.push(q1.x, q1.y, q1.z);
      const v2 = positions.length / 3;
      positions.push(q2.x, q2.y, q2.z);

      if (uvs.length > 0) {
        uvs.push(uvs[i0 * 2] ?? 0, uvs[i0 * 2 + 1] ?? 0);
        uvs.push(uvs[i1 * 2] ?? 0, uvs[i1 * 2 + 1] ?? 0);
        uvs.push(uvs[i2 * 2] ?? 0, uvs[i2 * 2 + 1] ?? 0);
      }

      // Back face (reverse winding)
      indices.push(v0, v2, v1);

      // Side quads
      indices.push(i0, i1, v1, i0, v1, v0);
      indices.push(i1, i2, v2, i1, v2, v1);
      indices.push(i2, i0, v0, i2, v0, v2);

      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.setIndices(indices);
      if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
      mesh.refreshBoundingInfo();

      this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
      const nextFaceId = this.selectedFaceId ?? faceId;
      this.recordMeshSurfaceEdit(mesh, `Solidify Face #${faceId}`, beforeSnap, faceId, nextFaceId);
      this.highlightFace(mesh, nextFaceId);
      this.events.onSceneModified?.();
      this.events.onToast?.(`Solidified face #${faceId} (thickness: ${thickness})!`, 'success');
      return;
    }

    // Solidify entire mesh
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const origVertCount = positions.length / 3;
    const normalsOrig: number[] = [];
    VertexData.ComputeNormals(positions, indices, normalsOrig);

    for (let v = 0; v < origVertCount; v++) {
      const nx = normalsOrig[v * 3] || 0;
      const ny = normalsOrig[v * 3 + 1] || 0;
      const nz = normalsOrig[v * 3 + 2] || 0;
      positions.push(
        positions[v * 3] - nx * thickness,
        positions[v * 3 + 1] - ny * thickness,
        positions[v * 3 + 2] - nz * thickness
      );
      if (uvs.length > 0) {
        uvs.push(uvs[v * 2] ?? 0, uvs[v * 2 + 1] ?? 0);
      }
    }

    const origTriCount = Math.floor(indices.length / 3);
    const explicitTriMats: number[] | undefined = preCtx ? [...preCtx.triMaterials] : undefined;
    for (let t = 0; t < origTriCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      indices.push(i0 + origVertCount, i2 + origVertCount, i1 + origVertCount);
      if (explicitTriMats) {
        explicitTriMats.push(preCtx!.triMaterials[t] ?? 0);
      }
    }

    const edgeCounts = new Map<string, { count: number; a: number; b: number; tri: number }>();
    for (let t = 0; t < origTriCount; t++) {
      const tri = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        const cur = edgeCounts.get(key);
        if (cur) cur.count++;
        else edgeCounts.set(key, { count: 1, a, b, tri: t });
      }
    }

    for (const [, val] of edgeCounts) {
      if (val.count === 1) {
        const a = val.a;
        const b = val.b;
        const aInner = a + origVertCount;
        const bInner = b + origVertCount;
        indices.push(a, b, bInner, a, bInner, aInner);
        if (explicitTriMats) {
          const borderMat = preCtx!.triMaterials[val.tri] ?? 0;
          explicitTriMats.push(borderMat, borderMat);
        }
      }
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const newNormals: number[] = [];
    VertexData.ComputeNormals(positions, indices, newNormals);
    mesh.setVerticesData(VertexBuffer.NormalKind, newNormals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, 0, undefined, explicitTriMats);
    this.recordMeshSurfaceEdit(mesh, `Solidify "${mesh.name}"`, beforeSnap, faceIdBefore, this.selectedFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Solidified "${mesh.name}" with thickness ${thickness}!`, 'success');
  }

  public bevelSelectedFacet(width: number = 0.15): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to bevel.', 'warning');
      return;
    }
    this.insetSelectedFacet(width, width * 0.4, `Bevel Face (${width})`);
    this.events.onToast?.(`Beveled face #${this.selectedFaceId}!`, 'success');
  }

  public arcSelectedFacet(segments: number = 4, height: number = 0.5): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to arc.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    if (faceId * 3 + 2 >= indices.length) return;

    const prevI0 = indices[faceId * 3];
    const prevI1 = indices[faceId * 3 + 1];
    const prevI2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[prevI0 * 3], positions[prevI0 * 3 + 1], positions[prevI0 * 3 + 2]);
    const p1 = new Vector3(positions[prevI1 * 3], positions[prevI1 * 3 + 1], positions[prevI1 * 3 + 2]);
    const p2 = new Vector3(positions[prevI2 * 3], positions[prevI2 * 3 + 1], positions[prevI2 * 3 + 2]);

    const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();
    const tangent = p1.subtract(p0).normalize();

    const segs = Math.max(2, Math.min(segments, 16));
    let lastV0 = prevI0;
    let lastV1 = prevI1;
    let lastV2 = prevI2;

    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const angle = t * Math.PI;
      const arcH = Math.sin(angle) * height;
      const arcAdvance = (1 - Math.cos(angle)) * height * 0.75;
      const offset = normal.scale(arcH).add(tangent.scale(arcAdvance));

      const q0 = p0.add(offset);
      const q1 = p1.add(offset);
      const q2 = p2.add(offset);

      const v0 = positions.length / 3;
      positions.push(q0.x, q0.y, q0.z);
      const v1 = positions.length / 3;
      positions.push(q1.x, q1.y, q1.z);
      const v2 = positions.length / 3;
      positions.push(q2.x, q2.y, q2.z);

      if (uvs.length > 0) {
        uvs.push(uvs[prevI0 * 2] ?? 0, uvs[prevI0 * 2 + 1] ?? 0);
        uvs.push(uvs[prevI1 * 2] ?? 0, uvs[prevI1 * 2 + 1] ?? 0);
        uvs.push(uvs[prevI2 * 2] ?? 0, uvs[prevI2 * 2 + 1] ?? 0);
      }

      // Connecting side quads
      indices.push(lastV0, v0, v1, lastV0, v1, lastV1);
      indices.push(lastV1, v1, v2, lastV1, v2, lastV2);
      indices.push(lastV2, v2, v0, lastV2, v0, lastV0);

      lastV0 = v0;
      lastV1 = v1;
      lastV2 = v2;
    }

    // Replace original cap with end cap
    indices[faceId * 3] = lastV0;
    indices[faceId * 3 + 1] = lastV1;
    indices[faceId * 3 + 2] = lastV2;

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, `Arc Face (${segs} segments)`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Created segmented arch (${segs} segments)!`, 'success');
  }

  public knifeSplitFacet(actionLabel?: string): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to knife split.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    if (faceId * 3 + 2 >= indices.length) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    const d01 = Vector3.Distance(p0, p1);
    const d12 = Vector3.Distance(p1, p2);
    const d20 = Vector3.Distance(p2, p0);

    let m: Vector3;
    const mIdx = positions.length / 3;
    let triA: [number, number, number];
    let triB: [number, number, number];

    if (d01 >= d12 && d01 >= d20) {
      m = p0.add(p1).scale(0.5);
      triA = [i0, mIdx, i2];
      triB = [mIdx, i1, i2];
    } else if (d12 >= d01 && d12 >= d20) {
      m = p1.add(p2).scale(0.5);
      triA = [i0, i1, mIdx];
      triB = [i0, mIdx, i2];
    } else {
      m = p2.add(p0).scale(0.5);
      triA = [i0, i1, mIdx];
      triB = [mIdx, i1, i2];
    }

    positions.push(m.x, m.y, m.z);
    if (uvs.length > 0) {
      uvs.push(((uvs[i0 * 2] ?? 0) + (uvs[i1 * 2] ?? 0)) * 0.5, ((uvs[i0 * 2 + 1] ?? 0) + (uvs[i1 * 2 + 1] ?? 0)) * 0.5);
    }

    indices[faceId * 3] = triA[0];
    indices[faceId * 3 + 1] = triA[1];
    indices[faceId * 3 + 2] = triA[2];
    indices.push(triB[0], triB[1], triB[2]);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, actionLabel || `Knife Split Face #${faceId}`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Knife cut face #${faceId} in two!`, 'success');
  }

  public loopCutSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face for loop cut.', 'warning');
      return;
    }
    this.knifeSplitFacet(`Loop Cut Face #${this.selectedFaceId}`);
    this.events.onToast?.(`Loop cut executed on face #${this.selectedFaceId}!`, 'success');
  }

  public cutThroughSelectedFacet(depth: number = 1.0): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to cut through.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    if (faceId * 3 + 2 >= indices.length) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    const normal = Vector3.Cross(p2.subtract(p0), p1.subtract(p0)).normalize();
    const offset = normal.scale(-depth);

    const q0 = p0.add(offset);
    const q1 = p1.add(offset);
    const q2 = p2.add(offset);

    const v0 = positions.length / 3;
    positions.push(q0.x, q0.y, q0.z);
    const v1 = positions.length / 3;
    positions.push(q1.x, q1.y, q1.z);
    const v2 = positions.length / 3;
    positions.push(q2.x, q2.y, q2.z);

    if (uvs.length > 0) {
      uvs.push(uvs[i0 * 2] ?? 0, uvs[i0 * 2 + 1] ?? 0);
      uvs.push(uvs[i1 * 2] ?? 0, uvs[i1 * 2 + 1] ?? 0);
      uvs.push(uvs[i2 * 2] ?? 0, uvs[i2 * 2 + 1] ?? 0);
    }

    // Tunnel inner walls (normals pointing inward)
    indices[faceId * 3] = i0;
    indices[faceId * 3 + 1] = v1;
    indices[faceId * 3 + 2] = i1;

    indices.push(i0, v0, v1);
    indices.push(i1, v2, i2);
    indices.push(i1, v1, v2);
    indices.push(i2, v0, i0);
    indices.push(i2, v2, v0);

    // End cap
    indices.push(v0, v1, v2);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, `Cut Through Face #${faceId}`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Cut through face #${faceId} (opening created)!`, 'success');
  }

  public relaxSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to relax.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);

    if (faceId * 3 + 2 >= indices.length) return;

    const targetVerts = [indices[faceId * 3], indices[faceId * 3 + 1], indices[faceId * 3 + 2]];

    for (const v of targetVerts) {
      const neighborIndices = new Set<number>();
      for (let t = 0; t < indices.length; t += 3) {
        if (indices[t] === v || indices[t + 1] === v || indices[t + 2] === v) {
          neighborIndices.add(indices[t]);
          neighborIndices.add(indices[t + 1]);
          neighborIndices.add(indices[t + 2]);
        }
      }
      neighborIndices.delete(v);
      if (neighborIndices.size === 0) continue;

      let avgX = 0;
      let avgY = 0;
      let avgZ = 0;
      for (const n of neighborIndices) {
        avgX += positions[n * 3];
        avgY += positions[n * 3 + 1];
        avgZ += positions[n * 3 + 2];
      }
      avgX /= neighborIndices.size;
      avgY /= neighborIndices.size;
      avgZ /= neighborIndices.size;

      positions[v * 3] = positions[v * 3] * 0.6 + avgX * 0.4;
      positions[v * 3 + 1] = positions[v * 3 + 1] * 0.6 + avgY * 0.4;
      positions[v * 3 + 2] = positions[v * 3 + 2] * 0.6 + avgZ * 0.4;
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.recordMeshSurfaceEdit(mesh, `Relax Face #${faceId}`, beforeSnap, faceId, faceId);
    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Relaxed vertices on face #${faceId}!`, 'success');
  }

  public arraySelectedFacetOrMesh(
    count: number = 3,
    offsetX: number = 1.0,
    offsetY: number = 0.0,
    offsetZ: number = 0.0
  ): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh to create an array.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const numCopies = Math.max(1, Math.min(count, 10));

    if (this.selectedFaceId !== null && this.selectedFaceId * 3 + 2 < indices.length) {
      const faceId = this.selectedFaceId;
      const beforeSnap = captureMeshSurfaceSnapshot(mesh);
      const preCtx = this.capturePreEditSubMeshContext(mesh);
      const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
      const i0 = indices[faceId * 3];
      const i1 = indices[faceId * 3 + 1];
      const i2 = indices[faceId * 3 + 2];

      const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      for (let c = 1; c <= numCopies; c++) {
        const off = new Vector3(offsetX * c, offsetY * c, offsetZ * c);
        const q0 = p0.add(off);
        const q1 = p1.add(off);
        const q2 = p2.add(off);

        const v0 = positions.length / 3;
        positions.push(q0.x, q0.y, q0.z);
        const v1 = positions.length / 3;
        positions.push(q1.x, q1.y, q1.z);
        const v2 = positions.length / 3;
        positions.push(q2.x, q2.y, q2.z);

        if (uvs.length > 0) {
          uvs.push(uvs[i0 * 2] ?? 0, uvs[i0 * 2 + 1] ?? 0);
          uvs.push(uvs[i1 * 2] ?? 0, uvs[i1 * 2 + 1] ?? 0);
          uvs.push(uvs[i2 * 2] ?? 0, uvs[i2 * 2 + 1] ?? 0);
        }

        indices.push(v0, v1, v2);
      }

      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.setIndices(indices);
      if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
      mesh.refreshBoundingInfo();

      this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
      this.recordMeshSurfaceEdit(mesh, `Array Face (${numCopies}x)`, beforeSnap, faceId, this.selectedFaceId ?? faceId);
      this.events.onSceneModified?.();
      this.events.onToast?.(`Created array of ${numCopies} faces!`, 'success');
      return;
    }

    const createdClones: Mesh[] = [];
    for (let c = 1; c <= numCopies; c++) {
      const clone = mesh.clone(`${mesh.name}_array_${c}`);
      clone.position.addInPlace(new Vector3(offsetX * c, offsetY * c, offsetZ * c));
      this.importedMeshes.push(clone);
      createdClones.push(clone);
    }

    if (createdClones.length > 0) {
      this.recordAction({
        name: `Array "${mesh.name}" (${numCopies}x)`,
        undo: () => {
          this.clearSelectionProxy();
          for (const cl of createdClones) {
            if (!cl.isDisposed()) cl.setEnabled(false);
            const idx = this.importedMeshes.indexOf(cl);
            if (idx !== -1) this.importedMeshes.splice(idx, 1);
          }
          if (!mesh.isDisposed()) this.selectMesh(mesh);
        },
        redo: () => {
          this.clearSelectionProxy();
          for (const cl of createdClones) {
            if (!cl.isDisposed()) {
              cl.setEnabled(true);
              if (!this.importedMeshes.includes(cl)) this.importedMeshes.push(cl);
            }
          }
          this.selectNodes([mesh, ...createdClones].filter((m) => !m.isDisposed()));
        },
      });
    }

    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Created array of ${numCopies} copies of "${mesh.name}"!`, 'success');
  }

  public deleteSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to delete.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);
    const deletedFaces = quad ? new Set(quad.faceIds) : new Set([faceId]);
    if (quad) {
      const facesToDelete = new Set(quad.faceIds);
      const newIndices: number[] = [];
      const numTriangles = indices.length / 3;
      for (let f = 0; f < numTriangles; f++) {
        if (!facesToDelete.has(f)) {
          newIndices.push(indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]);
        }
      }
      mesh.setIndices(newIndices);
    } else {
      indices.splice(faceId * 3, 3);
      mesh.setIndices(indices);
    }

    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, Array.from(mesh.getIndices() || []), normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx, deletedFaces);
    if (this.facetHighlightMesh) {
      this.facetHighlightMesh.dispose();
      this.facetHighlightMesh = null;
    }
    this.selectedFaceId = null;
    this.recordMeshSurfaceEdit(mesh, quad ? 'Delete Quad Face' : `Delete Face #${faceId}`, beforeSnap, faceId, null);
    this.events.onFaceSelected?.(null);
    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    this.events.onSceneModified?.();
    this.events.onToast?.(quad ? 'Quad face deleted.' : 'Face deleted.', 'success');
  }

  public flipSelectedFacetNormal(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to flip.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const preCtx = this.capturePreEditSubMeshContext(mesh);
    const srcMatIdx = getFacetMaterialInfo(mesh, faceId).materialIndex;
    const indices = Array.from(mesh.getIndices() || []);

    const quad = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, faceId);
    if (quad) {
      for (const f of quad.faceIds) {
        const temp = indices[f * 3 + 1];
        indices[f * 3 + 1] = indices[f * 3 + 2];
        indices[f * 3 + 2] = temp;
      }
    } else {
      // Swap 2 vertices to invert triangle winding
      const temp = indices[faceId * 3 + 1];
      indices[faceId * 3 + 1] = indices[faceId * 3 + 2];
      indices[faceId * 3 + 2] = temp;
    }

    mesh.setIndices(indices);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    }
    mesh.refreshBoundingInfo();
    this.finalizeSubMeshesAfterTopologyEdit(mesh, preCtx, srcMatIdx);
    const nextFaceId = this.selectedFaceId ?? faceId;
    this.recordMeshSurfaceEdit(mesh, quad ? 'Flip Quad Face Normal' : `Flip Face #${faceId} Normal`, beforeSnap, faceId, nextFaceId);
    this.highlightFace(mesh, nextFaceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(quad ? 'Quad face normal inverted!' : 'Face normal inverted!', 'success');
  }

  public getSceneEditableMaterials(): Material[] {
    const result: Material[] = [];
    const seen = new Set<Material>();
    for (const mat of this.scene.materials) {
      if (!mat || seen.has(mat)) continue;
      if (mat instanceof MultiMaterial) continue;
      if (mat === this.gridMaterial) continue;
      if (
        mat.name.startsWith('editor_') ||
        mat.name === 'gridMat' ||
        mat.name.endsWith('_wiremat') ||
        mat.name === 'BackgroundSkyboxMaterial'
      ) {
        continue;
      }
      seen.add(mat);
      result.push(mat);
    }
    return result;
  }

  public getSelectedFacetUVInfo(): FacetUVInfo | null {
    if (!this.selectedMesh || this.selectedFaceId === null) return null;
    const target = this.resolveTargetFacet(this.selectedMesh, this.selectedFaceId);
    if (!target) return null;
    return getFacetUVInfo(this.selectedMesh, target.faceIds, target.cornerPositions, target.isQuad);
  }

  public getSelectedFacetMaterialInfo(): FacetMaterialInfo | null {
    if (!this.selectedMesh || this.selectedFaceId === null) return null;
    const indices = this.selectedMesh.getIndices();
    if (!indices || this.selectedFaceId < 0 || this.selectedFaceId * 3 + 2 >= indices.length) {
      return null;
    }
    return getFacetMaterialInfo(this.selectedMesh, this.selectedFaceId);
  }

  public projectSelectedFacetUVs(
    mode: 'fit' | 'planar',
    options: FacetUVProjectionOptions = {}
  ): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    applyFacetUVProjection(mesh, target.faceIds, target.normal, mode, options);
    this.highlightFace(mesh, faceId);
    this.recordMeshSurfaceEdit(
      mesh,
      mode === 'fit' ? 'Facet UV Fit [0..1]' : 'Facet UV World Planar',
      beforeSnap,
      faceId,
      faceId
    );
    this.events.onFaceSelected?.(faceId, target.isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Projected ${mode === 'fit' ? 'Fit [0..1]' : 'World Planar'} UVs onto ${
        target.isQuad ? 'quad' : 'face'
      } #${faceId}.`,
      'success'
    );
    return true;
  }

  public setSelectedFacetUVRect(
    uMin: number,
    uMax: number,
    vMin: number,
    vMax: number
  ): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    if (![uMin, uMax, vMin, vMax].every((n) => Number.isFinite(n))) {
      this.events.onToast?.('Invalid UV bounds.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    remapFacetUVRect(mesh, target.faceIds, target.normal, uMin, uMax, vMin, vMax);
    this.highlightFace(mesh, faceId);
    this.recordMeshSurfaceEdit(mesh, 'Remap Facet UV Region', beforeSnap, faceId, faceId);
    this.events.onFaceSelected?.(faceId, target.isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Updated UV region for ${target.isQuad ? 'quad' : 'face'} #${faceId}.`, 'success');
    return true;
  }

  public transformSelectedFacetUVs(options: FacetUVTransformOptions): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
      applyFacetUVProjection(mesh, target.faceIds, target.normal, 'fit');
    }
    transformFacetUVs(mesh, target.faceIds, options);
    this.highlightFace(mesh, faceId);
    this.recordMeshSurfaceEdit(mesh, 'Transform Facet UVs', beforeSnap, faceId, faceId);
    this.events.onFaceSelected?.(faceId, target.isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Transformed UVs on ${target.isQuad ? 'quad' : 'face'} #${faceId}.`, 'success');
    return true;
  }

  public setSelectedFacetCornerUVs(cornerUVs: Array<{ u: number; v: number }>): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;
    if (
      cornerUVs.length < target.cornerPositions.length ||
      cornerUVs.some((c) => !Number.isFinite(c.u) || !Number.isFinite(c.v))
    ) {
      this.events.onToast?.('Invalid corner UV coordinates.', 'warning');
      return false;
    }

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    setFacetCornerUVs(mesh, target.faceIds, target.cornerPositions, cornerUVs);
    this.highlightFace(mesh, faceId);
    this.recordMeshSurfaceEdit(mesh, 'Edit Facet Corner UVs', beforeSnap, faceId, faceId);
    this.events.onFaceSelected?.(faceId, target.isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Updated corner UVs on ${target.isQuad ? 'quad' : 'face'} #${faceId}.`, 'success');
    return true;
  }

  private applyMaterialToTargetFacet(
    mesh: Mesh,
    faceIds: number[],
    mat: Material
  ): { newFaceId: number; isQuad: boolean } {
    ensureBaseMaterial(mesh);
    const triMats = getFaceTriangleMaterialIndices(mesh);
    const slots = getMeshSlotMaterials(mesh);

    let slotIdx = slots.indexOf(mat);
    if (slotIdx === -1) {
      slotIdx = slots.length;
      slots.push(mat);
    }

    for (const fid of faceIds) {
      if (fid >= 0 && fid < triMats.length) {
        triMats[fid] = slotIdx;
      }
    }

    const { faceIdMap } = rebuildMeshSubMeshes(mesh, triMats, slots, true);
    const primaryOldFaceId = faceIds[0] ?? 0;
    const newFaceId =
      primaryOldFaceId >= 0 && primaryOldFaceId < faceIdMap.length
        ? faceIdMap[primaryOldFaceId]
        : primaryOldFaceId;

    this.selectedFaceId = newFaceId;
    const matInfo = getFacetMaterialInfo(mesh, newFaceId);
    this.selectedSubMeshId = matInfo.subMeshIndex;
    const quadAfter = this.facetSingleTriangleMode ? null : this.getQuadFaceInfo(mesh, newFaceId);
    this.highlightFace(mesh, newFaceId);
    return { newFaceId, isQuad: !!quadAfter };
  }

  public assignMaterialToSelectedFacet(materialOrId: Material | string): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    let mat: Material | undefined;
    if (typeof materialOrId === 'string') {
      mat =
        this.getSceneEditableMaterials().find(
          (m) => m.id === materialOrId || m.name === materialOrId
        ) ||
        this.scene.materials.find(
          (m) => !(m instanceof MultiMaterial) && (m.id === materialOrId || m.name === materialOrId)
        );
    } else if (!(materialOrId instanceof MultiMaterial)) {
      mat = materialOrId;
    }

    if (!mat) {
      this.events.onToast?.('Material not found.', 'warning');
      return false;
    }

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const { newFaceId, isQuad } = this.applyMaterialToTargetFacet(mesh, target.faceIds, mat);
    this.recordMeshSurfaceEdit(mesh, 'Assign Material to Facet', beforeSnap, faceId, newFaceId);
    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    this.events.onFaceSelected?.(newFaceId, isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Assigned material "${mat.name}" to ${isQuad ? 'quad' : 'face'} #${newFaceId}.`,
      'success'
    );
    return true;
  }

  public assignNewColorMaterialToSelectedFacet(
    hexColor: string,
    name?: string
  ): Material | null {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return null;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return null;

    const cleanHex = (hexColor || '#4f8cf6').trim();
    let color: Color3;
    try {
      color = Color3.FromHexString(cleanHex.startsWith('#') ? cleanHex : `#${cleanHex}`);
    } catch {
      color = new Color3(0.31, 0.55, 0.96);
    }

    const matName =
      name?.trim() || `FacetMat_${cleanHex.replace('#', '')}_${Date.now().toString().slice(-4)}`;
    const mat = new PBRMaterial(matName, this.scene);
    mat.albedoColor = color;
    mat.roughness = 0.5;
    mat.metallic = 0.0;
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    const { newFaceId, isQuad } = this.applyMaterialToTargetFacet(mesh, target.faceIds, mat);
    this.recordMeshSurfaceEdit(
      mesh,
      'Assign Color Material to Facet',
      beforeSnap,
      faceId,
      newFaceId
    );
    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    this.events.onFaceSelected?.(newFaceId, isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Assigned new material "${mat.name}" to facet.`, 'success');
    return mat;
  }

  public assignTextureToSelectedFacet(fileOrUrl: File | string, name?: string): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    let url: string;
    let texName: string;
    if (fileOrUrl instanceof File) {
      url = URL.createObjectURL(fileOrUrl);
      this.objectUrls.add(url);
      texName = name?.trim() || fileOrUrl.name;
      this.registerDroppedFiles([fileOrUrl]);
    } else {
      url = fileOrUrl;
      texName = name?.trim() || 'FacetTexture';
    }
    if (!url) {
      this.events.onToast?.('No texture source provided.', 'warning');
      return false;
    }

    let tex = this.scene.textures.find(
      (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === url
    );
    if (!tex) {
      tex = new Texture(url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      tex.name = texName;
    } else if (name) {
      tex.name = texName;
    }
    tex.hasAlpha = false;

    let mat = this.scene.materials.find(
      (m): m is PBRMaterial =>
        m instanceof PBRMaterial && m.metadata && m.metadata.facetTextureUrl === url
    );
    if (!mat) {
      const safeName = texName.replace(/[^a-zA-Z0-9_-]/g, '_');
      mat = new PBRMaterial(`FacetTex_${safeName}_${Date.now().toString().slice(-4)}`, this.scene);
      mat.albedoColor = Color3.White();
      mat.albedoTexture = tex;
      mat.roughness = 0.6;
      mat.metallic = 0.0;
      mat.useAlphaFromAlbedoTexture = false;
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
      mat.metadata = { facetTextureUrl: url };
    }

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
      applyFacetUVProjection(mesh, target.faceIds, target.normal, 'fit');
    }
    const { newFaceId, isQuad } = this.applyMaterialToTargetFacet(mesh, target.faceIds, mat);
    this.recordMeshSurfaceEdit(mesh, 'Assign Texture to Facet', beforeSnap, faceId, newFaceId);
    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    this.events.onFaceSelected?.(newFaceId, isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied texture "${texName}" to facet.`, 'success');
    return true;
  }

  public assignAtlasTileToSelectedFacet(
    atlasId: string,
    frameId: string,
    assignAtlasMaterial: boolean = true
  ): boolean {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return false;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const target = this.resolveTargetFacet(mesh, faceId);
    if (!target) return false;

    const atlas = this.textureAtlasManager.getAtlas(atlasId);
    if (!atlas) {
      this.events.onToast?.('Atlas not found.', 'error');
      return false;
    }
    const frame = atlas.frames.find((f) => f.id === frameId || f.name === frameId);
    if (!frame) {
      this.events.onToast?.('Tile not found in atlas.', 'error');
      return false;
    }

    const beforeSnap = captureMeshSurfaceSnapshot(mesh);
    remapFacetUVRect(
      mesh,
      target.faceIds,
      target.normal,
      frame.uMin,
      frame.uMax,
      frame.vMin,
      frame.vMax
    );

    let finalFaceId = faceId;
    let isQuad = target.isQuad;
    if (assignAtlasMaterial) {
      let atlasMat = this.scene.materials.find(
        (m): m is PBRMaterial =>
          m instanceof PBRMaterial && m.metadata && m.metadata.atlasId === atlas.id
      );
      if (!atlasMat) {
        let atlasTex = atlas.texture;
        if (!atlasTex && atlas.dataUrl) {
          atlasTex = new Texture(atlas.dataUrl, this.scene, false, true, Texture.NEAREST_SAMPLINGMODE);
        }
        atlasMat = new PBRMaterial(`Atlas_${atlas.name}`, this.scene);
        atlasMat.albedoColor = Color3.White();
        atlasMat.albedoTexture = atlasTex || null;
        atlasMat.roughness = 0.85;
        atlasMat.metallic = 0.0;
        atlasMat.useAlphaFromAlbedoTexture = false;
        atlasMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
        atlasMat.metadata = { atlasId: atlas.id };
      }
      const res = this.applyMaterialToTargetFacet(mesh, target.faceIds, atlasMat);
      finalFaceId = res.newFaceId;
      isQuad = res.isQuad;
    } else {
      this.highlightFace(mesh, finalFaceId);
    }

    this.recordMeshSurfaceEdit(
      mesh,
      assignAtlasMaterial ? 'Assign Atlas Tile to Facet' : 'Map Facet UVs to Atlas Tile',
      beforeSnap,
      faceId,
      finalFaceId
    );
    this.events.onSelectionChanged?.(this.selectedNodes, this.selectedMesh, this.selectedSubMeshId);
    this.events.onFaceSelected?.(finalFaceId, isQuad);
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Mapped tile "${frame.name}" from "${atlas.name}" onto ${isQuad ? 'quad' : 'face'} #${finalFaceId}.`,
      'success'
    );
    return true;
  }

  /* =========================================================================
     11. MATERIALS & UV MAPPING
     ========================================================================= */
  public getSelectedMaterial(): Material | null {
    if (!this.selectedMesh) return null;
    if (this.selectedSubMeshId !== null && this.selectedMesh.subMeshes) {
      const sm = this.selectedMesh.subMeshes[this.selectedSubMeshId];
      if (sm) {
        const mat = sm.getMaterial();
        if (mat) return mat;
      }
    }
    return this.selectedMesh.material;
  }

  public createNewMaterialForSelected(name?: string): Material | null {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return null;
    }
    const mesh = this.selectedMesh;
    const prevMat = mesh.material;
    const matName = name || `Mat_${mesh.name}_${Date.now().toString().slice(-4)}`;
    const mat = new PBRMaterial(matName, this.scene);
    mat.albedoColor = new Color3(0.9, 0.9, 0.9);
    mat.roughness = 0.5;
    mat.metallic = 0.0;
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;

    mesh.material = mat;

    this.recordAction({
      name: `Create Material "${matName}"`,
      undo: () => {
        if (mesh.isDisposed()) return;
        mesh.material = prevMat;
        this.events.onTexturesChanged?.();
      },
      redo: () => {
        if (mesh.isDisposed()) return;
        mesh.material = mat;
        this.events.onTexturesChanged?.();
      },
    });

    this.events.onSceneModified?.();
    this.events.onToast?.(`Created new PBR Material "${matName}"!`, 'success');
    return mat;
  }

  public getActiveMaterialTexture(): Texture | null {
    const mat = this.getSelectedMaterial();
    if (!mat) return null;
    if (mat instanceof PBRMaterial) {
      return (mat.albedoTexture as Texture) || null;
    } else if (mat instanceof StandardMaterial) {
      return (mat.diffuseTexture as Texture) || null;
    }
    return null;
  }

  private buildActiveTextureSlot(
    tex: unknown,
    slot: ActiveTextureSlotInfo['slot'],
    label: string
  ): ActiveTextureSlotInfo | null {
    if (!(tex instanceof Texture)) return null;
    const size = tex.getSize();
    return {
      slot,
      label,
      name: tex.name || 'embedded_texture',
      url: this.resolveTextureImageUrl(tex) || tex.url || '',
      width: size.width || 0,
      height: size.height || 0,
    };
  }

  /**
   * Returns structured metadata about all textures currently assigned to the selected material.
   */
  public getActiveMaterialTexturesInfo(): ActiveMaterialTexturesInfo {
    const mat = this.getSelectedMaterial();
    if (!mat) {
      return {
        hasMaterial: false,
        materialName: 'No material',
        materialType: 'None',
        albedo: null,
        bump: null,
        emissive: null,
        metallic: null,
        extra: [],
      };
    }

    if (mat instanceof PBRMaterial) {
      return {
        hasMaterial: true,
        materialName: mat.name || 'PBR Material',
        materialType: 'PBR',
        albedo: this.buildActiveTextureSlot(mat.albedoTexture, 'albedo', 'Albedo'),
        bump: this.buildActiveTextureSlot(mat.bumpTexture, 'normal', 'Normal / Bump'),
        emissive: this.buildActiveTextureSlot(mat.emissiveTexture, 'emissive', 'Emissive'),
        metallic: this.buildActiveTextureSlot(mat.metallicTexture, 'metallic', 'Metallic / Roughness'),
        extra: [],
      };
    }

    if (mat instanceof StandardMaterial) {
      return {
        hasMaterial: true,
        materialName: mat.name || 'Standard Material',
        materialType: 'Standard',
        albedo: this.buildActiveTextureSlot(mat.diffuseTexture, 'diffuse', 'Diffuse'),
        bump: this.buildActiveTextureSlot(mat.bumpTexture, 'normal', 'Normal / Bump'),
        emissive: this.buildActiveTextureSlot(mat.emissiveTexture, 'emissive', 'Emissive'),
        metallic: null,
        extra: [],
      };
    }

    if (mat instanceof TerrainMaterial) {
      const extra: ActiveTextureSlotInfo[] = [];
      const t1 = this.buildActiveTextureSlot(mat.diffuseTexture1, 'terrain1', 'Layer 1 (High)');
      const t2 = this.buildActiveTextureSlot(mat.diffuseTexture2, 'terrain2', 'Layer 2 (Mid)');
      const t3 = this.buildActiveTextureSlot(mat.diffuseTexture3, 'terrain3', 'Layer 3 (Low)');
      if (t1) extra.push(t1);
      if (t2) extra.push(t2);
      if (t3) extra.push(t3);
      return {
        hasMaterial: true,
        materialName: mat.name || 'Terrain Material',
        materialType: 'Terrain',
        albedo: null,
        bump: null,
        emissive: null,
        metallic: null,
        extra,
      };
    }

    if (mat instanceof MultiMaterial) {
      const extra: ActiveTextureSlotInfo[] = [];
      for (const sub of mat.subMaterials || []) {
        if (!sub) continue;
        if (sub instanceof PBRMaterial && sub.albedoTexture) {
          const slot = this.buildActiveTextureSlot(sub.albedoTexture, 'albedo', sub.name || 'Sub-material');
          if (slot) extra.push(slot);
        } else if (sub instanceof StandardMaterial && sub.diffuseTexture) {
          const slot = this.buildActiveTextureSlot(sub.diffuseTexture, 'diffuse', sub.name || 'Sub-material');
          if (slot) extra.push(slot);
        }
      }
      return {
        hasMaterial: true,
        materialName: mat.name || 'MultiMaterial',
        materialType: 'MultiMaterial',
        albedo: null,
        bump: null,
        emissive: null,
        metallic: null,
        extra,
      };
    }

    return {
      hasMaterial: true,
      materialName: mat.name || 'Material',
      materialType: mat.getClassName?.() || 'Material',
      albedo: null,
      bump: null,
      emissive: null,
      metallic: null,
      extra: [],
    };
  }

  /**
   * Checks whether an embedded texture entry is currently assigned to the given material.
   */
  public isTextureAssignedToMaterial(
    mat: Material | null,
    texInfo: Pick<EmbeddedTextureInfo, 'id' | 'name' | 'url' | 'width' | 'height' | 'isAtlas' | 'atlasId'>
  ): { isAlbedo: boolean; isBump: boolean; isOther: boolean } {
    if (!mat) return { isAlbedo: false, isBump: false, isOther: false };

    const atlasTex =
      texInfo.isAtlas && texInfo.atlasId ? this.textureAtlasManager.getAtlas(texInfo.atlasId)?.texture : undefined;

    const matches = (matTex: unknown): boolean => {
      if (!(matTex instanceof Texture)) return false;
      if (texInfo.isAtlas && texInfo.atlasId) {
        if (mat.metadata?.atlasId === texInfo.atlasId || atlasTex === matTex) {
          return true;
        }
      }
      if (texInfo.id && matTex.uniqueId && String(matTex.uniqueId) === texInfo.id) {
        return true;
      }
      if (texInfo.url && matTex.url === texInfo.url) {
        return true;
      }
      if (texInfo.url && this.resolveTextureImageUrl(matTex) === texInfo.url) {
        return true;
      }
      if (
        texInfo.name &&
        matTex.name === texInfo.name &&
        texInfo.name !== 'embedded_texture' &&
        !texInfo.name.startsWith('data:')
      ) {
        const size = matTex.getSize();
        if (texInfo.width > 0 && size.width > 0) {
          return size.width === texInfo.width && size.height === texInfo.height;
        }
        return true;
      }
      return false;
    };

    if (mat instanceof PBRMaterial) {
      return {
        isAlbedo: matches(mat.albedoTexture),
        isBump: matches(mat.bumpTexture),
        isOther: matches(mat.emissiveTexture) || matches(mat.metallicTexture) || matches(mat.opacityTexture),
      };
    }

    if (mat instanceof StandardMaterial) {
      return {
        isAlbedo: matches(mat.diffuseTexture),
        isBump: matches(mat.bumpTexture),
        isOther: matches(mat.emissiveTexture) || matches(mat.specularTexture) || matches(mat.opacityTexture),
      };
    }

    if (mat instanceof TerrainMaterial) {
      return {
        isAlbedo: matches(mat.diffuseTexture1) || matches(mat.diffuseTexture2) || matches(mat.diffuseTexture3),
        isBump: false,
        isOther: matches(mat.mixTexture),
      };
    }

    return { isAlbedo: false, isBump: false, isOther: false };
  }

  public applyTextureToSelectedMaterial(url: string, name?: string): boolean {
    const mesh = this.selectedMesh;
    const prevMeshMat = mesh ? mesh.material : null;
    let selMat = this.getSelectedMaterial();
    let createdNewMat = false;
    if (!selMat && mesh) {
      selMat = this.runWithoutRecording(() => this.createNewMaterialForSelected());
      createdNewMat = !!selMat;
    }
    if (!selMat) {
      this.events.onToast?.('Please select a mesh first', 'warning');
      return false;
    }

    // Capture previous texture state
    const targetMat = selMat;
    const prevAlbedo =
      targetMat instanceof PBRMaterial
        ? targetMat.albedoTexture
        : targetMat instanceof StandardMaterial
        ? targetMat.diffuseTexture
        : null;
    const prevUseAlpha =
      targetMat instanceof PBRMaterial
        ? targetMat.useAlphaFromAlbedoTexture
        : targetMat instanceof StandardMaterial
        ? targetMat.useAlphaFromDiffuseTexture
        : false;
    const prevTransMode =
      targetMat instanceof PBRMaterial ? targetMat.transparencyMode : null;

    // Reuse existing Texture instance in the scene with the same URL if available
    let tex = this.scene.textures.find(
      (t): t is Texture =>
        t instanceof Texture && !(t as any).isRenderTarget && (t.url === url || this.resolveTextureImageUrl(t) === url)
    );
    if (!tex) {
      tex = new Texture(url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      if (name) tex.name = name;
    } else if (name) {
      tex.name = name;
    }

    // Default texture alpha to false - the user decides whether to enable alpha and transparency
    const prevTexHasAlpha = tex.hasAlpha;
    tex.hasAlpha = false;

    if (targetMat instanceof PBRMaterial) {
      targetMat.albedoTexture = tex;
      targetMat.useAlphaFromAlbedoTexture = false;
      targetMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
    } else if (targetMat instanceof StandardMaterial) {
      targetMat.diffuseTexture = tex;
      targetMat.useAlphaFromDiffuseTexture = false;
    }

    const appliedTex = tex;
    this.recordAction({
      name: `Apply Texture "${appliedTex.name || 'texture'}"`,
      undo: () => {
        if (createdNewMat && mesh && !mesh.isDisposed()) {
          mesh.material = prevMeshMat;
        } else if (targetMat instanceof PBRMaterial) {
          targetMat.albedoTexture = prevAlbedo;
          targetMat.useAlphaFromAlbedoTexture = prevUseAlpha;
          targetMat.transparencyMode = prevTransMode;
        } else if (targetMat instanceof StandardMaterial) {
          targetMat.diffuseTexture = prevAlbedo;
          targetMat.useAlphaFromDiffuseTexture = prevUseAlpha;
        }
        appliedTex.hasAlpha = prevTexHasAlpha;
        this.events.onTexturesChanged?.();
      },
      redo: () => {
        if (createdNewMat && mesh && !mesh.isDisposed()) {
          mesh.material = targetMat;
        }
        appliedTex.hasAlpha = false;
        if (targetMat instanceof PBRMaterial) {
          targetMat.albedoTexture = appliedTex;
          targetMat.useAlphaFromAlbedoTexture = false;
          targetMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
        } else if (targetMat instanceof StandardMaterial) {
          targetMat.diffuseTexture = appliedTex;
          targetMat.useAlphaFromDiffuseTexture = false;
        }
        this.events.onTexturesChanged?.();
      },
    });

    this.events.onTexturesChanged?.();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied texture to material "${selMat.name}"`, 'success');
    return true;
  }

  /**
   * Removes the active diffuse/albedo texture from the selected material without deleting the embedded texture.
   */
  public removeTextureFromSelectedMaterial(): boolean {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return false;
    if (selMat instanceof PBRMaterial) {
      if (!selMat.albedoTexture) return false;
      const prevTex = selMat.albedoTexture;
      const prevUseAlpha = selMat.useAlphaFromAlbedoTexture;
      const prevTransMode = selMat.transparencyMode;
      selMat.albedoTexture = null;
      selMat.useAlphaFromAlbedoTexture = false;
      selMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
      this.recordAction({
        name: `Remove Texture from "${selMat.name}"`,
        undo: () => {
          selMat.albedoTexture = prevTex;
          selMat.useAlphaFromAlbedoTexture = prevUseAlpha;
          selMat.transparencyMode = prevTransMode;
          this.events.onTexturesChanged?.();
        },
        redo: () => {
          selMat.albedoTexture = null;
          selMat.useAlphaFromAlbedoTexture = false;
          selMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
          this.events.onTexturesChanged?.();
        },
      });
      this.events.onTexturesChanged?.();
      this.events.onSceneModified?.();
      this.events.onToast?.(`Removed texture from material "${selMat.name}"`, 'info');
      return true;
    }
    if (selMat instanceof StandardMaterial) {
      if (!selMat.diffuseTexture) return false;
      const prevTex = selMat.diffuseTexture;
      const prevUseAlpha = selMat.useAlphaFromDiffuseTexture;
      selMat.diffuseTexture = null;
      selMat.useAlphaFromDiffuseTexture = false;
      this.recordAction({
        name: `Remove Texture from "${selMat.name}"`,
        undo: () => {
          selMat.diffuseTexture = prevTex;
          selMat.useAlphaFromDiffuseTexture = prevUseAlpha;
          this.events.onTexturesChanged?.();
        },
        redo: () => {
          selMat.diffuseTexture = null;
          selMat.useAlphaFromDiffuseTexture = false;
          this.events.onTexturesChanged?.();
        },
      });
      this.events.onTexturesChanged?.();
      this.events.onSceneModified?.();
      this.events.onToast?.(`Removed texture from material "${selMat.name}"`, 'info');
      return true;
    }
    return false;
  }

  public applyBumpTextureToSelectedMaterial(fileOrUrl: File | string, name?: string): boolean {
    const mesh = this.selectedMesh;
    const prevMeshMat = mesh ? mesh.material : null;
    let selMat = this.getSelectedMaterial();
    let createdNewMat = false;
    if (!selMat && mesh) {
      selMat = this.runWithoutRecording(() => this.createNewMaterialForSelected());
      createdNewMat = !!selMat;
    }
    if (!selMat) {
      this.events.onToast?.('Please select a mesh first', 'warning');
      return false;
    }

    const targetMat = selMat;
    const prevBump =
      targetMat instanceof PBRMaterial || targetMat instanceof StandardMaterial ? targetMat.bumpTexture : null;
    const prevBumpLevel = prevBump ? prevBump.level : 1.0;

    let url: string;
    let texName = name;
    if (fileOrUrl instanceof File) {
      url = URL.createObjectURL(fileOrUrl);
      this.objectUrls.add(url);
      if (!texName) texName = fileOrUrl.name;
      this.registerDroppedFiles([fileOrUrl]);
    } else {
      url = fileOrUrl;
    }

    // Reuse existing Texture instance in the scene with the same URL if available
    let tex = this.scene.textures.find(
      (t): t is Texture =>
        t instanceof Texture && !(t as any).isRenderTarget && (t.url === url || this.resolveTextureImageUrl(t) === url)
    );
    if (!tex) {
      tex = new Texture(url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      if (texName) tex.name = texName;
    } else if (texName) {
      tex.name = texName;
    }
    tex.hasAlpha = false;

    const baseTex = this.getActiveMaterialTexture();
    if (baseTex) {
      tex.uOffset = baseTex.uOffset;
      tex.vOffset = baseTex.vOffset;
      tex.uScale = baseTex.uScale;
      tex.vScale = baseTex.vScale;
      tex.wAng = baseTex.wAng;
      tex.wrapU = baseTex.wrapU;
      tex.wrapV = baseTex.wrapV;
    }

    if (targetMat instanceof PBRMaterial || targetMat instanceof StandardMaterial) {
      targetMat.bumpTexture = tex;
      tex.level = 1.0;
    }

    const appliedTex = tex;
    this.recordAction({
      name: `Apply Bump/Normal Map "${appliedTex.name || 'normal'}"`,
      undo: () => {
        if (createdNewMat && mesh && !mesh.isDisposed()) {
          mesh.material = prevMeshMat;
        } else if (targetMat instanceof PBRMaterial || targetMat instanceof StandardMaterial) {
          targetMat.bumpTexture = prevBump;
          if (prevBump) prevBump.level = prevBumpLevel;
        }
        this.events.onTexturesChanged?.();
      },
      redo: () => {
        if (createdNewMat && mesh && !mesh.isDisposed()) {
          mesh.material = targetMat;
        }
        if (targetMat instanceof PBRMaterial || targetMat instanceof StandardMaterial) {
          targetMat.bumpTexture = appliedTex;
          appliedTex.level = 1.0;
        }
        this.events.onTexturesChanged?.();
      },
    });

    this.events.onTexturesChanged?.();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied bump/normal map to material "${selMat.name}"`, 'success');
    return true;
  }

  public applyNormalMapToSelectedMaterial(fileOrUrl: File | string, name?: string): boolean {
    const res = this.applyBumpTextureToSelectedMaterial(fileOrUrl, name);
    if (res) {
      const selMat = this.getSelectedMaterial();
      this.events.onToast?.(`Applied normal map to material "${selMat?.name || 'selected'}"`, 'success');
    }
    return res;
  }

  public removeBumpTextureFromSelectedMaterial(): boolean {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return false;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      if (!selMat.bumpTexture) return false;
      const prevBump = selMat.bumpTexture;
      selMat.bumpTexture = null;
      this.recordAction({
        name: `Remove Bump Map from "${selMat.name}"`,
        undo: () => {
          selMat.bumpTexture = prevBump;
          this.events.onTexturesChanged?.();
        },
        redo: () => {
          selMat.bumpTexture = null;
          this.events.onTexturesChanged?.();
        },
      });
      this.events.onTexturesChanged?.();
      this.events.onSceneModified?.();
      this.events.onToast?.(`Removed normal / bump map from material "${selMat.name}"`, 'info');
      return true;
    }
    return false;
  }

  public setBumpLevel(level: number): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if ((selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) && selMat.bumpTexture) {
      selMat.bumpTexture.level = level;
      this.events.onSceneModified?.();
    }
  }

  public setInvertNormalMapX(invert: boolean): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      const prev = !!selMat.invertNormalMapX;
      if (prev === invert) return;
      selMat.invertNormalMapX = invert;
      this.recordAction({
        name: `Invert Normal Map X (${invert ? 'On' : 'Off'})`,
        undo: () => {
          selMat.invertNormalMapX = prev;
        },
        redo: () => {
          selMat.invertNormalMapX = invert;
        },
      });
      this.events.onSceneModified?.();
    }
  }

  public setInvertNormalMapY(invert: boolean): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      const prev = !!selMat.invertNormalMapY;
      if (prev === invert) return;
      selMat.invertNormalMapY = invert;
      this.recordAction({
        name: `Invert Normal Map Y (${invert ? 'On' : 'Off'})`,
        undo: () => {
          selMat.invertNormalMapY = prev;
        },
        redo: () => {
          selMat.invertNormalMapY = invert;
        },
      });
      this.events.onSceneModified?.();
    }
  }

  public setUseParallax(enabled: boolean): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      const prev = !!selMat.useParallax;
      if (prev === enabled) return;
      selMat.useParallax = enabled;
      this.recordAction({
        name: `Parallax Mapping (${enabled ? 'On' : 'Off'})`,
        undo: () => {
          selMat.useParallax = prev;
        },
        redo: () => {
          selMat.useParallax = enabled;
        },
      });
      this.events.onSceneModified?.();
    }
  }

  public setUseParallaxOcclusion(enabled: boolean): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      const prevOcclusion = !!selMat.useParallaxOcclusion;
      const prevParallax = !!selMat.useParallax;
      if (prevOcclusion === enabled && (!enabled || prevParallax)) return;
      selMat.useParallaxOcclusion = enabled;
      if (enabled) {
        selMat.useParallax = true;
      }
      const nextParallax = !!selMat.useParallax;
      this.recordAction({
        name: `Parallax Occlusion (${enabled ? 'On' : 'Off'})`,
        undo: () => {
          selMat.useParallaxOcclusion = prevOcclusion;
          selMat.useParallax = prevParallax;
        },
        redo: () => {
          selMat.useParallaxOcclusion = enabled;
          selMat.useParallax = nextParallax;
        },
      });
      this.events.onSceneModified?.();
    }
  }

  public setParallaxScaleBias(scale: number): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      selMat.parallaxScaleBias = scale;
      this.events.onSceneModified?.();
    }
  }

  public generateNormalMapFromActiveTexture(strength: number = 2.0): boolean {
    const selMat = this.getSelectedMaterial();
    if (!selMat || !(selMat instanceof PBRMaterial || selMat instanceof StandardMaterial)) {
      this.events.onToast?.('Please select a mesh with a material first', 'warning');
      return false;
    }
    const baseTex = this.getActiveMaterialTexture();
    if (!baseTex || !baseTex.url) {
      this.events.onToast?.('No active diffuse/albedo texture found to generate normal map from', 'warning');
      return false;
    }

    if (typeof document === 'undefined') return false;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 256;
          canvas.height = img.naturalHeight || 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const normalUrl = generateNormalMapFromCanvas(canvas, strength, !!selMat.invertNormalMapY);
          const normName = `${(baseTex.name || 'texture').replace(/\.[^/.]+$/, '')}_normal.png`;
          this.applyBumpTextureToSelectedMaterial(normalUrl, normName);
          this.events.onToast?.(`Generated and applied normal map from "${baseTex.name || 'texture'}"`, 'success');
        } catch (e: any) {
          this.events.onToast?.(`Failed to generate normal map: ${e.message}`, 'error');
        }
      };
      img.onerror = () => {
        this.events.onToast?.('Failed to load active texture image for normal map generation', 'error');
      };
      img.src = baseTex.url;
      return true;
    } catch {
      return false;
    }
  }

  public getMaterialBumpInfo(): {
    hasBump: boolean;
    name: string;
    level: number;
    invertX: boolean;
    invertY: boolean;
    useParallax: boolean;
    useParallaxOcclusion: boolean;
    parallaxScaleBias: number;
  } {
    const selMat = this.getSelectedMaterial();
    if (!selMat || !(selMat instanceof PBRMaterial || selMat instanceof StandardMaterial)) {
      return {
        hasBump: false,
        name: 'None',
        level: 1.0,
        invertX: false,
        invertY: false,
        useParallax: false,
        useParallaxOcclusion: false,
        parallaxScaleBias: 0.05,
      };
    }
    const hasBump = !!selMat.bumpTexture;
    const name = selMat.bumpTexture?.name || 'None';
    const level = selMat.bumpTexture?.level ?? 1.0;
    const invertX = !!selMat.invertNormalMapX;
    const invertY = !!selMat.invertNormalMapY;
    const useParallax = !!selMat.useParallax;
    const useParallaxOcclusion = !!selMat.useParallaxOcclusion;
    const parallaxScaleBias = typeof selMat.parallaxScaleBias === 'number' ? selMat.parallaxScaleBias : 0.05;
    return { hasBump, name, level, invertX, invertY, useParallax, useParallaxOcclusion, parallaxScaleBias };
  }

  public setTextureAlpha(enabled: boolean): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    const tex = this.getActiveMaterialTexture();
    const prevTexAlpha = tex ? !!tex.hasAlpha : false;
    const prevBackFace = mat.backFaceCulling;
    const prevUseAlpha =
      mat instanceof PBRMaterial
        ? mat.useAlphaFromAlbedoTexture
        : mat instanceof StandardMaterial
        ? mat.useAlphaFromDiffuseTexture
        : false;
    const prevTransMode = mat instanceof PBRMaterial ? mat.transparencyMode : null;

    if (tex) {
      tex.hasAlpha = enabled;
    }
    if (mat instanceof PBRMaterial) {
      mat.useAlphaFromAlbedoTexture = enabled;
      if (
        enabled &&
        (mat.transparencyMode === PBRMaterial.PBRMATERIAL_OPAQUE ||
          mat.transparencyMode === undefined ||
          mat.transparencyMode === null)
      ) {
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
      } else if (!enabled) {
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
      }
      mat.backFaceCulling = !enabled;
    } else if (mat instanceof StandardMaterial) {
      mat.useAlphaFromDiffuseTexture = enabled;
      mat.backFaceCulling = !enabled;
    }

    const nextBackFace = mat.backFaceCulling;
    const nextTransMode = mat instanceof PBRMaterial ? mat.transparencyMode : null;
    this.recordAction({
      name: `Texture Alpha (${enabled ? 'On' : 'Off'})`,
      undo: () => {
        if (tex) tex.hasAlpha = prevTexAlpha;
        mat.backFaceCulling = prevBackFace;
        if (mat instanceof PBRMaterial) {
          mat.useAlphaFromAlbedoTexture = prevUseAlpha;
          mat.transparencyMode = prevTransMode;
        } else if (mat instanceof StandardMaterial) {
          mat.useAlphaFromDiffuseTexture = prevUseAlpha;
        }
      },
      redo: () => {
        if (tex) tex.hasAlpha = enabled;
        mat.backFaceCulling = nextBackFace;
        if (mat instanceof PBRMaterial) {
          mat.useAlphaFromAlbedoTexture = enabled;
          mat.transparencyMode = nextTransMode;
        } else if (mat instanceof StandardMaterial) {
          mat.useAlphaFromDiffuseTexture = enabled;
        }
      },
    });

    this.events.onSceneModified?.();
  }

  public setMaterialTransparencyMode(mode: number): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    const tex = this.getActiveMaterialTexture();
    const prevTexAlpha = tex ? !!tex.hasAlpha : false;
    const prevBackFace = mat.backFaceCulling;
    const prevMode = (mat as any).transparencyMode;
    const prevUseAlpha =
      mat instanceof PBRMaterial
        ? mat.useAlphaFromAlbedoTexture
        : mat instanceof StandardMaterial
        ? mat.useAlphaFromDiffuseTexture
        : false;

    if (mat instanceof PBRMaterial) {
      mat.transparencyMode = mode;
      mat.useAlphaFromAlbedoTexture = mode !== PBRMaterial.PBRMATERIAL_OPAQUE;
      if (mode !== PBRMaterial.PBRMATERIAL_OPAQUE) mat.backFaceCulling = false;
    } else if (mat instanceof StandardMaterial) {
      mat.transparencyMode = mode;
      mat.useAlphaFromDiffuseTexture = mode !== 0;
      if (mode !== 0) mat.backFaceCulling = false;
    }
    if (tex) {
      tex.hasAlpha = mode !== 0;
    }

    const nextBackFace = mat.backFaceCulling;
    const nextUseAlpha =
      mat instanceof PBRMaterial
        ? mat.useAlphaFromAlbedoTexture
        : mat instanceof StandardMaterial
        ? mat.useAlphaFromDiffuseTexture
        : false;
    this.recordAction({
      name: `Change Transparency Mode`,
      undo: () => {
        if (tex) tex.hasAlpha = prevTexAlpha;
        mat.backFaceCulling = prevBackFace;
        if (mat instanceof PBRMaterial) {
          mat.transparencyMode = prevMode;
          mat.useAlphaFromAlbedoTexture = prevUseAlpha;
        } else if (mat instanceof StandardMaterial) {
          mat.transparencyMode = prevMode;
          mat.useAlphaFromDiffuseTexture = prevUseAlpha;
        }
      },
      redo: () => {
        if (tex) tex.hasAlpha = mode !== 0;
        mat.backFaceCulling = nextBackFace;
        if (mat instanceof PBRMaterial) {
          mat.transparencyMode = mode;
          mat.useAlphaFromAlbedoTexture = nextUseAlpha;
        } else if (mat instanceof StandardMaterial) {
          mat.transparencyMode = mode;
          mat.useAlphaFromDiffuseTexture = nextUseAlpha;
        }
      },
    });

    this.events.onSceneModified?.();
  }

  public setMaterialTwoSided(twoSided: boolean): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    const prevBackFace = mat.backFaceCulling;
    const nextBackFace = !twoSided;
    if (prevBackFace === nextBackFace) return;
    mat.backFaceCulling = nextBackFace;
    this.recordAction({
      name: `Two-Sided Material (${twoSided ? 'On' : 'Off'})`,
      undo: () => {
        mat.backFaceCulling = prevBackFace;
      },
      redo: () => {
        mat.backFaceCulling = nextBackFace;
      },
    });
    this.events.onSceneModified?.();
  }

  public setMaterialAlphaCutOff(cutoff: number): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    if (mat instanceof PBRMaterial) {
      mat.alphaCutOff = cutoff;
    }
    this.events.onSceneModified?.();
  }

  public getMaterialTransparencyInfo(): {
    hasAlpha: boolean;
    mode: number;
    twoSided: boolean;
    alphaCutOff: number;
  } {
    const mat = this.getSelectedMaterial();
    if (!mat) return { hasAlpha: false, mode: 0, twoSided: true, alphaCutOff: 0.5 };
    const tex = this.getActiveMaterialTexture();
    const hasAlpha = tex ? !!tex.hasAlpha : false;
    let mode = 0;
    let alphaCutOff = 0.5;
    if (mat instanceof PBRMaterial) {
      mode = mat.transparencyMode ?? (hasAlpha ? PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND : 0);
      alphaCutOff = mat.alphaCutOff ?? 0.5;
    } else if (mat instanceof StandardMaterial) {
      mode = (mat as any).transparencyMode ?? (hasAlpha ? 2 : 0);
    }
    const twoSided = mat.backFaceCulling === false;
    return { hasAlpha, mode, twoSided, alphaCutOff };
  }

  private recordMeshUVEdit(
    mesh: Mesh,
    actionName: string,
    beforeUVs: number[] | null,
    afterUVs: number[]
  ): void {
    const afterCopy = [...afterUVs];
    const beforeCopy = beforeUVs ? [...beforeUVs] : null;
    this.recordAction({
      name: actionName,
      undo: () => {
        if (mesh.isDisposed()) return;
        if (beforeCopy) {
          mesh.setVerticesData(VertexBuffer.UVKind, [...beforeCopy], true);
        } else {
          mesh.removeVerticesData(VertexBuffer.UVKind);
        }
      },
      redo: () => {
        if (mesh.isDisposed()) return;
        mesh.setVerticesData(VertexBuffer.UVKind, [...afterCopy], true);
      },
    });
  }

  public applyTriplanarUVs(scaleOrUScale: number = 1.0, vScaleParam?: number): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    if (!positions || !normals) return;

    const prevUVRaw = mesh.getVerticesData(VertexBuffer.UVKind);
    const beforeUVs = prevUVRaw ? Array.from(prevUVRaw) : null;

    const uScale = typeof scaleOrUScale === 'number' && !isNaN(scaleOrUScale) ? scaleOrUScale : 1.0;
    const vScale = typeof vScaleParam === 'number' && !isNaN(vScaleParam) ? vScaleParam : uScale;

    const uvs: number[] = [];
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const nx = Math.abs(normals[i * 3]);
      const ny = Math.abs(normals[i * 3 + 1]);
      const nz = Math.abs(normals[i * 3 + 2]);

      let u = 0;
      let v = 0;

      if (ny >= nx && ny >= nz) {
        // Top projection (XZ)
        u = x * uScale;
        v = z * vScale;
      } else if (nx >= ny && nx >= nz) {
        // Side projection (ZY)
        u = z * uScale;
        v = y * vScale;
      } else {
        // Front projection (XY)
        u = x * uScale;
        v = y * vScale;
      }

      uvs.push(u, v);
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
    this.recordMeshUVEdit(mesh, `Triplanar UVs "${mesh.name}"`, beforeUVs, uvs);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied Triplanar UV mapping to mesh (uScale: ${uScale}, vScale: ${vScale})!`, 'success');
  }

  public applyPlanarUVs(
    direction: 'top' | 'front' | 'side' = 'top',
    scaleOrUScale: number = 1.0,
    vScaleParam?: number
  ): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const prevUVRaw = mesh.getVerticesData(VertexBuffer.UVKind);
    const beforeUVs = prevUVRaw ? Array.from(prevUVRaw) : null;

    const uScale = typeof scaleOrUScale === 'number' && !isNaN(scaleOrUScale) ? scaleOrUScale : 1.0;
    const vScale = typeof vScaleParam === 'number' && !isNaN(vScaleParam) ? vScaleParam : uScale;

    const uvs: number[] = [];
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      let u = 0;
      let v = 0;

      if (direction === 'top') {
        u = x * uScale;
        v = z * vScale;
      } else if (direction === 'side') {
        u = z * uScale;
        v = y * vScale;
      } else {
        u = x * uScale;
        v = y * vScale;
      }
      uvs.push(u, v);
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
    this.recordMeshUVEdit(mesh, `Planar (${direction}) UVs "${mesh.name}"`, beforeUVs, uvs);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied Planar (${direction}) UVs (uScale: ${uScale}, vScale: ${vScale})!`, 'success');
  }

  public applyCylindricalUVs(scaleOrUScale: number = 1.0, vScaleParam?: number): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const prevUVRaw = mesh.getVerticesData(VertexBuffer.UVKind);
    const beforeUVs = prevUVRaw ? Array.from(prevUVRaw) : null;

    const uScale = typeof scaleOrUScale === 'number' && !isNaN(scaleOrUScale) ? scaleOrUScale : 1.0;
    const vScale = typeof vScaleParam === 'number' && !isNaN(vScaleParam) ? vScaleParam : uScale;

    const uvs: number[] = [];
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const theta = Math.atan2(z, x); // [-PI, PI]
      const u = ((theta + Math.PI) / (2 * Math.PI)) * uScale;
      const v = y * vScale;
      uvs.push(u, v);
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
    this.recordMeshUVEdit(mesh, `Cylindrical UVs "${mesh.name}"`, beforeUVs, uvs);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied Cylindrical UVs to mesh (uScale: ${uScale}, vScale: ${vScale})!`, 'success');
  }

  public scaleMeshUVs(
    scaleOrUScale: number = 1.0,
    vScaleParam?: number,
    uOffset: number = 0,
    vOffset: number = 0
  ): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    if (!uvs || uvs.length === 0) {
      this.events.onToast?.('Selected mesh has no UV coordinates to transform.', 'warning');
      return;
    }

    const beforeUVs = Array.from(uvs);

    const uScale = typeof scaleOrUScale === 'number' && !isNaN(scaleOrUScale) ? scaleOrUScale : 1.0;
    const vScale = typeof vScaleParam === 'number' && !isNaN(vScaleParam) ? vScaleParam : uScale;
    const safeUOffset = typeof uOffset === 'number' && !isNaN(uOffset) ? uOffset : 0;
    const safeVOffset = typeof vOffset === 'number' && !isNaN(vOffset) ? vOffset : 0;

    const newUVs = new Float32Array(uvs.length);
    for (let i = 0; i < uvs.length; i += 2) {
      newUVs[i] = uvs[i] * uScale + safeUOffset;
      newUVs[i + 1] = uvs[i + 1] * vScale + safeVOffset;
    }

    mesh.setVerticesData(VertexBuffer.UVKind, newUVs);
    this.recordMeshUVEdit(mesh, `Scale UVs "${mesh.name}"`, beforeUVs, Array.from(newUVs));
    this.events.onSceneModified?.();
    this.events.onToast?.(`Baked UV transform to mesh (uScale: ${uScale}, vScale: ${vScale})!`, 'success');
  }

  public async replaceSelectedTexture(file: File): Promise<void> {
    await this.applyDroppedTextures([file]);
  }

  public async applyDroppedTextures(files: File[]): Promise<void> {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];
    const imageFiles = files.filter((f) => {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      return imageExtensions.includes(ext);
    });

    if (imageFiles.length === 0) return;

    this.registerDroppedFiles(imageFiles);

    // Snapshot existing material texture assignments for Undo/Redo
    type MatSlotSnap = {
      mat: PBRMaterial | StandardMaterial;
      albedoOrDiffuse: any;
      bump: any;
      useAlpha: boolean;
      transparencyMode: any;
    };
    const captureMatSlots = (): Map<PBRMaterial | StandardMaterial, MatSlotSnap> => {
      const map = new Map<PBRMaterial | StandardMaterial, MatSlotSnap>();
      for (const m of this.scene.materials) {
        if (m instanceof PBRMaterial) {
          map.set(m, {
            mat: m,
            albedoOrDiffuse: m.albedoTexture,
            bump: m.bumpTexture,
            useAlpha: m.useAlphaFromAlbedoTexture,
            transparencyMode: m.transparencyMode,
          });
        } else if (m instanceof StandardMaterial) {
          map.set(m, {
            mat: m,
            albedoOrDiffuse: m.diffuseTexture,
            bump: m.bumpTexture,
            useAlpha: m.useAlphaFromDiffuseTexture,
            transparencyMode: (m as any).transparencyMode,
          });
        }
      }
      return map;
    };
    const beforeMatSlots = captureMatSlots();

    let totalApplied = 0;

    for (const file of imageFiles) {
      const blobUrl = URL.createObjectURL(file);
      this.objectUrls.add(blobUrl);

      // invertY = false is critical for glTF; NEAREST preserves crisp color-palette swatches
      const tex = new Texture(blobUrl, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      tex.name = file.name;

      const lowerFileName = file.name.toLowerCase();
      const baseNameWithoutExt = lowerFileName.substring(0, lowerFileName.lastIndexOf('.')) || lowerFileName;

      const isBumpMap =
        lowerFileName.includes('normal') ||
        lowerFileName.includes('bump') ||
        lowerFileName.includes('_norm') ||
        lowerFileName.includes('_nrm') ||
        baseNameWithoutExt.endsWith('_n') ||
        baseNameWithoutExt.endsWith('-n');

      const cleanBumpBase = isBumpMap
        ? baseNameWithoutExt
            .replace(/[_\-.](normal|bump|norm|nrm|n)$/i, '')
            .replace(/^(normal|bump)[_\-.]/i, '')
        : baseNameWithoutExt;

      // Default texture alpha to false - the user decides whether to enable transparency
      tex.hasAlpha = false;

      let fileAppliedCount = 0;

      // 1. Match scene materials by material name or current texture name
      for (const mesh of this.importedMeshes) {
        const mat = mesh.material;
        if (!mat || mat.name === 'gridMat' || mat.name.startsWith('editor_')) continue;

        const matNameLower = mat.name.toLowerCase();
        let matches = false;

        if (
          matNameLower === baseNameWithoutExt ||
          matNameLower === lowerFileName ||
          (isBumpMap && cleanBumpBase && matNameLower === cleanBumpBase)
        ) {
          matches = true;
        }

        if (!matches) {
          if (mat instanceof PBRMaterial && mat.albedoTexture) {
            const curTexName = (mat.albedoTexture.name || '').toLowerCase();
            if (
              curTexName.includes(lowerFileName) ||
              curTexName.includes(baseNameWithoutExt) ||
              (isBumpMap && cleanBumpBase && curTexName.includes(cleanBumpBase))
            ) {
              matches = true;
            }
          } else if (mat instanceof StandardMaterial && mat.diffuseTexture) {
            const curTexName = (mat.diffuseTexture.name || '').toLowerCase();
            if (
              curTexName.includes(lowerFileName) ||
              curTexName.includes(baseNameWithoutExt) ||
              (isBumpMap && cleanBumpBase && curTexName.includes(cleanBumpBase))
            ) {
              matches = true;
            }
          }
        }

        if (matches) {
          if (isBumpMap) {
            if (mat instanceof PBRMaterial || mat instanceof StandardMaterial) {
              mat.bumpTexture = tex;
              tex.level = 1.0;
              const baseTex = mat instanceof PBRMaterial ? mat.albedoTexture : mat.diffuseTexture;
              if (baseTex instanceof Texture) {
                tex.uOffset = baseTex.uOffset;
                tex.vOffset = baseTex.vOffset;
                tex.uScale = baseTex.uScale;
                tex.vScale = baseTex.vScale;
                tex.wAng = baseTex.wAng;
                tex.wrapU = baseTex.wrapU;
                tex.wrapV = baseTex.wrapV;
              }
              fileAppliedCount++;
            }
          } else if (mat instanceof PBRMaterial) {
            mat.albedoTexture = tex;
            mat.useAlphaFromAlbedoTexture = false;
            mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
            if (mat.bumpTexture instanceof Texture) {
              mat.bumpTexture.uOffset = tex.uOffset;
              mat.bumpTexture.vOffset = tex.vOffset;
              mat.bumpTexture.uScale = tex.uScale;
              mat.bumpTexture.vScale = tex.vScale;
              mat.bumpTexture.wAng = tex.wAng;
              mat.bumpTexture.wrapU = tex.wrapU;
              mat.bumpTexture.wrapV = tex.wrapV;
            }
            fileAppliedCount++;
          } else if (mat instanceof StandardMaterial) {
            mat.diffuseTexture = tex;
            mat.useAlphaFromDiffuseTexture = false;
            if (mat.bumpTexture instanceof Texture) {
              mat.bumpTexture.uOffset = tex.uOffset;
              mat.bumpTexture.vOffset = tex.vOffset;
              mat.bumpTexture.uScale = tex.uScale;
              mat.bumpTexture.vScale = tex.vScale;
              mat.bumpTexture.wAng = tex.wAng;
              mat.bumpTexture.wrapU = tex.wrapU;
              mat.bumpTexture.wrapV = tex.wrapV;
            }
            fileAppliedCount++;
          }
        }
      }

      // 2. If no name match was found and a mesh is selected, apply to selected mesh
      if (fileAppliedCount === 0 && this.getSelectedMaterial()) {
        const selMat = this.getSelectedMaterial();
        if (isBumpMap) {
          if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
            selMat.bumpTexture = tex;
            tex.level = 1.0;
            const baseTex = selMat instanceof PBRMaterial ? selMat.albedoTexture : selMat.diffuseTexture;
            if (baseTex instanceof Texture) {
              tex.uOffset = baseTex.uOffset;
              tex.vOffset = baseTex.vOffset;
              tex.uScale = baseTex.uScale;
              tex.vScale = baseTex.vScale;
              tex.wAng = baseTex.wAng;
              tex.wrapU = baseTex.wrapU;
              tex.wrapV = baseTex.wrapV;
            }
            fileAppliedCount++;
          }
        } else if (selMat instanceof PBRMaterial) {
          selMat.albedoTexture = tex;
          selMat.useAlphaFromAlbedoTexture = false;
          selMat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
          if (selMat.bumpTexture instanceof Texture) {
            selMat.bumpTexture.uOffset = tex.uOffset;
            selMat.bumpTexture.vOffset = tex.vOffset;
            selMat.bumpTexture.uScale = tex.uScale;
            selMat.bumpTexture.vScale = tex.vScale;
            selMat.bumpTexture.wAng = tex.wAng;
            selMat.bumpTexture.wrapU = tex.wrapU;
            selMat.bumpTexture.wrapV = tex.wrapV;
          }
          fileAppliedCount++;
        } else if (selMat instanceof StandardMaterial) {
          selMat.diffuseTexture = tex;
          selMat.useAlphaFromDiffuseTexture = false;
          if (selMat.bumpTexture instanceof Texture) {
            selMat.bumpTexture.uOffset = tex.uOffset;
            selMat.bumpTexture.vOffset = tex.vOffset;
            selMat.bumpTexture.uScale = tex.uScale;
            selMat.bumpTexture.vScale = tex.vScale;
            selMat.bumpTexture.wAng = tex.wAng;
            selMat.bumpTexture.wrapU = tex.wrapU;
            selMat.bumpTexture.wrapV = tex.wrapV;
          }
          fileAppliedCount++;
        }
      }

      // 3. If still not applied and only 1 image was dropped, apply to all imported meshes
      if (fileAppliedCount === 0 && imageFiles.length === 1) {
        for (const mesh of this.importedMeshes) {
          const mat = mesh.material;
          if (!mat || mat.name === 'gridMat' || mat.name.startsWith('editor_')) continue;
          if (isBumpMap) {
            if (mat instanceof PBRMaterial || mat instanceof StandardMaterial) {
              mat.bumpTexture = tex;
              tex.level = 1.0;
              fileAppliedCount++;
            }
          } else if (mat instanceof PBRMaterial) {
            mat.albedoTexture = tex;
            mat.useAlphaFromAlbedoTexture = false;
            mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
            fileAppliedCount++;
          } else if (mat instanceof StandardMaterial) {
            mat.diffuseTexture = tex;
            mat.useAlphaFromDiffuseTexture = false;
            fileAppliedCount++;
          }
        }
      }

      totalApplied += fileAppliedCount;
    }

    if (totalApplied > 0) {
      const afterMatSlots = captureMatSlots();
      const changed: Array<{ before: MatSlotSnap; after: MatSlotSnap }> = [];
      for (const [mat, after] of afterMatSlots.entries()) {
        const before = beforeMatSlots.get(mat);
        if (
          before &&
          (before.albedoOrDiffuse !== after.albedoOrDiffuse ||
            before.bump !== after.bump ||
            before.useAlpha !== after.useAlpha ||
            before.transparencyMode !== after.transparencyMode)
        ) {
          changed.push({ before, after });
        }
      }
      if (changed.length > 0) {
        const applySlotSnap = (snap: MatSlotSnap) => {
          if (snap.mat instanceof PBRMaterial) {
            snap.mat.albedoTexture = snap.albedoOrDiffuse;
            snap.mat.bumpTexture = snap.bump;
            snap.mat.useAlphaFromAlbedoTexture = snap.useAlpha;
            snap.mat.transparencyMode = snap.transparencyMode;
          } else {
            snap.mat.diffuseTexture = snap.albedoOrDiffuse;
            snap.mat.bumpTexture = snap.bump;
            snap.mat.useAlphaFromDiffuseTexture = snap.useAlpha;
            (snap.mat as any).transparencyMode = snap.transparencyMode;
          }
        };
        this.recordAction({
          name: `Apply Dropped Texture (${imageFiles.length} file${imageFiles.length === 1 ? '' : 's'})`,
          undo: () => {
            for (const c of changed) applySlotSnap(c.before);
            this.events.onTexturesChanged?.();
          },
          redo: () => {
            for (const c of changed) applySlotSnap(c.after);
            this.events.onTexturesChanged?.();
          },
        });
      }
    }

    this.events.onTexturesChanged?.();

    if (totalApplied > 0) {
      this.events.onSceneModified?.();
      this.events.onToast?.(`Texture applied to ${totalApplied} material(s)!`, 'success');
    } else {
      this.events.onToast?.(`Texture cached in memory (${imageFiles.length} file(s)).`, 'info');
    }
  }

  /* =========================================================================
     12. TEXTURE OPTIMIZATION (WEBP)
     ========================================================================= */
  private isSupportedImageUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.startsWith('data:image/') ||
      lowerUrl.startsWith('blob:') ||
      lowerUrl.startsWith('http://') ||
      lowerUrl.startsWith('https://') ||
      lowerUrl.startsWith('./') ||
      lowerUrl.startsWith('/')
    );
  }

  /**
   * Resolves any scene Texture (including GLB/glTF binary buffer textures whose URL is "data:file:...#imageN",
   * RawTexture/DynamicTexture canvases, or standard image URLs) into a directly displayable image URL.
   */
  public resolveTextureImageUrl(tex: Texture): string {
    const rawUrl = tex.url || '';
    if (rawUrl && this.isSupportedImageUrl(rawUrl)) {
      return rawUrl;
    }

    const cached = (tex as any).__resolvedDataUrl;
    if (typeof cached === 'string' && this.isSupportedImageUrl(cached)) {
      return cached;
    }

    const internal = tex.getInternalTexture?.();
    const candidateBuffer = (tex as any)._buffer ?? (internal as any)?._buffer;

    if (typeof candidateBuffer === 'string' && this.isSupportedImageUrl(candidateBuffer)) {
      (tex as any).__resolvedDataUrl = candidateBuffer;
      return candidateBuffer;
    }

    if (candidateBuffer && (candidateBuffer instanceof ArrayBuffer || ArrayBuffer.isView(candidateBuffer))) {
      try {
        const bytes =
          candidateBuffer instanceof ArrayBuffer
            ? new Uint8Array(candidateBuffer)
            : new Uint8Array(candidateBuffer.buffer, candidateBuffer.byteOffset, candidateBuffer.byteLength);
        if (bytes.length > 0) {
          let mimeType = (tex as any).mimeType || '';
          if (!mimeType || !mimeType.startsWith('image/')) {
            if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
              mimeType = 'image/png';
            } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
              mimeType = 'image/jpeg';
            } else if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
              mimeType = 'image/webp';
            } else {
              mimeType = 'image/png';
            }
          }

          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
            binary += String.fromCharCode.apply(null, Array.from(sub));
          }
          const nodeBuffer = (
            globalThis as unknown as { Buffer?: { from(data: Uint8Array): { toString(enc: string): string } } }
          ).Buffer;
          const b64 =
            typeof btoa === 'function'
              ? btoa(binary)
              : nodeBuffer
                ? nodeBuffer.from(bytes).toString('base64')
                : '';
          if (b64) {
            const dataUrl = `data:${mimeType};base64,${b64}`;
            (tex as any).__resolvedDataUrl = dataUrl;
            return dataUrl;
          }
        }
      } catch {
        // Ignore binary encoding failures and fall through
      }
    }

    if (
      typeof HTMLImageElement !== 'undefined' &&
      candidateBuffer instanceof HTMLImageElement &&
      candidateBuffer.src &&
      this.isSupportedImageUrl(candidateBuffer.src)
    ) {
      (tex as any).__resolvedDataUrl = candidateBuffer.src;
      return candidateBuffer.src;
    }

    if (typeof (tex as any).getContext === 'function') {
      try {
        const ctx = (tex as any).getContext();
        const canvas = ctx?.canvas as HTMLCanvasElement | undefined;
        if (canvas && typeof canvas.toDataURL === 'function') {
          const dataUrl = canvas.toDataURL('image/png');
          if (this.isSupportedImageUrl(dataUrl)) {
            (tex as any).__resolvedDataUrl = dataUrl;
            return dataUrl;
          }
        }
      } catch {
        // Ignore
      }
    }

    return '';
  }

  public scanSceneTextures(): Texture[] {
    const texList: Texture[] = [];
    const internalKeywords = [
      'rtt',
      'effectlayer',
      'highlightlayer',
      'postprocess',
      'environment',
      'mirror',
      'shadowmap',
      'probe',
      'reflection',
      'pass',
      'depth',
      'normal',
      'editor_',
      'gridmat',
      'envbrdf',
    ];

    const surfaceAssignedTextures = new Set<Texture>();
    for (const mat of this.scene.materials) {
      const matName = (mat?.name || '').toLowerCase();
      if (!mat || matName === 'gridmat' || matName.startsWith('editor_')) continue;
      if (mat instanceof PBRMaterial) {
        if (mat.albedoTexture instanceof Texture) surfaceAssignedTextures.add(mat.albedoTexture);
        if (mat.emissiveTexture instanceof Texture) surfaceAssignedTextures.add(mat.emissiveTexture);
      } else if (mat instanceof StandardMaterial) {
        if (mat.diffuseTexture instanceof Texture) surfaceAssignedTextures.add(mat.diffuseTexture);
        if (mat.emissiveTexture instanceof Texture) surfaceAssignedTextures.add(mat.emissiveTexture);
      } else if (mat instanceof TerrainMaterial) {
        if (mat.diffuseTexture1 instanceof Texture) surfaceAssignedTextures.add(mat.diffuseTexture1);
        if (mat.diffuseTexture2 instanceof Texture) surfaceAssignedTextures.add(mat.diffuseTexture2);
        if (mat.diffuseTexture3 instanceof Texture) surfaceAssignedTextures.add(mat.diffuseTexture3);
      }
    }

    for (const t of this.scene.textures) {
      if (!(t instanceof Texture)) continue;

      const lowerName = (t.name || '').toLowerCase();
      const isSurfaceMaterialTex = surfaceAssignedTextures.has(t);

      // Filter out internal RenderTargetTextures, cubes, post-processes and Babylon system layers
      if ((t as any).isRenderTarget || (t as any)._isRenderTarget || (t as any).isCube) continue;
      if (lowerName === 'gridmat' || lowerName.startsWith('editor_')) continue;
      if (!isSurfaceMaterialTex && internalKeywords.some((kw) => lowerName.includes(kw))) continue;

      // Real user / material textures must have a valid URL, buffer, or internal GPU buffer
      const hasBuffer = Boolean((t as any)._buffer || t.getInternalTexture?.()?._buffer);
      if (!t.url && !hasBuffer) continue;

      // Filter out non-image data URLs like data:application/ or data:Environment or raw .env/.dds
      if (t.url) {
        const lowerUrl = t.url.toLowerCase();
        if (
          lowerUrl.startsWith('data:application/') ||
          lowerUrl.startsWith('data:text/') ||
          lowerUrl.startsWith('data:environment') ||
          lowerUrl.includes('environment') ||
          lowerUrl.endsWith('.env') ||
          lowerUrl.endsWith('.dds')
        ) {
          continue;
        }
      }

      // Filter out 1x1 dummy colormaps without materials
      const size = t.getSize();
      if (!isSurfaceMaterialTex && size.width <= 1 && size.height <= 1 && lowerName.includes('color')) {
        continue;
      }

      texList.push(t);
    }
    return texList;
  }

  /**
   * Scans and returns detailed metadata for all distinct textures currently embedded in the scene/materials.
   * Duplicate texture instances with identical URLs or matching names/dimensions are automatically consolidated.
   */
  public getEmbeddedTexturesInfo(): EmbeddedTextureInfo[] {
    const textures = this.scanSceneTextures();
    const atlases = this.textureAtlasManager.getAtlases();
    const result: EmbeddedTextureInfo[] = [];

    // Always include registered atlases
    for (const atlas of atlases) {
      if (!atlas.dataUrl) continue;
      result.push({
        id: atlas.id,
        name: atlas.name,
        width: atlas.width,
        height: atlas.height,
        url: atlas.dataUrl,
        isAtlas: true,
        atlasId: atlas.id,
        columns: atlas.columns,
        rows: atlas.rows,
        framesCount: atlas.frames.length,
        materialsCount: 0,
        materialNames: [],
      });
    }

    for (const tex of textures) {
      // Don't re-add atlas textures already in result
      if (atlases.some((a) => a.texture === tex || a.id === tex.name || (a.dataUrl && a.dataUrl === tex.url))) {
        continue;
      }

      const size = tex.getSize();
      const url = this.resolveTextureImageUrl(tex);
      if (!url) continue;

      const matNames: string[] = [];
      for (const m of this.scene.materials) {
        if (m instanceof PBRMaterial) {
          if (
            m.albedoTexture === tex ||
            m.bumpTexture === tex ||
            m.metallicTexture === tex ||
            m.emissiveTexture === tex
          ) {
            matNames.push(m.name);
          }
        } else if (m instanceof StandardMaterial) {
          if (
            m.diffuseTexture === tex ||
            m.bumpTexture === tex ||
            m.specularTexture === tex ||
            m.emissiveTexture === tex
          ) {
            matNames.push(m.name);
          }
        } else if (m instanceof TerrainMaterial) {
          if (
            m.diffuseTexture1 === tex ||
            m.diffuseTexture2 === tex ||
            m.diffuseTexture3 === tex ||
            m.mixTexture === tex
          ) {
            matNames.push(m.name);
          }
        }
      }

      // Check if this texture is already represented in result (deduplicate distinct textures)
      const existing = result.find((item) => {
        // Direct match on URL / image source (data URL, blob, path)
        if (item.url && item.url === url) {
          return true;
        }
        // Match on identical non-generic name with identical dimensions
        if (
          item.name &&
          tex.name &&
          item.name === tex.name &&
          item.name !== 'embedded_texture' &&
          !item.name.startsWith('data:') &&
          size.width > 0 &&
          item.width === size.width &&
          item.height === size.height
        ) {
          return true;
        }
        return false;
      });

      if (existing) {
        // Merge material associations without duplicates
        for (const mName of matNames) {
          if (!existing.materialNames.includes(mName)) {
            existing.materialNames.push(mName);
          }
        }
        existing.materialsCount = existing.materialNames.length;

        // Upgrade name if current is generic and this instance has a descriptive name
        if (
          (!existing.name || existing.name === 'embedded_texture' || existing.name.startsWith('data:')) &&
          tex.name &&
          tex.name !== 'embedded_texture' &&
          !tex.name.startsWith('data:')
        ) {
          existing.name = tex.name;
        }

        // Update dimensions if previously not loaded
        if ((!existing.width || existing.width <= 0) && size.width > 0) {
          existing.width = size.width;
          existing.height = size.height;
        }
        continue;
      }

      result.push({
        id: tex.uniqueId ? String(tex.uniqueId) : tex.name,
        name: tex.name || 'embedded_texture',
        width: size.width || 0,
        height: size.height || 0,
        url,
        isAtlas: false,
        materialsCount: matNames.length,
        materialNames: matNames,
      });
    }

    return result;
  }

  private detachTextureFromSceneMaterials(tex: Texture, atlasId?: string): number {
    let detachedCount = 0;
    const clearSlots = (mat: Material | null | undefined) => {
      if (!mat) return;
      if (mat instanceof PBRMaterial) {
        if (mat.albedoTexture === tex) {
          mat.albedoTexture = null;
          mat.useAlphaFromAlbedoTexture = false;
          mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
          detachedCount++;
        }
        if (mat.bumpTexture === tex) {
          mat.bumpTexture = null;
          detachedCount++;
        }
        if (mat.metallicTexture === tex) {
          mat.metallicTexture = null;
          detachedCount++;
        }
        if (mat.emissiveTexture === tex) {
          mat.emissiveTexture = null;
          detachedCount++;
        }
        if (mat.ambientTexture === tex) {
          mat.ambientTexture = null;
          detachedCount++;
        }
        if (mat.opacityTexture === tex) {
          mat.opacityTexture = null;
          detachedCount++;
        }
        if (mat.reflectionTexture === tex) {
          mat.reflectionTexture = null;
          detachedCount++;
        }
      } else if (mat instanceof StandardMaterial) {
        if (mat.diffuseTexture === tex) {
          mat.diffuseTexture = null;
          mat.useAlphaFromDiffuseTexture = false;
          detachedCount++;
        }
        if (mat.bumpTexture === tex) {
          mat.bumpTexture = null;
          detachedCount++;
        }
        if (mat.specularTexture === tex) {
          mat.specularTexture = null;
          detachedCount++;
        }
        if (mat.emissiveTexture === tex) {
          mat.emissiveTexture = null;
          detachedCount++;
        }
        if (mat.ambientTexture === tex) {
          mat.ambientTexture = null;
          detachedCount++;
        }
        if (mat.opacityTexture === tex) {
          mat.opacityTexture = null;
          detachedCount++;
        }
        if (mat.reflectionTexture === tex) {
          mat.reflectionTexture = null;
          detachedCount++;
        }
      } else if (mat instanceof TerrainMaterial) {
        if (mat.diffuseTexture1 === tex) {
          mat.diffuseTexture1 = null;
          detachedCount++;
        }
        if (mat.diffuseTexture2 === tex) {
          mat.diffuseTexture2 = null;
          detachedCount++;
        }
        if (mat.diffuseTexture3 === tex) {
          mat.diffuseTexture3 = null;
          detachedCount++;
        }
        if (mat.mixTexture === tex) {
          mat.mixTexture = null;
          detachedCount++;
        }
      }
      if (atlasId && mat.metadata?.atlasId === atlasId) {
        delete mat.metadata.atlasId;
      }
    };

    for (const mat of this.scene.materials) {
      if (mat instanceof MultiMaterial) {
        for (const sub of mat.subMaterials || []) {
          clearSlots(sub);
        }
      } else {
        clearSlots(mat);
      }
    }
    return detachedCount;
  }

  private buildTextureDownloadFilename(rawName: string, url: string): string {
    const cleanBase = (rawName || 'texture').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'texture';
    let mimeExt = '';
    const mimeMatch = url.match(/^data:image\/([a-zA-Z0-9+.-]+);/i);
    if (mimeMatch) {
      const subtype = mimeMatch[1].toLowerCase();
      if (subtype === 'jpeg') mimeExt = 'jpg';
      else if (subtype === 'svg+xml') mimeExt = 'svg';
      else mimeExt = subtype;
    }

    const extMatch = cleanBase.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const existingExt = extMatch[1].toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(existingExt)) {
        if (mimeExt && mimeExt !== existingExt && !(mimeExt === 'jpg' && existingExt === 'jpeg')) {
          return cleanBase.replace(/\.[^.]+$/, `.${mimeExt}`);
        }
        return cleanBase;
      }
    }
    return `${cleanBase}.${mimeExt || 'png'}`;
  }

  /**
   * Triggers a browser download of an embedded texture or texture atlas image.
   */
  public async downloadEmbeddedTexture(
    texOrIdentifier: Pick<EmbeddedTextureInfo, 'name' | 'url' | 'isAtlas' | 'atlasId'> | string
  ): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    let name = 'texture';
    let url = '';

    if (typeof texOrIdentifier === 'string') {
      const match = this.getEmbeddedTexturesInfo().find(
        (t) => t.id === texOrIdentifier || t.url === texOrIdentifier || t.name === texOrIdentifier
      );
      if (match) {
        name = match.name;
        url = match.url;
      } else {
        url = texOrIdentifier;
      }
    } else {
      name = texOrIdentifier.name || 'texture';
      url = texOrIdentifier.url || '';
      if (!url && texOrIdentifier.isAtlas && texOrIdentifier.atlasId) {
        const atlas = this.textureAtlasManager.getAtlas(texOrIdentifier.atlasId);
        if (atlas) {
          url = atlas.dataUrl || this.resolveTextureImageUrl(atlas.texture);
          name = atlas.name || name;
        }
      }
    }

    if (!url) {
      this.events.onToast?.('Texture image data is unavailable for download.', 'warning');
      return false;
    }

    const filename = this.buildTextureDownloadFilename(name, url);
    let downloadHref = url;
    let tempObjectUrl: string | null = null;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          tempObjectUrl = URL.createObjectURL(blob);
          downloadHref = tempObjectUrl;
        }
      } catch {
        // Fall back to direct URL download if fetch is blocked by CORS
      }
    }

    const a = document.createElement('a');
    a.href = downloadHref;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (tempObjectUrl) {
      setTimeout(() => URL.revokeObjectURL(tempObjectUrl!), 1000);
    }

    this.events.onToast?.(`Downloaded texture "${filename}".`, 'success');
    return true;
  }

  /**
   * Deletes an embedded texture or texture atlas from the scene, detaching it from any materials that reference it.
   */
  public deleteEmbeddedTexture(
    identifier:
      | Pick<EmbeddedTextureInfo, 'id' | 'name' | 'url' | 'width' | 'height' | 'isAtlas' | 'atlasId'>
      | string
  ): boolean {
    const info =
      typeof identifier === 'string'
        ? this.getEmbeddedTexturesInfo().find(
            (t) => t.id === identifier || t.url === identifier || t.name === identifier || t.atlasId === identifier
          ) || { id: identifier, url: identifier, name: identifier, width: 0, height: 0, isAtlas: false }
        : identifier;

    // 1. Handle Texture Atlas deletion
    const atlasId = info.atlasId || (info.isAtlas ? info.id : undefined);
    if (atlasId) {
      const atlas = this.textureAtlasManager.getAtlas(atlasId);
      if (atlas) {
        this.detachTextureFromSceneMaterials(atlas.texture, atlas.id);
        this.textureAtlasManager.removeAtlas(atlas.id);

        if (this.voxelPainter.currentAtlasId === atlas.id) {
          const remaining = this.textureAtlasManager.getAtlases()[0];
          this.voxelPainter.useTextureAtlas(remaining ? remaining.id : null);
        }

        if (atlas.dataUrl && this.objectUrls.has(atlas.dataUrl)) {
          URL.revokeObjectURL(atlas.dataUrl);
          this.objectUrls.delete(atlas.dataUrl);
        }

        this.events.onTexturesChanged?.();
        this.events.onSceneModified?.();
        this.events.onToast?.(`Deleted texture atlas "${atlas.name}".`, 'info');
        return true;
      }
    }

    // 2. Handle standalone / material scene Texture deletion
    const matchedTextures = this.scanSceneTextures().filter((t) => {
      if (info.id && t.uniqueId && String(t.uniqueId) === info.id) return true;
      const resolvedUrl = this.resolveTextureImageUrl(t);
      if (info.url && (t.url === info.url || resolvedUrl === info.url)) return true;
      if (
        info.name &&
        t.name === info.name &&
        info.name !== 'embedded_texture' &&
        !info.name.startsWith('data:')
      ) {
        if (typeof info.width === 'number' && info.width > 0 && typeof info.height === 'number' && info.height > 0) {
          const s = t.getSize();
          return s.width === info.width && s.height === info.height;
        }
        return !info.id && !info.url;
      }
      return false;
    });

    if (matchedTextures.length === 0) {
      return false;
    }

    const displayName = info.name || matchedTextures[0].name || 'embedded_texture';

    for (const tex of matchedTextures) {
      this.detachTextureFromSceneMaterials(tex);
      tex.dispose();
    }

    // Clean up matching custom palette items in Voxel Painter
    const matchedSet = new Set<Texture>(matchedTextures);
    for (const [key, item] of Array.from(this.voxelPainter.palette.entries())) {
      if ((info.url && item.textureUrl === info.url) || (item.texture && matchedSet.has(item.texture))) {
        this.voxelPainter.palette.delete(key);
        if (this.voxelPainter.currentPaletteId === key) {
          const firstKey = this.voxelPainter.palette.keys().next().value;
          if (firstKey) this.voxelPainter.currentPaletteId = firstKey;
        }
      }
    }

    if (info.url && this.objectUrls.has(info.url)) {
      URL.revokeObjectURL(info.url);
      this.objectUrls.delete(info.url);
    }

    this.events.onTexturesChanged?.();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Deleted embedded texture "${displayName}".`, 'info');
    return true;
  }

  /**
   * Adds an embedded texture to the scene from a data URL string.
   */
  public addTextureFromDataUrl(name: string, dataUrl: string): Texture {
    let existing = this.scene.textures.find(
      (t): t is Texture => t instanceof Texture && !(t as any).isRenderTarget && t.url === dataUrl
    );
    if (existing) {
      if (name && (!existing.name || existing.name === 'embedded_texture')) {
        existing.name = name;
      }
      this.events.onTexturesChanged?.();
      return existing;
    }
    const tex = new Texture(dataUrl, this.scene, false, false);
    tex.name = name;
    tex.hasAlpha = false;
    this.events.onTexturesChanged?.();
    this.events.onToast?.(`Embedded texture "${name}" added to scene.`, 'success');
    return tex;
  }

  /**
   * Uploads an image file and embeds it into the active scene as a Texture.
   */
  public async addTextureFromFile(file: File): Promise<Texture> {
    if (/\.(json|tps|xml)$/i.test(file.name)) {
      throw new Error(`"${file.name}" is an atlas descriptor file. Please load it via the Atlas import button.`);
    }

    return new Promise<Texture>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const tex = this.addTextureFromDataUrl(file.name, reader.result);
          resolve(tex);
        } else {
          reject(new Error('Failed to read texture file.'));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Loads a TextureAtlas from an image file (and optional JSON descriptor) into the scene.
   */
  public async loadTextureAtlasFromFile(
    imageFile: File,
    columns: number = 4,
    rows: number = 4,
    jsonFile?: File
  ): Promise<TextureAtlasDefinition> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    let atlas: TextureAtlasDefinition;
    if (jsonFile) {
      const jsonText = await jsonFile.text();
      atlas = await this.textureAtlasManager.createAtlasFromJson(imageFile.name, dataUrl, jsonText);
    } else {
      atlas = await this.textureAtlasManager.createGridAtlasFromImage(
        imageFile.name,
        dataUrl,
        columns,
        rows
      );
    }

    // Automatically connect with Voxel Painter
    this.voxelPainter.useTextureAtlas(atlas.id);
    this.events.onToast?.(`Texture Atlas "${atlas.name}" (${atlas.frames.length} tiles) loaded into scene.`, 'success');
    return atlas;
  }

  /**
   * Smart unified loader for Texture Atlases from multi-file selection (image + JSON/TPS/XML).
   */
  public async importAtlasFiles(files: FileList | File[]): Promise<TextureAtlasDefinition> {
    const fileList = Array.from(files);
    if (fileList.length === 0) {
      throw new Error('No files provided');
    }

    const imageFile = fileList.find((f) => /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name));
    const descFile = fileList.find((f) => /\.(json|tps|xml)$/i.test(f.name));

    if (imageFile && descFile) {
      return this.loadTextureAtlasFromFile(imageFile, 4, 4, descFile);
    } else if (imageFile) {
      return this.loadTextureAtlasFromFile(imageFile, 4, 4);
    } else if (descFile) {
      const descText = await descFile.text();
      const parsed = this.textureAtlasManager.parseAtlasDescriptor(descText);
      const expectedImgName = parsed.imagePath?.replace(/^.*[\\/]/, '');

      // Check if image is already in scene
      const existingTextures = this.scanSceneTextures();
      const matchedTex = existingTextures.find((t) => {
        const lower = (t.name || '').toLowerCase();
        return expectedImgName && lower.includes(expectedImgName.toLowerCase());
      });

      if (matchedTex && matchedTex.url) {
        const atlas = await this.textureAtlasManager.createAtlasFromJson(
          descFile.name.replace(/\.[^/.]+$/, ''),
          matchedTex.url,
          descText
        );
        this.voxelPainter.useTextureAtlas(atlas.id);
        this.events.onToast?.(
          `Texture Atlas "${atlas.name}" (${atlas.frames.length} tiles) paired with scene texture!`,
          'success'
        );
        return atlas;
      }

      throw new Error(
        `Descriptor "${descFile.name}" requires an atlas image file${expectedImgName ? ` ("${expectedImgName}")` : ''}. Please select both the image and descriptor files together.`
      );
    }

    throw new Error('No supported image or atlas descriptor file found.');
  }

  /**
   * Applies an individual frame/tile from a texture atlas to the selected mesh material.
   * Extracts the tile at native pixel resolution as a crisp standalone texture.
   */
  public applyAtlasFrameToSelectedMaterial(atlasId: string, frameId: string): boolean {
    const atlas = this.textureAtlasManager.getAtlas(atlasId);
    if (!atlas) {
      this.events.onToast?.('Atlas not found', 'error');
      return false;
    }
    const frame = atlas.frames.find((f) => f.id === frameId || f.name === frameId);
    if (!frame) {
      this.events.onToast?.('Tile not found in atlas', 'error');
      return false;
    }

    const tileDataUrl = this.textureAtlasManager.extractFrameDataUrl(atlasId, frame.id);
    if (!tileDataUrl) {
      this.events.onToast?.('Failed to extract tile image', 'error');
      return false;
    }

    const tileName = `${atlas.name}_${frame.name}`;
    const success = this.applyTextureToSelectedMaterial(tileDataUrl, tileName);
    if (success) {
      this.events.onToast?.(`Applied tile "${frame.name}" from atlas "${atlas.name}" to material!`, 'success');
    }
    return success;
  }

  /**
   * Sets an atlas frame as the active paint tile in Voxel Painter.
   */
  public useAtlasFrameInVoxelPainter(atlasId: string, frameId: string): void {
    this.voxelPainter.useTextureAtlas(atlasId);
    const palId = `atlas_${atlasId}_${frameId}`;
    if (this.voxelPainter.palette.has(palId)) {
      this.voxelPainter.currentPaletteId = palId;
    }
    this.events.onToast?.(`Selected tile for Voxel Painter`, 'info');
  }

  public async optimizeAllTexturesToWebP(quality: number = 0.85, maxResolution: number = 1024): Promise<number> {
    const textures = this.scanSceneTextures();
    if (textures.length === 0) {
      this.events.onToast?.('No textures to optimize in model.', 'info');
      return 0;
    }

    this.events.onStatusChanged?.('Optimizing textures to WebP...', true);
    let optimizedCount = 0;
    const replacements: Array<{ oldTex: Texture; newTex: Texture }> = [];

    for (const tex of textures) {
      try {
        const optimizedTexture = await this.convertTextureToWebP(tex, quality, maxResolution);
        if (optimizedTexture) {
          this.replaceTextureInAllMaterials(tex, optimizedTexture);
          replacements.push({ oldTex: tex, newTex: optimizedTexture });
          optimizedCount++;
        }
      } catch (e) {
        console.warn('Failed to optimize texture:', tex.name, e);
      }
    }

    if (optimizedCount > 0) {
      this.recordAction({
        name: `Optimize ${optimizedCount} Texture(s) to WebP`,
        undo: () => {
          for (let i = replacements.length - 1; i >= 0; i--) {
            this.replaceTextureInAllMaterials(replacements[i].newTex, replacements[i].oldTex);
          }
          this.events.onTexturesChanged?.();
        },
        redo: () => {
          for (const r of replacements) {
            this.replaceTextureInAllMaterials(r.oldTex, r.newTex);
          }
          this.events.onTexturesChanged?.();
        },
      });
      this.events.onTexturesChanged?.();
    }
    this.events.onStatusChanged?.('Ready');
    this.events.onToast?.(`${optimizedCount} textures successfully optimized to WebP!`, 'success');
    return optimizedCount;
  }

  public async convertTextureToWebP(texture: Texture, quality: number, maxResolution: number): Promise<Texture | null> {
    const size = texture.getSize();
    let width = size.width;
    let height = size.height;
    if (width === 0 || height === 0) return null;

    if (maxResolution > 0 && (width > maxResolution || height > maxResolution)) {
      const ratio = Math.min(maxResolution / width, maxResolution / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const source = (texture as any)._texture?._source;
    if (source && (source instanceof HTMLImageElement || source instanceof ImageBitmap || source instanceof HTMLCanvasElement)) {
      ctx.drawImage(source, 0, 0, width, height);
    } else {
      const pixels = await texture.readPixels();
      if (!pixels) return null;
      const imgData = ctx.createImageData(size.width, size.height);
      imgData.data.set(pixels as any);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = size.width;
      tempCanvas.height = size.height;
      tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }

    const webpUrl = canvas.toDataURL('image/webp', quality);
    const newTex = new Texture(webpUrl, this.scene, false, false);
    newTex.hasAlpha = !!texture.hasAlpha;
    return newTex;
  }

  public replaceTextureInAllMaterials(oldTex: Texture, newTex: Texture): void {
    for (const mat of this.scene.materials) {
      if (mat instanceof PBRMaterial) {
        if (mat.albedoTexture === oldTex) mat.albedoTexture = newTex;
        if (mat.bumpTexture === oldTex) mat.bumpTexture = newTex;
        if (mat.metallicTexture === oldTex) mat.metallicTexture = newTex;
        if (mat.emissiveTexture === oldTex) mat.emissiveTexture = newTex;
      } else if (mat instanceof StandardMaterial) {
        if (mat.diffuseTexture === oldTex) mat.diffuseTexture = newTex;
        if (mat.bumpTexture === oldTex) mat.bumpTexture = newTex;
        if (mat.emissiveTexture === oldTex) mat.emissiveTexture = newTex;
      }
    }
  }

  /* =========================================================================
     13. ANIMATIONS
     ========================================================================= */
  public loadAnimationsFromScene(): void {
    this.animationGroups = this.scene.animationGroups.slice();
    if (this.animationGroups.length > 0) {
      this.activeAnimationGroup = this.animationGroups[0];
      const names = this.animationGroups.map((ag) => ag.name || 'Animation');
      this.events.onAnimationsLoaded?.(names, this.activeAnimationGroup);
    } else {
      this.activeAnimationGroup = null;
      this.events.onAnimationsLoaded?.([], null);
    }
  }

  public selectAnimationGroup(nameOrIndex: string | number): AnimationGroup | null {
    for (const ag of this.animationGroups) {
      ag.stop();
    }
    let found: AnimationGroup | undefined;
    if (typeof nameOrIndex === 'number') {
      found = this.animationGroups[nameOrIndex];
    } else {
      found = this.animationGroups.find((ag) => ag.name === nameOrIndex);
    }
    if (found) {
      this.activeAnimationGroup = found;
      this.animFrameCurrent = Math.floor(found.from || 0);
      return found;
    }
    return null;
  }

  public playAnimation(loop?: boolean, speed?: number): void {
    if (!this.activeAnimationGroup) return;
    if (speed !== undefined) {
      this.activeAnimationGroup.speedRatio = speed;
    }
    const shouldLoop = loop !== undefined ? loop : (this.activeAnimationGroup.loopAnimation ?? true);
    this.activeAnimationGroup.play(shouldLoop);
    this.isAnimPlaying = true;
    this.events.onToast?.(`Animation "${this.activeAnimationGroup.name}" playing`, 'info');
  }

  public pauseAnimation(): void {
    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.pause();
      this.isAnimPlaying = false;
    }
  }

  public stopAnimation(): void {
    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.reset();
      this.activeAnimationGroup.stop();
      this.isAnimPlaying = false;
      this.animFrameCurrent = Math.floor(this.activeAnimationGroup.from || 0);
      this.events.onAnimProgress?.(this.animFrameCurrent);
    }
  }

  public setAnimationLoop(loop: boolean): void {
    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.loopAnimation = loop;
    }
  }

  public setAnimationSpeed(speed: number): void {
    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.speedRatio = speed;
    }
  }

  public setAnimFrame(frame: number): void {
    if (this.activeAnimationGroup) {
      this.activeAnimationGroup.goToFrame(frame);
      this.animFrameCurrent = frame;
    }
  }

  public getCurrentAnimFrame(): number {
    if (!this.activeAnimationGroup) return 0;
    const animatables = (this.activeAnimationGroup as any)._animatables || (this.activeAnimationGroup as any).animatables;
    if (animatables && animatables.length > 0 && animatables[0].masterFrame !== undefined) {
      return Math.floor(animatables[0].masterFrame);
    }
    const animators = this.activeAnimationGroup.targetedAnimations;
    if (animators && animators.length > 0) {
      const runtime = animators[0].animation.runtimeAnimations;
      if (runtime && runtime.length > 0 && runtime[0].currentFrame !== undefined) {
        return Math.floor(runtime[0].currentFrame);
      }
    }
    return this.animFrameCurrent;
  }

  private updateLiveAnimationProgress(): void {
    if (this.isAnimPlaying && this.activeAnimationGroup && this.activeAnimationGroup.isPlaying) {
      const frame = this.getCurrentAnimFrame();
      if (frame !== this.animFrameCurrent) {
        this.animFrameCurrent = frame;
        this.events.onAnimProgress?.(frame);
      }
    }
  }

  /* =========================================================================
     14. EXPORTING
     ========================================================================= */
  public isNodeSelectedForExport(node: any, selectedNodes: any[]): boolean {
    if (!node) return false;
    const selectedSet = new Set(selectedNodes);
    if (selectedSet.has(node)) return true;

    // Check if node is a linked bone transform node of any selected mesh
    for (const sel of selectedNodes) {
      if (sel instanceof AbstractMesh && (sel as Mesh).skeleton) {
        for (const bone of (sel as Mesh).skeleton!.bones) {
          if (bone.getTransformNode() === node) {
            return true;
          }
        }
      }
    }

    // Check if any ancestor is in selectedSet (child of selected parent/group)
    let parent = node.parent;
    while (parent) {
      if (selectedSet.has(parent)) return true;
      parent = parent.parent;
    }

    // Check if any descendant is in selectedSet (parent/group of selected child)
    const hasSelectedDescendant = (n: any): boolean => {
      if (!n || !n.getChildren) return false;
      for (const child of n.getChildren()) {
        if (selectedSet.has(child) || hasSelectedDescendant(child)) return true;
      }
      return false;
    };

    return hasSelectedDescendant(node);
  }

  public shouldExportNode(node: any, selectedOnly: boolean = false): boolean {
    if (!node) return false;
    if (node.isDisposed && node.isDisposed()) return false;
    if (this.isEditorHelper(node)) return false;
    if (node.isEnabled && !node.isEnabled(true)) return false;
    if (node instanceof AbstractMesh && !this.importedMeshes.includes(node as Mesh)) return false;
    if (selectedOnly && !this.isNodeSelectedForExport(node, this.selectedNodes)) return false;
    return true;
  }

  public async exportCurrentModel(options?: Partial<ExportOptions>): Promise<void> {
    const opts: ExportOptions = {
      format: (options?.format || this.exportParams.format || 'glb') as ExportOptions['format'],
      filename: (options?.filename || this.exportParams.filename || 'model_edited').trim(),
      selectedOnly: options?.selectedOnly ?? this.exportParams.selectedOnly ?? false,
    };

    const format = opts.format.toLowerCase() as ExportOptions['format'];
    this.events.onStatusChanged?.(`Exporting as ${format.toUpperCase()}...`, true);

    // Fuse any unmerged decals into their target meshes prior to export
    if (this.decalController && this.decalController.getUnmergedDecals().length > 0) {
      this.decalController.mergeAllDecalsIntoMeshes();
    }

    // Restore materials & clean up temporary weight heatmap vertex colors and ensure bone nodes before export
    this.weightPaintController?.prepareMeshesForExport();
    await this.texturePaintController?.prepareMeshesForExport();
    if (format === 'glb' || format === 'gltf') {
      await this.heightmapController?.prepareMeshesForExport();
    } else if (format === 'babylon') {
      await this.heightmapController?.prepareTexturesForBabylonSerialization();
    }

    const shouldExport = (node: any) =>
      this.shouldExportNode(node, opts.selectedOnly) &&
      (format === 'babylon' || (!isGaussianSplatMesh(node) && !isGaussianSplatProxyMesh(node)));

    try {
      let exportedBlob: Blob | null = null;
      let downloadFallback: (() => void) | null = null;

      if (format === 'splat' || format === 'ply') {
        const targetSplat = this.gaussianSplatController.getActiveSplatMesh();
        if (!targetSplat) {
          throw new Error('No Gaussian Splat mesh is active in the scene to export.');
        }
        exportedBlob = this.gaussianSplatController.exportSplatBlob(targetSplat, format, true);
        downloadFallback = () => {
          const url = URL.createObjectURL(exportedBlob!);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${opts.filename}.${format}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        };
      } else if (format === 'glb') {
        const glb = await GLTF2Export.GLBAsync(this.scene, opts.filename, {
          shouldExportNode: shouldExport,
        });
        const fileMap = (glb as any)._glTFData?.files || (glb as any).files;
        if (fileMap) {
          for (const k in fileMap) {
            if (k.endsWith('.glb')) {
              exportedBlob = fileMap[k] as Blob;
              break;
            }
          }
        }
        downloadFallback = () => glb.downloadFiles();
      } else if (format === 'gltf') {
        const gltf = await GLTF2Export.GLTFAsync(this.scene, opts.filename, {
          shouldExportNode: shouldExport,
        });
        const fileMap = (gltf as any)._glTFData?.files || (gltf as any).files;
        if (fileMap) {
          for (const k in fileMap) {
            if (k.endsWith('.gltf')) {
              const val = fileMap[k];
              exportedBlob = val instanceof Blob ? val : new Blob([val], { type: 'model/gltf+json' });
              break;
            }
          }
        }
        downloadFallback = () => gltf.downloadFiles();
      } else if (format === 'obj') {
        const meshes = this.importedMeshes.filter((m) => shouldExport(m));
        const objText = OBJExport.OBJ(meshes as any, false, '', true);
        exportedBlob = new Blob([objText], { type: 'text/plain' });
        downloadFallback = () => {
          const url = URL.createObjectURL(exportedBlob!);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${opts.filename}.obj`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        };
      } else if (format === 'stl') {
        const meshes = this.importedMeshes.filter((m) => shouldExport(m));
        const stlData = STLExport.CreateSTL(meshes, false, opts.filename, true, true);
        exportedBlob = new Blob([stlData as any], { type: 'application/sla' });
        downloadFallback = () => {
          STLExport.CreateSTL(meshes, true, opts.filename, true, true);
        };
      } else if (format === 'babylon') {
        const projectData: MeshEditorProjectData = {
          version: 1,
          generator: 'MeshEditor',
          timestamp: Date.now(),
          tools: {
            voxelPainter:
              this.voxelPainter.blocks.size > 0
                ? {
                    voxelSize: this.voxelPainter.voxelSize,
                    paletteId: this.voxelPainter.currentPaletteId,
                    atlasId: this.voxelPainter.currentAtlasId,
                    voxelData: this.voxelPainter.exportVoxelData(),
                  }
                : undefined,
            pathExtrusion:
              this.pathExtrusion && this.pathExtrusion.paths.length > 0
                ? this.pathExtrusion.exportState()
                : undefined,
            pathWays:
              this.pathExtrusion && this.pathExtrusion.paths.length > 0
                ? this.pathExtrusion.exportState()
                : undefined,
            heightmap: this.heightmapController?.exportState(),
          },
        };

        this.scene.metadata = { ...(this.scene.metadata || {}), meshEditor: projectData };

        const originalDoNotSerialize = new Map<any, boolean>();
        const nodesToInspect: any[] = [
          this.camera,
          this.ambientLight,
          this.sunLight,
          this.gridMesh,
          this.facetHighlightMesh,
          this.selectionProxyNode,
          ...this.scene.meshes,
          ...this.scene.transformNodes,
        ];

        for (const node of nodesToInspect) {
          if (!node) continue;
          originalDoNotSerialize.set(node, !!node.doNotSerialize);
          if (
            !this.shouldExportNode(node, opts.selectedOnly) ||
            node === this.gridMesh ||
            node === this.camera ||
            node === this.ambientLight ||
            node === this.sunLight
          ) {
            node.doNotSerialize = true;
          }
        }

        try {
          const serialized = SceneSerializer.Serialize(this.scene);
          const jsonText = JSON.stringify(serialized, null, 2);
          exportedBlob = new Blob([jsonText], { type: 'application/json' });
          downloadFallback = () => {
            const url = URL.createObjectURL(exportedBlob!);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${opts.filename}.babylon`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          };
        } finally {
          for (const [node, original] of originalDoNotSerialize.entries()) {
            node.doNotSerialize = original;
          }
        }
      }

      let handledByAdapter = false;
      if (exportedBlob && this.events.onExportModel) {
        handledByAdapter = !!(await this.events.onExportModel(exportedBlob, opts.filename, format));
      }

      if (!handledByAdapter && downloadFallback) {
        downloadFallback();
        this.events.onToast?.(`Model successfully exported as ${format.toUpperCase()}!`, 'success');
        this.events.onStatusChanged?.('Export complete');
      } else if (handledByAdapter) {
        this.events.onStatusChanged?.('Ready');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      this.events.onToast?.(`Export failed: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Export error');
    } finally {
      this.heightmapController?.restoreMeshesAfterExport();
      this.texturePaintController?.restoreAfterExport();
      this.weightPaintController?.restoreMeshesAfterExport();
    }
  }

  public async exportToGLBBlob(filename: string = 'model'): Promise<Blob> {
    if (this.decalController && this.decalController.getUnmergedDecals().length > 0) {
      this.decalController.mergeAllDecalsIntoMeshes();
    }
    this.weightPaintController?.prepareMeshesForExport();
    await this.texturePaintController?.prepareMeshesForExport();
    await this.heightmapController?.prepareMeshesForExport();
    try {
      const shouldExport = (node: any) => this.shouldExportNode(node, false);
      const glb = await GLTF2Export.GLBAsync(this.scene, filename, {
        shouldExportNode: shouldExport,
      });

      const fileMap = (glb as any)._glTFData?.files || (glb as any).files;
      if (fileMap) {
        for (const k in fileMap) {
          if (k.endsWith('.glb')) {
            return fileMap[k] as Blob;
          }
        }
      }

      // Fallback: intercept download
      return new Promise<Blob>((resolve, reject) => {
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = (blob: any) => {
          URL.createObjectURL = originalCreateObjectURL;
          resolve(blob);
          return originalCreateObjectURL(blob);
        };
        try {
          glb.downloadFiles();
        } catch (err) {
          URL.createObjectURL = originalCreateObjectURL;
          reject(err);
        }
      });
    } finally {
      this.heightmapController?.restoreMeshesAfterExport();
      this.texturePaintController?.restoreAfterExport();
      this.weightPaintController?.restoreMeshesAfterExport();
    }
  }

  /**
   * Compresses the currently selected mesh or all visible scene meshes.
   * Performs lossless vertex deduplication, degenerate facet culling, and unused buffer cleanup.
   * Full Undo / Redo history is recorded.
   */
  public async compressActiveModel(
    options?: Partial<ModelCompressorOptions>
  ): Promise<ModelCompressorStats> {
    const targetMeshes = this.selectedMesh
      ? [this.selectedMesh]
      : this.importedMeshes.filter((m) => !m.isDisposed() && m.isEnabled());

    if (targetMeshes.length === 0) {
      throw new Error('No 3D meshes available in scene to compress.');
    }

    // Capture pre-compression vertex data snapshots for undo
    const preSnapshots = targetMeshes.map((m) => ({
      mesh: m,
      vertexData: VertexData.ExtractFromMesh(m),
    }));

    const stats = await ModelCompressor.optimizeMeshes(targetMeshes, options);

    // Capture post-compression snapshots for redo
    const postSnapshots = targetMeshes.map((m) => ({
      mesh: m,
      vertexData: VertexData.ExtractFromMesh(m),
    }));

    this.recordAction({
      name: `Compress Model (${stats.duplicateVerticesRemoved} duplicate verts welded, ${stats.degenerateFacesRemoved} faces cleaned)`,
      undo: () => {
        for (const snap of preSnapshots) {
          if (!snap.mesh.isDisposed()) {
            snap.vertexData.applyToMesh(
              snap.mesh,
              snap.mesh.isVertexBufferUpdatable(VertexBuffer.PositionKind)
            );
          }
        }
        this.updateStats();
        this.events.onSceneModified?.();
      },
      redo: () => {
        for (const snap of postSnapshots) {
          if (!snap.mesh.isDisposed()) {
            snap.vertexData.applyToMesh(
              snap.mesh,
              snap.mesh.isVertexBufferUpdatable(VertexBuffer.PositionKind)
            );
          }
        }
        this.updateStats();
        this.events.onSceneModified?.();
      },
    });

    this.updateStats();
    this.events.onSceneModified?.();
    return stats;
  }

  /**
   * Compresses active scene meshes and exports them directly to the chosen format (GLB, glTF, OBJ, STL)
   * with optional Draco compression.
   */
  public async exportCompressedActiveModel(
    options?: Partial<ModelCompressorOptions>,
    filename?: string
  ): Promise<{ blob: Blob; filename: string; size: number }> {
    if (this.decalController && this.decalController.getUnmergedDecals().length > 0) {
      this.decalController.mergeAllDecalsIntoMeshes();
    }
    const targetMeshes = this.selectedMesh
      ? [this.selectedMesh]
      : this.importedMeshes.filter((m) => !m.isDisposed() && m.isEnabled());

    if (targetMeshes.length === 0) {
      throw new Error('No 3D meshes available in scene to export.');
    }

    const baseName = filename || this.currentFilename || 'compressed_model';
    await this.texturePaintController?.prepareMeshesForExport();
    await this.heightmapController?.prepareMeshesForExport();
    try {
      return await ModelCompressor.exportCompressedModel(this.scene, targetMeshes, baseName, options);
    } finally {
      this.heightmapController?.restoreMeshesAfterExport();
      this.texturePaintController?.restoreAfterExport();
    }
  }

  /* =========================================================================
     15. FILE LOADING & SCENE MANAGEMENT
     ========================================================================= */
  private setupLoaderInterceptors(): void {
    this.loaderObserver = SceneLoader.OnPluginActivatedObservable.add((loader) => {
      if (loader.name === 'gltf') {
        const gltfLoader = loader as any;
        gltfLoader.preprocessUrlAsync = async (url: string, rootUrl?: string): Promise<string> => {
          return await this.preprocessLoaderUrl(url, rootUrl);
        };
      } else if (loader.name === 'splat') {
        const splatLoader = loader as any;
        if (splatLoader._loadingOptions) {
          splatLoader._loadingOptions.keepInRam = true;
          splatLoader._loadingOptions.disableAutoCameraLimits = true;
        }
      }
    });
  }

  public registerDroppedFiles(files: File[]): void {
    for (const f of files) {
      if (f.name.startsWith('.')) continue;
      const lowerName = f.name.toLowerCase();
      this.inMemoryFiles.set(lowerName, f);
      this.inMemoryFiles.set('textures/' + lowerName, f);
      FilesInputStore.FilesToLoad[lowerName] = f;
      FilesInputStore.FilesToLoad['textures/' + lowerName] = f;

      const correctName = (f as any).correctName || (f as any).fullRelativePath || f.webkitRelativePath;
      if (correctName) {
        const cleanPath = correctName.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
        this.inMemoryFiles.set(cleanPath, f);
        FilesInputStore.FilesToLoad[cleanPath] = f;

        let currentSub = cleanPath;
        let slashIdx = currentSub.indexOf('/');
        while (slashIdx !== -1) {
          currentSub = currentSub.substring(slashIdx + 1);
          this.inMemoryFiles.set(currentSub, f);
          FilesInputStore.FilesToLoad[currentSub] = f;
          slashIdx = currentSub.indexOf('/');
        }
      }
    }
  }

  private async preprocessLoaderUrl(url: string, rootUrl?: string): Promise<string> {
    // 1x1 neutral white fallback PNG data URI (pure white #FFFFFF with alpha 255)
    const FALLBACK_1X1_PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    const rawUri = url.startsWith('file:') ? url.substring(5) : url;
    const decodedUri = decodeURIComponent(rawUri);
    const cleanUri = decodedUri.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
    const lowerCleanUri = cleanUri.toLowerCase();
    const fileName = cleanUri.split('/').pop() || cleanUri;
    const lowerFileName = fileName.toLowerCase();

    // 1. Try finding in inMemoryFiles or FilesInputStore
    let matchedFile: File | undefined =
      this.inMemoryFiles.get(lowerCleanUri) ||
      this.inMemoryFiles.get(lowerFileName) ||
      FilesInputStore.FilesToLoad[lowerCleanUri] ||
      FilesInputStore.FilesToLoad[lowerFileName];

    if (!matchedFile) {
      for (const [key, file] of this.inMemoryFiles.entries()) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === lowerFileName ||
          lowerKey.endsWith('/' + lowerFileName) ||
          lowerKey === lowerCleanUri ||
          lowerKey.endsWith('/' + lowerCleanUri)
        ) {
          matchedFile = file;
          break;
        }
      }
    }

    if (!matchedFile && FilesInputStore.FilesToLoad) {
      for (const key of Object.keys(FilesInputStore.FilesToLoad)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === lowerFileName ||
          lowerKey.endsWith('/' + lowerFileName) ||
          lowerKey === lowerCleanUri ||
          lowerKey.endsWith('/' + lowerCleanUri)
        ) {
          matchedFile = FilesInputStore.FilesToLoad[key];
          break;
        }
      }
    }

    if (matchedFile) {
      const blobUrl = URL.createObjectURL(matchedFile);
      this.objectUrls.add(blobUrl);
      console.log(`[MeshEditor] Texture '${cleanUri}' resolved to in-memory file '${matchedFile.name}'`);
      return blobUrl;
    }

    // 2. Fallback placeholder for image textures so model loading never crashes
    if (/\.(png|jpe?g|webp|bmp|gif|dds|ktx2?)$/i.test(fileName)) {
      console.warn(`[MeshEditor] Texture '${cleanUri}' not found in dropped files. Using fallback placeholder.`);
      this.events.onToast?.(`Texture "${cleanUri}" not found. Loaded with neutral fallback. Drop the texture file to apply it.`, 'warning');
      return FALLBACK_1X1_PNG;
    }

    return url;
  }

  private async preprocessImportBatch(files: File[]) {
    const validFiles = files.filter((f) => !f.name.startsWith('.'));
    if (ColladaConverter.hasColladaFiles(validFiles)) {
      this.events.onStatusChanged?.('Converting Collada (.dae) to GLB...', true);
    }
    const batch = await ColladaConverter.preprocessImportFiles(validFiles);
    for (const warning of batch.warnings) {
      this.events.onToast?.(warning, 'warning');
    }
    return batch;
  }

  public async loadFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    const modelExtensions = ['.glb', '.gltf', '.obj', '.stl', '.ply', '.fbx', '.dae', '.babylon', '.splat', '.spz', '.sog'];

    const initialValid = files.filter((f) => !f.name.startsWith('.'));
    if (initialValid.length === 0) return;

    try {
      const batch = await this.preprocessImportBatch(initialValid);
      const validFiles = batch.files;
      if (validFiles.length === 0) return;

      const primaryFile =
        validFiles.find((f) => {
          const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
          return modelExtensions.includes(ext);
        }) || validFiles[0];
      const displayName = batch.originalNames.get(primaryFile) || primaryFile.name;

      this.events.onStatusChanged?.(`Loading ${displayName}...`, true);
      this.clearModel();
      this.registerDroppedFiles(validFiles);
      this.currentFilename = displayName;
      this.exportParams.filename = displayName.replace(/\.[^/.]+$/, '') + '_edited';

      const result = await SceneLoader.ImportMeshAsync('', 'file:', primaryFile, this.scene);

      this.processLoadedScene(result.meshes as Mesh[]);

      // Restore embedded project tool state if loading a .babylon project file
      if (primaryFile.name.toLowerCase().endsWith('.babylon')) {
        try {
          const text = await primaryFile.text();
          const parsed = JSON.parse(text);
          if (parsed.metadata?.meshEditor) {
            this.restoreProjectState(parsed.metadata.meshEditor);
          }
        } catch (err) {
          console.warn('Could not read project metadata from .babylon file:', err);
        }
      }

      // Ensure any unconsumed images included in the multi-file drop are immediately applied to materials
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];
      const imagesInDrop = validFiles.filter((f) => {
        if (batch.consumedTextureFiles.has(f)) return false;
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return imageExtensions.includes(ext);
      });
      if (imagesInDrop.length > 0) {
        await this.runWithoutRecordingAsync(() => this.applyDroppedTextures(imagesInDrop));
      }

      this.events.onModelLoaded?.(displayName);
      this.events.onToast?.(`File "${displayName}" loaded successfully!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error loading file:', err);
      this.events.onToast?.(`Failed to load file: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error loading model');
    }
  }

  public async importFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    const modelExtensions = ['.glb', '.gltf', '.obj', '.stl', '.ply', '.fbx', '.dae', '.babylon', '.splat', '.spz', '.sog'];

    const initialValid = files.filter((f) => !f.name.startsWith('.'));
    if (initialValid.length === 0) return;

    try {
      const batch = await this.preprocessImportBatch(initialValid);
      const validFiles = batch.files;
      if (validFiles.length === 0) return;

      this.registerDroppedFiles(validFiles);

      const modelFiles = validFiles.filter((f) => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return modelExtensions.includes(ext);
      });

      if (modelFiles.length > 0) {
        for (const m of modelFiles) {
          await this.importPreparedFile(m, batch.originalNames.get(m) || m.name);
        }
      } else {
        await this.importPreparedFile(validFiles[0], batch.originalNames.get(validFiles[0]) || validFiles[0].name);
      }

      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];
      const imagesInDrop = validFiles.filter((f) => {
        if (batch.consumedTextureFiles.has(f)) return false;
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return imageExtensions.includes(ext);
      });
      if (imagesInDrop.length > 0) {
        await this.applyDroppedTextures(imagesInDrop);
      }
    } catch (err: any) {
      console.error('Error importing files:', err);
      this.events.onToast?.(`Failed to import: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error importing');
    }
  }

  public async loadFile(file: File): Promise<void> {
    await this.loadFiles([file]);
  }

  public async importFile(file: File): Promise<void> {
    if (ColladaConverter.isColladaFile(file)) {
      await this.importFiles([file]);
      return;
    }
    await this.importPreparedFile(file, file.name);
  }

  private async importPreparedFile(file: File, displayName: string): Promise<void> {
    this.events.onStatusChanged?.(`Importing ${displayName}...`, true);
    try {
      this.currentFilename = displayName;
      FilesInputStore.FilesToLoad[file.name.toLowerCase()] = file;
      const result = await SceneLoader.ImportMeshAsync('', 'file:', file, this.scene);
      this.processImportedMeshes(result.meshes as Mesh[], displayName);

      if (file.name.toLowerCase().endsWith('.babylon')) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (parsed.metadata?.meshEditor) {
            this.restoreProjectState(parsed.metadata.meshEditor);
          }
        } catch (err) {
          console.warn('Could not read project metadata from imported .babylon file:', err);
        }
      }

      this.events.onToast?.(`"${displayName}" imported into scene!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error importing file:', err);
      this.events.onToast?.(`Failed to import: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error importing');
    }
  }

  public async loadFromUrl(url: string, name?: string): Promise<void> {
    const filename = name || url.split('/').pop() || 'model.glb';
    this.events.onStatusChanged?.(`Loading ${filename}...`, true);
    try {
      let result;
      if (ColladaConverter.isColladaFile(filename) || ColladaConverter.isColladaFile(url)) {
        this.events.onStatusChanged?.('Converting Collada (.dae) to GLB...', true);
        const converted = await ColladaConverter.convertUrlToGlbFile(url, filename);
        for (const warning of converted.warnings) {
          this.events.onToast?.(warning, 'warning');
        }
        this.clearModel();
        this.currentFilename = filename;
        this.exportParams.filename = filename.replace(/\.[^/.]+$/, '') + '_edited';
        FilesInputStore.FilesToLoad[converted.glbFile.name.toLowerCase()] = converted.glbFile;
        result = await SceneLoader.ImportMeshAsync('', 'file:', converted.glbFile, this.scene);
      } else {
        this.clearModel();
        this.currentFilename = filename;
        this.exportParams.filename = filename.replace(/\.[^/.]+$/, '') + '_edited';

        const lastSlash = url.lastIndexOf('/');
        const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : './';
        const file = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

        result = await SceneLoader.ImportMeshAsync('', rootUrl, file, this.scene);
      }
      this.processLoadedScene(result.meshes as Mesh[]);

      if (filename.toLowerCase().endsWith('.babylon')) {
        try {
          const res = await fetch(url);
          const parsed = await res.json();
          if (parsed.metadata?.meshEditor) {
            this.restoreProjectState(parsed.metadata.meshEditor);
          }
        } catch (err) {
          console.warn('Could not read project metadata from URL:', err);
        }
      }

      this.events.onModelLoaded?.(filename);
      this.events.onToast?.(`Model "${filename}" loaded successfully!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error loading model from URL:', err);
      this.events.onToast?.(`Failed to load: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error loading');
    }
  }

  public async importFromUrl(url: string, name?: string): Promise<void> {
    const filename = name || url.split('/').pop() || 'model.glb';
    this.events.onStatusChanged?.(`Importing ${filename}...`, true);
    try {
      let result;
      if (ColladaConverter.isColladaFile(filename) || ColladaConverter.isColladaFile(url)) {
        this.events.onStatusChanged?.('Converting Collada (.dae) to GLB...', true);
        const converted = await ColladaConverter.convertUrlToGlbFile(url, filename);
        for (const warning of converted.warnings) {
          this.events.onToast?.(warning, 'warning');
        }
        FilesInputStore.FilesToLoad[converted.glbFile.name.toLowerCase()] = converted.glbFile;
        result = await SceneLoader.ImportMeshAsync('', 'file:', converted.glbFile, this.scene);
      } else {
        const lastSlash = url.lastIndexOf('/');
        const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : './';
        const file = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

        result = await SceneLoader.ImportMeshAsync('', rootUrl, file, this.scene);
      }
      this.processImportedMeshes(result.meshes as Mesh[], filename);

      if (filename.toLowerCase().endsWith('.babylon')) {
        try {
          const res = await fetch(url);
          const parsed = await res.json();
          if (parsed.metadata?.meshEditor) {
            this.restoreProjectState(parsed.metadata.meshEditor);
          }
        } catch (err) {
          console.warn('Could not read project metadata from imported URL:', err);
        }
      }

      this.events.onToast?.(`Model "${filename}" imported into scene!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error importing model from URL:', err);
      this.events.onToast?.(`Failed to import: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error importing');
    }
  }

  /**
   * Restores embedded project state (e.g. VoxelPainter blocks/palette, pathways, custom tool state)
   * from a loaded .babylon scene file.
   */
  public restoreProjectState(projectData: MeshEditorProjectData | any): void {
    if (!projectData || typeof projectData !== 'object') return;
    const tools = projectData.tools || {};

    // Restore VoxelPainter state
    if (tools.voxelPainter) {
      const vp = tools.voxelPainter;
      if (vp.voxelSize !== undefined && typeof vp.voxelSize === 'number') {
        this.voxelPainter.setVoxelSize(vp.voxelSize);
      }
      if (vp.atlasId !== undefined) {
        this.voxelPainter.useTextureAtlas(vp.atlasId || null);
      }
      if (vp.paletteId) {
        this.voxelPainter.setPaletteItem(vp.paletteId);
      }
      if (vp.voxelData) {
        const count = this.voxelPainter.loadVoxelData(vp.voxelData);
        this.events.onToast?.(`Restored ${count} painted voxels from project state.`, 'info');
      }
    }

    // Restore Path Extrusion state
    const pathsToRestore = tools.pathExtrusion || tools.pathWays;
    if (pathsToRestore && Array.isArray(pathsToRestore)) {
      this.pathExtrusion.loadState(pathsToRestore);
      this.events.onToast?.(`Restored ${pathsToRestore.length} path extrusions from project state.`, 'info');
    }

    // Restore Heightmap Terrain state
    if (tools.heightmap && this.heightmapController) {
      this.heightmapController.restoreState(tools.heightmap);
    }

    this.events.onSceneModified?.();
  }

  private processLoadedScene(newMeshes?: Mesh[]): void {
    const meshes = (newMeshes || (this.scene.meshes as Mesh[])).filter(
      (m) => !this.isEditorHelper(m) && m !== this.gridMesh
    );
    this.importedMeshes = meshes;

    for (const mesh of meshes) {
      mesh.isPickable = true;
    }

    this.centerSceneToOrigin();
    this.loadAnimationsFromScene();
    this.updateStats();

    // Auto-frame camera to maximize mesh in frustum
    this.focusOnAll();

    this.events.onSceneModified?.();

    const firstGeoMesh = this.importedMeshes.find((m) => m.name !== '__root__' && m.getTotalVertices() > 0);
    if (firstGeoMesh) {
      this.selectMesh(firstGeoMesh);
    } else if (this.importedMeshes.length > 0) {
      this.selectMesh(this.importedMeshes[0]);
    }
  }

  private centerSceneToOrigin(): void {
    const validMeshes = this.scene.meshes.filter(
      (m) => !this.isEditorHelper(m) && m !== this.gridMesh && m instanceof Mesh && m.getTotalVertices() > 0
    ) as Mesh[];
    if (validMeshes.length === 0) return;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let hasGeometry = false;

    for (const m of validMeshes) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo()?.boundingBox;
      if (bb && isFinite(bb.minimumWorld.x) && isFinite(bb.maximumWorld.x)) {
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
        hasGeometry = true;
      }
    }

    if (!hasGeometry) {
      this.resetCamera();
      return;
    }

    const center = min.add(max).scale(0.5);
    const radius = Math.max(Vector3.Distance(min, max) * 0.5, 0.5);

    // Find top-level root nodes
    const topLevelNodes = new Set<TransformNode>();
    for (const m of validMeshes) {
      let top: TransformNode = m;
      while (top.parent && top.parent instanceof TransformNode && !this.isEditorHelper(top.parent)) {
        top = top.parent as TransformNode;
      }
      topLevelNodes.add(top);
    }

    const delta = new Vector3(-center.x, -min.y, -center.z);
    if (delta.lengthSquared() > 0.002) {
      for (const node of topLevelNodes) {
        node.position.addInPlace(delta);
        node.computeWorldMatrix(true);
      }
    }

    this.updateGridForModel(radius);
  }

  private processImportedMeshes(newMeshes: Mesh[], sourceName: string): void {
    const valid = newMeshes.filter((m) => !this.isEditorHelper(m) && m !== this.gridMesh);
    if (valid.length === 0) return;

    this.groupCounter++;
    const groupName = `${sourceName.replace(/\.[^/.]+$/, '')}_group_${this.groupCounter}`;
    const group = new TransformNode(groupName, this.scene);
    (group as any).metadata = { isEditorGroup: true };

    for (const m of valid) {
      m.isPickable = true;
      if (!this.importedMeshes.includes(m)) {
        this.importedMeshes.push(m);
      }
      if (!m.parent) {
        m.setParent(group);
      }
    }

    const prevSelected = [...this.selectedNodes];
    this.groups.push(group);
    this.selectNodes([group]);

    this.recordAction({
      name: `Import "${sourceName}"`,
      undo: () => {
        this.clearSelectionProxy();
        for (const m of valid) {
          if (!m.isDisposed()) m.setEnabled(false);
          const idx = this.importedMeshes.indexOf(m);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
        }
        if (!group.isDisposed()) group.setEnabled(false);
        const gIdx = this.groups.indexOf(group);
        if (gIdx !== -1) this.groups.splice(gIdx, 1);
        this.selectNodes(prevSelected.filter((n) => !n.isDisposed()));
      },
      redo: () => {
        this.clearSelectionProxy();
        if (!group.isDisposed()) {
          group.setEnabled(true);
          if (!this.groups.includes(group)) this.groups.push(group);
        }
        for (const m of valid) {
          if (!m.isDisposed()) {
            m.setEnabled(true);
            if (!this.importedMeshes.includes(m)) this.importedMeshes.push(m);
          }
        }
        this.selectNodes([group]);
      },
    });

    if (this.scene.animationGroups.length > 0) {
      this.loadAnimationsFromScene();
    }
    this.updateStats();
    this.events.onSceneModified?.();
  }

  public loadSampleModel(): void {
    this.clearModel();
    const box = MeshBuilder.CreateBox('sample_body', { size: 1.2 }, this.scene);
    box.position.y = 1.0;
    const boxMat = new PBRMaterial('sample_body_mat', this.scene);
    boxMat.albedoColor = new Color3(0.3, 0.6, 0.9);
    box.material = boxMat;

    const head = MeshBuilder.CreateSphere('sample_head', { diameter: 0.8 }, this.scene);
    head.position.y = 2.0;
    const headMat = new PBRMaterial('sample_head_mat', this.scene);
    headMat.albedoColor = new Color3(0.9, 0.7, 0.5);
    head.material = headMat;

    this.importedMeshes = [box, head];
    this.centerSceneToOrigin();
    this.focusOnAll();
    this.selectMesh(box);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.('Loaded sample 3D character.', 'success');
  }

  public clearModel(): void {
    this.clearSelectionProxy();
    this.highlightLayer.removeAllMeshes();

    for (const mesh of this.importedMeshes) {
      if (!mesh.isDisposed()) mesh.dispose();
    }
    this.importedMeshes = [];

    for (const group of this.groups) {
      if (!group.isDisposed()) group.dispose();
    }
    this.groups = [];

    if (this.currentModelRoot && !this.currentModelRoot.isDisposed()) {
      this.currentModelRoot.dispose();
      this.currentModelRoot = null;
    }

    if (this.voxelPainter && this.voxelPainter.blocks.size > 0) {
      this.voxelPainter.clear();
    }

    if (this.pathExtrusion) {
      this.pathExtrusion.clear();
    }

    // Stop and clear animations
    while (this.scene.animationGroups.length > 0) {
      this.scene.animationGroups[0].dispose();
    }
    this.animationGroups = [];
    this.activeAnimationGroup = null;
    this.isAnimPlaying = false;
    this.animFrameCurrent = 0;
    this.events.onAnimationsLoaded?.([], null);

    this.selectedNodes = [];
    this.selectedMesh = null;
    this.selectedSubMeshId = null;
    this.undoStack = [];
    this.redoStack = [];

    // Revoke any created blob URLs and clear memory caches
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.objectUrls.clear();
    this.inMemoryFiles.clear();

    this.resetCamera();
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.('Scene cleared.', 'info');
  }

  /* =========================================================================
     16. CAMERA & VIEW CONTROLS
     ========================================================================= */
  public focusOnSelected(): void {
    if (this.selectedNodes.length > 0) {
      this.focusOnTarget(this.selectedNodes[0]);
    } else if (this.selectedMesh) {
      this.focusOnTarget(this.selectedMesh);
    } else {
      this.focusOnAll();
    }
  }

  public focusOnAll(): void {
    const validMeshes = this.scene.meshes.filter(
      (m) => !this.isEditorHelper(m) && m !== this.gridMesh && m instanceof Mesh && m.getTotalVertices() > 0
    ) as Mesh[];

    if (validMeshes.length === 0) {
      this.resetCamera();
      return;
    }

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let hasValidBounds = false;

    for (const m of validMeshes) {
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo()?.boundingBox;
      if (!b) continue;
      const minW = b.minimumWorld;
      const maxW = b.maximumWorld;
      if (isFinite(minW.x) && isFinite(minW.y) && isFinite(minW.z) && isFinite(maxW.x) && isFinite(maxW.y) && isFinite(maxW.z)) {
        min = Vector3.Minimize(min, minW);
        max = Vector3.Maximize(max, maxW);
        hasValidBounds = true;
      }
    }

    if (!hasValidBounds) {
      this.resetCamera();
      return;
    }

    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);
    const radius = Math.max(Vector3.Distance(min, max) * 0.5, 0.5);

    // Calculate optimal distance using Camera Frustum FOV to maximize model in view
    const vFov = this.camera.fov || 0.8;
    const aspect = this.engine.getAspectRatio(this.camera) || this.canvas.width / this.canvas.height || 16 / 9;
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect);

    // Elevation angle (20 degrees above horizontal for ideal 3D perspective)
    const elevationAngle = (20 * Math.PI) / 180;
    const projHeight = size.y * Math.cos(elevationAngle) + size.z * Math.sin(elevationAngle);
    const projWidth = size.x;

    const distV = (projHeight * 0.5) / Math.tan(vFov * 0.5);
    const distH = (projWidth * 0.5) / Math.tan(hFov * 0.5);
    const distRadius = radius / Math.sin(Math.min(vFov, hFov) * 0.5);

    // Optimal distance with a comfortable margin to maximize the mesh in view
    const optimalDistance = Math.max(distV, distH, distRadius * 0.75) * 1.15;

    // Adjust camera clipping planes to accommodate large models
    this.camera.minZ = Math.min(0.1, optimalDistance * 0.001);
    this.camera.maxZ = Math.max(50000, optimalDistance * 30);

    // Dynamic camera speed adapted to model scale
    this.camera.speed = Math.max(0.3, optimalDistance * 0.025);

    // Position camera FIRST, then set target so camera rotation calculates accurately!
    const camY = center.y + optimalDistance * Math.sin(elevationAngle);
    const horizontalDist = optimalDistance * Math.cos(elevationAngle);
    const camZ = center.z - horizontalDist;
    const camX = center.x;

    this.camera.rotationQuaternion = null;
    this.camera.position.set(camX, camY, camZ);
    this.camera.setTarget(center);
    this.touchOrbitTarget.copyFrom(center);
  }

  public focusOnTarget(target: TransformNode): void {
    if (!target || target.isDisposed()) return;
    target.computeWorldMatrix(true);

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let hasBounds = false;

    if (target instanceof Mesh) {
      const b = target.getBoundingInfo()?.boundingBox;
      if (b && isFinite(b.minimumWorld.x) && isFinite(b.maximumWorld.x)) {
        min = b.minimumWorld.clone();
        max = b.maximumWorld.clone();
        hasBounds = true;
      }
    } else {
      for (const m of target.getChildMeshes()) {
        if (!m || m.isDisposed()) continue;
        m.computeWorldMatrix(true);
        const b = m.getBoundingInfo()?.boundingBox;
        if (b && isFinite(b.minimumWorld.x) && isFinite(b.maximumWorld.x)) {
          min = Vector3.Minimize(min, b.minimumWorld);
          max = Vector3.Maximize(max, b.maximumWorld);
          hasBounds = true;
        }
      }
    }

    if (!hasBounds) {
      this.resetCamera();
      return;
    }

    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);
    const radius = Math.max(Vector3.Distance(min, max) * 0.5, 0.5);

    const vFov = this.camera.fov || 0.8;
    const aspect = this.engine.getAspectRatio(this.camera) || this.canvas.width / this.canvas.height || 16 / 9;
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect);

    const elevationAngle = (20 * Math.PI) / 180;
    const projHeight = size.y * Math.cos(elevationAngle) + size.z * Math.sin(elevationAngle);
    const projWidth = size.x;

    const distV = (projHeight * 0.5) / Math.tan(vFov * 0.5);
    const distH = (projWidth * 0.5) / Math.tan(hFov * 0.5);
    const distRadius = radius / Math.sin(Math.min(vFov, hFov) * 0.5);

    const optimalDistance = Math.max(distV, distH, distRadius * 0.75) * 1.15;

    this.camera.minZ = Math.min(0.1, optimalDistance * 0.001);
    this.camera.maxZ = Math.max(50000, optimalDistance * 30);

    const camY = center.y + optimalDistance * Math.sin(elevationAngle);
    const horizontalDist = optimalDistance * Math.cos(elevationAngle);
    const camZ = center.z - horizontalDist;
    const camX = center.x;

    this.camera.rotationQuaternion = null;
    this.camera.position.set(camX, camY, camZ);
    this.camera.setTarget(center);
    this.touchOrbitTarget.copyFrom(center);
  }

  public resetCamera(): void {
    this.camera.minZ = 0.05;
    this.camera.maxZ = 50000;
    this.camera.speed = 0.4;
    this.camera.rotationQuaternion = null;
    this.camera.position.set(0, 2.5, -6);
    this.touchOrbitTarget.set(0, 1, 0);
    this.camera.setTarget(this.touchOrbitTarget);
  }

  public setClearColor(hex: string): void {
    this.sceneParams.clearColor = hex;
    this.scene.clearColor = Color4.FromHexString(hex + 'ff');
  }

  public setGridVisible(visible: boolean): void {
    this.sceneParams.grid = visible;
    if (this.gridMesh) this.gridMesh.setEnabled(visible);
  }

  public setGridSize(size: number): void {
    this.sceneParams.gridSize = size;
    if (this.gridMesh && !this.gridMesh.isDisposed()) {
      this.gridMesh.dispose();
    }
    this.gridMesh = MeshBuilder.CreateGround('editor_ground_grid', { width: size, height: size }, this.scene);
    this.gridMesh.material = this.gridMaterial;
    this.gridMesh.position.y = -0.001;
    this.gridMesh.isPickable = true;
    this.gridMesh.alphaIndex = this.sceneParams.gridFillTransparent ? -10 : Number.MAX_VALUE;
    this.gridMesh.setEnabled(this.sceneParams.grid);
    (this.gridMesh as any).metadata = { isEditorHelper: true };
  }

  public setGridLineColor(hex: string): void {
    this.sceneParams.gridLineColor = this.normalizeHexColor(hex, '#3299fd');
    this.applyGridAppearance();
  }

  public setGridFillColor(hex: string): void {
    this.sceneParams.gridFillColor = this.normalizeHexColor(hex, '#ffffff');
    this.applyGridAppearance();
  }

  public setGridFillTransparent(transparent: boolean): void {
    this.sceneParams.gridFillTransparent = !!transparent;
    this.applyGridAppearance();
  }

  public setAmbientIntensity(val: number): void {
    this.sceneParams.ambientLight = val;
    this.ambientLight.intensity = val;
  }

  public setSunIntensity(val: number): void {
    this.sceneParams.sunLight = val;
    this.sunLight.intensity = val;
  }

  public setCameraSpeed(val: number): void {
    this.sceneParams.cameraSpeed = val;
    this.camera.speed = val;
  }

  public setTranslateSnap(val: number): void {
    this.sceneParams.translateSnap = Math.max(0.001, Number(val) || 0.1);
    if (this.isSnapModifierActive) {
      this.updateGizmoSnapping(true);
    }
  }

  public setRotateSnap(val: number): void {
    this.sceneParams.rotateSnap = Math.max(0.1, Number(val) || 5);
    if (this.isSnapModifierActive) {
      this.updateGizmoSnapping(true);
    }
  }

  public setMeshSelectionColor(hex: string): void {
    this.sceneParams.meshSelectionColor = this.normalizeHexColor(hex, '#3399ff');
    this.applySelectionHighlights();
  }

  public setFaceSelectionColor(hex: string): void {
    this.sceneParams.faceSelectionColor = this.normalizeHexColor(hex, '#ffcc33');
    if (this.facetHighlightMesh && !this.facetHighlightMesh.isDisposed()) {
      this.facetHighlightMesh.color = this.getFaceSelectionColor3();
    }
  }

  public setVertexColor(hex: string): void {
    this.sceneParams.vertexColor = this.normalizeHexColor(hex, '#00d9ff');
    this.refreshVertexHandleColors();
  }

  public setVertexSelectionColor(hex: string): void {
    this.sceneParams.vertexSelectionColor = this.normalizeHexColor(hex, '#ffa61a');
    this.refreshVertexHandleColors();
  }

  public setVoxelToolColor(hex: string): void {
    this.sceneParams.voxelToolColor = this.normalizeHexColor(hex, '#ffd91a');
    this.voxelPainter?.refreshHighlightColor();
  }

  public setSnapModifierActive(active: boolean): void {
    if (this.isSnapModifierActive === active) return;
    this.isSnapModifierActive = active;
    this.updateGizmoSnapping(active);
  }

  public updateGizmoSnapping(snappingActive?: boolean): void {
    const isSnap = snappingActive !== undefined ? snappingActive : this.isSnapModifierActive;
    if (this.gizmoManager?.gizmos?.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.snapDistance = isSnap ? (this.sceneParams.translateSnap || 0.1) : 0;
    }
    if (this.gizmoManager?.gizmos?.rotationGizmo) {
      const snapDeg = this.sceneParams.rotateSnap || 5;
      this.gizmoManager.gizmos.rotationGizmo.snapDistance = isSnap ? ((snapDeg * Math.PI) / 180) : 0;
    }
  }

  public setGizmoMode(mode: 'translate' | 'rotate' | 'scale' | 'bounds'): void {
    this.gizmoMode = mode;
    this.gizmoManager.positionGizmoEnabled = mode === 'translate';
    this.gizmoManager.rotationGizmoEnabled = mode === 'rotate';
    this.gizmoManager.scaleGizmoEnabled = mode === 'scale';
    this.gizmoManager.boundingBoxGizmoEnabled = mode === 'bounds';

    this.ensureGizmoDragEvents();
    this.updateGizmoSnapping();
    this.refreshGizmoAttachment();
  }

  public setSceneInteractionLocked(locked: boolean): void {
    this.isSceneInteractionLocked = locked;
    if (locked) {
      this.isMarqueeCandidate = false;
      this.isMarqueeActive = false;
      this.hideMarqueeVisual();
      this.gizmoManager.attachToNode(null);
    } else {
      this.refreshGizmoAttachment();
    }
  }

  public refreshGizmoAttachment(): void {
    if (this.isSceneInteractionLocked) {
      this.gizmoManager.attachToNode(null);
      return;
    }
    if (this.selectedNodes.length === 0) {
      this.gizmoManager.attachToNode(null);
    } else if (this.selectedNodes.length === 1) {
      const single = this.selectedNodes[0];
      if (this.facetEditorActive && this.facetEditMode === 'vertex') {
        if (this.selectedVertexIndex !== null) {
          this.attachVertexGizmo();
        } else {
          this.gizmoManager.attachToNode(null);
        }
      } else {
        this.gizmoManager.attachToNode(single);
      }
    } else {
      if (!this.selectionProxyActive || !this.selectionProxyNode || this.selectionProxyNode.isDisposed()) {
        this.setupSelectionProxy();
      } else {
        this.gizmoManager.attachToNode(this.selectionProxyNode);
      }
    }
  }

  public updateGridForModel(radius: number): void {
    const desiredSize = Math.max(20, Math.ceil((radius * 3) / 20) * 20);
    if (desiredSize !== this.sceneParams.gridSize) {
      this.setGridSize(desiredSize);
    }
  }

  public updateStats(): void {
    const count = this.importedMeshes.length;
    let totalPolys = 0;
    for (const m of this.importedMeshes) {
      if (isGaussianSplatMesh(m)) continue;
      totalPolys += Math.floor((m.getTotalIndices ? m.getTotalIndices() : 0) / 3);
    }
    this.events.onStatsUpdated?.(count, totalPolys);
  }

  /* =========================================================================
     17. SCREENSHOT CAPTURE
     ========================================================================= */

  /**
   * Returns a suggested base filename (without extension) if a model or named object is active,
   * or an empty string when no meaningful name is available.
   */
  public getSuggestedScreenshotName(): string {
    const hasSceneContent =
      this.importedMeshes.length > 0 ||
      this.groups.length > 0 ||
      (this.voxelPainter && this.voxelPainter.blocks.size > 0) ||
      (this.pathExtrusion && this.pathExtrusion.paths.length > 0);

    if (hasSceneContent) {
      const currentBase = (this.currentFilename || '').replace(/\.[^/.]+$/, '').trim();
      const exportName = (this.exportParams?.filename || '').trim();
      const defaultDerivedExport = currentBase ? `${currentBase}_edited` : '';

      if (exportName && exportName !== 'model_edited' && exportName !== defaultDerivedExport) {
        return exportName;
      }
      if (this.currentFilename && this.currentFilename !== 'model.glb' && currentBase) {
        return currentBase;
      }
    }

    if (this.selectedNodes.length === 1) {
      const name = (this.selectedNodes[0]?.name || '').trim();
      if (name && name !== '__root__') return name;
    }

    if (this.selectedMesh?.name) {
      const name = this.selectedMesh.name.trim();
      if (name && name !== '__root__') return name;
    }

    if (this.currentModelRoot?.name) {
      const name = this.currentModelRoot.name.trim();
      if (name && name !== '__root__') return name;
    }

    if (this.groups.length === 1 && this.groups[0]?.name) {
      const name = this.groups[0].name.trim();
      if (name && name !== '__root__') return name;
    }

    if (this.importedMeshes.length === 1 && this.importedMeshes[0]?.name) {
      const name = this.importedMeshes[0].name.trim();
      if (name && name !== '__root__') return name;
    }

    return '';
  }

  private sanitizeScreenshotBaseName(rawName?: string): string {
    const stripped = (rawName || '')
      .trim()
      .replace(/\.(jpe?g|png|zip)$/i, '')
      .replace(/[\\/?%*:|"<>]/g, '_')
      .trim();
    return stripped || 'screenshot';
  }

  private computeScreenshotOrbitPivot(cam: UniversalCamera): Vector3 {
    const validMeshes = this.scene.meshes.filter(
      (m) =>
        !this.isEditorHelper(m) &&
        m !== this.gridMesh &&
        m instanceof Mesh &&
        m.getTotalVertices() > 0 &&
        m.isVisible &&
        m.isEnabled()
    ) as Mesh[];

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let hasBounds = false;

    for (const m of validMeshes) {
      m.computeWorldMatrix(true);
      const b = m.getBoundingInfo()?.boundingBox;
      if (!b) continue;
      const minW = b.minimumWorld;
      const maxW = b.maximumWorld;
      if (
        isFinite(minW.x) &&
        isFinite(minW.y) &&
        isFinite(minW.z) &&
        isFinite(maxW.x) &&
        isFinite(maxW.y) &&
        isFinite(maxW.z)
      ) {
        min = Vector3.Minimize(min, minW);
        max = Vector3.Maximize(max, maxW);
        hasBounds = true;
      }
    }

    cam.computeWorldMatrix();
    const forward = cam.getDirection(Vector3.Forward()).normalize();

    if (hasBounds) {
      const center = min.add(max).scale(0.5);
      const toCenter = center.subtract(cam.position);
      if (Vector3.Dot(toCenter, forward) > 0.01) {
        return center;
      }
      const fallbackDist = Math.max(toCenter.length(), 4);
      return cam.position.add(forward.scale(fallbackDist));
    }

    const defaultTarget = new Vector3(0, 1, 0);
    if (Vector3.Dot(defaultTarget.subtract(cam.position), forward) > 0.01) {
      return defaultTarget;
    }
    return cam.position.add(forward.scale(6));
  }

  private decodeDataUrlToBytes(dataUrl: string): Uint8Array {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private captureCanvasJpegBytes(quality = 0.92): Uint8Array {
    this.scene.render();
    const dataUrl =
      this.canvas && typeof this.canvas.toDataURL === 'function'
        ? this.canvas.toDataURL('image/jpeg', quality)
        : '';
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Could not capture JPEG image from the 3D viewport canvas.');
    }
    return this.decodeDataUrlToBytes(dataUrl);
  }

  /**
   * Captures one JPEG ('current') or a turntable ZIP archive ('4-directions' / '8-directions')
   * of JPEG images with the ground grid temporarily hidden.
   */
  public captureScreenshots(mode: ScreenshotMode, baseFilename?: string): ScreenshotCaptureResult {
    const baseName = this.sanitizeScreenshotBaseName(baseFilename);
    const cam = this.camera;

    const wasGridEnabled = this.gridMesh ? this.gridMesh.isEnabled() : this.sceneParams.grid;
    if (this.gridMesh) {
      this.gridMesh.setEnabled(false);
    }

    const savedPos = cam ? cam.position.clone() : Vector3.Zero();
    const savedRot = cam ? cam.rotation.clone() : Vector3.Zero();
    const savedQuat = cam && cam.rotationQuaternion ? cam.rotationQuaternion.clone() : null;

    try {
      if (mode === 'current') {
        const bytes = this.captureCanvasJpegBytes(0.92);
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
        return {
          blob,
          filename: `${baseName}.jpg`,
          count: 1,
          mode,
        };
      }

      const directionCount = mode === '8-directions' ? 8 : 4;
      const stepDeg = 360 / directionCount;
      const entries: ZipEntryInput[] = [];

      this.scene.render();
      const pivot = cam ? this.computeScreenshotOrbitPivot(cam) : Vector3.Zero();
      const offset = savedPos.subtract(pivot);

      for (let i = 0; i < directionCount; i++) {
        const deg = i * stepDeg;
        const angleRad = (deg * Math.PI) / 180;

        if (cam && i > 0) {
          const rotMat = Matrix.RotationY(angleRad);
          const rotatedOffset = Vector3.TransformCoordinates(offset, rotMat);
          cam.position.copyFrom(pivot.add(rotatedOffset));

          if (savedQuat) {
            cam.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), angleRad).multiply(savedQuat);
          } else {
            cam.rotationQuaternion = null;
            cam.rotation.set(savedRot.x, savedRot.y + angleRad, savedRot.z);
          }
        }

        const bytes = this.captureCanvasJpegBytes(0.92);
        const indexLabel = String(i + 1).padStart(2, '0');
        const degLabel = String(deg).padStart(3, '0');
        entries.push({
          name: `${baseName}_${indexLabel}_${degLabel}deg.jpg`,
          data: bytes,
        });
      }

      const zipBytes = createZipArchive(entries);
      const blob = new Blob([zipBytes as unknown as BlobPart], { type: 'application/zip' });
      return {
        blob,
        filename: `${baseName}.zip`,
        count: directionCount,
        mode,
      };
    } finally {
      if (cam) {
        cam.position.copyFrom(savedPos);
        cam.rotation.copyFrom(savedRot);
        cam.rotationQuaternion = savedQuat ? savedQuat.clone() : null;
      }
      if (this.gridMesh) {
        this.gridMesh.setEnabled(wasGridEnabled);
      }
      try {
        this.scene.render();
      } catch {
        // Ignore in headless/disposed environments
      }
    }
  }
}
