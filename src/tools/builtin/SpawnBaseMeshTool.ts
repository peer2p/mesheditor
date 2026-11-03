import { Vector3 } from '@babylonjs/core';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class SpawnBaseMeshTool extends AbstractTool {
  public readonly name = 'modeler_spawn_base_mesh';
  public readonly description =
    'Spawns an anatomically proportioned character base-mesh (Humanoid Loomis 8-head mannequin, Quadruped animal with digitigrade/unguligrade joints, Facial Head Bust, or Sculpt Sphere) with deformation-ready joint loops.';

  public readonly parameters = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['humanoid', 'chibi', 'creature', 'quadruped', 'head_bust', 'sculpt_sphere'],
        description:
          'Base mesh archetype: "creature" (stylized organic creature / chibi demon with seamless pear body, continuous curved tubular limbs, claws, horns, bat wings, halo, and eyes — ideal for monsters and soft organic characters), "chibi" (3.5-head cartoon/stylized character with potbelly, continuous limbs, and boots/gloves — ideal for Mario, toon characters, dwarves), "humanoid" (standard 8-head standing character), "quadruped" (4-legged beast), "head_bust", or "sculpt_sphere".',
      },
      style: {
        type: 'string',
        enum: ['organic', 'mannequin'],
        description:
          'Mesh construction style: "organic" (creates continuous, soft, flowing tubular limbs and seamless rounded body volumes — default, recommended for cartoon characters and creatures) or "mannequin" (classic wooden artist puppet with separated joint spheres).',
      },
      canon: {
        type: 'string',
        enum: ['heroic', 'chibi', 'stylized'],
        description:
          'Proportional canon for humanoid: "heroic" (8-head realistic), "chibi" (3.5-head cartoon/Mario), or "stylized" (6-head).',
      },
      pose: {
        type: 'string',
        enum: ['t_pose', 'a_pose'],
        description:
          'Resting pose for character arms: "t_pose" (arms horizontally outstretched at 90 degrees — recommended for rigging and animation) or "a_pose" (arms angled down at 45 degrees). Default: "t_pose".',
      },
      materialStyle: {
        type: 'string',
        enum: ['colored', 'clay'],
        description:
          'Material style: "colored" (applies skin, clothing, glove, and boot color zones) or "clay" (monochromatic sculpting clay). Default: "colored".',
      },
      name: {
        type: 'string',
        description: 'Optional custom mesh name (e.g. "Hero_BaseMesh").',
      },
      scale: {
        type: 'number',
        description: 'Uniform scaling factor (default: 1.0).',
      },
      locomotion: {
        type: 'string',
        enum: ['digitigrade', 'unguligrade'],
        description: 'Locomotion leg mechanics for quadruped ("digitigrade" for cats/dogs/wolves with raised hock, "unguligrade" for horses/deer).',
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
        description: 'World placement position (default: [0, 0, 0]).',
      },
    },
    required: ['type'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const type = String(args.type || 'humanoid').toLowerCase();
    const name = args.name ? String(args.name).trim() : undefined;
    const scale = Number(args.scale) || 1.0;
    const canon = args.canon as any;
    const pose = (args.pose === 'a_pose' ? 'a_pose' : 't_pose') as any;
    const materialStyle = (args.materialStyle === 'clay' ? 'clay' : 'colored') as any;
    const locomotion = (args.locomotion === 'unguligrade' ? 'unguligrade' : 'digitigrade') as any;

    const style = (args.style === 'mannequin' ? 'mannequin' : 'organic') as any;

    let pos: Vector3 | undefined;
    if (args.position) {
      pos = new Vector3(
        Number(args.position.x) || 0,
        Number(args.position.y) || 0,
        Number(args.position.z) || 0
      );
    }

    const sculptCtrl = context.service.sculptController;
    let mesh: any;

    switch (type) {
      case 'creature':
        mesh = sculptCtrl.spawnOrganicCreatureBaseMesh({ name, scale, materialStyle, position: pos });
        break;
      case 'chibi':
        mesh = sculptCtrl.spawnChibiBaseMesh({ name, scale, pose, materialStyle, style, position: pos });
        break;
      case 'quadruped':
        mesh = sculptCtrl.spawnQuadrupedBaseMesh({ name, scale, locomotion, position: pos });
        break;
      case 'head_bust':
        mesh = sculptCtrl.spawnHeadBust({ name, scale, position: pos });
        break;
      case 'sculpt_sphere':
        mesh = sculptCtrl.spawnSculptSphere({ name, scale, position: pos });
        break;
      case 'humanoid':
      default:
        mesh = sculptCtrl.spawnHumanoidBaseMesh({ name, scale, canon, pose, materialStyle, position: pos });
        break;
    }

    context.service.selectMesh(mesh);

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      meshId: mesh.id,
      totalVertices: mesh.getTotalVertices(),
      totalTriangles: mesh.getTotalIndices() / 3,
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    });
  }
}

