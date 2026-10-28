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
});
