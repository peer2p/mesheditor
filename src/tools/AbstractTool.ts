import { Mesh, PBRMaterial, Vector3 } from '@babylonjs/core';
import { ToolExecutionContext } from './ToolExecutionContext';
import { OpenAIToolDefinition, ToolInterface } from './ToolInterface';

/**
 * Abstract base class for self-contained tools.
 * Provides standard parameter schema wrapping and convenient helper utilities
 * so subclasses only need to specify their metadata and execute() implementation.
 */
export abstract class AbstractTool implements ToolInterface {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly parameters: Record<string, any>;

  /**
   * Generates standard OpenAI tool schema definition.
   */
  public getDefinition(): OpenAIToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  /**
   * Abstract execution method to be implemented by each concrete tool.
   */
  public abstract execute(args: any, context: ToolExecutionContext): Promise<string> | string;

  /**
   * Parses a 3D vector from an array `[x, y, z]` or object `{x, y, z}`.
   */
  protected parseVec3(v: any, defaultVal: number = 0): Vector3 {
    if (Array.isArray(v)) {
      return new Vector3(
        Number(v[0] ?? defaultVal) || 0,
        Number(v[1] ?? defaultVal) || 0,
        Number(v[2] ?? defaultVal) || 0
      );
    }
    return new Vector3(
      Number(v?.x ?? defaultVal) || 0,
      Number(v?.y ?? defaultVal) || 0,
      Number(v?.z ?? defaultVal) || 0
    );
  }

  /**
   * Parses a 2D or 3D point into a Vector3 suitable for polygon builders.
   */
  protected parsePolygonPoint(p: any): Vector3 {
    if (Array.isArray(p)) {
      if (p.length === 2) {
        return new Vector3(Number(p[0]) || 0, 0, Number(p[1]) || 0);
      }
      return new Vector3(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0);
    }
    return new Vector3(Number(p?.x) || 0, Number(p?.y) || 0, Number(p?.z) || 0);
  }

  /**
   * Normalizes hex color values to `#RRGGBB` format.
   */
  protected normalizeHex(hex: string): string {
    if (!hex || typeof hex !== 'string') return '#58a6ff';
    const trimmed = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      return (
        '#' +
        trimmed
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      );
    }
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return '#' + trimmed;
    return '#58a6ff';
  }

  /**
   * Helper to look up an active mesh in the scene by name or id.
   */
  protected findMesh(identifier: string, context: ToolExecutionContext): Mesh | undefined {
    return context.findMeshByNameOrId(identifier);
  }

  /**
   * Helper to register a newly created mesh into the editor's scene index.
   */
  protected registerMesh(mesh: Mesh, context: ToolExecutionContext): void {
    context.registerCreatedMesh(mesh);
  }

  /**
   * Helper to apply standard transform arguments (position, rotation, scaling) to a mesh.
   */
  protected applyTransform(mesh: Mesh, args: any, context: ToolExecutionContext): void {
    context.applyTransformArgs(mesh, args);
  }

  /**
   * Helper to get an existing material by name or create a new PBRMaterial.
   */
  protected getOrCreateMaterial(
    context: ToolExecutionContext,
    materialName?: string,
    colorHex?: string,
    roughness?: number,
    metallic?: number,
    fallbackName: string = 'Mat'
  ): PBRMaterial {
    return context.getOrCreateMaterial(materialName, colorHex, roughness, metallic, fallbackName);
  }
}

