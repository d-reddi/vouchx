import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearExpiredPendingClaim,
  ensureUserValidationSchedule,
  normalizeSubmittedPhotoUrl,
  toPublicHubConfig,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  withRedisLock,
  type RuntimeConfig,
} from './core.ts';

function buildRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'verification_123',
    username: 'example_user',
    subredditId: 't5_example',
    subredditName: 'example',
    ageAcknowledgedAt: '2026-03-11T12:00:00.000Z',
    submittedAt: '2026-03-11T12:00:00.000Z',
    photoOneUrl: 'https://i.redd.it/example.png',
    photoTwoUrl: '',
    photoThreeUrl: '',
    status: 'pending' as const,
    moderator: null,
    reviewedAt: null,
    denyReason: null,
    denyNotes: null,
    claimedBy: null,
    claimedAt: null,
    parentVerificationId: null,
    isResubmission: false,
    removedAt: null,
    removedBy: null,
    lastValidatedAt: null,
    nextValidationAt: null,
    hardExpireAt: null,
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
    lastTtlBumpAt: null,
    lastAppliedFlairTemplateId: null,
    lastFlairReconcileAt: null,
    ...overrides,
  };
}

function buildRuntimeConfig(): RuntimeConfig {
  return {
    verificationsEnabled: true,
    verificationsDisabledMessage: 'Disabled',
    autoFlairReconcileEnabled: true,
    requiredPhotoCount: 2,
    photoInstructions: 'Follow the instructions.',
    showPhotoInstructionsBeforeSubmit: true,
    denyReasons: [
      {
        id: 'reason_1',
        label: 'Edited image',
        template: 'Hidden internal template body',
        enabled: true,
      },
    ],
    pendingTurnaroundDays: 3,
    modmailSubject: 'Pending',
    pendingBody: 'Pending body',
    alwaysIncludeDenialNotesInModmail: false,
    flairText: 'Verified',
    flairTemplateId: 'abc123',
    flairCssClass: 'verified',
    flairTemplateCacheTemplateId: '',
    flairTemplateCacheText: '',
    flairTemplateCacheCheckedAt: 0,
    approveHeader: 'Approved',
    approveBody: 'Approved body',
    denyHeader: 'Denied',
    removeHeader: 'Removed',
    removeBody: 'Removed body',
    themePreset: 'coastal_light',
    useCustomColors: false,
    customPrimary: '',
    customAccent: '',
    customBackground: '',
  };
}

function createSchedulerFake(existingJobs: Array<{ name: string; data?: Record<string, unknown> }> = []) {
  const runJobCalls: Array<Record<string, unknown>> = [];

  return {
    scheduler: {
      async listJobs() {
        return existingJobs;
      },
      async runJob(payload: Record<string, unknown>) {
        runJobCalls.push(payload);
      },
    },
    runJobCalls,
  };
}

test('normalizeSubmittedPhotoUrl accepts Reddit-hosted upload URLs', () => {
  assert.equal(
    normalizeSubmittedPhotoUrl('https://i.redd.it/example-photo.png'),
    'https://i.redd.it/example-photo.png'
  );
  assert.equal(
    normalizeSubmittedPhotoUrl({ url: 'https://preview.redd.it/example-photo.png?width=1080&format=pjpg&auto=webp&s=123' }),
    'https://preview.redd.it/example-photo.png?width=1080&format=pjpg&auto=webp&s=123'
  );
});

test('normalizeSubmittedPhotoUrl rejects non-Reddit or non-https URLs', () => {
  assert.equal(normalizeSubmittedPhotoUrl('https://example.com/photo.png'), null);
  assert.equal(normalizeSubmittedPhotoUrl('http://i.redd.it/photo.png'), null);
  assert.equal(normalizeSubmittedPhotoUrl('javascript:alert(1)'), null);
});

test('clearExpiredPendingClaim clears stale claims', () => {
  const staleRecord = buildRecord({
    claimedBy: 'mod_one',
    claimedAt: '2026-03-11T11:00:00.000Z',
  });

  const cleared = clearExpiredPendingClaim(staleRecord, Date.parse('2026-03-11T12:00:00.000Z'));
  assert.equal(cleared.claimedBy, null);
  assert.equal(cleared.claimedAt, null);
});

test('clearExpiredPendingClaim keeps active claims', () => {
  const activeRecord = buildRecord({
    claimedBy: 'mod_one',
    claimedAt: '2026-03-11T11:55:00.000Z',
  });

  const result = clearExpiredPendingClaim(activeRecord, Date.parse('2026-03-11T12:00:00.000Z'));
  assert.equal(result.claimedBy, 'mod_one');
  assert.equal(result.claimedAt, '2026-03-11T11:55:00.000Z');
});

test('toPublicHubConfig omits moderator-only template content', () => {
  const publicConfig = toPublicHubConfig(buildRuntimeConfig());

  assert.deepEqual(publicConfig, {
    verificationsEnabled: true,
    verificationsDisabledMessage: 'Disabled',
    photoInstructions: 'Follow the instructions.',
    showPhotoInstructionsBeforeSubmit: true,
    pendingTurnaroundDays: 3,
    denyReasons: [
      {
        id: 'reason_1',
        label: 'Edited image',
        enabled: true,
      },
    ],
  });
  assert.equal('template' in publicConfig.denyReasons[0], false);
});

test('withRedisLock releases the lock after a successful callback', async () => {
  const setCalls: unknown[][] = [];
  const getCalls: unknown[][] = [];
  const delCalls: unknown[][] = [];
  let currentLockValue: string | null = null;
  const context = {
    redis: {
      async set(...args: unknown[]) {
        setCalls.push(args);
        currentLockValue = String(args[1] ?? '');
        return 'OK';
      },
      async get(...args: unknown[]) {
        getCalls.push(args);
        return currentLockValue;
      },
      async del(...args: unknown[]) {
        delCalls.push(args);
        currentLockValue = null;
      },
    },
  };

  const result = await withRedisLock(context as never, 'lock:key', 1000, 'failed', async () => 'done');

  assert.equal(result, 'done');
  assert.equal(setCalls.length, 1);
  assert.equal(typeof setCalls[0][1], 'string');
  assert.notEqual(setCalls[0][1], '1');
  assert.deepEqual(getCalls, [['lock:key']]);
  assert.deepEqual(delCalls, [['lock:key']]);
  assert.equal(currentLockValue, null);
});

test('withRedisLock does not delete a newer lock it does not own', async () => {
  const delCalls: unknown[][] = [];
  let currentLockValue: string | null = null;
  const context = {
    redis: {
      async set(...args: unknown[]) {
        currentLockValue = String(args[1] ?? '');
        return 'OK';
      },
      async get() {
        return currentLockValue;
      },
      async del(...args: unknown[]) {
        delCalls.push(args);
        currentLockValue = null;
      },
    },
  };

  const result = await withRedisLock(context as never, 'lock:key', 1000, 'failed', async () => {
    currentLockValue = 'newer-lock-token';
    return 'done';
  });

  assert.equal(result, 'done');
  assert.deepEqual(delCalls, []);
  assert.equal(currentLockValue, 'newer-lock-token');
});

test('withRedisLock surfaces lock contention without running the callback', async () => {
  let callbackRan = false;
  const context = {
    redis: {
      async set() {
        return null;
      },
      async get() {
        throw new Error('get should not run when the lock is never acquired');
      },
      async del() {
        throw new Error('del should not run when the lock is never acquired');
      },
    },
  };

  await assert.rejects(
    withRedisLock(context as never, 'lock:key', 1000, 'lock contention', async () => {
      callbackRan = true;
      return 'done';
    }),
    /lock contention/
  );
  assert.equal(callbackRan, false);
});

test('ensureUserValidationSchedule registers the user-validation scheduled job when missing', async () => {
  const { scheduler, runJobCalls } = createSchedulerFake();

  await ensureUserValidationSchedule(
    {
      scheduler,
    } as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(runJobCalls.length, 1);
  assert.deepEqual(runJobCalls[0], {
    name: USER_VALIDATION_JOB_NAME,
    cron: USER_VALIDATION_CRON,
    data: {
      subredditId: 't5_example',
      subredditName: 'examplesub',
    },
  });
});

test('ensureUserValidationSchedule does not register a duplicate when a matching job already exists', async () => {
  const { scheduler, runJobCalls } = createSchedulerFake([
    {
      name: USER_VALIDATION_JOB_NAME,
      data: {
        subredditId: 't5_example',
        subredditName: 'examplesub',
      },
    },
  ]);

  await ensureUserValidationSchedule(
    {
      scheduler,
    } as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(runJobCalls.length, 0);
});
