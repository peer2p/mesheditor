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
  Texture,
  TransformNode,
  UniversalCamera,
  Vector2,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { GridMaterial } from '@babylonjs/materials';
import { GLTF2Export, OBJExport, RegisterEXT_texture_webp, STLExport } from '@babylonjs/serializers';
import { AIAgentService } from './AIAgentService';
import {
  TextureAtlasManager,
  TextureAtlasDefinition,
  VoxelPainterController,
  EmbeddedTextureInfo,
} from './voxel';
import { PathExtrusionController } from './pathExtrusion';
import {
  ActionRecord,
  CSGOperationType,
  ExportOptions,
  MeshEditorProjectData,
  MeshEditorServiceEvents,
  PrimitiveConfig,
  TextureOptimizationInfo,
  TransformSnapshot,
} from './types';

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
  private selectionProxyNode: Nullable<TransformNode> = null;
  private selectionProxyActive: boolean = false;
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
  private readonly maxHistorySteps: number = 50;
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

  // Events listener
  public events: MeshEditorServiceEvents = {};

  // Parameters
  public sceneParams = {
    clearColor: '#141820',
    grid: true,
    gridSize: 20,
    ambientLight: 1.0,
    sunLight: 1.2,
    cameraSpeed: 0.4,
  };

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

    // Only right click (button 2) rotates camera!
    if (this.camera.inputs?.attached?.mouse) {
      (this.camera.inputs.attached.mouse as any).buttons = [2];
    }

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

    this.gridMaterial = new GridMaterial('gridMat', this.scene);
    this.gridMaterial.majorUnitFrequency = 5;
    this.gridMaterial.minorUnitVisibility = 0.45;
    this.gridMaterial.gridRatio = 1;
    this.gridMaterial.backFaceCulling = false;
    this.gridMaterial.mainColor = new Color3(1, 1, 1);
    this.gridMaterial.lineColor = new Color3(0.35, 0.45, 0.55);
    this.gridMaterial.opacity = 0.65;

    this.gridMesh = MeshBuilder.CreateGround(
      'editor_ground_grid',
      { width: this.sceneParams.gridSize, height: this.sceneParams.gridSize },
      this.scene
    );
    this.gridMesh.material = this.gridMaterial;
    this.gridMesh.position.y = -0.001;
    this.gridMesh.isPickable = true;
    (this.gridMesh as any).metadata = { isEditorHelper: true };

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
    if (this.loaderObserver) {
      SceneLoader.OnPluginActivatedObservable.remove(this.loaderObserver);
      this.loaderObserver = null;
    }
    this.voxelPainter?.dispose();
    if (this.engine) {
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
    const setupGizmoDragEvents = (gizmo: any, name: string) => {
      if (!gizmo) return;
      ['xGizmo', 'yGizmo', 'zGizmo', 'uniformGizmo', 'planeGizmo'].forEach((partName) => {
        const part = (gizmo as any)[partName];
        if (part && part.dragBehavior) {
          part.dragBehavior.onDragStartObservable.add(() => {
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
    };

    setupGizmoDragEvents(this.gizmoManager.gizmos.positionGizmo, 'Move');
    setupGizmoDragEvents(this.gizmoManager.gizmos.rotationGizmo, 'Rotate');
    setupGizmoDragEvents(this.gizmoManager.gizmos.scaleGizmo, 'Scale');

    // Pointer Picking for Mesh Selection & Facet Editing
    let pointerDownPos = { x: 0, y: 0 };
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        pointerDownPos = { x: this.scene.pointerX, y: this.scene.pointerY };
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        this.lastPointerX = this.scene.pointerX;
        this.lastPointerY = this.scene.pointerY;

        const dist = Math.hypot(
          this.scene.pointerX - pointerDownPos.x,
          this.scene.pointerY - pointerDownPos.y
        );
        if (dist > 6) return; // Camera orbit or drag, ignore click

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

        // If voxel painter or path extrusion tool is active, ignore default mesh selection
        if (this.voxelPainter?.isActive || this.pathExtrusion?.isActive) {
          return;
        }

        const pick = pointerInfo.pickInfo;
        const evt = pointerInfo.event as MouseEvent;

        if (pick && pick.hit && pick.pickedMesh) {
          const mesh = pick.pickedMesh as Mesh;
          if (this.isEditorHelper(mesh) || mesh === this.gridMesh) {
            if (!evt.shiftKey && !evt.metaKey && !evt.ctrlKey) {
              this.selectNodes([]);
            }
            return;
          }

          let targetNode: TransformNode = mesh;
          if (mesh.parent && this.isGroupNode(mesh.parent)) {
            targetNode = mesh.parent as TransformNode;
          }

          if (evt.shiftKey) {
            this.rangeSelectNodes(targetNode);
          } else if (evt.metaKey || evt.ctrlKey) {
            this.toggleNodeSelection(targetNode);
          } else {
            this.selectNodes([targetNode], false, pick.subMeshId);
          }
        } else {
          if (!evt.shiftKey && !evt.metaKey && !evt.ctrlKey) {
            this.selectNodes([]);
          }
        }
      }
    });
  }

  public isGroupNode(node: any): boolean {
    if (!node) return false;
    if (this.groups.includes(node)) return true;
    return !!(node.metadata && node.metadata.isEditorGroup);
  }

  public isEditorHelper(mesh: AbstractMesh | TransformNode): boolean {
    if (!mesh) return false;
    if (mesh === this.gridMesh || mesh === this.facetHighlightMesh) return true;
    const name = mesh.name || '';
    if (name.startsWith('editor_') || name.startsWith('gizmo') || name.startsWith('Lines')) return true;
    return !!((mesh as any).metadata && (mesh as any).metadata.isEditorHelper);
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
    this.gizmoManager.attachToNode(this.selectionProxyNode);
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

    for (const node of this.selectedNodes) {
      if (node instanceof Mesh) {
        if (!this.isEditorHelper(node)) {
          this.highlightLayer.addMesh(node, new Color3(0.2, 0.6, 1.0));
        }
      } else if (node instanceof TransformNode) {
        for (const child of node.getChildMeshes()) {
          if (!this.isEditorHelper(child) && child instanceof Mesh) {
            this.highlightLayer.addMesh(child, new Color3(0.4, 0.8, 1.0));
          }
        }
      }
    }

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
        if (this.selectedVertexIndex !== null) {
          this.attachVertexGizmo();
        } else {
          this.gizmoManager.attachToNode(null);
        }
      } else {
        this.gizmoManager.attachToNode(single);
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
      list.push(g);
      for (const m of g.getChildren()) {
        if (m instanceof Mesh && !this.isEditorHelper(m)) list.push(m);
      }
    }
    for (const m of this.importedMeshes) {
      if (!this.isEditorHelper(m) && !m.isDisposed() && (!m.parent || !this.isGroupNode(m.parent))) {
        list.push(m);
      }
    }
    return list;
  }

  /* =========================================================================
     3. UNDO / REDO HISTORY
     ========================================================================= */
  public recordAction(action: ActionRecord): void {
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
    action.undo();
    this.redoStack.push(action);
    this.events.onHistoryChanged?.(this.canUndo(), this.canRedo());
    this.events.onToast?.(`Undo: ${action.name}`, 'info');
    this.updateStats();
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop()!;
    action.redo();
    this.undoStack.push(action);
    this.events.onHistoryChanged?.(this.canUndo(), this.canRedo());
    this.events.onToast?.(`Redo: ${action.name}`, 'info');
    this.updateStats();
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

    for (const item of this.clipboardNodes) {
      if (item.isDisposed()) continue;

      if (this.isGroupNode(item)) {
        const groupCloneName = `${item.name}_copy_${Date.now().toString().slice(-4)}`;
        const groupClone = new TransformNode(groupCloneName, this.scene);
        (groupClone as any).metadata = { isEditorGroup: true };
        groupClone.position.copyFrom(item.position.add(delta));
        if (item.rotationQuaternion) {
          groupClone.rotationQuaternion = item.rotationQuaternion.clone();
        } else {
          groupClone.rotation.copyFrom(item.rotation);
        }
        groupClone.scaling.copyFrom(item.scaling);

        for (const child of item.getChildren()) {
          if (child instanceof Mesh) {
            const childClone = child.clone(`${child.name}_copy_${Date.now().toString().slice(-4)}`, groupClone);
            if (childClone) {
              this.importedMeshes.push(childClone);
              pastedMeshes.push(childClone);
            }
          }
        }
        this.groups.push(groupClone);
        pastedGroups.push(groupClone);
        pastedNodes.push(groupClone);
      } else if (item instanceof Mesh) {
        const uniqueName = `${item.name}_copy_${Date.now().toString().slice(-4)}`;
        const cloned = item.clone(uniqueName, item.parent);
        if (cloned) {
          cloned.computeWorldMatrix(true);
          cloned.setAbsolutePosition(item.getAbsolutePosition().add(delta));
          this.importedMeshes.push(cloned);
          this.centerMeshPivot(cloned);
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
    const affectedGroups: TransformNode[] = [];

    for (const node of nodesToDelete) {
      if (this.isGroupNode(node)) {
        affectedGroups.push(node);
        for (const cm of node.getChildMeshes()) {
          if (cm instanceof Mesh && !this.isEditorHelper(cm)) affectedMeshes.push(cm);
        }
      } else if (node instanceof Mesh && !this.isEditorHelper(node)) {
        affectedMeshes.push(node);
      }
    }

    for (const m of affectedMeshes) {
      m.setEnabled(false);
      const idx = this.importedMeshes.indexOf(m);
      if (idx !== -1) this.importedMeshes.splice(idx, 1);
    }
    for (const g of affectedGroups) {
      g.setEnabled(false);
      const idx = this.groups.indexOf(g);
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
        for (const g of affectedGroups) {
          g.setEnabled(true);
          if (!this.groups.includes(g)) this.groups.push(g);
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
        for (const g of affectedGroups) {
          g.setEnabled(false);
          const idx = this.groups.indexOf(g);
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
    this.selectedMesh.computeWorldMatrix(true);
    const bounds = this.selectedMesh.getBoundingInfo().boundingBox;
    const lowestY = bounds.minimumWorld.y;
    this.selectedMesh.position.y -= lowestY;
    this.events.onSceneModified?.();
    this.events.onToast?.('Snapped mesh to ground plane.', 'success');
  }

  public centerSelectedToOrigin(): void {
    if (!this.selectedMesh) return;
    this.selectedMesh.position.set(0, 0, 0);
    this.events.onSceneModified?.();
    this.events.onToast?.('Moved mesh to world origin (0, 0, 0).', 'info');
  }

  public centerMeshPivot(mesh: Mesh): void {
    if (!mesh || mesh.isDisposed()) return;
    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const center = bb.centerWorld;

    const delta = center.subtract(mesh.getAbsolutePosition());
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
      mesh.refreshBoundingInfo();
    }
  }

  public centerSelectedPivot(): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Select a mesh first.', 'warning');
      return;
    }
    this.centerMeshPivot(this.selectedMesh);
    this.selectMesh(this.selectedMesh);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Pivot centered to visual geometry for "${this.selectedMesh.name}".`, 'success');
  }

  public centerAllMeshPivots(): void {
    let count = 0;
    for (const mesh of this.importedMeshes) {
      if (!this.isEditorHelper(mesh)) {
        this.centerMeshPivot(mesh);
        count++;
      }
    }
    this.selectNodes(this.selectedNodes);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Centered pivots for ${count} meshes in scene!`, 'success');
  }

  public bakeSelectedTransform(): void {
    if (!this.selectedMesh) return;
    this.selectedMesh.bakeCurrentTransformIntoVertices();
    this.selectedMesh.refreshBoundingInfo();
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
    if (!mesh || mesh.isDisposed()) return;
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
    (mesh.material as any).wireframe = wireframe;
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
    for (const m of targets) {
      this.setMeshWireframe(m, anyNotWireframe);
    }
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
  public separateSelectedLooseParts(): Mesh[] {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh to separate.', 'warning');
      return [];
    }

    const sourceMesh = this.selectedMesh;
    const positions = sourceMesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = sourceMesh.getIndices();

    if (!positions || !indices || indices.length < 3) {
      this.events.onToast?.('Mesh does not contain valid geometry.', 'warning');
      return [];
    }

    this.events.onStatusChanged?.('Analyzing connected geometry components...', true);

    const normals = sourceMesh.getVerticesData(VertexBuffer.NormalKind);
    const uvs = sourceMesh.getVerticesData(VertexBuffer.UVKind);
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

    const vertexToTriangles = new Map<number, number[]>();
    for (let t = 0; t < triangleCount; t++) {
      for (let j = 0; j < 3; j++) {
        const vIdx = indices[t * 3 + j];
        let arr = vertexToTriangles.get(vIdx);
        if (!arr) {
          arr = [];
          vertexToTriangles.set(vIdx, arr);
        }
        arr.push(t);
      }
    }

    for (const [, triIndices] of vertexToTriangles) {
      const first = triIndices[0];
      for (let k = 1; k < triIndices.length; k++) {
        union(first, triIndices[k]);
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
      this.events.onStatusChanged?.('Ready');
      this.events.onToast?.('Mesh is already a single unified piece (no separate parts detected).', 'info');
      return [sourceMesh];
    }

    const separatedMeshes: Mesh[] = [];
    const baseName = sourceMesh.name.replace(/_part\d+$/, '');
    let partNum = 1;

    for (const [, triList] of clusters) {
      const newIndices: number[] = [];
      const newPositions: number[] = [];
      const newNormals: number[] = normals ? [] : [];
      const newUVs: number[] = uvs ? [] : [];
      const newColors: number[] = colors ? [] : [];

      const oldToNewVertMap = new Map<number, number>();

      for (const t of triList) {
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
            if (colors) {
              newColors.push(colors[oldV * 4], colors[oldV * 4 + 1], colors[oldV * 4 + 2], colors[oldV * 4 + 3]);
            }
          }
          newIndices.push(newV);
        }
      }

      const partMesh = new Mesh(`${baseName}_part${partNum++}`, this.scene, sourceMesh.parent);
      const vd = new VertexData();
      vd.positions = newPositions;
      vd.indices = newIndices;
      if (normals) vd.normals = newNormals;
      if (uvs) vd.uvs = newUVs;
      if (colors) vd.colors = newColors;

      vd.applyToMesh(partMesh, true);
      partMesh.material = sourceMesh.material;
      partMesh.position.copyFrom(sourceMesh.position);
      if (sourceMesh.rotationQuaternion) {
        partMesh.rotationQuaternion = sourceMesh.rotationQuaternion.clone();
      } else {
        partMesh.rotation.copyFrom(sourceMesh.rotation);
      }
      partMesh.scaling.copyFrom(sourceMesh.scaling);

      this.centerMeshPivot(partMesh);
      this.importedMeshes.push(partMesh);
      separatedMeshes.push(partMesh);
    }

    const origIdx = this.importedMeshes.indexOf(sourceMesh);
    if (origIdx !== -1) this.importedMeshes.splice(origIdx, 1);
    sourceMesh.setEnabled(false);

    this.recordAction({
      name: `Separate Loose Parts (${clusters.size} parts)`,
      undo: () => {
        for (const p of separatedMeshes) {
          const idx = this.importedMeshes.indexOf(p);
          if (idx !== -1) this.importedMeshes.splice(idx, 1);
          p.setEnabled(false);
        }
        if (!this.importedMeshes.includes(sourceMesh)) this.importedMeshes.push(sourceMesh);
        sourceMesh.setEnabled(true);
        this.selectMesh(sourceMesh);
      },
      redo: () => {
        const idx = this.importedMeshes.indexOf(sourceMesh);
        if (idx !== -1) this.importedMeshes.splice(idx, 1);
        sourceMesh.setEnabled(false);
        for (const p of separatedMeshes) {
          if (!this.importedMeshes.includes(p)) this.importedMeshes.push(p);
          p.setEnabled(true);
        }
        this.selectNodes(separatedMeshes);
      },
    });

    this.selectNodes(separatedMeshes);
    this.updateStats();
    this.events.onStatusChanged?.('Ready');
    this.events.onSceneModified?.();
    this.events.onToast?.(
      `Separated into ${separatedMeshes.length} individual parts!`,
      'success'
    );
    return separatedMeshes;
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
    for (let i = 0; i < subMeshes.length; i++) {
      const part = this.extractSelectedSubMesh(i, false);
      if (part) newMeshes.push(part);
    }

    const origIdx = this.importedMeshes.indexOf(sourceMesh);
    if (origIdx !== -1) this.importedMeshes.splice(origIdx, 1);
    sourceMesh.setEnabled(false);

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

    const nextIndices = [
      ...indices.slice(0, subMesh.indexStart),
      ...indices.slice(subMesh.indexStart + subMesh.indexCount),
    ];

    sourceMesh.setIndices(nextIndices);
    sourceMesh.subMeshes.splice(subMeshId, 1);
    this.selectedSubMeshId = null;
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
    this.centerMeshPivot(mesh);
    this.importedMeshes.push(mesh);
    this.selectMesh(mesh);
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

    cutterMesh.position.copyFrom(pos);
    cutterMesh.computeWorldMatrix(true);
    this.centerMeshPivot(cutterMesh);

    this.importedMeshes.push(cutterMesh);
    this.selectMesh(cutterMesh);
    this.updateStats();
    this.events.onSceneModified?.();
    this.events.onToast?.(`Added ${shape} cutter "${cutterName}". Transform it into place, then click Subtract / Cut!`, 'success');

    return cutterMesh;
  }

  public ensureMeshHasCSGGeometry(mesh: Mesh): Mesh | null {
    if (!mesh || mesh.isDisposed()) return null;

    // If mesh has 0 vertices or no positions, check if it's a container node with child geometry
    if (mesh.getTotalVertices() === 0 || !mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) {
      const childMeshes = mesh.getChildMeshes(false, (c) => (c instanceof Mesh) && c.getTotalVertices() > 0 && c.isVerticesDataPresent(VertexBuffer.PositionKind)) as Mesh[];
      if (childMeshes.length === 1) {
        return childMeshes[0];
      }
      if (childMeshes.length > 1) {
        const merged = Mesh.MergeMeshes(childMeshes, true, true, undefined, false, true);
        if (merged) {
          merged.name = mesh.name;
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
    targetMesh: Mesh,
    toolMesh: Mesh,
    op: 'subtract' | 'union' | 'intersect',
    keepToolMesh: boolean = false
  ): Promise<Mesh | null> {
    if (!targetMesh || !toolMesh) {
      this.events.onToast?.('Please specify both a target mesh and a cutter mesh.', 'warning');
      return null;
    }
    if (targetMesh === toolMesh) {
      this.events.onToast?.('Target mesh and tool mesh cannot be the same mesh.', 'warning');
      return null;
    }

    const validTarget = this.ensureMeshHasCSGGeometry(targetMesh);
    if (!validTarget) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(`Target mesh "${targetMesh.name}" has no 3D vertices/geometry. Please select a valid solid mesh.`, 'warning');
      return null;
    }

    const validTool = this.ensureMeshHasCSGGeometry(toolMesh);
    if (!validTool) {
      this.events.onStatusChanged?.('Ready', false);
      this.events.onToast?.(`Tool mesh "${toolMesh.name}" has no 3D vertices/geometry. Please select a valid solid mesh.`, 'warning');
      return null;
    }

    this.events.onStatusChanged?.(`Executing CSG ${op}...`, true);

    validTarget.computeWorldMatrix(true);
    validTool.computeWorldMatrix(true);

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

    // Detach gizmos and highlights from target before disposal
    this.gizmoManager.attachToMesh(null);
    if (this.selectedMesh === validTarget || this.selectedMesh === targetMesh) {
      this.highlightLayer.removeMesh(validTarget);
      if (validTarget !== targetMesh) this.highlightLayer.removeMesh(targetMesh);
      this.selectedMesh = null;
    }

    // Replace target in importedMeshes
    const targetIdx = this.importedMeshes.indexOf(validTarget);
    if (targetIdx !== -1) {
      this.importedMeshes.splice(targetIdx, 1, resultMesh);
    } else {
      const origIdx = this.importedMeshes.indexOf(targetMesh);
      if (origIdx !== -1) {
        this.importedMeshes.splice(origIdx, 1, resultMesh);
      } else {
        this.importedMeshes.push(resultMesh);
      }
    }
    validTarget.dispose();
    if (targetMesh !== validTarget && !targetMesh.isDisposed()) {
      targetMesh.dispose();
    }

    // Clean up tool mesh unless user toggled 'keepToolMesh'
    if (!keepToolMesh) {
      if (this.selectedMesh === validTool || this.selectedMesh === toolMesh) {
        this.highlightLayer.removeMesh(validTool);
        if (validTool !== toolMesh) this.highlightLayer.removeMesh(toolMesh);
        this.selectedMesh = null;
      }
      const toolIdx = this.importedMeshes.indexOf(validTool);
      if (toolIdx !== -1) {
        this.importedMeshes.splice(toolIdx, 1);
      }
      validTool.dispose();
      if (toolMesh !== validTool && !toolMesh.isDisposed()) {
        const origToolIdx = this.importedMeshes.indexOf(toolMesh);
        if (origToolIdx !== -1) this.importedMeshes.splice(origToolIdx, 1);
        toolMesh.dispose();
      }
    }

    this.selectMesh(resultMesh);
    this.updateStats();
    this.events.onStatusChanged?.('Ready', false);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Sculpt ${op} successful: Created "${resultMesh.name}"!`, 'success');

    return resultMesh;
  }

  public async applyCSGOperation(op: CSGOperationType): Promise<Mesh | null> {
    if (this.selectedNodes.length < 2) {
      this.events.onToast?.('Please select at least 2 meshes for sculpting (first selected is base).', 'warning');
      return null;
    }

    const meshes = this.selectedNodes.filter((n): n is Mesh => n instanceof Mesh && !this.isEditorHelper(n));
    if (meshes.length < 2) {
      this.events.onToast?.('Sculpting requires at least 2 valid meshes.', 'warning');
      return null;
    }

    return this.performCSGOperation(meshes[0], meshes[1], op as 'subtract' | 'union' | 'intersect');
  }

  /* =========================================================================
     10. FACET & VERTEX EDITING
     ========================================================================= */
  public toggleFacetEditor(active?: boolean): boolean {
    this.facetEditorActive = active !== undefined ? active : !this.facetEditorActive;
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
      if (this.selectedMesh) {
        this.gizmoManager.attachToNode(this.selectedMesh);
      }
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
        const quad = this.getQuadFaceInfo(picked, pick.faceId);
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
      mat.emissiveColor = isSelected ? new Color3(1.0, 0.65, 0.1) : new Color3(0.0, 0.85, 1.0);
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

    for (let f = 0; f < numTriangles; f++) {
      if (f === faceId) continue;
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

    const quad = this.getQuadFaceInfo(mesh, faceId);
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

    this.facetHighlightMesh.color = new Color3(1, 0.8, 0.2);
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

  public extrudeSelectedFacet(distance: number = 0.5): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const quad = this.getQuadFaceInfo(mesh, faceId);

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

      this.highlightFace(mesh, fA);
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

    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Extruded face by ${distance}!`, 'success');
  }

  public insetSelectedFacet(insetAmount: number = 0.25, depth: number = 0.0): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to inset.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    const quad = this.getQuadFaceInfo(mesh, faceId);

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

      this.highlightFace(mesh, fA);
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

    this.highlightFace(mesh, faceId);
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

    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Subdivided face #${faceId} into 4 facets!`, 'success');
  }

  public subdivideMesh(targetMesh?: Mesh): void {
    const mesh = targetMesh || this.selectedMesh;
    if (!mesh) {
      this.events.onToast?.('Please select a mesh to subdivide.', 'warning');
      return;
    }
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

    this.events.onSceneModified?.();
    this.events.onToast?.(`Subdivided "${mesh.name}" (${triCount * 4} triangles)!`, 'success');
  }

  public subDSmoothMeshOrFacet(iterations: number = 1): void {
    const mesh = this.selectedMesh;
    if (!mesh) {
      this.events.onToast?.('Please select a mesh to apply Sub-D smoothing.', 'warning');
      return;
    }
    // Subdivide first
    this.subdivideMesh(mesh);

    // Laplacian vertex relaxation
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const vertCount = positions.length / 3;

    // Build adjacency graph
    const adjacency: Set<number>[] = Array.from({ length: vertCount }, () => new Set<number>());
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      adjacency[a].add(b);
      adjacency[a].add(c);
      adjacency[b].add(a);
      adjacency[b].add(c);
      adjacency[c].add(a);
      adjacency[c].add(b);
    }

    for (let iter = 0; iter < Math.min(iterations, 3); iter++) {
      const smoothed = [...positions];
      for (let v = 0; v < vertCount; v++) {
        const neighbors = Array.from(adjacency[v]);
        if (neighbors.length === 0) continue;
        let avgX = 0;
        let avgY = 0;
        let avgZ = 0;
        for (const n of neighbors) {
          avgX += positions[n * 3];
          avgY += positions[n * 3 + 1];
          avgZ += positions[n * 3 + 2];
        }
        avgX /= neighbors.length;
        avgY /= neighbors.length;
        avgZ /= neighbors.length;

        const factor = 0.4;
        smoothed[v * 3] = positions[v * 3] * (1 - factor) + avgX * factor;
        smoothed[v * 3 + 1] = positions[v * 3 + 1] * (1 - factor) + avgY * factor;
        smoothed[v * 3 + 2] = positions[v * 3 + 2] * (1 - factor) + avgZ * factor;
      }
      for (let i = 0; i < positions.length; i++) positions[i] = smoothed[i];
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied Sub-D smooth subdivision to "${mesh.name}"!`, 'success');
  }

  public solidifyMeshOrFacet(thickness: number = 0.2, selectedOnly: boolean = false): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh to solidify.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const indices = Array.from(mesh.getIndices() || []);
    const positions = Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) || []);
    const uvs = Array.from(mesh.getVerticesData(VertexBuffer.UVKind) || []);

    // If selected face only
    if (selectedOnly && this.selectedFaceId !== null && this.selectedFaceId * 3 + 2 < indices.length) {
      const faceId = this.selectedFaceId;
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

      this.highlightFace(mesh, faceId);
      this.events.onSceneModified?.();
      this.events.onToast?.(`Solidified face #${faceId} (thickness: ${thickness})!`, 'success');
      return;
    }

    // Solidify entire mesh
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
    for (let t = 0; t < origTriCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      indices.push(i0 + origVertCount, i2 + origVertCount, i1 + origVertCount);
    }

    const edgeCounts = new Map<string, { count: number; a: number; b: number }>();
    for (let t = 0; t < origTriCount; t++) {
      const tri = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        const cur = edgeCounts.get(key);
        if (cur) cur.count++;
        else edgeCounts.set(key, { count: 1, a, b });
      }
    }

    for (const [, val] of edgeCounts) {
      if (val.count === 1) {
        const a = val.a;
        const b = val.b;
        const aInner = a + origVertCount;
        const bInner = b + origVertCount;
        indices.push(a, b, bInner, a, bInner, aInner);
      }
    }

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);
    if (uvs.length > 0) mesh.setVerticesData(VertexBuffer.UVKind, uvs);

    const newNormals: number[] = [];
    VertexData.ComputeNormals(positions, indices, newNormals);
    mesh.setVerticesData(VertexBuffer.NormalKind, newNormals);
    mesh.refreshBoundingInfo();

    this.events.onSceneModified?.();
    this.events.onToast?.(`Solidified "${mesh.name}" with thickness ${thickness}!`, 'success');
  }

  public bevelSelectedFacet(width: number = 0.15): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to bevel.', 'warning');
      return;
    }
    this.insetSelectedFacet(width, width * 0.4);
    this.events.onToast?.(`Beveled face #${this.selectedFaceId}!`, 'success');
  }

  public arcSelectedFacet(segments: number = 4, height: number = 0.5): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to arc.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
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

    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Created segmented arch (${segs} segments)!`, 'success');
  }

  public knifeSplitFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to knife split.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
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

    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Knife cut face #${faceId} in two!`, 'success');
  }

  public loopCutSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face for loop cut.', 'warning');
      return;
    }
    this.knifeSplitFacet();
    this.events.onToast?.(`Loop cut executed on face #${this.selectedFaceId}!`, 'success');
  }

  public cutThroughSelectedFacet(depth: number = 1.0): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to cut through.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
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

    this.highlightFace(mesh, faceId);
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

      this.events.onSceneModified?.();
      this.events.onToast?.(`Created array of ${numCopies} faces!`, 'success');
      return;
    }

    for (let c = 1; c <= numCopies; c++) {
      const clone = mesh.clone(`${mesh.name}_array_${c}`);
      clone.position.addInPlace(new Vector3(offsetX * c, offsetY * c, offsetZ * c));
      this.importedMeshes.push(clone);
    }
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
    const indices = Array.from(mesh.getIndices() || []);

    const quad = this.getQuadFaceInfo(mesh, faceId);
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

    if (this.facetHighlightMesh) {
      this.facetHighlightMesh.dispose();
      this.facetHighlightMesh = null;
    }
    this.selectedFaceId = null;
    this.events.onFaceSelected?.(null);
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
    const indices = Array.from(mesh.getIndices() || []);

    const quad = this.getQuadFaceInfo(mesh, faceId);
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
    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(quad ? 'Quad face normal inverted!' : 'Face normal inverted!', 'success');
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
    const matName = name || `Mat_${this.selectedMesh.name}_${Date.now().toString().slice(-4)}`;
    const mat = new PBRMaterial(matName, this.scene);
    mat.albedoColor = new Color3(0.9, 0.9, 0.9);
    mat.roughness = 0.5;
    mat.metallic = 0.0;

    this.selectedMesh.material = mat;
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

  public applyTextureToSelectedMaterial(url: string, name?: string): boolean {
    let selMat = this.getSelectedMaterial();
    if (!selMat && this.selectedMesh) {
      selMat = this.createNewMaterialForSelected();
    }
    if (!selMat) {
      this.events.onToast?.('Please select a mesh first', 'warning');
      return false;
    }
    const tex = new Texture(url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    if (name) tex.name = name;

    const lowerName = (name || url).toLowerCase();
    const isPotentiallyTransparent =
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.gif') ||
      lowerName.endsWith('.svg') ||
      url.startsWith('data:image/png') ||
      url.startsWith('data:image/webp');

    if (isPotentiallyTransparent) {
      tex.hasAlpha = true;
    }

    if (selMat instanceof PBRMaterial) {
      selMat.albedoTexture = tex;
      if (isPotentiallyTransparent) {
        selMat.useAlphaFromAlbedoTexture = true;
        if (
          selMat.transparencyMode === PBRMaterial.PBRMATERIAL_OPAQUE ||
          selMat.transparencyMode === undefined ||
          selMat.transparencyMode === null
        ) {
          selMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
        }
        selMat.backFaceCulling = false;
      }
    } else if (selMat instanceof StandardMaterial) {
      selMat.diffuseTexture = tex;
      if (isPotentiallyTransparent) {
        selMat.useAlphaFromDiffuseTexture = true;
        selMat.backFaceCulling = false;
      }
    }
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied texture to material "${selMat.name}"`, 'success');
    return true;
  }

  public applyBumpTextureToSelectedMaterial(fileOrUrl: File | string, name?: string): boolean {
    let selMat = this.getSelectedMaterial();
    if (!selMat && this.selectedMesh) {
      selMat = this.createNewMaterialForSelected();
    }
    if (!selMat) {
      this.events.onToast?.('Please select a mesh first', 'warning');
      return false;
    }

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

    const tex = new Texture(url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    if (texName) tex.name = texName;

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

    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      selMat.bumpTexture = tex;
      tex.level = 1.0;
    }

    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied bump/normal map to material "${selMat.name}"`, 'success');
    return true;
  }

  public removeBumpTextureFromSelectedMaterial(): boolean {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return false;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      selMat.bumpTexture = null;
      this.events.onSceneModified?.();
      this.events.onToast?.(`Removed bump map from material "${selMat.name}"`, 'info');
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
      selMat.invertNormalMapX = invert;
      this.events.onSceneModified?.();
    }
  }

  public setInvertNormalMapY(invert: boolean): void {
    const selMat = this.getSelectedMaterial();
    if (!selMat) return;
    if (selMat instanceof PBRMaterial || selMat instanceof StandardMaterial) {
      selMat.invertNormalMapY = invert;
      this.events.onSceneModified?.();
    }
  }

  public getMaterialBumpInfo(): {
    hasBump: boolean;
    name: string;
    level: number;
    invertX: boolean;
    invertY: boolean;
  } {
    const selMat = this.getSelectedMaterial();
    if (!selMat || !(selMat instanceof PBRMaterial || selMat instanceof StandardMaterial)) {
      return { hasBump: false, name: 'None', level: 1.0, invertX: false, invertY: false };
    }
    const hasBump = !!selMat.bumpTexture;
    const name = selMat.bumpTexture?.name || 'None';
    const level = selMat.bumpTexture?.level ?? 1.0;
    const invertX = !!selMat.invertNormalMapX;
    const invertY = !!selMat.invertNormalMapY;
    return { hasBump, name, level, invertX, invertY };
  }

  public setTextureAlpha(enabled: boolean): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    const tex = this.getActiveMaterialTexture();
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
    this.events.onSceneModified?.();
  }

  public setMaterialTransparencyMode(mode: number): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    if (mat instanceof PBRMaterial) {
      mat.transparencyMode = mode;
      mat.useAlphaFromAlbedoTexture = mode !== PBRMaterial.PBRMATERIAL_OPAQUE;
      if (mode !== PBRMaterial.PBRMATERIAL_OPAQUE) mat.backFaceCulling = false;
    } else if (mat instanceof StandardMaterial) {
      mat.transparencyMode = mode;
      mat.useAlphaFromDiffuseTexture = mode !== 0;
      if (mode !== 0) mat.backFaceCulling = false;
    }
    const tex = this.getActiveMaterialTexture();
    if (tex && mode !== 0) {
      tex.hasAlpha = true;
    }
    this.events.onSceneModified?.();
  }

  public setMaterialTwoSided(twoSided: boolean): void {
    const mat = this.getSelectedMaterial();
    if (!mat) return;
    mat.backFaceCulling = !twoSided;
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

  public applyTriplanarUVs(scale: number = 1.0): void {
    if (!this.selectedMesh) {
      this.events.onToast?.('Please select a mesh first.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    if (!positions || !normals) return;

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
        // Top projection
        u = x * scale;
        v = z * scale;
      } else if (nx >= ny && nx >= nz) {
        // Side projection
        u = z * scale;
        v = y * scale;
      } else {
        // Front projection
        u = x * scale;
        v = y * scale;
      }

      uvs.push(u, v);
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
    this.events.onSceneModified?.();
    this.events.onToast?.('Applied Triplanar UV mapping to mesh!', 'success');
  }

  public applyPlanarUVs(direction: 'top' | 'front' | 'side' = 'top', scale: number = 1.0): void {
    if (!this.selectedMesh) return;
    const mesh = this.selectedMesh;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const uvs: number[] = [];
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      let u = 0;
      let v = 0;

      if (direction === 'top') {
        u = x * scale;
        v = z * scale;
      } else if (direction === 'side') {
        u = z * scale;
        v = y * scale;
      } else {
        u = x * scale;
        v = y * scale;
      }
      uvs.push(u, v);
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied Planar (${direction}) UVs!`, 'success');
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

      const isPotentiallyTransparent =
        !isBumpMap &&
        (lowerFileName.endsWith('.png') ||
          lowerFileName.endsWith('.webp') ||
          lowerFileName.endsWith('.gif') ||
          lowerFileName.endsWith('.svg'));

      if (isPotentiallyTransparent) {
        tex.hasAlpha = true;
      }

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
            if (isPotentiallyTransparent) {
              mat.useAlphaFromAlbedoTexture = true;
              if (
                mat.transparencyMode === PBRMaterial.PBRMATERIAL_OPAQUE ||
                mat.transparencyMode === undefined ||
                mat.transparencyMode === null
              ) {
                mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
              }
              mat.backFaceCulling = false;
            }
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
            if (isPotentiallyTransparent) {
              mat.useAlphaFromDiffuseTexture = true;
              mat.backFaceCulling = false;
            }
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
          if (isPotentiallyTransparent) {
            selMat.useAlphaFromAlbedoTexture = true;
            if (
              selMat.transparencyMode === PBRMaterial.PBRMATERIAL_OPAQUE ||
              selMat.transparencyMode === undefined ||
              selMat.transparencyMode === null
            ) {
              selMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
            }
            selMat.backFaceCulling = false;
          }
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
          if (isPotentiallyTransparent) {
            selMat.useAlphaFromDiffuseTexture = true;
            selMat.backFaceCulling = false;
          }
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
            if (isPotentiallyTransparent) {
              mat.useAlphaFromAlbedoTexture = true;
              if (
                mat.transparencyMode === PBRMaterial.PBRMATERIAL_OPAQUE ||
                mat.transparencyMode === undefined ||
                mat.transparencyMode === null
              ) {
                mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
              }
              mat.backFaceCulling = false;
            }
            fileAppliedCount++;
          } else if (mat instanceof StandardMaterial) {
            mat.diffuseTexture = tex;
            if (isPotentiallyTransparent) {
              mat.useAlphaFromDiffuseTexture = true;
              mat.backFaceCulling = false;
            }
            fileAppliedCount++;
          }
        }
      }

      totalApplied += fileAppliedCount;
    }

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

    for (const t of this.scene.textures) {
      if (!(t instanceof Texture)) continue;

      const lowerName = (t.name || '').toLowerCase();

      // Filter out internal RenderTargetTextures, cubes, post-processes and Babylon system layers
      if ((t as any).isRenderTarget || (t as any)._isRenderTarget || (t as any).isCube) continue;
      if (lowerName === 'gridmat' || lowerName.startsWith('editor_')) continue;
      if (internalKeywords.some((kw) => lowerName.includes(kw))) continue;

      // Real user / material textures must have a valid URL or buffer
      if (!t.url && !(t as any)._buffer) continue;

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
      if (size.width <= 1 && size.height <= 1 && lowerName.includes('color')) {
        continue;
      }

      texList.push(t);
    }
    return texList;
  }

  /**
   * Scans and returns detailed metadata for all textures currently embedded in the scene/materials.
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
      const url = tex.url || '';
      if (!url) continue;

      // Validate URL format for 2D images
      const lowerUrl = url.toLowerCase();
      const isValidImageUrl =
        lowerUrl.startsWith('data:image/') ||
        lowerUrl.startsWith('blob:') ||
        lowerUrl.startsWith('http://') ||
        lowerUrl.startsWith('https://') ||
        lowerUrl.startsWith('./') ||
        lowerUrl.startsWith('/');
      if (!isValidImageUrl) continue;

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
        }
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

  /**
   * Adds an embedded texture to the scene from a data URL string.
   */
  public addTextureFromDataUrl(name: string, dataUrl: string): Texture {
    const tex = new Texture(dataUrl, this.scene, false, false);
    tex.name = name;
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

    for (const tex of textures) {
      try {
        const optimizedTexture = await this.convertTextureToWebP(tex, quality, maxResolution);
        if (optimizedTexture) {
          this.replaceTextureInAllMaterials(tex, optimizedTexture);
          optimizedCount++;
        }
      } catch (e) {
        console.warn('Failed to optimize texture:', tex.name, e);
      }
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
    return new Texture(webpUrl, this.scene, false, false);
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

    const shouldExport = (node: any) => this.shouldExportNode(node, opts.selectedOnly);

    try {
      let exportedBlob: Blob | null = null;
      let downloadFallback: (() => void) | null = null;

      if (format === 'glb') {
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
    }
  }

  public async exportToGLBBlob(filename: string = 'model'): Promise<Blob> {
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

  public async loadFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    const modelExtensions = ['.glb', '.gltf', '.obj', '.stl', '.ply', '.babylon'];

    const validFiles = files.filter((f) => !f.name.startsWith('.'));
    if (validFiles.length === 0) return;

    const primaryFile =
      validFiles.find((f) => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return modelExtensions.includes(ext);
      }) || validFiles[0];

    this.events.onStatusChanged?.(`Loading ${primaryFile.name}...`, true);
    try {
      this.clearModel();
      this.registerDroppedFiles(validFiles);
      this.currentFilename = primaryFile.name;
      this.exportParams.filename = primaryFile.name.replace(/\.[^/.]+$/, '') + '_edited';

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

      // Ensure any images included in the multi-file drop are immediately applied to materials
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];
      const imagesInDrop = validFiles.filter((f) => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return imageExtensions.includes(ext);
      });
      if (imagesInDrop.length > 0) {
        await this.applyDroppedTextures(imagesInDrop);
      }

      this.events.onModelLoaded?.(primaryFile.name);
      this.events.onToast?.(`File "${primaryFile.name}" loaded successfully!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error loading file:', err);
      this.events.onToast?.(`Failed to load file: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error loading model');
    }
  }

  public async importFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;
    const modelExtensions = ['.glb', '.gltf', '.obj', '.stl', '.ply', '.babylon'];

    const validFiles = files.filter((f) => !f.name.startsWith('.'));
    if (validFiles.length === 0) return;

    this.registerDroppedFiles(validFiles);

    const modelFiles = validFiles.filter((f) => {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      return modelExtensions.includes(ext);
    });

    if (modelFiles.length > 0) {
      for (const m of modelFiles) {
        await this.importFile(m);
      }
    } else {
      await this.importFile(validFiles[0]);
    }

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];
    const imagesInDrop = validFiles.filter((f) => {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      return imageExtensions.includes(ext);
    });
    if (imagesInDrop.length > 0) {
      await this.applyDroppedTextures(imagesInDrop);
    }
  }

  public async loadFile(file: File): Promise<void> {
    await this.loadFiles([file]);
  }

  public async importFile(file: File): Promise<void> {
    this.events.onStatusChanged?.(`Importing ${file.name}...`, true);
    try {
      this.currentFilename = file.name;
      FilesInputStore.FilesToLoad[file.name.toLowerCase()] = file;
      const result = await SceneLoader.ImportMeshAsync('', 'file:', file, this.scene);
      this.processImportedMeshes(result.meshes as Mesh[], file.name);

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

      this.events.onToast?.(`"${file.name}" imported into scene!`, 'success');
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
      this.clearModel();
      this.currentFilename = filename;
      this.exportParams.filename = filename.replace(/\.[^/.]+$/, '') + '_edited';

      const lastSlash = url.lastIndexOf('/');
      const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : './';
      const file = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

      const result = await SceneLoader.ImportMeshAsync('', rootUrl, file, this.scene);
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
      const lastSlash = url.lastIndexOf('/');
      const rootUrl = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : './';
      const file = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;

      const result = await SceneLoader.ImportMeshAsync('', rootUrl, file, this.scene);
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

    this.groups.push(group);
    this.selectNodes([group]);
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
  }

  public resetCamera(): void {
    this.camera.minZ = 0.05;
    this.camera.maxZ = 50000;
    this.camera.speed = 0.4;
    this.camera.rotationQuaternion = null;
    this.camera.position.set(0, 2.5, -6);
    this.camera.setTarget(new Vector3(0, 1, 0));
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
    this.gridMesh.setEnabled(this.sceneParams.grid);
    (this.gridMesh as any).metadata = { isEditorHelper: true };
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
      totalPolys += Math.floor((m.getTotalIndices ? m.getTotalIndices() : 0) / 3);
    }
    this.events.onStatsUpdated?.(count, totalPolys);
  }
}
