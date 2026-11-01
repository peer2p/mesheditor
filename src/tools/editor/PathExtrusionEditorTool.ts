import { PathExtrusionStudio } from '../../pathExtrusion';
import { ToolInterface } from '../ToolInterface';

/**
 * Path Extrusion Tool.
 * Create 3D extrusions along smooth Catmull-Rom spline curves with 2D cross-section shapes.
 */
export class PathExtrusionEditorTool implements ToolInterface {
  public readonly name = 'path_extrusion';
  public readonly dialogId = 'dialog-path-extrusion';
  public readonly triggerButtonId = 'btnTogglePathExtrusion';
  public readonly toolbarButtonId = 'btnToolbarPathExtrusion';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Path Extrusion';
  public readonly icon = 'route';
  public readonly order = 7;
  public readonly isExclusive3DTool = true;
  public readonly defaultOpen = false;
  public readonly description =
    'Create 3D extrusions along smooth Catmull-Rom spline curves with 2D cross-section shapes.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Path Extrusion</strong> tool procedurally sweeps 2D cross-section profiles along smooth 3D Catmull-Rom spline curves to create pipes, roads, railings, rollercoasters, structural beams, and architectural moldings.</p>

<h4><i class="app-icon" data-lucide="sparkles"></i> Key Capabilities</h4>
<ul>
  <li><strong>Catmull-Rom 3D Splines:</strong> Smooth interpolation through interactive 3D control points.</li>
  <li><strong>Interactive 3D Gizmos:</strong> Click any spline point sphere in the scene to translate it along X, Y, and Z axes with precision.</li>
  <li><strong>Cross-Section Presets:</strong> Pipe, Hollow Pipe, Flat Ribbon, U-Profile, Rectangle, Star, and Triangle.</li>
  <li><strong>Path Extrusion Studio:</strong> A dedicated 2D vector canvas to interactively sketch, pan, zoom, and sculpt custom cross-section contours.</li>
  <li><strong>Procedural Modifiers:</strong> Live controls for curve smooth steps, profile width, height, thickness, twist rotation, and scale tapers.</li>
  <li><strong>Bake Mesh:</strong> Generates a clean, watertight 3D solid in the scene ready for export (.glb, .obj, .stl).</li>
</ul>

<h4><i class="app-icon" data-lucide="list-ordered"></i> Getting Started</h4>
<ul>
  <li>Click <strong>➕ Add Path</strong> in the panel or in the Studio to create your first path extrusion curve.</li>
  <li>Shift + Click in the 3D scene to add more spline anchor points.</li>
  <li>Click <strong>Open Studio</strong> to customize the 2D cross-section profile.</li>
</ul>
`.trim();

  public isActive(app: any): boolean {
    return !!app?.service?.pathExtrusion?.isActive;
  }

  public onOpen(app: any): void {
    app.service.pathExtrusion.setActive(true);
    app.renderPathExtrusionUI?.();
    PathExtrusionStudio.open(app.service, app.service.pathExtrusion, () => {
      app.updatePanelButtonStates?.();
    });
    app.showToast?.('Path Extrusion Studio active. 2D Cross-section canvas ready.', 'info');
  }

  public onClose(app: any): void {
    app.service.pathExtrusion.setActive(false);
    PathExtrusionStudio.close();
  }

  public onMinimize(app: any): void {
    app.service.pathExtrusion.setActive(false);
    PathExtrusionStudio.close();
  }

  public onMaximize(app: any): void {
    app.service.pathExtrusion.setActive(true);
  }

  public onUpdateUI(app: any): void {
    app.renderPathExtrusionUI?.();
  }
}

