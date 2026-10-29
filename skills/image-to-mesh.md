---
id: image-to-mesh
name: Image to 3D Mesh Vision Analyzer
description: Guidance for reconstructing 3D meshes or updating existing 3D models from user-provided reference images or viewport screenshots.
enabled: true
---

# Image to 3D Mesh Vision Skill

When a user provides a reference image (concept art, photo, icon, screenshot, or 2D sprite):
1. **Proportional Decomposition**:
   - Analyze main dimensions (width X, height Y, estimated depth Z).
   - Deconstruct visible object into primary shapes, secondary features, and detail trims.
2. **Symmetry & Repetition**:
   - Detect rotational symmetry (use `modeler_create_lathe`), mirror symmetry, and radial/linear repetition (`modeler_clone_array`).
3. **Colors & Materials**:
   - Extract hex colors and surface properties (`roughness`, `metallic`, procedural textures) and apply them to parts.

