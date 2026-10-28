const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/mesheditor.css');
const outPath = path.resolve(__dirname, '../src/styles.ts');

const css = fs.readFileSync(cssPath, 'utf8');
const ts = `/**
 * Auto-generated inline CSS styles for Mesh Editor.
 * Allows Web Components (<mesh-editor>) and NPM library consumers
 * to mount the editor with zero external CSS configuration required.
 */
export const MESH_EDITOR_CSS: string = ${JSON.stringify(css)};

/**
 * Injects the Mesh Editor stylesheet into the document head or a ShadowRoot
 * if it is not already present.
 */
export function ensureMeshEditorStyles(target: Document | ShadowRoot = document): void {
  if (typeof document === 'undefined') return;

  if (target instanceof Document) {
    if (
      target.getElementById('mesh-editor-styles') ||
      target.querySelector('link[href*="mesheditor.css"]')
    ) {
      return;
    }
    const style = target.createElement('style');
    style.id = 'mesh-editor-styles';
    style.textContent = MESH_EDITOR_CSS;
    target.head.appendChild(style);
  } else {
    if (target.getElementById('mesh-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'mesh-editor-styles';
    style.textContent = MESH_EDITOR_CSS;
    target.appendChild(style);
  }
}
`;

fs.writeFileSync(outPath, ts, 'utf8');
console.log('[sync-styles] Synced src/mesheditor.css -> src/styles.ts');
