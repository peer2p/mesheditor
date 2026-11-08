import { Mesh } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';
import { AutoRigPreset, WeightBrushMode } from '../../rigging/WeightPaintController';

export class RigWeightTool extends AbstractTool {
  public readonly name = 'modeler_rig_and_weight_paint';
  public readonly description =
    'Auto-rigs a 3D mesh with a hierarchical Skeleton (Humanoid, Quadruped, or Spine Chain), binds smooth skin weights, paints per-bone vertex weights, or tests joint bending poses.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: {
        type: 'string',
        description: 'Name or ID of the target mesh in the scene.',
      },
      action: {
        type: 'string',
        enum: ['auto_rig', 'paint_weight', 'pose_bone', 'reset_pose'],
        description: 'Rigging or skinning action to execute (default "auto_rig").',
      },
      preset: {
        type: 'string',
        enum: ['humanoid', 'quadruped', 'spine_chain'],
        description: 'Skeleton hierarchy preset when action is "auto_rig" (default "humanoid").',
      },
      boneNameOrIndex: {
        type: ['string', 'integer'],
        description: 'Bone name (e.g. "UpperArm_L") or bone index for weight painting or posing.',
      },
      brushMode: {
        type: 'string',
        enum: ['add', 'subtract', 'smooth', 'replace'],
        description: 'Weight paint brush mode (default "add").',
      },
      worldPoint: {
        type: 'array',
        description: '[x, y, z] 3D world point where the weight brush is applied.',
        items: { type: 'number' },
      },
      radius: {
        type: 'number',
        description: 'Weight brush radius in meters (default 0.35).',
      },
      strength: {
        type: 'number',
        description: 'Weight brush strength from 0.05 to 1.0 (default 0.5).',
      },
      bendAngleDeg: {
        type: 'number',
        description: 'Joint bend angle in degrees when action is "pose_bone" (e.g. 45).',
      },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const meshName = String(args.meshName || '').trim();
    const mesh = context.findMeshByNameOrId(meshName);
    if (!mesh || !(mesh instanceof Mesh)) {
      throw new Error(`Mesh "${meshName}" not found in scene.`);
    }

    const ctrl = context.service.weightPaintController;
    const action = args.action || 'auto_rig';

    const resolveBoneIndex = (): number => {
      if (!mesh.skeleton) return 0;
      if (typeof args.boneNameOrIndex === 'number') {
        return Math.max(0, Math.min(mesh.skeleton.bones.length - 1, args.boneNameOrIndex));
      }
      if (typeof args.boneNameOrIndex === 'string') {
        const idx = mesh.skeleton.bones.findIndex(
          (b) => b.name.toLowerCase() === args.boneNameOrIndex.toLowerCase()
        );
        if (idx !== -1) return idx;
        const parsed = parseInt(args.boneNameOrIndex, 10);
        if (!isNaN(parsed)) return Math.max(0, Math.min(mesh.skeleton.bones.length - 1, parsed));
      }
      return ctrl.activeBoneIndex;
    };

    if (action === 'auto_rig') {
      const preset = (args.preset || 'humanoid') as AutoRigPreset;
      const skel = ctrl.createAutoRig(mesh, preset);
      const stats = ctrl.analyzeWeights(mesh);
      return JSON.stringify({
        status: 'ok',
        action: 'auto_rig',
        preset,
        skeletonName: skel.name,
        ...stats,
      });
    }

    if (action === 'paint_weight') {
      if (!mesh.skeleton) {
        ctrl.createAutoRig(mesh, 'humanoid');
      }
      const boneIdx = resolveBoneIndex();
      ctrl.setActiveBoneIndex(boneIdx);
      if (args.brushMode) ctrl.setBrushMode(args.brushMode as WeightBrushMode);
      if (args.radius !== undefined) ctrl.setRadius(Number(args.radius));
      if (args.strength !== undefined) ctrl.setStrength(Number(args.strength));

      const pt = args.worldPoint
        ? this.parseVec3(args.worldPoint, 0)
        : mesh.getBoundingInfo().boundingBox.centerWorld;
      const modifiedVertices = ctrl.applyWeightBrushStroke(mesh, pt, boneIdx);
      const stats = ctrl.analyzeWeights(mesh);

      return JSON.stringify({
        status: 'ok',
        action: 'paint_weight',
        modifiedVertices,
        ...stats,
      });
    }

    if (action === 'pose_bone') {
      if (!mesh.skeleton) {
        ctrl.createAutoRig(mesh, 'humanoid');
      }
      const boneIdx = resolveBoneIndex();
      ctrl.setActiveBoneIndex(boneIdx);
      const bendAngleDeg = Number(args.bendAngleDeg) || 35;
      ctrl.poseActiveBone(mesh, bendAngleDeg, 0, 0);
      const stats = ctrl.analyzeWeights(mesh);
      return JSON.stringify({
        status: 'ok',
        action: 'pose_bone',
        bendAngleDeg,
        ...stats,
      });
    }

    if (action === 'reset_pose') {
      ctrl.resetBindPose(mesh);
      const stats = ctrl.analyzeWeights(mesh);
      return JSON.stringify({
        status: 'ok',
        action: 'reset_pose',
        ...stats,
      });
    }

    throw new Error(`Unsupported rigging action: "${action}"`);
  }
}

