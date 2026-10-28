import { BrowserPlatformAdapter } from './BrowserPlatformAdapter';
import { ElectronPlatformAdapter } from './ElectronPlatformAdapter';
import { HostAppAdapter } from './HostAppAdapter';
import type { HostAppAdapterOptions } from './HostAppAdapter';
import type { ElectronBridgeAPI, MeshEditorPlatformAdapter, NativeFilePayload } from './PlatformAdapter';

export { BrowserPlatformAdapter, ElectronPlatformAdapter, HostAppAdapter };
export type { HostAppAdapterOptions, MeshEditorPlatformAdapter, ElectronBridgeAPI, NativeFilePayload };

/**
 * Automatically detects the runtime environment and returns the appropriate default adapter:
 * - `ElectronPlatformAdapter` when running inside the macOS / Windows / Linux Electron app
 * - `BrowserPlatformAdapter` when running in a standard web browser
 */
export function createDefaultPlatformAdapter(): MeshEditorPlatformAdapter {
  if (ElectronPlatformAdapter.isSupported()) {
    return new ElectronPlatformAdapter();
  }
  return new BrowserPlatformAdapter();
}
