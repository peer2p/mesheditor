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
    'Generate seamless 2D PBR textures and normal maps using the built-in procedural synthesizer or external AI image generators (Pollinations, OpenAI DALL-E, SD WebUI, Fal.ai, Replicate).';

  public readonly helpText = `
    <h4>AI Texture Generator</h4>
    <p>Synthesize seamless tileable Albedo and Tangent-Space Normal Map textures from natural language prompts using either the offline Procedural Synthesizer or external AI Image Generators.</p>
    <ul>
      <li><strong>Generator Engines:</strong> Choose between the built-in <em>Procedural Synthesizer</em> (fast offline mathematical noise) or external <em>AI Image Generators</em> (Free Pollinations.ai, OpenAI DALL-E 3/2, Stable Diffusion WebUI / Automatic1111, Fal.ai Flux, Replicate, or Custom REST endpoints).</li>
      <li><strong>Seamless Tiling & Normal Maps:</strong> Automatically generates matching tangent-space normal maps for realistic 3D depth and enhances prompts with orthogonal seamless tiling modifiers.</li>
      <li><strong>Prompt & Presets:</strong> Describe the surface material (e.g., <em>"Weathered dungeon cobblestone floor with mossy crevices"</em>) or pick a quick preset.</li>
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

