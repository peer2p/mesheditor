import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Scene & Environment Tool.
 * Adjust scene background color, ambient lighting, and sunlight intensity.
 */
export class SceneEnvironmentEditorTool extends AbstractEditorTool {
  public readonly name = 'scene_environment';
  public readonly dialogId = 'dialog-scene';
  public readonly triggerButtonId = 'btnToggleScenePanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Scene & Environment';
  public readonly category = 'Generic';
  public readonly icon = 'sun-medium';
  public readonly order = 13;
  public readonly defaultOpen = true;
  public readonly description =
    'Adjust scene background color, ambient lighting, and sunlight intensity.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Scene & Environment</strong> panel manages world lighting and sky background color.</p>

<h4><i class="app-icon" data-lucide="sun"></i> Environment Settings</h4>
<ul>
  <li><strong>Background:</strong> Viewport background color picker (default dark studio aesthetic).</li>
  <li><strong>Ambient Light:</strong> Hemispheric ambient light brightness for overall scene visibility.</li>
  <li><strong>Sun Light:</strong> Directional sunlight key light intensity for sharp cast shadows and specular highlights.</li>
</ul>

<h4><i class="app-icon" data-lucide="settings"></i> Viewport &amp; Snapping Settings</h4>
<p>Ground grid visibility, grid size, grid colors, transparent grid fill, camera speed, move snap, and rotate snap have moved to the <strong>Settings</strong> dialog (gear icon in the top-right toolbar), where they are saved automatically.</p>
`.trim();
}

