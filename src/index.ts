import { MeshEditorApp } from './MeshEditorApp';
import { registerMeshEditorElement } from './web-component';

export * from './types';
export * from './plugin';
export * from './adapters';
export * from './styles';
export * from './template';
export * from './builtInSkills';
export * from './voxel';
export * from './tools';
export * from './AIAgentService';
export * from './MeshEditorService';
export * from './MeshEditorApp';
export * from './web-component';

// Automatically register <mesh-editor> Web Component in browser environments
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  registerMeshEditorElement();
}

// Auto-bootstrap standalone application when a top-level #renderCanvas is found in DOM
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const bootstrap = () => {
    const canvas = document.getElementById('renderCanvas');
    // Only auto-bootstrap if #renderCanvas is not managed by a <mesh-editor> Web Component
    const isInsideWebComponent = canvas?.closest('mesh-editor');
    if (canvas && !isInsideWebComponent && !(window as any).meshEditorApp) {
      try {
        const app = new MeshEditorApp();
        (window as any).meshEditorApp = app;
      } catch (err) {
        console.error('[MeshEditor] Failed to bootstrap application:', err);
      }
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
