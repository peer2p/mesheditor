import { ToolInterface } from '../ToolInterface';
import { getToolViewTemplate } from './toolViews';

/**
 * Base class for built-in editor tools that provides automatic
 * view template loading and DOM rendering from its associated EJS view template.
 */
export abstract class AbstractEditorTool implements ToolInterface {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public readonly helpText?: string;
  public readonly icon?: string;
  public readonly dialogId?: string;
  public readonly triggerButtonId?: string;
  public readonly toolbarButtonId?: string;
  public readonly menuId?: string;
  public readonly menuLabel?: string;
  public readonly isExclusive3DTool?: boolean;
  public readonly defaultOpen?: boolean;
  public readonly order?: number;
  public readonly viewTemplate?: string;

  /**
   * Returns the HTML view template markup for this tool dialog,
   * dynamically retrieved from the compiled EJS view template.
   */
  public getViewTemplate(): string {
    if (this.viewTemplate) return this.viewTemplate;
    if (this.dialogId) {
      const byDialog = getToolViewTemplate(this.dialogId);
      if (byDialog) return byDialog;
    }
    return getToolViewTemplate(this.constructor.name) || '';
  }

  /**
   * Mounts or retrieves the tool's dialog DOM element.
   * If the dialog element is not already present in the DOM, mounts it from `getViewTemplate()`.
   */
  public renderView(container?: HTMLElement): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    if (this.dialogId) {
      const existing = document.getElementById(this.dialogId);
      if (existing) return existing;
    }
    const template = this.getViewTemplate();
    if (!template) return null;
    const target = container || document.getElementById('stackpanelRightSidebar') || document.body;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = template.trim();
    const element = wrapper.firstElementChild as HTMLElement;
    if (element && target) {
      target.appendChild(element);
      return element;
    }
    return null;
  }
}

