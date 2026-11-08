import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Normal Map & Ambient Occlusion Baking Studio Tool.
 * Projects high-poly surface details (creases, pores, bolts, bevels) onto a low-poly game mesh's
 * 2D Tangent-Space Normal Map and Ambient Occlusion (AO) Map using an inflated Projection Cage.
 */
export class BakingEditorTool extends AbstractEditorTool {
  public readonly name = 'texture_baker';
  public readonly dialogId = 'dialog-baking';
  public readonly triggerButtonId = 'btnToggleBakingTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Normal & AO Baker';
  public readonly icon = 'flame';
  public readonly order = 11;
  public readonly defaultOpen = false;
  public readonly description =
    'Bake High-Poly surface detail into Tangent-Space Normal Maps and Ambient Occlusion with automatic Cage generation.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Normal &amp; AO Baker</strong> transfers microscopic geometric detail (wrinkles, armor rivets, bevels, pores) from a High-Poly sculpt onto a flat 2D texture for a Low-Poly game mesh so it reacts realistically to dynamic lighting at a fraction of the polygon cost.</p>

<h4><i class="app-icon" data-lucide="box"></i> Projection Cage Generation</h4>
<ul>
  <li><strong>Smooth Averaged Cage:</strong> Extrudes a gap-free wireframe envelope around your Low-Poly mesh along welded vertex normals so rays never miss along hard edges.</li>
  <li><strong>Auto Cage Fit:</strong> Automatically measures bounding volume offsets between your High-Poly and Low-Poly meshes to set an optimal cage distance.</li>
  <li><strong>3D Cage Preview:</strong> Toggle the cyan wireframe envelope in the 3D viewport to visually verify that all high-poly features sit inside the cage.</li>
</ul>

<h4><i class="app-icon" data-lucide="flame"></i> Baked Maps &amp; Seam Dilation</h4>
<ul>
  <li><strong>Tangent-Space Normal Map:</strong> Encodes XYZ surface normal perturbations in tangent space (supports both OpenGL +Y and DirectX -Y conventions).</li>
  <li><strong>Ambient Occlusion (AO):</strong> Captures soft contact shadows in crevices, folds, and recessed cavities.</li>
  <li><strong>Edge Padding (Dilation):</strong> Expands island border pixels outward so mipmapping never causes visible seam lines.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.updateBakingUI?.();
  }

  public onClose(app: any): void {
    app.service?.textureBaker?.clearCagePreview();
  }

  public onUpdateUI(app: any): void {
    app.updateBakingUI?.();
  }
}

