import type { MeshEditorApp } from '../MeshEditorApp';
import type { ExportOptions } from '../types';
import { MeshEditorPlatformAdapter } from './PlatformAdapter';

/**
 * Default adapter for running Mesh Editor as a standalone web application in any browser.
 * Uses standard HTML5 File inputs and Blob downloads.
 */
export class BrowserPlatformAdapter implements MeshEditorPlatformAdapter {
  public readonly id = 'browser';
  public readonly name = 'Standalone Web Browser Adapter';

  public initialize(_app: MeshEditorApp): void {
    // Standard browser mode requires no extra setup
  }

  public async openModelDialog(_app: MeshEditorApp): Promise<boolean> {
    return false; // Use standard HTML <input type="file">
  }

  public async importModelDialog(_app: MeshEditorApp): Promise<boolean> {
    return false; // Use standard HTML <input type="file">
  }

  public async saveExportedModel(
    _blob: Blob,
    _filename: string,
    _format: ExportOptions['format'],
    _app: MeshEditorApp
  ): Promise<boolean> {
    return false; // Use standard browser download
  }

  public onModelLoaded(filename: string, _app: MeshEditorApp): void {
    if (typeof document !== 'undefined' && document.body && document.getElementById('renderCanvas')?.parentElement === document.getElementById('app-container')) {
      document.title = `${filename} — Mesh Editor`;
    }
  }
}

