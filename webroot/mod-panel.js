import { disconnectRealtime, connectRealtime } from '@devvit/realtime/client';
import { exitExpandedMode, getWebViewMode, navigateTo, showToast as devvitShowToast } from '@devvit/web/client';

(function () {
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const mainContent = document.getElementById('main-content');
  const tabPanels = {
    pending: document.getElementById('tab-pending'),
    blocked: document.getElementById('tab-blocked'),
    history: document.getElementById('tab-history'),
    settings: document.getElementById('tab-settings'),
    templates: document.getElementById('tab-templates'),
    themes: document.getElementById('tab-themes'),
  };

  const heroMeta = document.getElementById('hero-meta');
  const pendingList = document.getElementById('pending-list');
  const pendingSearchUserInput = document.getElementById('pending-search-user');
  const pendingSlaButtons = Array.from(document.querySelectorAll('.pending-sla-btn'));
  const historyViewButtons = Array.from(document.querySelectorAll('.history-view-btn'));
  const historyPanelRecords = document.getElementById('history-panel-records');
  const historyPanelApproved = document.getElementById('history-panel-approved');
  const historyPanelAudit = document.getElementById('history-panel-audit');
  const historySearchUserInput = document.getElementById('history-search-user');
  const historySearchHint = document.getElementById('history-search-hint');
  const historySearchFromInput = document.getElementById('history-search-from');
  const historySearchToInput = document.getElementById('history-search-to');
  const historySearchBtn = document.getElementById('history-search-btn');
  const historyClearBtn = document.getElementById('history-clear-btn');
  const historySearchResults = document.getElementById('history-search-results');
  const historyLoadMoreBtn = document.getElementById('history-load-more-btn');
  const approvedSearchUserInput = document.getElementById('approved-search-user');
  const approvedSearchFromInput = document.getElementById('approved-search-from');
  const approvedSearchToInput = document.getElementById('approved-search-to');
  const approvedSearchHint = document.getElementById('approved-search-hint');
  const approvedSearchBtn = document.getElementById('approved-search-btn');
  const approvedClearBtn = document.getElementById('approved-clear-btn');
  const approvedSearchResults = document.getElementById('approved-search-results');
  const approvedLoadMoreBtn = document.getElementById('approved-load-more-btn');
  const auditSearchUserInput = document.getElementById('audit-search-user');
  const auditSearchActorInput = document.getElementById('audit-search-actor');
  const auditSearchHint = document.getElementById('audit-search-hint');
  const auditActionButtons = Array.from(document.querySelectorAll('.audit-action-btn'));
  const auditSearchFromInput = document.getElementById('audit-search-from');
  const auditSearchToInput = document.getElementById('audit-search-to');
  const auditSearchBtn = document.getElementById('audit-search-btn');
  const auditClearBtn = document.getElementById('audit-clear-btn');
  const auditSearchResults = document.getElementById('audit-search-results');
  const auditLoadMoreBtn = document.getElementById('audit-load-more-btn');
  const blockedList = document.getElementById('blocked-list');
  const blockedSearchInput = document.getElementById('blocked-search');
  const storageMeterFill = document.getElementById('storage-meter-fill');
  const storagePercent = document.getElementById('storage-percent');
  const storageSummary = document.getElementById('storage-summary');
  const storageBreakdown = document.getElementById('storage-breakdown');
  const toastEl = document.getElementById('toast');

  const backToHubBtn = document.getElementById('back-to-hub-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const blockUserBtn = document.getElementById('block-user-btn');
  const saveFlairBtn = document.getElementById('save-flair-btn');
  const saveTemplatesBtn = document.getElementById('save-templates-btn');
  const saveThemeBtn = document.getElementById('save-theme-btn');
  const resetThemeBtn = document.getElementById('reset-theme-btn');

  const flairTemplateInput = document.getElementById('flair-template-id');
  const flairCssClassInput = document.getElementById('flair-css-class');
  const verificationsEnabledInput = document.getElementById('verifications-enabled');
  const requiredPhotoCountInput = document.getElementById('required-photo-count');

  const pendingTurnaroundDaysInput = document.getElementById('pending-turnaround-days');
  const modmailSubjectInput = document.getElementById('modmail-subject');
  const pendingBodyInput = document.getElementById('pending-body');
  const approveHeaderInput = document.getElementById('approve-header');
  const approveBodyInput = document.getElementById('approve-body');
  const denyHeaderInput = document.getElementById('deny-header');
  const denyBodyPhotoshopInput = document.getElementById('deny-body-photoshop');
  const denyBodyUnclearInput = document.getElementById('deny-body-unclear');
  const denyBodyInstructionsInput = document.getElementById('deny-body-instructions');
  const denyBodyOtherInput = document.getElementById('deny-body-other');
  const removeHeaderInput = document.getElementById('remove-header');
  const removeBodyInput = document.getElementById('remove-body');
  const themePresetList = document.getElementById('theme-preset-list');
  const useCustomColorsInput = document.getElementById('use-custom-colors');
  const customPrimaryInput = document.getElementById('custom-primary');
  const customPrimaryHexInput = document.getElementById('custom-primary-hex');
  const customAccentInput = document.getElementById('custom-accent');
  const customAccentHexInput = document.getElementById('custom-accent-hex');
  const customBackgroundInput = document.getElementById('custom-background');
  const customBackgroundHexInput = document.getElementById('custom-background-hex');
  const themePreview = document.getElementById('theme-preview');

  const imageModal = document.getElementById('image-modal');
  const imagePreview = document.getElementById('image-preview');
  const imageClose = document.getElementById('image-close');
  const blockModal = document.getElementById('block-modal');
  const blockUsernameInput = document.getElementById('block-username-input');
  const blockCancelBtn = document.getElementById('block-cancel-btn');
  const blockConfirmBtn = document.getElementById('block-confirm-btn');

  let state = null;
  let stateInitialized = false;
  let readyRetries = 0;
  let readyTimerId = 0;
  let isBusy = false;
  let pendingUsernameFilter = '';
  let selectedPendingSlaFilter = 'all';
  let activeHistoryView = 'records';
  let selectedThemePreset = 'coastal_light';
  let historySearchItems = [];
  let historySearchOffset = 0;
  let historySearchHasMore = false;
  let approvedSearchItems = [];
  let approvedSearchOffset = 0;
  let approvedSearchHasMore = false;
  let auditSearchItems = [];
  let auditSearchOffset = 0;
  let auditSearchHasMore = false;
  let historySearchDebounceId = 0;
  let approvedSearchDebounceId = 0;
  let auditSearchDebounceId = 0;
  let historySearchRequestId = 0;
  let approvedSearchRequestId = 0;
  let auditSearchRequestId = 0;
  let selectedAuditActionFilter = 'all';
  let realtimeChannel = '';
  let realtimeConnectedChannel = '';
  let realtimeReconnectTimerId = 0;
  let realtimeRefreshInFlight = false;
  let realtimeRefreshQueued = false;
  const queryParams = new URLSearchParams(window.location.search);
  const themeSubredditScope = (queryParams.get('subredditId') || 'default').trim().toLowerCase() || 'default';
  const THEME_SNAPSHOT_KEY = `nsfw-verify-theme-snapshot-v1:${themeSubredditScope}`;
  const prefersDarkMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function isDarkMode() {
    return Boolean(prefersDarkMedia && prefersDarkMedia.matches);
  }

  function normalizeThemePalette(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (value.light && value.dark) {
      return value;
    }
    return { light: value, dark: value };
  }

  function themeTokensForMode(value) {
    const palette = normalizeThemePalette(value);
    if (!palette) {
      return null;
    }
    return isDarkMode() ? palette.dark : palette.light;
  }

  function themeLightTokens(value) {
    const palette = normalizeThemePalette(value);
    return palette ? palette.light : null;
  }

  function persistThemeSnapshot(value) {
    try {
      const palette = normalizeThemePalette(value);
      if (!palette) {
        return;
      }
      window.localStorage.setItem(THEME_SNAPSHOT_KEY, JSON.stringify(palette));
    } catch (_error) {
      // Best-effort optimization for first-paint theme sync.
    }
  }

  async function requestJson(path, body) {
    const response = await fetch(path, body === undefined ? undefined : {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload.error === 'string' && payload.error ? payload.error : `Request failed: ${response.status}`);
    }
    return payload;
  }

  function applyApiState(payload) {
    syncRealtimeSubscription(payload && typeof payload.realtimeChannel === 'string' ? payload.realtimeChannel : '');
    if (payload && payload.state) {
      handleMessage({ type: 'state', payload: payload.state });
    } else {
      setBusy(false);
    }
    if (payload && payload.toast) {
      handleMessage({ type: 'toast', payload: payload.toast });
    }
  }

  function scheduleRealtimeReconnect(channel) {
    if (!channel || channel !== realtimeChannel || realtimeReconnectTimerId) {
      return;
    }
    realtimeReconnectTimerId = window.setTimeout(() => {
      realtimeReconnectTimerId = 0;
      if (channel === realtimeChannel && realtimeConnectedChannel !== channel) {
        connectToRealtimeChannel(channel);
      }
    }, 1500);
  }

  function closeRealtimeSubscription() {
    if (realtimeReconnectTimerId) {
      window.clearTimeout(realtimeReconnectTimerId);
      realtimeReconnectTimerId = 0;
    }
    const connectedChannel = realtimeConnectedChannel;
    realtimeChannel = '';
    realtimeConnectedChannel = '';
    if (connectedChannel) {
      disconnectRealtime(connectedChannel);
    }
  }

  function connectToRealtimeChannel(channel) {
    if (!channel || realtimeConnectedChannel === channel) {
      return;
    }
    try {
      connectRealtime({
        channel,
        onConnect(connectedChannel) {
          realtimeConnectedChannel = connectedChannel;
        },
        onDisconnect(disconnectedChannel) {
          if (disconnectedChannel === realtimeConnectedChannel) {
            realtimeConnectedChannel = '';
          }
          if (disconnectedChannel === realtimeChannel) {
            scheduleRealtimeReconnect(disconnectedChannel);
          }
        },
        onMessage(message) {
          if (!message || typeof message !== 'object' || message.type !== 'refresh') {
            return;
          }
          void refreshFromRealtimeSignal();
        },
      });
      realtimeConnectedChannel = channel;
    } catch (error) {
      console.log(`Realtime subscribe failed: ${error instanceof Error ? error.message : String(error)}`);
      scheduleRealtimeReconnect(channel);
    }
  }

  function syncRealtimeSubscription(nextChannel) {
    const normalized = String(nextChannel || '').trim();
    if (!normalized) {
      closeRealtimeSubscription();
      return;
    }
    if (realtimeReconnectTimerId) {
      window.clearTimeout(realtimeReconnectTimerId);
      realtimeReconnectTimerId = 0;
    }
    if (normalized === realtimeChannel && realtimeConnectedChannel === normalized) {
      return;
    }
    const previousChannel = realtimeConnectedChannel;
    realtimeChannel = normalized;
    realtimeConnectedChannel = '';
    if (previousChannel) {
      disconnectRealtime(previousChannel);
    }
    connectToRealtimeChannel(normalized);
  }

  async function refreshFromRealtimeSignal() {
    if (!realtimeChannel) {
      return;
    }
    if (isBusy) {
      realtimeRefreshQueued = true;
      return;
    }
    if (realtimeRefreshInFlight) {
      realtimeRefreshQueued = true;
      return;
    }
    realtimeRefreshInFlight = true;
    try {
      applyApiState(await requestJson('/api/mod/state'));
    } catch (error) {
      console.log(`Realtime refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      realtimeRefreshInFlight = false;
      if (realtimeRefreshQueued && !isBusy) {
        realtimeRefreshQueued = false;
        void refreshFromRealtimeSignal();
      }
    }
  }

  function stringInputValue(input) {
    return input ? String(input.value ?? '') : '';
  }

  function boolInputValue(input) {
    return Boolean(input && input.checked);
  }

  function capturePendingReviewDrafts() {
    const drafts = [];
    for (const card of document.querySelectorAll('[data-pending-id]')) {
      const verificationId = String(card.getAttribute('data-pending-id') || '');
      if (!verificationId) {
        continue;
      }
      const denyReason = card.querySelector('select.field-select');
      const denyNotes = card.querySelector('textarea.field-textarea');
      const reason = denyReason ? String(denyReason.value || '') : '';
      const notes = denyNotes ? String(denyNotes.value || '') : '';
      if (!reason && !notes.trim()) {
        continue;
      }
      drafts.push({ verificationId, reason, notes });
    }
    return drafts;
  }

  function captureSettingsDraft() {
    if (!state) {
      return null;
    }
    const draft = {
      flairTemplateId: stringInputValue(flairTemplateInput),
      flairCssClass: stringInputValue(flairCssClassInput),
      verificationsEnabled: boolInputValue(verificationsEnabledInput),
      requiredPhotoCount: stringInputValue(requiredPhotoCountInput),
    };
    const savedRequiredPhotoCount = `${Number(state.config.requiredPhotoCount || 2)}`;
    const dirty =
      draft.flairTemplateId !== String(state.config.flairTemplateId || '') ||
      draft.flairCssClass !== String(state.config.flairCssClass || '') ||
      draft.verificationsEnabled !== (state.config.verificationsEnabled !== false) ||
      draft.requiredPhotoCount !== savedRequiredPhotoCount;
    return dirty ? draft : null;
  }

  function captureTemplatesDraft() {
    if (!state) {
      return null;
    }
    const draft = {
      pendingTurnaroundDays: stringInputValue(pendingTurnaroundDaysInput),
      modmailSubject: stringInputValue(modmailSubjectInput),
      pendingBody: stringInputValue(pendingBodyInput),
      approveHeader: stringInputValue(approveHeaderInput),
      approveBody: stringInputValue(approveBodyInput),
      denyHeader: stringInputValue(denyHeaderInput),
      denyBodyPhotoshop: stringInputValue(denyBodyPhotoshopInput),
      denyBodyUnclear: stringInputValue(denyBodyUnclearInput),
      denyBodyInstructions: stringInputValue(denyBodyInstructionsInput),
      denyBodyOther: stringInputValue(denyBodyOtherInput),
      removeHeader: stringInputValue(removeHeaderInput),
      removeBody: stringInputValue(removeBodyInput),
    };
    const dirty =
      draft.pendingTurnaroundDays !== `${state.config.pendingTurnaroundDays ?? ''}` ||
      draft.modmailSubject !== String(state.config.modmailSubject || '') ||
      draft.pendingBody !== String(state.config.pendingBody || '') ||
      draft.approveHeader !== String(state.config.approveHeader || '') ||
      draft.approveBody !== String(state.config.approveBody || '') ||
      draft.denyHeader !== String(state.config.denyHeader || '') ||
      draft.denyBodyPhotoshop !== String(state.config.denyBodyPhotoshop || '') ||
      draft.denyBodyUnclear !== String(state.config.denyBodyUnclear || '') ||
      draft.denyBodyInstructions !== String(state.config.denyBodyInstructions || '') ||
      draft.denyBodyOther !== String(state.config.denyBodyOther || '') ||
      draft.removeHeader !== String(state.config.removeHeader || '') ||
      draft.removeBody !== String(state.config.removeBody || '');
    return dirty ? draft : null;
  }

  function captureThemeDraft() {
    if (!state) {
      return null;
    }
    const presetTheme = state.themePresets[selectedThemePreset] || state.resolvedTheme;
    const lightTheme = themeLightTokens(presetTheme);
    const fallbackPrimary = (lightTheme ? normalizeHex(lightTheme.primary) : null) || '#0e91b6';
    const fallbackAccent = (lightTheme ? normalizeHex(lightTheme.accent) : null) || '#ff7a45';
    const fallbackBackground = (lightTheme ? normalizeHex(lightTheme.bg) : null) || '#f3fbff';
    const draft = {
      selectedThemePreset,
      useCustomColors: boolInputValue(useCustomColorsInput),
      customPrimary: stringInputValue(customPrimaryInput),
      customPrimaryHex: stringInputValue(customPrimaryHexInput),
      customAccent: stringInputValue(customAccentInput),
      customAccentHex: stringInputValue(customAccentHexInput),
      customBackground: stringInputValue(customBackgroundInput),
      customBackgroundHex: stringInputValue(customBackgroundHexInput),
    };
    const savedThemePreset = String(state.config.themePreset || 'coastal_light');
    const savedUseCustomColors = state.config.useCustomColors === true;
    const savedPrimary = savedUseCustomColors
      ? normalizeHex(state.config.customPrimary || '') || fallbackPrimary
      : fallbackPrimary;
    const savedAccent = savedUseCustomColors
      ? normalizeHex(state.config.customAccent || '') || fallbackAccent
      : fallbackAccent;
    const savedBackground = savedUseCustomColors
      ? normalizeHex(state.config.customBackground || '') || fallbackBackground
      : fallbackBackground;
    const dirty =
      draft.selectedThemePreset !== savedThemePreset ||
      draft.useCustomColors !== savedUseCustomColors ||
      draft.customPrimary !== savedPrimary ||
      draft.customPrimaryHex !== savedPrimary ||
      draft.customAccent !== savedAccent ||
      draft.customAccentHex !== savedAccent ||
      draft.customBackground !== savedBackground ||
      draft.customBackgroundHex !== savedBackground;
    return dirty ? draft : null;
  }

  function captureUiDrafts() {
    return {
      pendingReviewDrafts: capturePendingReviewDrafts(),
      settings: captureSettingsDraft(),
      templates: captureTemplatesDraft(),
      theme: captureThemeDraft(),
    };
  }

  function restorePendingReviewDrafts(drafts) {
    for (const draft of Array.isArray(drafts) ? drafts : []) {
      const verificationId = String(draft && draft.verificationId ? draft.verificationId : '');
      if (!verificationId) {
        continue;
      }
      const card = document.querySelector(`[data-pending-id="${CSS.escape(verificationId)}"]`);
      if (!card) {
        continue;
      }
      const denyReason = card.querySelector('select.field-select');
      const denyNotes = card.querySelector('textarea.field-textarea');
      if (denyReason && typeof draft.reason === 'string') {
        denyReason.value = draft.reason;
      }
      if (denyNotes && typeof draft.notes === 'string') {
        denyNotes.value = draft.notes;
      }
    }
  }

  function restoreSettingsDraft(draft) {
    if (!draft) {
      return;
    }
    if (flairTemplateInput) {
      flairTemplateInput.value = draft.flairTemplateId;
    }
    if (flairCssClassInput) {
      flairCssClassInput.value = draft.flairCssClass;
    }
    if (verificationsEnabledInput) {
      verificationsEnabledInput.checked = draft.verificationsEnabled;
    }
    if (requiredPhotoCountInput) {
      requiredPhotoCountInput.value = draft.requiredPhotoCount;
    }
  }

  function restoreTemplatesDraft(draft) {
    if (!draft) {
      return;
    }
    if (pendingTurnaroundDaysInput) {
      pendingTurnaroundDaysInput.value = draft.pendingTurnaroundDays;
    }
    if (modmailSubjectInput) {
      modmailSubjectInput.value = draft.modmailSubject;
    }
    if (pendingBodyInput) {
      pendingBodyInput.value = draft.pendingBody;
    }
    if (approveHeaderInput) approveHeaderInput.value = draft.approveHeader;
    if (approveBodyInput) approveBodyInput.value = draft.approveBody;
    if (denyHeaderInput) denyHeaderInput.value = draft.denyHeader;
    if (denyBodyPhotoshopInput) denyBodyPhotoshopInput.value = draft.denyBodyPhotoshop;
    if (denyBodyUnclearInput) denyBodyUnclearInput.value = draft.denyBodyUnclear;
    if (denyBodyInstructionsInput) denyBodyInstructionsInput.value = draft.denyBodyInstructions;
    if (denyBodyOtherInput) denyBodyOtherInput.value = draft.denyBodyOther;
    if (removeHeaderInput) removeHeaderInput.value = draft.removeHeader;
    if (removeBodyInput) removeBodyInput.value = draft.removeBody;
  }

  function restoreThemeDraft(draft) {
    if (!draft) {
      return;
    }
    selectedThemePreset = draft.selectedThemePreset || selectedThemePreset;
    if (useCustomColorsInput) {
      useCustomColorsInput.checked = draft.useCustomColors;
    }
    if (customPrimaryInput) {
      customPrimaryInput.value = draft.customPrimary;
      const normalized = normalizeHex(draft.customPrimary);
      if (normalized) {
        customPrimaryInput.dataset.lastValidColor = normalized;
      }
      customPrimaryInput.disabled = !draft.useCustomColors;
    }
    if (customPrimaryHexInput) {
      customPrimaryHexInput.value = draft.customPrimaryHex;
      const normalized = normalizeHex(draft.customPrimaryHex);
      if (normalized) {
        customPrimaryHexInput.dataset.lastValidColor = normalized;
      }
      customPrimaryHexInput.disabled = !draft.useCustomColors;
    }
    if (customAccentInput) {
      customAccentInput.value = draft.customAccent;
      const normalized = normalizeHex(draft.customAccent);
      if (normalized) {
        customAccentInput.dataset.lastValidColor = normalized;
      }
      customAccentInput.disabled = !draft.useCustomColors;
    }
    if (customAccentHexInput) {
      customAccentHexInput.value = draft.customAccentHex;
      const normalized = normalizeHex(draft.customAccentHex);
      if (normalized) {
        customAccentHexInput.dataset.lastValidColor = normalized;
      }
      customAccentHexInput.disabled = !draft.useCustomColors;
    }
    if (customBackgroundInput) {
      customBackgroundInput.value = draft.customBackground;
      const normalized = normalizeHex(draft.customBackground);
      if (normalized) {
        customBackgroundInput.dataset.lastValidColor = normalized;
      }
      customBackgroundInput.disabled = !draft.useCustomColors;
    }
    if (customBackgroundHexInput) {
      customBackgroundHexInput.value = draft.customBackgroundHex;
      const normalized = normalizeHex(draft.customBackgroundHex);
      if (normalized) {
        customBackgroundHexInput.dataset.lastValidColor = normalized;
      }
      customBackgroundHexInput.disabled = !draft.useCustomColors;
    }
    renderThemePresets();
    renderThemePreview();
  }

  function restoreUiDrafts(drafts) {
    if (!drafts || typeof drafts !== 'object') {
      return;
    }
    restorePendingReviewDrafts(drafts.pendingReviewDrafts);
    restoreSettingsDraft(drafts.settings);
    restoreTemplatesDraft(drafts.templates);
    restoreThemeDraft(drafts.theme);
  }

  async function post(message) {
    try {
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'openExternalUrl') {
        const url = String(message.url || '').trim();
        if (!url) {
          throw new Error('Missing URL for navigation.');
        }
        navigateTo(url);
        setBusy(false);
        return;
      }

      if (message.type === 'openUserProfile') {
        const username = String(message.username || '').trim().replace(/^u\//i, '');
        if (!username) {
          throw new Error('Missing username for profile navigation.');
        }
        navigateTo(`https://www.reddit.com/user/${encodeURIComponent(username)}`);
        setBusy(false);
        return;
      }

      if (message.type === 'ready' || message.type === 'refresh') {
        applyApiState(await requestJson('/api/mod/state'));
        return;
      }

      if (message.type === 'approve') {
        applyApiState(await requestJson('/api/mod/approve', { verificationId: message.verificationId }));
        return;
      }

      if (message.type === 'deny') {
        applyApiState(
          await requestJson('/api/mod/deny', {
            verificationId: message.verificationId,
            reason: message.reason,
            moderatorNotes: message.moderatorNotes,
          })
        );
        return;
      }

      if (message.type === 'claimPending') {
        applyApiState(await requestJson('/api/mod/claim', { verificationId: message.verificationId }));
        return;
      }

      if (message.type === 'unclaimPending') {
        applyApiState(await requestJson('/api/mod/unclaim', { verificationId: message.verificationId }));
        return;
      }

      if (message.type === 'reopenDenied') {
        applyApiState(await requestJson('/api/mod/reopen', { verificationId: message.verificationId }));
        return;
      }

      if (message.type === 'cancelReopen') {
        applyApiState(await requestJson('/api/mod/cancel-reopen', { verificationId: message.verificationId }));
        return;
      }

      if (message.type === 'removeVerification') {
        applyApiState(
          await requestJson('/api/mod/remove', {
            verificationId: message.verificationId,
            reason: message.reason,
          })
        );
        return;
      }

      if (message.type === 'blockUser') {
        applyApiState(await requestJson('/api/mod/block', { username: message.username }));
        return;
      }

      if (message.type === 'unblockUser') {
        applyApiState(await requestJson('/api/mod/unblock', { username: message.username }));
        return;
      }

      if (message.type === 'saveFlair') {
        applyApiState(await requestJson('/api/mod/settings/flair', message));
        return;
      }

      if (message.type === 'saveTemplates') {
        applyApiState(await requestJson('/api/mod/settings/templates', message));
        return;
      }

      if (message.type === 'saveTheme') {
        applyApiState(await requestJson('/api/mod/settings/theme', message));
        return;
      }

      if (message.type === 'searchHistory') {
        handleMessage({
          type: 'historySearchResults',
          payload: {
            ...(await requestJson('/api/mod/search/history', message)),
            requestId: Number(message.requestId || 0),
          },
        });
        return;
      }

      if (message.type === 'searchApproved') {
        handleMessage({
          type: 'approvedSearchResults',
          payload: {
            ...(await requestJson('/api/mod/search/approved', message)),
            requestId: Number(message.requestId || 0),
          },
        });
        return;
      }

      if (message.type === 'searchAudit') {
        handleMessage({
          type: 'auditSearchResults',
          payload: {
            ...(await requestJson('/api/mod/search/audit', message)),
            requestId: Number(message.requestId || 0),
          },
        });
      }
    } catch (error) {
      handleMessage({
        type: 'toast',
        payload: {
          text: error instanceof Error ? error.message : String(error),
          tone: 'error',
        },
      });
    }
  }

  function setBusy(next) {
    isBusy = Boolean(next);
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      if (button.id === 'refresh-btn') {
        continue;
      }
      button.disabled = isBusy;
    }
    if (!isBusy && realtimeRefreshQueued && !realtimeRefreshInFlight) {
      realtimeRefreshQueued = false;
      void refreshFromRealtimeSignal();
    }
  }

  function postWithBusy(message) {
    setBusy(true);
    void post(message);
  }

  function showToast(text, tone) {
    devvitShowToast({
      text,
      appearance: tone === 'error' ? 'neutral' : tone === 'success' ? 'success' : 'neutral',
    });
    toastEl.textContent = text;
    toastEl.classList.remove('hidden', 'toast-success', 'toast-error');
    if (tone === 'success') {
      toastEl.classList.add('toast-success');
    } else if (tone === 'error') {
      toastEl.classList.add('toast-error');
    }
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(() => toastEl.classList.add('hidden'), 3000);
  }
  showToast.timerId = 0;

  function handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'state' && message.payload) {
      const uiDrafts = captureUiDrafts();
      state = message.payload;
      if (approvedSearchRequestId === 0 && Array.isArray(state.approved)) {
        approvedSearchItems = state.approved.slice();
        approvedSearchOffset = approvedSearchItems.length;
        approvedSearchHasMore = Boolean(state.approvedHasMore);
      }
      if (auditSearchRequestId === 0 && Array.isArray(state.auditLog)) {
        auditSearchItems = state.auditLog.slice();
        auditSearchOffset = auditSearchItems.length;
        auditSearchHasMore = Boolean(state.auditHasMore);
      }
      stateInitialized = true;
      setBusy(false);
      if (mainContent) {
        mainContent.classList.remove('hidden');
      }
      if (readyTimerId) {
        window.clearInterval(readyTimerId);
        readyTimerId = 0;
      }
      renderAll();
      restoreUiDrafts(uiDrafts);
      if (tabPanels.history && !tabPanels.history.classList.contains('hidden')) {
        if (activeHistoryView === 'records') {
          runHistoryRecordsSearchWithInputGuard(true);
        } else if (activeHistoryView === 'approved') {
          if (shouldUseSeededApprovedResults()) {
            renderApprovedSearchResults();
          } else {
            runApprovedSearchWithInputGuard(true);
          }
        } else if (activeHistoryView === 'audit') {
          if (shouldUseSeededAuditResults()) {
            renderAuditSearchResults();
          } else {
            runAuditSearchWithInputGuard(true);
          }
        }
      }
      return;
    }

    if (message.type === 'toast' && message.payload) {
      setBusy(false);
      showToast(message.payload.text || 'Action complete.', message.payload.tone || 'info');
      return;
    }

    if (message.type === 'historySearchResults' && message.payload) {
      setBusy(false);
      if (Number(message.payload.requestId || 0) !== historySearchRequestId) {
        return;
      }
      const payloadItems = Array.isArray(message.payload.items) ? message.payload.items : [];
      historySearchItems = historySearchItems.concat(payloadItems);
      historySearchOffset = Number(message.payload.offset || historySearchItems.length);
      historySearchHasMore = Boolean(message.payload.hasMore);
      renderHistorySearchResults();
      return;
    }

    if (message.type === 'approvedSearchResults' && message.payload) {
      setBusy(false);
      if (Number(message.payload.requestId || 0) !== approvedSearchRequestId) {
        return;
      }
      const payloadItems = Array.isArray(message.payload.items) ? message.payload.items : [];
      approvedSearchItems = approvedSearchItems.concat(payloadItems);
      approvedSearchOffset = Number(message.payload.offset || approvedSearchItems.length);
      approvedSearchHasMore = Boolean(message.payload.hasMore);
      renderApprovedSearchResults();
      return;
    }

    if (message.type === 'auditSearchResults' && message.payload) {
      setBusy(false);
      if (Number(message.payload.requestId || 0) !== auditSearchRequestId) {
        return;
      }
      const payloadItems = Array.isArray(message.payload.items) ? message.payload.items : [];
      auditSearchItems = auditSearchItems.concat(payloadItems);
      auditSearchOffset = Number(message.payload.offset || auditSearchItems.length);
      auditSearchHasMore = Boolean(message.payload.hasMore);
      renderAuditSearchResults();
    }
  }

  function setTab(tabName) {
    for (const [name, panel] of Object.entries(tabPanels)) {
      if (name === tabName) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }
    for (const btn of tabButtons) {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('tab-btn-active');
      } else {
        btn.classList.remove('tab-btn-active');
      }
    }
  }

  function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function applyDefaultDateRange(inputFrom, inputTo, daysBack) {
    if (!inputFrom || !inputTo) {
      return;
    }
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - daysBack);
    inputFrom.value = formatDateInputValue(from);
    inputTo.value = formatDateInputValue(now);
  }

  function setHistoryView(viewName) {
    activeHistoryView = viewName === 'approved' || viewName === 'audit' ? viewName : 'records';
    if (historyPanelRecords) {
      historyPanelRecords.classList.toggle('hidden', activeHistoryView !== 'records');
    }
    if (historyPanelApproved) {
      historyPanelApproved.classList.toggle('hidden', activeHistoryView !== 'approved');
    }
    if (historyPanelAudit) {
      historyPanelAudit.classList.toggle('hidden', activeHistoryView !== 'audit');
    }
    for (const button of historyViewButtons) {
      const isActive = String(button.dataset.historyView || 'records') === activeHistoryView;
      button.classList.toggle('btn-primary', isActive);
      button.classList.toggle('btn-secondary', !isActive);
    }
  }

  function normalizeUsernameForCompare(value) {
    return String(value || '')
      .trim()
      .replace(/^u\//i, '')
      .toLowerCase();
  }

  function isLikelyFlairTemplateId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return false;
    }
    return /\d/.test(normalized) && normalized.includes('-');
  }

  function isShortNonEmptyPrefix(value) {
    const normalized = normalizeUsernameForCompare(value);
    return normalized.length > 0 && normalized.length < 3;
  }

  function getPendingSortScore(item) {
    const score = new Date(item && item.submittedAt ? item.submittedAt : '').getTime();
    return Number.isFinite(score) ? score : 0;
  }

  function updateHeroMeta() {
    if (!state || !heroMeta) {
      return;
    }
    const pendingCount = Number.isFinite(Number(state.pendingCount))
      ? Number(state.pendingCount)
      : Array.isArray(state.pending)
        ? state.pending.length
        : 0;
    heroMeta.textContent = `r/${state.subredditName} | Pending: ${pendingCount} | Updated: ${new Date().toLocaleTimeString()}`;
  }

  function getPendingAgeHours(submittedAt) {
    const submittedMs = new Date(String(submittedAt || '')).getTime();
    if (!Number.isFinite(submittedMs)) {
      return null;
    }
    const diffMs = Math.max(0, Date.now() - submittedMs);
    return diffMs / (1000 * 60 * 60);
  }

  function getPendingSlaBucket(item) {
    const ageHours = getPendingAgeHours(item ? item.submittedAt : null);
    if (ageHours === null) {
      return 'unknown';
    }
    if (ageHours < 24) {
      return 'lt24';
    }
    if (ageHours <= 72) {
      return '24to72';
    }
    return 'gt72';
  }

  function matchesPendingFilters(item) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const normalizedUsername = normalizeUsernameForCompare(item.username);
    if (pendingUsernameFilter && !normalizedUsername.includes(pendingUsernameFilter)) {
      return false;
    }
    if (selectedPendingSlaFilter === 'all') {
      return true;
    }
    return getPendingSlaBucket(item) === selectedPendingSlaFilter;
  }

  function updatePendingSlaButtonStyles() {
    for (const button of pendingSlaButtons) {
      const isActive = String(button.dataset.sla || 'all') === selectedPendingSlaFilter;
      button.classList.toggle('btn-primary', isActive);
      button.classList.toggle('btn-secondary', !isActive);
    }
  }

  function createPendingAgeBadge(submittedAt) {
    const ageHours = getPendingAgeHours(submittedAt);
    if (ageHours === null) {
      return null;
    }
    const badge = document.createElement('span');
    badge.className = 'pending-age-badge';
    if (ageHours < 24) {
      badge.classList.add('pending-age-fresh');
      badge.textContent = '<24h';
    } else if (ageHours <= 72) {
      badge.classList.add('pending-age-warn');
      badge.textContent = '24-72h';
    } else {
      badge.classList.add('pending-age-stale');
      badge.textContent = '>72h';
    }
    badge.title = `Submitted ${Math.floor(ageHours)} hour(s) ago`;
    return badge;
  }

  function buildPendingCard(item) {
    const card = document.createElement('article');
    card.className = 'item';
    card.dataset.pendingId = String(item.id || '');
    const isReReview = Boolean(item.parentVerificationId);

    const viewerUsername = normalizeUsernameForCompare(state ? state.viewerUsername : '');
    const claimedByNormalized = normalizeUsernameForCompare(item.claimedBy);
    const isClaimed = Boolean(claimedByNormalized);
    const isClaimedByOther = isClaimed && (!viewerUsername || claimedByNormalized !== viewerUsername);

    const titleRow = document.createElement('div');
    titleRow.className = 'pending-title-row';
    titleRow.appendChild(createUsernameHeading(item.username));
    const ageBadge = createPendingAgeBadge(item.submittedAt);
    if (ageBadge) {
      titleRow.appendChild(ageBadge);
    }
    card.appendChild(titleRow);

    const submitted = document.createElement('p');
    submitted.className = 'item-meta';
    if (item.parentVerificationId) {
      const reopenedLabel = document.createElement('span');
      reopenedLabel.style.color = 'var(--accent)';
      reopenedLabel.style.fontWeight = '700';
      reopenedLabel.textContent = 'Reopened';
      submitted.appendChild(reopenedLabel);
      submitted.appendChild(document.createTextNode(`: ${formatTime(item.submittedAt)}`));
    } else {
      submitted.textContent = `Submitted: ${formatTime(item.submittedAt)}`;
    }
    card.appendChild(submitted);

    const ack = document.createElement('p');
    ack.className = 'item-meta';
    ack.textContent = `18+ acknowledged: ${formatTime(item.ageAcknowledgedAt)}`;
    card.appendChild(ack);

    if (isClaimed && !isClaimedByOther) {
      const claimMeta = document.createElement('p');
      claimMeta.className = 'item-meta';
      claimMeta.style.color = 'var(--danger)';
      claimMeta.textContent = 'Locked by you';
      card.appendChild(claimMeta);
    }

    if (isClaimedByOther) {
      const claimLockMeta = document.createElement('p');
      claimLockMeta.className = 'item-meta';
      claimLockMeta.style.color = 'var(--danger)';
      claimLockMeta.textContent = `This request is locked by u/${String(item.claimedBy || '').replace(/^u\//i, '')}`;
      card.appendChild(claimLockMeta);
    }

    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';
    const photos = [
      { url: item.photoOneUrl, label: `u/${item.username} photo 1` },
      { url: item.photoTwoUrl, label: `u/${item.username} photo 2` },
      { url: item.photoThreeUrl, label: `u/${item.username} photo 3` },
    ];
    for (const photo of photos) {
      if (typeof photo.url === 'string' && photo.url.trim()) {
        imageGrid.appendChild(createPhotoWrap(photo.url, photo.label));
      }
    }
    card.appendChild(imageGrid);

    let denyReason = null;
    let denyNotes = null;
    if (!isClaimedByOther && !isReReview) {
      denyReason = document.createElement('select');
      denyReason.className = 'field-select';
      denyReason.innerHTML = [
        '<option value="" selected>-- No denial reason selected --</option>',
        '<option value="photoshop">Photoshop</option>',
        '<option value="unclear_image">Unclear image</option>',
        '<option value="did_not_follow_instructions">Did not follow written instructions</option>',
        '<option value="other">Other</option>',
      ].join('');
      card.appendChild(denyReason);

      denyNotes = document.createElement('textarea');
      denyNotes.className = 'field-textarea';
      denyNotes.rows = 3;
      denyNotes.placeholder = 'Moderator notes for denial modmail and mod notes (required for Other)';
      card.appendChild(denyNotes);
    }

    const row = document.createElement('div');
    row.className = 'row';

    if (!isClaimedByOther) {
      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn btn-success';
      approveBtn.textContent = 'Approve';
      approveBtn.addEventListener('click', () => {
        if (denyReason && denyReason.value) {
          showToast('You selected a denial reason. Clear the denial reason before approving.', 'error');
          return;
        }
        postWithBusy({ type: 'approve', verificationId: item.id });
      });
      row.appendChild(approveBtn);

      if (!isReReview) {
        const denyBtn = document.createElement('button');
        denyBtn.className = 'btn btn-danger';
        denyBtn.textContent = 'Deny';
        denyBtn.addEventListener('click', () => {
          if (!denyReason || !denyReason.value) {
            showToast('Select a denial reason before denying.', 'error');
            return;
          }
          if (denyReason.value === 'other' && (!denyNotes || !denyNotes.value.trim())) {
            showToast('Notes are required when denial reason is Other.', 'error');
            return;
          }
          postWithBusy({
            type: 'deny',
            verificationId: item.id,
            reason: denyReason.value,
            moderatorNotes: denyNotes ? denyNotes.value : '',
          });
        });
        row.appendChild(denyBtn);
      }
    }

    if (isClaimed) {
      const unclaimBtn = document.createElement('button');
      unclaimBtn.className = 'btn btn-secondary';
      unclaimBtn.textContent = isClaimedByOther ? 'Force Unlock' : 'Unlock';
      unclaimBtn.addEventListener('click', () => {
        postWithBusy({ type: 'unclaimPending', verificationId: item.id });
      });
      row.appendChild(unclaimBtn);
    } else {
      const claimBtn = document.createElement('button');
      claimBtn.className = 'btn btn-secondary';
      claimBtn.textContent = 'Lock';
      claimBtn.addEventListener('click', () => {
        postWithBusy({ type: 'claimPending', verificationId: item.id });
      });
      row.appendChild(claimBtn);
    }

    if (item.parentVerificationId && !isClaimedByOther) {
      const cancelReopenBtn = document.createElement('button');
      cancelReopenBtn.className = 'btn btn-secondary';
      cancelReopenBtn.textContent = 'Cancel Re-review';
      cancelReopenBtn.addEventListener('click', () => {
        postWithBusy({ type: 'cancelReopen', verificationId: item.id });
      });
      row.appendChild(cancelReopenBtn);
    }

    card.appendChild(row);
    return card;
  }

  function renderPending() {
    updatePendingSlaButtonStyles();
    pendingList.innerHTML = '';
    if (!state || !Array.isArray(state.pending) || state.pending.length === 0) {
      pendingList.innerHTML = '<p class="muted">No pending verifications.</p>';
      return;
    }

    const flairTemplateId = String((state.config && state.config.flairTemplateId) || '').trim();
    if (!flairTemplateId) {
      pendingList.innerHTML =
        '<p class="muted">Set a Flair template ID in Verification Settings before processing approvals/denials. Pending items are hidden until this is configured.</p>';
      return;
    }

    const filtered = state.pending.filter(matchesPendingFilters).sort((left, right) => getPendingSortScore(left) - getPendingSortScore(right));
    if (filtered.length === 0) {
      pendingList.innerHTML = '<p class="muted">No pending verifications match your filters.</p>';
      return;
    }

    for (const item of filtered) {
      pendingList.appendChild(buildPendingCard(item));
    }
  }

  function renderBlocked() {
    if (!blockedList || !blockedSearchInput) {
      return;
    }
    blockedList.innerHTML = '';
    if (!state || !Array.isArray(state.blocked) || state.blocked.length === 0) {
      blockedList.innerHTML = '<p class="muted">No blocked users.</p>';
      return;
    }

    const query = (blockedSearchInput.value || '').trim().toLowerCase();
    const filtered = state.blocked.filter((item) => {
      const username = String(item.username || '').toLowerCase();
      const reason = String(item.reason || '').toLowerCase();
      if (!query) {
        return true;
      }
      return username.includes(query) || reason.includes(query);
    });

    if (filtered.length === 0) {
      blockedList.innerHTML = '<p class="muted">No blocked users match your search.</p>';
      return;
    }

    for (const item of filtered) {
      const card = document.createElement('article');
      card.className = 'item';

      card.appendChild(createUsernameHeading(item.username));

      const blockedAt = document.createElement('p');
      blockedAt.className = 'item-meta';
      blockedAt.textContent = `Blocked: ${formatTime(item.blockedAt)}`;
      card.appendChild(blockedAt);

      const deniedCount = document.createElement('p');
      deniedCount.className = 'item-meta';
      deniedCount.textContent =
        Number(item.deniedCount || 0) > 0 ? `Denials: ${item.deniedCount}` : 'Denials: manual block';
      card.appendChild(deniedCount);

      const reason = document.createElement('p');
      reason.className = 'item-meta';
      reason.textContent = `Reason: ${item.reason || 'Reached denial threshold.'}`;
      card.appendChild(reason);

      const row = document.createElement('div');
      row.className = 'row';

      const unblockBtn = document.createElement('button');
      unblockBtn.className = 'btn btn-secondary';
      unblockBtn.textContent = 'Remove Block';
      unblockBtn.addEventListener('click', () => {
        postWithBusy({ type: 'unblockUser', username: item.username });
      });
      row.appendChild(unblockBtn);

      card.appendChild(row);
      blockedList.appendChild(card);
    }
  }

  function renderHistorySearchResults() {
    if (!historySearchResults) {
      return;
    }
    historySearchResults.innerHTML = '';
    const isMinLengthHintVisible = Boolean(historySearchHint && !historySearchHint.classList.contains('hidden'));
    if (!Array.isArray(historySearchItems) || historySearchItems.length === 0) {
      if (!isMinLengthHintVisible) {
        historySearchResults.innerHTML = '<p class="muted">No history search results.</p>';
      }
    } else {
      for (const item of historySearchItems) {
        const card = document.createElement('article');
        card.className = 'item';
        const statusLabel =
          item.status === 'pending' && item.parentVerificationId
            ? 'PENDING RE-REVIEW'
            : String(item.status || '').toUpperCase();
        const denyReasonMeta =
          item.status === 'denied' && item.denyReason
            ? `<p class="item-meta">Reason: ${String(item.denyReason || '').replaceAll('_', ' ')}</p>`
            : '';
        const reopenedMeta =
          item.status === 'denied' && item.reopenedState && item.reopenedState !== 'none'
            ? `<p class="item-meta reopened-warning">Reopened: ${item.reopenedState === 'yes_cancelled' ? 'Yes (cancelled)' : 'Yes'}</p>`
            : '';
        card.innerHTML = `
          <h3 class="item-title">u/${item.username}</h3>
          <p class="item-meta">Status: ${statusLabel}</p>
          <p class="item-meta">Submitted: ${formatTime(item.submittedAt)}</p>
          <p class="item-meta">Reviewed: ${item.reviewedAt ? formatTime(item.reviewedAt) : 'N/A'}</p>
          <p class="item-meta">Moderator: ${item.moderator ? `u/${item.moderator}` : 'N/A'}</p>
          ${denyReasonMeta}
          ${reopenedMeta}
        `;
        if (item.status === 'denied' && !item.reopenedChildId) {
          const row = document.createElement('div');
          row.className = 'row';
          const reopenBtn = document.createElement('button');
          reopenBtn.className = 'btn btn-secondary';
          reopenBtn.textContent = 'Reopen Verification';
          reopenBtn.addEventListener('click', () => {
            postWithBusy({ type: 'reopenDenied', verificationId: item.id });
          });
          row.appendChild(reopenBtn);
          card.appendChild(row);
        }
        historySearchResults.appendChild(card);
      }
    }
    if (historyLoadMoreBtn) {
      historyLoadMoreBtn.classList.toggle('hidden', !historySearchHasMore || isMinLengthHintVisible);
    }
  }

  function renderApprovedSearchResults() {
    if (!approvedSearchResults) {
      return;
    }
    approvedSearchResults.innerHTML = '';
    const isMinLengthHintVisible = Boolean(approvedSearchHint && !approvedSearchHint.classList.contains('hidden'));
    if (!Array.isArray(approvedSearchItems) || approvedSearchItems.length === 0) {
      if (!isMinLengthHintVisible) {
        approvedSearchResults.innerHTML = '<p class="muted">No approved users found for this filter.</p>';
      }
    } else {
      for (const item of approvedSearchItems) {
        const card = document.createElement('article');
        card.className = 'item';

        card.appendChild(createUsernameHeading(item.username));

        const approved = document.createElement('p');
        approved.className = 'item-meta';
        approved.textContent = `Approved: ${formatTime(item.approvedAt)}`;
        card.appendChild(approved);

        const by = document.createElement('p');
        by.className = 'item-meta';
        by.textContent = `Approved by: u/${item.approvedBy}`;
        card.appendChild(by);

        const removeReason = document.createElement('textarea');
        removeReason.className = 'field-textarea';
        removeReason.rows = 2;
        removeReason.placeholder = 'Reason for removal (sent to user)';
        card.appendChild(removeReason);

        const row = document.createElement('div');
        row.className = 'row';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger';
        removeBtn.textContent = 'Remove Verification';
        removeBtn.addEventListener('click', () => {
          const trimmedReason = removeReason.value.trim();
          if (!trimmedReason) {
            showToast('Removal reason is required.', 'error');
            return;
          }
          postWithBusy({ type: 'removeVerification', verificationId: item.id, reason: trimmedReason });
        });
        row.appendChild(removeBtn);
        card.appendChild(row);

        approvedSearchResults.appendChild(card);
      }
    }
    if (approvedLoadMoreBtn) {
      approvedLoadMoreBtn.classList.toggle('hidden', !approvedSearchHasMore || isMinLengthHintVisible);
    }
  }

  function renderAuditSearchResults() {
    if (!auditSearchResults) {
      return;
    }
    auditSearchResults.innerHTML = '';
    const isMinLengthHintVisible = Boolean(auditSearchHint && !auditSearchHint.classList.contains('hidden'));
    if (!Array.isArray(auditSearchItems) || auditSearchItems.length === 0) {
      if (!isMinLengthHintVisible) {
        auditSearchResults.innerHTML = '<p class="muted">No audit log entries found for this filter.</p>';
      }
    } else {
      for (const item of auditSearchItems) {
        const card = document.createElement('article');
        card.className = 'item';
        card.appendChild(createUsernameHeading(item.username));

        const line = document.createElement('p');
        line.className = 'item-meta';
        line.textContent = item.line;
        card.appendChild(line);

        const actor = document.createElement('p');
        actor.className = 'item-meta';
        actor.textContent = `Actor: u/${item.actor || 'unknown'}`;
        card.appendChild(actor);

        const at = document.createElement('p');
        at.className = 'item-meta';
        at.textContent = formatTime(item.at);
        card.appendChild(at);

        auditSearchResults.appendChild(card);
      }
    }
    if (auditLoadMoreBtn) {
      auditLoadMoreBtn.classList.toggle('hidden', !auditSearchHasMore || isMinLengthHintVisible);
    }
  }

  function applyHistoryReopenPatch(payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    const deniedId = String(payload.deniedId || '');
    const reopenedChildId = String(payload.reopenedChildId || '');
    const reopenedState = String(payload.reopenedState || '');
    if (!deniedId || !reopenedChildId) {
      if (!deniedId) {
        return;
      }
    }
    let changed = false;
    historySearchItems = (Array.isArray(historySearchItems) ? historySearchItems : []).map((item) => {
      if (String(item.id || '') !== deniedId) {
        return item;
      }
      changed = true;
      return {
        ...item,
        reopenedChildId,
        reopenedState: reopenedState || (reopenedChildId ? 'yes' : item.reopenedState || 'none'),
      };
    });
    if (changed) {
      renderHistorySearchResults();
    }
  }

  function renderSettings() {
    if (!state) {
      return;
    }
    if (verificationsEnabledInput) {
      verificationsEnabledInput.checked = state.config.verificationsEnabled !== false;
    }
    flairTemplateInput.value = state.config.flairTemplateId || '';
    if (flairCssClassInput) {
      flairCssClassInput.value = state.config.flairCssClass || '';
    }
    if (requiredPhotoCountInput) {
      const count = Number(state.config.requiredPhotoCount || 2);
      requiredPhotoCountInput.value = `${count >= 1 && count <= 3 ? count : 2}`;
    }
  }

  function renderTemplates() {
    if (!state) {
      return;
    }
    if (pendingTurnaroundDaysInput) {
      pendingTurnaroundDaysInput.value = `${state.config.pendingTurnaroundDays ?? ''}`;
    }
    if (modmailSubjectInput) {
      modmailSubjectInput.value = state.config.modmailSubject || '';
    }
    if (pendingBodyInput) {
      pendingBodyInput.value = state.config.pendingBody || '';
    }
    approveHeaderInput.value = state.config.approveHeader || '';
    approveBodyInput.value = state.config.approveBody || '';
    denyHeaderInput.value = state.config.denyHeader || '';
    denyBodyPhotoshopInput.value = state.config.denyBodyPhotoshop || '';
    denyBodyUnclearInput.value = state.config.denyBodyUnclear || '';
    denyBodyInstructionsInput.value = state.config.denyBodyInstructions || '';
    denyBodyOtherInput.value = state.config.denyBodyOther || '';
    removeHeaderInput.value = state.config.removeHeader || '';
    removeBodyInput.value = state.config.removeBody || '';
  }

  function normalizeHex(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
      const expanded = raw
        .split('')
        .map((ch) => `${ch}${ch}`)
        .join('')
        .toLowerCase();
      return `#${expanded}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
      return `#${raw.toLowerCase()}`;
    }
    return null;
  }

  function normalizeThemeInputColor(input, fallbackHex) {
    if (!input) {
      return null;
    }
    const normalized = normalizeHex(input.value);
    if (normalized) {
      input.value = normalized;
      input.dataset.lastValidColor = normalized;
      return normalized;
    }
    const fallback = normalizeHex(input.dataset.lastValidColor || fallbackHex || '');
    if (fallback) {
      input.value = fallback;
      input.dataset.lastValidColor = fallback;
    }
    return null;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) {
      return null;
    }
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    };
  }

  function toHexChannel(value) {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }

  function rgbToHex(rgb) {
    if (!rgb) {
      return '#000000';
    }
    return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
  }

  function mixHex(colorA, colorB, weightA) {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);
    if (!rgbA && !rgbB) {
      return '#000000';
    }
    if (!rgbA) {
      return rgbToHex(rgbB);
    }
    if (!rgbB) {
      return rgbToHex(rgbA);
    }
    const weight = Number.isFinite(weightA) ? Math.max(0, Math.min(1, weightA)) : 0.5;
    return rgbToHex({
      r: rgbA.r * weight + rgbB.r * (1 - weight),
      g: rgbA.g * weight + rgbB.g * (1 - weight),
      b: rgbA.b * weight + rgbB.b * (1 - weight),
    });
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return 0;
    }
    const srgb = [rgb.r, rgb.g, rgb.b].map((value) => value / 255);
    const linear = srgb.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function deriveCustomThemeTokens(baseTokens, customPrimary, customAccent, customBackground, mode) {
    const primary = normalizeHex(customPrimary);
    const accent = normalizeHex(customAccent);
    const background = normalizeHex(customBackground);
    if (!primary || !accent || !background) {
      return { ...baseTokens };
    }

    const sourceLuminance = relativeLuminance(background);
    let bg = background;
    if (mode === 'dark') {
      if (sourceLuminance >= 0.55) {
        bg = mixHex(background, baseTokens.bg, 0.2);
      } else if (sourceLuminance >= 0.25) {
        bg = mixHex(background, baseTokens.bg, 0.55);
      } else {
        bg = mixHex(background, baseTokens.bg, 0.72);
      }
    } else if (sourceLuminance <= 0.24) {
      bg = mixHex(background, '#f3fbff', 0.65);
    }

    let surface = mode === 'dark' ? mixHex(bg, baseTokens.surface, 0.72) : mixHex(bg, baseTokens.surface, 0.76);
    surface = mixHex(surface, accent, 0.94);

    const borderBase = mixHex(baseTokens.border, accent, 0.65);
    const border = mode === 'dark' ? mixHex(borderBase, bg, 0.78) : mixHex(borderBase, bg, 0.7);

    const text = mode === 'dark' ? mixHex(baseTokens.text, bg, 0.92) : baseTokens.text;
    const mutedText = mode === 'dark' ? mixHex(baseTokens.mutedText, bg, 0.82) : mixHex(baseTokens.mutedText, bg, 0.86);

    return {
      ...baseTokens,
      primary,
      accent,
      bg,
      surface,
      text,
      mutedText,
      border,
    };
  }

  function deriveCustomThemePalette(presetTheme, customPrimary, customAccent, customBackground) {
    const primary = normalizeHex(customPrimary);
    const accent = normalizeHex(customAccent);
    const background = normalizeHex(customBackground);
    if (!primary || !accent || !background) {
      return presetTheme;
    }
    return {
      light: deriveCustomThemeTokens(presetTheme.light, primary, accent, background, 'light'),
      dark: deriveCustomThemeTokens(presetTheme.dark, primary, accent, background, 'dark'),
    };
  }

  function applyThemeColorInputsFromPalette(palette, disabled) {
    const lightTheme = themeLightTokens(palette);
    const fallbackPrimary = (lightTheme ? normalizeHex(lightTheme.primary) : null) || '#0e91b6';
    const fallbackAccent = (lightTheme ? normalizeHex(lightTheme.accent) : null) || '#ff7a45';
    const fallbackBackground = (lightTheme ? normalizeHex(lightTheme.bg) : null) || '#f3fbff';
    applyThemeColorControlValue(customPrimaryInput, customPrimaryHexInput, fallbackPrimary, disabled);
    applyThemeColorControlValue(customAccentInput, customAccentHexInput, fallbackAccent, disabled);
    applyThemeColorControlValue(customBackgroundInput, customBackgroundHexInput, fallbackBackground, disabled);
  }

  function readThemeColorValue(colorInput, hexInput) {
    if (hexInput && typeof hexInput.value === 'string' && hexInput.value.trim()) {
      return hexInput.value;
    }
    if (colorInput && typeof colorInput.value === 'string') {
      return colorInput.value;
    }
    return '';
  }

  function applyThemeColorControlValue(colorInput, hexInput, value, disabled) {
    if (colorInput) {
      colorInput.value = value;
      colorInput.dataset.lastValidColor = value;
      colorInput.disabled = disabled;
    }
    if (hexInput) {
      hexInput.value = value;
      hexInput.dataset.lastValidColor = value;
      hexInput.disabled = disabled;
    }
  }

  function normalizeThemeControlForSave(colorInput, hexInput, fallbackHex) {
    const sourceInput = hexInput || colorInput;
    const normalized = normalizeThemeInputColor(sourceInput, fallbackHex);
    if (normalized) {
      if (colorInput) {
        colorInput.value = normalized;
        colorInput.dataset.lastValidColor = normalized;
      }
      if (hexInput) {
        hexInput.value = normalized;
        hexInput.dataset.lastValidColor = normalized;
      }
    }
    return normalized;
  }

  function wireThemeColorControl(colorInput, hexInput, fallbackHex) {
    if (colorInput) {
      const onColorChange = () => {
        enableCustomColorsForThemeEditing();
        const normalized = normalizeThemeInputColor(colorInput, fallbackHex);
        if (normalized && hexInput) {
          hexInput.value = normalized;
          hexInput.dataset.lastValidColor = normalized;
        }
        renderThemePreview();
      };
      colorInput.addEventListener('input', onColorChange);
      colorInput.addEventListener('change', onColorChange);
    }
    if (hexInput) {
      hexInput.addEventListener('input', () => {
        enableCustomColorsForThemeEditing();
        const normalized = normalizeHex(hexInput.value);
        if (normalized) {
          hexInput.dataset.lastValidColor = normalized;
          if (colorInput) {
            colorInput.value = normalized;
            colorInput.dataset.lastValidColor = normalized;
          }
          renderThemePreview();
        }
      });
      hexInput.addEventListener('change', () => {
        enableCustomColorsForThemeEditing();
        const normalized = normalizeThemeInputColor(hexInput, fallbackHex);
        if (normalized && colorInput) {
          colorInput.value = normalized;
          colorInput.dataset.lastValidColor = normalized;
        }
        renderThemePreview();
      });
    }
  }

  function applyThemeVariables(target, tokens) {
    if (!target || !tokens) {
      return;
    }
    target.style.setProperty('--primary', tokens.primary);
    target.style.setProperty('--primary-strong', tokens.primary);
    target.style.setProperty('--accent', tokens.accent);
    target.style.setProperty('--success', tokens.success);
    target.style.setProperty('--danger', tokens.danger);
    target.style.setProperty('--bg', tokens.bg);
    target.style.setProperty('--card', tokens.surface);
    target.style.setProperty('--text', tokens.text);
    target.style.setProperty('--muted', tokens.mutedText);
    target.style.setProperty('--line-base', tokens.border);
    target.style.setProperty('--line-accent', tokens.accent);
    target.style.setProperty('--line', `color-mix(in srgb, ${tokens.border} 78%, ${tokens.accent} 22%)`);
  }

  function resolveEditedTheme() {
    if (!state || !state.themePresets) {
      return null;
    }
    const presetTheme = normalizeThemePalette(state.themePresets[selectedThemePreset] || state.resolvedTheme);
    if (!presetTheme) {
      return null;
    }
    const useCustom = useCustomColorsInput ? Boolean(useCustomColorsInput.checked) : false;
    const customPrimary = normalizeHex(readThemeColorValue(customPrimaryInput, customPrimaryHexInput));
    const customAccent = normalizeHex(readThemeColorValue(customAccentInput, customAccentHexInput));
    const customBackground = normalizeHex(readThemeColorValue(customBackgroundInput, customBackgroundHexInput));
    if (useCustom) {
      return deriveCustomThemePalette(presetTheme, customPrimary, customAccent, customBackground);
    }
    return presetTheme;
  }

  function renderThemePresets() {
    if (!themePresetList || !state || !state.themePresets) {
      return;
    }
    themePresetList.innerHTML = '';
    const presetEntries = Object.entries(state.themePresets);
    for (const [presetKey, rawTheme] of presetEntries) {
      const tokens = themeTokensForMode(rawTheme);
      if (!tokens) {
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `theme-card ${presetKey === selectedThemePreset ? 'theme-card-active' : ''}`;
      btn.dataset.preset = presetKey;
      btn.innerHTML = `
        <span class="theme-card-title">${presetKey.replaceAll('_', ' ')}</span>
        <span class="theme-swatch-row">
          <span class="theme-swatch" style="background:${tokens.primary}"></span>
          <span class="theme-swatch" style="background:${tokens.accent}"></span>
          <span class="theme-swatch" style="background:${tokens.bg}"></span>
          <span class="theme-swatch" style="background:${tokens.surface}"></span>
        </span>
      `;
      btn.addEventListener('click', () => {
        selectedThemePreset = presetKey;
        if (useCustomColorsInput && useCustomColorsInput.checked) {
          useCustomColorsInput.checked = false;
        }
        applyThemeColorInputsFromPalette(rawTheme, true);
        renderThemePresets();
        renderThemePreview();
      });
      themePresetList.appendChild(btn);
    }
  }

  function renderThemePreview() {
    if (!themePreview || !state) {
      return;
    }
    const tokens = themeTokensForMode(resolveEditedTheme() || state.resolvedTheme);
    if (tokens) {
      applyThemeVariables(themePreview, tokens);
    }
  }

  function renderThemes() {
    if (!state) {
      return;
    }
    selectedThemePreset = String(state.config.themePreset || 'coastal_light');
    if (useCustomColorsInput) {
      useCustomColorsInput.checked = state.config.useCustomColors === true;
    }
    const customColorsEnabled = Boolean(useCustomColorsInput && useCustomColorsInput.checked);
    if (customColorsEnabled) {
      const lightTheme = themeLightTokens(state.resolvedTheme);
      const fallbackPrimary = (lightTheme ? normalizeHex(lightTheme.primary) : null) || '#0e91b6';
      const fallbackAccent = (lightTheme ? normalizeHex(lightTheme.accent) : null) || '#ff7a45';
      const fallbackBackground = (lightTheme ? normalizeHex(lightTheme.bg) : null) || '#f3fbff';
      applyThemeColorControlValue(
        customPrimaryInput,
        customPrimaryHexInput,
        normalizeHex(state.config.customPrimary || '') || fallbackPrimary,
        false
      );
      applyThemeColorControlValue(
        customAccentInput,
        customAccentHexInput,
        normalizeHex(state.config.customAccent || '') || fallbackAccent,
        false
      );
      applyThemeColorControlValue(
        customBackgroundInput,
        customBackgroundHexInput,
        normalizeHex(state.config.customBackground || '') || fallbackBackground,
        false
      );
    } else {
      const selectedPresetTheme = state.themePresets[selectedThemePreset] || state.resolvedTheme;
      applyThemeColorInputsFromPalette(selectedPresetTheme, true);
    }
    renderThemePresets();
    renderThemePreview();
  }

  function formatBytes(bytes) {
    const numeric = Number(bytes || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = numeric;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
  }

  function renderStorage() {
    if (!state || !state.storage) {
      return;
    }
    const usedBytes = Number(state.storage.estimatedBytes || 0);
    const capBytes = Number(state.storage.capBytes || 0);
    const percentRaw =
      Number.isFinite(state.storage.percent) && state.storage.percent >= 0
        ? Number(state.storage.percent)
        : capBytes > 0
          ? (usedBytes / capBytes) * 100
          : 0;
    const percent = Math.max(0, Math.min(100, percentRaw));

    if (storageMeterFill) {
      storageMeterFill.style.width = `${percent}%`;
    }
    if (storagePercent) {
      storagePercent.textContent = `${percent.toFixed(1)}%`;
    }
    if (storageSummary) {
      storageSummary.textContent = `${formatBytes(usedBytes)} used of ${formatBytes(capBytes || 0)}`;
    }
    if (storageBreakdown) {
      storageBreakdown.textContent =
        `Records: ${state.storage.recordCount || 0} | ` +
        `Audit: ${state.storage.auditCount || 0} | ` +
        `Blocked: ${state.storage.blockedCount || 0} | ` +
        `Denial counters: ${state.storage.deniedCountEntries || 0}`;
    }
  }

  function renderAll() {
    if (!state) {
      return;
    }
    const activeTokens = themeTokensForMode(state.resolvedTheme);
    if (activeTokens) {
      applyThemeVariables(document.documentElement, activeTokens);
      persistThemeSnapshot(state.resolvedTheme);
    }
    updateHeroMeta();
    renderPending();
    renderBlocked();
    setHistoryView(activeHistoryView);
    renderHistorySearchResults();
    renderApprovedSearchResults();
    renderAuditSearchResults();
    renderStorage();
    renderSettings();
    renderTemplates();
    renderThemes();
  }

  function createPhotoWrap(url, alt) {
    const wrap = document.createElement('div');
    wrap.className = 'photo-wrap';

    const img = document.createElement('img');
    img.className = 'photo';
    img.src = url;
    img.alt = alt;
    img.loading = 'lazy';
    img.addEventListener('click', () => openImage(url));
    wrap.appendChild(img);

    const row = document.createElement('div');
    row.className = 'row';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-secondary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => {
      post({ type: 'openExternalUrl', url });
    });
    row.appendChild(openBtn);
    wrap.appendChild(row);

    return wrap;
  }

  function createUsernameHeading(username) {
    const title = document.createElement('h3');
    title.className = 'item-title';

    const normalizedUsername = String(username || '').trim().replace(/^u\//i, '');
    const usernameBtn = document.createElement('button');
    usernameBtn.type = 'button';
    usernameBtn.className = 'username-link';
    usernameBtn.textContent = `u/${normalizedUsername}`;
    usernameBtn.addEventListener('click', () => {
      if (!normalizedUsername) {
        return;
      }
      post({ type: 'openUserProfile', username: normalizedUsername });
    });

    title.appendChild(usernameBtn);
    return title;
  }

  function openImage(url) {
    imagePreview.src = url;
    imageModal.classList.remove('hidden');
  }

  function closeImage() {
    imageModal.classList.add('hidden');
    imagePreview.src = '';
  }

  function openBlockModal() {
    if (!blockModal || !blockUsernameInput) {
      return;
    }
    blockUsernameInput.value = '';
    blockModal.classList.remove('hidden');
    window.setTimeout(() => blockUsernameInput.focus(), 0);
  }

  function closeBlockModal() {
    if (!blockModal || !blockUsernameInput) {
      return;
    }
    blockModal.classList.add('hidden');
    blockUsernameInput.value = '';
  }

  function submitManualBlock() {
    if (!blockUsernameInput) {
      return;
    }
    const username = blockUsernameInput.value.trim().replace(/^u\//i, '');
    if (!username) {
      showToast('Enter a valid username to block.', 'error');
      return;
    }
    postWithBusy({ type: 'blockUser', username });
    closeBlockModal();
  }

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString();
  }

  function buildHistorySearchMessage(offset, requestId) {
    return {
      type: 'searchHistory',
      username: historySearchUserInput ? historySearchUserInput.value.trim() : '',
      fromDate: historySearchFromInput ? historySearchFromInput.value : '',
      toDate: historySearchToInput ? historySearchToInput.value : '',
      offset,
      limit: 25,
      requestId,
    };
  }

  function buildApprovedSearchMessage(offset, requestId) {
    return {
      type: 'searchApproved',
      username: approvedSearchUserInput ? approvedSearchUserInput.value.trim() : '',
      fromDate: approvedSearchFromInput ? approvedSearchFromInput.value : '',
      toDate: approvedSearchToInput ? approvedSearchToInput.value : '',
      offset,
      limit: 25,
      requestId,
    };
  }

  function buildAuditSearchMessage(offset, requestId) {
    return {
      type: 'searchAudit',
      username: auditSearchUserInput ? auditSearchUserInput.value.trim() : '',
      actor: auditSearchActorInput ? auditSearchActorInput.value.trim() : '',
      action: selectedAuditActionFilter === 'all' ? '' : selectedAuditActionFilter,
      fromDate: auditSearchFromInput ? auditSearchFromInput.value : '',
      toDate: auditSearchToInput ? auditSearchToInput.value : '',
      offset,
      limit: 25,
      requestId,
    };
  }

  function setHistorySearchHintVisible(visible) {
    if (!historySearchHint) {
      return;
    }
    historySearchHint.classList.toggle('hidden', !visible);
  }

  function setAuditSearchHintVisible(visible) {
    if (!auditSearchHint) {
      return;
    }
    auditSearchHint.classList.toggle('hidden', !visible);
  }

  function setAuditActionFilter(nextFilter) {
    selectedAuditActionFilter = nextFilter || 'all';
    for (const button of auditActionButtons) {
      const isActive = String(button.dataset.auditAction || 'all') === selectedAuditActionFilter;
      button.classList.toggle('btn-primary', isActive);
      button.classList.toggle('btn-secondary', !isActive);
    }
  }

  function buildHubPath() {
    const search = window.location.search || '';
    return `./hub.html${search}`;
  }

  function runHistoryRecordsSearch(reset) {
    if (reset) {
      historySearchItems = [];
      historySearchOffset = 0;
      historySearchHasMore = false;
      renderHistorySearchResults();
    }
    historySearchRequestId += 1;
    postWithBusy(buildHistorySearchMessage(reset ? 0 : historySearchOffset, historySearchRequestId));
  }

  function runHistoryRecordsSearchWithInputGuard(reset) {
    const query = historySearchUserInput ? historySearchUserInput.value.trim() : '';
    if (isShortNonEmptyPrefix(query)) {
      historySearchRequestId += 1;
      setHistorySearchHintVisible(true);
      historySearchItems = [];
      historySearchOffset = 0;
      historySearchHasMore = false;
      renderHistorySearchResults();
      return;
    }
    setHistorySearchHintVisible(false);
    runHistoryRecordsSearch(reset);
  }

  function runApprovedSearch(reset) {
    if (reset) {
      approvedSearchItems = [];
      approvedSearchOffset = 0;
      approvedSearchHasMore = false;
      renderApprovedSearchResults();
    }
    approvedSearchRequestId += 1;
    postWithBusy(buildApprovedSearchMessage(reset ? 0 : approvedSearchOffset, approvedSearchRequestId));
  }

  function setApprovedSearchHintVisible(visible) {
    if (!approvedSearchHint) {
      return;
    }
    approvedSearchHint.classList.toggle('hidden', !visible);
  }

  function runApprovedSearchWithInputGuard(reset) {
    const query = approvedSearchUserInput ? approvedSearchUserInput.value.trim() : '';
    if (!query) {
      setApprovedSearchHintVisible(false);
      runApprovedSearch(reset);
      return;
    }
    if (query.length < 3) {
      approvedSearchRequestId += 1;
      setApprovedSearchHintVisible(true);
      approvedSearchItems = [];
      approvedSearchOffset = 0;
      approvedSearchHasMore = false;
      renderApprovedSearchResults();
      return;
    }
    setApprovedSearchHintVisible(false);
    runApprovedSearch(reset);
  }

  function runAuditSearch(reset) {
    if (reset) {
      auditSearchItems = [];
      auditSearchOffset = 0;
      auditSearchHasMore = false;
      renderAuditSearchResults();
    }
    auditSearchRequestId += 1;
    postWithBusy(buildAuditSearchMessage(reset ? 0 : auditSearchOffset, auditSearchRequestId));
  }

  function runAuditSearchWithInputGuard(reset) {
    const usernameQuery = auditSearchUserInput ? auditSearchUserInput.value.trim() : '';
    const actorQuery = auditSearchActorInput ? auditSearchActorInput.value.trim() : '';
    if (isShortNonEmptyPrefix(usernameQuery) || isShortNonEmptyPrefix(actorQuery)) {
      auditSearchRequestId += 1;
      setAuditSearchHintVisible(true);
      auditSearchItems = [];
      auditSearchOffset = 0;
      auditSearchHasMore = false;
      renderAuditSearchResults();
      return;
    }
    setAuditSearchHintVisible(false);
    runAuditSearch(reset);
  }

  function shouldUseSeededApprovedResults() {
    return approvedSearchRequestId === 0 && approvedSearchItems.length > 0;
  }

  function shouldUseSeededAuditResults() {
    return auditSearchRequestId === 0 && auditSearchItems.length > 0;
  }

  if (backToHubBtn) {
    backToHubBtn.addEventListener('click', (event) => {
      if (event instanceof MouseEvent && getWebViewMode() === 'expanded') {
        try {
          exitExpandedMode(event);
          return;
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), 'error');
        }
      }
      window.location.assign(buildHubPath());
    });
  }

  refreshBtn.addEventListener('click', () => postWithBusy({ type: 'refresh' }));

  if (blockUserBtn) {
    blockUserBtn.addEventListener('click', () => {
      openBlockModal();
    });
  }

  if (blockedSearchInput) {
    blockedSearchInput.addEventListener('input', () => {
      renderBlocked();
    });
  }

  if (pendingSearchUserInput) {
    pendingSearchUserInput.addEventListener('input', () => {
      pendingUsernameFilter = normalizeUsernameForCompare(pendingSearchUserInput.value || '');
      renderPending();
    });
  }

  if (pendingSlaButtons.length) {
    for (const button of pendingSlaButtons) {
      button.addEventListener('click', () => {
        selectedPendingSlaFilter = String(button.dataset.sla || 'all');
        updatePendingSlaButtonStyles();
        renderPending();
      });
    }
  }

  if (historyViewButtons.length) {
    for (const button of historyViewButtons) {
      button.addEventListener('click', () => {
        const view = String(button.dataset.historyView || 'records');
        setHistoryView(view);
        if (activeHistoryView === 'records') {
          runHistoryRecordsSearchWithInputGuard(true);
          return;
        }
        if (activeHistoryView === 'approved') {
          if (shouldUseSeededApprovedResults()) {
            renderApprovedSearchResults();
            return;
          }
          runApprovedSearchWithInputGuard(true);
          return;
        }
        if (activeHistoryView === 'audit') {
          if (shouldUseSeededAuditResults()) {
            renderAuditSearchResults();
            return;
          }
          runAuditSearchWithInputGuard(true);
        }
      });
    }
  }

  if (historySearchBtn) {
    historySearchBtn.addEventListener('click', () => {
      runHistoryRecordsSearchWithInputGuard(true);
    });
  }

  if (historyClearBtn) {
    historyClearBtn.addEventListener('click', () => {
      historySearchItems = [];
      historySearchOffset = 0;
      historySearchHasMore = false;
      if (historySearchUserInput) historySearchUserInput.value = '';
      applyDefaultDateRange(historySearchFromInput, historySearchToInput, 30);
      setHistorySearchHintVisible(false);
      renderHistorySearchResults();
      runHistoryRecordsSearchWithInputGuard(true);
    });
  }

  if (historyLoadMoreBtn) {
    historyLoadMoreBtn.addEventListener('click', () => {
      runHistoryRecordsSearchWithInputGuard(false);
    });
  }

  if (approvedSearchBtn) {
    approvedSearchBtn.addEventListener('click', () => {
      runApprovedSearchWithInputGuard(true);
    });
  }

  if (approvedClearBtn) {
    approvedClearBtn.addEventListener('click', () => {
      approvedSearchItems = [];
      approvedSearchOffset = 0;
      approvedSearchHasMore = false;
      if (approvedSearchUserInput) approvedSearchUserInput.value = '';
      applyDefaultDateRange(approvedSearchFromInput, approvedSearchToInput, 30);
      setApprovedSearchHintVisible(false);
      renderApprovedSearchResults();
      runApprovedSearchWithInputGuard(true);
    });
  }

  if (approvedLoadMoreBtn) {
    approvedLoadMoreBtn.addEventListener('click', () => {
      runApprovedSearchWithInputGuard(false);
    });
  }

  if (auditSearchBtn) {
    auditSearchBtn.addEventListener('click', () => {
      runAuditSearchWithInputGuard(true);
    });
  }

  if (auditClearBtn) {
    auditClearBtn.addEventListener('click', () => {
      auditSearchItems = [];
      auditSearchOffset = 0;
      auditSearchHasMore = false;
      if (auditSearchUserInput) auditSearchUserInput.value = '';
      if (auditSearchActorInput) auditSearchActorInput.value = '';
      setAuditActionFilter('all');
      applyDefaultDateRange(auditSearchFromInput, auditSearchToInput, 30);
      setAuditSearchHintVisible(false);
      renderAuditSearchResults();
      runAuditSearchWithInputGuard(true);
    });
  }

  if (auditLoadMoreBtn) {
    auditLoadMoreBtn.addEventListener('click', () => {
      runAuditSearchWithInputGuard(false);
    });
  }

  if (historySearchUserInput) {
    historySearchUserInput.addEventListener('input', () => {
      window.clearTimeout(historySearchDebounceId);
      historySearchDebounceId = window.setTimeout(() => {
        if (activeHistoryView === 'records') {
          runHistoryRecordsSearchWithInputGuard(true);
        }
      }, 300);
    });
  }
  if (historySearchFromInput) {
    historySearchFromInput.addEventListener('change', () => {
      if (activeHistoryView === 'records') {
        runHistoryRecordsSearchWithInputGuard(true);
      }
    });
  }
  if (historySearchToInput) {
    historySearchToInput.addEventListener('change', () => {
      if (activeHistoryView === 'records') {
        runHistoryRecordsSearchWithInputGuard(true);
      }
    });
  }

  if (approvedSearchUserInput) {
    approvedSearchUserInput.addEventListener('input', () => {
      window.clearTimeout(approvedSearchDebounceId);
      approvedSearchDebounceId = window.setTimeout(() => {
        if (activeHistoryView === 'approved') {
          runApprovedSearchWithInputGuard(true);
        }
      }, 300);
    });
  }
  if (approvedSearchFromInput) {
    approvedSearchFromInput.addEventListener('change', () => {
      if (activeHistoryView === 'approved') {
        runApprovedSearchWithInputGuard(true);
      }
    });
  }
  if (approvedSearchToInput) {
    approvedSearchToInput.addEventListener('change', () => {
      if (activeHistoryView === 'approved') {
        runApprovedSearchWithInputGuard(true);
      }
    });
  }

  if (auditSearchUserInput) {
    auditSearchUserInput.addEventListener('input', () => {
      window.clearTimeout(auditSearchDebounceId);
      auditSearchDebounceId = window.setTimeout(() => {
        if (activeHistoryView === 'audit') {
          runAuditSearchWithInputGuard(true);
        }
      }, 300);
    });
  }
  if (auditSearchActorInput) {
    auditSearchActorInput.addEventListener('input', () => {
      window.clearTimeout(auditSearchDebounceId);
      auditSearchDebounceId = window.setTimeout(() => {
        if (activeHistoryView === 'audit') {
          runAuditSearchWithInputGuard(true);
        }
      }, 300);
    });
  }
  if (auditSearchFromInput) {
    auditSearchFromInput.addEventListener('change', () => {
      if (activeHistoryView === 'audit') {
        runAuditSearchWithInputGuard(true);
      }
    });
  }
  if (auditSearchToInput) {
    auditSearchToInput.addEventListener('change', () => {
      if (activeHistoryView === 'audit') {
        runAuditSearchWithInputGuard(true);
      }
    });
  }

  if (auditActionButtons.length) {
    for (const button of auditActionButtons) {
      button.addEventListener('click', () => {
        setAuditActionFilter(String(button.dataset.auditAction || 'all'));
        if (activeHistoryView === 'audit') {
          runAuditSearchWithInputGuard(true);
        }
      });
    }
  }

  saveFlairBtn.addEventListener('click', () => {
    const flairTemplateId = flairTemplateInput ? String(flairTemplateInput.value || '').trim() : '';
    if (!flairTemplateId) {
      showToast('Flair template ID is required to save verification settings.', 'error');
      return;
    }
    if (!isLikelyFlairTemplateId(flairTemplateId)) {
      showToast('Flair template ID is invalid, renter and save again.', 'error');
      return;
    }
    postWithBusy({
      type: 'saveFlair',
      flairTemplateId,
      flairCssClass: flairCssClassInput ? flairCssClassInput.value : '',
      verificationsEnabled: verificationsEnabledInput ? Boolean(verificationsEnabledInput.checked) : true,
      requiredPhotoCount: requiredPhotoCountInput ? Number(requiredPhotoCountInput.value || 2) : 2,
    });
  });

  saveTemplatesBtn.addEventListener('click', () => {
    postWithBusy({
      type: 'saveTemplates',
      pendingTurnaroundDays: pendingTurnaroundDaysInput ? pendingTurnaroundDaysInput.value : '',
      modmailSubject: modmailSubjectInput ? modmailSubjectInput.value : '',
      pendingBody: pendingBodyInput ? pendingBodyInput.value : '',
      approveHeader: approveHeaderInput.value,
      approveBody: approveBodyInput.value,
      denyHeader: denyHeaderInput.value,
      denyBodyPhotoshop: denyBodyPhotoshopInput.value,
      denyBodyUnclear: denyBodyUnclearInput.value,
      denyBodyInstructions: denyBodyInstructionsInput.value,
      denyBodyOther: denyBodyOtherInput.value,
      removeHeader: removeHeaderInput.value,
      removeBody: removeBodyInput.value,
    });
  });

  if (useCustomColorsInput) {
    useCustomColorsInput.addEventListener('change', () => {
      const enabled = Boolean(useCustomColorsInput.checked);
      if (customPrimaryInput) customPrimaryInput.disabled = !enabled;
      if (customPrimaryHexInput) customPrimaryHexInput.disabled = !enabled;
      if (customAccentInput) customAccentInput.disabled = !enabled;
      if (customAccentHexInput) customAccentHexInput.disabled = !enabled;
      if (customBackgroundInput) customBackgroundInput.disabled = !enabled;
      if (customBackgroundHexInput) customBackgroundHexInput.disabled = !enabled;
      renderThemePreview();
    });
  }
  function enableCustomColorsForThemeEditing() {
    if (!useCustomColorsInput) {
      return;
    }
    if (!useCustomColorsInput.checked) {
      useCustomColorsInput.checked = true;
    }
    if (customPrimaryInput) {
      customPrimaryInput.disabled = false;
    }
    if (customPrimaryHexInput) {
      customPrimaryHexInput.disabled = false;
    }
    if (customAccentInput) {
      customAccentInput.disabled = false;
    }
    if (customAccentHexInput) {
      customAccentHexInput.disabled = false;
    }
    if (customBackgroundInput) {
      customBackgroundInput.disabled = false;
    }
    if (customBackgroundHexInput) {
      customBackgroundHexInput.disabled = false;
    }
  }
  wireThemeColorControl(customPrimaryInput, customPrimaryHexInput, '#0e91b6');
  wireThemeColorControl(customAccentInput, customAccentHexInput, '#ff7a45');
  wireThemeColorControl(customBackgroundInput, customBackgroundHexInput, '#f3fbff');
  if (resetThemeBtn) {
    resetThemeBtn.addEventListener('click', () => {
      if (!state) {
        return;
      }
      if (useCustomColorsInput) {
        useCustomColorsInput.checked = false;
      }
      const selectedPresetTheme = state.themePresets[selectedThemePreset] || state.resolvedTheme;
      applyThemeColorInputsFromPalette(selectedPresetTheme, true);
      renderThemePreview();
    });
  }
  if (saveThemeBtn) {
    saveThemeBtn.addEventListener('click', () => {
      const useCustomColors = useCustomColorsInput ? Boolean(useCustomColorsInput.checked) : false;
      const normalizedPrimary = normalizeThemeControlForSave(customPrimaryInput, customPrimaryHexInput, '#0e91b6');
      const normalizedAccent = normalizeThemeControlForSave(customAccentInput, customAccentHexInput, '#ff7a45');
      const normalizedBackground = normalizeThemeControlForSave(
        customBackgroundInput,
        customBackgroundHexInput,
        '#f3fbff'
      );
      if (useCustomColors && (!normalizedPrimary || !normalizedAccent || !normalizedBackground)) {
        showToast('Custom colors must be valid hex values for primary, secondary, and background.', 'error');
        return;
      }
      postWithBusy({
        type: 'saveTheme',
        themePreset: selectedThemePreset,
        useCustomColors,
        customPrimary: normalizedPrimary || '',
        customAccent: normalizedAccent || '',
        customBackground: normalizedBackground || '',
      });
    });
  }

  imageClose.addEventListener('click', closeImage);
  imageModal.addEventListener('click', (event) => {
    if (event.target === imageModal) {
      closeImage();
    }
  });

  if (blockCancelBtn) {
    blockCancelBtn.addEventListener('click', closeBlockModal);
  }
  if (blockConfirmBtn) {
    blockConfirmBtn.addEventListener('click', submitManualBlock);
  }
  if (blockUsernameInput) {
    blockUsernameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitManualBlock();
      }
    });
  }
  if (blockModal) {
    blockModal.addEventListener('click', (event) => {
      if (event.target === blockModal) {
        closeBlockModal();
      }
    });
  }

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) {
        setTab(tab);
        if (tab === 'pending') {
          void refreshFromRealtimeSignal();
        } else if (tab === 'history') {
          setHistoryView(activeHistoryView);
          if (activeHistoryView === 'records') {
            runHistoryRecordsSearchWithInputGuard(true);
          } else if (activeHistoryView === 'approved') {
            if (shouldUseSeededApprovedResults()) {
              renderApprovedSearchResults();
            } else {
              runApprovedSearchWithInputGuard(true);
            }
          } else if (activeHistoryView === 'audit') {
            if (shouldUseSeededAuditResults()) {
              renderAuditSearchResults();
            } else {
              runAuditSearchWithInputGuard(true);
            }
          }
        }
      }
    });
  }

  function onColorSchemeChange() {
    if (!state) {
      return;
    }
    renderAll();
  }

  if (prefersDarkMedia) {
    if (typeof prefersDarkMedia.addEventListener === 'function') {
      prefersDarkMedia.addEventListener('change', onColorSchemeChange);
    } else if (typeof prefersDarkMedia.addListener === 'function') {
      prefersDarkMedia.addListener(onColorSchemeChange);
    }
  }

  window.addEventListener('pagehide', closeRealtimeSubscription);

  applyDefaultDateRange(historySearchFromInput, historySearchToInput, 30);
  applyDefaultDateRange(approvedSearchFromInput, approvedSearchToInput, 30);
  applyDefaultDateRange(auditSearchFromInput, auditSearchToInput, 30);
  setHistorySearchHintVisible(false);
  setAuditSearchHintVisible(false);
  setAuditActionFilter('all');
  setHistoryView('records');

  function startHandshake() {
    post({ type: 'ready' });
    readyTimerId = window.setInterval(() => {
      if (stateInitialized) {
        window.clearInterval(readyTimerId);
        readyTimerId = 0;
        return;
      }
      readyRetries += 1;
      post({ type: 'ready' });
      if (readyRetries >= 8) {
        window.clearInterval(readyTimerId);
        readyTimerId = 0;
        showToast('Still waiting for moderator data. Tap Refresh.', 'error');
      }
    }, 900);
  }

  if (document.readyState === 'complete') {
    startHandshake();
  } else {
    window.addEventListener('load', startHandshake, { once: true });
  }
})();
