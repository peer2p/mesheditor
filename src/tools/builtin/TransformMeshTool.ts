import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class TransformMeshTool extends AbstractTool {
  public readonly name = 'modeler_transform_mesh';
  public readonly description =
    'Updates an existing mesh in the scene: position, rotationDegrees, scaling, name, visibility, snapToGround, centerPivot, or bakeTransform.';

  public readonly parameters = {
    type: 'object',
    properties: {
      meshName: { type: 'string', description: 'Name of the existing mesh to update.' },
      newName: { type: 'string', description: 'Optional new name for the mesh.' },
      position: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      rotationDegrees: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      scaling: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
      },
      visible: { type: 'boolean' },
      snapToGround: {
        type: 'boolean',
        description: 'If true, shifts the mesh vertically so its lowest point sits on Y=0.',
      },
      centerPivot: {
        type: 'boolean',
        description: 'If true, centers the mesh pivot to its visual bounding box center.',
      },
      bakeTransform: {
        type: 'boolean',
        description: 'If true, bakes current position/rotation/scale into vertex coordinates.',
      },
    },
    required: ['meshName'],
  };

  public execute(args: any, context: ToolExecutionContext): string {
    const mesh = context.findMeshByNameOrId(args.meshName);
    if (!mesh) {
      throw new Error(`Mesh "${args.meshName}" not found.`);
    }

    if (args.newName && typeof args.newName === 'string') {
      mesh.name = args.newName.replace(/\s+/g, '_');
    }
    if (args.visible !== undefined) {
      mesh.isVisible = !!args.visible;
    }
    context.applyTransformArgs(mesh, args);

    if (args.centerPivot) {
      context.service.centerMeshPivot(mesh);
    }
    if (args.snapToGround) {
      mesh.computeWorldMatrix(true);
      const lowestY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
      mesh.position.y -= lowestY;
      mesh.computeWorldMatrix(true);
    }
    if (args.bakeTransform) {
      mesh.bakeCurrentTransformIntoVertices();
      mesh.refreshBoundingInfo();
    }

    return JSON.stringify({
      status: 'ok',
      meshName: mesh.name,
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    });
  }
}

