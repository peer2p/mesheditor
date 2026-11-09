import { AbstractEditorTool } from './AbstractEditorTool';

export class AITextureEditorTool extends AbstractEditorTool {
  public readonly name = 'ai_texture_generator';
  public readonly dialogId = 'dialog-ai-texture';
  public readonly triggerButtonId = 'btnToggleAITextureTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'AI Texture Generator';
  public readonly icon = 'wand-2';
  public readonly order = 16;
  public readonly isExclusive3DTool = false;

  public readonly description =
    'Generate seamless 2D PBR textures and normal maps from natural language prompts, download them as PNG, or apply them to meshes and decals.';

  public readonly helpText = `
    <h4>AI Texture Generator</h4>
    <p>Synthesize seamless tileable Albedo and Tangent-Space Normal Map textures from text prompts.</p>
    <ul>
      <li><strong>Prompt & Presets:</strong> Describe the surface material (e.g., <em>"Weathered dungeon cobblestone floor with mossy crevices"</em>) or pick a quick preset.</li>
      <li><strong>Pattern Styles:</strong> Automatically inferred from your prompt, or manually select Cobblestone, Brick, Wood Planks, Sci-Fi Panels, Rusted Metal, Volcanic Lava, Marble, Arcane Runes, Scales, Moss, or Alpha Decal.</li>
      <li><strong>Seamless & Normal Maps:</strong> Generated textures use periodic toroidal noise for seamless UV tiling and include a matching normal map.</li>
      <li><strong>Apply, Decal & Download:</strong> Click <strong>Apply to Mesh</strong> to assign the PBR texture to the selected mesh, <strong>Use as Decal</strong> to paint with it in the Decal Painter, or <strong>Download PNG</strong> to save it locally.</li>
    </ul>
  `;

  public onOpen(app: any): void {
    app.updateAITextureUI?.();
  }

  public onUpdateUI(app: any): void {
    app.updateAITextureUI?.();
  }
}

