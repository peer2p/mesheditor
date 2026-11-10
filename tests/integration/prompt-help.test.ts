import { NullEngine } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeshEditorApp } from '../../src/MeshEditorApp';
import { createDefaultToolRegistry } from '../../src/tools';

describe('AI Prompting & Tools Guide Modal Integration Tests', () => {
  let container: HTMLElement;
  let canvas: HTMLCanvasElement;
  let engine: NullEngine;
  let app: MeshEditorApp;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    container.id = 'test-host';
    document.body.appendChild(container);

    engine = new NullEngine();
    app = new MeshEditorApp({
      container,
      engine,
    });
  });

  afterEach(() => {
    app.dispose();
    container.remove();
  });

  describe('1. Modal Lifecycle & Opening via Triggers', () => {
    it('opens prompt help modal via app.showPromptHelp() and closes via hidePromptHelp()', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      expect(modal).not.toBeNull();
      expect(modal.classList.contains('active')).toBe(false);

      app.showPromptHelp('guide');
      expect(modal.classList.contains('active')).toBe(true);
      expect(modal.style.display).toBe('flex');

      // Verify guide pane is active by default
      const guidePane = modal.querySelector('#tabPaneGuide') as HTMLElement;
      expect(guidePane.classList.contains('active')).toBe(true);
      expect(guidePane.style.display).not.toBe('none');

      app.hidePromptHelp();
      expect(modal.classList.contains('active')).toBe(false);
      expect(modal.style.display).toBe('none');
    });

    it('opens prompt help modal when clicking the AI control bar button (#btnAIPromptHelp)', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const btnPromptHelp = container.querySelector('#btnAIPromptHelp') as HTMLButtonElement;
      expect(btnPromptHelp).not.toBeNull();

      btnPromptHelp.click();
      expect(modal.classList.contains('active')).toBe(true);
    });

    it('opens prompt help modal when clicking the dialog header button (#btnAIPromptHelpHeader)', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const btnHeader = container.querySelector('#btnAIPromptHelpHeader') as HTMLButtonElement;
      expect(btnHeader).not.toBeNull();

      btnHeader.click();
      expect(modal.classList.contains('active')).toBe(true);
    });

    it('opens prompt help directly to tools tab when clicking the inline summary link (#btnOpenPromptHelpInline)', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const btnInline = container.querySelector('#btnOpenPromptHelpInline') as HTMLButtonElement;
      expect(btnInline).not.toBeNull();

      btnInline.click();
      expect(modal.classList.contains('active')).toBe(true);

      const toolsPane = modal.querySelector('#tabPaneTools') as HTMLElement;
      expect(toolsPane.classList.contains('active')).toBe(true);
      expect(toolsPane.style.display).toBe('flex');
    });

    it('opens prompt help when clicking the trigger in the general Help modal (#btnOpenPromptHelpFromGeneralHelp)', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const btnFromGeneral = container.querySelector('#btnOpenPromptHelpFromGeneralHelp') as HTMLButtonElement;
      expect(btnFromGeneral).not.toBeNull();

      btnFromGeneral.click();
      expect(modal.classList.contains('active')).toBe(true);
    });

    it('closes modal when clicking close button, done button, or backdrop', () => {
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      app.showPromptHelp('guide');
      expect(modal.classList.contains('active')).toBe(true);

      // Close via X button
      const btnClose = modal.querySelector('#btnClosePromptHelp') as HTMLButtonElement;
      btnClose.click();
      expect(modal.classList.contains('active')).toBe(false);

      // Open and close via Got it! button
      app.showPromptHelp('guide');
      const btnDone = modal.querySelector('#btnDonePromptHelp') as HTMLButtonElement;
      btnDone.click();
      expect(modal.classList.contains('active')).toBe(false);

      // Open and close via backdrop click
      app.showPromptHelp('guide');
      modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(modal.classList.contains('active')).toBe(false);
    });
  });

  describe('2. Dynamic Tools Directory (Name & Description from ToolRegistry)', () => {
    it('populates all registered AI tools with their exact name and description from ToolRegistry', () => {
      app.showPromptHelp('tools');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;

      const defaultRegistry = createDefaultToolRegistry();
      const allTools = defaultRegistry.getAll();
      expect(allTools.length).toBeGreaterThanOrEqual(40);

      // Badge displays total tool count
      const countBadge = modal.querySelector('#promptHelpToolCountBadge');
      expect(countBadge?.textContent).toBe(String(allTools.length));

      // Each tool is rendered with its name and description
      const toolItems = modal.querySelectorAll('.prompt-tool-item');
      expect(toolItems.length).toBe(allTools.length);

      for (const tool of allTools) {
        const item = modal.querySelector(`[data-tool-name="${tool.name}"]`);
        expect(item).not.toBeNull();

        const nameEl = item?.querySelector('.prompt-tool-code');
        expect(nameEl?.textContent).toBe(tool.name);

        const descEl = item?.querySelector('.prompt-tool-desc');
        expect(descEl?.textContent?.trim()).toBe(tool.description.trim());
      }
    });

    it('filters tools dynamically via the search input by name, keyword or description', () => {
      app.showPromptHelp('tools');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const searchInput = modal.querySelector('#promptToolSearchInput') as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      // Search for 'lathe'
      searchInput.value = 'lathe';
      searchInput.dispatchEvent(new Event('input'));

      const visibleItems = Array.from(modal.querySelectorAll<HTMLElement>('.prompt-tool-item')).filter(
        (el) => el.style.display !== 'none'
      );
      expect(visibleItems.length).toBeGreaterThanOrEqual(1);
      expect(visibleItems.some((el) => el.getAttribute('data-tool-name') === 'modeler_create_lathe')).toBe(true);

      const statusEl = modal.querySelector('#promptToolsCount');
      expect(statusEl?.textContent).toContain(`Showing ${visibleItems.length} of`);

      // Clear search
      const clearBtn = modal.querySelector('#btnClearPromptToolSearch') as HTMLButtonElement;
      expect(clearBtn.style.display).not.toBe('none');
      clearBtn.click();

      const allItems = Array.from(modal.querySelectorAll<HTMLElement>('.prompt-tool-item')).filter(
        (el) => el.style.display !== 'none'
      );
      expect(allItems.length).toBe(createDefaultToolRegistry().getAll().length);
    });

    it('filters tools by category chips (e.g. Architecture, Shapes, CSG)', () => {
      app.showPromptHelp('tools');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;

      const archChip = modal.querySelector('[data-category="architecture"]') as HTMLButtonElement;
      expect(archChip).not.toBeNull();
      archChip.click();

      const visibleItems = Array.from(modal.querySelectorAll<HTMLElement>('.prompt-tool-item')).filter(
        (el) => el.style.display !== 'none'
      );
      expect(visibleItems.length).toBeGreaterThan(0);
      for (const item of visibleItems) {
        expect(item.getAttribute('data-tool-category')).toBe('architecture');
      }

      // Revert to all
      const allChip = modal.querySelector('[data-category="all"]') as HTMLButtonElement;
      allChip.click();
      const allVisible = Array.from(modal.querySelectorAll<HTMLElement>('.prompt-tool-item')).filter(
        (el) => el.style.display !== 'none'
      );
      expect(allVisible.length).toBe(createDefaultToolRegistry().getAll().length);
    });

    it('copies tool name to clipboard on clicking Copy button', () => {
      app.showPromptHelp('tools');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;

      const copyBtn = modal.querySelector('[data-tool-name="modeler_create_lathe"] .btn-copy-tool') as HTMLButtonElement;
      expect(copyBtn).not.toBeNull();

      // Mock clipboard writeText
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      copyBtn.click();
      expect(writeTextMock).toHaveBeenCalledWith('modeler_create_lathe');
      expect(copyBtn.textContent).toContain('Copied!');
    });

    it('inserts tool name into #aiPromptInput and focuses textarea on clicking Insert button', () => {
      app.showPromptHelp('tools');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;

      const promptInput = container.querySelector('#aiPromptInput') as HTMLTextAreaElement;
      expect(promptInput).not.toBeNull();
      promptInput.value = 'Please build a vase using';

      const insertBtn = modal.querySelector('[data-tool-name="modeler_create_lathe"] .btn-insert-tool') as HTMLButtonElement;
      expect(insertBtn).not.toBeNull();

      insertBtn.click();

      expect(promptInput.value).toBe('Please build a vase using modeler_create_lathe');
      expect(modal.classList.contains('active')).toBe(false); // Closed after insertion for seamless workflow
    });
  });

  describe('3. Prompt Engineering Guide & Ready-to-Use Templates', () => {
    it('displays prompt engineering principles (Y-up grounding, part hierarchy, PBR) in Guide tab', () => {
      app.showPromptHelp('guide');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;
      const guideText = modal.querySelector('#tabPaneGuide')?.textContent || '';

      expect(guideText).toContain('How the AI Agent Uses 3D Tools');
      expect(guideText).toContain('Referencing Tools in Your Prompts');
      expect(guideText).toContain('Bottom-Alignment & Grounding (Y = 0)');
      expect(guideText).toContain('Part Hierarchy & Polygon Budget');
      expect(guideText).toContain('PBR Materials & Normal Maps');
    });

    it('renders prompt templates with one-click Use Prompt insertion into textarea', () => {
      app.showPromptHelp('examples');
      const modal = container.querySelector('#promptHelpModal') as HTMLElement;

      const examplesPane = modal.querySelector('#tabPaneExamples') as HTMLElement;
      expect(examplesPane.classList.contains('active')).toBe(true);

      const templateCards = modal.querySelectorAll('.prompt-template-card');
      expect(templateCards.length).toBeGreaterThanOrEqual(8);

      const promptInput = container.querySelector('#aiPromptInput') as HTMLTextAreaElement;
      promptInput.value = '';

      const firstUseBtn = templateCards[0].querySelector('.btn-use-template') as HTMLButtonElement;
      expect(firstUseBtn).not.toBeNull();
      firstUseBtn.click();

      expect(promptInput.value.length).toBeGreaterThan(20);
      expect(modal.classList.contains('active')).toBe(false);
    });
  });
});
