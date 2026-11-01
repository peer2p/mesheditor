import { ToolInterface } from '../ToolInterface';

/**
 * Material & UV Mapping Tool.
 * Configure PBR material properties, colors, textures, roughness, metallic, and UV projections.
 */
export class MaterialEditorTool implements ToolInterface {
  public readonly name = 'material_uv';
  public readonly dialogId = 'dialog-material';
  public readonly triggerButtonId = 'btnToggleMaterialPanel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Material & UV Mapping';
  public readonly icon = 'palette';
  public readonly order = 10;
  public readonly defaultOpen = true;
  public readonly description =
    'Configure PBR material properties, colors, textures, roughness, metallic, and UV projections.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Material & UV Mapping</strong> panel configures Physically Based Rendering (PBR) metallic-roughness materials, texture maps, and automated UV coordinate projections.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> PBR Properties</h4>
<ul>
  <li><strong>Albedo Tint:</strong> Base diffuse surface color with live RGB and HEX color pickers.</li>
  <li><strong>Metallic & Roughness:</strong> Sliders spanning mirror-smooth polished chrome to matte rough ceramics.</li>
  <li><strong>Alpha & Transparency:</strong> Opacity slider supporting transparent glass, plastics, and translucent overlays.</li>
  <li><strong>Emissive Glow:</strong> Self-illuminating color for lamps, neon signs, and glowing sci-fi elements.</li>
</ul>

<h4><i class="app-icon" data-lucide="grid"></i> UV Projection & Textures</h4>
<ul>
  <li>Load diffuse, normal, and roughness image maps.</li>
  <li>Auto-generate clean <strong>Box</strong>, <strong>Planar</strong>, and <strong>Cylindrical</strong> UV texture mappings with customizable tiling scales.</li>
  <li>Manage embedded textures bundled directly within saved scene projects.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.renderEmbeddedTextures?.();
  }
}

