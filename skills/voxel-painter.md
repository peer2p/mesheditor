---
id: voxel-painter
name: Voxel & Block Modeler (3D Voxel Grids & 2D-to-3D Extrusion)
description: Guidance for generating 3D voxel models, blocky characters, pixel-art extrusions, and modular terrain blocks using palette-based voxel runs or box regions.
enabled: true
---

# Voxel & Block Modeler Skill

Use this skill when generating voxel models, blocky characters, retro 3D sprites, or converting 2D pixel art into 3D voxel meshes.

## Workflow with `modeler_build_voxel_mesh`
1. **Define Palette**:
   - Define named palette entries with hex color, roughness, and metallic (e.g. `stone: { color: "#7d8491", roughness: 0.85 }`, `gold: { color: "#f5c542", metallic: 0.85, roughness: 0.2 }`, `wood: { color: "#8b5a2b", roughness: 0.7 }`).
2. **Efficient Box Regions (`boxes`) & Voxel Lists (`voxels`)**:
   - Use the `boxes` array for solid cuboids/walls/platforms: `{ minX, minY, minZ, maxX, maxY, maxZ, paletteKey }`.
   - Add fine details with the `voxels` array: `{ x, y, z, paletteKey }`.
   - Interior hidden voxels are culled automatically, and solid voxels of the same palette key are merged into optimized multi-material meshes.
3. **2D Image to 3D Voxel Conversion**:
   - Map X (width) and Y (height) of the image, extruding depth along the Z axis (typically 3 to 8 voxels deep).

