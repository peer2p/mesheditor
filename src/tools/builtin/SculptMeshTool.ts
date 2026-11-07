import { Mesh, Vector3, VertexBuffer } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export interface SculptStrokeVec3 {
  x: number;
  y: number;
  z: number;
}

export interface SculptStrokeItem {
  x?: number;
  y?: number;
  z?: number;
  from?: SculptStrokeVec3 | [number, number, number];
  to?: SculptStrokeVec3 | [number, number, number];
  delta?: SculptStrokeVec3 | [number, number, number];
  normal?: SculptStrokeVec3 | [number, number, number];
  steps?: number;
  radius?: number;
  strength?: number;
  invert?: boolean;
}

function parseStrokeVec(v: any): Vector3 | null {
  if (Array.isArray(v) && v.length >= 3) {
    const x = Number(v[0]);
    const y = Number(v[1]);
    const z = Number(v[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return new Vector3(x, y, z);
    }
  }
  if (v && typeof v === 'object') {
    const x = Number(v.x);
    const y = Number(v.y);
    const z = Number(v.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return new Vector3(x, y, z);
    }
  }
  return null;
}

/**
 * Estimates the outward world-space surface normal on `mesh` nearest to `worldPt`.
 */
function estimateSurfaceNormal(mesh: Mesh, worldPt: Vector3): Vector3 {
  mesh.computeWorldMatrix(true);
  const bb = mesh.getBoundingInfo()?.boundingBox;
  const center = bb?.centerWorld || mesh.position;

  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (positions && normals && positions.length >= 3) {
    const invWorld = mesh.getWorldMatrix().clone().invert();
    const localPt = Vector3.TransformCoordinates(worldPt, invWorld);
    let bestDistSq = Infinity;
    let bestIdx = 0;
    const step = positions.length > 6000 ? 6 : 3;
    for (let i = 0; i < positions.length; i += step) {
      const dx = positions[i] - localPt.x;
      const dy = positions[i + 1] - localPt.y;
      const dz = positions[i + 2] - localPt.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
    const localNorm = new Vector3(
      normals[bestIdx] || 0,
      normals[bestIdx + 1] || 1,
      normals[bestIdx + 2] || 0
    );
    const worldNorm = Vector3.TransformNormal(localNorm, mesh.getWorldMatrix());
    if (worldNorm.lengthSquared() > 1e-6) {
      return worldNorm.normalize();
    }
  }

  const radial = worldPt.subtract(center);
  if (radial.lengthSquared() > 1e-6) {
    return radial.normalize();
  }
  return Vector3.Up();
}

export class SculptMeshTool extends AbstractTool {
  public readonly name = 'modeler_sculpt_mesh';
  public readonly description =
    'Applies digital clay sculpting brush deformations ("clay", "grab", "inflate", "pinch", "flatten", "smooth") to a 3D mesh (such as a clay sphere spawned via modeler_spawn_base_mesh with type="sculpt_sphere", an SDF mesh, or any character/prop mesh). Supports both single contact points (x,y,z) and continuous directional stroke paths (from -> to or delta) for pulling out volumes, sculpting muscles, carving eye sockets, flattening planes, and smoothing seams.';

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
          'Sculpting brush mode: "clay" (builds up or carves clay strips along surface normals), "grab" (pulls/drags a region of clay from "from" to "to" or by "delta" to shape silhouettes, jaws, noses, limbs, or horns), "inflate" (expands/deflates volume along vertex normals), "pinch" (sharpens creases, lips, eyelids, or edges), "flatten" (planes off anatomical/architectural surfaces), or "smooth" (relaxes surface bumps). Default: "clay".',
      },
      strokes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'Contact point X (or start X if delta/to is used).' },
            y: { type: 'number', description: 'Contact point Y (or start Y if delta/to is used).' },
            z: { type: 'number', description: 'Contact point Z (or start Z if delta/to is used).' },
            from: {
              type: 'object',
              description: 'Optional start point { x, y, z } for a continuous brush drag or grab stroke.',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            to: {
              type: 'object',
              description: 'Optional end point { x, y, z } for a continuous brush drag or grab stroke.',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            delta: {
              type: 'object',
              description: 'Optional displacement vector { x, y, z } added to (x,y,z) or "from" (especially useful for "grab" brush).',
              properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
            },
            steps: {
              type: 'integer',
              minimum: 1,
              maximum: 32,
              description: 'Interpolation steps along a from->to stroke path (default: 8).',
            },
            radius: { type: 'number', description: 'Brush influence radius in meters (default: 0.35).' },
            strength: { type: 'number', description: 'Deformation strength from 0.05 to 1.0 (default: 0.55).' },
            invert: {
              type: 'boolean',
              description: 'Invert brush direction (e.g. carve inward / excavate eye sockets instead of building outward).',
            },
          },
        },
        description:
          'Array of 3D brush strokes. Each stroke can specify a point {x, y, z} or a continuous path {from: {x,y,z}, to: {x,y,z}}.',
      },
      symmetryX: {
        type: 'boolean',
        description: 'Mirror strokes across the X = 0 symmetry plane (default: true).',
      },
      subdivideIfCoarse: {
        type: 'boolean',
        description:
          'Automatically subdivide the target mesh before sculpting if it has fewer than 600 vertices so clay strokes deform smoothly (default: true).',
      },
      remeshTargetFaces: {
        type: 'integer',
        minimum: 300,
        maximum: 100000,
        description: 'Optional target triangle count to retopologize/clean up topology after sculpting.',
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

    // Automatically subdivide coarse meshes (such as a basic box or low-segment sphere) so clay brushes have vertices to move
    let autoSubdivided = false;
    if (args.subdivideIfCoarse !== false && mesh.getTotalVertices() < 600) {
      const iters = mesh.getTotalVertices() < 150 ? 2 : 1;
      for (let i = 0; i < iters; i++) {
        context.service.subdivideMesh(mesh);
      }
      autoSubdivided = true;
    }

    const brush = String(args.brush || 'clay').toLowerCase() as any;
    const strokes: SculptStrokeItem[] = Array.isArray(args.strokes) ? args.strokes : [];
    const symmetryX = args.symmetryX !== false;

    const prevBrush = sculptCtrl.brushType;
    const prevRadius = sculptCtrl.radius;
    const prevStrength = sculptCtrl.strength;
    const prevSymmetry = sculptCtrl.symmetryX;
    const prevInvert = sculptCtrl.invert;

    sculptCtrl.brushType = brush;
    sculptCtrl.symmetryX = symmetryX;

    let appliedCount = 0;
    let totalSamples = 0;
    try {
      for (const stroke of strokes) {
        const startPt =
          parseStrokeVec(stroke.from) ||
          (typeof stroke.x === 'number' && typeof stroke.y === 'number' && typeof stroke.z === 'number'
            ? new Vector3(stroke.x, stroke.y, stroke.z)
            : null);
        if (!startPt) continue;

        const deltaVec = parseStrokeVec(stroke.delta);
        const endPt =
          parseStrokeVec(stroke.to) ||
          (deltaVec ? startPt.add(deltaVec) : null);

        sculptCtrl.radius =
          typeof stroke.radius === 'number' ? Math.max(0.02, stroke.radius) : prevRadius;
        sculptCtrl.strength =
          typeof stroke.strength === 'number' ? Math.max(0.01, stroke.strength) : prevStrength;
        sculptCtrl.invert = !!stroke.invert;

        const explicitNormal = parseStrokeVec(stroke.normal);

        if (endPt && Vector3.DistanceSquared(startPt, endPt) > 1e-6) {
          const steps = Math.max(
            2,
            Math.min(
              32,
              Number(stroke.steps) ||
                Math.ceil(Vector3.Distance(startPt, endPt) / Math.max(0.03, sculptCtrl.radius * 0.35))
            )
          );
          // Reset lastLocalPick at start of path so grab brush drags cleanly along startPt -> endPt
          (sculptCtrl as any).lastLocalPick = null;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const pt = Vector3.Lerp(startPt, endPt, t);
            const norm = explicitNormal || estimateSurfaceNormal(mesh, pt);
            sculptCtrl.applyBrushStroke(mesh, pt, norm);
            totalSamples++;
          }
          (sculptCtrl as any).lastLocalPick = null;
          appliedCount++;
        } else {
          const norm = explicitNormal || estimateSurfaceNormal(mesh, startPt);
          if (brush === 'grab') {
            // If grab was called with a single point and no delta/to, pull slightly along outward normal
            (sculptCtrl as any).lastLocalPick = null;
            const pullDir = norm.scale((sculptCtrl.invert ? -1 : 1) * sculptCtrl.radius * 0.35 * sculptCtrl.strength);
            sculptCtrl.applyBrushStroke(mesh, startPt, norm);
            sculptCtrl.applyBrushStroke(mesh, startPt.add(pullDir), norm);
            (sculptCtrl as any).lastLocalPick = null;
            totalSamples += 2;
          } else {
            sculptCtrl.applyBrushStroke(mesh, startPt, norm);
            totalSamples++;
          }
          appliedCount++;
        }
      }
    } finally {
      sculptCtrl.brushType = prevBrush;
      sculptCtrl.radius = prevRadius;
      sculptCtrl.strength = prevStrength;
      sculptCtrl.symmetryX = prevSymmetry;
      sculptCtrl.invert = prevInvert;
      (sculptCtrl as any).lastLocalPick = null;
    }

    if (
      typeof args.remeshTargetFaces === 'number' &&
      args.remeshTargetFaces >= 300 &&
      Math.floor(mesh.getTotalIndices() / 3) > args.remeshTargetFaces
    ) {
      await sculptCtrl.retopologizeMesh(mesh, Math.round(args.remeshTargetFaces));
    }

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    context.service.updateStats();
    context.service.events.onSceneModified?.();

    const bb = mesh.getBoundingInfo().boundingBox;
    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      brush,
      strokesApplied: appliedCount,
      samplesApplied: totalSamples,
      symmetryX,
      autoSubdivided,
      totalVertices: mesh.getTotalVertices(),
      totalTriangles: Math.floor(mesh.getTotalIndices() / 3),
      totalIndices: mesh.getTotalIndices(),
      bounds: {
        min: {
          x: Number(bb.minimumWorld.x.toFixed(3)),
          y: Number(bb.minimumWorld.y.toFixed(3)),
          z: Number(bb.minimumWorld.z.toFixed(3)),
        },
        max: {
          x: Number(bb.maximumWorld.x.toFixed(3)),
          y: Number(bb.maximumWorld.y.toFixed(3)),
          z: Number(bb.maximumWorld.z.toFixed(3)),
        },
      },
    });
  }
}
