import { Vector3 } from '@babylonjs/core';

/**
 * Shape array that may include solid-shape metadata for manifold mesh generation.
 */
export type SolidShape = Vector3[] & { solidHalfCount?: number; closedShape?: boolean };

export type PresetShapeName =
  | 'custom'
  | 'pipe'
  | 'flatPipe'
  | 'circle'
  | 'rectangle'
  | 'uProfile'
  | 'uprofile' // lowercase alias
  | 'halfpipe'
  | 'triangle'
  | 'ellipse'
  | 'star'
  | 'horizontalLine'
  | 'verticalLine'
  | 'halfCircle'
  | 'halfCircleDepth'
  | 'depthLine'
  | 'diagonalUp'
  | 'diagonalDown'
  | 'plane'
  | 'flat';

export type ShapePresetType = PresetShapeName;

export interface ShapeConfig {
  shapeType: PresetShapeName;
  customPoints?: PathPointData[];
  radius?: number;
  width?: number;
  height?: number;
  depth?: number;
  thickness?: number;
  segments?: number;
  excludeBottom?: number;
  starPoints?: number;
  outerRadius?: number;
  innerRadius?: number;
  solidHalfCount?: number;
  closedShape?: boolean;
  scale?: number;
  twist?: number;
  smoothSteps?: number;
  yOffset?: number;
  cap?: number; // 0: None, 1: Start, 2: End, 3: Both
  capEnds?: boolean;
  color?: string;
  materialName?: string;
  roughness?: number;
  metallic?: number;
}

export interface PathPointData {
  x: number;
  y: number;
  z: number;
}

export interface PathExtrusionItem {
  id: string;
  name: string;
  points: PathPointData[];
  shapeConfig: ShapeConfig;
  shape?: Vector3[];
  bakedMeshName?: string | null;
}

export type PathWayItem = PathExtrusionItem;
