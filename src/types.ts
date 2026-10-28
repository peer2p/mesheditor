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
  format: 'glb' | 'gltf' | 'obj' | 'stl';
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
  onAnimationsLoaded?: (names: string[], currentGroup: AnimationGroup | null) => void;
  onAnimProgress?: (currentFrame: number) => void;
  onExportModel?: (blob: Blob, filename: string, format: ExportOptions['format']) => Promise<boolean> | boolean;
}
