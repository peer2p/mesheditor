import {
  AI_ENDPOINT_PRESETS,
  AI_PROTOCOL_INFO,
  DEFAULT_AI_AGENT_CONFIG,
  DEFAULT_ANTHROPIC_MAX_TOKENS,
  DEFAULT_AZURE_API_VERSION,
  DEFAULT_OLLAMA_NUM_CTX,
  findMatchingPreset,
  NEURAL_3D_PROTOCOL_DEFAULTS,
  resolveProtocol,
} from '../AIAgentService';
import { createDefaultNeural3DProviders } from '../Neural3DGeneratorService';
import { createDefaultImageGeneratorProviders } from '../textures/ExternalImageGeneratorService';
import type {
  AIAgentProtocol,
  AIAgentReasoningEffort,
  Neural3DBackendId,
  Neural3DProtocol,
  Neural3DProvidersMap,
} from '../types';
import type { MeshEditorAppHost } from './MeshEditorAppHost';

export const SETTINGS_STORAGE_KEY = 'mesheditor_settings';

export interface MeshEditorSettings {
  grid: boolean;
  gridSize: number;
  gridLineColor: string;
  gridFillColor: string;
  gridFillTransparent: boolean;
  cameraSpeed: number;
  translateSnap: number;
  rotateSnap: number;
  meshSelectionColor: string;
  faceSelectionColor: string;
  vertexColor: string;
  vertexSelectionColor: string;
  voxelToolColor: string;
}

export const DEFAULT_MESH_EDITOR_SETTINGS: MeshEditorSettings = {
  grid: true,
  gridSize: 20,
  gridLineColor: '#3299fd',
  gridFillColor: '#ffffff',
  gridFillTransparent: true,
  cameraSpeed: 0.4,
  translateSnap: 0.1,
  rotateSnap: 5,
  meshSelectionColor: '#3399ff',
  faceSelectionColor: '#ffcc33',
  vertexColor: '#00d9ff',
  vertexSelectionColor: '#ffa61a',
  voxelToolColor: '#ffd91a',
};

export class SettingsUIService {
  public activeSettingsTab: 'editing' | 'ai' = 'editing';
  public syncAISettingsControlsUI: (() => void) | null = null;

  constructor(private readonly app: MeshEditorAppHost) {}

  private getNumericSettingBindings() {
    return [
      {
        key: 'gridSize' as const,
        rangeId: 'settingGridSizeRange',
        numId: 'settingGridSizeNum',
        min: 5,
        max: 200,
        unit: 'units',
        decimals: 0,
        apply: (val: number) => this.app.service.setGridSize(val),
      },
      {
        key: 'cameraSpeed' as const,
        rangeId: 'settingCameraSpeedRange',
        numId: 'settingCameraSpeedNum',
        min: 0.1,
        max: 2.0,
        unit: 'x',
        decimals: 2,
        apply: (val: number) => this.app.service.setCameraSpeed(val),
      },
      {
        key: 'translateSnap' as const,
        rangeId: 'settingMoveSnapRange',
        numId: 'settingMoveSnapNum',
        min: 0.01,
        max: 50.0,
        unit: 'units',
        decimals: 2,
        apply: (val: number) => this.app.service.setTranslateSnap(val),
      },
      {
        key: 'rotateSnap' as const,
        rangeId: 'settingRotateSnapRange',
        numId: 'settingRotateSnapNum',
        min: 1,
        max: 90,
        unit: '°',
        decimals: 0,
        apply: (val: number) => this.app.service.setRotateSnap(val),
      },
    ];
  }

  private getColorSettingBindings() {
    return [
      {
        key: 'gridLineColor' as const,
        inputId: 'settingGridLineColor',
        hexId: 'settingGridLineColorHex',
        apply: (val: string) => this.app.service.setGridLineColor(val),
      },
      {
        key: 'gridFillColor' as const,
        inputId: 'settingGridFillColor',
        hexId: 'settingGridFillColorHex',
        apply: (val: string) => this.app.service.setGridFillColor(val),
      },
      {
        key: 'meshSelectionColor' as const,
        inputId: 'settingMeshSelectionColor',
        hexId: 'settingMeshSelectionColorHex',
        apply: (val: string) => this.app.service.setMeshSelectionColor(val),
      },
      {
        key: 'faceSelectionColor' as const,
        inputId: 'settingFaceSelectionColor',
        hexId: 'settingFaceSelectionColorHex',
        apply: (val: string) => this.app.service.setFaceSelectionColor(val),
      },
      {
        key: 'vertexColor' as const,
        inputId: 'settingVertexColor',
        hexId: 'settingVertexColorHex',
        apply: (val: string) => this.app.service.setVertexColor(val),
      },
      {
        key: 'vertexSelectionColor' as const,
        inputId: 'settingVertexSelectionColor',
        hexId: 'settingVertexSelectionColorHex',
        apply: (val: string) => this.app.service.setVertexSelectionColor(val),
      },
      {
        key: 'voxelToolColor' as const,
        inputId: 'settingVoxelToolColor',
        hexId: 'settingVoxelToolColorHex',
        apply: (val: string) => this.app.service.setVoxelToolColor(val),
      },
    ];
  }

  private syncGridFillTransparencyState(): void {
    const isTransparent = !!this.app.service.sceneParams.gridFillTransparent;
    const fillItem = this.app.getElement<HTMLElement>('settingGridFillColorItem');
    const badgeEl = this.app.getElement<HTMLElement>('settingGridFillTransparentBadge');
    if (fillItem) {
      fillItem.classList.toggle('is-transparent-fill', isTransparent);
    }
    if (badgeEl) {
      badgeEl.hidden = !isTransparent;
    }
  }

  private syncSliderVisual(rangeEl: HTMLInputElement, value: number, unit: string): void {
    rangeEl.style.setProperty('--attr-min', rangeEl.min || '0');
    rangeEl.style.setProperty('--attr-max', rangeEl.max || '100');
    rangeEl.style.setProperty('--control-value', String(value));
    rangeEl.setAttribute('aria-valuetext', `${value} ${unit}`);
  }

  private clampSettingValue(value: number, min: number, max: number, decimals: number): number {
    const clamped = Math.min(max, Math.max(min, value));
    const factor = Math.pow(10, decimals);
    return Math.round(clamped * factor) / factor;
  }

  public loadSettingsFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<MeshEditorSettings>;
      if (!parsed || typeof parsed !== 'object') return;

      if (typeof parsed.grid === 'boolean') {
        this.app.service.setGridVisible(parsed.grid);
      }
      if (typeof parsed.gridFillTransparent === 'boolean') {
        this.app.service.setGridFillTransparent(parsed.gridFillTransparent);
      }
      for (const binding of this.getNumericSettingBindings()) {
        const val = parsed[binding.key];
        if (typeof val === 'number' && Number.isFinite(val)) {
          const clamped = this.clampSettingValue(val, binding.min, binding.max, binding.decimals);
          binding.apply(clamped);
        }
      }
      for (const binding of this.getColorSettingBindings()) {
        const val = parsed[binding.key];
        if (typeof val === 'string' && val.trim()) {
          binding.apply(val);
        }
      }
    } catch (err) {
      console.warn('Failed to load settings from localStorage:', err);
    }
  }

  public saveSettingsToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: MeshEditorSettings = {
        grid: !!this.app.service.sceneParams.grid,
        gridSize: this.app.service.sceneParams.gridSize,
        gridLineColor: this.app.service.sceneParams.gridLineColor,
        gridFillColor: this.app.service.sceneParams.gridFillColor,
        gridFillTransparent: !!this.app.service.sceneParams.gridFillTransparent,
        cameraSpeed: this.app.service.sceneParams.cameraSpeed,
        translateSnap: this.app.service.sceneParams.translateSnap,
        rotateSnap: this.app.service.sceneParams.rotateSnap,
        meshSelectionColor: this.app.service.sceneParams.meshSelectionColor,
        faceSelectionColor: this.app.service.sceneParams.faceSelectionColor,
        vertexColor: this.app.service.sceneParams.vertexColor,
        vertexSelectionColor: this.app.service.sceneParams.vertexSelectionColor,
        voxelToolColor: this.app.service.sceneParams.voxelToolColor,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save settings to localStorage:', err);
    }
  }

  public syncSettingsUI(): void {
    const gridToggle = this.app.getElement<HTMLInputElement>('settingGridVisible');
    if (gridToggle) {
      gridToggle.checked = !!this.app.service.sceneParams.grid;
    }

    const gridFillTransparentToggle = this.app.getElement<HTMLInputElement>('settingGridFillTransparent');
    if (gridFillTransparentToggle) {
      gridFillTransparentToggle.checked = !!this.app.service.sceneParams.gridFillTransparent;
    }
    this.syncGridFillTransparencyState();

    for (const binding of this.getNumericSettingBindings()) {
      const currentVal = this.app.service.sceneParams[binding.key];
      const rangeEl = this.app.getElement<HTMLInputElement>(binding.rangeId);
      const numEl = this.app.getElement<HTMLInputElement>(binding.numId);
      if (rangeEl) {
        rangeEl.value = String(currentVal);
        this.syncSliderVisual(rangeEl, currentVal, binding.unit);
      }
      if (numEl) {
        numEl.value = String(currentVal);
      }
    }

    for (const binding of this.getColorSettingBindings()) {
      const currentVal = this.app.service.sceneParams[binding.key];
      const inputEl = this.app.getElement<HTMLInputElement>(binding.inputId);
      const hexEl = this.app.getElement<HTMLElement>(binding.hexId);
      if (inputEl) {
        inputEl.value = currentVal;
      }
      if (hexEl) {
        hexEl.textContent = currentVal.toUpperCase();
      }
    }

    this.syncAISettingsControlsUI?.();
  }

  public setSettingsInlineFeedback(elementId: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const el = this.app.getElement<HTMLElement>(elementId);
    if (!el) return;
    const cleanMsg = message.replace(/^[\s\p{Emoji}\p{Extended_Pictographic}]+/u, '').trim();
    if (!cleanMsg) {
      el.style.display = 'none';
      el.textContent = '';
      el.className =
        elementId === 'settingsFooterFeedback'
          ? 'settings-inline-feedback settings-footer-feedback'
          : 'settings-inline-feedback';
      return;
    }

    const iconMap: Record<'info' | 'success' | 'warning' | 'error', string> = {
      info: 'info',
      success: 'check-circle-2',
      warning: 'alert-triangle',
      error: 'alert-circle',
    };
    const baseClass =
      elementId === 'settingsFooterFeedback'
        ? 'settings-inline-feedback settings-footer-feedback'
        : 'settings-inline-feedback';
    el.className = `${baseClass} is-${type}`;
    el.style.display = 'flex';
    el.innerHTML = `<i class="app-icon" data-lucide="${iconMap[type]}"></i><span>${this.app.escapeHtml(cleanMsg)}</span>`;
    this.app.refreshIcons(el);
  }

  public resetSettingsToDefaults(): void {
    if (this.activeSettingsTab === 'ai') {
      this.resetAISettingsToDefaults();
      return;
    }

    this.app.service.setGridVisible(DEFAULT_MESH_EDITOR_SETTINGS.grid);
    this.app.service.setGridSize(DEFAULT_MESH_EDITOR_SETTINGS.gridSize);
    this.app.service.setGridFillTransparent(DEFAULT_MESH_EDITOR_SETTINGS.gridFillTransparent);
    this.app.service.setCameraSpeed(DEFAULT_MESH_EDITOR_SETTINGS.cameraSpeed);
    this.app.service.setTranslateSnap(DEFAULT_MESH_EDITOR_SETTINGS.translateSnap);
    this.app.service.setRotateSnap(DEFAULT_MESH_EDITOR_SETTINGS.rotateSnap);
    for (const binding of this.getColorSettingBindings()) {
      binding.apply(DEFAULT_MESH_EDITOR_SETTINGS[binding.key]);
    }

    this.syncSettingsUI();
    this.app.updatePanelButtonStates();
    this.saveSettingsToStorage();
    this.setSettingsInlineFeedback('settingsFooterFeedback', 'Editing settings reset to defaults.', 'info');
  }

  public resetAISettingsToDefaults(): void {
    const defaultImageProviders = createDefaultImageGeneratorProviders();
    for (const [id, prov] of Object.entries(defaultImageProviders)) {
      this.app.service.externalImageGenerator.updateProvider(id as any, prov);
    }
    this.app.service.externalImageGenerator.setActiveBackend(
      DEFAULT_AI_AGENT_CONFIG.imageGeneratorEnabled
        ? ((DEFAULT_AI_AGENT_CONFIG.imageGeneratorActiveBackend as any) || 'pollinations')
        : 'procedural'
    );

    this.app.service.aiAgent.saveConfig({
      ...DEFAULT_AI_AGENT_CONFIG,
      neural3DProviders: createDefaultNeural3DProviders(),
      imageGeneratorProviders: defaultImageProviders,
      skillStates: {},
      toolStates: {},
    });
    this.app.service.aiAgent.reloadSkills();
    this.app.renderAISkills();
    this.app.renderAIToolSet();
    this.syncAISettingsControlsUI?.();
    this.app.refreshAIEndpointBadge();

    const settingsStatus = this.app.getElement<HTMLElement>('aiSettingsStatus');
    if (settingsStatus) settingsStatus.textContent = 'Defaults restored';
    this.setSettingsInlineFeedback('aiEndpointFeedback', '', 'info');
    this.setSettingsInlineFeedback('aiImageGenTestResult', '', 'info');
    for (const id of ['trellis', 'hunyuan3d', 'hi3d']) {
      this.setSettingsInlineFeedback(`aiNeuralTestResult_${id}`, '', 'info');
    }
    this.setSettingsInlineFeedback('settingsFooterFeedback', 'AI settings reset to defaults.', 'info');
  }

  public switchSettingsTab(tab: 'editing' | 'ai'): void {
    this.activeSettingsTab = tab;
    const modal = this.app.getElement<HTMLDialogElement>('settingsModal');
    if (!modal) return;

    const tabBtns = modal.querySelectorAll<HTMLButtonElement>('[data-settings-tab]');
    tabBtns.forEach((btn) => {
      const isTarget = btn.getAttribute('data-settings-tab') === tab;
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('tabindex', isTarget ? '0' : '-1');
      btn.toggleAttribute('focusgroupstart', isTarget);
    });

    const editingPanel = this.app.getElement<HTMLElement>('settingsTabPanelEditing');
    const aiPanel = this.app.getElement<HTMLElement>('settingsTabPanelAI');
    if (editingPanel) {
      if (tab === 'editing') editingPanel.removeAttribute('hidden');
      else editingPanel.setAttribute('hidden', 'until-found');
    }
    if (aiPanel) {
      if (tab === 'ai') aiPanel.removeAttribute('hidden');
      else aiPanel.setAttribute('hidden', 'until-found');
    }

    const modalBody = this.app.getElement<HTMLElement>('settingsModalBody');
    if (modalBody) modalBody.scrollTop = 0;

    if (tab === 'ai') {
      this.app.service.aiAgent.reloadSkills();
      this.app.renderAISkills();
      this.app.renderAIToolSet();
      this.syncAISettingsControlsUI?.();

      const modelSelect = this.app.getElement<HTMLSelectElement>('aiModelSelect');
      if (modelSelect && modelSelect.options.length <= 1) {
        this.app.service.aiAgent
          .fetchAvailableModels()
          .then((models) => {
            if (this.app.isDisposed) return;
            if (models.length > 0) {
              const current = this.app.service.aiAgent.getConfig().model;
              const unique = Array.from(new Set([current, ...models].filter(Boolean)));
              modelSelect.innerHTML = unique
                .map((m) => `<option value="${this.app.escapeHtml(m)}">${this.app.escapeHtml(m)}</option>`)
                .join('');
              modelSelect.value = current;
            }
          })
          .catch(() => {});
      }
    }
  }

  public openSettingsModal(tab?: 'editing' | 'ai', options?: {
      endpointFeedback?: {
        message: string;
        type?: 'info' | 'success' | 'warning' | 'error';
      };
    }): void {
    this.app.closeAllDropdowns();
    this.setSettingsInlineFeedback('settingsFooterFeedback', '', 'info');
    if (tab) {
      this.switchSettingsTab(tab);
    } else if (this.activeSettingsTab === 'ai') {
      this.app.service.aiAgent.reloadSkills();
      this.app.renderAISkills();
    }
    this.syncSettingsUI();

    const settingsStatus = this.app.getElement<HTMLElement>('aiSettingsStatus');
    if (options?.endpointFeedback?.message) {
      const feedbackType = options.endpointFeedback.type ?? 'error';
      this.setSettingsInlineFeedback('aiEndpointFeedback', options.endpointFeedback.message, feedbackType);
      if (settingsStatus && feedbackType === 'error') {
        settingsStatus.textContent = 'Request failed';
      }
      const modalBody = this.app.getElement<HTMLElement>('settingsModalBody');
      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    }

    const settingsModal = this.app.getElement<HTMLDialogElement>('settingsModal');
    if (!settingsModal) return;

    if (typeof settingsModal.showModal === 'function') {
      try {
        if (!settingsModal.open) {
          settingsModal.showModal();
        }
      } catch {
        settingsModal.setAttribute('open', '');
      }
    } else {
      settingsModal.setAttribute('open', '');
    }
  }

  public closeSettingsModal(): void {
    const settingsModal = this.app.getElement<HTMLDialogElement>('settingsModal');
    if (!settingsModal) return;

    if (typeof settingsModal.close === 'function') {
      try {
        if (settingsModal.open) {
          settingsModal.close();
        }
      } catch {
        settingsModal.removeAttribute('open');
      }
    } else {
      settingsModal.removeAttribute('open');
    }
  }

  public initSettingsUI(): void {
    const settingsModal = this.app.getElement<HTMLDialogElement>('settingsModal');
    this.app.getElement('btnSettings')?.addEventListener('click', () => this.openSettingsModal());
    this.app.getElement('btnCloseSettings')?.addEventListener('click', () => this.closeSettingsModal());
    this.app.getElement('btnSettingsDone')?.addEventListener('click', () => this.closeSettingsModal());
    this.app.getElement('btnResetSettings')?.addEventListener('click', () => this.resetSettingsToDefaults());

    if (settingsModal) {
      settingsModal.addEventListener('close', () => {
        settingsModal.returnValue = '';
      });

      const tabList = settingsModal.querySelector<HTMLElement>('.settings-tabs');
      const tabBtns = Array.from(settingsModal.querySelectorAll<HTMLButtonElement>('[data-settings-tab]'));
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-settings-tab') as 'editing' | 'ai' | null;
          if (target) this.switchSettingsTab(target);
        });
      });

      tabList?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (tabBtns.length < 2) return;
        const currentIdx = tabBtns.findIndex((b) => b === document.activeElement);
        if (currentIdx === -1) return;
        let nextIdx = -1;
        if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % tabBtns.length;
        else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabBtns.length - 1;
        if (nextIdx >= 0) {
          e.preventDefault();
          const nextBtn = tabBtns[nextIdx];
          const target = nextBtn.getAttribute('data-settings-tab') as 'editing' | 'ai' | null;
          nextBtn.focus();
          if (target) this.switchSettingsTab(target);
        }
      });

      this.app.getElement('settingsTabPanelEditing')?.addEventListener('beforematch', () => {
        this.switchSettingsTab('editing');
      });
      this.app.getElement('settingsTabPanelAI')?.addEventListener('beforematch', () => {
        this.switchSettingsTab('ai');
      });

      // Fallback light-dismiss for browsers without native closedby support
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
        const isOutside = (e: PointerEvent) => {
          const rect = settingsModal.getBoundingClientRect();
          return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
        };
        let pressedOutside = false;
        settingsModal.addEventListener('pointerdown', (e) => {
          pressedOutside = isOutside(e);
        });
        settingsModal.addEventListener('pointerup', (e) => {
          if (pressedOutside && isOutside(e)) {
            this.closeSettingsModal();
          }
        });
      }
    }

    const gridToggle = this.app.getElement<HTMLInputElement>('settingGridVisible');
    if (gridToggle) {
      if (typeof HTMLInputElement !== 'undefined' && !('switch' in HTMLInputElement.prototype)) {
        gridToggle.setAttribute('role', 'switch');
      }
      gridToggle.addEventListener('change', () => {
        this.app.service.setGridVisible(gridToggle.checked);
        this.app.updatePanelButtonStates();
        this.saveSettingsToStorage();
      });
    }

    const gridFillTransparentToggle = this.app.getElement<HTMLInputElement>('settingGridFillTransparent');
    if (gridFillTransparentToggle) {
      if (typeof HTMLInputElement !== 'undefined' && !('switch' in HTMLInputElement.prototype)) {
        gridFillTransparentToggle.setAttribute('role', 'switch');
      }
      gridFillTransparentToggle.addEventListener('change', () => {
        this.app.service.setGridFillTransparent(gridFillTransparentToggle.checked);
        this.syncGridFillTransparencyState();
        this.saveSettingsToStorage();
      });
    }

    for (const binding of this.getNumericSettingBindings()) {
      const rangeEl = this.app.getElement<HTMLInputElement>(binding.rangeId);
      const numEl = this.app.getElement<HTMLInputElement>(binding.numId);

      if (rangeEl) {
        rangeEl.addEventListener('input', () => {
          const val = this.clampSettingValue(Number(rangeEl.value), binding.min, binding.max, binding.decimals);
          binding.apply(val);
          if (numEl) numEl.value = String(val);
          this.syncSliderVisual(rangeEl, val, binding.unit);
          this.saveSettingsToStorage();
        });
      }

      if (numEl) {
        numEl.addEventListener('input', () => {
          const parsed = Number(numEl.value);
          if (!Number.isFinite(parsed) || numEl.value.trim() === '') return;
          const clamped = this.clampSettingValue(parsed, binding.min, binding.max, Math.max(binding.decimals, 3));
          binding.apply(clamped);
          if (rangeEl) {
            rangeEl.value = String(clamped);
            this.syncSliderVisual(rangeEl, clamped, binding.unit);
          }
          this.saveSettingsToStorage();
        });

        numEl.addEventListener('change', () => {
          const parsed = Number(numEl.value);
          const fallback = this.app.service.sceneParams[binding.key];
          const clamped = Number.isFinite(parsed)
            ? this.clampSettingValue(parsed, binding.min, binding.max, Math.max(binding.decimals, 3))
            : fallback;
          binding.apply(clamped);
          numEl.value = String(clamped);
          if (rangeEl) {
            rangeEl.value = String(clamped);
            this.syncSliderVisual(rangeEl, clamped, binding.unit);
          }
          this.saveSettingsToStorage();
        });
      }
    }

    for (const binding of this.getColorSettingBindings()) {
      const colorEl = this.app.getElement<HTMLInputElement>(binding.inputId);
      const hexEl = this.app.getElement<HTMLElement>(binding.hexId);
      if (!colorEl) continue;

      const applyAndPersistColor = () => {
        binding.apply(colorEl.value);
        const normalized = this.app.service.sceneParams[binding.key];
        if (colorEl.value.toLowerCase() !== normalized.toLowerCase()) {
          colorEl.value = normalized;
        }
        if (hexEl) {
          hexEl.textContent = normalized.toUpperCase();
        }
        this.saveSettingsToStorage();
      };

      colorEl.addEventListener('input', applyAndPersistColor);
      colorEl.addEventListener('change', applyAndPersistColor);
    }

    this.initAISettingsUI();
    this.syncSettingsUI();
  }

  public initAISettingsUI(): void {
    const providerPresetSelect = this.app.getElement<HTMLSelectElement>('aiProviderPresetSelect');
    const protocolSelect = this.app.getElement<HTMLSelectElement>('aiProtocolSelect');
    const protocolAuthBadge = this.app.getElement<HTMLElement>('aiProtocolAuthBadge');
    const protocolHintText = this.app.getElement<HTMLElement>('aiProtocolHintText');
    const apiKeyReqBadge = this.app.getElement<HTMLElement>('aiApiKeyRequirementBadge');
    const protocolOptionsContainer = this.app.getElement<HTMLElement>('aiProtocolOptionsContainer');
    const anthropicCachingCheck = this.app.getElement<HTMLInputElement>('aiAnthropicCachingCheck');
    const anthropicMaxTokensInput = this.app.getElement<HTMLInputElement>('aiAnthropicMaxTokensInput');
    const ollamaNumCtxSelect = this.app.getElement<HTMLSelectElement>('aiOllamaNumCtxSelect');
    const azureApiVersionInput = this.app.getElement<HTMLInputElement>('aiAzureApiVersionInput');
    const reasoningEffortSelect = this.app.getElement<HTMLSelectElement>('aiReasoningEffortSelect');
    const responsesMaxTokensInput = this.app.getElement<HTMLInputElement>('aiResponsesMaxTokensInput');
    const endpointInput = this.app.getElement<HTMLInputElement>('aiEndpointUrlInput');
    const apiKeyInput = this.app.getElement<HTMLInputElement>('aiApiKeyInput');
    const modelInput = this.app.getElement<HTMLInputElement>('aiModelInput');
    const modelSelect = this.app.getElement<HTMLSelectElement>('aiModelSelect');
    const btnToggleCustomModel = this.app.getElement<HTMLButtonElement>('btnToggleCustomModel');
    const btnFetchModels = this.app.getElement<HTMLButtonElement>('btnFetchAIModels');
    const modelDatalist = this.app.getElement<HTMLDataListElement>('aiModelDatalist');
    const settingsStatus = this.app.getElement<HTMLElement>('aiSettingsStatus');
    const minPolyInput = this.app.getElement<HTMLInputElement>('aiMinPolyInput');
    const minPolyVal = this.app.getElement<HTMLElement>('aiMinPolyVal');
    const maxPolyInput = this.app.getElement<HTMLInputElement>('aiMaxPolyInput');
    const maxPolyVal = this.app.getElement<HTMLElement>('aiMaxPolyVal');
    const maxIterationsInput = this.app.getElement<HTMLInputElement>('aiMaxIterationsInput');
    const maxIterationsVal = this.app.getElement<HTMLElement>('aiMaxIterationsVal');
    const createTexturesCheck = this.app.getElement<HTMLInputElement>('aiCreateTexturesCheck');
    const createTexturesCheckQuick = this.app.getElement<HTMLInputElement>('aiCreateTexturesCheckQuick');
    const createNormalMapsCheck = this.app.getElement<HTMLInputElement>('aiCreateNormalMapsCheck');
    const createNormalMapsCheckQuick = this.app.getElement<HTMLInputElement>('aiCreateNormalMapsCheckQuick');
    const visualCritiqueCheck = this.app.getElement<HTMLInputElement>('aiVisualCritiqueCheck');
    const visualCritiqueCheckQuick = this.app.getElement<HTMLInputElement>('aiVisualCritiqueCheckQuick');
    const checkZFightingCheck = this.app.getElement<HTMLInputElement>('aiCheckZFightingCheck');
    const checkZFightingCheckQuick = this.app.getElement<HTMLInputElement>('aiCheckZFightingCheckQuick');
    const btnToolsCorePreset = this.app.getElement<HTMLButtonElement>('btnAIToolsCorePreset');
    const btnToolsAllPreset = this.app.getElement<HTMLButtonElement>('btnAIToolsAllPreset');
    const promptSuffixInput = this.app.getElement<HTMLTextAreaElement>('aiPromptSuffixInput');

    const populateModelSelect = (models: string[], selectedModel?: string) => {
      if (!modelSelect) return;
      const targetModel = selectedModel || modelInput?.value || this.app.service.aiAgent.getConfig().model;
      const existing = Array.from(modelSelect.options).map((o) => o.value);
      const combined = Array.from(new Set([...models, ...existing, targetModel].filter(Boolean)));
      modelSelect.innerHTML = combined
        .map((m) => `<option value="${this.app.escapeHtml(m)}">${this.app.escapeHtml(m)}</option>`)
        .join('');
      if (targetModel) {
        modelSelect.value = targetModel;
      }
      if (modelInput) {
        modelInput.value = modelSelect.value || targetModel || '';
      }
    };

    const neuralProviderIds: Neural3DBackendId[] = ['trellis', 'hunyuan3d', 'hi3d'];
    const readNeuralProvidersFromDOM = (fallbackToPreset: boolean = true): Neural3DProvidersMap => {
      const currentMap = this.app.service.aiAgent.getNeural3DProviders();
      for (const id of neuralProviderIds) {
        const enableEl = this.app.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
        const protoEl = this.app.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
        const modelEl = this.app.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
        const urlEl = this.app.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
        const keyEl = this.app.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);

        const protocol = (protoEl?.value || currentMap[id].protocol) as Neural3DProtocol;
        const preset = NEURAL_3D_PROTOCOL_DEFAULTS[id][protocol] || NEURAL_3D_PROTOCOL_DEFAULTS[id].omlx;
        const rawModel = modelEl ? modelEl.value.trim() : currentMap[id].modelId;
        const rawUrl = urlEl ? urlEl.value.trim() : currentMap[id].endpointUrl;
        currentMap[id] = {
          ...currentMap[id],
          enabled: enableEl ? !!enableEl.checked : currentMap[id].enabled,
          protocol,
          modelId: rawModel || (fallbackToPreset ? preset.modelId : ''),
          endpointUrl: rawUrl || (fallbackToPreset ? preset.endpointUrl : ''),
          apiKey: keyEl ? keyEl.value.trim() : currentMap[id].apiKey,
        };
      }
      return currentMap;
    };

    const syncNeuralProvidersUI = () => {
      const providers = this.app.service.aiAgent.getNeural3DProviders();
      for (const id of neuralProviderIds) {
        const p = providers[id];
        const enableEl = this.app.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
        const bodyEl = this.app.getElement<HTMLElement>(`aiNeuralConfigBody_${id}`);
        const protoEl = this.app.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
        const modelEl = this.app.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
        const urlEl = this.app.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
        const keyEl = this.app.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);

        if (enableEl) enableEl.checked = !!p.enabled;
        if (bodyEl) bodyEl.style.display = p.enabled ? 'flex' : 'none';
        if (protoEl) protoEl.value = p.protocol;
        if (modelEl) modelEl.value = p.modelId || '';
        if (urlEl) urlEl.value = p.endpointUrl || '';
        if (keyEl) keyEl.value = p.apiKey || '';
      }
    };

    // External Image Generator bindings (AI Textures)
    const imgGenEnableEl = this.app.getElement<HTMLInputElement>('aiImageGenEnabled');
    const imgGenBodyEl = this.app.getElement<HTMLElement>('aiImageGenConfigBody');
    const imgGenBackendEl = this.app.getElement<HTMLSelectElement>('aiImageGenBackendSelect');
    const imgGenModelEl = this.app.getElement<HTMLInputElement>('aiImageGenModel');
    const imgGenUrlEl = this.app.getElement<HTMLInputElement>('aiImageGenUrl');
    const imgGenKeyEl = this.app.getElement<HTMLInputElement>('aiImageGenKey');
    const testImgGenBtn = this.app.getElement<HTMLButtonElement>('btnTestImageGenGlobal');

    const syncImageGenUI = () => {
      const imgGenService = this.app.service.externalImageGenerator;
      const cfg = this.app.service.aiAgent.getConfig();
      const isEnabled = !!cfg.imageGeneratorEnabled;
      const currentActive = imgGenService.getActiveBackend();
      const savedBackend = cfg.imageGeneratorActiveBackend;
      const targetBackend = (
        savedBackend && savedBackend !== 'procedural'
          ? savedBackend
          : currentActive && currentActive !== 'procedural'
            ? currentActive
            : 'pollinations'
      ) as any;
      const provider =
        cfg.imageGeneratorProviders?.[targetBackend as keyof typeof cfg.imageGeneratorProviders] ||
        imgGenService.getProvider(targetBackend);

      if (imgGenEnableEl) imgGenEnableEl.checked = isEnabled;
      if (imgGenBodyEl) imgGenBodyEl.style.display = isEnabled ? 'flex' : 'none';
      if (imgGenBackendEl) imgGenBackendEl.value = targetBackend;
      if (imgGenModelEl) imgGenModelEl.value = provider?.modelId || '';
      if (imgGenUrlEl) imgGenUrlEl.value = provider?.endpointUrl || '';
      if (imgGenKeyEl) imgGenKeyEl.value = provider?.apiKey || '';
    };
    this.app.syncAIAgentImageGenUI = syncImageGenUI;

    const saveImageGenFromDOM = () => {
      const isEnabled = !!imgGenEnableEl?.checked;
      const backend = (imgGenBackendEl?.value || 'pollinations') as any;
      this.app.service.externalImageGenerator.updateProvider(backend, {
        modelId: imgGenModelEl?.value.trim(),
        endpointUrl: imgGenUrlEl?.value.trim(),
        apiKey: imgGenKeyEl?.value.trim(),
      });
      this.app.service.externalImageGenerator.setActiveBackend(isEnabled ? backend : 'procedural');
      this.app.service.aiAgent.saveConfig({
        imageGeneratorEnabled: isEnabled,
        imageGeneratorActiveBackend: backend,
        imageGeneratorProviders: this.app.service.externalImageGenerator.getProviders(),
      });
    };

    const readProtocolOverridesFromDOM = () => {
      const protocol = (protocolSelect?.value || resolveProtocol(this.app.service.aiAgent.getConfig())) as AIAgentProtocol;
      const baseUrl = endpointInput?.value.trim() || '';
      const apiKey = apiKeyInput?.value.trim() || '';
      const isCustomVisible = !!modelInput && modelInput.style.display !== 'none';
      const model =
        (isCustomVisible ? modelInput?.value.trim() : modelSelect?.value.trim()) ||
        modelInput?.value.trim() ||
        '';
      const maxTokensRaw =
        protocol === 'anthropic'
          ? Number(anthropicMaxTokensInput?.value)
          : protocol === 'openai_responses'
            ? Number(responsesMaxTokensInput?.value)
            : NaN;
      return {
        protocol,
        baseUrl,
        apiKey,
        model,
        promptCaching: anthropicCachingCheck ? !!anthropicCachingCheck.checked : undefined,
        maxTokens: Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : undefined,
        ollamaNumCtx: ollamaNumCtxSelect ? Number(ollamaNumCtxSelect.value) || DEFAULT_OLLAMA_NUM_CTX : undefined,
        azureApiVersion: azureApiVersionInput ? azureApiVersionInput.value.trim() : undefined,
        reasoningEffort: (reasoningEffortSelect?.value || '') as AIAgentReasoningEffort,
      };
    };

    const syncProtocolAndPresetUI = () => {
      const cfg = this.app.service.aiAgent.getConfig();
      const protocol = resolveProtocol(cfg);
      const info = AI_PROTOCOL_INFO[protocol];
      const matchedPreset = findMatchingPreset(cfg);

      if (protocolSelect) protocolSelect.value = protocol;
      if (providerPresetSelect) {
        providerPresetSelect.value = matchedPreset?.id || '';
      }

      // Highlight matching quick-pick chip
      this.app.getElement('aiPresetChips')
        ?.querySelectorAll<HTMLElement>('[data-preset]')
        .forEach((chip) => {
          const id = chip.getAttribute('data-preset');
          chip.classList.toggle('active', !!matchedPreset && id === matchedPreset.id);
        });

      // Dynamic protocol guide callout & auth badge
      if (protocolAuthBadge) {
        protocolAuthBadge.textContent = info.authSummary;
      }
      if (protocolHintText) {
        protocolHintText.textContent = matchedPreset?.description || info.description;
      }

      // Dynamic placeholders & key requirement badge
      if (endpointInput) endpointInput.placeholder = info.urlPlaceholder;
      if (apiKeyInput) apiKeyInput.placeholder = info.keyPlaceholder;
      if (modelInput) modelInput.placeholder = info.modelPlaceholder;
      if (btnFetchModels) {
        btnFetchModels.title = `Load available models from endpoint (${info.modelsPathLabel})`;
      }

      const lowerUrl = (cfg.baseUrl || '').toLowerCase();
      const isLocalEndpoint =
        lowerUrl.includes('/api/antigravity') ||
        lowerUrl.includes('localhost') ||
        lowerUrl.includes('127.0.0.1') ||
        protocol === 'ollama_native';
      const keyRequired = matchedPreset ? matchedPreset.requiresKey : !isLocalEndpoint;
      if (apiKeyReqBadge) {
        apiKeyReqBadge.textContent = keyRequired ? 'Required' : 'Optional (local / bridge)';
        apiKeyReqBadge.classList.toggle('is-required', keyRequired);
      }

      // Contextual protocol-specific options panel
      const protocolPanels: AIAgentProtocol[] = [
        'anthropic',
        'ollama_native',
        'azure_openai',
        'openai_responses',
      ];
      let hasVisiblePanel = false;
      for (const pId of protocolPanels) {
        const panel = this.app.getElement<HTMLElement>(`aiProtocolOpts_${pId}`);
        const isVisible = pId === protocol;
        if (panel) {
          panel.style.display = isVisible ? 'flex' : 'none';
        }
        if (isVisible) hasVisiblePanel = true;
      }
      if (protocolOptionsContainer) {
        protocolOptionsContainer.style.display = hasVisiblePanel ? 'block' : 'none';
      }

      if (anthropicCachingCheck) {
        anthropicCachingCheck.checked = cfg.promptCaching !== false;
      }
      if (anthropicMaxTokensInput) {
        anthropicMaxTokensInput.value = String(cfg.maxTokens || DEFAULT_ANTHROPIC_MAX_TOKENS);
      }
      if (ollamaNumCtxSelect) {
        const ctxVal = String(cfg.ollamaNumCtx || DEFAULT_OLLAMA_NUM_CTX);
        if (!Array.from(ollamaNumCtxSelect.options).some((o) => o.value === ctxVal)) {
          const opt = document.createElement('option');
          opt.value = ctxVal;
          opt.textContent = `${Number(ctxVal).toLocaleString()} tokens`;
          ollamaNumCtxSelect.appendChild(opt);
        }
        ollamaNumCtxSelect.value = ctxVal;
      }
      if (azureApiVersionInput) {
        azureApiVersionInput.value = cfg.azureApiVersion ?? DEFAULT_AZURE_API_VERSION;
      }
      if (reasoningEffortSelect) {
        reasoningEffortSelect.value = cfg.reasoningEffort || '';
      }
      if (responsesMaxTokensInput) {
        responsesMaxTokensInput.value =
          protocol === 'openai_responses' && cfg.maxTokens && cfg.maxTokens !== DEFAULT_ANTHROPIC_MAX_TOKENS
            ? String(cfg.maxTokens)
            : '';
      }
    };

    const syncAllAIControls = () => {
      const cfg = this.app.service.aiAgent.getConfig();
      if (endpointInput) endpointInput.value = cfg.baseUrl;
      if (apiKeyInput) apiKeyInput.value = cfg.apiKey;
      if (modelInput) modelInput.value = cfg.model;
      populateModelSelect([], cfg.model);
      syncProtocolAndPresetUI();

      const minPolys = cfg.minPolygons ?? 200;
      const maxPolys = Math.min(500000, cfg.maxPolygons ?? 25000);
      if (minPolyInput) {
        minPolyInput.value = String(minPolys);
        this.syncSliderVisual(minPolyInput, minPolys, 'polys');
      }
      if (minPolyVal) minPolyVal.textContent = minPolys.toLocaleString();
      if (maxPolyInput) {
        maxPolyInput.value = String(maxPolys);
        this.syncSliderVisual(maxPolyInput, maxPolys, 'polys');
      }
      if (maxPolyVal) maxPolyVal.textContent = maxPolys.toLocaleString();

      const maxIter = Math.max(1, Math.min(25, cfg.maxIterations ?? DEFAULT_AI_AGENT_CONFIG.maxIterations ?? 6));
      if (maxIterationsInput) {
        maxIterationsInput.value = String(maxIter);
        this.syncSliderVisual(maxIterationsInput, maxIter, 'steps');
      }
      if (maxIterationsVal) maxIterationsVal.textContent = String(maxIter);

      const texturesOn = cfg.createTextures !== false;
      if (createTexturesCheck) createTexturesCheck.checked = texturesOn;
      if (createTexturesCheckQuick) createTexturesCheckQuick.checked = texturesOn;

      const normalMapsOn = cfg.createNormalMaps !== false;
      if (createNormalMapsCheck) createNormalMapsCheck.checked = normalMapsOn;
      if (createNormalMapsCheckQuick) createNormalMapsCheckQuick.checked = normalMapsOn;

      const critiqueOn = !!cfg.visualCritique;
      if (visualCritiqueCheck) visualCritiqueCheck.checked = critiqueOn;
      if (visualCritiqueCheckQuick) visualCritiqueCheckQuick.checked = critiqueOn;

      const zFightOn = !!cfg.checkZFighting;
      if (checkZFightingCheck) checkZFightingCheck.checked = zFightOn;
      if (checkZFightingCheckQuick) checkZFightingCheckQuick.checked = zFightOn;

      if (promptSuffixInput) promptSuffixInput.value = cfg.promptSuffix || '';

      syncNeuralProvidersUI();
      syncImageGenUI();
    };
    this.syncAISettingsControlsUI = syncAllAIControls;

    // Protocol selector & contextual protocol options
    protocolSelect?.addEventListener('change', () => {
      const nextProto = (protocolSelect.value || 'openai') as AIAgentProtocol;
      this.app.service.aiAgent.saveConfig({ protocol: nextProto });
      syncProtocolAndPresetUI();
      this.app.refreshAIEndpointBadge();
      const info = AI_PROTOCOL_INFO[nextProto];
      if (settingsStatus) settingsStatus.textContent = `Protocol: ${info.shortBadge}`;
      this.setSettingsInlineFeedback(
        'aiEndpointFeedback',
        `Switched API protocol to ${info.label}.`,
        'info'
      );
    });

    anthropicCachingCheck?.addEventListener('change', () => {
      this.app.service.aiAgent.saveConfig({ promptCaching: !!anthropicCachingCheck.checked });
    });

    anthropicMaxTokensInput?.addEventListener('change', () => {
      const parsed = Math.max(256, Math.min(64000, Number(anthropicMaxTokensInput.value) || DEFAULT_ANTHROPIC_MAX_TOKENS));
      anthropicMaxTokensInput.value = String(parsed);
      this.app.service.aiAgent.saveConfig({ maxTokens: parsed });
    });

    ollamaNumCtxSelect?.addEventListener('change', () => {
      const parsed = Math.max(2048, Number(ollamaNumCtxSelect.value) || DEFAULT_OLLAMA_NUM_CTX);
      this.app.service.aiAgent.saveConfig({ ollamaNumCtx: parsed });
    });

    azureApiVersionInput?.addEventListener('input', () => {
      this.app.service.aiAgent.saveConfig({ azureApiVersion: azureApiVersionInput.value.trim() });
    });
    azureApiVersionInput?.addEventListener('change', () => {
      this.app.service.aiAgent.saveConfig({ azureApiVersion: azureApiVersionInput.value.trim() });
    });

    reasoningEffortSelect?.addEventListener('change', () => {
      this.app.service.aiAgent.saveConfig({
        reasoningEffort: (reasoningEffortSelect.value || '') as AIAgentReasoningEffort,
      });
    });

    responsesMaxTokensInput?.addEventListener('change', () => {
      const raw = responsesMaxTokensInput.value.trim();
      if (!raw) {
        this.app.service.aiAgent.saveConfig({ maxTokens: undefined });
      } else {
        const parsed = Math.max(256, Math.min(64000, Number(raw) || DEFAULT_ANTHROPIC_MAX_TOKENS));
        responsesMaxTokensInput.value = String(parsed);
        this.app.service.aiAgent.saveConfig({ maxTokens: parsed });
      }
    });

    // Endpoint inputs (persist immediately to localStorage)
    endpointInput?.addEventListener('input', () => {
      const val = endpointInput.value.trim();
      if (!val) return;
      this.app.service.aiAgent.saveConfig({ baseUrl: val });
      syncProtocolAndPresetUI();
      this.app.refreshAIEndpointBadge();
    });
    endpointInput?.addEventListener('change', () => {
      const val = endpointInput.value.trim() || DEFAULT_AI_AGENT_CONFIG.baseUrl;
      endpointInput.value = val;
      this.app.service.aiAgent.saveConfig({ baseUrl: val });
      syncProtocolAndPresetUI();
      this.app.refreshAIEndpointBadge();
    });

    apiKeyInput?.addEventListener('input', () => {
      this.app.service.aiAgent.saveConfig({ apiKey: apiKeyInput.value.trim() });
      this.app.refreshAIEndpointBadge();
    });
    apiKeyInput?.addEventListener('change', () => {
      this.app.service.aiAgent.saveConfig({ apiKey: apiKeyInput.value.trim() });
      this.app.refreshAIEndpointBadge();
    });

    promptSuffixInput?.addEventListener('input', () => {
      this.app.service.aiAgent.saveConfig({ promptSuffix: promptSuffixInput.value });
    });
    promptSuffixInput?.addEventListener('change', () => {
      const trimmed = promptSuffixInput.value.trim();
      promptSuffixInput.value = trimmed;
      this.app.service.aiAgent.saveConfig({ promptSuffix: trimmed });
    });

    modelSelect?.addEventListener('change', () => {
      if (modelInput) modelInput.value = modelSelect.value;
      this.app.service.aiAgent.saveConfig({ model: modelSelect.value });
      this.app.refreshAIEndpointBadge();
    });

    modelInput?.addEventListener('input', () => {
      const val = modelInput.value.trim();
      if (!val) return;
      populateModelSelect([val], val);
      this.app.service.aiAgent.saveConfig({ model: val });
      this.app.refreshAIEndpointBadge();
    });
    modelInput?.addEventListener('change', () => {
      const val = modelInput.value.trim() || DEFAULT_AI_AGENT_CONFIG.model;
      modelInput.value = val;
      populateModelSelect([val], val);
      this.app.service.aiAgent.saveConfig({ model: val });
      this.app.refreshAIEndpointBadge();
    });

    btnToggleCustomModel?.addEventListener('click', () => {
      if (!modelInput || !modelSelect) return;
      const isCustomVisible = modelInput.style.display !== 'none';
      if (isCustomVisible) {
        modelInput.style.display = 'none';
        modelSelect.style.display = 'inline-block';
        btnToggleCustomModel.textContent = 'Custom ID...';
        if (modelSelect.value) {
          modelInput.value = modelSelect.value;
          this.app.service.aiAgent.saveConfig({ model: modelSelect.value });
          this.app.refreshAIEndpointBadge();
        }
      } else {
        modelInput.style.display = 'inline-block';
        modelSelect.style.display = 'none';
        btnToggleCustomModel.textContent = 'Select...';
        modelInput.focus();
      }
    });

    // Polygon budget sliders & preset chips (persist immediately to localStorage)
    const persistPolyBudget = () => {
      const minVal = minPolyInput ? Math.max(50, Number(minPolyInput.value) || 200) : 200;
      const maxVal = maxPolyInput ? Math.max(minVal, Number(maxPolyInput.value) || 25000) : 25000;
      if (minPolyVal) minPolyVal.textContent = minVal.toLocaleString();
      if (maxPolyVal) maxPolyVal.textContent = maxVal.toLocaleString();
      if (minPolyInput) this.syncSliderVisual(minPolyInput, minVal, 'polys');
      if (maxPolyInput) this.syncSliderVisual(maxPolyInput, maxVal, 'polys');
      this.app.service.aiAgent.saveConfig({ minPolygons: minVal, maxPolygons: maxVal });
      this.app.refreshAIEndpointBadge();
    };

    minPolyInput?.addEventListener('input', () => {
      const val = Number(minPolyInput.value);
      if (maxPolyInput && Number(maxPolyInput.value) < val) {
        maxPolyInput.value = String(val);
      }
      persistPolyBudget();
    });

    maxPolyInput?.addEventListener('input', () => {
      const val = Number(maxPolyInput.value);
      if (minPolyInput && Number(minPolyInput.value) > val) {
        minPolyInput.value = String(val);
      }
      persistPolyBudget();
    });

    this.app.getElement('aiMaxPolyChips')
      ?.querySelectorAll<HTMLButtonElement>('[data-poly]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const poly = btn.getAttribute('data-poly');
          if (poly && maxPolyInput) {
            maxPolyInput.value = poly;
            maxPolyInput.dispatchEvent(new Event('input'));
          }
        });
      });

    maxIterationsInput?.addEventListener('input', () => {
      const val = Math.max(1, Math.min(25, Math.round(Number(maxIterationsInput.value) || 6)));
      if (maxIterationsVal) maxIterationsVal.textContent = String(val);
      this.syncSliderVisual(maxIterationsInput, val, 'steps');
      this.app.service.aiAgent.saveConfig({ maxIterations: val });
    });

    this.app.getElement('aiMaxIterationsChips')
      ?.querySelectorAll<HTMLButtonElement>('[data-iterations]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const iter = btn.getAttribute('data-iterations');
          if (iter && maxIterationsInput) {
            maxIterationsInput.value = iter;
            maxIterationsInput.dispatchEvent(new Event('input'));
          }
        });
      });

    // Texture, Normal Map, Visual Critique checkboxes (synced with quick checkboxes & persisted)
    createTexturesCheck?.addEventListener('change', () => {
      const enabled = !!createTexturesCheck.checked;
      if (createTexturesCheckQuick) createTexturesCheckQuick.checked = enabled;
      this.app.service.aiAgent.saveConfig({ createTextures: enabled });
      this.app.refreshAIEndpointBadge();
    });

    createNormalMapsCheck?.addEventListener('change', () => {
      const enabled = !!createNormalMapsCheck.checked;
      if (createNormalMapsCheckQuick) createNormalMapsCheckQuick.checked = enabled;
      this.app.service.aiAgent.saveConfig({ createNormalMaps: enabled });
      this.app.refreshAIEndpointBadge();
    });

    visualCritiqueCheck?.addEventListener('change', () => {
      const enabled = !!visualCritiqueCheck.checked;
      if (visualCritiqueCheckQuick) visualCritiqueCheckQuick.checked = enabled;
      this.app.service.aiAgent.saveConfig({ visualCritique: enabled });
      this.app.refreshAIEndpointBadge();
    });

    checkZFightingCheck?.addEventListener('change', () => {
      const enabled = !!checkZFightingCheck.checked;
      if (checkZFightingCheckQuick) checkZFightingCheckQuick.checked = enabled;
      this.app.service.aiAgent.saveConfig({ checkZFighting: enabled });
      this.app.refreshAIEndpointBadge();
    });

    btnToolsCorePreset?.addEventListener('click', () => {
      this.app.service.aiAgent.setToolPreset('core');
      this.app.renderAIToolSet();
    });

    btnToolsAllPreset?.addEventListener('click', () => {
      this.app.service.aiAgent.setToolPreset('all');
      this.app.renderAIToolSet();
    });

    // Neural 3D Generators (TRELLIS 2, Hunyuan3D, Hi3D)
    for (const id of neuralProviderIds) {
      const enableEl = this.app.getElement<HTMLInputElement>(`aiNeuralEnabled_${id}`);
      const bodyEl = this.app.getElement<HTMLElement>(`aiNeuralConfigBody_${id}`);
      const protoEl = this.app.getElement<HTMLSelectElement>(`aiNeuralProtocol_${id}`);
      const modelEl = this.app.getElement<HTMLInputElement>(`aiNeuralModel_${id}`);
      const urlEl = this.app.getElement<HTMLInputElement>(`aiNeuralUrl_${id}`);
      const keyEl = this.app.getElement<HTMLInputElement>(`aiNeuralKey_${id}`);
      const testBtn = this.app.getElement<HTMLButtonElement>(`btnTestNeural_${id}`);

      enableEl?.addEventListener('change', () => {
        const enabled = !!enableEl.checked;
        if (bodyEl) bodyEl.style.display = enabled ? 'flex' : 'none';
        this.app.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        this.app.refreshAIEndpointBadge();
      });

      protoEl?.addEventListener('change', () => {
        const newProto = (protoEl.value || 'omlx') as Neural3DProtocol;
        const preset = NEURAL_3D_PROTOCOL_DEFAULTS[id][newProto];
        if (preset) {
          if (urlEl) urlEl.value = preset.endpointUrl;
          if (modelEl) modelEl.value = preset.modelId;
        }
        this.app.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        this.app.refreshAIEndpointBadge();
      });

      const onFieldInput = () => {
        this.app.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM(false) });
        this.app.refreshAIEndpointBadge();
      };
      const onFieldChange = () => {
        this.app.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM(true) });
        syncNeuralProvidersUI();
        this.app.refreshAIEndpointBadge();
      };
      modelEl?.addEventListener('input', onFieldInput);
      urlEl?.addEventListener('input', onFieldInput);
      keyEl?.addEventListener('input', onFieldInput);
      modelEl?.addEventListener('change', onFieldChange);
      urlEl?.addEventListener('change', onFieldChange);
      keyEl?.addEventListener('change', onFieldChange);

      testBtn?.addEventListener('click', async () => {
        this.app.service.aiAgent.saveConfig({ neural3DProviders: readNeuralProvidersFromDOM() });
        if (testBtn) testBtn.disabled = true;
        this.setSettingsInlineFeedback(`aiNeuralTestResult_${id}`, 'Testing connection...', 'info');
        try {
          const res = await this.app.service.aiAgent.testNeural3DProvider(id);
          this.setSettingsInlineFeedback(`aiNeuralTestResult_${id}`, res.message, res.ok ? 'success' : 'warning');
        } catch (err: any) {
          this.setSettingsInlineFeedback(
            `aiNeuralTestResult_${id}`,
            err?.message || 'Connection test failed.',
            'error'
          );
        } finally {
          if (testBtn) testBtn.disabled = false;
        }
      });
    }

    // External Image Generator bindings
    imgGenEnableEl?.addEventListener('change', () => {
      const isEnabled = !!imgGenEnableEl.checked;
      if (imgGenBodyEl) imgGenBodyEl.style.display = isEnabled ? 'flex' : 'none';
      saveImageGenFromDOM();
    });

    imgGenBackendEl?.addEventListener('change', () => {
      const backend = (imgGenBackendEl.value || 'pollinations') as any;
      const provider = this.app.service.externalImageGenerator.getProvider(backend);
      if (imgGenModelEl) imgGenModelEl.value = provider.modelId || '';
      if (imgGenUrlEl) imgGenUrlEl.value = provider.endpointUrl || '';
      if (imgGenKeyEl) imgGenKeyEl.value = provider.apiKey || '';
      this.setSettingsInlineFeedback('aiImageGenTestResult', '', 'info');
      saveImageGenFromDOM();
    });

    imgGenModelEl?.addEventListener('input', saveImageGenFromDOM);
    imgGenUrlEl?.addEventListener('input', saveImageGenFromDOM);
    imgGenKeyEl?.addEventListener('input', saveImageGenFromDOM);
    imgGenModelEl?.addEventListener('change', saveImageGenFromDOM);
    imgGenUrlEl?.addEventListener('change', saveImageGenFromDOM);
    imgGenKeyEl?.addEventListener('change', saveImageGenFromDOM);

    testImgGenBtn?.addEventListener('click', async () => {
      saveImageGenFromDOM();
      const backend = (imgGenBackendEl?.value || 'pollinations') as any;
      if (testImgGenBtn) testImgGenBtn.disabled = true;
      this.setSettingsInlineFeedback('aiImageGenTestResult', 'Testing generator endpoint...', 'info');
      try {
        const res = await this.app.service.externalImageGenerator.testProvider(backend);
        this.setSettingsInlineFeedback('aiImageGenTestResult', res.message, res.ok ? 'success' : 'warning');
      } catch (err: any) {
        this.setSettingsInlineFeedback(
          'aiImageGenTestResult',
          err?.message || 'Generator connection test failed.',
          'error'
        );
      } finally {
        if (testImgGenBtn) testImgGenBtn.disabled = false;
      }
    });

    // Shared preset applier for Quick Preset chips & All Provider Presets select
    const applyEndpointPreset = (presetId: string) => {
      const preset = AI_ENDPOINT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      if (endpointInput) endpointInput.value = preset.baseUrl;
      if (modelInput) modelInput.value = preset.defaultModel;
      const suggested = Array.from(
        new Set([preset.defaultModel, ...(preset.suggestedModels || [])].filter(Boolean))
      );
      populateModelSelect(suggested, preset.defaultModel);

      this.app.service.aiAgent.saveConfig({
        protocol: preset.protocol,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
        ...(preset.maxTokens !== undefined ? { maxTokens: preset.maxTokens } : {}),
        ...(preset.promptCaching !== undefined ? { promptCaching: preset.promptCaching } : {}),
        ...(preset.ollamaNumCtx !== undefined ? { ollamaNumCtx: preset.ollamaNumCtx } : {}),
        ...(preset.azureApiVersion !== undefined ? { azureApiVersion: preset.azureApiVersion } : {}),
        ...(preset.reasoningEffort !== undefined ? { reasoningEffort: preset.reasoningEffort } : {}),
      });

      syncProtocolAndPresetUI();
      this.app.refreshAIEndpointBadge();
      const protoBadge = AI_PROTOCOL_INFO[preset.protocol]?.shortBadge || preset.protocol;
      if (settingsStatus) settingsStatus.textContent = `Preset: ${preset.shortLabel || preset.label}`;
      this.setSettingsInlineFeedback(
        'aiEndpointFeedback',
        `Switched to ${preset.label} [${protoBadge}] (${preset.defaultModel}).`,
        'info'
      );

      // Auto-discover models for local bridges & local Ollama
      if (
        preset.baseUrl.includes('antigravity') ||
        preset.baseUrl.includes('localhost:8787') ||
        preset.baseUrl.includes('localhost:8788') ||
        preset.protocol === 'ollama_native'
      ) {
        this.app.service.aiAgent
          .fetchAvailableModels({ protocol: preset.protocol, baseUrl: preset.baseUrl })
          .then((models) => {
            if (models.length > 0) {
              populateModelSelect(models, preset.defaultModel);
            }
          })
          .catch(() => {});
      }
    };

    // Quick preset chips
    this.app.getElement('aiPresetChips')
      ?.querySelectorAll('[data-preset]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const presetId = (btn as HTMLElement).getAttribute('data-preset');
          if (presetId) applyEndpointPreset(presetId);
        });
      });

    // Categorized "All Provider Presets" dropdown
    providerPresetSelect?.addEventListener('change', () => {
      const presetId = providerPresetSelect.value;
      if (presetId) {
        applyEndpointPreset(presetId);
      }
    });

    // Toggle API key visibility
    const btnToggleApiKeyVis = this.app.getElement<HTMLButtonElement>('btnToggleApiKeyVis');
    btnToggleApiKeyVis?.addEventListener('click', () => {
      this.app.toggleApiKeyVisibility(apiKeyInput, btnToggleApiKeyVis);
    });

    // Fetch available models from protocol-specific discovery endpoint (/models, /v1/models, /v1beta/models, /api/tags)
    btnFetchModels?.addEventListener('click', async () => {
      const overrides = readProtocolOverridesFromDOM();
      const info = AI_PROTOCOL_INFO[overrides.protocol];
      if (btnFetchModels) btnFetchModels.disabled = true;
      if (settingsStatus) settingsStatus.textContent = 'Fetching models...';
      this.setSettingsInlineFeedback(
        'aiEndpointFeedback',
        `Fetching available models from ${info.modelsPathLabel}...`,
        'info'
      );
      try {
        const models = await this.app.service.aiAgent.fetchAvailableModels(overrides);
        populateModelSelect(models);
        if (modelDatalist) {
          modelDatalist.innerHTML = models.map((m) => `<option value="${m}"></option>`).join('');
        }
        if (settingsStatus) settingsStatus.textContent = `${models.length} models loaded`;
        this.setSettingsInlineFeedback('aiEndpointFeedback', `Loaded ${models.length} models from endpoint.`, 'success');
      } catch (err: any) {
        if (settingsStatus) settingsStatus.textContent = 'Model fetch failed';
        this.setSettingsInlineFeedback(
          'aiEndpointFeedback',
          err?.message || 'Failed to fetch models from endpoint.',
          'warning'
        );
      } finally {
        if (btnFetchModels) btnFetchModels.disabled = false;
      }
    });

    // Test endpoint connection & model across any active protocol
    const btnTestEndpoint = this.app.getElement<HTMLButtonElement>('btnTestAIEndpoint');
    btnTestEndpoint?.addEventListener('click', async () => {
      const overrides = readProtocolOverridesFromDOM();
      const info = AI_PROTOCOL_INFO[overrides.protocol];

      if (btnTestEndpoint) btnTestEndpoint.disabled = true;
      if (settingsStatus) settingsStatus.textContent = 'Testing...';
      this.setSettingsInlineFeedback(
        'aiEndpointFeedback',
        `Testing ${info.shortBadge} endpoint connection...`,
        'info'
      );
      try {
        const res = await this.app.service.aiAgent.testEndpointConnection(overrides);
        if (settingsStatus) {
          settingsStatus.textContent = res.ok ? 'Connected' : 'Test failed';
        }
        this.setSettingsInlineFeedback(
          'aiEndpointFeedback',
          res.message,
          res.ok ? 'success' : 'error'
        );
      } catch (err: any) {
        if (settingsStatus) settingsStatus.textContent = 'Test failed';
        this.setSettingsInlineFeedback(
          'aiEndpointFeedback',
          err?.message || 'Endpoint connection test failed.',
          'error'
        );
      } finally {
        if (btnTestEndpoint) btnTestEndpoint.disabled = false;
      }
    });

    syncAllAIControls();
    this.app.renderAISkills();
    this.app.renderAIToolSet();
    this.app.refreshAIEndpointBadge();

    // Refresh dynamic skills from local dev server/bridge if available
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      this.app.service.aiAgent.fetchSkillsFromApi().then(() => {
        if (!this.app.isDisposed) {
          this.app.renderAISkills();
        }
      });
    }
  }
}
