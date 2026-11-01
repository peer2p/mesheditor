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
  private unsubscribeKeyDown?: () => void;
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

      // Handle Spacebar shortcut for Quick Look (only when not editing text in inputs)
      if (typeof window !== 'undefined') {
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' && !e.repeat) {
            const target = e.target as HTMLElement | null;
            const isEditable =
              target &&
              (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                target.getAttribute('contenteditable') === 'true' ||
                target.closest('input') ||
                target.closest('textarea'));
            if (!isEditable) {
              e.preventDefault();
              this.triggerQuickLook(app);
            }
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        this.unsubscribeKeyDown = () => window.removeEventListener('keydown', handleKeyDown);
      }
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

  public async openBumpTextureDialog(app: MeshEditorApp): Promise<boolean> {
    if (!this.bridge) return false;
    const payloads = await this.bridge.openFilesDialog({
      title: 'Select Bump / Normal Map Image',
      multiSelections: false,
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'dds'],
    });
    if (!payloads) return true;
    if (payloads.length > 0) {
      const files = this.payloadsToFiles(payloads);
      app.service.applyBumpTextureToSelectedMaterial(files[0]);
      (app as any).updateMaterialGUI?.();
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

    // 1. If the current file is a format natively supported by macOS Quick Look (e.g. USDZ, images),
    // preview the file on disk directly.
    const ext = this.currentFilePath ? this.currentFilePath.split('.').pop()?.toLowerCase() : '';
    const isDirectlySupported = ['usdz', 'reality', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'].includes(
      ext || ''
    );

    if (this.currentFilePath && isDirectlySupported && this.bridge.previewFile) {
      const res = await this.bridge.previewFile(this.currentFilePath);
      if (res?.success) return true;
    }

    // 2. For 3D mesh formats (.glb, .gltf, .obj, .stl, .ply, .babylon) or unsaved scenes:
    // macOS Quick Look does not have a native glTF/OBJ parser.
    // Render a crisp beauty snapshot of the current 3D viewport canvas.
    try {
      app.service.scene?.render();
    } catch {
      // Ignore if headless or rendering not available
    }

    let snapshotDataUrl: string | null = null;
    try {
      if (app.service.canvas && typeof app.service.canvas.toDataURL === 'function') {
        snapshotDataUrl = app.service.canvas.toDataURL('image/png');
      }
    } catch {
      // Ignore
    }

    if (!snapshotDataUrl || !snapshotDataUrl.startsWith('data:image/')) {
      snapshotDataUrl = app.service.aiAgent?.captureViewportDataUrl() || null;
    }

    if (snapshotDataUrl && this.bridge.previewSnapshot) {
      const baseName = this.currentFilePath
        ? this.currentFilePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^/.]+$/, '')
        : (app.service.exportParams?.filename || '3D_Model');
      const filename = `${baseName}_Preview.png`;

      const res = await this.bridge.previewSnapshot(snapshotDataUrl, filename, filename);
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
    if (this.unsubscribeKeyDown) {
      this.unsubscribeKeyDown();
      this.unsubscribeKeyDown = undefined;
    }
  }
}
