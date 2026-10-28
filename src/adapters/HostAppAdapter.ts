import type { MeshEditorApp } from '../MeshEditorApp';
import type { ExportOptions } from '../types';
import { MeshEditorPlatformAdapter } from './PlatformAdapter';

export interface HostAppAdapterOptions {
  /**
   * Custom handler when the user clicks "Open..." in the editor.
   * Return an array of Files, a model URL string, or null if cancelled.
   */
  onRequestOpenModel?: () => Promise<File[] | string | null>;

  /**
   * Custom handler when the user clicks "Import..." in the editor.
   * Return an array of Files, a model URL string, or null if cancelled.
   */
  onRequestImportModel?: () => Promise<File[] | string | null>;

  /**
   * Callback invoked whenever a model is exported from the editor.
   */
  onModelExported?: (blob: Blob, filename: string, format: ExportOptions['format']) => void | Promise<void>;

  /**
   * Callback invoked when a model finishes loading.
   */
  onModelLoaded?: (filename: string) => void;

  /**
   * If true, suppresses the automatic browser file download when exporting,
   * allowing the host application or Web Component listener to handle the exported Blob exclusively.
   * Defaults to false.
   */
  suppressBrowserDownload?: boolean;

  /**
   * Optional label for a primary "Save to Host App" toolbar button.
   * If provided, adds a prominent save button to the top toolbar that exports a GLB
   * and triggers `onSaveToHost(blob, filename)`.
   */
  saveButtonLabel?: string;

  /**
   * Callback invoked when the user clicks the optional "Save to Host App" toolbar button.
   */
  onSaveToHost?: (blob: Blob, filename: string) => void | Promise<void>;
}

/**
 * Adapter for embedding the Mesh Editor inside a host web application
 * (e.g. React, Vue, Angular, Svelte, or via the `<mesh-editor>` Web Component).
 */
export class HostAppAdapter implements MeshEditorPlatformAdapter {
  public readonly id = 'host-app';
  public readonly name = 'Embedded Host Application Adapter';

  public options: HostAppAdapterOptions;

  constructor(options: HostAppAdapterOptions = {}) {
    this.options = options;
  }

  public initialize(app: MeshEditorApp): void {
    if (this.options.onSaveToHost) {
      const label = this.options.saveButtonLabel || 'Save Model';
      app.registerToolbarButton({
        id: 'btnHostAppSave',
        label,
        icon: 'save',
        title: `${label} (Export GLB to application)`,
        className: 'btn-primary',
        onClick: async () => {
          app.setStatus('Saving model...', true);
          try {
            const filename = app.service.currentFilename || 'model.glb';
            const blob = await app.service.exportToGLBBlob(filename.replace(/\.[^/.]+$/, ''));
            await this.options.onSaveToHost!(blob, filename);
            app.showToast(`Model "${filename}" saved!`, 'success');
            app.setStatus('Saved');
          } catch (err: any) {
            app.showToast(`Save failed: ${err?.message || err}`, 'error');
            app.setStatus('Save error');
          }
        },
      });
    }
  }

  public async openModelDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.options.onRequestOpenModel) return false;
    const result = await this.options.onRequestOpenModel();
    if (!result) return true;
    if (typeof result === 'string') {
      await app.service.loadFromUrl(result);
    } else if (Array.isArray(result) && result.length > 0) {
      await app.service.loadFiles(result);
    }
    return true;
  }

  public async importModelDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.options.onRequestImportModel) return false;
    const result = await this.options.onRequestImportModel();
    if (!result) return true;
    if (typeof result === 'string') {
      await app.service.importFromUrl(result);
    } else if (Array.isArray(result) && result.length > 0) {
      await app.service.importFiles(result);
    }
    return true;
  }

  public async saveExportedModel(
    blob: Blob,
    filename: string,
    format: ExportOptions['format'],
    _app: MeshEditorApp
  ): Promise<boolean> {
    if (this.options.onModelExported) {
      await this.options.onModelExported(blob, filename, format);
    }
    return !!this.options.suppressBrowserDownload;
  }

  public onModelLoaded(filename: string, _app: MeshEditorApp): void {
    this.options.onModelLoaded?.(filename);
  }
}

