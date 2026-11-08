# AI Agent Modeling Skills

This directory contains markdown (`.md`) skill definitions for the Mesh Editor AI Agent.
Any `.md` file placed here (or in subdirectories like `skills/<skill-name>/SKILL.md`) is automatically discovered and loaded by the Mesh Editor.

## Skill File Structure

Each skill file uses standard Markdown, optionally starting with YAML frontmatter to configure metadata:

```markdown
---
id: custom-skill-id
name: Custom Modeling Skill Name
description: Brief summary displayed in the UI settings checklist.
enabled: true
---

# Skill Instructions Header

Provide domain-specific instructions, prompt guidance, and tool usage rules here.
```

### Supported Metadata Fields:
- `id`: Unique identifier (defaults to filename without extension)
- `name`: Display name in the AI skills checklist (defaults to the first `# Heading` or file id)
- `description`: Short description shown under the skill checkbox
- `enabled`: `true` (default) or `false` to toggle initial activation

## Built-In Skills

| Skill File | Skill ID | Description |
| :--- | :--- | :--- |
| [`3d-mesh-modeler.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/3d-mesh-modeler.md) | `3d-mesh-modeler` | Core spatial 3D modeling rules, proportion ratios, grounding (`Y = 0`), and primitive composition. |
| [`csg-boolean-architect.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/csg-boolean-architect.md) | `csg-boolean-architect` | Constructive Solid Geometry (CSG2) workflows for boolean subtraction, union, and intersection. |
| [`pbr-material-stylist.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/pbr-material-stylist.md) | `pbr-material-stylist` | Physically Based Rendering (PBR) material composition, metallic/roughness calibration, and normal maps. |
| [`mesh-topology-optimizer.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/mesh-topology-optimizer.md) | `mesh-topology-optimizer` | Triangle budget adherence, QEM decimation, subdivision, and vertex welding guidelines. |
| [`image-to-mesh.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/image-to-mesh.md) | `image-to-mesh` | Multimodal 2D-to-3D visual decomposition from attached reference images and viewport snapshots. |
| [`neural-3d-generator.md`](file:///Users/dpeer/Sites/games/mesheditor/skills/neural-3d-generator.md) | `neural-3d-generator` | Hybrid task & subtask delegation to external Neural 3D Generators (**TRELLIS 2**, **Hunyuan3D**, **Hi3D**) via local **oMLX**, FastAPI, Gradio, or cloud BYO-key endpoints (`modeler_generate_neural_mesh`). |

## Synchronizing Built-In Skills

After adding or editing any `.md` skill file in `skills/`, synchronize `src/builtInSkills.ts` by running:

```bash
npm run sync:skills
```


