export function isWizardRunActive(step, mode) {
  return Number.isInteger(step) && step >= 0 && Boolean(mode);
}

export function resolveReconciledWizardStepIndex(currentStepId, currentIndex, nextStepIds) {
  if (!Array.isArray(nextStepIds) || nextStepIds.length === 0) {
    return -1;
  }
  const matchingIndex = currentStepId ? nextStepIds.indexOf(currentStepId) : -1;
  if (matchingIndex >= 0) {
    return matchingIndex;
  }
  const safeCurrentIndex = Number.isInteger(currentIndex) ? currentIndex : 0;
  return Math.min(Math.max(0, safeCurrentIndex), nextStepIds.length - 1);
}
