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

console.log('[prepare-pages] Successfully prepared GitHub Pages artifact in dist/');

