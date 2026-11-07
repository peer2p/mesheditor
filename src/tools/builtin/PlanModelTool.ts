import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export interface PlannedPartSpec {
  name: string;
  tier?: 'primary' | 'secondary' | 'tertiary';
  dimensions?: { width?: number; height?: number; depth?: number };
  yRange?: [number, number];
  targetPolygons?: number;
  recommendedTool?: string;
}

export class PlanModelTool extends AbstractTool {
  public readonly name = 'modeler_plan_model';
  public readonly description =
    'Validates a structural and proportional 3D blueprint BEFORE creating geometry. Checks part hierarchy (primary vs secondary vs tertiary volumes), enforces proportional polygon budget allocation (preventing tiny parts like eyes or bolts from having more polygons than the torso or main body), verifies vertical contact/adjacency, and recommends the optimal modeling tools and segment counts.';

  public readonly parameters = {
    type: 'object',
    properties: {
      assetName: { type: 'string', description: 'Name of the overall 3D asset being planned.' },
      category: {
        type: 'string',
        enum: ['character', 'creature', 'architecture', 'hard_surface', 'organic_prop'],
        description: 'Asset category.',
      },
      totalHeight: {
        type: 'number',
        description: 'Total target height in meters (e.g. 1.8 for human, 1.2 for chibi, 6.0 for building).',
      },
      parts: {
        type: 'array',
        description: 'List of planned structural components with hierarchy tier, dimensions, vertical range, and polygon budget.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Component name (e.g. "torso", "head", "eye_left", "facade_wall").' },
            tier: {
              type: 'string',
              enum: ['primary', 'secondary', 'tertiary'],
              description:
                '"primary" (50-65% of budget: torso, head, main walls, roof), "secondary" (25-35% of budget: limbs, columns, arches, stairs), or "tertiary" (5-15% of budget: eyes, buttons, rivets, small trim).',
            },
            dimensions: {
              type: 'object',
              description: 'Approximate bounding size { width, height, depth } in meters.',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
                depth: { type: 'number' },
              },
            },
            yRange: {
              type: 'array',
              items: { type: 'number' },
              description: 'Vertical span [yMin, yMax] in meters to verify parts connect without floating.',
            },
            targetPolygons: {
              type: 'integer',
              description: 'Planned triangle count for this component.',
            },
            recommendedTool: {
              type: 'string',
              description: 'Tool planned to create this component (e.g. "modeler_create_sdf_mesh", "modeler_create_wall").',
            },
          },
          required: ['name', 'tier'],
        },
      },
    },
    required: ['assetName', 'category', 'parts'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const minBudget = context.aiAgent?.config?.minPolygons ?? 200;
    const maxBudget = context.aiAgent?.config?.maxPolygons ?? 5000;
    const targetMidBudget = Math.min(maxBudget, Math.max(minBudget, Math.round(maxBudget * 0.75)));

    const rawParts: PlannedPartSpec[] = Array.isArray(args.parts) ? args.parts : [];
    if (rawParts.length === 0) {
      throw new Error('modeler_plan_model requires a non-empty "parts" array.');
    }

    const warnings: string[] = [];
    const primaryParts = rawParts.filter((p) => (p.tier || 'primary') === 'primary');
    const secondaryParts = rawParts.filter((p) => p.tier === 'secondary');
    const tertiaryParts = rawParts.filter((p) => p.tier === 'tertiary');

    const primaryPool = Math.round(targetMidBudget * 0.6);
    const secondaryPool = Math.round(targetMidBudget * 0.28);
    const tertiaryPool = Math.round(targetMidBudget * 0.12);

    let minPrimaryPolys = Infinity;
    for (const p of primaryParts) {
      if (typeof p.targetPolygons === 'number' && p.targetPolygons > 0) {
        minPrimaryPolys = Math.min(minPrimaryPolys, p.targetPolygons);
      }
    }

    const allocatedParts = rawParts.map((p) => {
      const tier = p.tier || 'primary';
      const w = Number(p.dimensions?.width ?? 0.5);
      const h = Number(p.dimensions?.height ?? 0.5);
      const d = Number(p.dimensions?.depth ?? 0.5);
      const maxDim = Math.max(w, h, d);

      let defaultShare = 200;
      if (tier === 'primary') {
        defaultShare = Math.max(120, Math.round(primaryPool / Math.max(1, primaryParts.length)));
      } else if (tier === 'secondary') {
        defaultShare = Math.max(60, Math.round(secondaryPool / Math.max(1, secondaryParts.length)));
      } else {
        defaultShare = Math.max(24, Math.min(180, Math.round(tertiaryPool / Math.max(1, tertiaryParts.length))));
      }

      let recommendedPolygons = typeof p.targetPolygons === 'number' ? p.targetPolygons : defaultShare;

      if (tier === 'tertiary' && Number.isFinite(minPrimaryPolys) && recommendedPolygons >= minPrimaryPolys) {
        warnings.push(
          `Proportion error: Tertiary detail "${p.name}" (${recommendedPolygons} tris) had >= polygons than a primary volume (${minPrimaryPolys} tris). Clamped to ${defaultShare} tris.`
        );
        recommendedPolygons = Math.min(defaultShare, Math.max(32, Math.floor(minPrimaryPolys * 0.25)));
      }

      // Compute recommended sphere/cylinder segments for this size and tier
      let recommendedSegments = 16;
      if (tier === 'tertiary' || maxDim <= 0.12) {
        recommendedSegments = 8;
      } else if (tier === 'secondary' || maxDim <= 0.4) {
        recommendedSegments = 12;
      } else {
        recommendedSegments = 20;
      }

      return {
        name: p.name,
        tier,
        dimensions: { width: w, height: h, depth: d },
        yRange: p.yRange || null,
        recommendedPolygons,
        recommendedSegments,
        recommendedTool: p.recommendedTool || null,
      };
    });

    // Check vertical continuity across yRange intervals if provided
    const intervals = allocatedParts
      .map((p) => p.yRange)
      .filter((r): r is [number, number] => Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]))
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    if (intervals.length > 0) {
      if (intervals[0][0] > 0.08) {
        warnings.push(
          `Grounding warning: Lowest planned part starts at Y = ${intervals[0][0].toFixed(2)}m instead of resting on ground Y = 0.`
        );
      }
      let currentMaxY = intervals[0][1];
      for (let i = 1; i < intervals.length; i++) {
        const [y0, y1] = intervals[i];
        if (y0 > currentMaxY + 0.05) {
          warnings.push(
            `Floating gap warning: Vertical gap detected between Y = ${currentMaxY.toFixed(2)}m and Y = ${y0.toFixed(2)}m. Ensure parts overlap slightly.`
          );
        }
        currentMaxY = Math.max(currentMaxY, y1);
      }
    }

    const totalPlannedPolygons = allocatedParts.reduce((sum, p) => sum + p.recommendedPolygons, 0);
    if (totalPlannedPolygons > maxBudget) {
      warnings.push(
        `Budget warning: Total planned polygons (${totalPlannedPolygons}) exceeds maximum budget (${maxBudget}). Scale down segments or call modeler_retopologize_mesh.`
      );
    }

    return JSON.stringify({
      status: 'ok',
      assetName: args.assetName,
      category: args.category,
      budgetRange: { minPolygons: minBudget, maxPolygons: maxBudget },
      totalPlannedPolygons,
      parts: allocatedParts,
      warnings,
    });
  }
}

