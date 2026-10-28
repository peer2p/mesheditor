import type { MeshEditorApp } from '../MeshEditorApp';
import type { ExportOptions } from '../types';

export interface NativeFilePayload {
  name: string;
  path?: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string;
}

export interface ElectronBridgeAPI {
  readonly isElectron: boolean;
  readonly platform: string; // 'darwin' | 'win32' | 'linux'
  openFilesDialog(options?: {
    title?: string;
    multiSelections?: boolean;
    extensions?: string[];
  }): Promise<NativeFilePayload[] | null>;
  saveFileDialog(options: {
    title?: string;
    defaultPath?: string;
    data: Uint8Array | ArrayBuffer;
    format?: string;
  }): Promise<{ saved: boolean; filePath?: string }>;
  onMenuCommand(callback: (command: string, payload?: any) => void): () => void;
  setWindowTitle?(title: string): void;
}

declare global {
  interface Window {
    meshEditorElectron?: ElectronBridgeAPI;
  }
}

/**
 * Adapter interface that abstracts platform-specific operations
 * (Standalone Browser, Electron Desktop App on macOS/Windows/Linux, or Embedded Host Web App).
 */
export interface MeshEditorPlatformAdapter {
  /**
   * Identifier of the platform adapter (e.g. 'browser', 'electron', 'host-app').
   */
  readonly id: string;

  /**
   * Human-readable name of the adapter.
   */
  readonly name: string;

  /**
   * Called when MeshEditorApp initializes this adapter.
   */
  initialize?(app: MeshEditorApp): void | Promise<void>;

  /**
   * Optional custom handler for "File > Open...".
   * Return `true` if the adapter handled the open dialog, or `false` to fall back to the browser file input.
   */
  openModelDialog?(app: MeshEditorApp): Promise<boolean>;

  /**
   * Optional custom handler for "File > Import...".
   * Return `true` if the adapter handled the import dialog, or `false` to fall back to the browser file input.
   */
  importModelDialog?(app: MeshEditorApp): Promise<boolean>;

  /**
   * Optional custom handler for "Replace Texture...".
   * Return `true` if the adapter handled the texture dialog, or `false` to fall back to the browser file input.
   */
  openTextureDialog?(app: MeshEditorApp): Promise<boolean>;

  /**
   * Optional custom handler for saving/exporting a 3D model.
   * Return `true` if the adapter handled saving (e.g., native OS save dialog or host app callback),
   * or `false` to fall back to standard browser download.
   */
  saveExportedModel?(
    blob: Blob,
    filename: string,
    format: ExportOptions['format'],
    app: MeshEditorApp
  ): Promise<boolean>;

  /**
   * Optional notification hook invoked when a model has been loaded.
   */
  onModelLoaded?(filename: string, app: MeshEditorApp): void;

  /**
   * Cleanup resources when the editor is disposed.
   */
  dispose?(): void;
}

