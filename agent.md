# Agent Guidelines: Language & Output Policy

## Strict English Language Requirement

**All code, GUI elements, user-facing text, tool labels, logs, prompts, comments, and documentation in this codebase MUST be strictly in English.**

### Rules:
1. **User Interface (GUI)**:
   - All labels, buttons, headers, tooltips, dialogs, quick prompts, badges, placeholders, and empty states MUST be written in English.
   - Never introduce German words (e.g., "Baue", "Schatztruhe", "Steinsäule", "Prompt eingeben", "Fehler", "Fertig", "Zahnrad", "Konto", "Speichern") into HTML templates, EJS templates, or DOM-manipulating code.

2. **System Prompts & AI Skills**:
   - All agent instructions, system prompts, skill descriptions, tool descriptions, and few-shot examples injected into LLMs must be authored in English.
   - When instructing models on what to output, ensure default fallback messages and confirmations are English (e.g., "Finished 3D mesh operations." instead of "Fertig.").

3. **Status Messages, Toasts & Errors**:
   - `events.onToast`, `events.onStatusChanged`, throw statements (`new Error(...)`), status badges, and console logs (`console.warn`, `console.error`, `console.log`) MUST be strictly in English.

4. **Code, Comments & Identifiers**:
   - Variable names, functions, classes, interfaces, comments, and commit messages MUST be in English.

5. **Conversational Communication**:
   - Even if the user communicates in German, code changes, UI additions, and runtime artifacts must remain strictly English.

---

# Tool Architecture & Authoring Guide

The Mesh Editor employs a **Decentralized Modular Tools Architecture**. Every editor tool is completely self-contained with its TypeScript logic, metadata, in-app help guide, lifecycle hooks, and dedicated EJS view template.

## Tool Authoring Checklist

When adding or modifying an editor tool:

1. **File Locations**:
   - Class file: `src/tools/editor/<ToolName>EditorTool.ts`
   - EJS view template: `src/tools/editor/<ToolName>EditorTool.ejs`
   - Both files must reside side-by-side in `src/tools/editor/`.

2. **Inheritance & Abstraction**:
   - Extend `AbstractEditorTool` (`from './AbstractEditorTool'`).
   - `AbstractEditorTool` automatically resolves `getViewTemplate()` from the compiled `.ejs` template and provides `renderView(container?: HTMLElement)` for dynamic DOM mounting.

3. **Required Tool Properties**:
   - `name`: Unique snake_case string identifier (e.g. `'my_tool'`).
   - `dialogId`: Element ID of the floating dialog (e.g. `'dialog-my-tool'`).
   - `triggerButtonId`: Element ID of the trigger button in menus (e.g. `'btnToggleMyTool'`).
   - `toolbarButtonId`: (Optional) Element ID of the quick-access top toolbar button.
   - `menuId`: Menu identifier (typically `'menuTools'`).
   - `menuLabel`: Human-readable label (strictly English, e.g. `'My Tool'`).
   - `icon`: Lucide icon name (e.g. `'brush'`, `'wand-2'`, `'route'`, `'shapes'`).
   - `description`: English summary of what the tool does.
   - `helpText`: HTML markup explaining overview, mouse/keyboard controls, and tips. Rendered inside the in-app help modal opened by the `?` header button.
   - `isExclusive3DTool`: Set to `true` if this tool claims exclusive 3D viewport clicks (e.g. voxel drawing, curve editing). Activating any other tool or gizmo automatically closes/deactivates exclusive tools.

4. **Standard EJS View Structure**:
   - The `.ejs` template represents the floating dialog window:
   ```html
   <div id="dialog-my-tool" class="floating-dialog" style="top: 100px; left: 348px; width: 340px; display: none">
     <div class="dialog-header">
       <span class="dialog-title"><i class="app-icon" data-lucide="wand-2"></i> My Tool</span>
       <div class="dialog-actions">
         <button class="dialog-btn btn-help" title="Help & Tool Guide" aria-label="Help"><i class="app-icon" data-lucide="help-circle"></i></button>
         <button class="dialog-btn btn-min" title="Minimize"><i class="app-icon" data-lucide="minus"></i></button>
         <button class="dialog-btn btn-close" title="Close"><i class="app-icon" data-lucide="x"></i></button>
       </div>
     </div>
     <div class="dialog-body my-tool-body">
       <!-- Tool controls, swatches, inputs, actions -->
     </div>
   </div>
   ```

5. **Lifecycle Hooks**:
   - Implement lifecycle methods on the tool class as needed:
     - `onOpen(app)`: Called when the dialog is opened/displayed.
     - `onClose(app)`: Called when the dialog is closed or deactivated.
     - `onMinimize(app)`: Called when the dialog is collapsed.
     - `onMaximize(app)`: Called when the dialog is restored/expanded.
     - `onUpdateUI(app)`: Called when editor state or scene selection updates.
     - `isActive(app)`: Returns boolean indicating whether the tool is currently active.

6. **Registration & Template Synchronization**:
   - Add `<%- include('./tools/editor/<ToolName>EditorTool.ejs') %>` inside `#stackpanelRightSidebar` in `src/mesheditor.ejs`.
   - Register and instantiate the tool class in `createBuiltinEditorTools()` in `src/tools/editor/index.ts`.
   - Run `npm run sync:templates` (or `npm run build` / `npm test`), which automatically synchronizes `src/tools/editor/toolViews.ts` and `src/template.ts`.
   - If the dialog is not present in the DOM (e.g. custom container or dynamic plugin tool), `MeshEditorApp.toggleDialog` automatically mounts it via `tool.renderView()`.


