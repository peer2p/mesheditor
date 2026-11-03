# 3D Mesh Editor

A modern, standalone 3D model studio and mesh manipulation workbench built with **TypeScript**. Designed to function across multiple deployment targets via a unified **Platform Adapter Architecture**:

1. **Standalone Web Application** (Browser app)
2. **NPM Library & Web Component** (`<mesh-editor>` + TypeScript/ES Module classes)
3. **Desktop Applications** (macOS `.dmg`/`.app`, Windows `.exe`, Linux `.AppImage`/`.deb` via Electron)

---

## Architecture Overview

The Mesh Editor is structured into decoupled layers to ensure complete isolation from project-specific assets, APIs, and paths:

```
src/
├── index.ts                          # Public exports (App, Service, Adapters, Web Component, Plugins, Tools)
├── types.ts                          # Shared data types, callbacks, and events
├── plugin.ts                         # Plugin interfaces (MeshEditorPlugin, Context, PluginManager)
├── template.ts                       # Self-contained HTML UI template (compiled from mesheditor.ejs & tool views)
├── styles.ts                         # Auto-injected CSS stylesheet for Web Component / NPM usage
├── MeshEditorService.ts              # Core 3D engine: meshes, gizmos, CSG2, facets, materials
├── MeshEditorApp.ts                  # UI coordinator: dat.GUI panels, outliner, window management
├── tools/                            # Modular tool architecture
│   ├── ToolInterface.ts              # Tool contracts, metadata, lifecycle hooks, AI function schemas
│   ├── AbstractTool.ts               # Base class with math & scene helper utilities
│   ├── ToolRegistry.ts               # Runtime tool registry & execution dispatcher
│   └── editor/                       # Decentralized editor tools & EJS views
│       ├── AbstractEditorTool.ts     # Base editor tool with auto-template & DOM rendering
│       ├── toolViews.ts              # Auto-compiled EJS view templates
│       ├── OutlinerEditorTool.ts / .ejs
│       ├── AIAgentEditorTool.ts / .ejs
│       ├── CreatePrimitiveEditorTool.ts / .ejs
│       ├── CSGEditorTool.ts / .ejs
│       ├── FacetEditorTool.ts / .ejs
│       ├── SceneEnvironmentEditorTool.ts / .ejs
│       ├── MeshPropertiesEditorTool.ts / .ejs
│       ├── MaterialEditorTool.ts / .ejs
│       ├── AnimationPlayerEditorTool.ts / .ejs
│       ├── TextureOptimizerEditorTool.ts / .ejs
│       ├── VoxelPainterEditorTool.ts / .ejs
│       └── PathExtrusionEditorTool.ts / .ejs
├── adapters/
│   ├── PlatformAdapter.ts            # Platform adapter contract (open/save dialogs, native menu bridge)
│   ├── BrowserPlatformAdapter.ts     # Standalone browser file input & download adapter
│   ├── ElectronPlatformAdapter.ts    # Desktop adapter (macOS, Windows, Linux native dialogs & menus)
│   └── HostAppAdapter.ts             # Embedded host application adapter (callbacks & custom save button)
├── web-component/
│   └── MeshEditorElement.ts          # <mesh-editor> Custom Element
├── mesheditor.ejs                    # Modular HTML entry template with EJS tool includes
└── mesheditor.css                    # Theme styles, layouts (Floating vs Stackpanel), dialogs
electron/
├── main.js                           # Electron main process (macOS, Windows, Linux native dialogs & menu)
└── preload.js                        # Context-isolated IPC bridge (window.meshEditorElectron)
```

### Core Design Principles

1. **Engine Decoupling (`MeshEditorService`)**: Encapsulates BabylonJS engine setup, `UniversalCamera`, lights, gizmo managers, CSG2 boolean sculpting, vertex/facet editing, WebP texture optimization, and import/export operations (`.glb`, `.gltf`, `.obj`, `.stl`). It operates on pure DOM canvas, files, and memory Blobs without any project-specific asset URLs.
2. **UI Orchestration (`MeshEditorApp`)**: Manages floating and dockable sidebar layouts, window dragging/docking, outliner search filter, and dropdown menus.
3. **Zero Project Couplings in Core**: Project-specific features (such as game asset libraries, backend saving to project folders, etc.) live strictly outside `src/mesheditor/` as independent plugins (located in `src/plugins/mesheditor/`).

---

## Camera Navigation & Controls

### Mouse Controls

| Action                  | Description                                                  |
| :---------------------- | :----------------------------------------------------------- |
| **Right Click + Drag**  | Free look / Orbit camera around scene                        |
| **Left Click**          | Select mesh, click vertices/facets, manipulate gizmo handles |
| **Middle Click + Drag** | Pan camera view                                              |

### Keyboard Navigation

| Key                 | Action                     |
| :------------------ | :------------------------- |
| **W / Up Arrow**    | Move camera forward        |
| **S / Down Arrow**  | Move camera backward       |
| **A / Left Arrow**  | Move camera left (strafe)  |
| **D / Right Arrow** | Move camera right (strafe) |

### Gizmo & Tool Shortcuts

| Key                    | Tool                                                        |
| :--------------------- | :---------------------------------------------------------- |
| **M**                  | Move / Position Gizmo                                       |
| **E**                  | Rotate Gizmo                                                |
| **R**                  | Scale Gizmo                                                 |
| **B**                  | Bounding Box Gizmo                                          |
| **F**                  | Focus camera on selected object                             |
| **Del / Backspace**    | Delete selected mesh or group                               |
| **⌘Z / Ctrl+Z**        | Undo last transformation / boolean operation                |
| **⇧⌘Z / Ctrl+Y**       | Redo                                                        |
| **⌘G / Ctrl+G**        | Group selected meshes                                       |
| **⇧⌘G / Ctrl+Shift+G** | Ungroup selected group                                      |
| **⌘C / Ctrl+C**        | Copy selected mesh                                          |
| **⌘V / Ctrl+V**        | Paste copy at cursor position                               |
| **⌘D / Ctrl+D**        | Duplicate selected mesh in place                            |
| **Esc**                | Cancel active Pick & Place placement mode / close dropdowns |

---

## Modular Tool Architecture & Creating New Tools

The Mesh Editor features a **Decentralized Modular Tool Architecture** where every 3D tool (such as Voxel Painter, Path Extrusion, CSG Sculpting, Material UV Editor, and the AI Mesh Agent) is a fully self-contained unit. Rather than hardcoding tool logic and dialog HTML into monolithic files, each tool encapsulates:

- **Logic & Configuration**: A TypeScript class extending [`AbstractEditorTool`](src/tools/editor/AbstractEditorTool.ts) (which implements [`ToolInterface`](src/tools/ToolInterface.ts)).
- **Dedicated EJS View**: Its own `.ejs` dialog template (e.g. `VoxelPainterEditorTool.ejs`) located right beside the class in `src/tools/editor/`.
- **In-App Help Guide**: An HTML `helpText` string explaining tool features, keyboard/mouse shortcuts, and tips rendered inside the `?` header button guide popup.
- **Lifecycle Hooks**: Methods (`onOpen`, `onClose`, `onMinimize`, `onMaximize`, `onUpdateUI`, `isActive`) managing activation, viewport event capturing, and cleanup.
- **Dynamic DOM Mounting**: If a tool dialog is not already present in the DOM (e.g. in custom mounting containers or dynamically registered plugin tools), the tool automatically mounts itself into `#stackpanelRightSidebar` via `renderView()`.

---

### Step-by-Step Guide: How to Create a New Tool

Follow these steps to build and register a new tool in the Mesh Editor:

#### Step 1: Create the EJS View Template

Create `src/tools/editor/MyCustomEditorTool.ejs` to define the floating dialog markup:

```html
<div
  id="dialog-my-custom-tool"
  class="floating-dialog"
  style="top: 100px; left: 348px; width: 340px; display: none"
>
  <div class="dialog-header">
    <span class="dialog-title"
      ><i class="app-icon" data-lucide="wand-2"></i> Custom Tool</span
    >
    <div class="dialog-actions">
      <button
        class="dialog-btn btn-help"
        title="Help & Tool Guide"
        aria-label="Help"
      >
        <i class="app-icon" data-lucide="help-circle"></i>
      </button>
      <button class="dialog-btn btn-min" title="Minimize">
        <i class="app-icon" data-lucide="minus"></i>
      </button>
      <button class="dialog-btn btn-close" title="Close">
        <i class="app-icon" data-lucide="x"></i>
      </button>
    </div>
  </div>
  <div class="dialog-body my-custom-tool-body" style="padding: 10px">
    <p
      style="margin-bottom: 8px; font-size: 12px; color: var(--text-secondary)"
    >
      Parametric procedural generator for custom geometries.
    </p>
    <div class="form-group" style="margin-bottom: 8px">
      <label for="customParam" style="font-size: 11px">Size Parameter:</label>
      <input
        type="number"
        id="customParam"
        class="form-input-sm"
        value="1.0"
        min="0.1"
        max="10.0"
        step="0.5"
      />
    </div>
    <button
      class="btn btn-primary btn-sm"
      id="btnMyCustomAction"
      style="width: 100%"
    >
      <i class="app-icon" data-lucide="play"></i> Run Operation
    </button>
  </div>
</div>
```

> [!TIP]
> Always include the three standard header action buttons: `btn-help` (`?` guide popup), `btn-min` (collapse/expand), and `btn-close` (`x` close).

#### Step 2: Create the Tool Class

Create `src/tools/editor/MyCustomEditorTool.ts` extending `AbstractEditorTool`:

```typescript
import { AbstractEditorTool } from "./AbstractEditorTool";

export class MyCustomEditorTool extends AbstractEditorTool {
  public readonly name = "my_custom_tool";
  public readonly dialogId = "dialog-my-custom-tool";
  public readonly triggerButtonId = "btnToggleMyCustomTool";
  public readonly toolbarButtonId = "btnToolbarMyCustomTool"; // Optional quick-access toolbar button
  public readonly menuId = "menuTools";
  public readonly menuLabel = "Custom Tool";
  public readonly icon = "wand-2"; // Lucide icon identifier
  public readonly order = 15;
  public readonly isExclusive3DTool = false; // Set to true if the tool takes exclusive control of 3D canvas clicks
  public readonly defaultOpen = false;
  public readonly description =
    "Parametric procedural generator for custom geometries.";

  public readonly helpText = `
<h4><i class="app-icon" data-lucide="info"></i> Overview</h4>
<p>The <strong>Custom Tool</strong> enables procedural generation and editing of custom 3D geometries.</p>

<h4><i class="app-icon" data-lucide="mouse-pointer"></i> Viewport Controls</h4>
<ul>
  <li><strong>Left Click:</strong> Select mesh or target position.</li>
  <li><strong>Right Click + Drag:</strong> Orbit camera freely.</li>
</ul>

<h4><i class="app-icon" data-lucide="sparkles"></i> Options & Tips</h4>
<ul>
  <li>Adjust <code>Size Parameter</code> to control the procedural generation resolution.</li>
  <li>Click <strong>Run Operation</strong> to generate meshes in the active scene.</li>
</ul>
`.trim();

  public onOpen(app: any): void {
    app.showToast("Custom Tool activated.", "info");
    const btn = document.getElementById("btnMyCustomAction");
    if (btn) {
      btn.onclick = () => {
        app.showToast("Custom action executed!", "success");
      };
    }
  }

  public onClose(app: any): void {
    // Teardown active viewport helpers or event listeners if necessary
  }

  public onMinimize(app: any): void {
    // Optional: pause rendering or interactive listeners
  }

  public onMaximize(app: any): void {
    // Optional: resume interactive listeners
  }

  public onUpdateUI(app: any): void {
    // Sync UI elements with active selection
  }
}
```

#### Step 3: Include in `src/mesheditor.ejs`

Add the EJS partial include inside `#stackpanelRightSidebar` in `src/mesheditor.ejs`:

```html
<div id="stackpanelRightSidebar" class="stackpanel-sidebar">
  ... <%- include('./tools/editor/MyCustomEditorTool.ejs') %>
</div>
```

_(Note: Even if omitted from `mesheditor.ejs`, `tool.renderView()` automatically mounts the dialog into `#stackpanelRightSidebar` when opened)._

#### Step 4: Register in `src/tools/editor/index.ts`

Export and instantiate the new tool in `createBuiltinEditorTools()`:

```typescript
import { MyCustomEditorTool } from './MyCustomEditorTool';

export {
  ...
  MyCustomEditorTool,
};

export function createBuiltinEditorTools(): ToolInterface[] {
  return [
    ...
    new MyCustomEditorTool(),
  ];
}
```

#### Step 5: Synchronize Templates & Verify

Run the template sync script:

```bash
npm run sync:templates
```

This compiles your `.ejs` file into `src/tools/editor/toolViews.ts` and updates `src/template.ts` for Web Components and library bundles.

Then verify with tests and build:

```bash
npm run type-check
npm test
npm run build
```

---

### Optional: AI Function Calling Support

If your tool should also be executable by the AI Mesh Agent (or LLMs via OpenAI-compatible function calling), implement `execute(args, context)` and the `parameters` JSON schema:

```typescript
import { ToolExecutionContext } from '../ToolExecutionContext';

export class MyCustomEditorTool extends AbstractEditorTool {
  ...
  public readonly parameters = {
    type: 'object',
    properties: {
      size: { type: 'number', description: 'Size of the generated box', default: 1.0 },
    },
    required: ['size'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const mesh = context.service.createBox(`custom_box_${Date.now()}`, { size: args.size });
    return JSON.stringify({ success: true, meshName: mesh.name });
  }
}
```

---

## Plugin Architecture

Plugins allow extending the Mesh Editor with custom menus, modals, tool buttons, and backend integrations without modifying the core `mesheditor` component.

### 1. `MeshEditorPlugin` Interface

Every plugin must implement the `MeshEditorPlugin` interface:

```typescript
export interface MeshEditorPlugin {
  /** Unique plugin identifier (e.g. 'company-asset-browser') */
  readonly id: string;

  /** Human-readable display name */
  readonly name: string;

  /** Optional semantic version */
  readonly version?: string;

  /** Optional plugin description */
  readonly description?: string;

  /**
   * Called once when the plugin is registered via `app.use()`.
   * Use this to register menu items, toolbar buttons, and DOM modals.
   */
  initialize(context: MeshEditorPluginContext): void | Promise<void>;

  /**
   * Optional cleanup handler called when the plugin is unregistered.
   */
  dispose?(): void;
}
```

---

### 2. `MeshEditorPluginContext` API

When `initialize(context)` is called, the editor provides a rich context with the following APIs:

#### Menu & Toolbar Registration

- `context.registerFileMenuItem(item: MenuItemDefinition): void`  
  Appends an item to the **File** dropdown menu under the plugin section.
- `context.registerActionMenuItem(item: MenuItemDefinition): void`  
  Appends an item to the **Actions** dropdown menu.
- `context.registerToolMenuItem(item: MenuItemDefinition): void`  
  Appends an item to the **Tools** dropdown menu.
- `context.registerToolbarButton(button: ToolbarButtonDefinition): void`  
  Adds a button directly onto the top toolbar.

#### UI & Feedback

- `context.showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void`  
  Displays a stylized toast notification at the bottom right.
- `context.setStatus(message: string, isBusy?: boolean): void`  
  Updates the text and pulsating busy indicator in the bottom status bar.

#### 3D Models & Scene

- `context.openModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void>`  
  Clears the scene and opens the model.
- `context.importModel(source: File | Blob | ArrayBuffer | string, name?: string): Promise<void>`  
  Appends the model into the current scene without clearing existing meshes.
- `context.exportGLB(filename?: string): Promise<Blob>`  
  Exports the current model/scene to a binary GLB `Blob`.
- `context.getCurrentFilename(): string` / `context.setCurrentFilename(name: string): void`  
  Reads or sets the active filename.
- `context.getScene(): Scene`  
  Accesses the underlying BabylonJS `Scene` instance for custom shaders or particle effects.

---

## Writing a Custom Plugin

Here is a complete example of creating a custom plugin that adds a menu item and downloads an analytics report:

```typescript
import { MeshEditorPlugin, MeshEditorPluginContext } from "./mesheditor";

export class CustomMeshAnalyzerPlugin implements MeshEditorPlugin {
  public readonly id = "my-analyzer-plugin";
  public readonly name = "Mesh Polygon Analyzer";
  public readonly version = "1.0.0";
  public readonly description = "Analyzes scene complexity and polygon count";

  private context!: MeshEditorPluginContext;

  public async initialize(context: MeshEditorPluginContext): Promise<void> {
    this.context = context;

    // Register into the Tools dropdown menu
    context.registerToolMenuItem({
      id: "menuToolAnalyzeMesh",
      label: "Analyze Polygons",
      icon: "activity",
      onClick: () => this.analyze(),
    });

    // Register a shortcut in the Actions dropdown menu
    context.registerActionMenuItem({
      id: "menuActionQuickAnalyze",
      label: "Quick Complexity Check",
      icon: "zap",
      shortcut: "⌥C",
      onClick: () => this.analyze(),
    });
  }

  private analyze(): void {
    const scene = this.context.getScene();
    const meshCount = scene.meshes.length;
    let totalIndices = 0;

    for (const mesh of scene.meshes) {
      if (mesh.getTotalIndices) {
        totalIndices += mesh.getTotalIndices();
      }
    }

    this.context.showToast(
      `Scene analysis: ${meshCount} meshes, ${(totalIndices / 3).toLocaleString()} triangles.`,
      "info",
    );
  }

  public dispose(): void {
    // Teardown any DOM elements or event listeners if necessary
  }
}
```

---

## Bootstrapping & Integration

### Standalone Bootstrap (Vanilla / Any Project)

```typescript
import { MeshEditorApp } from "./mesheditor";

const app = new MeshEditorApp();
// Ready! Runs completely standalone with built-in primitives, CSG sculpting,
// outliner, textures, and file import/export.
```

### Adding Project Plugins

```typescript
import { MeshEditorApp } from "./mesheditor";
import { AssetLibraryPlugin, SaveAssetPlugin } from "./plugins/mesheditor";

async function bootstrap() {
  const app = new MeshEditorApp();

  // Register project-specific extensions
  await app.use(new AssetLibraryPlugin());
  await app.use(new SaveAssetPlugin());
}

bootstrap();
```

---

## Build Commands Overview (`package.json`)

| Target Platform                      | Command                                 | Description / Output                                                                                                                                                                          |
| :----------------------------------- | :-------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standalone Web (Dev)**             | `npm run dev`                           | Starts the Webpack Dev Server on `http://localhost:8080`                                                                                                                                      |
| **Standalone Web (Prod)**            | `npm run build`                         | Builds the standalone web application into `dist/`                                                                                                                                            |
| **NPM Library & Web Component**      | `npm run build:lib`                     | Builds ESM + `.d.ts` (`dist-lib/esm/`), UMD with `@babylonjs/*` as `peerDependencies` (`dist-lib/index.umd.js`), and a standalone bundle (`dist-lib/standalone/mesheditor-element.bundle.js`) |
| **Desktop App (Dev Mode)**           | `npm run desktop:dev`                   | Launches Electron connected to the local dev server (`http://localhost:8080`)                                                                                                                 |
| **Desktop App (Local Start)**        | `npm run desktop:start`                 | Builds `dist/` and starts the Electron desktop app (`electron/main.js`)                                                                                                                       |
| **macOS App (`.dmg` / `.zip`)**      | `npm run desktop:build:mac`             | Packages the macOS app (`arm64` & `x64`) via `electron-builder.yml` into `release/`                                                                                                           |
| **Windows App (`.exe`)**             | `npm run desktop:build:win`             | Packages the Windows NSIS installer & portable `.exe` into `release/`                                                                                                                         |
| **Linux App (`.AppImage` / `.deb`)** | `npm run desktop:build:linux`           | Packages the Linux `AppImage` and Debian `.deb` package into `release/`                                                                                                                       |
| **All Desktop Platforms**            | `npm run desktop:build:all`             | Packages macOS, Windows, and Linux builds in one run into `release/`                                                                                                                          |
| **Integration Tests (Headless 3D)**  | `npm test` / `npm run test:integration` | Runs fast Vitest + Babylon.js `NullEngine` integration tests (`tests/integration/`)                                                                                                           |
| **Integration Tests (Watch)**        | `npm run test:watch`                    | Runs Vitest in interactive watch mode                                                                                                                                                         |
| **End-to-End Tests (Browser)**       | `npm run test:e2e`                      | Starts the dev server and runs Playwright Chromium E2E tests (`tests/e2e/`)                                                                                                                   |
| **Full Test Suite**                  | `npm run test:all`                      | Runs all integration tests followed by all Playwright E2E tests                                                                                                                               |
| **Sync Tool View Templates**         | `npm run sync:templates`                | Synchronizes decentralized `.ejs` tool views into `toolViews.ts` and updates `src/template.ts`                                                                                                |
| **Clean Build Artifacts**            | `npm run clean`                         | Removes `dist/`, `dist-lib/`, and `release/`                                                                                                                                                  |

---

## Multi-Target Adapters & Integration Guide

### 1. Standalone Web Application

```bash
# Development server with hot reload (http://localhost:8080)
npm run dev

# Production build (outputs to dist/)
npm run build
```

### 2. NPM Library & Web Component (`<mesh-editor>`)

Build the NPM library outputs (`dist-lib/esm`, `dist-lib/index.umd.js`, TypeScript `.d.ts` declarations, and `dist-lib/standalone/mesheditor-element.bundle.js`):

```bash
npm run build:lib
```

#### A) Using as a Web Component (`<mesh-editor>`)

```typescript
import "mesheditor";
```

```html
<div style="width: 100%; height: 700px;">
  <mesh-editor
    id="myEditor"
    src="/assets/models/character.glb"
    layout="stackpanel"
    grid="true"
    save-button-label="Save to Project"
    suppress-download
  ></mesh-editor>
</div>

<script type="module">
  const editor = document.getElementById("myEditor");

  // Listen to exported / saved models from the editor
  editor.addEventListener("model-saved", (e) => {
    const { blob, filename } = e.detail;
    console.log("Saved GLB blob from editor:", filename, blob);
  });

  editor.addEventListener("model-exported", (e) => {
    const { blob, filename, format } = e.detail;
    console.log(`Exported ${format}:`, filename, blob);
  });

  // Programmatic API on the element
  // await editor.openModel('/assets/other.glb');
  // const glbBlob = await editor.exportGLB('character_edited');
</script>
```

#### B) Using `MeshEditorApp` & `HostAppAdapter` Programmatically

```typescript
import { MeshEditorApp, HostAppAdapter } from "mesheditor";

const app = new MeshEditorApp({
  container: document.getElementById("editor-mount")!,
  layoutMode: "stackpanel",
  adapter: new HostAppAdapter({
    saveButtonLabel: "Save to Game",
    suppressBrowserDownload: true,
    onSaveToHost: async (blob, filename) => {
      // Upload or store the GLB blob in your host application
      console.log("Received GLB from MeshEditor:", filename, blob.size);
    },
  }),
});
```

---

### 3. Desktop App (macOS, Windows, Linux via Electron)

The project includes a full **Electron Desktop Adapter** (`electron/main.js`, `electron/preload.js`, `ElectronPlatformAdapter`) providing:

- Native OS File Open & Import dialogs (including automatic companion `.bin` & texture resolution for `.gltf` files)
- Native OS File Save dialogs (`⌘S` / `Ctrl+S`) writing directly to the local filesystem
- Native macOS / Windows / Linux Application Menu Bar with keyboard shortcuts

#### Installing Electron Dev Dependencies (once)

```bash
npm install --save-dev electron electron-builder
```

#### Running & Building Desktop Apps

```bash
# Run desktop app in development mode (connects to webpack dev server)
npm run desktop:dev

# Build web assets & launch Electron desktop app locally
npm run desktop:start

# Package native macOS app (.dmg & .zip for Apple Silicon arm64 & Intel x64)
npm run desktop:build:mac

# Package native Windows app (NSIS installer .exe & Portable .exe)
npm run desktop:build:win

# Package native Linux app (.AppImage & .deb)
npm run desktop:build:linux
```

---

## Testing Architecture & Strategy

Testing a 3D WebGL application requires balancing **execution speed & determinism** (scene graph math, vertex manipulation, undo/redo state) with **real browser verification** (WebGL canvas initialization, DOM menus, dat.GUI controls, and custom elements).

The Mesh Editor uses a **two-tier testing architecture**:

```
tests/
├── integration/
│   ├── service.test.ts          # Stage 1: Core 3D service tests (Vitest + Babylon NullEngine)
│   └── app-and-plugins.test.ts  # Stage 1: UI mounting, Outliner DOM sync, PluginManager & HostAppAdapter
└── e2e/
    └── editor.spec.ts           # Stage 2: Full browser E2E smoke & workflow tests (Playwright Chromium)
```

### Stage 1: Headless 3D Integration Tests (`Vitest` + Babylon.js `NullEngine` + `jsdom`)

The core [`MeshEditorService`](src/MeshEditorService.ts) and [`MeshEditorApp`](src/MeshEditorApp.ts) accept an optional custom `Engine` instance (`customEngine?: Engine`), allowing tests to inject Babylon's headless **`NullEngine`**. This executes the real Babylon.js 3D scene graph, bounding box calculations, vertex buffer mutations, and hierarchy transformations directly in Node.js without requiring a physical GPU or browser window (~2.5 seconds for the entire suite):

- **`tests/integration/service.test.ts`**:
  - **Scene & Environment**: Camera, lights, ground grid visibility/sizing, and clear color updates.
  - **Primitive Generation**: Spawning `Box`, `Sphere`, `Cylinder`, `Cone`, `Capsule`, `Torus`, `Plane`, `Ground`, and `Polyhedron` meshes with valid vertex data and `PBRMaterial`.
  - **Selection & Multi-Selection Proxy**: Single selection, toggle selection, range selection, and temporary multi-selection transform proxy parenting.
  - **Grouping & Hierarchy**: Grouping multiple meshes into `TransformNode` containers (`groupSelected`) and ungrouping (`ungroupSelected`) with full **Undo / Redo** verification.
  - **Clipboard & Lifecycle**: Copy, paste, duplicate, and delete operations with Undo / Redo restoration.
  - **Transform & Pivot Utilities**: Snap to ground ($Y \ge 0$), center to origin, degree-based rotation helpers, and baking transforms into vertex positions.
  - **Facet & Vertex Editing**: Toggling the facet editor, extruding selected triangular facets, flipping face normals, and deleting individual facets.
  - **Materials & UV Mapping**: Creating PBR materials and applying Triplanar and Planar (`top`, `front`, `side`) UV projections.
- **`tests/integration/app-and-plugins.test.ts`**:
  - **DOM & Outliner Synchronization**: Mounting `MeshEditorApp` into a custom container and verifying automatic `#statsMeshes` and `#outlinerTreeContainer` DOM updates when meshes are added.
  - **Plugin Lifecycle**: Registering, executing toolbar/menu callbacks, and disposing custom plugins via [`PluginManager`](src/plugin.ts).
  - **Host Application Adapter**: Verifying [`HostAppAdapter`](src/adapters/HostAppAdapter.ts) custom save toolbar buttons (`saveButtonLabel`) and `onModelLoaded` / `onModelExported` callbacks.

### Stage 2: Real Browser End-to-End Tests (`Playwright` + Headless Chromium WebGL)

While `NullEngine` verifies 3D logic at high speed, **Stage 2 (`tests/e2e/editor.spec.ts`)** launches the compiled application in a real Chromium browser with WebGL enabled (`playwright.config.ts`) to verify end-to-end user workflows:

1. **Application Boot & Web Component Registration**: Verifies zero console/page errors on startup, active WebGL scene initialization, and `<mesh-editor>` Custom Element registration.
2. **UI Primitive Creation Workflow**: Opens _Tools → Create Mesh_, triggers _Spawn at Origin_ inside the `dat.GUI` panel, and verifies live updates in the Scene Objects outliner and polygon/mesh counters.
3. **Interactive Delete & Undo/Redo**: Deletes a selected mesh through _Actions → Delete Selected_ and restores/re-deletes it via the top toolbar _Undo_ (`#btnUndo`) and _Redo_ (`#btnRedo`) buttons.
4. **Layout & Gizmo Switching**: Toggles between _Floating_ and _Stackpanel_ layout modes and switches active transformation gizmos (_Move_, _Rotate_, _Scale_).
5. **Modal Dialogs**: Opens and closes the _Help & Keyboard Shortcuts_ modal.

### Running the Tests

```bash
# Run fast headless 3D integration tests (Vitest + NullEngine)
npm test

# Run integration tests in interactive watch mode during development
npm run test:watch

# Run browser E2E tests (automatically starts webpack-dev-server on port 8080)
npm run test:e2e

# Run the complete test suite (Integration + E2E)
npm run test:all
```

---

## CI/CD & GitHub Releases (`.github/workflows/`)

Three GitHub Actions workflows are included for automated building, testing, and multi-platform distribution:

| Workflow                             | File                                                                                                        | Trigger                                         | Description                                                                                                                                                                                                                                                                                    |
| :----------------------------------- | :---------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI — Build & Verify Targets**      | [`.github/workflows/ci.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/ci.yml)           | Push / PR on `main`, `master`, `develop`        | Runs `type-check`, executes the `Vitest` integration test suite (`npm run test:integration`), builds the Standalone Web App (`dist/`) and the NPM Library & `<mesh-editor>` Web Component (`dist-lib/` + `.tgz`), and uploads build artifacts.                                                 |
| **Release & Distribute All Targets** | [`.github/workflows/release.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/release.yml) | Tag `v*.*.*` (e.g. `v1.0.0`) or Manual Dispatch | Builds **macOS** (`.dmg` & `.zip` for `arm64`/`x64`), **Windows** (`.exe` NSIS & Portable), **Linux** (`.AppImage` & `.deb`), **Standalone Web** (`.zip`), and **NPM Library / Web Component** (`.tgz` & `.zip`), generates `SHA256SUMS.txt`, and publishes everything to **GitHub Releases**. |
| **Deploy to GitHub Pages**           | [`.github/workflows/pages.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/pages.yml)     | Push on `main` / `master` or Manual Dispatch    | Automatically deploys the Standalone Web App (`dist/`) to **GitHub Pages**.                                                                                                                                                                                                                    |

### Creating a New GitHub Release

Push a semantic version tag to trigger the full multi-platform release pipeline:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Bundling & Asset Setup

The CSS stylesheet is maintained in `mesheditor.css` and copied to the build root via Webpack's `CopyWebpackPlugin`:

```javascript
new CopyWebpackPlugin({
  patterns: [{ from: "src/mesheditor.css", to: "mesheditor.css" }],
});
```

In `mesheditor.ejs`, the stylesheet is loaded cleanly via:

```html
<link rel="stylesheet" href="./mesheditor.css" />
```
