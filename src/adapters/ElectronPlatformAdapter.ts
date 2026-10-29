import type { MeshEditorApp } from '../MeshEditorApp';
import type { ExportOptions } from '../types';
import { ElectronBridgeAPI, MeshEditorPlatformAdapter, NativeFilePayload } from './PlatformAdapter';

/**
 * Desktop Platform Adapter for Electron (macOS, Windows, Linux).
 * Integrates native OS file open/save dialogs, native application menu bar commands,
 * and window title updates.
 */
export class ElectronPlatformAdapter implements MeshEditorPlatformAdapter {
  public readonly id = 'electron';
  public readonly name = 'Electron Desktop Adapter (macOS / Windows / Linux)';

  private bridge: ElectronBridgeAPI | undefined;
  private unsubscribeMenu?: () => void;

  constructor(bridge?: ElectronBridgeAPI) {
    this.bridge = bridge || (typeof window !== 'undefined' ? window.meshEditorElectron : undefined);
  }

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.meshEditorElectron?.isElectron;
  }

  public initialize(app: MeshEditorApp): void {
    if (!this.bridge) return;

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
      }
    });
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
      app.showToast(`Saved to ${res.filePath}`, 'success');
    } else {
      app.setStatus('Export cancelled');
    }
    return true;
  }

  public onModelLoaded(filename: string, _app: MeshEditorApp): void {
    this.bridge?.setWindowTitle?.(`${filename} — Mesh Editor`);
  }

  public dispose(): void {
    if (this.unsubscribeMenu) {
      this.unsubscribeMenu();
      this.unsubscribeMenu = undefined;
    }
  }
}

