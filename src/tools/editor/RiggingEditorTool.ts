import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Rigging, Skeleton & 3D Weight Painting Tool.
 * Generates game-ready Humanoid/Quadruped/Prop skeletons, binds smooth skin envelopes,
 * paints per-bone vertex influence weights with a live color heatmap, and tests joint bending.
 */
export class RiggingEditorTool extends AbstractEditorTool {
  public readonly name = 'rigging_skinning';
  public readonly dialogId = 'dialog-rigging';
  public readonly triggerButtonId = 'btnToggleRiggingTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Rigging & Weight Paint';
  public readonly icon = 'bone';
  public readonly order = 15;
  public readonly defaultOpen = false;
  public readonly isExclusive3DTool = true;
  public readonly description =
    'Auto-rig 3D models with Humanoid/Quadruped skeletons, paint vertex bone weights with live heatmap, and test joint poses.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Rigging &amp; Weight Paint</strong> tool prepares characters, creatures, and props for animation in Unreal Engine, Unity, and Babylon.js by binding a hierarchical skeleton and painting smooth per-vertex skin weights.</p>

<h4><i class="app-icon" data-lucide="bone"></i> Skeleton Auto-Rigging</h4>
<ul>
  <li><strong>Humanoid Rig (20 Bones):</strong> Standard game-engine biped hierarchy (Root, Hips, Spine, Chest, Neck, Head, Left/Right Arms &amp; Legs) automatically fitted to your mesh's bounding volume.</li>
  <li><strong>Quadruped Beast Rig:</strong> Pelvis, Spine, Neck, Head, Tail, and 4 articulated legs.</li>
  <li><strong>Prop / Spine Chain:</strong> 5-bone articulated chain for tails, tentacles, banners, and turrets.</li>
</ul>

<h4><i class="app-icon" data-lucide="brush"></i> Interactive 3D Weight Painting</h4>
<ul>
  <li><strong>Weight Heatmap:</strong> Colors vertices from <strong>Blue (0.0)</strong> &rarr; Cyan &rarr; Green &rarr; Yellow &rarr; <strong>Red (1.0)</strong> to show the exact influence of the selected bone.</li>
  <li><strong>Add / Subtract / Smooth / Replace:</strong> Paint directly on the 3D mesh to refine how joints bend. Weights across all 4 bone slots per vertex are normalized to <code>1.0</code> automatically.</li>
  <li><strong>X-Symmetry:</strong> Automatically mirrors painted weights across Left (<code>_L</code>) and Right (<code>_R</code>) bones.</li>
  <li><strong>Joint Pose Bend Test:</strong> Rotate the active bone right in the viewport to test joint deformation and click <em>Reset Bind Pose</em> when finished.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!app?.service?.weightPaintController?.isActive;
  }

  public onActivate(app: any): void {
    app.service?.weightPaintController?.setActive(true);
    app.updatePanelButtonStates?.();
    app.updateRiggingUI?.();
  }

  public onDeactivate(app: any): void {
    app.service?.weightPaintController?.setActive(false);
    app.updatePanelButtonStates?.();
    app.updateRiggingUI?.();
  }

  public onOpen(app: any): void {
    this.onActivate(app);
    app.updateRiggingUI?.();
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
    app.updateRiggingUI?.();
  }
}

