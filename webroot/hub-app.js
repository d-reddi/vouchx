import { navigateTo, requestExpandedMode, showForm, showToast as devvitShowToast } from '@devvit/web/client';

const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const TERMS_AND_CONDITIONS_URL = 'https://www.reddit.com/r/vouchx/wiki/terms-and-conditions/';
const PRIVACY_POLICY_URL = 'https://www.reddit.com/r/vouchx/wiki/privacy-policy/';
const SUBMIT_ACKNOWLEDGEMENTS = [
  {
    key: 'is18Confirmed',
    label: 'I am at least 18 years old.',
  },
  {
    key: 'adultOnlySelfPhotosConfirmed',
    label: 'Any uploaded photo(s) are of me and do not depict anyone under the age of 18.',
  },
  {
    key: 'termsAccepted',
    label: 'I have read and accept the Terms and Conditions of the VouchX app.',
  },
];

function createShell(root, inline) {
  root.innerHTML = `
    <div class="shell">
      <div data-el="loading" class="loading-screen">${inline ? 'Loading verification panel...' : 'Loading Verification Hub...'}</div>
      <div data-el="main" class="hidden">
        <section class="card">
          <div class="card-header">
            <div>
              <h1>Verification Hub</h1>
              <p data-el="meta-subreddit" class="meta"></p>
              <p data-el="meta-username" class="meta"></p>
              <p data-el="meta-status" class="status-line"></p>
            </div>
            <div class="row" style="margin-top: 0">
              <span data-el="pending-badge" class="badge hidden"></span>
              <button data-el="refresh-btn" class="btn-secondary" type="button">Refresh</button>
            </div>
          </div>
          <div class="row">
            <button data-el="mod-panel-btn" class="btn-secondary hidden" type="button">Open Moderator Panel</button>
          </div>
        </section>

        <section class="card">
          <h2>Verification</h2>
          <p data-el="info-msg" class="info-msg hidden"></p>
          <div data-el="action-row" class="row"></div>
          <div data-el="submission-box" class="submission-box hidden"></div>
        </section>

        <footer data-el="legal-links" class="legal-links hidden"></footer>
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
          <h2>Photo Instructions</h2>
          <p class="meta">
            Review these instructions before opening the upload form.
          </p>
          <div data-el="photo-instructions-body" class="markdown-body hub-modal-copy"></div>
          <div class="row">
            <button data-el="photo-instructions-close" class="btn-secondary" type="button">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    loadingScreen: root.querySelector('[data-el="loading"]'),
    mainContent: root.querySelector('[data-el="main"]'),
    metaSubreddit: root.querySelector('[data-el="meta-subreddit"]'),
    metaUsername: root.querySelector('[data-el="meta-username"]'),
    metaStatus: root.querySelector('[data-el="meta-status"]'),
    pendingBadge: root.querySelector('[data-el="pending-badge"]'),
    refreshBtn: root.querySelector('[data-el="refresh-btn"]'),
    modPanelBtn: root.querySelector('[data-el="mod-panel-btn"]'),
    infoMsg: root.querySelector('[data-el="info-msg"]'),
    actionRow: root.querySelector('[data-el="action-row"]'),
    submissionBox: root.querySelector('[data-el="submission-box"]'),
    legalLinks: root.querySelector('[data-el="legal-links"]'),
    submitWarningModal: root.querySelector('[data-el="submit-warning-modal"]'),
    submitWarningList: root.querySelector('[data-el="submit-warning-list"]'),
    submitWarningLinks: root.querySelector('[data-el="submit-warning-links"]'),
    submitWarningCancel: root.querySelector('[data-el="submit-warning-cancel"]'),
    submitWarningContinue: root.querySelector('[data-el="submit-warning-continue"]'),
    photoInstructionsModal: root.querySelector('[data-el="photo-instructions-modal"]'),
    photoInstructionsBody: root.querySelector('[data-el="photo-instructions-body"]'),
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
  return typeof source === 'string' && source.includes('css-wildcard-match');
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
    return '<p class="markdown-empty">No photo instructions have been configured yet.</p>';
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

export function mountHub(options = {}) {
  const { rootId = 'app-root', inline = false } = options;
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
  const legalLinks = [
    { label: 'Terms and Conditions', url: normalizeExternalUrl(TERMS_AND_CONDITIONS_URL) },
    { label: 'Privacy Policy', url: normalizeExternalUrl(PRIVACY_POLICY_URL) },
  ];

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
    for (const item of legalLinks) {
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

  if (refs.photoInstructionsClose && refs.photoInstructionsModal) {
    refs.photoInstructionsClose.addEventListener('click', () => {
      refs.photoInstructionsModal.classList.add('hidden');
    });
    refs.photoInstructionsModal.addEventListener('click', (event) => {
      if (event.target === refs.photoInstructionsModal) {
        refs.photoInstructionsModal.classList.add('hidden');
      }
    });
  }

  function setBusy(next) {
    isBusy = Boolean(next);
    for (const button of root.querySelectorAll('button')) {
      if (button === refs.refreshBtn) {
        continue;
      }
      button.disabled = isBusy;
    }
  }

  async function performAction(path, body = {}) {
    setBusy(true);
    try {
      applyPayload(await requestJson(path, body));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openSubmitForm() {
    if (!hubForms?.submit) {
      return;
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

  function openPhotoInstructionsModal() {
    if (!refs.photoInstructionsModal || !refs.photoInstructionsBody) {
      return;
    }
    refs.photoInstructionsBody.innerHTML = renderMarkdown(
      renderInstructionTemplate(hubState?.config?.photoInstructions || '', hubState)
    );
    refs.photoInstructionsModal.classList.remove('hidden');
  }

  function renderState(state) {
    if (!state) {
      return;
    }

    const isRestricted = Boolean(state.viewerBlocked && !state.viewerVerifiedByFlair);

    applyTheme(state.resolvedTheme);
    refs.metaSubreddit.textContent = `Subreddit: r/${state.subredditName || ''}`;
    refs.metaUsername.textContent = state.viewerUsername ? `Username: u/${state.viewerUsername}` : 'Username: not signed in';

    refs.metaStatus.className = 'status-line';
    let statusText = 'Not verified';
    if (state.viewerVerifiedByFlair) {
      statusText = isManualSource(state.viewerFlairCheckSource) ? 'Verified (Manual)' : 'Verified';
      refs.metaStatus.classList.add('status-verified');
    } else if (isRestricted) {
      statusText = 'Blocked';
      refs.metaStatus.classList.add('status-blocked');
    } else if (state.userLatest?.status === 'pending' && state.userLatest?.parentVerificationId) {
      statusText = 'Pending re-review';
      refs.metaStatus.classList.add('status-pending');
    } else if (state.userLatest?.status === 'pending') {
      statusText = 'Pending review';
      refs.metaStatus.classList.add('status-pending');
    } else {
      refs.metaStatus.classList.add('status-danger');
    }
    refs.metaStatus.textContent = `Status: ${statusText}`;

    refs.pendingBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount || 0);
    refs.pendingBadge.classList.toggle('hidden', !(state.canReview && state.pendingCount > 0));
    refs.modPanelBtn.classList.toggle('hidden', !state.canReview);

    let infoText = '';
    if (!state.viewerVerifiedByFlair && !isRestricted && !state.config.verificationsEnabled) {
      infoText = String(state.config.verificationsDisabledMessage || '').trim() || 'Verifications are temporarily disabled. Please check back soon.';
    } else if (!state.viewerVerifiedByFlair && !isRestricted && state.userLatest?.status === 'pending') {
      infoText = state.userLatest.parentVerificationId
        ? 'Your verification is pending moderator re-review.'
        : 'Your verification is pending moderator review.';
    } else if (!state.viewerVerifiedByFlair && isRestricted) {
      infoText = 'You cannot submit a verification request.';
    }
    refs.infoMsg.textContent = infoText;
    refs.infoMsg.classList.toggle('hidden', !infoText);

    refs.actionRow.innerHTML = '';
    const submitLabel =
      state.userLatest && (state.userLatest.status === 'denied' || state.userLatest.status === 'removed')
        ? 'Resubmit Verification'
        : 'Submit Verification';

    if (
      !state.viewerVerifiedByFlair &&
      !isRestricted &&
      state.config.verificationsEnabled &&
      !(state.userLatest && state.userLatest.status === 'pending')
    ) {
      refs.actionRow.appendChild(
        makeButton('Photo Instructions', 'btn-secondary', () => {
          openPhotoInstructionsModal();
        })
      );
      refs.actionRow.appendChild(
        makeButton(submitLabel, 'btn-primary', () => {
          void openSubmitForm();
        })
      );
    }

    if (!state.viewerVerifiedByFlair && !isRestricted && state.userLatest?.status === 'pending') {
      refs.actionRow.appendChild(
        makeButton('Withdraw Pending Verification', 'btn-secondary', () => {
          void performAction('/api/hub/withdraw');
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

    if ((!isRestricted || state.viewerVerifiedByFlair) && state.userLatest) {
      const statusLabel =
        state.userLatest.status === 'removed'
          ? 'REVOKED'
          : state.userLatest.status === 'pending' && state.userLatest.parentVerificationId
            ? 'PENDING (RE-REVIEW)'
            : state.userLatest.status.toUpperCase();
      const pieces = [
        `<p><strong>Latest submission status:</strong> ${statusLabel}</p>`,
        `<p>Submitted: ${formatTimestamp(state.userLatest.submittedAt)}</p>`,
      ];
      if (state.userLatest.reviewedAt) {
        pieces.push(`<p>Reviewed: ${formatTimestamp(state.userLatest.reviewedAt)}</p>`);
      }
      if (state.userLatest.status === 'denied' && state.userLatest.denyReason) {
        pieces.push(`<p>Reason: ${escapeHtml(getDenyReasonLabel(state, state.userLatest.denyReason))}</p>`);
      }
      refs.submissionBox.innerHTML = pieces.join('');
      refs.submissionBox.classList.remove('hidden');
    } else if (!isRestricted || state.viewerVerifiedByFlair) {
      refs.submissionBox.innerHTML = '<p>No verification submission yet.</p>';
      refs.submissionBox.classList.remove('hidden');
    } else {
      refs.submissionBox.classList.add('hidden');
    }
  }

  function applyPayload(payload) {
    if (!payload) {
      return;
    }
    if (payload.toast?.text) {
      showToast(payload.toast.text, payload.toast.tone || 'info');
    }
    hubState = payload.state ?? hubState;
    hubForms = payload.forms ?? hubForms;
    modPanelPath = typeof payload.modPanelPath === 'string' && payload.modPanelPath ? payload.modPanelPath : modPanelPath;
    if (hubState) {
      refs.loadingScreen.classList.add('hidden');
      refs.mainContent.classList.remove('hidden');
      renderState(hubState);
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
      if (document.hidden || isBusy) {
        return;
      }
      void refreshState({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  refs.refreshBtn.addEventListener('click', () => {
    void refreshState();
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
    window.location.assign(modPanelPath || './mod-panel.html');
  });

  scheduleAutoRefresh();
  void refreshState();
}
