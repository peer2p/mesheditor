import { Texture } from '@babylonjs/core';

export interface TextureAtlasFrame {
  id: string;
  name: string;
  col: number;
  row: number;
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
  thumbnailDataUrl?: string;
}

export interface TextureAtlasDefinition {
  id: string;
  name: string;
  texture: Texture;
  dataUrl?: string;
  width: number;
  height: number;
  columns: number;
  rows: number;
  tileSize: number;
  frames: TextureAtlasFrame[];
}

export interface EmbeddedTextureInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  url: string;
  isAtlas: boolean;
  atlasId?: string;
  columns?: number;
  rows?: number;
  materialsCount: number;
  materialNames: string[];
}

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  paletteId: string;
  color?: string;
  atlasTileId?: string;
}

export interface VoxelPaletteItem {
  id: string;
  name: string;
  color: string;
  textureUrl?: string;
  texture?: Texture;
  atlasId?: string;
  atlasTile?: TextureAtlasFrame;
  isLiquid?: boolean;
}

/**
 * Run-Length Encoded (RLE) voxel data format compatible with platformia3d.
 * runs format: [x, y, z, len, paletteIndex, ...]
 */
export interface VoxelData {
  version: number;
  palette: string[];
  runs: number[];
}

export interface RawVoxel {
  x: number;
  y: number;
  z: number;
  id: string;
}

