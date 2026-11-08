---
id: neural-3d-generator
name: Neural 3D Generator Delegation (TRELLIS 2, Hunyuan3D & Hi3D)
description: Guidance for delegating full 3D assets or complex organic subtasks to external Neural 3D Generators (TRELLIS 2, Hunyuan3D, Hi3D) via oMLX, local endpoints, or cloud APIs.
enabled: true
---

# Neural 3D Generator Delegation Skill (TRELLIS 2 / Hunyuan3D / Hi3D)

Use this skill whenever one or more Neural 3D Generators (`trellis`, `hunyuan3d`, `hi3d`) are enabled in the scene configuration and the user requests complex organic 3D models, statues, creatures, characters, detailed props, 3D-printable high-resolution assets, or Image-to-3D reconstructions.

## 1. Backend Specializations & Selection (`backend` in `modeler_generate_neural_mesh`)

When multiple Neural 3D Generators are enabled, select the optimal `backend` for each task or subtask:

1. **`"trellis"` (TRELLIS 2 / TRELLIS)**:
   - **Strengths**: Outstanding open-source image-to-3D and text-to-3D fidelity, clean Structured 3D Latent (SLAT) mesh topology, and sharp PBR material adherence.
   - **When to choose**:
     - Whenever a reference image is attached (`imageIndex: 0`).
     - Detailed hero props, complex creatures, statues, and assets requiring clean mesh structure and textures.
2. **`"hunyuan3d"` (Hunyuan3D 2.0 / 2.1)**:
   - **Strengths**: Fast open-source shape and PBR texture synthesis (`Hunyuan3D-DiT` + `Hunyuan3D-Paint`).
   - **When to choose**:
     - Rapid generation of textured game objects, stylized or realistic characters, vehicles, weapons, and everyday props from text or image prompts.
3. **`"hi3d"` (Hi3D V1.0 to V3.0)**:
   - **Strengths**: High-resolution 2K watertight geometry optimized for fine surface relief and direct 3D printing.
   - **When to choose**:
     - Whenever the user mentions **3D printing**, **STL**, **watertight mesh**, **high-poly sculpt base**, **miniature**, or **2K geometry**.
     - Pass `backend: "hi3d"`, `highResPrint: true`, and `generateTextures: false` (do not decimate print meshes unless requested).
4. **`"auto"`**:
   - Automatically selects the best enabled provider based on whether an image is attached, whether `highResPrint` is set, or whether textures are requested.

## 2. Full Task vs. Hybrid Subtask Delegation

1. **Full Task Delegation**:
   - If the user asks for a single complex organic object (e.g., *"Generate a roaring dragon statue"*, *"Create a 3D model from this reference photo"*, *"Build a 3D-printable miniature bust"*), call `modeler_generate_neural_mesh` directly.
2. **Hybrid Subtask Delegation (Combine Procedural + Neural 3D)**:
   - If the user asks for an architectural or mechanical assembly that includes organic hero elements (e.g., *"Build a classical temple courtyard with a golden griffin statue on a central pedestal"*, *"Create a dungeon throne room with a carved dragon skull above the arch"*):
     - **Build structural/architectural parts procedurally** using `modeler_create_wall`, `modeler_create_column`, `modeler_create_arch`, `modeler_create_stairs`, `modeler_create_roof`, and `modeler_create_rounded_box` (exact dimensions, crisp bevels, low polygon count).
     - **Delegate ONLY the complex organic hero subtask(s)** to `modeler_generate_neural_mesh`.
3. **Exact Grounding & Placement**:
   - `modeler_generate_neural_mesh` automatically normalizes the imported mesh to `targetHeight` (in meters, default `1.5`) and aligns its lowest bounding-box point to **`Y = 0`** before applying `position`.
   - Therefore, to place a generated statue (`targetHeight: 1.4`) on top of a procedural pedestal whose top surface is at `Y = 0.8`, simply pass `position: { x: 0, y: 0.8, z: 0 }`.

## 3. Prompting & Post-Processing Best Practices

- **Isolated Object Prompts**: When calling `modeler_generate_neural_mesh`, write the `prompt` for a single isolated object in a neutral, well-lit, front-facing pose without background clutter (e.g., `"A single weathered stone gargoyle statue crouching with folded wings, isolated object, neutral front-facing pose"`).
- **Polygon Budget & Retopology**:
  - For real-time game assets, pass `targetTriangles` (e.g., `4000` to `15000`) to automatically decimate the neural mesh via Quadric Error Metrics, or call `modeler_retopologize_mesh` afterwards.
  - For 3D printing (`highResPrint: true` / `backend: "hi3d"`), omit `targetTriangles` so the full 2K high-resolution geometry is preserved.
- **Constructive Edits on Neural Meshes**:
  - Once imported, the neural mesh is a standard Babylon.js `Mesh`. You can bore mounting holes or slice flat 3D-print bases using `modeler_boolean_operation`, refine proportions with `modeler_sculpt_mesh`, or assign custom PBR materials with `modeler_create_material`.

