import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * UV Unwrap & Texel Density Studio Tool.
 * Smart Seam Marking, Seam-Aware LSCM/Angle UV Unwrapping, Texel Density Normalization (px/m),
 * and 2D UV Island Bin-Packing with live 2D UV Map preview.
 */
export class UVUnwrapEditorTool extends AbstractEditorTool {
  public readonly name = 'uv_unwrap';
  public readonly dialogId = 'dialog-uv-unwrap';
  public readonly triggerButtonId = 'btnToggleUVUnwrap';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'UV Unwrap & Texel Density';
  public readonly icon = 'map';
  public readonly order = 10;
  public readonly defaultOpen = false;
  public readonly isExclusive3DTool = true;
  public readonly description =
    'Smart Seam Marking, Seam-Aware UV Unwrapping, Texel Density Normalization (px/m), and 2D Island Bin-Packing.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>UV Unwrap &amp; Texel Density Studio</strong> projects your 3D model cleanly onto a flat 2D texture sheet so materials, painted details, and baked normal maps wrap without stretching or seams.</p>

<h4><i class="app-icon" data-lucide="scissors"></i> Smart Seam Marking</h4>
<ul>
  <li><strong>Auto Smart Seams:</strong> Automatically detects sharp crease edges (above the angle threshold), open boundaries, and cylindrical seam cuts, highlighting them in bright orange in the 3D viewport.</li>
  <li><strong>Interactive 3D Seam Picking:</strong> Enable <em>Click Edges to Mark Seams</em> and click directly on edges of the 3D model to add or remove cut seams manually.</li>
</ul>

<h4><i class="app-icon" data-lucide="maximize-2"></i> Texel Density Tools</h4>
<ul>
  <li><strong>Uniform Resolution (px/m):</strong> Measures the exact ratio of 2D texture pixels per 3D world meter so every part of a character (e.g. face and armor) shares the exact same sharpness.</li>
  <li><strong>Normalize Texel Density:</strong> Rescales all UV islands to match your target density (e.g. 512 px/m or 1024 px/m) at your chosen texture resolution.</li>
  <li><strong>UV Checkerboard Preview:</strong> Toggles a high-contrast color grid on the 3D mesh to visually inspect texel density and stretch.</li>
</ul>

<h4><i class="app-icon" data-lucide="layout-grid"></i> Island Packing Algorithms</h4>
<ul>
  <li><strong>Skyline / Shelf Bin-Packing:</strong> Automatically arranges all 2D UV islands inside the <code>[0, 1]</code> UV square to maximize texture coverage with zero overlap.</li>
  <li><strong>Island Padding &amp; 90&deg; Rotation:</strong> Adds configurable pixel margin between islands to prevent mipmap bleeding and rotates tall islands for optimal packing density.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!app?.service?.uvUnwrapController?.isActive;
  }

  public onActivate(app: any): void {
    app.service?.uvUnwrapController?.setActive(true);
    app.updatePanelButtonStates?.();
    app.updateUVUnwrapUI?.();
  }

  public onDeactivate(app: any): void {
    app.service?.uvUnwrapController?.setActive(false);
    app.updatePanelButtonStates?.();
    app.updateUVUnwrapUI?.();
  }

  public onOpen(app: any): void {
    this.onActivate(app);
    app.updateUVUnwrapUI?.();
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
    app.updateUVUnwrapUI?.();
  }
}

