const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable hardware acceleration and WebGL2 / WebGPU optimizations across macOS, Windows, and Linux
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

let mainWindow = null;

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

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const sendMenuCommand = (cmd) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:command', cmd);
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
          label: 'Open 3D Model...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuCommand('file:open'),
        },
        {
          label: 'Import 3D Model...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuCommand('file:import'),
        },
        { type: 'separator' },
        {
          label: 'Save / Export Model...',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuCommand('file:save'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
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
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Mesh Editor',
    backgroundColor: '#0f1218',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const devUrl = process.env.MESHEDITOR_DEV_URL || (process.argv.includes('--dev') ? 'http://localhost:8080' : null);
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Native Desktop Adapter
ipcMain.handle('dialog:openFiles', async (_event, options = {}) => {
  if (!mainWindow) return null;

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

  const result = await dialog.showOpenDialog(mainWindow, {
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

  for (const filePath of result.filePaths) {
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
          // Prevent path traversal outside baseDir
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
});

ipcMain.handle('dialog:saveFile', async (_event, options = {}) => {
  if (!mainWindow || !options.data) return { saved: false };

  const format = (options.format || 'glb').toLowerCase();
  const defaultPath = options.defaultPath || `model_edited.${format}`;

  const filterMap = {
    glb: { name: 'Binary glTF (.glb)', extensions: ['glb'] },
    gltf: { name: 'glTF 2.0 (.gltf)', extensions: ['gltf'] },
    obj: { name: 'Wavefront OBJ (.obj)', extensions: ['obj'] },
    stl: { name: 'Stereolithography STL (.stl)', extensions: ['stl'] },
  };

  const primaryFilter = filterMap[format] || { name: '3D Model', extensions: [format] };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save 3D Model',
    defaultPath,
    filters: [primaryFilter, { name: 'All Files', extensions: ['*'] }],
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  fs.writeFileSync(result.filePath, Buffer.from(options.data));
  return { saved: true, filePath: result.filePath };
});

ipcMain.on('window:setTitle', (_event, title) => {
  if (mainWindow && !mainWindow.isDestroyed() && typeof title === 'string') {
    mainWindow.setTitle(title);
  }
});

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

