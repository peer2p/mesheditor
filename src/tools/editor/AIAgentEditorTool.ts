import { ToolInterface } from '../ToolInterface';

/**
 * AI Mesh Agent Tool.
 * Text-to-Mesh and Image-to-Mesh generator and conversational scene assistant.
 */
export class AIAgentEditorTool implements ToolInterface {
  public readonly name = 'ai_agent';
  public readonly dialogId = 'dialog-ai-agent';
  public readonly triggerButtonId = 'btnToggleAIAgent';
  public readonly toolbarButtonId = 'btnToolbarAIAgent';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'AI Mesh Agent';
  public readonly icon = 'bot';
  public readonly order = 8;
  public readonly defaultOpen = false;
  public readonly description =
    'Text-to-Mesh and Image-to-Mesh generator and conversational scene assistant.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>AI Mesh Agent</strong> is an autonomous 3D modeling assistant powered by large language and vision models. It understands natural language descriptions and image references to build, modify, and compose complete 3D scenes.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Capabilities</h4>
<ul>
  <li><strong>Text-to-Mesh:</strong> Type prompts like <em>"Build a medieval watchtower with stone walls and wooden roof"</em> to generate detailed multi-part 3D models.</li>
  <li><strong>Image-to-Mesh:</strong> Attach reference photos, sketches, or concept art. The AI inspects silhouette, colors, and proportions to reproduce the subject in 3D.</li>
  <li><strong>Mesh Update:</strong> Select an existing mesh in the viewport and ask the AI to modify it (e.g. <em>"Scale this mesh by 1.5 and change material to gold"</em>).</li>
  <li><strong>Speech-to-Text:</strong> Click the microphone icon to speak your modeling instructions hands-free.</li>
  <li><strong>Viewport Capture:</strong> Click the camera icon to send a screenshot of your active 3D view to the AI for visual feedback and adjustments.</li>
  <li><strong>OpenAI-Compatible:</strong> Connects to Ollama (local), OpenAI (GPT-4o), OpenRouter, LM Studio, or any OpenAI-compatible API endpoint.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    const dlg = app?.getElement?.('dialog-ai-agent');
    return !!(dlg && dlg.style.display !== 'none');
  }
}

