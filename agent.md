# Agent Guidelines: Language & Output Policy

## Strict English Language Requirement

**All code, GUI elements, user-facing text, tool labels, logs, prompts, comments, and documentation in this codebase MUST be strictly in English.**

### Rules:
1. **User Interface (GUI)**:
   - All labels, buttons, headers, tooltips, dialogs, quick prompts, badges, placeholders, and empty states MUST be written in English.
   - Never introduce German words (e.g., "Baue", "Schatztruhe", "Steinsäule", "Prompt eingeben", "Fehler", "Fertig", "Zahnrad", "Konto", "Speichern") into HTML templates, EJS templates, or DOM-manipulating code.

2. **System Prompts & AI Skills**:
   - All agent instructions, system prompts, skill descriptions, tool descriptions, and few-shot examples injected into LLMs must be authored in English.
   - When instructing models on what to output, ensure default fallback messages and confirmations are English (e.g., "Finished 3D mesh operations." instead of "Fertig.").

3. **Status Messages, Toasts & Errors**:
   - `events.onToast`, `events.onStatusChanged`, throw statements (`new Error(...)`), status badges, and console logs (`console.warn`, `console.error`, `console.log`) MUST be strictly in English.

4. **Code, Comments & Identifiers**:
   - Variable names, functions, classes, interfaces, comments, and commit messages MUST be in English.

5. **Conversational Communication**:
   - Even if the user communicates in German, code changes, UI additions, and runtime artifacts must remain strictly English.

