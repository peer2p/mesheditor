import { NullEngine, Vector3, VertexBuffer } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorService } from '../../src/MeshEditorService';
import {
  compileSdfParts,
  evaluateSdfScene,
  extractSdfSurfaceNets,
  sdRoundBox,
  sdRoundCone,
  sdSphere,
  smoothMin,
} from '../../src/sdf';
import { CreateSdfMeshTool } from '../../src/tools/builtin/CreateSdfMeshTool';

describe('SDF Smooth Clay / Metaball Modeling Engine & Tool', () => {
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

  it('evaluates exact SDF primitives and smooth polynomial union (smin)', () => {
    expect(sdSphere(0, 0, 0, 1.0)).toBeCloseTo(-1.0, 5);
    expect(sdSphere(1, 0, 0, 1.0)).toBeCloseTo(0.0, 5);
    expect(sdSphere(2, 0, 0, 1.0)).toBeCloseTo(1.0, 5);

    expect(sdRoundBox(0, 0, 0, 1, 1, 1, 0.1)).toBeLessThan(0);
    expect(sdRoundCone(0, 0, 0, 0, -1, 0, 0, 1, 0, 0.5, 0.2)).toBeLessThan(0);

    // Smooth min pulls the seam inward (smaller/more negative distance than sharp min)
    const sharp = Math.min(0.05, 0.05);
    const blended = smoothMin(0.05, 0.05, 0.2);
    expect(blended.dist).toBeLessThan(sharp);
    expect(blended.weightB).toBeCloseTo(0.5, 3);
  });

  it('extracts a watertight, outward-oriented indexed mesh via Surface Nets', () => {
    const parts = compileSdfParts([
      { shape: 'sphere', center: [0, 1, 0], radius: 0.8 },
    ]);
    const res = extractSdfSurfaceNets(parts, { resolution: 28, smoothIterations: 1 });

    const positions = res.vertexData.positions!;
    const normals = res.vertexData.normals!;
    const indices = res.vertexData.indices!;

    expect(positions.length).toBeGreaterThan(300);
    expect(indices.length).toBeGreaterThan(600);
    expect(res.bounds.size.x).toBeGreaterThan(1.45);
    expect(res.bounds.size.x).toBeLessThan(1.75);

    // Check watertightness: every undirected edge is shared by an even number of triangles (2)
    const edgeCounts = new Map<string, number>();
    const addEdge = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    };
    let signedVolume6 = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];
      addEdge(i0, i1);
      addEdge(i1, i2);
      addEdge(i2, i0);

      const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
      const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
      const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];
      signedVolume6 +=
        x0 * (y1 * z2 - z1 * y2) -
        y0 * (x1 * z2 - z1 * x2) +
        z0 * (x1 * y2 - y1 * x2);
    }

    let boundaryEdges = 0;
    for (const c of edgeCounts.values()) {
      if (c !== 2) boundaryEdges++;
    }
    expect(boundaryEdges).toBe(0);
    expect(signedVolume6).toBeGreaterThan(0);

    // Check analytical normals point outward from sphere center (0, 1, 0)
    const vCount = positions.length / 3;
    for (let v = 0; v < vCount; v += 10) {
      const dx = positions[v * 3];
      const dy = positions[v * 3 + 1] - 1.0;
      const dz = positions[v * 3 + 2];
      const nx = normals[v * 3];
      const ny = normals[v * 3 + 1];
      const nz = normals[v * 3 + 2];
      expect(dx * nx + dy * ny + dz * nz).toBeGreaterThan(0.5);
    }
  });

  it('builds a multi-part organic character bust with symmetryX, smooth subtraction, vertex colors, and decimation via CreateSdfMeshTool', async () => {
    const tool = new CreateSdfMeshTool();
    const ctx = service.aiAgent.createToolContext();

    const rawResult = await tool.execute(
      {
        name: 'Clay_Creature_Bust',
        symmetryX: true,
        resolution: 36,
        targetTriangles: 1200,
        parts: [
          {
            shape: 'ellipsoid',
            center: { x: 0, y: 0.5, z: 0 },
            size: { x: 0.7, y: 0.8, z: 0.6 },
            blend: 0.05,
            color: '#d98a6c',
          },
          {
            shape: 'round_cone',
            start: { x: 0.25, y: 0.65, z: 0 },
            end: { x: 0.55, y: 1.05, z: -0.05 },
            radius: 0.14,
            endRadius: 0.04,
            blend: 0.08,
            color: '#4a3525',
          },
          {
            shape: 'sphere',
            op: 'subtract',
            center: { x: 0.14, y: 0.58, z: 0.26 },
            radius: 0.09,
            blend: 0.02,
          },
        ],
      },
      ctx
    );

    const parsed = JSON.parse(rawResult);
    expect(parsed.status).toBe('ok');
    expect(parsed.meshName).toBe('Clay_Creature_Bust');
    // 1 center ellipsoid + 2 mirrored horns + 2 mirrored eye socket subtractions = 5 compiled parts
    expect(parsed.partCount).toBe(5);
    expect(parsed.hasVertexColors).toBe(true);
    expect(parsed.triangles).toBeGreaterThan(100);
    expect(parsed.triangles).toBeLessThanOrEqual(1200 * 1.25);

    const mesh = service.importedMeshes.find((m) => m.name === 'Clay_Creature_Bust');
    expect(mesh).toBeDefined();
    expect(mesh!.isVertexBufferUpdatable(VertexBuffer.PositionKind)).toBe(true);
  });
});

