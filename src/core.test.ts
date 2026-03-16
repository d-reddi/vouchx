import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModeratorUpdateNotice,
  clearExpiredPendingClaim,
  collectPendingAccountDetailsSnapshot,
  dismissModeratorUpdateNotice,
  ensureUserValidationSchedule,
  getCurrentModeratorPermissionList,
  getModeratorAccessSnapshot,
  normalizeSubmittedPhotoUrl,
  parseRecord,
  releaseRedisLockIfOwned,
  toModPanelState,
  toPublicHubConfig,
  toHubState,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  validateFlairTemplateId,
  validateMaxDenialsBeforeBlockSetting,
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

function buildPendingAccountDetailsSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    capturedAt: '2026-03-11T12:00:00.000Z',
    accountCreatedAt: '2026-03-01T12:00:00.000Z',
    subredditKarma: 42,
    previousDeniedAttempts: 2,
    banStatus: 'not_banned' as const,
    ...overrides,
  };
}

function buildRuntimeConfig(): RuntimeConfig {
  return {
    verificationsEnabled: true,
    verificationsDisabledMessage: 'Disabled',
    autoFlairReconcileEnabled: true,
    maxDenialsBeforeBlock: 3,
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

function buildDashboardData(overrides: Partial<Parameters<typeof toHubState>[0]> = {}): Parameters<typeof toHubState>[0] {
  return {
    viewerUsername: 'example_user',
    subredditName: 'example',
    isModerator: false,
    canReview: false,
    canManageUsers: false,
    canOpenInstallSettings: false,
    hasConfigAccess: false,
    canAccessSettingsTab: false,
    flairTemplateValidation: {
      isValid: true,
      code: 'valid',
      message: 'Flair template ID looks valid.',
    },
    requiresInitialSetup: false,
    config: buildRuntimeConfig(),
    viewerSnapshot: {
      accountAgeDays: 365,
      totalKarma: 1000,
    },
    viewerVerifiedByFlair: false,
    viewerFlairConfiguredTemplateId: '',
    viewerFlairDetectedTemplateId: '',
    viewerFlairCheckSource: 'none',
    viewerFlairCheckError: null,
    viewerCurrentFlairText: '',
    viewerCurrentFlairCssClass: '',
    userLatest: null,
    viewerBlocked: null,
    pendingCount: 0,
    pending: [],
    approved: [],
    blocked: [],
    auditLog: [],
    storage: {
      estimatedBytes: 0,
      capBytes: 0,
      percent: 0,
      recordCount: 0,
      auditCount: 0,
      blockedCount: 0,
      deniedCountEntries: 0,
    },
    approvedHasMore: false,
    auditHasMore: false,
    ...overrides,
  };
}

function createSchedulerRegistrationContext(options?: {
  existingJobs?: Array<{ name: string; data?: Record<string, unknown> }>;
  initialLockValue?: string | null;
  onRunJob?: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const runJobCalls: Array<Record<string, unknown>> = [];
  const listJobsCalls: unknown[][] = [];
  const setCalls: unknown[][] = [];
  const getCalls: unknown[][] = [];
  const delCalls: unknown[][] = [];
  let currentLockValue = options?.initialLockValue ?? null;
  const existingJobs = options?.existingJobs ?? [];

  return {
    context: {
      scheduler: {
        async listJobs(...args: unknown[]) {
          listJobsCalls.push(args);
          return existingJobs;
        },
        async runJob(payload: Record<string, unknown>) {
          runJobCalls.push(payload);
          await options?.onRunJob?.(payload);
        },
      },
      redis: {
        async set(...args: unknown[]) {
          setCalls.push(args);
          const value = String(args[1] ?? '');
          const lockOptions = args[2] as { nx?: boolean } | undefined;
          if (lockOptions?.nx && currentLockValue !== null) {
            return null;
          }
          currentLockValue = value;
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
    },
    listJobsCalls,
    runJobCalls,
    setCalls,
    getCalls,
    delCalls,
    get currentLockValue() {
      return currentLockValue;
    },
    setCurrentLockValue(value: string | null) {
      currentLockValue = value;
    },
  };
}

function createRedisLockContext(initialValue: string | null) {
  const getCalls: unknown[][] = [];
  const delCalls: unknown[][] = [];
  let currentLockValue = initialValue;

  return {
    context: {
      redis: {
        async get(...args: unknown[]) {
          getCalls.push(args);
          return currentLockValue;
        },
        async del(...args: unknown[]) {
          delCalls.push(args);
          currentLockValue = null;
        },
      },
    },
    getCalls,
    delCalls,
    get currentLockValue() {
      return currentLockValue;
    },
  };
}

function createUpdateNoticeContext(options?: {
  appVersion?: string | null;
  subredditId?: string;
  settingsValues?: Record<string, string | boolean | undefined>;
  initialDismissals?: Record<string, string>;
}) {
  const settingsValues = options?.settingsValues ?? {};
  const redisStore = new Map<string, string>(Object.entries(options?.initialDismissals ?? {}));
  const getCalls: string[] = [];
  const setCalls: Array<[string, string, unknown?]> = [];

  return {
    context: {
      appVersion: options?.appVersion ?? '0.0.2',
      subredditId: options?.subredditId ?? 't5_example',
      settings: {
        async get(key: string) {
          return settingsValues[key];
        },
      },
      redis: {
        async get(key: string) {
          getCalls.push(key);
          return redisStore.get(key) ?? null;
        },
        async set(key: string, value: string, options?: unknown) {
          setCalls.push([key, value, options]);
          redisStore.set(key, value);
          return 'OK';
        },
      },
    },
    getCalls,
    setCalls,
    redisStore,
  };
}

function createModeratorLookupContext(options?: {
  subredditId?: string;
  currentUsername?: string | null;
  permissionResponses?: Array<string[] | Error>;
  broadModeratorResponses?: Array<Array<{ username: string }> | Error>;
  filteredModeratorResponses?: Array<Array<{ username: string }> | Error>;
}) {
  const redisStore = new Map<string, string>();
  const permissionResponses = options?.permissionResponses ?? [];
  const broadModeratorResponses = options?.broadModeratorResponses ?? [];
  const filteredModeratorResponses = options?.filteredModeratorResponses ?? [];
  let permissionCallCount = 0;
  let broadCallCount = 0;
  let filteredCallCount = 0;

  const nextPermissionResponse = (): string[] => {
    const response = permissionResponses[Math.min(permissionCallCount, permissionResponses.length - 1)];
    permissionCallCount += 1;
    if (response instanceof Error) {
      throw response;
    }
    return Array.isArray(response) ? response : [];
  };

  const nextModeratorsResponse = (
    responses: Array<Array<{ username: string }> | Error>,
    kind: 'broad' | 'filtered'
  ): Array<{ username: string }> => {
    if (kind === 'broad') {
      broadCallCount += 1;
    } else {
      filteredCallCount += 1;
    }
    const index = kind === 'broad' ? broadCallCount - 1 : filteredCallCount - 1;
    const response = responses[Math.min(index, responses.length - 1)];
    if (response instanceof Error) {
      throw response;
    }
    return Array.isArray(response) ? response : [];
  };

  return {
    context: {
      subredditId: options?.subredditId ?? 't5_example',
      reddit: {
        async getCurrentUsername() {
          return options?.currentUsername ?? 'mod_one';
        },
        async getCurrentUser() {
          return {
            async getModPermissionsForSubreddit() {
              return nextPermissionResponse();
            },
          };
        },
        getModerators(args: { username?: string }) {
          return {
            async all() {
              return args.username
                ? nextModeratorsResponse(filteredModeratorResponses, 'filtered')
                : nextModeratorsResponse(broadModeratorResponses, 'broad');
            },
          };
        },
      },
      redis: {
        async set(key: string, value: string, options?: { nx?: boolean }) {
          if (options?.nx && redisStore.has(key)) {
            return null;
          }
          redisStore.set(key, value);
          return 'OK';
        },
        async get(key: string) {
          return redisStore.get(key) ?? null;
        },
        async del(...keys: string[]) {
          for (const key of keys) {
            redisStore.delete(key);
          }
        },
      },
    },
    get permissionCallCount() {
      return permissionCallCount;
    },
    get broadCallCount() {
      return broadCallCount;
    },
    get filteredCallCount() {
      return filteredCallCount;
    },
  };
}

function createPendingAccountDetailsContext(options?: {
  userResponses?: Array<{ createdAt: Date } | null | Error>;
  karmaResponses?: Array<unknown | Error>;
  bannedResponses?: Array<unknown[] | Error>;
  denialCount?: string | null;
}) {
  const userResponses = options?.userResponses ?? [];
  const karmaResponses = options?.karmaResponses ?? [];
  const bannedResponses = options?.bannedResponses ?? [];
  let userCallCount = 0;
  let karmaCallCount = 0;
  let bannedCallCount = 0;
  let denialCountCallCount = 0;

  return {
    context: {
      reddit: {
        async getUserByUsername() {
          const response = userResponses[Math.min(userCallCount, userResponses.length - 1)];
          userCallCount += 1;
          if (response instanceof Error) {
            throw response;
          }
          if (!response) {
            return null;
          }
          return {
            createdAt: response.createdAt,
            async getUserKarmaFromCurrentSubreddit() {
              const karmaResponse = karmaResponses[Math.min(karmaCallCount, karmaResponses.length - 1)];
              karmaCallCount += 1;
              if (karmaResponse instanceof Error) {
                throw karmaResponse;
              }
              return karmaResponse ?? null;
            },
          };
        },
        getBannedUsers() {
          return {
            async all() {
              const response = bannedResponses[Math.min(bannedCallCount, bannedResponses.length - 1)];
              bannedCallCount += 1;
              if (response instanceof Error) {
                throw response;
              }
              return Array.isArray(response) ? response : [];
            },
          };
        },
      },
      redis: {
        async hGet() {
          denialCountCallCount += 1;
          return options?.denialCount ?? null;
        },
      },
    },
    get userCallCount() {
      return userCallCount;
    },
    get karmaCallCount() {
      return karmaCallCount;
    },
    get bannedCallCount() {
      return bannedCallCount;
    },
    get denialCountCallCount() {
      return denialCountCallCount;
    },
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

test('validateFlairTemplateId rejects missing template IDs', () => {
  const validation = validateFlairTemplateId('');
  assert.equal(validation.isValid, false);
  assert.equal(validation.code, 'missing');
});

test('validateFlairTemplateId rejects malformed template IDs', () => {
  const validation = validateFlairTemplateId('abc123');
  assert.equal(validation.isValid, false);
  assert.equal(validation.code, 'invalid_format');
});

test('validateFlairTemplateId accepts template IDs with a digit and hyphen', () => {
  const validation = validateFlairTemplateId('ABC-123');
  assert.equal(validation.isValid, true);
  assert.equal(validation.code, 'valid');
});

test('validateMaxDenialsBeforeBlockSetting allows 0 to disable auto-block', () => {
  assert.equal(validateMaxDenialsBeforeBlockSetting(0), undefined);
});

test('validateMaxDenialsBeforeBlockSetting rejects 1', () => {
  assert.equal(
    validateMaxDenialsBeforeBlockSetting(1),
    'Enter 0 to disable auto-block, or a whole number of denials (2 or greater).'
  );
});

test('validateMaxDenialsBeforeBlockSetting allows 2', () => {
  assert.equal(validateMaxDenialsBeforeBlockSetting(2), undefined);
});

test('getCurrentModeratorPermissionList reuses cached permissions after a transient lookup failure', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [['access', 'config'], new Error('reddit 500')],
  });

  const first = await getCurrentModeratorPermissionList(lookupContext.context as never, 'ExampleSub', 'mod_one');
  const second = await getCurrentModeratorPermissionList(lookupContext.context as never, 'ExampleSub', 'mod_one');

  assert.deepEqual(first, ['access', 'config']);
  assert.deepEqual(second, ['access', 'config']);
  assert.equal(lookupContext.permissionCallCount, 2);
  assert.equal(lookupContext.broadCallCount, 0);
  assert.equal(lookupContext.filteredCallCount, 0);
});

test('getModeratorAccessSnapshot falls back to cached moderator role when moderator listings fail', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [new Error('reddit 500'), new Error('reddit 500')],
    broadModeratorResponses: [[{ username: 'mod_one' }], new Error('reddit 500')],
    filteredModeratorResponses: [new Error('reddit 500')],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const first = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_one');
    const second = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_one');

    assert.equal(first.isModerator, true);
    assert.deepEqual(first.permissions, []);
    assert.equal(second.isModerator, true);
    assert.deepEqual(second.permissions, []);
    assert.equal(lookupContext.permissionCallCount, 2);
    assert.equal(lookupContext.broadCallCount, 2);
    assert.equal(lookupContext.filteredCallCount, 1);
  } finally {
    console.log = originalConsoleLog;
  }
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

test('parseRecord preserves valid pending account details snapshots', () => {
  const parsed = parseRecord(
    JSON.stringify(
      buildRecord({
        accountDetails: buildPendingAccountDetailsSnapshot(),
      })
    )
  );

  assert.ok(parsed);
  assert.deepEqual(parsed.accountDetails, buildPendingAccountDetailsSnapshot());
});

test('parseRecord collapses malformed pending account details snapshots to null', () => {
  const parsed = parseRecord(
    JSON.stringify(
      buildRecord({
        accountDetails: {
          capturedAt: 123,
          previousDeniedAttempts: 'bad-data',
        },
      })
    )
  );

  assert.ok(parsed);
  assert.equal(parsed.accountDetails, null);
});

test('toModPanelState includes account details on pending items', () => {
  const accountDetails = buildPendingAccountDetailsSnapshot();
  const modState = toModPanelState(
    buildDashboardData({
      pendingCount: 1,
      pending: [buildRecord({ accountDetails }) as never],
    })
  );

  assert.equal(modState.pending.length, 1);
  assert.deepEqual(modState.pending[0].accountDetails, accountDetails);
});

test('collectPendingAccountDetailsSnapshot retries transient lookup failures and stores pending snapshot values', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [new Error('temporary user lookup failure'), { createdAt: new Date('2026-03-01T12:00:00.000Z') }],
    karmaResponses: [{ fromComments: 4, fromPosts: 5 }],
    bannedResponses: [new Error('temporary ban lookup failure'), []],
    denialCount: '2',
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const snapshot = await collectPendingAccountDetailsSnapshot(
      snapshotContext.context as never,
      't5_example',
      'example',
      'example_user',
      '2026-03-11T12:00:00.000Z'
    );

    assert.equal(snapshot.capturedAt, '2026-03-11T12:00:00.000Z');
    assert.equal(snapshot.accountCreatedAt, '2026-03-01T12:00:00.000Z');
    assert.equal(snapshot.subredditKarma, 9);
    assert.equal(snapshot.previousDeniedAttempts, 2);
    assert.equal(snapshot.banStatus, 'not_banned');
    assert.equal(snapshotContext.userCallCount, 2);
    assert.equal(snapshotContext.karmaCallCount, 1);
    assert.equal(snapshotContext.bannedCallCount, 2);
    assert.equal(snapshotContext.denialCountCallCount, 1);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('collectPendingAccountDetailsSnapshot falls back to partial values after retry exhaustion', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [new Error('lookup failure'), new Error('lookup failure')],
    bannedResponses: [new Error('ban failure'), new Error('ban failure')],
    denialCount: '3',
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const snapshot = await collectPendingAccountDetailsSnapshot(
      snapshotContext.context as never,
      't5_example',
      'example',
      'example_user',
      '2026-03-11T12:00:00.000Z'
    );

    assert.equal(snapshot.accountCreatedAt, null);
    assert.equal(snapshot.subredditKarma, null);
    assert.equal(snapshot.banStatus, 'unknown');
    assert.equal(snapshot.previousDeniedAttempts, 3);
    assert.equal(snapshotContext.userCallCount, 2);
    assert.equal(snapshotContext.bannedCallCount, 2);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('buildModeratorUpdateNotice returns null when latest release metadata is missing or invalid', async () => {
  const missingVersionContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_title: 'Release ready',
    },
  });

  assert.equal(await buildModeratorUpdateNotice(missingVersionContext.context as never, 'mod_one'), null);

  const invalidVersionContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_version: 'soon',
    },
  });

  assert.equal(await buildModeratorUpdateNotice(invalidVersionContext.context as never, 'mod_one'), null);
});

test('buildModeratorUpdateNotice returns a dismissible notice when a newer release exists', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_version: '0.0.3',
      latest_release_title: 'VouchX 0.0.3 is available',
      latest_release_notes: 'Improves moderator tooling.',
      latest_release_link: 'https://example.com/changelog/0.0.3',
    },
  });

  const notice = await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One');

  assert.deepEqual(notice, {
    targetVersion: '0.0.3',
    critical: false,
    title: 'VouchX 0.0.3 is available',
    notes: 'Improves moderator tooling.',
    linkUrl: 'https://example.com/changelog/0.0.3',
  });
  assert.equal(updateContext.getCalls.length, 1);
});

test('buildModeratorUpdateNotice supports Devvit playtest versions when a newer release exists', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2.1',
    settingsValues: {
      latest_release_version: '0.0.3',
      latest_release_title: 'VouchX 0.0.3 is available',
    },
  });

  const notice = await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One');

  assert.deepEqual(notice, {
    targetVersion: '0.0.3',
    critical: false,
    title: 'VouchX 0.0.3 is available',
    notes: null,
    linkUrl: null,
  });
});

test('buildModeratorUpdateNotice does not show an update when the installed Devvit playtest build is already ahead of the latest release', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2.1',
    settingsValues: {
      latest_release_version: '0.0.2',
      latest_release_title: 'VouchX 0.0.2 is available',
    },
  });

  assert.equal(await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One'), null);
});

test('buildModeratorUpdateNotice ignores Redis dismissals for critical releases', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_version: '0.0.3',
      latest_release_severity: 'critical',
      latest_release_title: 'Critical stability update',
    },
    initialDismissals: {
      'subreddit:t5_example:moderator:update-dismissed:mod_one:0.0.3': '2026-03-15T00:00:00.000Z',
    },
  });

  const notice = await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One');

  assert.deepEqual(notice, {
    targetVersion: '0.0.3',
    critical: true,
    title: 'Critical stability update',
    notes: null,
    linkUrl: null,
  });
});

test('buildModeratorUpdateNotice treats latest_release_severity normal as non-critical and respects dismissals', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_version: '0.0.3',
      latest_release_severity: 'normal',
      latest_release_title: 'Standard update',
    },
    initialDismissals: {
      'subreddit:t5_example:moderator:update-dismissed:mod_one:0.0.3': '2026-03-15T00:00:00.000Z',
    },
  });

  assert.equal(await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One'), null);
});

test('dismissModeratorUpdateNotice stores a per-moderator per-version dismissal that suppresses the notice', async () => {
  const updateContext = createUpdateNoticeContext({
    appVersion: '0.0.2',
    settingsValues: {
      latest_release_version: '0.0.3',
    },
  });

  await dismissModeratorUpdateNotice(updateContext.context as never, 'Mod_One', 'v0.0.3');
  const notice = await buildModeratorUpdateNotice(updateContext.context as never, 'Mod_One');
  const expirationOptions = updateContext.setCalls[0][2] as { expiration?: Date } | undefined;

  assert.equal(notice, null);
  assert.equal(updateContext.setCalls.length, 1);
  assert.match(updateContext.setCalls[0][0], /subreddit:t5_example:moderator:update-dismissed:mod_one:0\.0\.3$/);
  assert.ok(expirationOptions?.expiration instanceof Date);
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

test('toHubState marks initial setup required when flair template ID is blank', () => {
  const hubState = toHubState(
    buildDashboardData({
      requiresInitialSetup: true,
      config: {
        ...buildRuntimeConfig(),
        flairTemplateId: '',
      },
    })
  );

  assert.equal(hubState.requiresInitialSetup, true);
  assert.equal('flairTemplateId' in hubState.config, false);
});

test('toHubState does not mark initial setup required when flair template ID is non-empty', () => {
  const hubState = toHubState(
    buildDashboardData({
      requiresInitialSetup: false,
      config: {
        ...buildRuntimeConfig(),
        flairTemplateId: 'template-id-present',
      },
    })
  );

  assert.equal(hubState.requiresInitialSetup, false);
});

test('releaseRedisLockIfOwned deletes the cleanup lock when the token matches', async () => {
  const lockContext = createRedisLockContext('cleanup-lock-token');

  await releaseRedisLockIfOwned(lockContext.context as never, 'cleanup:lock', 'cleanup-lock-token');

  assert.deepEqual(lockContext.getCalls, [['cleanup:lock']]);
  assert.deepEqual(lockContext.delCalls, [['cleanup:lock']]);
  assert.equal(lockContext.currentLockValue, null);
});

test('releaseRedisLockIfOwned does not delete a newer cleanup lock token', async () => {
  const lockContext = createRedisLockContext('newer-cleanup-lock-token');

  await releaseRedisLockIfOwned(lockContext.context as never, 'cleanup:lock', 'older-cleanup-lock-token');

  assert.deepEqual(lockContext.getCalls, [['cleanup:lock']]);
  assert.deepEqual(lockContext.delCalls, []);
  assert.equal(lockContext.currentLockValue, 'newer-cleanup-lock-token');
});

test('releaseRedisLockIfOwned does not delete a legacy cleanup lock value during rollout', async () => {
  const lockContext = createRedisLockContext('1');

  await releaseRedisLockIfOwned(lockContext.context as never, 'cleanup:lock', 'new-cleanup-lock-token');

  assert.deepEqual(lockContext.getCalls, [['cleanup:lock']]);
  assert.deepEqual(lockContext.delCalls, []);
  assert.equal(lockContext.currentLockValue, '1');
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
  const schedulerContext = createSchedulerRegistrationContext();

  await ensureUserValidationSchedule(
    schedulerContext.context as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(schedulerContext.listJobsCalls.length, 1);
  assert.equal(schedulerContext.runJobCalls.length, 1);
  assert.deepEqual(schedulerContext.runJobCalls[0], {
    name: USER_VALIDATION_JOB_NAME,
    cron: USER_VALIDATION_CRON,
    data: {
      subredditId: 't5_example',
      subredditName: 'examplesub',
    },
  });
  assert.equal(schedulerContext.setCalls.length, 1);
  assert.equal(schedulerContext.getCalls.length, 1);
  assert.equal(schedulerContext.delCalls.length, 1);
  assert.equal(schedulerContext.currentLockValue, null);
});

test('ensureUserValidationSchedule does not register a duplicate when a matching job already exists', async () => {
  const schedulerContext = createSchedulerRegistrationContext({
    existingJobs: [
      {
        name: USER_VALIDATION_JOB_NAME,
        data: {
          subredditId: 't5_example',
          subredditName: 'examplesub',
        },
      },
    ],
  });

  await ensureUserValidationSchedule(
    schedulerContext.context as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(schedulerContext.listJobsCalls.length, 1);
  assert.equal(schedulerContext.runJobCalls.length, 0);
  assert.equal(schedulerContext.getCalls.length, 1);
  assert.equal(schedulerContext.delCalls.length, 1);
  assert.equal(schedulerContext.currentLockValue, null);
});

test('ensureUserValidationSchedule skips registration when another caller holds the schedule lock', async () => {
  const schedulerContext = createSchedulerRegistrationContext({
    initialLockValue: 'other-caller-lock-token',
  });

  await ensureUserValidationSchedule(
    schedulerContext.context as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(schedulerContext.listJobsCalls.length, 0);
  assert.equal(schedulerContext.runJobCalls.length, 0);
  assert.equal(schedulerContext.getCalls.length, 0);
  assert.equal(schedulerContext.delCalls.length, 0);
  assert.equal(schedulerContext.currentLockValue, 'other-caller-lock-token');
});

test('ensureUserValidationSchedule does not delete a newer schedule lock it does not own', async () => {
  const schedulerContext = createSchedulerRegistrationContext({
    onRunJob: () => {
      schedulerContext.setCurrentLockValue('newer-schedule-lock-token');
    },
  });

  await ensureUserValidationSchedule(
    schedulerContext.context as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(schedulerContext.listJobsCalls.length, 1);
  assert.equal(schedulerContext.runJobCalls.length, 1);
  assert.equal(schedulerContext.getCalls.length, 1);
  assert.equal(schedulerContext.delCalls.length, 0);
  assert.equal(schedulerContext.currentLockValue, 'newer-schedule-lock-token');
});
