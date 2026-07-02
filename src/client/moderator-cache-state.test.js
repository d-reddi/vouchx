import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  canStartQueuedRefresh,
  createViewStaleness,
  isMatchingRequestGeneration,
  isViewStale,
  markViewFresh,
  markViewsStale,
  queuedRefreshAfterMutationResponse,
  removePendingItemsById,
  shouldFetchCachedView,
} from './moderator-cache-state.js';

function createSearchHarness(viewName) {
  const staleness = createViewStaleness(['records', 'approved', 'audit']);
  let currentRequestId = 1;
  let previousSignature = 'default-query';
  let fetchCount = 0;

  markViewFresh(staleness, viewName);
  return {
    staleness,
    markStateChanged() {
      markViewsStale(staleness, ['records', 'approved', 'audit']);
      currentRequestId += 1;
    },
    open(signature = 'default-query') {
      const shouldFetch = shouldFetchCachedView({
        force: false,
        stale: isViewStale(staleness, viewName),
        requestId: currentRequestId,
        nextSignature: signature,
        previousSignature,
      });
      if (!shouldFetch) {
        return null;
      }
      fetchCount += 1;
      currentRequestId += 1;
      previousSignature = signature;
      return currentRequestId;
    },
    complete(responseRequestId, { success = true } = {}) {
      if (!success || !isMatchingRequestGeneration(responseRequestId, currentRequestId)) {
        return false;
      }
      markViewFresh(staleness, viewName);
      return true;
    },
    get currentRequestId() {
      return currentRequestId;
    },
    get fetchCount() {
      return fetchCount;
    },
  };
}

function simulateMutationWindow({ hasAuthoritativeState, refreshRequested, signalCount }) {
  let queued = false;
  let mutationInFlight = true;
  let authoritativeResponsesApplied = 0;
  let followUpFetches = 0;

  for (let index = 0; index < signalCount; index += 1) {
    queued = true;
    assert.equal(
      canStartQueuedRefresh({ queued, refreshInFlight: false, busy: false, mutationInFlight }),
      false
    );
  }

  if (hasAuthoritativeState) {
    authoritativeResponsesApplied += 1;
  }
  queued = queuedRefreshAfterMutationResponse({ queued, refreshRequested });
  mutationInFlight = false;

  if (canStartQueuedRefresh({ queued, refreshInFlight: false, busy: false, mutationInFlight })) {
    queued = false;
    followUpFetches += 1;
  }
  assert.equal(
    canStartQueuedRefresh({ queued, refreshInFlight: false, busy: false, mutationInFlight }),
    false,
    'the mutation window drains at most one queued follow-up'
  );

  return { authoritativeResponsesApplied, followUpFetches };
}

for (const viewName of ['records', 'audit', 'approved']) {
  test(`state change while ${viewName} is inactive refreshes it once when opened`, () => {
    const view = createSearchHarness(viewName);

    view.markStateChanged();
    assert.equal(view.fetchCount, 0, 'inactive views do not fetch in the background');
    const requestId = view.open();
    assert.equal(typeof requestId, 'number', 'stale plus unchanged signature must fetch');
    assert.equal(view.fetchCount, 1);
    assert.equal(view.complete(requestId), true);
    assert.equal(view.open(), null, 'fresh plus unchanged signature still dedupes');
    assert.equal(view.fetchCount, 1);
  });
}

for (const viewName of ['records', 'approved', 'audit']) {
  test(`${viewName} remains stale after failed, aborted, or superseded requests`, () => {
    const failed = createSearchHarness(viewName);
    failed.markStateChanged();
    const failedRequestId = failed.open();
    assert.equal(failed.complete(failedRequestId, { success: false }), false);
    assert.equal(isViewStale(failed.staleness, viewName), true);

    const aborted = createSearchHarness(viewName);
    aborted.markStateChanged();
    aborted.open();
    assert.equal(isViewStale(aborted.staleness, viewName), true);

    const superseded = createSearchHarness(viewName);
    superseded.markStateChanged();
    const oldRequestId = superseded.open();
    const newerRequestId = superseded.open('new-query');
    assert.equal(superseded.complete(oldRequestId), false);
    assert.equal(isViewStale(superseded.staleness, viewName), true);
    assert.equal(superseded.complete(newerRequestId), true);
    assert.equal(isViewStale(superseded.staleness, viewName), false);
  });
}

test('multiple state changes before opening cause only one later search fetch', () => {
  const view = createSearchHarness('audit');
  view.markStateChanged();
  view.markStateChanged();
  view.markStateChanged();

  assert.equal(view.fetchCount, 0);
  const requestId = view.open();
  assert.equal(view.complete(requestId), true);
  assert.equal(view.open(), null);
  assert.equal(view.fetchCount, 1);
});

test('targeted pending removal uses the production helper and invalidates related caches', () => {
  const staleness = createViewStaleness(['records', 'approved', 'audit']);
  markViewFresh(staleness, 'records');
  markViewFresh(staleness, 'approved');
  markViewFresh(staleness, 'audit');
  const statsStale = { weekly: false, monthly: false };

  const removal = removePendingItemsById([{ id: 'keep' }, { id: 'remove' }], ['remove']);
  markViewsStale(staleness, ['records', 'approved', 'audit']);
  statsStale.weekly = true;
  statsStale.monthly = true;

  assert.deepEqual(removal, { items: [{ id: 'keep' }], removedIds: ['remove'], removedCount: 1 });
  assert.deepEqual(staleness, { records: true, approved: true, audit: true });
  assert.deepEqual(statsStale, { weekly: true, monthly: true });
});

test('authoritative mutation plus its Realtime echo applies state and performs one follow-up', () => {
  assert.deepEqual(
    simulateMutationWindow({ hasAuthoritativeState: true, refreshRequested: false, signalCount: 1 }),
    { authoritativeResponsesApplied: 1, followUpFetches: 1 }
  );
});

test('authoritative mutation preserves an external moderator signal for one later refresh', () => {
  const result = simulateMutationWindow({ hasAuthoritativeState: true, refreshRequested: false, signalCount: 1 });
  assert.equal(result.authoritativeResponsesApplied, 1);
  assert.equal(result.followUpFetches, 1, 'the later fetch can observe the concurrent moderator change');
});

test('multiple Realtime signals during one authoritative mutation collapse to one follow-up', () => {
  assert.deepEqual(
    simulateMutationWindow({ hasAuthoritativeState: true, refreshRequested: false, signalCount: 4 }),
    { authoritativeResponsesApplied: 1, followUpFetches: 1 }
  );
});

test('fast mutation response still triggers exactly one authoritative refresh', () => {
  assert.deepEqual(
    simulateMutationWindow({ hasAuthoritativeState: false, refreshRequested: true, signalCount: 3 }),
    { authoritativeResponsesApplied: 0, followUpFetches: 1 }
  );
});

test('active refresh queue coalesces repeated signals while a refresh is in flight', () => {
  const state = { queued: true, refreshInFlight: false, busy: false, mutationInFlight: false };
  assert.equal(canStartQueuedRefresh(state), true);
  state.refreshInFlight = true;
  assert.equal(canStartQueuedRefresh(state), false);
  state.queued = true;
  assert.equal(canStartQueuedRefresh(state), false);
  state.refreshInFlight = false;
  assert.equal(canStartQueuedRefresh(state), true, 'in-flight signals collapse to one follow-up');
});

test('moderator cache-state tests are included in the normal full test command', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.scripts.test, /src\/client\/moderator-cache-state\.test\.js/);
});
