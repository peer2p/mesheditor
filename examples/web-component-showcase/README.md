# MeshEditor Web Component — StackBlitz & Vite Showcase

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/peer2p/mesheditor/tree/main/examples/web-component-showcase?view=preview)
[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/mesheditor)

This showcase demonstrates how to integrate the `<mesh-editor>` custom element and its dynamic plugin system into a modern Vite + TypeScript application using the official `mesheditor` npm package.

---

## Run in StackBlitz

Click the badge above or navigate to:
**[https://stackblitz.com/github/peer2p/mesheditor/tree/main/examples/web-component-showcase?view=preview](https://stackblitz.com/github/peer2p/mesheditor/tree/main/examples/web-component-showcase?view=preview)**

> [!TIP]
> The link uses `?view=preview` to focus StackBlitz directly on the live app preview. You can also click the **"Open in New Tab"** button in the app header (or StackBlitz's own pop-out icon) to open the 3D studio in a separate full-screen browser window.

---

## Features Demonstrated

1. **Declarative Custom Element**:
   - Zero-boilerplate mounting via `<mesh-editor>`.
   - Host toggles for top toolbar, inspector sidebar, and status footer.
2. **Modular Plugin Architecture**:
   - Dynamic plugin registration via `editor.usePlugin(pluginDefinition)`.
   - Custom Actions menu items (`Validate Polygon Budget`, `Tag as Production Asset`).
   - Custom Tools menu items (`Apply 3-Point Studio Lights`, `Apply Golden Hour Preset`).
   - Built-in toast notifications and status bar updates from plugins.
3. **Host-to-3D Viewport Control**:
   - Adding procedural 3D primitives (Cubes, Spheres, Cylinders, Toruses) into the active BabylonJS scene.
   - Live color palette swatches applied to the currently selected mesh.
4. **Bi-directional Event Stream**:
   - Listens to `editor-ready`, `scene-modified`, `selection-changed`, `model-loaded`, and `model-exported`.
   - Real-time telemetry: mesh count, polygon count, and live rendering FPS.

---

## Running Locally

```bash
cd examples/web-component-showcase
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
