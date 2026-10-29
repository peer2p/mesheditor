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
      <input type="file" id="aiImageFileInput" class="hidden-input" accept="image/*" multiple />

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
            <button class="dropdown-item active" id="btnToggleAIAgent" title="AI Mesh Agent (Text/Image to Mesh & Mesh Update)">
              <span class="btn-icon"><i class="app-icon" data-lucide="bot"></i></span>
              <span class="btn-label">AI Mesh Agent</span>
            </button>
            <button class="dropdown-item active" id="btnCreatePrimitive" title="Create Mesh (Box, Sphere, Cylinder, Polyhedron...)">
              <span class="btn-icon"><i class="app-icon" data-lucide="plus-circle"></i></span>
              <span class="btn-label">Create Mesh</span>
            </button>
            <button
              class="dropdown-item active"
              id="btnToggleCSG"
              title="Sculpting with Constructive Solid Geometry (Subtract / Cut, Union, Intersect)"
            >
              <span class="btn-icon"><i class="app-icon" data-lucide="shapes"></i></span>
              <span class="btn-label">Sculpting</span>
            </button>
            <button class="dropdown-item active" id="btnToggleFacetEditor" title="Facet & Vertex Editor">
              <span class="btn-icon"><i class="app-icon" data-lucide="triangle"></i></span>
              <span class="btn-label">Facet & Vertex Editor</span>
            </button>
            <button class="dropdown-item active" id="btnToggleTexturePanel" title="WebP Texture Optimizer">
              <span class="btn-icon"><i class="app-icon" data-lucide="zap"></i></span>
              <span class="btn-label">Texture Optimizer</span>
            </button>
            <div class="dropdown-divider"></div>
            <div class="dropdown-header-label">Panels & View</div>
            <button class="dropdown-item active" id="btnToggleOutliner" title="Scene Objects">
              <span class="btn-icon"><i class="app-icon" data-lucide="list-tree"></i></span>
              <span class="btn-label">Scene Objects</span>
            </button>
            <button class="dropdown-item active" id="btnToggleMeshPanel" title="Mesh Properties">
              <span class="btn-icon"><i class="app-icon" data-lucide="box"></i></span>
              <span class="btn-label">Mesh Properties</span>
            </button>
            <button class="dropdown-item active" id="btnToggleMaterialPanel" title="Material & UVs">
              <span class="btn-icon"><i class="app-icon" data-lucide="palette"></i></span>
              <span class="btn-label">Material & UV Mapping</span>
            </button>
            <button class="dropdown-item active" id="btnToggleScenePanel" title="Scene & Environment">
              <span class="btn-icon"><i class="app-icon" data-lucide="sun-medium"></i></span>
              <span class="btn-label">Scene & Environment</span>
            </button>
            <button class="dropdown-item active" id="btnToggleAnimPanel" title="Animation Player">
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

        <!-- Quick AI Agent Toggle -->
        <div class="btn-group ai-toolbar-group">
          <button class="tool-btn ai-toolbar-btn active" id="btnToolbarAIAgent" title="Toggle AI Mesh Agent (Text/Image to Mesh & Mesh Update)">
            <span class="btn-icon"><i class="app-icon" data-lucide="bot"></i></span>
            <span class="btn-label">AI Agent</span>
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

      <!-- Program Startup 3D Mesh Loading Animation -->
      <div id="appStartupLoader" class="me-loader-overlay me-startup-loader" role="status" aria-live="polite">
        <div class="me-loader-ambient-glow"></div>
        <div class="me-loader-content">
          <div class="me-mesh-stage" aria-hidden="true">
            <div class="me-orbit-ring me-orbit-ring-1"></div>
            <div class="me-orbit-ring me-orbit-ring-2"></div>
            <div class="me-orbit-ring me-orbit-ring-3"></div>
            <div class="me-3d-scene">
              <div class="me-3d-mesh-assembly">
                <div class="me-mesh-face me-face-front"><span></span></div>
                <div class="me-mesh-face me-face-back"><span></span></div>
                <div class="me-mesh-face me-face-right"><span></span></div>
                <div class="me-mesh-face me-face-left"><span></span></div>
                <div class="me-mesh-face me-face-top"><span></span></div>
                <div class="me-mesh-face me-face-bottom"><span></span></div>
                <div class="me-inner-octahedron">
                  <div class="me-octa-plane me-octa-1"></div>
                  <div class="me-octa-plane me-octa-2"></div>
                  <div class="me-octa-plane me-octa-3"></div>
                </div>
              </div>
            </div>
            <div class="me-ground-holo-grid">
              <div class="me-laser-scan"></div>
            </div>
          </div>
          <div class="me-loader-info">
            <div class="me-loader-title">
              <span class="me-loader-badge">3D STUDIO</span>
              <span>Mesh Editor</span>
            </div>
            <div class="me-loader-status" id="startupLoaderText">Initializing 3D Workspace & Tools...</div>
            <div class="me-loader-progress-row">
              <progress aria-label="Application startup progress" class="loading-spinner me-startup-spinner"></progress>
              <div class="me-loader-bar-track">
                <div class="me-loader-bar-fill" id="startupLoaderBar"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Babylon Scene Initialization & Mesh Loading Overlay -->
      <div id="sceneInitLoader" class="me-loader-overlay me-scene-loader" role="status" aria-live="polite">
        <div class="me-scene-loader-card">
          <div class="me-icosahedron-stage" aria-hidden="true">
            <div class="me-gizmo-arc me-gizmo-arc-x"></div>
            <div class="me-gizmo-arc me-gizmo-arc-y"></div>
            <div class="me-gizmo-arc me-gizmo-arc-z"></div>
            <svg class="me-icosahedron-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="meMeshFacetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--accent-active)" stop-opacity="0.58" />
                  <stop offset="100%" stop-color="var(--accent-active)" stop-opacity="0.08" />
                </linearGradient>
                <radialGradient id="meMeshCoreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="var(--accent-active)" stop-opacity="0.65" />
                  <stop offset="100%" stop-color="var(--accent-active)" stop-opacity="0" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="72" fill="url(#meMeshCoreGlow)" class="me-mesh-core-pulse" />
              <g class="me-mesh-back-edges">
                <polygon points="100,24 166,62 100,68" />
                <polygon points="100,24 34,62 100,68" />
                <polygon points="34,62 34,138 100,132" />
                <polygon points="166,62 166,138 100,132" />
                <polygon points="34,138 100,176 100,132" />
                <polygon points="166,138 100,176 100,132" />
              </g>
              <g class="me-mesh-facets">
                <polygon class="me-facet me-facet-1" points="100,24 58,78 142,78" />
                <polygon class="me-facet me-facet-2" points="100,24 34,62 58,78" />
                <polygon class="me-facet me-facet-3" points="100,24 142,78 166,62" />
                <polygon class="me-facet me-facet-4" points="34,62 34,138 58,78" />
                <polygon class="me-facet me-facet-5" points="166,62 142,78 166,138" />
                <polygon class="me-facet me-facet-6" points="58,78 142,78 100,134" />
                <polygon class="me-facet me-facet-7" points="34,138 58,78 100,134" />
                <polygon class="me-facet me-facet-8" points="166,138 100,134 142,78" />
                <polygon class="me-facet me-facet-9" points="34,138 100,176 100,134" />
                <polygon class="me-facet me-facet-10" points="166,138 100,134 100,176" />
              </g>
              <g class="me-mesh-wireframe">
                <polygon points="100,24 166,62 166,138 100,176 34,138 34,62" />
                <polygon points="58,78 142,78 100,134" />
                <line x1="100" y1="24" x2="58" y2="78" />
                <line x1="100" y1="24" x2="142" y2="78" />
                <line x1="34" y1="62" x2="58" y2="78" />
                <line x1="166" y1="62" x2="142" y2="78" />
                <line x1="34" y1="138" x2="58" y2="78" />
                <line x1="166" y1="138" x2="142" y2="78" />
                <line x1="34" y1="138" x2="100" y2="134" />
                <line x1="166" y1="138" x2="100" y2="134" />
                <line x1="100" y1="176" x2="100" y2="134" />
              </g>
              <g class="me-mesh-vertices">
                <circle cx="100" cy="24" r="4" />
                <circle cx="166" cy="62" r="3.5" />
                <circle cx="166" cy="138" r="3.5" />
                <circle cx="100" cy="176" r="4" />
                <circle cx="34" cy="138" r="3.5" />
                <circle cx="34" cy="62" r="3.5" />
                <circle cx="58" cy="78" r="4.5" />
                <circle cx="142" cy="78" r="4.5" />
                <circle cx="100" cy="134" r="4.5" />
              </g>
            </svg>
          </div>
          <div class="me-scene-loader-hud">
            <div class="me-scene-loader-header">
              <progress aria-label="Babylon scene initialization" class="loading-spinner me-scene-spinner"></progress>
              <span class="me-scene-loader-title" id="sceneLoaderTitle">Initializing Babylon 3D Scene...</span>
            </div>
            <div class="me-scene-loader-sub" id="sceneLoaderSub">WEBGL2 ENGINE • SHADER PIPELINE • MESH GEOMETRY</div>
          </div>
        </div>
      </div>

      <!-- Drag & Drop Overlay -->
      <div id="dropOverlay">
        <div class="drop-icon"><i class="app-icon" data-lucide="upload-cloud" style="width: 48px; height: 48px"></i></div>
        <div class="drop-text">Drop 3D Model Here!</div>
        <div class="drop-subtext">3D models (.glb, .gltf, .obj, .stl) or texture images (.png, .jpg, .webp)</div>
      </div>

      <!-- Outliner Floating Dialog (Hierarchy Tree of Meshes & Submeshes) -->
      <div id="dialog-outliner" class="floating-dialog" style="top: 64px; left: 16px; width: 320px">
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
        <div id="dialog-ai-agent" class="floating-dialog" style="top: 64px; left: 660px; width: 350px; z-index: 58">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="bot"></i> AI Mesh Agent</span>
            <div class="dialog-actions">
              <button class="dialog-btn" id="btnAISettingsToggle" title="Configure OpenAI-Compatible Endpoint & Skills">
                <i class="app-icon" data-lucide="settings"></i>
              </button>
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>

          <!-- Endpoint & Skills Configuration Drawer -->
          <div id="aiSettingsPanel" class="ai-settings-panel" style="display: none">
            <div class="ai-settings-title-row">
              <span class="ai-settings-title">OpenAI-Compatible Endpoint</span>
              <div class="ai-preset-chips" id="aiPresetChips">
                <button type="button" class="ai-chip-btn" data-preset="antigravity">Antigravity</button>
                <button type="button" class="ai-chip-btn" data-preset="gemini">Gemini Flash</button>
                <button type="button" class="ai-chip-btn" data-preset="gemini-pro">Gemini Pro</button>
                <button type="button" class="ai-chip-btn" data-preset="openai">OpenAI</button>
                <button type="button" class="ai-chip-btn" data-preset="openrouter">OpenRouter</button>
                <button type="button" class="ai-chip-btn" data-preset="ollama">Ollama</button>
                <button type="button" class="ai-chip-btn" data-preset="lmstudio">LM Studio</button>
              </div>
            </div>

            <div class="ai-form-group">
              <label for="aiEndpointUrlInput">Base URL</label>
              <input
                type="text"
                id="aiEndpointUrlInput"
                class="ai-input"
                placeholder="https://api.openai.com/v1"
                autocomplete="off"
              />
            </div>

            <div class="ai-form-group">
              <label for="aiApiKeyInput">API Key</label>
              <div class="ai-input-row">
                <input
                  type="password"
                  id="aiApiKeyInput"
                  class="ai-input"
                  placeholder="sk-... (optional for local Ollama / LM Studio)"
                  autocomplete="off"
                />
                <button type="button" class="ai-icon-btn" id="btnToggleApiKeyVis" title="Show/Hide API Key">
                  <i class="app-icon" data-lucide="eye"></i>
                </button>
              </div>
            </div>

            <div class="ai-form-group">
              <label for="aiModelInput">Model</label>
              <div class="ai-input-row">
                <input
                  type="text"
                  id="aiModelInput"
                  class="ai-input"
                  list="aiModelDatalist"
                  placeholder="gpt-4o"
                  autocomplete="off"
                />
                <datalist id="aiModelDatalist">
                  <option value="gemini-3.8-flash-medium"></option>
                  <option value="gemini-3.8-flash-high"></option>
                  <option value="gemini-3.8-flash-low"></option>
                  <option value="gemini-4-argon-medium"></option>
                  <option value="claude-sonnet-5-5-medium"></option>
                  <option value="gemini-3-flash-preview"></option>
                  <option value="gemini-3.1-pro-preview"></option>
                  <option value="gpt-4o"></option>
                  <option value="qwen2.5-coder:14b"></option>
                </datalist>
                <button type="button" class="ai-icon-btn" id="btnFetchAIModels" title="Load available models from endpoint (/models)">
                  <i class="app-icon" data-lucide="refresh-cw"></i>
                </button>
              </div>
            </div>

            <div class="ai-form-group">
              <label>Built-in Babylon.js Agent Skills</label>
              <div id="aiSkillsList" class="ai-skills-list"></div>
            </div>

            <div class="ai-settings-actions">
              <button type="button" class="tool-btn btn-primary" id="btnSaveAISettings" style="width: 100%">
                <span class="btn-icon"><i class="app-icon" data-lucide="check"></i></span>
                <span class="btn-label">Save Endpoint Config</span>
              </button>
            </div>
          </div>

          <div class="dialog-body ai-agent-body">
            <!-- Status & Mode Bar -->
            <div class="ai-mode-bar">
              <select id="aiActionModeSelect" class="ai-select" title="Choose how generated meshes interact with current scene">
                <option value="create_or_update">Create / Update in Scene</option>
                <option value="replace_scene">Replace Scene (Clear First)</option>
              </select>
              <label class="ai-checkbox-label" title="Send a screenshot of the current 3D viewport to the vision model">
                <input type="checkbox" id="aiIncludeViewportCheck" />
                <span>+ 3D View</span>
              </label>
            </div>

            <div class="ai-endpoint-summary" id="aiEndpointSummaryBar">
              <span class="ai-endpoint-dot" id="aiEndpointStatusDot"></span>
              <span id="aiEndpointSummaryText">Model: gpt-4o</span>
              <button type="button" class="ai-link-btn" id="btnOpenAISettingsInline">Configure</button>
            </div>

            <!-- Quick Example Prompts -->
            <div class="ai-quick-prompts" id="aiQuickPrompts">
              <button type="button" class="ai-prompt-chip" data-prompt="Build an ancient fluted stone pillar with a stepped base and capital.">Stone Pillar</button>
              <button type="button" class="ai-prompt-chip" data-prompt="Create a metallic gear wheel with 12 teeth and a center bore.">Gear Wheel</button>
              <button type="button" class="ai-prompt-chip" data-prompt="Build a medieval wooden treasure chest with golden trim.">Treasure Chest</button>
              <button type="button" class="ai-prompt-chip" data-prompt="Build a detailed voxel knight helmet with visor.">Voxel Helmet</button>
              <button type="button" class="ai-prompt-chip" data-prompt="Update the currently selected mesh: hollow it out with CSG and apply a polished marble material.">Mesh Update</button>
            </div>

            <!-- Chat & Tool Execution Log -->
            <div id="aiChatLog" class="ai-chat-log">
              <div class="ai-chat-empty">
                <strong>Text / Image to 3D Mesh & Update</strong><br />
                Describe a 3D object, attach a reference image, or select a mesh in the scene to modify it with AI.
              </div>
            </div>

            <!-- Attached Images Preview Bar -->
            <div id="aiImageAttachmentsBar" class="ai-image-attachments" style="display: none"></div>

            <!-- Prompt Input & Controls -->
            <div class="ai-input-area">
              <textarea
                id="aiPromptInput"
                class="ai-prompt-textarea"
                rows="3"
                placeholder="Enter a prompt (e.g. 'Build a stone archway' or 'Add a roof to selected mesh')... Attach images via button, Drag & Drop or Cmd+V."
              ></textarea>
              <div class="ai-controls-row">
                <div class="ai-controls-left">
                  <button type="button" class="tool-btn" id="btnAIAttachImage" title="Attach reference image for Image-to-Mesh">
                    <span class="btn-icon"><i class="app-icon" data-lucide="image"></i></span>
                    <span class="btn-label">Image</span>
                  </button>
                  <button type="button" class="tool-btn" id="btnAICaptureView" title="Attach screenshot of current 3D viewport">
                    <span class="btn-icon"><i class="app-icon" data-lucide="camera"></i></span>
                    <span class="btn-label">View</span>
                  </button>
                  <button type="button" class="tool-btn" id="btnAIClearChat" title="Clear AI conversation history">
                    <span class="btn-icon"><i class="app-icon" data-lucide="trash-2"></i></span>
                  </button>
                </div>
                <div class="ai-controls-right">
                  <button type="button" class="tool-btn btn-danger" id="btnAIStop" style="display: none" title="Cancel running AI generation">
                    <span class="btn-icon"><i class="app-icon" data-lucide="square"></i></span>
                    <span class="btn-label">Stop</span>
                  </button>
                  <button type="button" class="tool-btn btn-primary" id="btnAIGenerate" title="Run AI Mesh Agent (Enter / Cmd+Enter)">
                    <span class="btn-icon"><i class="app-icon" data-lucide="send"></i></span>
                    <span class="btn-label">Generate</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="dialog-create-primitive" class="floating-dialog" style="top: 64px; right: 338px; width: 320px; z-index: 55">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="plus-circle"></i> Create Mesh</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-create-container"></div>
        </div>

        <div id="dialog-csg" class="floating-dialog" style="top: 530px; right: 338px; width: 320px">
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

        <div id="dialog-facet" class="floating-dialog" style="top: 360px; right: 16px; width: 310px">
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

        <div id="dialog-scene" class="floating-dialog" style="top: 64px; right: 16px; width: 310px">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="sun-medium"></i> Scene & Environment</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-scene-container"></div>
        </div>

        <div id="dialog-mesh" class="floating-dialog" style="top: 64px; left: 348px; width: 300px">
          <div class="dialog-header">
            <span class="dialog-title"><i class="app-icon" data-lucide="box"></i> Mesh Properties</span>
            <div class="dialog-actions">
              <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
              <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
            </div>
          </div>
          <div class="dialog-body" id="gui-mesh-container"></div>
        </div>

        <div id="dialog-material" class="floating-dialog" style="top: 260px; left: 16px; width: 320px">
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
          style="bottom: 46px; left: 50%; transform: translateX(-50%); width: 440px"
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

        <div id="dialog-textures" class="floating-dialog" style="top: 560px; right: 16px; width: 310px">
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

