import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronPlatformAdapter } from '../../src/adapters/ElectronPlatformAdapter';
import type { ElectronBridgeAPI, NativeFilePayload } from '../../src/adapters/PlatformAdapter';
import type { MeshEditorApp } from '../../src/MeshEditorApp';

describe('ElectronPlatformAdapter Integration Tests', () => {
  let mockBridge: ElectronBridgeAPI & {
    menuListener?: (cmd: string, payload?: any) => void;
    openFileListener?: (payloads: NativeFilePayload[]) => void;
  };
  let mockApp: Partial<MeshEditorApp>;
  let registeredMenuItems: any[];

  beforeEach(() => {
    registeredMenuItems = [];
    mockBridge = {
      isElectron: true,
      platform: 'darwin',
      openFilesDialog: vi.fn(),
      saveFileDialog: vi.fn(),
      setWindowTitle: vi.fn(),
      setRepresentedFilename: vi.fn(),
      setDocumentEdited: vi.fn(),
      previewFile: vi.fn().mockResolvedValue({ success: true }),
      previewSnapshot: vi.fn().mockResolvedValue({ success: true, filePath: '/tmp/test.png' }),
      notifyReady: vi.fn(),
      onMenuCommand: vi.fn((cb) => {
        mockBridge.menuListener = cb;
        return () => {};
      }),
      onFileOpenFromOS: vi.fn((cb) => {
        mockBridge.openFileListener = cb;
        return () => {};
      }),
    };

    mockApp = {
      registerFileMenuItem: vi.fn((item) => {
        registeredMenuItems.push(item);
      }),
      openExportDialog: vi.fn(),
      triggerOpenModel: vi.fn(),
      triggerImportModel: vi.fn(),
      showToast: vi.fn(),
      setStatus: vi.fn(),
      setLayoutMode: vi.fn(),
      updatePanelButtonStates: vi.fn(),
      service: {
        events: {},
        loadFiles: vi.fn().mockResolvedValue(undefined),
        importFiles: vi.fn().mockResolvedValue(undefined),
        replaceSelectedTexture: vi.fn().mockResolvedValue(undefined),
        undo: vi.fn(),
        redo: vi.fn(),
        copySelected: vi.fn(),
        pasteAtCursor: vi.fn(),
        duplicateSelectedMesh: vi.fn(),
        deleteSelected: vi.fn(),
        groupSelected: vi.fn(),
        ungroupSelected: vi.fn(),
        focusOnSelected: vi.fn(),
        setGridVisible: vi.fn(),
        sceneParams: { grid: true },
        aiAgent: {
          captureViewportDataUrl: vi.fn().mockReturnValue('data:image/png;base64,mockImage'),
        },
        canvas: document.createElement('canvas'),
      } as any,
    };
  });

  it('detects Electron environment and registers native menus & Quick Look on macOS', () => {
    const adapter = new ElectronPlatformAdapter(mockBridge);
    expect(adapter.id).toBe('electron');

    adapter.initialize(mockApp as MeshEditorApp);

    expect(mockBridge.notifyReady).toHaveBeenCalled();
    expect(document.body.classList.contains('is-electron')).toBe(true);
    expect(document.body.classList.contains('is-electron-mac')).toBe(true);

    // Verifies File menu registration
    const saveAsItem = registeredMenuItems.find((i) => i.id === 'menuFileNativeSaveAs');
    const quickLookItem = registeredMenuItems.find((i) => i.id === 'menuFileNativeQuickLook');

    expect(saveAsItem).toBeDefined();
    expect(saveAsItem.shortcut).toBe('⌘S');
    expect(quickLookItem).toBeDefined();
    expect(quickLookItem.shortcut).toBe('Space');
  });

  it('triggers native macOS Quick Look for disk files and generated viewport snapshots', async () => {
    const adapter = new ElectronPlatformAdapter(mockBridge);
    adapter.initialize(mockApp as MeshEditorApp);

    // 1. Without loaded file on disk: triggers Quick Look snapshot preview
    const snapshotSuccess = await adapter.triggerQuickLook(mockApp as MeshEditorApp);
    expect(snapshotSuccess).toBe(true);
    expect(mockBridge.previewSnapshot).toHaveBeenCalledWith(
      'data:image/png;base64,mockImage',
      '3D_Model_Preview.png',
      expect.any(String)
    );

    // 2. With loaded .glb file on disk: triggers beauty preview snapshot because macOS cannot natively parse GLB
    mockBridge.openFilesDialog = vi.fn().mockResolvedValue([
      {
        name: 'model.glb',
        path: '/Users/test/Documents/model.glb',
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'model/gltf-binary',
      },
    ]);

    await adapter.openModelDialog(mockApp as MeshEditorApp);
    expect(mockBridge.setRepresentedFilename).toHaveBeenCalledWith('/Users/test/Documents/model.glb');
    expect(mockBridge.setDocumentEdited).toHaveBeenCalledWith(false);

    const glbSuccess = await adapter.triggerQuickLook(mockApp as MeshEditorApp);
    expect(glbSuccess).toBe(true);
    expect(mockBridge.previewSnapshot).toHaveBeenCalled();

    // 3. With loaded .usdz file on disk: triggers native Quick Look file preview directly
    mockBridge.openFilesDialog = vi.fn().mockResolvedValue([
      {
        name: 'model.usdz',
        path: '/Users/test/Documents/model.usdz',
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'model/vnd.usdz+zip',
      },
    ]);

    await adapter.openModelDialog(mockApp as MeshEditorApp);
    const usdzSuccess = await adapter.triggerQuickLook(mockApp as MeshEditorApp);
    expect(usdzSuccess).toBe(true);
    expect(mockBridge.previewFile).toHaveBeenCalledWith('/Users/test/Documents/model.usdz');
  });

  it('handles files opened from OS (Finder double-click / Dock drag & drop)', async () => {
    const adapter = new ElectronPlatformAdapter(mockBridge);
    adapter.initialize(mockApp as MeshEditorApp);

    expect(mockBridge.openFileListener).toBeDefined();

    mockBridge.openFileListener!([
      {
        name: 'external.glb',
        path: '/Downloads/external.glb',
        data: new Uint8Array([4, 5, 6]),
        mimeType: 'model/gltf-binary',
      },
    ]);

    expect(mockBridge.setRepresentedFilename).toHaveBeenCalledWith('/Downloads/external.glb');
    expect(mockBridge.setDocumentEdited).toHaveBeenCalledWith(false);
    expect(mockApp.service!.loadFiles).toHaveBeenCalled();
  });

  it('updates document edited indicator on scene modification and resets on save', async () => {
    const adapter = new ElectronPlatformAdapter(mockBridge);
    adapter.initialize(mockApp as MeshEditorApp);

    // Simulate scene edit
    mockApp.service!.events.onSceneModified!();
    expect(mockBridge.setDocumentEdited).toHaveBeenCalledWith(true);

    // Simulate saving file
    mockBridge.saveFileDialog = vi.fn().mockResolvedValue({
      saved: true,
      filePath: '/Saved/scene.glb',
    });

    const blob = new Blob([new Uint8Array([0, 1])]);
    await adapter.saveExportedModel(blob, 'scene.glb', 'glb', mockApp as MeshEditorApp);

    expect(mockBridge.setRepresentedFilename).toHaveBeenCalledWith('/Saved/scene.glb');
    expect(mockBridge.setDocumentEdited).toHaveBeenCalledWith(false);
  });
});

