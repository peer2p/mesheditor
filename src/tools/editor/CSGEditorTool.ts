import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * CSG Sculpting & Non-Destructive Bevel Modifier Tool.
 * Constructive Solid Geometry operations (Subtract, Union, Intersect) with
 * non-destructive base mesh preservation and real-time Chamfer / Fillet Bevel Modifier.
 */
export class CSGEditorTool extends AbstractEditorTool {
  public readonly name = 'csg_sculpting';
  public readonly dialogId = 'dialog-csg';
  public readonly triggerButtonId = 'btnToggleCSG';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Constructive Solid Geometry';
  public readonly icon = 'shapes';
  public readonly order = 8;
  public readonly defaultOpen = true;
  public readonly description =
    'Constructive Solid Geometry operations (Subtract, Union, Intersect) with Non-Destructive workflow and Bevel Modifier.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p><strong>Constructive Solid Geometry (CSG) &amp; Bevel Modifier</strong> lets you perform Boolean modeling operations between two solid 3D meshes and round sharp edges non-destructively without permanently destroying your underlying mesh.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Boolean Operations</h4>
<ul>
  <li><strong>Subtract (Carve / Cut):</strong> Carves the cutting tool mesh shape out of the target mesh. Ideal for cutting doorways, windows, screw holes, and notches.</li>
  <li><strong>Union (Merge Solids):</strong> Seamlessly fuses two overlapping meshes into a single contiguous 3D solid without internal overlapping geometry.</li>
  <li><strong>Intersect:</strong> Retains only the shared overlapping volume where both meshes intersect, discarding the rest.</li>
</ul>

<h4><i class="app-icon" data-lucide="shield-check"></i> Non-Destructive Bevel Modifier</h4>
<ul>
  <li><strong>Non-Destructive Mode:</strong> Preserves a pristine snapshot of the underlying mesh geometry so you can tweak bevel parameters at any time or revert to the un-beveled / pre-boolean base mesh.</li>
  <li><strong>Bevel Width &amp; Segments:</strong> Round sharp boolean cuts and 90&deg; corners using 1 segment (flat Chamfer) or 2&ndash;4 segments (smooth Rounded Fillet).</li>
  <li><strong>Angle Threshold:</strong> Only bevels crease edges whose dihedral angle exceeds the threshold (e.g. 30&deg;), keeping curved surfaces untouched.</li>
  <li><strong>Revert &amp; Bake:</strong> Click <em>Revert to Base</em> to restore original sharp geometry, or <em>Bake Modifier</em> to permanently commit the beveled mesh.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.updateCSGGUI?.();
  }

  public onUpdateUI(app: any): void {
    app.updateCSGGUI?.();
  }
}
