import { ToolInterface } from '../ToolInterface';
import { AbstractEditorTool } from './AbstractEditorTool';
import { AIAgentEditorTool } from './AIAgentEditorTool';
import { AnimationPlayerEditorTool } from './AnimationPlayerEditorTool';
import { CreatePrimitiveEditorTool } from './CreatePrimitiveEditorTool';
import { CSGEditorTool } from './CSGEditorTool';
import { FacetEditorTool } from './FacetEditorTool';
import { MaterialEditorTool } from './MaterialEditorTool';
import { MeshPropertiesEditorTool } from './MeshPropertiesEditorTool';
import { OutlinerEditorTool } from './OutlinerEditorTool';
import { PathExtrusionEditorTool } from './PathExtrusionEditorTool';
import { SceneEnvironmentEditorTool } from './SceneEnvironmentEditorTool';
import { TextureOptimizerEditorTool } from './TextureOptimizerEditorTool';
import { CompressModelEditorTool } from './CompressModelEditorTool';
import { VoxelPainterEditorTool } from './VoxelPainterEditorTool';
import { SculptEditorTool } from './SculptEditorTool';
import { TOOL_VIEWS, getToolViewTemplate } from './toolViews';

export {
  AbstractEditorTool,
  AIAgentEditorTool,
  AnimationPlayerEditorTool,
  CreatePrimitiveEditorTool,
  CSGEditorTool,
  FacetEditorTool,
  MaterialEditorTool,
  MeshPropertiesEditorTool,
  OutlinerEditorTool,
  PathExtrusionEditorTool,
  SceneEnvironmentEditorTool,
  TextureOptimizerEditorTool,
  CompressModelEditorTool,
  VoxelPainterEditorTool,
  SculptEditorTool,
  TOOL_VIEWS,
  getToolViewTemplate,
};

/**
 * Creates instances of all decentralized built-in editor tool classes.
 */
export function createBuiltinEditorTools(): ToolInterface[] {
  return [
    new OutlinerEditorTool(),
    new CreatePrimitiveEditorTool(),
    new CSGEditorTool(),
    new FacetEditorTool(),
    new SculptEditorTool(),
    new TextureOptimizerEditorTool(),
    new CompressModelEditorTool(),
    new VoxelPainterEditorTool(),
    new PathExtrusionEditorTool(),
    new AIAgentEditorTool(),
    new MeshPropertiesEditorTool(),
    new MaterialEditorTool(),
    new SceneEnvironmentEditorTool(),
    new AnimationPlayerEditorTool(),
  ];
}

/**
 * Backwards compatibility alias for `createBuiltinEditorTools`.
 */
export const getBuiltinEditorTools = createBuiltinEditorTools;

