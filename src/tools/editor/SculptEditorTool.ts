import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Figure Sculpt & Retopology Tool.
 * Digital figure sculpting (Clay, Grab, Smooth, Flatten, Inflate, Pinch, Quad-Draw),
 * anatomical humanoid/creature base-mesh blockouts, X-axis symmetry,
 * Shrinkwrap surface projection, and game-ready Quadric Error retopology decimation.
 */
export class SculptEditorTool extends AbstractEditorTool {
  public readonly name = 'sculpt_retopo';
  public readonly dialogId = 'dialog-sculpt';
  public readonly triggerButtonId = 'btnToggleSculptTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Figure Sculpt & Retopo';
  public readonly icon = 'sparkles';
  public readonly order = 5;
  public readonly defaultOpen = false;
  public readonly isExclusive3DTool = true;
  public readonly description =
    'Digital figure sculpting, Quad-Draw retopology strips, Shrinkwrap mesh projection, humanoid & creature blockouts, and game-ready LOD decimation.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Figure Sculpt & Retopo</strong> tool brings organic character sculpting, anatomical base-mesh blockouts, Quad-Draw strip retopology, Shrinkwrap projection, and real-time game decimation into Mesh Editor.</p>

<h4><i class="app-icon" data-lucide="brush"></i> Digital Sculpting &amp; Quad-Draw Brushes</h4>
<ul>
  <li><strong>Clay:</strong> Pushes and carves surface volume along local face normals with a soft plateau profile.</li>
  <li><strong>Grab:</strong> Pulls vertices smoothly along mouse drag movements (essential for silhouettes and primary forms).</li>
  <li><strong>Smooth:</strong> Applies Laplacian smoothing to relax wrinkles, surface bumps, and uneven vertices.</li>
  <li><strong>Flatten:</strong> Projects vertices onto the average contact plane to carve planar bone landmarks and facial planes.</li>
  <li><strong>Inflate:</strong> Expands or deflates mesh volume along individual vertex normals.</li>
  <li><strong>Pinch:</strong> Pulls vertices toward the center of the brush to sculpt sharp creases, muscle cuts, and wrinkles.</li>
  <li><strong>Quad-Draw (Strips):</strong> Draws clean 4-sided quad polygon strips directly onto the high-poly surface and automatically welds adjacent vertices for animation-ready edge flow.</li>
</ul>

<h4><i class="app-icon" data-lucide="layers"></i> Retopology: Shrinkwrap &amp; Quad Cage</h4>
<ul>
  <li><strong>Shrinkwrap (Mesh Projection):</strong> Wraps the selected low-poly mesh tightly onto the target high-poly sculpt like a stretch film with configurable surface offset and tangential relaxation.</li>
  <li><strong>Generate Quad Cage:</strong> Builds a structured quad-ring retopology cage around the target mesh and shrinkwraps it onto the surface.</li>
  <li><strong>Quadric Error Simplification:</strong> Decimates high-poly sculpts down to game budgets (Mobile ~4k, Standard ~15k, Hero ~32k) while preserving silhouette and submeshes.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!(app?.service?.isSculptModeActive?.() ?? app?.service?.sculptController?.isActive);
  }

  public onActivate(app: any): void {
    app.service?.sculptController?.setActive(true);
    app.updatePanelButtonStates?.();
    app.updateSculptUI?.();
  }

  public onDeactivate(app: any): void {
    app.service?.sculptController?.setActive(false);
    app.updatePanelButtonStates?.();
    app.updateSculptUI?.();
  }

  public onOpen(app: any): void {
    this.onActivate(app);
    app.updateSculptUI?.();
  }

  public onClose(app: any): void {
    this.onDeactivate(app);
  }

  public onMinimize(app: any): void {
    this.onDeactivate(app);
  }

  public onMaximize(app: any): void {
    this.onActivate(app);
  }

  public onUpdateUI(app: any): void {
    app.updateSculptUI?.();
  }
}
