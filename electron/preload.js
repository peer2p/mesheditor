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

  setWindowTitle: (title) => {
    ipcRenderer.send('window:setTitle', title);
  },
});

