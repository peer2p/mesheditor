import { Mesh, PBRMaterial, Scene, Vector3 } from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import type { AIAgentService } from '../AIAgentService';

/**
 * Execution context provided to tools when executed by the tool registry.
 * Provides direct access to the live scene, editor service, mesh finding,
 * material caching, and transform utilities.
 */
export interface ToolExecutionContext {
  /** The core 3D mesh editor service */
  service: MeshEditorService;
  /** The live Babylon.js scene */
  scene: Scene;
  /** The AI agent service instance if running within an agent session */
  aiAgent?: AIAgentService;
  /** Cached materials by name */
  materialRegistry: Map<string, PBRMaterial>;

  /** Finds an active, non-editor mesh by name or ID */
  findMeshByNameOrId(identifier: string): Mesh | undefined;

  /** Gets an existing material or creates a new PBRMaterial */
  getOrCreateMaterial(
    materialName?: string,
    colorHex?: string,
    roughness?: number,
    metallic?: number,
    fallbackName?: string
  ): PBRMaterial;

  /** Applies position, rotation (Euler or degrees), and scaling from arguments */
  applyTransformArgs(mesh: Mesh, args: any): void;

  /** Registers a newly created mesh with selection and tracking */
  registerCreatedMesh(mesh: Mesh): void;

  /** Normalizes hex color string to #RRGGBB */
  normalizeHex(hex: string): string;

  /** Parses a 3D vector from an array or object */
  parseVec3(v: any, defaultVal?: number): Vector3;

  /** Parses a 2D or 3D point into a Vector3 for polygon builder */
  parsePolygonPoint(p: any): Vector3;

  /** Builds a JSON-serializable summary of the active scene */
  buildSceneSummary(): Record<string, any>;
}

