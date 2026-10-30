import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class MergeMeshesTool extends AbstractTool {
  public readonly name = 'modeler_merge_meshes';
  public readonly description =
    'Merges multiple meshes into a single combined mesh while preserving their individual materials as subMeshes.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of the meshes to merge (or ["*"] to merge all scene meshes).',
      },
      newName: { type: 'string', description: 'Name for the merged mesh.' },
      disposeSources: {
        type: 'boolean',
        description: 'Whether to remove the original source meshes after merging (default true).',
      },
    },
    required: ['meshNames'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const names: string[] = Array.isArray(args.meshNames) ? args.meshNames : [];
    const disposeSources = args.disposeSources !== false;

    const meshesToMerge =
      names.includes('*')
        ? context.service.importedMeshes.filter(
            (m) => !context.service.isEditorHelper(m) && !m.isDisposed() && m.getTotalVertices() > 0
          )
        : names
            .map((n) => context.findMeshByNameOrId(n))
            .filter((m): m is Mesh => !!m && m.getTotalVertices() > 0);

    if (meshesToMerge.length < 2) {
      throw new Error('At least 2 valid meshes are required to merge.');
    }

    for (const m of meshesToMerge) {
      m.computeWorldMatrix(true);
    }

    const merged = Mesh.MergeMeshes(meshesToMerge, disposeSources, true, undefined, false, true);
    if (!merged) {
      throw new Error('Mesh.MergeMeshes failed.');
    }

    merged.name = (args.newName || `${meshesToMerge[0].name}_merged`).replace(/\s+/g, '_');
    if (disposeSources) {
      for (const m of meshesToMerge) {
        const idx = context.service.importedMeshes.indexOf(m);
        if (idx !== -1) context.service.importedMeshes.splice(idx, 1);
      }
    }
    context.registerCreatedMesh(merged);
    context.service.centerMeshPivot(merged);

    return JSON.stringify({
      status: 'ok',
      mergedMeshName: merged.name,
      vertices: merged.getTotalVertices(),
    });
  }
}

