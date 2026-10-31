import { NullEngine, Ray, Vector3, Mesh, Texture } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshEditorService } from '../../src/MeshEditorService';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { TextureAtlasManager } from '../../src/voxel/TextureAtlasManager';
import { CustomVoxelMesher } from '../../src/voxel/CustomVoxelMesher';
import { VoxelPainterController } from '../../src/voxel/VoxelPainterController';
import { VoxelPainterTool } from '../../src/tools/builtin/VoxelPainterTool';
import { VoxelBlock } from '../../src/voxel/types';
import { PrimitiveConfig } from '../../src/types';

function createBoxConfig(name: string): PrimitiveConfig {
  return {
    shape: 'Box',
    name,
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
  };
}

describe('Voxel Painter & Texture Atlas Integration Tests', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    document.body.appendChild(canvas);

    engine = new NullEngine();
    service = new MeshEditorService(
      canvas,
      {
        onSelectionChanged: vi.fn(),
        onSceneModified: vi.fn(),
        onHistoryChanged: vi.fn(),
        onToast: vi.fn(),
        onStatsUpdated: vi.fn(),
      },
      engine
    );
  });

  afterEach(() => {
    service.dispose();
    engine.dispose();
    canvas.remove();
    document.body.innerHTML = '';
  });

  describe('1. TextureAtlasManager & Procedural Atlas', () => {
    it('creates procedural 4x4 terrain atlas with 16 distinct tiles and valid UV coordinates', () => {
      const atlasMgr = new TextureAtlasManager(service.scene);
      const atlas = atlasMgr.createProceduralTerrainAtlas('Test Terrain Atlas');

      expect(atlas).toBeDefined();
      expect(atlas.name).toBe('Test Terrain Atlas');
      expect(atlas.columns).toBe(4);
      expect(atlas.rows).toBe(4);
      expect(atlas.frames.length).toBe(16);

      const frameNames = atlas.frames.map((f) => f.name);
      expect(frameNames).toContain('Stone');
      expect(frameNames).toContain('Grass Top');
      expect(frameNames).toContain('Water');
      expect(frameNames).toContain('Wood Planks');
      expect(frameNames).toContain('Obsidian');

      for (const frame of atlas.frames) {
        expect(frame.uMin).toBeGreaterThanOrEqual(0);
        expect(frame.uMax).toBeLessThanOrEqual(1.0001);
        expect(frame.vMin).toBeGreaterThanOrEqual(0);
        expect(frame.vMax).toBeLessThanOrEqual(1.0001);
        expect(frame.uMax).toBeGreaterThan(frame.uMin);
        expect(frame.vMax).toBeGreaterThan(frame.vMin);
        expect(typeof frame.thumbnailDataUrl).toBe('string');
        expect(frame.thumbnailDataUrl?.startsWith('data:image/')).toBe(true);
      }

      expect(atlasMgr.getAtlas(atlas.id)).toBe(atlas);
      expect(atlasMgr.getAtlases().length).toBe(1);
    });

    it('creates custom grid atlas from image dimensions', async () => {
      const atlasMgr = new TextureAtlasManager(service.scene);
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const atlas = await atlasMgr.createGridAtlasFromImage('Custom Dungeon Atlas', mockDataUrl, 4, 4);

      expect(atlas.columns).toBe(4);
      expect(atlas.rows).toBe(4);
      expect(atlas.frames.length).toBe(16);
      expect(atlas.tileSize).toBe(64);
      expect(atlas.frames[0].id).toBe('tile_0_0');
      expect(atlas.frames[0].name).toBe('Tile (0, 0)');
    });
  });

  describe('2. Embedded Textures Overview & Material Assignment', () => {
    it('scans embedded textures from both texture atlas manager and scene materials', () => {
      const textures = service.getEmbeddedTexturesInfo();
      expect(textures.length).toBeGreaterThanOrEqual(1);

      const defaultAtlasInfo = textures.find((t) => t.isAtlas);
      expect(defaultAtlasInfo).toBeDefined();
      expect(defaultAtlasInfo?.columns).toBe(4);
      expect(defaultAtlasInfo?.rows).toBe(4);
    });

    it('adds custom texture and applies it to selected mesh material', () => {
      const mesh = service.createPrimitive(createBoxConfig('CubeForTex'));
      service.selectMesh(mesh);

      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const added = service.addTextureFromDataUrl('my_embedded_wood.png', mockDataUrl);
      expect(added).toBeDefined();

      const success = service.applyTextureToSelectedMaterial(added.url, added.name);
      expect(success).toBe(true);

      const currentTex = service.getActiveMaterialTexture();
      expect(currentTex).toBeDefined();
      expect(currentTex?.name).toBe('my_embedded_wood.png');
    });

    it('filters out internal Babylon RenderTargetTextures (RTT, EffectLayer, HighlightLayer)', () => {
      // Simulate Babylon's internal RTT textures
      const rtt1 = new Texture('EffectLayerMainRTT', service.scene);
      rtt1.name = 'EffectLayerMainRTT';
      (rtt1 as any).isRenderTarget = true;

      const rtt2 = new Texture('HighlightLayerBlurRTT0', service.scene);
      rtt2.name = 'HighlightLayerBlurRTT0';

      const list = service.scanSceneTextures();
      const names = list.map((t) => t.name);
      expect(names).not.toContain('EffectLayerMainRTT');
      expect(names).not.toContain('HighlightLayerBlurRTT0');

      const infoList = service.getEmbeddedTexturesInfo();
      const infoNames = infoList.map((t) => t.name);
      expect(infoNames).not.toContain('EffectLayerMainRTT');
      expect(infoNames).not.toContain('HighlightLayerBlurRTT0');

      rtt1.dispose();
      rtt2.dispose();
    });
  });

  describe('3. VoxelPainterController & Slab Intersection Ray-Casting', () => {
    it('manages blocks, modes, and palette selection', () => {
      const painter = service.voxelPainter;
      expect(painter.mode).toBe('paint');

      painter.setBlock(0, 0, 0, 'stone');
      painter.setBlock(1, 0, 0, 'dirt');
      painter.setBlock(0, 1, 0, 'grass_top');

      expect(painter.blocks.size).toBe(3);
      expect(painter.getBlock(0, 0, 0)?.paletteId).toBe('stone');
      expect(painter.getBlock(1, 0, 0)?.paletteId).toBe('dirt');

      painter.removeBlock(1, 0, 0);
      expect(painter.blocks.size).toBe(2);
      expect(painter.getBlock(1, 0, 0)).toBeUndefined();

      painter.mode = 'erase';
      expect(painter.mode).toBe('erase');
      painter.mode = 'pick';
      expect(painter.mode).toBe('pick');
    });

    it('calculates target voxel block coordinates using slab ray-box intersection math', () => {
      const painter = service.voxelPainter;
      painter.setBlock(0, 0, 0, 'stone');

      // Ray pointing straight down from above (0, 5, 0) to (0, 0, 0)
      const ray = new Ray(new Vector3(0, 5, 0), new Vector3(0, -1, 0), 10);

      // In paint mode, it should target the adjacent empty block on top (0, 1, 0)
      painter.mode = 'paint';
      const targetPaint = painter.getTargetBlock(undefined, false, ray);
      expect(targetPaint).toEqual({ x: 0, y: 1, z: 0 });

      // In erase mode, it should target the intersected block itself (0, 0, 0)
      painter.mode = 'erase';
      const targetErase = painter.getTargetBlock(undefined, true, ray);
      expect(targetErase).toEqual({ x: 0, y: 0, z: 0 });

      // In pick mode, it should target the intersected block itself (0, 0, 0)
      painter.mode = 'pick';
      const targetPick = painter.getTargetBlock(undefined, false, ray);
      expect(targetPick).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('targets ground plane (y = 0) when painting on empty ground', () => {
      const painter = service.voxelPainter;
      painter.clear();
      painter.setMode('paint');

      // Ray aimed at ground at (3, 0, 4) from (3, 10, 4)
      const ray = new Ray(new Vector3(3, 10, 4), new Vector3(0, -1, 0), 20);
      const target = painter.getTargetBlock(undefined, false, ray);
      expect(target).toEqual({ x: 3, y: 0, z: 4 });
    });

    it('activates voxel painter with crosshair cursor and disengages gizmos', () => {
      const painter = service.voxelPainter;
      painter.setActive(true);
      expect(painter.isActive).toBe(true);
      expect(canvas.style.cursor).toBe('crosshair');

      painter.setActive(false);
      expect(painter.isActive).toBe(false);
      expect(canvas.style.cursor).toBe('default');
    });
  });

  describe('4. CustomVoxelMesher Culling & Mesh Baking with Undo/Redo', () => {
    it('culls interior solid faces when building multi-block meshes', () => {
      const atlas = service.textureAtlasManager.getAtlases()[0];

      // 1 isolated cube
      const singleBlock: VoxelBlock[] = [{ x: 0, y: 0, z: 0, paletteId: 'stone' }];
      const singleMesh = CustomVoxelMesher.build(service.scene, singleBlock, service.voxelPainter.palette, {
        voxelSize: 1.0,
        meshName: 'SingleBlockMesh',
        atlas,
      });

      expect(singleMesh).toBeDefined();
      const singleIndicesCount = singleMesh!.getIndices()?.length || 0;
      // 6 faces * 2 triangles * 3 vertices = 36 indices
      expect(singleIndicesCount).toBe(36);

      // 2 adjacent cubes sharing the face at x=0 / x=1
      const twoBlocks: VoxelBlock[] = [
        { x: 0, y: 0, z: 0, paletteId: 'stone' },
        { x: 1, y: 0, z: 0, paletteId: 'stone' },
      ];
      const twoMesh = CustomVoxelMesher.build(service.scene, twoBlocks, service.voxelPainter.palette, {
        voxelSize: 1.0,
        meshName: 'TwoBlocksMesh',
        atlas,
      });

      expect(twoMesh).toBeDefined();
      const twoIndicesCount = twoMesh!.getIndices()?.length || 0;
      // Without culling: 12 faces * 6 = 72 indices
      // With interior face culling: 10 faces * 6 = 60 indices (2 inner faces culled)
      expect(twoIndicesCount).toBe(60);

      singleMesh?.dispose();
      twoMesh?.dispose();
    });

    it('bakes painted voxels into a scene mesh and supports Undo / Redo', () => {
      const painter = service.voxelPainter;
      painter.clear();
      painter.setBlock(0, 0, 0, 'stone');
      painter.setBlock(0, 1, 0, 'grass_top');
      painter.setBlock(0, 2, 0, 'leaves');

      const bakedMesh = painter.bakeToMesh('VoxelTower');
      expect(bakedMesh).toBeDefined();
      expect(bakedMesh?.name).toBe('VoxelTower');
      expect(service.importedMeshes).toContain(bakedMesh);

      // Verify undo removes baked mesh
      expect(service.canUndo()).toBe(true);
      service.undo();
      expect(service.importedMeshes.includes(bakedMesh!)).toBe(false);

      // Verify redo restores baked mesh
      expect(service.canRedo()).toBe(true);
      service.redo();
      expect(service.importedMeshes.length).toBeGreaterThan(0);
    });

    it('exports and imports Run-Length Encoded (RLE) voxel data compatible with platformia3d', () => {
      const painter = service.voxelPainter;
      painter.clear();
      painter.setBlock(0, 0, 0, 'stone');
      painter.setBlock(1, 0, 0, 'stone');
      painter.setBlock(2, 0, 0, 'stone');
      painter.setBlock(0, 1, 0, 'grass_top');

      const exported = painter.exportVoxelData();
      expect(exported.version).toBe(1);
      expect(exported.palette.length).toBeGreaterThan(0);
      expect(exported.runs.length).toBeGreaterThan(0);

      // Clear current blocks
      painter.clear();
      expect(painter.blocks.size).toBe(0);

      // Restore from RLE data
      painter.loadVoxelData(exported);
      expect(painter.blocks.size).toBe(4);
      expect(painter.getBlock(0, 0, 0)?.paletteId).toBe('stone');
      expect(painter.getBlock(1, 0, 0)?.paletteId).toBe('stone');
      expect(painter.getBlock(2, 0, 0)?.paletteId).toBe('stone');
      expect(painter.getBlock(0, 1, 0)?.paletteId).toBe('grass_top');
    });
  });

  describe('5. ModelerPaintVoxelsTool AI Tool Execution', () => {
    it('executes paint, bake, and clear actions via ToolExecutionContext', async () => {
      const tool = new VoxelPainterTool();
      const ctx = service.aiAgent.createToolContext();

      // 1. Add blocks via tool
      const setResultStr = await tool.execute(
        {
          action: 'paint',
          voxels: [
            { x: 0, y: 0, z: 0, paletteId: 'stone' },
            { x: 1, y: 0, z: 0, paletteId: 'wood_planks' },
            { x: 0, y: 1, z: 0, paletteId: 'glass' },
          ],
        },
        ctx
      );

      const setResult = JSON.parse(setResultStr);
      expect(setResult.status).toBe('ok');
      expect(setResult.paintedCount).toBe(3);
      expect(service.voxelPainter.blocks.size).toBe(3);

      // 2. Bake via tool
      const bakeResultStr = await tool.execute(
        {
          action: 'bake',
          meshName: 'AIBakedVoxelHouse',
        },
        ctx
      );

      const bakeResult = JSON.parse(bakeResultStr);
      expect(bakeResult.status).toBe('ok');
      expect(bakeResult.meshName).toBe('AIBakedVoxelHouse');
      const baked = service.importedMeshes.find((m) => m.name === 'AIBakedVoxelHouse');
      expect(baked).toBeDefined();

      // 3. Clear via tool
      const clearResultStr = await tool.execute({ action: 'clear' }, ctx);
      const clearResult = JSON.parse(clearResultStr);
      expect(clearResult.status).toBe('ok');
      expect(service.voxelPainter.blocks.size).toBe(0);
    });
  });

  describe('6. MeshEditorApp UI Wiring for Voxel Painter & Embedded Textures', () => {
    it('toggles voxel painter dialog and synchronizes active painter state', () => {
      const container = document.createElement('div');
      container.id = 'appRoot';
      document.body.appendChild(container);

      const app = new MeshEditorApp({
        container,
        engine,
      });

      const dialogVoxel = document.getElementById('dialog-voxel-painter');
      expect(dialogVoxel).toBeDefined();

      // Open voxel painter dialog
      app.toggleDialog('dialog-voxel-painter', true);
      expect(dialogVoxel?.style.display).toBe('flex');
      expect(app.service.voxelPainter.isActive).toBe(true);

      // Close voxel painter dialog
      app.toggleDialog('dialog-voxel-painter', false);
      expect(dialogVoxel?.style.display).toBe('none');
      expect(app.service.voxelPainter.isActive).toBe(false);

      app.dispose();
      container.remove();
    });

    it('renders palette swatches and embedded textures gallery', () => {
      const container = document.createElement('div');
      container.id = 'appRoot';
      document.body.appendChild(container);

      const app = new MeshEditorApp({
        container,
        engine,
      });

      // Palette grid check
      app.renderVoxelPalette();
      const paletteGrid = document.getElementById('voxelPaletteGrid');
      const swatches = paletteGrid?.querySelectorAll('.voxel-palette-swatch');
      expect(swatches?.length).toBeGreaterThan(0);

      // Embedded textures gallery check
      app.renderEmbeddedTextures();
      const gallery = document.getElementById('embeddedTexturesGallery');
      const cards = gallery?.querySelectorAll('.embedded-texture-card');
      expect(cards?.length).toBeGreaterThan(0);

      // Verify individual texture item addition to voxel palette
      const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';
      const item = app.service.voxelPainter.addTexturePaletteItem('Custom Brick', dummyDataUrl);
      expect(item.id).toBeDefined();
      expect(item.name).toBe('Custom Brick');
      expect(item.textureUrl).toBe(dummyDataUrl);
      expect(app.service.voxelPainter.currentPaletteId).toBe(item.id);

      app.renderVoxelPalette();
      const updatedSwatches = paletteGrid?.querySelectorAll('.voxel-palette-swatch');
      expect(updatedSwatches?.length).toBeGreaterThan(swatches!.length);

      app.dispose();
      container.remove();
    });

    it('bakes hybrid voxel mesh containing both atlas tiles and individual textures', () => {
      const painter = service.voxelPainter;
      const atlas = service.textureAtlasManager.createProceduralTerrainAtlas('Atlas Test');
      painter.useTextureAtlas(atlas.id);

      // Add single custom texture item to palette
      const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';
      const singleItem = painter.addTexturePaletteItem('Wood Texture', dummyDataUrl);

      // Paint 1 atlas block and 1 individual texture block
      painter.setBlock(0, 0, 0, painter.palette.get(`atlas_${atlas.id}_tile_0`)!.id);
      painter.setBlock(1, 0, 0, singleItem.id);

      const baked = painter.bakeToMesh('Hybrid_Voxel_Mesh');
      expect(baked).toBeDefined();
      expect(baked?.name).toBe('Hybrid_Voxel_Mesh');
      expect(baked?.getTotalVertices()).toBeGreaterThan(0);
    });
  });
});
