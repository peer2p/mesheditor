import { NullEngine } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostAppAdapter } from '../../src/adapters/HostAppAdapter';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorPlugin } from '../../src/plugin';

describe('MeshEditorApp, PluginManager & HostAppAdapter Integration Tests', () => {
  let container: HTMLDivElement;
  let engine: NullEngine;
  let app: MeshEditorApp;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    container.id = 'test-host';
    document.body.appendChild(container);
    engine = new NullEngine();
  });

  afterEach(() => {
    if (app) {
      app.dispose();
    }
    container.remove();
  });

  it('activates all tools by default on first run and renders startup & scene 3D mesh loaders', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const expectedDialogs = [
      'dialog-outliner',
      'dialog-create-primitive',
      'dialog-csg',
      'dialog-facet',
      'dialog-scene',
      'dialog-mesh',
      'dialog-material',
      'dialog-anim',
      'dialog-textures',
    ];

    for (const id of expectedDialogs) {
      const dlg = container.querySelector(`#${id}`) as HTMLElement | null;
      expect(dlg).not.toBeNull();
      expect(dlg?.style.display).toBe('flex');
    }

    const startupLoader = container.querySelector('#appStartupLoader');
    const sceneLoader = container.querySelector('#sceneInitLoader');
    expect(startupLoader).not.toBeNull();
    expect(sceneLoader).not.toBeNull();

    app.showSceneLoader('Custom Scene Load...');
    expect(sceneLoader?.classList.contains('is-hidden')).toBe(false);
    app.hideSceneLoader();
    expect(sceneLoader?.classList.contains('is-hidden')).toBe(true);
  });

  it('styles Create Mesh CTA buttons (Spawn at Origin and Pick & Place in 3D) with tool-btn tool-btn-primary btn-block', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const createContainer = container.querySelector('#gui-create-container');
    expect(createContainer).not.toBeNull();

    const spawnBtn = Array.from(createContainer!.querySelectorAll('.cr.function')).find(
      (el) => el.textContent?.includes('Spawn at Origin')
    );
    expect(spawnBtn).toBeDefined();
    expect(spawnBtn?.classList.contains('tool-btn')).toBe(true);
    expect(spawnBtn?.classList.contains('tool-btn-primary')).toBe(true);
    expect(spawnBtn?.classList.contains('btn-block')).toBe(true);

    const placeBtn = Array.from(createContainer!.querySelectorAll('.cr.function')).find(
      (el) => el.textContent?.includes('Pick & Place in 3D')
    );
    expect(placeBtn).toBeDefined();
    expect(placeBtn?.classList.contains('tool-btn')).toBe(true);
    expect(placeBtn?.classList.contains('tool-btn-primary')).toBe(true);
    expect(placeBtn?.classList.contains('btn-block')).toBe(true);
  });

  it('keeps color picker palettes visible with elevated z-index across repeated interactions', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const colorRows = Array.from(container.querySelectorAll('.dg .cr.color')) as HTMLElement[];
    expect(colorRows.length).toBeGreaterThanOrEqual(3);

    // Repeatedly interact with each color tool (Create Mesh, Scene, Material)
    for (let round = 0; round < 3; round++) {
      for (const row of colorRows) {
        const dialog = row.closest('.floating-dialog') as HTMLElement;
        const selector = row.querySelector('.selector') as HTMLElement;
        const satField = row.querySelector('.saturation-field') as HTMLElement;

        row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        expect(row.classList.contains('color-picker-open')).toBe(true);
        expect(dialog.classList.contains('has-open-color-picker')).toBe(true);
        expect(dialog.style.zIndex).toBe('60');
        expect(satField.style.backgroundImage).toContain('linear-gradient');

        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }
    }
  });

  it('mounts MeshEditorApp into a custom container and updates DOM outliner when meshes are created', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    expect(app.canvas).toBeDefined();
    expect(app.service).toBeDefined();
    expect(container.querySelector('#renderCanvas')).not.toBeNull();

    // Create a primitive via service and verify DOM stats & outliner update
    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'OutlinerBox',
      size: 1,
      width: 1,
      height: 1,
      depth: 1,
      subdivisions: 1,
      tessellation: 16,
      color: '#ff5500',
    });

    const statsMeshes = container.querySelector('#statsMeshes');
    expect(statsMeshes?.textContent).toBe('1');

    const outliner = container.querySelector('#outlinerTreeContainer');
    expect(outliner?.textContent).toContain(box.name);
  });

  it('registers, initializes, and disposes plugins via PluginManager', async () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const initSpy = vi.fn();
    const disposeSpy = vi.fn();
    const actionClickSpy = vi.fn();

    const customPlugin: MeshEditorPlugin = {
      id: 'test-plugin',
      name: 'Test Custom Plugin',
      version: '1.0.0',
      initialize(ctx) {
        initSpy(ctx.getCurrentFilename());
        ctx.registerToolbarButton({
          id: 'btnTestPlugin',
          label: 'Run Custom Action',
          icon: 'sparkles',
          onClick: actionClickSpy,
        });
        ctx.registerToolMenuItem({
          id: 'menuToolCustom',
          label: 'Custom Mesh Tool',
          onClick: actionClickSpy,
        });
        ctx.registerViewMenuItem({
          id: 'menuViewCustom',
          label: 'Custom View Action',
          onClick: actionClickSpy,
        });
      },
      dispose: disposeSpy,
    };

    await app.use(customPlugin);

    expect(initSpy).toHaveBeenCalledOnce();
    expect(app.pluginManager.getPlugin('test-plugin')).toBe(customPlugin);
    expect(app.pluginManager.getAllPlugins().length).toBe(1);

    const toolbarBtn = container.querySelector('#btnTestPlugin') as HTMLButtonElement | null;
    expect(toolbarBtn).not.toBeNull();
    toolbarBtn?.click();
    expect(actionClickSpy).toHaveBeenCalledOnce();

    const menuBtn = container.querySelector('#menuToolCustom') as HTMLButtonElement | null;
    expect(menuBtn).not.toBeNull();
    menuBtn?.click();
    expect(actionClickSpy).toHaveBeenCalledTimes(2);

    const viewMenuBtn = container.querySelector('#menuViewCustom') as HTMLButtonElement | null;
    expect(viewMenuBtn).not.toBeNull();
    viewMenuBtn?.click();
    expect(actionClickSpy).toHaveBeenCalledTimes(3);

    app.pluginManager.unregister('test-plugin');
    expect(disposeSpy).toHaveBeenCalledOnce();
    expect(app.pluginManager.getPlugin('test-plugin')).toBeUndefined();
  });

  it('integrates HostAppAdapter with custom save button and model callbacks', async () => {
    const onSaveToHost = vi.fn();
    const onModelLoaded = vi.fn();
    const onModelExported = vi.fn();

    const adapter = new HostAppAdapter({
      saveButtonLabel: 'Save to Cloud',
      suppressBrowserDownload: true,
      onSaveToHost,
      onModelLoaded,
      onModelExported,
    });

    app = new MeshEditorApp({
      container,
      engine,
      adapter,
    });

    const saveBtn = container.querySelector('#btnHostAppSave') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn?.textContent).toContain('Save to Cloud');

    // Trigger model loaded event
    app.service.events.onModelLoaded?.('spaceship.glb');
    expect(onModelLoaded).toHaveBeenCalledWith('spaceship.glb');

    // Trigger saveExportedModel
    const dummyBlob = new Blob(['test'], { type: 'model/gltf-binary' });
    const handled = await app.service.events.onExportModel?.(dummyBlob, 'spaceship.glb', 'glb');
    expect(handled).toBe(true);
    expect(onModelExported).toHaveBeenCalledWith(dummyBlob, 'spaceship.glb', 'glb');
  });

  it('opens, updates, and confirms model export via dedicated export modal dialog', async () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const exportModal = container.querySelector('#exportModal') as HTMLElement;
    expect(exportModal).not.toBeNull();
    expect(exportModal.classList.contains('active')).toBe(false);

    // Open export dialog via File menu button
    const btnExportMenu = container.querySelector('#btnExportMenu') as HTMLButtonElement;
    expect(btnExportMenu).not.toBeNull();
    btnExportMenu.click();

    expect(exportModal.classList.contains('active')).toBe(true);

    const filenameInput = container.querySelector('#exportFilenameInput') as HTMLInputElement;
    const badge = container.querySelector('#exportExtensionBadge') as HTMLElement;
    expect(filenameInput).not.toBeNull();
    expect(badge.textContent).toBe('.glb');

    // Select OBJ format
    const objCard = exportModal.querySelector('.export-format-option[data-format="obj"]') as HTMLElement;
    expect(objCard).not.toBeNull();
    objCard.click();

    expect(objCard.classList.contains('active')).toBe(true);
    expect(badge.textContent).toBe('.obj');

    // Change filename
    filenameInput.value = 'hero_ship';

    // Mock service.exportCurrentModel
    const exportSpy = vi.spyOn(app.service, 'exportCurrentModel').mockResolvedValue(undefined as any);

    // Confirm export
    const btnConfirm = container.querySelector('#btnConfirmExport') as HTMLButtonElement;
    btnConfirm.click();

    expect(exportModal.classList.contains('active')).toBe(false);
    expect(exportSpy).toHaveBeenCalledWith({
      filename: 'hero_ship',
      format: 'obj',
      selectedOnly: false,
    });

    // Test closing via cancel button
    app.openExportDialog();
    expect(exportModal.classList.contains('active')).toBe(true);
    const btnCancel = container.querySelector('#btnCancelExport') as HTMLButtonElement;
    btnCancel.click();
    expect(exportModal.classList.contains('active')).toBe(false);

    // Test closing via Escape key
    app.openExportDialog();
    expect(exportModal.classList.contains('active')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(exportModal.classList.contains('active')).toBe(false);
  });

  it('manages stackpanel sidebar mode, accordion minimizing, and active-focus state cleanly', () => {
    localStorage.removeItem('mesheditor_layout_mode');
    app = new MeshEditorApp({
      container,
      engine,
    });

    // Default layout on fresh startup is stackpanel
    expect(app.layoutMode).toBe('stackpanel');
    expect(document.body.classList.contains('layout-stackpanel')).toBe(true);

    const btnHelp = container.querySelector('#top-toolbar .panel-group #btnHelp');
    expect(btnHelp).not.toBeNull();

    const dialogMesh = container.querySelector('#dialog-mesh') as HTMLElement;
    const dialogScene = container.querySelector('#dialog-scene') as HTMLElement;
    expect(dialogMesh).not.toBeNull();
    expect(dialogScene).not.toBeNull();

    // Ensure dialogMesh is open
    app.toggleDialog('dialog-mesh', true);
    expect(dialogMesh.style.display).not.toBe('none');

    // Minimizing dialogMesh in stackpanel mode removes active-focus
    app.toggleDialogMinimize(dialogMesh, true);
    expect(dialogMesh.classList.contains('minimized')).toBe(true);
    expect(dialogMesh.classList.contains('active-focus')).toBe(false);

    // Clicking/bringing a minimized dialog to front does not assign active-focus in stackpanel mode
    app.bringDialogToFront(dialogMesh);
    expect(dialogMesh.classList.contains('active-focus')).toBe(false);

    // Expanding dialogScene minimizes others and clears active-focus from minimized ones
    app.toggleDialog('dialog-scene', true);
    app.toggleDialogMinimize(dialogScene, false);
    expect(dialogScene.classList.contains('minimized')).toBe(false);
    expect(dialogMesh.classList.contains('minimized')).toBe(true);
    expect(dialogMesh.classList.contains('active-focus')).toBe(false);

    // Minimizing Scene Objects (dialog-outliner) manages height and bottom properties
    const dialogOutliner = container.querySelector('#dialog-outliner') as HTMLElement;
    expect(dialogOutliner).not.toBeNull();
    app.toggleDialogMinimize(dialogOutliner, true);
    expect(dialogOutliner.classList.contains('minimized')).toBe(true);
    expect(dialogOutliner.style.bottom).toBe('auto');
    expect(dialogOutliner.style.height).toBe('auto');

    // Restoring Scene Objects restores normal height and bottom
    app.toggleDialogMinimize(dialogOutliner, false);
    expect(dialogOutliner.classList.contains('minimized')).toBe(false);
    expect(dialogOutliner.style.bottom).toBe('');
    expect(dialogOutliner.style.height).toBe('');

    // Unified order verification: Tools menu order matches stackpanel sidebar order
    const menuTools = container.querySelector('#menuTools');
    const menuButtons = Array.from(menuTools?.querySelectorAll('.dropdown-item[data-tool-name]') || []) as HTMLElement[];
    const sidebarDialogs = Array.from(container.querySelectorAll('.stackpanel-sidebar .floating-dialog')) as HTMLElement[];

    const menuToolNames = menuButtons.map((b) => b.getAttribute('data-tool-name'));
    const sidebarToolNames = sidebarDialogs.map((d) => app.getToolByDialogId(d.id)?.name).filter(Boolean);

    expect(menuToolNames[0]).toBe('scene_outliner');
    expect(menuToolNames.slice(1)).toEqual(sidebarToolNames);

    // Verify Drag Handle existence and draggable attribute on sidebar dialog headers in stackpanel mode
    const firstSidebarDialog = sidebarDialogs[0];
    const firstHeader = firstSidebarDialog.querySelector('.dialog-header') as HTMLElement;
    expect(firstHeader.getAttribute('draggable')).toBe('true');
    const dragHandle = firstSidebarDialog.querySelector('.dialog-drag-handle');
    expect(dragHandle).not.toBeNull();

    // Verify Drag & Drop reordering in the stackpanel and localStorage persistence
    const sidebarContainer = container.querySelector('#stackpanelRightSidebar') as HTMLElement;
    const initialFirstDialog = sidebarContainer.firstElementChild as HTMLElement;
    const initialLastDialog = sidebarContainer.lastElementChild as HTMLElement;
    expect(initialFirstDialog).not.toBe(initialLastDialog);

    // Simulate drag and drop: move the last dialog to the very top (before first dialog)
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k] || '';
      },
      effectAllowed: 'move',
      dropEffect: 'none',
    };

    const dragStartEvent = new Event('dragstart', { bubbles: true }) as any;
    dragStartEvent.dataTransfer = dataTransfer;
    initialLastDialog.querySelector('.dialog-header')?.dispatchEvent(dragStartEvent);

    // Verify that dragging a tool does NOT trigger the full-page file drop backdrop
    const dropOverlay = container.querySelector('#dropOverlay') as HTMLElement | null;
    if (dropOverlay) {
      expect(dropOverlay.classList.contains('active')).toBe(false);
    }

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
    dropEvent.dataTransfer = dataTransfer;
    dropEvent.clientY = initialFirstDialog.getBoundingClientRect().top; // Top half -> insert before
    initialFirstDialog.dispatchEvent(dropEvent);

    // Verify DOM was reordered: the moved dialog is now the first child
    expect(sidebarContainer.firstElementChild?.id).toBe(initialLastDialog.id);

    // Verify the new order was persisted to localStorage
    const savedOrderJson = localStorage.getItem('mesheditor_stackpanel_order');
    expect(savedOrderJson).not.toBeNull();
    const savedOrder = JSON.parse(savedOrderJson!);
    expect(savedOrder[0]).toBe(initialLastDialog.id);

    // Verify that the Tools menu was dynamically synchronized with the new order
    const updatedMenuButtons = Array.from(menuTools?.querySelectorAll('.dropdown-item[data-tool-name]') || []) as HTMLElement[];
    const updatedMenuToolNames = updatedMenuButtons.map((b) => b.getAttribute('data-tool-name'));
    expect(updatedMenuToolNames[1]).toBe(app.getToolByDialogId(initialLastDialog.id)?.name);

    // Verify restoring from localStorage in a fresh app instance
    const freshApp = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'stackpanel',
    });
    const freshSidebarDialogs = Array.from(container.querySelectorAll('.stackpanel-sidebar .floating-dialog')) as HTMLElement[];
    expect(freshSidebarDialogs[0].id).toBe(initialLastDialog.id);

    // Clean up localStorage for subsequent tests
    localStorage.removeItem('mesheditor_stackpanel_order');
  });

  it('renders btnMergeMeshes in Actions menu and triggers service.mergeSelectedMeshes()', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const btnMerge = container.querySelector('#btnMergeMeshes') as HTMLButtonElement | null;
    expect(btnMerge).not.toBeNull();
    expect(btnMerge?.textContent).toContain('Merge Meshes');

    let mergeCalled = false;
    (app.service as any).mergeSelectedMeshes = () => {
      mergeCalled = true;
      return null;
    };

    btnMerge?.click();
    expect(mergeCalled).toBe(true);
  });

  it('switches gizmos via toolbar buttons without deselecting meshes and displays updated help modal with snapping and selection', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'AppGizmoBox',
      size: 1,
      width: 1,
      height: 1,
      depth: 1,
      subdivisions: 1,
      tessellation: 16,
      color: '#ff5500',
    });
    app.service.selectNodes([box]);
    expect(app.service.selectedNodes).toEqual([box]);

    const btnRotate = container.querySelector('#btnGizmoRotate') as HTMLButtonElement;
    const btnTranslate = container.querySelector('#btnGizmoTranslate') as HTMLButtonElement;
    const btnScale = container.querySelector('#btnGizmoScale') as HTMLButtonElement;
    const btnBounds = container.querySelector('#btnGizmoBounds') as HTMLButtonElement;

    // Switch to Rotate via UI button
    btnRotate.click();
    expect(btnRotate.classList.contains('active')).toBe(true);
    expect(btnTranslate.classList.contains('active')).toBe(false);
    expect(app.service.selectedNodes).toEqual([box]);
    expect(app.service.gizmoManager.rotationGizmoEnabled).toBe(true);
    expect(app.service.gizmoManager.positionGizmoEnabled).toBe(false);

    // Switch to Scale via UI button
    btnScale.click();
    expect(btnScale.classList.contains('active')).toBe(true);
    expect(app.service.selectedNodes).toEqual([box]);
    expect(app.service.gizmoManager.scaleGizmoEnabled).toBe(true);

    // Switch to Bounds via UI button
    btnBounds.click();
    expect(btnBounds.classList.contains('active')).toBe(true);
    expect(app.service.selectedNodes).toEqual([box]);

    // Switch back to Translate
    btnTranslate.click();
    expect(btnTranslate.classList.contains('active')).toBe(true);
    expect(app.service.selectedNodes).toEqual([box]);

    // Verify Help Modal updated contents
    const helpModal = container.querySelector('#helpModal') as HTMLElement;
    expect(helpModal).not.toBeNull();
    const helpText = helpModal.textContent || '';
    expect(helpText).toContain('Mouse Controls & Selection');
    expect(helpText).toContain('Marquee / rectangle box select');
    expect(helpText).toContain('Shift+Click / Cmd+Click');
    expect(helpText).toContain('Snap movement to Move Grid (default: 0.1) or rotation to angle steps (default: 5°)');
    expect(helpText).toContain('Multi-Selection & Scene Tree');
  });
});
