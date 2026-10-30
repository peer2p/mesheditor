import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class GetSceneInfoTool extends AbstractTool {
  public readonly name = 'modeler_get_scene_info';
  public readonly description =
    'Returns detailed information about all meshes, groups, materials, selections, and world bounding boxes currently in the 3D scene.';
  public readonly parameters = {
    type: 'object',
    properties: {},
  };

  public execute(_args: any, context: ToolExecutionContext): string {
    return JSON.stringify(context.buildSceneSummary());
  }
}

