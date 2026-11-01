import { ToolInterface } from '../ToolInterface';

/**
 * Scene & Environment Tool.
 * Adjust scene background color, ground grid, ambient lighting, sunlight intensity, and camera speed.
 */
export class SceneEnvironmentEditorTool implements ToolInterface {
  public readonly name = 'scene_environment';
  public readonly dialogId = 'dialog-scene';
  public readonly triggerButtonId = 'btnToggleScenePanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Scene & Environment';
  public readonly icon = 'sun-medium';
  public readonly order = 11;
  public readonly defaultOpen = true;
  public readonly description =
    'Adjust scene background color, ground grid, ambient lighting, sunlight intensity, and camera speed.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Scene & Environment</strong> panel manages world lighting, sky background color, camera navigation speed, and ground grid reference markers.</p>

<h4><i class="app-icon" data-lucide="sun"></i> Environment Settings</h4>
<ul>
  <li><strong>Clear Color:</strong> Viewport background color picker (default dark studio aesthetic).</li>
  <li><strong>Ground Grid:</strong> Toggle the dynamic ground plane grid and adjust grid cell size for metric modeling reference.</li>
  <li><strong>Ambient Lighting:</strong> Hemispheric ambient light brightness for overall scene visibility.</li>
  <li><strong>Sun Light:</strong> Directional sunlight key light intensity for sharp cast shadows and specular highlights.</li>
  <li><strong>Camera Speed:</strong> Multiplier for orbit camera zoom, pan, and rotation responsiveness.</li>
</ul>
`.trim();
}

