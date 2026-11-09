import { AbstractEditorTool } from './AbstractEditorTool';

export class TextMeshEditorTool extends AbstractEditorTool {
  public readonly name = 'text_mesh';
  public readonly dialogId = 'dialog-text-mesh';
  public readonly triggerButtonId = 'btnToggleTextMeshTool';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = '3D Text';
  public readonly icon = 'type';
  public readonly order = 17;
  public readonly isExclusive3DTool = false;

  public readonly description =
    'Create and edit extruded 3D text meshes with customizable fonts, depth, curve resolution, and PBR materials.';

  public readonly helpText = `
    <h4>3D Text Tool</h4>
    <p>Generate and edit extruded 3D typography meshes directly in the scene.</p>
    <ul>
      <li><strong>Create 3D Text:</strong> Type your text, select a font family (<em>Kenney Future</em>, <em>Droid Sans Bold</em>, or <em>Droid Sans Regular</em>), adjust size, extrusion depth, and curve resolution, then click <strong>Create 3D Text</strong>.</li>
      <li><strong>Edit Existing Text:</strong> Select any 3D Text mesh in the viewport or Outliner. Its settings automatically load into the dialog so you can modify the text, font, depth, or material and click <strong>Update Selected</strong>.</li>
      <li><strong>Surface Placement:</strong> Enable <em>Shift + Left-Click in 3D view</em> to stamp new 3D text directly onto any clicked surface or ground point.</li>
    </ul>
  `;

  public onOpen(app: any): void {
    app.updateTextMeshUI?.();
  }

  public onClose(app: any): void {
    app.service?.textMeshController?.setSurfacePlacementActive(false);
  }

  public onUpdateUI(app: any): void {
    app.updateTextMeshUI?.();
  }
}

