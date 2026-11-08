import { AbstractEditorTool } from './AbstractEditorTool';

/**
 * Compress Model Editor Tool.
 * In-browser 3D model size optimizer: welds duplicate vertices, culls unused geometry
 * and degenerate facets, applies Draco compression, and optimizes textures.
 */
export class CompressModelEditorTool extends AbstractEditorTool {
  public readonly name = 'compress_model';
  public readonly dialogId = 'dialog-compress-model';
  public readonly triggerButtonId = 'btnToggleCompressModel';
  public readonly menuId = 'menuTools';
  public readonly menuLabel = 'Compress Model';
  public readonly icon = 'file-archive';
  public readonly order = 12;
  public readonly defaultOpen = false;
  public readonly description =
    'Reduce 3D model file size in browser: weld duplicate vertices, cull unused geometry, and apply Draco compression.';

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Compress Model</strong> tool reduces 3D file size directly in your browser. All processing is 100% client-side with zero cloud uploads and no account required.</p>

<h4><i class="app-icon" data-lucide="layers"></i> Supported Formats</h4>
<ul>
  <li><strong>Input:</strong> GLB, GLTF, OBJ, STL, PLY, and FBX files.</li>
  <li><strong>Output:</strong> GLB (with Draco support), standard glTF, OBJ, or STL.</li>
</ul>

<h4><i class="app-icon" data-lucide="sparkles"></i> Compression Levels</h4>
<ul>
  <li><strong>Lossless (Standard):</strong> Welds duplicate vertices, removes unreferenced vertex buffers, and cleans degenerate zero-area faces. <em>100% of valid polygons are preserved with zero visual degradation.</em></li>
  <li><strong>Draco Compression (High):</strong> Applies geometry cleanup plus Khronos Draco bitstream encoding (GLB/GLTF) for drastic file size reductions (up to 70%–85%).</li>
  <li><strong>Draco Compression (Ultra):</strong> Maximizes Draco quantization for ultra-compact network streaming and mobile transmission.</li>
  <li><strong>Polygon Decimation (Lossy):</strong> Simplifies mesh face count to a target percentage using Quadric Error Metrics while retaining overall shape and silhouette.</li>
  <li><strong>Custom:</strong> Fine-tune vertex welding tolerances, normal and UV preservation, and WebP texture compression.</li>
</ul>

<h4><i class="app-icon" data-lucide="mouse-pointer"></i> Workflow</h4>
<ul>
  <li><strong>Active Scene:</strong> Optimize the currently selected 3D mesh or whole scene in-place with full Undo (<kbd>Cmd+Z</kbd>) support.</li>
  <li><strong>Import 3D File:</strong> Drag and drop any 3D model file into the drop zone to compress and download immediately without disrupting your active canvas.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.updateCompressModelUI?.();
  }

  public onUpdateUI(app: any): void {
    app.updateCompressModelUI?.();
  }
}

