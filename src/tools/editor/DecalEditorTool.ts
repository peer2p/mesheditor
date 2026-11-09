import { AbstractEditorTool } from './AbstractEditorTool';

export class DecalEditorTool extends AbstractEditorTool {
  public readonly name = 'decal_painter';
  public readonly dialogId = 'dialog-decal';
  public readonly triggerButtonId = 'btnToggleDecalTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Decal Painter';
  public readonly icon = 'stamp';
  public readonly order = 18;
  public readonly isExclusive3DTool = true;

  public readonly description =
    'Project and paint 2D decals (foliage, cracks, bullet impacts, runes, or AI-generated textures) onto 3D meshes and fuse them into the mesh on export.';

  public readonly helpText = `
    <h4>Decal Painter Tool</h4>
    <p>Paint surface details, stickers, foliage, wear-and-tear, or custom AI textures directly onto 3D meshes.</p>
    <ul>
      <li><strong>Left-Click on Mesh:</strong> Projects and stamps the selected decal onto the surface under your cursor.</li>
      <li><strong>Right-Click on Decal:</strong> Removes an unmerged decal under the cursor.</li>
      <li><strong>Keyboard Shortcuts:</strong> Press <kbd>Q</kbd> / <kbd>E</kbd> to rotate the decal by 15&deg;, or <kbd>[</kbd> / <kbd>]</kbd> to resize the decal projector.</li>
      <li><strong>Mesh Fusion &amp; Export:</strong> Click <strong>Merge Decals into Mesh</strong> at any time to fuse placed decals into the target mesh geometry (with normal-offset submeshes), or simply export your model &mdash; unmerged decals are automatically fused into the mesh during export.</li>
    </ul>
  `;

  public onOpen(app: any): void {
    app.service?.decalController?.setActive(true);
    app.updateDecalUI?.();
  }

  public onClose(app: any): void {
    app.service?.decalController?.setActive(false);
    app.updateDecalUI?.();
  }

  public onUpdateUI(app: any): void {
    app.updateDecalUI?.();
  }

  public isActive(app: any): boolean {
    return Boolean(app.service?.decalController?.isActive);
  }
}

