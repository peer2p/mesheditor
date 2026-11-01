const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable hardware acceleration and WebGL2 / WebGPU optimizations across macOS, Windows, and Linux
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const openWindows = new Set();
const pendingInitialFiles = [];

const MIME_MAP = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'text/plain',
  '.stl': 'application/sla',
  '.ply': 'application/octet-stream',
  '.babylon': 'application/json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.dds': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
};

const MODEL_EXTENSIONS = new Set(['.glb', '.gltf', '.obj', '.stl', '.ply', '.babylon']);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Resolves a list of file paths into payloads (with companion buffers/textures for glTF).
 */
function resolveFilePayloads(filePaths) {
  const loadedPaths = new Set();
  const payloads = [];

  const addFilePayload = (filePath, relativeName) => {
    const normalized = path.resolve(filePath);
    if (loadedPaths.has(normalized)) return;
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) return;
    loadedPaths.add(normalized);

    const buffer = fs.readFileSync(normalized);
    payloads.push({
      name: relativeName || path.basename(normalized),
      path: normalized,
      data: new Uint8Array(buffer),
      mimeType: getMimeType(normalized),
    });
  };

  for (const filePath of filePaths) {
    addFilePayload(filePath);

    // If a .gltf file was selected, automatically include companion .bin and texture files from its directory
    if (path.extname(filePath).toLowerCase() === '.gltf') {
      try {
        const baseDir = path.dirname(filePath);
        const gltfJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const uris = [];
        if (Array.isArray(gltfJson.buffers)) {
          gltfJson.buffers.forEach((b) => b.uri && uris.push(b.uri));
        }
        if (Array.isArray(gltfJson.images)) {
          gltfJson.images.forEach((img) => img.uri && uris.push(img.uri));
        }
        for (const uri of uris) {
          if (uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://')) continue;
          const decodedUri = decodeURIComponent(uri);
          const companionPath = path.resolve(baseDir, decodedUri);
          if (companionPath.startsWith(baseDir)) {
            addFilePayload(companionPath, decodedUri.replace(/\\/g, '/'));
          }
        }
      } catch (err) {
        console.warn('[Electron] Could not auto-resolve companion files for .gltf:', err);
      }
    }
  }

  return payloads;
}

/**
 * Dispatches files to a specific target window.
 */
function dispatchFilesToWindow(win, filePaths) {
  if (!win || win.isDestroyed() || !filePaths || filePaths.length === 0) return;
  const payloads = resolveFilePayloads(filePaths);
  if (payloads.length > 0) {
    win.webContents.send('file:open-from-os', payloads);
    win._hasLoadedDocument = true;
    if (process.platform === 'darwin' && payloads[0]?.path) {
      app.addRecentDocument(payloads[0].path);
    }
  }
}

/**
 * Resolves the active or event target window dynamically.
 */
function getTargetWindow(event) {
  if (event && event.sender) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) return win;
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  if (openWindows.size > 0) {
    return Array.from(openWindows)[0];
  }
  return null;
}

// macOS "Open With" / Double-click in Finder / Drag & Drop to Dock handler
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!app.isReady()) {
    pendingInitialFiles.push(filePath);
    return;
  }

  const focused = BrowserWindow.getFocusedWindow();
  if (focused && focused._isRendererReady && !focused._hasLoadedDocument) {
    dispatchFilesToWindow(focused, [filePath]);
  } else {
    createWindow([filePath]);
  }
});

// Process command-line file arguments (Windows / Linux / macOS CLI)
function getCommandLineFileArgs() {
  const args = process.argv.slice(1);
  return args.filter((arg) => {
    if (arg.startsWith('-') || arg.startsWith('http:') || arg.startsWith('https:')) return false;
    try {
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        const ext = path.extname(arg).toLowerCase();
        return MODEL_EXTENSIONS.has(ext);
      }
    } catch {
      return false;
    }
    return false;
  });
}

async function handleMenuOpen() {
  const targetWin = BrowserWindow.getFocusedWindow();
  if (targetWin && !targetWin.isDestroyed()) {
    targetWin.webContents.send('menu:command', 'file:open');
  } else {
    const result = await dialog.showOpenDialog(null, {
      title: 'Open 3D Model',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '3D Models & Assets', extensions: ['glb', 'gltf', 'obj', 'stl', 'ply', 'babylon'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      createWindow(result.filePaths);
    }
  }
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const sendMenuCommand = (cmd, payload) => {
    const targetWin = BrowserWindow.getFocusedWindow() || (openWindows.size > 0 ? Array.from(openWindows)[0] : null);
    if (targetWin && !targetWin.isDestroyed()) {
      targetWin.webContents.send('menu:command', cmd, payload);
    }
  };

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow(),
        },
        { type: 'separator' },
        {
          label: 'Open 3D Model...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleMenuOpen(),
        },
        {
          label: 'Import 3D Model...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuCommand('file:import'),
        },
        ...(isMac
          ? [
              {
                label: 'Open Recent',
                role: 'recentdocuments',
                submenu: [
                  {
                    label: 'Clear Recent',
                    role: 'clearrecentdocuments',
                  },
                ],
              },
            ]
          : []),
        { type: 'separator' },
        {
          label: 'Save / Export Model...',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuCommand('file:save'),
        },
        { type: 'separator' },
        ...(isMac
          ? [
              {
                label: 'Quick Look Preview',
                accelerator: 'CmdOrCtrl+Y',
                click: () => sendMenuCommand('file:quicklook'),
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close',
        },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuCommand('edit:undo'),
        },
        {
          label: 'Redo',
          accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => sendMenuCommand('edit:redo'),
        },
        { type: 'separator' },
        {
          label: 'Copy Mesh',
          accelerator: 'CmdOrCtrl+C',
          click: () => sendMenuCommand('edit:copy'),
        },
        {
          label: 'Paste Mesh',
          accelerator: 'CmdOrCtrl+V',
          click: () => sendMenuCommand('edit:paste'),
        },
        {
          label: 'Duplicate Mesh',
          accelerator: 'CmdOrCtrl+D',
          click: () => sendMenuCommand('edit:duplicate'),
        },
        { type: 'separator' },
        {
          label: 'Group Selected',
          accelerator: 'CmdOrCtrl+G',
          click: () => sendMenuCommand('edit:group'),
        },
        {
          label: 'Ungroup Selected',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendMenuCommand('edit:ungroup'),
        },
        { type: 'separator' },
        {
          label: 'Delete Selected',
          accelerator: 'Delete',
          click: () => sendMenuCommand('edit:delete'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Center Selection',
          accelerator: 'F',
          click: () => sendMenuCommand('view:focus'),
        },
        {
          label: 'Toggle Ground Grid',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendMenuCommand('view:toggle-grid'),
        },
        { type: 'separator' },
        {
          label: 'Floating Windows Layout',
          click: () => sendMenuCommand('view:layout-floating'),
        },
        {
          label: 'Docked Stackpanel Layout',
          click: () => sendMenuCommand('view:layout-stack'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Mesh Editor Guide & Documentation',
          click: () => sendMenuCommand('help:documentation'),
        },
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/peer2p/mesheditor');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow(filePathsToOpen = null) {
  const isMac = process.platform === 'darwin';
  const iconPath = path.join(__dirname, '..', 'build', isMac ? 'icon.icns' : 'icon.png');

  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Mesh Editor',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f1218',
    show: false,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 14 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  win._pendingFiles = Array.isArray(filePathsToOpen) && filePathsToOpen.length > 0 ? [...filePathsToOpen] : [];
  win._isRendererReady = false;
  win._hasLoadedDocument = false;
  openWindows.add(win);

  if (isMac && app.setAboutPanelOptions) {
    app.setAboutPanelOptions({
      applicationName: 'Mesh Editor',
      applicationVersion: app.getVersion(),
      copyright: 'Copyright © 2026 Daniel Peer',
      credits: 'A modern 3D Mesh Editor and manipulation studio',
    });
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  const devUrl = process.env.MESHEDITOR_DEV_URL || (process.argv.includes('--dev') ? 'http://localhost:8080' : null);
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(indexPath);
  }

  win.on('closed', () => {
    openWindows.delete(win);
  });

  return win;
}

// IPC Handlers
ipcMain.on('app:ready', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win._isRendererReady = true;
    if (win._pendingFiles && win._pendingFiles.length > 0) {
      const files = [...win._pendingFiles];
      win._pendingFiles.length = 0;
      dispatchFilesToWindow(win, files);
    }
  }
});

ipcMain.handle('dialog:openFiles', async (event, options = {}) => {
  const targetWin = getTargetWindow(event);
  if (!targetWin) return null;

  const extensions = options.extensions || [
    'glb',
    'gltf',
    'obj',
    'stl',
    'ply',
    'babylon',
    'bin',
    'png',
    'jpg',
    'jpeg',
    'webp',
  ];

  const properties = ['openFile'];
  if (options.multiSelections !== false) {
    properties.push('multiSelections');
  }

  const result = await dialog.showOpenDialog(targetWin, {
    title: options.title || 'Open 3D Model',
    properties,
    filters: [
      { name: '3D Models & Assets', extensions },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  targetWin._hasLoadedDocument = true;
  return resolveFilePayloads(result.filePaths);
});

ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
  const targetWin = getTargetWindow(event);
  if (!targetWin || !options.data) return { saved: false };

  const format = (options.format || 'glb').toLowerCase();
  const defaultPath = options.defaultPath || `model_edited.${format}`;

  const filterMap = {
    glb: { name: 'Binary glTF (.glb)', extensions: ['glb'] },
    gltf: { name: 'glTF 2.0 (.gltf)', extensions: ['gltf'] },
    obj: { name: 'Wavefront OBJ (.obj)', extensions: ['obj'] },
    stl: { name: 'Stereolithography STL (.stl)', extensions: ['stl'] },
  };

  const primaryFilter = filterMap[format] || { name: '3D Model', extensions: [format] };

  const result = await dialog.showSaveDialog(targetWin, {
    title: options.title || 'Save 3D Model',
    defaultPath,
    filters: [primaryFilter, { name: 'All Files', extensions: ['*'] }],
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  fs.writeFileSync(result.filePath, Buffer.from(options.data));

  if (process.platform === 'darwin') {
    app.addRecentDocument(result.filePath);
  }

  return { saved: true, filePath: result.filePath };
});

ipcMain.on('window:setTitle', (event, title) => {
  const targetWin = getTargetWindow(event);
  if (targetWin && !targetWin.isDestroyed() && typeof title === 'string') {
    targetWin.setTitle(title);
  }
});

ipcMain.on('window:setRepresentedFilename', (event, filePath) => {
  const targetWin = getTargetWindow(event);
  if (process.platform === 'darwin' && targetWin && !targetWin.isDestroyed()) {
    targetWin.setRepresentedFilename(filePath || '');
    if (filePath) {
      targetWin._hasLoadedDocument = true;
      if (fs.existsSync(filePath)) {
        app.addRecentDocument(filePath);
      }
    }
  }
});

ipcMain.on('window:setDocumentEdited', (event, isEdited) => {
  const targetWin = getTargetWindow(event);
  if (process.platform === 'darwin' && targetWin && !targetWin.isDestroyed()) {
    targetWin.setDocumentEdited(Boolean(isEdited));
  }
});

// macOS Quick Look Preview Handlers
ipcMain.handle('preview:file', async (event, { filePath, displayName }) => {
  const targetWin = getTargetWindow(event);
  if (process.platform === 'darwin' && targetWin && !targetWin.isDestroyed()) {
    if (filePath && fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const nativeMacQuickLookExts = new Set([
        '.usdz',
        '.reality',
        '.png',
        '.jpg',
        '.jpeg',
        '.webp',
        '.gif',
        '.bmp',
        '.tiff',
        '.pdf',
      ]);
      if (!nativeMacQuickLookExts.has(ext)) {
        return {
          success: false,
          error: 'Format not natively readable by macOS Quick Look',
          fallbackToSnapshot: true,
        };
      }
      targetWin.previewFile(filePath, displayName || path.basename(filePath));
      return { success: true };
    }
    return { success: false, error: 'File does not exist on disk' };
  }
  return { success: false, error: 'Quick Look is only supported on macOS' };
});

ipcMain.handle('preview:snapshot', async (event, { base64Data, filename, displayName }) => {
  const targetWin = getTargetWindow(event);
  if (process.platform === 'darwin' && targetWin && !targetWin.isDestroyed()) {
    try {
      const cleanBase64 = (base64Data || '').replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const tempDir = app.getPath('temp');
      const rawName = filename || `MeshEditor_Preview_${Date.now()}`;
      const previewFileName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
      const tempFilePath = path.join(tempDir, previewFileName);
      fs.writeFileSync(tempFilePath, buffer);

      let cleanDisplayName = displayName || previewFileName;
      if (!cleanDisplayName.toLowerCase().endsWith('.png')) {
        cleanDisplayName = `${cleanDisplayName}.png`;
      }

      targetWin.previewFile(tempFilePath, cleanDisplayName);
      return { success: true, filePath: tempFilePath };
    } catch (err) {
      console.warn('[Electron] Could not show Quick Look preview snapshot:', err);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Quick Look is only supported on macOS' };
});

app.whenReady().then(() => {
  createApplicationMenu();

  const cliFiles = getCommandLineFileArgs();
  const initialFiles = pendingInitialFiles.length > 0 ? pendingInitialFiles : cliFiles;

  createWindow(initialFiles.length > 0 ? initialFiles : null);

  app.on('activate', () => {
    if (openWindows.size === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
