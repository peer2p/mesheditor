import { ToolExecutionContext } from './ToolExecutionContext';

/**
 * OpenAI-compatible function calling definition structure.
 */
export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * Common tool interface for modular, self-contained 3D editor & AI agent tools.
 * Enables rapid implementation and registration of new tools, UI panels, and AI actions.
 */
export interface ToolInterface {
  /** Unique identifier for the tool (e.g. 'modeler_create_primitive' or 'tool_voxel_painter') */
  readonly name: string;

  /** Human- and LLM-readable summary description of what this tool does */
  readonly description: string;

  /**
   * Comprehensive user-facing guide and help text explaining the tool's purpose,
   * features, keyboard/mouse controls, and workflow tips. Rendered in the tool help popup.
   */
  readonly helpText?: string;

  /** Lucide icon identifier (e.g. 'brush', 'route', 'bot', 'box', 'palette', 'help-circle') */
  readonly icon?: string;

  /** DOM element ID of the tool's floating dialog window (e.g. 'dialog-voxel-painter') */
  readonly dialogId?: string;

  /** DOM element ID of the primary trigger button in menus (e.g. 'btnToggleVoxelPainter') */
  readonly triggerButtonId?: string;

  /** Menu identifier where this tool should appear (e.g. 'menuTools' or 'tools') */
  readonly menuId?: string;

  /** Human-readable menu item and panel title label (e.g. 'Voxel Painter') */
  readonly menuLabel?: string;

  /**
   * HTML/EJS view template markup for this tool's floating dialog or panel.
   */
  readonly viewTemplate?: string;

  /**
   * If true, this tool takes exclusive control of 3D scene pointer clicks (e.g. voxel painting or path curve editing).
   * Multiple exclusive tool dialogs can remain open simultaneously, but only the active tool edits 3D viewport state.
   * Activating one exclusive tool automatically deactivates 3D editing on other exclusive tools without closing their dialogs.
   */
  readonly isExclusive3DTool?: boolean;

  /** Whether this tool dialog should be open and expanded by default on initial profile load */
  readonly defaultOpen?: boolean;

  /** JSON Schema describing the input parameters for AI function calling */
  readonly parameters?: Record<string, any>;

  /** Optional sorting order priority in dropdown menus and stackpanel sidebar */
  order?: number;

  /**
   * Returns the HTML/EJS view template markup for this tool.
   */
  getViewTemplate?(): string;

  /**
   * Mounts or retrieves the tool's dialog DOM element.
   * If the dialog element is not already present in the DOM, mounts it from `viewTemplate`.
   */
  renderView?(container?: HTMLElement): HTMLElement | null;

  /** Formats the tool specification for OpenAI-compatible function calling */
  getDefinition?(): OpenAIToolDefinition;

  /**
   * Executes the tool logic against the live scene and editor context.
   *
   * @param args Parsed input arguments matching `parameters` schema
   * @param context Scene, service, and utility context
   * @returns String result (usually JSON) sent back to the LLM or caller
   */
  execute?(args: any, context: ToolExecutionContext): Promise<string> | string;

  /**
   * Dynamic check returning whether this tool is currently active in the editor.
   */
  isActive?(app?: any): boolean;

  /**
   * Lifecycle hook invoked when an interactive 3D tool becomes active for 3D state editing.
   */
  onActivate?(app: any): void;

  /**
   * Lifecycle hook invoked when an interactive 3D tool is deactivated from 3D state editing (without closing its dialog).
   */
  onDeactivate?(app: any): void;

  /**
   * Lifecycle hook invoked when the tool dialog/panel is opened or displayed.
   */
  onOpen?(app: any): void;

  /**
   * Lifecycle hook invoked when the tool dialog/panel is closed or deactivated.
   */
  onClose?(app: any): void;

  /**
   * Lifecycle hook invoked when the tool dialog is collapsed / minimized.
   */
  onMinimize?(app: any): void;

  /**
   * Lifecycle hook invoked when the tool dialog is expanded / maximized.
   */
  onMaximize?(app: any): void;

  /**
   * Lifecycle hook invoked when the editor UI needs to re-synchronize state.
   */
  onUpdateUI?(app: any): void;
}
