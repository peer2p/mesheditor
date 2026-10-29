import { Scene } from '@babylonjs/core';
import type { MeshEditorApp } from './MeshEditorApp';
import type { MeshEditorService } from './MeshEditorService';

/**
 * Definition for a dropdown menu item registered by a plugin.
 * Used for extending the File, Actions, or Tools dropdown menus.
 */
export interface MenuItemDefinition {
  /**
   * Unique identifier for the menu item DOM element.
   * Example: 'menuFileCustomImport'
   */
  id: string;

  /**
   * Human-readable label displayed inside the dropdown item.
   * Example: 'Asset Library...'
   */
  label: string;

  /**
   * Optional Lucide icon name (without prefix).
   * Example: 'folder', 'save', 'library', 'sparkles', 'wrench'
   */
  icon?: string;

  /**
   * Optional keyboard shortcut badge displayed on the right edge of the item.
   * Example: '⌘S', '⌥A', '⇧⌘G'
   */
  shortcut?: string;

  /**
   * If true, styles the item with a danger/red accent on hover.
   * Suitable for destructive actions like delete or reset.
   */
  danger?: boolean;

  /**
   * Display ordering priority (lower numbers appear first).
   * Defaults to appending at the end of the plugin section.
   */
  order?: number;

  /**
   * Callback invoked when the user clicks this menu item.
   * Can be synchronous or asynchronous.
   */
  onClick: () => void | Promise<void>;
}

/**
 * Definition for a top toolbar button registered by a plugin.
 */
export interface ToolbarButtonDefinition {
  /**
   * Unique identifier for the toolbar button DOM element.
   * Example: 'btnQuickAssetLibrary'
   */
  id: string;

  /**
   * Text label displayed alongside or inside the button.
   */
  label: string;

  /**
   * Optional Lucide icon name (without prefix).
   * Example: 'library', 'download', 'upload'
   */
  icon?: string;

  /**
   * Optional tooltip text displayed on hover.
   */
  title?: string;

  /**
   * Optional additional CSS classes to style the button.
   * Example: 'btn-primary', 'btn-export'
   */
  className?: string;

  /**
   * Callback invoked when the user clicks the toolbar button.
   * Can be synchronous or asynchronous.
   */
  onClick: () => void | Promise<void>;
}

/**
 * The execution context provided to a plugin during its `initialize()` lifecycle.
 * Exposes editor APIs, menu hooks, scene interactions, and notification helpers
 * without creating tight couplings to project-specific paths.
 */
export interface MeshEditorPluginContext {
  /**
   * Reference to the UI application coordinator instance.
   */
  readonly app: MeshEditorApp;

  /**
   * Reference to the core 3D engine and editing service instance.
   */
  readonly service: MeshEditorService;

  /**
   * Registers an item into the File dropdown menu under the plugin section.
   *
   * @param item - The menu item definition with id, label, icon, shortcut, and onClick.
   */
  registerFileMenuItem(item: MenuItemDefinition): void;

  /**
   * Registers an item into the Actions dropdown menu under the plugin section.
   *
   * @param item - The menu item definition with id, label, icon, shortcut, and onClick.
   */
  registerActionMenuItem(item: MenuItemDefinition): void;

  /**
   * Registers an item into the Tools dropdown menu under the plugin section.
   *
   * @param item - The menu item definition with id, label, icon, shortcut, and onClick.
   */
  registerToolMenuItem(item: MenuItemDefinition): void;

  /**
   * Registers an item into the View dropdown menu under the plugin section.
   *
   * @param item - The menu item definition with id, label, icon, shortcut, and onClick.
   */
  registerViewMenuItem(item: MenuItemDefinition): void;

  /**
   * Registers a direct quick-access button into the top toolbar.
   *
   * @param button - The toolbar button definition with id, label, icon, and onClick.
   */
  registerToolbarButton(button: ToolbarButtonDefinition): void;

  /**
   * Displays an animated toast notification banner at the bottom-right of the viewport.
   *
   * @param message - The text message to display.
   * @param type - Notification severity style: 'info' | 'success' | 'warning' | 'error'.
   */
  showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;

  /**
   * Sets the status indicator message in the bottom status bar.
   *
   * @param message - Status text to display.
   * @param isBusy - If true, pulses the status indicator dot to indicate background work.
   */
  setStatus(message: string, isBusy?: boolean): void;

  /**
   * Clears the current scene and loads a fresh 3D model into the editor.
   * Supports URLs, File objects, Blobs, and ArrayBuffers (.glb, .gltf, .obj, .stl).
   *
   * @param source - File, Blob, ArrayBuffer, or URL string of the 3D model.
   * @param name - Optional filename to assign to the loaded model.
   */
  openModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void>;

  /**
   * Imports and appends a 3D model into the active scene without clearing existing meshes.
   *
   * @param source - File, Blob, ArrayBuffer, or URL string of the 3D model.
   * @param name - Optional filename to assign to the imported model.
   */
  importModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void>;

  /**
   * Exports the entire scene (or current model) to a binary glTF (.glb) Blob.
   *
   * @param filename - Optional export filename (e.g. 'custom_model.glb').
   * @returns A Promise resolving to the binary GLB Blob.
   */
  exportGLB(filename?: string): Promise<Blob>;

  /**
   * Gets the active filename of the currently opened model.
   *
   * @returns Current filename string (e.g. 'hero.glb').
   */
  getCurrentFilename(): string;

  /**
   * Sets or updates the active model filename in the editor.
   *
   * @param name - New filename string.
   */
  setCurrentFilename(name: string): void;

  /**
   * Returns the underlying BabylonJS Scene instance for advanced custom rendering.
   *
   * @returns The active BabylonJS Scene.
   */
  getScene(): Scene;
}

/**
 * Interface that all MeshEditor plugins must implement.
 *
 * Plugins are modular extensions that can inject custom menus, modals,
 * project-specific asset integrations, or custom tools into the editor.
 */
export interface MeshEditorPlugin {
  /**
   * Unique identifier for the plugin (namespaced reverse-domain style recommended).
   * Example: 'myorg-model-importer', 'myorg-sketchfab-importer'
   */
  readonly id: string;

  /**
   * Human-readable display name for the plugin.
   * Example: 'Game Asset Library'
   */
  readonly name: string;

  /**
   * Optional semantic version string.
   * Example: '1.0.0'
   */
  readonly version?: string;

  /**
   * Optional brief description of what the plugin does.
   */
  readonly description?: string;

  /**
   * Lifecycle method called once when the plugin is registered with `MeshEditorApp.use()`.
   *
   * @param context - The plugin execution context exposing UI and service hooks.
   */
  initialize(context: MeshEditorPluginContext): void | Promise<void>;

  /**
   * Optional teardown lifecycle method called when the plugin is unregistered or the editor is destroyed.
   * Clean up event listeners, modals, or injected DOM elements here.
   */
  dispose?(): void;
}

/**
 * Manages plugin lifecycle, registration, extension registry, and execution contexts.
 */
export class PluginManager {
  private plugins: Map<string, MeshEditorPlugin> = new Map();
  private app: MeshEditorApp;
  private service: MeshEditorService;

  constructor(app: MeshEditorApp, service: MeshEditorService) {
    this.app = app;
    this.service = service;
  }

  /**
   * Registers and initializes a plugin with the editor.
   *
   * @param plugin - The plugin instance to register.
   */
  public async register(plugin: MeshEditorPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin with id "${plugin.id}" is already registered. Skipping.`);
      return;
    }

    const context = this.createContext(plugin);
    try {
      await plugin.initialize(context);
      this.plugins.set(plugin.id, plugin);
      console.log(`[PluginManager] Plugin "${plugin.name}" (${plugin.id}) registered successfully.`);
    } catch (err) {
      console.error(`[PluginManager] Failed to initialize plugin "${plugin.name}" (${plugin.id}):`, err);
      throw err;
    }
  }

  /**
   * Unregisters and disposes a plugin by its unique ID.
   *
   * @param pluginId - The unique ID of the plugin to remove.
   */
  public unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    if (plugin.dispose) {
      try {
        plugin.dispose();
      } catch (err) {
        console.error(`[PluginManager] Error disposing plugin "${plugin.name}":`, err);
      }
    }

    this.plugins.delete(pluginId);
    console.log(`[PluginManager] Plugin "${plugin.name}" (${pluginId}) unregistered.`);
  }

  /**
   * Retrieves a registered plugin by its ID.
   *
   * @param pluginId - The plugin ID to look up.
   * @returns The plugin instance or undefined if not registered.
   */
  public getPlugin(pluginId: string): MeshEditorPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Returns an array of all currently registered plugins.
   */
  public getAllPlugins(): MeshEditorPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Creates the specialized plugin context for a given plugin instance.
   */
  private createContext(plugin: MeshEditorPlugin): MeshEditorPluginContext {
    return {
      app: this.app,
      service: this.service,
      registerFileMenuItem: (item: MenuItemDefinition) => {
        this.app.registerFileMenuItem(item);
      },
      registerActionMenuItem: (item: MenuItemDefinition) => {
        this.app.registerActionMenuItem(item);
      },
      registerToolMenuItem: (item: MenuItemDefinition) => {
        this.app.registerToolMenuItem(item);
      },
      registerViewMenuItem: (item: MenuItemDefinition) => {
        this.app.registerViewMenuItem(item);
      },
      registerToolbarButton: (button: ToolbarButtonDefinition) => {
        this.app.registerToolbarButton(button);
      },
      showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => {
        this.app.showToast(message, type);
      },
      setStatus: (message: string, isBusy?: boolean) => {
        this.app.setStatus(message, isBusy);
      },
      openModel: async (source: File | Blob | ArrayBuffer | string, name?: string) => {
        if (typeof source === 'string') {
          await this.service.loadFromUrl(source, name);
        } else if (source instanceof File) {
          await this.service.loadFile(source);
        } else if (source instanceof Blob) {
          const file = new File([source], name || 'model.glb');
          await this.service.loadFile(file);
        } else if (source instanceof ArrayBuffer) {
          const blob = new Blob([source]);
          const file = new File([blob], name || 'model.glb');
          await this.service.loadFile(file);
        }
      },
      importModel: async (source: File | Blob | ArrayBuffer | string, name?: string) => {
        if (typeof source === 'string') {
          await this.service.importFromUrl(source, name);
        } else if (source instanceof File) {
          await this.service.importFile(source);
        } else if (source instanceof Blob) {
          const file = new File([source], name || 'model.glb');
          await this.service.importFile(file);
        } else if (source instanceof ArrayBuffer) {
          const blob = new Blob([source]);
          const file = new File([blob], name || 'model.glb');
          await this.service.importFile(file);
        }
      },
      exportGLB: async (filename?: string) => {
        return await this.service.exportToGLBBlob(filename);
      },
      getCurrentFilename: () => {
        return this.service.currentFilename;
      },
      setCurrentFilename: (name: string) => {
        this.service.currentFilename = name;
      },
      getScene: () => {
        return this.service.getScene();
      },
    };
  }
}
