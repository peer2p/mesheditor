import { Vector3 } from '@babylonjs/core';
import type { MeshEditorService } from '../MeshEditorService';
import { PathExtrusionController } from './PathExtrusionController';
import { PathFactory } from './PathFactory';
import { PathExtrusionItem, PresetShapeName, SolidShape } from './types';

const STYLE_ID = 'path-extrusion-studio-style';

const CSS = `
.pes-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  pointer-events: none;
}
.pes-dialog {
  background: #181d29;
  color: #e2e8f0;
  width: min(780px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px #2e384d;
  overflow: hidden;
  position: absolute;
  pointer-events: auto;
}
.pes-header {
  padding: 10px 16px;
  background: #1e2433;
  border-bottom: 1px solid #2e384d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  gap: 12px;
}
.pes-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.pes-header-title {
  font-size: 14px;
  font-weight: 700;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.pes-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pes-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}
.pes-close-btn:hover {
  background: #334155;
  color: #fff;
}
.pes-tabs {
  display: flex;
  background: #141824;
  border-bottom: 1px solid #2e384d;
  padding: 0 12px;
  gap: 4px;
  overflow-x: auto;
}
.pes-tab {
  padding: 9px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.pes-tab:hover {
  color: #f1f5f9;
}
.pes-tab.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  background: rgba(56, 189, 248, 0.06);
}
.pes-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pes-section {
  background: #1e2433;
  border: 1px solid #2d3748;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pes-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pes-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pes-row > label {
  width: 150px;
  min-width: 150px;
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
.pes-row-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pes-input {
  background: #111520;
  color: #f1f5f9;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}
.pes-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  color-scheme: dark;
  background-color: #21262d;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px 12px;
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 2px 26px 2px 8px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.pes-input:focus {
  border-color: #38bdf8;
}
.pes-select:hover {
  background-color: #282e37;
  border-color: rgba(255, 255, 255, 0.28);
}
.pes-select:focus {
  background-color: #1c2128;
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
}
.pes-select option {
  background: #161b22;
  color: #f0f6fc;
  padding: 6px 10px;
}
.pes-input[type=number] {
  width: 75px;
}
.pes-slider {
  flex: 1;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  outline: none;
  accent-color: #38bdf8;
  cursor: pointer;
}
.pes-btn {
  background: #334155;
  color: #f8fafc;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  user-select: none;
}
.pes-btn:hover {
  background: #475569;
}
.pes-btn.primary {
  background: #2563eb;
  border-color: #3b82f6;
}
.pes-btn.primary:hover {
  background: #1d4ed8;
}
.pes-btn.success {
  background: #16a34a;
  border-color: #22c55e;
}
.pes-btn.success:hover {
  background: #15803d;
}
.pes-btn.accent {
  background: #0284c7;
  border-color: #38bdf8;
}
.pes-btn.accent:hover {
  background: #0369a1;
}
.pes-btn.danger {
  background: #dc2626;
  border-color: #ef4444;
}
.pes-btn.danger:hover {
  background: #b91c1c;
}
.pes-btn.small {
  padding: 3px 6px;
  font-size: 11px;
}
.pes-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #0f766e;
  color: #ccfbf1;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.pes-footer {
  padding: 10px 18px;
  background: #1e2433;
  border-top: 1px solid #2e384d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pes-canvas-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0b0f19;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
}
.pes-canvas {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
  cursor: grab;
  display: block;
  width: 100%;
  max-width: 720px;
  aspect-ratio: 2 / 1;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.6);
}
.pes-canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
  justify-content: center;
}
.pes-canvas-hint {
  font-size: 11px;
  color: #64748b;
  text-align: center;
  line-height: 1.4;
  user-select: none;
}
.pes-table-container {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #111520;
}
.pes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.pes-table th {
  background: #1e2433;
  color: #94a3b8;
  text-align: left;
  padding: 5px 8px;
  position: sticky;
  top: 0;
  border-bottom: 1px solid #334155;
}
.pes-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #1e293b;
}
.pes-table tr:hover {
  background: rgba(56, 189, 248, 0.05);
}
`;

export class PathExtrusionStudio {
  private static instance: PathExtrusionStudio | null = null;

  private overlay!: HTMLDivElement;
  private dialog!: HTMLDivElement;
  private activeTab: 'shape' | 'mesh' | 'curve' = 'shape';

  // Draggable state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dialogStartX = 0;
  private dialogStartY = 0;

  // Header controls
  private pathSelect!: HTMLSelectElement;

  // Tabs
  private tabButtons: Map<string, HTMLButtonElement> = new Map();
  private tabContents: Map<string, HTMLDivElement> = new Map();

  // 2D Canvas Editor state
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private canvasWidth = 720;
  private canvasHeight = 360;
  private scale = 45; // pixels per world meter
  private panX = 0;
  private panY = 0;
  private isCanvasDragging = false;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private draggedVertexIndex: number | null = null;
  private hoveredVertexIndex: number | null = null;
  private hoveredEdgeIndex: number | null = null;
  private snapGrid = 0.1; // meters
  private mouseWorldCoord = { x: 0, y: 0 };

  // Preset parameters state
  private currentPreset: PresetShapeName = 'pipe';
  private presetSegments = 16;
  private presetRadius = 1.5;
  private presetWidth = 3;
  private presetHeight = 0.5;
  private presetDepth = 0.5;
  private presetThickness = 0.2;
  private presetExcludeBottom = 0;
  private presetStarPoints = 5;
  private presetOuterRadius = 2;
  private presetInnerRadius = 0.9;

  // Throttled 3D update
  private updateTimer: any = null;

  public constructor(
    private service: MeshEditorService,
    private controller: PathExtrusionController,
    private onCloseCallback: () => void = () => {}
  ) {
    this.injectStyle();
    this.createDOM();
    this.detectCurrentPreset();
    this.renderActiveTab();
    this.fitCanvasView();
    PathExtrusionStudio.instance = this;
  }

  public static open(
    service: MeshEditorService,
    controller: PathExtrusionController,
    onClose: () => void = () => {}
  ): PathExtrusionStudio {
    if (PathExtrusionStudio.instance && document.body.contains(PathExtrusionStudio.instance.overlay)) {
      PathExtrusionStudio.instance.refresh();
      return PathExtrusionStudio.instance;
    }
    if (PathExtrusionStudio.instance) {
      PathExtrusionStudio.instance.close();
    }
    return new PathExtrusionStudio(service, controller, onClose);
  }

  public static close(): void {
    if (PathExtrusionStudio.instance) {
      PathExtrusionStudio.instance.close();
    }
  }

  public static isOpen(): boolean {
    return !!PathExtrusionStudio.instance;
  }

  private injectStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  public close(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    PathExtrusionStudio.instance = null;
    this.onCloseCallback();
  }

  public refresh(): void {
    this.updatePathDropdown();
    this.renderActiveTab();
    this.redrawCanvas();
  }

  private getActivePath(): PathExtrusionItem | undefined {
    return this.controller.activePath || undefined;
  }

  private triggerWYSIWYGUpdate(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.controller.updatePreviewMesh();
      this.controller.onStateChanged?.();
    }, 16);
  }

  // ─── DOM Building ──────────────────────────────────────────────────────────

  private createDOM(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pes-overlay';

    this.dialog = document.createElement('div');
    this.dialog.className = 'pes-dialog';
    this.dialog.id = 'pathExtrusionStudioDialog';

    this.dialog.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
    });
    this.dialog.addEventListener('keyup', (e) => e.stopPropagation());

    // 1. Header
    const header = document.createElement('div');
    header.className = 'pes-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'pes-header-left';

    const headerTitle = document.createElement('div');
    headerTitle.className = 'pes-header-title';
    headerTitle.innerHTML = `<span>🛣️</span><span>Path Extrusion Studio</span>`;

    this.pathSelect = document.createElement('select');
    this.pathSelect.className = 'pes-select';
    this.pathSelect.style.maxWidth = '260px';
    this.pathSelect.onchange = () => {
      this.controller.selectPath(this.pathSelect.value);
      this.detectCurrentPreset();
      this.renderActiveTab();
      this.redrawCanvas();
    };
    this.updatePathDropdown();

    headerLeft.append(headerTitle, this.pathSelect);

    const headerActions = document.createElement('div');
    headerActions.className = 'pes-header-actions';

    const newBtn = document.createElement('button');
    newBtn.className = 'pes-btn small primary';
    newBtn.innerHTML = '➕ New';
    newBtn.title = 'Add new path extrusion';
    newBtn.onclick = () => {
      this.controller.addNewPath();
      this.detectCurrentPreset();
      this.refresh();
    };

    const dupBtn = document.createElement('button');
    dupBtn.className = 'pes-btn small';
    dupBtn.innerHTML = '📑 Clone';
    dupBtn.title = 'Clone active path extrusion';
    dupBtn.onclick = () => {
      this.controller.duplicateActivePathway();
      this.refresh();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'pes-btn small danger';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete active path extrusion';
    delBtn.onclick = () => {
      if (confirm('Delete this path extrusion?')) {
        this.controller.deleteActivePathway();
        this.refresh();
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pes-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close Studio';
    closeBtn.onclick = () => this.close();

    headerActions.append(newBtn, dupBtn, delBtn, closeBtn);
    header.append(headerLeft, headerActions);
    this.dialog.appendChild(header);

    this.setupDraggableHeader(header);

    // 2. Tabs
    const tabsBar = document.createElement('div');
    tabsBar.className = 'pes-tabs';

    const createTabBtn = (id: 'shape' | 'mesh' | 'curve', label: string) => {
      const btn = document.createElement('button');
      btn.className = `pes-tab ${this.activeTab === id ? 'active' : ''}`;
      btn.innerHTML = label;
      btn.onclick = () => {
        this.activeTab = id;
        this.tabButtons.forEach((b, k) => b.classList.toggle('active', k === id));
        this.tabContents.forEach((c, k) => (c.style.display = k === id ? 'flex' : 'none'));
        if (id === 'shape') {
          this.fitCanvasView();
        }
      };
      this.tabButtons.set(id, btn);
      tabsBar.appendChild(btn);
    };

    createTabBtn('shape', '🎨 2D Shape');
    createTabBtn('mesh', '🧱 Extrusion Mesh & Materials');
    createTabBtn('curve', '🛤️ Path Trajectory');

    this.dialog.appendChild(tabsBar);

    // 3. Body & Tab Contents
    const body = document.createElement('div');
    body.className = 'pes-body';

    const shapeContent = document.createElement('div');
    shapeContent.style.display = this.activeTab === 'shape' ? 'flex' : 'none';
    shapeContent.style.flexDirection = 'column';
    shapeContent.style.gap = '14px';
    this.tabContents.set('shape', shapeContent);
    body.appendChild(shapeContent);

    const meshContent = document.createElement('div');
    meshContent.style.display = this.activeTab === 'mesh' ? 'flex' : 'none';
    meshContent.style.flexDirection = 'column';
    meshContent.style.gap = '14px';
    this.tabContents.set('mesh', meshContent);
    body.appendChild(meshContent);

    const curveContent = document.createElement('div');
    curveContent.style.display = this.activeTab === 'curve' ? 'flex' : 'none';
    curveContent.style.flexDirection = 'column';
    curveContent.style.gap = '14px';
    this.tabContents.set('curve', curveContent);
    body.appendChild(curveContent);

    this.dialog.appendChild(body);

    // 4. Footer
    const footer = document.createElement('div');
    footer.className = 'pes-footer';

    const leftFoot = document.createElement('div');
    leftFoot.style.display = 'flex';
    leftFoot.style.gap = '8px';

    const rebuildBtn = document.createElement('button');
    rebuildBtn.className = 'pes-btn accent';
    rebuildBtn.innerHTML = '🔄 Rebuild Active Extrusion';
    rebuildBtn.onclick = () => this.controller.rebuildActivePathway();

    const rebuildAllBtn = document.createElement('button');
    rebuildAllBtn.className = 'pes-btn';
    rebuildAllBtn.innerHTML = '🔄 Rebuild All';
    rebuildAllBtn.onclick = () => this.controller.rebuildAll();

    leftFoot.append(rebuildBtn, rebuildAllBtn);

    const rightFoot = document.createElement('div');
    rightFoot.style.display = 'flex';
    rightFoot.style.gap = '8px';

    const bakeBtn = document.createElement('button');
    bakeBtn.className = 'pes-btn success';
    bakeBtn.innerHTML = '📦 Bake Mesh';
    bakeBtn.title = 'Bake extrusion into a permanent 3D mesh in the scene';
    bakeBtn.onclick = () => {
      const mesh = this.controller.bakeMesh();
      if (mesh) {
        bakeBtn.innerHTML = 'Baked ✓';
        setTimeout(() => (bakeBtn.innerHTML = '📦 Bake Mesh'), 2000);
      }
    };

    const doneBtn = document.createElement('button');
    doneBtn.className = 'pes-btn';
    doneBtn.innerHTML = 'Done';
    doneBtn.onclick = () => this.close();

    rightFoot.append(bakeBtn, doneBtn);
    footer.append(leftFoot, rightFoot);
    this.dialog.appendChild(footer);

    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);
  }

  private setupDraggableHeader(header: HTMLElement): void {
    header.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'SELECT') return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.dialog.getBoundingClientRect();
      this.dialogStartX = rect.left;
      this.dialogStartY = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.dialog.style.left = `${this.dialogStartX + dx}px`;
      this.dialog.style.top = `${this.dialogStartY + dy}px`;
      this.dialog.style.transform = 'none';
      this.dialog.style.margin = '0';
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  private updatePathDropdown(): void {
    if (!this.pathSelect) return;
    this.pathSelect.innerHTML = '';
    const paths = this.controller.paths || [];
    if (paths.length === 0) {
      const opt = document.createElement('option');
      opt.text = 'No path extrusions defined';
      opt.value = '-1';
      this.pathSelect.appendChild(opt);
      return;
    }

    paths.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const shapeType = p.shape ? `${p.shape.length}p shape` : p.shapeConfig.shapeType;
      opt.text = `${p.name || `Path Extrusion #${idx + 1}`} (${shapeType}, ${p.points.length} pts)`;
      if (p.id === this.controller.activePathId) opt.selected = true;
      this.pathSelect.appendChild(opt);
    });
  }

  private renderActiveTab(): void {
    const p = this.getActivePath();
    if (!p) {
      this.tabContents.forEach((c) => {
        c.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8;">
          No path extrusions exist yet.<br><br>
          <button class="pes-btn primary" id="pesCreateFirstBtn">➕ Create First Path Extrusion</button>
        </div>`;
        const btn = c.querySelector('#pesCreateFirstBtn');
        if (btn) (btn as HTMLElement).onclick = () => {
          this.controller.addNewPath();
          this.refresh();
        };
      });
      return;
    }

    this.renderShapeTab(p);
    this.renderMeshTab(p);
    this.renderCurveTab(p);
  }

  // ─── TAB 1: 2D Shape & Canvas ───────────────────────────────────────

  private renderShapeTab(p: PathExtrusionItem): void {
    const container = this.tabContents.get('shape');
    if (!container) return;
    container.innerHTML = '';

    // Section 1: Presets Toolbar
    const presetSection = document.createElement('div');
    presetSection.className = 'pes-section';

    const pHeader = document.createElement('div');
    pHeader.className = 'pes-section-title';
    pHeader.innerHTML = '<span>📐 2D Shape Presets (PathFactory)</span>';
    presetSection.appendChild(pHeader);

    const presetRow = document.createElement('div');
    presetRow.className = 'pes-row';
    const presetLabel = document.createElement('label');
    presetLabel.textContent = 'Shape Generator:';
    const presetContent = document.createElement('div');
    presetContent.className = 'pes-row-content';

    const presetDropdown = document.createElement('select');
    presetDropdown.className = 'pes-select';
    presetDropdown.style.flex = '1';

    const PRESETS: { id: PresetShapeName; label: string }[] = [
      { id: 'custom', label: '✏️ Custom Shape (Drawn on Canvas)' },
      { id: 'pipe', label: '⭕ Round Pipe (PathFactory.shapePipe)' },
      { id: 'flatPipe', label: '💊 Flat Pipe (PathFactory.shapeFlatPipe)' },
      { id: 'circle', label: '⚪ Circle Disc (PathFactory.shapeCircle)' },
      { id: 'rectangle', label: '⬛ Rectangle / Box (PathFactory.shapeRectangle)' },
      { id: 'uProfile', label: '🕳️ U-Profile / Gutter (PathFactory.shapeUProfile)' },
      { id: 'halfpipe', label: '🛹 Halfpipe (PathFactory.shapeHalfpipe)' },
      { id: 'triangle', label: '▲ Triangle (PathFactory.shapeTriangle)' },
      { id: 'ellipse', label: '⬭ Ellipse (PathFactory.shapeEllipse)' },
      { id: 'star', label: '⭐ Star (PathFactory.shapeStar)' },
      { id: 'horizontalLine', label: '━ Horizontal Track (PathFactory.shapeHorizontalLine)' },
      { id: 'verticalLine', label: '┃ Vertical Wall (PathFactory.shapeVerticalLine)' },
      { id: 'halfCircle', label: '◖ Half Circle (PathFactory.shapeHalfCircle)' },
    ];

    PRESETS.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.text = item.label;
      if (item.id === this.currentPreset) opt.selected = true;
      presetDropdown.appendChild(opt);
    });

    presetContent.appendChild(presetDropdown);
    presetRow.append(presetLabel, presetContent);
    presetSection.appendChild(presetRow);

    // Preset Dynamic Parameters Container
    const paramsContainer = document.createElement('div');
    paramsContainer.style.display = 'flex';
    paramsContainer.style.flexDirection = 'column';
    paramsContainer.style.gap = '8px';
    presetSection.appendChild(paramsContainer);

    const updatePresetParamsUI = () => {
      paramsContainer.innerHTML = '';
      if (this.currentPreset === 'custom') return;

      const addSlider = (label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) => {
        const row = document.createElement('div');
        row.className = 'pes-row';
        const lbl = document.createElement('label');
        lbl.textContent = label;
        const cnt = document.createElement('div');
        cnt.className = 'pes-row-content';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'pes-slider';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();

        const num = document.createElement('input');
        num.type = 'number';
        num.className = 'pes-input';
        num.min = min.toString();
        num.max = max.toString();
        num.step = step.toString();
        num.value = value.toString();

        const sync = (v: number) => {
          slider.value = v.toString();
          num.value = v.toString();
          onChange(v);
          this.applyPresetToActivePath();
        };

        slider.oninput = () => sync(parseFloat(slider.value));
        num.onchange = () => sync(parseFloat(num.value));

        cnt.append(slider, num);
        row.append(lbl, cnt);
        paramsContainer.appendChild(row);
      };

      if (this.currentPreset === 'pipe') {
        addSlider('Segments:', 4, 32, 1, this.presetSegments, (v) => (this.presetSegments = v));
        addSlider('Radius:', 0.2, 8, 0.1, this.presetRadius, (v) => (this.presetRadius = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
        addSlider('Exclude Bottom Pts:', 0, 16, 1, this.presetExcludeBottom, (v) => (this.presetExcludeBottom = v));
      } else if (this.currentPreset === 'flatPipe') {
        addSlider('Segments:', 4, 32, 1, this.presetSegments, (v) => (this.presetSegments = v));
        addSlider('Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Height:', 0.1, 5, 0.05, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'circle') {
        addSlider('Segments:', 4, 32, 1, this.presetSegments, (v) => (this.presetSegments = v));
        addSlider('Radius:', 0.2, 8, 0.1, this.presetRadius, (v) => (this.presetRadius = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'rectangle') {
        addSlider('Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Height:', 0.1, 5, 0.05, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'uProfile') {
        addSlider('Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Wall Height:', 0.1, 5, 0.05, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Thickness:', 0.05, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'halfpipe') {
        addSlider('Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Height:', 0.1, 5, 0.05, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Depth:', 0.1, 5, 0.05, this.presetDepth, (v) => (this.presetDepth = v));
        addSlider('Thickness:', 0.05, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'triangle') {
        addSlider('Base Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Height:', 0.2, 8, 0.1, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'ellipse') {
        addSlider('Segments:', 4, 32, 1, this.presetSegments, (v) => (this.presetSegments = v));
        addSlider('Width:', 0.5, 10, 0.1, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Height:', 0.1, 5, 0.05, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Thickness:', 0, 2, 0.05, this.presetThickness, (v) => (this.presetThickness = v));
      } else if (this.currentPreset === 'star') {
        addSlider('Star Points:', 3, 12, 1, this.presetStarPoints, (v) => (this.presetStarPoints = v));
        addSlider('Outer Radius:', 0.5, 8, 0.1, this.presetOuterRadius, (v) => (this.presetOuterRadius = v));
        addSlider('Inner Radius:', 0.2, 5, 0.1, this.presetInnerRadius, (v) => (this.presetInnerRadius = v));
      } else if (this.currentPreset === 'horizontalLine') {
        addSlider('Width:', 0.5, 15, 0.2, this.presetWidth, (v) => (this.presetWidth = v));
        addSlider('Segments:', 2, 16, 1, this.presetSegments, (v) => (this.presetSegments = v));
      } else if (this.currentPreset === 'verticalLine') {
        addSlider('Height:', 0.5, 15, 0.2, this.presetHeight, (v) => (this.presetHeight = v));
        addSlider('Segments:', 2, 16, 1, this.presetSegments, (v) => (this.presetSegments = v));
      } else if (this.currentPreset === 'halfCircle') {
        addSlider('Segments:', 4, 32, 1, this.presetSegments, (v) => (this.presetSegments = v));
        addSlider('Radius:', 0.2, 8, 0.1, this.presetRadius, (v) => (this.presetRadius = v));
      }
    };

    presetDropdown.onchange = () => {
      this.currentPreset = presetDropdown.value as PresetShapeName;
      updatePresetParamsUI();
      if (this.currentPreset !== 'custom') {
        this.applyPresetToActivePath();
      }
    };
    updatePresetParamsUI();

    container.appendChild(presetSection);

    // Section 2: Interactive 2D Canvas Editor
    const canvasSection = document.createElement('div');
    canvasSection.className = 'pes-section';

    const cHeader = document.createElement('div');
    cHeader.className = 'pes-section-title';
    cHeader.innerHTML = `
      <span>🎨 Interactive 2D Cross-Section Canvas</span>
      <div style="display:flex; gap:12px; align-items:center;">
        <span id="pesCanvasZoom" style="color:#38bdf8; font-size:11px; font-weight:600;">Scale: 45 px/m</span>
        <span id="pesMouseCoord" style="color:#94a3b8; font-size:11px;">X: 0.00m, Y: 0.00m</span>
      </div>
    `;
    canvasSection.appendChild(cHeader);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'pes-canvas-container';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pes-canvas';
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvasInteractions();
    canvasContainer.appendChild(this.canvas);

    // Canvas Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'pes-canvas-toolbar';

    const fitBtn = document.createElement('button');
    fitBtn.className = 'pes-btn small accent';
    fitBtn.innerHTML = '🎯 Fit View';
    fitBtn.title = 'Automatically frame all shape points within the canvas';
    fitBtn.onclick = () => this.fitCanvasView();

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'pes-btn small';
    zoomInBtn.innerHTML = '➕ Zoom In';
    zoomInBtn.onclick = () => {
      this.scale = Math.min(400, this.scale * 1.25);
      this.redrawCanvas();
    };

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'pes-btn small';
    zoomOutBtn.innerHTML = '➖ Zoom Out';
    zoomOutBtn.onclick = () => {
      this.scale = Math.max(2, this.scale * 0.8);
      this.redrawCanvas();
    };

    const resetPanBtn = document.createElement('button');
    resetPanBtn.className = 'pes-btn small';
    resetPanBtn.innerHTML = '↺ Center View';
    resetPanBtn.title = 'Reset pan and scale to default center';
    resetPanBtn.onclick = () => {
      this.panX = 0;
      this.panY = 0;
      this.scale = 45;
      this.redrawCanvas();
    };

    const shape = p.shape as SolidShape | undefined;
    const isClosed = shape?.closedShape ?? p.shapeConfig.closedShape ?? true;
    const closedBtn = document.createElement('button');
    closedBtn.className = `pes-btn small ${isClosed ? 'accent' : ''}`;
    closedBtn.innerHTML = `🔲 Closed: ${isClosed ? 'Yes' : 'No'}`;
    closedBtn.onclick = () => {
      if (p.shape) {
        (p.shape as SolidShape).closedShape = !isClosed;
        p.shapeConfig.closedShape = !isClosed;
        this.currentPreset = 'custom';
        this.renderActiveTab();
        this.triggerWYSIWYGUpdate();
      }
    };

    const flipHBtn = document.createElement('button');
    flipHBtn.className = 'pes-btn small';
    flipHBtn.innerHTML = '↔️ Flip H';
    flipHBtn.onclick = () => {
      if (p.shape) {
        p.shape.forEach((pt) => (pt.x = -pt.x));
        this.currentPreset = 'custom';
        this.renderActiveTab();
        this.triggerWYSIWYGUpdate();
      }
    };

    const flipVBtn = document.createElement('button');
    flipVBtn.className = 'pes-btn small';
    flipVBtn.innerHTML = '↕️ Flip V';
    flipVBtn.onclick = () => {
      if (p.shape) {
        p.shape.forEach((pt) => (pt.y = -pt.y));
        this.currentPreset = 'custom';
        this.renderActiveTab();
        this.triggerWYSIWYGUpdate();
      }
    };

    const centerBtn = document.createElement('button');
    centerBtn.className = 'pes-btn small';
    centerBtn.innerHTML = '🎯 Center Shape';
    centerBtn.onclick = () => this.centerShape();

    const snapSelect = document.createElement('select');
    snapSelect.className = 'pes-select small';
    snapSelect.innerHTML = `
      <option value="0.05">Snap: 0.05</option>
      <option value="0.1" selected>Snap: 0.10</option>
      <option value="0.25">Snap: 0.25</option>
      <option value="0">Snap: Off</option>
    `;
    snapSelect.onchange = () => (this.snapGrid = parseFloat(snapSelect.value));

    toolbar.append(fitBtn, zoomInBtn, zoomOutBtn, resetPanBtn, closedBtn, flipHBtn, flipVBtn, centerBtn, snapSelect);
    canvasContainer.appendChild(toolbar);

    const hint = document.createElement('div');
    hint.className = 'pes-canvas-hint';
    hint.innerHTML = '💡 <b>Controls:</b> Drag vertices • Click edge to add point • Right-click vertex to delete • Drag background to pan • Wheel to zoom';
    canvasContainer.appendChild(hint);

    canvasSection.appendChild(canvasContainer);

    // Section 3: Vertex Coordinates Table
    const tableSection = document.createElement('div');
    tableSection.className = 'pes-section';

    const tHeader = document.createElement('div');
    tHeader.className = 'pes-section-title';
    const numPoints = p.shape ? p.shape.length : 0;
    const solidHalf = (p.shape as SolidShape)?.solidHalfCount || p.shapeConfig.solidHalfCount || 0;
    tHeader.innerHTML = `<span>📋 Shape Vertices (${numPoints} points, solidHalf: ${solidHalf})</span>`;
    tableSection.appendChild(tHeader);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'pes-table-container';

    const table = document.createElement('table');
    table.className = 'pes-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>X (Right)</th>
          <th>Y (Up)</th>
          <th>Ring</th>
          <th style="width:40px;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    if (p.shape) {
      p.shape.forEach((pt, i) => {
        const tr = document.createElement('tr');
        const isInner = solidHalf > 0 && i >= solidHalf;
        tr.innerHTML = `
          <td style="color:${isInner ? '#fb923c' : '#38bdf8'}; font-weight:600;">${i}</td>
          <td><input type="number" step="0.05" class="pes-input" style="width:70px; padding:2px 4px;" value="${pt.x.toFixed(2)}" data-idx="${i}" data-coord="x"></td>
          <td><input type="number" step="0.05" class="pes-input" style="width:70px; padding:2px 4px;" value="${pt.y.toFixed(2)}" data-idx="${i}" data-coord="y"></td>
          <td style="font-size:10px; color:${isInner ? '#fb923c' : '#94a3b8'};">${isInner ? 'Inner Ring' : 'Outer Loop'}</td>
          <td><button class="pes-btn small danger" style="padding:1px 5px;" data-del="${i}">✕</button></td>
        `;

        tr.querySelectorAll('input').forEach((inp) => {
          inp.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            const idx = parseInt(target.dataset.idx!, 10);
            const coord = target.dataset.coord as 'x' | 'y';
            p.shape![idx][coord] = parseFloat(target.value) || 0;
            this.currentPreset = 'custom';
            this.redrawCanvas();
            this.triggerWYSIWYGUpdate();
          };
        });

        tr.querySelector('button')?.addEventListener('click', () => {
          if (p.shape && p.shape.length > 3) {
            p.shape.splice(i, 1);
            this.currentPreset = 'custom';
            this.renderActiveTab();
            this.redrawCanvas();
            this.triggerWYSIWYGUpdate();
          }
        });

        tbody.appendChild(tr);
      });
    }

    tableWrap.appendChild(table);
    tableSection.appendChild(tableWrap);

    container.append(presetSection, canvasSection, tableSection);
  }

  private detectCurrentPreset(): void {
    const p = this.getActivePath();
    if (!p) {
      this.currentPreset = 'pipe';
      return;
    }
    this.currentPreset = p.shapeConfig.shapeType || 'custom';
  }

  private applyPresetToActivePath(): void {
    const p = this.getActivePath();
    if (!p) return;

    let points: SolidShape = [];
    switch (this.currentPreset) {
      case 'pipe':
        points = PathFactory.shapePipe(this.presetSegments, this.presetRadius, this.presetThickness, this.presetExcludeBottom);
        break;
      case 'flatPipe':
        points = PathFactory.shapeFlatPipe(this.presetSegments, this.presetWidth, this.presetHeight, this.presetThickness);
        break;
      case 'circle':
        points = PathFactory.shapeCircle(this.presetSegments, this.presetRadius, this.presetThickness);
        break;
      case 'rectangle':
        points = PathFactory.shapeRectangle(this.presetWidth, this.presetHeight, this.presetThickness);
        break;
      case 'uProfile':
        points = PathFactory.shapeUProfile(this.presetWidth, this.presetHeight, this.presetThickness);
        break;
      case 'halfpipe':
        points = PathFactory.shapeHalfpipe(this.presetWidth, this.presetHeight, this.presetDepth, this.presetThickness);
        break;
      case 'triangle':
        points = PathFactory.shapeTriangle(this.presetWidth, this.presetHeight, this.presetThickness);
        break;
      case 'ellipse':
        points = PathFactory.shapeEllipse(this.presetSegments, this.presetWidth, this.presetHeight, this.presetThickness);
        break;
      case 'star':
        points = PathFactory.shapeStar(this.presetStarPoints, this.presetOuterRadius, this.presetInnerRadius);
        break;
      case 'horizontalLine':
        points = PathFactory.shapeHorizontalLine(this.presetWidth, this.presetSegments);
        break;
      case 'verticalLine':
        points = PathFactory.shapeVerticalLine(this.presetHeight, this.presetSegments);
        break;
      case 'halfCircle':
        points = PathFactory.shapeHalfCircle(this.presetSegments, this.presetRadius);
        break;
      default:
        return;
    }

    p.shape = points;
    p.shapeConfig.shapeType = this.currentPreset;
    p.shapeConfig.solidHalfCount = points.solidHalfCount;
    p.shapeConfig.closedShape = points.closedShape;

    const dims = this.getShapeDimensions(points);
    p.shapeConfig.width = parseFloat(dims.width.toFixed(2));
    p.shapeConfig.height = parseFloat(dims.height.toFixed(2));

    this.fitCanvasView();
    this.redrawCanvas();
    this.triggerWYSIWYGUpdate();
  }

  public getShapeDimensions(shape?: Vector3[]): { width: number; height: number } {
    if (!shape || shape.length === 0) return { width: 4, height: 1 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of shape) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return {
      width: Math.max(0.01, maxX - minX),
      height: Math.max(0.01, maxY - minY),
    };
  }

  private centerShape(): void {
    const p = this.getActivePath();
    if (!p || !p.shape || p.shape.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of p.shape) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    for (const pt of p.shape) {
      pt.x -= midX;
      pt.y -= midY;
    }
    this.currentPreset = 'custom';
    this.renderActiveTab();
    this.redrawCanvas();
    this.triggerWYSIWYGUpdate();
  }

  private updateVertexTable(p: PathExtrusionItem): void {
    const tableContainer = this.tabContents.get('shape')?.querySelector('.pes-table tbody');
    if (!tableContainer || !p.shape) return;
    const inputs = tableContainer.querySelectorAll<HTMLInputElement>('input[data-idx]');
    inputs.forEach((inp) => {
      const idx = parseInt(inp.dataset.idx!, 10);
      const coord = inp.dataset.coord as 'x' | 'y';
      if (p.shape && p.shape[idx]) {
        inp.value = p.shape[idx][coord].toFixed(2);
      }
    });
  }

  private fitCanvasView(): void {
    const p = this.getActivePath();
    if (!p || !p.shape || p.shape.length === 0) {
      this.scale = 45;
      this.panX = 0;
      this.panY = 0;
      this.redrawCanvas();
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of p.shape) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }

    const spanX = Math.max(0.4, maxX - minX);
    const spanY = Math.max(0.4, maxY - minY);

    const scaleX = (this.canvasWidth * 0.75) / spanX;
    const scaleY = (this.canvasHeight * 0.75) / spanY;
    this.scale = Math.max(2, Math.min(300, Math.min(scaleX, scaleY)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    this.panX = -midX * this.scale;
    this.panY = midY * this.scale;

    this.redrawCanvas();
  }

  // ─── 2D Canvas Drawing & Interactions ──────────────────────────────────────

  private setupCanvasInteractions(): void {
    const canvas = this.canvas;

    const getCanvasCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleFactorX = this.canvasWidth / rect.width;
      const scaleFactorY = this.canvasHeight / rect.height;
      const cx = (e.clientX - rect.left) * scaleFactorX;
      const cy = (e.clientY - rect.top) * scaleFactorY;
      return { cx, cy, scaleFactorX, scaleFactorY };
    };

    const toWorld = (cx: number, cy: number) => {
      const originX = this.canvasWidth / 2 + this.panX;
      const originY = this.canvasHeight / 2 + this.panY;
      const x = (cx - originX) / this.scale;
      const y = (originY - cy) / this.scale;
      return { x, y };
    };

    const toCanvas = (wx: number, wy: number) => {
      const originX = this.canvasWidth / 2 + this.panX;
      const originY = this.canvasHeight / 2 + this.panY;
      const cx = originX + wx * this.scale;
      const cy = originY - wy * this.scale;
      return { cx, cy };
    };

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);
      const p = this.getActivePath();
      if (!p || !p.shape) return;

      const shape = p.shape;

      // 1. Check vertex pick
      let foundIdx: number | null = null;
      for (let i = 0; i < shape.length; i++) {
        const { cx: px, cy: py } = toCanvas(shape[i].x, shape[i].y);
        const dist = Math.hypot(cx - px, cy - py);
        if (dist <= 9) {
          foundIdx = i;
          break;
        }
      }

      if (e.button === 0) {
        if (foundIdx !== null) {
          this.isCanvasDragging = true;
          this.draggedVertexIndex = foundIdx;
          canvas.style.cursor = 'grabbing';
        } else if (this.hoveredEdgeIndex !== null) {
          // Edge pick: insert vertex
          const world = toWorld(cx, cy);
          const insertIdx = this.hoveredEdgeIndex + 1;
          shape.splice(insertIdx, 0, new Vector3(world.x, world.y, 0));
          this.isCanvasDragging = true;
          this.draggedVertexIndex = insertIdx;
          this.currentPreset = 'custom';
          this.renderActiveTab();
          this.triggerWYSIWYGUpdate();
        } else {
          // Panning
          this.isPanning = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          canvas.style.cursor = 'grabbing';
        }
      } else if (e.button === 1) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        canvas.style.cursor = 'grabbing';
      } else if (e.button === 2) {
        if (foundIdx !== null && shape.length > 3) {
          shape.splice(foundIdx, 1);
          this.currentPreset = 'custom';
          this.renderActiveTab();
          this.triggerWYSIWYGUpdate();
        }
      }
    });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const { cx, cy, scaleFactorX, scaleFactorY } = getCanvasCoords(e);
      const world = toWorld(cx, cy);
      this.mouseWorldCoord = world;

      const coordEl = document.getElementById('pesMouseCoord');
      if (coordEl) coordEl.textContent = `X: ${world.x.toFixed(2)}m, Y: ${world.y.toFixed(2)}m`;

      if (this.isPanning) {
        const dx = (e.clientX - this.panStartX) * scaleFactorX;
        const dy = (e.clientY - this.panStartY) * scaleFactorY;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panX += dx;
        this.panY += dy;
        this.redrawCanvas();
        return;
      }

      const p = this.getActivePath();
      if (!p || !p.shape) return;

      const shape = p.shape;

      if (this.isCanvasDragging && this.draggedVertexIndex !== null) {
        let finalX = world.x;
        let finalY = world.y;
        if (this.snapGrid > 0) {
          finalX = Math.round(finalX / this.snapGrid) * this.snapGrid;
          finalY = Math.round(finalY / this.snapGrid) * this.snapGrid;
        }
        shape[this.draggedVertexIndex].x = finalX;
        shape[this.draggedVertexIndex].y = finalY;
        this.currentPreset = 'custom';
        this.redrawCanvas();
        this.triggerWYSIWYGUpdate();
      } else {
        // Vertex hover
        this.hoveredVertexIndex = null;
        for (let i = 0; i < shape.length; i++) {
          const { cx: px, cy: py } = toCanvas(shape[i].x, shape[i].y);
          if (Math.hypot(cx - px, cy - py) <= 9) {
            this.hoveredVertexIndex = i;
            break;
          }
        }

        // Edge hover
        this.hoveredEdgeIndex = null;
        if (this.hoveredVertexIndex === null && shape.length >= 2) {
          for (let i = 0; i < shape.length; i++) {
            const nextI = (i + 1) % shape.length;
            const p1 = toCanvas(shape[i].x, shape[i].y);
            const p2 = toCanvas(shape[nextI].x, shape[nextI].y);
            const dist = this.distToSegment({ x: cx, y: cy }, { x: p1.cx, y: p1.cy }, { x: p2.cx, y: p2.cy });
            if (dist <= 6) {
              this.hoveredEdgeIndex = i;
              break;
            }
          }
        }

        canvas.style.cursor =
          this.hoveredVertexIndex !== null ? 'pointer' : this.hoveredEdgeIndex !== null ? 'cell' : 'grab';
        this.redrawCanvas();
      }
    });

    const handleMouseUp = () => {
      const p = this.getActivePath();
      if (this.isCanvasDragging) {
        this.isCanvasDragging = false;
        this.draggedVertexIndex = null;
        if (p) this.updateVertexTable(p);
      }
      if (this.isPanning) {
        this.isPanning = false;
        canvas.style.cursor = 'grab';
      }
    };

    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('dblclick', (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);
      const world = toWorld(cx, cy);
      const p = this.getActivePath();
      if (!p || !p.shape) return;

      p.shape.push(new Vector3(world.x, world.y, 0));
      this.currentPreset = 'custom';
      this.renderActiveTab();
      this.triggerWYSIWYGUpdate();
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const { cx, cy } = getCanvasCoords(e);
      const world = toWorld(cx, cy);
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.max(2, Math.min(400, this.scale * zoomFactor));

      this.panX = cx - this.canvasWidth / 2 - world.x * newScale;
      this.panY = cy - this.canvasHeight / 2 + world.y * newScale;
      this.scale = newScale;
      this.redrawCanvas();
    });
  }

  private distToSegment(p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }): number {
    const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  private redrawCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    ctx.clearRect(0, 0, width, height);

    const originX = width / 2 + this.panX;
    const originY = height / 2 + this.panY;

    // Zoom/scale display
    const zoomEl = document.getElementById('pesCanvasZoom');
    if (zoomEl) {
      zoomEl.textContent = `Scale: ${this.scale.toFixed(1)} px/m (${Math.round((this.scale / 45) * 100)}%)`;
    }

    // 1. Dynamic Background Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const targetPixelSpacing = 40;
    const rawStep = targetPixelSpacing / this.scale;
    const niceSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
    let gridMeterStep = niceSteps[niceSteps.length - 1];
    for (const s of niceSteps) {
      if (s >= rawStep) {
        gridMeterStep = s;
        break;
      }
    }
    const pixelStep = gridMeterStep * this.scale;

    const startX = ((originX % pixelStep) + pixelStep) % pixelStep;
    for (let x = startX; x < width; x += pixelStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    const startY = ((originY % pixelStep) + pixelStep) % pixelStep;
    for (let y = startY; y < height; y += pixelStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Axes
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(originX, originY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '9px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`X (${gridMeterStep}m/div)`, width - 75, Math.max(14, Math.min(height - 6, originY - 4)));
    ctx.fillText('Y', Math.max(4, Math.min(width - 14, originX + 4)), 12);

    // 3. Draw Cross-section Shape
    const p = this.getActivePath();
    if (!p || !p.shape || p.shape.length < 2) return;

    const shape = p.shape;
    const solidHalf = (shape as SolidShape).solidHalfCount || p.shapeConfig.solidHalfCount || 0;
    const isClosed = (shape as SolidShape).closedShape ?? p.shapeConfig.closedShape ?? true;

    const toCanvas = (wx: number, wy: number) => ({
      x: originX + wx * this.scale,
      y: originY - wy * this.scale,
    });

    if (solidHalf > 0) {
      // Solid annular shape (outer loop + inner ring)
      const outerCount = solidHalf;
      const innerCount = shape.length - solidHalf;

      // Outer path
      ctx.beginPath();
      const p0 = toCanvas(shape[0].x, shape[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < outerCount; i++) {
        const pt = toCanvas(shape[i].x, shape[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      if (isClosed) ctx.closePath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner path
      if (innerCount > 1) {
        ctx.beginPath();
        const pi0 = toCanvas(shape[solidHalf].x, shape[solidHalf].y);
        ctx.moveTo(pi0.x, pi0.y);
        for (let i = solidHalf + 1; i < shape.length; i++) {
          const pt = toCanvas(shape[i].x, shape[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        if (isClosed) ctx.closePath();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Shaded fill between rings
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < outerCount; i++) {
        const pt = toCanvas(shape[i].x, shape[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      if (isClosed) ctx.closePath();
      for (let i = solidHalf; i < shape.length; i++) {
        const pt = toCanvas(shape[i].x, shape[i].y);
        if (i === solidHalf) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      if (isClosed) ctx.closePath();
      ctx.fill('evenodd');
    } else {
      ctx.beginPath();
      const p0 = toCanvas(shape[0].x, shape[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < shape.length; i++) {
        const pt = toCanvas(shape[i].x, shape[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      if (isClosed) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fill();
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 4. Draw Vertex Handles
    let pointsOffscreen = 0;
    for (let i = 0; i < shape.length; i++) {
      const pt = toCanvas(shape[i].x, shape[i].y);
      if (pt.x < 0 || pt.x > width || pt.y < 0 || pt.y > height) {
        pointsOffscreen++;
      }
      const isHovered = this.hoveredVertexIndex === i;
      const isInner = solidHalf > 0 && i >= solidHalf;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHovered ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isInner ? '#fb923c' : i === 0 ? '#f59e0b' : '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (isHovered) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`#${i} (${shape[i].x.toFixed(2)}, ${shape[i].y.toFixed(2)})`, pt.x + 8, pt.y - 8);
      }
    }

    // 5. Offscreen warning
    if (pointsOffscreen > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
      ctx.beginPath();
      const bx = 10;
      const by = height - 30;
      const bw = 260;
      const bh = 20;
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 4);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`⚠️ ${pointsOffscreen} points out of view — Click [Fit View]`, bx + 6, by + 14);
    }
  }

  // ─── TAB 2: Extrusion Mesh & Materials ────────────────────────────────────

  private renderMeshTab(p: PathExtrusionItem): void {
    const container = this.tabContents.get('mesh');
    if (!container) return;
    container.innerHTML = '';

    // Dimensions
    const dimSec = document.createElement('div');
    dimSec.className = 'pes-section';
    dimSec.innerHTML = '<div class="pes-section-title"><span>📐 Dimensions & Elevation</span></div>';

    const addNumRow = (label: string, min: number, max: number, step: number, val: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.className = 'pes-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const cnt = document.createElement('div');
      cnt.className = 'pes-row-content';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'pes-slider';
      slider.min = min.toString();
      slider.max = max.toString();
      slider.step = step.toString();
      slider.value = (val || 0).toString();

      const num = document.createElement('input');
      num.type = 'number';
      num.className = 'pes-input';
      num.min = min.toString();
      num.max = max.toString();
      num.step = step.toString();
      num.value = (val || 0).toString();

      const sync = (v: number) => {
        slider.value = v.toString();
        num.value = v.toString();
        onChange(v);
        this.triggerWYSIWYGUpdate();
      };
      slider.oninput = () => sync(parseFloat(slider.value));
      num.onchange = () => sync(parseFloat(num.value));

      cnt.append(slider, num);
      row.append(lbl, cnt);
      dimSec.appendChild(row);
    };

    const dims = this.getShapeDimensions(p.shape);
    const initialWidth = p.shapeConfig.width ?? parseFloat(dims.width.toFixed(2));
    const initialHeight = p.shapeConfig.height ?? parseFloat(dims.height.toFixed(2));

    addNumRow('Width:', 0.5, 30, 0.25, initialWidth, (newWidth) => {
      if (p.shape && p.shape.length > 0) {
        const curW = this.getShapeDimensions(p.shape).width;
        if (curW > 0.001) {
          const factor = newWidth / curW;
          for (const pt of p.shape) {
            pt.x *= factor;
          }
        }
        this.currentPreset = 'custom';
        this.fitCanvasView();
      }
      p.shapeConfig.width = newWidth;
    });

    addNumRow('Height:', 0.1, 10, 0.05, initialHeight, (newHeight) => {
      if (p.shape && p.shape.length > 0) {
        const curH = this.getShapeDimensions(p.shape).height;
        if (curH > 0.001) {
          const factor = newHeight / curH;
          for (const pt of p.shape) {
            pt.y *= factor;
          }
        }
        this.currentPreset = 'custom';
        this.fitCanvasView();
      }
      p.shapeConfig.height = newHeight;
    });

    addNumRow('Y-Offset (Elevation):', -5, 15, 0.1, p.shapeConfig.yOffset || 0, (v) => (p.shapeConfig.yOffset = v));
    addNumRow('Spline Smoothness:', 1, 40, 1, p.shapeConfig.smoothSteps || 10, (v) => (p.shapeConfig.smoothSteps = v));

    // Cap ends toggle
    const capRow = document.createElement('div');
    capRow.className = 'pes-row';
    const capLbl = document.createElement('label');
    capLbl.textContent = 'Cap Ends:';
    const capCnt = document.createElement('div');
    capCnt.className = 'pes-row-content';
    const capCheck = document.createElement('input');
    capCheck.type = 'checkbox';
    capCheck.checked = p.shapeConfig.capEnds ?? false;
    capCheck.onchange = () => {
      p.shapeConfig.capEnds = capCheck.checked;
      this.triggerWYSIWYGUpdate();
    };
    const capDesc = document.createElement('span');
    capDesc.style.fontSize = '11px';
    capDesc.style.color = '#94a3b8';
    capDesc.textContent = 'Generate solid manifold end caps at start and end of path';
    capCnt.append(capCheck, capDesc);
    capRow.append(capLbl, capCnt);
    dimSec.appendChild(capRow);

    container.appendChild(dimSec);

    // Materials
    const matSec = document.createElement('div');
    matSec.className = 'pes-section';
    matSec.innerHTML = '<div class="pes-section-title"><span>🎨 Materials & Shading</span></div>';

    // Color picker
    const colRow = document.createElement('div');
    colRow.className = 'pes-row';
    const colLbl = document.createElement('label');
    colLbl.textContent = 'Albedo Color:';
    const colCnt = document.createElement('div');
    colCnt.className = 'pes-row-content';
    const colInput = document.createElement('input');
    colInput.type = 'color';
    colInput.value = p.shapeConfig.color || '#38bdf8';
    const colHex = document.createElement('span');
    colHex.style.fontSize = '12px';
    colHex.style.fontFamily = 'monospace';
    colHex.textContent = colInput.value;
    colInput.oninput = () => {
      p.shapeConfig.color = colInput.value;
      colHex.textContent = colInput.value;
      this.triggerWYSIWYGUpdate();
    };
    colCnt.append(colInput, colHex);
    colRow.append(colLbl, colCnt);
    matSec.appendChild(colRow);

    // Roughness & Metallic
    const addMatSlider = (label: string, val: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.className = 'pes-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const cnt = document.createElement('div');
      cnt.className = 'pes-row-content';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'pes-slider';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.05';
      slider.value = (val ?? 0.4).toString();

      const num = document.createElement('span');
      num.style.fontSize = '12px';
      num.style.width = '35px';
      num.textContent = slider.value;

      slider.oninput = () => {
        num.textContent = slider.value;
        onChange(parseFloat(slider.value));
        this.triggerWYSIWYGUpdate();
      };

      cnt.append(slider, num);
      row.append(lbl, cnt);
      matSec.appendChild(row);
    };

    addMatSlider('Roughness:', p.shapeConfig.roughness ?? 0.4, (v) => (p.shapeConfig.roughness = v));
    addMatSlider('Metallic:', p.shapeConfig.metallic ?? 0.1, (v) => (p.shapeConfig.metallic = v));

    container.appendChild(matSec);
  }

  // ─── TAB 3: Path Trajectory & Curve ───────────────────────────────────────

  private renderCurveTab(p: PathExtrusionItem): void {
    const container = this.tabContents.get('curve');
    if (!container) return;
    container.innerHTML = '';

    const ptsSec = document.createElement('div');
    ptsSec.className = 'pes-section';
    ptsSec.innerHTML = `<div class="pes-section-title"><span>📍 Spline Waypoints (${p.points.length} points)</span></div>`;

    // Quick Actions Toolbar
    const actRow = document.createElement('div');
    actRow.style.display = 'flex';
    actRow.style.gap = '6px';
    actRow.style.flexWrap = 'wrap';

    const addBtn = document.createElement('button');
    addBtn.className = 'pes-btn small primary';
    addBtn.innerHTML = '➕ Add Point';
    addBtn.onclick = () => {
      const last = p.points[p.points.length - 1] || { x: 0, y: 0.1, z: 0 };
      this.controller.addPoint(new Vector3(last.x + 1.5, last.y, last.z + 1.5));
      this.renderActiveTab();
    };

    const reverseBtn = document.createElement('button');
    reverseBtn.className = 'pes-btn small';
    reverseBtn.innerHTML = '🔄 Reverse Points';
    reverseBtn.onclick = () => {
      p.points.reverse();
      this.controller.refreshScene();
      this.renderActiveTab();
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'pes-btn small';
    removeBtn.innerHTML = '➖ Remove Selected';
    removeBtn.onclick = () => {
      this.controller.removeSelectedPoint();
      this.renderActiveTab();
    };

    const clearBtn = document.createElement('button');
    clearBtn.className = 'pes-btn small danger';
    clearBtn.innerHTML = '🗑️ Clear All';
    clearBtn.onclick = () => {
      if (confirm('Clear all waypoints?')) {
        this.controller.clearPoints();
        this.renderActiveTab();
      }
    };

    actRow.append(addBtn, reverseBtn, removeBtn, clearBtn);
    ptsSec.appendChild(actRow);

    // Points Table
    const tableWrap = document.createElement('div');
    tableWrap.className = 'pes-table-container';
    tableWrap.style.maxHeight = '220px';

    const table = document.createElement('table');
    table.className = 'pes-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>X</th>
          <th>Y</th>
          <th>Z</th>
          <th style="width:30px;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    p.points.forEach((pt, i) => {
      const tr = document.createElement('tr');
      const isSelected = i === this.controller.selectedPointIndex;
      if (isSelected) tr.style.background = 'rgba(56, 189, 248, 0.12)';

      tr.innerHTML = `
        <td style="color:${isSelected ? '#fbbf24' : '#38bdf8'}; font-weight:600;">${i}</td>
        <td><input type="number" step="0.5" class="pes-input" style="width:65px; padding:2px 4px;" value="${pt.x.toFixed(2)}" data-idx="${i}" data-c="x"></td>
        <td><input type="number" step="0.5" class="pes-input" style="width:65px; padding:2px 4px;" value="${pt.y.toFixed(2)}" data-idx="${i}" data-c="y"></td>
        <td><input type="number" step="0.5" class="pes-input" style="width:65px; padding:2px 4px;" value="${pt.z.toFixed(2)}" data-idx="${i}" data-c="z"></td>
        <td><button class="pes-btn small danger" style="padding:1px 5px;" data-del="${i}">✕</button></td>
      `;

      tr.querySelectorAll('input').forEach((inp) => {
        inp.onchange = (e) => {
          const target = e.target as HTMLInputElement;
          const idx = parseInt(target.dataset.idx!, 10);
          const coord = target.dataset.c as 'x' | 'y' | 'z';
          p.points[idx][coord] = parseFloat(target.value) || 0;
          this.controller.refreshScene();
        };
      });

      tr.querySelector('button')?.addEventListener('click', () => {
        p.points.splice(i, 1);
        this.controller.refreshScene();
        this.renderActiveTab();
      });

      tbody.appendChild(tr);
    });

    tableWrap.appendChild(table);
    ptsSec.appendChild(tableWrap);

    const tip = document.createElement('div');
    tip.style.fontSize = '11px';
    tip.style.color = '#94a3b8';
    tip.innerHTML = '💡 <i>Tip: Hold <b>Shift</b> and click anywhere on the 3D ground or meshes to append points, or click any waypoint sphere to attach the 3D Gizmo and drag it in 3D space!</i>';
    ptsSec.appendChild(tip);

    container.appendChild(ptsSec);
  }
}
