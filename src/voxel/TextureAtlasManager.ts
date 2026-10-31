import { Scene, Texture } from '@babylonjs/core';
import { TextureAtlasDefinition, TextureAtlasFrame } from './types';

const FALLBACK_1X1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

export class TextureAtlasManager {
  private atlases: Map<string, TextureAtlasDefinition> = new Map();
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getAtlases(): TextureAtlasDefinition[] {
    return Array.from(this.atlases.values());
  }

  public getAtlas(id: string): TextureAtlasDefinition | undefined {
    return this.atlases.get(id);
  }

  public removeAtlas(id: string): boolean {
    const atlas = this.atlases.get(id);
    if (atlas) {
      atlas.texture.dispose();
      return this.atlases.delete(id);
    }
    return false;
  }

  /**
   * Generates a procedural 4x4 terrain and architecture texture atlas.
   * Useful out-of-the-box for block building without needing external files.
   */
  public createProceduralTerrainAtlas(name: string = 'Terrain & Block Atlas'): TextureAtlasDefinition {
    const cols = 4;
    const rows = 4;
    const tileSize = 32;
    const totalW = cols * tileSize;
    const totalH = rows * tileSize;

    const tileDefs: Array<{ name: string; bg: string; fg?: string; pattern?: string }> = [
      { name: 'Stone', bg: '#888c94', fg: '#5a5e66', pattern: 'noise' },
      { name: 'Dirt', bg: '#865439', fg: '#5e3823', pattern: 'noise' },
      { name: 'Grass Top', bg: '#4f8a10', fg: '#3b6a0a', pattern: 'grass' },
      { name: 'Grass Side', bg: '#865439', fg: '#4f8a10', pattern: 'grass-side' },
      { name: 'Sand', bg: '#d9c077', fg: '#bfa352', pattern: 'noise' },
      { name: 'Water', bg: '#2980b9', fg: '#3498db', pattern: 'waves' },
      { name: 'Wood Planks', bg: '#966236', fg: '#663f1d', pattern: 'planks' },
      { name: 'Wood Log', bg: '#5c3a21', fg: '#3b2311', pattern: 'bark' },
      { name: 'Cobblestone', bg: '#6e737b', fg: '#44484e', pattern: 'bricks' },
      { name: 'Stone Bricks', bg: '#5c6168', fg: '#383b40', pattern: 'bricks' },
      { name: 'Red Bricks', bg: '#a64232', fg: '#68251b', pattern: 'bricks' },
      { name: 'Foliage', bg: '#2d7a22', fg: '#1d5415', pattern: 'leaves' },
      { name: 'Glass', bg: '#aed6f1', fg: '#ffffff', pattern: 'glass' },
      { name: 'Gold Block', bg: '#f1c40f', fg: '#b7950b', pattern: 'border' },
      { name: 'Iron Block', bg: '#bdc3c7', fg: '#7f8c8d', pattern: 'border' },
      { name: 'Obsidian', bg: '#201b2d', fg: '#4a235a', pattern: 'noise' },
    ];

    let dataUrl = FALLBACK_1X1_PNG;
    const frames: TextureAtlasFrame[] = [];

    let ctx: CanvasRenderingContext2D | null = null;
    let canvas: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined') {
      try {
        canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        ctx = canvas.getContext('2d');
      } catch {
        ctx = null;
      }
    }

    if (ctx && canvas) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, totalW, totalH);
    }

    for (let i = 0; i < tileDefs.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const def = tileDefs[i];
      let thumbUrl = FALLBACK_1X1_PNG;

      if (ctx && canvas) {
        const x = col * tileSize;
        const y = row * tileSize;

        // Draw base tile
        ctx.fillStyle = def.bg;
        ctx.fillRect(x, y, tileSize, tileSize);

        // Draw procedural patterns
        ctx.fillStyle = def.fg || '#ffffff';
        if (def.pattern === 'noise') {
          for (let py = 0; py < tileSize; py += 4) {
            for (let px = 0; px < tileSize; px += 4) {
              if ((px + py) % 8 === 0) {
                ctx.fillRect(x + px, y + py, 3, 3);
              }
            }
          }
        } else if (def.pattern === 'bricks') {
          ctx.strokeStyle = def.fg || '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
          ctx.beginPath();
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x + tileSize, y + 8);
          ctx.moveTo(x, y + 16);
          ctx.lineTo(x + tileSize, y + 16);
          ctx.moveTo(x, y + 24);
          ctx.lineTo(x + tileSize, y + 24);
          ctx.moveTo(x + 16, y);
          ctx.lineTo(x + 16, y + 8);
          ctx.moveTo(x + 8, y + 8);
          ctx.lineTo(x + 8, y + 16);
          ctx.moveTo(x + 24, y + 8);
          ctx.lineTo(x + 24, y + 16);
          ctx.moveTo(x + 16, y + 16);
          ctx.lineTo(x + 16, y + 24);
          ctx.stroke();
        } else if (def.pattern === 'planks') {
          ctx.strokeStyle = def.fg || '#000';
          ctx.lineWidth = 1;
          for (let p = 8; p < tileSize; p += 8) {
            ctx.beginPath();
            ctx.moveTo(x, y + p);
            ctx.lineTo(x + tileSize, y + p);
            ctx.stroke();
          }
        } else if (def.pattern === 'grass-side') {
          ctx.fillRect(x, y, tileSize, 8);
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 8);
          ctx.lineTo(x + 8, y + 12);
          ctx.lineTo(x + 12, y + 8);
          ctx.moveTo(x + 18, y + 8);
          ctx.lineTo(x + 22, y + 14);
          ctx.lineTo(x + 26, y + 8);
          ctx.fill();
        } else if (def.pattern === 'glass') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 26);
          ctx.lineTo(x + 26, y + 4);
          ctx.lineTo(x + 28, y + 4);
          ctx.lineTo(x + 4, y + 28);
          ctx.fill();
        } else if (def.pattern === 'border') {
          ctx.strokeStyle = def.fg || '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
        }

        try {
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = tileSize;
          thumbCanvas.height = tileSize;
          const thumbCtx = thumbCanvas.getContext('2d');
          if (thumbCtx) {
            thumbCtx.drawImage(canvas, x, y, tileSize, tileSize, 0, 0, tileSize, tileSize);
            thumbUrl = thumbCanvas.toDataURL('image/png');
          }
        } catch {
          thumbUrl = FALLBACK_1X1_PNG;
        }
      }

      // UV coordinates (Normalized 0 to 1)
      const uMin = col / cols;
      const uMax = (col + 1) / cols;
      const vMin = 1.0 - (row + 1) / rows;
      const vMax = 1.0 - row / rows;

      frames.push({
        id: `tile_${i}`,
        name: def.name,
        col,
        row,
        uMin,
        vMin,
        uMax,
        vMax,
        thumbnailDataUrl: thumbUrl,
      });
    }

    if (canvas && ctx) {
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch {
        dataUrl = FALLBACK_1X1_PNG;
      }
    }

    const texture = new Texture(dataUrl, this.scene, false, true);
    texture.name = 'atlas_terrain_procedural';

    const id = `atlas_${Date.now().toString().slice(-4)}`;
    const atlasDef: TextureAtlasDefinition = {
      id,
      name,
      texture,
      dataUrl,
      width: totalW,
      height: totalH,
      columns: cols,
      rows,
      tileSize,
      frames,
    };

    this.atlases.set(id, atlasDef);
    return atlasDef;
  }

  /**
   * Loads a custom TextureAtlas from an image data URL / URL and grid columns & rows.
   */
  public async createGridAtlasFromImage(
    name: string,
    imageSrc: string,
    columns: number = 4,
    rows: number = 4,
    tileNames?: string[]
  ): Promise<TextureAtlasDefinition> {
    const cols = Math.max(1, columns);
    const r = Math.max(1, rows);

    const buildAtlas = (
      totalW: number,
      totalH: number,
      ctx: CanvasRenderingContext2D | null,
      canvas: HTMLCanvasElement | null
    ): TextureAtlasDefinition => {
      const tileW = Math.floor(totalW / cols);
      const tileH = Math.floor(totalH / r);
      const frames: TextureAtlasFrame[] = [];
      const totalTiles = cols * r;

      for (let i = 0; i < totalTiles; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * tileW;
        const y = row * tileH;
        const tileName = tileNames?.[i] || `Tile (${col}, ${row})`;

        let thumbUrl = imageSrc;
        if (ctx && canvas) {
          try {
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = Math.min(64, tileW);
            thumbCanvas.height = Math.min(64, tileH);
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              thumbCtx.drawImage(canvas, x, y, tileW, tileH, 0, 0, thumbCanvas.width, thumbCanvas.height);
              thumbUrl = thumbCanvas.toDataURL('image/png');
            }
          } catch {
            thumbUrl = imageSrc;
          }
        }

        const uMin = col / cols;
        const uMax = (col + 1) / cols;
        const vMin = 1.0 - (row + 1) / r;
        const vMax = 1.0 - row / r;

        frames.push({
          id: `tile_${col}_${row}`,
          name: tileName,
          col,
          row,
          uMin,
          vMin,
          uMax,
          vMax,
          thumbnailDataUrl: thumbUrl,
        });
      }

      const texture = new Texture(imageSrc, this.scene, false, true);
      texture.name = `atlas_${name.toLowerCase().replace(/\s+/g, '_')}`;

      const id = `atlas_${Date.now().toString().slice(-4)}`;
      const atlasDef: TextureAtlasDefinition = {
        id,
        name,
        texture,
        dataUrl: imageSrc,
        width: totalW,
        height: totalH,
        columns: cols,
        rows: r,
        tileSize: tileW,
        frames,
      };

      this.atlases.set(id, atlasDef);
      return atlasDef;
    };

    return new Promise<TextureAtlasDefinition>((resolve) => {
      if (typeof Image === 'undefined') {
        return resolve(buildAtlas(256, 256, null, null));
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      let resolved = false;
      const finish = (w: number, h: number) => {
        if (resolved) return;
        resolved = true;
        let canvas: HTMLCanvasElement | null = null;
        let ctx: CanvasRenderingContext2D | null = null;
        try {
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
        } catch {
          ctx = null;
        }
        resolve(buildAtlas(w, h, ctx, canvas));
      };

      img.onload = () => {
        finish(img.width || 256, img.height || 256);
      };
      img.onerror = () => {
        finish(256, 256);
      };

      img.src = imageSrc;
      if (img.complete && (img as any).naturalWidth !== undefined) {
        finish((img as any).naturalWidth || 256, (img as any).naturalHeight || 256);
      } else {
        setTimeout(() => {
          finish(256, 256);
        }, 50);
      }
    });
  }

  /**
   * Loads an Atlas from an image and a JSON spritesheet / frames specification.
   */
  public async createAtlasFromJson(
    name: string,
    imageSrc: string,
    jsonDescriptor: any
  ): Promise<TextureAtlasDefinition> {
    return new Promise<TextureAtlasDefinition>((resolve, reject) => {
      const descriptor =
        typeof jsonDescriptor === 'string' ? JSON.parse(jsonDescriptor || '{}') : jsonDescriptor || {};

      if (typeof Image === 'undefined') {
        const texture = new Texture(imageSrc, this.scene);
        const id = `atlas_${Date.now().toString().slice(-4)}`;
        const dummy: TextureAtlasDefinition = {
          id,
          name,
          texture,
          dataUrl: imageSrc,
          width: 256,
          height: 256,
          columns: 1,
          rows: 1,
          tileSize: 256,
          frames: [],
        };
        this.atlases.set(id, dummy);
        return resolve(dummy);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const totalW = img.width || descriptor.meta?.size?.w || 256;
        const totalH = img.height || descriptor.meta?.size?.h || 256;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);

        const frames: TextureAtlasFrame[] = [];
        const rawFrames = descriptor.frames || {};

        let idx = 0;
        const processFrame = (frameId: string, rect: { x: number; y: number; w: number; h: number }) => {
          let thumbUrl: string | undefined;
          if (ctx) {
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = Math.min(64, rect.w);
            thumbCanvas.height = Math.min(64, rect.h);
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              thumbCtx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, thumbCanvas.width, thumbCanvas.height);
              thumbUrl = thumbCanvas.toDataURL('image/png');
            }
          }

          const uMin = rect.x / totalW;
          const uMax = (rect.x + rect.w) / totalW;
          const vMin = 1.0 - (rect.y + rect.h) / totalH;
          const vMax = 1.0 - rect.y / totalH;

          frames.push({
            id: frameId,
            name: frameId,
            col: idx++,
            row: 0,
            uMin,
            vMin,
            uMax,
            vMax,
            thumbnailDataUrl: thumbUrl,
          });
        };

        if (Array.isArray(rawFrames)) {
          for (const item of rawFrames) {
            const frameId = item.filename || `frame_${idx}`;
            const r = item.frame || { x: 0, y: 0, w: 32, h: 32 };
            processFrame(frameId, r);
          }
        } else {
          for (const [key, val] of Object.entries(rawFrames)) {
            const r = (val as any).frame || val || { x: 0, y: 0, w: 32, h: 32 };
            processFrame(key, r);
          }
        }

        const texture = new Texture(imageSrc, this.scene, false, true);
        texture.name = `atlas_${name.toLowerCase().replace(/\s+/g, '_')}`;

        const id = `atlas_${Date.now().toString().slice(-4)}`;
        const atlasDef: TextureAtlasDefinition = {
          id,
          name,
          texture,
          dataUrl: imageSrc,
          width: totalW,
          height: totalH,
          columns: frames.length,
          rows: 1,
          tileSize: frames[0] ? totalW / frames.length : 32,
          frames,
        };

        this.atlases.set(id, atlasDef);
        resolve(atlasDef);
      };

      img.onerror = (e) => reject(new Error('Failed to load TextureAtlas image: ' + String(e)));
      img.src = imageSrc;
    });
  }
}
