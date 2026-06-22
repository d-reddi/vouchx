import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isWizardRunActive,
  resolveReconciledWizardStepIndex,
} from './wizard-state.js';

test('an initialized wizard run stays active while server eligibility changes', () => {
  assert.equal(isWizardRunActive(6, 'setup'), true);
  assert.equal(isWizardRunActive(0, 'onboarding'), true);
  assert.equal(isWizardRunActive(-1, 'setup'), false);
  assert.equal(isWizardRunActive(2, null), false);
});

test('wizard step reconciliation preserves the current step when permissions change elsewhere', () => {
  assert.equal(
    resolveReconciledWizardStepIndex('history', 8, ['welcome', 'queue', 'history', 'complete']),
    2
  );
});

test('wizard step reconciliation advances safely when the current step becomes inaccessible', () => {
  assert.equal(
    resolveReconciledWizardStepIndex('settings', 8, ['welcome', 'queue', 'history', 'complete']),
    3
  );
  assert.equal(resolveReconciledWizardStepIndex('settings', 2, []), -1);
});
