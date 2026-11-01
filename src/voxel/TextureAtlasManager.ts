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
        pixelRect: { x: col * tileSize, y: row * tileSize, w: tileSize, h: tileSize },
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
      sourceCanvas: canvas || undefined,
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
          pixelRect: { x, y, w: tileW, h: tileH },
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
        sourceCanvas: canvas || undefined,
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
   * Universal parser for TexturePacker JSON (Array or Hash), XML (Starling, Cocos, Sparrow),
   * or TPS files.
   */
  public parseAtlasDescriptor(descriptorInput: any): {
    frames: Array<{ name: string; x: number; y: number; w: number; h: number }>;
    imagePath?: string;
  } {
    const rawFrames: Array<{ name: string; x: number; y: number; w: number; h: number }> = [];
    let imagePath: string | undefined;

    let descriptor = descriptorInput;
    if (typeof descriptor === 'string') {
      const trimmed = descriptor.trim();
      if (trimmed.startsWith('<')) {
        return this.parseXmlAtlasDescriptor(trimmed);
      }
      try {
        descriptor = JSON.parse(trimmed);
      } catch {
        return this.parseXmlAtlasDescriptor(trimmed);
      }
    }

    if (!descriptor || typeof descriptor !== 'object') {
      return { frames: rawFrames };
    }

    // Extract image metadata if available
    if (descriptor.meta?.image) {
      imagePath = descriptor.meta.image;
    } else if (descriptor.imagePath) {
      imagePath = descriptor.imagePath;
    } else if (descriptor.image) {
      imagePath = descriptor.image;
    }

    // 1. TexturePacker JSON Array: { frames: [ { filename: "...", frame: { x, y, w, h } } ] }
    if (Array.isArray(descriptor.frames)) {
      for (let i = 0; i < descriptor.frames.length; i++) {
        const item = descriptor.frames[i];
        const name = item.filename || item.name || `frame_${i}`;
        const rect = item.frame || item.rect || item;
        rawFrames.push({
          name,
          x: rect.x ?? rect.left ?? 0,
          y: rect.y ?? rect.top ?? 0,
          w: rect.w ?? rect.width ?? 32,
          h: rect.h ?? rect.height ?? 32,
        });
      }
    }
    // 2. TexturePacker JSON Hash: { frames: { "tile1.png": { frame: { x, y, w, h } } } }
    else if (descriptor.frames && typeof descriptor.frames === 'object') {
      for (const [key, val] of Object.entries(descriptor.frames)) {
        const item = val as any;
        const rect = item?.frame || item?.rect || item || {};
        rawFrames.push({
          name: key,
          x: rect.x ?? rect.left ?? 0,
          y: rect.y ?? rect.top ?? 0,
          w: rect.w ?? rect.width ?? 32,
          h: rect.h ?? rect.height ?? 32,
        });
      }
    }
    // 3. Flat array of frames: [ { name, x, y, w, h } ]
    else if (Array.isArray(descriptor)) {
      for (let i = 0; i < descriptor.length; i++) {
        const item = descriptor[i];
        const name = item.name || item.filename || `frame_${i}`;
        const rect = item.frame || item.rect || item;
        rawFrames.push({
          name,
          x: rect.x ?? rect.left ?? 0,
          y: rect.y ?? rect.top ?? 0,
          w: rect.w ?? rect.width ?? 32,
          h: rect.h ?? rect.height ?? 32,
        });
      }
    }

    return { frames: rawFrames, imagePath };
  }

  /**
   * Parses XML / TPS / Starling / Cocos texture atlas formats.
   */
  public parseXmlAtlasDescriptor(xmlText: string): {
    frames: Array<{ name: string; x: number; y: number; w: number; h: number }>;
    imagePath?: string;
  } {
    const rawFrames: Array<{ name: string; x: number; y: number; w: number; h: number }> = [];
    let imagePath: string | undefined;

    if (typeof DOMParser === 'undefined') {
      return { frames: rawFrames };
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');

      // Check for <TextureAtlas imagePath="trees.png">
      const root = doc.documentElement;
      if (root) {
        imagePath = root.getAttribute('imagePath') || root.getAttribute('image') || undefined;

        // TexturePacker / Starling SubTexture tags
        const subTextures = root.querySelectorAll('SubTexture');
        if (subTextures.length > 0) {
          subTextures.forEach((node, idx) => {
            const name = node.getAttribute('name') || `frame_${idx}`;
            const x = parseFloat(node.getAttribute('x') || '0') || 0;
            const y = parseFloat(node.getAttribute('y') || '0') || 0;
            const w = parseFloat(node.getAttribute('width') || node.getAttribute('w') || '32') || 32;
            const h = parseFloat(node.getAttribute('height') || node.getAttribute('h') || '32') || 32;
            rawFrames.push({ name, x, y, w, h });
          });
          return { frames: rawFrames, imagePath };
        }

        // Generic <sprite n="..." x="..." y="..." w="..." h="...">
        const sprites = root.querySelectorAll('sprite');
        if (sprites.length > 0) {
          sprites.forEach((node, idx) => {
            const name = node.getAttribute('n') || node.getAttribute('name') || `sprite_${idx}`;
            const x = parseFloat(node.getAttribute('x') || '0') || 0;
            const y = parseFloat(node.getAttribute('y') || '0') || 0;
            const w = parseFloat(node.getAttribute('w') || node.getAttribute('width') || '32') || 32;
            const h = parseFloat(node.getAttribute('h') || node.getAttribute('height') || '32') || 32;
            rawFrames.push({ name, x, y, w, h });
          });
          return { frames: rawFrames, imagePath };
        }

        // TPS XML project file: extract textureFileName if available
        const filenameNodes = root.querySelectorAll('filename');
        filenameNodes.forEach((fn) => {
          const val = fn.textContent?.trim();
          if (val && /\.(png|jpe?g|webp)$/i.test(val) && !imagePath) {
            imagePath = val;
          }
        });
      }
    } catch (e) {
      console.warn('parseXmlAtlasDescriptor error:', e);
    }

    return { frames: rawFrames, imagePath };
  }

  /**
   * Loads an Atlas from an image and a JSON/XML/TPS spritesheet or frames specification.
   */
  public async createAtlasFromJson(
    name: string,
    imageSrc: string,
    jsonDescriptor: any
  ): Promise<TextureAtlasDefinition> {
    const parsed = this.parseAtlasDescriptor(jsonDescriptor);
    const parsedFrames = parsed.frames;

    return new Promise<TextureAtlasDefinition>((resolve, reject) => {
      const buildAtlasFromCanvas = (
        totalW: number,
        totalH: number,
        ctx: CanvasRenderingContext2D | null,
        canvas: HTMLCanvasElement | null
      ): TextureAtlasDefinition => {
        const frames: TextureAtlasFrame[] = [];

        // If no frames could be extracted from descriptor, default to a 4x4 grid
        const effectiveFrames =
          parsedFrames.length > 0
            ? parsedFrames
            : Array.from({ length: 16 }, (_, i) => {
                const cols = 4;
                const rows = 4;
                const tw = Math.floor(totalW / cols);
                const th = Math.floor(totalH / rows);
                const col = i % cols;
                const row = Math.floor(i / cols);
                return {
                  name: `Tile (${col}, ${row})`,
                  x: col * tw,
                  y: row * th,
                  w: tw,
                  h: th,
                };
              });

        for (let idx = 0; idx < effectiveFrames.length; idx++) {
          const f = effectiveFrames[idx];
          const x = f.x;
          const y = f.y;
          const w = Math.max(1, f.w);
          const h = Math.max(1, f.h);

          let thumbUrl = imageSrc;
          if (ctx && canvas) {
            try {
              const thumbCanvas = document.createElement('canvas');
              thumbCanvas.width = Math.min(64, w);
              thumbCanvas.height = Math.min(64, h);
              const thumbCtx = thumbCanvas.getContext('2d');
              if (thumbCtx) {
                thumbCtx.drawImage(canvas, x, y, w, h, 0, 0, thumbCanvas.width, thumbCanvas.height);
                thumbUrl = thumbCanvas.toDataURL('image/png');
              }
            } catch {
              thumbUrl = imageSrc;
            }
          }

          const uMin = x / totalW;
          const uMax = (x + w) / totalW;
          const vMin = 1.0 - (y + h) / totalH;
          const vMax = 1.0 - y / totalH;

          frames.push({
            id: `tile_${idx}`,
            name: f.name,
            col: idx,
            row: 0,
            uMin,
            vMin,
            uMax,
            vMax,
            thumbnailDataUrl: thumbUrl,
            pixelRect: { x, y, w, h },
          });
        }

        const texture = new Texture(imageSrc, this.scene, false, true, Texture.NEAREST_SAMPLINGMODE);
        texture.name = `atlas_${name.toLowerCase().replace(/\s+/g, '_')}`;

        const id = `atlas_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
        const atlasDef: TextureAtlasDefinition = {
          id,
          name,
          texture,
          dataUrl: imageSrc,
          width: totalW,
          height: totalH,
          columns: frames.length,
          rows: 1,
          tileSize: frames[0] ? frames[0].pixelRect?.w || 32 : 32,
          frames,
          sourceCanvas: canvas || undefined,
        };

        this.atlases.set(id, atlasDef);
        return atlasDef;
      };

      if (typeof Image === 'undefined') {
        return resolve(buildAtlasFromCanvas(256, 256, null, null));
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      let finished = false;
      const finish = (w: number, h: number) => {
        if (finished) return;
        finished = true;

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

        resolve(buildAtlasFromCanvas(w, h, ctx, canvas));
      };

      img.onload = () => {
        finish(img.width || 256, img.height || 256);
      };
      img.onerror = () => {
        finish(256, 256);
      };

      img.src = imageSrc;
      if (img.complete && (img as any).naturalWidth !== undefined && (img as any).naturalWidth > 0) {
        finish((img as any).naturalWidth, (img as any).naturalHeight || 256);
      } else {
        setTimeout(() => finish(256, 256), 60);
      }
    });
  }

  /**
   * Extracts a cropped sub-image data URL for an individual frame from an atlas at native pixel resolution.
   */
  public extractFrameDataUrl(atlasId: string, frameId: string): string | null {
    const atlas = this.getAtlas(atlasId);
    if (!atlas) return null;
    const frame = atlas.frames.find((f) => f.id === frameId || f.name === frameId);
    if (!frame) return null;

    if (typeof document === 'undefined') {
      return frame.thumbnailDataUrl || atlas.dataUrl || null;
    }

    const rect = frame.pixelRect || {
      x: Math.round(frame.uMin * atlas.width),
      y: Math.round((1.0 - frame.vMax) * atlas.height),
      w: Math.max(1, Math.round((frame.uMax - frame.uMin) * atlas.width)),
      h: Math.max(1, Math.round((frame.vMax - frame.vMin) * atlas.height)),
    };

    try {
      let sourceCanvas = atlas.sourceCanvas;
      if (!sourceCanvas && atlas.dataUrl) {
        const c = document.createElement('canvas');
        c.width = atlas.width;
        c.height = atlas.height;
        const cCtx = c.getContext('2d');
        const img = new Image();
        img.src = atlas.dataUrl;
        if (cCtx) {
          cCtx.drawImage(img, 0, 0);
          atlas.sourceCanvas = c;
          sourceCanvas = c;
        }
      }

      if (sourceCanvas) {
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = rect.w;
        tileCanvas.height = rect.h;
        const ctx = tileCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
          return tileCanvas.toDataURL('image/png');
        }
      }
    } catch (err) {
      console.warn('Failed to extract frame canvas:', err);
    }

    return frame.thumbnailDataUrl || atlas.dataUrl || null;
  }
}
