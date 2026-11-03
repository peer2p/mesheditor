import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Figure Sculpt & Retopology Tool.
 * Digital figure sculpting (Clay, Grab, Smooth, Flatten, Inflate, Pinch),
 * anatomical humanoid/creature base-mesh blockouts, X-axis symmetry,
 * and game-ready Quadric Error retopology decimation.
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
    'Digital figure sculpting (Grab, Clay, Smooth, Flatten, Inflate), humanoid & creature base-mesh blocking, symmetry, and game-ready Quad/LOD retopology.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Figure Sculpt & Retopo</strong> tool brings organic character sculpting, anatomical base-mesh blockouts, and real-time game retopology into Mesh Editor.</p>

<h4><i class="app-icon" data-lucide="brush"></i> Digital Sculpting Brushes</h4>
<ul>
  <li><strong>Clay:</strong> Pushes and carves surface volume along local face normals with a soft plateau profile.</li>
  <li><strong>Grab:</strong> Pulls vertices smoothly along mouse drag movements (essential for silhouettes and primary forms).</li>
  <li><strong>Smooth:</strong> Applies Laplacian smoothing to relax wrinkles, surface bumps, and uneven vertices.</li>
  <li><strong>Flatten:</strong> Projects vertices onto the average contact plane to carve planar bone landmarks and facial planes.</li>
  <li><strong>Inflate:</strong> Expands or deflates mesh volume along individual vertex normals.</li>
  <li><strong>Pinch:</strong> Pulls vertices toward the center of the brush to sculpt sharp creases, muscle cuts, and wrinkles.</li>
</ul>

<h4><i class="app-icon" data-lucide="symmetry"></i> Symmetry & Controls</h4>
<ul>
  <li><strong>X-Symmetry:</strong> Automatically mirrors brush strokes across the center X = 0 plane for symmetrical humans, faces, and animals.</li>
  <li><strong>Invert (Alt / Ctrl):</strong> Hold <kbd>Alt</kbd> or <kbd>Ctrl</kbd> while sculpting to invert brush direction (e.g. carve instead of build up).</li>
  <li><strong>Camera Orbit:</strong> Right-click or middle-click and drag in the viewport to orbit the camera freely while sculpting.</li>
</ul>

<h4><i class="app-icon" data-lucide="user"></i> Anatomical Base-Mesh Blockouts</h4>
<ul>
  <li><strong>Humanoid (8 Heads):</strong> Spawns a 1.80m character mannequin built according to the Loomis canon with articulated joint loops (knees, elbows, hips).</li>
  <li><strong>Quadruped Beast:</strong> Spawns an animal base with realistic digitigrade leg mechanics (raised hock/ankle joint).</li>
  <li><strong>Head Bust:</strong> Facial plane mannequin with eye sockets, jawline, and nose bridge.</li>
  <li><strong>Sculpt Sphere:</strong> High-density subdivided sphere for freeform digital clay sculpting from scratch.</li>
</ul>

<h4><i class="app-icon" data-lucide="cpu"></i> Game-Ready Retopology</h4>
<ul>
  <li><strong>Target Budgets:</strong> Quickly optimize high-poly sculpts down to game-ready polygon counts (Mobile ~4k, Standard Indie ~15k, Hero Asset ~30k).</li>
  <li><strong>Quadric Error Simplification:</strong> Preserves critical silhouettes, volume, and boundary edges while recalculating smooth normals.</li>
  <li><strong>Live Topology Health:</strong> Real-time indicator checks vertex and triangle counts to certify game engine readiness.</li>
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

