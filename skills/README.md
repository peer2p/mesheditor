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

