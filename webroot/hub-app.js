import { connectRealtime, disconnectRealtime } from '@devvit/realtime/client';
import {
  exitExpandedMode,
  navigateTo,
  requestExpandedMode,
  showForm,
  showToast as devvitShowToast,
} from '@devvit/web/client';
import { EffectType } from '@devvit/protos/json/devvit/ui/effects/v1alpha/effect.js';
import { WebViewImmersiveMode } from '@devvit/protos/json/devvit/ui/effects/web_view/v1alpha/immersive_mode.js';
import { emitEffect } from '@devvit/shared-types/client/emit-effect.js';
import brandLogoUrl from './logo.png';
import { HOW_TO_USE_APP_URL, MODERATOR_QUICK_START_URL } from './app-config.js';

const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const TERMS_AND_CONDITIONS_URL = 'https://www.reddit.com/r/vouchx/wiki/terms-and-conditions/';
const PRIVACY_POLICY_URL = 'https://www.reddit.com/r/vouchx/wiki/privacy-policy/';
const PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY = 'vouchx-photo-instructions-launch-v1';
const PHOTO_INSTRUCTIONS_LAUNCH_STATE_TTL_MS = 5 * 60 * 1000;
const PHOTO_INSTRUCTIONS_READ_STATE_PREFIX = 'vouchx-photo-instructions-read-v1:';
const PHOTO_INSTRUCTIONS_READ_TTL_MS = 15 * 60 * 1000;
const SUBMIT_ACKNOWLEDGEMENTS = [
  {
    key: 'is18Confirmed',
    label: 'I am at least 18 years old.',
  },
  {
    key: 'adultOnlySelfPhotosConfirmed',
    label: 'Photos I submit are of me and do not include anyone under 18.',
  },
  {
    key: 'termsAccepted',
    label: 'I have read and accept the VouchX Terms and Conditions.',
  },
];
const MANUAL_SOURCE_MARKERS = ['css-substring-match', 'css-wildcard-match'];
const WORKTREE_LABEL = typeof __VOUCHX_WORKTREE_LABEL__ === 'string' ? __VOUCHX_WORKTREE_LABEL__.trim() : '';

function createShell(root, inline) {
  root.innerHTML = `
    <div class="shell">
      <div data-el="loading" class="loading-screen">
        <div class="loading-copy">
          ${WORKTREE_LABEL ? `<p class="hub-worktree-badge loading-worktree-badge">WT ${escapeHtml(WORKTREE_LABEL)}</p>` : ''}
          <p>${inline ? 'Loading verification panel...' : 'Loading Verification Hub...'}</p>
        </div>
      </div>
      <div data-el="main" class="hub-main hidden">
        <section class="hub-surface">
          <header class="hub-hero">
            <div class="hub-brand">
              <div class="hub-title-row">
                <div class="hub-brand-mark">
                  <img
                    data-el="brand-logo"
                    class="hub-brand-logo hidden"
                    src=""
                    alt="VouchX logo"
                  />
                </div>
                <div class="hub-title-copy">
                  <p class="hub-kicker">VouchX</p>
                  <h1>Verification Hub</h1>
                  ${WORKTREE_LABEL ? `<p class="hub-worktree-badge">WT ${escapeHtml(WORKTREE_LABEL)}</p>` : ''}
                </div>
              </div>
              <p data-el="meta-username" class="meta"></p>
              <p data-el="meta-subreddit" class="meta"></p>
              <div class="hub-brand-status">
                <p class="hub-status-kicker">Current status</p>
                <p data-el="meta-status" class="status-line"></p>
              </div>
            </div>
            <div class="hub-hero-actions">
              <span data-el="pending-badge" class="badge hidden"></span>
              <button data-el="mod-panel-btn" class="btn-secondary hub-toolbar-btn hidden" type="button">Mod Panel</button>
            </div>
          </header>

          <section class="hub-command">
            <div class="hub-command-copy">
              <p class="hub-kicker">Actions</p>
              <h2 data-el="command-title">Review the instructions, then submit your verification.</h2>
            </div>
            <p data-el="info-msg" class="info-msg hidden"></p>
            <div data-el="action-row" class="row hub-action-dock"></div>
          </section>

          <footer data-el="legal-links" class="legal-links hidden"></footer>
        </section>
      </div>

      <div data-el="submit-warning-modal" class="hub-modal hidden">
        <div class="hub-modal-card">
          <h2>Before You Submit</h2>
          <p class="meta">
            You must agree to each statement below before the upload form will open.
          </p>
          <div data-el="submit-warning-list" class="warning-checklist"></div>
          <div data-el="submit-warning-links" class="legal-links legal-links-modal hidden"></div>
          <div class="row">
            <button data-el="submit-warning-cancel" class="btn-secondary" type="button">Cancel</button>
            <button data-el="submit-warning-continue" class="btn-primary" type="button">Continue to Upload</button>
          </div>
        </div>
      </div>

      <div data-el="photo-instructions-modal" class="hub-modal hidden">
        <div class="hub-modal-card">
          <h2>Photo Requirements</h2>
          <p class="meta">
            Review these instructions carefully before submitting your photos.
          </p>
          <div data-el="photo-instructions-scroll-shell" class="hub-scroll-shell" data-scroll-overflow="false" data-scroll-bottom="true">
            <div data-el="photo-instructions-body" class="markdown-body hub-modal-copy"></div>
            <div data-el="photo-instructions-scroll-hint" class="hub-scroll-hint hidden" aria-hidden="true">Scroll Down ↓</div>
          </div>
          <div class="row">
            <button data-el="photo-instructions-continue" class="btn-primary hidden" type="button">Continue to Submission</button>
            <button data-el="photo-instructions-close" class="btn-secondary" type="button">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    loadingScreen: root.querySelector('[data-el="loading"]'),
    mainContent: root.querySelector('[data-el="main"]'),
    brandLogo: root.querySelector('[data-el="brand-logo"]'),
    metaUsername: root.querySelector('[data-el="meta-username"]'),
    metaSubreddit: root.querySelector('[data-el="meta-subreddit"]'),
    metaStatus: root.querySelector('[data-el="meta-status"]'),
    commandTitle: root.querySelector('[data-el="command-title"]'),
    pendingBadge: root.querySelector('[data-el="pending-badge"]'),
    modPanelBtn: root.querySelector('[data-el="mod-panel-btn"]'),
    infoMsg: root.querySelector('[data-el="info-msg"]'),
    actionRow: root.querySelector('[data-el="action-row"]'),
    legalLinks: root.querySelector('[data-el="legal-links"]'),
    submitWarningModal: root.querySelector('[data-el="submit-warning-modal"]'),
    submitWarningList: root.querySelector('[data-el="submit-warning-list"]'),
    submitWarningLinks: root.querySelector('[data-el="submit-warning-links"]'),
    submitWarningCancel: root.querySelector('[data-el="submit-warning-cancel"]'),
    submitWarningContinue: root.querySelector('[data-el="submit-warning-continue"]'),
    photoInstructionsModal: root.querySelector('[data-el="photo-instructions-modal"]'),
    photoInstructionsScrollShell: root.querySelector('[data-el="photo-instructions-scroll-shell"]'),
    photoInstructionsBody: root.querySelector('[data-el="photo-instructions-body"]'),
    photoInstructionsScrollHint: root.querySelector('[data-el="photo-instructions-scroll-hint"]'),
    photoInstructionsContinue: root.querySelector('[data-el="photo-instructions-continue"]'),
    photoInstructionsClose: root.querySelector('[data-el="photo-instructions-close"]'),
  };
}

function showToast(text, tone = 'info') {
  devvitShowToast({
    text,
    appearance: tone === 'success' ? 'success' : 'neutral',
  });
}

async function requestJson(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' && payload.error ? payload.error : `Request failed: ${response.status}`);
  }
  return payload;
}

function applyTheme(resolvedTheme) {
  if (!resolvedTheme || typeof resolvedTheme !== 'object') {
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tokens = prefersDark ? resolvedTheme.dark : resolvedTheme.light;
  if (!tokens) {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty('--primary', tokens.primary);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--success', tokens.success);
  root.style.setProperty('--danger', tokens.danger);
  root.style.setProperty('--bg', tokens.bg);
  root.style.setProperty('--card', tokens.surface);
  root.style.setProperty('--text', tokens.text);
  root.style.setProperty('--muted', tokens.mutedText);
  root.style.setProperty('--line', tokens.border);
}

function isManualSource(source) {
  return typeof source === 'string' && MANUAL_SOURCE_MARKERS.some((marker) => source.includes(marker));
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function makeButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeExternalUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function createExternalLink(item, extraClassName = '') {
  const link = document.createElement('a');
  link.className = ['legal-link', extraClassName].filter(Boolean).join(' ');
  if (!item.url) {
    link.classList.add('legal-link-disabled');
  }
  link.href = item.url || '#';
  link.textContent = item.label;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (!item.url) {
      showToast(`${item.label} URL is not configured.`, 'error');
      return;
    }
    navigateTo(item.url);
  });
  return link;
}

function formatDenyReasonSlot(reasonId) {
  const match = String(reasonId || '').match(/^reason_(\d+)$/);
  return match ? `Reason ${match[1]}` : String(reasonId || '').replaceAll('_', ' ');
}

function getDenyReasonLabel(state, reasonId) {
  if (!state || !state.config || !Array.isArray(state.config.denyReasons)) {
    return formatDenyReasonSlot(reasonId);
  }
  const match = state.config.denyReasons.find((item) => item && item.id === reasonId);
  const label = match && typeof match.label === 'string' ? match.label.trim() : '';
  return label || formatDenyReasonSlot(reasonId);
}

function renderInlineMarkdown(value) {
  const replacements = [];
  const storeReplacement = (html) => {
    const token = `%%MDTOKEN${replacements.length}%%`;
    replacements.push(html);
    return token;
  };

  let source = String(value ?? '');
  source = source.replace(/`([^`]+)`/g, (_match, code) => storeReplacement(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const normalized = normalizeExternalUrl(url);
    if (!normalized) {
      return label;
    }
    return storeReplacement(
      `<a href="${escapeHtml(normalized)}" data-external-url="${escapeHtml(normalized)}">${escapeHtml(label)}</a>`
    );
  });

  let html = escapeHtml(source);
  html = html.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[\s(])\*([^*\n][\s\S]*?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[\s(])_([^_\n][\s\S]*?)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

  return html.replace(/%%MDTOKEN(\d+)%%/g, (_match, index) => replacements[Number(index)] ?? '');
}

function renderMarkdown(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) {
    return '<p class="markdown-empty">No photo instructions are available yet.</p>';
  }

  const html = [];
  const lines = source.split('\n');
  let paragraphLines = [];
  let listType = '';

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    html.push(`<p>${renderInlineMarkdown(paragraphLines.join('\n')).replace(/\n/g, '<br />')}</p>`);
    paragraphLines = [];
  };

  const closeList = () => {
    if (!listType) {
      return;
    }
    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = Math.min(6, headingMatch[1].length + 2);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    if (listType) {
      closeList();
    }
    paragraphLines.push(line);
  }

  flushParagraph();
  closeList();
  return html.join('');
}

function formatPendingTurnaroundDays(days) {
  const normalizedDays = Number.isFinite(Number(days)) ? Math.max(0, Math.trunc(Number(days))) : 0;
  return `${normalizedDays} ${normalizedDays === 1 ? 'day' : 'days'}`;
}

function renderInstructionTemplate(value, state) {
  const replacements = {
    subreddit: String(state?.subredditName || '').trim(),
    days: formatPendingTurnaroundDays(state?.config?.pendingTurnaroundDays),
  };

  return String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawKey) => {
    const normalizedKey = String(rawKey || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    return replacements[normalizedKey] ?? '';
  });
}

function isAndroidWebViewClient() {
  const userAgent = String(navigator.userAgent || '');
  return /android/i.test(userAgent) && (/;\s*wv\)/i.test(userAgent) || /version\/4\.0/i.test(userAgent));
}

function forceExitExpandedView(event) {
  if (!(event instanceof MouseEvent) || !event.isTrusted || event.type !== 'click') {
    throw new Error('Back to Hub requires a trusted click event.');
  }
  emitEffect({
    type: EffectType.EFFECT_WEB_VIEW,
    immersiveMode: {
      immersiveMode: WebViewImmersiveMode.INLINE_MODE,
    },
  });
}

function buildInternalNavigationUrl(targetPath) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(String(targetPath || './hub.html'), currentUrl);
  const mergedParams = new URLSearchParams(currentUrl.search);
  for (const [key, value] of new URLSearchParams(targetUrl.search)) {
    mergedParams.set(key, value);
  }
  targetUrl.search = mergedParams.toString();
  return targetUrl.toString();
}

function normalizeStorageKeyPart(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function persistPhotoInstructionsLaunchMode(mode) {
  try {
    window.localStorage.setItem(
      PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY,
      JSON.stringify({
        mode: mode === 'submit' ? 'submit' : 'view',
        recordedAt: Date.now(),
      })
    );
  } catch (_error) {
    // Best effort only. If storage is unavailable, the dedicated entry defaults to view mode.
  }
}

export function consumePhotoInstructionsLaunchMode() {
  let parsed = null;
  try {
    const raw = window.localStorage.getItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    if (!raw) {
      return 'view';
    }
    window.localStorage.removeItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    parsed = JSON.parse(raw);
  } catch (_error) {
    try {
      window.localStorage.removeItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    } catch (_removeError) {
      // Ignore cleanup failures.
    }
    return 'view';
  }

  const recordedAt = Number(parsed?.recordedAt || 0);
  if (!recordedAt || Math.abs(Date.now() - recordedAt) > PHOTO_INSTRUCTIONS_LAUNCH_STATE_TTL_MS) {
    return 'view';
  }
  return parsed?.mode === 'submit' ? 'submit' : 'view';
}

export function mountHub(options = {}) {
  const {
    rootId = 'app-root',
    inline = false,
    photoInstructionsOnly = false,
    photoInstructionsLaunchMode = 'view',
  } = options;
  const root = document.getElementById(rootId);
  if (!root) {
    return;
  }

  const refs = createShell(root, inline);
  let hubState = null;
  let hubForms = null;
  let modPanelPath = './mod-panel.html';
  let isBusy = false;
  let autoRefreshTimerId = 0;
  let realtimeChannel = '';
  let realtimeConnectedChannel = '';
  let realtimeLiveChannel = '';
  let realtimeReconnectTimerId = 0;
  let realtimeRefreshInFlight = false;
  let realtimeRefreshQueued = false;
  let photoInstructionsOnlyHandled = false;
  const howToUseUrl = normalizeExternalUrl(HOW_TO_USE_APP_URL);
  const moderatorQuickStartUrl = normalizeExternalUrl(MODERATOR_QUICK_START_URL);
  const legalLinks = [
    { label: 'Terms and Conditions', url: normalizeExternalUrl(TERMS_AND_CONDITIONS_URL) },
    { label: 'Privacy Policy', url: normalizeExternalUrl(PRIVACY_POLICY_URL) },
    ...(howToUseUrl ? [{ label: 'How to use this app', url: howToUseUrl }] : []),
  ];
  const submitWarningLinks = legalLinks.filter((item) => item.label !== 'How to use this app');

  if (refs.brandLogo) {
    refs.brandLogo.src = brandLogoUrl;
    refs.brandLogo.addEventListener('load', () => {
      refs.brandLogo.classList.remove('hidden');
    });
    refs.brandLogo.addEventListener('error', () => {
      refs.brandLogo.classList.add('hidden');
    });
  }

  if (refs.legalLinks) {
    refs.legalLinks.classList.remove('hidden');
    for (const item of legalLinks) {
      refs.legalLinks.appendChild(createExternalLink(item));
    }
  }

  if (refs.submitWarningList) {
    for (const acknowledgement of SUBMIT_ACKNOWLEDGEMENTS) {
      const label = document.createElement('label');
      label.className = 'warning-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.ackKey = acknowledgement.key;
      const text = document.createElement('span');
      text.textContent = acknowledgement.label;
      label.appendChild(input);
      label.appendChild(text);
      refs.submitWarningList.appendChild(label);
    }
  }

  if (refs.submitWarningLinks) {
    refs.submitWarningLinks.classList.remove('hidden');
    for (const item of submitWarningLinks) {
      refs.submitWarningLinks.appendChild(createExternalLink(item));
    }
  }

  if (refs.photoInstructionsBody) {
    refs.photoInstructionsBody.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const link = event.target.closest('a[data-external-url]');
      if (!link) {
        return;
      }
      event.preventDefault();
      const url = String(link.getAttribute('data-external-url') || '').trim();
      if (!url) {
        return;
      }
      navigateTo(url);
    });
  }

  function buildPhotoInstructionsReadStateKey() {
    return `${PHOTO_INSTRUCTIONS_READ_STATE_PREFIX}${normalizeStorageKeyPart(
      hubState?.subredditName,
      'unknown-subreddit'
    )}:${normalizeStorageKeyPart(hubState?.viewerUsername, 'unknown-user')}`;
  }

  function hasRecentPhotoInstructionsRead() {
    if (!hubState?.viewerUsername || !hubState?.subredditName) {
      return false;
    }
    const storageKey = buildPhotoInstructionsReadStateKey();
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return false;
      }
      parsed = JSON.parse(raw);
    } catch (_error) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (_removeError) {
        // Ignore cleanup failures.
      }
      return false;
    }

    const acknowledgedAt = Number(parsed?.acknowledgedAt || 0);
    if (!acknowledgedAt || Date.now() - acknowledgedAt > PHOTO_INSTRUCTIONS_READ_TTL_MS) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (_removeError) {
        // Ignore cleanup failures.
      }
      return false;
    }
    return true;
  }

  function markPhotoInstructionsRead() {
    if (!hubState?.viewerUsername || !hubState?.subredditName) {
      return;
    }
    try {
      window.localStorage.setItem(
        buildPhotoInstructionsReadStateKey(),
        JSON.stringify({
          acknowledgedAt: Date.now(),
        })
      );
    } catch (_error) {
      // Best effort only.
    }
  }

  function shouldUseAndroidPhotoInstructionsStep() {
    return photoInstructionsOnly || isAndroidWebViewClient();
  }

  function setPhotoInstructionsPresentation(isOpen) {
    const useAndroidPhotoInstructionsStep = shouldUseAndroidPhotoInstructionsStep();
    if (refs.photoInstructionsModal) {
      refs.photoInstructionsModal.classList.toggle('hub-photo-instructions-step', useAndroidPhotoInstructionsStep);
    }
    document.body.classList.toggle(
      'hub-photo-instructions-step-open',
      useAndroidPhotoInstructionsStep && isOpen
    );
  }

  function updatePhotoInstructionsScrollAffordance() {
    if (!refs.photoInstructionsBody || !refs.photoInstructionsScrollShell) {
      return;
    }
    if (shouldUseAndroidPhotoInstructionsStep()) {
      refs.photoInstructionsScrollShell.dataset.scrollOverflow = 'false';
      refs.photoInstructionsScrollShell.dataset.scrollBottom = 'true';
      if (refs.photoInstructionsScrollHint) {
        refs.photoInstructionsScrollHint.classList.add('hidden');
      }
      return;
    }
    const overflow = refs.photoInstructionsBody.scrollHeight - refs.photoInstructionsBody.clientHeight > 8;
    const atBottom =
      refs.photoInstructionsBody.scrollTop + refs.photoInstructionsBody.clientHeight >=
      refs.photoInstructionsBody.scrollHeight - 6;
    const nearTop = refs.photoInstructionsBody.scrollTop <= 10;
    refs.photoInstructionsScrollShell.dataset.scrollOverflow = overflow ? 'true' : 'false';
    refs.photoInstructionsScrollShell.dataset.scrollBottom = atBottom ? 'true' : 'false';
    if (refs.photoInstructionsScrollHint) {
      refs.photoInstructionsScrollHint.classList.toggle(
        'hidden',
        !overflow || !nearTop
      );
    }
  }

  if (refs.photoInstructionsBody) {
    refs.photoInstructionsBody.addEventListener('scroll', () => {
      updatePhotoInstructionsScrollAffordance();
    });
  }

  window.addEventListener('resize', () => {
    if (refs.photoInstructionsModal && !refs.photoInstructionsModal.classList.contains('hidden')) {
      updatePhotoInstructionsScrollAffordance();
    }
  });

  function setBusy(next) {
    isBusy = Boolean(next);
    for (const button of root.querySelectorAll('button')) {
      button.disabled = isBusy;
    }
    if (!isBusy && realtimeRefreshQueued && !realtimeRefreshInFlight) {
      realtimeRefreshQueued = false;
      void refreshFromRealtimeSignal();
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
    realtimeLiveChannel = '';
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
          if (channel !== realtimeChannel) {
            disconnectRealtime(connectedChannel);
            return;
          }
          realtimeConnectedChannel = connectedChannel;
          realtimeLiveChannel = connectedChannel;
        },
        onDisconnect(disconnectedChannel) {
          if (disconnectedChannel === realtimeConnectedChannel) {
            realtimeConnectedChannel = '';
          }
          if (disconnectedChannel === realtimeLiveChannel) {
            realtimeLiveChannel = '';
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
    realtimeLiveChannel = '';
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
      applyPayload(await requestJson('/api/hub/state'));
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

  async function performAction(path, body = {}, options = {}) {
    const { refreshOnError = null } = options;
    setBusy(true);
    try {
      applyPayload(await requestJson(path, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(message, 'error');
      if (typeof refreshOnError === 'function' && refreshOnError(message)) {
        await refreshState({ silent: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function openSubmitForm(triggerEvent = null) {
    if (!hubForms?.submit) {
      return;
    }
    const shouldShowPhotoInstructionsFirst = Boolean(
      hubState?.config?.showPhotoInstructionsBeforeSubmit && String(hubState?.config?.photoInstructions || '').trim()
    );
    if (shouldShowPhotoInstructionsFirst) {
      if (shouldUseAndroidPhotoInstructionsStep() && !photoInstructionsOnly) {
        if (!hasRecentPhotoInstructionsRead()) {
          markPhotoInstructionsRead();
          persistPhotoInstructionsLaunchMode('submit');
          if (inline && triggerEvent instanceof MouseEvent) {
            try {
              requestExpandedMode(triggerEvent, 'photoInstructions');
              return;
            } catch (error) {
              showToast(error instanceof Error ? error.message : String(error), 'error');
            }
          }
          window.location.replace(buildInternalNavigationUrl('./photo-instructions.html'));
          return;
        }
      } else {
        const continueToSubmission = await requestPhotoInstructionsReview({ requireContinue: true });
        if (!continueToSubmission) {
          return;
        }
      }
    }
    const acknowledgements = await requestSubmitAcknowledgements();
    if (!acknowledgements) {
      return;
    }
    const result = await showForm(hubForms.submit);
    if (!result || result.action !== 'SUBMITTED') {
      return;
    }
    await performAction('/api/hub/submit', {
      ...result.values,
      ...acknowledgements,
    });
  }

  async function openDeleteForm() {
    if (!hubForms?.removeVerification) {
      return;
    }
    const result = await showForm(hubForms.removeVerification);
    if (!result || result.action !== 'SUBMITTED') {
      return;
    }
    await performAction('/api/hub/delete', result.values);
  }

  function requestSubmitAcknowledgements() {
    return new Promise((resolve) => {
      if (
        !refs.submitWarningModal ||
        !refs.submitWarningCancel ||
        !refs.submitWarningContinue ||
        !refs.submitWarningList
      ) {
        resolve(null);
        return;
      }

      const inputs = Array.from(refs.submitWarningList.querySelectorAll('input[type="checkbox"][data-ack-key]'));
      for (const input of inputs) {
        input.checked = false;
      }

      const close = (result) => {
        refs.submitWarningModal.classList.add('hidden');
        refs.submitWarningCancel.removeEventListener('click', onCancel);
        refs.submitWarningContinue.removeEventListener('click', onContinue);
        refs.submitWarningModal.removeEventListener('click', onBackdrop);
        resolve(result);
      };

      const onCancel = () => {
        close(null);
      };

      const onContinue = () => {
        const acknowledgementValues = {};
        for (const input of inputs) {
          acknowledgementValues[input.dataset.ackKey] = input.checked;
        }
        if (Object.values(acknowledgementValues).some((value) => !value)) {
          showToast('You must agree to each submission statement before continuing.', 'error');
          return;
        }
        close(acknowledgementValues);
      };

      const onBackdrop = (event) => {
        if (event.target === refs.submitWarningModal) {
          close(null);
        }
      };

      refs.submitWarningCancel.addEventListener('click', onCancel);
      refs.submitWarningContinue.addEventListener('click', onContinue);
      refs.submitWarningModal.addEventListener('click', onBackdrop);
      refs.submitWarningModal.classList.remove('hidden');
    });
  }

  function requestPhotoInstructionsReview(options = {}) {
    const { requireContinue = false, dedicatedView = false } = options;
    return new Promise((resolve) => {
      if (
        !refs.photoInstructionsModal ||
        !refs.photoInstructionsBody ||
        !refs.photoInstructionsClose ||
        !refs.photoInstructionsContinue
      ) {
        resolve(false);
        return;
      }

      refs.photoInstructionsBody.innerHTML = renderMarkdown(
        renderInstructionTemplate(hubState?.config?.photoInstructions || '', hubState)
      );
      refs.photoInstructionsBody.scrollTop = 0;
      refs.photoInstructionsModal.scrollTop = 0;
      const hideCloseButton = dedicatedView && requireContinue;
      refs.photoInstructionsContinue.classList.toggle('hidden', !requireContinue);
      refs.photoInstructionsClose.classList.toggle('hidden', hideCloseButton);
      refs.photoInstructionsClose.textContent = dedicatedView ? 'Back to Hub' : 'Close';
      setPhotoInstructionsPresentation(true);

      const close = (result, event = null) => {
        if (dedicatedView && event instanceof MouseEvent) {
          try {
            exitExpandedMode(event);
            resolve(result);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.toLowerCase().includes('already inlined')) {
              showToast(message, 'error');
            }
            try {
              forceExitExpandedView(event);
              resolve(result);
              return;
            } catch (fallbackError) {
              showToast(fallbackError instanceof Error ? fallbackError.message : String(fallbackError), 'error');
            }
          }
        }
        refs.photoInstructionsModal.classList.add('hidden');
        setPhotoInstructionsPresentation(false);
        refs.photoInstructionsClose.removeEventListener('click', onClose);
        refs.photoInstructionsContinue.removeEventListener('click', onContinue);
        refs.photoInstructionsModal.removeEventListener('click', onBackdrop);
        refs.photoInstructionsContinue.classList.add('hidden');
        refs.photoInstructionsClose.classList.remove('hidden');
        refs.photoInstructionsClose.textContent = 'Close';
        if (dedicatedView) {
          window.location.replace(buildInternalNavigationUrl('./hub.html'));
        }
        resolve(result);
      };

      const onClose = (event) => {
        close(requireContinue ? false : true, event);
      };

      const onContinue = (event) => {
        close(true, event);
      };

      const onBackdrop = (event) => {
        if (shouldUseAndroidPhotoInstructionsStep()) {
          return;
        }
        if (event.target === refs.photoInstructionsModal) {
          close(requireContinue ? false : true);
        }
      };

      refs.photoInstructionsClose.addEventListener('click', onClose);
      refs.photoInstructionsContinue.addEventListener('click', onContinue);
      refs.photoInstructionsModal.addEventListener('click', onBackdrop);
      refs.photoInstructionsModal.classList.remove('hidden');
      // Wait until the modal is visible so overflow measurements reflect the final layout.
      window.requestAnimationFrame(() => {
        updatePhotoInstructionsScrollAffordance();
      });
    });
  }

  function openPhotoInstructionsModal(event) {
    if (shouldUseAndroidPhotoInstructionsStep() && !photoInstructionsOnly) {
      persistPhotoInstructionsLaunchMode('view');
      if (inline) {
        try {
          if (event instanceof MouseEvent) {
            requestExpandedMode(event, 'photoInstructions');
            return;
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), 'error');
        }
      }
      window.location.replace(buildInternalNavigationUrl('./photo-instructions.html'));
      return;
    }
    void requestPhotoInstructionsReview();
  }

  function renderState(state) {
    if (!state) {
      return;
    }

    const isRestricted = Boolean(state.viewerBlocked && !state.viewerVerifiedByFlair);

    applyTheme(state.resolvedTheme);
    refs.metaUsername.textContent = state.viewerUsername ? `Username: u/${state.viewerUsername}` : 'Username: not signed in';
    refs.metaSubreddit.textContent = state.subredditName ? `Subreddit: r/${state.subredditName}` : '';

    refs.metaStatus.className = 'status-line';
    let statusText = 'Not verified';
    let statusClass = 'status-neutral';
    if (state.viewerVerifiedByFlair) {
      statusText = isManualSource(state.viewerFlairCheckSource) ? 'Verified (Manual)' : 'Verified';
      statusClass = 'status-verified';
    } else if (isRestricted) {
      statusText = 'Blocked';
      statusClass = 'status-blocked';
    } else if (state.userLatest?.status === 'pending' && state.userLatest?.parentVerificationId) {
      statusText = 'Pending Re-review';
      statusClass = 'status-warning';
    } else if (state.userLatest?.status === 'pending') {
      statusText = 'Pending Review';
      statusClass = 'status-warning';
    } else if (state.userLatest?.status === 'denied') {
      statusText = 'Denied';
      statusClass = 'status-danger';
    } else if (state.userLatest?.status === 'removed') {
      statusText = 'Verification Removed';
      statusClass = 'status-danger';
    }
    refs.metaStatus.classList.add(statusClass);
    refs.metaStatus.textContent = statusText;

    refs.pendingBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount || 0);
    refs.pendingBadge.classList.toggle('hidden', !(state.canReview && state.pendingCount > 0));
    refs.modPanelBtn.classList.toggle('hidden', !state.canReview);

    let commandTitle = 'Review the instructions, then submit your verification.';
    let infoText = '';
    if (!state.viewerVerifiedByFlair && !isRestricted && !state.config.verificationsEnabled) {
      commandTitle = 'Verifications are currently unavailable';
      infoText = String(state.config.verificationsDisabledMessage || '').trim() || 'Verifications are temporarily disabled. Please check back soon.';
    } else if (!state.viewerVerifiedByFlair && !isRestricted && state.userLatest?.status === 'pending') {
      commandTitle = state.userLatest.parentVerificationId ? 'Pending moderator re-review' : 'Pending moderator review';
      infoText = state.userLatest.parentVerificationId
        ? 'Your verification is being reviewed again by the moderators.'
        : 'Your verification is pending moderator review.';
    } else if (!state.viewerVerifiedByFlair && isRestricted) {
      commandTitle = 'Verification submissions are blocked';
      infoText = 'You cannot submit a verification request.';
    } else if (state.viewerVerifiedByFlair) {
      commandTitle = isManualSource(state.viewerFlairCheckSource) ? 'Verification detected' : 'Verification complete';
      if (state.userLatest?.reviewedAt) {
        infoText = `Reviewed ${formatTimestamp(state.userLatest.reviewedAt)}.`;
      }
    } else if (state.userLatest?.status === 'denied') {
      commandTitle = 'Denied - Resubmit your photo(s)';
      const parts = [];
      if (state.userLatest.denyReason) {
        parts.push(`Reason: ${getDenyReasonLabel(state, state.userLatest.denyReason)}.`);
      }
      if (state.userLatest.reviewedAt) {
        parts.push(`Reviewed ${formatTimestamp(state.userLatest.reviewedAt)}.`);
      }
      infoText = parts.join('\n');
    } else if (state.userLatest?.status === 'removed') {
      commandTitle = 'Verification removed';
      if (state.userLatest.removedAt) {
        infoText = `Removed ${formatTimestamp(state.userLatest.removedAt)}.`;
      }
    } else if (state.requiresInitialSetup) {
      commandTitle = 'Setup required';
      infoText = state.canReview
        ? 'Setup is required. Open the Mod Panel > Settings and set a flair template ID to get started. If you do not see the Settings tab in the mod panel, ask a moderator with \"config\" permissions to complete setup.'
        : 'Verification setup is still in progress. Please check back later.';
    }

    refs.commandTitle.textContent = commandTitle;
    refs.infoMsg.textContent = infoText;
    refs.infoMsg.classList.toggle('hidden', !infoText);

    refs.actionRow.innerHTML = '';
    const submitLabel =
      state.userLatest && (state.userLatest.status === 'denied' || state.userLatest.status === 'removed')
        ? 'Resubmit Verification'
        : 'Submit Verification';

    if (state.requiresInitialSetup && moderatorQuickStartUrl) {
      refs.actionRow.appendChild(
        makeButton('Moderator Quick Start', 'btn-secondary', () => {
          navigateTo(moderatorQuickStartUrl);
        })
      );
    }

    if (
      !state.viewerVerifiedByFlair &&
      !isRestricted &&
      !state.requiresInitialSetup &&
      state.config.verificationsEnabled &&
      !(state.userLatest && state.userLatest.status === 'pending')
    ) {
      refs.actionRow.appendChild(
        makeButton('Photo Requirements', 'btn-secondary', (event) => {
          openPhotoInstructionsModal(event);
        })
      );
      refs.actionRow.appendChild(
        makeButton(submitLabel, 'btn-primary', (event) => {
          void openSubmitForm(event);
        })
      );
    }

    if (!state.viewerVerifiedByFlair && !isRestricted && state.userLatest?.status === 'pending') {
      refs.actionRow.appendChild(
        makeButton('Withdraw Pending Verification', 'btn-secondary', () => {
          void performAction('/api/hub/withdraw', {}, {
            refreshOnError(message) {
              return message.includes('No pending verification request found.');
            },
          });
        })
      );
    }

    if (state.viewerVerifiedByFlair) {
      refs.actionRow.appendChild(
        makeButton('Remove Verification', 'btn-danger', () => {
          void openDeleteForm();
        })
      );
    }

    refs.actionRow.classList.toggle('hidden', refs.actionRow.childElementCount === 0);
  }

  function applyPayload(payload) {
    if (!payload) {
      return;
    }
    syncRealtimeSubscription(payload && typeof payload.realtimeChannel === 'string' ? payload.realtimeChannel : '');
    if (payload.toast?.text) {
      showToast(payload.toast.text, payload.toast.tone || 'info');
    }
    hubState = payload.state ?? hubState;
    hubForms = payload.forms ?? hubForms;
    modPanelPath = typeof payload.modPanelPath === 'string' && payload.modPanelPath ? payload.modPanelPath : modPanelPath;
    if (hubState) {
      refs.loadingScreen.classList.add('hidden');
      if (!photoInstructionsOnly) {
        refs.mainContent.classList.remove('hidden');
      }
      renderState(hubState);
      if (photoInstructionsOnly && !photoInstructionsOnlyHandled) {
        photoInstructionsOnlyHandled = true;
        void requestPhotoInstructionsReview({
          dedicatedView: true,
          requireContinue: photoInstructionsLaunchMode === 'submit',
        });
      }
    }
  }

  async function refreshState(options = {}) {
    const { silent = false } = options;
    setBusy(true);
    try {
      applyPayload(await requestJson('/api/hub/state'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!hubState) {
        refs.loadingScreen.textContent = `Unable to load verification state: ${message}`;
      }
      if (!silent) {
        showToast(message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function scheduleAutoRefresh() {
    if (autoRefreshTimerId) {
      window.clearInterval(autoRefreshTimerId);
    }
    autoRefreshTimerId = window.setInterval(() => {
      if (document.hidden || isBusy || (realtimeChannel && realtimeLiveChannel === realtimeChannel)) {
        return;
      }
      void refreshState({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || isBusy) {
      return;
    }
    if (realtimeRefreshQueued && !realtimeRefreshInFlight) {
      realtimeRefreshQueued = false;
      void refreshFromRealtimeSignal();
      return;
    }
    if (!(realtimeChannel && realtimeLiveChannel === realtimeChannel)) {
      void refreshState({ silent: true });
    }
  });

  window.addEventListener('beforeunload', () => {
    closeRealtimeSubscription();
  });

  refs.modPanelBtn.addEventListener('click', (event) => {
    if (inline) {
      try {
        if (event instanceof MouseEvent) {
          requestExpandedMode(event, 'modPanel');
          return;
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), 'error');
      }
    }
    window.location.replace(buildInternalNavigationUrl(modPanelPath || './mod-panel.html'));
  });

  scheduleAutoRefresh();
  void refreshState();
}
