/**
 * Generates the inner HTML structure for the Mesh Editor UI.
 * Used when mounting the editor programmatically into a container element
 * or inside the <mesh-editor> Web Component.
 */
export function getMeshEditorTemplate(): string {
  return `
      <!-- Hidden file inputs -->
      <input type="file" id="modelFileInput" class="hidden-input" accept=".glb,.gltf,.obj,.stl,.ply,.babylon,.bin,.png,.jpg,.jpeg,.webp" multiple />
      <input type="file" id="importFileInput" class="hidden-input" accept=".glb,.gltf,.obj,.stl,.ply,.babylon,.bin,.png,.jpg,.jpeg,.webp" multiple />
      <input type="file" id="textureFileInput" class="hidden-input" accept="image/*" />

      <!-- Top Toolbar -->
      <header id="top-toolbar">
        <div class="toolbar-brand">
          <span class="app-title-logo"><i class="app-icon app-icon-lg" data-lucide="box"></i></span>
          <div class="app-title-info">
            <div class="app-title-text">Mesh Editor</div>
            <div class="app-subtitle-text">3D Studio</div>
          </div>
        </div>

        <div class="toolbar-divider"></div>

        <!-- File Operations Menu -->
        <div class="dropdown-wrapper" id="dropdownFile">
          <button class="tool-btn dropdown-toggle" id="btnDropdownFile" title="File Operations">
            <span class="btn-icon"><i class="app-icon" data-lucide="folder"></i></span>
            <span class="btn-label">File</span>
            <span class="dropdown-arrow"><i class="app-icon arrow-icon" data-lucide="chevron-down"></i></span>
          </button>
          <div class="dropdown-menu" id="menuFile">
            <button class="dropdown-item" id="btnOpenModel" title="Open 3D Model from disk (replaces current scene)">
              <span class="btn-icon"><i class="app-icon" data-lucide="folder-open"></i></span>
              <span class="btn-label">Open...</span>
            </button>
            <button
              class="dropdown-item"
              id="btnImportModel"
              title="Import / Append 3D Model from disk into current scene (.glb, .gltf, .obj, .stl)"
            >
              <span class="btn-icon"><i class="app-icon" data-lucide="folder-input"></i></span>
              <span class="btn-label">Import...</span>
            </button>
            <button class="dropdown-item" id="btnExportMenu" title="Export 3D Model">
              <span class="btn-icon"><i class="app-icon" data-lucide="download"></i></span>
              <span class="btn-label">Export...</span>
            </button>
            <div class="dropdown-divider" id="menuFilePluginsDivider" style="display: none"></div>
            <div id="menuFilePlugins"></div>
          </div>
        </div>

        <!-- Actions Menu -->
        <div class="dropdown-wrapper" id="dropdownActions">
          <button class="tool-btn dropdown-toggle" id="btnDropdownActions" title="Actions Menu">
            <span class="btn-icon"><i class="app-icon" data-lucide="sparkles"></i></span>
            <span class="btn-label">Actions</span>
            <span class="dropdown-arrow"><i class="app-icon arrow-icon" data-lucide="chevron-down"></i></span>
          </button>
          <div class="dropdown-menu" id="menuActions">
            <button class="dropdown-item" id="btnFocus" title="Center camera on selection (Key: F)">
              <span class="btn-icon"><i class="app-icon" data-lucide="crosshair"></i></span>
              <span class="btn-label">Center Selection</span>
              <span class="shortcut-tag">F</span>
            </button>
            <button class="dropdown-item" id="btnCenterPivot" title="Center pivot to mesh visual center">
              <span class="btn-icon"><i class="app-icon" data-lucide="target"></i></span>
              <span class="btn-label">Center Pivot</span>
            </button>
            <button class="dropdown-item" id="btnExtractSubmesh" title="Separate into loose parts or submeshes">
              <span class="btn-icon"><i class="app-icon" data-lucide="scissors"></i></span>
              <span class="btn-label">Separate Loose Parts</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="btnGroup" title="Group selected meshes (Cmd+G / Ctrl+G)">
              <span class="btn-icon"><i class="app-icon" data-lucide="folder-plus"></i></span>
              <span class="btn-label">Group Meshes</span>
              <span class="shortcut-tag">⌘G</span>
            </button>
            <button class="dropdown-item" id="btnUngroup" title="Ungroup selected group (Cmd+Shift+G / Ctrl+Shift+G)">
              <span class="btn-icon"><i class="app-icon" data-lucide="folder-minus"></i></span>
              <span class="btn-label">Ungroup</span>
              <span class="shortcut-tag">⇧⌘G</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item btn-danger" id="btnDeleteSelected" title="Delete selected mesh or group (Key: Del)">
              <span class="btn-icon"><i class="app-icon" data-lucide="trash-2"></i></span>
              <span class="btn-label">Delete Selected</span>
              <span class="shortcut-tag">Del</span>
            </button>
            <div class="dropdown-divider" id="menuActionsPluginsDivider" style="display: none"></div>
            <div id="menuActionsPlugins"></div>
          </div>
        </div>

        <!-- Tools Menu  -->
        <div class="dropdown-wrapper" id="dropdownTools">
          <button class="tool-btn dropdown-toggle" id="btnDropdownTools" title="Tools & Panels Menu">
            <span class="btn-icon"><i class="app-icon" data-lucide="wrench"></i></span>
            <span class="btn-label">Tools</span>
            <span class="dropdown-arrow"><i class="app-icon arrow-icon" data-lucide="chevron-down"></i></span>
          </button>
          <div class="dropdown-menu" id="menuTools">
            <div class="dropdown-header-label">Tools</div>
            <button class="dropdown-item" id="btnCreatePrimitive" title="Create Mesh (Box, Sphere, Cylinder, Polyhedron...)">
              <span class="btn-icon"><i class="app-icon" data-lucide="plus-circle"></i></span>
              <span class="btn-label">Create Mesh</span>
            </button>
            <button
              class="dropdown-item"
              id="btnToggleCSG"
              title="Sculpting with Constructive Solid Geometry (Subtract / Cut, Union, Intersect)"
            >
              <span class="btn-icon"><i class="app-icon" data-lucide="shapes"></i></span>
              <span class="btn-label">Sculpting</span>
            </button>
            <button class="dropdown-item" id="btnToggleFacetEditor" title="Facet & Vertex Editor">
              <span class="btn-icon"><i class="app-icon" data-lucide="triangle"></i></span>
              <span class="btn-label">Facet & Vertex Editor</span>
            </button>
            <button class="dropdown-item" id="btnToggleTexturePanel" title="WebP Texture Optimizer">
              <span class="btn-icon"><i class="app-icon" data-lucide="zap"></i></span>
              <span class="btn-label">Texture Optimizer</span>
            </button>
            <div class="dropdown-divider"></div>
            <div class="dropdown-header-label">Panels & View</div>
            <button class="dropdown-item active" id="btnToggleOutliner" title="Scene Objects">
              <span class="btn-icon"><i class="app-icon" data-lucide="list-tree"></i></span>
              <span class="btn-label">Scene Objects</span>
            </button>
            <button class="dropdown-item" id="btnToggleMeshPanel" title="Mesh Properties">
              <span class="btn-icon"><i class="app-icon" data-lucide="box"></i></span>
              <span class="btn-label">Mesh Properties</span>
            </button>
            <button class="dropdown-item" id="btnToggleMaterialPanel" title="Material & UVs">
              <span class="btn-icon"><i class="app-icon" data-lucide="palette"></i></span>
              <span class="btn-label">Material & UV Mapping</span>
            </button>
            <button class="dropdown-item" id="btnToggleScenePanel" title="Scene & Environment">
              <span class="btn-icon"><i class="app-icon" data-lucide="sun-medium"></i></span>
              <span class="btn-label">Scene & Environment</span>
            </button>
            <button class="dropdown-item" id="btnToggleAnimPanel" title="Animation Player">
              <span class="btn-icon"><i class="app-icon" data-lucide="film"></i></span>
              <span class="btn-label">Animation Player</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item active" id="btnToggleGrid" title="Toggle ground grid">
              <span class="btn-icon"><i class="app-icon" data-lucide="grid-3x3"></i></span>
              <span class="btn-label">Ground Grid</span>
            </button>
            <div class="dropdown-divider" id="menuToolsPluginsDivider" style="display: none"></div>
            <div id="menuToolsPlugins"></div>
          </div>
        </div>

        <div class="toolbar-divider"></div>

        <!-- History: Undo & Redo -->
        <div class="btn-group history-group">
          <button class="tool-btn" id="btnUndo" title="Undo (Cmd+Z / Ctrl+Z)" disabled>
            <span class="btn-icon"><i class="app-icon" data-lucide="undo-2"></i></span><span class="btn-label">Undo</span>
          </button>
          <button class="tool-btn" id="btnRedo" title="Redo (Cmd+Shift+Z / Ctrl+Y)" disabled>
            <span class="btn-icon"><i class="app-icon" data-lucide="redo-2"></i></span><span class="btn-label">Redo</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <!-- Transform Gizmos -->
        <div class="btn-group gizmo-group">
          <button class="tool-btn active gizmo-btn" id="btnGizmoTranslate" title="Move (Key: M)">
            <span class="btn-icon"><i class="app-icon" data-lucide="move"></i></span><span class="btn-badge">M</span>
          </button>
          <button class="tool-btn gizmo-btn" id="btnGizmoRotate" title="Rotate (Key: E)">
            <span class="btn-icon"><i class="app-icon" data-lucide="rotate-cw"></i></span><span class="btn-badge">E</span>
          </button>
          <button class="tool-btn gizmo-btn" id="btnGizmoScale" title="Scale (Key: R)">
            <span class="btn-icon"><i class="app-icon" data-lucide="maximize-2"></i></span><span class="btn-badge">R</span>
          </button>
          <button class="tool-btn gizmo-btn" id="btnGizmoBounds" title="Bounds (Key: B)">
            <span class="btn-icon"><i class="app-icon" data-lucide="box-select"></i></span><span class="btn-badge">B</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <!-- Layout Mode Switcher: Floating vs Stackpanel -->
        <div class="btn-group layout-group">
          <button class="tool-btn layout-btn active" id="btnLayoutFloating" title="Floating layout: freely movable windows">
            <span class="btn-icon"><i class="app-icon" data-lucide="app-window"></i></span><span class="btn-label">Float</span>
          </button>
          <button class="tool-btn layout-btn" id="btnLayoutStack" title="Stackpanel layout: neatly docked vertical sidebar">
            <span class="btn-icon"><i class="app-icon" data-lucide="panel-right"></i></span><span class="btn-label">Stack</span>
          </button>
        </div>

        <div class="toolbar-divider"></div>

        <div class="btn-group panel-group">
          <button class="tool-btn panel-btn" id="btnHelp" title="Help & Keyboard Shortcuts">
            <span class="btn-icon"><i class="app-icon" data-lucide="help-circle"></i></span>
          </button>
        </div>
      </header>

      <!-- 3D Babylon Canvas -->
      <canvas id="renderCanvas" tabindex="0"></canvas>

      <!-- Drag & Drop Overlay -->
      <div id="dropOverlay">
        <div class="drop-icon"><i class="app-icon" data-lucide="upload-cloud" style="width: 48px; height: 48px"></i></div>
        <div class="drop-text">Drop 3D Model Here!</div>
        <div class="drop-subtext">3D models (.glb, .gltf, .obj, .stl) or texture images (.png, .jpg, .webp)</div>
      </div>

      <!-- Outliner Floating Dialog (Hierarchy Tree of Meshes & Submeshes) -->
      <div id="dialog-outliner" class="floating-dialog" style="top: 76px; left: 20px; width: 330px">
        <div class="dialog-header">
          <span class="dialog-title"><i class="app-icon" data-lucide="list-tree"></i> Scene Objects</span>
          <div class="dialog-actions">
            <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
            <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
          </div>
        </div>
        <div class="outliner-header-bar">
          <input type="text" id="outlinerSearch" class="outliner-search-input" placeholder="Filter objects..." />
        </div>
        <div class="dialog-body" style="max-height: 440px; padding: 6px">
          <div id="outlinerTreeContainer" class="outliner-tree"></div>
        </div>
      </div>

      <!-- Floating HTML Dialog Containers for dat.GUI (wrapped for Stackpanel mode) -->
      <div id="stackpanelRightSidebar" class="stackpanel-sidebar">
        <div id="dialog-create-primitive" class="floating-dialog" style="top: 76px; right: 360px; width: 330px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="plus-circle"></i> Create Mesh</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-create-container"></div>
        </div>

        <div id="dialog-csg" class="floating-dialog" style="top: 76px; right: 380px; width: 340px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="shapes"></i> Sculpting</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div
            style="
              padding: 6px 12px;
              background: rgba(88, 166, 255, 0.12);
              border-bottom: 1px solid var(--border-color);
              font-size: 11px;
              color: var(--accent-color);
              display: flex;
              align-items: center;
              gap: 6px;
            "
          >
            <i class="app-icon" data-lucide="lightbulb" style="color: var(--accent-color)"></i>
            <span>Use a tool mesh (created or selected) to carve, merge, or intersect with a target mesh!</span>
          </div>
          <div class="dialog-body" id="gui-csg-container"></div>
        </div>

        <div id="dialog-facet" class="floating-dialog" style="top: 76px; right: 20px; width: 330px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="triangle"></i> Facet & Vertex Editor</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div
            style="
              padding: 6px 12px;
              background: rgba(88, 166, 255, 0.12);
              border-bottom: 1px solid var(--border-color);
              font-size: 11px;
              color: var(--accent-color);
              display: flex;
              align-items: center;
              gap: 6px;
            "
          >
            <i class="app-icon" data-lucide="lightbulb" style="color: var(--accent-color)"></i>
            <span>Click on any triangle on the selected mesh to edit!</span>
          </div>
          <div class="dialog-body" id="gui-facet-container"></div>
        </div>

        <div id="dialog-scene" class="floating-dialog" style="top: 76px; right: 20px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="sun-medium"></i> Scene & Environment</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-scene-container"></div>
        </div>

        <div id="dialog-mesh" class="floating-dialog" style="top: 76px; left: 360px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="box"></i> Mesh Properties</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-mesh-container"></div>
        </div>

        <div id="dialog-material" class="floating-dialog" style="top: 380px; left: 360px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="palette"></i> Material & UV Mapping</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-material-container"></div>
        </div>

        <div
          id="dialog-anim"
          class="floating-dialog"
          style="bottom: 48px; left: 50%; transform: translateX(-50%); width: 440px; display: none"
        >
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="film"></i> Animation Player</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-anim-container"></div>
        </div>

        <div id="dialog-textures" class="floating-dialog" style="top: 380px; right: 20px; width: 340px; display: none">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="zap"></i> Texture Optimizer</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-textures-container"></div>
        </div>
      </div>

      <!-- Bottom Status Bar -->
      <footer id="bottom-bar">
        <div class="status-left">
          <span class="status-badge" id="statusIndicator"></span>
          <span class="status-message" id="statusText">Ready. Drag a 3D file here or click "Open".</span>
        </div>

        <div class="status-center">
          <span><span class="shortcut-tag">Left Click</span> Select / Gizmo</span>
          <span><span class="shortcut-tag">Right Click</span> Orbit Camera</span>
          <span><span class="shortcut-tag">W A S D</span> Fly Camera</span>
          <span><span class="shortcut-tag">Del</span> Delete Selected</span>
        </div>

        <div class="status-right">
          <div class="stats-item"><span>Selected:</span> <strong id="statsSelection">None</strong></div>
          <div class="stats-item"><span>Meshes:</span> <strong id="statsMeshes">0</strong></div>
          <div class="stats-item"><span>Polygons:</span> <strong id="statsPolys">0</strong></div>
        </div>
      </footer>

      <!-- Help Modal Dialog -->
      <div id="helpModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="app-icon" data-lucide="help-circle"></i> Mesh Editor Guide & Shortcuts</h3>
            <button class="dialog-btn btn-close" id="btnCloseHelp"><i class="app-icon" data-lucide="x"></i></button>
          </div>
          <div class="modal-body">
            <div class="help-section">
              <h4><i class="app-icon" data-lucide="mouse"></i> Mouse Controls</h4>
              <table class="help-table">
                <tr>
                  <td>Left Click</td>
                  <td>Select mesh or facet & drag transform gizmos</td>
                </tr>
                <tr>
                  <td>Right Click (Hold)</td>
                  <td>Orbit & rotate camera freely in 3D</td>
                </tr>
                <tr>
                  <td>Mouse Wheel</td>
                  <td>Zoom in & out</td>
                </tr>
                <tr>
                  <td>Middle Click / Shift+Right</td>
                  <td>Pan camera sideways or vertically</td>
                </tr>
              </table>
            </div>

            <div class="help-section">
              <h4><i class="app-icon" data-lucide="keyboard"></i> Keyboard Shortcuts</h4>
              <table class="help-table">
                <tr>
                  <td><span class="shortcut-tag">W, A, S, D</span></td>
                  <td>Fly camera through the 3D scene (no gizmo conflict)</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">M</span></td>
                  <td>Activate Move (Translate) gizmo</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">E</span></td>
                  <td>Activate Rotate gizmo</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">R</span></td>
                  <td>Activate Scale gizmo</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">B</span></td>
                  <td>Activate Bounds (Bounding Box) gizmo</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">F</span></td>
                  <td>Focus camera on selected object</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">Cmd+C / Ctrl+C</span></td>
                  <td>Copy selected mesh</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">Cmd+V / Ctrl+V</span></td>
                  <td>Paste copied mesh at 3D cursor position</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">Cmd+D / Ctrl+D</span></td>
                  <td>Duplicate selected mesh</td>
                </tr>
                <tr>
                  <td><span class="shortcut-tag">Del / Backspace</span></td>
                  <td>Delete selected mesh or facet</td>
                </tr>
              </table>
            </div>

            <div class="help-section">
              <h4><i class="app-icon" data-lucide="sparkles"></i> AI Model Editing Tips</h4>
              <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5">
                • <strong>Separate Loose Parts:</strong> AI models often merge all pieces into one mesh. Click "Separate" to instantly split
                disconnected parts into individual selectable objects!<br />
                • <strong>Center Pivot:</strong> Click "Center Pivot" if gizmos appear offset from the visual object.<br />
                • <strong>Pick & Place:</strong> In the Tools menu, choose "Create Mesh..." and click on any surface to spawn new meshes
                directly in 3D.<br />
                • <strong>Auto-Saved Windows:</strong> Window positions, sizes, and open states are saved automatically in your browser
                localStorage.
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="tool-btn btn-primary" id="btnHelpDone">Got it!</button>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div id="toast">
        <span id="toastIcon"><i class="app-icon" data-lucide="info"></i></span>
        <span id="toastText">Message</span>
      </div>
  `;
}

