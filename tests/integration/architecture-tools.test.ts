import { NullEngine } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorService } from '../../src/MeshEditorService';
import { CreateArchTool } from '../../src/tools/builtin/CreateArchTool';
import { CreateColumnTool } from '../../src/tools/builtin/CreateColumnTool';
import { CreateMoldingTool } from '../../src/tools/builtin/CreateMoldingTool';
import { CreateRoofTool } from '../../src/tools/builtin/CreateRoofTool';
import { CreateRoundedBoxTool } from '../../src/tools/builtin/CreateRoundedBoxTool';
import { CreateStairsTool } from '../../src/tools/builtin/CreateStairsTool';
import { CreateWallTool } from '../../src/tools/builtin/CreateWallTool';
import { PlanModelTool } from '../../src/tools/builtin/PlanModelTool';

describe('Parametric Architecture, Beveled Box & Model Planning Tools', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
  });

  afterEach(() => {
    service.dispose();
    canvas.remove();
  });

  it('builds a beveled rounded box with smooth edge rings via CreateRoundedBoxTool', () => {
    const tool = new CreateRoundedBoxTool();
    const ctx = service.aiAgent.createToolContext();

    const res = JSON.parse(
      tool.execute(
        {
          name: 'Beveled_Pedestal',
          width: 2.0,
          height: 1.0,
          depth: 1.5,
          radius: 0.1,
          segments: 3,
          position: { x: 0, y: 0.5, z: 0 },
        },
        ctx
      )
    );

    expect(res.status).toBe('ok');
    expect(res.meshName).toBe('Beveled_Pedestal');
    expect(res.triangles).toBeGreaterThan(24);
    expect(res.bounds.min.y).toBeCloseTo(0, 2);
    expect(res.bounds.max.y).toBeCloseTo(1.0, 2);
    expect(res.bounds.max.x - res.bounds.min.x).toBeCloseTo(2.0, 2);
  });

  it('builds an architectural wall with door and arched window openings and frames via CreateWallTool', () => {
    const tool = new CreateWallTool();
    const ctx = service.aiAgent.createToolContext();

    const res = JSON.parse(
      tool.execute(
        {
          name: 'Cathedral_Facade',
          width: 6.0,
          height: 4.0,
          thickness: 0.3,
          plinthHeight: 0.25,
          corniceHeight: 0.18,
          openings: [
            { type: 'arch', x: 0, y: 0, width: 1.4, height: 2.4, archRise: 0.7, frame: true },
            { type: 'arch', x: -1.8, y: 1.0, width: 0.9, height: 1.8, archRise: 0.45, frame: true },
            { type: 'round', x: 1.8, y: 1.4, width: 1.0, height: 1.0, frame: true },
          ],
        },
        ctx
      )
    );

    expect(res.status).toBe('ok');
    expect(res.openingsCount).toBe(3);
    expect(res.triangles).toBeGreaterThan(40);
    expect(res.bounds.min.y).toBeCloseTo(0, 2);
    expect(res.bounds.max.y).toBeCloseTo(4.0, 2);
  });

  it('builds Roman round and Gothic pointed arches with piers and keystones via CreateArchTool', () => {
    const tool = new CreateArchTool();
    const ctx = service.aiAgent.createToolContext();

    const gothic = JSON.parse(
      tool.execute(
        {
          name: 'Gothic_Portal',
          style: 'pointed',
          span: 2.4,
          pierHeight: 2.0,
          pierWidth: 0.4,
          rise: 1.6,
          keystone: true,
        },
        ctx
      )
    );

    expect(gothic.status).toBe('ok');
    expect(gothic.style).toBe('pointed');
    expect(gothic.triangles).toBeGreaterThan(30);
    expect(gothic.bounds.min.y).toBeCloseTo(0, 2);
    expect(gothic.bounds.size.y).toBeGreaterThan(3.5);
  });

  it('builds fluted classical columns with entasis and capitals via CreateColumnTool', () => {
    const tool = new CreateColumnTool();
    const ctx = service.aiAgent.createToolContext();

    const ionic = JSON.parse(
      tool.execute(
        {
          name: 'Ionic_Pillar',
          order: 'ionic',
          height: 3.6,
          radius: 0.25,
          flutes: 24,
        },
        ctx
      )
    );

    expect(ionic.status).toBe('ok');
    expect(ionic.order).toBe('ionic');
    expect(ionic.triangles).toBeGreaterThan(200);
    expect(ionic.bounds.min.y).toBeCloseTo(0, 2);
    expect(ionic.bounds.max.y).toBeCloseTo(3.6, 1);
  });

  it('sweeps a mitered cornice molding around a closed rectangular perimeter via CreateMoldingTool', () => {
    const tool = new CreateMoldingTool();
    const ctx = service.aiAgent.createToolContext();

    const molding = JSON.parse(
      tool.execute(
        {
          name: 'Roof_Cornice',
          profile: 'cornice',
          width: 0.2,
          height: 0.22,
          closed: true,
          path: [
            [-2, 3, -2],
            [2, 3, -2],
            [2, 3, 2],
            [-2, 3, 2],
          ],
        },
        ctx
      )
    );

    expect(molding.status).toBe('ok');
    expect(molding.triangles).toBeGreaterThan(20);
    expect(molding.bounds.min.y).toBeCloseTo(3.0, 2);
    expect(molding.bounds.max.y).toBeCloseTo(3.22, 2);
  });

  it('builds straight and spiral staircases with railings via CreateStairsTool and roofs via CreateRoofTool', () => {
    const stairsTool = new CreateStairsTool();
    const roofTool = new CreateRoofTool();
    const ctx = service.aiAgent.createToolContext();

    const stairs = JSON.parse(
      stairsTool.execute(
        {
          name: 'Grand_Stairs',
          style: 'straight',
          steps: 8,
          stepRise: 0.2,
          stepRun: 0.3,
          width: 1.4,
          railing: 'both',
        },
        ctx
      )
    );
    expect(stairs.status).toBe('ok');
    expect(stairs.triangles).toBeGreaterThan(100);
    expect(stairs.bounds.min.y).toBeCloseTo(0, 2);

    const spiral = JSON.parse(
      stairsTool.execute(
        {
          name: 'Tower_Spiral_Stairs',
          style: 'spiral',
          steps: 12,
          stepRise: 0.2,
          width: 1.0,
          railing: 'both',
        },
        ctx
      )
    );
    expect(spiral.status).toBe('ok');
    expect(spiral.triangles).toBeGreaterThan(100);

    const roof = JSON.parse(
      roofTool.execute(
        {
          name: 'Temple_Roof',
          style: 'gable',
          width: 4.0,
          depth: 6.0,
          height: 1.5,
          overhang: 0.3,
          position: { x: 0, y: 3.0, z: 0 },
        },
        ctx
      )
    );
    expect(roof.status).toBe('ok');
    expect(roof.bounds.size.x).toBeGreaterThan(4.4);
    expect(roof.bounds.min.y).toBeLessThanOrEqual(3.1);
  });

  it('validates proportional polygon budget and detects disproportionate tertiary details in PlanModelTool', () => {
    const planTool = new PlanModelTool();
    const ctx = service.aiAgent.createToolContext();

    const res = JSON.parse(
      planTool.execute(
        {
          assetName: 'Hero_Character',
          category: 'character',
          totalHeight: 1.8,
          parts: [
            {
              name: 'Torso',
              tier: 'primary',
              dimensions: { width: 0.4, height: 0.6, depth: 0.28 },
              yRange: [0.9, 1.5],
              targetPolygons: 400,
            },
            {
              name: 'Left_Eye',
              tier: 'tertiary',
              dimensions: { width: 0.03, height: 0.03, depth: 0.03 },
              yRange: [1.62, 1.65],
              targetPolygons: 2700, // Disproportionately higher than Torso!
            },
          ],
        },
        ctx
      )
    );

    expect(res.status).toBe('ok');
    expect(res.warnings.length).toBeGreaterThan(0);
    const eyePart = res.parts.find((p: any) => p.name === 'Left_Eye');
    expect(eyePart.recommendedPolygons).toBeLessThan(400);
    expect(eyePart.recommendedSegments).toBe(8);
  });
});

