export type ProceduralTextureType =
  | 'wood'
  | 'stone'
  | 'marble'
  | 'brick'
  | 'metal'
  | 'checker'
  | 'grid'
  | 'noise'
  | 'gradient';

export interface ProceduralTextureOptions {
  type: ProceduralTextureType;
  primaryColor?: string;
  secondaryColor?: string;
  scale?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#888888').replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '8');
  const num = parseInt(full.slice(0, 6), 16) || 0x888888;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Simple deterministic pseudo-random noise helper
function pseudoNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = pseudoNoise(ix, iy);
  const b = pseudoNoise(ix + 1, iy);
  const c = pseudoNoise(ix, iy + 1);
  const d = pseudoNoise(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function generateProceduralTextureDataUrl(opts: ProceduralTextureOptions): string {
  const FALLBACK_1X1_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

  if (typeof document === 'undefined') {
    return FALLBACK_1X1_PNG;
  }

  try {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK_1X1_PNG;

    const defaults: Record<ProceduralTextureType, [string, string]> = {
      wood: ['#8b5a2b', '#5c3a1b'],
      stone: ['#888c94', '#585c64'],
      marble: ['#f0eee9', '#9aa0a8'],
      brick: ['#a64232', '#c8c2b8'],
      metal: ['#9aa2ad', '#626a75'],
      checker: ['#e6edf3', '#2d333b'],
      grid: ['#1f242c', '#58a6ff'],
      noise: ['#999999', '#444444'],
      gradient: ['#58a6ff', '#1f6feb'],
    };

    const [defPrimary, defSecondary] = defaults[opts.type] || ['#cccccc', '#666666'];
    const c1 = hexToRgb(opts.primaryColor || defPrimary);
    const c2 = hexToRgb(opts.secondaryColor || defSecondary);
    const scale = Math.max(0.25, opts.scale || 1.0);

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let t = 0.5;
        const nx = (x / size) * scale;
        const ny = (y / size) * scale;

        switch (opts.type) {
          case 'wood': {
            const n = smoothNoise(nx * 8, ny * 2) * 0.35;
            t = 0.5 + 0.5 * Math.sin((nx * 18 + n * 6) * Math.PI * 2);
            break;
          }
          case 'stone':
          case 'noise': {
            const n1 = smoothNoise(nx * 12, ny * 12) * 0.6;
            const n2 = smoothNoise(nx * 28, ny * 28) * 0.3;
            const n3 = pseudoNoise(x, y) * 0.1;
            t = Math.min(1, Math.max(0, n1 + n2 + n3));
            break;
          }
          case 'marble': {
            const turb =
              smoothNoise(nx * 6, ny * 6) * 0.5 +
              smoothNoise(nx * 12, ny * 12) * 0.25 +
              smoothNoise(nx * 24, ny * 24) * 0.125;
            t = Math.pow(0.5 + 0.5 * Math.sin((nx * 6 + ny * 4 + turb * 5) * Math.PI), 0.65);
            break;
          }
          case 'brick': {
            const rows = Math.round(8 * scale);
            const cols = Math.round(4 * scale);
            const rowH = size / rows;
            const colW = size / cols;
            const rowIdx = Math.floor(y / rowH);
            const offsetX = (rowIdx % 2) * (colW * 0.5);
            const localY = y % rowH;
            const localX = (x + offsetX) % colW;
            const mortar = localY < 3 || localX < 3;
            const n = (smoothNoise(x * 0.15, y * 0.15) - 0.5) * 0.18;
            t = mortar ? 1.0 : Math.min(0.85, Math.max(0, 0.15 + n));
            break;
          }
          case 'metal': {
            const streak = smoothNoise(x * 0.03, y * 0.8) * 0.6 + pseudoNoise(0, y) * 0.25;
            const spec = 0.5 + 0.5 * Math.sin((nx * 2 + ny * 0.5) * Math.PI * 2);
            t = Math.min(1, Math.max(0, streak * 0.6 + spec * 0.4));
            break;
          }
          case 'checker': {
            const cells = Math.max(2, Math.round(8 * scale));
            const cx = Math.floor((x / size) * cells);
            const cy = Math.floor((y / size) * cells);
            t = (cx + cy) % 2 === 0 ? 0 : 1;
            break;
          }
          case 'grid': {
            const cells = Math.max(2, Math.round(8 * scale));
            const cellSize = size / cells;
            const isLine = x % cellSize < 2 || y % cellSize < 2;
            t = isLine ? 1 : 0;
            break;
          }
          case 'gradient':
          default: {
            t = y / (size - 1);
            break;
          }
        }

        const idx = (y * size + x) * 4;
        data[idx] = Math.round(c1[0] * (1 - t) + c2[0] * t);
        data[idx + 1] = Math.round(c1[1] * (1 - t) + c2[1] * t);
        data[idx + 2] = Math.round(c1[2] * (1 - t) + c2[2] * t);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl && dataUrl.startsWith('data:image') ? dataUrl : FALLBACK_1X1_PNG;
  } catch {
    return FALLBACK_1X1_PNG;
  }
}

