import type { MeshEditorApp } from '../MeshEditorApp';
import type { ExportOptions } from '../types';
import { ElectronBridgeAPI, MeshEditorPlatformAdapter, NativeFilePayload } from './PlatformAdapter';

/**
 * Desktop Platform Adapter for Electron (macOS, Windows, Linux).
 * Integrates native OS file open/save dialogs, native application menu bar commands,
 * macOS Quick Look (Vorschau), proxy icons, file associations, and window styling.
 */
export class ElectronPlatformAdapter implements MeshEditorPlatformAdapter {
  public readonly id = 'electron';
  public readonly name = 'Electron Desktop Adapter (macOS / Windows / Linux)';

  private bridge: ElectronBridgeAPI | undefined;
  private unsubscribeMenu?: () => void;
  private unsubscribeOpenFile?: () => void;
  private currentFilePath?: string;

  constructor(bridge?: ElectronBridgeAPI) {
    this.bridge = bridge || (typeof window !== 'undefined' ? window.meshEditorElectron : undefined);
  }

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.meshEditorElectron?.isElectron;
  }

  public initialize(app: MeshEditorApp): void {
    if (!this.bridge) return;

    // Apply platform-specific classes for native macOS styling
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('is-electron');
      if (this.bridge.platform === 'darwin') {
        document.body.classList.add('is-electron-mac');
      }
    }

    // Register native "Save As..." in the File menu
    app.registerFileMenuItem({
      id: 'menuFileNativeSaveAs',
      label: 'Save Model As...',
      icon: 'save',
      shortcut: this.bridge.platform === 'darwin' ? '⌘S' : 'Ctrl+S',
      onClick: () => {
        app.openExportDialog();
      },
    });

    // Register native macOS Quick Look Preview in the File menu
    if (this.bridge.platform === 'darwin') {
      app.registerFileMenuItem({
        id: 'menuFileNativeQuickLook',
        label: 'Quick Look Preview',
        icon: 'eye',
        shortcut: 'Space',
        onClick: async () => {
          await this.triggerQuickLook(app);
        },
      });
    }

    // Hook scene modifications to update macOS native dirty indicator dot
    const origSceneModified = app.service.events.onSceneModified;
    app.service.events.onSceneModified = () => {
      origSceneModified?.();
      this.bridge?.setDocumentEdited?.(true);
    };

    const origHistoryChanged = app.service.events.onHistoryChanged;
    app.service.events.onHistoryChanged = (canUndo, canRedo) => {
      origHistoryChanged?.(canUndo, canRedo);
      this.bridge?.setDocumentEdited?.(canUndo);
    };

    // Listen to native OS Menu Bar commands (macOS / Windows / Linux)
    this.unsubscribeMenu = this.bridge.onMenuCommand(async (command: string) => {
      switch (command) {
        case 'file:open':
          await app.triggerOpenModel();
          break;
        case 'file:import':
          await app.triggerImportModel();
          break;
        case 'file:save':
        case 'file:export':
          app.openExportDialog();
          break;
        case 'file:quicklook':
          await this.triggerQuickLook(app);
          break;
        case 'edit:undo':
          app.service.undo();
          break;
        case 'edit:redo':
          app.service.redo();
          break;
        case 'edit:copy':
          app.service.copySelected();
          break;
        case 'edit:paste':
          app.service.pasteAtCursor();
          break;
        case 'edit:duplicate':
          app.service.duplicateSelectedMesh();
          break;
        case 'edit:delete':
          app.service.deleteSelected();
          break;
        case 'edit:group':
          app.service.groupSelected();
          break;
        case 'edit:ungroup':
          app.service.ungroupSelected();
          break;
        case 'view:focus':
          app.service.focusOnSelected();
          break;
        case 'view:toggle-grid':
          app.service.setGridVisible(!app.service.sceneParams.grid);
          app.updatePanelButtonStates();
          break;
        case 'view:layout-floating':
          app.setLayoutMode('floating');
          break;
        case 'view:layout-stack':
          app.setLayoutMode('stackpanel');
          break;
        case 'help:documentation':
          if (typeof app.openHelpModal === 'function') {
            app.openHelpModal();
          } else {
            const btnHelp = document.getElementById('btnHelp');
            btnHelp?.click();
          }
          break;
      }
    });

    // Listen to files opened from OS (Finder double-click, drag & drop to Dock icon, or CLI arguments)
    if (this.bridge.onFileOpenFromOS) {
      this.unsubscribeOpenFile = this.bridge.onFileOpenFromOS(async (payloads) => {
        if (payloads && payloads.length > 0) {
          if (payloads[0].path) {
            this.currentFilePath = payloads[0].path;
            this.bridge?.setRepresentedFilename?.(payloads[0].path);
            this.bridge?.setDocumentEdited?.(false);
          }
          const files = this.payloadsToFiles(payloads);
          await app.service.loadFiles(files);
        }
      });
    }

    // Signal main process that renderer is ready to receive any queued launch files
    this.bridge.notifyReady?.();
  }

  private payloadsToFiles(payloads: NativeFilePayload[]): File[] {
    return payloads.map((p) => {
      const uint8 = p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data);
      const blob = new Blob([uint8 as any], { type: p.mimeType || 'application/octet-stream' });
      const file = new File([blob], p.name, { type: p.mimeType || 'application/octet-stream' });
      if (p.path) {
        (file as any).nativePath = p.path;
      }
      return file;
    });
  }

  public async openModelDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.bridge) return false;
    const payloads = await this.bridge.openFilesDialog({
      title: 'Open 3D Model',
      multiSelections: true,
      extensions: ['glb', 'gltf', 'obj', 'stl', 'ply', 'babylon', 'bin', 'png', 'jpg', 'jpeg', 'webp'],
    });
    if (!payloads) return true; // User cancelled native dialog
    if (payloads.length > 0) {
      if (payloads[0].path) {
        this.currentFilePath = payloads[0].path;
        this.bridge.setRepresentedFilename?.(payloads[0].path);
        this.bridge.setDocumentEdited?.(false);
      }
      const files = this.payloadsToFiles(payloads);
      await app.service.loadFiles(files);
    }
    return true;
  }

  public async importModelDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.bridge) return false;
    const payloads = await this.bridge.openFilesDialog({
      title: 'Import 3D Model into Scene',
      multiSelections: true,
      extensions: ['glb', 'gltf', 'obj', 'stl', 'ply', 'babylon', 'bin', 'png', 'jpg', 'jpeg', 'webp'],
    });
    if (!payloads) return true;
    if (payloads.length > 0) {
      const files = this.payloadsToFiles(payloads);
      await app.service.importFiles(files);
    }
    return true;
  }

  public async openTextureDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.bridge) return false;
    const payloads = await this.bridge.openFilesDialog({
      title: 'Select Texture Image',
      multiSelections: false,
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
    });
    if (!payloads) return true;
    if (payloads.length > 0) {
      const files = this.payloadsToFiles(payloads);
      await app.service.replaceSelectedTexture(files[0]);
    }
    return true;
  }

  public async saveExportedModel(
    blob: Blob,
    filename: string,
    format: ExportOptions['format'],
    app: MeshEditorApp
  ): Promise<boolean> {
    if (!this.bridge) return false;

    const ext = `.${format.toLowerCase()}`;
    const fullFilename = filename.toLowerCase().endsWith(ext) ? filename : `${filename}${ext}`;
    const buffer = await blob.arrayBuffer();

    const res = await this.bridge.saveFileDialog({
      title: `Export 3D Model (${format.toUpperCase()})`,
      defaultPath: fullFilename,
      data: new Uint8Array(buffer),
      format,
    });

    if (res.saved && res.filePath) {
      this.currentFilePath = res.filePath;
      this.bridge.setRepresentedFilename?.(res.filePath);
      this.bridge.setDocumentEdited?.(false);
      app.showToast(`Saved to ${res.filePath}`, 'success');
    } else {
      app.setStatus('Export cancelled');
    }
    return true;
  }

  /**
   * Triggers native macOS Quick Look preview for the current model or a rendered viewport snapshot.
   */
  public async triggerQuickLook(app: MeshEditorApp): Promise<boolean> {
    if (!this.bridge) return false;

    // 1. If currently loaded file exists on disk, preview it directly via macOS Quick Look
    if (this.currentFilePath && this.bridge.previewFile) {
      const res = await this.bridge.previewFile(this.currentFilePath);
      if (res?.success) return true;
    }

    // 2. Otherwise generate a viewport beauty snapshot and preview that via Quick Look
    const snapshotDataUrl =
      app.service.aiAgent?.captureViewportDataUrl() ||
      (app.service.canvas && typeof app.service.canvas.toDataURL === 'function'
        ? app.service.canvas.toDataURL('image/png')
        : null);

    if (snapshotDataUrl && this.bridge.previewSnapshot) {
      const res = await this.bridge.previewSnapshot(
        snapshotDataUrl,
        `MeshEditor_Preview_${Date.now()}.png`
      );
      if (res?.success) {
        return true;
      }
    }

    app.showToast('Could not open macOS Quick Look preview.', 'warning');
    return false;
  }

  public onModelLoaded(filename: string, _app: MeshEditorApp): void {
    this.bridge?.setWindowTitle?.(`${filename} — Mesh Editor`);
    this.bridge?.setDocumentEdited?.(false);
  }

  public dispose(): void {
    if (this.unsubscribeMenu) {
      this.unsubscribeMenu();
      this.unsubscribeMenu = undefined;
    }
    if (this.unsubscribeOpenFile) {
      this.unsubscribeOpenFile();
      this.unsubscribeOpenFile = undefined;
    }
  }
}
