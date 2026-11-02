---
id: procedural-modeler
name: Procedural Modeler (MeshBuilder, CSG2, Extrude, Lathe)
description: Guidance for building 3D meshes procedurally using Babylon.js primitives, CSG boolean operations, box-modeling (extrude, inset, arc, cut-through), Sub-D smoothing, solidify wall thickness, lathes, and PBR materials.
enabled: true
---

# Procedural Modeler Skill (Babylon.js Live Scene)

Use this skill whenever requested to create or extend 3D models, assets, or geometries (such as pipes, columns, gears, furniture, swords, vehicles, buildings, organic/mechanical objects, cups, bowls, arches, or stone formations).

## Core Workflow Rules

1. **Think procedurally**: Decompose complex objects into geometric primitives (boxes, cylinders, spheres, cones, capsules, tori, polygons, lathes, tubes) or start with a low-poly cage and use box-modeling / Sub-D smoothing.
2. **Coordinate system**: Babylon.js uses a left-handed coordinate system:
   - **Y is up** (height), **X is right** (width), **Z is forward** (depth).
   - Align the base of standing objects to **Y = 0** (Bottom-Aligned: A box with `height: 2` stands on ground `Y = 0` when `position.y = 1`).
3. **Step-by-step workflow**:
   - Inspect scene if updating existing meshes (`modeler_get_scene_info`).
   - Create base meshes (`modeler_create_primitive`, `modeler_extrude_polygon`, `modeler_extrude_shape`, `modeler_create_lathe`, `modeler_create_tube`).
   - Refine with Box-Modeling & Topology edits (`modeler_facet_extrude`, `modeler_facet_inset`, `modeler_facet_arc`, `modeler_facet_cut_through`).
   - Apply wall thickness (`modeler_solidify_mesh`) or organic curvature (`modeler_subd_smooth`).
   - Apply materials before or after CSG operations (`modeler_create_material`, `modeler_apply_material`).
   - Combine or carve shapes using CSG (`modeler_boolean_operation`: `union`, `subtract`, `intersect`).
   - Apply `modeler_auto_uv_mapping` to CSG, extruded, or modified meshes so textures project cleanly.

## Box-Modeling & Topology Workflows (Facet Tool Methods)

1. **Wall Thickness & Shells (`modeler_solidify_mesh`)**:
   - **When to use**: Creating hollow vessels, cups, mugs, bowls, bottles, helmets, armor, hollow pipes, or architectural room walls.
   - **Advantage over CSG**: Instead of subtracting an inner cylinder/sphere with CSG `subtract`, call `modeler_solidify_mesh` with `thickness: 0.1` to `0.2`. It is 10x faster, perfectly watertight/manifold, and preserves clean UVs.
2. **Organic Subdivision Surface (`modeler_subd_smooth`) & Subdivision (`modeler_subdivide_mesh`)**:
   - **When to use**: Organic shapes, curved cushions, rocks, boulders, creature bodies, car hoods, rounded handles.
   - **Workflow**: Create a low-poly base box or simple blockout cage (e.g. `box` with `width: 2, height: 0.6, depth: 2`), then call `modeler_subd_smooth` with `iterations: 1` or `2`. It applies midpoint subdivision and Laplacian smoothing to transform rigid blockouts into smooth, natural curves without massive polygon counts.
3. **Facet Extrusions (`modeler_facet_extrude`) & Insets (`modeler_facet_inset`)**:
   - **Extrude**: Pulls a face outward along its normal with connecting quad sides (e.g. `direction: "top"`, `distance: 0.5`). Perfect for towers, battlements, chimney stacks, and limbs.
   - **Inset**: Shrinks perimeter edges inward toward centroid (e.g. `direction: "front"`, `insetAmount: 0.2`, `depth: -0.1`). Negative `depth` recesses window frames and door portals; positive `depth` creates beveled paneling.
4. **Curved Segmented Arches (`modeler_facet_arc`)**:
   - Extrudes a face along a smooth circular arc (`direction: "top"`, `segments: 4` to `8`, `height: 0.6`).
   - Ideal for bridges, Roman/Gothic arches, tunnel bends, mugs/pitcher handles, and horns.
5. **Portals & Through-Holes (`modeler_facet_cut_through`)**:
   - Tunnels a hollow portal directly through the mesh along normal (`direction: "front"`, `depth: 1.0`).
   - Great for doorways, open arch gates, and hollow openings without intermediate cutter meshes.
6. **In `modeler_execute_babylon_code`**:
   The `service` instance exposes all facet methods directly:

   ```javascript
   // Solidify a hollow hemisphere into a bowl:
   const bowl = MeshBuilder.CreateSphere(
     "bowl",
     { diameter: 2, slice: 0.5, sideOrientation: Mesh.DOUBLESIDE },
     scene,
   );
   registerMesh(bowl);
   service.solidifyMeshOrFacet(0.1, false, bowl);

   // Box modeling a tower with an arch:
   const tower = MeshBuilder.CreateBox(
     "tower",
     { width: 1.5, height: 3, depth: 1.5 },
     scene,
   );
   registerMesh(tower);
   service.insetFacet(tower, { direction: "front" }, 0.25, -0.15); // Recessed door frame
   service.arcFacet(tower, { direction: "top" }, 6, 0.8); // Arched dome roof
   ```

## 3D Texture Generation & PBR Material Mastery

High quality 3D materials require clean textures without baked lighting artifacts.

### A. When using AI Image Generators (e.g. `generate_image`, DALL-E, Imagen)

In Babylon.js (and all modern PBR renderers), shadows, highlights, and ambient occlusion are computed dynamically at runtime based on scene lights and camera position. If an AI image contains directional shadows, angled perspectives, or baked lighting, tiling it produces jarring light-grid artifacts and conflicting shadows.

**Mandatory Prompt Rules for 3D Tiling Textures**:

1. **View / Projection**: Always specify `"top-down orthogonal view"`, `"flat 90-degree overhead projection"`, `"no perspective angle"`.
2. **Lighting / Shading**: Always specify `"completely unshaded diffuse albedo map"`, `"uniform flat lighting"`, `"zero directional shadows"`, `"no specular highlights"`, `"no vignette"`.
3. **Tiling**: Always include `"seamless texture"`, `"seamless tileable repeating pattern"`, `"perfect for 3D tiling"`.
4. **Subject**: Focus purely on the surface macro/micro texture without scene objects, horizons, or tilted elements.

**Prompt Examples**:

- **Sand**: `"A high quality top-down seamless texture of fine gray sand with subtle wind ripples. Completely unshaded diffuse albedo map, flat orthogonal 90-degree projection, uniform lighting, zero shadows, no highlights, seamless repeating pattern, perfect for 3D tiling."`
- **Cobblestone**: `"A high quality top-down seamless texture of medieval cobblestone street pavement. Flat orthogonal top-down view, unshaded diffuse albedo map, uniform ambient lighting, no cast shadows, clean repeating tileable pattern."`
- **Roof Tiles**: `"A high quality top-down seamless texture of weathered terracotta clay roof tiles. Flat orthogonal 90-degree view, unshaded diffuse map, uniform lighting, no shadows, perfectly tileable."`
- **Bark / Wood**: `"A high quality top-down seamless texture of vertical oak wood grain planks. Flat overhead unshaded diffuse albedo map, uniform lighting, no shadows, seamless tileable."`

**Applying Generated Textures**:
Pass the resulting image URL or base64 data URI directly to `modeler_create_material`:

```json
{
  "materialName": "SandPBRMat",
  "textureUrl": "https://... or data:image/png;base64,...",
  "uScale": 4,
  "vScale": 4,
  "roughness": 0.9,
  "metallic": 0.0
}
```

### B. When the LLM does NOT have an Image Generator (3 Powerful Offline Alternatives)

Models without image generation tools can achieve stunning, seamless textures using these three approaches:

1. **Built-in Procedural Textures (`proceduralTexture` in `modeler_create_material`)**:
   Mesh Editor contains a built-in mathematical procedural texture generator that runs instantly and offline.
   - **Supported Types**: `sand`, `tiles`, `grass`, `fabric`, `wood`, `stone`, `marble`, `brick`, `metal`, `checker`, `grid`, `noise`, `gradient`.
   - **Parameters**: `primaryColor`, `secondaryColor`, `scale`, `uScale`, `vScale`.
   - **Example**:
     ```json
     {
       "materialName": "DuneSandMat",
       "roughness": 0.92,
       "metallic": 0.0,
       "proceduralTexture": {
         "type": "sand",
         "primaryColor": "#c2b280",
         "secondaryColor": "#9c8c5a",
         "scale": 1.2,
         "uScale": 4,
         "vScale": 4
       }
     }
     ```

2. **Custom Procedural 2D Canvas in `modeler_execute_babylon_code` (`DynamicTexture`)**:
   LLMs can generate any mathematical pattern using standard HTML5 Canvas 2D methods directly in code:

   ```javascript
   const dt = new DynamicTexture("customTexture", 512, scene, true);
   const ctx = dt.getContext();
   ctx.fillStyle = "#888c94";
   ctx.fillRect(0, 0, 512, 512);
   // Add noise grain / speckles
   for (let i = 0; i < 15000; i++) {
     const x = Math.random() * 512;
     const y = Math.random() * 512;
     const delta = (Math.random() - 0.5) * 30;
     ctx.fillStyle = `rgba(${136 + delta}, ${140 + delta}, ${148 + delta}, 0.6)`;
     ctx.fillRect(x, y, 2, 2);
   }
   dt.update();
   const mat = new PBRMaterial("customMat", scene);
   mat.albedoTexture = dt;
   mat.roughness = 0.85;
   ```

3. **PBR Physical Properties + Triplanar UVs (`modeler_auto_uv_mapping`)**:
   High visual fidelity in 3D relies heavily on micro-surface physics rather than complex diffuse maps alone:
   - **Matte Sand / Stone / Dirt**: `roughness: 0.85-0.95`, `metallic: 0.0`.
   - **Polished Marble / Tile**: `roughness: 0.15`, `metallic: 0.05`.
   - **Brushed Metal / Steel**: `roughness: 0.25-0.35`, `metallic: 0.85-0.95`.
   - **Gold / Brass**: `albedoColor: "#ffd700"`, `roughness: 0.2`, `metallic: 0.95`.
   - Always run `modeler_auto_uv_mapping` with `scale: 1.0` to `2.0` on boolean or modified meshes to eliminate texture stretching across corners.

## Best Practices & Guidelines

1. **Clean up intermediate meshes**:
   - In `modeler_boolean_operation`, input meshes are removed by default (`keepToolMesh: false`), leaving only the clean CSG result.
   - When using `modeler_execute_babylon_code` for complex parametric loops, always dispose temporary intermediate tool meshes.
2. **Multi-materials in CSG & Merge**:
   - If an object needs multiple materials (e.g. wooden walls with a brick roof), apply materials **before** boolean operations or before `modeler_merge_meshes`.
   - Do not overwrite a merged multi-material mesh with a single material afterwards.
3. **Extrusions (`modeler_extrude_polygon` & `modeler_extrude_shape`)**:
   - `modeler_extrude_polygon` expects 2D points in the **XZ plane** (`y: 0`) clockwise without self-intersection and extrudes along Y. To stand a profile upright, rotate by `rotationDegrees: { x: -90, y: 0, z: 0 }`.
   - `modeler_extrude_shape` extrudes a 2D profile along a 3D path.
4. **Rotational Bodies (`modeler_create_lathe`)**:
   - Ideal for vases, chalices, pillar bases, bottles, chess pieces, domes, or lamp shades. Define profile in the XY plane (`x >= 0` radius, `y` height).
5. **Metallic & filigree structures**:
   - Use thin cylinders or `modeler_create_tube` for railings, frames, pipes, and cables. For realistic metal use `metallic: 0.8`, `roughness: 0.25`.
