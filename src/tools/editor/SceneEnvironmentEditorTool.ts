import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Scene & Environment Tool.
 * Adjust scene background color, ground grid, ambient lighting, sunlight intensity, and camera speed.
 */
export class SceneEnvironmentEditorTool extends AbstractEditorTool {
  public readonly name = 'scene_environment';
  public readonly dialogId = 'dialog-scene';
  public readonly triggerButtonId = 'btnToggleScenePanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Scene & Environment';
  public readonly icon = 'sun-medium';
  public readonly order = 13;
  public readonly defaultOpen = true;
  public readonly description =
    'Adjust scene background color, ground grid, ambient lighting, sunlight intensity, camera speed, and transform grid snapping.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Scene & Environment</strong> panel manages world lighting, sky background color, camera navigation speed, ground grid reference markers, and transform grid snapping.</p>

<h4><i class="app-icon" data-lucide="sun"></i> Environment Settings</h4>
<ul>
  <li><strong>Clear Color:</strong> Viewport background color picker (default dark studio aesthetic).</li>
  <li><strong>Ground Grid:</strong> Toggle the dynamic ground plane grid and adjust grid cell size for metric modeling reference.</li>
  <li><strong>Ambient Lighting:</strong> Hemispheric ambient light brightness for overall scene visibility.</li>
  <li><strong>Sun Light:</strong> Directional sunlight key light intensity for sharp cast shadows and specular highlights.</li>
  <li><strong>Camera Speed:</strong> Multiplier for orbit camera zoom, pan, and rotation responsiveness.</li>
</ul>

<h4><i class="app-icon" data-lucide="grid"></i> Transform Snapping (Command Key)</h4>
<ul>
  <li><strong>Move Snap:</strong> Grid increment in units for translating meshes when holding the Command (or Ctrl) key (default: 0.1).</li>
  <li><strong>Rotate Snap:</strong> Angle increment in degrees for rotating meshes when holding the Command (or Ctrl) key (default: 5°).</li>
</ul>
`.trim();
}

