import { ToolInterface } from '../ToolInterface';

/**
 * Texture Optimizer Tool.
 * Optimize, resize, convert textures to WebP, inspect texture memory, and embed texture assets.
 */
export class TextureOptimizerEditorTool implements ToolInterface {
  public readonly name = 'texture_optimizer';
  public readonly dialogId = 'dialog-textures';
  public readonly triggerButtonId = 'btnToggleTexturePanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Texture Optimizer';
  public readonly icon = 'zap';
  public readonly order = 5;
  public readonly defaultOpen = true;
  public readonly description =
    'Optimize, resize, convert textures to WebP, inspect texture memory, and embed texture assets.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Texture Optimizer</strong> analyzes GPU memory consumption across all active scene materials and converts heavy PNG/JPG textures into ultra-compact, modern WebP format.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Capabilities</h4>
<ul>
  <li><strong>VRAM Memory Audit:</strong> View live texture resolutions, bit depths, and GPU video memory footprints.</li>
  <li><strong>WebP Compression:</strong> Reduce texture file size by 60%–85% with zero perceptible visual quality loss.</li>
  <li><strong>Texture Atlas Packing:</strong> Combine multiple small textures into single GPU texture sheets for maximum rendering performance.</li>
  <li><strong>Asset Embedding:</strong> Package external image maps directly inside the exported 3D scene project.</li>
</ul>
`.trim();
}

