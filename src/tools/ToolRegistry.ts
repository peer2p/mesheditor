import { ToolExecutionContext } from './ToolExecutionContext';
import { OpenAIToolDefinition, ToolInterface } from './ToolInterface';
import {
  ApplyMaterialTool,
  AutoUVMappingTool,
  BooleanOperationTool,
  BuildVoxelMeshTool,
  CloneArrayTool,
  CreateLatheTool,
  CreateMaterialTool,
  CreatePrimitiveTool,
  CreateTubeTool,
  DeleteMeshTool,
  ExecuteBabylonCodeTool,
  ExtrudePolygonTool,
  ExtrudeShapeTool,
  GetSceneInfoTool,
  MergeMeshesTool,
  SeparateMeshTool,
  TransformMeshTool,
  VoxelPainterTool,
} from './builtin';

/**
 * Registry managing available modeling & AI tools.
 * Handles tool lookup, OpenAI schema aggregation, and safe execution dispatch.
 */
export class ToolRegistry {
  private tools: Map<string, ToolInterface> = new Map();

  constructor(initialTools: ToolInterface[] = []) {
    for (const tool of initialTools) {
      this.register(tool);
    }
  }

  /**
   * Registers a tool instance into the registry.
   * If a tool with the same name exists, it will be overwritten.
   */
  public register(tool: ToolInterface): void {
    if (!tool || !tool.name) {
      throw new Error('Invalid tool provided: must have a valid "name".');
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregisters a tool by name.
   */
  public unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  /**
   * Retrieves a tool by its unique name.
   */
  public get(toolName: string): ToolInterface | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Checks whether a tool is registered.
   */
  public has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Returns all currently registered tools.
   */
  public getAll(): ToolInterface[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns an array of OpenAI function tool specifications for all registered tools.
   */
  public getOpenAITools(): OpenAIToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Executes a registered tool by name with arguments and context.
   */
  public async execute(
    toolName: string,
    rawArgs: any,
    context: ToolExecutionContext
  ): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
    return await tool.execute(args, context);
  }
}

/**
 * Factory helper creating a new ToolRegistry populated with all 17 built-in Babylon.js modeling tools.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    new GetSceneInfoTool(),
    new CreatePrimitiveTool(),
    new ExtrudePolygonTool(),
    new ExtrudeShapeTool(),
    new CreateLatheTool(),
    new CreateTubeTool(),
    new BooleanOperationTool(),
    new CreateMaterialTool(),
    new ApplyMaterialTool(),
    new AutoUVMappingTool(),
    new TransformMeshTool(),
    new CloneArrayTool(),
    new MergeMeshesTool(),
    new SeparateMeshTool(),
    new DeleteMeshTool(),
    new BuildVoxelMeshTool(),
    new ExecuteBabylonCodeTool(),
    new VoxelPainterTool(),
  ]);
}

