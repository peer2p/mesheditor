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
 * Enables rapid implementation and registration of new tools.
 */
export interface ToolInterface {
  /** Unique identifier for the tool (e.g. 'modeler_create_primitive') */
  readonly name: string;

  /** Human- and LLM-readable description of what this tool does */
  readonly description: string;

  /** JSON Schema describing the input parameters */
  readonly parameters: Record<string, any>;

  /** Formats the tool specification for OpenAI-compatible function calling */
  getDefinition(): OpenAIToolDefinition;

  /**
   * Executes the tool logic against the live scene and editor context.
   *
   * @param args Parsed input arguments matching `parameters` schema
   * @param context Scene, service, and utility context
   * @returns String result (usually JSON) sent back to the LLM or caller
   */
  execute(args: any, context: ToolExecutionContext): Promise<string> | string;
}

