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
├── index.ts                          # Public exports (App, Service, Adapters, Web Component, Plugins)
├── types.ts                          # Shared data types, callbacks, and events
├── plugin.ts                         # Plugin interfaces (MeshEditorPlugin, Context, PluginManager)
├── template.ts                       # Self-contained HTML UI template
├── styles.ts                         # Auto-injected CSS stylesheet for Web Component / NPM usage
├── MeshEditorService.ts              # Core 3D engine: meshes, gizmos, CSG2, facets, materials
├── MeshEditorApp.ts                  # UI coordinator: dat.GUI panels, outliner, window management
├── adapters/
│   ├── PlatformAdapter.ts            # Platform adapter contract (open/save dialogs, native menu bridge)
│   ├── BrowserPlatformAdapter.ts     # Standalone browser file input & download adapter
│   ├── ElectronPlatformAdapter.ts    # Desktop adapter (macOS, Windows, Linux native dialogs & menus)
│   └── HostAppAdapter.ts             # Embedded host application adapter (callbacks & custom save button)
├── web-component/
│   └── MeshEditorElement.ts          # <mesh-editor> Custom Element
├── mesheditor.ejs                    # Standalone HTML entry template
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
| **Mouse Wheel**         | Zoom in / Zoom out                                           |
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
import { MeshEditorPlugin, MeshEditorPluginContext } from './mesheditor';

export class CustomMeshAnalyzerPlugin implements MeshEditorPlugin {
  public readonly id = 'my-analyzer-plugin';
  public readonly name = 'Mesh Polygon Analyzer';
  public readonly version = '1.0.0';
  public readonly description = 'Analyzes scene complexity and polygon count';

  private context!: MeshEditorPluginContext;

  public async initialize(context: MeshEditorPluginContext): Promise<void> {
    this.context = context;

    // Register into the Tools dropdown menu
    context.registerToolMenuItem({
      id: 'menuToolAnalyzeMesh',
      label: 'Analyze Polygons',
      icon: 'activity',
      onClick: () => this.analyze(),
    });

    // Register a shortcut in the Actions dropdown menu
    context.registerActionMenuItem({
      id: 'menuActionQuickAnalyze',
      label: 'Quick Complexity Check',
      icon: 'zap',
      shortcut: '⌥C',
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

    this.context.showToast(`Scene analysis: ${meshCount} meshes, ${(totalIndices / 3).toLocaleString()} triangles.`, 'info');
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
import { MeshEditorApp } from './mesheditor';

const app = new MeshEditorApp();
// Ready! Runs completely standalone with built-in primitives, CSG sculpting,
// outliner, textures, and file import/export.
```

### Adding Project Plugins

```typescript
import { MeshEditorApp } from './mesheditor';
import { AssetLibraryPlugin, SaveAssetPlugin } from './plugins/mesheditor';

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

| Target Platform | Command | Description / Output |
| :--- | :--- | :--- |
| **Standalone Web (Dev)** | `npm run dev` | Starts the Webpack Dev Server on `http://localhost:8080` |
| **Standalone Web (Prod)** | `npm run build` | Builds the standalone web application into `dist/` |
| **NPM Library & Web Component** | `npm run build:lib` | Builds ESM + `.d.ts` (`dist-lib/esm/`), UMD with `@babylonjs/*` as `peerDependencies` (`dist-lib/index.umd.js`), and a standalone bundle (`dist-lib/standalone/mesheditor-element.bundle.js`) |
| **Desktop App (Dev Mode)** | `npm run desktop:dev` | Launches Electron connected to the local dev server (`http://localhost:8080`) |
| **Desktop App (Local Start)** | `npm run desktop:start` | Builds `dist/` and starts the Electron desktop app (`electron/main.js`) |
| **macOS App (`.dmg` / `.zip`)** | `npm run desktop:build:mac` | Packages the macOS app (`arm64` & `x64`) via `electron-builder.yml` into `release/` |
| **Windows App (`.exe`)** | `npm run desktop:build:win` | Packages the Windows NSIS installer & portable `.exe` into `release/` |
| **Linux App (`.AppImage` / `.deb`)** | `npm run desktop:build:linux` | Packages the Linux `AppImage` and Debian `.deb` package into `release/` |
| **All Desktop Platforms** | `npm run desktop:build:all` | Packages macOS, Windows, and Linux builds in one run into `release/` |
| **Clean Build Artifacts** | `npm run clean` | Removes `dist/`, `dist-lib/`, and `release/` |

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
import 'mesheditor';
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
  const editor = document.getElementById('myEditor');

  // Listen to exported / saved models from the editor
  editor.addEventListener('model-saved', (e) => {
    const { blob, filename } = e.detail;
    console.log('Saved GLB blob from editor:', filename, blob);
  });

  editor.addEventListener('model-exported', (e) => {
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
import { MeshEditorApp, HostAppAdapter } from 'mesheditor';

const app = new MeshEditorApp({
  container: document.getElementById('editor-mount')!,
  layoutMode: 'stackpanel',
  adapter: new HostAppAdapter({
    saveButtonLabel: 'Save to Game',
    suppressBrowserDownload: true,
    onSaveToHost: async (blob, filename) => {
      // Upload or store the GLB blob in your host application
      console.log('Received GLB from MeshEditor:', filename, blob.size);
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

## CI/CD & GitHub Releases (`.github/workflows/`)

Three GitHub Actions workflows are included for automated building, testing, and multi-platform distribution:

| Workflow | File | Trigger | Description |
| :--- | :--- | :--- | :--- |
| **CI — Build & Verify Targets** | [`.github/workflows/ci.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/ci.yml) | Push / PR on `main`, `master`, `develop` | Runs `type-check`, builds the Standalone Web App (`dist/`) and the NPM Library & `<mesh-editor>` Web Component (`dist-lib/` + `.tgz`), and uploads build artifacts. |
| **Release & Distribute All Targets** | [`.github/workflows/release.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/release.yml) | Tag `v*.*.*` (e.g. `v1.0.0`) or Manual Dispatch | Builds **macOS** (`.dmg` & `.zip` for `arm64`/`x64`), **Windows** (`.exe` NSIS & Portable), **Linux** (`.AppImage` & `.deb`), **Standalone Web** (`.zip`), and **NPM Library / Web Component** (`.tgz` & `.zip`), generates `SHA256SUMS.txt`, and publishes everything to **GitHub Releases**. |
| **Deploy to GitHub Pages** | [`.github/workflows/pages.yml`](file:///Users/dpeer/Sites/games/mesheditor/.github/workflows/pages.yml) | Push on `main` / `master` or Manual Dispatch | Automatically deploys the Standalone Web App (`dist/`) to **GitHub Pages**. |

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
  patterns: [
    { from: 'src/mesheditor.css', to: 'mesheditor.css' },
  ],
});
```

In `mesheditor.ejs`, the stylesheet is loaded cleanly via:

```html
<link rel="stylesheet" href="./mesheditor.css" />
```
