import { Mesh, MeshBuilder } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class BuildVoxelMeshTool extends AbstractTool {
  public readonly name = 'modeler_build_voxel_mesh';
  public readonly description =
    'Builds a 3D voxel model from a material palette, box regions, and/or individual voxel coordinates, automatically merging blocks by material.';

  public readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the resulting voxel mesh.' },
      voxelSize: { type: 'number', description: 'World size of 1 voxel cube (default 0.5).' },
      palette: {
        type: 'object',
        description:
          'Map of paletteKey -> { color: "#hex", roughness?: number, metallic?: number } (e.g. { "stone": { "color": "#888888" } }).',
      },
      boxes: {
        type: 'array',
        description:
          'Filled rectangular box regions of voxels: { minX, minY, minZ, maxX, maxY, maxZ, paletteKey }.',
        items: {
          type: 'object',
          properties: {
            minX: { type: 'number' },
            minY: { type: 'number' },
            minZ: { type: 'number' },
            maxX: { type: 'number' },
            maxY: { type: 'number' },
            maxZ: { type: 'number' },
            paletteKey: { type: 'string' },
          },
          required: ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ', 'paletteKey'],
        },
      },
      voxels: {
        type: 'array',
        description: 'Individual voxel coordinates: { x, y, z, paletteKey }.',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
            paletteKey: { type: 'string' },
          },
          required: ['x', 'y', 'z', 'paletteKey'],
        },
      },
    },
    required: ['name', 'palette'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const meshName = (args.name || 'voxel_model').replace(/\s+/g, '_');
    const voxelSize = Math.max(0.05, Number(args.voxelSize) || 0.5);
    const paletteObj: Record<string, { color: string; roughness?: number; metallic?: number }> =
      args.palette || { default: { color: '#58a6ff' } };

    // Map coordinate "x,y,z" -> paletteKey so overlapping definitions overwrite cleanly
    const grid = new Map<string, string>();

    if (Array.isArray(args.boxes)) {
      for (const b of args.boxes) {
        const sVec = b.start ? this.parseVec3(b.start, 0) : null;
        const eVec = b.end ? this.parseVec3(b.end, 0) : null;
        const x1 = sVec ? sVec.x : Number(b.minX) || 0;
        const x2 = eVec ? eVec.x : Number(b.maxX) || 0;
        const y1 = sVec ? sVec.y : Number(b.minY) || 0;
        const y2 = eVec ? eVec.y : Number(b.maxY) || 0;
        const z1 = sVec ? sVec.z : Number(b.minZ) || 0;
        const z2 = eVec ? eVec.z : Number(b.maxZ) || 0;

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2);
        const maxZ = Math.max(z1, z2);
        const key = String(b.paletteKey || b.type || Object.keys(paletteObj)[0] || 'default');

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (grid.size > 15000) break;
              grid.set(`${x},${y},${z}`, key);
            }
          }
        }
      }
    }

    if (Array.isArray(args.voxels)) {
      for (const v of args.voxels) {
        if (grid.size > 15000) break;
        const x = Math.round(Number(v.x ?? v.pos?.[0]) || 0);
        const y = Math.round(Number(v.y ?? v.pos?.[1]) || 0);
        const z = Math.round(Number(v.z ?? v.pos?.[2]) || 0);
        const key = String(v.paletteKey || v.type || Object.keys(paletteObj)[0] || 'default');
        grid.set(`${x},${y},${z}`, key);
      }
    }

    if (grid.size === 0) {
      throw new Error('No voxels or box regions provided for modeler_build_voxel_mesh.');
    }

    // Group voxel meshes by paletteKey
    const byPalette = new Map<string, Array<[number, number, number]>>();
    let culledInteriorVoxels = 0;
    for (const [coord, palKey] of grid.entries()) {
      // Cull completely interior hidden voxels that have all 6 neighbors occupied
      const [x, y, z] = coord.split(',').map(Number);
      const isInterior =
        grid.has(`${x + 1},${y},${z}`) &&
        grid.has(`${x - 1},${y},${z}`) &&
        grid.has(`${x},${y + 1},${z}`) &&
        grid.has(`${x},${y - 1},${z}`) &&
        grid.has(`${x},${y},${z + 1}`) &&
        grid.has(`${x},${y},${z - 1}`);
      if (isInterior) {
        culledInteriorVoxels++;
        continue;
      }

      let list = byPalette.get(palKey);
      if (!list) {
        list = [];
        byPalette.set(palKey, list);
      }
      list.push([x, y, z]);
    }

    const paletteMeshes: Mesh[] = [];
    for (const [palKey, coords] of byPalette.entries()) {
      const palDef = paletteObj[palKey] || { color: '#58a6ff' };
      const mat = context.getOrCreateMaterial(
        `vox_${meshName}_${palKey}`,
        palDef.color,
        palDef.roughness ?? 0.65,
        palDef.metallic ?? 0.05
      );

      const cubes: Mesh[] = [];
      for (const [vx, vy, vz] of coords) {
        const c = MeshBuilder.CreateBox('v', { size: voxelSize }, context.scene);
        c.position.set(vx * voxelSize, (vy + 0.5) * voxelSize, vz * voxelSize);
        c.computeWorldMatrix(true);
        cubes.push(c);
      }

      if (cubes.length > 0) {
        const palMerged = Mesh.MergeMeshes(cubes, true, true);
        if (palMerged) {
          palMerged.name = `${meshName}_${palKey}`;
          palMerged.material = mat;
          paletteMeshes.push(palMerged);
        }
      }
    }

    let finalVoxelMesh: Mesh | null = null;
    if (paletteMeshes.length === 1) {
      finalVoxelMesh = paletteMeshes[0];
      finalVoxelMesh.name = meshName;
    } else if (paletteMeshes.length > 1) {
      finalVoxelMesh = Mesh.MergeMeshes(paletteMeshes, true, true, undefined, false, true);
      if (finalVoxelMesh) {
        finalVoxelMesh.name = meshName;
      }
    }

    if (!finalVoxelMesh) {
      throw new Error('Failed to merge voxel geometry.');
    }

    context.registerCreatedMesh(finalVoxelMesh);
    context.service.centerMeshPivot(finalVoxelMesh);
    // Align bottom to Y = 0
    finalVoxelMesh.computeWorldMatrix(true);
    const minY = finalVoxelMesh.getBoundingInfo().boundingBox.minimumWorld.y;
    finalVoxelMesh.position.y -= minY;
    finalVoxelMesh.computeWorldMatrix(true);

    return JSON.stringify({
      status: 'ok',
      meshName: finalVoxelMesh.name,
      voxelCount: grid.size,
      solidVoxels: grid.size - culledInteriorVoxels,
      culledInteriorVoxels,
      vertices: finalVoxelMesh.getTotalVertices(),
    });
  }
}

