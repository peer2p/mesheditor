import { ToolInterface } from '../ToolInterface';

/**
 * Create Mesh Primitive Generator Tool.
 * Interactive 3D primitive mesh generation with raycast pick-and-place.
 */
export class CreatePrimitiveEditorTool implements ToolInterface {
  public readonly name = 'create_primitive';
  public readonly dialogId = 'dialog-create-primitive';
  public readonly triggerButtonId = 'btnCreatePrimitive';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Create Mesh';
  public readonly icon = 'plus-circle';
  public readonly order = 2;
  public readonly defaultOpen = true;
  public readonly description =
    'Interactive 3D primitive mesh generation with raycast pick-and-place.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Create Mesh</strong> tool allows you to spawn standard and advanced geometric primitives directly into your 3D world with full dimensional control.</p>

<h4><i class="app-icon" data-lucide="shapes"></i> Supported Primitive Types</h4>
<ul>
  <li><strong>Basic Solids:</strong> Box (Cube), Sphere, Cylinder, Cone, Torus (Donut), Plane, and Disc.</li>
  <li><strong>Advanced Geometry:</strong> Capsule, IcoSphere, Polyhedron, Tube, and Lathe (Rotational Extrusion).</li>
</ul>

<h4><i class="app-icon" data-lucide="sparkles"></i> Surface Raycast Pick & Place</h4>
<p>When creating a primitive, you can click directly on the ground grid or on the surface of any existing 3D mesh in the viewport to spawn the new object precisely at the cursor raycast hit point.</p>

<h4><i class="app-icon" data-lucide="sliders"></i> Parameters</h4>
<ul>
  <li>Adjust width, height, depth, tessellation subdivisions, and radius.</li>
  <li>Pick an initial base color or leave it to use the active material palette.</li>
  <li>Transforms are automatically centered with clean origins ready for sculpting or export.</li>
</ul>
`.trim();
}

