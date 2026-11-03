import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * CSG Sculpting Tool.
 * Constructive Solid Geometry operations (Subtract, Union, Intersect) using selected meshes.
 */
export class CSGEditorTool extends AbstractEditorTool {
  public readonly name = 'csg_sculpting';
  public readonly dialogId = 'dialog-csg';
  public readonly triggerButtonId = 'btnToggleCSG';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Constructive Solid Geometry';
  public readonly icon = 'shapes';
  public readonly order = 3;
  public readonly defaultOpen = true;
  public readonly description =
    'Constructive Solid Geometry operations (Subtract, Union, Intersect) using selected meshes.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p><strong>Constructive Solid Geometry (CSG)</strong> lets you perform Boolean modeling operations between two solid 3D meshes to carve complex architectural and mechanical shapes.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Boolean Operations</h4>
<ul>
  <li><strong>Subtract (Carve / Cut):</strong> Carves the cutting tool mesh shape out of the target mesh. Ideal for cutting doorways, windows, screw holes, and notches.</li>
  <li><strong>Union (Merge Solids):</strong> Seamlessly fuses two overlapping meshes into a single contiguous 3D solid without internal overlapping geometry.</li>
  <li><strong>Intersect:</strong> Retains only the shared overlapping volume where both meshes intersect, discarding the rest.</li>
</ul>

<h4><i class="app-icon" data-lucide="list-ordered"></i> How to Use</h4>
<ul>
  <li>1. Select the <strong>Base (Target) Mesh</strong> in the viewport or Outliner.</li>
  <li>2. Select or spawn a secondary <strong>Tool (Cutting) Mesh</strong> and position it so it overlaps the target mesh.</li>
  <li>3. Choose the operation (Subtract, Union, or Intersect) and click execute.</li>
  <li>4. The resulting manifold solid is baked into the scene with full Undo (<kbd>Cmd+Z</kbd>) support.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.updateCSGGUI?.();
  }
}

