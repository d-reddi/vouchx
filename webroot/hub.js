import { showForm, showToast as devvitShowToast } from '@devvit/web/client';

let hubState = null;
let hubForms = null;
let modPanelPath = './mod-panel.html';
let isBusy = false;

const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');
const metaSubreddit = document.getElementById('meta-subreddit');
const metaUsername = document.getElementById('meta-username');
const metaStatus = document.getElementById('meta-status');
const pendingBadge = document.getElementById('pending-badge');
const refreshBtn = document.getElementById('refresh-btn');
const modPanelBtn = document.getElementById('mod-panel-btn');
const infoMsg = document.getElementById('info-msg');
const actionRow = document.getElementById('action-row');
const submissionBox = document.getElementById('submission-box');

const DENY_REASON_LABEL = {
  photoshop: 'Photoshop',
  unclear_image: 'Unclear image',
  did_not_follow_instructions: 'Did not follow written instructions',
  other: 'Other',
};

function setBusy(next) {
  isBusy = Boolean(next);
  for (const button of document.querySelectorAll('button')) {
    if (button.id === 'refresh-btn') {
      continue;
    }
    button.disabled = isBusy;
  }
}

function showToast(text, tone = 'info') {
  devvitShowToast({
    text,
    appearance: tone === 'success' ? 'success' : 'neutral',
  });
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

function renderState(state) {
  if (!state) {
    return;
  }

  applyTheme(state.resolvedTheme);
  metaSubreddit.textContent = `Subreddit: r/${state.subredditName || ''}`;
  metaUsername.textContent = state.viewerUsername ? `Username: u/${state.viewerUsername}` : 'Username: not signed in';

  metaStatus.className = 'status-line';
  let statusText = 'Not verified';
  if (state.viewerBlocked) {
    statusText = 'Blocked';
    metaStatus.classList.add('status-blocked');
  } else if (state.viewerVerifiedByFlair) {
    statusText = isManualSource(state.viewerFlairCheckSource) ? 'Verified (Manual)' : 'Verified';
    metaStatus.classList.add('status-verified');
  } else if (state.userLatest?.status === 'pending' && state.userLatest?.parentVerificationId) {
    statusText = 'Pending re-review';
    metaStatus.classList.add('status-pending');
  } else if (state.userLatest?.status === 'pending') {
    statusText = 'Pending review';
    metaStatus.classList.add('status-pending');
  } else {
    metaStatus.classList.add('status-danger');
  }
  metaStatus.textContent = `Status: ${statusText}`;

  pendingBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount || 0);
  pendingBadge.classList.toggle('hidden', !(state.canReview && state.pendingCount > 0));

  modPanelBtn.classList.toggle('hidden', !state.canReview);

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
  infoMsg.textContent = infoText;
  infoMsg.classList.toggle('hidden', !infoText);

  actionRow.innerHTML = '';
  const submitLabel = state.userLatest && (state.userLatest.status === 'denied' || state.userLatest.status === 'removed')
    ? 'Resubmit Verification'
    : 'Submit Verification';

  if (
    !state.viewerVerifiedByFlair &&
    !state.viewerBlocked &&
    state.config.verificationsEnabled &&
    !(state.userLatest && state.userLatest.status === 'pending')
  ) {
    actionRow.appendChild(makeButton(submitLabel, 'btn-primary', () => {
      void openSubmitForm();
    }));
  }

  if (!state.viewerVerifiedByFlair && !state.viewerBlocked && state.userLatest?.status === 'pending') {
    actionRow.appendChild(makeButton('Withdraw Pending Verification', 'btn-secondary', () => {
      void performAction('/api/hub/withdraw');
    }));
  }

  if (state.viewerVerifiedByFlair) {
    actionRow.appendChild(makeButton('Remove Verification', 'btn-danger', () => {
      void openDeleteForm();
    }));
  }

  if (!state.viewerBlocked && state.userLatest) {
    const statusLabel = state.userLatest.status === 'removed'
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
    const photos = [
      state.userLatest.photoOneUrl,
      state.userLatest.photoTwoUrl,
      state.userLatest.photoThreeUrl,
    ].filter((value) => typeof value === 'string' && value.trim());
    if (photos.length > 0) {
      pieces.push(
        `<div class="photo-row">${photos
          .map((url, index) => `<a class="photo-link btn-secondary" href="${url}" target="_blank" rel="noreferrer">Photo ${index + 1}</a>`)
          .join('')}</div>`
      );
    }
    submissionBox.innerHTML = pieces.join('');
    submissionBox.classList.remove('hidden');
  } else if (!state.viewerBlocked) {
    submissionBox.innerHTML = '<p>No verification submission yet.</p>';
    submissionBox.classList.remove('hidden');
  } else {
    submissionBox.classList.add('hidden');
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
    loadingScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    renderState(hubState);
  }
}

async function refreshState() {
  setBusy(true);
  try {
    applyPayload(await requestJson('/api/hub/state'));
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    setBusy(false);
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

refreshBtn.addEventListener('click', () => {
  void refreshState();
});

modPanelBtn.addEventListener('click', () => {
  window.location.assign(modPanelPath || './mod-panel.html');
});

void refreshState();
