import { ToolInterface } from '../ToolInterface';
import { AbstractEditorTool } from './AbstractEditorTool';
import { AIAgentEditorTool } from './AIAgentEditorTool';
import { AnimationPlayerEditorTool } from './AnimationPlayerEditorTool';
import { BakingEditorTool } from './BakingEditorTool';
import { CreatePrimitiveEditorTool } from './CreatePrimitiveEditorTool';
import { CSGEditorTool } from './CSGEditorTool';
import { FacetEditorTool } from './FacetEditorTool';
import { MaterialEditorTool } from './MaterialEditorTool';
import { MeshPropertiesEditorTool } from './MeshPropertiesEditorTool';
import { OutlinerEditorTool } from './OutlinerEditorTool';
import { PathExtrusionEditorTool } from './PathExtrusionEditorTool';
import { RiggingEditorTool } from './RiggingEditorTool';
import { SceneEnvironmentEditorTool } from './SceneEnvironmentEditorTool';
import { TextureOptimizerEditorTool } from './TextureOptimizerEditorTool';
import { CompressModelEditorTool } from './CompressModelEditorTool';
import { UVUnwrapEditorTool } from './UVUnwrapEditorTool';
import { VoxelPainterEditorTool } from './VoxelPainterEditorTool';
import { SculptEditorTool } from './SculptEditorTool';
import { AITextureEditorTool } from './AITextureEditorTool';
import { TextMeshEditorTool } from './TextMeshEditorTool';
import { DecalEditorTool } from './DecalEditorTool';
import { TOOL_VIEWS, getToolViewTemplate } from './toolViews';

export {
  AbstractEditorTool,
  AIAgentEditorTool,
  AnimationPlayerEditorTool,
  BakingEditorTool,
  CreatePrimitiveEditorTool,
  CSGEditorTool,
  FacetEditorTool,
  MaterialEditorTool,
  MeshPropertiesEditorTool,
  OutlinerEditorTool,
  PathExtrusionEditorTool,
  RiggingEditorTool,
  SceneEnvironmentEditorTool,
  TextureOptimizerEditorTool,
  CompressModelEditorTool,
  UVUnwrapEditorTool,
  VoxelPainterEditorTool,
  SculptEditorTool,
  AITextureEditorTool,
  TextMeshEditorTool,
  DecalEditorTool,
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
    new VoxelPainterEditorTool(),
    new PathExtrusionEditorTool(),
    new AIAgentEditorTool(),
    new MeshPropertiesEditorTool(),
    new MaterialEditorTool(),
    new UVUnwrapEditorTool(),
    new BakingEditorTool(),
    new TextureOptimizerEditorTool(),
    new CompressModelEditorTool(),
    new SceneEnvironmentEditorTool(),
    new AnimationPlayerEditorTool(),
    new RiggingEditorTool(),
    new AITextureEditorTool(),
    new TextMeshEditorTool(),
    new DecalEditorTool(),
  ];
}

/**
 * Backwards compatibility alias for `createBuiltinEditorTools`.
 */
export const getBuiltinEditorTools = createBuiltinEditorTools;
