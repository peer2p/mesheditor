import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Scene Objects Outliner Tool.
 * Hierarchical tree view of all scene meshes, submeshes, and parent-child transforms.
 */
export class OutlinerEditorTool extends AbstractEditorTool {
  public readonly name = 'scene_outliner';
  public readonly dialogId = 'dialog-outliner';
  public readonly triggerButtonId = 'btnToggleOutliner';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Scene Objects';
  public readonly icon = 'list-tree';
  public readonly order = 1;
  public readonly defaultOpen = true;
  public readonly description =
    'Hierarchical tree view of all scene meshes, submeshes, and parent-child transforms.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Scene Objects Outliner</strong> provides a structured hierarchy tree of every 3D mesh, submesh, and helper node in your Babylon.js scene.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Key Capabilities</h4>
<ul>
  <li><strong>Instant Filtering:</strong> Type in the search bar at the top to filter objects by name in real-time.</li>
  <li><strong>Submesh Hierarchy:</strong> Expand parent mesh nodes to inspect individual constituent submeshes, loose parts, and bones.</li>
  <li><strong>Selection & Focus:</strong> Click any mesh row in the tree to select it in the 3D viewport and highlight its bounding volume.</li>
  <li><strong>Quick Delete:</strong> Click the trash icon next to any selected item to safely delete it from the scene with full Undo support.</li>
</ul>

<h4><i class="app-icon" data-lucide="mouse-pointer"></i> Controls & Tips</h4>
<ul>
  <li>Click an item to select it. The viewport orbit camera will center on your selection when focused.</li>
  <li>Use <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + <kbd>Z</kbd> to restore any accidentally deleted meshes.</li>
</ul>
`.trim();
}

