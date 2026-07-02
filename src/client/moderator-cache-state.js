export function createViewStaleness(viewNames) {
  return Object.fromEntries(viewNames.map((viewName) => [viewName, true]));
}

export function markViewsStale(staleness, viewNames) {
  for (const viewName of viewNames) {
    staleness[viewName] = true;
  }
}

export function markViewFresh(staleness, viewName) {
  staleness[viewName] = false;
}

export function isViewStale(staleness, viewName) {
  return staleness[viewName] !== false;
}

export function shouldFetchCachedView({ force, stale, requestId, nextSignature, previousSignature }) {
  return Boolean(force || stale || requestId <= 0 || nextSignature !== previousSignature);
}

export function canStartQueuedRefresh({ queued, refreshInFlight, busy, mutationInFlight }) {
  return Boolean(queued && !refreshInFlight && !busy && !mutationInFlight);
}

export function queuedRefreshAfterMutationResponse({ queued, refreshRequested }) {
  return Boolean(queued || refreshRequested);
}

export function isMatchingRequestGeneration(responseRequestId, currentRequestId) {
  return Number(responseRequestId || 0) === Number(currentRequestId || 0);
}

export function removePendingItemsById(items, verificationIds) {
  const idsToRemove = new Set(verificationIds.map((id) => String(id || '').trim()).filter(Boolean));
  if (!Array.isArray(items) || idsToRemove.size === 0) {
    return { items: Array.isArray(items) ? items : [], removedIds: [], removedCount: 0 };
  }
  const removedIds = [];
  const nextItems = items.filter((item) => {
    const id = String(item && item.id || '');
    if (!idsToRemove.has(id)) {
      return true;
    }
    removedIds.push(id);
    return false;
  });
  return { items: nextItems, removedIds, removedCount: removedIds.length };
}
