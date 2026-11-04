import { Nullable, Vector3, Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export interface SculptStrokeItem {
  x: number;
  y: number;
  z: number;
  radius?: number;
  strength?: number;
  invert?: boolean;
}

export class SculptMeshTool extends AbstractTool {
  public readonly name = 'modeler_sculpt_mesh';
  public readonly description =
    'Applies digital sculpting brush deformations (clay, grab, smooth, flatten, inflate, pinch) to organic character or prop meshes, with support for radius, strength, invert, and X-axis symmetry.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the mesh in the scene to sculpt.',
      },
      brush: {
        type: 'string',
        enum: ['clay', 'grab', 'smooth', 'flatten', 'inflate', 'pinch'],
        description:
          'Sculpting brush mode: "clay" (add/carve surface mass along normals), "grab" (pull volume in drag direction), "smooth" (Laplacian smoothing to relax creases/wrinkles), "flatten" (plane bone and facial landmarks), "inflate" (expand/contract volume), or "pinch" (creases). Default: "clay".',
      },
      strokes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'Contact point X.' },
            y: { type: 'number', description: 'Contact point Y.' },
            z: { type: 'number', description: 'Contact point Z.' },
            radius: { type: 'number', description: 'Brush influence radius (default: 0.35).' },
            strength: { type: 'number', description: 'Deformation strength (default: 0.50).' },
            invert: { type: 'boolean', description: 'Invert direction (e.g. carve inward instead of pull outward).' },
          },
          required: ['x', 'y', 'z'],
        },
        description: 'Array of 3D contact points where the sculpt brush is applied.',
      },
      symmetryX: {
        type: 'boolean',
        description: 'Whether to mirror strokes across X = 0 center plane (default: true for characters).',
      },
    },
    required: ['meshName', 'strokes'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const meshName = String(args.meshName || '').trim();
    const mesh = context.findMeshByNameOrId(meshName);
    if (!mesh || !(mesh instanceof Mesh)) {
      throw new Error(`Mesh "${meshName}" not found in scene.`);
    }

    const sculptCtrl = context.service.sculptController;
    if (!sculptCtrl) {
      throw new Error('SculptController is not available on MeshEditorService.');
    }

    const brush = String(args.brush || 'clay').toLowerCase() as any;
    const strokes: SculptStrokeItem[] = Array.isArray(args.strokes) ? args.strokes : [];
    const symmetryX = args.symmetryX !== false;

    // Save previous controller settings to restore afterwards
    const prevBrush = sculptCtrl.brushType;
    const prevRadius = sculptCtrl.radius;
    const prevStrength = sculptCtrl.strength;
    const prevSymmetry = sculptCtrl.symmetryX;
    const prevInvert = sculptCtrl.invert;

    sculptCtrl.brushType = brush;
    sculptCtrl.symmetryX = symmetryX;

    let appliedCount = 0;
    try {
      for (const stroke of strokes) {
        if (typeof stroke.x !== 'number' || typeof stroke.y !== 'number' || typeof stroke.z !== 'number') {
          continue;
        }
        sculptCtrl.radius = typeof stroke.radius === 'number' ? Math.max(0.02, stroke.radius) : prevRadius;
        sculptCtrl.strength = typeof stroke.strength === 'number' ? Math.max(0.01, stroke.strength) : prevStrength;
        sculptCtrl.invert = !!stroke.invert;

        const hitPos = new Vector3(stroke.x, stroke.y, stroke.z);
        sculptCtrl.applyBrushStroke(mesh, hitPos, null);
        appliedCount++;
      }
    } finally {
      sculptCtrl.brushType = prevBrush;
      sculptCtrl.radius = prevRadius;
      sculptCtrl.strength = prevStrength;
      sculptCtrl.symmetryX = prevSymmetry;
      sculptCtrl.invert = prevInvert;
    }

    mesh.refreshBoundingInfo();
    context.service.updateStats();
    context.service.events.onSceneModified?.();

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      brush,
      strokesApplied: appliedCount,
      symmetryX,
      totalVertices: mesh.getTotalVertices(),
      totalIndices: mesh.getTotalIndices(),
    });
  }
}

