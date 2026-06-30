import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldApplyHubRefreshSignal } from './realtime-filter.js';

test('global refresh signal (no usernames) applies to everyone', () => {
  assert.equal(
    shouldApplyHubRefreshSignal({ type: 'refresh' }, { viewerUsername: 'someone', canReview: false }),
    true
  );
  assert.equal(
    shouldApplyHubRefreshSignal({ type: 'refresh', usernames: [] }, { viewerUsername: 'someone', canReview: false }),
    true
  );
});

test('targeted signal applies when the viewer username matches (case-insensitive)', () => {
  assert.equal(
    shouldApplyHubRefreshSignal(
      { type: 'refresh', usernames: ['ornery_locksmith_176'] },
      { viewerUsername: 'Ornery_Locksmith_176', canReview: false }
    ),
    true
  );
});

test('targeted signal is ignored by a non-matching regular viewer', () => {
  assert.equal(
    shouldApplyHubRefreshSignal(
      { type: 'refresh', usernames: ['other_user'] },
      { viewerUsername: 'Ornery_Locksmith_176', canReview: false }
    ),
    false
  );
});

test('reviewers always refresh on a targeted signal so the pending bubble stays current', () => {
  assert.equal(
    shouldApplyHubRefreshSignal(
      { type: 'refresh', usernames: ['other_user'] },
      { viewerUsername: 'mod_one', canReview: true }
    ),
    true
  );
});

test('non-refresh, malformed, or unidentified-viewer signals do not apply', () => {
  assert.equal(shouldApplyHubRefreshSignal(null, { canReview: true }), false);
  assert.equal(shouldApplyHubRefreshSignal({ type: 'other' }, { canReview: true }), false);
  // Targeted signal but the viewer's identity isn't known yet (no username, not a reviewer).
  assert.equal(
    shouldApplyHubRefreshSignal({ type: 'refresh', usernames: ['x'] }, { viewerUsername: '', canReview: false }),
    false
  );
});
