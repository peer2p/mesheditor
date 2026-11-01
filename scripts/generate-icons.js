const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const ICONS_DIR = path.join(BUILD_DIR, 'icons');
const ICONSET_APP_DIR = path.join(BUILD_DIR, 'icon.iconset');
const ICONSET_DOC_DIR = path.join(BUILD_DIR, 'document-3d.iconset');

[BUILD_DIR, ICONS_DIR, ICONSET_APP_DIR, ICONSET_DOC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 1. High-resolution App Icon SVG (macOS Squircle style, 1024x1024)
const appIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Squircle Gradient -->
    <linearGradient id="bgGrad" x1="512" y1="100" x2="512" y2="924" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e2430" />
      <stop offset="50%" stop-color="#141822" />
      <stop offset="100%" stop-color="#0b0d13" />
    </linearGradient>

    <!-- Rim Light Gradient -->
    <linearGradient id="rimGrad" x1="512" y1="100" x2="512" y2="924" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
      <stop offset="40%" stop-color="#38bdf8" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05" />
    </linearGradient>

    <!-- Drop Shadow Filter for Squircle -->
    <filter id="squircleShadow" x="40" y="50" width="944" height="944" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#000000" flood-opacity="0.55" />
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.35" />
    </filter>

    <!-- Subtle Glow Behind 3D Mesh -->
    <radialGradient id="meshAmbientGlow" cx="512" cy="512" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28" />
      <stop offset="50%" stop-color="#6366f1" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
    </radialGradient>

    <!-- 3D Cube Facet Gradients -->
    <!-- Top Face Gradient -->
    <linearGradient id="topFaceGrad" x1="512" y1="280" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>

    <!-- Left Face Gradient -->
    <linearGradient id="leftFaceGrad" x1="280" y1="512" x2="512" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <!-- Right Face Gradient -->
    <linearGradient id="rightFaceGrad" x1="744" y1="512" x2="512" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>

    <!-- Glow for Vertex Nodes -->
    <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- macOS Standard Squircle Body with Drop Shadow -->
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bgGrad)" filter="url(#squircleShadow)" stroke="url(#rimGrad)" stroke-width="3" />

  <!-- Inner Ambient Glow -->
  <circle cx="512" cy="512" r="300" fill="url(#meshAmbientGlow)" />

  <!-- Subtle 3D Grid Overlay Lines on Background -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="2">
    <line x1="200" y1="260" x2="824" y2="260" />
    <line x1="160" y1="380" x2="864" y2="380" />
    <line x1="140" y1="512" x2="884" y2="512" />
    <line x1="160" y1="644" x2="864" y2="644" />
    <line x1="200" y1="764" x2="824" y2="764" />
    <line x1="260" y1="200" x2="260" y2="824" />
    <line x1="380" y1="160" x2="380" y2="864" />
    <line x1="512" y1="140" x2="512" y2="884" />
    <line x1="644" y1="160" x2="644" y2="864" />
    <line x1="764" y1="200" x2="764" y2="824" />
  </g>

  <!-- 3D Geometric Isometric Mesh Model -->
  <!-- Top Face: Points (512, 280), (744, 400), (512, 516), (280, 400) -->
  <polygon points="512,280 744,400 512,516 280,400" fill="url(#topFaceGrad)" />

  <!-- Left Face: Points (280, 400), (512, 516), (512, 756), (280, 640) -->
  <polygon points="280,400 512,516 512,756 280,640" fill="url(#leftFaceGrad)" />

  <!-- Right Face: Points (512, 516), (744, 400), (744, 640), (512, 756) -->
  <polygon points="512,516 744,400 744,640 512,756" fill="url(#rightFaceGrad)" />

  <!-- Subdivided Mesh Wireframe Tessellation Lines -->
  <!-- Top Face Wireframe Subdivisions -->
  <g stroke="#ffffff" stroke-width="3" stroke-opacity="0.45" stroke-linecap="round">
    <!-- Midpoint crosses -->
    <line x1="396" y1="340" x2="628" y2="458" />
    <line x1="628" y1="340" x2="396" y2="458" />
    <!-- Diagonal cross -->
    <line x1="512" y1="280" x2="512" y2="516" stroke-opacity="0.6" stroke-width="4" />
    <line x1="280" y1="400" x2="744" y2="400" stroke-opacity="0.6" stroke-width="4" />
  </g>

  <!-- Left Face Wireframe Subdivisions -->
  <g stroke="#ffffff" stroke-width="3" stroke-opacity="0.38" stroke-linecap="round">
    <line x1="280" y1="520" x2="512" y2="636" />
    <line x1="396" y1="458" x2="396" y2="698" />
    <line x1="280" y1="400" x2="512" y2="756" stroke-opacity="0.3" stroke-width="2" />
  </g>

  <!-- Right Face Wireframe Subdivisions -->
  <g stroke="#ffffff" stroke-width="3" stroke-opacity="0.42" stroke-linecap="round">
    <line x1="512" y1="636" x2="744" y2="520" />
    <line x1="628" y1="458" x2="628" y2="698" />
    <line x1="744" y1="400" x2="512" y2="756" stroke-opacity="0.3" stroke-width="2" />
  </g>

  <!-- Outer Isometric Cube Edges -->
  <g stroke="#e0f2fe" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="512" y1="280" x2="744" y2="400" />
    <line x1="744" y1="400" x2="744" y2="640" />
    <line x1="744" y1="640" x2="512" y2="756" />
    <line x1="512" y1="756" x2="280" y2="640" />
    <line x1="280" y1="640" x2="280" y2="400" />
    <line x1="280" y1="400" x2="512" y2="280" />

    <!-- Center Y edges -->
    <line x1="512" y1="516" x2="280" y2="400" />
    <line x1="512" y1="516" x2="744" y2="400" />
    <line x1="512" y1="516" x2="512" y2="756" />
  </g>

  <!-- Radiant Glowing 3D Mesh Vertex Nodes -->
  <g filter="url(#nodeGlow)">
    <!-- Top vertex -->
    <circle cx="512" cy="280" r="10" fill="#38bdf8" stroke="#ffffff" stroke-width="3" />
    <!-- Center vertex -->
    <circle cx="512" cy="516" r="12" fill="#00f0ff" stroke="#ffffff" stroke-width="3.5" />
    <!-- Bottom vertex -->
    <circle cx="512" cy="756" r="10" fill="#818cf8" stroke="#ffffff" stroke-width="3" />
    <!-- Left vertex -->
    <circle cx="280" cy="400" r="10" fill="#38bdf8" stroke="#ffffff" stroke-width="3" />
    <!-- Right vertex -->
    <circle cx="744" cy="400" r="10" fill="#a78bfa" stroke="#ffffff" stroke-width="3" />
    <!-- Bottom-left vertex -->
    <circle cx="280" cy="640" r="9" fill="#2563eb" stroke="#ffffff" stroke-width="2.5" />
    <!-- Bottom-right vertex -->
    <circle cx="744" cy="640" r="9" fill="#7c3aed" stroke="#ffffff" stroke-width="2.5" />
    <!-- Face Center Sub-nodes -->
    <circle cx="512" cy="398" r="7" fill="#67e8f9" stroke="#ffffff" stroke-width="2" />
    <circle cx="396" cy="578" r="7" fill="#38bdf8" stroke="#ffffff" stroke-width="2" />
    <circle cx="628" cy="578" r="7" fill="#c084fc" stroke="#ffffff" stroke-width="2" />
  </g>
</svg>`;

// 2. 3D Document Icon SVG (1024x1024)
const docIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="docShadow" x="120" y="80" width="784" height="884" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="24" stdDeviation="20" flood-color="#000000" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.25" />
    </filter>
    <linearGradient id="docBg" x1="512" y1="120" x2="512" y2="904" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="foldGrad" x1="684" y1="120" x2="824" y2="260" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="300" y1="720" x2="724" y2="720" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
  </defs>

  <!-- Document Body: Folded corner at top right -->
  <!-- Main Sheet with cut corner: (200, 120) -> (684, 120) -> (824, 260) -> (824, 904) -> (200, 904) -->
  <path d="M 230 120 L 684 120 L 824 260 L 824 880 C 824 893 813 904 800 904 L 230 904 C 217 904 206 893 206 880 L 206 144 C 206 131 217 120 230 120 Z" fill="url(#docBg)" filter="url(#docShadow)" stroke="#cbd5e1" stroke-width="2" />

  <!-- Folded Corner Triangle -->
  <path d="M 684 120 L 684 240 C 684 251 693 260 704 260 L 824 260 Z" fill="url(#foldGrad)" />

  <!-- 3D Mesh Symbol inside Document -->
  <g transform="translate(102, 60) scale(0.8)">
    <polygon points="512,320 690,410 512,500 334,410" fill="#38bdf8" fill-opacity="0.85" />
    <polygon points="334,410 512,500 512,680 334,590" fill="#0284c7" fill-opacity="0.9" />
    <polygon points="512,500 690,410 690,590 512,680" fill="#6366f1" fill-opacity="0.95" />

    <g stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="512" y1="320" x2="690" y2="410" />
      <line x1="690" y1="410" x2="690" y2="590" />
      <line x1="690" y1="590" x2="512" y2="680" />
      <line x1="512" y1="680" x2="334" y2="590" />
      <line x1="334" y1="590" x2="334" y2="410" />
      <line x1="334" y1="410" x2="512" y2="320" />
      <line x1="512" y1="500" x2="334" y2="410" />
      <line x1="512" y1="500" x2="690" y2="410" />
      <line x1="512" y1="500" x2="512" y2="680" />
    </g>

    <!-- Vertex dots -->
    <circle cx="512" cy="320" r="8" fill="#ffffff" />
    <circle cx="512" cy="500" r="10" fill="#ffffff" />
    <circle cx="512" cy="680" r="8" fill="#ffffff" />
    <circle cx="334" cy="410" r="8" fill="#ffffff" />
    <circle cx="690" cy="410" r="8" fill="#ffffff" />
    <circle cx="334" cy="590" r="8" fill="#ffffff" />
    <circle cx="690" cy="590" r="8" fill="#ffffff" />
  </g>

  <!-- 3D Format Badge at Bottom of Sheet -->
  <rect x="332" y="730" width="360" height="96" rx="28" fill="url(#badgeGrad)" />
  <text x="512" y="796" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="4">3D MESH</text>
</svg>`;

// Write source SVGs
const appIconSvgPath = path.join(BUILD_DIR, 'app-icon.svg');
const docIconSvgPath = path.join(BUILD_DIR, 'document-3d.svg');

fs.writeFileSync(appIconSvgPath, appIconSvg, 'utf8');
fs.writeFileSync(docIconSvgPath, docIconSvg, 'utf8');
console.log('[IconGenerator] Wrote SVG icon masters to build/');

// Helper to render icon sizes for an iconset
function generateIconset(svgPath, iconsetDir) {
  const sizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  // Render 1024x1024 base PNG first
  const base1024 = path.join(iconsetDir, 'icon_512x512@2x.png');
  execSync(`magick -background none -density 384 "${svgPath}" -resize 1024x1024 "${base1024}"`);

  for (const s of sizes) {
    if (s.name === 'icon_512x512@2x.png') continue;
    const dest = path.join(iconsetDir, s.name);
    execSync(`magick "${base1024}" -resize ${s.size}x${s.size} "${dest}"`);
  }
}

console.log('[IconGenerator] Rendering App Icon set...');
generateIconset(appIconSvgPath, ICONSET_APP_DIR);

console.log('[IconGenerator] Rendering Document Icon set...');
generateIconset(docIconSvgPath, ICONSET_DOC_DIR);

// Build .icns using macOS native iconutil
const macAppIcns = path.join(BUILD_DIR, 'icon.icns');
const macDocIcns = path.join(ICONS_DIR, 'document-3d.icns');

execSync(`iconutil -c icns "${ICONSET_APP_DIR}" -o "${macAppIcns}"`);
execSync(`iconutil -c icns "${ICONSET_DOC_DIR}" -o "${macDocIcns}"`);
console.log(`[IconGenerator] Created macOS ICNS icons: ${macAppIcns}, ${macDocIcns}`);

// Build .ico for Windows (multi-resolution 16, 24, 32, 48, 64, 128, 256)
const winAppIco = path.join(BUILD_DIR, 'icon.ico');
const winDocIco = path.join(ICONS_DIR, 'document-3d.ico');

execSync(
  `magick "${path.join(ICONSET_APP_DIR, 'icon_256x256.png')}" ` +
    `"${path.join(ICONSET_APP_DIR, 'icon_128x128.png')}" ` +
    `"${path.join(ICONSET_APP_DIR, 'icon_32x32@2x.png')}" ` +
    `"${path.join(ICONSET_APP_DIR, 'icon_32x32.png')}" ` +
    `"${path.join(ICONSET_APP_DIR, 'icon_16x16.png')}" "${winAppIco}"`
);

execSync(
  `magick "${path.join(ICONSET_DOC_DIR, 'icon_256x256.png')}" ` +
    `"${path.join(ICONSET_DOC_DIR, 'icon_128x128.png')}" ` +
    `"${path.join(ICONSET_DOC_DIR, 'icon_32x32@2x.png')}" ` +
    `"${path.join(ICONSET_DOC_DIR, 'icon_32x32.png')}" ` +
    `"${path.join(ICONSET_DOC_DIR, 'icon_16x16.png')}" "${winDocIco}"`
);
console.log(`[IconGenerator] Created Windows ICO icons: ${winAppIco}, ${winDocIco}`);

// Copy 512x512 PNG for Linux
fs.copyFileSync(path.join(ICONSET_APP_DIR, 'icon_512x512.png'), path.join(BUILD_DIR, 'icon.png'));
fs.copyFileSync(path.join(ICONSET_DOC_DIR, 'icon_512x512.png'), path.join(ICONS_DIR, 'document-3d.png'));
console.log('[IconGenerator] Copied Linux PNG icons.');

// Clean up temporary .iconset directories
fs.rmSync(ICONSET_APP_DIR, { recursive: true, force: true });
fs.rmSync(ICONSET_DOC_DIR, { recursive: true, force: true });

console.log('[IconGenerator] Icon suite generation completed successfully!');

