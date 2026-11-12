import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Facet & Vertex Editor Tool.
 * Advanced 3D polygon modeling, face manipulation, extrusion, inset, bevel, subdivision, and topology editing.
 */
export class FacetEditorTool extends AbstractEditorTool {
  public readonly name = 'facet_editor';
  public readonly dialogId = 'dialog-facet';
  public readonly triggerButtonId = 'btnToggleFacetEditor';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Facet & Vertex Editor';
  public readonly icon = 'triangle';
  public readonly order = 4;
  public readonly defaultOpen = true;
  public readonly isExclusive3DTool = true;
  public readonly description =
    'Advanced polygon modeling plus per-facet UV mapping, atlas tiles, and per-facet material/texture assignment.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Facet &amp; Vertex Editor</strong> gives you high-precision polygon mesh modeling tools, per-facet UV coordinate editing, and per-facet material or texture assignment directly in the 3D viewport.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> 3D Mesh Modeling Tools</h4>
<ul>
  <li><strong>Extrude (X):</strong> Pulls a new polygon volume outward along face normals with connecting quad sides.</li>
  <li><strong>Inset (I):</strong> Shrinks a face inward toward its centroid, generating an inner polygon surrounded by quads.</li>
  <li><strong>Arc (Shift+A):</strong> Extrudes a face along a curved, segmented circular arch.</li>
  <li><strong>Knife (C):</strong> Splits a triangle across its longest edge with precision midpoint cutting.</li>
  <li><strong>Loop Cut (Shift+E):</strong> Cuts a quad subdivision strip through selected edges or adjacent faces.</li>
  <li><strong>Bevel (-):</strong> Chamfers perimeter edges and transitions smoothly with beveled facets.</li>
  <li><strong>Solidify (H):</strong> Adds real wall thickness to open surface sheets or hollow meshes.</li>
  <li><strong>Array:</strong> Duplicates faces or objects with progressive linear offsets.</li>
  <li><strong>Cut Through (T):</strong> Punches an open recessed portal or through-hole through the mesh.</li>
  <li><strong>Relax (V):</strong> Applies Laplacian vertex relaxation to even out polygon proportions.</li>
  <li><strong>Subdivide (K):</strong> Splits selected faces into 4 smaller equilateral subtriangles.</li>
  <li><strong>Sub-D (Shift+S):</strong> Smooth subdivision surface with organic Laplacian curvature smoothing.</li>
  <li><strong>Invert Normal (N):</strong> Flips polygon winding order to fix inside-out or transparent faces.</li>
  <li><strong>Delete Face (Del):</strong> Removes selected face geometry.</li>
</ul>

<h4><i class="app-icon" data-lucide="grid"></i> Per-Facet UVs &amp; Atlas Tiles</h4>
<ul>
  <li><strong>Shared Vertex Isolation:</strong> Any UV edit automatically isolates vertices belonging to the selected facet so adjacent faces are never distorted.</li>
  <li><strong>Fit [0..1] / Planar:</strong> Re-projects normalized local UVs or consistent world-scale planar UVs onto the picked facet.</li>
  <li><strong>Transforms &amp; Region:</strong> Rotate UVs by 90°, flip U/V, remap exact <code>[uMin..uMax, vMin..vMax]</code> bounds, or edit individual corner <code>(U, V)</code> values.</li>
  <li><strong>Atlas Tiles:</strong> Click any atlas tile swatch to map the facet onto that tile's UV coordinates (and optionally assign the shared atlas material).</li>
</ul>

<h4><i class="app-icon" data-lucide="palette"></i> Per-Facet Materials &amp; Textures</h4>
<ul>
  <li><strong>SubMesh Splitting:</strong> Assign an existing scene material, a newly created colored PBR material, or an embedded/uploaded image texture exclusively to the picked facet using automatic <code>MultiMaterial</code> SubMeshes.</li>
  <li><strong>Single Tri Mode:</strong> Enable <em>Single Tri</em> in the status bar to target one individual triangle instead of pairing coplanar triangles into a quad.</li>
</ul>

<h4><i class="app-icon" data-lucide="mouse-pointer"></i> Viewport Controls</h4>
<ul>
  <li><strong>Face Mode:</strong> Click any face to select. On cubes and planar meshes, adjacent coplanar triangles sharing the same material are paired as a Quad unless <em>Single Tri</em> is enabled.</li>
  <li><strong>Vertex Mode:</strong> Click interactive sphere handles or click on the mesh to select vertices and drag them with the 3D Move Gizmo.</li>
  <li><strong>WASD Navigation:</strong> Camera navigation (W, A, S, D, Arrow keys) always works smoothly in the 3D viewport without interfering with modeling tools.</li>
  <li><strong>Keyboard Shortcuts:</strong> Press X, I, C, H, T, K, Shift+A, Shift+E, Shift+S while editing to trigger operations instantly.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!app?.service?.facetEditorActive;
  }

  public onOpen(app: any): void {
    app.service?.toggleFacetEditor(true);
    app.updatePanelButtonStates?.();
  }

  public onClose(app: any): void {
    app.service?.toggleFacetEditor(false);
    app.updatePanelButtonStates?.();
  }

  public onActivate(app: any): void {
    app.service?.toggleFacetEditor(true);
    app.updatePanelButtonStates?.();
  }

  public onDeactivate(app: any): void {
    app.service?.toggleFacetEditor(false);
    app.updatePanelButtonStates?.();
  }
}

