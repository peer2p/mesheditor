import { HostAppAdapter, HostAppAdapterOptions } from '../adapters';
import { MeshEditorApp } from '../MeshEditorApp';
import { MeshEditorService } from '../MeshEditorService';
import { MeshEditorPlugin } from '../plugin';
import { ensureMeshEditorStyles } from '../styles';
import { getMeshEditorTemplate } from '../template';
import { ExportOptions } from '../types';

export interface MeshEditorElementEvents {
  'editor-ready': CustomEvent<{ app: MeshEditorApp; service: MeshEditorService }>;
  'model-loaded': CustomEvent<{ filename: string }>;
  'scene-modified': CustomEvent<{ meshCount: number; polyCount: number }>;
  'selection-changed': CustomEvent<{
    selectedNodes: any[];
    selectedMesh: any | null;
    subMeshId: number | null;
  }>;
  'model-exported': CustomEvent<{ blob: Blob; filename: string; format: ExportOptions['format'] }>;
  'model-saved': CustomEvent<{ blob: Blob; filename: string }>;
}

/**
 * Custom Web Component `<mesh-editor>` for embedding
 * the 3D Mesh Editor into any web application (Vanilla, React, Vue, Angular, Svelte).
 *
 * Example usage:
 * ```html
 * <mesh-editor
 *   src="/assets/models/robot.glb"
 *   layout="stackpanel"
 *   save-button-label="Save to Project"
 * ></mesh-editor>
 * ```
 */
export class MeshEditorElement extends HTMLElement {
  public static get observedAttributes(): string[] {
    return ['src', 'model-url', 'layout', 'grid', 'clear-color', 'suppress-download', 'save-button-label'];
  }

  public app: MeshEditorApp | null = null;
  public hostAdapter: HostAppAdapter | null = null;
  private isMounted: boolean = false;

  public get service(): MeshEditorService | null {
    return this.app ? this.app.service : null;
  }

  public connectedCallback(): void {
    if (this.isMounted) return;
    this.isMounted = true;

    // Ensure styles are injected into the document or root node
    ensureMeshEditorStyles(this.getRootNode() as Document | ShadowRoot);

    // Create container if not present
    let appContainer = this.querySelector('#app-container') as HTMLElement | null;
    if (!appContainer) {
      appContainer = document.createElement('div');
      appContainer.id = 'app-container';
      appContainer.innerHTML = getMeshEditorTemplate();
      this.appendChild(appContainer);
    }

    const suppressDownload =
      this.hasAttribute('suppress-download') && this.getAttribute('suppress-download') !== 'false';
    const saveButtonLabel = this.getAttribute('save-button-label') || undefined;

    const adapterOptions: HostAppAdapterOptions = {
      suppressBrowserDownload: suppressDownload,
      saveButtonLabel,
      onModelLoaded: (filename) => {
        this.emitEvent('model-loaded', { filename });
      },
      onModelExported: (blob, filename, format) => {
        this.emitEvent('model-exported', { blob, filename, format });
      },
      onSaveToHost: saveButtonLabel
        ? (blob, filename) => {
            this.emitEvent('model-saved', { blob, filename });
          }
        : undefined,
    };

    this.hostAdapter = new HostAppAdapter(adapterOptions);

    const layoutAttr = this.getAttribute('layout') as 'floating' | 'stackpanel' | null;
    const initialModelUrl = this.getAttribute('src') || this.getAttribute('model-url') || undefined;

    this.app = new MeshEditorApp({
      container: appContainer,
      adapter: this.hostAdapter,
      layoutMode: layoutAttr === 'stackpanel' || layoutAttr === 'floating' ? layoutAttr : undefined,
      autoLoadUrl: initialModelUrl,
      events: {
        onSceneModified: () => {
          const meshCount = this.app?.service.importedMeshes.length || 0;
          let polyCount = 0;
          for (const m of this.app?.service.importedMeshes || []) {
            polyCount += Math.floor((m.getTotalIndices ? m.getTotalIndices() : 0) / 3);
          }
          this.emitEvent('scene-modified', { meshCount, polyCount });
        },
        onSelectionChanged: (selectedNodes, selectedMesh, subMeshId) => {
          this.emitEvent('selection-changed', { selectedNodes, selectedMesh, subMeshId });
        },
      },
    });

    // Apply initial attribute states
    const gridAttr = this.getAttribute('grid');
    if (gridAttr !== null) {
      this.app.service.setGridVisible(gridAttr !== 'false');
    }

    const clearColorAttr = this.getAttribute('clear-color');
    if (clearColorAttr) {
      this.app.service.setClearColor(clearColorAttr);
    }

    this.emitEvent('editor-ready', { app: this.app, service: this.app.service });
  }

  public disconnectedCallback(): void {
    if (this.app) {
      this.app.dispose();
      this.app = null;
    }
    this.isMounted = false;
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.app || oldValue === newValue) return;

    switch (name) {
      case 'src':
      case 'model-url':
        if (newValue) {
          this.app.service.loadFromUrl(newValue);
        }
        break;
      case 'layout':
        if (newValue === 'floating' || newValue === 'stackpanel') {
          this.app.setLayoutMode(newValue, false);
        }
        break;
      case 'grid':
        this.app.service.setGridVisible(newValue !== 'false');
        this.app.updatePanelButtonStates();
        break;
      case 'clear-color':
        if (newValue) {
          this.app.service.setClearColor(newValue);
        }
        break;
      case 'suppress-download':
        if (this.hostAdapter) {
          this.hostAdapter.options.suppressBrowserDownload = newValue !== null && newValue !== 'false';
        }
        break;
    }
  }

  /* =========================================================================
     PUBLIC WEB COMPONENT API FOR HOST APPLICATIONS
     ========================================================================= */

  /**
   * Clears the scene and opens a 3D model from a URL, File, Blob, or ArrayBuffer.
   */
  public async openModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void> {
    if (!this.app) return;
    if (typeof source === 'string') {
      await this.app.service.loadFromUrl(source, name);
    } else if (source instanceof File) {
      await this.app.service.loadFile(source);
    } else if (source instanceof Blob) {
      await this.app.service.loadFile(new File([source], name || 'model.glb'));
    } else if (source instanceof ArrayBuffer) {
      await this.app.service.loadFile(new File([new Blob([source])], name || 'model.glb'));
    }
  }

  /**
   * Appends a 3D model into the current scene without clearing existing objects.
   */
  public async importModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void> {
    if (!this.app) return;
    if (typeof source === 'string') {
      await this.app.service.importFromUrl(source, name);
    } else if (source instanceof File) {
      await this.app.service.importFile(source);
    } else if (source instanceof Blob) {
      await this.app.service.importFile(new File([source], name || 'model.glb'));
    } else if (source instanceof ArrayBuffer) {
      await this.app.service.importFile(new File([new Blob([source])], name || 'model.glb'));
    }
  }

  /**
   * Exports the current scene to a binary GLB Blob.
   */
  public async exportGLB(filename?: string): Promise<Blob> {
    if (!this.app) {
      throw new Error('MeshEditor is not mounted.');
    }
    return await this.app.service.exportToGLBBlob(filename);
  }

  /**
   * Triggers a model export using the specified format ('glb' | 'gltf' | 'obj' | 'stl').
   */
  public async exportModel(options?: Partial<ExportOptions>): Promise<void> {
    if (!this.app) return;
    await this.app.service.exportCurrentModel(options);
  }

  /**
   * Opens the model export dialog.
   */
  public openExportDialog(): void {
    this.app?.openExportDialog();
  }

  /**
   * Clears all meshes and resets the scene.
   */
  public clearScene(): void {
    this.app?.service.clearModel();
  }

  /**
   * Registers a plugin with the embedded Mesh Editor instance.
   */
  public async usePlugin(plugin: MeshEditorPlugin): Promise<void> {
    if (!this.app) return;
    await this.app.use(plugin);
  }

  private emitEvent<K extends keyof MeshEditorElementEvents>(
    type: K,
    detail: MeshEditorElementEvents[K]['detail']
  ): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }
}

/**
 * Registers the `<mesh-editor>` custom element in the browser.
 * Safe to call multiple times.
 */
export function registerMeshEditorElement(tagName: string = 'mesh-editor'): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;

  if (!customElements.get(tagName)) {
    customElements.define(tagName, MeshEditorElement);
  }
}
