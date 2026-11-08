import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Animation Player Tool.
 * Play, pause, scrub, and inspect skeletal animations and animation groups imported with 3D models.
 */
export class AnimationPlayerEditorTool extends AbstractEditorTool {
  public readonly name = 'animation_player';
  public readonly dialogId = 'dialog-anim';
  public readonly triggerButtonId = 'btnToggleAnimPanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Animation Player';
  public readonly icon = 'film';
  public readonly order = 14;
  public readonly defaultOpen = true;
  public readonly description =
    'Play, pause, scrub, and inspect skeletal animations and animation groups imported with 3D models.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Animation Player</strong> lets you preview, scrub, and manage skeletal and morph target animations imported with animated GLTF / GLB 3D models.</p>

<h4><i class="app-icon" data-lucide="play"></i> Playback Controls</h4>
<ul>
  <li><strong>Animation Group Selector:</strong> Dropdown listing all animation tracks packaged in the imported model (e.g. Walk, Run, Attack, Idle).</li>
  <li><strong>Play / Pause / Stop:</strong> Standard transport playback controls.</li>
  <li><strong>Interactive Scrub Bar:</strong> Drag the timeline slider to inspect individual animation frames with precision.</li>
  <li><strong>Speed Multiplier:</strong> Adjust playback speed from 0.25x slow motion up to 2.0x fast forward.</li>
  <li><strong>Looping:</strong> Toggle continuous seamless loop playback.</li>
</ul>
`.trim();
}

