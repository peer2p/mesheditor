const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const docsDir = path.join(rootDir, 'docs');

if (!fs.existsSync(distDir)) {
  console.error('[prepare-pages] dist directory not found. Please run npm run build first.');
  process.exit(1);
}

// 1. Copy dist/index.html to dist/app.html so the standalone web editor is available at /app.html
const distIndex = path.join(distDir, 'index.html');
const distApp = path.join(distDir, 'app.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, distApp);
  console.log('[prepare-pages] Copied dist/index.html -> dist/app.html (Standalone Web App)');
}

// 2. Copy docs/* to dist/ (marketing landing page at dist/index.html)
if (fs.existsSync(docsDir)) {
  fs.cpSync(docsDir, distDir, { recursive: true, force: true });
  console.log('[prepare-pages] Copied docs/* -> dist/ (Marketing Landing Page at root)');
}

// 3. Ensure src/promptImages are present in dist/promptImages
const promptImagesSrc = path.join(rootDir, 'src', 'promptImages');
if (fs.existsSync(promptImagesSrc)) {
  fs.cpSync(promptImagesSrc, path.join(distDir, 'promptImages'), { recursive: true, force: true });
  console.log('[prepare-pages] Copied src/promptImages -> dist/promptImages');
}

// 4. Ensure standalone Web Component bundle is available in dist/ for web component demo
const standaloneBundleSrc = path.join(rootDir, 'dist-lib', 'standalone', 'mesheditor-element.bundle.js');
if (fs.existsSync(standaloneBundleSrc)) {
  fs.copyFileSync(standaloneBundleSrc, path.join(distDir, 'mesheditor-element.bundle.js'));
  const standaloneMapSrc = path.join(rootDir, 'dist-lib', 'standalone', 'mesheditor-element.bundle.js.map');
  if (fs.existsSync(standaloneMapSrc)) {
    fs.copyFileSync(standaloneMapSrc, path.join(distDir, 'mesheditor-element.bundle.js.map'));
  }
  console.log('[prepare-pages] Copied standalone Web Component bundle -> dist/mesheditor-element.bundle.js');
}

console.log('[prepare-pages] Successfully prepared GitHub Pages artifact in dist/');

