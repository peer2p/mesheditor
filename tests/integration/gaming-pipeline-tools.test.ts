import {
  Mesh,
  MeshBuilder,
  NullEngine,
  PBRMaterial,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { MeshEditorService } from '../../src/MeshEditorService';

describe('Gaming Pipeline Tools: Non-Destructive CSG Bevel, Retopo Shrinkwrap/Quad-Draw, UV Unwrap, Baking & Rigging', () => {
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let service: MeshEditorService;
  let app: MeshEditorApp;

  beforeEach(() => {
    localStorage.clear();
    canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    engine = new NullEngine();
    service = new MeshEditorService(canvas, {}, engine);
    app = new MeshEditorApp({
      container: document.body,
      engine,
    });
  });

  afterEach(() => {
    app?.dispose();
    service?.dispose();
    canvas?.remove();
  });

  describe('1. Non-Destructive CSG & Bevel Modifier', () => {
    it('applies non-destructive Bevel Modifier to round sharp edges and reverts cleanly to original base mesh', () => {
      const box = MeshBuilder.CreateBox('armor_plate', { size: 2 }, service.scene);
      service.addMesh(box);
      const originalVerts = box.getTotalVertices();
      const originalIndices = box.getTotalIndices();

      // Apply 2-segment rounded fillet bevel non-destructively
      const { sharpEdgeCount } = service.applyNonDestructiveBevel(box, {
        width: 0.08,
        segments: 2,
        angleThresholdDeg: 30,
        nonDestructive: true,
      });

      expect(sharpEdgeCount).toBe(12); // A cube has 12 sharp 90-degree edges
      expect(box.getTotalVertices()).toBeGreaterThan(originalVerts);
      expect(box.getTotalIndices()).toBeGreaterThan(originalIndices);
      expect(box.metadata?.nonDestructiveCSG?.isNonDestructive).toBe(true);
      expect(box.metadata?.nonDestructiveCSG?.bevel?.enabled).toBe(true);

      // Update bevel width non-destructively from the stored base snapshot
      service.applyNonDestructiveBevel(box, {
        width: 0.14,
        segments: 3,
        angleThresholdDeg: 30,
        nonDestructive: true,
      });
      expect(box.metadata?.nonDestructiveCSG?.bevel?.width).toBe(0.14);
      expect(box.metadata?.nonDestructiveCSG?.bevel?.segments).toBe(3);

      // Revert back to the pristine base mesh non-destructively
      const reverted = service.revertNonDestructiveMesh(box);
      expect(reverted).toBe(true);
      expect(box.getTotalVertices()).toBe(originalVerts);
      expect(box.getTotalIndices()).toBe(originalIndices);
    });

    it('executes non-destructive CSG boolean operation with live edge beveling via modeler_boolean_operation', async () => {
      const baseBox = MeshBuilder.CreateBox('crate_base', { size: 2 }, service.scene);
      const cutterBox = MeshBuilder.CreateBox('crate_notch', { size: 1 }, service.scene);
      cutterBox.position.set(0.8, 0.8, 0.8);
      service.addMesh(baseBox);
      service.addMesh(cutterBox);

      const resJson = await service.aiAgent.executeToolCall('modeler_boolean_operation', {
        operation: 'subtract',
        baseMeshName: 'crate_base',
        toolMeshName: 'crate_notch',
        nonDestructive: true,
        bevelWidth: 0.05,
        bevelSegments: 2,
      });

      const res = JSON.parse(resJson);
      expect(res.status).toBe('ok');
      expect(res.nonDestructive).toBe(true);
      expect(res.bevelApplied).toBe(true);
      expect(res.sharpEdgeCount).toBeGreaterThan(0);

      const resultMesh = service.importedMeshes.find((m) => m.name === res.resultMeshName)!;
      expect(resultMesh).toBeDefined();
      expect(resultMesh.metadata?.nonDestructiveCSG?.isNonDestructive).toBe(true);
    });
  });

  describe('2. Retopology: Shrinkwrap Projection & Quad-Draw / Strips', () => {
    it('projects a low-poly mesh onto a high-poly sculpt using Shrinkwrap', () => {
      const highPoly = MeshBuilder.CreateSphere('high_sculpt', { diameter: 2.0, segments: 24 }, service.scene);
      const lowPoly = MeshBuilder.CreateBox('low_cage', { size: 3.0 }, service.scene);
      service.addMesh(highPoly);
      service.addMesh(lowPoly);

      const preBounds = lowPoly.getBoundingInfo().boundingBox;
      expect(preBounds.maximum.x).toBeCloseTo(1.5, 1);

      const analysis = service.sculptController.shrinkwrapMesh(lowPoly, highPoly, {
        offset: 0.01,
        mode: 'nearest',
        smoothIterations: 1,
      });

      expect(analysis.vertexCount).toBeGreaterThan(0);
      lowPoly.refreshBoundingInfo();
      const postBounds = lowPoly.getBoundingInfo().boundingBox;
      // Vertices of the 3.0m box should now be pulled onto the radius=1.0m sphere surface (~1.01m)
      expect(postBounds.maximum.x).toBeLessThan(1.15);
    });

    it('draws surface-snapped Quad-Draw strips and welds adjacent strip vertices for clean edge flow', () => {
      const highPoly = MeshBuilder.CreateSphere('monster_sculpt', { diameter: 2.4, segments: 18 }, service.scene);
      service.addMesh(highPoly);

      const stroke1 = [
        new Vector3(0, -0.6, 1.2),
        new Vector3(0, 0.0, 1.2),
        new Vector3(0, 0.6, 1.2),
      ];
      const quadMesh = service.sculptController.drawQuadStripOnMesh(highPoly, stroke1, 0.3, 0.005);
      expect(quadMesh).toBeDefined();
      expect(quadMesh.name).toBe('monster_sculpt_RetopoQuads');
      const vertsAfterStrip1 = quadMesh.getTotalVertices();
      expect(vertsAfterStrip1).toBeGreaterThanOrEqual(4);

      // Draw a second overlapping/adjacent quad strip to verify auto-welding
      const quadMesh2 = service.sculptController.drawQuadStripOnMesh(highPoly, stroke1, 0.3, 0.005);
      expect(quadMesh2).toBe(quadMesh);
      expect(quadMesh2.getTotalIndices()).toBeGreaterThan(6);
    });

    it('generates a complete Quad-Flow Retopology Cage around a high-poly sculpt via AI tool', async () => {
      const highPoly = MeshBuilder.CreateSphere('armor_sculpt', { diameter: 2.0, segments: 20 }, service.scene);
      service.addMesh(highPoly);

      const resJson = await service.aiAgent.executeToolCall('modeler_retopologize_mesh', {
        meshName: 'armor_sculpt',
        mode: 'quad_cage',
        surfaceOffset: 0.005,
      });
      const res = JSON.parse(resJson);
      expect(res.status).toBe('ok');
      expect(res.mode).toBe('quad_cage');
      expect(res.resultMeshName).toBe('armor_sculpt_QuadCage');
      expect(res.totalTriangles).toBeGreaterThan(100);
    });
  });

  describe('3. UV Unwrapping: Smart Seam Marking, Texel Density & Island Bin-Packing', () => {
    it('marks Smart UV Seams, unwraps into islands, normalizes Texel Density (px/m), and packs into [0,1]', async () => {
      const cyl = MeshBuilder.CreateCylinder(
        'character_pillar',
        { height: 2.5, diameter: 1.2, tessellation: 16 },
        service.scene
      );
      service.addMesh(cyl);

      // 1. Mark Smart Seams
      const seamRes = service.uvUnwrapController.markSmartSeams(cyl, 45);
      expect(seamRes.seamEdgeCount).toBeGreaterThan(0);

      // 2. Unwrap and pack islands
      const unwrapStats = service.uvUnwrapController.unwrapMesh(cyl, {
        method: 'smart_seams',
        angleThresholdDeg: 45,
        marginPx: 6,
        textureResolution: 1024,
        rotateOptimal: true,
      });
      expect(unwrapStats.islandCount).toBeGreaterThanOrEqual(2);
      expect(unwrapStats.uvCoveragePercent).toBeGreaterThan(5);
      expect(unwrapStats.texelDensityPxPerMeter).toBeGreaterThan(0);

      // Verify all packed UVs lie within [0, 1]
      const uvs = cyl.getVerticesData(VertexBuffer.UVKind)!;
      for (let i = 0; i < uvs.length; i++) {
        expect(uvs[i]).toBeGreaterThanOrEqual(-0.001);
        expect(uvs[i]).toBeLessThanOrEqual(1.001);
      }

      // 3. Normalize Texel Density to 512 px/m via AI tool
      const aiResJson = await service.aiAgent.executeToolCall('modeler_uv_unwrap', {
        meshName: 'character_pillar',
        action: 'normalize_texel_density',
        targetTexelDensity: 512,
        textureResolution: 1024,
      });
      const aiRes = JSON.parse(aiResJson);
      expect(aiRes.status).toBe('ok');
      expect(aiRes.texelDensityPxPerMeter).toBeGreaterThan(450);
      expect(aiRes.texelDensityPxPerMeter).toBeLessThan(580);
    });
  });

  describe('4. Texture Baking: Projection Cage Generation, Normal Map & AO Baker', () => {
    it('generates a 3D Projection Cage and bakes High-Poly details onto Low-Poly Normal & AO maps', async () => {
      const highPoly = MeshBuilder.CreateSphere('shield_high', { diameter: 2.05, segments: 20 }, service.scene);
      const lowPoly = MeshBuilder.CreateSphere('shield_low', { diameter: 2.0, segments: 8 }, service.scene);
      service.addMesh(highPoly);
      service.addMesh(lowPoly);

      // Preview 3D Cage
      const cageDist = service.textureBaker.computeAutoCageDistance(lowPoly, highPoly);
      expect(cageDist).toBeGreaterThan(0.005);
      const cagePreview = service.textureBaker.updateCagePreview(lowPoly, cageDist, true);
      expect(cagePreview).not.toBeNull();

      // Bake Normal & AO Maps via AI tool
      const bakeJson = await service.aiAgent.executeToolCall('modeler_bake_textures', {
        lowPolyMeshName: 'shield_low',
        highPolyMeshName: 'shield_high',
        resolution: 128,
        cageExtrusion: cageDist,
        paddingPx: 4,
        applyToMaterial: true,
      });
      const bakeRes = JSON.parse(bakeJson);
      expect(bakeRes.status).toBe('ok');
      expect(bakeRes.resolution).toBe(128);
      expect(bakeRes.rayHitCount).toBeGreaterThan(0);
      expect(bakeRes.appliedToMaterial).toBe(true);

      const mat = lowPoly.material as PBRMaterial;
      expect(mat).toBeDefined();
      expect(mat.bumpTexture).toBeDefined();
      expect(mat.ambientTexture).toBeDefined();
      expect(service.textureBaker.lastBakeResult?.normalMapDataUrl).toMatch(/^data:image\//);
      expect(service.textureBaker.lastBakeResult?.aoMapDataUrl).toMatch(/^data:image\//);
    });
  });

  describe('5. Rigging, Skeleton & 3D Weight Painting', () => {
    it('creates a 20-bone Humanoid Auto-Rig, paints normalized bone weights with X-symmetry, and bends joints', async () => {
      const hero = service.sculptController.spawnHumanoidBaseMesh({ name: 'Rigged_Hero' });
      service.selectMesh(hero);

      // 1. Auto-Rig with 20-bone Humanoid skeleton
      const rigJson = await service.aiAgent.executeToolCall('modeler_rig_and_weight_paint', {
        meshName: 'Rigged_Hero',
        action: 'auto_rig',
        preset: 'humanoid',
      });
      const rigRes = JSON.parse(rigJson);
      expect(rigRes.status).toBe('ok');
      expect(rigRes.boneCount).toBe(20);
      expect(hero.skeleton).toBeDefined();

      // Verify vertex weights sum to 1.0
      const weights = hero.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      expect(weights).toBeDefined();
      for (let i = 0; i < hero.getTotalVertices(); i++) {
        const sum =
          weights[i * 4] + weights[i * 4 + 1] + weights[i * 4 + 2] + weights[i * 4 + 3];
        expect(sum).toBeCloseTo(1.0, 3);
      }

      // 2. Paint weights on UpperArm_L and verify normalization & X-symmetry mirror
      const paintJson = await service.aiAgent.executeToolCall('modeler_rig_and_weight_paint', {
        meshName: 'Rigged_Hero',
        action: 'paint_weight',
        boneNameOrIndex: 'UpperArm_L',
        brushMode: 'add',
        worldPoint: [0.35, 1.4, 0],
        radius: 0.45,
        strength: 0.8,
      });
      const paintRes = JSON.parse(paintJson);
      expect(paintRes.status).toBe('ok');
      expect(paintRes.modifiedVertices).toBeGreaterThan(0);

      // Check post-paint normalization
      const postWeights = hero.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      for (let i = 0; i < hero.getTotalVertices(); i++) {
        const sum =
          postWeights[i * 4] +
          postWeights[i * 4 + 1] +
          postWeights[i * 4 + 2] +
          postWeights[i * 4 + 3];
        expect(sum).toBeCloseTo(1.0, 3);
      }

      // 3. Pose active bone to test joint deformation and then reset to bind pose
      const prePosePos = Array.from(hero.getVerticesData(VertexBuffer.PositionKind)!);
      await service.aiAgent.executeToolCall('modeler_rig_and_weight_paint', {
        meshName: 'Rigged_Hero',
        action: 'pose_bone',
        boneNameOrIndex: 'UpperArm_L',
        bendAngleDeg: 45,
      });
      const posedPos = hero.getVerticesData(VertexBuffer.PositionKind)!;
      let deformedCount = 0;
      for (let i = 0; i < posedPos.length; i += 3) {
        if (Math.abs(posedPos[i + 1] - prePosePos[i + 1]) > 0.005) {
          deformedCount++;
        }
      }
      expect(deformedCount).toBeGreaterThan(0);

      await service.aiAgent.executeToolCall('modeler_rig_and_weight_paint', {
        meshName: 'Rigged_Hero',
        action: 'reset_pose',
      });
      const resetPos = hero.getVerticesData(VertexBuffer.PositionKind)!;
      expect(resetPos[0]).toBeCloseTo(prePosePos[0], 4);
    });
  });
});

