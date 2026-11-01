const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const ICONS_DIR = path.join(BUILD_DIR, 'icons');
const ICONSET_APP_DIR = path.join(BUILD_DIR, 'icon.iconset');
const ICONSET_DOC_DIR = path.join(BUILD_DIR, 'document-3d.iconset');

[BUILD_DIR, ICONS_DIR, ICONSET_APP_DIR, ICONSET_DOC_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// App Icon SVG:
// - Balanced 3D Mesh Cube with generous margin inside the squircle (radius 340, Y 172 to 852, X 218 to 806)
// - Styled after the 3D Startup & Scene Loader Animation:
//   * Cybernetic glass faces with dark cobalt/obsidian depth
//   * Radiant 3D wireframe mesh grid in bright light blue & cyan (#58a6ff / #79c0ff / #00d2ff)
//   * Specular rim crest highlights on the ridges (#ffffff -> #00f0ff -> #38bdf8)
//   * Glowing inner core octahedron / energy diamond
//   * Precision gizmo orbit arcs
//   * Radiant white-hot 3D vertex nodes with glowing cyan coronas
const appIconSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Squircle Gradient (Obsidian / Dark Cyber Space) -->
    <linearGradient id="bgGrad" x1="512" y1="80" x2="512" y2="944" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#121620" />
      <stop offset="40%" stop-color="#0c0e14" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>

    <!-- Squircle Border Subtle Metallic Rim -->
    <linearGradient id="rimGrad" x1="512" y1="80" x2="512" y2="944" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.32" />
      <stop offset="50%" stop-color="#1f6feb" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.1" />
    </linearGradient>

    <!-- Squircle Drop Shadow -->
    <filter id="squircleShadow" x="30" y="40" width="964" height="964" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000000" flood-opacity="0.75" />
    </filter>

    <!-- Neon Glow Filter for Outer Edges & Nodes -->
    <filter id="neonGlow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Soft Bloom for Inner Core -->
    <radialGradient id="ambientGlow" cx="512" cy="512" r="380" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1f6feb" stop-opacity="0.36" />
      <stop offset="35%" stop-color="#00d2ff" stop-opacity="0.18" />
      <stop offset="70%" stop-color="#090d16" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Edge Specular Highlight: Center Vertical Ridge -->
    <linearGradient id="centerRidgeSpec" x1="512" y1="172" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="20%" stop-color="#a5f3fc" stop-opacity="0.95" />
      <stop offset="70%" stop-color="#38bdf8" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#1f6feb" stop-opacity="0.15" />
    </linearGradient>

    <!-- Edge Specular Highlight: Top Left Edge -->
    <linearGradient id="topLeftSpec" x1="218" y1="342" x2="512" y2="172" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4" />
      <stop offset="65%" stop-color="#e0f2fe" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
    </linearGradient>

    <!-- Edge Specular Highlight: Top Right Edge -->
    <linearGradient id="topRightSpec" x1="512" y1="172" x2="806" y2="342" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="35%" stop-color="#79c0ff" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#1f6feb" stop-opacity="0.3" />
    </linearGradient>

    <!-- Top Face Glass Fill -->
    <linearGradient id="topFaceGrad" x1="218" y1="172" x2="806" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1f6feb" stop-opacity="0.25" />
      <stop offset="50%" stop-color="#0e2340" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#091424" stop-opacity="0.7" />
    </linearGradient>

    <!-- Left Face Glass Fill -->
    <linearGradient id="leftFaceGrad" x1="218" y1="342" x2="512" y2="852" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f294a" stop-opacity="0.55" />
      <stop offset="60%" stop-color="#0a192f" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#050d18" stop-opacity="0.9" />
    </linearGradient>

    <!-- Right Face Glass Fill -->
    <linearGradient id="rightFaceGrad" x1="806" y1="342" x2="512" y2="852" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a1a30" stop-opacity="0.7" />
      <stop offset="60%" stop-color="#06101e" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#02060b" stop-opacity="0.95" />
    </linearGradient>

    <!-- Inner Core Diamond Gradient -->
    <radialGradient id="octaCoreGlow" cx="512" cy="512" r="125" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
      <stop offset="25%" stop-color="#00f0ff" stop-opacity="0.8" />
      <stop offset="60%" stop-color="#1f6feb" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#0d1117" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- macOS Standard Squircle Background (864x864 with rx=195) -->
  <rect x="80" y="80" width="864" height="864" rx="195" fill="url(#bgGrad)" filter="url(#squircleShadow)" stroke="url(#rimGrad)" stroke-width="2.5" />

  <!-- Background Orbit Gizmo Rings (Loader Animation Style) -->
  <circle cx="512" cy="512" r="380" stroke="#1f6feb" stroke-width="2" stroke-dasharray="8 12" stroke-opacity="0.32" />
  <circle cx="512" cy="512" r="414" stroke="#00f0ff" stroke-width="1.6" stroke-opacity="0.22" />
  <path d="M 190 350 A 380 380 0 0 1 512 132" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.65" />
  <path d="M 834 674 A 414 414 0 0 1 512 926" fill="none" stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.55" />

  <!-- Ambient Volumetric Center Glow -->
  <circle cx="512" cy="512" r="360" fill="url(#ambientGlow)" />

  <!-- ======================================================== -->
  <!-- 3D CUBE TRANSLUCENT FACETS                                -->
  <!-- ======================================================== -->
  <polygon points="512,172 806,342 512,512 218,342" fill="url(#topFaceGrad)" />
  <polygon points="218,342 512,512 512,852 218,682" fill="url(#leftFaceGrad)" />
  <polygon points="512,512 806,342 806,682 512,852" fill="url(#rightFaceGrad)" />

  <!-- ======================================================== -->
  <!-- INNER 3D OCTAHEDRON / DIAMOND CORE (Loader Style)         -->
  <!-- ======================================================== -->
  <circle cx="512" cy="512" r="120" fill="url(#octaCoreGlow)" />
  <!-- Octahedron Facets -->
  <polygon points="512,415 594,472 512,578 430,472" fill="#00f0ff" fill-opacity="0.32" stroke="#67e8f9" stroke-width="4" stroke-linejoin="round" />
  <polygon points="512,415 594,472 512,512" fill="#79c0ff" fill-opacity="0.45" />
  <polygon points="430,472 512,415 512,512" fill="#38bdf8" fill-opacity="0.35" />
  <polygon points="512,578 594,472 512,512" fill="#1f6feb" fill-opacity="0.5" />
  <polygon points="512,578 430,472 512,512" fill="#0f2744" fill-opacity="0.6" />

  <!-- ======================================================== -->
  <!-- 3D WIREFRAME MESH GRID IN LIGHT BLUE (#58a6ff / #79c0ff)  -->
  <!-- ======================================================== -->
  <g stroke="#79c0ff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.88">
    <!-- Top Face Grid -->
    <line x1="316" y1="399" x2="610" y2="229" />
    <line x1="414" y1="455" x2="708" y2="285" />
    <line x1="316" y1="285" x2="610" y2="455" />
    <line x1="414" y1="229" x2="708" y2="399" />
    <!-- Diagonal Triangulation of Top Face -->
    <line x1="218" y1="342" x2="806" y2="342" stroke-width="9" stroke-opacity="0.55" />

    <!-- Left Face Grid -->
    <line x1="316" y1="399" x2="316" y2="739" />
    <line x1="414" y1="455" x2="414" y2="795" />
    <line x1="218" y1="455" x2="512" y2="625" />
    <line x1="218" y1="569" x2="512" y2="739" />
    <!-- Diagonal Triangulation of Left Face -->
    <line x1="218" y1="342" x2="512" y2="852" stroke-width="9" stroke-opacity="0.5" />

    <!-- Right Face Grid -->
    <line x1="610" y1="455" x2="610" y2="795" />
    <line x1="708" y1="399" x2="708" y2="739" />
    <line x1="512" y1="625" x2="806" y2="455" />
    <line x1="512" y1="739" x2="806" y2="569" />
    <!-- Diagonal Triangulation of Right Face -->
    <line x1="806" y1="342" x2="512" y2="852" stroke-width="9" stroke-opacity="0.5" />
  </g>

  <!-- Dashed Sub-Wireframe Accents (Matching .me-mesh-face span) -->
  <g stroke="#38bdf8" stroke-width="3.5" stroke-dasharray="7 7" stroke-opacity="0.5">
    <line x1="218" y1="342" x2="806" y2="682" />
    <line x1="806" y1="342" x2="218" y2="682" />
  </g>

  <!-- ======================================================== -->
  <!-- MAIN BOLD CUBE WIREFRAME EDGES (Vibrant Electric Blue)    -->
  <!-- ======================================================== -->
  <!-- Subtle Neon Glow Underlayer -->
  <g stroke="#1f6feb" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" opacity="0.45" filter="url(#neonGlow)">
    <path d="M 512 172 L 806 342 L 806 682 L 512 852 L 218 682 L 218 342 Z" fill="none" />
    <path d="M 512 512 L 512 172 M 512 512 L 218 682 M 512 512 L 806 682" fill="none" />
  </g>

  <!-- Primary Solid Cube Wireframe (#2563eb / #1f6feb) -->
  <g stroke="#2563eb" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 512 172 L 806 342 L 806 682 L 512 852 L 218 682 L 218 342 Z" fill="none" />
    <path d="M 512 512 L 512 172 M 512 512 L 218 682 M 512 512 L 806 682" fill="none" />
  </g>

  <!-- ======================================================== -->
  <!-- SPECULAR EDGE RIM HIGHLIGHTS (Crest Glow)                 -->
  <!-- ======================================================== -->
  <!-- Center Vertical Crest Ridge -->
  <line x1="512" y1="172" x2="512" y2="512" stroke="url(#centerRidgeSpec)" stroke-width="14" stroke-linecap="round" />
  <!-- Top Left Crest Ridge -->
  <line x1="218" y1="342" x2="512" y2="172" stroke="url(#topLeftSpec)" stroke-width="14" stroke-linecap="round" />
  <!-- Top Right Crest Ridge -->
  <line x1="512" y1="172" x2="806" y2="342" stroke="url(#topRightSpec)" stroke-width="14" stroke-linecap="round" />

  <!-- Lower Edge Crest Highlights -->
  <line x1="218" y1="682" x2="512" y2="512" stroke="#58a6ff" stroke-width="10" stroke-linecap="round" stroke-opacity="0.4" />
  <line x1="806" y1="682" x2="512" y2="512" stroke="#388bfd" stroke-width="10" stroke-linecap="round" stroke-opacity="0.35" />

  <!-- ======================================================== -->
  <!-- RADIANT 3D VERTEX CORNER NODES (Loader Style)            -->
  <!-- ======================================================== -->
  <!-- Top Apex Vertex Node -->
  <circle cx="512" cy="172" r="20" fill="#00f0ff" opacity="0.35" filter="url(#neonGlow)" />
  <circle cx="512" cy="172" r="13" fill="#ffffff" stroke="#00f0ff" stroke-width="4" />

  <!-- Center Hub Vertex Node -->
  <circle cx="512" cy="512" r="24" fill="#00f0ff" opacity="0.45" filter="url(#neonGlow)" />
  <circle cx="512" cy="512" r="15" fill="#ffffff" stroke="#00f0ff" stroke-width="4.5" />

  <!-- Upper Left Vertex Node -->
  <circle cx="218" cy="342" r="16" fill="#38bdf8" opacity="0.35" filter="url(#neonGlow)" />
  <circle cx="218" cy="342" r="11" fill="#ffffff" stroke="#38bdf8" stroke-width="3.5" />

  <!-- Upper Right Vertex Node -->
  <circle cx="806" cy="342" r="16" fill="#38bdf8" opacity="0.35" filter="url(#neonGlow)" />
  <circle cx="806" cy="342" r="11" fill="#ffffff" stroke="#38bdf8" stroke-width="3.5" />

  <!-- Lower Left Vertex Node -->
  <circle cx="218" cy="682" r="15" fill="#1f6feb" opacity="0.3" filter="url(#neonGlow)" />
  <circle cx="218" cy="682" r="10" fill="#e0f2fe" stroke="#1f6feb" stroke-width="3" />

  <!-- Lower Right Vertex Node -->
  <circle cx="806" cy="682" r="15" fill="#1f6feb" opacity="0.3" filter="url(#neonGlow)" />
  <circle cx="806" cy="682" r="10" fill="#e0f2fe" stroke="#1f6feb" stroke-width="3" />

  <!-- Bottom Apex Vertex Node -->
  <circle cx="512" cy="852" r="16" fill="#00d2ff" opacity="0.35" filter="url(#neonGlow)" />
  <circle cx="512" cy="852" r="11" fill="#ffffff" stroke="#00d2ff" stroke-width="3.5" />

  <!-- Subtle Interior Grid Intersection Micro-Nodes -->
  <g fill="#79c0ff">
    <circle cx="414" cy="455" r="4" />
    <circle cx="610" cy="455" r="4" />
    <circle cx="316" cy="399" r="4" />
    <circle cx="708" cy="399" r="4" />
    <circle cx="414" cy="229" r="3.5" />
    <circle cx="610" cy="229" r="3.5" />
    <circle cx="316" cy="739" r="3.5" />
    <circle cx="414" cy="795" r="3.5" />
    <circle cx="610" cy="795" r="3.5" />
    <circle cx="708" cy="739" r="3.5" />
  </g>
</svg>`;

// Document Icon SVG:
// - macOS Document Sheet with folded corner
// - Scaled high-tech 3D Cube in center matching app icon
// - "3D MESH" badge at bottom
const docIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Document Page Background Gradient -->
    <linearGradient id="docBg" x1="512" y1="120" x2="512" y2="904" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="85%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>

    <!-- Document Shadow -->
    <filter id="docShadow" x="170" y="90" width="690" height="854" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000000" flood-opacity="0.3" />
    </filter>

    <!-- Fold Gradient -->
    <linearGradient id="foldGrad" x1="684" y1="120" x2="824" y2="260" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
  </defs>

  <!-- Document Sheet -->
  <path d="M 230 120 L 684 120 L 824 260 L 824 880 C 824 893 813 904 800 904 L 230 904 C 217 904 206 893 206 880 L 206 144 C 206 131 217 120 230 120 Z" fill="url(#docBg)" filter="url(#docShadow)" stroke="#cbd5e1" stroke-width="2" />
  <!-- Folded Corner -->
  <path d="M 684 120 L 684 240 C 684 251 693 260 704 260 L 824 260 Z" fill="url(#foldGrad)" />

  <!-- Bold High-Tech 3D Cube in Center -->
  <g transform="translate(102, 35) scale(0.8)">
    <polygon points="512,172 806,342 512,512 218,342" fill="#00d2ff" fill-opacity="0.25" />
    <polygon points="218,342 512,512 512,852 218,682" fill="#1f6feb" fill-opacity="0.38" />
    <polygon points="512,512 806,342 806,682 512,852" fill="#0c172a" fill-opacity="0.55" />

    <!-- Grid lines -->
    <g stroke="#00f0ff" stroke-width="12" stroke-linecap="round">
      <line x1="316" y1="399" x2="610" y2="229" />
      <line x1="414" y1="455" x2="708" y2="285" />
      <line x1="316" y1="285" x2="610" y2="455" />
      <line x1="414" y1="229" x2="708" y2="399" />
      <line x1="316" y1="399" x2="316" y2="739" />
      <line x1="414" y1="455" x2="414" y2="795" />
      <line x1="610" y1="455" x2="610" y2="795" />
      <line x1="708" y1="399" x2="708" y2="739" />
    </g>

    <!-- Outer cube -->
    <path d="M 512 172 L 806 342 L 806 682 L 512 852 L 218 682 L 218 342 Z"
          fill="none" stroke="#1f6feb" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 512 512 L 512 172 M 512 512 L 218 682 M 512 512 L 806 682"
          fill="none" stroke="#1f6feb" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Core glow & Nodes -->
    <circle cx="512" cy="172" r="14" fill="#ffffff" stroke="#00f0ff" stroke-width="3.5" />
    <circle cx="512" cy="512" r="16" fill="#ffffff" stroke="#00f0ff" stroke-width="4" />
    <circle cx="218" cy="342" r="12" fill="#ffffff" stroke="#38bdf8" stroke-width="3" />
    <circle cx="806" cy="342" r="12" fill="#ffffff" stroke="#38bdf8" stroke-width="3" />
  </g>

  <!-- Format Tag at Bottom -->
  <rect x="332" y="740" width="360" height="90" rx="24" fill="#1f6feb" />
  <text x="512" y="802" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="46" font-weight="800" fill="#ffffff" letter-spacing="4">3D MESH</text>
</svg>`;

// Write source SVGs
const appIconSvgPath = path.join(BUILD_DIR, 'app-icon.svg');
const docIconSvgPath = path.join(BUILD_DIR, 'document-3d.svg');

fs.writeFileSync(appIconSvgPath, appIconSvg, 'utf8');
fs.writeFileSync(docIconSvgPath, docIconSvg, 'utf8');
console.log('[IconGenerator] Wrote SVG icon masters to build/');

// High-fidelity Chromium-based iconset rasterizer
// Chromium ensures 100% full support for SVG filters (glows, drop shadows, gaussian blurs),
// gradients, stroke caps, dash arrays, and subpixel anti-aliasing.
async function generateHighFidelityIconset(page, rawSvg, iconsetDir) {
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

  // Responsive SVG wrapper
  const responsiveSvg = rawSvg.replace(/<svg width="1024" height="1024"/, '<svg width="100%" height="100%"');

  for (const s of sizes) {
    const dest = path.join(iconsetDir, s.name);
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:${s.size}px;height:${s.size}px;overflow:hidden;background:transparent;}</style></head><body>${responsiveSvg}</body></html>`);
    await page.screenshot({ path: dest, omitBackground: true });
  }
}

async function run() {
  console.log('[IconGenerator] Launching headless browser for pixel-perfect SVG rasterization...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('[IconGenerator] Rasterizing App Icon set with Chromium (full SVG filter & glow fidelity)...');
  await generateHighFidelityIconset(page, appIconSvg, ICONSET_APP_DIR);

  console.log('[IconGenerator] Rasterizing Document Icon set with Chromium...');
  await generateHighFidelityIconset(page, docIconSvg, ICONSET_DOC_DIR);

  await browser.close();

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

  // Copy 512x512 PNG for Linux & web
  fs.copyFileSync(path.join(ICONSET_APP_DIR, 'icon_512x512.png'), path.join(BUILD_DIR, 'icon.png'));
  fs.copyFileSync(path.join(ICONSET_DOC_DIR, 'icon_512x512.png'), path.join(ICONS_DIR, 'document-3d.png'));
  console.log('[IconGenerator] Copied Linux PNG icons.');

  // Clean up temporary .iconset directories
  fs.rmSync(ICONSET_APP_DIR, { recursive: true, force: true });
  fs.rmSync(ICONSET_DOC_DIR, { recursive: true, force: true });

  console.log('[IconGenerator] High-fidelity icon suite generation completed successfully!');
}

run().catch((err) => {
  console.error('[IconGenerator] Error generating icons:', err);
  process.exit(1);
});
