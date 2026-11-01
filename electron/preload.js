const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes a secure, context-isolated bridge (`window.meshEditorElectron`)
 * for the `ElectronPlatformAdapter` in the renderer process.
 */
contextBridge.exposeInMainWorld('meshEditorElectron', {
  isElectron: true,
  platform: process.platform,

  openFilesDialog: (options) => ipcRenderer.invoke('dialog:openFiles', options),

  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  onMenuCommand: (callback) => {
    const listener = (_event, command, payload) => {
      callback(command, payload);
    };
    ipcRenderer.on('menu:command', listener);
    return () => {
      ipcRenderer.removeListener('menu:command', listener);
    };
  },

  onFileOpenFromOS: (callback) => {
    const listener = (_event, payloads) => {
      callback(payloads);
    };
    ipcRenderer.on('file:open-from-os', listener);
    return () => {
      ipcRenderer.removeListener('file:open-from-os', listener);
    };
  },

  notifyReady: () => {
    ipcRenderer.send('app:ready');
  },

  previewFile: (filePath, displayName) => ipcRenderer.invoke('preview:file', { filePath, displayName }),

  previewSnapshot: (base64Data, filename) => ipcRenderer.invoke('preview:snapshot', { base64Data, filename }),

  setWindowTitle: (title) => {
    ipcRenderer.send('window:setTitle', title);
  },

  setRepresentedFilename: (filePath) => {
    ipcRenderer.send('window:setRepresentedFilename', filePath);
  },

  setDocumentEdited: (isEdited) => {
    ipcRenderer.send('window:setDocumentEdited', isEdited);
  },
});
