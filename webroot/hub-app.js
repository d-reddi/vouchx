import { requestExpandedMode, showForm, showToast as devvitShowToast } from '@devvit/web/client';

const DENY_REASON_LABEL = {
  photoshop: 'Photoshop',
  unclear_image: 'Unclear image',
  did_not_follow_instructions: 'Did not follow written instructions',
  other: 'Other',
};

function createShell(root, inline) {
  root.innerHTML = `
    <div class="shell">
      <div data-el="loading" class="loading-screen">${inline ? 'Loading verification panel...' : 'Loading Verification Hub...'}</div>
      <div data-el="main" class="hidden">
        <section class="card">
          <div class="card-header">
            <div>
              <h1>Verification Hub</h1>
              <p class="meta">Submit photos, check your status, or review pending requests.</p>
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

  function setBusy(next) {
    isBusy = Boolean(next);
    for (const button of root.querySelectorAll('button')) {
      if (button === refs.refreshBtn) {
        continue;
      }
      button.disabled = isBusy;
    }
  }

  async function performAction(path, body) {
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
    const result = await showForm(hubForms.submit);
    if (!result || result.action !== 'SUBMITTED') {
      return;
    }
    await performAction('/api/hub/submit', result.values);
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

  function renderState(state) {
    if (!state) {
      return;
    }

    applyTheme(state.resolvedTheme);
    refs.metaSubreddit.textContent = `Subreddit: r/${state.subredditName || ''}`;
    refs.metaUsername.textContent = state.viewerUsername ? `Username: u/${state.viewerUsername}` : 'Username: not signed in';

    refs.metaStatus.className = 'status-line';
    let statusText = 'Not verified';
    if (state.viewerBlocked) {
      statusText = 'Blocked';
      refs.metaStatus.classList.add('status-blocked');
    } else if (state.viewerVerifiedByFlair) {
      statusText = isManualSource(state.viewerFlairCheckSource) ? 'Verified (Manual)' : 'Verified';
      refs.metaStatus.classList.add('status-verified');
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
    if (!state.viewerVerifiedByFlair && !state.viewerBlocked && !state.config.verificationsEnabled) {
      infoText = 'Verifications are temporarily disabled. Please check back soon.';
    } else if (!state.viewerVerifiedByFlair && !state.viewerBlocked && state.userLatest?.status === 'pending') {
      infoText = state.userLatest.parentVerificationId
        ? 'Your verification is pending moderator re-review.'
        : 'Your verification is pending moderator review.';
    } else if (!state.viewerVerifiedByFlair && state.viewerBlocked) {
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
      !state.viewerBlocked &&
      state.config.verificationsEnabled &&
      !(state.userLatest && state.userLatest.status === 'pending')
    ) {
      refs.actionRow.appendChild(
        makeButton(submitLabel, 'btn-primary', () => {
          void openSubmitForm();
        })
      );
    }

    if (!state.viewerVerifiedByFlair && !state.viewerBlocked && state.userLatest?.status === 'pending') {
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

    if (!state.viewerBlocked && state.userLatest) {
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
        pieces.push(`<p>Reason: ${DENY_REASON_LABEL[state.userLatest.denyReason] || state.userLatest.denyReason}</p>`);
      }
      refs.submissionBox.innerHTML = pieces.join('');
      refs.submissionBox.classList.remove('hidden');
    } else if (!state.viewerBlocked) {
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

  async function refreshState() {
    setBusy(true);
    try {
      applyPayload(await requestJson('/api/hub/state'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!hubState) {
        refs.loadingScreen.textContent = `Unable to load verification state: ${message}`;
      }
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
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

  void refreshState();
}
