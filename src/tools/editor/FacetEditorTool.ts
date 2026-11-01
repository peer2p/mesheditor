import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Facet & Vertex Editor Tool.
 * Inspect, move, and edit mesh facet normals, vertex data, and wireframes.
 */
export class FacetEditorTool extends AbstractEditorTool {
  public readonly name = 'facet_editor';
  public readonly dialogId = 'dialog-facet';
  public readonly triggerButtonId = 'btnToggleFacetEditor';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Facet & Vertex Editor';
  public readonly icon = 'triangle';
  public readonly order = 4;
  public readonly defaultOpen = true;
  public readonly description =
    'Inspect, move, and edit mesh facet normals, vertex data, and wireframes.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Facet & Vertex Editor</strong> is a diagnostic and topology tool for inspecting polygon face normals, vertex structures, and wireframe cages.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Features & Tools</h4>
<ul>
  <li><strong>Normal Visualizer:</strong> Toggle per-vertex normal spike lines to verify which direction faces are pointing.</li>
  <li><strong>Flip / Invert Normals:</strong> Reverse polygon winding order if faces appear transparent or inside-out due to backface culling.</li>
  <li><strong>Flat vs. Smooth Shading:</strong> Recalculate vertex normals for sharp mechanical facets or silky-smooth organic curves.</li>
  <li><strong>Wireframe Overlay:</strong> View underlying triangle density, quad subdivisions, and edge flows.</li>
</ul>
`.trim();
}

