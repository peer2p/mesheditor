import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Mesh Properties Tool.
 * Inspect and modify transform (position, rotation, scale), pivots, bounding boxes, and hierarchy.
 */
export class MeshPropertiesEditorTool extends AbstractEditorTool {
  public readonly name = 'mesh_properties';
  public readonly dialogId = 'dialog-mesh';
  public readonly triggerButtonId = 'btnToggleMeshPanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Mesh Properties';
  public readonly icon = 'box';
  public readonly order = 9;
  public readonly defaultOpen = true;
  public readonly description =
    'Inspect and modify transform (position, rotation, scale), pivots, bounding boxes, and hierarchy.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Mesh Properties</strong> panel provides CAD-grade numeric transform controls, pivot alignment tools, and geometry decomposition utilities for selected objects.</p>

<h4><i class="app-icon" data-lucide="sliders"></i> Transform Controls</h4>
<ul>
  <li><strong>Position (X, Y, Z):</strong> Numeric coordinates in scene units.</li>
  <li><strong>Rotation (X, Y, Z):</strong> Angular rotations in degrees.</li>
  <li><strong>Scale (X, Y, Z):</strong> Axis scaling factors and convenient Uniform Scale slider.</li>
  <li><strong>Bounding Box:</strong> Toggle visual wireframe bounding box volume.</li>
</ul>

<h4><i class="app-icon" data-lucide="wrench"></i> Geometric Operations</h4>
<ul>
  <li><strong>Snap to Ground:</strong> Automatically drops the selected object onto the ground plane (Y = 0) based on its lowest bounding vertex.</li>
  <li><strong>Center Pivot:</strong> Recalculates the mesh origin and sets the transform pivot to the exact geometric center.</li>
  <li><strong>Bake Transform:</strong> Applies current position, rotation, and scale permanently into vertex buffer data and resets transform vectors to identity.</li>
  <li><strong>Separate Loose Parts:</strong> Scans disconnected mesh vertex clusters and splits them into separate, individually selectable scene meshes.</li>
  <li><strong>Merge Meshes:</strong> Combines multiple selected meshes into a single mesh while preserving individual sub-materials.</li>
</ul>
`.trim();
}

