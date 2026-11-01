import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Voxel Painter Tool.
 * 3D voxel painting and block placement on grid surfaces with textures and atlas palettes.
 */
export class VoxelPainterEditorTool extends AbstractEditorTool {
  public readonly name = 'voxel_painter';
  public readonly dialogId = 'dialog-voxel-painter';
  public readonly triggerButtonId = 'btnToggleVoxelPainter';
  public readonly toolbarButtonId = 'btnToolbarVoxelPainter';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Voxel Painter';
  public readonly icon = 'brush';
  public readonly order = 6;
  public readonly isExclusive3DTool = true;
  public readonly defaultOpen = false;
  public readonly description =
    '3D voxel painting and block placement on grid surfaces with textures and atlas palettes.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Voxel Painter</strong> turns your 3D canvas into a block-building and voxel painting studio. Place, paint, and sculpt textured voxel blocks directly onto the ground or existing 3D surfaces.</p>

<h4><i class="app-icon" data-lucide="mouse-pointer"></i> Viewport Controls</h4>
<ul>
  <li><strong>Left Click:</strong> Place a new voxel block at the cursor raycast hit position.</li>
  <li><strong>Shift + Left Click:</strong> Erase / remove an existing voxel block.</li>
  <li><strong>Right Click + Drag:</strong> Orbit the 3D scene camera freely without placing or modifying blocks.</li>
</ul>

<h4><i class="app-icon" data-lucide="palette"></i> Materials & Palettes</h4>
<ul>
  <li><strong>Color Swatches:</strong> Choose from vibrant preset color palettes or pick custom hex colors.</li>
  <li><strong>Texture Atlas:</strong> Load Minecraft or custom texture atlas image grids to map different textures to cube faces.</li>
  <li><strong>Individual Textures:</strong> Import custom image files (.png, .jpg) directly onto painted voxel surfaces.</li>
  <li><strong>Bake Voxel Mesh:</strong> Combines all placed blocks into a single high-performance, greedy-meshed 3D scene solid ready for export.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!app?.service?.voxelPainter?.isActive;
  }

  public onActivate(app: any): void {
    app.service?.voxelPainter?.setActive(true);
    app.updatePanelButtonStates?.();
  }

  public onDeactivate(app: any): void {
    app.service?.voxelPainter?.setActive(false);
    app.updatePanelButtonStates?.();
  }

  public onOpen(app: any): void {
    this.onActivate(app);
    app.renderVoxelPalette?.();
    app.renderVoxelAtlasOptions?.();
    app.renderVoxelTextureGallery?.();
    app.showToast('Voxel Painter active. Left click to paint, right click to orbit camera.', 'info');
  }

  public onClose(app: any): void {
    this.onDeactivate(app);
  }

  public onMinimize(app: any): void {
    this.onDeactivate(app);
  }

  public onMaximize(app: any): void {
    this.onActivate(app);
  }

  public onUpdateUI(app: any): void {
    app.renderVoxelPalette?.();
    app.renderVoxelAtlasOptions?.();
    app.renderVoxelTextureGallery?.();
  }
}

