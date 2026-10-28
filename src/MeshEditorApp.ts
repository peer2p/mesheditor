import { Color3, Engine, Mesh, PBRMaterial, StandardMaterial, Texture } from '@babylonjs/core';
import * as dat from 'dat.gui';
import { createDefaultPlatformAdapter, MeshEditorPlatformAdapter } from './adapters';
import { MeshEditorService } from './MeshEditorService';
import { MenuItemDefinition, MeshEditorPlugin, PluginManager, ToolbarButtonDefinition } from './plugin';
import { ensureMeshEditorStyles } from './styles';
import { getMeshEditorTemplate } from './template';
import { MeshEditorServiceEvents, PrimitiveShape } from './types';

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
  Box,
  BoxSelect,
  Check,
  CheckCircle2,
  ChevronDown,
  createIcons,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  File,
  Film,
  Folder,
  FolderInput,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Grid3x3,
  HelpCircle,
  Info,
  Keyboard,
  Library,
  Lightbulb,
  ListTree,
  Loader2,
  Maximize2,
  Minus,
  Mouse,
  Move,
  Palette,
  PanelRight,
  Plus,
  PlusCircle,
  Redo2,
  RotateCw,
  Save,
  Scissors,
  Search,
  Shapes,
  Sparkles,
  Sun,
  SunMedium,
  Target,
  Trash2,
  Triangle,
  Undo2,
  Upload,
  UploadCloud,
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
  Box,
  BoxSelect,
  Check,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  File,
  Film,
  Folder,
  FolderInput,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Grid3x3,
  HelpCircle,
  Info,
  Keyboard,
  Library,
  Lightbulb,
  ListTree,
  Loader2,
  Maximize2,
  Minus,
  Mouse,
  Move,
  Palette,
  PanelRight,
  Plus,
  PlusCircle,
  Redo2,
  RotateCw,
  Save,
  Scissors,
  Search,
  Shapes,
  Sparkles,
  Sun,
  SunMedium,
  Target,
  Trash2,
  Triangle,
  Undo2,
  Upload,
  UploadCloud,
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

  // File Inputs
  private modelFileInput: HTMLInputElement;
  private importFileInput: HTMLInputElement;
  private textureFileInput: HTMLInputElement;

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
  public layoutMode: 'floating' | 'stackpanel' = 'floating';

  // Loading Animation Elements & Timers
  private startupLoaderElement: HTMLElement | null = null;
  private startupLoaderText: HTMLElement | null = null;
  private startupLoaderBar: HTMLElement | null = null;
  private sceneLoaderElement: HTMLElement | null = null;
  private sceneLoaderTitle: HTMLElement | null = null;
  private sceneLoaderSub: HTMLElement | null = null;
  private startupTimerIds: Array<ReturnType<typeof setTimeout>> = [];
  private sceneLoaderTimerId: ReturnType<typeof setTimeout> | null = null;

  // Dialog IDs
  private readonly dialogIds: string[] = [
    'dialog-outliner',
    'dialog-create-primitive',
    'dialog-csg',
    'dialog-facet',
    'dialog-scene',
    'dialog-mesh',
    'dialog-material',
    'dialog-anim',
    'dialog-textures',
  ];

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
    extrudeNow: () => this.service.extrudeSelectedFacet(this.facetParams.extrudeDist),
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
      'floating';
    this.setLayoutMode(savedLayoutMode, false);
    this.refreshIcons();

    this.runInitialLoadingSequence(options.autoLoadUrl);

    if (options.autoLoadUrl) {
      this.service.loadFromUrl(options.autoLoadUrl);
    }
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

  public dispose(): void {
    for (const timer of this.startupTimerIds) {
      clearTimeout(timer);
    }
    this.startupTimerIds = [];
    if (this.sceneLoaderTimerId) {
      clearTimeout(this.sceneLoaderTimerId);
      this.sceneLoaderTimerId = null;
    }
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

    // Insert before layout buttons
    const layoutGroup = toolbar.querySelector('.layout-group');
    if (layoutGroup) {
      toolbar.insertBefore(btn, layoutGroup);
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

      this.service.gizmoManager.positionGizmoEnabled = mode === 'translate';
      this.service.gizmoManager.rotationGizmoEnabled = mode === 'rotate';
      this.service.gizmoManager.scaleGizmoEnabled = mode === 'scale';
      this.service.gizmoManager.boundingBoxGizmoEnabled = mode === 'bounds';
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
      this.toggleDialog('dialog-scene', true);
      this.showToast('Configure your export in the Scene & Environment panel.', 'info');
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

    // Tools Menu
    document.getElementById('btnCreatePrimitive')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-create-primitive');
    });
    document.getElementById('btnToggleCSG')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-csg');
      this.updateCSGGUI();
    });
    document.getElementById('btnToggleFacetEditor')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-facet');
    });
    document.getElementById('btnToggleTexturePanel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-textures');
    });
    document.getElementById('btnToggleOutliner')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-outliner');
    });
    document.getElementById('btnToggleMeshPanel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-mesh');
    });
    (document.getElementById('btnToggleMaterialPanel') || document.getElementById('btnToggleMatPanel'))?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-material');
    });
    document.getElementById('btnToggleScenePanel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-scene');
    });
    document.getElementById('btnToggleAnimPanel')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      this.toggleDialog('dialog-anim');
    });
    document.getElementById('btnToggleGrid')?.addEventListener('click', () => {
      this.closeAllDropdowns();
      const newGridState = !this.service.sceneParams.grid;
      this.service.setGridVisible(newGridState);
      this.updatePanelButtonStates();
      this.showToast(`Ground grid ${newGridState ? 'enabled' : 'disabled'}`, 'info');
    });

    // Layout Mode (Floating vs Stack)
    document.getElementById('btnLayoutFloating')?.addEventListener('click', () => this.setLayoutMode('floating'));
    document.getElementById('btnLayoutStack')?.addEventListener('click', () => this.setLayoutMode('stackpanel'));

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
      }
    });

    // Setup Floating Dialogs & Dragging
    for (const id of this.dialogIds) {
      const dialog = document.getElementById(id);
      if (dialog) this.setupFloatingDialog(dialog);
    }

    // Restore saved window layout and active tools from localStorage
    this.restoreDialogLayout();
    this.updatePanelButtonStates();

    // Help Modal
    const helpModal = document.getElementById('helpModal');
    document.getElementById('btnHelp')?.addEventListener('click', () => helpModal?.classList.add('active'));
    document.getElementById('btnCloseHelp')?.addEventListener('click', () => helpModal?.classList.remove('active'));
    document.getElementById('btnHelpDone')?.addEventListener('click', () => helpModal?.classList.remove('active'));
    helpModal?.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.remove('active');
    });

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
      const sidebarPanels = Array.from(
        (this.rootContainer || document).querySelectorAll('.stackpanel-sidebar .floating-dialog')
      ) as HTMLElement[];
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
    } else {
      document.body.classList.remove('layout-stackpanel');
      this.rootContainer?.classList.remove('layout-stackpanel');
      this.restoreDialogLayout();
      if (save) {
        this.showToast('Switched to Floating windows layout', 'info');
      }
    }
    this.updatePanelButtonStates();
  }

  private setupFloatingDialog(dialog: HTMLElement): void {
    const header = dialog.querySelector('.dialog-header') as HTMLElement;
    const btnClose = dialog.querySelector('.btn-close');
    const btnMin = dialog.querySelector('.btn-min');
    const title = dialog.querySelector('.dialog-title');

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
      this.toggleDialogMinimize(dialog);
    });

    // In stackpanel mode, clicking anywhere in header (except buttons) toggles collapse
    if (header) {
      header.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) return;
        if (this.layoutMode === 'stackpanel') {
          this.toggleDialogMinimize(dialog);
        }
      });
    }

    // Bring to front
    dialog.addEventListener('mousedown', () => {
      this.bringDialogToFront(dialog);
    });

    // Dragging
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

  public toggleDialogMinimize(dialog: HTMLElement, forceState?: boolean): void {
    const isCurrentlyMin = dialog.classList.contains('minimized');
    const willBeMin = forceState !== undefined ? forceState : !isCurrentlyMin;

    if (willBeMin) {
      dialog.classList.add('minimized');
    } else {
      dialog.classList.remove('minimized');
      if (this.layoutMode === 'stackpanel') {
        this.accordionMinimizeOthers(dialog);
      }
    }

    const btnMin = dialog.querySelector('.btn-min') as HTMLElement | null;
    if (btnMin) {
      btnMin.innerHTML = `<i class="app-icon" data-lucide="${willBeMin ? 'plus' : 'minus'}"></i>`;
      btnMin.title = willBeMin ? 'Expand' : 'Minimize';
    }
    this.refreshIcons();
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
          const btnMin = other.querySelector('.btn-min') as HTMLElement | null;
          if (btnMin) {
            btnMin.innerHTML = '<i class="app-icon" data-lucide="plus"></i>';
            btnMin.title = 'Expand';
          }
        }
      }
    }
    this.refreshIcons();
    this.saveDialogLayout();
  }

  public toggleDialog(id: string, forceOpen?: boolean): void {
    const dialog = this.getElement(id);
    if (!dialog) return;

    const isCurrentlyOpen =
      dialog.style.display !== 'none' && (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none');
    const willOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;
    dialog.style.display = willOpen ? 'flex' : 'none';

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
    }

    this.refreshIcons();
    this.updatePanelButtonStates();
    this.saveDialogLayout();
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
        // First time execution: activate all tools & panels by default
        for (const id of this.dialogIds) {
          const dialog = this.getElement(id);
          if (dialog) {
            dialog.style.display = 'flex';
            dialog.classList.remove('minimized');
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
        const btnMin = dialog.querySelector('.btn-min') as HTMLElement | null;
        if (btnMin) {
          btnMin.innerHTML = `<i class="app-icon" data-lucide="${isMin ? 'plus' : 'minus'}"></i>`;
          btnMin.title = isMin ? 'Expand' : 'Minimize';
        }
      }

      // Safeguard: If every dialog is closed, activate all tools by default
      const anyOpen = this.dialogIds.some((id) => {
        const d = this.getElement(id);
        return d && d.style.display !== 'none';
      });
      if (!anyOpen) {
        for (const id of this.dialogIds) {
          const d = this.getElement(id);
          if (d) d.style.display = 'flex';
        }
      }

      this.updatePanelButtonStates();
      this.refreshIcons();
    } catch (e) {
      console.warn('Failed to restore dialog layout:', e);
    }
  }

  public updatePanelButtonStates(): void {
    const mapping: { [dialogId: string]: string } = {
      'dialog-outliner': 'btnToggleOutliner',
      'dialog-create-primitive': 'btnCreatePrimitive',
      'dialog-csg': 'btnToggleCSG',
      'dialog-facet': 'btnToggleFacetEditor',
      'dialog-mesh': 'btnToggleMeshPanel',
      'dialog-material': 'btnToggleMaterialPanel',
      'dialog-scene': 'btnToggleScenePanel',
      'dialog-anim': 'btnToggleAnimPanel',
      'dialog-textures': 'btnToggleTexturePanel',
    };

    for (const [dialogId, btnId] of Object.entries(mapping)) {
      const dialog = this.getElement(dialogId);
      const btn = this.getElement(btnId);
      if (dialog && btn) {
        const isOpen =
          dialog.style.display !== 'none' && (dialog.style.display !== '' || window.getComputedStyle(dialog).display !== 'none');
        btn.classList.toggle('active', isOpen);
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

    const fExport = this.guiScene.addFolder('Export Model');
    fExport.add(this.service.exportParams, 'format', ['glb', 'gltf', 'obj', 'stl']).name('Format');
    fExport.add(this.service.exportParams, 'filename').name('Filename');
    fExport.add(this.service.exportParams, 'selectedOnly').name('Selected Only');
    fExport.add({ exportNow: () => this.service.exportCurrentModel() }, 'exportNow').name('Export File');
    fExport.open();

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
    this.guiMaterial.add(this.materialParams, 'replaceTexture').name('Replace Texture...');
    this.guiMaterial.add(this.materialParams, 'newMaterial').name('New PBR Material');

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

    // 5. CSG2 Boolean Sculpting GUI
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
    } else {
      this.materialParams.materialName = 'No material';
    }

    for (const key in this.materialControllers) {
      this.materialControllers[key]?.updateDisplay();
    }
    this.updateUVGUI();
  }

  /* =========================================================================
     OUTLINER SCENE HIERARCHY TREE
     ========================================================================= */
  public updateOutliner(): void {
    if (!this.outlinerTreeContainer) return;
    this.outlinerTreeContainer.innerHTML = '';

    const filter = this.searchFilter.toLowerCase().trim();
    const activeGroups = this.service.groups.filter((g) => !g.isDisposed());
    const rootMeshes = this.service.importedMeshes.filter(
      (m) => !this.service.isEditorHelper(m) && !m.isDisposed() && (!m.parent || !this.service.isGroupNode(m.parent))
    );

    if (activeGroups.length === 0 && rootMeshes.length === 0) {
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

    // 1. Groups
    for (const group of activeGroups) {
      const children = group.getChildren().filter((c) => c instanceof Mesh && !this.service.isEditorHelper(c)) as Mesh[];
      if (filter && !group.name.toLowerCase().includes(filter) && !children.some((c) => c.name.toLowerCase().includes(filter))) {
        continue;
      }

      const isGroupSelected = this.service.selectedNodes.includes(group);
      const groupNodeWrapper = document.createElement('div');
      groupNodeWrapper.className = 'outliner-node';

      const groupRow = document.createElement('div');
      groupRow.className = `outliner-item outliner-item-group ${isGroupSelected ? 'selected' : ''}`;

      const left = document.createElement('div');
      left.className = 'outliner-item-left';

      const icon = document.createElement('span');
      icon.className = 'outliner-item-icon';
      icon.innerHTML = '<i class="app-icon" data-lucide="folder"></i>';
      left.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'outliner-item-name';
      name.textContent = group.name;
      left.appendChild(name);

      const badge = document.createElement('span');
      badge.className = 'outliner-badge';
      badge.textContent = `${children.length} Meshes`;
      left.appendChild(badge);

      groupRow.appendChild(left);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'outliner-item-actions';

      const btnVis = document.createElement('button');
      btnVis.className = 'outliner-btn';
      const hasGroupVis = children.some((c) => c.isVisible);
      btnVis.innerHTML = `<i class="app-icon" data-lucide="${hasGroupVis ? 'eye' : 'eye-off'}"></i>`;
      btnVis.title = 'Toggle group visibility';
      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVis = !children.some((c) => c.isVisible);
        for (const c of children) c.isVisible = nextVis;
        btnVis.innerHTML = `<i class="app-icon" data-lucide="${nextVis ? 'eye' : 'eye-off'}"></i>`;
        this.refreshIcons();
      });
      actions.appendChild(btnVis);

      const btnUngroup = document.createElement('button');
      btnUngroup.className = 'outliner-btn';
      btnUngroup.innerHTML = '<i class="app-icon" data-lucide="folder-minus"></i>';
      btnUngroup.title = 'Ungroup meshes';
      btnUngroup.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.selectNodes([group]);
        this.service.ungroupSelected();
      });
      actions.appendChild(btnUngroup);

      const btnDel = document.createElement('button');
      btnDel.className = 'outliner-btn';
      btnDel.innerHTML = '<i class="app-icon" data-lucide="trash-2"></i>';
      btnDel.title = 'Delete group';
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.selectNodes([group]);
        this.service.deleteSelected();
      });
      actions.appendChild(btnDel);

      groupRow.appendChild(actions);

      groupRow.addEventListener('click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
          this.service.toggleNodeSelection(group);
        } else if (e.shiftKey) {
          this.service.rangeSelectNodes(group);
        } else {
          this.service.selectNodes([group]);
        }
      });

      groupRow.addEventListener('dblclick', () => {
        this.service.focusOnTarget(group);
      });

      groupNodeWrapper.appendChild(groupRow);

      // Group children
      for (const child of children) {
        if (filter && !child.name.toLowerCase().includes(filter) && !group.name.toLowerCase().includes(filter)) {
          continue;
        }

        const isChildSelected = this.service.selectedNodes.includes(child);
        const childRow = document.createElement('div');
        childRow.className = `outliner-item outliner-item-child ${isChildSelected ? 'selected' : ''}`;

        const cLeft = document.createElement('div');
        cLeft.className = 'outliner-item-left';

        const cIcon = document.createElement('span');
        cIcon.className = 'outliner-item-icon';
        cIcon.innerHTML = '<i class="app-icon" data-lucide="box"></i>';
        cLeft.appendChild(cIcon);

        const cName = document.createElement('span');
        cName.className = 'outliner-item-name';
        cName.textContent = child.name;
        cLeft.appendChild(cName);

        const polyCount = Math.floor(child.getTotalIndices() / 3);
        const cBadge = document.createElement('span');
        cBadge.className = 'outliner-badge';
        cBadge.textContent = `${polyCount} Tris`;
        cLeft.appendChild(cBadge);

        childRow.appendChild(cLeft);

        const cActions = document.createElement('div');
        cActions.className = 'outliner-item-actions';

        const btnCVis = document.createElement('button');
        btnCVis.className = 'outliner-btn';
        btnCVis.innerHTML = `<i class="app-icon" data-lucide="${child.isVisible ? 'eye' : 'eye-off'}"></i>`;
        btnCVis.title = 'Toggle visibility';
        btnCVis.addEventListener('click', (e) => {
          e.stopPropagation();
          child.isVisible = !child.isVisible;
          btnCVis.innerHTML = `<i class="app-icon" data-lucide="${child.isVisible ? 'eye' : 'eye-off'}"></i>`;
          this.refreshIcons();
        });
        cActions.appendChild(btnCVis);

        const btnCCenter = document.createElement('button');
        btnCCenter.className = 'outliner-btn';
        btnCCenter.innerHTML = '<i class="app-icon" data-lucide="crosshair"></i>';
        btnCCenter.title = 'Center pivot on object';
        btnCCenter.addEventListener('click', (e) => {
          e.stopPropagation();
          this.service.centerMeshPivot(child);
          this.showToast(`Pivot of "${child.name}" centered`, 'success');
        });
        cActions.appendChild(btnCCenter);

        childRow.appendChild(cActions);

        childRow.addEventListener('click', (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey) {
            this.service.toggleNodeSelection(child);
          } else if (e.shiftKey) {
            this.service.rangeSelectNodes(child);
          } else {
            this.service.selectNodes([child]);
          }
        });

        childRow.addEventListener('dblclick', () => {
          this.service.focusOnTarget(child);
        });

        groupNodeWrapper.appendChild(childRow);
      }

      this.outlinerTreeContainer.appendChild(groupNodeWrapper);
    }

    // 2. Root Meshes
    for (const mesh of rootMeshes) {
      if (filter && !mesh.name.toLowerCase().includes(filter)) {
        continue;
      }

      const isSelected = this.service.selectedNodes.includes(mesh);
      const row = document.createElement('div');
      row.className = `outliner-item ${isSelected ? 'selected' : ''}`;

      const left = document.createElement('div');
      left.className = 'outliner-item-left';

      const icon = document.createElement('span');
      icon.className = 'outliner-item-icon';
      icon.innerHTML = '<i class="app-icon" data-lucide="box"></i>';
      left.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'outliner-item-name';
      name.textContent = mesh.name;
      left.appendChild(name);

      const polyCount = Math.floor(mesh.getTotalIndices() / 3);
      const badge = document.createElement('span');
      badge.className = 'outliner-badge';
      badge.textContent = `${polyCount} Tris`;
      left.appendChild(badge);

      row.appendChild(left);

      const actions = document.createElement('div');
      actions.className = 'outliner-item-actions';

      const btnVis = document.createElement('button');
      btnVis.className = 'outliner-btn';
      btnVis.innerHTML = `<i class="app-icon" data-lucide="${mesh.isVisible ? 'eye' : 'eye-off'}"></i>`;
      btnVis.title = 'Toggle visibility';
      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        mesh.isVisible = !mesh.isVisible;
        btnVis.innerHTML = `<i class="app-icon" data-lucide="${mesh.isVisible ? 'eye' : 'eye-off'}"></i>`;
        this.refreshIcons();
      });
      actions.appendChild(btnVis);

      const btnCenter = document.createElement('button');
      btnCenter.className = 'outliner-btn';
      btnCenter.innerHTML = '<i class="app-icon" data-lucide="crosshair"></i>';
      btnCenter.title = 'Center pivot on object';
      btnCenter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.centerMeshPivot(mesh);
        this.showToast(`Pivot of "${mesh.name}" centered`, 'success');
      });
      actions.appendChild(btnCenter);

      const btnDel = document.createElement('button');
      btnDel.className = 'outliner-btn';
      btnDel.innerHTML = '<i class="app-icon" data-lucide="trash-2"></i>';
      btnDel.title = 'Delete mesh';
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.service.selectMesh(mesh);
        this.service.deleteSelected();
      });
      actions.appendChild(btnDel);

      row.appendChild(actions);

      row.addEventListener('click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
          this.service.toggleNodeSelection(mesh);
        } else if (e.shiftKey) {
          this.service.rangeSelectNodes(mesh);
        } else {
          this.service.selectNodes([mesh]);
        }
      });

      row.addEventListener('dblclick', () => {
        this.service.focusOnTarget(mesh);
      });

      this.outlinerTreeContainer.appendChild(row);
    }

    this.refreshIcons();
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

    // Drag & Drop
    const dropZone = document.getElementById('dropOverlay') || document.getElementById('drop-zone');

    window.addEventListener('dragover', (e) => {
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
      e.preventDefault();
      if (dropZone) dropZone.classList.remove('active');

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
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key.toLowerCase();

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
        if (this.service.isPlaceModeActive) {
          this.service.cancelPlacementMode();
        }
      }
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
    }
  }

  private runInitialLoadingSequence(autoLoadUrl?: string): void {
    this.setStartupProgress(78, 'Activating 3D Tools & Panels...');

    const t1 = setTimeout(() => {
      this.setStartupProgress(100, 'Launching 3D Studio...');
    }, 260);

    const t2 = setTimeout(() => {
      this.hideStartupLoader();
    }, 560);

    this.startupTimerIds.push(t1, t2);

    const scene = this.service.getScene();
    const finalizeSceneInit = () => {
      if (autoLoadUrl) return;
      if (this.sceneLoaderTimerId) clearTimeout(this.sceneLoaderTimerId);
      this.sceneLoaderTimerId = setTimeout(() => {
        this.hideSceneLoader();
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

    const result = await this.service.performCSGOperation(targetMesh, toolMesh, op, this.csgParams.keepToolMesh);
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
      (m) => !this.service.isEditorHelper(m) && m.name !== '__root__' && m.getTotalVertices() > 0
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
    const tex = this.service.getActiveMaterialTexture();
    if (!tex) return;
    tex.uOffset = this.uvParams.uOffset;
    tex.vOffset = this.uvParams.vOffset;
    tex.uScale = this.uvParams.uScale;
    tex.vScale = this.uvParams.vScale;
    tex.wAng = (this.uvParams.rotation * Math.PI) / 180;
    const mode =
      this.uvParams.wrapMode === 'Clamp'
        ? Texture.CLAMP_ADDRESSMODE
        : this.uvParams.wrapMode === 'Mirror'
          ? Texture.MIRROR_ADDRESSMODE
          : Texture.WRAP_ADDRESSMODE;
    tex.wrapU = mode;
    tex.wrapV = mode;
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
}
