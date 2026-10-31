import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class VoxelPainterTool extends AbstractTool {
  public readonly name = 'modeler_paint_voxels';
  public readonly description =
    'Interactively adds, paints, or erases voxel blocks, or loads RLE voxel level data with palette or texture atlas support, and bakes them into an optimized 3D scene mesh.';

  public readonly parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['paint', 'erase', 'clear', 'load_data', 'bake_mesh', 'use_atlas', 'get_state'],
        description: 'Voxel operation to perform.',
      },
      voxels: {
        type: 'array',
        description: 'Array of voxel coordinates { x, y, z, paletteId? } to paint or erase.',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
            paletteId: { type: 'string' },
          },
          required: ['x', 'y', 'z'],
        },
      },
      paletteId: {
        type: 'string',
        description: 'Palette ID (e.g. "stone", "dirt", "grass", "wood", or an atlas tile ID) to paint with.',
      },
      atlasId: {
        type: 'string',
        description: 'Optional TextureAtlas ID to activate for voxel painting.',
      },
      voxelSize: {
        type: 'number',
        description: 'Size of each voxel block (default 1.0).',
      },
      meshName: {
        type: 'string',
        description: 'Name for the baked mesh when action is "bake_mesh".',
      },
      rleData: {
        type: 'object',
        description: 'Platformia3D compatible RLE voxel data { version: 1, palette: [...], runs: [...] }.',
      },
    },
    required: ['action'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const painter = context.service.voxelPainter;
    const action = String(args.action || 'get_state').toLowerCase();

    if (args.voxelSize !== undefined) {
      painter.setVoxelSize(Number(args.voxelSize));
    }
    if (args.paletteId) {
      painter.setPaletteItem(String(args.paletteId));
    }
    if (args.atlasId !== undefined) {
      painter.useTextureAtlas(args.atlasId ? String(args.atlasId) : null);
    }

    switch (action) {
      case 'paint': {
        const voxels = Array.isArray(args.voxels) ? args.voxels : [];
        let count = 0;
        for (const v of voxels) {
          const key = `${v.x},${v.y},${v.z}`;
          painter.blocks.set(key, {
            x: Math.round(Number(v.x) || 0),
            y: Math.round(Number(v.y) || 0),
            z: Math.round(Number(v.z) || 0),
            paletteId: String(v.paletteId || args.paletteId || painter.currentPaletteId),
          });
          count++;
        }
        painter.updateThinInstances();
        return JSON.stringify({
          status: 'ok',
          action: 'paint',
          paintedCount: count,
          totalBlocks: painter.blocks.size,
        });
      }

      case 'erase': {
        const voxels = Array.isArray(args.voxels) ? args.voxels : [];
        let count = 0;
        for (const v of voxels) {
          const key = `${v.x},${v.y},${v.z}`;
          if (painter.blocks.delete(key)) {
            count++;
          }
        }
        painter.updateThinInstances();
        return JSON.stringify({
          status: 'ok',
          action: 'erase',
          erasedCount: count,
          totalBlocks: painter.blocks.size,
        });
      }

      case 'clear': {
        painter.clear();
        return JSON.stringify({
          status: 'ok',
          action: 'clear',
          totalBlocks: 0,
        });
      }

      case 'load_data': {
        const data = args.rleData || args;
        const total = painter.loadVoxelData(data);
        return JSON.stringify({
          status: 'ok',
          action: 'load_data',
          totalBlocks: total,
        });
      }

      case 'bake':
      case 'bake_mesh': {
        const name = String(args.meshName || 'Voxel_Model');
        const mesh = painter.bakeToMesh(name);
        if (!mesh) {
          throw new Error('Failed to bake voxel model into scene mesh.');
        }
        return JSON.stringify({
          status: 'ok',
          action: 'bake_mesh',
          meshName: mesh.name,
          vertices: mesh.getTotalVertices(),
        });
      }

      case 'use_atlas': {
        painter.useTextureAtlas(args.atlasId ? String(args.atlasId) : null);
        return JSON.stringify({
          status: 'ok',
          action: 'use_atlas',
          currentAtlasId: painter.currentAtlasId,
        });
      }

      case 'get_state':
      default: {
        return JSON.stringify({
          status: 'ok',
          totalBlocks: painter.blocks.size,
          voxelSize: painter.voxelSize,
          currentPaletteId: painter.currentPaletteId,
          currentAtlasId: painter.currentAtlasId,
          palette: Array.from(painter.palette.keys()),
        });
      }
    }
  }
}
