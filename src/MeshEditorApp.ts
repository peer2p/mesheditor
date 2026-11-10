import { Color3, Engine, Mesh, Node, PBRMaterial, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';
import * as dat from 'dat.gui';
import { marked } from 'marked';
import { createDefaultPlatformAdapter, MeshEditorPlatformAdapter } from './adapters';
import { AI_ENDPOINT_PRESETS, NEURAL_3D_PROTOCOL_DEFAULTS } from './AIAgentService';
import { MeshEditorService } from './MeshEditorService';
import { MenuItemDefinition, MeshEditorPlugin, PluginManager, ToolbarButtonDefinition } from './plugin';
import { ensureMeshEditorStyles } from './styles';
import { AI_CHAT_EMPTY_HTML, getMeshEditorTemplate } from './template';
import {
  AIAgentToolExecutionStep,
  ExportOptions,
  MeshEditorServiceEvents,
  Neural3DBackendId,
  Neural3DProtocol,
  Neural3DProvidersMap,
  PrimitiveShape,
} from './types';
import { PathExtrusionStudio } from './pathExtrusion';
import { getBuiltinEditorTools, ToolInterface } from './tools';
import {
  AI_QUICK_PROMPTS,
  AIQuickPrompt,
  getAllQuickPrompts,
  getQuickPromptById,
  normalizePromptImageUrl,
} from './tools/editor/aiQuickPrompts';
import {
  ModelCompressor,
  ModelCompressorOptions,
  ModelCompressorStats,
} from './compression/ModelCompressor';
import { SculptBrushType } from './sculpting/SculptController';

export interface MeshEditorAppOptions {
  /**
   * Optional DOM container element (or selector) to mount the Mesh Editor into.
   * If omitted, uses the existing `#app-container` / `#renderCanvas` in the document,
   * or creates a container in `document.body`.
   */
  container?: HTMLElement | string;

  /**
   * Optional Platform Adapter (e.g. `BrowserPlatformAdapter`, `ElectronPlatformAdapter`, `HostAppAdapter`).
   * If omitted, automatically detects Electron vs. Browser.
   */
  adapter?: MeshEditorPlatformAdapter;

  /**
   * Optional initial layout mode ('floating' | 'stackpanel').
   */
  layoutMode?: 'floating' | 'stackpanel';

  /**
   * Optional initial 3D model URL to load upon startup.
   */
  autoLoadUrl?: string;

  /**
   * Optional additional service event callbacks (e.g. used by `<mesh-editor>` Web Component).
   */
  events?: MeshEditorServiceEvents;

  /**
   * Optional custom Babylon Engine instance (e.g. `NullEngine` for headless integration testing).
   */
  engine?: Engine;
}

// Single icons are imported here for tree shaking and smaller bundle size
// This is more performant than importing the entire lucide library
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart2,
  Bone,
  Bot,
  Box,
  Boxes,
  BoxSelect,
  Brush,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Code,
  Combine,
  Copy,
  createIcons,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  File,
  FileArchive,
  FileCheck,
  Film,
  Flame,
  Folder,
  FolderInput,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Grid,
  Grid2x2,
  Grid3x3,
  GripVertical,
  Hash,
  HelpCircle,
  Image,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  Library,
  Lightbulb,
  ListTree,
  Loader2,
  Map as LucideMap,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  Move3d,
  Network,
  Mouse,
  MousePointer,
  Move,
  Package,
  Palette,
  Paintbrush,
  PanelRight,
  PawPrint,
  Pipette,
  Plus,
  PlusCircle,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Route,
  Save,
  Scan,
  Scissors,
  Search,
  Send,
  Settings,
  Shapes,
  Shield,
  ShieldCheck,
  Sliders,
  Smile,
  Sparkles,
  Square,
  SquareDashed,
  Stamp,
  Sun,
  SunMedium,
  Target,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  Wand2,
  Waves,
  Wrench,
  X,
  Zap,
} from 'lucide';

// The icons are registered with Lucide for tree shaking and smaller bundle size
export const editorIcons = {
  Activity,
  AlertCircle,
  AlertTriangle,
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart2,
  Bone,
  Bot,
  Box,
  Boxes,
  BoxSelect,
  Brush,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Code,
  Combine,
  Copy,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  File,
  FileArchive,
  FileCheck,
  Film,
  Flame,
  Folder,
  FolderInput,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Grid,
  Grid2x2,
  Grid3x3,
  GripVertical,
  Hash,
  HelpCircle,
  Image,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  Library,
  Lightbulb,
  ListTree,
  Loader2,
  Map: LucideMap,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  Move3d,
  Network,
  Mouse,
  MousePointer,
  Move,
  Package,
  Palette,
  Paintbrush,
  PanelRight,
  PawPrint,
  Pipette,
  Plus,
  PlusCircle,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Route,
  Save,
  Scan,
  Scissors,
  Search,
  Send,
  Settings,
  Shapes,
  Shield,
  ShieldCheck,
  Sliders,
  Smile,
  Sparkles,
  Square,
  SquareDashed,
  Stamp,
  Sun,
  SunMedium,
  Target,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  Wand2,
  Waves,
  Wrench,
  X,
  Zap,
};

// Expose on window for plugins or legacy calls
if (typeof window !== 'undefined') {
  (window as any).lucide = {
    createIcons: (options: any = {}) => createIcons({ icons: editorIcons, ...options }),
    icons: editorIcons,
  };
}

// Initial icon rendering
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createIcons({ icons: editorIcons });
    });
  } else {
    createIcons({ icons: editorIcons });
  }
}

export class MeshEditorApp {
  public rootContainer: HTMLElement;
  public canvas: HTMLCanvasElement;
  public service: MeshEditorService;
  public pluginManager: PluginManager;
  public adapter: MeshEditorPlatformAdapter;

  // UI DOM Elements
  private toastElement: HTMLElement;
  private toastIcon: HTMLElement;
  private toastText: HTMLElement;
  private statusText: HTMLElement;
  private statusIndicator: HTMLElement;
  private statsMeshes: HTMLElement;
  private statsPolys: HTMLElement;

  private outlinerTreeContainer: HTMLElement;
  private outlinerSearchInput: HTMLInputElement;
  private searchFilter: string = '';
  private collapsedNodeIds: Set<string> = new Set<string>();

  // File Inputs
  private modelFileInput: HTMLInputElement;
  private importFileInput: HTMLInputElement;
  private textureFileInput: HTMLInputElement;
  private bumpFileInput: HTMLInputElement;

  // dat.GUI instances
  private guiScene!: dat.GUI;
  private guiMesh!: dat.GUI;
  private guiMaterial!: dat.GUI;
  private guiAnim!: dat.GUI;
  private guiTextures!: dat.GUI;
  private guiCreate!: dat.GUI;
  private guiCSG!: dat.GUI;
  private guiFacet!: dat.GUI;

  private meshControllers: { [key: string]: dat.GUIController } = {};
  private materialControllers: { [key: string]: dat.GUIController } = {};
  private textureControllers: { [key: string]: dat.GUIController } = {};
  private csgControllers: { [key: string]: dat.GUIController } = {};
  private animControllers: { [key: string]: dat.GUIController } = {};
  private createControllers: { [key: string]: dat.GUIController } = {};
  private uvControllers: { [key: string]: dat.GUIController } = {};

  // Layout Mode
  public layoutMode: 'floating' | 'stackpanel' = 'stackpanel';

  // Compress Model Tool State
  public compressLoadedFile: File | null = null;

  // Loading Animation Elements & Timers
  private startupLoaderElement: HTMLElement | null = null;
  private startupLoaderText: HTMLElement | null = null;
  private startupLoaderBar: HTMLElement | null = null;
  private sceneLoaderElement: HTMLElement | null = null;
  private sceneLoaderTitle: HTMLElement | null = null;
  private sceneLoaderSub: HTMLElement | null = null;
  private startupTimerIds: Array<ReturnType<typeof setTimeout>> = [];
  private sceneLoaderTimerId: ReturnType<typeof setTimeout> | null = null;

  // Built-in Editor Tools & Abstracted Dialog IDs
  public readonly editorTools: ToolInterface[] = getBuiltinEditorTools();

  public get dialogIds(): string[] {
    return this.editorTools.filter((t) => !!t.dialogId).map((t) => t.dialogId!);
  }

  public getToolByDialogId(dialogId: string): ToolInterface | undefined {
    return this.editorTools.find((t) => t.dialogId === dialogId);
  }

  public getToolByName(name: string): ToolInterface | undefined {
    return this.editorTools.find((t) => t.name === name);
  }

  public isDialogOpen(dialogId: string): boolean {
    const dialog = this.getElement(dialogId);
    if (!dialog) return false;
    return (
      dialog.style.display !== 'none' &&
      (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none')
    );
  }

  // Stackpanel Tool Drag & Drop Reordering State
  private currentDraggedStackpanelDialog: HTMLElement | null = null;
  private justFinishedStackpanelDrag: boolean = false;

  // AI Agent UI State
  private aiPendingImages: string[] = [];
  private aiAbortController: AbortController | null = null;
  private initialChatEmptyHtml: string = '';
  private speechRecognition: any = null;
  private isRecordingSpeech: boolean = false;
  private speechInitialPrompt: string = '';

  // GUI parameter proxy objects
  private meshParams = {
    name: '',
    visible: true,
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    uniformScale: 1,
    showBoundingBox: false,
    snapToGround: () => this.service.snapSelectedToGround(),
    centerOrigin: () => this.service.centerSelectedPivot(),
    centerAllPivots: () => this.service.centerAllMeshPivots(),
    bakeTransform: () => this.service.bakeSelectedTransform(),
    separateLooseParts: () => this.service.separateSelectedLooseParts(),
    mergeMeshes: () => this.service.mergeSelectedMeshes(),
    separateSubmeshes: () => this.service.separateSelectedSubMeshes(),
    copyMesh: () => this.service.copySelected(),
    pasteMesh: () => this.service.pasteAtCursor(),
    duplicateMesh: () => this.service.duplicateSelectedMesh(),
    deleteMesh: () => this.service.deleteSelected(),
  };

  private materialParams = {
    submeshInfo: 'No Submesh',
    extractSubmesh: () => this.service.extractSelectedSubMesh(),
    deleteSubmesh: () => this.service.deleteSelectedSubMesh(),
    splitAllSubmeshes: () => this.service.splitAllSubMeshesOnSelected(),
    materialName: '',
    albedoColor: '#ffffff',
    emissiveColor: '#000000',
    roughness: 0.5,
    metallic: 0.0,
    alpha: 1.0,
    wireframe: false,
    backFaceCulling: false,
    textureAlpha: false,
    transparencyMode: 'Opaque',
    twoSided: true,
    alphaCutOff: 0.5,
    bumpInfo: 'None',
    bumpLevel: 1.0,
    invertNormalMapX: false,
    invertNormalMapY: false,
    useParallax: false,
    useParallaxOcclusion: false,
    parallaxScaleBias: 0.05,
    loadBumpTexture: () => this.triggerReplaceBumpTexture(),
    generateNormalFromDiffuse: () => {
      this.service.generateNormalMapFromActiveTexture();
      this.updateMaterialGUI();
    },
    removeBumpTexture: () => {
      this.service.removeBumpTextureFromSelectedMaterial();
      this.updateMaterialGUI();
    },
    replaceTexture: () => this.triggerReplaceTexture(),
    newMaterial: () => this.service.createNewMaterialForSelected(),
  };

  private uvParams = {
    uOffset: 0,
    vOffset: 0,
    uScale: 1,
    vScale: 1,
    rotation: 0,
    wrapMode: 'Repeat',
    autoTriplanar: () => this.service.applyTriplanarUVs(),
    planarTop: () => this.service.applyPlanarUVs('top'),
    planarFront: () => this.service.applyPlanarUVs('front'),
    planarSide: () => this.service.applyPlanarUVs('side'),
  };

  private createParams = {
    shape: 'Box' as PrimitiveShape,
    name: 'New_Mesh',
    size: 1.0,
    width: 1.0,
    height: 1.0,
    depth: 1.0,
    diameter: 1.0,
    thickness: 0.3,
    tessellation: 24,
    subdivisions: 2,
    polyType: '1: Octahedron (8)',
    color: '#4f8cf6',
    roughness: 0.4,
    metallic: 0.1,
    createNow: () => this.createPrimitiveMesh(),
    clickToPlace: () => this.startPrimitivePlacement(),
  };

  private csgParams = {
    targetMesh: 'None',
    toolMesh: 'None',
    keepToolMesh: false,
    useSelectedAsTarget: () => this.setCSGTargetFromSelected(),
    useSelectedAsTool: () => this.setCSGToolFromSelected(),
    swapTargetAndTool: () => this.swapCSGMeshes(),
    addCutterBox: () => this.addQuickCutter('Box'),
    addCutterCylinder: () => this.addQuickCutter('Cylinder'),
    addCutterSphere: () => this.addQuickCutter('Sphere'),
    subtract: () => this.performCSGOperation('subtract'),
    union: () => this.performCSGOperation('union'),
    intersect: () => this.performCSGOperation('intersect'),
  };

  private facetParams = {
    active: false,
    extrudeDist: 0.5,
    insetAmount: 0.25,
    thickness: 0.2,
    segments: 4,
    count: 3,
    extrudeNow: () => this.service.extrudeSelectedFacet(this.facetParams.extrudeDist),
    insetNow: () => this.service.insetSelectedFacet(this.facetParams.insetAmount),
    arcNow: () => this.service.arcSelectedFacet(this.facetParams.segments, this.facetParams.extrudeDist),
    knifeNow: () => this.service.knifeSplitFacet(),
    loopCutNow: () => this.service.loopCutSelectedFacet(),
    bevelNow: () => this.service.bevelSelectedFacet(this.facetParams.insetAmount),
    solidifyNow: () => this.service.solidifyMeshOrFacet(this.facetParams.thickness, true),
    arrayNow: () => this.service.arraySelectedFacetOrMesh(this.facetParams.count, this.facetParams.extrudeDist, 0, 0),
    cutThroughNow: () => this.service.cutThroughSelectedFacet(this.facetParams.extrudeDist),
    relaxNow: () => this.service.relaxSelectedFacet(),
    subdivideNow: () => this.service.subdivideSelectedFacet(),
    subDNow: () => this.service.subDSmoothMeshOrFacet(),
    deleteFacet: () => this.service.deleteSelectedFacet(),
    flipNormal: () => this.service.flipSelectedFacetNormal(),
  };

  private animParams = {
    clip: 'None',
    play: () => this.playAnimation(),
    pause: () => this.pauseAnimation(),
    stop: () => this.stopAnimation(),
    loop: true,
    speed: 1.0,
    frame: 0,
  };

  private textureParams = {
    detectedCount: 0,
    status: 'Ready',
    quality: 85,
    maxResolution: '1024',
    optimizeAll: () =>
      this.service.optimizeAllTexturesToWebP(this.textureParams.quality / 100, parseInt(this.textureParams.maxResolution, 10)),
  };

  constructor(options: MeshEditorAppOptions = {}) {
    // Resolve or create the root container
    let targetContainer: HTMLElement | null = null;
    if (typeof options.container === 'string') {
      targetContainer = document.querySelector(options.container) as HTMLElement;
    } else if (options.container instanceof HTMLElement) {
      targetContainer = options.container;
    }

    if (targetContainer) {
      ensureMeshEditorStyles(targetContainer.getRootNode() as Document | ShadowRoot);
      const existingCanvas = targetContainer.querySelector('#renderCanvas') as HTMLCanvasElement | null;
      if (!existingCanvas) {
        if (targetContainer.id === 'app-container') {
          targetContainer.innerHTML = getMeshEditorTemplate();
          this.rootContainer = targetContainer;
        } else {
          const appContainer = document.createElement('div');
          appContainer.id = 'app-container';
          appContainer.innerHTML = getMeshEditorTemplate();
          targetContainer.appendChild(appContainer);
          this.rootContainer = appContainer;
        }
      } else {
        this.rootContainer = (targetContainer.querySelector('#app-container') as HTMLElement) || targetContainer;
      }
    } else {
      const existingCanvas = document.getElementById('renderCanvas') as HTMLCanvasElement | null;
      if (!existingCanvas && typeof document !== 'undefined' && document.body) {
        ensureMeshEditorStyles(document);
        const appContainer = document.createElement('div');
        appContainer.id = 'app-container';
        appContainer.innerHTML = getMeshEditorTemplate();
        document.body.appendChild(appContainer);
        this.rootContainer = appContainer;
      } else {
        this.rootContainer = document.getElementById('app-container') || document.body;
      }
    }

    this.canvas = this.getElement<HTMLCanvasElement>('renderCanvas')!;
    if (!this.canvas) {
      throw new Error('Canvas element #renderCanvas not found in DOM.');
    }

    this.toastElement = this.getElement<HTMLElement>('toast')!;
    this.toastIcon = this.getElement<HTMLElement>('toastIcon')!;
    this.toastText = this.getElement<HTMLElement>('toastText')!;
    this.statusText = this.getElement<HTMLElement>('statusText')!;
    this.statusIndicator = this.getElement<HTMLElement>('statusIndicator')!;
    this.statsMeshes = this.getElement<HTMLElement>('statsMeshes')!;
    this.statsPolys = this.getElement<HTMLElement>('statsPolys')!;

    this.outlinerTreeContainer = this.getElement<HTMLElement>('outlinerTreeContainer')!;
    this.outlinerSearchInput = (this.getElement<HTMLInputElement>('outlinerSearch') ||
      this.getElement<HTMLInputElement>('outlinerSearchInput'))!;

    this.modelFileInput = this.getElement<HTMLInputElement>('modelFileInput')!;
    this.importFileInput = this.getElement<HTMLInputElement>('importFileInput')!;
    this.textureFileInput = this.getElement<HTMLInputElement>('textureFileInput')!;
    this.bumpFileInput = this.getElement<HTMLInputElement>('bumpFileInput')!;

    this.startupLoaderElement = this.getElement<HTMLElement>('appStartupLoader');
    this.startupLoaderText = this.getElement<HTMLElement>('startupLoaderText');
    this.startupLoaderBar = this.getElement<HTMLElement>('startupLoaderBar');
    this.sceneLoaderElement = this.getElement<HTMLElement>('sceneInitLoader');
    this.sceneLoaderTitle = this.getElement<HTMLElement>('sceneLoaderTitle');
    this.sceneLoaderSub = this.getElement<HTMLElement>('sceneLoaderSub');

    this.setStartupProgress(35, 'Initializing Babylon 3D Engine...');
    this.showSceneLoader('Initializing Babylon 3D Scene...', 'WEBGL2 ENGINE • SHADER PIPELINE • MESH GEOMETRY');

    // Initialize Platform Adapter
    this.adapter = options.adapter || createDefaultPlatformAdapter();

    // Initialize 3D Core Service
    this.service = new MeshEditorService(this.canvas, {
      onSelectionChanged: (nodes, activeMesh, subMeshId) => {
        this.updateMeshGUI();
        this.updateMaterialGUI();
        this.updateOutliner();
        this.updateCSGGUI();
        this.updateSculptUI();
        this.updateUVUnwrapUI();
        this.updateBakingUI();
        this.updateRiggingUI();
        this.updateAITextureUI();
        this.updateTextMeshUI();
        this.updateDecalUI();
        const statsSelection = this.getElement<HTMLElement>('statsSelection');
        if (statsSelection) {
          statsSelection.textContent = activeMesh
            ? activeMesh.name
            : nodes.length > 0
              ? `${nodes.length} objects`
              : 'None';
        }
        options.events?.onSelectionChanged?.(nodes, activeMesh, subMeshId);
      },
      onSceneModified: () => {
        this.updateOutliner();
        this.updateMeshGUI();
        this.updateCSGGUI();
        this.updateSculptUI();
        this.updateUVUnwrapUI();
        this.updateBakingUI();
        this.updateRiggingUI();
        this.updateAITextureUI();
        this.updateTextMeshUI();
        this.updateDecalUI();
        options.events?.onSceneModified?.();
      },
      onHistoryChanged: (canUndo, canRedo) => {
        const btnUndo = this.getElement<HTMLButtonElement>('btnUndo');
        const btnRedo = this.getElement<HTMLButtonElement>('btnRedo');
        if (btnUndo) btnUndo.disabled = !canUndo;
        if (btnRedo) btnRedo.disabled = !canRedo;
        options.events?.onHistoryChanged?.(canUndo, canRedo);
      },
      onStatusChanged: (text, isBusy) => {
        this.setStatus(text, isBusy);
        options.events?.onStatusChanged?.(text, isBusy);
      },
      onToast: (msg, type) => {
        this.showToast(msg, type);
        options.events?.onToast?.(msg, type);
      },
      onModelLoaded: (filename) => {
        this.updateOutliner();
        this.updateCSGGUI();
        this.renderEmbeddedTextures();
        this.adapter.onModelLoaded?.(filename, this);
        options.events?.onModelLoaded?.(filename);
      },
      onStatsUpdated: (meshCount, polyCount) => {
        if (this.statsMeshes) this.statsMeshes.textContent = meshCount.toString();
        if (this.statsPolys) this.statsPolys.textContent = polyCount.toLocaleString();
        options.events?.onStatsUpdated?.(meshCount, polyCount);
      },
      onAnimationsLoaded: (names, currentGroup) => {
        this.setupAnimations(names, currentGroup);
        options.events?.onAnimationsLoaded?.(names, currentGroup);
      },
      onAnimProgress: (frame) => {
        this.animParams.frame = frame;
        this.animControllers['frame']?.updateDisplay();
        options.events?.onAnimProgress?.(frame);
      },
      onExportModel: async (blob, filename, format) => {
        let handled = false;
        if (this.adapter.saveExportedModel) {
          handled = await this.adapter.saveExportedModel(blob, filename, format, this);
        }
        if (options.events?.onExportModel) {
          const eventHandled = await options.events.onExportModel(blob, filename, format);
          handled = handled || eventHandled;
        }
        return handled;
      },
    }, options.engine);

    // Initialize Plugin Manager
    this.pluginManager = new PluginManager(this, this.service);

    this.initGUI();
    this.initToolbarAndDialogs();
    this.initFileHandling();
    this.initKeyboardShortcuts();
    this.updateOutliner();

    // Initialize Platform Adapter hooks
    try {
      this.adapter.initialize?.(this);
    } catch (err) {
      console.warn('[MeshEditor] Failed to initialize platform adapter:', err);
    }

    // Set initial layout mode
    const savedLayoutMode =
      options.layoutMode ||
      (localStorage.getItem('mesheditor_layout_mode') as 'floating' | 'stackpanel') ||
      'stackpanel';
    this.setLayoutMode(savedLayoutMode, false);
    this.refreshIcons();

    this.runInitialLoadingSequence(options.autoLoadUrl);

    if (options.autoLoadUrl) {
      this.service.loadFromUrl(options.autoLoadUrl);
    }

    // Set initial focus on canvas so WASD & camera navigation works immediately
    requestAnimationFrame(() => {
      try {
        this.canvas?.focus();
      } catch {
        // Ignore in headless/mock environments
      }
    });
  }

  public getElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
    if (this.rootContainer) {
      const scoped = this.rootContainer.querySelector(`#${id}`) as T | null;
      if (scoped) return scoped;
    }
    if (typeof document !== 'undefined') {
      return document.getElementById(id) as T | null;
    }
    return null;
  }

  public setAdapter(adapter: MeshEditorPlatformAdapter): void {
    this.stopSpeechRecognition();
    this.adapter.dispose?.();
    this.adapter = adapter;
    this.adapter.initialize?.(this);
  }

  public async triggerOpenModel(): Promise<void> {
    if (this.adapter.openModelDialog) {
      const handled = await this.adapter.openModelDialog(this);
      if (handled) return;
    }
    this.modelFileInput?.click();
  }

  public async triggerImportModel(): Promise<void> {
    if (this.adapter.importModelDialog) {
      const handled = await this.adapter.importModelDialog(this);
      if (handled) return;
    }
    this.importFileInput?.click();
  }

  public async triggerReplaceTexture(): Promise<void> {
    if (this.adapter.openTextureDialog) {
      const handled = await this.adapter.openTextureDialog(this);
      if (handled) return;
    }
    this.textureFileInput?.click();
  }

  public async triggerReplaceBumpTexture(): Promise<void> {
    if (this.adapter.openBumpTextureDialog) {
      const handled = await this.adapter.openBumpTextureDialog(this);
      if (handled) return;
    }
    this.bumpFileInput?.click();
  }

  public dispose(): void {
    for (const timer of this.startupTimerIds) {
      clearTimeout(timer);
    }
    this.startupTimerIds = [];
    if (this.sceneLoaderTimerId) {
      clearTimeout(this.sceneLoaderTimerId);
      this.sceneLoaderTimerId = null;
    }
    this.stopSpeechRecognition();
    this.adapter.dispose?.();
    for (const plugin of this.pluginManager.getAllPlugins()) {
      this.pluginManager.unregister(plugin.id);
    }
    this.service.dispose();
  }

  public async use(plugin: MeshEditorPlugin): Promise<void> {
    await this.pluginManager.register(plugin);
    this.refreshIcons();
  }

  /* =========================================================================
     MENU & TOOLBAR EXTENSIONS FOR PLUGINS
     ========================================================================= */
  public registerFileMenuItem(item: MenuItemDefinition): void {
    const container = document.getElementById('menuFilePlugins');
    const divider = document.getElementById('menuFilePluginsDivider');
    if (!container) return;

    if (divider) divider.style.display = 'block';

    const btn = document.createElement('button');
    btn.className = `dropdown-item ${item.danger ? 'btn-danger' : ''}`;
    btn.id = item.id;

    const iconHtml = item.icon ? `<span class="btn-icon"><i class="app-icon" data-lucide="${item.icon}"></i></span>` : '';
    const shortcutHtml = item.shortcut ? `<span class="shortcut-tag">${item.shortcut}</span>` : '';

    btn.innerHTML = `
      ${iconHtml}
      <span class="btn-label">${item.label}</span>
      ${shortcutHtml}
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await item.onClick();
    });

    container.appendChild(btn);
    this.refreshIcons();
  }

  public registerActionMenuItem(item: MenuItemDefinition): void {
    const container = document.getElementById('menuActionsPlugins');
    const divider = document.getElementById('menuActionsPluginsDivider');
    if (!container) return;

    if (divider) divider.style.display = 'block';

    const btn = document.createElement('button');
    btn.className = `dropdown-item ${item.danger ? 'btn-danger' : ''}`;
    btn.id = item.id;

    const iconHtml = item.icon ? `<span class="btn-icon"><i class="app-icon" data-lucide="${item.icon}"></i></span>` : '';
    const shortcutHtml = item.shortcut ? `<span class="shortcut-tag">${item.shortcut}</span>` : '';

    btn.innerHTML = `
      ${iconHtml}
      <span class="btn-label">${item.label}</span>
      ${shortcutHtml}
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await item.onClick();
    });

    container.appendChild(btn);
    this.refreshIcons();
  }

  public registerToolMenuItem(item: MenuItemDefinition): void {
    const container = document.getElementById('menuToolsPlugins');
    const divider = document.getElementById('menuToolsPluginsDivider');
    if (!container) return;

    if (divider) divider.style.display = 'block';

    const btn = document.createElement('button');
    btn.className = `dropdown-item ${item.danger ? 'btn-danger' : ''}`;
    btn.id = item.id;

    const iconHtml = item.icon ? `<span class="btn-icon"><i class="app-icon" data-lucide="${item.icon}"></i></span>` : '';
    const shortcutHtml = item.shortcut ? `<span class="shortcut-tag">${item.shortcut}</span>` : '';

    btn.innerHTML = `
      ${iconHtml}
      <span class="btn-label">${item.label}</span>
      ${shortcutHtml}
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await item.onClick();
    });

    container.appendChild(btn);
    this.refreshIcons();
  }

  public registerViewMenuItem(item: MenuItemDefinition): void {
    const container = document.getElementById('menuViewPlugins');
    const divider = document.getElementById('menuViewPluginsDivider');
    if (!container) return;

    if (divider) divider.style.display = 'block';

    const btn = document.createElement('button');
    btn.className = `dropdown-item ${item.danger ? 'btn-danger' : ''}`;
    btn.id = item.id;

    const iconHtml = item.icon ? `<span class="btn-icon"><i class="app-icon" data-lucide="${item.icon}"></i></span>` : '';
    const shortcutHtml = item.shortcut ? `<span class="shortcut-tag">${item.shortcut}</span>` : '';

    btn.innerHTML = `
      ${iconHtml}
      <span class="btn-label">${item.label}</span>
      ${shortcutHtml}
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await item.onClick();
    });

    container.appendChild(btn);
    this.refreshIcons();
  }

  public registerToolbarButton(button: ToolbarButtonDefinition): void {
    const toolbar = document.getElementById('top-toolbar');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.className = `tool-btn ${button.className || ''}`;
    btn.id = button.id;
    if (button.title) btn.title = button.title;

    const iconHtml = button.icon ? `<span class="btn-icon"><i class="app-icon" data-lucide="${button.icon}"></i></span>` : '';
    btn.innerHTML = `${iconHtml}<span class="btn-label">${button.label}</span>`;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await button.onClick();
    });

    // Insert before help or layout buttons
    const targetAnchor = toolbar.querySelector('.panel-group') || toolbar.querySelector('.layout-group');
    if (targetAnchor) {
      toolbar.insertBefore(btn, targetAnchor);
    } else {
      toolbar.appendChild(btn);
    }
    this.refreshIcons();
  }

  /* =========================================================================
     TOOLBAR & DIALOG WINDOWS SETUP
     ========================================================================= */
  private initToolbarAndDialogs(): void {
    // Gizmo Mode Switches
    const btnTranslate = document.getElementById('btnGizmoTranslate');
    const btnRotate = document.getElementById('btnGizmoRotate');
    const btnScale = document.getElementById('btnGizmoScale');
    const btnBounds = document.getElementById('btnGizmoBounds');

    const updateGizmoButtons = (mode: 'translate' | 'rotate' | 'scale' | 'bounds') => {
      btnTranslate?.classList.toggle('active', mode === 'translate');
      btnRotate?.classList.toggle('active', mode === 'rotate');
      btnScale?.classList.toggle('active', mode === 'scale');
      btnBounds?.classList.toggle('active', mode === 'bounds');

      // Switching to standard transform gizmos deactivates exclusive 3D tools without closing their dialogs
      for (const tool of this.editorTools) {
        if (tool.isExclusive3DTool && tool.isActive?.(this)) {
          tool.onDeactivate?.(this);
        }
      }

      this.service.setGizmoMode(mode);
      this.updatePanelButtonStates();
    };

    btnTranslate?.addEventListener('click', () => updateGizmoButtons('translate'));
    btnRotate?.addEventListener('click', () => updateGizmoButtons('rotate'));
    btnScale?.addEventListener('click', () => updateGizmoButtons('scale'));
    btnBounds?.addEventListener('click', () => updateGizmoButtons('bounds'));

    // Undo / Redo
    document.getElementById('btnUndo')?.addEventListener('click', () => this.service.undo());
    document.getElementById('btnRedo')?.addEventListener('click', () => this.service.redo());

    // File Menu Generic Operations
    this.getElement('btnOpenModel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.triggerOpenModel();
    });
    this.getElement('btnImportModel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.triggerImportModel();
    });
    this.getElement('btnExportMenu')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.openExportDialog();
    });

    // Actions Menu
    document.getElementById('btnFocus')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.focusOnSelected();
    });
    document.getElementById('btnCenterPivot')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.centerSelectedPivot();
    });
    document.getElementById('btnExtractSubmesh')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.separateSelectedLooseParts();
    });
    document.getElementById('btnMergeMeshes')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.mergeSelectedMeshes();
    });
    document.getElementById('btnGroup')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.groupSelected();
    });
    document.getElementById('btnUngroup')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.ungroupSelected();
    });
    document.getElementById('btnDeleteSelected')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.service.deleteSelected();
    });

    // Build and wire Tools dropdown menu dynamically from registered ToolInterface instances
    this.renderToolsMenu();

    // Support legacy alias btnToggleMatPanel if present
    document.getElementById('btnToggleMatPanel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-material');
    });
    document.getElementById('btnToggleGrid')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      const newGridState = !this.service.sceneParams.grid;
      this.service.setGridVisible(newGridState);
      this.updatePanelButtonStates();
      this.showToast(`Ground grid ${newGridState ? 'enabled' : 'disabled'}`, 'info');
    });

    // Layout Mode (Floating vs Stack)
    this.getElement('btnLayoutFloating')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.setLayoutMode('floating');
    });
    this.getElement('btnLayoutStack')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.setLayoutMode('stackpanel');
    });

    // Dropdown Toggles Setup
    const setupDropdown = (wrapperId: string, buttonId: string, menuId: string) => {
      const btn = document.getElementById(buttonId);
      const wrapper = document.getElementById(wrapperId);
      const menu = document.getElementById(menuId);
      if (!btn || !wrapper) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = wrapper.classList.contains('open') || wrapper.classList.contains('active');
        this.closeAllDropdowns();
        if (!wasOpen) {
          wrapper.classList.add('open');
          wrapper.classList.add('active');
        }
      });

      menu?.addEventListener('click', (e) => {
        // Prevent click inside menu (on headers/dividers) from closing unless an action item was clicked
        const target = e.target as HTMLElement;
        if (!target.closest('.dropdown-item')) {
          e.stopPropagation();
        }
      });
    };

    setupDropdown('dropdownFile', 'btnDropdownFile', 'menuFile');
    setupDropdown('dropdownActions', 'btnDropdownActions', 'menuActions');
    setupDropdown('dropdownTools', 'btnDropdownTools', 'menuTools');
    setupDropdown('dropdownView', 'btnDropdownView', 'menuView');

    // Close on outside click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-wrapper')) {
        this.closeAllDropdowns();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
        this.closeExportDialog();
      }
    });

    // Setup Floating Dialogs & Dragging
    for (const id of this.dialogIds) {
      const dialog = this.getElement(id);
      if (dialog) this.setupFloatingDialog(dialog);
    }

    // Initialize stackpanel tool drag & drop and restore tool order
    this.initStackpanelDragAndDrop();
    this.restoreStackpanelOrder();

    // Initialize AI Agent Panel UI
    this.initAIAgentUI();
    this.initVoxelPainterUI();
    this.initEmbeddedTexturesUI();
    this.initPathExtrusionUI();
    this.initCompressModelUI();
    this.initSculptUI();
    this.initCSGBevelUI();
    this.initUVUnwrapUI();
    this.initBakingUI();
    this.initRiggingUI();
    this.initAITextureUI();
    this.initTextMeshUI();
    this.initDecalUI();

    // Restore saved window layout and active tools from localStorage
    this.restoreDialogLayout();
    this.updatePanelButtonStates();

    // Help Modal
    const helpModal = document.getElementById('helpModal');
    document.getElementById('btnHelp')?.addEventListener('click', () => helpModal?.classList.add('active'));
    document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
      helpModal?.classList.remove('active');
      this.canvas?.focus();
    });
    document.getElementById('btnHelpDone')?.addEventListener('click', () => {
      helpModal?.classList.remove('active');
      this.canvas?.focus();
    });
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.remove('active');
        this.canvas?.focus();
      }
    });

    // Tool-specific Help Modal Popup
    const toolHelpModal = this.getElement('toolHelpModal');
    this.getElement('btnCloseToolHelp')?.addEventListener('click', () => {
      toolHelpModal?.classList.remove('active');
      if (toolHelpModal) toolHelpModal.style.display = 'none';
      this.canvas?.focus();
    });
    this.getElement('btnDoneToolHelp')?.addEventListener('click', () => {
      toolHelpModal?.classList.remove('active');
      if (toolHelpModal) toolHelpModal.style.display = 'none';
      this.canvas?.focus();
    });
    toolHelpModal?.addEventListener('click', (e) => {
      if (e.target === toolHelpModal) {
        toolHelpModal.classList.remove('active');
        toolHelpModal.style.display = 'none';
        this.canvas?.focus();
      }
    });

    // Export Modal Dialog
    this.initExportDialog();

    // Outliner wireframe toggle button
    const btnOutlinerWireframe = this.getElement<HTMLButtonElement>('btnOutlinerWireframe');
    btnOutlinerWireframe?.addEventListener('click', () => {
      this.service.toggleSelectedWireframe();
      this.updateOutliner();
    });

    // Initialize Facet Modeling UI
    this.initFacetToolUI();

    // Search filter in Outliner
    this.outlinerSearchInput?.addEventListener('input', (e) => {
      this.searchFilter = (e.target as HTMLInputElement).value;
      this.updateOutliner();
    });
  }

  public closeAllDropdowns(): void {
    document.querySelectorAll('.dropdown-wrapper').forEach((el) => {
      el.classList.remove('open');
      el.classList.remove('active');
    });
  }

  public setLayoutMode(mode: 'floating' | 'stackpanel', save: boolean = true): void {
    this.layoutMode = mode;
    if (save) {
      localStorage.setItem('mesheditor_layout_mode', mode);
    }
    const btnFloating = this.getElement('btnLayoutFloating');
    const btnStack = this.getElement('btnLayoutStack');
    if (btnFloating) btnFloating.classList.toggle('active', mode === 'floating');
    if (btnStack) btnStack.classList.toggle('active', mode === 'stackpanel');

    if (mode === 'stackpanel') {
      document.body.classList.add('layout-stackpanel');
      this.rootContainer?.classList.add('layout-stackpanel');
      this.restoreStackpanelOrder();
      const sidebarPanels = Array.from(
        (this.rootContainer || document).querySelectorAll('.stackpanel-sidebar .floating-dialog')
      ) as HTMLElement[];
      sidebarPanels.forEach((p) => {
        const h = p.querySelector('.dialog-header');
        h?.setAttribute('draggable', 'true');
      });
      const openPanels = sidebarPanels.filter((d) => d.style.display !== 'none');
      if (openPanels.length > 0) {
        // Find if one is already expanded, or take the first open one
        const expanded = openPanels.find((d) => !d.classList.contains('minimized')) || openPanels[0];
        expanded.classList.remove('minimized');
        const btnMin = expanded.querySelector('.btn-min') as HTMLElement | null;
        if (btnMin) {
          btnMin.innerHTML = '<i class="app-icon" data-lucide="minus"></i>';
          btnMin.title = 'Minimize';
        }
        this.accordionMinimizeOthers(expanded);
      }
      if (save) {
        this.showToast('Switched to Stackpanel sidebar layout', 'info');
      }
      const outliner = this.getElement('dialog-outliner');
      if (outliner) {
        if (outliner.classList.contains('minimized')) {
          outliner.style.bottom = 'auto';
          outliner.style.height = 'auto';
        } else {
          outliner.style.bottom = '';
          outliner.style.height = '';
        }
      }
    } else {
      document.body.classList.remove('layout-stackpanel');
      this.rootContainer?.classList.remove('layout-stackpanel');
      const sidebarPanels = Array.from(
        (this.rootContainer || document).querySelectorAll('.stackpanel-sidebar .floating-dialog')
      ) as HTMLElement[];
      sidebarPanels.forEach((p) => {
        const h = p.querySelector('.dialog-header');
        h?.removeAttribute('draggable');
      });
      this.restoreDialogLayout();
      if (save) {
        this.showToast('Switched to Floating windows layout', 'info');
      }
    }
    this.updatePanelButtonStates();
  }

  private setupFloatingDialog(dialog: HTMLElement): void {
    const tool = this.getToolByDialogId(dialog.id);
    if (tool && tool.order !== undefined) {
      dialog.style.order = String(tool.order);
    }

    const header = dialog.querySelector('.dialog-header') as HTMLElement;
    const btnClose = dialog.querySelector('.btn-close');
    const btnMin = dialog.querySelector('.btn-min');
    let btnHelp = dialog.querySelector('.btn-help') as HTMLElement | null;
    const title = dialog.querySelector('.dialog-title') as HTMLElement | null;
    const actions = dialog.querySelector('.dialog-actions');

    // Ensure Help button exists directly to the left of Minimize button
    if (!btnHelp && actions && btnMin) {
      btnHelp = document.createElement('button');
      btnHelp.className = 'dialog-btn btn-help';
      btnHelp.title = 'Help & Tool Guide';
      btnHelp.setAttribute('aria-label', 'Help');
      btnHelp.innerHTML = '<i class="app-icon" data-lucide="help-circle"></i>';
      actions.insertBefore(btnHelp, btnMin);
    }

    // Ensure drag handle exists in title for stackpanel reordering
    let dragHandle = header?.querySelector('.dialog-drag-handle') as HTMLElement | null;
    if (!dragHandle && header && title) {
      dragHandle = document.createElement('span');
      dragHandle.className = 'dialog-drag-handle';
      dragHandle.title = 'Drag to reorder tools';
      dragHandle.setAttribute('aria-label', 'Drag to reorder tools');
      dragHandle.innerHTML = '<i class="app-icon" data-lucide="grip-vertical"></i>';
      title.insertBefore(dragHandle, title.firstChild);
    }

    dragHandle?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Configure draggable attribute on header according to current layout mode
    const isStack = this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel');
    const inSidebar = dialog.closest('.stackpanel-sidebar') !== null;
    if (header) {
      if (isStack && inSidebar) {
        header.setAttribute('draggable', 'true');
      } else {
        header.removeAttribute('draggable');
      }
    }

    btnHelp?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showToolHelp(dialog.id);
    });

    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDialog(dialog.id, false);
    });

    btnMin?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDialogMinimize(dialog);
    });

    title?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.justFinishedStackpanelDrag) return;
      this.toggleDialogMinimize(dialog);
    });

    // In stackpanel mode, clicking anywhere in header (except buttons and drag handle) toggles collapse
    if (header) {
      header.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'BUTTON' ||
          target.closest('button') ||
          target.closest('.dialog-btn') ||
          target.closest('.dialog-drag-handle')
        ) {
          return;
        }
        if (this.justFinishedStackpanelDrag) return;
        if (this.layoutMode === 'stackpanel') {
          this.toggleDialogMinimize(dialog);
        }
      });
    }

    // Bring to front
    dialog.addEventListener('mousedown', () => {
      this.bringDialogToFront(dialog);
    });

    // Stackpanel Drag & Drop Reordering
    if (header) {
      header.addEventListener('dragstart', (e: DragEvent) => {
        const isCurrentStack =
          this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel');
        const inSide = dialog.closest('.stackpanel-sidebar') !== null;
        if (!isCurrentStack || !inSide) {
          e.preventDefault();
          return;
        }

        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('.dialog-btn')) {
          e.preventDefault();
          return;
        }

        this.currentDraggedStackpanelDialog = dialog;
        this.justFinishedStackpanelDrag = true;
        dialog.classList.add('is-dragging');

        // Ensure file drop overlay is hidden and never triggered for internal tool dragging
        const dropOverlay = document.getElementById('dropOverlay') || document.getElementById('drop-zone');
        if (dropOverlay) dropOverlay.classList.remove('active');

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', dialog.id);
        }
      });

      header.addEventListener('dragend', () => {
        this.currentDraggedStackpanelDialog = null;
        dialog.classList.remove('is-dragging');
        this.clearStackpanelDragIndicators();
        const dropOverlay = document.getElementById('dropOverlay') || document.getElementById('drop-zone');
        if (dropOverlay) dropOverlay.classList.remove('active');
        setTimeout(() => {
          this.justFinishedStackpanelDrag = false;
        }, 200);
      });
    }

    // Floating Mode 2D Window Dragging
    if (header) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      header.addEventListener('mousedown', (e: MouseEvent) => {
        if (this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel')) return;
        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('.dialog-btn')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = dialog.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Bring to front
        this.bringDialogToFront(dialog);

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isDragging) return;
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;

          let newLeft = Math.max(0, Math.min(window.innerWidth - dialog.offsetWidth, initialLeft + deltaX));
          let newTop = Math.max(54, Math.min(window.innerHeight - 36, initialTop + deltaY));

          dialog.style.left = `${newLeft}px`;
          dialog.style.top = `${newTop}px`;
          dialog.style.right = 'auto';
          dialog.style.bottom = 'auto';
          dialog.style.transform = 'none';
        };

        const onMouseUp = () => {
          if (isDragging) {
            isDragging = false;
            this.saveDialogLayout();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  /**
   * Clears drag position indicators from all dialogs in the stackpanel sidebar.
   */
  public clearStackpanelDragIndicators(): void {
    const container = this.getElement('stackpanelRightSidebar') || document.getElementById('stackpanelRightSidebar');
    if (!container) return;
    const dialogs = container.querySelectorAll('.floating-dialog');
    dialogs.forEach((d) => d.classList.remove('drag-target-above', 'drag-target-below'));
  }

  /**
   * Initializes drag & drop reordering handlers on the stackpanel container.
   */
  public initStackpanelDragAndDrop(): void {
    const container = this.getElement('stackpanelRightSidebar') || document.getElementById('stackpanelRightSidebar');
    if (!container) return;

    container.addEventListener('dragover', (e: DragEvent) => {
      const isStack = this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel');
      if (!isStack || !this.currentDraggedStackpanelDialog) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const targetDialog = (e.target as HTMLElement).closest('.stackpanel-sidebar .floating-dialog') as HTMLElement | null;
      if (targetDialog && targetDialog !== this.currentDraggedStackpanelDialog) {
        const rect = targetDialog.getBoundingClientRect();
        const isAfter = e.clientY - rect.top > rect.height / 2;
        this.clearStackpanelDragIndicators();
        if (isAfter) {
          targetDialog.classList.add('drag-target-below');
        } else {
          targetDialog.classList.add('drag-target-above');
        }
      } else {
        this.clearStackpanelDragIndicators();
      }
    });

    container.addEventListener('dragenter', (e: DragEvent) => {
      e.stopPropagation();
    });

    container.addEventListener('dragleave', (e: DragEvent) => {
      e.stopPropagation();
      if (!e.relatedTarget || !container.contains(e.relatedTarget as any)) {
        this.clearStackpanelDragIndicators();
      }
    });

    container.addEventListener('drop', (e: DragEvent) => {
      const isStack = this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel');
      if (!isStack) return;

      e.preventDefault();
      e.stopPropagation();
      this.clearStackpanelDragIndicators();

      const draggedId = e.dataTransfer?.getData('text/plain');
      const draggedEl =
        this.currentDraggedStackpanelDialog ||
        (draggedId ? container.querySelector<HTMLElement>(`#${draggedId}`) : null);

      if (!draggedEl) return;

      const targetDialog = (e.target as HTMLElement).closest('.stackpanel-sidebar .floating-dialog') as HTMLElement | null;
      if (targetDialog && targetDialog !== draggedEl) {
        const rect = targetDialog.getBoundingClientRect();
        const isAfter = e.clientY - rect.top > rect.height / 2;
        if (isAfter) {
          container.insertBefore(draggedEl, targetDialog.nextSibling);
        } else {
          container.insertBefore(draggedEl, targetDialog);
        }
      } else if (!targetDialog) {
        container.appendChild(draggedEl);
      }

      this.currentDraggedStackpanelDialog = null;
      this.updateStackpanelOrderFromDOM();
      this.justFinishedStackpanelDrag = true;
      setTimeout(() => {
        this.justFinishedStackpanelDrag = false;
      }, 200);
    });
  }

  /**
   * Updates CSS flex order and ToolInterface.order for each tool in the stackpanel sidebar,
   * synchronizes the Tools dropdown menu, and persists the new order to localStorage.
   */
  public updateStackpanelOrderFromDOM(): void {
    const container = this.getElement('stackpanelRightSidebar') || document.getElementById('stackpanelRightSidebar');
    if (!container) return;

    const dialogs = Array.from(container.querySelectorAll(':scope > .floating-dialog')) as HTMLElement[];
    dialogs.forEach((dialog, index) => {
      dialog.style.order = String(index);
      const tool = this.getToolByDialogId(dialog.id);
      if (tool) {
        (tool as any).order = index + 2; // Offset 2 so Outliner remains #1
      }
    });

    this.saveStackpanelOrder();
    this.renderToolsMenu();
  }

  /**
   * Persists the current stackpanel tool order to localStorage.
   */
  public saveStackpanelOrder(): void {
    const container = this.getElement('stackpanelRightSidebar') || document.getElementById('stackpanelRightSidebar');
    if (!container) return;

    try {
      const dialogs = Array.from(container.querySelectorAll(':scope > .floating-dialog')) as HTMLElement[];
      const orderList = dialogs.map((d) => d.id).filter(Boolean);
      localStorage.setItem('mesheditor_stackpanel_order', JSON.stringify(orderList));
    } catch (e) {
      console.warn('Failed to save stackpanel order to localStorage:', e);
    }
  }

  /**
   * Restores the persisted tool order in the stackpanel sidebar from localStorage,
   * or sorts sidebar dialog elements by default tool.order if no order is saved.
   */
  public restoreStackpanelOrder(): void {
    const container = this.getElement('stackpanelRightSidebar') || document.getElementById('stackpanelRightSidebar');
    if (!container) return;

    try {
      const saved = localStorage.getItem('mesheditor_stackpanel_order');
      if (saved) {
        const orderList: string[] = JSON.parse(saved);
        if (Array.isArray(orderList) && orderList.length > 0) {
          const dialogs = Array.from(container.querySelectorAll(':scope > .floating-dialog')) as HTMLElement[];
          const dialogMap = new Map<string, HTMLElement>();
          for (const d of dialogs) {
            if (d.id) dialogMap.set(d.id, d);
          }

          let orderIndex = 0;
          for (const id of orderList) {
            const dialog = dialogMap.get(id);
            if (dialog) {
              container.appendChild(dialog);
              dialog.style.order = String(orderIndex);
              const tool = this.getToolByDialogId(id);
              if (tool) {
                (tool as any).order = orderIndex + 2;
              }
              dialogMap.delete(id);
              orderIndex++;
            }
          }

          for (const [, dialog] of dialogMap) {
            container.appendChild(dialog);
            dialog.style.order = String(orderIndex);
            const tool = this.getToolByDialogId(dialog.id);
            if (tool) {
              (tool as any).order = orderIndex + 2;
            }
            orderIndex++;
          }

          this.renderToolsMenu();
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to restore stackpanel order from localStorage:', e);
    }

    // If no order is saved in localStorage, sort container children by initial tool.order
    const dialogs = Array.from(container.querySelectorAll(':scope > .floating-dialog')) as HTMLElement[];
    dialogs.sort((a, b) => {
      const toolA = this.getToolByDialogId(a.id);
      const toolB = this.getToolByDialogId(b.id);
      const orderA = toolA?.order ?? 999;
      const orderB = toolB?.order ?? 999;
      return orderA - orderB;
    });
    dialogs.forEach((dialog, index) => {
      container.appendChild(dialog);
      dialog.style.order = String(index);
    });
  }

  /**
   * Opens the main in-app help modal.
   */
  public openHelpModal(): void {
    const helpModal = this.getElement('helpModal') || document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.add('active');
    }
  }

  /**
   * Closes the main in-app help modal and refocuses the canvas.
   */
  public closeHelpModal(): void {
    const helpModal = this.getElement('helpModal') || document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.remove('active');
      this.canvas?.focus();
    }
  }

  /**
   * Opens the rich guide and help popup for any tool or floating dialog.
   */
  public showToolHelp(toolOrId: string | ToolInterface): void {
    const tool =
      typeof toolOrId === 'string'
        ? this.getToolByDialogId(toolOrId) || this.getToolByName(toolOrId)
        : toolOrId;
    if (!tool) return;

    let modal = this.getElement('toolHelpModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'toolHelpModal';
      modal.innerHTML = `
        <div class="tool-help-dialog" role="dialog" aria-modal="true" aria-labelledby="toolHelpTitle">
          <div class="tool-help-header">
            <div class="tool-help-title-group">
              <span class="tool-help-icon" id="toolHelpIcon"><i class="app-icon" data-lucide="help-circle"></i></span>
              <div class="tool-help-title-col">
                <div class="tool-help-title-row">
                  <h3 class="tool-help-title" id="toolHelpTitle">Tool Guide</h3>
                  <span class="tool-help-badge" id="toolHelpBadge">3D Tool</span>
                </div>
                <div class="tool-help-desc" id="toolHelpDesc">Tool overview and capabilities guide.</div>
              </div>
            </div>
            <button class="dialog-btn btn-close" id="btnCloseToolHelp" title="Close Guide"><i class="app-icon" data-lucide="x"></i></button>
          </div>
          <div class="tool-help-body" id="toolHelpBody"></div>
          <div class="tool-help-footer">
            <button class="tool-btn btn-primary" id="btnDoneToolHelp">Got it!</button>
          </div>
        </div>
      `;
      (this.rootContainer || document.body).appendChild(modal);
      this.getElement('btnCloseToolHelp')?.addEventListener('click', () => {
        modal!.classList.remove('active');
        modal!.style.display = 'none';
      });
      this.getElement('btnDoneToolHelp')?.addEventListener('click', () => {
        modal!.classList.remove('active');
        modal!.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal!.classList.remove('active');
          modal!.style.display = 'none';
        }
      });
    }

    const titleEl = modal.querySelector('#toolHelpTitle') || this.getElement('toolHelpTitle');
    const descEl = modal.querySelector('#toolHelpDesc') || this.getElement('toolHelpDesc');
    const iconEl = modal.querySelector('#toolHelpIcon') || this.getElement('toolHelpIcon');
    const bodyEl = modal.querySelector('#toolHelpBody') || this.getElement('toolHelpBody');
    const badgeEl = modal.querySelector('#toolHelpBadge') || this.getElement('toolHelpBadge');

    if (titleEl) titleEl.textContent = tool.menuLabel || tool.name;
    if (descEl) descEl.textContent = tool.description || '';
    if (badgeEl) badgeEl.textContent = tool.isExclusive3DTool ? 'Interactive 3D Tool' : 'Editor Tool';
    if (iconEl) {
      iconEl.innerHTML = `<i class="app-icon" data-lucide="${tool.icon || 'help-circle'}"></i>`;
    }
    if (bodyEl) {
      bodyEl.innerHTML = tool.helpText || `<p>${tool.description}</p>`;
    }

    this.refreshIcons();
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  public toggleDialogMinimize(dialog: HTMLElement, forceState?: boolean): void {
    const isCurrentlyMin = dialog.classList.contains('minimized');
    const willBeMin = forceState !== undefined ? forceState : !isCurrentlyMin;
    const tool = this.getToolByDialogId(dialog.id);

    if (willBeMin) {
      dialog.classList.add('minimized');
      dialog.classList.remove('active-focus');
      if (dialog.id === 'dialog-outliner') {
        dialog.style.bottom = 'auto';
        dialog.style.height = 'auto';
      }
      tool?.onMinimize?.(this);
    } else {
      dialog.classList.remove('minimized');
      if (dialog.id === 'dialog-outliner') {
        dialog.style.bottom = '';
        dialog.style.height = '';
      }
      if (this.layoutMode === 'stackpanel') {
        this.accordionMinimizeOthers(dialog);
      }
      tool?.onMaximize?.(this);
    }

    const btnMin = dialog.querySelector('.btn-min') as HTMLElement | null;
    if (btnMin) {
      btnMin.innerHTML = `<i class="app-icon" data-lucide="${willBeMin ? 'plus' : 'minus'}"></i>`;
      btnMin.title = willBeMin ? 'Expand' : 'Minimize';
      btnMin.blur();
    }
    this.refreshIcons();
    this.updatePanelButtonStates();
    this.saveDialogLayout();
  }

  private accordionMinimizeOthers(activeDialog: HTMLElement): void {
    const isSidebarPanel = activeDialog.closest('.stackpanel-sidebar') !== null;
    for (const id of this.dialogIds) {
      const other = this.getElement(id);
      if (!other || other === activeDialog || other.style.display === 'none') continue;

      if (isSidebarPanel && other.closest('.stackpanel-sidebar') !== null) {
        if (!other.classList.contains('minimized')) {
          other.classList.add('minimized');
          other.classList.remove('active-focus');
          const btnMin = other.querySelector('.btn-min') as HTMLElement | null;
          if (btnMin) {
            btnMin.innerHTML = '<i class="app-icon" data-lucide="plus"></i>';
            btnMin.title = 'Expand';
            btnMin.blur();
          }
          const otherTool = this.getToolByDialogId(id);
          otherTool?.onMinimize?.(this);
        }
      }
    }
    this.refreshIcons();
    this.saveDialogLayout();
  }

  public toggleDialog(id: string, forceOpen?: boolean): void {
    let dialog = this.getElement(id);
    if (!dialog) {
      const tool = this.getToolByDialogId(id);
      if (tool?.renderView) {
        const container = this.getElement<HTMLElement>('stackpanelRightSidebar') || undefined;
        dialog = tool.renderView(container);
        if (dialog) {
          this.setupFloatingDialog(dialog);
          if (id === 'dialog-compress-model') {
            this.initCompressModelUI();
          }
          this.initSculptUI();
          this.initCSGBevelUI();
          this.initUVUnwrapUI();
          this.initBakingUI();
          this.initRiggingUI();
          this.initAITextureUI();
          this.initTextMeshUI();
          this.initDecalUI();
          this.refreshIcons();
        }
      }
    }
    if (!dialog) return;

    const isCurrentlyOpen =
      dialog.style.display !== 'none' && (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none');
    const willOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;
    dialog.style.display = willOpen ? 'flex' : 'none';

    const tool = this.getToolByDialogId(id);

    if (willOpen) {
      this.bringDialogToFront(dialog);
      dialog.classList.remove('minimized');
      const btnMin = dialog.querySelector('.btn-min') as HTMLElement | null;
      if (btnMin) {
        btnMin.innerHTML = '<i class="app-icon" data-lucide="minus"></i>';
        btnMin.title = 'Minimize';
      }
      if (this.layoutMode === 'stackpanel') {
        this.accordionMinimizeOthers(dialog);
      }

      // When opening an exclusive 3D tool, deactivate other exclusive 3D tools without closing their dialogs
      if (tool?.isExclusive3DTool) {
        for (const other of this.editorTools) {
          if (other !== tool && other.isExclusive3DTool) {
            other.onDeactivate?.(this);
          }
        }
      }
      tool?.onOpen?.(this);
    } else {
      tool?.onClose?.(this);
    }

    this.refreshIcons();
    this.updatePanelButtonStates();
    this.saveDialogLayout();
  }

  /* =========================================================================
     EXPORT MODAL DIALOG
     ========================================================================= */
  private initExportDialog(): void {
    const modal = this.getElement('exportModal');
    if (!modal) return;

    const btnClose = this.getElement('btnCloseExport');
    const btnCancel = this.getElement('btnCancelExport');
    const btnConfirm = this.getElement('btnConfirmExport');
    const filenameInput = this.getElement<HTMLInputElement>('exportFilenameInput');
    const selectedOnlyCheckbox = this.getElement<HTMLInputElement>('exportSelectedOnlyCheckbox');
    const formatCards = modal.querySelectorAll<HTMLElement>('.export-format-option');

    btnClose?.addEventListener('click', () => this.closeExportDialog());
    btnCancel?.addEventListener('click', () => this.closeExportDialog());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeExportDialog();
      }
    });

    formatCards.forEach((card) => {
      card.addEventListener('click', () => {
        const format = card.getAttribute('data-format') as ExportOptions['format'] | null;
        if (!format) return;

        formatCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');

        const radio = card.querySelector<HTMLInputElement>('input[type="radio"]');
        if (radio) radio.checked = true;

        this.service.exportParams.format = format;
        const badge = this.getElement('exportExtensionBadge');
        if (badge) badge.textContent = '.' + format;
      });
    });

    selectedOnlyCheckbox?.addEventListener('change', () => {
      this.service.exportParams.selectedOnly = selectedOnlyCheckbox.checked;
      this.updateExportScopeDetails();
    });

    btnConfirm?.addEventListener('click', () => {
      this.confirmExport();
    });

    filenameInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmExport();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeExportDialog();
      }
    });
  }

  public openExportDialog(): void {
    const modal = this.getElement('exportModal');
    if (!modal) return;

    const filenameInput = this.getElement<HTMLInputElement>('exportFilenameInput');
    if (filenameInput) {
      filenameInput.value = (this.service.exportParams.filename || 'model_edited').trim();
    }

    const currentFormat = (this.service.exportParams.format || 'glb').toLowerCase();
    const formatCards = modal.querySelectorAll<HTMLElement>('.export-format-option');
    formatCards.forEach((card) => {
      const format = card.getAttribute('data-format');
      const isSelected = format === currentFormat;
      card.classList.toggle('active', isSelected);
      const radio = card.querySelector<HTMLInputElement>('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    const badge = this.getElement('exportExtensionBadge');
    if (badge) {
      badge.textContent = '.' + currentFormat;
    }

    const selectedOnlyCheckbox = this.getElement<HTMLInputElement>('exportSelectedOnlyCheckbox');
    if (selectedOnlyCheckbox) {
      selectedOnlyCheckbox.checked = !!this.service.exportParams.selectedOnly;
    }

    this.updateExportScopeDetails();

    modal.classList.add('active');
    this.refreshIcons();

    setTimeout(() => {
      if (filenameInput) {
        filenameInput.focus();
        filenameInput.select();
      }
    }, 50);
  }

  public closeExportDialog(): void {
    const modal = this.getElement('exportModal');
    modal?.classList.remove('active');
    try {
      this.canvas?.focus();
    } catch {
      // Ignore
    }
  }

  public updateExportScopeDetails(): void {
    const selectedOnlyCheckbox = this.getElement<HTMLInputElement>('exportSelectedOnlyCheckbox');
    const details = this.getElement('exportSelectionDetails');
    if (!details) return;

    const selectedCount = this.service.selectedNodes.length;
    const totalMeshes = this.service.importedMeshes.length;

    if (selectedOnlyCheckbox?.checked) {
      if (selectedCount > 0) {
        details.textContent = `${selectedCount} selected mesh${selectedCount === 1 ? '' : 'es'} will be exported.`;
        details.className = 'export-selection-details';
      } else {
        details.textContent = 'Warning: No meshes are currently selected.';
        details.className = 'export-selection-details warning';
      }
    } else {
      details.textContent = `All scene meshes will be exported (${totalMeshes} mesh${totalMeshes === 1 ? '' : 'es'} in scene).`;
      details.className = 'export-selection-details';
    }
  }

  public async confirmExport(): Promise<void> {
    const filenameInput = this.getElement<HTMLInputElement>('exportFilenameInput');
    const rawFilename = (filenameInput?.value || '').trim();
    const filename = rawFilename || this.service.exportParams.filename || 'model_edited';

    const modal = this.getElement('exportModal');
    const activeCard = modal?.querySelector<HTMLElement>('.export-format-option.active');
    const format = (activeCard?.getAttribute('data-format') || this.service.exportParams.format || 'glb') as ExportOptions['format'];

    const selectedOnlyCheckbox = this.getElement<HTMLInputElement>('exportSelectedOnlyCheckbox');
    const selectedOnly = !!selectedOnlyCheckbox?.checked;

    if (selectedOnly && this.service.selectedNodes.length === 0) {
      this.showToast('Please select at least one mesh or uncheck "Export selected objects only".', 'warning');
      return;
    }

    this.service.exportParams.filename = filename;
    this.service.exportParams.format = format;
    this.service.exportParams.selectedOnly = selectedOnly;

    this.closeExportDialog();
    await this.service.exportCurrentModel({ filename, format, selectedOnly });
  }

  private initFacetToolUI(): void {
    const btnPickToggle = this.getElement<HTMLButtonElement>('btnFacetPickToggle');
    const lblPickState = this.getElement<HTMLElement>('lblFacetPickState');
    const badge = this.getElement<HTMLElement>('facetSelectedBadge');
    const btnModeFace = this.getElement<HTMLButtonElement>('btnFacetModeFace');
    const btnModeVertex = this.getElement<HTMLButtonElement>('btnFacetModeVertex');
    const coordsStrip = this.getElement<HTMLElement>('facetVertexCoordsStrip');
    const inputX = this.getElement<HTMLInputElement>('facetVertexX');
    const inputY = this.getElement<HTMLInputElement>('facetVertexY');
    const inputZ = this.getElement<HTMLInputElement>('facetVertexZ');

    const updatePickUI = () => {
      const active = this.service.facetEditorActive;
      btnPickToggle?.classList.toggle('active', active);
      if (lblPickState) lblPickState.textContent = active ? 'Pick: ON' : 'Pick: OFF';
    };

    const updateModeUI = (mode: 'face' | 'vertex') => {
      btnModeFace?.classList.toggle('active', mode === 'face');
      btnModeVertex?.classList.toggle('active', mode === 'vertex');
      if (mode === 'vertex') {
        if (coordsStrip && this.service.selectedVertexIndex !== null) {
          coordsStrip.style.display = 'flex';
        }
      } else {
        if (coordsStrip) coordsStrip.style.display = 'none';
      }
    };

    btnModeFace?.addEventListener('click', () => {
      this.service.setFacetEditMode('face');
      updateModeUI('face');
    });

    btnModeVertex?.addEventListener('click', () => {
      this.service.setFacetEditMode('vertex');
      updateModeUI('vertex');
    });

    btnPickToggle?.addEventListener('click', () => {
      this.service.toggleFacetEditor();
      updatePickUI();
      this.updatePanelButtonStates();
    });

    this.service.events.onFacetEditorStateChanged = (active: boolean) => {
      updatePickUI();
      this.updatePanelButtonStates();
    };

    this.service.events.onFacetEditModeChanged = (mode: 'face' | 'vertex') => {
      updateModeUI(mode);
    };

    this.service.events.onFaceSelected = (faceId: number | null, isQuad?: boolean) => {
      if (!badge) return;
      if (faceId !== null) {
        badge.textContent = isQuad ? `Quad #${faceId} selected` : `Face #${faceId} selected`;
        badge.classList.add('active');
      } else {
        badge.textContent = this.service.facetEditMode === 'vertex' ? 'No vertex picked' : 'No face picked';
        badge.classList.remove('active');
      }
    };

    this.service.events.onVertexSelected = (vertexIndex: number | null, pos?: Vector3) => {
      if (vertexIndex !== null && pos) {
        if (badge) {
          badge.textContent = `Vertex #${vertexIndex} selected`;
          badge.classList.add('active');
        }
        if (coordsStrip) coordsStrip.style.display = 'flex';
        if (inputX && document.activeElement !== inputX) inputX.value = pos.x.toFixed(2);
        if (inputY && document.activeElement !== inputY) inputY.value = pos.y.toFixed(2);
        if (inputZ && document.activeElement !== inputZ) inputZ.value = pos.z.toFixed(2);
      } else {
        if (coordsStrip) coordsStrip.style.display = 'none';
        if (this.service.facetEditMode === 'vertex' && badge) {
          badge.textContent = 'No vertex picked';
          badge.classList.remove('active');
        }
      }
    };

    const applyVertexCoords = () => {
      if (this.service.selectedVertexIndex === null) return;
      const x = parseFloat(inputX?.value || '0');
      const y = parseFloat(inputY?.value || '0');
      const z = parseFloat(inputZ?.value || '0');
      this.service.setVertexPosition(x, y, z);
    };
    inputX?.addEventListener('change', applyVertexCoords);
    inputY?.addEventListener('change', applyVertexCoords);
    inputZ?.addEventListener('change', applyVertexCoords);

    // Initial sync
    updatePickUI();
    updateModeUI(this.service.facetEditMode);

    const inputDist = this.getElement<HTMLInputElement>('facetInputDistance');
    inputDist?.addEventListener('input', () => {
      this.facetParams.extrudeDist = parseFloat(inputDist.value) || 0.5;
    });

    const inputInset = this.getElement<HTMLInputElement>('facetInputInset');
    inputInset?.addEventListener('input', () => {
      this.facetParams.insetAmount = parseFloat(inputInset.value) || 0.25;
    });

    const inputThickness = this.getElement<HTMLInputElement>('facetInputThickness');
    inputThickness?.addEventListener('input', () => {
      this.facetParams.thickness = parseFloat(inputThickness.value) || 0.2;
    });

    const inputSegments = this.getElement<HTMLInputElement>('facetInputSegments');
    inputSegments?.addEventListener('input', () => {
      this.facetParams.segments = parseInt(inputSegments.value, 10) || 4;
    });

    this.getElement('btnFacetExtrude')?.addEventListener('click', () => this.facetParams.extrudeNow());
    this.getElement('btnFacetInset')?.addEventListener('click', () => this.facetParams.insetNow());
    this.getElement('btnFacetArc')?.addEventListener('click', () => this.facetParams.arcNow());
    this.getElement('btnFacetKnife')?.addEventListener('click', () => this.facetParams.knifeNow());
    this.getElement('btnFacetLoopCut')?.addEventListener('click', () => this.facetParams.loopCutNow());
    this.getElement('btnFacetBevel')?.addEventListener('click', () => this.facetParams.bevelNow());
    this.getElement('btnFacetSolidify')?.addEventListener('click', () => this.facetParams.solidifyNow());
    this.getElement('btnFacetArray')?.addEventListener('click', () => this.facetParams.arrayNow());
    this.getElement('btnFacetCutThrough')?.addEventListener('click', () => this.facetParams.cutThroughNow());
    this.getElement('btnFacetRelax')?.addEventListener('click', () => this.facetParams.relaxNow());
    this.getElement('btnFacetSubdivide')?.addEventListener('click', () => this.facetParams.subdivideNow());
    this.getElement('btnFacetSubD')?.addEventListener('click', () => this.facetParams.subDNow());
    this.getElement('btnFacetFlipNormal')?.addEventListener('click', () => this.facetParams.flipNormal());
    this.getElement('btnFacetDelete')?.addEventListener('click', () => this.facetParams.deleteFacet());
  }

  private saveDialogLayout(): void {
    try {
      const layout: Record<string, { left: string; top: string; display: string; open: boolean; minimized: boolean }> = {};
      for (const id of this.dialogIds) {
        const dialog = this.getElement(id);
        if (dialog) {
          const isOpen =
            dialog.style.display !== 'none' && (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none');
          layout[id] = {
            left: dialog.style.left,
            top: dialog.style.top,
            display: isOpen ? 'flex' : 'none',
            open: isOpen,
            minimized: dialog.classList.contains('minimized'),
          };
        }
      }
      localStorage.setItem('mesheditor_window_layout', JSON.stringify(layout));
    } catch (e) {
      console.warn('Failed to save dialog layout:', e);
    }
  }

  private restoreDialogLayout(): void {
    try {
      const saved = localStorage.getItem('mesheditor_window_layout');
      if (!saved) {
        // First time execution: activate default tools & panels (keep specialized studio tools closed until toggled)
        for (const tool of this.editorTools) {
          if (!tool.dialogId) continue;
          const dialog = this.getElement(tool.dialogId);
          if (dialog) {
            dialog.style.display = tool.defaultOpen ? 'flex' : 'none';
            if (tool.defaultOpen) {
              dialog.classList.remove('minimized');
            }
          }
          if (!tool.defaultOpen) {
            tool.onClose?.(this);
          }
        }
        this.updatePanelButtonStates();
        this.saveDialogLayout();
        return;
      }

      const layout = JSON.parse(saved);

      for (const id of this.dialogIds) {
        const dialog = this.getElement(id);
        const state = layout[id];
        if (!dialog || !state) continue;

        // Restore position
        const leftVal = state.left || (typeof state.x === 'number' && state.x > 0 ? `${state.x}px` : null);
        const topVal = state.top || (typeof state.y === 'number' && state.y > 0 ? `${state.y}px` : null);

        if (leftVal) {
          dialog.style.left = leftVal;
          dialog.style.right = 'auto';
          dialog.style.transform = 'none';
        }
        if (topVal) {
          dialog.style.top = topVal;
          dialog.style.bottom = 'auto';
          dialog.style.transform = 'none';
        }

        // Restore visibility (support old display: string and new open: boolean)
        let isOpen = true;
        if (state.display !== undefined) {
          isOpen = state.display !== 'none';
        } else if (state.open !== undefined) {
          isOpen = !!state.open;
        }

        dialog.style.display = isOpen ? 'flex' : 'none';

        // Restore minimized state
        const isMin = !!state.minimized;
        dialog.classList.toggle('minimized', isMin);
        if (id === 'dialog-outliner') {
          if (isMin) {
            dialog.style.bottom = 'auto';
            dialog.style.height = 'auto';
          } else {
            dialog.style.bottom = '';
            dialog.style.height = '';
          }
        }
        const btnMin = dialog.querySelector('.btn-min') as HTMLElement | null;
        if (btnMin) {
          btnMin.innerHTML = `<i class="app-icon" data-lucide="${isMin ? 'plus' : 'minus'}"></i>`;
          btnMin.title = isMin ? 'Expand' : 'Minimize';
        }
      }

      // Safeguard: If every default panel is closed, activate standard panels
      const defaultPanelIds = this.editorTools
        .filter((t) => t.defaultOpen && t.dialogId)
        .map((t) => t.dialogId!);
      const anyOpen = defaultPanelIds.some((id) => {
        const d = this.getElement(id);
        return d && d.style.display !== 'none';
      });
      if (!anyOpen) {
        for (const id of defaultPanelIds) {
          const d = this.getElement(id);
          if (d) d.style.display = 'flex';
        }
      }

      // Synchronize tool lifecycle state from open dialogs
      for (const tool of this.editorTools) {
        if (!tool.dialogId) continue;
        const d = this.getElement(tool.dialogId);
        const isOpenAndActive = !!(d && d.style.display !== 'none' && !d.classList.contains('minimized'));
        if (isOpenAndActive) {
          tool.onOpen?.(this);
        } else {
          tool.onClose?.(this);
        }
      }

      this.updatePanelButtonStates();
      this.refreshIcons();
    } catch (e) {
      console.warn('Failed to restore dialog layout:', e);
    }
  }

  /**
   * Dynamically renders the Tools dropdown menu (#menuTools) from registered ToolInterface instances.
   */
  public renderToolsMenu(): void {
    const menu = this.getElement('menuTools') || document.getElementById('menuTools');
    if (!menu) return;

    const divider = menu.querySelector('#menuToolsPluginsDivider') || document.getElementById('menuToolsPluginsDivider');
    const pluginsContainer = menu.querySelector('#menuToolsPlugins') || document.getElementById('menuToolsPlugins');

    // Remove any previously rendered dynamic items
    const existingItems = menu.querySelectorAll('.dropdown-item[data-tool-name]');
    existingItems.forEach((el) => el.remove());

    // Sort tools by their `order` property
    const tools = [...this.editorTools].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    for (const tool of tools) {
      if (tool.menuId && tool.menuId !== 'menuTools') continue;
      if (!tool.triggerButtonId || !tool.menuLabel) continue;

      const btn = document.createElement('button');
      btn.className = 'dropdown-item';
      btn.id = tool.triggerButtonId;
      btn.setAttribute('data-tool-name', tool.name);
      btn.title = tool.description || tool.menuLabel;

      const iconName = tool.icon || 'wrench';
      btn.innerHTML = `
        <span class="btn-icon"><i class="app-icon" data-lucide="${iconName}"></i></span>
        <span class="btn-label">${tool.menuLabel}</span>
      `.trim();

      btn.addEventListener('click', () => {
        this.closeAllDropdowns();
        if (tool.dialogId) {
          this.toggleDialog(tool.dialogId);
          if (tool.dialogId === 'dialog-csg') {
            this.updateCSGGUI();
          }
        }
      });

      if (divider) {
        menu.insertBefore(btn, divider);
      } else if (pluginsContainer) {
        menu.insertBefore(btn, pluginsContainer);
      } else {
        menu.appendChild(btn);
      }
    }

    this.refreshIcons();
    this.updatePanelButtonStates();
  }

  /**
   * Registers a new editor tool dynamically and updates the Tools menu.
   */
  public registerEditorTool(tool: ToolInterface): void {
    const existingIdx = this.editorTools.findIndex((t) => t.name === tool.name);
    if (existingIdx !== -1) {
      this.editorTools[existingIdx] = tool;
    } else {
      this.editorTools.push(tool);
    }
    this.renderToolsMenu();
  }

  public updatePanelButtonStates(): void {
    for (const tool of this.editorTools) {
      if (tool.dialogId && tool.triggerButtonId) {
        const dialog = this.getElement(tool.dialogId);
        const btn = this.getElement(tool.triggerButtonId) || document.getElementById(tool.triggerButtonId);
        if (dialog && btn) {
          const isOpen =
            dialog.style.display !== 'none' &&
            (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none');
          btn.classList.toggle('active', isOpen);
        }
      }
    }

    // Also update Ground Grid button state
    const btnGrid = this.getElement('btnToggleGrid');
    if (btnGrid) {
      btnGrid.classList.toggle('active', !!this.service.sceneParams?.grid);
    }
  }

  /* =========================================================================
     DAT.GUI PANELS INITIALIZATION
     ========================================================================= */
  private initGUI(): void {
    // 1. Scene GUI
    const containerScene = document.getElementById('gui-scene-container') || document.getElementById('gui-container-scene');
    this.guiScene = new dat.GUI({ autoPlace: false, width: 280 });
    containerScene?.appendChild(this.guiScene.domElement);

    this.guiScene
      .addColor(this.service.sceneParams, 'clearColor')
      .name('Background')
      .onChange((v) => this.service.setClearColor(v));
    this.guiScene
      .add(this.service.sceneParams, 'grid')
      .name('Grid visible')
      .onChange((v) => this.service.setGridVisible(v));
    this.guiScene
      .add(this.service.sceneParams, 'gridSize', 5, 200, 5)
      .name('Grid size')
      .onChange((v) => this.service.setGridSize(v));
    this.guiScene
      .add(this.service.sceneParams, 'ambientLight', 0.1, 3.0, 0.1)
      .name('Ambient Light')
      .onChange((v) => this.service.setAmbientIntensity(v));
    this.guiScene
      .add(this.service.sceneParams, 'sunLight', 0.1, 4.0, 0.1)
      .name('Sun Light')
      .onChange((v) => this.service.setSunIntensity(v));
    this.guiScene
      .add(this.service.sceneParams, 'cameraSpeed', 0.1, 2.0, 0.05)
      .name('Camera Speed')
      .onChange((v) => this.service.setCameraSpeed(v));
    this.guiScene
      .add(this.service.sceneParams, 'translateSnap', 0.01, 50.0, 0.05)
      .name('Move Snap')
      .onChange((v) => this.service.setTranslateSnap(v));
    this.guiScene
      .add(this.service.sceneParams, 'rotateSnap', 1, 90, 1)
      .name('Rotate Snap (°)')
      .onChange((v) => this.service.setRotateSnap(v));

    // 2. Mesh Properties GUI
    const containerMesh = document.getElementById('gui-mesh-container') || document.getElementById('gui-container-mesh');
    this.guiMesh = new dat.GUI({ autoPlace: false, width: 280 });
    containerMesh?.appendChild(this.guiMesh.domElement);

    this.meshControllers['name'] = this.guiMesh.add(this.meshParams, 'name').name('Name').listen();
    this.meshControllers['visible'] = this.guiMesh
      .add(this.meshParams, 'visible')
      .name('Visible')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.isVisible = v;
      });

    const fTransform = this.guiMesh.addFolder('Transform');
    this.meshControllers['posX'] = fTransform
      .add(this.meshParams, 'posX')
      .step(0.05)
      .name('Pos X')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.position.x = v;
      });
    this.meshControllers['posY'] = fTransform
      .add(this.meshParams, 'posY')
      .step(0.05)
      .name('Pos Y')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.position.y = v;
      });
    this.meshControllers['posZ'] = fTransform
      .add(this.meshParams, 'posZ')
      .step(0.05)
      .name('Pos Z')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.position.z = v;
      });

    this.meshControllers['rotX'] = fTransform
      .add(this.meshParams, 'rotX', -180, 180, 1)
      .name('Rot X°')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.setMeshRotationDegrees(this.service.selectedMesh, 'x', v);
      });
    this.meshControllers['rotY'] = fTransform
      .add(this.meshParams, 'rotY', -180, 180, 1)
      .name('Rot Y°')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.setMeshRotationDegrees(this.service.selectedMesh, 'y', v);
      });
    this.meshControllers['rotZ'] = fTransform
      .add(this.meshParams, 'rotZ', -180, 180, 1)
      .name('Rot Z°')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.setMeshRotationDegrees(this.service.selectedMesh, 'z', v);
      });

    this.meshControllers['scaleX'] = fTransform
      .add(this.meshParams, 'scaleX', 0.01, 20, 0.05)
      .name('Scale X')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.scaling.x = v;
      });
    this.meshControllers['scaleY'] = fTransform
      .add(this.meshParams, 'scaleY', 0.01, 20, 0.05)
      .name('Scale Y')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.scaling.y = v;
      });
    this.meshControllers['scaleZ'] = fTransform
      .add(this.meshParams, 'scaleZ', 0.01, 20, 0.05)
      .name('Scale Z')
      .onChange((v) => {
        if (this.service.selectedMesh) this.service.selectedMesh.scaling.z = v;
      });
    fTransform.open();

    const fActions = this.guiMesh.addFolder('Mesh Tools');
    fActions.add(this.meshParams, 'snapToGround').name('Snap to Ground');
    fActions.add(this.meshParams, 'centerOrigin').name('Center Pivot');
    fActions.add(this.meshParams, 'bakeTransform').name('Bake Transform');
    fActions.add(this.meshParams, 'separateLooseParts').name('Separate Loose Parts');
    fActions.add(this.meshParams, 'mergeMeshes').name('Merge Meshes');
    fActions.open();

    // 3. Material Properties GUI
    const containerMat = document.getElementById('gui-material-container') || document.getElementById('gui-container-material');
    this.guiMaterial = new dat.GUI({ autoPlace: false, width: 280 });
    containerMat?.appendChild(this.guiMaterial.domElement);

    this.materialControllers['materialName'] = this.guiMaterial.add(this.materialParams, 'materialName').name('Material').listen();
    this.materialControllers['albedoColor'] = this.guiMaterial
      .addColor(this.materialParams, 'albedoColor')
      .name('Color')
      .onChange((hex) => {
        const mat = this.service.getSelectedMaterial();
        if (mat instanceof PBRMaterial) mat.albedoColor = Color3.FromHexString(hex);
        else if (mat instanceof StandardMaterial) mat.diffuseColor = Color3.FromHexString(hex);
      });
    this.materialControllers['roughness'] = this.guiMaterial
      .add(this.materialParams, 'roughness', 0, 1, 0.05)
      .name('Roughness')
      .onChange((v) => {
        const mat = this.service.getSelectedMaterial();
        if (mat instanceof PBRMaterial) mat.roughness = v;
      });
    this.materialControllers['metallic'] = this.guiMaterial
      .add(this.materialParams, 'metallic', 0, 1, 0.05)
      .name('Metallic')
      .onChange((v) => {
        const mat = this.service.getSelectedMaterial();
        if (mat instanceof PBRMaterial) mat.metallic = v;
      });
    this.materialControllers['alpha'] = this.guiMaterial
      .add(this.materialParams, 'alpha', 0, 1, 0.05)
      .name('Opacity')
      .onChange((v) => {
        const mat = this.service.getSelectedMaterial();
        if (mat) mat.alpha = v;
      });
    this.materialControllers['wireframe'] = this.guiMaterial
      .add(this.materialParams, 'wireframe')
      .name('Wireframe')
      .onChange((v) => {
        const mat = this.service.getSelectedMaterial();
        if (mat) mat.wireframe = v;
      });
    this.materialControllers['textureAlpha'] = this.guiMaterial
      .add(this.materialParams, 'textureAlpha')
      .name('Texture Alpha')
      .onChange((v: boolean) => {
        this.service.setTextureAlpha(v);
      });
    this.materialControllers['transparencyMode'] = this.guiMaterial
      .add(this.materialParams, 'transparencyMode', [
        'Opaque',
        'Alpha Test (Cutout)',
        'Alpha Blend',
        'Alpha Test & Blend',
      ])
      .name('Transparency Mode')
      .onChange((modeStr: string) => {
        const map: Record<string, number> = {
          Opaque: 0,
          'Alpha Test (Cutout)': 1,
          'Alpha Blend': 2,
          'Alpha Test & Blend': 3,
        };
        this.service.setMaterialTransparencyMode(map[modeStr] ?? 3);
      });
    this.materialControllers['twoSided'] = this.guiMaterial
      .add(this.materialParams, 'twoSided')
      .name('Double Sided')
      .onChange((v: boolean) => {
        this.service.setMaterialTwoSided(v);
      });
    this.materialControllers['alphaCutOff'] = this.guiMaterial
      .add(this.materialParams, 'alphaCutOff', 0.0, 1.0, 0.05)
      .name('Alpha Cutoff')
      .onChange((v: number) => {
        this.service.setMaterialAlphaCutOff(v);
      });
    this.guiMaterial.add(this.materialParams, 'replaceTexture').name('Replace Texture...');
    this.guiMaterial.add(this.materialParams, 'newMaterial').name('New PBR Material');

    const fBump = this.guiMaterial.addFolder('Bump & Normal Map');
    this.materialControllers['bumpInfo'] = fBump.add(this.materialParams, 'bumpInfo').name('Map').listen();
    this.materialControllers['bumpLevel'] = fBump
      .add(this.materialParams, 'bumpLevel', 0, 5, 0.05)
      .name('Intensity')
      .onChange((v: number) => {
        this.service.setBumpLevel(v);
      });
    this.materialControllers['invertNormalMapX'] = fBump
      .add(this.materialParams, 'invertNormalMapX')
      .name('Invert X')
      .onChange((v: boolean) => {
        this.service.setInvertNormalMapX(v);
      });
    this.materialControllers['invertNormalMapY'] = fBump
      .add(this.materialParams, 'invertNormalMapY')
      .name('Invert Y (DirectX)')
      .onChange((v: boolean) => {
        this.service.setInvertNormalMapY(v);
      });
    this.materialControllers['useParallax'] = fBump
      .add(this.materialParams, 'useParallax')
      .name('Parallax Mapping')
      .onChange((v: boolean) => {
        this.service.setUseParallax(v);
      });
    this.materialControllers['useParallaxOcclusion'] = fBump
      .add(this.materialParams, 'useParallaxOcclusion')
      .name('Parallax Occlusion')
      .onChange((v: boolean) => {
        this.service.setUseParallaxOcclusion(v);
      });
    this.materialControllers['parallaxScaleBias'] = fBump
      .add(this.materialParams, 'parallaxScaleBias', 0, 0.2, 0.005)
      .name('Parallax Depth')
      .onChange((v: number) => {
        this.service.setParallaxScaleBias(v);
      });
    fBump.add(this.materialParams, 'loadBumpTexture').name('Load Normal Map...');
    fBump.add(this.materialParams, 'generateNormalFromDiffuse').name('Generate from Texture');
    fBump.add(this.materialParams, 'removeBumpTexture').name('Remove Normal Map');
    fBump.open();

    const fUV = this.guiMaterial.addFolder('UV Mapping & Texture');
    this.uvControllers['uOffset'] = fUV
      .add(this.uvParams, 'uOffset', -5, 5, 0.05)
      .name('Offset U')
      .onChange(() => this.applyLiveUVTransform());
    this.uvControllers['vOffset'] = fUV
      .add(this.uvParams, 'vOffset', -5, 5, 0.05)
      .name('Offset V')
      .onChange(() => this.applyLiveUVTransform());
    this.uvControllers['uScale'] = fUV
      .add(this.uvParams, 'uScale', 0.1, 10, 0.05)
      .name('Tiling U')
      .onChange(() => this.applyLiveUVTransform());
    this.uvControllers['vScale'] = fUV
      .add(this.uvParams, 'vScale', 0.1, 10, 0.05)
      .name('Tiling V')
      .onChange(() => this.applyLiveUVTransform());
    this.uvControllers['rotation'] = fUV
      .add(this.uvParams, 'rotation', -180, 180, 1)
      .name('Rotation°')
      .onChange(() => this.applyLiveUVTransform());
    this.uvControllers['wrapMode'] = fUV
      .add(this.uvParams, 'wrapMode', ['Repeat', 'Clamp', 'Mirror'])
      .name('Wrap Mode')
      .onChange(() => this.applyLiveUVTransform());
    fUV.add(this.uvParams, 'autoTriplanar').name('Auto-Triplanar / Box UV');
    fUV.add(this.uvParams, 'planarTop').name('Planar Top (XZ)');
    fUV.add(this.uvParams, 'planarFront').name('Planar Front (XY)');
    fUV.add(this.uvParams, 'planarSide').name('Planar Side (ZY)');
    fUV.open();

    // 4. Primitive Creation GUI
    const containerCreate = document.getElementById('gui-create-container') || document.getElementById('gui-container-create');
    this.guiCreate = new dat.GUI({ autoPlace: false, width: 310 });
    containerCreate?.appendChild(this.guiCreate.domElement);

    this.guiCreate
      .add(this.createParams, 'shape', [
        'Box',
        'Sphere',
        'Cylinder',
        'Cone',
        'Capsule',
        'Torus',
        'TorusKnot',
        'Plane',
        'Disc',
        'Ground',
        'Polyhedron',
      ])
      .name('Shape')
      .onChange((val: string) => {
        this.updateCreateShapeVisibility(val);
      });

    this.createControllers['name'] = this.guiCreate.add(this.createParams, 'name').name('Name');

    const fDim = this.guiCreate.addFolder('Dimensions');
    this.createControllers['size'] = fDim.add(this.createParams, 'size', 0.1, 10, 0.1).name('Size');
    this.createControllers['width'] = fDim.add(this.createParams, 'width', 0.1, 10, 0.1).name('Width (X)');
    this.createControllers['height'] = fDim.add(this.createParams, 'height', 0.1, 10, 0.1).name('Height (Y)');
    this.createControllers['depth'] = fDim.add(this.createParams, 'depth', 0.1, 10, 0.1).name('Depth (Z)');
    this.createControllers['diameter'] = fDim.add(this.createParams, 'diameter', 0.1, 10, 0.1).name('Diameter');
    this.createControllers['thickness'] = fDim.add(this.createParams, 'thickness', 0.05, 2, 0.05).name('Thickness / Tube');
    this.createControllers['tessellation'] = fDim.add(this.createParams, 'tessellation', 3, 64, 1).name('Segments');
    this.createControllers['subdivisions'] = fDim.add(this.createParams, 'subdivisions', 1, 32, 1).name('Subdivisions');
    this.createControllers['polyType'] = fDim
      .add(this.createParams, 'polyType', [
        '0: Tetrahedron (4)',
        '1: Octahedron (8)',
        '2: Dodecahedron (12)',
        '3: Icosahedron (20)',
        '4: Rhombicuboctahedron (26)',
      ])
      .name('Polyhedron Type');
    fDim.open();

    const fCreateMat = this.guiCreate.addFolder('Initial Material');
    fCreateMat.addColor(this.createParams, 'color').name('Color');
    fCreateMat.add(this.createParams, 'roughness', 0, 1, 0.05).name('Roughness');
    fCreateMat.add(this.createParams, 'metallic', 0, 1, 0.05).name('Metallic');
    fCreateMat.open();

    this.guiCreate.add(this.createParams, 'createNow').name('Spawn at Origin');
    this.guiCreate.add(this.createParams, 'clickToPlace').name('Pick & Place in 3D');

    this.updateCreateShapeVisibility(this.createParams.shape);

    // 5. Constructive Solid Geometryg GUI
    const containerCSG = document.getElementById('gui-csg-container') || document.getElementById('gui-container-csg');
    this.guiCSG = new dat.GUI({ autoPlace: false, width: 310 });
    containerCSG?.appendChild(this.guiCSG.domElement);

    const fMeshes = this.guiCSG.addFolder('Target & Tool Meshes');
    this.csgControllers['targetMesh'] = fMeshes
      .add(this.csgParams, 'targetMesh', ['None'])
      .name('Target Mesh')
      .onChange((val) => {
        this.csgParams.targetMesh = val;
      });
    fMeshes.add(this.csgParams, 'useSelectedAsTarget').name('Set Target (Selected)');
    this.csgControllers['toolMesh'] = fMeshes
      .add(this.csgParams, 'toolMesh', ['None'])
      .name('Tool / Cutter')
      .onChange((val) => {
        this.csgParams.toolMesh = val;
      });
    fMeshes.add(this.csgParams, 'useSelectedAsTool').name('Set Tool (Selected)');
    fMeshes.add(this.csgParams, 'swapTargetAndTool').name('Swap Target & Tool');
    fMeshes.add(this.csgParams, 'keepToolMesh').name('Keep Tool Mesh');
    fMeshes.open();

    const fCutters = this.guiCSG.addFolder('Quick Sculpt Cutters');
    fCutters.add(this.csgParams, 'addCutterBox').name('Add Box Cutter');
    fCutters.add(this.csgParams, 'addCutterCylinder').name('Add Cylinder Cutter');
    fCutters.add(this.csgParams, 'addCutterSphere').name('Add Sphere Cutter');
    fCutters.open();

    const fOps = this.guiCSG.addFolder('Boolean Operations');
    fOps.add(this.csgParams, 'subtract').name('Subtract / Cut Out (A - B)');
    fOps.add(this.csgParams, 'union').name('Union / Fuse (A + B)');
    fOps.add(this.csgParams, 'intersect').name('Intersect (A ∩ B)');
    fOps.open();

    // 6. Facet & Vertex Editor GUI
    const containerFacet = document.getElementById('gui-facet-container') || document.getElementById('gui-container-facet');
    this.guiFacet = new dat.GUI({ autoPlace: false, width: 280 });
    containerFacet?.appendChild(this.guiFacet.domElement);
    this.guiFacet
      .add(this.facetParams, 'active')
      .name('Enable Face Pick')
      .onChange((v) => this.service.toggleFacetEditor(v));
    this.guiFacet.add(this.facetParams, 'extrudeDist', 0.05, 5, 0.05).name('Distance');
    this.guiFacet.add(this.facetParams, 'extrudeNow').name('Extrude Face');
    this.guiFacet.add(this.facetParams, 'deleteFacet').name('Delete Face');
    this.guiFacet.add(this.facetParams, 'flipNormal').name('Invert Normal');

    // 7. WebP Textures GUI
    const containerTex = document.getElementById('gui-textures-container') || document.getElementById('gui-container-textures');
    this.guiTextures = new dat.GUI({ autoPlace: false, width: 280 });
    containerTex?.appendChild(this.guiTextures.domElement);
    this.textureControllers['status'] = this.guiTextures.add(this.textureParams, 'status').name('Status').listen();
    this.guiTextures.add(this.textureParams, 'quality', 10, 100, 5).name('WebP Quality %');
    this.guiTextures.add(this.textureParams, 'maxResolution', ['Original', '2048', '1024', '512', '256']).name('Max Res');
    this.guiTextures.add(this.textureParams, 'optimizeAll').name('Optimize All Textures');

    // 8. Animations GUI (Babylon Sandbox Style)
    const containerAnim = document.getElementById('gui-anim-container') || document.getElementById('gui-container-anim');
    this.guiAnim = new dat.GUI({ autoPlace: false, width: 420 });
    containerAnim?.appendChild(this.guiAnim.domElement);

    this.animControllers['clip'] = this.guiAnim
      .add(this.animParams, 'clip', ['None'])
      .name('Clip')
      .onChange((name: string) => {
        this.selectAnimationGroup(name);
      });

    const ctrlPlay = this.guiAnim.add(this.animParams, 'play').name('▶ Play');
    const ctrlPause = this.guiAnim.add(this.animParams, 'pause').name('⏸ Pause');
    const ctrlStop = this.guiAnim.add(this.animParams, 'stop').name('⏹ Stop');

    // Group Play, Pause, Stop into a single horizontal row
    const animBtnRow = document.createElement('div');
    animBtnRow.className = 'anim-btn-group';
    const liPlay = ctrlPlay.domElement.closest('li') || ctrlPlay.domElement;
    const liPause = ctrlPause.domElement.closest('li') || ctrlPause.domElement;
    const liStop = ctrlStop.domElement.closest('li') || ctrlStop.domElement;

    if (liPlay.parentElement) {
      liPlay.parentElement.insertBefore(animBtnRow, liPlay);
      animBtnRow.appendChild(liPlay);
      animBtnRow.appendChild(liPause);
      animBtnRow.appendChild(liStop);
    }

    this.animControllers['loop'] = this.guiAnim
      .add(this.animParams, 'loop')
      .name('Loop')
      .onChange((v: boolean) => {
        this.service.setAnimationLoop(v);
      });

    this.animControllers['speed'] = this.guiAnim
      .add(this.animParams, 'speed', 0.1, 2.5, 0.1)
      .name('Speed')
      .onChange((v: number) => {
        this.service.setAnimationSpeed(v);
      });

    this.animControllers['frame'] = this.guiAnim
      .add(this.animParams, 'frame', 0, 100, 1)
      .name('Timeline')
      .onChange((f: number) => {
        this.service.setAnimFrame(f);
      });

    this.setupColorPickerEnhancements();
  }

  public bringDialogToFront(activeDialog: HTMLElement): void {
    const scope = this.rootContainer || document;
    const isStack = this.layoutMode === 'stackpanel' || document.body.classList.contains('layout-stackpanel');

    if (isStack && activeDialog.closest('.stackpanel-sidebar')) {
      const sidebarDialogs = Array.from(scope.querySelectorAll('.stackpanel-sidebar .floating-dialog')) as HTMLElement[];
      sidebarDialogs.forEach((d) => d.classList.remove('active-focus'));
      if (!activeDialog.classList.contains('minimized')) {
        activeDialog.classList.add('active-focus');
      }
      return;
    }

    const allDialogs = Array.from(scope.querySelectorAll('.floating-dialog')) as HTMLElement[];
    // Sort other dialogs by their current z-index so relative stacking order is preserved
    const others = allDialogs
      .filter((d) => d !== activeDialog)
      .sort((a, b) => (parseInt(a.style.zIndex || '50', 10) || 50) - (parseInt(b.style.zIndex || '50', 10) || 50));

    others.forEach((d, idx) => {
      d.style.zIndex = String(50 + idx);
      d.classList.remove('active-focus');
    });

    activeDialog.style.zIndex = '60';
    activeDialog.classList.add('active-focus');

    // If an exclusive 3D tool dialog is brought to front, make it the active 3D tool
    const targetTool =
      this.getToolByDialogId(activeDialog.id) ||
      (activeDialog.id === 'pathExtrusionStudioDialog' ? this.getToolByName('path_extrusion') : null);

    if (targetTool?.isExclusive3DTool && !targetTool.isActive?.(this)) {
      for (const other of this.editorTools) {
        if (other !== targetTool && other.isExclusive3DTool) {
          other.onDeactivate?.(this);
        }
      }
      targetTool.onActivate?.(this);
      this.updatePanelButtonStates();
    }
  }

  private setupColorPickerEnhancements(): void {
    const scope = this.rootContainer || document;
    const colorRows = Array.from(scope.querySelectorAll('.dg .cr.color')) as HTMLElement[];

    const closeAllColorPickers = (exceptRow?: HTMLElement) => {
      for (const row of colorRows) {
        if (row === exceptRow) continue;
        row.classList.remove('color-picker-open');
        const sel = row.querySelector('.selector') as HTMLElement | null;
        if (sel) {
          sel.classList.remove('drag');
          sel.style.display = '';
        }
        const input = row.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (input && document.activeElement === input) {
          input.blur();
        }
      }
      const allDialogs = Array.from(scope.querySelectorAll('.floating-dialog')) as HTMLElement[];
      for (const dlg of allDialogs) {
        if (exceptRow && dlg.contains(exceptRow)) continue;
        dlg.classList.remove('has-open-color-picker');
      }
    };

    // Enhance each dat.GUI ColorController instance
    const allGuis = [this.guiScene, this.guiMaterial, this.guiCreate].filter(Boolean);
    const collectColorControllers = (gui: dat.GUI): any[] => {
      const result: any[] = [];
      const controllers = (gui as any).__controllers || [];
      for (const ctrl of controllers) {
        if (ctrl && ctrl.__selector && ctrl.__saturation_field && ctrl.__hue_field) {
          result.push(ctrl);
        }
      }
      const folders = (gui as any).__folders || {};
      for (const folderName of Object.keys(folders)) {
        result.push(...collectColorControllers(folders[folderName]));
      }
      return result;
    };

    for (const gui of allGuis) {
      for (const ctrl of collectColorControllers(gui)) {
        let lastValidHue =
          typeof ctrl.__color?.__state?.h === 'number' && !Number.isNaN(ctrl.__color.__state.h) ? ctrl.__color.__state.h : 0;
        const origUpdateDisplay = ctrl.updateDisplay;

        ctrl.updateDisplay = function () {
          if (typeof this.__color?.__state?.h === 'number' && !Number.isNaN(this.__color.__state.h)) {
            lastValidHue = this.__color.__state.h;
          }
          const res = origUpdateDisplay.apply(this, arguments);
          try {
            if (this.__color?.__state) {
              if (Number.isNaN(this.__color.__state.h) || this.__color.__state.h === undefined) {
                this.__color.__state.h = lastValidHue;
              } else {
                lastValidHue = this.__color.__state.h;
              }
            }

            // Compute pure hue RGB for saturation gradient using standard CSS linear-gradient syntax
            const hNorm = (((lastValidHue % 360) + 360) % 360) / 60;
            const hi = Math.floor(hNorm) % 6;
            const f = hNorm - Math.floor(hNorm);
            const q = 1 - f;
            const t = f;
            const rgbArr = [
              [1, t, 0],
              [q, 1, 0],
              [0, 1, t],
              [0, q, 1],
              [t, 0, 1],
              [1, 0, q],
            ][hi] || [1, 0, 0];
            const hr = Math.round(rgbArr[0] * 255);
            const hg = Math.round(rgbArr[1] * 255);
            const hb = Math.round(rgbArr[2] * 255);
            const pureHueCss = `rgb(${hr}, ${hg}, ${hb})`;

            if (this.__saturation_field) {
              this.__saturation_field.style.backgroundImage = `linear-gradient(to right, #ffffff 0%, ${pureHueCss} 100%)`;
              const valField = this.__saturation_field.firstElementChild as HTMLElement | null;
              if (valField) {
                valField.style.backgroundImage = 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, #000000 100%)';
              }
            }
            if (this.__hue_field) {
              this.__hue_field.style.backgroundImage =
                'linear-gradient(to bottom, #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%)';
            }
          } catch {
            // Ignore style sync errors
          }
          return res;
        };

        ctrl.updateDisplay();
      }
    }

    // Attach robust open/close & z-index management to each .cr.color row
    for (const row of colorRows) {
      const dialog = row.closest('.floating-dialog') as HTMLElement | null;
      const selector = row.querySelector('.selector') as HTMLElement | null;
      const input = row.querySelector('input[type="text"]') as HTMLInputElement | null;
      let isDraggingPalette = false;

      const openPicker = () => {
        closeAllColorPickers(row);
        row.classList.add('color-picker-open');
        if (dialog) {
          this.bringDialogToFront(dialog);
          dialog.classList.add('has-open-color-picker');
        }
      };

      row.addEventListener('mouseenter', () => {
        openPicker();
      });

      row.addEventListener('mousedown', () => {
        openPicker();
      });

      input?.addEventListener('focus', () => {
        openPicker();
      });

      selector?.addEventListener('mousedown', () => {
        isDraggingPalette = true;
        openPicker();
        const onWindowMouseUp = () => {
          isDraggingPalette = false;
          selector.classList.remove('drag');
          if (!row.matches(':hover') && document.activeElement !== input) {
            row.classList.remove('color-picker-open');
            dialog?.classList.remove('has-open-color-picker');
          }
        };
        window.addEventListener('mouseup', onWindowMouseUp, { once: true });
      });

      row.addEventListener('mouseleave', () => {
        if (!isDraggingPalette && document.activeElement !== input) {
          row.classList.remove('color-picker-open');
          dialog?.classList.remove('has-open-color-picker');
        }
      });
    }

    const rootTarget = this.rootContainer || document;
    rootTarget.addEventListener('mousedown', (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const activeColorRow = target.closest('.cr.color') as HTMLElement | null;
      if (!activeColorRow) {
        closeAllColorPickers();
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        closeAllColorPickers();
      }
    });
  }

  private updateMeshGUI(): void {
    const mesh = this.service.selectedMesh;
    if (mesh) {
      this.meshParams.name = mesh.name;
      this.meshParams.visible = mesh.isVisible;
      this.meshParams.posX = parseFloat(mesh.position.x.toFixed(3));
      this.meshParams.posY = parseFloat(mesh.position.y.toFixed(3));
      this.meshParams.posZ = parseFloat(mesh.position.z.toFixed(3));

      const rot = this.service.getMeshRotationDegrees(mesh);
      this.meshParams.rotX = Math.round(rot.x);
      this.meshParams.rotY = Math.round(rot.y);
      this.meshParams.rotZ = Math.round(rot.z);

      this.meshParams.scaleX = parseFloat(mesh.scaling.x.toFixed(3));
      this.meshParams.scaleY = parseFloat(mesh.scaling.y.toFixed(3));
      this.meshParams.scaleZ = parseFloat(mesh.scaling.z.toFixed(3));
    } else {
      this.meshParams.name = this.service.selectedNodes.length > 0 ? `(${this.service.selectedNodes.length} objects)` : 'No selection';
      this.meshParams.visible = true;
    }

    for (const key in this.meshControllers) {
      this.meshControllers[key]?.updateDisplay();
    }
  }

  private updateMaterialGUI(): void {
    const mat = this.service.getSelectedMaterial();
    if (mat) {
      this.materialParams.materialName = mat.name;
      if (mat instanceof PBRMaterial) {
        this.materialParams.albedoColor = mat.albedoColor ? mat.albedoColor.toHexString() : '#ffffff';
        this.materialParams.roughness = mat.roughness !== undefined ? mat.roughness : 0.5;
        this.materialParams.metallic = mat.metallic !== undefined ? mat.metallic : 0.0;
        this.materialParams.alpha = mat.alpha !== undefined ? mat.alpha : 1.0;
        this.materialParams.wireframe = mat.wireframe || false;
      } else if (mat instanceof StandardMaterial) {
        this.materialParams.albedoColor = mat.diffuseColor ? mat.diffuseColor.toHexString() : '#ffffff';
        this.materialParams.alpha = mat.alpha !== undefined ? mat.alpha : 1.0;
        this.materialParams.wireframe = mat.wireframe || false;
      }

      const trans = this.service.getMaterialTransparencyInfo();
      this.materialParams.textureAlpha = trans.hasAlpha;
      const modeNames = ['Opaque', 'Alpha Test (Cutout)', 'Alpha Blend', 'Alpha Test & Blend'];
      this.materialParams.transparencyMode = modeNames[trans.mode] ?? 'Opaque';
      this.materialParams.twoSided = trans.twoSided;
      this.materialParams.alphaCutOff = trans.alphaCutOff;

      const bump = this.service.getMaterialBumpInfo();
      this.materialParams.bumpInfo = bump.hasBump ? bump.name : 'None';
      this.materialParams.bumpLevel = bump.level;
      this.materialParams.invertNormalMapX = bump.invertX;
      this.materialParams.invertNormalMapY = bump.invertY;
      this.materialParams.useParallax = bump.useParallax;
      this.materialParams.useParallaxOcclusion = bump.useParallaxOcclusion;
      this.materialParams.parallaxScaleBias = bump.parallaxScaleBias;
    } else {
      this.materialParams.materialName = 'No material';
      this.materialParams.bumpInfo = 'None';
      this.materialParams.bumpLevel = 1.0;
      this.materialParams.invertNormalMapX = false;
      this.materialParams.invertNormalMapY = false;
      this.materialParams.useParallax = false;
      this.materialParams.useParallaxOcclusion = false;
      this.materialParams.parallaxScaleBias = 0.05;
    }

    for (const key in this.materialControllers) {
      this.materialControllers[key]?.updateDisplay();
    }
    this.updateUVGUI();
    this.renderEmbeddedTextures();
    this.updateCompressModelUI();
  }

  /* =========================================================================
     OUTLINER SCENE HIERARCHY TREE
     ========================================================================= */
  public updateOutliner(): void {
    if (!this.outlinerTreeContainer) return;
    const prevScrollTop = this.outlinerTreeContainer.scrollTop;
    this.outlinerTreeContainer.innerHTML = '';

    const filter = this.searchFilter.toLowerCase().trim();

    const isValidSceneNode = (n: any): boolean => {
      if (!n || n.isDisposed()) return false;
      if (typeof n.isEnabled === 'function' && !n.isEnabled()) return false;
      if (this.service.isEditorHelper(n)) return false;
      const className = n.getClassName ? n.getClassName() : '';
      if (className.includes('Camera') || className.includes('Light')) return false;
      return true;
    };

    const getLogicalParent = (n: Node): Node | null => {
      if (this.service.selectionProxyActive && n.parent === this.service.selectionProxyNode) {
        return (this.service as any).selectionProxyMap?.get(n) || null;
      }
      const p = n.parent;
      if (!p || !isValidSceneNode(p)) return null;
      return p;
    };

    const getLogicalChildren = (parent: Node): (TransformNode | Mesh)[] => {
      const children: (TransformNode | Mesh)[] = [];
      const rawChildren = parent.getChildren ? parent.getChildren() : [];
      for (const c of rawChildren) {
        if (isValidSceneNode(c) && !children.includes(c as any)) {
          children.push(c as any);
        }
      }
      if (this.service.selectionProxyActive) {
        const map = (this.service as any).selectionProxyMap as Map<any, any>;
        if (map) {
          for (const [proxiedNode, origParent] of map.entries()) {
            if (origParent === parent && isValidSceneNode(proxiedNode) && !children.includes(proxiedNode)) {
              children.push(proxiedNode);
            }
          }
        }
      }
      return children;
    };

    // Gather all potential scene nodes
    const candidateNodes = new Set<Node>();
    for (const n of this.service.scene.rootNodes) {
      if (isValidSceneNode(n)) candidateNodes.add(n);
    }
    for (const m of this.service.importedMeshes) {
      if (isValidSceneNode(m)) candidateNodes.add(m);
    }
    for (const g of this.service.groups) {
      if (isValidSceneNode(g)) candidateNodes.add(g);
    }
    for (const tn of this.service.scene.transformNodes) {
      if (isValidSceneNode(tn)) candidateNodes.add(tn);
    }
    for (const m of this.service.scene.meshes) {
      if (isValidSceneNode(m)) candidateNodes.add(m);
    }

    if (candidateNodes.size === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '18px 12px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--text-secondary)';
      emptyMsg.style.fontSize = '12px';
      emptyMsg.innerHTML =
        'No objects in the scene.<br><span style="font-size:11px; opacity:0.8;">Click "File > Open" or "Tools > Create".</span>';
      this.outlinerTreeContainer.appendChild(emptyMsg);
      return;
    }

    // Determine root nodes (nodes whose logical parent is not another valid candidate node)
    const rootNodes: Node[] = [];
    for (const n of candidateNodes) {
      const p = getLogicalParent(n);
      if (!p || !candidateNodes.has(p)) {
        if (!rootNodes.includes(n)) rootNodes.push(n);
      }
    }

    const nodeMatchesFilter = (n: Node): boolean => {
      if (!filter) return true;
      if ((n.name || '').toLowerCase().includes(filter)) return true;
      const children = getLogicalChildren(n);
      return children.some((c) => nodeMatchesFilter(c));
    };

    const renderedNodes = new Set<Node>();

    const renderNode = (node: Node, depth: number, parentElement: HTMLElement) => {
      if (renderedNodes.has(node)) return;
      renderedNodes.add(node);

      if (filter && !nodeMatchesFilter(node)) {
        return;
      }

      const children = getLogicalChildren(node);
      const hasChildren = children.length > 0;
      const isGroup = this.service.isGroupNode(node);
      const isSelected = this.service.selectedNodes.includes(node as any) || this.service.selectedMesh === node;

      const isForcedOpen = filter.length > 0;
      const isCollapsed = !isForcedOpen && this.collapsedNodeIds.has(node.uniqueId.toString());
      const isExpanded = !isCollapsed;

      const row = document.createElement('div');
      row.className = `outliner-item ${isSelected ? 'selected' : ''} ${isGroup ? 'outliner-item-group' : ''}`;
      row.style.paddingLeft = `${6 + depth * 14}px`;

      const left = document.createElement('div');
      left.className = 'outliner-item-left';

      // Chevron or spacer
      if (hasChildren) {
        const chevron = document.createElement('span');
        chevron.className = 'outliner-chevron';
        chevron.title = isExpanded ? 'Collapse' : 'Expand';
        chevron.innerHTML = `<i class="app-icon" data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}"></i>`;
        chevron.addEventListener('click', (e) => {
          e.stopPropagation();
          const idStr = node.uniqueId.toString();
          if (this.collapsedNodeIds.has(idStr)) {
            this.collapsedNodeIds.delete(idStr);
          } else {
            this.collapsedNodeIds.add(idStr);
          }
          this.updateOutliner();
        });
        left.appendChild(chevron);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'outliner-chevron-spacer';
        left.appendChild(spacer);
      }

      // Icon
      const icon = document.createElement('span');
      icon.className = 'outliner-item-icon';
      let iconName = 'box';
      if (isGroup) {
        iconName = 'folder';
      } else if (node instanceof Mesh) {
        iconName = node.getTotalVertices() > 0 ? 'box' : 'box-select';
      } else {
        iconName = 'network';
      }
      icon.innerHTML = `<i class="app-icon" data-lucide="${iconName}"></i>`;
      left.appendChild(icon);

      // Name
      const name = document.createElement('span');
      name.className = 'outliner-item-name';
      name.textContent = node.name || 'Unnamed';
      name.title = node.name || '';
      left.appendChild(name);

      // Badges
      if (node instanceof Mesh && node.getTotalVertices() > 0) {
        const polyCount = Math.floor(node.getTotalIndices() / 3);
        const badge = document.createElement('span');
        badge.className = 'outliner-badge';
        badge.textContent = `${polyCount} Tris`;
        left.appendChild(badge);
      }
      if (hasChildren) {
        const childBadge = document.createElement('span');
        childBadge.className = 'outliner-badge';
        childBadge.textContent = `${children.length} ${children.length === 1 ? 'item' : 'items'}`;
        left.appendChild(childBadge);
      }

      row.appendChild(left);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'outliner-item-actions';

      const descMeshes = this.service.collectNodeAndDescendants(node as any).meshes;

      // 1. Visibility toggle
      const btnVis = document.createElement('button');
      btnVis.className = 'outliner-btn';
      const isCurrentlyVisible = (): boolean =>
        node instanceof Mesh ? node.isVisible : descMeshes.some((m) => m.isVisible);
      const isVis = isCurrentlyVisible();
      btnVis.innerHTML = `<i class="app-icon" data-lucide="${isVis ? 'eye' : 'eye-off'}"></i>`;
      btnVis.title = 'Toggle visibility';
      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVis = !isCurrentlyVisible();
        if (node instanceof Mesh) {
          node.isVisible = nextVis;
        }
        for (const m of descMeshes) {
          m.isVisible = nextVis;
        }
        this.updateOutliner();
      });
      actions.appendChild(btnVis);

      // 2. Focus / Center
      const btnCenter = document.createElement('button');
      btnCenter.className = 'outliner-btn';
      btnCenter.innerHTML = '<i class="app-icon" data-lucide="target"></i>';
      btnCenter.title = 'Center camera on selection';
      btnCenter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.selectNodes([node as any]);
        this.service.focusOnTarget(node as any);
        this.showToast(`Centered on "${node.name}"`, 'success');
      });
      actions.appendChild(btnCenter);

      // 3. Wireframe
      const checkIsWire = (): boolean =>
        node instanceof Mesh
          ? this.service.isMeshWireframe(node)
          : descMeshes.length > 0 && descMeshes.every((m) => this.service.isMeshWireframe(m));
      const isWire = checkIsWire();
      const btnWire = document.createElement('button');
      btnWire.className = `outliner-btn ${isWire ? 'active' : ''}`;
      btnWire.innerHTML = '<i class="app-icon" data-lucide="scan"></i>';
      btnWire.title = 'Toggle wireframe';
      btnWire.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node instanceof Mesh) {
          const state = this.service.toggleMeshWireframe(node);
          this.showToast(`Wireframe ${state ? 'enabled' : 'disabled'} for "${node.name}"`, 'info');
        } else {
          const nextState = !checkIsWire();
          for (const m of descMeshes) {
            this.service.setMeshWireframe(m, nextState);
          }
          this.showToast(`Wireframe ${nextState ? 'enabled' : 'disabled'} for "${node.name}"`, 'info');
        }
        this.updateOutliner();
      });
      actions.appendChild(btnWire);

      // 4. Ungroup (if isGroup)
      if (isGroup) {
        const btnUngroup = document.createElement('button');
        btnUngroup.className = 'outliner-btn';
        btnUngroup.innerHTML = '<i class="app-icon" data-lucide="folder-minus"></i>';
        btnUngroup.title = 'Ungroup meshes';
        btnUngroup.addEventListener('click', (e) => {
          e.stopPropagation();
          this.service.selectNodes([node as any]);
          this.service.ungroupSelected();
        });
        actions.appendChild(btnUngroup);
      }

      // 5. Delete (deletes node and all its children)
      const btnDel = document.createElement('button');
      btnDel.className = 'outliner-btn';
      btnDel.innerHTML = '<i class="app-icon" data-lucide="trash-2"></i>';
      btnDel.title = hasChildren ? 'Delete object and children' : 'Delete object';
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.selectNodes([node as any]);
        this.service.deleteSelected();
      });
      actions.appendChild(btnDel);

      row.appendChild(actions);

      row.addEventListener('click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
          this.service.toggleNodeSelection(node as any);
        } else if (e.shiftKey) {
          this.service.rangeSelectNodes(node as any);
        } else {
          this.service.selectNodes([node as any]);
        }
      });

      row.addEventListener('dblclick', () => {
        this.service.focusOnTarget(node as any);
      });

      parentElement.appendChild(row);

      // If expanded, render children recursively
      if (hasChildren && isExpanded) {
        for (const child of children) {
          renderNode(child, depth + 1, parentElement);
        }
      }
    };

    for (const root of rootNodes) {
      renderNode(root, 0, this.outlinerTreeContainer);
    }

    this.refreshIcons();
    this.outlinerTreeContainer.scrollTop = prevScrollTop;
  }

  /* =========================================================================
     FILE DRAG & DROP & INPUTS
     ========================================================================= */
  private initFileHandling(): void {
    this.modelFileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.service.loadFiles(Array.from(files));
      }
    });

    this.importFileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.service.importFiles(Array.from(files));
      }
    });

    this.textureFileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.service.replaceSelectedTexture(file);
    });

    this.bumpFileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.service.applyBumpTextureToSelectedMaterial(file);
        this.updateMaterialGUI();
      }
    });

    // Drag & Drop
    const dropZone = document.getElementById('dropOverlay') || document.getElementById('drop-zone');

    window.addEventListener('dragover', (e) => {
      // Do not activate file drop overlay if an internal tool is being reordered
      if (this.currentDraggedStackpanelDialog) {
        if (dropZone) dropZone.classList.remove('active');
        return;
      }

      // Check whether files are actively being dragged into the window from the OS
      const types = e.dataTransfer?.types;
      const isFileDrag = types ? Array.from(types).includes('Files') : false;
      if (!isFileDrag) {
        if (dropZone) dropZone.classList.remove('active');
        return;
      }

      e.preventDefault();
      if (dropZone) dropZone.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0) {
        if (dropZone) dropZone.classList.remove('active');
      }
    });

    const readEntriesPromise = (reader: any): Promise<any[]> =>
      new Promise((resolve) => {
        reader.readEntries(
          (entries: any[]) => resolve(entries || []),
          () => resolve([])
        );
      });

    const traverseEntry = async (entry: any, pathPrefix = ''): Promise<File[]> => {
      const collected: File[] = [];
      if (!entry) return collected;
      if (entry.name && entry.name.startsWith('.')) return collected;

      if (entry.isFile) {
        try {
          const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
          if (file.name.startsWith('.')) return collected;
          const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
          (file as any).correctName = relPath;
          collected.push(file);
        } catch {
          // Skip unreadable file
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const currentDir = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        let batch: any[] = [];
        do {
          batch = await readEntriesPromise(reader);
          for (const child of batch) {
            const sub = await traverseEntry(child, currentDir);
            collected.push(...sub);
          }
        } while (batch.length > 0);
      }
      return collected;
    };

    window.addEventListener('drop', async (e) => {
      if (dropZone) dropZone.classList.remove('active');
      if (this.currentDraggedStackpanelDialog) return;
      const types = e.dataTransfer?.types;
      const isFileDrag = types ? Array.from(types).includes('Files') : false;
      if (!isFileDrag) return;

      e.preventDefault();

      // CRITICAL: Extract all FileSystemEntries synchronously BEFORE any 'await' calls!
      // Otherwise Chromium/WebKit clears e.dataTransfer.items on the next event loop tick.
      const entries: any[] = [];
      const directFiles: File[] = [];

      const items = e.dataTransfer?.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind && item.kind !== 'file') continue;
          const entry = (item as any).getAsEntry?.() || (item as any).webkitGetAsEntry?.();
          if (entry) {
            entries.push(entry);
          } else {
            const f = item.getAsFile?.();
            if (f && !f.name.startsWith('.')) directFiles.push(f);
          }
        }
      } else if (e.dataTransfer?.files) {
        directFiles.push(...Array.from(e.dataTransfer.files).filter((f) => !f.name.startsWith('.')));
      }

      const files: File[] = [...directFiles];
      for (const entry of entries) {
        const entryFiles = await traverseEntry(entry);
        files.push(...entryFiles);
      }

      const validFiles = files.filter((f) => !f.name.startsWith('.'));
      if (validFiles.length === 0) return;

      const modelExtensions = ['.glb', '.gltf', '.obj', '.stl', '.ply', '.babylon'];
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.dds', '.ktx2'];

      const hasModel = validFiles.some((f) => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return modelExtensions.includes(ext);
      });

      const allImages = validFiles.every((f) => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
        return imageExtensions.includes(ext);
      });

      // If only textures/images were dropped (e.g. Textures folder or texture images):
      // Apply them to the current scene without wiping out the model!
      if (!hasModel && allImages) {
        await this.service.applyDroppedTextures(validFiles);
        return;
      }

      if (e.shiftKey) {
        await this.service.importFiles(validFiles);
      } else {
        await this.service.loadFiles(validFiles);
      }
    });
  }

  /* =========================================================================
     KEYBOARD SHORTCUTS
     ========================================================================= */
  private initKeyboardShortcuts(): void {
    const isNavigationKey = (key: string, e: KeyboardEvent): boolean => {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      return (
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright'
      );
    };

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Ensure WASD / Arrow camera navigation works even if canvas lost focus (e.g. clicked toolbar button or UI)
      if (isNavigationKey(key, e)) {
        if (document.activeElement !== this.canvas) {
          try {
            this.canvas?.focus();
          } catch {
            // Ignore
          }
          if (e.target !== this.canvas) {
            const forwardEvent = new KeyboardEvent(e.type, {
              key: e.key,
              code: e.code,
              keyCode: e.keyCode,
              which: e.which,
              bubbles: true,
              cancelable: true,
            });
            this.canvas?.dispatchEvent(forwardEvent);
          }
        }
        // Camera navigation takes absolute precedence: bare WASD and arrow keys never trigger tool shortcuts!
        return;
      }

      // Prevent repetitive rapid firing when keys are held down
      if (e.repeat) return;

      if (e.key === 'Meta' || e.key === 'Control' || e.metaKey || e.ctrlKey) {
        this.service.setSnapModifierActive(true);
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.service.redo();
        else this.service.undo();
      } else if ((e.metaKey || e.ctrlKey) && key === 'y') {
        e.preventDefault();
        this.service.redo();
      } else if ((e.metaKey || e.ctrlKey) && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) this.service.ungroupSelected();
        else this.service.groupSelected();
      } else if ((e.metaKey || e.ctrlKey) && key === 'c') {
        e.preventDefault();
        this.service.copySelected();
      } else if ((e.metaKey || e.ctrlKey) && key === 'v') {
        e.preventDefault();
        this.service.pasteAtCursor();
      } else if ((e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault();
        this.service.duplicateSelectedMesh();
      } else if ((e.metaKey || e.ctrlKey) && key === 'e') {
        e.preventDefault();
        this.openExportDialog();
      } else if (this.service.facetEditorActive && this.service.selectedFaceId !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!e.shiftKey && key === 'x') {
          e.preventDefault();
          this.facetParams.extrudeNow();
        } else if (!e.shiftKey && key === 'i') {
          e.preventDefault();
          this.facetParams.insetNow();
        } else if (e.shiftKey && key === 'a') {
          e.preventDefault();
          this.facetParams.arcNow();
        } else if (!e.shiftKey && key === 'c') {
          e.preventDefault();
          this.facetParams.knifeNow();
        } else if (e.shiftKey && key === 'e') {
          e.preventDefault();
          this.facetParams.loopCutNow();
        } else if (!e.shiftKey && (key === '-' || key === '_')) {
          e.preventDefault();
          this.facetParams.bevelNow();
        } else if (!e.shiftKey && key === 'h') {
          e.preventDefault();
          this.facetParams.solidifyNow();
        } else if (!e.shiftKey && key === 't') {
          e.preventDefault();
          this.facetParams.cutThroughNow();
        } else if (!e.shiftKey && key === 'v') {
          e.preventDefault();
          this.facetParams.relaxNow();
        } else if (!e.shiftKey && key === 'k') {
          e.preventDefault();
          this.facetParams.subdivideNow();
        } else if (e.shiftKey && key === 's') {
          e.preventDefault();
          this.facetParams.subDNow();
        } else if (!e.shiftKey && key === 'n') {
          e.preventDefault();
          this.facetParams.flipNormal();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          this.facetParams.deleteFacet();
        }
      } else if (key === 'm') {
        document.getElementById('btnGizmoTranslate')?.click();
      } else if (key === 'e') {
        document.getElementById('btnGizmoRotate')?.click();
      } else if (key === 'r') {
        document.getElementById('btnGizmoScale')?.click();
      } else if (key === 'b') {
        document.getElementById('btnGizmoBounds')?.click();
      } else if (key === 'f') {
        this.service.focusOnSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.service.deleteSelected();
      } else if (e.key === 'Escape') {
        this.closeAllDropdowns();
        this.closeExportDialog();
        if (this.service.isPlaceModeActive) {
          this.service.cancelPlacementMode();
        }
        for (const tool of this.editorTools) {
          if (tool.isExclusive3DTool) {
            tool.onDeactivate?.(this);
          }
        }
        this.updatePanelButtonStates();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.key === 'Meta' || e.key === 'Control' || (!e.metaKey && !e.ctrlKey)) {
        this.service.setSnapModifierActive(false);
      }
      if (isNavigationKey(key, e) && document.activeElement !== this.canvas && e.target !== this.canvas) {
        const forwardEvent = new KeyboardEvent(e.type, {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          which: e.which,
          bubbles: true,
          cancelable: true,
        });
        this.canvas?.dispatchEvent(forwardEvent);
      }
    });

    window.addEventListener('blur', () => {
      this.service.setSnapModifierActive(false);
    });
  }

  /* =========================================================================
     NOTIFICATIONS & HELPERS
     ========================================================================= */
  public refreshIcons(): void {
    const render = () => {
      createIcons({ icons: editorIcons });
    };
    render();
    setTimeout(render, 60);
    setTimeout(render, 300);
  }

  public showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.toastText || !this.toastElement) return;
    const cleanMsg = message.replace(/^[\s\p{Emoji}\p{Extended_Pictographic}]+/u, '').trim();
    this.toastText.textContent = cleanMsg;
    this.toastElement.className = `show ${type}`;

    const iconMap: { [key: string]: string } = {
      info: 'info',
      success: 'check-circle-2',
      warning: 'alert-triangle',
      error: 'alert-circle',
    };
    if (this.toastIcon) {
      this.toastIcon.innerHTML = `<i class="app-icon" data-lucide="${iconMap[type] || 'info'}"></i>`;
    }
    this.refreshIcons();

    setTimeout(() => {
      this.toastElement.classList.remove('show');
    }, 3200);
  }

  public setStatus(text: string, isBusy: boolean = false): void {
    if (this.statusText) this.statusText.textContent = text;
    if (this.statusIndicator) this.statusIndicator.classList.toggle('busy', isBusy);
    if (isBusy) {
      this.showSceneLoader(text, 'BABYLON.JS 3D SCENE • PROCESSING MESH PIPELINE');
    } else {
      this.hideSceneLoader();
      if (!document.activeElement || document.activeElement === document.body) {
        try {
          this.canvas?.focus();
        } catch {
          // Ignore
        }
      }
    }
  }

  private runInitialLoadingSequence(autoLoadUrl?: string): void {
    this.setStartupProgress(78, 'Activating 3D Tools & Panels...');

    const t1 = setTimeout(() => {
      this.setStartupProgress(100, 'Launching Mesh Editor...');
    }, 260);

    const t2 = setTimeout(() => {
      this.hideStartupLoader();
      try {
        this.canvas?.focus();
      } catch {
        // Ignore
      }
    }, 560);

    this.startupTimerIds.push(t1, t2);

    const scene = this.service.getScene();
    const finalizeSceneInit = () => {
      if (autoLoadUrl) return;
      if (this.sceneLoaderTimerId) clearTimeout(this.sceneLoaderTimerId);
      this.sceneLoaderTimerId = setTimeout(() => {
        this.hideSceneLoader();
        try {
          this.canvas?.focus();
        } catch {
          // Ignore
        }
      }, 1050);
    };

    if (scene) {
      scene.executeWhenReady(() => {
        finalizeSceneInit();
      });
    } else {
      finalizeSceneInit();
    }
  }

  public setStartupProgress(percent: number, statusText?: string): void {
    if (this.startupLoaderBar) {
      this.startupLoaderBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    if (statusText && this.startupLoaderText) {
      this.startupLoaderText.textContent = statusText;
    }
  }

  public showStartupLoader(statusText?: string): void {
    if (statusText && this.startupLoaderText) {
      this.startupLoaderText.textContent = statusText;
    }
    this.startupLoaderElement?.classList.remove('is-hidden');
  }

  public hideStartupLoader(): void {
    this.startupLoaderElement?.classList.add('is-hidden');
  }

  public showSceneLoader(title?: string, subtitle?: string): void {
    if (this.sceneLoaderTimerId) {
      clearTimeout(this.sceneLoaderTimerId);
      this.sceneLoaderTimerId = null;
    }
    if (title && this.sceneLoaderTitle) {
      this.sceneLoaderTitle.textContent = title;
    }
    if (subtitle && this.sceneLoaderSub) {
      this.sceneLoaderSub.textContent = subtitle;
    }
    this.sceneLoaderElement?.classList.remove('is-hidden');
  }

  public hideSceneLoader(): void {
    this.sceneLoaderElement?.classList.add('is-hidden');
  }

  /* =========================================================================
     CSG BOOLEAN SCULPTING HELPER METHODS
     ========================================================================= */
  public setCSGTargetFromSelected(): void {
    if (
      !this.service.selectedMesh ||
      this.service.isEditorHelper(this.service.selectedMesh) ||
      this.service.selectedMesh.getTotalVertices() === 0
    ) {
      this.showToast('Please select a valid 3D mesh with geometry first.', 'warning');
      return;
    }
    this.csgParams.targetMesh = this.service.selectedMesh.name;
    this.updateCSGGUI();
    this.showToast(`Target mesh set to "${this.service.selectedMesh.name}"`, 'info');
  }

  public setCSGToolFromSelected(): void {
    if (
      !this.service.selectedMesh ||
      this.service.isEditorHelper(this.service.selectedMesh) ||
      this.service.selectedMesh.getTotalVertices() === 0
    ) {
      this.showToast('Please select a valid 3D mesh with geometry first.', 'warning');
      return;
    }
    this.csgParams.toolMesh = this.service.selectedMesh.name;
    this.updateCSGGUI();
    this.showToast(`Tool / Cutter mesh set to "${this.service.selectedMesh.name}"`, 'info');
  }

  public swapCSGMeshes(): void {
    const tmp = this.csgParams.targetMesh;
    this.csgParams.targetMesh = this.csgParams.toolMesh;
    this.csgParams.toolMesh = tmp;
    this.updateCSGGUI();
    this.showToast('Swapped CSG Target and Tool meshes.', 'info');
  }

  public addQuickCutter(shape: 'Box' | 'Cylinder' | 'Sphere'): void {
    const cutterMesh = this.service.addQuickCutter(shape, this.csgParams.targetMesh);
    if (cutterMesh) {
      this.csgParams.toolMesh = cutterMesh.name;
      this.updateOutliner();
      this.updateCSGGUI();
    }
  }

  public async performCSGOperation(op: 'subtract' | 'union' | 'intersect'): Promise<void> {
    const targetMesh = this.service.importedMeshes.find((m) => m.name === this.csgParams.targetMesh);
    const toolMesh = this.service.importedMeshes.find((m) => m.name === this.csgParams.toolMesh);

    if (!targetMesh) {
      this.showToast('Please select a Target Mesh first.', 'warning');
      return;
    }
    if (!toolMesh) {
      this.showToast('Please select a Tool / Cutter Mesh first.', 'warning');
      return;
    }

    const chkNonDestructive = this.getElement<HTMLInputElement>('chkCSGNonDestructive');
    const sliderBevelWidth = this.getElement<HTMLInputElement>('sliderCSGBevelWidth');
    const selectBevelSegments = this.getElement<HTMLSelectElement>('selectCSGBevelSegments');
    const numBevelAngle = this.getElement<HTMLInputElement>('numCSGBevelAngle');

    const nonDestructive = chkNonDestructive ? chkNonDestructive.checked : true;
    const bevelWidth = sliderBevelWidth ? parseFloat(sliderBevelWidth.value) || 0 : 0;
    const bevelSegments = selectBevelSegments ? parseInt(selectBevelSegments.value, 10) || 2 : 2;
    const angleThresholdDeg = numBevelAngle ? parseFloat(numBevelAngle.value) || 30 : 30;

    const result = await this.service.performCSGOperation(
      targetMesh,
      toolMesh,
      op,
      this.csgParams.keepToolMesh,
      {
        nonDestructive,
        bevelWidth,
        bevelSegments,
        angleThresholdDeg,
      }
    );
    if (result) {
      this.csgParams.targetMesh = result.name;
      if (!this.csgParams.keepToolMesh) {
        this.csgParams.toolMesh = 'None';
      }
      this.updateOutliner();
      this.updateCSGGUI();
    }
  }

  public updateCSGGUI(): void {
    const validMeshes = this.service.importedMeshes.filter(
      (m) => !this.service.isEditorHelper(m) && m.name !== '__root__' && m.getTotalVertices() > 0 && (!m.isEnabled || m.isEnabled())
    );
    const meshNames = validMeshes.map((m) => m.name);
    const options = ['None', ...meshNames];

    // If current target no longer exists, reset to None
    if (this.csgParams.targetMesh !== 'None' && !meshNames.includes(this.csgParams.targetMesh)) {
      this.csgParams.targetMesh = 'None';
    }
    // If current tool no longer exists, reset to None
    if (this.csgParams.toolMesh !== 'None' && !meshNames.includes(this.csgParams.toolMesh)) {
      this.csgParams.toolMesh = 'None';
    }

    // Auto-suggest selected mesh as target if target is None, or pick first valid mesh
    if (this.csgParams.targetMesh === 'None') {
      const sel = this.service.selectedMesh;
      if (sel && !this.service.isEditorHelper(sel) && sel.name !== '__root__' && sel.getTotalVertices() > 0) {
        this.csgParams.targetMesh = sel.name;
      } else if (validMeshes.length > 0) {
        this.csgParams.targetMesh = validMeshes[0].name;
      }
    }

    if (this.csgControllers['targetMesh']) {
      this.updateDropdownOptions(this.csgControllers['targetMesh'], options, this.csgParams.targetMesh);
      this.csgControllers['targetMesh'].updateDisplay();
    }
    if (this.csgControllers['toolMesh']) {
      this.updateDropdownOptions(this.csgControllers['toolMesh'], options, this.csgParams.toolMesh);
      this.csgControllers['toolMesh'].updateDisplay();
    }

    const badge = this.getElement('csgNonDestructiveBadge');
    const selMesh = this.service.selectedMesh;
    if (badge) {
      const ndMeta = selMesh?.metadata?.nonDestructiveCSG;
      if (ndMeta?.isNonDestructive) {
        badge.textContent = ndMeta.bevel?.enabled
          ? `Beveled (${ndMeta.bevel.sharpEdgeCount} edges)`
          : 'Non-Destructive Ready';
      } else {
        badge.textContent = 'Active';
      }
    }
  }

  public initCSGBevelUI(): void {
    const sliderWidth = this.getElement<HTMLInputElement>('sliderCSGBevelWidth');
    const widthVal = this.getElement('csgBevelWidthVal');
    const selectSegments = this.getElement<HTMLSelectElement>('selectCSGBevelSegments');
    const numAngle = this.getElement<HTMLInputElement>('numCSGBevelAngle');
    const chkNonDestructive = this.getElement<HTMLInputElement>('chkCSGNonDestructive');

    if (sliderWidth) {
      sliderWidth.addEventListener('input', () => {
        const val = parseFloat(sliderWidth.value);
        if (widthVal) widthVal.textContent = val.toFixed(2);
      });
    }

    this.getElement('btnApplyCSGBevel')?.addEventListener('click', () => {
      const target =
        this.service.selectedMesh ||
        this.service.importedMeshes.find((m) => m.name === this.csgParams.targetMesh);
      if (!target) {
        this.showToast('Please select a mesh to apply the Bevel Modifier.', 'warning');
        return;
      }
      const width = sliderWidth ? parseFloat(sliderWidth.value) || 0.04 : 0.04;
      const segments = selectSegments ? parseInt(selectSegments.value, 10) || 2 : 2;
      const angleThresholdDeg = numAngle ? parseFloat(numAngle.value) || 30 : 30;
      const nonDestructive = chkNonDestructive ? chkNonDestructive.checked : true;

      const { sharpEdgeCount } = this.service.applyNonDestructiveBevel(target, {
        width,
        segments,
        angleThresholdDeg,
        nonDestructive,
      });
      this.showToast(
        `Applied Non-Destructive Bevel (w=${width.toFixed(2)}, ${segments} segs) across ${sharpEdgeCount} sharp edges on "${target.name}".`,
        'success'
      );
      this.updateCSGGUI();
    });

    this.getElement('btnRevertCSGBase')?.addEventListener('click', () => {
      const target =
        this.service.selectedMesh ||
        this.service.importedMeshes.find((m) => m.name === this.csgParams.targetMesh);
      if (!target) {
        this.showToast('Please select a mesh to revert.', 'warning');
        return;
      }
      const reverted = this.service.revertNonDestructiveMesh(target);
      if (reverted) {
        this.showToast(`Reverted "${target.name}" to its original un-beveled base geometry.`, 'info');
        this.updateCSGGUI();
      } else {
        this.showToast(`Mesh "${target.name}" has no non-destructive modifier state to revert.`, 'warning');
      }
    });
  }

  public playAnimation(): void {
    this.service.playAnimation(this.animParams.loop, this.animParams.speed);
  }

  public pauseAnimation(): void {
    this.service.pauseAnimation();
  }

  public stopAnimation(): void {
    this.service.stopAnimation();
    this.animParams.frame = 0;
    this.animControllers['frame']?.updateDisplay();
  }

  public selectAnimationGroup(name: string): void {
    if (name === 'None' || name === 'No animations') return;
    const ag = this.service.selectAnimationGroup(name);
    if (ag) {
      this.animParams.clip = ag.name || name;
      const from = Math.floor(ag.from || 0);
      const to = Math.max(from + 1, Math.floor(ag.to || 100));
      if (this.animControllers['frame']) {
        this.animControllers['frame'].min(from);
        this.animControllers['frame'].max(to);
        this.animParams.frame = from;
        this.animControllers['frame'].updateDisplay();
      }
      this.animParams.loop = ag.loopAnimation !== undefined ? ag.loopAnimation : true;
      this.animParams.speed = ag.speedRatio || 1.0;
      this.animControllers['loop']?.updateDisplay();
      this.animControllers['speed']?.updateDisplay();
      this.playAnimation();
    }
  }

  public setupAnimations(names: string[], currentGroup: any | null): void {
    if (names.length > 0 && currentGroup) {
      this.animParams.clip = currentGroup.name || names[0];
      if (this.animControllers['clip']) {
        this.updateDropdownOptions(this.animControllers['clip'], names, this.animParams.clip);
        this.animControllers['clip'].setValue(this.animParams.clip);
        this.animControllers['clip'].updateDisplay();
      }
      const from = Math.floor(currentGroup.from || 0);
      const to = Math.max(from + 1, Math.floor(currentGroup.to || 100));
      if (this.animControllers['frame']) {
        this.animControllers['frame'].min(from);
        this.animControllers['frame'].max(to);
        this.animParams.frame = from;
        this.animControllers['frame'].updateDisplay();
      }
      this.animParams.loop = currentGroup.loopAnimation !== undefined ? currentGroup.loopAnimation : true;
      this.animParams.speed = currentGroup.speedRatio || 1.0;
      this.animControllers['loop']?.updateDisplay();
      this.animControllers['speed']?.updateDisplay();

      // Automatically open the Animation Player dialog
      this.toggleDialog('dialog-anim', true);

      // Automatically play the default clip
      this.playAnimation();
    } else {
      this.animParams.clip = 'No animations';
      if (this.animControllers['clip']) {
        this.updateDropdownOptions(this.animControllers['clip'], ['No animations'], 'No animations');
        this.animControllers['clip'].setValue('No animations');
        this.animControllers['clip'].updateDisplay();
      }
      if (this.animControllers['frame']) {
        this.animControllers['frame'].min(0);
        this.animControllers['frame'].max(100);
        this.animParams.frame = 0;
        this.animControllers['frame'].updateDisplay();
      }
    }
  }

  private updateUVGUI(): void {
    const tex = this.service.getActiveMaterialTexture();
    if (tex) {
      this.uvParams.uOffset = parseFloat((tex.uOffset || 0).toFixed(2));
      this.uvParams.vOffset = parseFloat((tex.vOffset || 0).toFixed(2));
      this.uvParams.uScale = parseFloat((tex.uScale !== undefined ? tex.uScale : 1).toFixed(2));
      this.uvParams.vScale = parseFloat((tex.vScale !== undefined ? tex.vScale : 1).toFixed(2));
      this.uvParams.rotation = Math.round(((tex.wAng || 0) * 180) / Math.PI);
      this.uvParams.wrapMode =
        tex.wrapU === Texture.CLAMP_ADDRESSMODE ? 'Clamp' : tex.wrapU === Texture.MIRROR_ADDRESSMODE ? 'Mirror' : 'Repeat';
    } else {
      this.uvParams.uOffset = 0;
      this.uvParams.vOffset = 0;
      this.uvParams.uScale = 1;
      this.uvParams.vScale = 1;
      this.uvParams.rotation = 0;
      this.uvParams.wrapMode = 'Repeat';
    }

    for (const key of Object.keys(this.uvControllers)) {
      this.uvControllers[key]?.updateDisplay();
    }
  }

  private applyLiveUVTransform(): void {
    const mat = this.service.getSelectedMaterial();
    const textures: Texture[] = [];
    const baseTex = this.service.getActiveMaterialTexture();
    if (baseTex) textures.push(baseTex);
    if (mat && (mat instanceof PBRMaterial || mat instanceof StandardMaterial) && mat.bumpTexture instanceof Texture) {
      if (!textures.includes(mat.bumpTexture)) {
        textures.push(mat.bumpTexture);
      }
    }
    if (textures.length === 0) return;

    const mode =
      this.uvParams.wrapMode === 'Clamp'
        ? Texture.CLAMP_ADDRESSMODE
        : this.uvParams.wrapMode === 'Mirror'
          ? Texture.MIRROR_ADDRESSMODE
          : Texture.WRAP_ADDRESSMODE;

    for (const tex of textures) {
      tex.uOffset = this.uvParams.uOffset;
      tex.vOffset = this.uvParams.vOffset;
      tex.uScale = this.uvParams.uScale;
      tex.vScale = this.uvParams.vScale;
      tex.wAng = (this.uvParams.rotation * Math.PI) / 180;
      tex.wrapU = mode;
      tex.wrapV = mode;
    }
    this.service.events.onSceneModified?.();
  }

  private updateCreateShapeVisibility(shape: string): void {
    const isBox = shape === 'Box';
    const isSphere = shape === 'Sphere';
    const isCylinder = shape === 'Cylinder' || shape === 'Cone';
    const isCapsule = shape === 'Capsule';
    const isTorus = shape === 'Torus' || shape === 'TorusKnot';
    const isPlane = shape === 'Plane';
    const isDisc = shape === 'Disc';
    const isGround = shape === 'Ground';
    const isPoly = shape === 'Polyhedron';

    const toggle = (ctrl: dat.GUIController | undefined, show: boolean) => {
      if (!ctrl || !ctrl.domElement) return;
      const li = ctrl.domElement.closest('li');
      if (li) (li as HTMLElement).style.display = show ? 'block' : 'none';
    };

    toggle(this.createControllers['width'], isBox || isPlane || isGround);
    toggle(this.createControllers['height'], isBox || isCylinder || isCapsule || isPlane);
    toggle(this.createControllers['depth'], isBox || isGround);
    toggle(this.createControllers['diameter'], isSphere || isCylinder || isCapsule || isTorus || isDisc);
    toggle(this.createControllers['thickness'], isTorus);
    toggle(this.createControllers['tessellation'], isSphere || isCylinder || isCapsule || isTorus || isDisc);
    toggle(this.createControllers['subdivisions'], isSphere || isGround);
    toggle(this.createControllers['size'], isPoly || isPlane);
    toggle(this.createControllers['polyType'], isPoly);
  }

  public createPrimitiveMesh(): void {
    const polyTypeNum = parseInt(this.createParams.polyType.split(':')[0], 10) || 1;
    this.service.createPrimitive({
      shape: this.createParams.shape,
      name: this.createParams.name,
      size: this.createParams.size,
      width: this.createParams.width,
      height: this.createParams.height,
      depth: this.createParams.depth,
      diameter: this.createParams.diameter,
      thickness: this.createParams.thickness,
      tessellation: this.createParams.tessellation,
      subdivisions: this.createParams.subdivisions,
      polyType: polyTypeNum,
      color: this.createParams.color,
      roughness: this.createParams.roughness,
      metallic: this.createParams.metallic,
    });
  }

  public startPrimitivePlacement(): void {
    const polyTypeNum = parseInt(this.createParams.polyType.split(':')[0], 10) || 1;
    this.service.startPlacementMode({
      shape: this.createParams.shape,
      name: this.createParams.name,
      size: this.createParams.size,
      width: this.createParams.width,
      height: this.createParams.height,
      depth: this.createParams.depth,
      diameter: this.createParams.diameter,
      thickness: this.createParams.thickness,
      tessellation: this.createParams.tessellation,
      subdivisions: this.createParams.subdivisions,
      polyType: polyTypeNum,
      color: this.createParams.color,
      roughness: this.createParams.roughness,
      metallic: this.createParams.metallic,
    });
  }

  private updateDropdownOptions(controller: dat.GUIController, options: string[], currentVal: string): void {
    if (!controller || !controller.domElement) return;
    const select = controller.domElement.querySelector('select');
    if (select) {
      select.innerHTML = '';
      for (const opt of options) {
        const optionElem = document.createElement('option');
        optionElem.value = opt;
        optionElem.textContent = opt;
        if (opt === currentVal) {
          optionElem.selected = true;
        }
        select.appendChild(optionElem);
      }
      if (options.includes(currentVal)) {
        select.value = currentVal;
      } else {
        select.value = options[0] || 'None';
      }
    }
  }

  /* =========================================================================
     AI MESH AGENT UI (TEXT/IMAGE TO MESH & MESH UPDATE)
     ========================================================================= */
  public renderAISkills(): void {
    const skillsList = this.getElement<HTMLElement>('aiSkillsList');
    if (!skillsList) return;
    const skills = this.service.aiAgent.getSkills();
    skillsList.innerHTML = '';
    for (const skill of skills) {
      const checked = skill.enabled;
      const label = document.createElement('label');
      label.className = 'ai-skill-item';
      label.title = skill.description;
      label.innerHTML = `
        <input type="checkbox" data-skill-id="${skill.id}" ${checked ? 'checked' : ''} />
        <span class="ai-skill-info">
          <span class="ai-skill-name">${skill.name}</span>
          <span class="ai-skill-desc">${skill.description}</span>
        </span>
      `;
      const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      checkbox?.addEventListener('change', () => {
        this.service.aiAgent.setSkillEnabled(skill.id, !!checkbox.checked);
      });
      skillsList.appendChild(label);
    }
  }

  public toggleAISettings(forceOpen?: boolean): void {
    const settingsPanel = this.getElement<HTMLElement>('aiSettingsPanel');
    const agentBody = this.getElement<HTMLElement>('aiAgentBody');
    const dialogTitleText = this.getElement<HTMLElement>('aiDialogTitleText');
    const btnSettingsToggle = this.getElement<HTMLButtonElement>('btnAISettingsToggle');
    if (!settingsPanel) return;

    const isHidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';
    const willOpen = forceOpen !== undefined ? forceOpen : isHidden;

    if (willOpen) {
      this.service.aiAgent.reloadSkills();
      this.renderAISkills();
      settingsPanel.style.display = 'flex';
      if (agentBody) agentBody.style.display = 'none';
      btnSettingsToggle?.classList.add('active');
      btnSettingsToggle?.setAttribute('title', 'Back to Chat & Generation');
      if (dialogTitleText) dialogTitleText.textContent = 'AI Agent Settings';

      // Auto-fetch endpoint models on first settings drawer open if not already loaded
      const modelSelect = this.getElement<HTMLSelectElement>('aiModelSelect');
      if (modelSelect && modelSelect.options.length <= 1) {
        this.service.aiAgent.fetchAvailableModels().then((models) => {
          if (models.length > 0) {
            const current = this.service.aiAgent.getConfig().model;
            const unique = Array.from(new Set([current, ...models].filter(Boolean)));
            modelSelect.innerHTML = unique.map((m) => `<option value="${this.escapeHtml(m)}">${this.escapeHtml(m)}</option>`).join('');
            modelSelect.value = current;
          }
        }).catch(() => {});
      }
    } else {
      settingsPanel.style.display = 'none';
      if (agentBody) agentBody.style.display = 'flex';
      btnSettingsToggle?.classList.remove('active');
      btnSettingsToggle?.setAttribute('title', 'Configure OpenAI-Compatible Endpoint & Skills');
      if (dialogTitleText) dialogTitleText.textContent = 'AI Mesh Agent';
    }
  }

  public copyToClipboard(text: string, button?: HTMLElement): void {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        this.fallbackCopyToClipboard(text);
      });
    } else {
      this.fallbackCopyToClipboard(text);
    }
    if (button) {
      button.classList.add('is-copied');
      const icon = button.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', 'check');
        if (typeof (window as any).lucide?.createIcons === 'function') {
          (window as any).lucide.createIcons();
        }
      }
      setTimeout(() => {
        button.classList.remove('is-copied');
        if (icon) {
          icon.setAttribute('data-lucide', 'copy');
          if (typeof (window as any).lucide?.createIcons === 'function') {
            (window as any).lucide.createIcons();
          }
        }
      }, 1500);
    }
    this.showToast('Copied to clipboard!', 'info');
  }

  private fallbackCopyToClipboard(text: string): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // ignore
    }
  }

  private initAIAgentUI(): void {
    const endpointInput = this.getElement<HTMLInputElement>('aiEndpointUrlInput');
    const apiKeyInput = this.getElement<HTMLInputElement>('aiApiKeyInput');
    const modelInput = this.getElement<HTMLInputElement>('aiModelInput');
    const modelSelect = this.getElement<HTMLSelectElement>('aiModelSelect');
    const btnToggleCustomModel = this.getElement<HTMLButtonElement>('btnToggleCustomModel');
    const modelDatalist = this.getElement<HTMLDataListElement>('aiModelDatalist');
    const settingsPanel = this.getElement<HTMLElement>('aiSettingsPanel');
    const skillsList = this.getElement<HTMLElement>('aiSkillsList');
    const endpointBadge =
      this.getElement<HTMLElement>('aiEndpointSummaryText') || this.getElement<HTMLElement>('aiEndpointBadge');
    const endpointDot = this.getElement<HTMLElement>('aiEndpointStatusDot');
    const settingsStatus = this.getElement<HTMLElement>('aiSettingsStatus');
    const promptInput = this.getElement<HTMLTextAreaElement>('aiPromptInput');
    const imageFileInput = this.getElement<HTMLInputElement>('aiImageFileInput');
    const chatLog = this.getElement<HTMLElement>('aiChatLog');
    const minPolyInput = this.getElement<HTMLInputElement>('aiMinPolyInput');
    const minPolyVal = this.getElement<HTMLElement>('aiMinPolyVal');
    const maxPolyInput = this.getElement<HTMLInputElement>('aiMaxPolyInput');
    const maxPolyVal = this.getElement<HTMLElement>('aiMaxPolyVal');
    const createTexturesCheck = this.getElement<HTMLInputElement>('aiCreateTexturesCheck');
    const createTexturesCheckQuick = this.getElement<HTMLInputElement>('aiCreateTexturesCheckQuick');
    const createNormalMapsCheck = this.getElement<HTMLInputElement>('aiCreateNormalMapsCheck');
    const createNormalMapsCheckQuick = this.getElement<HTMLInputElement>('aiCreateNormalMapsCheckQuick');
    const visualCritiqueCheck = this.getElement<HTMLInputElement>('aiVisualCritiqueCheck');
    const visualCritiqueCheckQuick = this.getElement<HTMLInputElement>('aiVisualCritiqueCheckQuick');

    if (chatLog) {
      if (!chatLog.innerHTML.trim()) {
        chatLog.innerHTML = AI_CHAT_EMPTY_HTML;
      }
      this.initialChatEmptyHtml = chatLog.innerHTML;
    }

    const updateEndpointBadge = () => {
      const cfg = this.service.aiAgent.getConfig();
      const isAgy =
        cfg.baseUrl.includes('/api/antigravity') ||
        cfg.baseUrl.includes('localhost:8787') ||
        cfg.baseUrl.includes('127.0.0.1:8787');
      let host = isAgy ? 'Antigravity' : cfg.baseUrl;
      if (!isAgy) {
        try {
          const u = new URL(cfg.baseUrl);
          host = u.host;
        } catch {
          // Keep raw string if not a valid URL
        }
      }
      const isLocal = isAgy || host.includes('localhost') || host.includes('127.0.0.1');
      const hasKey = !!cfg.apiKey || isLocal;
      const keyStatus = isAgy ? 'Account ✓' : cfg.apiKey ? 'Key ✓' : isLocal ? 'Local' : 'No Key';
      const minP = cfg.minPolygons ?? 200;
      const maxP = cfg.maxPolygons ?? 5000;
      const formatPoly = (n: number) => {
        if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
        return String(n);
      };
      const polySummary = `${formatPoly(minP)}–${formatPoly(maxP)}p`;
      const enabledNeural = this.service.aiAgent.getEnabledNeural3DProviders();
      const neuralSuffix =
        enabledNeural.length > 0
          ? ` • 3D: ${enabledNeural.map((p) => (p.id === 'trellis' ? 'TRELLIS' : p.id === 'hunyuan3d' ? 'Hunyuan3D' : 'Hi3D')).join('+')}`
          : '';
      if (endpointBadge) {
        endpointBadge.textContent = `${cfg.model} • ${polySummary} • ${host} (${keyStatus})${neuralSuffix}`;
      }
      if (endpointDot) {
        endpointDot.classList.toggle('is-ready', hasKey);
      }
    };

    // Populate initial values from saved config
    const initialConfig = this.service.aiAgent.getConfig();
    if (endpointInput) endpointInput.value = initialConfig.baseUrl;
    if (apiKeyInput) apiKeyInput.value = initialConfig.apiKey;
    if (modelInput) modelInput.value = initialConfig.model;

    const populateModelSelect = (models: string[], selectedModel?: string) => {
      if (!modelSelect) return;
      const targetModel = selectedModel || modelInput?.value || this.service.aiAgent.getConfig().model;
      const existing = Array.from(modelSelect.options).map((o) => o.value);
      const combined = Array.from(new Set([...models, ...existing, targetModel].filter(Boolean)));
      modelSelect.innerHTML = combined
        .map((m) => `<option value="${this.escapeHtml(m)}">${this.escapeHtml(m)}</option>`)
        .join('');
      if (targetModel) {
        modelSelect.value = targetModel;
      }
      if (modelInput) {
        modelInput.value = modelSelect.value || targetModel || '';
      }
    };

    if (modelSelect) {
      populateModelSelect([], initialConfig.model);
      modelSelect.addEventListener('change', () => {
        if (modelInput) modelInput.value = modelSelect.value;
        this.service.aiAgent.saveConfig({ model: modelSelect.value });
        updateEndpointBadge();
      });
    }

    if (modelInput) {
      modelInput.addEventListener('input', () => {
        if (modelSelect && modelInput.value.trim()) {
          populateModelSelect([modelInput.value.trim()], modelInput.value.trim());
        }
      });
    }

    if (btnToggleCustomModel) {
      btnToggleCustomModel.addEventListener('click', () => {
        if (!modelInput || !modelSelect) return;
        const isCustomVisible = modelInput.style.display !== 'none';
        if (isCustomVisible) {
          modelInput.style.display = 'none';
          modelSelect.style.display = 'inline-block';
          btnToggleCustomModel.textContent = 'Custom ID...';
          if (modelSelect.value) {
            modelInput.value = modelSelect.value;
            this.service.aiAgent.saveConfig({ model: modelSelect.value });
            updateEndpointBadge();
          }
        } else {
          modelInput.style.display = 'inline-block';
          modelSelect.style.display = 'none';
          btnToggleCustomModel.textContent = 'Select...';
          modelInput.focus();
        }
      });
    }

    if (minPolyInput) {
      minPolyInput.value = String(initialConfig.minPolygons ?? 200);
      if (minPolyVal) minPolyVal.textContent = Number(minPolyInput.value).toLocaleString();
      minPolyInput.addEventListener('input', () => {
        const val = Number(minPolyInput.value);
        if (minPolyVal) minPolyVal.textContent = val.toLocaleString();
        if (maxPolyInput && Number(maxPolyInput.value) < val) {
          maxPolyInput.value = String(val);
          if (maxPolyVal) maxPolyVal.textContent = val.toLocaleString();
        }
      });
    }

    if (maxPolyInput) {
      maxPolyInput.value = String(initialConfig.maxPolygons ?? 5000);
      if (maxPolyVal) maxPolyVal.textContent = Number(maxPolyInput.value).toLocaleString();
      maxPolyInput.addEventListener('input', () => {
        const val = Number(maxPolyInput.value);
        if (maxPolyVal) maxPolyVal.textContent = val.toLocaleString();
        if (minPolyInput && Number(minPolyInput.value) > val) {
          minPolyInput.value = String(val);
          if (minPolyVal) minPolyVal.textContent = val.toLocaleString();
        }
      });
    }

    const polyChipsContainer = this.getElement('aiMaxPolyChips');
    polyChipsContainer?.querySelectorAll<HTMLButtonElement>('[data-poly]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const poly = btn.getAttribute('data-poly');
        if (poly && maxPolyInput) {
          maxPolyInput.value = poly;
          maxPolyInput.dispatchEvent(new Event('input'));
        }
      });
    });

    const initialTextures = initialConfig.createTextures !== false;
    if (createTexturesCheck) createTexturesCheck.checked = initialTextures;
    if (createTexturesCheckQuick) createTexturesCheckQuick.checked = initialTextures;

    const syncTextures = (enabled: boolean) => {
      if (createTexturesCheck) createTexturesCheck.checked = enabled;
      if (createTexturesCheckQuick) createTexturesCheckQuick.checked = enabled;
      this.service.aiAgent.saveConfig({ createTextures: enabled });
      updateEndpointBadge();
    };

    createTexturesCheck?.addEventListener('change', () => {
      syncTextures(!!createTexturesCheck.checked);
    });
    createTexturesCheckQuick?.addEventListener('change', () => {
      syncTextures(!!createTexturesCheckQuick.checked);
    });

    const initialNormalMaps = initialConfig.createNormalMaps !== false;
    if (createNormalMapsCheck) createNormalMapsCheck.checked = initialNormalMaps;
    if (createNormalMapsCheckQuick) createNormalMapsCheckQuick.checked = initialNormalMaps;

    const syncNormalMaps = (enabled: boolean) => {
      if (createNormalMapsCheck) createNormalMapsCheck.checked = enabled;
      if (createNormalMapsCheckQuick) createNormalMapsCheckQuick.checked = enabled;
      this.service.aiAgent.saveConfig({ createNormalMaps: enabled });
      updateEndpointBadge();
    };

    createNormalMapsCheck?.addEventListener('change', () => {
      syncNormalMaps(!!createNormalMapsCheck.checked);
    });
    createNormalMapsCheckQuick?.addEventListener('change', () => {
      syncNormalMaps(!!createNormalMapsCheckQuick.checked);
    });

    const initialVisualCritique = !!initialConfig.visualCritique;
    if (visualCritiqueCheck) visualCritiqueCheck.checked = initialVisualCritique;
    if (visualCritiqueCheckQuick) visualCritiqueCheckQuick.checked = initialVisualCritique;

    const syncVisualCritique = (enabled: boolean) => {
      if (visualCritiqueCheck) visualCritiqueCheck.checked = enabled;
      if (visualCritiqueCheckQuick) visualCritiqueCheckQuick.checked = enabled;
      this.service.aiAgent.saveConfig({ visualCritique: enabled });
      updateEndpointBadge();
    };

    visualCritiqueCheck?.addEventListener('change', () => {
      syncVisualCritique(!!visualCritiqueCheck.checked);
    });
    visualCritiqueCheckQuick?.addEventListener('change', () => {
      syncVisualCritique(!!visualCritiqueCheckQuick.checked);
    });

    // Neural 3D Generators (TRELLIS 2, Hunyuan3D, Hi3D)
    const neuralProviderIds: Neural3DBackendId[] = ['trellis', 'hunyuan3d', 'hi3d'];
    const readNeuralProvidersFromDOM = (): Neural3DProvidersMap => {
      const currentMap = this.service.aiAgent.getNeural3DProviders();
      for (const id of neuralProviderIds) {
        const enableEl = this.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
        const protoEl = this.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
        const modelEl = this.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
        const urlEl = this.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
        const keyEl = this.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);

        const protocol = (protoEl?.value || currentMap[id].protocol) as Neural3DProtocol;
        const preset = NEURAL_3D_PROTOCOL_DEFAULTS[id][protocol] || NEURAL_3D_PROTOCOL_DEFAULTS[id].omlx;
        currentMap[id] = {
          ...currentMap[id],
          enabled: enableEl ? !!enableEl.checked : currentMap[id].enabled,
          protocol,
          modelId: modelEl?.value.trim() || preset.modelId,
          endpointUrl: urlEl?.value.trim() || preset.endpointUrl,
          apiKey: keyEl ? keyEl.value.trim() : currentMap[id].apiKey,
        };
      }
      return currentMap;
    };

    const syncNeuralProvidersUI = () => {
      const providers = this.service.aiAgent.getNeural3DProviders();
      for (const id of neuralProviderIds) {
        const p = providers[id];
        const enableEl = this.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
        const bodyEl = this.getElement<HTMLElement>(`aiNeuralConfigBody_${id}`);
        const protoEl = this.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
        const modelEl = this.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
        const urlEl = this.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
        const keyEl = this.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);

        if (enableEl) enableEl.checked = !!p.enabled;
        if (bodyEl) bodyEl.style.display = p.enabled ? 'flex' : 'none';
        if (protoEl) protoEl.value = p.protocol;
        if (modelEl) modelEl.value = p.modelId || '';
        if (urlEl) urlEl.value = p.endpointUrl || '';
        if (keyEl) keyEl.value = p.apiKey || '';
      }
    };

    for (const id of neuralProviderIds) {
      const enableEl = this.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
      const bodyEl = this.getElement<HTMLElement>(`aiNeuralConfigBody_${id}`);
      const protoEl = this.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
      const modelEl = this.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
      const urlEl = this.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
      const keyEl = this.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);
      const testBtn = this.getElement<HTMLButtonElement>(`btnTestNeural_${id}`);

      enableEl?.addEventListener('change', () => {
        const enabled = !!enableEl.checked;
        if (bodyEl) bodyEl.style.display = enabled ? 'flex' : 'none';
        this.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        updateEndpointBadge();
      });

      protoEl?.addEventListener('change', () => {
        const newProto = (protoEl.value || 'omlx') as Neural3DProtocol;
        const preset = NEURAL_3D_PROTOCOL_DEFAULTS[id][newProto];
        if (preset) {
          if (urlEl) urlEl.value = preset.endpointUrl;
          if (modelEl) modelEl.value = preset.modelId;
        }
        this.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        updateEndpointBadge();
      });

      const onFieldChange = () => {
        this.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        updateEndpointBadge();
      };
      modelEl?.addEventListener('change', onFieldChange);
      urlEl?.addEventListener('change', onFieldChange);
      keyEl?.addEventListener('change', onFieldChange);

      testBtn?.addEventListener('click', async () => {
        this.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        const res = await this.service.aiAgent.testNeural3DProvider(id);
        this.showToast(res.message, res.ok ? 'success' : 'warning');
      });
    }

    syncNeuralProvidersUI();

    updateEndpointBadge();
    this.renderAISkills();

    // Refresh dynamic skills from local dev server/bridge if available
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      this.service.aiAgent.fetchSkillsFromApi().then(() => {
        this.renderAISkills();
      });
    }

    this.getElement('btnAISettingsToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAISettings();
    });
    this.getElement('btnOpenAISettingsInline')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAISettings(true);
    });
    this.getElement('btnCancelAISettings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAISettings(false);
    });

    // Endpoint presets
    const presetContainer = this.getElement('aiPresetChips');
    presetContainer?.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = (btn as HTMLElement).getAttribute('data-preset');
        const preset = AI_ENDPOINT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          if (endpointInput) endpointInput.value = preset.baseUrl;
          if (modelInput) modelInput.value = preset.defaultModel;
          populateModelSelect([preset.defaultModel], preset.defaultModel);
          this.service.aiAgent.saveConfig({
            baseUrl: preset.baseUrl,
            model: preset.defaultModel,
          });
          updateEndpointBadge();
          if (settingsStatus) settingsStatus.textContent = `Preset: ${preset.label}`;
          this.showToast(`Switched to ${preset.label} (${preset.defaultModel})`, 'info');

          // Auto-fetch available models for this preset if local bridge / antigravity
          if (preset.baseUrl.includes('antigravity') || preset.baseUrl.includes('8787')) {
            this.service.aiAgent.fetchAvailableModels({ baseUrl: preset.baseUrl }).then((models) => {
              if (models.length > 0) {
                populateModelSelect(models, preset.defaultModel);
              }
            }).catch(() => {});
          }
        }
      });
    });

    // Toggle API key visibility
    this.getElement('btnToggleApiKeyVis')?.addEventListener('click', () => {
      if (!apiKeyInput) return;
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    // Fetch available models from OpenAI-compatible /models endpoint
    this.getElement('btnFetchAIModels')?.addEventListener('click', async () => {
      try {
        if (settingsStatus) settingsStatus.textContent = 'Fetching models...';
        const models = await this.service.aiAgent.fetchAvailableModels({
          baseUrl: endpointInput?.value.trim(),
          apiKey: apiKeyInput?.value.trim(),
        });
        populateModelSelect(models);
        if (modelDatalist) {
          modelDatalist.innerHTML = models.map((m) => `<option value="${m}"></option>`).join('');
        }
        if (settingsStatus) settingsStatus.textContent = `${models.length} models loaded`;
        this.showToast(`Loaded ${models.length} models from endpoint.`, 'success');
      } catch (err: any) {
        if (settingsStatus) settingsStatus.textContent = 'Model fetch failed';
        this.showToast(err?.message || 'Failed to fetch models from endpoint.', 'warning');
      }
    });

    // Save settings button
    this.getElement('btnSaveAISettings')?.addEventListener('click', () => {
      const minVal = minPolyInput ? Math.max(50, Number(minPolyInput.value) || 200) : 200;
      const maxVal = maxPolyInput ? Math.max(minVal, Number(maxPolyInput.value) || 5000) : 5000;
      const createTex = createTexturesCheck ? !!createTexturesCheck.checked : true;
      const createNorm = createNormalMapsCheck ? !!createNormalMapsCheck.checked : true;
      const visCritique = visualCritiqueCheck ? !!visualCritiqueCheck.checked : false;

      if (createTexturesCheckQuick && createTexturesCheck) {
        createTexturesCheckQuick.checked = createTexturesCheck.checked;
      }
      if (createNormalMapsCheckQuick && createNormalMapsCheck) {
        createNormalMapsCheckQuick.checked = createNormalMapsCheck.checked;
      }
      if (visualCritiqueCheckQuick && visualCritiqueCheck) {
        visualCritiqueCheckQuick.checked = visualCritiqueCheck.checked;
      }

      this.service.aiAgent.saveConfig({
        baseUrl: endpointInput?.value.trim() || 'https://api.openai.com/v1',
        apiKey: apiKeyInput?.value.trim() || '',
        model: modelInput?.value.trim() || 'gpt-4o',
        minPolygons: minVal,
        maxPolygons: maxVal,
        createTextures: createTex,
        createNormalMaps: createNorm,
        visualCritique: visCritique,
        neural3DProviders: readNeuralProvidersFromDOM(),
      });
      updateEndpointBadge();
      if (settingsStatus) settingsStatus.textContent = 'Saved ✓';
      this.toggleAISettings(false);
      this.showToast(`AI settings saved (${minVal.toLocaleString()}–${maxVal.toLocaleString()} polys, textures ${createTex ? 'on' : 'off'}, normal maps ${createNorm ? 'on' : 'off'}).`, 'success');
    });

    // Initialize AI Quick Prompts select-like dropdown from JS array
    this.initAIQuickPrompts();

    // Image attachments (Upload File, Capture 3D Viewport, Paste)
    this.getElement('btnAIAttachImage')?.addEventListener('click', () => {
      imageFileInput?.click();
    });

    imageFileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            this.aiPendingImages.push(reader.result);
            this.renderAIAttachments();
          }
        };
        reader.readAsDataURL(file);
      });
      imageFileInput.value = '';
    });

    this.getElement('btnAICaptureView')?.addEventListener('click', () => {
      const dataUrl = this.service.aiAgent.captureViewportDataUrl();
      if (dataUrl) {
        this.aiPendingImages.push(dataUrl);
        this.renderAIAttachments();
        this.showToast('Captured 3D viewport snapshot for AI Agent.', 'info');
      } else {
        this.showToast('Could not capture viewport image.', 'warning');
      }
    });

    promptInput?.addEventListener('paste', (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                this.aiPendingImages.push(reader.result);
                this.renderAIAttachments();
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    });

    // Speech-to-Text Voice Recording
    this.getElement('btnAIRecordSpeech')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSpeechRecognition();
    });

    // Clear chat history
    this.getElement('btnAIClearChat')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.service.aiAgent.clearChatHistory();
      const chatLog = this.getElement('aiChatLog');
      if (chatLog) {
        chatLog.innerHTML = this.initialChatEmptyHtml || AI_CHAT_EMPTY_HTML;
      }
      this.showToast('AI Agent chat history cleared.', 'info');
    });

    // Generate & Stop buttons
    this.getElement('btnAIGenerate')?.addEventListener('click', () => {
      this.runAIAgentPrompt();
    });

    this.getElement('btnAIStop')?.addEventListener('click', () => {
      if (this.aiAbortController) {
        this.aiAbortController.abort();
        this.aiAbortController = null;
      }
    });

    promptInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.runAIAgentPrompt();
      }
    });
  }

  private renderAIAttachments(): void {
    const bar = this.getElement('aiImageAttachmentsBar');
    if (!bar) return;

    if (this.aiPendingImages.length === 0) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = '';
    this.aiPendingImages.forEach((dataUrl, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'ai-attachment-thumb';
      thumb.innerHTML = `
        <img src="${dataUrl}" alt="Reference ${idx + 1}" />
        <button type="button" class="ai-attachment-remove" title="Remove image">&times;</button>
      `;
      thumb.querySelector('.ai-attachment-remove')?.addEventListener('click', () => {
        this.aiPendingImages.splice(idx, 1);
        this.renderAIAttachments();
      });
      bar.appendChild(thumb);
    });
  }

  /**
   * Returns all available AI quick prompt presets.
   */
  public getQuickPrompts(): AIQuickPrompt[] {
    return getAllQuickPrompts();
  }

  /**
   * Initializes the AI Quick Prompts select-like dropdown menu from the JS array.
   * Renders a compact single-row GUI with rich thumbnails, tags, and reference image support.
   */
  private initAIQuickPrompts(): void {
    const container = this.getElement('aiQuickPrompts');
    if (!container) return;

    const wrapper = this.getElement('aiQuickSelectWrapper');
    const selectBtn = this.getElement<HTMLButtonElement>('btnAIQuickSelect');
    const menu = this.getElement('aiQuickPromptMenu');
    const nativeSelect = this.getElement<HTMLSelectElement>('aiQuickPromptSelect');
    const textEl = this.getElement('aiQuickSelectText');
    const thumbWrap = this.getElement('aiQuickSelectThumb');
    const thumbImg = this.getElement<HTMLImageElement>('aiQuickSelectThumbImg');
    const iconEl = this.getElement('aiQuickSelectIcon');
    const promptInput = this.getElement<HTMLTextAreaElement>('aiPromptInput');

    if (!menu) return;

    // Render quick prompt items from the central JS array
    const prompts = getAllQuickPrompts();
    menu.innerHTML = '';
    if (nativeSelect) {
      nativeSelect.innerHTML = '<option value="">Quick Prompts (Examples)...</option>';
    }

    // Top clear/reset option in menu
    const resetItem = document.createElement('button');
    resetItem.type = 'button';
    resetItem.className = 'ai-quick-menu-item';
    resetItem.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
    resetItem.style.marginBottom = '2px';
    resetItem.innerHTML = `
      <div class="ai-quick-item-thumb" style="width: 28px; height: 28px;">
        <span class="ai-quick-item-thumb-placeholder" style="color: var(--text-secondary); font-size: 14px;">&times;</span>
      </div>
      <div class="ai-quick-item-info">
        <div class="ai-quick-item-title" style="color: var(--text-secondary);">Clear / Reset Selection</div>
      </div>
    `;
    resetItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (promptInput) promptInput.value = '';
      this.aiPendingImages = [];
      this.renderAIAttachments();
      if (textEl) textEl.textContent = 'Quick Prompts (Examples)...';
      if (thumbWrap) thumbWrap.style.display = 'none';
      if (iconEl) iconEl.style.display = '';
      if (nativeSelect) nativeSelect.value = '';
      menu.querySelectorAll('.ai-quick-menu-item').forEach((i) => i.classList.remove('active'));
      wrapper?.classList.remove('open');
      menu.style.display = 'none';
      selectBtn?.setAttribute('aria-expanded', 'false');
    });
    menu.appendChild(resetItem);

    const applyPrompt = (prompt: AIQuickPrompt, itemEl?: HTMLElement) => {
      if (promptInput) {
        promptInput.value = prompt.prompt;
        promptInput.focus();
      }

      // Handle image attachment with normalized URL
      const primaryImage = normalizePromptImageUrl(prompt.image);
      const rawImages = prompt.images && prompt.images.length > 0 ? prompt.images : (primaryImage ? [primaryImage] : []);
      if (rawImages.length > 0) {
        const toAttach = rawImages.map((u) => normalizePromptImageUrl(u) || u);
        this.aiPendingImages = [...toAttach];
        this.renderAIAttachments();
        this.showToast(`Selected: ${prompt.title} (+ image attached)`, 'info');
      } else {
        this.showToast(`Selected: ${prompt.title}`, 'info');
      }

      // Update select trigger button UI
      if (textEl) {
        textEl.textContent = `[${prompt.tag}] ${prompt.title}`;
      }
      if (primaryImage && thumbWrap && thumbImg) {
        thumbImg.src = primaryImage;
        thumbWrap.style.display = 'flex';
        if (iconEl) iconEl.style.display = 'none';
      } else {
        if (thumbWrap) thumbWrap.style.display = 'none';
        if (iconEl) iconEl.style.display = '';
      }

      if (nativeSelect) {
        nativeSelect.value = prompt.id;
      }

      // Update active highlight in menu
      menu.querySelectorAll('.ai-quick-menu-item').forEach((i) => i.classList.remove('active'));
      if (itemEl) {
        itemEl.classList.add('active');
      }

      // Close dropdown
      wrapper?.classList.remove('open');
      menu.style.display = 'none';
      selectBtn?.setAttribute('aria-expanded', 'false');
    };

    prompts.forEach((prompt) => {
      // 1. Add to native select for accessibility & syncing
      if (nativeSelect) {
        const opt = document.createElement('option');
        opt.value = prompt.id;
        opt.textContent = `[${prompt.tag}] ${prompt.title}`;
        nativeSelect.appendChild(opt);
      }

      // 2. Add to custom dropdown menu
      const resolvedImg = normalizePromptImageUrl(prompt.image);
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'ai-quick-menu-item ai-prompt-chip';
      itemBtn.setAttribute('data-id', prompt.id);
      itemBtn.setAttribute('data-technique', prompt.technique);
      itemBtn.setAttribute('data-prompt', prompt.prompt);
      if (resolvedImg) itemBtn.setAttribute('data-image', resolvedImg);
      itemBtn.title = `${prompt.title}: ${prompt.description}`;
      itemBtn.setAttribute('role', 'option');

      const thumbHtml = resolvedImg
        ? `<img src="${resolvedImg}" alt="${prompt.title}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><span class="ai-quick-item-thumb-placeholder" style="display: none;">${prompt.tag}</span>`
        : `<span class="ai-quick-item-thumb-placeholder">${prompt.tag}</span>`;

      itemBtn.innerHTML = `
        <div class="ai-quick-item-thumb">
          ${thumbHtml}
        </div>
        <div class="ai-quick-item-info">
          <div class="ai-quick-item-header">
            <span class="ai-quick-item-badge">${prompt.tag}</span>
            <span class="ai-quick-item-title">${prompt.title}</span>
            ${resolvedImg ? '<span class="ai-quick-item-img-tag" title="Includes reference image">IMG</span>' : ''}
          </div>
          <div class="ai-quick-item-desc">${prompt.description}</div>
        </div>
      `;

      itemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPrompt(prompt, itemBtn);
      });

      menu.appendChild(itemBtn);
    });

    // Toggle dropdown open/close on trigger button click
    selectBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper?.classList.contains('open') || menu.style.display === 'flex';
      if (isOpen) {
        wrapper?.classList.remove('open');
        menu.style.display = 'none';
        selectBtn.setAttribute('aria-expanded', 'false');
      } else {
        wrapper?.classList.add('open');
        menu.style.display = 'flex';
        selectBtn.setAttribute('aria-expanded', 'true');
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (wrapper && !wrapper.contains(e.target as unknown as HTMLElement)) {
        wrapper.classList.remove('open');
        menu.style.display = 'none';
        selectBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    // Native select change sync
    nativeSelect?.addEventListener('change', () => {
      const selected = getQuickPromptById(nativeSelect.value);
      if (selected) {
        const itemEl = menu.querySelector<HTMLElement>(`[data-id="${selected.id}"]`) || undefined;
        applyPrompt(selected, itemEl);
      }
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private toggleSpeechRecognition(): void {
    if (this.isRecordingSpeech) {
      this.stopSpeechRecognition();
      return;
    }
    this.startSpeechRecognition();
  }

  private startSpeechRecognition(): void {
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      this.showToast('Speech recognition is not supported in this browser.', 'warning');
      return;
    }

    const promptInput = this.getElement<HTMLTextAreaElement>('aiPromptInput');
    const btnRecord = this.getElement<HTMLButtonElement>('btnAIRecordSpeech');

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang =
        typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

      this.speechInitialPrompt = promptInput?.value || '';

      recognition.onstart = () => {
        this.isRecordingSpeech = true;
        if (btnRecord) {
          btnRecord.classList.add('btn-recording');
          btnRecord.title = 'Listening... Speak into your microphone (click to stop)';
          const label = btnRecord.querySelector('.btn-label');
          if (label) label.textContent = 'Listening...';
        }
        this.showToast('Listening... Speak into your microphone.', 'info');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        if (event && event.results) {
          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res && res[0]) {
              if (res.isFinal) {
                finalTranscript += res[0].transcript;
              } else {
                interimTranscript += res[0].transcript;
              }
            }
          }
        }

        const spoken = (finalTranscript + ' ' + interimTranscript).trim();
        if (promptInput) {
          const base = this.speechInitialPrompt.trim();
          promptInput.value = base ? `${base} ${spoken}` : spoken;
          promptInput.scrollTop = promptInput.scrollHeight;
        }
      };

      recognition.onerror = (event: any) => {
        const errType = event?.error;
        console.warn('[AI Speech Recognition] Error:', errType);
        if (errType === 'not-allowed') {
          this.showToast('Microphone access was denied.', 'error');
        } else if (errType !== 'no-speech' && errType !== 'aborted') {
          this.showToast(`Speech recognition error: ${errType || 'unknown'}`, 'warning');
        }
        this.stopSpeechRecognition();
      };

      recognition.onend = () => {
        this.cleanupSpeechRecognitionUI();
      };

      this.speechRecognition = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('[AI Speech Recognition] Failed to start:', err);
      this.showToast('Failed to start speech recognition.', 'error');
      this.cleanupSpeechRecognitionUI();
    }
  }

  private stopSpeechRecognition(): void {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {
        // ignore
      }
    }
    this.cleanupSpeechRecognitionUI();
  }

  private cleanupSpeechRecognitionUI(): void {
    this.isRecordingSpeech = false;
    this.speechRecognition = null;
    const btnRecord = this.getElement<HTMLButtonElement>('btnAIRecordSpeech');
    if (btnRecord) {
      btnRecord.classList.remove('btn-recording');
      btnRecord.title = 'Voice: Record prompt using Speech-to-Text';
      const label = btnRecord.querySelector('.btn-label');
      if (label) label.textContent = 'Voice';
    }
  }

  public async runAIAgentPrompt(promptOverride?: string): Promise<void> {
    if (this.isRecordingSpeech) {
      this.stopSpeechRecognition();
    }
    const promptInput = this.getElement<HTMLTextAreaElement>('aiPromptInput');
    const endpointInput = this.getElement<HTMLInputElement>('aiEndpointUrlInput');
    const apiKeyInput = this.getElement<HTMLInputElement>('aiApiKeyInput');
    const modelInput = this.getElement<HTMLInputElement>('aiModelInput');
    const chatLog = this.getElement<HTMLElement>('aiChatLog');
    const btnGenerate = this.getElement<HTMLButtonElement>('btnAIGenerate');
    const btnStop = this.getElement<HTMLButtonElement>('btnAIStop');
    const endpointBadge =
      this.getElement<HTMLElement>('aiEndpointSummaryText') || this.getElement<HTMLElement>('aiEndpointBadge');
    const actionModeSelect = this.getElement<HTMLSelectElement>('aiActionModeSelect');
    const includeViewportCheck = this.getElement<HTMLInputElement>('aiIncludeViewportCheck');
    const visualCritiqueCheckQuick = this.getElement<HTMLInputElement>('aiVisualCritiqueCheckQuick');

    const promptText = (promptOverride !== undefined ? promptOverride : promptInput?.value || '').trim();
    const images = [...this.aiPendingImages];

    if (!promptText && images.length === 0) {
      this.showToast('Please enter a prompt or attach a reference image.', 'warning');
      return;
    }

    // Sync any edits in the settings inputs before calling the endpoint
    if (endpointInput?.value.trim() || modelInput?.value.trim() || apiKeyInput?.value !== undefined) {
      const updatedCfg = this.service.aiAgent.saveConfig({
        baseUrl: endpointInput?.value.trim() || this.service.aiAgent.getConfig().baseUrl,
        apiKey: apiKeyInput ? apiKeyInput.value.trim() : this.service.aiAgent.getConfig().apiKey,
        model: modelInput?.value.trim() || this.service.aiAgent.getConfig().model,
      });
      if (endpointInput) endpointInput.value = updatedCfg.baseUrl;
      if (modelInput) modelInput.value = updatedCfg.model;
      if (endpointBadge) {
        const isAgy =
          updatedCfg.baseUrl.includes('/api/antigravity') ||
          updatedCfg.baseUrl.includes('localhost:8787') ||
          updatedCfg.baseUrl.includes('127.0.0.1:8787');
        let host = isAgy ? 'Antigravity' : updatedCfg.baseUrl;
        if (!isAgy) {
          try {
            host = new URL(updatedCfg.baseUrl).host;
          } catch {
            // ignore
          }
        }
        const keyStatus = isAgy
          ? 'Account ✓'
          : updatedCfg.apiKey
            ? 'Key ✓'
            : host.includes('localhost') || host.includes('127.0.0.1')
              ? 'Local'
              : 'No Key';
        endpointBadge.textContent = `${updatedCfg.model} • ${host} (${keyStatus})`;
      }
    }

    if (promptInput && promptOverride === undefined) {
      promptInput.value = '';
    }
    this.aiPendingImages = [];
    this.renderAIAttachments();

    // Remove empty state or welcome banner if present
    chatLog?.querySelector('.ai-chat-empty, .ai-chat-welcome')?.remove();

    // Append user bubble
    if (chatLog) {
      const userEl = document.createElement('div');
      userEl.className = 'ai-msg ai-msg-user';
      const userHeader = document.createElement('div');
      userHeader.className = 'ai-msg-header';
      userHeader.innerHTML = `
        <span class="ai-msg-role"><i class="app-icon" data-lucide="user"></i> You</span>
        <div class="ai-msg-header-right">
          <span class="ai-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button type="button" class="ai-msg-copy-btn" title="Copy prompt" aria-label="Copy prompt">
            <i class="app-icon" data-lucide="copy"></i>
          </button>
        </div>
      `;
      const copyUserBtn = userHeader.querySelector<HTMLButtonElement>('.ai-msg-copy-btn');
      copyUserBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(promptText, copyUserBtn);
      });
      userEl.appendChild(userHeader);

      if (images.length > 0) {
        const imgsDiv = document.createElement('div');
        imgsDiv.className = 'ai-msg-images';
        imgsDiv.innerHTML = images.map((u) => `<img src="${u}" alt="Ref" />`).join('');
        userEl.appendChild(imgsDiv);
      }

      const userTextDiv = document.createElement('div');
      userTextDiv.className = 'ai-msg-text';
      userTextDiv.innerHTML = marked.parse(promptText || '(Image-to-Mesh Reference)', {
        async: false,
        breaks: true,
        gfm: true,
      }) as string;
      userEl.appendChild(userTextDiv);
      chatLog.appendChild(userEl);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Create assistant progress bubble
    const assistantEl = document.createElement('div');
    assistantEl.className = 'ai-msg ai-msg-assistant';

    const assistantHeader = document.createElement('div');
    assistantHeader.className = 'ai-msg-header';
    assistantHeader.innerHTML = `
      <span class="ai-msg-role"><i class="app-icon" data-lucide="bot"></i> AI Mesh Agent</span>
      <div class="ai-msg-header-right">
        <span class="ai-msg-timer" id="aiMsgTimer">Thinking (0s)...</span>
        <button type="button" class="ai-msg-copy-btn" title="Copy response" aria-label="Copy response">
          <i class="app-icon" data-lucide="copy"></i>
        </button>
      </div>
    `;
    const copyAssistantBtn = assistantHeader.querySelector<HTMLButtonElement>('.ai-msg-copy-btn');
    assistantEl.appendChild(assistantHeader);

    // Active Skills Bar - instant feedback of loaded capabilities
    const activeSkills = this.service.aiAgent.getSkills().filter((s) => s.enabled);
    if (activeSkills.length > 0) {
      const skillsBar = document.createElement('div');
      skillsBar.className = 'ai-active-skills-bar';
      skillsBar.innerHTML = `
        <span class="ai-skills-pill-label"><i class="app-icon" data-lucide="sparkles"></i> Active Skills:</span>
        <div class="ai-skills-pills" style="display: inline-flex; flex-wrap: wrap; gap: 3px;">
          ${activeSkills.map((s) => `<span class="ai-skill-pill">${this.escapeHtml(s.name)}</span>`).join('')}
        </div>
      `;
      assistantEl.appendChild(skillsBar);
    }

    // Live Thinking & Reasoning Box
    const thinkingBox = document.createElement('div');
    thinkingBox.className = 'ai-thinking-box';
    thinkingBox.innerHTML = `
      <span class="ai-thinking-spinner"></span>
      <span class="ai-thinking-text">Connecting to endpoint & planning 3D operations...</span>
    `;
    assistantEl.appendChild(thinkingBox);

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'ai-msg-steps';
    const textContainer = document.createElement('div');
    textContainer.className = 'ai-msg-text';
    textContainer.style.display = 'none';

    assistantEl.appendChild(stepsContainer);
    assistantEl.appendChild(textContainer);
    chatLog?.appendChild(assistantEl);
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

    // Refresh icons inside new bubbles
    if (typeof (window as any).lucide?.createIcons === 'function') {
      (window as any).lucide.createIcons();
    }

    copyAssistantBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rawText = assistantEl.getAttribute('data-raw-response') || textContainer.textContent || '';
      this.copyToClipboard(rawText, copyAssistantBtn);
    });

    const startTime = Date.now();
    const timerEl = assistantHeader.querySelector<HTMLElement>('#aiMsgTimer');
    const thinkingTextEl = thinkingBox.querySelector<HTMLElement>('.ai-thinking-text');
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (timerEl) timerEl.textContent = `Thinking (${elapsed}s)...`;
      if (elapsed >= 12 && thinkingTextEl && thinkingTextEl.textContent?.includes('Connecting')) {
        thinkingTextEl.textContent = `Model reasoning & building 3D mesh operations (${elapsed}s)...`;
      }
    }, 1000);

    const stepElements = new Map<string, HTMLElement>();

    if (btnGenerate) btnGenerate.disabled = true;
    if (btnStop) btnStop.style.display = 'inline-flex';
    this.aiAbortController = new AbortController();

    try {
      const modeVal =
        actionModeSelect?.value === 'replace_scene' ? 'replace_scene' : 'create_or_update';
      const result = await this.service.aiAgent.runPrompt({
        prompt: promptText || 'Build a 3D mesh matching the attached reference image.',
        images,
        mode: modeVal,
        includeViewportSnapshot: !!includeViewportCheck?.checked,
        visualCritique: visualCritiqueCheckQuick
          ? !!visualCritiqueCheckQuick.checked
          : this.service.aiAgent.getConfig().visualCritique,
        signal: this.aiAbortController.signal,
        onStep: (step: AIAgentToolExecutionStep) => {
          if (thinkingTextEl) {
            thinkingTextEl.textContent = `Executing tool: ${step.toolName.replace(/^modeler_/, '')}...`;
          }
          const isErr = !!step.isError;
          const statusClass = isErr ? 'error' : 'success';
          let stepEl = stepElements.get(step.id);
          if (!stepEl) {
            stepEl = document.createElement('div');
            stepEl.className = `ai-tool-step is-${statusClass}`;
            stepElements.set(step.id, stepEl);
            stepsContainer.appendChild(stepEl);
          } else {
            stepEl.className = `ai-tool-step is-${statusClass}`;
          }

          const iconSymbol = isErr ? '⚠' : '✓';
          const argSummary =
            step.args?.name ||
            step.args?.meshName ||
            step.args?.targetMeshName ||
            step.args?.materialName ||
            step.args?.shape ||
            '';
          stepEl.innerHTML = `
            <span class="ai-step-icon">${iconSymbol}</span>
            <span class="ai-step-name">${this.escapeHtml(step.toolName.replace(/^modeler_/, ''))}</span>
            <span class="ai-step-summary">${this.escapeHtml(String(argSummary))}</span>
            <span class="ai-step-duration">${step.durationMs ? `${step.durationMs}ms` : ''}</span>
          `;
          if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
        },
        onStatus: (statusText: string) => {
          if (thinkingTextEl) {
            thinkingTextEl.textContent = statusText;
          }
          if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
        },
      });

      clearInterval(timerInterval);
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (timerEl) timerEl.textContent = `Done in ${totalElapsed}s`;
      thinkingBox.remove();

      const responseMarkdown = result.content || 'Completed 3D mesh operations.';
      assistantEl.setAttribute('data-raw-response', responseMarkdown);
      textContainer.style.display = 'block';
      textContainer.innerHTML = marked.parse(responseMarkdown, {
        async: false,
        breaks: true,
        gfm: true,
      }) as string;

      if (modelInput) {
        modelInput.value = this.service.aiAgent.getConfig().model;
      }
      this.updateOutliner();
      this.updateMeshGUI();
      this.updateMaterialGUI();
      this.updateCSGGUI();
    } catch (err: any) {
      clearInterval(timerInterval);
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (timerEl) timerEl.textContent = `Failed after ${totalElapsed}s`;
      thinkingBox.remove();

      assistantEl.classList.add('ai-msg-error');
      textContainer.style.display = 'block';
      const errMsg = err?.message || String(err);
      textContainer.textContent = `Error: ${errMsg}`;
      this.showToast(errMsg, 'error');

      // Automatically open endpoint settings if API key or connection failed
      if (errMsg.includes('401') || errMsg.includes('API key') || errMsg.includes('Endpoint')) {
        this.toggleAISettings(true);
      }
    } finally {
      this.aiAbortController = null;
      if (btnGenerate) btnGenerate.disabled = false;
      if (btnStop) btnStop.style.display = 'none';
      if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  /* =========================================================================
     VOXEL PAINTER UI & CONTROLS
     ========================================================================= */
  private initVoxelPainterUI(): void {
    const btnPaint = this.getElement<HTMLButtonElement>('btnVoxelModePaint');
    const btnErase = this.getElement<HTMLButtonElement>('btnVoxelModeErase');
    const btnPick = this.getElement<HTMLButtonElement>('btnVoxelModePick');
    const sizeInput = this.getElement<HTMLInputElement>('voxelSizeInput');
    const intervalInput = this.getElement<HTMLInputElement>('voxelIntervalInput');
    const atlasSelect = this.getElement<HTMLSelectElement>('voxelAtlasSelect');
    const btnLoadAtlas = this.getElement<HTMLButtonElement>('btnVoxelLoadAtlas');
    const atlasFileInput = this.getElement<HTMLInputElement>('voxelAtlasFileInput');
    const btnBake = this.getElement<HTMLButtonElement>('btnVoxelBake');
    const btnClear = this.getElement<HTMLButtonElement>('btnVoxelClear');
    const btnImport = this.getElement<HTMLButtonElement>('btnVoxelImportJson');
    const btnExport = this.getElement<HTMLButtonElement>('btnVoxelExportJson');
    const jsonFileInput = this.getElement<HTMLInputElement>('voxelJsonFileInput');
    const countBadge = this.getElement<HTMLElement>('voxelBlocksCount');

    const updateModeButtons = (mode: 'paint' | 'erase' | 'pick') => {
      btnPaint?.classList.toggle('active', mode === 'paint');
      btnErase?.classList.toggle('active', mode === 'erase');
      btnPick?.classList.toggle('active', mode === 'pick');
    };

    btnPaint?.addEventListener('click', () => {
      this.service.voxelPainter.setActive(true);
      this.service.voxelPainter.setMode('paint');
      updateModeButtons('paint');
      this.updatePanelButtonStates();
    });
    btnErase?.addEventListener('click', () => {
      this.service.voxelPainter.setActive(true);
      this.service.voxelPainter.setMode('erase');
      updateModeButtons('erase');
      this.updatePanelButtonStates();
    });
    btnPick?.addEventListener('click', () => {
      this.service.voxelPainter.setActive(true);
      this.service.voxelPainter.setMode('pick');
      updateModeButtons('pick');
      this.updatePanelButtonStates();
    });

    sizeInput?.addEventListener('input', () => {
      const val = parseFloat(sizeInput.value);
      if (!isNaN(val) && val > 0) {
        this.service.voxelPainter.setVoxelSize(val);
      }
    });

    intervalInput?.addEventListener('input', () => {
      const val = parseInt(intervalInput.value, 10);
      if (!isNaN(val) && val >= 50) {
        this.service.voxelPainter.paintIntervalMs = val;
      }
    });

    atlasSelect?.addEventListener('change', () => {
      const atlasId = atlasSelect.value;
      if (atlasId) {
        this.service.voxelPainter.useTextureAtlas(atlasId);
        this.renderVoxelPalette();
        this.renderVoxelTextureGallery();
      }
    });

    const handleAtlasFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      try {
        const atlas = await this.service.importAtlasFiles(files);
        this.renderVoxelAtlasOptions();
        this.service.voxelPainter.useTextureAtlas(atlas.id);
        this.renderVoxelPalette();
        this.renderVoxelTextureGallery();
        this.renderEmbeddedTextures();
        this.showToast(`Loaded atlas "${atlas.name}" (${atlas.frames.length} tiles)`, 'success');
      } catch (err: any) {
        this.showToast(`Failed to load atlas: ${err.message}`, 'error');
      }
    };

    btnLoadAtlas?.addEventListener('click', () => {
      atlasFileInput?.click();
    });

    atlasFileInput?.addEventListener('change', async () => {
      await handleAtlasFiles(atlasFileInput.files);
      atlasFileInput.value = '';
    });

    const btnAddTex = this.getElement<HTMLButtonElement>('btnVoxelAddTexture');
    const texFileInput = this.getElement<HTMLInputElement>('voxelTextureFileInput');

    btnAddTex?.addEventListener('click', () => {
      texFileInput?.click();
    });

    texFileInput?.addEventListener('change', async () => {
      const files = texFileInput.files;
      if (!files || files.length === 0) return;

      const fileList = Array.from(files);
      const hasDescriptor = fileList.some((f) => /\.(json|tps|xml)$/i.test(f.name));
      if (hasDescriptor || fileList.length > 1) {
        await handleAtlasFiles(files);
      } else {
        const file = fileList[0];
        try {
          const tex = await this.service.addTextureFromFile(file);
          const url = (tex as any).url || (tex as any)._buffer || '';
          const name = file.name.replace(/\.[^/.]+$/, '');
          this.service.voxelPainter.addTexturePaletteItem(name, url, tex);
          this.renderVoxelPalette();
          this.renderVoxelTextureGallery();
          this.renderEmbeddedTextures();
          this.showToast(`Added texture "${name}" to voxel palette`, 'success');
        } catch (err: any) {
          this.showToast(`Failed to load texture: ${err.message}`, 'error');
        }
      }
      texFileInput.value = '';
    });

    btnBake?.addEventListener('click', () => {
      const mesh = this.service.voxelPainter.bakeToMesh();
      if (mesh) {
        this.showToast(`Baked voxel mesh with ${this.service.voxelPainter.blocks.size} blocks`, 'success');
        this.updateOutliner();
        this.updateMeshGUI();
      } else {
        this.showToast('No voxel blocks to bake', 'warning');
      }
    });

    btnClear?.addEventListener('click', () => {
      this.service.voxelPainter.clear();
      this.showToast('Voxel blocks cleared', 'info');
    });

    btnImport?.addEventListener('click', () => {
      jsonFileInput?.click();
    });

    jsonFileInput?.addEventListener('change', async () => {
      const file = jsonFileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        this.service.voxelPainter.loadVoxelData(data);
        this.renderVoxelPalette();
        this.showToast(`Imported ${this.service.voxelPainter.blocks.size} voxel blocks`, 'success');
      } catch (err: any) {
        this.showToast(`Failed to import voxels: ${err.message}`, 'error');
      } finally {
        jsonFileInput.value = '';
      }
    });

    btnExport?.addEventListener('click', async () => {
      const data = this.service.voxelPainter.exportVoxelData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const filename = 'voxels.json';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Exported voxel data to JSON', 'info');
    });

    this.service.voxelPainter.onBlocksChanged = (count) => {
      if (countBadge) {
        countBadge.textContent = `${count} Block${count === 1 ? '' : 's'}`;
      }
    };

    this.service.voxelPainter.onPaletteChanged = () => {
      this.renderVoxelPalette();
      this.renderVoxelTextureGallery();
    };

    this.service.voxelPainter.onAtlasChanged = () => {
      this.renderVoxelAtlasOptions();
      this.renderVoxelTextureGallery();
    };

    this.service.voxelPainter.onModeChanged = (mode) => {
      updateModeButtons(mode);
    };

    this.renderVoxelAtlasOptions();
    this.renderVoxelPalette();
    this.renderVoxelTextureGallery();
  }

  public renderVoxelAtlasOptions(): void {
    const select = this.getElement<HTMLSelectElement>('voxelAtlasSelect');
    if (!select) return;

    const atlases = this.service.textureAtlasManager.getAtlases();
    const currentAtlas = this.service.voxelPainter.currentAtlas;
    const currentId = currentAtlas ? currentAtlas.id : '';

    select.innerHTML = '';
    for (const atlas of atlases) {
      const opt = document.createElement('option');
      opt.value = atlas.id;
      opt.textContent = `${atlas.name} (${atlas.frames.length} tiles)`;
      if (atlas.id === currentId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
  }

  public renderVoxelPalette(): void {
    const grid = this.getElement<HTMLElement>('voxelPaletteGrid');
    const selectedLabel = this.getElement<HTMLElement>('voxelSelectedMaterialName');
    const activeThumb = this.getElement<HTMLElement>('voxelActiveThumb');
    const activeTitle = this.getElement<HTMLElement>('voxelActiveTitle');
    const activeType = this.getElement<HTMLElement>('voxelActiveType');
    if (!grid) return;

    grid.innerHTML = '';
    const palette = this.service.voxelPainter.getActivePaletteItems();
    const currentId = this.service.voxelPainter.currentPaletteId;

    const activeItem = palette.find((p) => p.id === currentId) || palette[0];
    const updateActivePreview = (item: any) => {
      if (!item) return;
      if (selectedLabel) selectedLabel.textContent = item.name;
      if (activeTitle) activeTitle.textContent = item.name;
      if (activeType) {
        activeType.textContent = item.atlasTile
          ? 'Atlas Tile'
          : item.textureUrl || item.texture
            ? 'Texture Image'
            : 'Solid Color';
      }
      if (activeThumb) {
        const thumb =
          item.atlasTile?.thumbnailDataUrl ||
          (item.atlasTile && item.atlasId
            ? this.service.textureAtlasManager.extractFrameDataUrl(item.atlasId, item.atlasTile.id)
            : null) ||
          item.textureUrl;
        if (thumb) {
          activeThumb.style.backgroundImage = `url("${thumb}")`;
          activeThumb.style.backgroundColor = 'transparent';
        } else if (item.color) {
          activeThumb.style.backgroundImage = 'none';
          activeThumb.style.backgroundColor = item.color;
        }
      }
    };

    if (activeItem) {
      updateActivePreview(activeItem);
    }

    for (const item of palette) {
      const swatch = document.createElement('div');
      swatch.className = 'voxel-palette-swatch';
      const dim = item.atlasTile?.pixelRect ? ` (${item.atlasTile.pixelRect.w}x${item.atlasTile.pixelRect.h}px)` : '';
      swatch.title = `${item.name}${dim}`;
      if (item.id === currentId) {
        swatch.classList.add('active');
      }

      const thumb =
        item.atlasTile?.thumbnailDataUrl ||
        (item.atlasTile && item.atlasId
          ? this.service.textureAtlasManager.extractFrameDataUrl(item.atlasId, item.atlasTile.id)
          : null) ||
        item.textureUrl;
      if (thumb) {
        swatch.style.backgroundImage = `url("${thumb}")`;
        swatch.style.backgroundSize = 'cover';
        swatch.style.imageRendering = 'pixelated';
      } else if (item.color) {
        swatch.style.backgroundColor = item.color;
      }

      swatch.addEventListener('click', () => {
        this.service.voxelPainter.currentPaletteId = item.id;
        grid.querySelectorAll('.voxel-palette-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        updateActivePreview(item);
        this.renderVoxelTextureGallery();
      });

      grid.appendChild(swatch);
    }
  }

  public renderVoxelTextureGallery(): void {
    const gallery = this.getElement<HTMLElement>('voxelTextureGallery');
    if (!gallery) return;

    gallery.innerHTML = '';
    const atlases = this.service.textureAtlasManager.getAtlases();
    const currentAtlasId = this.service.voxelPainter.currentAtlasId;
    const currentPaletteId = this.service.voxelPainter.currentPaletteId;
    const embeddedTextures = this.service.getEmbeddedTexturesInfo();

    // 1. Atlas cards
    for (const atlas of atlases) {
      const card = document.createElement('div');
      card.className = 'voxel-texture-card';
      if (atlas.id === currentAtlasId) {
        card.classList.add('active');
      }
      card.title = `Atlas: ${atlas.name} (${atlas.frames.length} tiles) - Click to load`;

      const img = document.createElement('img');
      img.className = 'voxel-texture-card-thumb';
      img.src = atlas.frames[0]?.thumbnailDataUrl || atlas.dataUrl || '';
      img.alt = atlas.name;
      img.onerror = () => {
        card.style.display = 'none';
      };

      const name = document.createElement('div');
      name.className = 'voxel-texture-card-name';
      name.textContent = atlas.name;

      card.appendChild(img);
      card.appendChild(name);

      card.addEventListener('click', () => {
        this.service.voxelPainter.useTextureAtlas(atlas.id);
        this.renderVoxelAtlasOptions();
        this.renderVoxelPalette();
        this.renderVoxelTextureGallery();
      });

      gallery.appendChild(card);
    }

    // 2. Individual embedded textures
    for (const tex of embeddedTextures) {
      if (tex.isAtlas) continue;
      if (!tex.url) continue;

      const card = document.createElement('div');
      card.className = 'voxel-texture-card';
      const activeItem = this.service.voxelPainter.palette.get(currentPaletteId);
      if (activeItem?.textureUrl === tex.url) {
        card.classList.add('active');
      }
      card.title = `Texture: ${tex.name} (${tex.width}x${tex.height}px) - Click to paint with this`;

      const img = document.createElement('img');
      img.className = 'voxel-texture-card-thumb';
      img.src = tex.url;
      img.alt = tex.name;
      img.onerror = () => {
        card.style.display = 'none';
      };

      const name = document.createElement('div');
      name.className = 'voxel-texture-card-name';
      name.textContent = tex.name;

      card.appendChild(img);
      card.appendChild(name);

      card.addEventListener('click', () => {
        this.service.voxelPainter.addTexturePaletteItem(tex.name, tex.url);
        this.renderVoxelPalette();
        this.renderVoxelTextureGallery();
      });

      gallery.appendChild(card);
    }
  }

  /* =========================================================================
     EMBEDDED TEXTURES & ATLAS OVERVIEW UI
     ========================================================================= */
  private initEmbeddedTexturesUI(): void {
    const btnAdd = this.getElement<HTMLButtonElement>('btnEmbedAddTexture');
    const btnLoadAtlas = this.getElement<HTMLButtonElement>('btnEmbedLoadAtlas');
    const fileInput = this.getElement<HTMLInputElement>('embedTextureFileInput');
    const atlasInput = this.getElement<HTMLInputElement>('embedAtlasFileInput');

    const handleAtlasFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      try {
        const atlas = await this.service.importAtlasFiles(files);
        this.renderEmbeddedTextures();
        this.renderVoxelAtlasOptions();
        this.renderVoxelPalette();
        this.renderVoxelTextureGallery();
        this.renderAtlasTilePicker(atlas.id);
        this.showToast(`Loaded atlas "${atlas.name}" (${atlas.frames.length} tiles)`, 'success');
      } catch (err: any) {
        this.showToast(`Failed to load atlas: ${err.message}`, 'error');
      }
    };

    btnAdd?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;

      const fileList = Array.from(files);
      const hasDescriptor = fileList.some((f) => /\.(json|tps|xml)$/i.test(f.name));
      if (hasDescriptor || fileList.length > 1) {
        await handleAtlasFiles(files);
      } else {
        for (const file of fileList) {
          try {
            await this.service.addTextureFromFile(file);
            this.showToast(`Embedded texture "${file.name}"`, 'success');
          } catch (err: any) {
            this.showToast(`Failed to add texture: ${err.message}`, 'error');
          }
        }
        this.renderEmbeddedTextures();
      }
      fileInput.value = '';
    });

    btnLoadAtlas?.addEventListener('click', () => {
      atlasInput?.click();
    });

    atlasInput?.addEventListener('change', async () => {
      await handleAtlasFiles(atlasInput.files);
      atlasInput.value = '';
    });
  }

  public renderEmbeddedTextures(): void {
    const gallery = this.getElement<HTMLElement>('embeddedTexturesGallery');
    const countBadge = this.getElement<HTMLElement>('embeddedTexturesCount');
    if (!gallery) return;

    const textures = this.service.getEmbeddedTexturesInfo();
    if (countBadge) {
      countBadge.textContent = textures.length.toString();
    }

    gallery.innerHTML = '';
    if (textures.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'textures-empty-state';
      empty.textContent = 'No custom textures embedded yet.';
      gallery.appendChild(empty);
      return;
    }

    for (const tex of textures) {
      if (!tex.url) continue;
      const card = document.createElement('div');
      card.className = 'embedded-texture-card';
      if (tex.isAtlas) {
        card.classList.add('is-atlas');
      }

      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'embedded-texture-thumb';

      const img = document.createElement('img');
      img.src = tex.url;
      img.alt = tex.name;
      img.style.imageRendering = tex.isAtlas ? 'pixelated' : 'auto';
      img.onerror = () => {
        card.style.display = 'none';
      };
      thumbWrapper.appendChild(img);

      const info = document.createElement('div');
      info.className = 'embedded-texture-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'embedded-texture-name';
      nameRow.textContent = tex.name;
      nameRow.title = tex.name;

      const metaRow = document.createElement('div');
      metaRow.className = 'embedded-texture-meta';
      metaRow.textContent = `${tex.width}x${tex.height}px`;

      if (tex.isAtlas) {
        const badge = document.createElement('span');
        badge.className = 'embedded-texture-badge';
        badge.textContent = `Atlas (${tex.framesCount || 16})`;
        metaRow.appendChild(badge);
      }

      info.appendChild(nameRow);
      info.appendChild(metaRow);

      const actions = document.createElement('div');
      actions.className = 'embedded-texture-actions';

      if (tex.isAtlas && tex.atlasId) {
        const atlas = this.service.textureAtlasManager.getAtlas(tex.atlasId);
        const tileCount = atlas ? atlas.frames.length : tex.framesCount || 16;

        const btnTiles = document.createElement('button');
        btnTiles.className = 'tool-btn-xs tool-btn-primary';
        btnTiles.title = `Browse and pick individual tiles from this atlas (${tileCount} tiles)`;
        btnTiles.innerHTML = `<i class="app-icon" data-lucide="grid-3x3"></i> Tiles (${tileCount})`;
        btnTiles.addEventListener('click', (e) => {
          e.stopPropagation();
          this.renderAtlasTilePicker(tex.atlasId!);
        });
        actions.appendChild(btnTiles);

        const btnApplyAll = document.createElement('button');
        btnApplyAll.className = 'tool-btn-xs';
        btnApplyAll.title = 'Apply entire atlas texture to material';
        btnApplyAll.innerHTML = '<i class="app-icon" data-lucide="check"></i> Apply';
        btnApplyAll.addEventListener('click', (e) => {
          e.stopPropagation();
          this.service.applyTextureToSelectedMaterial(tex.url, tex.name);
          this.updateMaterialGUI();
        });
        actions.appendChild(btnApplyAll);

        card.addEventListener('click', () => {
          this.renderAtlasTilePicker(tex.atlasId!);
        });
      } else {
        const btnApply = document.createElement('button');
        btnApply.className = 'tool-btn-xs tool-btn-primary';
        btnApply.title = 'Apply texture to selected mesh material';
        btnApply.innerHTML = '<i class="app-icon" data-lucide="check"></i> Apply';
        btnApply.addEventListener('click', (e) => {
          e.stopPropagation();
          this.service.applyTextureToSelectedMaterial(tex.url, tex.name);
          this.updateMaterialGUI();
        });
        actions.appendChild(btnApply);

        const btnBump = document.createElement('button');
        btnBump.className = 'tool-btn-xs';
        btnBump.title = 'Apply as Normal / Bump Map to selected mesh material';
        btnBump.innerHTML = '<i class="app-icon" data-lucide="layers"></i> Normal';
        btnBump.addEventListener('click', (e) => {
          e.stopPropagation();
          this.service.applyBumpTextureToSelectedMaterial(tex.url, tex.name);
          this.updateMaterialGUI();
        });
        actions.appendChild(btnBump);

        card.addEventListener('click', () => {
          this.service.applyTextureToSelectedMaterial(tex.url, tex.name);
          this.updateMaterialGUI();
        });
      }

      card.appendChild(thumbWrapper);
      card.appendChild(info);
      card.appendChild(actions);

      gallery.appendChild(card);
    }

    this.refreshIcons();
    this.renderVoxelTextureGallery();
  }

  public renderAtlasTilePicker(atlasId: string): void {
    const section = this.getElement<HTMLElement>('atlasTilePickerSection');
    const title = this.getElement<HTMLElement>('atlasTilePickerTitle');
    const grid = this.getElement<HTMLElement>('atlasTilePickerGrid');
    const closeBtn = this.getElement<HTMLButtonElement>('btnCloseAtlasTilePicker');
    const selectedBar = this.getElement<HTMLElement>('atlasTileSelectedBar');
    const selectedPrev = this.getElement<HTMLElement>('atlasTileSelectedPreview');
    const selectedName = this.getElement<HTMLElement>('atlasTileSelectedName');
    const selectedDim = this.getElement<HTMLElement>('atlasTileSelectedDim');
    const btnApply = this.getElement<HTMLButtonElement>('btnApplyAtlasTileToMaterial');
    const btnVoxel = this.getElement<HTMLButtonElement>('btnUseAtlasTileInVoxel');
    if (!section || !grid) return;

    const atlas = this.service.textureAtlasManager.getAtlas(atlasId);
    if (!atlas) return;

    section.style.display = 'flex';
    if (title) {
      title.innerHTML = `<i class="app-icon" data-lucide="grid-3x3"></i> ${atlas.name} (${atlas.frames.length} tiles)`;
    }

    grid.innerHTML = '';
    if (closeBtn) {
      closeBtn.onclick = () => {
        section.style.display = 'none';
      };
    }

    let activeFrameId: string | null = atlas.frames[0]?.id || null;

    const updateSelectedBar = (frame: any) => {
      if (!frame || !selectedBar) return;
      activeFrameId = frame.id;
      selectedBar.style.display = 'flex';

      const thumb =
        frame.thumbnailDataUrl ||
        this.service.textureAtlasManager.extractFrameDataUrl(atlas.id, frame.id) ||
        atlas.dataUrl;
      if (selectedPrev && thumb) {
        selectedPrev.style.backgroundImage = `url("${thumb}")`;
      }
      if (selectedName) {
        selectedName.textContent = frame.name;
      }
      if (selectedDim) {
        const dim = frame.pixelRect
          ? `${frame.pixelRect.w}x${frame.pixelRect.h}px`
          : `${atlas.tileSize}x${atlas.tileSize}px`;
        selectedDim.textContent = dim;
      }
    };

    for (const frame of atlas.frames) {
      const swatch = document.createElement('div');
      swatch.className = 'atlas-tile-picker-swatch';
      const dim = frame.pixelRect ? `${frame.pixelRect.w}x${frame.pixelRect.h}px` : `${atlas.tileSize}px`;
      swatch.title = `${frame.name} (${dim}) - Click to select, double-click to apply`;

      const thumb =
        frame.thumbnailDataUrl ||
        this.service.textureAtlasManager.extractFrameDataUrl(atlas.id, frame.id) ||
        atlas.dataUrl;
      if (thumb) {
        swatch.style.backgroundImage = `url("${thumb}")`;
      }

      if (frame.id === activeFrameId) {
        swatch.classList.add('active');
        updateSelectedBar(frame);
      }

      swatch.addEventListener('click', () => {
        grid.querySelectorAll('.atlas-tile-picker-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        updateSelectedBar(frame);
      });

      swatch.addEventListener('dblclick', () => {
        this.service.applyAtlasFrameToSelectedMaterial(atlas.id, frame.id);
        this.updateMaterialGUI();
      });

      grid.appendChild(swatch);
    }

    if (btnApply) {
      btnApply.onclick = () => {
        if (!activeFrameId) return;
        this.service.applyAtlasFrameToSelectedMaterial(atlas.id, activeFrameId);
        this.updateMaterialGUI();
      };
    }

    if (btnVoxel) {
      btnVoxel.onclick = () => {
        if (!activeFrameId) return;
        this.service.useAtlasFrameInVoxelPainter(atlas.id, activeFrameId);
        this.toggleDialog('dialog-voxel-painter', true);
        this.renderVoxelAtlasOptions();
        this.renderVoxelPalette();
      };
    }

    this.refreshIcons();
  }

  /* =========================================================================
     PATH EXTRUSION & SPLINE STUDIO UI
     ========================================================================= */
  private initPathExtrusionUI(): void {
    const pathSelect = this.getElement<HTMLSelectElement>('pathExtrusionSelect') || this.getElement<HTMLSelectElement>('pathwaySelect');
    const btnNew = this.getElement<HTMLButtonElement>('btnPathExtrusionNew') || this.getElement<HTMLButtonElement>('btnPathNew');
    const btnDelete = this.getElement<HTMLButtonElement>('btnPathExtrusionDelete') || this.getElement<HTMLButtonElement>('btnPathDelete');
    const shapeTypeSelect = this.getElement<HTMLSelectElement>('pathExtrusionShapeType') || this.getElement<HTMLSelectElement>('pathwayShapeType');
    const widthInput = this.getElement<HTMLInputElement>('pathExtrusionWidth') || this.getElement<HTMLInputElement>('pathwayWidth');
    const heightInput = this.getElement<HTMLInputElement>('pathExtrusionHeight') || this.getElement<HTMLInputElement>('pathwayHeight');
    const thicknessInput = this.getElement<HTMLInputElement>('pathExtrusionThickness') || this.getElement<HTMLInputElement>('pathwayThickness');
    const smoothStepsInput = this.getElement<HTMLInputElement>('pathExtrusionSmoothSteps') || this.getElement<HTMLInputElement>('pathwaySmoothSteps');
    const scaleInput = this.getElement<HTMLInputElement>('pathExtrusionScale') || this.getElement<HTMLInputElement>('pathwayScale');
    const twistInput = this.getElement<HTMLInputElement>('pathExtrusionTwist') || this.getElement<HTMLInputElement>('pathwayTwist');
    const colorInput = this.getElement<HTMLInputElement>('pathExtrusionColor') || this.getElement<HTMLInputElement>('pathwayColor');
    const colorHex = this.getElement<HTMLElement>('pathExtrusionColorHex') || this.getElement<HTMLElement>('pathwayColorHex');
    const btnRemovePoint = this.getElement<HTMLButtonElement>('btnPathExtrusionRemovePoint') || this.getElement<HTMLButtonElement>('btnPathRemovePoint');
    const btnClearPoints = this.getElement<HTMLButtonElement>('btnPathExtrusionClearPoints') || this.getElement<HTMLButtonElement>('btnPathClearPoints');
    const btnBake = this.getElement<HTMLButtonElement>('btnPathExtrusionBakeMesh') || this.getElement<HTMLButtonElement>('btnPathBakeMesh');

    pathSelect?.addEventListener('change', () => {
      this.service.pathExtrusion.selectPath(pathSelect.value);
      this.renderPathExtrusionUI();
    });

    btnNew?.addEventListener('click', () => {
      const created = this.service.pathExtrusion.addNewPath();
      this.renderPathExtrusionUI();
      this.showToast(`Created new path extrusion "${created.name}"`, 'success');
    });

    btnDelete?.addEventListener('click', () => {
      const active = this.service.pathExtrusion.activePath;
      if (!active) return;
      this.service.pathExtrusion.deletePath(active.id);
      this.renderPathExtrusionUI();
      this.showToast(`Deleted path extrusion "${active.name}"`, 'info');
    });

    shapeTypeSelect?.addEventListener('change', () => {
      this.service.pathExtrusion.updateShapeConfig({ shapeType: shapeTypeSelect.value as any });
    });

    const updateParams = () => {
      const cfg: any = {};
      if (widthInput) {
        const val = parseFloat(widthInput.value) || 1.0;
        cfg.width = val;
        cfg.radius = val / 2;
      }
      if (heightInput) cfg.height = parseFloat(heightInput.value) || 0.5;
      if (thicknessInput) cfg.thickness = parseFloat(thicknessInput.value) || 0;
      if (smoothStepsInput) cfg.smoothSteps = parseInt(smoothStepsInput.value, 10) || 10;
      if (scaleInput) cfg.scale = parseFloat(scaleInput.value) || 1.0;
      if (twistInput) cfg.twist = parseFloat(twistInput.value) || 0;
      this.service.pathExtrusion.updateShapeConfig(cfg);
    };

    widthInput?.addEventListener('input', updateParams);
    heightInput?.addEventListener('input', updateParams);
    thicknessInput?.addEventListener('input', updateParams);
    smoothStepsInput?.addEventListener('input', updateParams);
    scaleInput?.addEventListener('input', updateParams);
    twistInput?.addEventListener('input', updateParams);

    colorInput?.addEventListener('input', () => {
      if (colorHex) colorHex.textContent = colorInput.value;
      this.service.pathExtrusion.updateShapeConfig({ color: colorInput.value });
    });

    btnRemovePoint?.addEventListener('click', () => {
      this.service.pathExtrusion.removeSelectedPoint();
    });

    btnClearPoints?.addEventListener('click', () => {
      this.service.pathExtrusion.clearPoints();
      this.showToast('Cleared all path extrusion points', 'info');
    });

    btnBake?.addEventListener('click', () => {
      const mesh = this.service.pathExtrusion.bakeMesh();
      if (mesh) {
        this.renderPathExtrusionUI();
      }
    });

    const btnOpenStudio = this.getElement<HTMLButtonElement>('btnOpenPathExtrusionStudio');
    btnOpenStudio?.addEventListener('click', () => {
      this.service.pathExtrusion.setActive(true);
      PathExtrusionStudio.open(this.service, this.service.pathExtrusion, () => {
        this.updatePanelButtonStates();
      });
      this.updatePanelButtonStates();
    });

    this.service.pathExtrusion.onStateChanged = () => {
      this.renderPathExtrusionUI();
      if (PathExtrusionStudio.isOpen()) {
        PathExtrusionStudio.open(this.service, this.service.pathExtrusion).refresh();
      }
    };
  }

  private renderPathExtrusionUI(): void {
    const pathSelect = this.getElement<HTMLSelectElement>('pathExtrusionSelect') || this.getElement<HTMLSelectElement>('pathwaySelect');
    const shapeTypeSelect = this.getElement<HTMLSelectElement>('pathExtrusionShapeType') || this.getElement<HTMLSelectElement>('pathwayShapeType');
    const widthInput = this.getElement<HTMLInputElement>('pathExtrusionWidth') || this.getElement<HTMLInputElement>('pathwayWidth');
    const heightInput = this.getElement<HTMLInputElement>('pathExtrusionHeight') || this.getElement<HTMLInputElement>('pathwayHeight');
    const thicknessInput = this.getElement<HTMLInputElement>('pathExtrusionThickness') || this.getElement<HTMLInputElement>('pathwayThickness');
    const smoothStepsInput = this.getElement<HTMLInputElement>('pathExtrusionSmoothSteps') || this.getElement<HTMLInputElement>('pathwaySmoothSteps');
    const scaleInput = this.getElement<HTMLInputElement>('pathExtrusionScale') || this.getElement<HTMLInputElement>('pathwayScale');
    const twistInput = this.getElement<HTMLInputElement>('pathExtrusionTwist') || this.getElement<HTMLInputElement>('pathwayTwist');
    const colorInput = this.getElement<HTMLInputElement>('pathExtrusionColor') || this.getElement<HTMLInputElement>('pathwayColor');
    const colorHex = this.getElement<HTMLElement>('pathExtrusionColorHex') || this.getElement<HTMLElement>('pathwayColorHex');

    if (pathSelect) {
      const currentVal = this.service.pathExtrusion.activePathId;
      pathSelect.innerHTML = '';
      if (this.service.pathExtrusion.paths.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No paths created yet';
        pathSelect.appendChild(opt);
      } else {
        for (const p of this.service.pathExtrusion.paths) {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.name} (${p.points.length} pts)`;
          if (p.id === currentVal) opt.selected = true;
          pathSelect.appendChild(opt);
        }
      }
    }

    const active = this.service.pathExtrusion.activePath;
    if (!active) return;
    const cfg = active.shapeConfig;

    if (shapeTypeSelect && cfg.shapeType) shapeTypeSelect.value = cfg.shapeType;
    if (widthInput && cfg.width !== undefined) widthInput.value = String(cfg.width);
    if (heightInput && cfg.height !== undefined) heightInput.value = String(cfg.height);
    if (thicknessInput && cfg.thickness !== undefined) thicknessInput.value = String(cfg.thickness);
    if (smoothStepsInput && cfg.smoothSteps !== undefined) smoothStepsInput.value = String(cfg.smoothSteps);
    if (scaleInput && cfg.scale !== undefined) scaleInput.value = String(cfg.scale);
    if (twistInput && cfg.twist !== undefined) twistInput.value = String(cfg.twist);
    if (colorInput && cfg.color) colorInput.value = cfg.color;
    if (colorHex && cfg.color) colorHex.textContent = cfg.color;
  }

  // Backward compatibility aliases
  private initPathWaysUI(): void {
    this.initPathExtrusionUI();
  }

  private renderPathWaysUI(): void {
    this.renderPathExtrusionUI();
  }

  /* =========================================================================
     COMPRESS MODEL EDITOR TOOL UI
     ========================================================================= */
  private initCompressModelUI(): void {
    const dialog = this.getElement('dialog-compress-model');
    if (!dialog) return;

    const sourceSelect = this.getElement<HTMLSelectElement>('compressModelSourceSelect');
    const dropZone = this.getElement('compressDropZone');
    const dropZoneInner = this.getElement('compressDropZoneInner');
    const fileInput = this.getElement<HTMLInputElement>('compressFileInput');
    const browseLink = this.getElement('compressBrowseLink');
    const fileInfo = this.getElement('compressLoadedFileInfo');
    const fileNameEl = this.getElement('compressLoadedFileName');
    const fileSizeEl = this.getElement('compressLoadedFileSize');
    const btnClearFile = this.getElement('btnCompressClearFile');

    const presetSelect = this.getElement<HTMLSelectElement>('compressPresetSelect');
    const presetDesc = this.getElement('compressPresetDesc');
    const advancedBox = this.getElement('compressAdvancedSection');

    const chkWeld = this.getElement<HTMLInputElement>('chkCompressWeld');
    const chkDegenerate = this.getElement<HTMLInputElement>('chkCompressDegenerate');
    const chkUnused = this.getElement<HTMLInputElement>('chkCompressUnused');
    const chkDraco = this.getElement<HTMLInputElement>('chkCompressDraco');
    const sliderDecimate = this.getElement<HTMLInputElement>('sliderCompressDecimate');
    const decimateVal = this.getElement('compressDecimateValue');
    const chkWebP = this.getElement<HTMLInputElement>('chkCompressWebP');

    const formatSelect = this.getElement<HTMLSelectElement>('compressExportFormatSelect');
    const btnDownload = this.getElement('btnCompressDownload');
    const btnApplyScene = this.getElement('btnCompressApplyScene');

    // 1. Source selector
    sourceSelect?.addEventListener('change', () => {
      const isFile = sourceSelect.value === 'file';
      if (dropZone) dropZone.style.display = isFile ? 'block' : 'none';
      if (btnApplyScene) {
        btnApplyScene.innerHTML = isFile
          ? '<i class="app-icon" data-lucide="folder-input"></i> Load File into Scene'
          : '<i class="app-icon" data-lucide="check"></i> Apply to Scene';
        this.refreshIcons();
      }
      this.updateCompressModelUI();
    });

    // 2. Drag & Drop / File picking
    const handleFile = (file: File) => {
      this.compressLoadedFile = file;
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = this.formatBytes(file.size);
      if (fileInfo) fileInfo.style.display = 'flex';
      if (dropZoneInner) dropZoneInner.style.display = 'none';
      this.refreshIcons();
      this.updateCompressModelUI();
    };

    browseLink?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    dropZone?.addEventListener('click', () => {
      if (!this.compressLoadedFile) fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) handleFile(f);
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    });

    btnClearFile?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.compressLoadedFile = null;
      if (fileInput) fileInput.value = '';
      if (fileInfo) fileInfo.style.display = 'none';
      if (dropZoneInner) dropZoneInner.style.display = 'flex';
      this.updateCompressModelUI();
    });

    // 3. Preset changes
    presetSelect?.addEventListener('change', () => {
      const p = presetSelect.value;
      if (advancedBox) advancedBox.style.display = p === 'custom' ? 'flex' : 'none';

      if (presetDesc) {
        switch (p) {
          case 'lossless':
            presetDesc.textContent =
              'Removes duplicate vertices and unused geometry data without altering any polygons.';
            if (chkWeld) chkWeld.checked = true;
            if (chkDegenerate) chkDegenerate.checked = true;
            if (chkUnused) chkUnused.checked = true;
            if (chkDraco) chkDraco.checked = false;
            if (sliderDecimate) sliderDecimate.value = '0';
            if (decimateVal) decimateVal.textContent = '0% (Lossless)';
            break;
          case 'draco_balanced':
            presetDesc.textContent =
              'Cleaned geometry + Khronos Draco bitstream compression (GLB/GLTF) for up to 75% size reduction.';
            if (chkWeld) chkWeld.checked = true;
            if (chkDegenerate) chkDegenerate.checked = true;
            if (chkUnused) chkUnused.checked = true;
            if (chkDraco) chkDraco.checked = true;
            if (sliderDecimate) sliderDecimate.value = '0';
            if (decimateVal) decimateVal.textContent = '0% (Lossless)';
            if (formatSelect) formatSelect.value = 'glb';
            break;
          case 'draco_ultra':
            presetDesc.textContent =
              'Aggressive Draco quantization for maximum network streaming compression.';
            if (chkWeld) chkWeld.checked = true;
            if (chkDegenerate) chkDegenerate.checked = true;
            if (chkUnused) chkUnused.checked = true;
            if (chkDraco) chkDraco.checked = true;
            if (sliderDecimate) sliderDecimate.value = '0';
            if (decimateVal) decimateVal.textContent = '0% (Lossless)';
            if (formatSelect) formatSelect.value = 'glb';
            break;
          case 'decimate_50':
            presetDesc.textContent =
              'Reduces triangle count by 50% with Quadric Error Metrics, plus Draco compression.';
            if (chkWeld) chkWeld.checked = true;
            if (chkDegenerate) chkDegenerate.checked = true;
            if (chkUnused) chkUnused.checked = true;
            if (chkDraco) chkDraco.checked = true;
            if (sliderDecimate) sliderDecimate.value = '50';
            if (decimateVal) decimateVal.textContent = '50% (Decimation)';
            if (formatSelect) formatSelect.value = 'glb';
            break;
          case 'custom':
            presetDesc.textContent =
              'Custom configuration: configure welding, Draco, decimation, and texture compression.';
            break;
        }
      }
      this.updateCompressModelUI();
    });

    sliderDecimate?.addEventListener('input', () => {
      const v = parseInt(sliderDecimate.value, 10);
      if (decimateVal) decimateVal.textContent = v === 0 ? '0% (Lossless)' : `${v}% (Decimation)`;
      this.updateCompressModelUI();
    });

    // 4. Compress & Download
    btnDownload?.addEventListener('click', async () => {
      await this.executeCompressModel(true);
    });

    // 5. Apply to Scene
    btnApplyScene?.addEventListener('click', async () => {
      await this.executeCompressModel(false);
    });

    this.updateCompressModelUI();
  }

  public updateCompressModelUI(): void {
    const dialog = this.getElement('dialog-compress-model');
    if (!dialog) return;

    const sourceSelect = this.getElement<HTMLSelectElement>('compressModelSourceSelect');
    const isFile = sourceSelect?.value === 'file';
    const metricSize = this.getElement('compressMetricSize');
    const metricVerts = this.getElement('compressMetricVerts');
    const metricFaces = this.getElement('compressMetricFaces');
    const savingsBadge = this.getElement('compressSavingsBadge');
    const statusNotice = this.getElement('compressStatusNotice');

    if (isFile) {
      if (!this.compressLoadedFile) {
        if (metricSize) metricSize.textContent = '--';
        if (metricVerts) metricVerts.textContent = '--';
        if (metricFaces) metricFaces.textContent = '--';
        if (savingsBadge) savingsBadge.style.display = 'none';
        if (statusNotice) statusNotice.textContent = 'Drop a 3D model file above to analyze and compress.';
        return;
      }

      if (metricSize) metricSize.textContent = this.formatBytes(this.compressLoadedFile.size);
      if (statusNotice) {
        statusNotice.textContent = `File ready: "${this.compressLoadedFile.name}". Click Compress & Download.`;
      }
      return;
    }

    // Active scene mode
    const targetMeshes = this.service.selectedMesh
      ? [this.service.selectedMesh]
      : this.service.importedMeshes.filter((m) => !m.isDisposed() && m.isEnabled());

    if (targetMeshes.length === 0) {
      if (metricSize) metricSize.textContent = '0 B';
      if (metricVerts) metricVerts.textContent = '0';
      if (metricFaces) metricFaces.textContent = '0';
      if (savingsBadge) savingsBadge.style.display = 'none';
      if (statusNotice) statusNotice.textContent = 'No 3D objects in scene. Create or import a mesh first.';
      return;
    }

    let totalVerts = 0;
    let totalFaces = 0;
    for (const m of targetMeshes) {
      totalVerts += m.getTotalVertices();
      totalFaces += m.getTotalIndices() > 0 ? m.getTotalIndices() / 3 : 0;
    }

    const approxBytes = ModelCompressor.calculateMeshesBufferBytes(targetMeshes);
    if (metricSize) metricSize.textContent = this.formatBytes(approxBytes);
    if (metricVerts) metricVerts.textContent = totalVerts.toLocaleString();
    if (metricFaces) metricFaces.textContent = totalFaces.toLocaleString();
    if (statusNotice) {
      statusNotice.textContent = `${targetMeshes.length} object(s) ready. Select preset and click Compress.`;
    }
  }

  private displayCompressStats(data: {
    originalBytes: number;
    compressedBytes: number;
    savedPercent: number;
    originalVerts: number;
    compressedVerts: number;
    originalFaces: number;
    compressedFaces: number;
    weldedVerts: number;
    cleanedFaces: number;
  }): void {
    const metricSize = this.getElement('compressMetricSize');
    const metricVerts = this.getElement('compressMetricVerts');
    const metricFaces = this.getElement('compressMetricFaces');
    const savingsBadge = this.getElement('compressSavingsBadge');
    const statusNotice = this.getElement('compressStatusNotice');

    if (savingsBadge) {
      savingsBadge.textContent = `-${data.savedPercent}%`;
      savingsBadge.style.display = 'inline-block';
    }

    if (metricSize) {
      metricSize.textContent = `${this.formatBytes(data.compressedBytes)}`;
    }
    if (metricVerts) {
      metricVerts.textContent = `${data.compressedVerts.toLocaleString()}`;
    }
    if (metricFaces) {
      metricFaces.textContent = `${data.compressedFaces.toLocaleString()}`;
    }

    if (statusNotice) {
      statusNotice.innerHTML =
        `Saved <strong>${data.savedPercent}%</strong> (${this.formatBytes(data.originalBytes)} → ${this.formatBytes(data.compressedBytes)})<br>` +
        `Welded <strong>${data.weldedVerts.toLocaleString()}</strong> duplicate vertices, stripped <strong>${data.cleanedFaces}</strong> degenerate faces.`;
    }
  }

  private async executeCompressModel(download: boolean): Promise<void> {
    const sourceSelect = this.getElement<HTMLSelectElement>('compressModelSourceSelect');
    const isFile = sourceSelect?.value === 'file';
    const presetSelect = this.getElement<HTMLSelectElement>('compressPresetSelect');
    const formatSelect = this.getElement<HTMLSelectElement>('compressExportFormatSelect');
    const statusNotice = this.getElement('compressStatusNotice');

    const chkWeld = this.getElement<HTMLInputElement>('chkCompressWeld');
    const chkDegenerate = this.getElement<HTMLInputElement>('chkCompressDegenerate');
    const chkUnused = this.getElement<HTMLInputElement>('chkCompressUnused');
    const chkDraco = this.getElement<HTMLInputElement>('chkCompressDraco');
    const sliderDecimate = this.getElement<HTMLInputElement>('sliderCompressDecimate');
    const chkWebP = this.getElement<HTMLInputElement>('chkCompressWebP');

    const preset = (presetSelect?.value || 'lossless') as any;
    const exportFormat = (formatSelect?.value || 'glb') as any;
    const decimateRatio = sliderDecimate ? (100 - parseInt(sliderDecimate.value, 10)) / 100 : 1.0;

    const options: ModelCompressorOptions = ModelCompressor.resolveOptions({
      preset,
      weldVertices: chkWeld ? chkWeld.checked : true,
      removeDegenerateFaces: chkDegenerate ? chkDegenerate.checked : true,
      removeUnusedVertices: chkUnused ? chkUnused.checked : true,
      dracoCompression: chkDraco ? chkDraco.checked : (preset.includes('draco') || preset === 'decimate_50'),
      simplifyMesh: decimateRatio < 1.0,
      simplifyRatio: decimateRatio,
      optimizeTextures: chkWebP ? chkWebP.checked : false,
      exportFormat,
    });

    if (statusNotice) statusNotice.textContent = 'Compressing 3D model in browser...';
    this.service.events.onStatusChanged?.('Compressing 3D model...', true);

    try {
      if (isFile) {
        if (!this.compressLoadedFile) {
          this.showToast('Please select or drop a 3D file first.', 'warning');
          return;
        }

        const file = this.compressLoadedFile;
        if (!download) {
          // "Apply to Scene" for file means load it into the editor scene!
          await this.service.loadFiles([file]);
          await this.service.compressActiveModel(options);
          this.showToast(`Imported and compressed "${file.name}" into scene.`, 'success');
          this.updateCompressModelUI();
          return;
        }

        const loaded = await ModelCompressor.loadModelFromFile(file, this.service.engine);
        try {
          const stats = await ModelCompressor.optimizeMeshes(loaded.meshes, options);
          const exported = await ModelCompressor.exportCompressedModel(
            loaded.scene,
            loaded.meshes,
            file.name,
            options
          );

          this.triggerDownloadBlob(exported.blob, exported.filename);

          const savedBytes = Math.max(0, file.size - exported.size);
          const savedPercent = file.size > 0 ? Math.round((savedBytes / file.size) * 100) : 0;
          this.showToast(
            `Model compressed! Reduced by ${savedPercent}% (${this.formatBytes(file.size)} → ${this.formatBytes(exported.size)}).`,
            'success'
          );

          this.displayCompressStats({
            originalBytes: file.size,
            compressedBytes: exported.size,
            savedPercent,
            originalVerts: stats.originalVertices,
            compressedVerts: stats.compressedVertices,
            originalFaces: stats.originalFaces,
            compressedFaces: stats.compressedFaces,
            weldedVerts: stats.duplicateVerticesRemoved,
            cleanedFaces: stats.degenerateFacesRemoved,
          });
        } finally {
          loaded.dispose();
        }
      } else {
        // Scene mode
        if (download) {
          const targetMeshes = this.service.selectedMesh
            ? [this.service.selectedMesh]
            : this.service.importedMeshes.filter((m) => !m.isDisposed() && m.isEnabled());
          const beforeBytes = ModelCompressor.calculateMeshesBufferBytes(targetMeshes);
          const exported = await this.service.exportCompressedActiveModel(options);
          this.triggerDownloadBlob(exported.blob, exported.filename);

          const savedBytes = Math.max(0, beforeBytes - exported.size);
          const savedPercent = beforeBytes > 0 ? Math.round((savedBytes / beforeBytes) * 100) : 0;
          this.showToast(
            `Exported compressed model "${exported.filename}" (${this.formatBytes(exported.size)})!`,
            'success'
          );

          this.displayCompressStats({
            originalBytes: beforeBytes,
            compressedBytes: exported.size,
            savedPercent,
            originalVerts: targetMeshes.reduce((acc, m) => acc + m.getTotalVertices(), 0),
            compressedVerts: targetMeshes.reduce((acc, m) => acc + m.getTotalVertices(), 0),
            originalFaces: targetMeshes.reduce((acc, m) => acc + m.getTotalIndices() / 3, 0),
            compressedFaces: targetMeshes.reduce((acc, m) => acc + m.getTotalIndices() / 3, 0),
            weldedVerts: 0,
            cleanedFaces: 0,
          });
        } else {
          const stats = await this.service.compressActiveModel(options);
          this.showToast(
            `Compressed scene! Welded ${stats.duplicateVerticesRemoved} duplicate vertices, stripped ${stats.degenerateFacesRemoved} degenerate faces.`,
            'success'
          );

          this.displayCompressStats({
            originalBytes: stats.originalSizeBytes,
            compressedBytes: stats.compressedSizeBytes,
            savedPercent: stats.byteSavingsPercent,
            originalVerts: stats.originalVertices,
            compressedVerts: stats.compressedVertices,
            originalFaces: stats.originalFaces,
            compressedFaces: stats.compressedFaces,
            weldedVerts: stats.duplicateVerticesRemoved,
            cleanedFaces: stats.degenerateFacesRemoved,
          });
        }
      }
    } catch (err: any) {
      console.error('[MeshEditorApp] Model compression error:', err);
      this.showToast(`Compression failed: ${err.message || err}`, 'error');
      if (statusNotice) statusNotice.textContent = `Error: ${err.message || err}`;
    } finally {
      this.service.events.onStatusChanged?.('Ready');
    }
  }

  private triggerDownloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /* =========================================================================
     FIGURE SCULPT & RETOPOLOGY TOOL UI
     ========================================================================= */
  public openSculptTool(): void {
    this.service.sculptController.setActive(true);
    this.updateSculptUI();
  }

  public closeSculptTool(): void {
    this.service.sculptController.setActive(false);
  }

  public initSculptUI(): void {
    const dialog = this.getElement('dialog-sculpt');
    if (!dialog) return;

    // Hook model modification
    this.service.sculptController.onMeshModified = () => {
      this.updateSculptUI();
    };

    // Clicking anywhere in the sculpt dialog reactivates sculpt mode if it was dormant
    dialog.addEventListener('click', () => {
      if (!this.service.sculptController.isActive) {
        this.service.sculptController.setActive(true);
        this.updatePanelButtonStates();
      }
    });

    // Brush selection pills
    const brushButtons = dialog.querySelectorAll<HTMLButtonElement>('.btn-sculpt-brush');
    brushButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        brushButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const brush = (btn.dataset.brush || 'clay') as SculptBrushType;
        this.service.sculptController.setBrushType(brush);
        this.service.sculptController.setActive(true);
        this.updatePanelButtonStates();
      });
    });

    // Radius controls
    const sliderRadius = this.getElement<HTMLInputElement>('sliderSculptRadius');
    const valRadius = this.getElement('sculptRadiusValue');
    if (sliderRadius) {
      sliderRadius.addEventListener('input', () => {
        const val = parseFloat(sliderRadius.value);
        if (valRadius) valRadius.textContent = val.toFixed(2);
        this.service.sculptController.setRadius(val);
      });
    }

    // Strength controls
    const sliderStrength = this.getElement<HTMLInputElement>('sliderSculptStrength');
    const valStrength = this.getElement('sculptStrengthValue');
    if (sliderStrength) {
      sliderStrength.addEventListener('input', () => {
        const val = parseFloat(sliderStrength.value);
        if (valStrength) valStrength.textContent = val.toFixed(2);
        this.service.sculptController.setStrength(val);
      });
    }

    // Symmetry & Invert checkboxes
    const chkSymmetry = this.getElement<HTMLInputElement>('chkSculptSymmetry');
    if (chkSymmetry) {
      chkSymmetry.addEventListener('change', () => {
        this.service.sculptController.setSymmetry(chkSymmetry.checked);
      });
    }
    const chkInvert = this.getElement<HTMLInputElement>('chkSculptInvert');
    if (chkInvert) {
      chkInvert.addEventListener('change', () => {
        this.service.sculptController.setInvert(chkInvert.checked);
      });
    }

    // Base Mesh Spawners
    const getSelectedPose = (): 't_pose' | 'a_pose' => {
      const selectPose = this.getElement<HTMLSelectElement>('selectSculptPose');
      return selectPose?.value === 'a_pose' ? 'a_pose' : 't_pose';
    };

    const getSelectedStyle = (): 'organic' | 'mannequin' => {
      const selectStyle = this.getElement<HTMLSelectElement>('selectSculptStyle');
      return selectStyle?.value === 'mannequin' ? 'mannequin' : 'organic';
    };

    this.getElement('btnSpawnHumanoidBase')?.addEventListener('click', () => {
      const pose = getSelectedPose();
      const style = getSelectedStyle();
      const mesh = this.service.sculptController.spawnHumanoidBaseMesh({ pose, style });
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Humanoid Base Mesh "${mesh.name}" (8-Head ${pose === 't_pose' ? 'T-Pose' : 'A-Pose'}).`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    this.getElement('btnSpawnChibiBase')?.addEventListener('click', () => {
      const pose = getSelectedPose();
      const style = getSelectedStyle();
      const mesh = this.service.sculptController.spawnChibiBaseMesh({ pose, style });
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Chibi / Toon Base Mesh "${mesh.name}" (3.5-Head ${pose === 't_pose' ? 'T-Pose' : 'A-Pose'}, ${style}).`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    this.getElement('btnSpawnCreatureBase')?.addEventListener('click', () => {
      const mesh = this.service.sculptController.spawnOrganicCreatureBaseMesh();
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Organic Creature / Demon Base Mesh "${mesh.name}" (Soft Continuous Contours).`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    this.getElement('btnSpawnQuadrupedBase')?.addEventListener('click', () => {
      const mesh = this.service.sculptController.spawnQuadrupedBaseMesh();
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Quadruped Base Mesh "${mesh.name}" (Digitigrade locomotion).`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    this.getElement('btnSpawnHeadBust')?.addEventListener('click', () => {
      const mesh = this.service.sculptController.spawnHeadBust();
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Head & Facial Plane Bust "${mesh.name}".`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    this.getElement('btnSpawnSculptSphere')?.addEventListener('click', () => {
      const mesh = this.service.sculptController.spawnSculptSphere();
      this.service.sculptController.setActive(true);
      this.showToast(`Spawned Digital Clay Sphere "${mesh.name}".`, 'success');
      this.updateSculptUI();
      this.updatePanelButtonStates();
    });

    // Retopology presets & execution
    const selectPreset = this.getElement<HTMLSelectElement>('selectRetopoPreset');
    const numTargetFaces = this.getElement<HTMLInputElement>('numRetopoTargetFaces');
    const selectHighPoly = this.getElement<HTMLSelectElement>('selectRetopoHighPolyTarget');
    const numSurfaceOffset = this.getElement<HTMLInputElement>('numRetopoSurfaceOffset');

    if (selectPreset && numTargetFaces) {
      selectPreset.addEventListener('change', () => {
        if (selectPreset.value !== 'custom') {
          numTargetFaces.value = selectPreset.value;
        }
      });
    }

    if (numSurfaceOffset) {
      numSurfaceOffset.addEventListener('change', () => {
        const val = parseFloat(numSurfaceOffset.value) || 0.004;
        this.service.sculptController.quadSurfaceOffset = val;
      });
    }

    this.getElement('btnShrinkwrapMesh')?.addEventListener('click', () => {
      const lowMesh = this.service.selectedMesh;
      if (!lowMesh) {
        this.showToast('Please select a low-poly mesh in the viewport to Shrinkwrap.', 'warning');
        return;
      }
      const targetVal = selectHighPoly?.value || 'auto';
      const highMesh =
        targetVal !== 'auto'
          ? this.service.importedMeshes.find((m) => m.name === targetVal) || lowMesh
          : this.service.importedMeshes.find((m) => m !== lowMesh && !this.service.isEditorHelper(m)) ||
            lowMesh;
      const offset = numSurfaceOffset ? parseFloat(numSurfaceOffset.value) || 0.004 : 0.004;
      const analysis = this.service.sculptController.shrinkwrapMesh(lowMesh, highMesh, {
        offset,
        mode: 'nearest',
        smoothIterations: 1,
      });
      this.showToast(
        `Shrinkwrapped "${lowMesh.name}" onto "${highMesh.name}" (${analysis.triangleCount} tris).`,
        'success'
      );
      this.updateSculptUI();
    });

    this.getElement('btnGenerateQuadCage')?.addEventListener('click', () => {
      const targetMesh =
        this.service.selectedMesh ||
        this.service.importedMeshes.find((m) => !this.service.isEditorHelper(m));
      if (!targetMesh) {
        this.showToast('Please select a target sculpt mesh first.', 'warning');
        return;
      }
      const offset = numSurfaceOffset ? parseFloat(numSurfaceOffset.value) || 0.004 : 0.004;
      const cage = this.service.sculptController.generateQuadFlowCage(targetMesh, 14, 16, offset);
      this.service.selectMesh(cage);
      this.showToast(`Generated Quad-Flow Retopology Cage "${cage.name}".`, 'success');
      this.updateSculptUI();
    });

    this.getElement('btnExecuteRetopology')?.addEventListener('click', async () => {
      const targetMesh = this.service.selectedMesh;
      if (!targetMesh) {
        this.showToast('Please select a 3D mesh in the viewport to retopologize.', 'warning');
        return;
      }

      const targetFaces = parseInt(numTargetFaces?.value || '15000', 10);
      try {
        this.showToast('Retopologizing mesh with Quadric Error Metrics...', 'info');
        const analysis = await this.service.sculptController.retopologizeMesh(targetMesh, targetFaces);
        this.showToast(
          `Retopologized "${targetMesh.name}" to ${analysis.triangleCount} triangles (${analysis.gameReadiness}).`,
          'success'
        );
        this.updateSculptUI();
      } catch (err: any) {
        this.showToast(`Retopology failed: ${err.message || err}`, 'error');
      }
    });

    this.updateSculptUI();
  }

  public updateSculptUI(): void {
    const dialog = this.getElement('dialog-sculpt');
    if (!dialog) return;

    const targetMesh = this.service.selectedMesh || (this.service.importedMeshes[0] as Mesh);
    const nameEl = this.getElement('sculptMeshName');
    const triEl = this.getElement('sculptTriCount');
    const vertEl = this.getElement('sculptVertCount');
    const badgeEl = this.getElement('sculptGameBadge');

    if (!targetMesh) {
      if (nameEl) nameEl.textContent = 'None';
      if (triEl) triEl.textContent = '0';
      if (vertEl) vertEl.textContent = '0';
      if (badgeEl) {
        badgeEl.textContent = 'No Mesh';
        badgeEl.className = 'badge badge-secondary';
      }
      return;
    }

    const analysis = this.service.sculptController.analyzeTopology(targetMesh);
    if (nameEl) nameEl.textContent = targetMesh.name;
    if (triEl) triEl.textContent = analysis.triangleCount.toLocaleString();
    if (vertEl) vertEl.textContent = analysis.vertexCount.toLocaleString();
    if (badgeEl) {
      badgeEl.textContent = analysis.gameReadiness;
      badgeEl.style.background =
        analysis.gameReadinessClass === 'success'
          ? 'rgba(35, 134, 54, 0.2)'
          : analysis.gameReadinessClass === 'warning'
            ? 'rgba(210, 153, 34, 0.2)'
            : 'rgba(248, 81, 73, 0.2)';
      badgeEl.style.color =
        analysis.gameReadinessClass === 'success'
          ? '#3fb950'
          : analysis.gameReadinessClass === 'warning'
            ? '#d29922'
            : '#f85149';
      badgeEl.style.border =
        analysis.gameReadinessClass === 'success'
          ? '1px solid rgba(63, 185, 80, 0.3)'
          : analysis.gameReadinessClass === 'warning'
            ? '1px solid rgba(210, 153, 34, 0.3)'
            : '1px solid rgba(248, 81, 73, 0.3)';
    }

    const selectHighPoly = this.getElement<HTMLSelectElement>('selectRetopoHighPolyTarget');
    if (selectHighPoly) {
      const prevVal = selectHighPoly.value;
      const validMeshes = this.service.importedMeshes.filter(
        (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && (!m.isEnabled || m.isEnabled())
      );
      selectHighPoly.innerHTML = `<option value="auto">Auto / Active High-Poly</option>`;
      for (const m of validMeshes) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        selectHighPoly.appendChild(opt);
      }
      if (prevVal && Array.from(selectHighPoly.options).some((o) => o.value === prevVal)) {
        selectHighPoly.value = prevVal;
      }
    }
  }

  /* =========================================================================
     UV UNWRAP & TEXEL DENSITY STUDIO UI
     ========================================================================= */
  public initUVUnwrapUI(): void {
    const dialog = this.getElement('dialog-uv-unwrap');
    if (!dialog) return;

    this.service.uvUnwrapController.onUVModified = () => {
      this.updateUVUnwrapUI();
    };

    const sliderAngle = this.getElement<HTMLInputElement>('sliderUVSeamAngle');
    const valAngle = this.getElement('uvSeamAngleVal');
    if (sliderAngle) {
      sliderAngle.addEventListener('input', () => {
        const deg = parseInt(sliderAngle.value, 10) || 60;
        if (valAngle) valAngle.textContent = `${deg}°`;
        this.service.uvUnwrapController.angleThresholdDeg = deg;
      });
    }

    const chkSeamPick = this.getElement<HTMLInputElement>('chkUVInteractiveSeamPick');
    if (chkSeamPick) {
      chkSeamPick.addEventListener('change', () => {
        this.service.uvUnwrapController.seamPickMode = chkSeamPick.checked;
        if (chkSeamPick.checked) {
          this.service.uvUnwrapController.setActive(true);
        }
      });
    }

    this.getElement('btnUVMarkSmartSeams')?.addEventListener('click', () => {
      const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
      if (!mesh) {
        this.showToast('Please select a 3D mesh to mark UV seams.', 'warning');
        return;
      }
      const res = this.service.uvUnwrapController.markSmartSeams(
        mesh,
        this.service.uvUnwrapController.angleThresholdDeg
      );
      this.showToast(`Marked ${res.seamEdgeCount} Smart UV Seam edges on "${mesh.name}".`, 'success');
      this.updateUVUnwrapUI();
    });

    this.getElement('btnUVClearSeams')?.addEventListener('click', () => {
      const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
      if (!mesh) return;
      this.service.uvUnwrapController.clearSeams(mesh);
      this.showToast(`Cleared UV seams on "${mesh.name}".`, 'info');
      this.updateUVUnwrapUI();
    });

    const selectMethod = this.getElement<HTMLSelectElement>('selectUVUnwrapMethod');
    const selectMargin = this.getElement<HTMLSelectElement>('selectUVIslandMargin');
    const chkRotate = this.getElement<HTMLInputElement>('chkUVRotateOptimal');
    const chkChecker = this.getElement<HTMLInputElement>('chkUVCheckerPreview');
    const selectRes = this.getElement<HTMLSelectElement>('selectUVTextureRes');
    const numTargetDensity = this.getElement<HTMLInputElement>('numUVTargetTexelDensity');

    if (chkChecker) {
      chkChecker.addEventListener('change', () => {
        const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
        if (mesh) {
          this.service.uvUnwrapController.toggleCheckerPreview(mesh, chkChecker.checked);
        }
      });
    }

    this.getElement('btnExecuteUVUnwrap')?.addEventListener('click', () => {
      const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
      if (!mesh) {
        this.showToast('Please select a 3D mesh to unwrap.', 'warning');
        return;
      }
      const method = (selectMethod?.value || 'smart_seams') as
        | 'smart_seams'
        | 'angle_project'
        | 'cylindrical';
      const marginPx = parseInt(selectMargin?.value || '6', 10);
      const textureResolution = parseInt(selectRes?.value || '1024', 10);
      const rotateOptimal = chkRotate ? chkRotate.checked : true;

      const stats = this.service.uvUnwrapController.unwrapMesh(mesh, {
        method,
        angleThresholdDeg: this.service.uvUnwrapController.angleThresholdDeg,
        marginPx,
        textureResolution,
        rotateOptimal,
      });
      this.showToast(
        `Unwrapped "${mesh.name}" into ${stats.islandCount} UV islands (${stats.texelDensityPxPerMeter} px/m, ${stats.uvCoveragePercent}% coverage).`,
        'success'
      );
      this.updateUVUnwrapUI();
    });

    this.getElement('btnPackUVIslands')?.addEventListener('click', () => {
      const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
      if (!mesh) {
        this.showToast('Please select a 3D mesh to pack UV islands.', 'warning');
        return;
      }
      const marginPx = parseInt(selectMargin?.value || '6', 10);
      const textureResolution = parseInt(selectRes?.value || '1024', 10);
      const rotateOptimal = chkRotate ? chkRotate.checked : true;
      const stats = this.service.uvUnwrapController.packUVIslands(mesh, {
        marginPx,
        textureResolution,
        rotateOptimal,
        normalizeScale: true,
      });
      this.showToast(
        `Packed ${stats.islandCount} UV islands (${stats.uvCoveragePercent}% UV space utilization).`,
        'success'
      );
      this.updateUVUnwrapUI();
    });

    this.getElement('btnApplyTexelDensity')?.addEventListener('click', () => {
      const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
      if (!mesh) {
        this.showToast('Please select a 3D mesh to equalize Texel Density.', 'warning');
        return;
      }
      const targetPx = parseInt(numTargetDensity?.value || '512', 10) || 512;
      const textureResolution = parseInt(selectRes?.value || '1024', 10) || 1024;
      const stats = this.service.uvUnwrapController.normalizeTexelDensity(
        mesh,
        targetPx,
        textureResolution,
        false
      );
      this.showToast(
        `Normalized Texel Density on "${mesh.name}" to ${stats.texelDensityPxPerMeter} px/m.`,
        'success'
      );
      this.updateUVUnwrapUI();
    });

    this.updateUVUnwrapUI();
  }

  public updateUVUnwrapUI(): void {
    const dialog = this.getElement('dialog-uv-unwrap');
    if (!dialog) return;

    const mesh = this.service.uvUnwrapController.getActiveTargetMesh();
    const selectRes = this.getElement<HTMLSelectElement>('selectUVTextureRes');
    const res = parseInt(selectRes?.value || '1024', 10) || 1024;
    const stats = mesh
      ? this.service.uvUnwrapController.analyzeUVs(mesh, res)
      : {
          islandCount: 0,
          seamEdgeCount: 0,
          texelDensityPxPerMeter: 0,
          worldSurfaceAreaM2: 0,
          uvCoveragePercent: 0,
        };

    const islandsEl = this.getElement('uvStatIslandsSeams');
    const densityEl = this.getElement('uvStatTexelDensity');
    const areaEl = this.getElement('uvStatSurfaceArea');
    const covEl = this.getElement('uvCoverageBadge');
    const canvas = this.getElement<HTMLCanvasElement>('uvPreviewCanvas');

    if (islandsEl) {
      islandsEl.textContent = `${stats.islandCount} islands / ${stats.seamEdgeCount} seams`;
    }
    if (densityEl) {
      densityEl.textContent = `${stats.texelDensityPxPerMeter} px/m`;
    }
    if (areaEl) {
      areaEl.textContent = `${stats.worldSurfaceAreaM2.toFixed(2)} m²`;
    }
    if (covEl) {
      covEl.textContent = `Coverage: ${stats.uvCoveragePercent}%`;
    }
    if (canvas) {
      this.service.uvUnwrapController.renderUVLayoutToCanvas(mesh, canvas);
    }
  }

  /* =========================================================================
     NORMAL & AO TEXTURE BAKER STUDIO UI
     ========================================================================= */
  public initBakingUI(): void {
    const dialog = this.getElement('dialog-baking');
    if (!dialog) return;

    const sliderCage = this.getElement<HTMLInputElement>('sliderBakeCageOffset');
    const valCage = this.getElement('bakeCageOffsetVal');
    const chkShowCage = this.getElement<HTMLInputElement>('chkBakeShowCage');
    const selectLow = this.getElement<HTMLSelectElement>('selectBakeLowPoly');
    const selectHigh = this.getElement<HTMLSelectElement>('selectBakeHighPoly');
    const selectRes = this.getElement<HTMLSelectElement>('selectBakeResolution');
    const selectPad = this.getElement<HTMLSelectElement>('selectBakePadding');
    const chkFlipY = this.getElement<HTMLInputElement>('chkBakeFlipY');
    const chkApply = this.getElement<HTMLInputElement>('chkBakeApplyMaterial');
    const chkAutoUnwrap = this.getElement<HTMLInputElement>('chkBakeAutoUnwrap');
    const selectPreviewChannel = this.getElement<HTMLSelectElement>('selectBakePreviewChannel');
    const previewCanvas = this.getElement<HTMLCanvasElement>('bakePreviewCanvas');

    const resolveLowPoly = (): Mesh | null => {
      const val = selectLow?.value || 'selected';
      if (val !== 'selected') {
        const found = this.service.importedMeshes.find((m) => m.name === val && !m.isDisposed() && (!m.isEnabled || m.isEnabled()));
        if (found) return found;
      }
      return (
        this.service.selectedMesh ||
        this.service.importedMeshes.find((m) => !this.service.isEditorHelper(m) && !m.isDisposed() && (!m.isEnabled || m.isEnabled())) ||
        null
      );
    };

    const resolveHighPoly = (low: Mesh | null): Mesh | null => {
      const val = selectHigh?.value || 'self';
      if (val !== 'self') {
        const found = this.service.importedMeshes.find((m) => m.name === val && !m.isDisposed() && (!m.isEnabled || m.isEnabled()));
        if (found) return found;
      }
      return low;
    };

    selectLow?.addEventListener('change', () => this.updateBakingUI());
    selectHigh?.addEventListener('change', () => this.updateBakingUI());

    this.getElement('btnBakeQuickUnwrap')?.addEventListener('click', () => {
      const low = resolveLowPoly();
      if (!low) {
        this.showToast('Please select a Low-Poly mesh first.', 'warning');
        return;
      }
      if (this.service.uvUnwrapController) {
        this.service.uvUnwrapController.unwrapMesh(low);
        this.updateBakingUI();
        this.showToast(`Unwrapped and packed UV islands for "${low.name}".`, 'success');
      }
    });

    if (sliderCage) {
      sliderCage.addEventListener('input', () => {
        const dist = parseFloat(sliderCage.value) || 0.04;
        if (valCage) valCage.textContent = dist.toFixed(3);
        this.service.textureBaker.cageExtrusion = dist;
        if (chkShowCage?.checked) {
          this.service.textureBaker.updateCagePreview(resolveLowPoly(), dist, true);
        }
      });
    }

    if (chkShowCage) {
      chkShowCage.addEventListener('change', () => {
        const dist = sliderCage ? parseFloat(sliderCage.value) || 0.04 : 0.04;
        this.service.textureBaker.updateCagePreview(resolveLowPoly(), dist, chkShowCage.checked);
      });
    }

    this.getElement('btnBakeAutoCage')?.addEventListener('click', () => {
      const low = resolveLowPoly();
      if (!low) {
        this.showToast('Please select a Low-Poly mesh first.', 'warning');
        return;
      }
      const high = resolveHighPoly(low);
      const optimal = this.service.textureBaker.computeAutoCageDistance(low, high);
      if (sliderCage) sliderCage.value = optimal.toString();
      if (valCage) valCage.textContent = optimal.toFixed(3);
      if (chkShowCage?.checked) {
        this.service.textureBaker.updateCagePreview(low, optimal, true);
      }
      this.showToast(`Auto-calculated optimal Cage extrusion: ${optimal.toFixed(3)}m.`, 'info');
    });

    if (selectPreviewChannel && previewCanvas) {
      selectPreviewChannel.addEventListener('change', () => {
        const ch = selectPreviewChannel.value === 'ao' ? 'ao' : 'normal';
        this.service.textureBaker.renderBakePreviewToCanvas(previewCanvas, ch);
      });
    }

    this.getElement('btnExecuteBake')?.addEventListener('click', async () => {
      const low = resolveLowPoly();
      if (!low) {
        this.showToast('Please select a target Low-Poly mesh to bake.', 'warning');
        return;
      }
      const high = resolveHighPoly(low);
      const resolution = (parseInt(selectRes?.value || '512', 10) || 512) as
        | 128
        | 256
        | 512
        | 1024
        | 2048;
      const cageExtrusion = sliderCage ? parseFloat(sliderCage.value) || 0.04 : 0.04;
      const paddingPx = parseInt(selectPad?.value || '4', 10) || 4;
      const flipNormalY = !!chkFlipY?.checked;
      const applyToMaterial = chkApply ? chkApply.checked : true;
      const autoUnwrapIfOverlapping = chkAutoUnwrap ? chkAutoUnwrap.checked : false;

      try {
        const res = await this.service.textureBaker.bakeTextures({
          lowPolyMesh: low,
          highPolyMesh: high,
          resolution,
          cageExtrusion,
          paddingPx,
          flipNormalY,
          applyToMaterial,
          autoUnwrapIfOverlapping,
        });

        const statusEl = this.getElement('bakeStatusText');
        const statsEl = this.getElement('bakeRayStats');
        if (statusEl) statusEl.textContent = `Baked ${res.resolution}×${res.resolution}`;
        if (statsEl) {
          statsEl.textContent = `${res.rayHitCount.toLocaleString()} rays (${res.coveragePercent}%)`;
        }
        if (previewCanvas) {
          const ch = selectPreviewChannel?.value === 'ao' ? 'ao' : 'normal';
          this.service.textureBaker.renderBakePreviewToCanvas(previewCanvas, ch);
        }
        this.showToast(
          `Baked Normal & AO Maps (${res.resolution}×${res.resolution}) onto "${low.name}".`,
          'success'
        );
      } catch (err: any) {
        this.showToast(`Baking failed: ${err.message || err}`, 'error');
      }
    });

    const downloadDataUrl = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    this.getElement('btnDownloadNormalMap')?.addEventListener('click', () => {
      const last = this.service.textureBaker.lastBakeResult;
      if (!last) {
        this.showToast('Please run Bake Normal & AO Maps first.', 'warning');
        return;
      }
      downloadDataUrl(last.normalMapDataUrl, `${last.lowPolyMeshName}_NormalMap.png`);
    });

    this.getElement('btnDownloadAOMap')?.addEventListener('click', () => {
      const last = this.service.textureBaker.lastBakeResult;
      if (!last) {
        this.showToast('Please run Bake Normal & AO Maps first.', 'warning');
        return;
      }
      downloadDataUrl(last.aoMapDataUrl, `${last.lowPolyMeshName}_AOMap.png`);
    });

    this.updateBakingUI();
  }

  public updateBakingUI(): void {
    const dialog = this.getElement('dialog-baking');
    if (!dialog) return;

    const selectLow = this.getElement<HTMLSelectElement>('selectBakeLowPoly');
    const selectHigh = this.getElement<HTMLSelectElement>('selectBakeHighPoly');
    const validMeshes = this.service.importedMeshes.filter(
      (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && (!m.isEnabled || m.isEnabled())
    );

    if (selectLow) {
      const prev = selectLow.value;
      selectLow.innerHTML = `<option value="selected">Selected Mesh</option>`;
      for (const m of validMeshes) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        selectLow.appendChild(opt);
      }
      if (prev && Array.from(selectLow.options).some((o) => o.value === prev)) {
        selectLow.value = prev;
      }
    }

    if (selectHigh) {
      const prev = selectHigh.value;
      selectHigh.innerHTML = `<option value="self">Self (Bevel & Cavity Detail)</option>`;
      for (const m of validMeshes) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        selectHigh.appendChild(opt);
      }
      if (prev && Array.from(selectHigh.options).some((o) => o.value === prev)) {
        selectHigh.value = prev;
      }
    }

    const warningEl = this.getElement('bakeUVWarning');
    if (warningEl) {
      const targetMesh =
        selectLow && selectLow.value !== 'selected'
          ? validMeshes.find((m) => m.name === selectLow.value)
          : this.service.selectedMesh || validMeshes[0];

      if (targetMesh && this.service.uvUnwrapController) {
        const stats = this.service.uvUnwrapController.analyzeUVs(targetMesh);
        warningEl.style.display = stats.overlapDetected ? 'block' : 'none';
      } else {
        warningEl.style.display = 'none';
      }
    }
  }

  /* =========================================================================
     RIGGING, SKELETON & WEIGHT PAINTING STUDIO UI
     ========================================================================= */
  public initRiggingUI(): void {
    const dialog = this.getElement('dialog-rigging');
    if (!dialog) return;

    this.service.weightPaintController.onWeightsModified = () => {
      this.updateRiggingUI();
    };

    const selectPreset = this.getElement<HTMLSelectElement>('selectRigPreset');
    const selectBone = this.getElement<HTMLSelectElement>('selectRigActiveBone');
    const sliderRadius = this.getElement<HTMLInputElement>('sliderWeightRadius');
    const valRadius = this.getElement('weightRadiusVal');
    const sliderStrength = this.getElement<HTMLInputElement>('sliderWeightStrength');
    const valStrength = this.getElement('weightStrengthVal');
    const chkSymmetry = this.getElement<HTMLInputElement>('chkWeightSymmetry');
    const chkHeatmap = this.getElement<HTMLInputElement>('chkWeightHeatmap');
    const sliderPose = this.getElement<HTMLInputElement>('sliderRigPoseAngle');
    const valPose = this.getElement('rigPoseAngleVal');

    this.getElement('btnCreateAutoRig')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh) {
        this.showToast('Please select a 3D mesh to rig.', 'warning');
        return;
      }

      const preset = (selectPreset?.value || 'humanoid') as 'humanoid' | 'chibi' | 'quadruped' | 'spine_chain';
      const skel = this.service.weightPaintController.createAutoRig(mesh, preset);
      this.service.weightPaintController.setActive(true);
      this.showToast(
        `Created ${preset} skeleton "${skel.name}" (${skel.bones.length} bones) and bound envelope skin weights!`,
        'success'
      );
      this.updateRiggingUI();
      this.updatePanelButtonStates();
    });

    const sliderArmHeight = this.getElement<HTMLInputElement>('sliderRigArmHeight');
    const valArmHeight = this.getElement('rigArmHeightVal');
    const sliderHipHeight = this.getElement<HTMLInputElement>('sliderRigHipHeight');
    const valHipHeight = this.getElement('rigHipHeightVal');

    if (selectPreset) {
      selectPreset.addEventListener('change', () => {
        const val = selectPreset.value;
        if (val === 'chibi') {
          if (sliderArmHeight) sliderArmHeight.value = '0.59';
          if (valArmHeight) valArmHeight.textContent = '59%';
          if (sliderHipHeight) sliderHipHeight.value = '0.36';
          if (valHipHeight) valHipHeight.textContent = '36%';
        } else if (val === 'humanoid') {
          if (sliderArmHeight) sliderArmHeight.value = '0.78';
          if (valArmHeight) valArmHeight.textContent = '78%';
          if (sliderHipHeight) sliderHipHeight.value = '0.48';
          if (valHipHeight) valHipHeight.textContent = '48%';
        }
      });
    }

    const applyProportionAdjustments = () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh || !mesh.skeleton) return;
      const armRatio = parseFloat(sliderArmHeight?.value || '0.78');
      const hipRatio = parseFloat(sliderHipHeight?.value || '0.48');
      this.service.weightPaintController.adjustBoneHeights(mesh, armRatio, hipRatio);
    };

    if (sliderArmHeight) {
      sliderArmHeight.addEventListener('input', () => {
        const v = parseFloat(sliderArmHeight.value) || 0.78;
        if (valArmHeight) valArmHeight.textContent = `${Math.round(v * 100)}%`;
        applyProportionAdjustments();
      });
    }

    if (sliderHipHeight) {
      sliderHipHeight.addEventListener('input', () => {
        const v = parseFloat(sliderHipHeight.value) || 0.48;
        if (valHipHeight) valHipHeight.textContent = `${Math.round(v * 100)}%`;
        applyProportionAdjustments();
      });
    }

    this.getElement('btnNudgeBoneUp')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh || !mesh.skeleton) return;
      this.service.weightPaintController.nudgeActiveBone(mesh, new Vector3(0, 0.03, 0));
    });

    this.getElement('btnNudgeBoneDown')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh || !mesh.skeleton) return;
      this.service.weightPaintController.nudgeActiveBone(mesh, new Vector3(0, -0.03, 0));
    });

    this.getElement('btnAutoBindWeights')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh || !mesh.skeleton) {
        this.showToast('Please create an Auto-Rig skeleton on the mesh first.', 'warning');
        return;
      }
      this.service.weightPaintController.autoBindSkinWeights(mesh, mesh.skeleton);
      this.showToast(`Recalculated smooth envelope skin weights for "${mesh.name}".`, 'info');
      this.updateRiggingUI();
    });

    this.getElement('btnMergeRigParts')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (!mesh) return;
      const targets = this.service.weightPaintController.getTargetMeshes(mesh);
      if (targets.length <= 1) {
        this.showToast('Model is already a single unified mesh.', 'info');
        return;
      }
      this.service.weightPaintController.prepareMeshesForExport();
      this.service.selectNodes(targets);
      const merged = this.service.mergeSelectedMeshes();
      if (merged) {
        this.service.selectNodes([merged]);
        this.service.weightPaintController.setActive(true);
        this.showToast(`Merged ${targets.length} character parts into "${merged.name}".`, 'success');
        this.updateRiggingUI();
      }
    });

    if (selectBone) {
      selectBone.addEventListener('change', () => {
        const idx = parseInt(selectBone.value, 10) || 0;
        this.service.weightPaintController.setActiveBoneIndex(idx);
        if (sliderPose) sliderPose.value = '0';
        if (valPose) valPose.textContent = '0°';
      });
    }

    const modeButtons = dialog.querySelectorAll<HTMLButtonElement>('.btn-weight-mode');
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = (btn.dataset.mode || 'add') as 'add' | 'subtract' | 'smooth' | 'replace';
        this.service.weightPaintController.setBrushMode(mode);
        this.service.weightPaintController.setActive(true);
        this.updatePanelButtonStates();
      });
    });

    if (sliderRadius) {
      sliderRadius.addEventListener('input', () => {
        const v = parseFloat(sliderRadius.value) || 0.35;
        if (valRadius) valRadius.textContent = v.toFixed(2);
        this.service.weightPaintController.setRadius(v);
      });
    }

    if (sliderStrength) {
      sliderStrength.addEventListener('input', () => {
        const v = parseFloat(sliderStrength.value) || 0.5;
        if (valStrength) valStrength.textContent = v.toFixed(2);
        this.service.weightPaintController.setStrength(v);
      });
    }

    if (chkSymmetry) {
      chkSymmetry.addEventListener('change', () => {
        this.service.weightPaintController.symmetryX = chkSymmetry.checked;
      });
    }

    if (chkHeatmap) {
      chkHeatmap.addEventListener('change', () => {
        this.service.weightPaintController.showHeatmap = chkHeatmap.checked;
        const mesh = this.service.weightPaintController.getActiveTargetMesh();
        if (mesh) {
          if (chkHeatmap.checked) {
            this.service.weightPaintController.updateWeightHeatmap(mesh);
          } else {
            this.service.weightPaintController.restoreOriginalVertexColors(mesh);
          }
        }
      });
    }

    if (sliderPose) {
      sliderPose.addEventListener('input', () => {
        const angle = parseFloat(sliderPose.value) || 0;
        if (valPose) valPose.textContent = `${angle}°`;
        const mesh = this.service.weightPaintController.getActiveTargetMesh();
        if (mesh) {
          this.service.weightPaintController.poseActiveBone(mesh, angle, 0, 0);
        }
      });
    }

    this.getElement('btnResetBindPose')?.addEventListener('click', () => {
      const mesh = this.service.weightPaintController.getActiveTargetMesh();
      if (mesh) {
        this.service.weightPaintController.resetBindPose(mesh);
      }
      if (sliderPose) sliderPose.value = '0';
      if (valPose) valPose.textContent = '0°';
    });

    this.updateRiggingUI();
  }

  public updateRiggingUI(): void {
    const dialog = this.getElement('dialog-rigging');
    if (!dialog) return;

    const mesh = this.service.weightPaintController.getActiveTargetMesh();
    const stats = this.service.weightPaintController.analyzeWeights(mesh);

    const selectBone = this.getElement<HTMLSelectElement>('selectRigActiveBone');
    if (selectBone) {
      if (mesh && mesh.skeleton && mesh.skeleton.bones.length > 0) {
        selectBone.innerHTML = '';
        mesh.skeleton.bones.forEach((b, idx) => {
          const opt = document.createElement('option');
          opt.value = idx.toString();
          opt.textContent = `${idx}: ${b.name}`;
          selectBone.appendChild(opt);
        });
        selectBone.value = stats.activeBoneIndex.toString();
      } else {
        selectBone.innerHTML = `<option value="0">None (Create Rig First)</option>`;
      }
    }

    const boneCountEl = this.getElement('rigStatBoneCount');
    const influencedEl = this.getElement('rigStatInfluencedVerts');
    if (boneCountEl) {
      boneCountEl.textContent = `${stats.boneCount} bones`;
    }
    if (influencedEl) {
      influencedEl.textContent = `${stats.influencedVertexCount} verts (avg ${stats.averageActiveWeight.toFixed(2)})`;
    }

    const targets = mesh ? this.service.weightPaintController.getTargetMeshes(mesh) : [];
    const multiBadge = this.getElement('rigMultiPartsBadge');
    const multiCount = this.getElement('rigMultiPartsCount');
    if (multiBadge) {
      if (targets.length > 1) {
        multiBadge.style.display = 'block';
        if (multiCount) multiCount.textContent = `${targets.length} Parts`;
      } else {
        multiBadge.style.display = 'none';
      }
    }
  }

  /* =========================================================================
     AI TEXTURE GENERATOR UI
     ========================================================================= */
  private activeAITextureId: string | null = null;
  private activeAITexturePreviewMode: 'albedo' | 'normal' | 'tiled' = 'albedo';

  public initAITextureUI(): void {
    const dialog = this.getElement('dialog-ai-texture');
    if (!dialog || (dialog as any)._aiTextureInitialized) return;
    (dialog as any)._aiTextureInitialized = true;

    const promptInput = this.getElement<HTMLTextAreaElement>('aiTexturePrompt');
    const presetSelect = this.getElement<HTMLSelectElement>('aiTexturePresetSelect');
    const styleSelect = this.getElement<HTMLSelectElement>('aiTextureStyleSelect');
    const sizeSelect = this.getElement<HTMLSelectElement>('aiTextureSizeSelect');
    const seamlessCheck = this.getElement<HTMLInputElement>('aiTextureSeamlessCheck');
    const normalCheck = this.getElement<HTMLInputElement>('aiTextureNormalCheck');
    const customColorsCheck = this.getElement<HTMLInputElement>('aiTextureCustomColorsCheck');
    const colorPickersRow = this.getElement<HTMLElement>('aiTextureColorPickersRow');
    const primaryColorInput = this.getElement<HTMLInputElement>('aiTexturePrimaryColor');
    const secondaryColorInput = this.getElement<HTMLInputElement>('aiTextureSecondaryColor');
    const accentColorInput = this.getElement<HTMLInputElement>('aiTextureAccentColor');
    const normalStrengthInput = this.getElement<HTMLInputElement>('aiTextureNormalStrength');
    const normalStrengthVal = this.getElement<HTMLElement>('aiTextureNormalStrengthVal');
    const uvScaleInput = this.getElement<HTMLInputElement>('aiTextureUVScaleInput');

    presetSelect?.addEventListener('change', () => {
      if (!presetSelect.value) return;
      const [presetPrompt, presetStyle] = presetSelect.value.split('|');
      if (promptInput && presetPrompt) promptInput.value = presetPrompt;
      if (styleSelect && presetStyle) styleSelect.value = presetStyle;
      presetSelect.value = '';
    });

    customColorsCheck?.addEventListener('change', () => {
      if (colorPickersRow) {
        colorPickersRow.style.display = customColorsCheck.checked ? 'flex' : 'none';
      }
    });

    normalStrengthInput?.addEventListener('input', () => {
      if (normalStrengthVal) normalStrengthVal.textContent = Number(normalStrengthInput.value).toFixed(1);
    });

    const setPreviewMode = (mode: 'albedo' | 'normal' | 'tiled') => {
      this.activeAITexturePreviewMode = mode;
      this.updateAITextureUI();
    };

    this.getElement('btnPreviewAlbedo')?.addEventListener('click', () => setPreviewMode('albedo'));
    this.getElement('btnPreviewNormal')?.addEventListener('click', () => setPreviewMode('normal'));
    this.getElement('btnPreviewTiled')?.addEventListener('click', () => setPreviewMode('tiled'));

    this.getElement('btnGenerateAITexture')?.addEventListener('click', async () => {
      const prompt = promptInput?.value.trim() || 'Seamless stone texture';
      const style = (styleSelect?.value || 'auto') as any;
      const size = parseInt(sizeSelect?.value || '512', 10) || 512;
      const seamless = seamlessCheck ? seamlessCheck.checked : true;
      const generateNormalMap = normalCheck ? normalCheck.checked : true;
      const normalStrength = parseFloat(normalStrengthInput?.value || '2.2') || 2.2;
      const useCustomColors = Boolean(customColorsCheck?.checked);

      const item = await this.service.aiTextureGenerator.generateTexture({
        prompt,
        style,
        size,
        seamless,
        generateNormalMap,
        normalStrength,
        primaryColor: useCustomColors ? primaryColorInput?.value : undefined,
        secondaryColor: useCustomColors ? secondaryColorInput?.value : undefined,
        accentColor: useCustomColors ? accentColorInput?.value : undefined,
        embedInScene: true,
      });

      this.activeAITextureId = item.id;
      this.showToast(`Generated "${item.name}" (${item.size}x${item.size})`, 'success');
      this.updateAITextureUI();
      this.updateDecalUI();
    });

    const btnUploadTex = this.getElement<HTMLButtonElement>('btnUploadAITextureImage');
    const fileInputTex = this.getElement<HTMLInputElement>('aiTextureImageFileInput');
    btnUploadTex?.addEventListener('click', () => fileInputTex?.click());
    fileInputTex?.addEventListener('change', async () => {
      const file = fileInputTex.files?.[0];
      if (!file) return;
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const normalStrength = parseFloat(normalStrengthInput?.value || '2.2') || 2.2;
          const item = await this.service.aiTextureGenerator.addExternalTexture(
            file.name.replace(/\.[^/.]+$/, ''),
            dataUrl,
            promptInput?.value.trim() || file.name,
            normalStrength,
          );
          this.activeAITextureId = item.id;
          this.showToast(`Imported texture "${item.name}" with normal map!`, 'success');
          this.updateAITextureUI();
          this.updateDecalUI();
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        this.showToast(err?.message || 'Failed to import texture image.', 'error');
      }
      fileInputTex.value = '';
    });

    this.getElement('btnApplyAITextureToMesh')?.addEventListener('click', () => {
      const item = this.activeAITextureId
        ? this.service.aiTextureGenerator.getTextureById(this.activeAITextureId)
        : this.service.aiTextureGenerator.getLatestTexture();
      if (!item) {
        this.showToast('Generate a texture first.', 'warning');
        return;
      }
      const uvScale = parseFloat(uvScaleInput?.value || '1') || 1;
      try {
        const res = this.service.aiTextureGenerator.applyTextureToMesh(item.id, 'selected', uvScale);
        this.showToast(`Applied "${item.name}" to ${res.appliedTo.join(', ')}`, 'success');
      } catch (err: any) {
        this.showToast(err?.message || 'Select a mesh first to apply texture.', 'warning');
      }
    });

    this.getElement('btnUseAITextureAsDecal')?.addEventListener('click', () => {
      const item = this.activeAITextureId
        ? this.service.aiTextureGenerator.getTextureById(this.activeAITextureId)
        : this.service.aiTextureGenerator.getLatestTexture();
      if (!item) {
        this.showToast('Generate a texture first.', 'warning');
        return;
      }
      this.service.decalController.setTexture(item.albedoDataUrl, item.name);
      this.toggleDialog('dialog-decal', true);
      this.service.decalController.setActive(true);
      this.updateDecalUI();
      this.showToast(`Loaded "${item.name}" into Decal Painter! Click on a mesh to paint.`, 'info');
    });

    this.getElement('btnDownloadAITextureAlbedo')?.addEventListener('click', () => {
      const item = this.activeAITextureId
        ? this.service.aiTextureGenerator.getTextureById(this.activeAITextureId)
        : this.service.aiTextureGenerator.getLatestTexture();
      if (item) {
        this.service.aiTextureGenerator.downloadTexture(item.id, 'albedo');
      }
    });

    this.getElement('btnDownloadAITextureNormal')?.addEventListener('click', () => {
      const item = this.activeAITextureId
        ? this.service.aiTextureGenerator.getTextureById(this.activeAITextureId)
        : this.service.aiTextureGenerator.getLatestTexture();
      if (item && item.normalDataUrl) {
        this.service.aiTextureGenerator.downloadTexture(item.id, 'normal');
      } else {
        this.showToast('No normal map available for this texture.', 'warning');
      }
    });

    this.service.aiTextureGenerator.onHistoryChanged = () => {
      this.updateAITextureUI();
    };

    this.updateAITextureUI();
  }

  public updateAITextureUI(): void {
    const dialog = this.getElement('dialog-ai-texture');
    if (!dialog) return;

    const history = this.service.aiTextureGenerator.getHistory();
    const countBadge = this.getElement('aiTextureCountBadge');
    if (countBadge) {
      countBadge.textContent = `${history.length} texture${history.length === 1 ? '' : 's'}`;
    }

    if (!this.activeAITextureId && history.length > 0) {
      this.activeAITextureId = history[0].id;
    }

    const activeItem = this.activeAITextureId
      ? this.service.aiTextureGenerator.getTextureById(this.activeAITextureId) || history[0]
      : history[0];

    const previewContainer = this.getElement<HTMLElement>('aiTexturePreviewContainer');
    const previewBox = this.getElement<HTMLElement>('aiTexturePreviewBox');
    const metaLabel = this.getElement<HTMLElement>('aiTextureMetaLabel');

    if (previewContainer && previewBox) {
      if (activeItem) {
        previewContainer.style.display = 'block';
        if (metaLabel) {
          metaLabel.textContent = `${activeItem.name} (${activeItem.size}px • ${activeItem.style})`;
        }
        const url =
          this.activeAITexturePreviewMode === 'normal' && activeItem.normalDataUrl
            ? activeItem.normalDataUrl
            : activeItem.albedoDataUrl;
        previewBox.style.backgroundImage = `url("${url}")`;
        if (this.activeAITexturePreviewMode === 'tiled') {
          previewBox.style.backgroundSize = '50% 50%';
          previewBox.style.backgroundRepeat = 'repeat';
        } else {
          previewBox.style.backgroundSize = 'contain';
          previewBox.style.backgroundRepeat = 'no-repeat';
        }
      } else {
        previewContainer.style.display = 'none';
      }
    }

    const modes: Array<{ id: string; mode: 'albedo' | 'normal' | 'tiled' }> = [
      { id: 'btnPreviewAlbedo', mode: 'albedo' },
      { id: 'btnPreviewNormal', mode: 'normal' },
      { id: 'btnPreviewTiled', mode: 'tiled' },
    ];
    for (const m of modes) {
      const btn = this.getElement<HTMLButtonElement>(m.id);
      if (btn) {
        const isCurrent = this.activeAITexturePreviewMode === m.mode;
        btn.classList.toggle('active', isCurrent);
      }
    }

    const historyList = this.getElement<HTMLElement>('aiTextureHistoryList');
    if (historyList) {
      historyList.innerHTML = '';
      for (const item of history) {
        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.title = `${item.name}: ${item.prompt}`;
        const isSelected = activeItem && activeItem.id === item.id;
        thumb.style.cssText = `
          height: 52px;
          border-radius: 5px;
          border: 2px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.12)'};
          background-color: #161b22;
          background-image: url("${item.albedoDataUrl}");
          background-size: cover;
          background-position: center;
          cursor: pointer;
          padding: 0;
        `;
        thumb.addEventListener('click', () => {
          this.activeAITextureId = item.id;
          this.updateAITextureUI();
        });
        historyList.appendChild(thumb);
      }
    }
  }

  /* =========================================================================
     3D TEXT MESH TOOL UI
     ========================================================================= */
  public initTextMeshUI(): void {
    const dialog = this.getElement('dialog-text-mesh');
    if (!dialog || (dialog as any)._textMeshInitialized) return;
    (dialog as any)._textMeshInitialized = true;

    const textInput = this.getElement<HTMLInputElement>('textMeshInput');
    const fontSelect = this.getElement<HTMLSelectElement>('textMeshFontSelect');
    const sizeRange = this.getElement<HTMLInputElement>('textMeshSizeRange');
    const sizeNum = this.getElement<HTMLInputElement>('textMeshSizeNum');
    const depthRange = this.getElement<HTMLInputElement>('textMeshDepthRange');
    const depthNum = this.getElement<HTMLInputElement>('textMeshDepthNum');
    const resRange = this.getElement<HTMLInputElement>('textMeshResolutionRange');
    const resNum = this.getElement<HTMLInputElement>('textMeshResolutionNum');
    const colorPicker = this.getElement<HTMLInputElement>('textMeshColorPicker');
    const colorHex = this.getElement<HTMLElement>('textMeshColorHex');
    const roughnessRange = this.getElement<HTMLInputElement>('textMeshRoughnessRange');
    const roughnessVal = this.getElement<HTMLElement>('textMeshRoughnessVal');
    const metallicRange = this.getElement<HTMLInputElement>('textMeshMetallicRange');
    const metallicVal = this.getElement<HTMLElement>('textMeshMetallicVal');
    const emissivePicker = this.getElement<HTMLInputElement>('textMeshEmissivePicker');
    const emissiveIntensityRange = this.getElement<HTMLInputElement>('textMeshEmissiveIntensityRange');
    const surfacePlaceCheck = this.getElement<HTMLInputElement>('textMeshSurfacePlaceCheck');

    const syncPair = (range: HTMLInputElement | null, num: HTMLInputElement | null) => {
      range?.addEventListener('input', () => {
        if (num) num.value = range.value;
      });
      num?.addEventListener('change', () => {
        if (range) range.value = num.value;
      });
    };
    syncPair(sizeRange, sizeNum);
    syncPair(depthRange, depthNum);
    syncPair(resRange, resNum);

    colorPicker?.addEventListener('input', () => {
      if (colorHex) colorHex.textContent = colorPicker.value;
    });
    roughnessRange?.addEventListener('input', () => {
      if (roughnessVal) roughnessVal.textContent = Number(roughnessRange.value).toFixed(2);
    });
    metallicRange?.addEventListener('input', () => {
      if (metallicVal) metallicVal.textContent = Number(metallicRange.value).toFixed(2);
    });
    surfacePlaceCheck?.addEventListener('change', () => {
      this.service.textMeshController.setSurfacePlacementActive(Boolean(surfacePlaceCheck.checked));
    });

    const readFormConfig = () => ({
      text: textInput?.value.trim() || 'Hello 3D',
      fontUrl: fontSelect?.value || 'assets/fonts/Kenney_Future_Regular.json',
      size: parseFloat(sizeNum?.value || sizeRange?.value || '1.0') || 1.0,
      depth: parseFloat(depthNum?.value || depthRange?.value || '0.25') || 0.25,
      resolution: parseInt(resNum?.value || resRange?.value || '8', 10) || 8,
      color: colorPicker?.value || '#3b82f6',
      roughness: parseFloat(roughnessRange?.value || '0.35') ?? 0.35,
      metallic: parseFloat(metallicRange?.value || '0.2') ?? 0.2,
      emissiveColor: emissivePicker?.value || '#000000',
      emissiveIntensity: parseFloat(emissiveIntensityRange?.value || '0') || 0,
    });

    this.getElement('btnCreateTextMesh')?.addEventListener('click', async () => {
      const cfg = readFormConfig();
      const mesh = await this.service.textMeshController.createTextMesh(cfg);
      this.showToast(`Created 3D Text "${cfg.text}" (${mesh.name})`, 'success');
      this.updateTextMeshUI();
    });

    this.getElement('btnUpdateTextMesh')?.addEventListener('click', async () => {
      const sel = this.service.selectedMesh;
      if (!sel || !this.service.textMeshController.isTextMesh(sel)) {
        this.showToast('Select a 3D Text mesh first to update it.', 'warning');
        return;
      }
      const cfg = readFormConfig();
      const updated = await this.service.textMeshController.updateTextMesh(sel, cfg);
      this.showToast(`Updated 3D Text "${updated.name}"`, 'success');
      this.updateTextMeshUI();
    });

    this.getElement('btnDuplicateTextMesh')?.addEventListener('click', async () => {
      const sel = this.service.selectedMesh;
      if (!sel || !this.service.textMeshController.isTextMesh(sel)) {
        this.showToast('Select a 3D Text mesh first to duplicate it.', 'warning');
        return;
      }
      const dup = await this.service.textMeshController.duplicateTextMesh(sel);
      this.showToast(`Duplicated 3D Text as "${dup.name}"`, 'success');
      this.updateTextMeshUI();
    });

    this.updateTextMeshUI();
  }

  public updateTextMeshUI(): void {
    const dialog = this.getElement('dialog-text-mesh');
    if (!dialog) return;

    const sel = this.service.selectedMesh;
    const isText = Boolean(sel && this.service.textMeshController.isTextMesh(sel));
    const badge = this.getElement<HTMLElement>('textMeshSelectedBadge');
    const btnUpdate = this.getElement<HTMLButtonElement>('btnUpdateTextMesh');
    const btnDuplicate = this.getElement<HTMLButtonElement>('btnDuplicateTextMesh');

    if (btnUpdate) btnUpdate.disabled = !isText;
    if (btnDuplicate) btnDuplicate.disabled = !isText;

    if (isText && sel) {
      const cfg = this.service.textMeshController.getTextConfig(sel);
      if (badge) {
        badge.innerHTML = `Editing 3D Text: <strong>${sel.name}</strong>`;
      }
      if (cfg) {
        const textInput = this.getElement<HTMLInputElement>('textMeshInput');
        const fontSelect = this.getElement<HTMLSelectElement>('textMeshFontSelect');
        const sizeRange = this.getElement<HTMLInputElement>('textMeshSizeRange');
        const sizeNum = this.getElement<HTMLInputElement>('textMeshSizeNum');
        const depthRange = this.getElement<HTMLInputElement>('textMeshDepthRange');
        const depthNum = this.getElement<HTMLInputElement>('textMeshDepthNum');
        const resRange = this.getElement<HTMLInputElement>('textMeshResolutionRange');
        const resNum = this.getElement<HTMLInputElement>('textMeshResolutionNum');
        const colorPicker = this.getElement<HTMLInputElement>('textMeshColorPicker');
        const colorHex = this.getElement<HTMLElement>('textMeshColorHex');

        if (textInput && document.activeElement !== textInput) textInput.value = cfg.text;
        if (fontSelect) fontSelect.value = cfg.fontUrl;
        if (sizeRange) sizeRange.value = String(cfg.size);
        if (sizeNum && document.activeElement !== sizeNum) sizeNum.value = String(cfg.size);
        if (depthRange) depthRange.value = String(cfg.depth);
        if (depthNum && document.activeElement !== depthNum) depthNum.value = String(cfg.depth);
        if (resRange) resRange.value = String(cfg.resolution);
        if (resNum && document.activeElement !== resNum) resNum.value = String(cfg.resolution);
        if (colorPicker) colorPicker.value = cfg.color;
        if (colorHex) colorHex.textContent = cfg.color;
      }
    } else if (badge) {
      badge.innerHTML =
        'Enter text and click <strong>Create 3D Text</strong>, or select an existing 3D text mesh to edit it.';
    }
  }

  /* =========================================================================
     DECAL PAINTER TOOL UI
     ========================================================================= */
  public initDecalUI(): void {
    const dialog = this.getElement('dialog-decal');
    if (!dialog || (dialog as any)._decalInitialized) return;
    (dialog as any)._decalInitialized = true;

    const btnToggleMode = this.getElement<HTMLButtonElement>('btnToggleDecalPaintMode');
    const texSelect = this.getElement<HTMLSelectElement>('decalTextureSelect');
    const btnUpload = this.getElement<HTMLButtonElement>('btnUploadDecalImage');
    const fileInput = this.getElement<HTMLInputElement>('decalImageFileInput');
    const sizeRange = this.getElement<HTMLInputElement>('decalSizeRange');
    const sizeNum = this.getElement<HTMLInputElement>('decalSizeNum');
    const angleRange = this.getElement<HTMLInputElement>('decalAngleRange');
    const angleNum = this.getElement<HTMLInputElement>('decalAngleNum');
    const opacityRange = this.getElement<HTMLInputElement>('decalOpacityRange');
    const opacityVal = this.getElement<HTMLElement>('decalOpacityVal');
    const tintPicker = this.getElement<HTMLInputElement>('decalTintColorPicker');
    const cullCheck = this.getElement<HTMLInputElement>('decalCullBackFacesCheck');
    const faceSelect = this.getElement<HTMLSelectElement>('decalFaceSelect');

    btnToggleMode?.addEventListener('click', () => {
      const next = !this.service.decalController.isActive;
      this.service.decalController.setActive(next);
      this.updateDecalUI();
      this.updatePanelButtonStates();
    });

    texSelect?.addEventListener('change', () => {
      const opt = this.service.decalController
        .getAvailableTextures()
        .find((t) => t.url === texSelect.value || t.id === texSelect.value);
      if (opt) {
        this.service.decalController.setTexture(opt.url, opt.name);
        this.updateDecalUI();
      }
    });

    btnUpload?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const tex = await this.service.addTextureFromFile(file);
        if (tex.url) {
          this.service.decalController.setTexture(tex.url, file.name);
          this.updateDecalUI();
        }
      } catch (err: any) {
        this.showToast(err?.message || 'Failed to load decal image.', 'error');
      }
      fileInput.value = '';
    });

    sizeRange?.addEventListener('input', () => {
      const v = parseFloat(sizeRange.value) || 0.6;
      if (sizeNum) sizeNum.value = String(v);
      this.service.decalController.setUniformSize(v);
    });
    sizeNum?.addEventListener('change', () => {
      const v = parseFloat(sizeNum.value) || 0.6;
      if (sizeRange) sizeRange.value = String(v);
      this.service.decalController.setUniformSize(v);
    });

    angleRange?.addEventListener('input', () => {
      const deg = parseFloat(angleRange.value) || 0;
      if (angleNum) angleNum.value = String(deg);
      this.service.decalController.setAngleDegrees(deg);
    });
    angleNum?.addEventListener('change', () => {
      const deg = parseFloat(angleNum.value) || 0;
      if (angleRange) angleRange.value = String(deg);
      this.service.decalController.setAngleDegrees(deg);
    });

    opacityRange?.addEventListener('input', () => {
      const v = parseFloat(opacityRange.value) || 1.0;
      this.service.decalController.config.opacity = v;
      if (opacityVal) opacityVal.textContent = `${Math.round(v * 100)}%`;
    });

    tintPicker?.addEventListener('input', () => {
      this.service.decalController.config.tintColor = tintPicker.value;
    });

    cullCheck?.addEventListener('change', () => {
      this.service.decalController.config.cullBackFaces = cullCheck.checked;
    });

    this.getElement('btnPlaceDecalOnSelected')?.addEventListener('click', () => {
      try {
        const face = (faceSelect?.value || 'front') as any;
        const decal = this.service.decalController.placeDecal({ face });
        this.showToast(`Stamped decal "${this.service.decalController.config.textureName}" (${decal.name})`, 'success');
        this.updateDecalUI();
      } catch (err: any) {
        this.showToast(err?.message || 'Select a target mesh first.', 'warning');
      }
    });

    this.getElement('btnMergeDecalsIntoMesh')?.addEventListener('click', () => {
      const unmerged = this.service.decalController.getUnmergedDecals();
      if (unmerged.length === 0) {
        this.showToast('No unmerged decals in scene to merge.', 'info');
        return;
      }
      const res = this.service.decalController.mergeAllDecalsIntoMeshes();
      this.showToast(
        `Merged ${res.mergedDecalCount} decal(s) into ${res.affectedMeshes.join(', ')}!`,
        'success',
      );
      this.updateDecalUI();
    });

    this.getElement('btnClearUnmergedDecals')?.addEventListener('click', () => {
      const removed = this.service.decalController.clearUnmergedDecals();
      if (removed > 0) {
        this.showToast(`Removed ${removed} unmerged decal(s).`, 'info');
      } else {
        this.showToast('No unmerged decals to remove.', 'info');
      }
      this.updateDecalUI();
    });

    this.service.decalController.onDecalsChanged = () => {
      this.updateDecalUI();
    };
    this.service.decalController.onConfigChanged = () => {
      this.updateDecalUI();
    };

    this.updateDecalUI();
  }

  public updateDecalUI(): void {
    const dialog = this.getElement('dialog-decal');
    if (!dialog) return;

    const ctrl = this.service.decalController;
    const btnToggleMode = this.getElement<HTMLButtonElement>('btnToggleDecalPaintMode');
    const modeLabel = this.getElement<HTMLElement>('decalPaintModeLabel');
    if (btnToggleMode && modeLabel) {
      if (ctrl.isActive) {
        btnToggleMode.classList.add('tool-btn-primary');
        btnToggleMode.classList.remove('sculpt-btn');
        modeLabel.textContent = 'Paint Mode: Active (Click Mesh)';
      } else {
        btnToggleMode.classList.remove('tool-btn-primary');
        btnToggleMode.classList.add('sculpt-btn');
        modeLabel.textContent = 'Activate Decal Paint Mode';
      }
    }

    const available = ctrl.getAvailableTextures();
    const texSelect = this.getElement<HTMLSelectElement>('decalTextureSelect');
    if (texSelect) {
      texSelect.innerHTML = '';
      for (const opt of available) {
        const el = document.createElement('option');
        el.value = opt.url;
        el.textContent = opt.name;
        if (opt.url === ctrl.config.textureUrl) {
          el.selected = true;
        }
        texSelect.appendChild(el);
      }
    }

    const gallery = this.getElement<HTMLElement>('decalTextureGallery');
    if (gallery) {
      gallery.innerHTML = '';
      for (const opt of available) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = opt.name;
        const isSelected = opt.url === ctrl.config.textureUrl;
        btn.style.cssText = `
          height: 46px;
          border-radius: 5px;
          border: 2px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.12)'};
          background-color: #161b22;
          background-image: url("${opt.previewDataUrl || opt.url}");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          cursor: pointer;
          padding: 0;
        `;
        btn.addEventListener('click', () => {
          ctrl.setTexture(opt.url, opt.name);
        });
        gallery.appendChild(btn);
      }
    }

    const sizeRange = this.getElement<HTMLInputElement>('decalSizeRange');
    const sizeNum = this.getElement<HTMLInputElement>('decalSizeNum');
    const angleRange = this.getElement<HTMLInputElement>('decalAngleRange');
    const angleNum = this.getElement<HTMLInputElement>('decalAngleNum');

    if (sizeRange) sizeRange.value = String(ctrl.config.sizeX);
    if (sizeNum && document.activeElement !== sizeNum) sizeNum.value = String(ctrl.config.sizeX);
    const deg = ctrl.getAngleDegrees();
    if (angleRange) angleRange.value = String(deg);
    if (angleNum && document.activeElement !== angleNum) angleNum.value = String(deg);

    const unmergedCount = ctrl.getUnmergedDecals().length;
    const countBadge = this.getElement<HTMLElement>('decalUnmergedCountBadge');
    if (countBadge) {
      countBadge.textContent = `${unmergedCount} unmerged decal${unmergedCount === 1 ? '' : 's'}`;
    }
  }
}
