import { Mesh, Vector3 } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CloneArrayTool extends AbstractTool {
  public readonly name = 'modeler_clone_array';
  public readonly description =
    'Clones an existing mesh in a linear or radial array pattern (e.g. pillars, gear teeth, stairs, fence posts, windows) and optionally merges them.';

  public readonly parameters = {
    type: 'object',
    properties: {
      sourceMeshName: { type: 'string', description: 'Name of the mesh to clone.' },
      mode: { type: 'string', enum: ['linear', 'radial'], description: 'Array pattern mode.' },
      count: { type: 'number', description: 'Total number of items in the array (2 to 64).' },
      offset: {
        type: 'object',
        description: 'For linear mode: step offset { x, y, z } between each clone.',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      radius: {
        type: 'number',
        description: 'For radial mode: distance from center in the XZ plane.',
      },
      center: {
        type: 'object',
        description: 'For radial mode: center point { x, y, z } (default {0,0,0}).',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      arcDegrees: {
        type: 'number',
        description: 'For radial mode: total angle span in degrees (default 360).',
      },
      rotateWithAngle: {
        type: 'boolean',
        description: 'For radial mode: rotate each clone around Y to face outward/inward (default true).',
      },
      mergeResult: {
        type: 'boolean',
        description: 'If true, merges all clones (and source) into a single mesh.',
      },
      mergedName: { type: 'string' },
    },
    required: ['sourceMeshName', 'mode', 'count'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const source = context.findMeshByNameOrId(args.sourceMeshName);
    if (!source) {
      throw new Error(`Source mesh "${args.sourceMeshName}" not found.`);
    }
    const count = Math.max(2, Math.min(64, Math.round(Number(args.count) || 2)));
    const mode = args.mode === 'radial' ? 'radial' : 'linear';
    const createdClones: Mesh[] = [source];

    if (mode === 'linear') {
      const offVec = this.parseVec3(args.offset, 0);
      const ox = offVec.x;
      const oy = offVec.y;
      const oz = offVec.z;

      for (let i = 1; i < count; i++) {
        const clone = source.clone(`${source.name}_arr_${i}`, source.parent);
        if (clone) {
          clone.position.set(
            source.position.x + ox * i,
            source.position.y + oy * i,
            source.position.z + oz * i
          );
          context.registerCreatedMesh(clone);
          createdClones.push(clone);
        }
      }
    } else {
      const radius = args.radius !== undefined ? Number(args.radius) : 2.0;
      const centerVec = args.center ? this.parseVec3(args.center, 0) : new Vector3(0, source.position.y, 0);
      const cx = centerVec.x;
      const cy = centerVec.y;
      const cz = centerVec.z;
      const totalDeg = Number(args.arcDegrees) || 360;
      const rotateWithAngle = args.rotateWithAngle !== false;

      // Position source at index 0 on the circle
      source.position.set(cx + radius, cy, cz);
      if (rotateWithAngle) {
        source.rotationQuaternion = null;
        source.rotation.y = 0;
      }
      source.computeWorldMatrix(true);

      for (let i = 1; i < count; i++) {
        const angleRad = (((totalDeg / count) * i) * Math.PI) / 180;
        const clone = source.clone(`${source.name}_rad_${i}`, source.parent);
        if (clone) {
          clone.position.set(cx + Math.cos(angleRad) * radius, cy, cz + Math.sin(angleRad) * radius);
          if (rotateWithAngle) {
            clone.rotationQuaternion = null;
            clone.rotation.y = -angleRad;
          }
          context.registerCreatedMesh(clone);
          createdClones.push(clone);
        }
      }
    }

    if (args.mergeResult && createdClones.length > 1) {
      const merged = Mesh.MergeMeshes(createdClones, true, true, undefined, false, true);
      if (merged) {
        merged.name = (args.mergedName || args.newName || `${source.name}_array`).replace(/\s+/g, '_');
        for (const c of createdClones) {
          const idx = context.service.importedMeshes.indexOf(c);
          if (idx !== -1) context.service.importedMeshes.splice(idx, 1);
        }
        context.registerCreatedMesh(merged);
        return JSON.stringify({
          status: 'ok',
          mergedMeshName: merged.name,
          count,
        });
      }
    }

    return JSON.stringify({
      status: 'ok',
      createdMeshes: createdClones.map((m) => m.name),
    });
  }
}

