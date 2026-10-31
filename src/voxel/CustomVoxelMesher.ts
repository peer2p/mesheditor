import {
  Color3,
  Mesh,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import { TextureAtlasDefinition, VoxelBlock, VoxelPaletteItem } from './types';

export interface VoxelMesherOptions {
  voxelSize?: number;
  meshName?: string;
  atlas?: TextureAtlasDefinition;
}

export class CustomVoxelMesher {
  /**
   * Generates an optimized 3D mesh from a collection of voxel blocks with interior face culling.
   * Internal faces between two solid voxels are not generated.
   * If an atlas is used, UV coordinates are mapped to each block's atlas frame.
   */
  public static build(
    scene: Scene,
    blocks: VoxelBlock[],
    paletteMap: Map<string, VoxelPaletteItem>,
    options: VoxelMesherOptions = {}
  ): Mesh | null {
    if (!blocks || blocks.length === 0) return null;

    const voxelSize = options.voxelSize || 1.0;
    const meshName = options.meshName || 'voxel_model';
    const half = voxelSize * 0.5;

    // Fast lookup map for 3D coordinate culling
    const grid = new Map<string, VoxelBlock>();
    for (const b of blocks) {
      grid.set(`${b.x},${b.y},${b.z}`, b);
    }

    // Group blocks by material / atlas
    const blocksByGroup = new Map<string, VoxelBlock[]>();
    for (const b of blocks) {
      const pal = paletteMap.get(b.paletteId);
      const isAtlasTile = !!(pal?.atlasTile && pal?.atlasId);
      const groupKey = isAtlasTile
        ? `atlas_${pal!.atlasId}`
        : pal?.textureUrl || pal?.texture?.name || b.paletteId;

      let list = blocksByGroup.get(groupKey);
      if (!list) {
        list = [];
        blocksByGroup.set(groupKey, list);
      }
      list.push(b);
    }

    const createdSubMeshes: Mesh[] = [];

    // Helper to test if a neighboring voxel is solid
    const isSolid = (x: number, y: number, z: number): boolean => {
      const neighbor = grid.get(`${x},${y},${z}`);
      if (!neighbor) return false;
      const neighborPal = paletteMap.get(neighbor.paletteId);
      if (neighborPal?.isLiquid) return false;
      return true;
    };

    for (const [groupKey, voxelList] of blocksByGroup.entries()) {
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let vertOffset = 0;

      for (const b of voxelList) {
        const cx = b.x * voxelSize;
        const cy = b.y * voxelSize;
        const cz = b.z * voxelSize;

        const pal = paletteMap.get(b.paletteId);
        const tile = pal?.atlasTile;
        const u0 = tile ? tile.uMin : 0.0;
        const u1 = tile ? tile.uMax : 1.0;
        const v0 = tile ? tile.vMin : 0.0;
        const v1 = tile ? tile.vMax : 1.0;

        // +X Face (Right)
        if (!isSolid(b.x + 1, b.y, b.z)) {
          positions.push(
            cx + half, cy - half, cz - half,
            cx + half, cy + half, cz - half,
            cx + half, cy + half, cz + half,
            cx + half, cy - half, cz + half
          );
          normals.push(
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0
          );
          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }

        // -X Face (Left)
        if (!isSolid(b.x - 1, b.y, b.z)) {
          positions.push(
            cx - half, cy - half, cz + half,
            cx - half, cy + half, cz + half,
            cx - half, cy + half, cz - half,
            cx - half, cy - half, cz - half
          );
          normals.push(
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0
          );
          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }

        // +Y Face (Top)
        if (!isSolid(b.x, b.y + 1, b.z)) {
          positions.push(
            cx - half, cy + half, cz - half,
            cx - half, cy + half, cz + half,
            cx + half, cy + half, cz + half,
            cx + half, cy + half, cz - half
          );
          normals.push(
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0
          );
          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }

        // -Y Face (Bottom)
        if (!isSolid(b.x, b.y - 1, b.z)) {
          positions.push(
            cx - half, cy - half, cz + half,
            cx - half, cy - half, cz - half,
            cx + half, cy - half, cz - half,
            cx + half, cy - half, cz + half
          );
          normals.push(
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0
          );
          uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }

        // +Z Face (Front)
        if (!isSolid(b.x, b.y, b.z + 1)) {
          positions.push(
            cx - half, cy - half, cz + half,
            cx + half, cy - half, cz + half,
            cx + half, cy + half, cz + half,
            cx - half, cy + half, cz + half
          );
          normals.push(
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1
          );
          uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }

        // -Z Face (Back)
        if (!isSolid(b.x, b.y, b.z - 1)) {
          positions.push(
            cx + half, cy - half, cz - half,
            cx - half, cy - half, cz - half,
            cx - half, cy + half, cz - half,
            cx + half, cy + half, cz - half
          );
          normals.push(
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1
          );
          uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
          indices.push(vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3);
          vertOffset += 4;
        }
      }

      if (indices.length === 0) continue;

      const subMesh = new Mesh(`${meshName}_part_${groupKey}`, scene);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.normals = normals;
      vertexData.uvs = uvs;
      vertexData.indices = indices;
      vertexData.applyToMesh(subMesh);

      // Assign Material
      const samplePal = paletteMap.get(voxelList[0].paletteId);
      if (groupKey.startsWith('atlas_') && options.atlas) {
        const mat = new PBRMaterial(`mat_${options.atlas.name}`, scene);
        mat.albedoTexture = options.atlas.texture;
        mat.roughness = 0.6;
        mat.metallic = 0.1;
        mat.backFaceCulling = false;
        subMesh.material = mat;
      } else {
        const mat = new PBRMaterial(`mat_${meshName}_${groupKey.replace(/[^a-zA-Z0-9_]/g, '_')}`, scene);
        if (samplePal?.texture) {
          mat.albedoTexture = samplePal.texture;
        } else if (samplePal?.textureUrl) {
          mat.albedoTexture = new Texture(samplePal.textureUrl, scene);
        } else if (samplePal?.color) {
          mat.albedoColor = Color3.FromHexString(samplePal.color);
        } else {
          mat.albedoColor = new Color3(0.6, 0.6, 0.6);
        }
        mat.roughness = 0.55;
        mat.metallic = 0.1;
        mat.backFaceCulling = false;
        subMesh.material = mat;
      }

      createdSubMeshes.push(subMesh);
    }

    if (createdSubMeshes.length === 0) return null;

    let finalMesh: Mesh;
    if (createdSubMeshes.length === 1) {
      finalMesh = createdSubMeshes[0];
      finalMesh.name = meshName;
    } else {
      const merged = Mesh.MergeMeshes(createdSubMeshes, true, true, undefined, false, true);
      if (!merged) return null;
      merged.name = meshName;
      finalMesh = merged;
    }

    finalMesh.isPickable = true;
    finalMesh.computeWorldMatrix(true);
    finalMesh.refreshBoundingInfo();

    return finalMesh;
  }
}

