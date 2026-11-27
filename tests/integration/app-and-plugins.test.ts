import { MeshBuilder, NullEngine, PointerEventTypes } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_AGENT_STORAGE_KEY, DEFAULT_AI_AGENT_CONFIG } from '../../src/AIAgentService';
import { HostAppAdapter } from '../../src/adapters/HostAppAdapter';
import { DEFAULT_MESH_EDITOR_SETTINGS, MeshEditorApp, SETTINGS_STORAGE_KEY } from '../../src/MeshEditorApp';
import { MeshEditorPlugin } from '../../src/plugin';
import { MESH_EDITOR_CSS } from '../../src/styles';
import { MeshEditorElement, registerMeshEditorElement } from '../../src/web-component';

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

    // Test that clicking the modal backdrop does not close the export dialog
    app.openExportDialog();
    expect(exportModal.classList.contains('active')).toBe(true);
    exportModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(exportModal.classList.contains('active')).toBe(true);

    // Test closing via cancel button
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
      layoutMode: 'stackpanel',
    });

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

    // Unified order verification: within each category submenu, Tools menu order matches relative stackpanel sidebar order
    const menuTools = container.querySelector('#menuTools');
    const sidebarDialogs = Array.from(container.querySelectorAll('.stackpanel-sidebar .floating-dialog')) as HTMLElement[];
    const sidebarTools = sidebarDialogs.map((d) => app.getToolByDialogId(d.id)).filter(Boolean);

    const genericMenuButtons = Array.from(
      menuTools?.querySelectorAll('#menuToolsSubmenu-Generic .dropdown-item[data-tool-name]') || []
    ) as HTMLElement[];
    expect(genericMenuButtons.map((b) => b.getAttribute('data-tool-name'))).toEqual([
      'scene_outliner',
      ...sidebarTools.filter((t) => t?.category === 'Generic').map((t) => t!.name),
    ]);

    for (const cat of ['Materials', 'Creation', 'Optimization', 'Characters']) {
      const catButtons = Array.from(
        menuTools?.querySelectorAll(`#menuToolsSubmenu-${cat} .dropdown-item[data-tool-name]`) || []
      ) as HTMLElement[];
      expect(catButtons.map((b) => b.getAttribute('data-tool-name'))).toEqual(
        sidebarTools.filter((t) => t?.category === cat).map((t) => t!.name)
      );
    }

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

    // Verify that the moved tool's category submenu in Tools menu was dynamically synchronized with the new order
    const movedTool = app.getToolByDialogId(initialLastDialog.id);
    expect(movedTool?.category).toBeTruthy();
    const updatedCategoryButtons = Array.from(
      menuTools?.querySelectorAll(`#menuToolsSubmenu-${movedTool!.category} .dropdown-item[data-tool-name]`) || []
    ) as HTMLElement[];
    const updatedCategoryToolNames = updatedCategoryButtons.map((b) => b.getAttribute('data-tool-name'));
    expect(updatedCategoryToolNames[0]).toBe(movedTool?.name);

    // Verify restoring from localStorage in a fresh app instance
    app.dispose();
    container.innerHTML = '';
    engine = new NullEngine();
    app = new MeshEditorApp({
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

  it('renders btnCopy and btnPaste in Actions menu and triggers service copy/paste', () => {
    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const btnCopy = container.querySelector('#btnCopy') as HTMLButtonElement | null;
    const btnPaste = container.querySelector('#btnPaste') as HTMLButtonElement | null;
    expect(btnCopy).not.toBeNull();
    expect(btnPaste).not.toBeNull();
    expect(btnCopy?.textContent).toContain('Copy');
    expect(btnPaste?.textContent).toContain('Paste');

    let copyCalled = false;
    let pasteCalled = false;
    (app.service as any).copySelected = () => {
      copyCalled = true;
    };
    (app.service as any).pasteAtCursor = () => {
      pasteCalled = true;
      return [];
    };

    btnCopy?.click();
    expect(copyCalled).toBe(true);

    btnPaste?.click();
    expect(pasteCalled).toBe(true);
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

  it('provides uScale and vScale controls in Material & Texture tool and applies them to materials and meshes', () => {
    app = new MeshEditorApp({ container, engine });
    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'UVTestBox',
      size: 1,
    });
    app.service.selectMesh(box);

    const mat = app.service.createNewMaterialForSelected('UVBoxMat');
    expect(mat).not.toBeNull();

    // Verify uvControllers has uScale and vScale
    expect((app as any).uvControllers['uScale']).toBeDefined();
    expect((app as any).uvControllers['vScale']).toBeDefined();
    expect((app as any).uvControllers['uOffset']).toBeDefined();
    expect((app as any).uvControllers['vOffset']).toBeDefined();

    // Set custom uScale and vScale in uvParams
    (app as any).uvParams.uScale = 3.5;
    (app as any).uvParams.vScale = 2.0;

    // Trigger auto-triplanar UV mapping with uScale & vScale
    (app as any).uvParams.autoTriplanar();
    let uvs = box.getVerticesData('uv');
    expect(uvs).toBeDefined();
    expect(uvs!.length).toBeGreaterThan(0);

    // Trigger cylindrical UV mapping
    (app as any).uvParams.cylindrical();
    uvs = box.getVerticesData('uv');
    expect(uvs).toBeDefined();

    // Trigger baking UV scale to mesh
    (app as any).uvParams.bakeToMesh();
    uvs = box.getVerticesData('uv');
    expect(uvs).toBeDefined();
  });

  it('controls per-facet UVs and per-facet materials/textures through the Facet & Vertex Editor DOM', () => {
    app = new MeshEditorApp({ container, engine });
    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'FacetUITestBox',
      size: 2,
      width: 2,
      height: 2,
      depth: 2,
      diameter: 2,
      thickness: 0.4,
      subdivisions: 2,
      tessellation: 16,
      color: '#4f8cf6',
      roughness: 0.4,
      metallic: 0.1,
    });
    app.service.createNewMaterialForSelected('UIWallMat');

    // Select quad face 0 via service
    expect(app.service.selectFace(box, 0)).toBe(true);

    const uvStatus = container.querySelector('#facetUVStatus') as HTMLElement;
    const matBadge = container.querySelector('#facetMaterialBadge') as HTMLElement;
    const cornerGrid = container.querySelector('#facetCornerUVGrid') as HTMLElement;
    expect(uvStatus.textContent).toBe('Quad (4 corners)');
    expect(matBadge.textContent).toContain('UIWallMat');
    expect(cornerGrid.querySelectorAll('.facet-corner-u').length).toBe(4);

    // Apply UV Rect via DOM inputs & button
    const minU = container.querySelector('#facetUVMinU') as HTMLInputElement;
    const maxU = container.querySelector('#facetUVMaxU') as HTMLInputElement;
    const minV = container.querySelector('#facetUVMinV') as HTMLInputElement;
    const maxV = container.querySelector('#facetUVMaxV') as HTMLInputElement;
    minU.value = '0.2';
    maxU.value = '0.8';
    minV.value = '0.25';
    maxV.value = '0.75';
    (container.querySelector('#btnFacetApplyUVRect') as HTMLButtonElement).click();

    const updatedUV = app.service.getSelectedFacetUVInfo()!;
    expect(updatedUV.uMin).toBeCloseTo(0.2, 4);
    expect(updatedUV.uMax).toBeCloseTo(0.8, 4);
    expect(updatedUV.vMin).toBeCloseTo(0.25, 4);
    expect(updatedUV.vMax).toBeCloseTo(0.75, 4);

    // Assign new per-facet color material via DOM controls
    const colorInput = container.querySelector('#facetNewMatColor') as HTMLInputElement;
    const nameInput = container.querySelector('#facetNewMatName') as HTMLInputElement;
    colorInput.value = '#e11d48';
    nameInput.value = 'RoseFacetMat';
    (container.querySelector('#btnFacetApplyColorMat') as HTMLButtonElement).click();

    expect(matBadge.textContent).toContain('RoseFacetMat');
    expect(app.service.getSelectedFacetMaterialInfo()?.materialName).toBe('RoseFacetMat');

    // Toggle Single Triangle mode via DOM checkbox
    const chkSingleTri = container.querySelector('#chkFacetSingleTri') as HTMLInputElement;
    chkSingleTri.checked = true;
    chkSingleTri.dispatchEvent(new Event('change'));
    expect(app.service.facetSingleTriangleMode).toBe(true);
    expect(uvStatus.textContent).toBe('Tri (3 corners)');
    expect(cornerGrid.querySelectorAll('.facet-corner-u').length).toBe(3);
  });

  it('toggles fullscreen mode from the View menu button and tracks fullscreenchange events', async () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const btnFullscreen = container.querySelector('#btnToggleFullscreen') as HTMLButtonElement | null;
    expect(btnFullscreen).not.toBeNull();
    expect(btnFullscreen?.closest('#menuView')).not.toBeNull();
    expect(btnFullscreen?.classList.contains('active')).toBe(false);
    expect(btnFullscreen?.querySelector('.btn-label')?.textContent).toBe('Fullscreen');

    let fullscreenEl: Element | null = null;
    const originalFullscreenDesc = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const originalExitFullscreen = (document as any).exitFullscreen;
    const originalRequestFullscreen = (document.documentElement as any).requestFullscreen;

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenEl,
    });
    const requestMock = vi.fn(async () => {
      fullscreenEl = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exitMock = vi.fn(async () => {
      fullscreenEl = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    (document.documentElement as any).requestFullscreen = requestMock;
    (document as any).exitFullscreen = exitMock;

    try {
      btnFullscreen?.click();
      await Promise.resolve();
      expect(requestMock).toHaveBeenCalledOnce();
      expect(btnFullscreen?.classList.contains('active')).toBe(true);
      expect(btnFullscreen?.querySelector('.btn-label')?.textContent).toBe('Exit Fullscreen');

      btnFullscreen?.click();
      await Promise.resolve();
      expect(exitMock).toHaveBeenCalledOnce();
      expect(btnFullscreen?.classList.contains('active')).toBe(false);
      expect(btnFullscreen?.querySelector('.btn-label')?.textContent).toBe('Fullscreen');
    } finally {
      if (originalFullscreenDesc) {
        Object.defineProperty(document, 'fullscreenElement', originalFullscreenDesc);
      } else {
        delete (document as any).fullscreenElement;
      }
      (document.documentElement as any).requestFullscreen = originalRequestFullscreen;
      (document as any).exitFullscreen = originalExitFullscreen;
    }
  });

  it('embeds via <mesh-editor> custom element and registers plugins via usePlugin', async () => {
    registerMeshEditorElement();

    const el = document.createElement('mesh-editor') as MeshEditorElement;
    el.customEngine = engine;
    el.setAttribute('save-button-label', 'Save to CMS');
    el.setAttribute('suppress-download', 'true');

    const readySpy = vi.fn();
    el.addEventListener('editor-ready', readySpy);

    container.appendChild(el);

    expect(readySpy).toHaveBeenCalledOnce();
    expect(el.app).not.toBeNull();
    expect(el.service).not.toBeNull();
    expect(el.getApp()).toBe(el.app);
    expect(el.getService()).toBe(el.service);
    expect(el.getScene()).toBe(el.service?.getScene());

    // Register a plugin via element.usePlugin
    const pluginActionSpy = vi.fn();
    const plugin: MeshEditorPlugin = {
      id: 'cms-sync-plugin',
      name: 'CMS Sync Plugin',
      version: '1.0.0',
      initialize(ctx) {
        ctx.registerToolbarButton({
          id: 'btnCmsSyncAction',
          label: 'Sync CMS',
          onClick: pluginActionSpy,
        });
      },
    };

    await el.usePlugin(plugin);

    expect(el.app?.pluginManager.getPlugin('cms-sync-plugin')).toBe(plugin);
    const syncBtn = el.querySelector('#btnCmsSyncAction') as HTMLButtonElement | null;
    expect(syncBtn).not.toBeNull();
    syncBtn?.click();
    expect(pluginActionSpy).toHaveBeenCalledOnce();

    el.remove();
  });

  it('opens Settings dialog from toolbar right of Shortcuts, moves 5 scene controls there, and persists to localStorage', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    // 1. Verify #btnSettings sits immediately to the right of #btnHelp in the rightmost .panel-group
    const panelGroup = container.querySelector('#top-toolbar .panel-group') as HTMLElement | null;
    expect(panelGroup).not.toBeNull();
    const panelButtons = Array.from(panelGroup!.querySelectorAll(':scope > button')) as HTMLButtonElement[];
    expect(panelButtons.map((b) => b.id)).toEqual(['btnHelp', 'btnSettings']);

    const toolbarChildren = Array.from(container.querySelector('#top-toolbar')!.children);
    expect(toolbarChildren[toolbarChildren.length - 1]).toBe(panelGroup);

    // 2. Verify Scene & Environment only contains Background, Ambient Light, Sun Light
    const sceneContainer = container.querySelector('#gui-scene-container') as HTMLElement | null;
    expect(sceneContainer).not.toBeNull();
    const sceneLabels = Array.from(sceneContainer!.querySelectorAll('.property-name')).map((el) => el.textContent?.trim());
    expect(sceneLabels).toEqual(['Background', 'Ambient Light', 'Sun Light']);

    // 3. Open and close Settings dialog
    const settingsModal = container.querySelector('#settingsModal') as HTMLDialogElement | null;
    expect(settingsModal).not.toBeNull();
    expect(settingsModal!.hasAttribute('open')).toBe(false);

    const btnSettings = container.querySelector('#btnSettings') as HTMLButtonElement;
    btnSettings.click();
    expect(settingsModal!.hasAttribute('open')).toBe(true);

    // 4. Modify all 5 settings inside Settings dialog and verify service + localStorage updates
    const gridToggle = container.querySelector('#settingGridVisible') as HTMLInputElement;
    const gridSizeNum = container.querySelector('#settingGridSizeNum') as HTMLInputElement;
    const cameraSpeedRange = container.querySelector('#settingCameraSpeedRange') as HTMLInputElement;
    const moveSnapNum = container.querySelector('#settingMoveSnapNum') as HTMLInputElement;
    const rotateSnapRange = container.querySelector('#settingRotateSnapRange') as HTMLInputElement;

    gridToggle.checked = false;
    gridToggle.dispatchEvent(new Event('change', { bubbles: true }));

    gridSizeNum.value = '80';
    gridSizeNum.dispatchEvent(new Event('change', { bubbles: true }));

    cameraSpeedRange.value = '1.25';
    cameraSpeedRange.dispatchEvent(new Event('input', { bubbles: true }));

    moveSnapNum.value = '0.5';
    moveSnapNum.dispatchEvent(new Event('change', { bubbles: true }));

    rotateSnapRange.value = '15';
    rotateSnapRange.dispatchEvent(new Event('input', { bubbles: true }));

    expect(app.service.sceneParams.grid).toBe(false);
    expect(app.service.sceneParams.gridSize).toBe(80);
    expect(app.service.sceneParams.cameraSpeed).toBe(1.25);
    expect(app.service.sceneParams.translateSnap).toBe(0.5);
    expect(app.service.sceneParams.rotateSnap).toBe(15);

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    expect(stored).toEqual({
      ...DEFAULT_MESH_EDITOR_SETTINGS,
      grid: false,
      gridSize: 80,
      cameraSpeed: 1.25,
      translateSnap: 0.5,
      rotateSnap: 15,
    });

    // Close dialog via Done button
    const btnSettingsDone = container.querySelector('#btnSettingsDone') as HTMLButtonElement;
    btnSettingsDone.click();
    expect(settingsModal!.hasAttribute('open')).toBe(false);

    // 5. Re-instantiate MeshEditorApp and verify persisted settings are restored from localStorage
    app.dispose();
    container.innerHTML = '';
    const secondEngine = new NullEngine();
    app = new MeshEditorApp({
      container,
      engine: secondEngine,
    });

    expect(app.service.sceneParams.grid).toBe(false);
    expect(app.service.sceneParams.gridSize).toBe(80);
    expect(app.service.sceneParams.cameraSpeed).toBe(1.25);
    expect(app.service.sceneParams.translateSnap).toBe(0.5);
    expect(app.service.sceneParams.rotateSnap).toBe(15);
    expect(app.service.camera.speed).toBe(1.25);
    expect(app.service.gridMesh.isEnabled()).toBe(false);

    const restoredToggle = container.querySelector('#settingGridVisible') as HTMLInputElement;
    const restoredGridSize = container.querySelector('#settingGridSizeNum') as HTMLInputElement;
    expect(restoredToggle.checked).toBe(false);
    expect(restoredGridSize.value).toBe('80');

    // 6. Reset Defaults restores defaults and updates localStorage
    const btnReset = container.querySelector('#btnResetSettings') as HTMLButtonElement;
    btnReset.click();
    expect(app.service.sceneParams.grid).toBe(DEFAULT_MESH_EDITOR_SETTINGS.grid);
    expect(app.service.sceneParams.gridSize).toBe(DEFAULT_MESH_EDITOR_SETTINGS.gridSize);
    expect(app.service.sceneParams.cameraSpeed).toBe(DEFAULT_MESH_EDITOR_SETTINGS.cameraSpeed);
    expect(app.service.sceneParams.translateSnap).toBe(DEFAULT_MESH_EDITOR_SETTINGS.translateSnap);
    expect(app.service.sceneParams.rotateSnap).toBe(DEFAULT_MESH_EDITOR_SETTINGS.rotateSnap);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')).toEqual(DEFAULT_MESH_EDITOR_SETTINGS);
  });

  it('uses 70vw scrollable Settings dialog with Editing and AI tabs and persists AI settings in localStorage', () => {
    expect(MESH_EDITOR_CSS).toContain('dialog#settingsModal {\n  width: 70vw;');
    expect(MESH_EDITOR_CSS).toMatch(/\.settings-modal-body\s*\{[^}]*overflow-y:\s*auto;/);

    app = new MeshEditorApp({
      container,
      engine,
    });

    // AI Agent panel no longer has its own Settings toggle button or inline settings panel
    expect(container.querySelector('#btnAISettingsToggle')).toBeNull();
    expect(container.querySelector('#aiSettingsPanel')).toBeNull();

    const btnSettings = container.querySelector('#btnSettings') as HTMLButtonElement;
    btnSettings.click();

    const tabEditing = container.querySelector('#settingsTabBtnEditing') as HTMLButtonElement;
    const tabAI = container.querySelector('#settingsTabBtnAI') as HTMLButtonElement;
    const panelEditing = container.querySelector('#settingsTabPanelEditing') as HTMLElement;
    const panelAI = container.querySelector('#settingsTabPanelAI') as HTMLElement;

    expect(tabEditing.textContent?.trim()).toBe('Editing');
    expect(tabAI.textContent?.trim()).toBe('AI');
    expect(tabEditing.getAttribute('aria-selected')).toBe('true');
    expect(panelEditing.hidden).toBe(false);
    expect(panelAI.hidden).toBe(true);

    // Switch to AI tab
    tabAI.click();
    expect(tabAI.getAttribute('aria-selected')).toBe('true');
    expect(tabEditing.getAttribute('aria-selected')).toBe('false');
    expect(panelAI.hidden).toBe(false);
    expect(panelEditing.hidden).toBe(true);

    // Modify AI Endpoint, API Key, Model, Polygon bounds, and Neural 3D provider
    const endpointInput = container.querySelector('#aiEndpointUrlInput') as HTMLInputElement;
    const apiKeyInput = container.querySelector('#aiApiKeyInput') as HTMLInputElement;
    const modelSelect = container.querySelector('#aiModelSelect') as HTMLSelectElement;
    const minPolyInput = container.querySelector('#aiMinPolyInput') as HTMLInputElement;
    const trellisCheck = container.querySelector('#aiNeuralEnabled_trellis') as HTMLInputElement;

    endpointInput.value = 'https://custom-llm.example.com/v1';
    endpointInput.dispatchEvent(new Event('change', { bubbles: true }));

    apiKeyInput.value = 'sk-test-12345';
    apiKeyInput.dispatchEvent(new Event('input', { bubbles: true }));

    modelSelect.value = 'gpt-4o';
    modelSelect.dispatchEvent(new Event('change', { bubbles: true }));

    minPolyInput.value = '500';
    minPolyInput.dispatchEvent(new Event('input', { bubbles: true }));

    trellisCheck.checked = true;
    trellisCheck.dispatchEvent(new Event('change', { bubbles: true }));

    const storedAI = JSON.parse(localStorage.getItem(AI_AGENT_STORAGE_KEY) || '{}');
    expect(storedAI.baseUrl).toBe('https://custom-llm.example.com/v1');
    expect(storedAI.apiKey).toBe('sk-test-12345');
    expect(storedAI.model).toBe('gpt-4o');
    expect(storedAI.minPolygons).toBe(500);
    expect(storedAI.neural3DProviders?.trellis?.enabled).toBe(true);

    // Re-instantiate MeshEditorApp and verify AI settings restore from localStorage
    app.dispose();
    container.innerHTML = '';
    const secondEngine = new NullEngine();
    app = new MeshEditorApp({
      container,
      engine: secondEngine,
    });

    (container.querySelector('#btnSettings') as HTMLButtonElement).click();
    (container.querySelector('#settingsTabBtnAI') as HTMLButtonElement).click();

    expect((container.querySelector('#aiEndpointUrlInput') as HTMLInputElement).value).toBe(
      'https://custom-llm.example.com/v1'
    );
    expect((container.querySelector('#aiApiKeyInput') as HTMLInputElement).value).toBe('sk-test-12345');
    expect((container.querySelector('#aiModelSelect') as HTMLSelectElement).value).toBe('gpt-4o');
    expect((container.querySelector('#aiMinPolyInput') as HTMLInputElement).value).toBe('500');
    expect((container.querySelector('#aiNeuralEnabled_trellis') as HTMLInputElement).checked).toBe(true);

    // Reset Defaults while on AI tab restores AI defaults without wiping Editing settings
    (container.querySelector('#btnResetSettings') as HTMLButtonElement).click();
    expect(app.service.aiAgent.getConfig().baseUrl).toBe(DEFAULT_AI_AGENT_CONFIG.baseUrl);
    expect(app.service.aiAgent.getConfig().apiKey).toBe(DEFAULT_AI_AGENT_CONFIG.apiKey);
    expect(app.service.aiAgent.getConfig().minPolygons).toBe(DEFAULT_AI_AGENT_CONFIG.minPolygons);
    expect(app.service.aiAgent.getEnabledNeural3DProviders()).toEqual([]);

    const footerFeedback = container.querySelector('#settingsFooterFeedback') as HTMLElement;
    expect(footerFeedback.style.display).toBe('flex');
    expect(footerFeedback.textContent).toContain('AI settings reset to defaults.');
  });

  it('displays /models fetch and Test results inline inside Settings modal instead of backdrop-covered toasts', async () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    (container.querySelector('#btnSettings') as HTMLButtonElement).click();
    (container.querySelector('#settingsTabBtnAI') as HTMLButtonElement).click();

    const toastEl = container.querySelector('#toast') as HTMLElement;
    toastEl.className = '';

    const fetchSpy = vi
      .spyOn(app.service.aiAgent, 'fetchAvailableModels')
      .mockResolvedValueOnce(['model-a', 'model-b'])
      .mockRejectedValueOnce(new Error('Endpoint unreachable'));

    const btnFetchModels = container.querySelector('#btnFetchAIModels') as HTMLButtonElement;
    btnFetchModels.click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiEndpointFeedback') as HTMLElement;
      expect(fb.classList.contains('is-success')).toBe(true);
      expect(fb.textContent).toContain('Loaded 2 models from endpoint.');
    });

    btnFetchModels.click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiEndpointFeedback') as HTMLElement;
      expect(fb.classList.contains('is-warning')).toBe(true);
      expect(fb.textContent).toContain('Endpoint unreachable');
    });

    const neuralTestSpy = vi
      .spyOn(app.service.aiAgent, 'testNeural3DProvider')
      .mockResolvedValueOnce({ ok: true, message: 'TRELLIS reachable on localhost' });
    (container.querySelector('#btnTestNeural_trellis') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiNeuralTestResult_trellis') as HTMLElement;
      expect(fb.classList.contains('is-success')).toBe(true);
      expect(fb.textContent).toContain('TRELLIS reachable on localhost');
    });

    const imgTestSpy = vi
      .spyOn(app.service.externalImageGenerator, 'testProvider')
      .mockResolvedValueOnce({ ok: false, message: 'API key missing for OpenAI' });
    (container.querySelector('#btnTestImageGenGlobal') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiImageGenTestResult') as HTMLElement;
      expect(fb.classList.contains('is-warning')).toBe(true);
      expect(fb.textContent).toContain('API key missing for OpenAI');
    });

    const endpointTestSpy = vi
      .spyOn(app.service.aiAgent, 'testEndpointConnection')
      .mockResolvedValueOnce({ ok: true, message: 'Connected to gpt-4o (120 ms).', status: 200, latencyMs: 120, model: 'gpt-4o' })
      .mockResolvedValueOnce({ ok: false, message: 'Endpoint error (401): Invalid API key', status: 401, latencyMs: 45 });

    const btnTestEndpoint = container.querySelector('#btnTestAIEndpoint') as HTMLButtonElement;
    expect(btnTestEndpoint).not.toBeNull();
    btnTestEndpoint.click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiEndpointFeedback') as HTMLElement;
      expect(fb.classList.contains('is-success')).toBe(true);
      expect(fb.textContent).toContain('Connected to gpt-4o (120 ms).');
    });

    btnTestEndpoint.click();
    await vi.waitFor(() => {
      const fb = container.querySelector('#aiEndpointFeedback') as HTMLElement;
      expect(fb.classList.contains('is-error')).toBe(true);
      expect(fb.textContent).toContain('Endpoint error (401): Invalid API key');
    });

    // None of the modal actions should trigger the backdrop-covered #toast element
    expect(toastEl.classList.contains('show')).toBe(false);
    fetchSpy.mockRestore();
    neuralTestSpy.mockRestore();
    imgTestSpy.mockRestore();
    endpointTestSpy.mockRestore();
  });

  it('masks API key fields without type="password" so browsers and password managers do not trigger form warnings', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    expect(container.querySelectorAll('input[type="password"]').length).toBe(0);

    const apiKeyIds = [
      'aiApiKeyInput',
      'aiNeuralKey_trellis',
      'aiNeuralKey_hunyuan3d',
      'aiNeuralKey_hi3d',
      'aiImageGenKey',
      'aiTextureApiKey',
    ];

    for (const id of apiKeyIds) {
      const input = container.querySelector(`#${id}`) as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.type).toBe('text');
      expect(input.classList.contains('api-key-masked')).toBe(true);
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.hasAttribute('data-1p-ignore')).toBe(true);
      expect(input.getAttribute('data-lpignore')).toBe('true');
      expect(input.getAttribute('data-bwignore')).toBe('true');
      expect(input.getAttribute('data-form-type')).toBe('other');
    }

    const pairs: Array<[string, string]> = [
      ['aiApiKeyInput', 'btnToggleApiKeyVis'],
      ['aiTextureApiKey', 'btnToggleTextureApiKeyVis'],
    ];

    for (const [inputId, btnId] of pairs) {
      const input = container.querySelector(`#${inputId}`) as HTMLInputElement;
      const btn = container.querySelector(`#${btnId}`) as HTMLButtonElement;
      expect(btn.getAttribute('aria-pressed')).toBe('false');

      btn.click();
      expect(input.type).toBe('text');
      expect(input.classList.contains('api-key-masked')).toBe(false);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.getAttribute('aria-label')).toBe('Hide API Key');

      btn.click();
      expect(input.type).toBe('text');
      expect(input.classList.contains('api-key-masked')).toBe(true);
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.getAttribute('aria-label')).toBe('Show API Key');
    }
  });

  it('shows backdrop-free top HUD loader, locks scene mutations while allowing panel navigation and camera focus during AI generation', async () => {
    expect(MESH_EDITOR_CSS).toMatch(/\.me-scene-loader\.is-top-hud\s*\{[^}]*background:\s*transparent;/);
    expect(MESH_EDITOR_CSS).toMatch(/\.me-scene-loader\.is-top-hud\s*\{[^}]*backdrop-filter:\s*none;/);

    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'floating',
    });

    const scene = app.service.getScene();
    const box = MeshBuilder.CreateBox('TestBox', { size: 1 }, scene);
    app.service.importedMeshes.push(box);
    app.service.selectMesh(box);
    app.updateOutliner();

    let resolvePrompt!: (val: any) => void;
    const runPromptSpy = vi.spyOn(app.service.aiAgent, 'runPrompt').mockImplementation((opts) => {
      opts.onStatus?.('Executing tool: create_box...');
      return new Promise((resolve) => {
        resolvePrompt = resolve;
      });
    });

    const promptInput = container.querySelector('#aiPromptInput') as HTMLTextAreaElement;
    promptInput.value = 'Build a futuristic crate';
    const runPromise = app.runAIAgentPrompt();

    const appContainer = container.querySelector('#app-container') as HTMLElement;
    const sceneLoader = container.querySelector('#sceneInitLoader') as HTMLElement;
    const sceneLoaderTitle = container.querySelector('#sceneLoaderTitle') as HTMLElement;
    const stopHudBtn = container.querySelector('#btnSceneLoaderStop') as HTMLButtonElement;

    // 1. Top HUD is shown without backdrop, with Stop button and live status
    expect(sceneLoader.classList.contains('is-hidden')).toBe(false);
    expect(sceneLoader.classList.contains('is-top-hud')).toBe(true);
    expect(sceneLoaderTitle.textContent).toBe('Executing tool: create_box...');
    expect(stopHudBtn.style.display).toBe('inline-flex');
    expect(appContainer.classList.contains('is-ai-scene-locked')).toBe(true);
    expect(app.service.isSceneInteractionLocked).toBe(true);

    // Gizmo should be detached while locked and exclusive 3D tools deactivated
    expect(app.service.gizmoManager.attachedNode).toBeNull();
    expect(app.service.facetEditorActive).toBe(false);

    // 2. Intermediate non-AI status resets do not prematurely hide the loader or unlock the scene
    app.setStatus('Ready', false);
    expect(sceneLoader.classList.contains('is-hidden')).toBe(false);
    expect(app.service.isSceneInteractionLocked).toBe(true);

    // 3. Viewport pointer selection is blocked while locked
    app.service.scene.onPointerObservable.notifyObservers({
      type: PointerEventTypes.POINTERUP,
      event: new MouseEvent('pointerup', { button: 0 }) as any,
      pickInfo: { hit: false, pickedMesh: null } as any,
    } as any);
    expect(app.service.selectedMesh).toBe(box);

    // 4. Outliner mutation buttons and selection clicks are blocked while locked
    const outlinerDelBtn = container.querySelector('.outliner-btn-mutate[title*="Delete"]') as HTMLButtonElement;
    expect(outlinerDelBtn).toBeTruthy();
    outlinerDelBtn.click();
    expect(app.service.importedMeshes).toContain(box);

    // Delete keyboard shortcut is blocked while locked
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(app.service.importedMeshes).toContain(box);

    // 5. Panel navigation works freely without activating exclusive 3D edit modes
    const facetSpy = vi.spyOn(app.service, 'toggleFacetEditor');
    app.toggleDialog('dialog-material', true);
    expect(app.isDialogOpen('dialog-material')).toBe(true);
    app.toggleDialog('dialog-facet', true);
    expect(facetSpy).not.toHaveBeenCalled();
    expect(app.isDialogOpen('dialog-facet')).toBe(true);
    expect(app.service.facetEditorActive).toBe(false);
    app.toggleDialog('dialog-sculpt', true);
    expect(app.isDialogOpen('dialog-sculpt')).toBe(true);
    expect(app.service.isSculptModeActive()).toBe(false);

    // 6. Resolving AI generation unlocks scene, restores gizmo, and hides top HUD
    resolvePrompt({
      id: 'msg_1',
      role: 'assistant',
      content: 'Done.',
      toolSteps: [],
      timestamp: Date.now(),
    });
    await runPromise;

    expect(runPromptSpy).toHaveBeenCalledTimes(1);
    expect(sceneLoader.classList.contains('is-hidden')).toBe(true);
    expect(sceneLoader.classList.contains('is-top-hud')).toBe(false);
    expect(stopHudBtn.style.display).toBe('none');
    expect(appContainer.classList.contains('is-ai-scene-locked')).toBe(false);
    expect(app.service.isSceneInteractionLocked).toBe(false);
    expect(app.service.gizmoManager.attachedNode).toBe(box);
  });

  it('minimizes Scene Objects on startup when viewport width is <= 1024px and keeps it expanded above 1024px', () => {
    const origInnerWidth = window.innerWidth;
    try {
      // Simulate desktop width (> 1024px)
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      localStorage.removeItem('mesheditor_window_layout');
      app = new MeshEditorApp({ container, engine });
      const desktopOutliner = container.querySelector('#dialog-outliner') as HTMLElement;
      expect(desktopOutliner).not.toBeNull();
      expect(desktopOutliner.classList.contains('minimized')).toBe(false);
      app.dispose();

      // Simulate iPad width (<= 1024px) even with desktop-saved expanded state in localStorage
      container.innerHTML = '';
      engine = new NullEngine();
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      app = new MeshEditorApp({ container, engine });
      const compactOutliner = container.querySelector('#dialog-outliner') as HTMLElement;
      expect(compactOutliner).not.toBeNull();
      expect(compactOutliner.classList.contains('minimized')).toBe(true);
      expect(compactOutliner.style.bottom).toBe('auto');
      expect(compactOutliner.style.height).toBe('auto');
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
    }
  });

  it('wires keyboard-free touch viewport bar, Duplicate action, and tap modes for Path Extrusion, Decals, and 3D Text', async () => {
    app = new MeshEditorApp({ container, engine });

    const btnOrbit = container.querySelector('#btnTouchModeOrbit') as HTMLButtonElement;
    const btnRect = container.querySelector('#btnTouchModeRect') as HTMLButtonElement;
    const btnMulti = container.querySelector('#btnTouchMultiSelect') as HTMLButtonElement;
    const btnSnap = container.querySelector('#btnTouchSnap') as HTMLButtonElement;
    const btnDup = container.querySelector('#btnDuplicateSelected') as HTMLButtonElement;
    expect(btnOrbit).not.toBeNull();
    expect(btnRect).not.toBeNull();
    expect(btnMulti).not.toBeNull();
    expect(btnSnap).not.toBeNull();
    expect(btnDup).not.toBeNull();

    // Ensure touch controls are NOT inside #top-toolbar
    expect(container.querySelector('#top-toolbar #touchViewportControls')).toBeNull();

    btnRect.click();
    expect(app.service.touchDragMode).toBe('marquee');
    expect(btnRect.classList.contains('active')).toBe(true);
    btnOrbit.click();
    expect(app.service.touchDragMode).toBe('orbit');

    btnMulti.click();
    expect(app.service.touchMultiSelectActive).toBe(true);
    btnSnap.click();
    expect(app.service.touchSnapActive).toBe(true);
    expect(app.service.isSnapModifierActive).toBe(true);

    // Duplicate from Actions menu without keyboard
    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'DupBox',
      size: 1,
      width: 1,
      height: 1,
      depth: 1,
      subdivisions: 1,
      tessellation: 12,
      color: '#4f8cf6',
    });
    app.service.selectNodes([box]);
    const preCount = app.service.importedMeshes.length;
    btnDup.click();
    expect(app.service.importedMeshes.length).toBe(preCount + 1);

    // Path Extrusion tap-to-place toggle works without Shift
    const chkTapPlace = container.querySelector('#chkPathExtrusionTapPlace') as HTMLInputElement;
    expect(chkTapPlace).not.toBeNull();
    chkTapPlace.checked = true;
    chkTapPlace.dispatchEvent(new Event('change'));
    expect(app.service.pathExtrusion.tapToPlaceMode).toBe(true);

    // Decal Painter Stamp / Erase mode buttons work without Right-Click
    const btnEraseDecal = container.querySelector('#btnDecalModeErase') as HTMLButtonElement;
    const btnStampDecal = container.querySelector('#btnDecalModeStamp') as HTMLButtonElement;
    expect(btnEraseDecal).not.toBeNull();
    expect(btnStampDecal).not.toBeNull();
    btnEraseDecal.click();
    expect(app.service.decalController.interactionMode).toBe('erase');
    btnStampDecal.click();
    expect(app.service.decalController.interactionMode).toBe('stamp');

    // Text Mesh surface placement stamps on tap without Shift key
    app.service.textMeshController.setSurfacePlacementActive(true);
    const beforeTextCount = app.service.importedMeshes.length;
    app.service.scene.onPointerObservable.notifyObservers({
      type: PointerEventTypes.POINTERDOWN,
      event: { pointerType: 'touch', pointerId: 40, button: 0, shiftKey: false, clientX: 200, clientY: 200 },
    } as any);
    app.service.scene.onPointerObservable.notifyObservers({
      type: PointerEventTypes.POINTERUP,
      event: { pointerType: 'touch', pointerId: 40, button: 0, shiftKey: false, clientX: 201, clientY: 201 },
    } as any);
    await new Promise((r) => setTimeout(r, 30));
    expect(app.service.importedMeshes.length).toBeGreaterThan(beforeTextCount);
  });

  it('toggles stackpanel drawer collapse, persists state, and auto-expands when opening a sidebar tool', () => {
    localStorage.removeItem('mesheditor_layout_mode');
    localStorage.removeItem('mesheditor_stackpanel_drawer_collapsed');

    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'stackpanel',
    });

    const toggleBtn = container.querySelector('#btnStackpanelDrawerToggle') as HTMLButtonElement | null;
    const sidebar = container.querySelector('#stackpanelRightSidebar') as HTMLElement | null;
    expect(toggleBtn).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(app.isStackpanelDrawerCollapsed).toBe(false);
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('true');
    expect(toggleBtn?.classList.contains('is-empty')).toBe(false);

    // Click drawer toggle to minimize stackpanel into drawer
    toggleBtn?.click();
    expect(app.isStackpanelDrawerCollapsed).toBe(true);
    expect(document.body.classList.contains('stackpanel-drawer-collapsed')).toBe(true);
    expect(sidebar?.hasAttribute('inert')).toBe(true);
    expect(sidebar?.getAttribute('aria-hidden')).toBe('true');
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('mesheditor_stackpanel_drawer_collapsed')).toBe('true');

    // Switching to floating mode clears drawer collapsed class & inert state
    app.setLayoutMode('floating', false);
    expect(document.body.classList.contains('stackpanel-drawer-collapsed')).toBe(false);
    expect(sidebar?.hasAttribute('inert')).toBe(false);

    // Switching back to stackpanel restores drawer collapsed state
    app.setLayoutMode('stackpanel', false);
    expect(document.body.classList.contains('stackpanel-drawer-collapsed')).toBe(true);
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    // Opening a sidebar tool automatically expands the drawer
    app.toggleDialog('dialog-material', true);
    expect(app.isStackpanelDrawerCollapsed).toBe(false);
    expect(document.body.classList.contains('stackpanel-drawer-collapsed')).toBe(false);
    expect(sidebar?.hasAttribute('inert')).toBe(false);
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('true');

    // Clean up localStorage
    localStorage.removeItem('mesheditor_stackpanel_drawer_collapsed');
  });

  it('disables Facet Pick, Sculpt Draw tools, and Decal Paint mode whenever another tool is activated (stackpanel & floating)', () => {
    localStorage.removeItem('mesheditor_layout_mode');
    localStorage.removeItem('mesheditor_window_layout');

    app = new MeshEditorApp({
      container,
      engine,
      layoutMode: 'stackpanel',
    });

    const pickBtn = container.querySelector('#btnFacetPickToggle') as HTMLButtonElement;
    const pickLabel = container.querySelector('#lblFacetPickState') as HTMLElement;
    const sculptDrawBtn = container.querySelector('#btnSculptDrawToggle') as HTMLButtonElement;
    const sculptDrawLabel = container.querySelector('#lblSculptDrawState') as HTMLElement;
    const decalPaintBtn = container.querySelector('#btnToggleDecalPaintMode') as HTMLButtonElement;
    const decalPaintLabel = container.querySelector('#decalPaintModeLabel') as HTMLElement;

    // Initial state in stackpanel mode (Outliner is expanded, Facet is minimized -> Pick is OFF)
    expect(app.service.facetEditorActive).toBe(false);
    expect(pickBtn.classList.contains('active')).toBe(false);
    expect(pickLabel.textContent).toBe('Pick: OFF');

    // 1. Open Facet & Vertex Editor -> Pick ON
    app.toggleDialog('dialog-facet', true);
    expect(app.service.facetEditorActive).toBe(true);
    expect(pickBtn.classList.contains('active')).toBe(true);
    expect(pickLabel.textContent).toBe('Pick: ON');

    // Opening a non-exclusive tool (Material Editor) in stackpanel minimizes Facet -> Pick OFF
    app.toggleDialog('dialog-material', true);
    expect(app.service.facetEditorActive).toBe(false);
    expect(pickBtn.classList.contains('active')).toBe(false);
    expect(pickLabel.textContent).toBe('Pick: OFF');

    // Re-open Facet -> Pick ON again
    app.toggleDialog('dialog-facet', true);
    expect(app.service.facetEditorActive).toBe(true);

    // 2. Open Figure Sculpt & Retopo -> Facet Pick OFF, Sculpt Draw tools ON
    app.toggleDialog('dialog-sculpt', true);
    expect(app.service.facetEditorActive).toBe(false);
    expect(pickBtn.classList.contains('active')).toBe(false);
    expect(pickLabel.textContent).toBe('Pick: OFF');
    expect(app.service.sculptController.isActive).toBe(true);
    expect(app.service.isSculptModeActive()).toBe(true);
    expect(sculptDrawBtn.classList.contains('active')).toBe(true);
    expect(sculptDrawLabel.textContent).toBe('Draw: ON');
    expect(container.querySelector('#dialog-sculpt .btn-sculpt-brush[data-brush="clay"]')?.classList.contains('active')).toBe(true);

    // Clicking the Sculpt header in stackpanel mode minimizes it and keeps Draw tools disabled (no bubble re-activation)
    const sculptHeader = container.querySelector('#dialog-sculpt .dialog-header') as HTMLElement;
    sculptHeader.click();
    expect(container.querySelector('#dialog-sculpt')?.classList.contains('minimized')).toBe(true);
    expect(app.service.sculptController.isActive).toBe(false);
    expect(app.service.isSculptModeActive()).toBe(false);
    expect(sculptDrawBtn.classList.contains('active')).toBe(false);
    expect(sculptDrawLabel.textContent).toBe('Draw: OFF');
    expect(container.querySelectorAll('#dialog-sculpt .btn-sculpt-brush.active').length).toBe(0);

    // Clicking a brush button re-activates Draw tools
    const grabBrushBtn = container.querySelector('#dialog-sculpt .btn-sculpt-brush[data-brush="grab"]') as HTMLButtonElement;
    grabBrushBtn.click();
    expect(app.service.sculptController.isActive).toBe(true);
    expect(grabBrushBtn.classList.contains('active')).toBe(true);

    // 3. Open Decal Painter -> Sculpt Draw tools OFF, Decal Paint mode ON
    app.toggleDialog('dialog-decal', true);
    expect(app.service.sculptController.isActive).toBe(false);
    expect(app.service.isSculptModeActive()).toBe(false);
    expect(sculptDrawBtn.classList.contains('active')).toBe(false);
    expect(sculptDrawLabel.textContent).toBe('Draw: OFF');
    expect(container.querySelectorAll('#dialog-sculpt .btn-sculpt-brush.active').length).toBe(0);
    expect(app.service.decalController.isActive).toBe(true);
    expect(decalPaintBtn.classList.contains('tool-btn-primary')).toBe(true);
    expect(decalPaintLabel.textContent).toContain('Paint Mode: Active');

    // Opening Voxel Painter disables Decal Paint mode
    app.toggleDialog('dialog-voxel-painter', true);
    expect(app.service.decalController.isActive).toBe(false);
    expect(decalPaintBtn.classList.contains('tool-btn-primary')).toBe(false);
    expect(decalPaintLabel.textContent).toBe('Activate Decal Paint Mode');
    expect(app.service.voxelPainter.isActive).toBe(true);

    // 4. Switch to Floating mode: all three remain exclusive when switching between open dialogs
    app.setLayoutMode('floating', false);
    app.toggleDialog('dialog-facet', true);
    app.toggleDialog('dialog-sculpt', true);
    app.toggleDialog('dialog-decal', true);

    expect(app.service.decalController.isActive).toBe(true);
    expect(app.service.sculptController.isActive).toBe(false);
    expect(app.service.facetEditorActive).toBe(false);

    // Pointer move in floating mode must NOT silently re-activate Sculpt while Decal Painter is active
    app.service.scene.onPointerObservable.notifyObservers({
      type: PointerEventTypes.POINTERMOVE,
      event: { pointerType: 'mouse', clientX: 100, clientY: 100 },
    } as any);
    expect(app.service.isSculptModeActive()).toBe(false);
    expect(app.service.sculptController.isActive).toBe(false);
    expect(app.service.decalController.isActive).toBe(true);

    // Clicking Pick toggle in Facet dialog disables Decal Paint mode
    pickBtn.click();
    expect(app.service.facetEditorActive).toBe(true);
    expect(app.service.decalController.isActive).toBe(false);
    expect(decalPaintLabel.textContent).toBe('Activate Decal Paint Mode');

    // Clicking Decal Paint Mode toggle disables Facet Pick
    decalPaintBtn.click();
    expect(app.service.decalController.isActive).toBe(true);
    expect(app.service.facetEditorActive).toBe(false);
    expect(pickLabel.textContent).toBe('Pick: OFF');

    // Pressing Escape disables Decal Paint mode cleanly
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.service.decalController.isActive).toBe(false);
    expect(decalPaintLabel.textContent).toBe('Activate Decal Paint Mode');
  });

  it('clears active mesh selection on Escape without clearing when closing overlay modals', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'EscTestBox',
      size: 2,
    });
    expect(box).not.toBeNull();
    expect(app.service.selectedMesh).toBe(box);
    expect(app.service.selectedNodes).toEqual([box]);
    expect(app.service.highlightLayer.hasMesh(box!)).toBe(true);

    // Opening Export modal and pressing Escape on document closes the modal WITHOUT clearing active mesh selection
    app.openExportDialog();
    const exportModal = container.querySelector('#exportModal') as HTMLElement;
    expect(exportModal.classList.contains('active')).toBe(true);

    const modalEsc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(modalEsc);
    expect(exportModal.classList.contains('active')).toBe(false);
    expect(app.service.selectedMesh).toBe(box);
    expect(app.service.selectedNodes).toEqual([box]);

    // Pressing Escape with no overlay open clears active mesh selection
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.service.selectedMesh).toBeNull();
    expect(app.service.selectedNodes).toEqual([]);
    expect(app.service.highlightLayer.hasMesh(box!)).toBe(false);
  });

  it('configures selection and voxel tool colors in Settings -> Editing tab, applies live, and persists in localStorage', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const btnSettings = container.querySelector('#btnSettings') as HTMLButtonElement;
    btnSettings.click();

    const meshColorInput = container.querySelector('#settingMeshSelectionColor') as HTMLInputElement;
    const faceColorInput = container.querySelector('#settingFaceSelectionColor') as HTMLInputElement;
    const vertexColorInput = container.querySelector('#settingVertexColor') as HTMLInputElement;
    const vertexSelColorInput = container.querySelector('#settingVertexSelectionColor') as HTMLInputElement;
    const voxelColorInput = container.querySelector('#settingVoxelToolColor') as HTMLInputElement;

    // Pre-populated with current default colors
    expect(meshColorInput.value.toLowerCase()).toBe('#3399ff');
    expect(faceColorInput.value.toLowerCase()).toBe('#ffcc33');
    expect(vertexColorInput.value.toLowerCase()).toBe('#00d9ff');
    expect(vertexSelColorInput.value.toLowerCase()).toBe('#ffa61a');
    expect(voxelColorInput.value.toLowerCase()).toBe('#ffd91a');

    // Create a mesh, select a face, and inspect live color updates
    const box = app.service.createPrimitive({
      shape: 'Box',
      name: 'ColorTestBox',
      size: 2,
    })!;
    app.service.toggleFacetEditor(true);
    app.service.selectFace(box, 0);
    app.service.setFacetEditMode('vertex');
    app.service.selectVertex(0);

    // Update all 5 colors via Settings UI
    meshColorInput.value = '#ff3366';
    meshColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    faceColorInput.value = '#22dd88';
    faceColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    vertexColorInput.value = '#aa55ff';
    vertexColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    vertexSelColorInput.value = '#ff5500';
    vertexSelColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    voxelColorInput.value = '#33ffaa';
    voxelColorInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(app.service.sceneParams.meshSelectionColor).toBe('#ff3366');
    expect(app.service.sceneParams.faceSelectionColor).toBe('#22dd88');
    expect(app.service.sceneParams.vertexColor).toBe('#aa55ff');
    expect(app.service.sceneParams.vertexSelectionColor).toBe('#ff5500');
    expect(app.service.sceneParams.voxelToolColor).toBe('#33ffaa');

    // Verify live updates in Babylon scene objects
    expect(app.service.facetHighlightMesh?.color.toHexString().toLowerCase()).toBe('#22dd88');
    const selectedHandle = app.service.vertexHandles.find((h) =>
      ((h as any).metadata?.vertexIndices || []).includes(app.service.selectedVertexIndex)
    );
    const unselectedHandle = app.service.vertexHandles.find(
      (h) => !((h as any).metadata?.vertexIndices || []).includes(app.service.selectedVertexIndex)
    );
    expect((selectedHandle?.material as any)?.emissiveColor?.toHexString().toLowerCase()).toBe('#ff5500');
    expect((unselectedHandle?.material as any)?.emissiveColor?.toHexString().toLowerCase()).toBe('#aa55ff');

    const voxelHighlight = app.service.scene.getMeshByName('editor_voxel_highlight');
    expect((voxelHighlight?.material as any)?.emissiveColor?.toHexString().toLowerCase()).toBe('#33ffaa');

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    expect(stored.meshSelectionColor).toBe('#ff3366');
    expect(stored.faceSelectionColor).toBe('#22dd88');
    expect(stored.vertexColor).toBe('#aa55ff');
    expect(stored.vertexSelectionColor).toBe('#ff5500');
    expect(stored.voxelToolColor).toBe('#33ffaa');

    // Re-instantiate MeshEditorApp and verify persisted colors are restored from localStorage
    app.dispose();
    container.innerHTML = '';
    const secondEngine = new NullEngine();
    app = new MeshEditorApp({
      container,
      engine: secondEngine,
    });

    expect(app.service.sceneParams.meshSelectionColor).toBe('#ff3366');
    expect(app.service.sceneParams.faceSelectionColor).toBe('#22dd88');
    expect(app.service.sceneParams.vertexColor).toBe('#aa55ff');
    expect(app.service.sceneParams.vertexSelectionColor).toBe('#ff5500');
    expect(app.service.sceneParams.voxelToolColor).toBe('#33ffaa');

    expect((container.querySelector('#settingMeshSelectionColor') as HTMLInputElement).value.toLowerCase()).toBe('#ff3366');
    expect((container.querySelector('#settingFaceSelectionColor') as HTMLInputElement).value.toLowerCase()).toBe('#22dd88');
    expect((container.querySelector('#settingVertexColor') as HTMLInputElement).value.toLowerCase()).toBe('#aa55ff');
    expect((container.querySelector('#settingVertexSelectionColor') as HTMLInputElement).value.toLowerCase()).toBe('#ff5500');
    expect((container.querySelector('#settingVoxelToolColor') as HTMLInputElement).value.toLowerCase()).toBe('#33ffaa');

    // Reset Defaults restores all 5 colors and updates localStorage
    const btnReset = container.querySelector('#btnResetSettings') as HTMLButtonElement;
    btnReset.click();
    expect(app.service.sceneParams.meshSelectionColor).toBe(DEFAULT_MESH_EDITOR_SETTINGS.meshSelectionColor);
    expect(app.service.sceneParams.faceSelectionColor).toBe(DEFAULT_MESH_EDITOR_SETTINGS.faceSelectionColor);
    expect(app.service.sceneParams.vertexColor).toBe(DEFAULT_MESH_EDITOR_SETTINGS.vertexColor);
    expect(app.service.sceneParams.vertexSelectionColor).toBe(DEFAULT_MESH_EDITOR_SETTINGS.vertexSelectionColor);
    expect(app.service.sceneParams.voxelToolColor).toBe(DEFAULT_MESH_EDITOR_SETTINGS.voxelToolColor);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')).toEqual(DEFAULT_MESH_EDITOR_SETTINGS);
  });

  it('configures ground grid line/fill colors and transparent grid fill in Settings, applies live to GridMaterial, and persists in localStorage', () => {
    app = new MeshEditorApp({
      container,
      engine,
    });

    const btnSettings = container.querySelector('#btnSettings') as HTMLButtonElement;
    btnSettings.click();

    const lineColorInput = container.querySelector('#settingGridLineColor') as HTMLInputElement;
    const lineColorHex = container.querySelector('#settingGridLineColorHex') as HTMLElement;
    const fillColorInput = container.querySelector('#settingGridFillColor') as HTMLInputElement;
    const fillColorHex = container.querySelector('#settingGridFillColorHex') as HTMLElement;
    const fillColorItem = container.querySelector('#settingGridFillColorItem') as HTMLElement;
    const fillBadge = container.querySelector('#settingGridFillTransparentBadge') as HTMLElement;
    const fillTransparentToggle = container.querySelector('#settingGridFillTransparent') as HTMLInputElement;

    // Verify defaults (transparent fill enabled by default, #3299fd line color, #ffffff fill color)
    expect(lineColorInput.value.toLowerCase()).toBe('#3299fd');
    expect(lineColorHex.textContent).toBe('#3299FD');
    expect(fillColorInput.value.toLowerCase()).toBe('#ffffff');
    expect(fillColorHex.textContent).toBe('#FFFFFF');
    expect(fillTransparentToggle.checked).toBe(true);
    expect(fillBadge.hidden).toBe(false);
    expect(fillColorItem.classList.contains('is-transparent-fill')).toBe(true);
    expect(app.service.gridMaterial.linesOnly).toBe(true);
    expect(app.service.gridMaterial.opacity).toBe(1.0);
    expect(app.service.gridMaterial.lineColor.toHexString().toLowerCase()).toBe('#3299fd');
    // mainColor matches lineColor when linesOnly=true so minor lines stay pure without fill bleed
    expect(app.service.gridMaterial.mainColor.toHexString().toLowerCase()).toBe('#3299fd');
    expect(app.service.gridMesh.alphaIndex).toBe(-10);

    // Resizing the grid preserves transparent fill alphaIndex
    app.service.setGridSize(60);
    expect(app.service.gridMesh.alphaIndex).toBe(-10);

    // Disable transparent grid fill and customize grid line and fill colors
    fillTransparentToggle.checked = false;
    fillTransparentToggle.dispatchEvent(new Event('change', { bubbles: true }));

    lineColorInput.value = '#ff8800';
    lineColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    fillColorInput.value = '#1b2230';
    fillColorInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(app.service.sceneParams.gridFillTransparent).toBe(false);
    expect(app.service.sceneParams.gridLineColor).toBe('#ff8800');
    expect(app.service.sceneParams.gridFillColor).toBe('#1b2230');
    expect(lineColorHex.textContent).toBe('#FF8800');
    expect(fillColorHex.textContent).toBe('#1B2230');
    expect(fillBadge.hidden).toBe(true);
    expect(fillColorItem.classList.contains('is-transparent-fill')).toBe(false);
    expect(app.service.gridMaterial.linesOnly).toBe(false);
    expect(app.service.gridMaterial.opacity).toBeCloseTo(0.65, 2);
    expect(app.service.gridMaterial.lineColor.toHexString().toLowerCase()).toBe('#ff8800');
    expect(app.service.gridMaterial.mainColor.toHexString().toLowerCase()).toBe('#1b2230');
    expect(app.service.gridMesh.alphaIndex).toBe(Number.MAX_VALUE);

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    expect(stored.gridLineColor).toBe('#ff8800');
    expect(stored.gridFillColor).toBe('#1b2230');
    expect(stored.gridFillTransparent).toBe(false);

    // Re-instantiate MeshEditorApp and verify persisted grid settings are restored
    app.dispose();
    container.innerHTML = '';
    const secondEngine = new NullEngine();
    app = new MeshEditorApp({
      container,
      engine: secondEngine,
    });

    expect(app.service.sceneParams.gridLineColor).toBe('#ff8800');
    expect(app.service.sceneParams.gridFillColor).toBe('#1b2230');
    expect(app.service.sceneParams.gridFillTransparent).toBe(false);
    expect(app.service.gridMaterial.linesOnly).toBe(false);
    expect(app.service.gridMaterial.opacity).toBeCloseTo(0.65, 2);
    expect(app.service.gridMaterial.lineColor.toHexString().toLowerCase()).toBe('#ff8800');
    expect(app.service.gridMaterial.mainColor.toHexString().toLowerCase()).toBe('#1b2230');
    expect((container.querySelector('#settingGridLineColor') as HTMLInputElement).value.toLowerCase()).toBe('#ff8800');
    expect((container.querySelector('#settingGridFillColor') as HTMLInputElement).value.toLowerCase()).toBe('#1b2230');
    expect((container.querySelector('#settingGridFillTransparent') as HTMLInputElement).checked).toBe(false);
    expect((container.querySelector('#settingGridFillTransparentBadge') as HTMLElement).hidden).toBe(true);

    // Reset Defaults restores transparent grid fill + #3299fd line color defaults
    const btnReset = container.querySelector('#btnResetSettings') as HTMLButtonElement;
    btnReset.click();

    expect(app.service.sceneParams.gridLineColor).toBe('#3299fd');
    expect(app.service.sceneParams.gridFillColor).toBe('#ffffff');
    expect(app.service.sceneParams.gridFillTransparent).toBe(true);
    expect(app.service.gridMaterial.linesOnly).toBe(true);
    expect(app.service.gridMaterial.opacity).toBe(1.0);
    expect(app.service.gridMaterial.lineColor.toHexString().toLowerCase()).toBe('#3299fd');
    expect(app.service.gridMaterial.mainColor.toHexString().toLowerCase()).toBe('#3299fd');
    expect((container.querySelector('#settingGridFillTransparentBadge') as HTMLElement).hidden).toBe(false);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')).toEqual(DEFAULT_MESH_EDITOR_SETTINGS);
  });
});
