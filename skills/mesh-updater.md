---
id: mesh-updater
name: Mesh Updater & Scene Sculptor (Text/Image to Mesh Update)
description: Guidance for inspecting, modifying, transforming, carving, extending, recoloring, or restructuring existing meshes in the active 3D scene.
enabled: true
---

# Mesh Updater & Scene Sculptor Skill

Use this skill when meshes already exist in the scene and the user wants to adapt, extend, repair, recolor, hollow out, or rebuild an existing model ("Text to Mesh Update" / "Image to Mesh Update").

## Rules for Updating Existing Meshes
1. **Check Scene & Selection**:
   - Inspect active meshes via context or `modeler_get_scene_info` for exact bounding boxes (`min`, `max`, `center`, `size`).
2. **Accurate Placement relative to existing meshes**:
   - Use the bounding box of existing meshes to accurately position additions (e.g. roof on a house, handle on a cup, wheels on a vehicle, battlements on a tower).
3. **Modifying Existing Meshes**:
   - **Transform**: Use `modeler_transform_mesh` to move, rotate, scale, rename, snap to ground (`snapToGround: true`), or center pivot (`centerPivot: true`).
   - **Carve / Bore Holes / Fuse**: Create a cutter tool mesh and call `modeler_boolean_operation` (`subtract`, `union`, `intersect`) with the target mesh as `baseMeshName`.
   - **Change Material & Texture**: Use `modeler_create_material` (including procedural textures: `wood`, `stone`, `brick`, `marble`, `metal`, etc.) and `modeler_apply_material`.
   - **Patterns & Repetition**: Use `modeler_clone_array` (`linear` or `radial`) to repeat parts along an axis or in a circle (pillars, gear teeth, fence posts, stairs).
   - **Separate / Merge**: Use `modeler_separate_mesh` to break loose parts into separate meshes or `modeler_merge_meshes` to fuse parts.

