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
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
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
import {
  ActionRecord,
  CSGOperationType,
  ExportOptions,
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
  public selectedFaceId: number | null = null;
  public facetHighlightMesh: Nullable<LinesMesh> = null;

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
          part.dragBehavior.onDragStartObservable.add(capturePreDrag);
          part.dragBehavior.onDragEndObservable.add(() => commitPostDrag(name));
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

        // If voxel painter is active, ignore default mesh selection
        if (this.voxelPainter?.isActive) {
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
    } else if (this.selectedNodes.length === 1) {
      const single = this.selectedNodes[0];
      if (single instanceof Mesh) {
        this.selectedMesh = single;
        this.selectedSubMeshId = subMeshId !== undefined ? subMeshId : null;
      } else {
        this.selectedMesh = null;
        this.selectedSubMeshId = null;
      }
      this.gizmoManager.attachToNode(single);
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
    }
    this.events.onToast?.(
      this.facetEditorActive ? 'Facet Editor enabled. Click faces on selected mesh.' : 'Facet Editor disabled.',
      'info'
    );
    return this.facetEditorActive;
  }

  public handleFacetPointer(pointerInfo: PointerInfo): void {
    if (!this.selectedMesh) return;
    const pick = pointerInfo.pickInfo;
    if (pick && pick.hit && pick.pickedMesh === this.selectedMesh && pick.faceId !== undefined) {
      this.selectedFaceId = pick.faceId;
      this.highlightFace(this.selectedMesh, pick.faceId);
      this.events.onToast?.(`Face #${pick.faceId} selected.`, 'info');
    }
  }

  private highlightFace(mesh: Mesh, faceId: number): void {
    if (this.facetHighlightMesh) {
      this.facetHighlightMesh.dispose();
      this.facetHighlightMesh = null;
    }

    const indices = mesh.getIndices();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!indices || !positions) return;

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    mesh.computeWorldMatrix(true);
    const wm = mesh.getWorldMatrix();
    const w0 = Vector3.TransformCoordinates(p0, wm);
    const w1 = Vector3.TransformCoordinates(p1, wm);
    const w2 = Vector3.TransformCoordinates(p2, wm);

    this.facetHighlightMesh = MeshBuilder.CreateLines(
      'editor_facet_highlight',
      { points: [w0, w1, w2, w0] },
      this.scene
    );
    this.facetHighlightMesh.color = new Color3(1, 0.8, 0.2);
    (this.facetHighlightMesh as any).metadata = { isEditorHelper: true };
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

    const i0 = indices[faceId * 3];
    const i1 = indices[faceId * 3 + 1];
    const i2 = indices[faceId * 3 + 2];

    const p0 = new Vector3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
    const p1 = new Vector3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
    const p2 = new Vector3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

    // Face normal
    const normal = Vector3.Cross(p1.subtract(p0), p2.subtract(p0)).normalize();
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

    // Update top face
    indices[faceId * 3] = newV0;
    indices[faceId * 3 + 1] = newV1;
    indices[faceId * 3 + 2] = newV2;

    // Create side quads (2 triangles each)
    indices.push(i0, newV0, newV1, i0, newV1, i1);
    indices.push(i1, newV1, newV2, i1, newV2, i2);
    indices.push(i2, newV2, newV0, i2, newV0, i0);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setIndices(indices);

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();

    this.highlightFace(mesh, faceId);
    this.events.onSceneModified?.();
    this.events.onToast?.(`Extruded face by ${distance}!`, 'success');
  }

  public deleteSelectedFacet(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to delete.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const indices = Array.from(mesh.getIndices() || []);

    indices.splice(faceId * 3, 3);
    mesh.setIndices(indices);
    mesh.refreshBoundingInfo();

    if (this.facetHighlightMesh) {
      this.facetHighlightMesh.dispose();
      this.facetHighlightMesh = null;
    }
    this.selectedFaceId = null;
    this.events.onSceneModified?.();
    this.events.onToast?.('Face deleted.', 'success');
  }

  public flipSelectedFacetNormal(): void {
    if (!this.selectedMesh || this.selectedFaceId === null) {
      this.events.onToast?.('Please pick a face to flip.', 'warning');
      return;
    }
    const mesh = this.selectedMesh;
    const faceId = this.selectedFaceId;
    const indices = Array.from(mesh.getIndices() || []);

    // Swap 2 vertices to invert triangle winding
    const temp = indices[faceId * 3 + 1];
    indices[faceId * 3 + 1] = indices[faceId * 3 + 2];
    indices[faceId * 3 + 2] = temp;

    mesh.setIndices(indices);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    }
    mesh.refreshBoundingInfo();
    this.events.onSceneModified?.();
    this.events.onToast?.('Face normal inverted!', 'success');
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
    if (selMat instanceof PBRMaterial) {
      selMat.albedoTexture = tex;
    } else if (selMat instanceof StandardMaterial) {
      selMat.diffuseTexture = tex;
    }
    this.events.onSceneModified?.();
    this.events.onToast?.(`Applied texture to material "${selMat.name}"`, 'success');
    return true;
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

      let fileAppliedCount = 0;

      // 1. Match scene materials by material name or current texture name
      for (const mesh of this.importedMeshes) {
        const mat = mesh.material;
        if (!mat || mat.name === 'gridMat' || mat.name.startsWith('editor_')) continue;

        const matNameLower = mat.name.toLowerCase();
        let matches = false;

        if (matNameLower === baseNameWithoutExt || matNameLower === lowerFileName) {
          matches = true;
        }

        if (!matches) {
          if (mat instanceof PBRMaterial && mat.albedoTexture) {
            const curTexName = (mat.albedoTexture.name || '').toLowerCase();
            if (curTexName.includes(lowerFileName) || curTexName.includes(baseNameWithoutExt)) {
              matches = true;
            }
          } else if (mat instanceof StandardMaterial && mat.diffuseTexture) {
            const curTexName = (mat.diffuseTexture.name || '').toLowerCase();
            if (curTexName.includes(lowerFileName) || curTexName.includes(baseNameWithoutExt)) {
              matches = true;
            }
          }
        }

        if (matches) {
          if (mat instanceof PBRMaterial) {
            mat.albedoTexture = tex;
            fileAppliedCount++;
          } else if (mat instanceof StandardMaterial) {
            mat.diffuseTexture = tex;
            fileAppliedCount++;
          }
        }
      }

      // 2. If no name match was found and a mesh is selected, apply to selected mesh
      if (fileAppliedCount === 0 && this.getSelectedMaterial()) {
        const selMat = this.getSelectedMaterial();
        if (selMat instanceof PBRMaterial) {
          selMat.albedoTexture = tex;
          fileAppliedCount++;
        } else if (selMat instanceof StandardMaterial) {
          selMat.diffuseTexture = tex;
          fileAppliedCount++;
        }
      }

      // 3. If still not applied and only 1 image was dropped, apply to all imported meshes
      if (fileAppliedCount === 0 && imageFiles.length === 1) {
        for (const mesh of this.importedMeshes) {
          const mat = mesh.material;
          if (!mat || mat.name === 'gridMat' || mat.name.startsWith('editor_')) continue;
          if (mat instanceof PBRMaterial) {
            mat.albedoTexture = tex;
            fileAppliedCount++;
          } else if (mat instanceof StandardMaterial) {
            mat.diffuseTexture = tex;
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
      'RTT',
      'EffectLayer',
      'HighlightLayer',
      'postprocess',
      'environment',
      'mirror',
      'shadowMap',
      'probe',
      'reflection',
      'pass',
    ];

    for (const t of this.scene.textures) {
      if (!(t instanceof Texture)) continue;

      // Filter out internal RenderTargetTextures, post-processes and Babylon system layers
      if ((t as any).isRenderTarget || (t as any)._isRenderTarget) continue;
      if (t.name === 'gridMat' || t.name.startsWith('editor_')) continue;
      if (internalKeywords.some((kw) => t.name.includes(kw))) continue;

      // Real user / material textures must have a valid URL or buffer
      if (!t.url && !(t as any)._buffer) continue;

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

    for (const tex of textures) {
      const size = tex.getSize();
      const matchingAtlas = atlases.find(
        (a) => a.texture === tex || a.texture.name === tex.name || (a.dataUrl && a.dataUrl === tex.url)
      );

      const url = tex.url || matchingAtlas?.dataUrl || '';
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
        }
      }

      result.push({
        id: tex.uniqueId ? String(tex.uniqueId) : tex.name,
        name: tex.name || 'embedded_texture',
        width: size.width || 0,
        height: size.height || 0,
        url,
        isAtlas: !!matchingAtlas,
        atlasId: matchingAtlas?.id,
        columns: matchingAtlas?.columns,
        rows: matchingAtlas?.rows,
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
  public async exportCurrentModel(options?: Partial<ExportOptions>): Promise<void> {
    const opts: ExportOptions = {
      format: (options?.format || this.exportParams.format || 'glb') as ExportOptions['format'],
      filename: (options?.filename || this.exportParams.filename || 'model_edited').trim(),
      selectedOnly: options?.selectedOnly ?? this.exportParams.selectedOnly ?? false,
    };

    const format = opts.format.toLowerCase() as ExportOptions['format'];
    this.events.onStatusChanged?.(`Exporting as ${format.toUpperCase()}...`, true);

    const shouldExport = (node: any) => {
      if (this.isEditorHelper(node)) return false;
      if (opts.selectedOnly && !this.selectedNodes.includes(node)) return false;
      return true;
    };

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
    const shouldExport = (node: any) => !this.isEditorHelper(node);
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
      this.events.onToast?.(`Model "${filename}" imported into scene!`, 'success');
      this.events.onStatusChanged?.('Ready');
    } catch (err: any) {
      console.error('Error importing model from URL:', err);
      this.events.onToast?.(`Failed to import: ${err.message || err}`, 'error');
      this.events.onStatusChanged?.('Error importing');
    }
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
