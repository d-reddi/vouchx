import { requestExpandedMode, showToast } from '@devvit/web/client';

const statusTitle = document.getElementById('status-title');
const statusCopy = document.getElementById('status-copy');
const metaLine = document.getElementById('meta-line');
const openHubBtn = document.getElementById('open-hub-btn');
const openModBtn = document.getElementById('open-mod-btn');

async function requestJson(path) {
  const response = await fetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' && payload.error ? payload.error : `Request failed: ${response.status}`);
  }
  return payload;
}

function renderStatus(payload) {
  const state = payload?.state;
  if (!state) {
    statusTitle.textContent = 'Unable to load';
    statusCopy.textContent = 'The launch screen could not load the current post state.';
    metaLine.textContent = 'Tap Open Verification Hub to continue.';
    return;
  }

  if (state.viewerBlocked) {
    statusTitle.textContent = 'Submission blocked';
    statusCopy.textContent = 'Your account cannot submit a verification request right now.';
  } else if (state.viewerVerifiedByFlair) {
    statusTitle.textContent = 'Verified';
    statusCopy.textContent = 'Your flair already indicates a completed verification.';
  } else if (state.userLatest?.status === 'pending' && state.userLatest?.parentVerificationId) {
    statusTitle.textContent = 'Pending re-review';
    statusCopy.textContent = 'Your most recent submission is waiting for moderator re-review.';
  } else if (state.userLatest?.status === 'pending') {
    statusTitle.textContent = 'Pending review';
    statusCopy.textContent = 'Your latest verification request is waiting for moderator review.';
  } else {
    statusTitle.textContent = 'Ready to submit';
    statusCopy.textContent = state.config?.verificationsEnabled === false
      ? 'Verifications are currently paused by the moderators.'
      : 'Open the full hub to submit verification photos or review your latest status.';
  }

  metaLine.textContent = state.viewerUsername
    ? `u/${state.viewerUsername} in r/${state.subredditName}`
    : `Open the hub in r/${state.subredditName}`;

  openModBtn.classList.toggle('hidden', !state.canReview);
}

openHubBtn.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'hub');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
});

openModBtn.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'modPanel');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
});

async function init() {
  try {
    renderStatus(await requestJson('/api/hub/state'));
  } catch (error) {
    statusTitle.textContent = 'Unable to load';
    statusCopy.textContent = error instanceof Error ? error.message : String(error);
    metaLine.textContent = 'Tap Open Verification Hub to continue.';
  }
}

void init();
