import { Nullable, Quaternion, TransformNode, Vector3, Mesh, AnimationGroup } from '@babylonjs/core';

export interface TextureOptimizationInfo {
  name: string;
  originalSize: number;
  newSize: number;
  width: number;
  height: number;
}

export interface TransformSnapshot {
  position: Vector3;
  rotation: Vector3;
  rotationQuaternion: Nullable<Quaternion>;
  scaling: Vector3;
}

export interface ActionRecord {
  name: string;
  undo: () => void;
  redo: () => void;
}

export type PrimitiveShape =
  | 'Box'
  | 'Sphere'
  | 'Cylinder'
  | 'Cone'
  | 'Capsule'
  | 'Torus'
  | 'TorusKnot'
  | 'Plane'
  | 'Disc'
  | 'Ground'
  | 'Polyhedron';

export interface PrimitiveConfig {
  shape: PrimitiveShape;
  name?: string;
  size: number;
  width: number;
  height: number;
  depth: number;
  diameter?: number;
  thickness?: number;
  subdivisions: number;
  tessellation: number;
  polyType?: number;
  color: string;
  roughness?: number;
  metallic?: number;
}

export type CSGOperationType = 'subtract' | 'union' | 'intersect' | 'slice';

export interface ExportOptions {
  format: 'glb' | 'gltf' | 'obj' | 'stl' | 'babylon';
  filename: string;
  selectedOnly?: boolean;
}

export interface MeshEditorServiceEvents {
  onSelectionChanged?: (nodes: TransformNode[], activeMesh: Mesh | null, subMeshId: number | null) => void;
  onSceneModified?: () => void;
  onHistoryChanged?: (canUndo: boolean, canRedo: boolean) => void;
  onStatusChanged?: (text: string, isBusy?: boolean) => void;
  onToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onModelLoaded?: (filename: string) => void;
  onStatsUpdated?: (meshCount: number, polyCount: number) => void;
  onFaceSelected?: (faceId: number | null, isQuad?: boolean) => void;
  onVertexSelected?: (vertexIndex: number | null, position?: Vector3) => void;
  onFacetEditModeChanged?: (mode: 'face' | 'vertex') => void;
  onFacetEditorStateChanged?: (active: boolean) => void;
  onAnimationsLoaded?: (names: string[], currentGroup: AnimationGroup | null) => void;
  onAnimProgress?: (currentFrame: number) => void;
  onExportModel?: (blob: Blob, filename: string, format: ExportOptions['format']) => Promise<boolean> | boolean;
}

export type Neural3DBackendId = 'trellis' | 'hunyuan3d' | 'hi3d';

export type Neural3DProtocol =
  | 'omlx'
  | 'local_rest'
  | 'gradio'
  | 'fal'
  | 'replicate';

export interface Neural3DProviderConfig {
  id: Neural3DBackendId;
  name: string;
  enabled: boolean;
  protocol: Neural3DProtocol;
  endpointUrl: string;
  apiKey?: string;
  modelId?: string;
}

export type Neural3DProvidersMap = Record<Neural3DBackendId, Neural3DProviderConfig>;

export interface AIAgentEndpointConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxIterations?: number;
  minPolygons?: number;
  maxPolygons?: number;
  createTextures?: boolean;
  createNormalMaps?: boolean;
  visualCritique?: boolean;
  neural3DProviders?: Neural3DProvidersMap;
}

export interface AIAgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
}

export interface AIAgentToolExecutionStep {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result: string;
  isError?: boolean;
  durationMs?: number;
}

export interface AIAgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  toolSteps?: AIAgentToolExecutionStep[];
  timestamp: number;
}

export interface AIAgentRequestOptions {
  prompt: string;
  images?: string[];
  mode?: 'create_or_update' | 'replace_scene';
  includeViewportSnapshot?: boolean;
  visualCritique?: boolean;
  signal?: AbortSignal;
  onStep?: (step: AIAgentToolExecutionStep) => void;
  onStatus?: (statusText: string) => void;
}

export interface MeshEditorVoxelProjectState {
  voxelSize: number;
  paletteId: string;
  atlasId?: string | null;
  voxelData: any;
}

export interface MeshEditorProjectData {
  version: number;
  generator?: string;
  timestamp?: number;
  tools?: {
    voxelPainter?: MeshEditorVoxelProjectState;
    pathExtrusion?: any[];
    pathWays?: any[];
    [key: string]: any;
  };
}

