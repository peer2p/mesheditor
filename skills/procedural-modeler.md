---
id: procedural-modeler
name: Procedural Modeler (MeshBuilder, CSG2, Extrude, Lathe)
description: Guidance for building 3D meshes procedurally using Babylon.js primitives, CSG boolean operations, polygon/path extrusions, lathes, PBR materials, and triplanar UV mapping.
enabled: true
---

# Procedural Modeler Skill (Babylon.js Live Scene)

Use this skill whenever requested to create or extend 3D models, assets, or geometries (such as pipes, columns, gears, furniture, swords, vehicles, buildings, or organic/mechanical objects).

## Core Workflow Rules
1. **Think procedurally**: Decompose complex objects into geometric primitives (boxes, cylinders, spheres, cones, capsules, tori, polygons, lathes, tubes).
2. **Coordinate system**: Babylon.js uses a left-handed coordinate system:
   - **Y is up** (height), **X is right** (width), **Z is forward** (depth).
   - Align the base of standing objects to **Y = 0** (Bottom-Aligned: A box with `height: 2` stands on ground `Y = 0` when `position.y = 1`).
3. **Step-by-step workflow**:
   - Inspect scene if updating existing meshes (`modeler_get_scene_info`).
   - Create base meshes (`modeler_create_primitive`, `modeler_extrude_polygon`, `modeler_extrude_shape`, `modeler_create_lathe`, `modeler_create_tube`).
   - Apply materials before or after CSG operations (`modeler_create_material`, `modeler_apply_material`).
   - Combine or carve shapes using CSG (`modeler_boolean_operation`: `union`, `subtract`, `intersect`).
   - Apply `modeler_auto_uv_mapping` to CSG or extruded meshes so textures project cleanly.

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

