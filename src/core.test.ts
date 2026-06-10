import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addPendingFlagNote,
  assertCanReview,
  approveVerification,
  archivePendingVerificationModmailReply,
  autoDenyShadowbannedSubmission,
  batchReviewVerifications,
  blockUserForModerator,
  buildBatchReviewToast,
  buildModeratorUpdateNotice,
  checkVerificationFlair,
  clearExpiredPendingClaim,
  collectPendingAccountDetailsSnapshot,
  computeUserGrade,
  detectContentCreator,
  extractModmailUserSignals,
  parsePendingAccountDetailsSnapshot,
  parsePendingLastDenialSnapshot,
  parsePendingReviewFlag,
  denyVerification,
  dismissModeratorUpdateNotice,
  ensureUserValidationSchedule,
  getCurrentModeratorPermissionList,
  getHubModeratorUiState,
  getRuntimeConfig,
  getModeratorAccessSnapshot,
  getModeratorStats,
  getViewerFlairSnapshot,
  isViewerAwaitingFlairPropagation,
  loadApprovalFlairOptionsForSettings,
  loadHubDashboard,
  loadModDashboard,
  looksLikeInternalModmailArchiveError,
  onSaveFlairTemplateValues,
  removeApprovedVerificationByModerator,
  sendUserModmailWithFallback,
  setPendingFlagState,
  searchApprovedRecords,
  searchAuditEntries,
  searchHistoryRecords,
  normalizeBatchReviewVerificationIds,
  normalizeModmailConversationId,
  normalizeMaxDenialsBeforeBlockSetting,
  normalizeSubmittedPhotoUrl,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  onModeratorPurgeUserData,
  parseRecord,
  releaseRedisLockIfOwned,
  repairMissingAutoBlockForUser,
  refreshConfiguredFlairTemplateCache,
  shouldReconcileApprovedViewerFlair,
  shouldViewerDisplayVerifiedState,
  submitVerification,
  toModPanelState,
  toPublicHubConfig,
  toHubState,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  validateFlairTemplateId,
  validateMaxDenialsBeforeBlockSetting,
  withRedisLock,
  withdrawCurrentUserPendingVerification,
  usernameLookupFields,
  type RuntimeConfig,
} from './core.ts';
import {
  GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME,
  GLOBAL_BLOCKED_USERNAME_SETTING_NAMES,
  parseRedditUsernameList,
  splitRedditUsernameListAcrossSettings,
} from './shared/global-usernames.ts';

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
    retentionDays: null,
    lastAppliedFlairTemplateId: null,
    lastFlairReconcileAt: null,
    ...overrides,
  };
}

function buildPendingAccountDetailsSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    capturedAt: '2026-03-11T12:00:00.000Z',
    accountCreatedAt: '2026-03-01T12:00:00.000Z',
    totalKarma: 420,
    subredditKarma: 42,
    previousDeniedAttempts: 2,
    banStatus: 'not_banned' as const,
    hasVerifiedEmail: true,
    hasRedditPremium: false,
    isShadowBanned: false,
    recentActivityCount: 5,
    socialLinkCount: 0,
    isContentCreator: false,
    creatorLinkTypes: [] as string[],
    lastDenial: null,
    ...overrides,
  };
}

function buildRuntimeConfig(): RuntimeConfig {
  return {
    verificationsEnabled: true,
    verificationsDisabledMessage: 'Disabled',
    verificationRequiredToPost: false,
    verificationRequiredToComment: false,
    autoFlairReconcileEnabled: true,
    autoDenyShadowbannedEnabled: false,
    maxDenialsBeforeBlock: 3,
    userAdvisoryScoreBadgeEnabled: true,
    contentCreatorBadgeEnabled: true,
    requiredPhotoCount: 2,
    photoInstructions: 'Follow the instructions.',
    photoInstructionsEs: 'Sigue las instrucciones.',
    photoInstructionsFr: 'Suivez les instructions.',
    photoInstructionsPtBr: 'Siga as instruções.',
    photoInstructionsDefaultLanguage: 'en',
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
    multipleApprovalFlairsEnabled: false,
    additionalApprovalFlairs: [],
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
    moderatorAccess: {
      state: 'denied',
      permissionState: 'unknown',
      isModerator: false,
      permissions: [],
    },
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
    needsOnboarding: false,
    config: buildRuntimeConfig(),
    viewerSnapshot: {
      accountAgeDays: 365,
      totalKarma: 1000,
    },
    viewerShouldDisplayVerified: false,
    viewerAwaitingFlairPropagation: false,
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

async function withFixedNow<ValueType>(iso: string, callback: (nowMs: number) => Promise<ValueType> | ValueType) {
  const nowMs = new Date(iso).getTime();
  const originalDateNow = Date.now;
  Date.now = () => nowMs;
  try {
    return await callback(nowMs);
  } finally {
    Date.now = originalDateNow;
  }
}

function scheduleLockKeyForTest(subredditId = 't5_example') {
  return `photo-verification:subreddit:${subredditId}:validation:schedule-lock`;
}

function schedulePresentKeyForTest(subredditId = 't5_example') {
  return `photo-verification:subreddit:${subredditId}:validation:schedule-present`;
}

function findRedisValueBySuffix(store: Map<string, string>, suffix: string): string | null {
  for (const [key, value] of store.entries()) {
    if (key.endsWith(suffix)) {
      return value;
    }
  }
  return null;
}

function createSchedulerRegistrationContext(options?: {
  existingJobs?: Array<{ name: string; data?: Record<string, unknown> }>;
  initialLockValue?: string | null;
  initialMarkerValue?: string | null;
  onRunJob?: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const runJobCalls: Array<Record<string, unknown>> = [];
  const listJobsCalls: unknown[][] = [];
  const setCalls: unknown[][] = [];
  const getCalls: unknown[][] = [];
  const delCalls: unknown[][] = [];
  const redisStore = new Map<string, string>();
  if (options?.initialLockValue !== undefined && options.initialLockValue !== null) {
    redisStore.set(scheduleLockKeyForTest(), options.initialLockValue);
  }
  if (options?.initialMarkerValue !== undefined && options.initialMarkerValue !== null) {
    redisStore.set(schedulePresentKeyForTest(), options.initialMarkerValue);
  }
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
          const key = String(args[0] ?? '');
          const value = String(args[1] ?? '');
          const lockOptions = args[2] as { nx?: boolean } | undefined;
          const existingSpecialValue =
            key.endsWith(':validation:schedule-lock')
              ? findRedisValueBySuffix(redisStore, ':validation:schedule-lock')
              : key.endsWith(':validation:schedule-present')
                ? findRedisValueBySuffix(redisStore, ':validation:schedule-present')
                : null;
          if (lockOptions?.nx && (redisStore.has(key) || existingSpecialValue !== null)) {
            return null;
          }
          redisStore.set(key, value);
          return 'OK';
        },
        async get(...args: unknown[]) {
          getCalls.push(args);
          const key = String(args[0] ?? '');
          return redisStore.get(key) ?? (
            key.endsWith(':validation:schedule-lock')
              ? findRedisValueBySuffix(redisStore, ':validation:schedule-lock')
              : key.endsWith(':validation:schedule-present')
                ? findRedisValueBySuffix(redisStore, ':validation:schedule-present')
                : null
          );
        },
        async del(...args: unknown[]) {
          delCalls.push(args);
          for (const key of args.map((value) => String(value ?? ''))) {
            redisStore.delete(key);
          }
        },
      },
    },
    listJobsCalls,
    runJobCalls,
    setCalls,
    getCalls,
    delCalls,
    get currentLockValue() {
      return findRedisValueBySuffix(redisStore, ':validation:schedule-lock');
    },
    setCurrentLockValue(value: string | null) {
      const existingKey =
        Array.from(redisStore.keys()).find((key) => key.endsWith(':validation:schedule-lock')) || scheduleLockKeyForTest();
      if (value === null) {
        redisStore.delete(existingKey);
        return;
      }
      redisStore.set(existingKey, value);
    },
    get markerValue() {
      return findRedisValueBySuffix(redisStore, ':validation:schedule-present');
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
          return settingsValues[key] ?? settingsValues[key.replace(/^play_/, '')];
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
  subredditName?: string;
  userId?: string;
  currentUsername?: string | null;
  pendingCount?: number;
  redisStore?: Map<string, string>;
  permissionResponses?: Array<string[] | Error>;
}) {
  const redisStore = options?.redisStore ?? new Map<string, string>();
  const permissionResponses = options?.permissionResponses ?? [];
  let permissionCallCount = 0;

  const nextPermissionResponse = (): string[] => {
    const response = permissionResponses[Math.min(permissionCallCount, permissionResponses.length - 1)];
    permissionCallCount += 1;
    if (response instanceof Error) {
      throw response;
    }
    return Array.isArray(response) ? response : [];
  };

  return {
    context: {
      subredditId: options?.subredditId ?? 't5_example',
      subredditName: options?.subredditName ?? 'example',
      userId: options?.userId ?? 't2_mod',
      reddit: {
        async getCurrentUsername() {
          return options?.currentUsername ?? 'mod_one';
        },
        async getCurrentUser() {
          return {
            username: options?.currentUsername ?? 'mod_one',
            id: options?.userId ?? 't2_mod',
            async getModPermissionsForSubreddit() {
              return nextPermissionResponse();
            },
          };
        },
        async getCurrentSubreddit() {
          return { name: options?.subredditName ?? 'example' };
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
        async zCard() {
          return options?.pendingCount ?? 0;
        },
      },
    },
    get permissionCallCount() {
      return permissionCallCount;
    },
    redisStore,
  };
}

function createPendingAccountDetailsContext(options?: {
  userResponses?: Array<{ createdAt: Date; commentKarma?: number | null; linkKarma?: number | null } | null | Error>;
  karmaResponses?: Array<unknown | Error>;
  bannedResponses?: Array<unknown[] | Error>;
  denialCount?: string | null;
  historyRecords?: Array<Record<string, unknown>>;
}) {
  const userResponses = options?.userResponses ?? [];
  const karmaResponses = options?.karmaResponses ?? [];
  const bannedResponses = options?.bannedResponses ?? [];
  // Newest-first, matching the reverse-rank order of the history index scan.
  const historyRecords = options?.historyRecords ?? [];
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
            commentKarma: response.commentKarma,
            linkKarma: response.linkKarma,
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
        async zRange() {
          return historyRecords.map((record, index) => ({
            member: String(record.id ?? `record-${index}`),
            score: historyRecords.length - index,
          }));
        },
        async mGet(keys: string[]) {
          return keys.map((key) => {
            const id = key.split(':').pop();
            const match = historyRecords.find((record) => String(record.id ?? '') === id);
            return match ? JSON.stringify(match) : null;
          });
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

function createApprovalFlairOptionsContext(options?: {
  flairTemplates?: Array<{
    id: string;
    text?: string;
    modOnly?: boolean;
    backgroundColor?: string;
    textColor?: string;
  }> | Error;
  permissions?: string[];
  settingsTabRequiresConfigAccess?: boolean;
}) {
  const redisStore = new Map<string, string>();
  let getUserFlairTemplatesCallCount = 0;

  return {
    context: {
      subredditId: 't5_example',
      settings: {
        async get() {
          return options?.settingsTabRequiresConfigAccess ?? false;
        },
      },
      reddit: {
        async getCurrentUsername() {
          return 'mod_one';
        },
        async getCurrentSubreddit() {
          return { name: 'example' };
        },
        async getCurrentUser() {
          return {
            async getModPermissionsForSubreddit() {
              return options?.permissions ?? ['all'];
            },
          };
        },
        async getSubredditByName() {
          return {
            async getUserFlairTemplates() {
              getUserFlairTemplatesCallCount += 1;
              if (options?.flairTemplates instanceof Error) {
                throw options.flairTemplates;
              }
              return options?.flairTemplates ?? [];
            },
          };
        },
      },
      redis: {
        async get(key: string) {
          return redisStore.get(key) ?? null;
        },
        async set(key: string, value: string) {
          redisStore.set(key, value);
          return 'OK';
        },
      },
    },
    getUserFlairTemplatesCallCount() {
      return getUserFlairTemplatesCallCount;
    },
  };
}

function createFlairSettingsSaveContext(options?: {
  storedConfig?: Record<string, string>;
  flairTemplates?: Array<{
    id: string;
    text?: string;
    modOnly?: boolean;
    backgroundColor?: string;
    textColor?: string;
  }>;
  multipleApprovalFlairsEnabled?: boolean | string;
  userAdvisoryScoreBadgeEnabled?: boolean | string;
  contentCreatorBadgeEnabled?: boolean | string;
  settingsTabRequiresConfigAccess?: boolean;
}) {
  const hashStore = new Map<string, Map<string, string>>();
  const setFieldsCalls: Array<Record<string, string>> = [];
  const configKey = 'subreddit:t5_example:config';
  const storedConfig = options?.storedConfig ?? {};
  let flairTemplateFetchCount = 0;
  hashStore.set(configKey, new Map(Object.entries(storedConfig)));

  const ensureHash = (key: string) => {
    const existing = hashStore.get(key);
    if (existing) {
      return existing;
    }
    const created = new Map<string, string>();
    hashStore.set(key, created);
    return created;
  };

  return {
    context: {
      subredditId: 't5_example',
      settings: {
        async get(key: string) {
          if (key === 'settings_tab_requires_config_access') {
            return options?.settingsTabRequiresConfigAccess ?? false;
          }
          if (key === 'auto_flair_reconcile_enabled') {
            return true;
          }
          if (key === 'show_photo_instructions_before_submit') {
            return true;
          }
          if (key === 'max_denials_before_block') {
            return 3;
          }
          if (key === 'multiple_approval_flairs_enabled') {
            return options?.multipleApprovalFlairsEnabled ?? false;
          }
          if (key === 'user_advisory_score_badge_enabled') {
            return options?.userAdvisoryScoreBadgeEnabled;
          }
          if (key === 'content_creator_badge_enabled') {
            return options?.contentCreatorBadgeEnabled;
          }
          if (key === 'verifications_disabled_message') {
            return 'Disabled';
          }
          return undefined;
        },
      },
      reddit: {
        async getCurrentUsername() {
          return 'mod_one';
        },
        async getCurrentSubreddit() {
          return { name: 'example' };
        },
        async getCurrentUser() {
          return {
            async getModPermissionsForSubreddit() {
              return ['all'];
            },
          };
        },
        async getSubredditByName() {
          return {
            async getUserFlairTemplates() {
              flairTemplateFetchCount += 1;
              return options?.flairTemplates ?? [
                {
                  id: 'ABC-123',
                  text: 'Verified',
                  modOnly: true,
                  backgroundColor: '#123456',
                  textColor: 'light',
                },
              ];
            },
          };
        },
      },
      redis: {
        async hGetAll(key: string) {
          return Object.fromEntries(ensureHash(key).entries());
        },
        async hSet(key: string, entries: Record<string, string>) {
          setFieldsCalls.push(entries);
          const hash = ensureHash(key);
          for (const [field, value] of Object.entries(entries)) {
            hash.set(field, value);
          }
          return Object.keys(entries).length;
        },
      },
    },
    hashStore,
    setFieldsCalls,
    configKey,
    get flairTemplateFetchCount() {
      return flairTemplateFetchCount;
    },
  };
}

function createViewerFlairSnapshotContext(options?: {
  currentUsername?: string | null;
  currentUserResponses?: Array<
    | {
        username?: string;
        id?: string;
        flair?:
          | {
              flairText?: string;
              flairCssClass?: string;
              flairTemplateId?: string;
            }
          | null
          | Error;
      }
    | null
    | Error
  >;
  usernameUserResponses?: Array<
    | {
        username?: string;
        id?: string;
        flair?:
          | {
              flairText?: string;
              flairCssClass?: string;
              flairTemplateId?: string;
            }
          | null
          | Error;
      }
    | null
    | Error
  >;
}) {
  const currentUsername = options?.currentUsername ?? null;
  const currentUserResponses = options?.currentUserResponses ?? [];
  const usernameUserResponses = options?.usernameUserResponses ?? [];
  let currentUserCallCount = 0;
  let currentUsernameCallCount = 0;
  let usernameLookupCallCount = 0;
  const usernameLookupCalls: string[] = [];
  let flairLookupCallCount = 0;

  const toMockUser = (
    response:
      | {
          username?: string;
          id?: string;
          flair?:
            | {
                flairText?: string;
                flairCssClass?: string;
                flairTemplateId?: string;
              }
            | null
            | Error;
        }
      | null
      | Error,
    onLookup: () => void
  ) => {
    if (response instanceof Error) {
      throw response;
    }
    if (!response) {
      return null;
    }
    return {
      username: response.username ?? '',
      id: response.id ?? '',
      async getUserFlairBySubreddit() {
        onLookup();
        if (response.flair instanceof Error) {
          throw response.flair;
        }
        if (!response.flair) {
          return undefined;
        }
        return {
          flairText: response.flair.flairText ?? '',
          flairCssClass: response.flair.flairCssClass ?? '',
          flairTemplateId: response.flair.flairTemplateId ?? '',
        };
      },
    };
  };

  return {
    context: {
      subredditId: 't5_example',
      reddit: {
        async getCurrentUser() {
          const response = currentUserResponses[Math.min(currentUserCallCount, currentUserResponses.length - 1)];
          currentUserCallCount += 1;
          return toMockUser(response, () => {
            flairLookupCallCount += 1;
          });
        },
        async getCurrentUsername() {
          currentUsernameCallCount += 1;
          return currentUsername;
        },
        async getUserByUsername(username: string) {
          usernameLookupCalls.push(username);
          const response = usernameUserResponses[Math.min(usernameLookupCallCount, usernameUserResponses.length - 1)];
          usernameLookupCallCount += 1;
          return toMockUser(response, () => {
            flairLookupCallCount += 1;
          });
        },
      },
    },
    get currentUserCallCount() {
      return currentUserCallCount;
    },
    get currentUsernameCallCount() {
      return currentUsernameCallCount;
    },
    get usernameLookupCallCount() {
      return usernameLookupCallCount;
    },
    get usernameLookupCalls() {
      return usernameLookupCalls;
    },
    get flairLookupCallCount() {
      return flairLookupCallCount;
    },
  };
}

function createHubDashboardContext(options?: {
  subredditId?: string;
  subredditName?: string;
  userId?: string;
  currentUsername?: string | null;
  permissions?: string[];
  settingsValues?: Record<string, unknown>;
  currentUserResponses?: Array<
    | {
        username?: string;
        id?: string;
        createdAt?: Date;
        commentKarma?: number | null;
        linkKarma?: number | null;
        flair?:
          | {
              flairText?: string;
              flairCssClass?: string;
              flairTemplateId?: string;
            }
          | null
          | Error;
      }
    | null
    | Error
  >;
  record?: Record<string, unknown> | null;
  hashValues?: Record<string, string>;
}) {
  const subredditId = options?.subredditId ?? 't5_example';
  const subredditName = options?.subredditName ?? 'example';
  const userId = options?.userId ?? 't2_viewer';
  const record = options?.record ? buildRecord(options.record) : null;
  const redisStore = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();
  const zsetStore = new Map<string, Map<string, number>>();
  let currentUserCallCount = 0;
  let currentUsernameCallCount = 0;

  const toHubDashboardUser = (
    response:
      | {
          username?: string;
          id?: string;
          createdAt?: Date;
          commentKarma?: number | null;
          linkKarma?: number | null;
          flair?:
            | {
                flairText?: string;
                flairCssClass?: string;
                flairTemplateId?: string;
              }
            | null
            | Error;
        }
      | null
      | Error
  ) => {
    if (response instanceof Error) {
      throw response;
    }
    if (!response) {
      return null;
    }
    return {
      username: response.username ?? '',
      id: response.id ?? userId,
      createdAt: response.createdAt ?? new Date('2026-03-01T12:00:00.000Z'),
      commentKarma: response.commentKarma ?? 0,
      linkKarma: response.linkKarma ?? 0,
      async getUserFlairBySubreddit() {
        if (response.flair instanceof Error) {
          throw response.flair;
        }
        if (!response.flair) {
          return undefined;
        }
        return {
          flairText: response.flair.flairText ?? '',
          flairCssClass: response.flair.flairCssClass ?? '',
          flairTemplateId: response.flair.flairTemplateId ?? '',
        };
      },
      async getModPermissionsForSubreddit() {
        return options?.permissions ?? ['all'];
      },
    };
  };

  if (record) {
    redisStore.set(verificationRecordTestKey(subredditId, record.id), JSON.stringify(record));
    ensureTestZSet(zsetStore, historyDateIndexTestKey(subredditId)).set(
      record.id,
      new Date(record.submittedAt).getTime()
    );
    ensureTestZSet(zsetStore, historyByUserIndexTestKey(subredditId, record.username)).set(
      record.id,
      new Date(record.submittedAt).getTime()
    );
  }
  if (options?.hashValues) {
    hashStore.set(subredditConfigTestKey(subredditId), new Map(Object.entries(options.hashValues)));
  }

  return {
    context: {
      subredditId,
      subredditName,
      userId,
      reddit: {
        async getCurrentUser() {
          const responses = options?.currentUserResponses ?? [];
          const response = responses[Math.min(currentUserCallCount, responses.length - 1)];
          currentUserCallCount += 1;
          return toHubDashboardUser(response);
        },
        async getCurrentUsername() {
          currentUsernameCallCount += 1;
          return options?.currentUsername ?? null;
        },
        async getUserByUsername() {
          const responses = options?.currentUserResponses ?? [];
          return toHubDashboardUser(responses[0] ?? null);
        },
        async getSubredditByName() {
          return {
            async getUserFlairTemplates() {
              return [];
            },
          };
        },
      },
      settings: {
        async get(key: string) {
          return options?.settingsValues?.[key];
        },
      },
      redis: {
        async get(key: string) {
          return redisStore.get(key) ?? null;
        },
        async mGet(keys: string[]) {
          return keys.map((key) => redisStore.get(key) ?? null);
        },
        async set(key: string, value: string) {
          redisStore.set(key, value);
          return 'OK';
        },
        async del(...keys: string[]) {
          for (const key of keys) {
            redisStore.delete(key);
            hashStore.delete(key);
            zsetStore.delete(key);
          }
          return keys.length;
        },
        async hGetAll(key: string) {
          return Object.fromEntries((hashStore.get(key) ?? new Map()).entries());
        },
        async hGet(key: string, field: string) {
          return hashStore.get(key)?.get(field) ?? null;
        },
        async hSet(key: string, entries: Record<string, string>) {
          const hash = ensureTestHash(hashStore, key);
          for (const [field, value] of Object.entries(entries)) {
            hash.set(field, value);
          }
          return Object.keys(entries).length;
        },
        async hDel(key: string, fields: string[]) {
          const hash = ensureTestHash(hashStore, key);
          let removed = 0;
          for (const field of fields) {
            if (hash.delete(field)) {
              removed += 1;
            }
          }
          return removed;
        },
        async hLen(key: string) {
          return (hashStore.get(key) ?? new Map()).size;
        },
        async zAdd(key: string, entry: { member: string; score: number }) {
          ensureTestZSet(zsetStore, key).set(entry.member, entry.score);
          return 1;
        },
        async zRange(
          key: string,
          start: number,
          stop: number,
          options?: { by?: 'score' | 'rank'; reverse?: boolean }
        ) {
          const zset = ensureTestZSet(zsetStore, key);
          let entries = Array.from(zset.entries()).map(([member, score]) => ({ member, score }));
          if (options?.by === 'score') {
            entries = entries
              .filter((entry) => entry.score >= start && entry.score <= stop)
              .sort((left, right) => left.score - right.score);
          } else {
            entries = entries.sort((left, right) => (options?.reverse ? right.score - left.score : left.score - right.score));
            const endIndex = stop < 0 ? entries.length : stop + 1;
            entries = entries.slice(Math.max(0, start), Math.max(0, endIndex));
          }
          return entries;
        },
        async zRem(key: string, members: string[]) {
          const zset = ensureTestZSet(zsetStore, key);
          let removed = 0;
          for (const member of members) {
            if (zset.delete(member)) {
              removed += 1;
            }
          }
          return removed;
        },
        async zCard(key: string) {
          return ensureTestZSet(zsetStore, key).size;
        },
      },
    },
    redisStore,
    hashStore,
    zsetStore,
    get currentUserCallCount() {
      return currentUserCallCount;
    },
    get currentUsernameCallCount() {
      return currentUsernameCallCount;
    },
  };
}

function createModmailContext(options?: {
  initialRedis?: Record<string, string>;
  replyError?: Error | null;
  createConversationResponses?: Array<{ conversation: { id: string } } | Error>;
  unarchiveError?: Error | null;
  archiveError?: Error | null;
}) {
  const redisStore = new Map<string, string>(Object.entries(options?.initialRedis ?? {}));
  const getCalls: string[] = [];
  const setCalls: Array<[string, string, unknown?]> = [];
  const delCalls: string[][] = [];
  const replyCalls: Array<{ conversationId: string; body: string; isAuthorHidden: boolean }> = [];
  const createConversationCalls: Array<{
    subredditName: string;
    subject: string;
    body: string;
    to: string | null;
    isAuthorHidden: boolean;
  }> = [];
  const unarchiveCalls: string[] = [];
  const archiveCalls: string[] = [];
  const createConversationResponses = options?.createConversationResponses ?? [{ conversation: { id: '39to20' } }];
  let createConversationCallCount = 0;

  return {
    context: {
      reddit: {
        modMail: {
          async unarchiveConversation(conversationId: string) {
            unarchiveCalls.push(conversationId);
            if (options?.unarchiveError) {
              throw options.unarchiveError;
            }
          },
          async reply(args: { conversationId: string; body: string; isAuthorHidden: boolean }) {
            replyCalls.push(args);
            if (options?.replyError) {
              throw options.replyError;
            }
          },
          async createConversation(args: {
            subredditName: string;
            subject: string;
            body: string;
            to: string | null;
            isAuthorHidden: boolean;
          }) {
            createConversationCalls.push(args);
            const response =
              createConversationResponses[Math.min(createConversationCallCount, createConversationResponses.length - 1)];
            createConversationCallCount += 1;
            if (response instanceof Error) {
              throw response;
            }
            return response;
          },
          async archiveConversation(conversationId: string) {
            archiveCalls.push(conversationId);
            if (options?.archiveError) {
              throw options.archiveError;
            }
          },
        },
      },
      redis: {
        async get(key: string) {
          getCalls.push(key);
          return redisStore.get(key) ?? null;
        },
        async set(key: string, value: string, setOptions?: unknown) {
          setCalls.push([key, value, setOptions]);
          redisStore.set(key, value);
          return 'OK';
        },
        async del(...keys: string[]) {
          delCalls.push(keys);
          for (const key of keys) {
            redisStore.delete(key);
          }
        },
      },
    },
    redisStore,
    getCalls,
    setCalls,
    delCalls,
    replyCalls,
    createConversationCalls,
    unarchiveCalls,
    archiveCalls,
  };
}

function modmailThreadKey(subredditId: string, usernameField: string): string {
  return `subreddit:${subredditId.toLowerCase()}:modmail:thread-by-user:${normalizeUsername(usernameField)}`;
}

function pendingModmailConversationTestKey(subredditId: string, conversationId: string): string {
  return `subreddit:${subredditId.toLowerCase()}:modmail:pending-conversation:${normalizeModmailConversationId(conversationId)}`;
}

function subredditPrefixKey(subredditId: string): string {
  return `subreddit:${subredditId.toLowerCase()}`;
}

function verificationRecordTestKey(subredditId: string, verificationId: string): string {
  return `${subredditPrefixKey(subredditId)}:verification:${verificationId}`;
}

function pendingIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:pending`;
}

function approvedIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:approved`;
}

function approvedPrefixIndexTestKey(subredditId: string, prefix3: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:approved:prefix3:v1:${normalizeUsername(prefix3).slice(0, 3)}`;
}

function historyDateIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:history:date`;
}

function historyByUserIndexTestKey(subredditId: string, username: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:history:user:${normalizeUsername(username)}`;
}

function historyByModeratorIndexTestKey(subredditId: string, username: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:history:mod:${normalizeUsername(username)}`;
}

function userPendingTestKey(subredditId: string, username: string): string {
  return `${subredditPrefixKey(subredditId)}:user:${normalizeUsername(username)}:pending`;
}

function userLatestTestKey(subredditId: string, username: string): string {
  return `${subredditPrefixKey(subredditId)}:user:${normalizeUsername(username)}:latest`;
}

function userPendingByIdTestKey(subredditId: string, userId: string): string {
  return `${subredditPrefixKey(subredditId)}:user-id:${String(userId ?? '').trim()}:pending`;
}

function userLatestByIdTestKey(subredditId: string, userId: string): string {
  return `${subredditPrefixKey(subredditId)}:user-id:${String(userId ?? '').trim()}:latest`;
}

function subredditConfigTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:config`;
}

function validationDueIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:validation:due`;
}

function validationHardExpireIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:validation:hard-expire`;
}

function denialCountTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:denials`;
}

function blockedUsersTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:blocked`;
}

function reopenedChildByDeniedTestKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditPrefixKey(subredditId)}:reopened-by-denied:${deniedVerificationId.trim()}`;
}

function reopenedStateByDeniedTestKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditPrefixKey(subredditId)}:reopened-state-by-denied:${deniedVerificationId.trim()}`;
}

function reopenedAuditByReopenedTestKey(subredditId: string, reopenedVerificationId: string): string {
  return `${subredditPrefixKey(subredditId)}:reopened-audit-by-reopened:${reopenedVerificationId.trim()}`;
}

function auditDateIndexTestKey(subredditId: string): string {
  return `${subredditPrefixKey(subredditId)}:idx:audit:date`;
}

function auditEntryTestKey(subredditId: string, auditId: string): string {
  return `${subredditPrefixKey(subredditId)}:audit:${auditId}`;
}

function ensureTestZSet(store: Map<string, Map<string, number>>, key: string) {
  let zset = store.get(key);
  if (!zset) {
    zset = new Map<string, number>();
    store.set(key, zset);
  }
  return zset;
}

function ensureTestHash(store: Map<string, Map<string, string>>, key: string) {
  let hash = store.get(key);
  if (!hash) {
    hash = new Map<string, string>();
    store.set(key, hash);
  }
  return hash;
}

function seedApprovedIndexMembers(
  reviewContext: ReturnType<typeof createReviewActionContext>,
  members: Array<{ id: string; score: number }>
) {
  const zset = ensureTestZSet(reviewContext.zsetStore, approvedIndexTestKey(reviewContext.subredditId));
  for (const member of members) {
    zset.set(member.id, member.score);
  }
}

function seedApprovedRecords(
  reviewContext: ReturnType<typeof createReviewActionContext>,
  records: Array<{
    id: string;
    approvedAt: string;
    username?: string;
    moderator?: string;
    photoOneUrl?: string;
    photoTwoUrl?: string;
    photoThreeUrl?: string;
    includeApprovedIndex?: boolean;
  }>
) {
  for (const record of records) {
    const approvedAtMs = new Date(record.approvedAt).getTime();
    const submittedAt = new Date(approvedAtMs - 60_000).toISOString();
    const username = record.username ?? `${record.id}_user`;
    const approvedRecord = buildRecord({
      id: record.id,
      username,
      subredditId: reviewContext.subredditId,
      subredditName: reviewContext.record.subredditName,
      status: 'approved',
      moderator: record.moderator ?? 'Mod_One',
      submittedAt,
      ageAcknowledgedAt: submittedAt,
      reviewedAt: record.approvedAt,
      photoOneUrl: record.photoOneUrl ?? 'https://i.redd.it/example.png',
      photoTwoUrl: record.photoTwoUrl ?? '',
      photoThreeUrl: record.photoThreeUrl ?? '',
    });

    reviewContext.redisStore.set(
      verificationRecordTestKey(reviewContext.subredditId, record.id),
      JSON.stringify(approvedRecord)
    );
    ensureTestZSet(reviewContext.zsetStore, historyDateIndexTestKey(reviewContext.subredditId)).set(record.id, approvedAtMs);
    ensureTestZSet(reviewContext.zsetStore, historyByUserIndexTestKey(reviewContext.subredditId, username)).set(record.id, approvedAtMs);

    if (approvedRecord.moderator) {
      ensureTestZSet(
        reviewContext.zsetStore,
        historyByModeratorIndexTestKey(reviewContext.subredditId, approvedRecord.moderator)
      ).set(record.id, approvedAtMs);
    }

    if (record.includeApprovedIndex !== false) {
      ensureTestZSet(reviewContext.zsetStore, approvedIndexTestKey(reviewContext.subredditId)).set(record.id, approvedAtMs);
      ensureTestZSet(reviewContext.zsetStore, approvedPrefixIndexTestKey(reviewContext.subredditId, username)).set(
        record.id,
        approvedAtMs
      );
    }
  }
}

function seedAuditEntries(
  reviewContext: ReturnType<typeof createReviewActionContext>,
  entries: Array<{
    id: string;
    username?: string;
    action: 'approved' | 'denied' | 'reopened' | 'removed_by_mod' | 'blocked' | 'unblocked';
    actor: string;
    at: string;
    verificationId?: string;
    notes?: string;
  }>
) {
  const auditZset = ensureTestZSet(reviewContext.zsetStore, auditDateIndexTestKey(reviewContext.subredditId));
  for (const entry of entries) {
    const fullEntry = {
      subredditId: reviewContext.subredditId,
      subredditName: reviewContext.record.subredditName,
      username: reviewContext.record.username,
      verificationId: entry.verificationId ?? entry.id,
      notes: entry.notes ?? '',
      ...entry,
    };
    reviewContext.redisStore.set(
      auditEntryTestKey(reviewContext.subredditId, fullEntry.id),
      JSON.stringify(fullEntry)
    );
    auditZset.set(fullEntry.id, new Date(fullEntry.at).getTime());
  }
}

function createReviewActionContext(options?: {
  recordOverrides?: Record<string, unknown>;
  moderatorName?: string;
  validationResponses?: Array<{ username?: string; id?: string; isSuspended?: boolean } | Error | null>;
  bannedResponses?: Array<unknown[] | Error>;
  unbanResponses?: Array<true | Error>;
  setUserFlairResponses?: Array<true | Error>;
  addModNoteResponses?: Array<true | Error>;
  createConversationResponses?: Array<{ conversation: { id: string } } | Error>;
  archiveConversationResponses?: Array<true | Error>;
  getConversationResponses?: Array<Record<string, unknown> | Error>;
  maxDenialsBeforeBlock?: number | string;
  multipleApprovalFlairsEnabled?: boolean | string;
  pendingModmailAutoArchiveEnabled?: boolean | string;
  initialRedis?: Record<string, string>;
  initialHashes?: Record<string, Record<string, string>>;
}) {
  const subredditId = 't5_example';
  const subredditName = 'ExampleSub';
  const moderatorName = options?.moderatorName ?? 'Mod_One';
  const record = buildRecord({
    subredditId,
    subredditName,
    ...options?.recordOverrides,
  });
  const normalizedUsername = normalizeUsername(record.username);
  const redisStore = new Map<string, string>(Object.entries(options?.initialRedis ?? {}));
  const hashStore = new Map<string, Map<string, string>>();
  const zsetStore = new Map<string, Map<string, number>>();
  const getUserByUsernameCalls: string[] = [];
  const setUserFlairCalls: Array<Record<string, unknown>> = [];
  const addModNoteCalls: Array<Record<string, unknown>> = [];
  const createConversationCalls: Array<Record<string, unknown>> = [];
  const archiveCalls: string[] = [];
  const replyCalls: Array<Record<string, unknown>> = [];
  const unbanUserCalls: Array<{ username: string; subredditName: string }> = [];
  const validationResponses = options?.validationResponses ?? [{ username: normalizedUsername, id: 't2_target' }];
  const bannedResponses = options?.bannedResponses ?? [[]];
  const unbanResponses = options?.unbanResponses ?? [true];
  const setUserFlairResponses = options?.setUserFlairResponses ?? [true];
  const addModNoteResponses = options?.addModNoteResponses ?? [true];
  const createConversationResponses = options?.createConversationResponses ?? [{ conversation: { id: '39to20' } }];
  const archiveConversationResponses = options?.archiveConversationResponses ?? [true];
  const getConversationResponses = options?.getConversationResponses ?? [
    {
      conversation: {
        conversationType: 'sr_user',
        subreddit: { id: subredditId, displayName: subredditName },
        participant: { id: 't2_target', name: record.username },
        messages: {},
      },
      user: { id: 't2_target', name: record.username },
    },
  ];
  let validationResponseIndex = 0;
  let bannedResponseIndex = 0;
  let unbanResponseIndex = 0;
  let setUserFlairResponseIndex = 0;
  let addModNoteResponseIndex = 0;
  let createConversationResponseIndex = 0;
  let archiveConversationResponseIndex = 0;
  let getConversationResponseIndex = 0;

  const ensureHash = (key: string) => {
    let hash = hashStore.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      hashStore.set(key, hash);
    }
    return hash;
  };

  const ensureZSet = (key: string) => {
    let zset = zsetStore.get(key);
    if (!zset) {
      zset = new Map<string, number>();
      zsetStore.set(key, zset);
    }
    return zset;
  };

  const pickResponse = <T,>(responses: T[], index: number): T => responses[Math.min(index, responses.length - 1)]!;

  for (const [key, entries] of Object.entries(options?.initialHashes ?? {})) {
    hashStore.set(key, new Map(Object.entries(entries)));
  }

  ensureHash(subredditConfigTestKey(subredditId)).set('flair_template_id', 'abc-123');
  redisStore.set(verificationRecordTestKey(subredditId, record.id), JSON.stringify(record));
  redisStore.set(userPendingTestKey(subredditId, normalizedUsername), record.id);
  redisStore.set(userLatestTestKey(subredditId, normalizedUsername), record.id);

  const submittedAtMs = new Date(record.submittedAt).getTime() || Date.now();
  ensureZSet(pendingIndexTestKey(subredditId)).set(record.id, submittedAtMs);
  ensureZSet(historyDateIndexTestKey(subredditId)).set(record.id, submittedAtMs);
  ensureZSet(historyByUserIndexTestKey(subredditId, normalizedUsername)).set(record.id, submittedAtMs);

  if (record.parentVerificationId) {
    redisStore.set(reopenedChildByDeniedTestKey(subredditId, record.parentVerificationId), record.id);
    redisStore.set(reopenedStateByDeniedTestKey(subredditId, record.parentVerificationId), 'open');
    redisStore.set(reopenedAuditByReopenedTestKey(subredditId, record.id), 'audit-reopened-1');
    redisStore.set(
      auditEntryTestKey(subredditId, 'audit-reopened-1'),
      JSON.stringify({
        id: 'audit-reopened-1',
        subredditId,
        subredditName,
        username: record.username,
        action: 'reopened',
        actor: moderatorName,
        at: record.submittedAt,
        verificationId: record.id,
        notes: 'Moved denied case back to pending re-review.',
      })
    );
    ensureZSet(auditDateIndexTestKey(subredditId)).set('audit-reopened-1', submittedAtMs);
  }

  return {
    context: {
      subredditId,
      subredditName,
      reddit: {
        async getCurrentUsername() {
          return moderatorName;
        },
        async getCurrentUser() {
          return {
            async getModPermissionsForSubreddit() {
              return ['access'];
            },
          };
        },
        async getCurrentSubreddit() {
          return { name: subredditName };
        },
        getBannedUsers() {
          return {
            async all() {
              const response = pickResponse(bannedResponses, bannedResponseIndex);
              bannedResponseIndex += 1;
              if (response instanceof Error) {
                throw response;
              }
              return Array.isArray(response) ? response : [];
            },
          };
        },
        async unbanUser(username: string, targetSubredditName: string) {
          unbanUserCalls.push({ username, subredditName: targetSubredditName });
          const response = pickResponse(unbanResponses, unbanResponseIndex);
          unbanResponseIndex += 1;
          if (response instanceof Error) {
            throw response;
          }
        },
        async getUserByUsername(username: string) {
          getUserByUsernameCalls.push(username);
          const response = pickResponse(validationResponses, validationResponseIndex);
          validationResponseIndex += 1;
          if (response instanceof Error) {
            throw response;
          }
          if (response === null) {
            return null;
          }
          return {
            username: response.username ?? username,
            id: response.id ?? 't2_target',
            isSuspended: response.isSuspended,
            async getUserFlairBySubreddit() {
              return undefined;
            },
          };
        },
        async setUserFlair(args: Record<string, unknown>) {
          setUserFlairCalls.push(args);
          const response = pickResponse(setUserFlairResponses, setUserFlairResponseIndex);
          setUserFlairResponseIndex += 1;
          if (response instanceof Error) {
            throw response;
          }
        },
        async addModNote(args: Record<string, unknown>) {
          addModNoteCalls.push(args);
          const response = pickResponse(addModNoteResponses, addModNoteResponseIndex);
          addModNoteResponseIndex += 1;
          if (response instanceof Error) {
            throw response;
          }
        },
        modMail: {
          async getConversation() {
            const response = pickResponse(getConversationResponses, getConversationResponseIndex);
            getConversationResponseIndex += 1;
            if (response instanceof Error) {
              throw response;
            }
            return response;
          },
          async unarchiveConversation() {},
          async reply(args: Record<string, unknown>) {
            replyCalls.push(args);
          },
          async createConversation(args: Record<string, unknown>) {
            createConversationCalls.push(args);
            const response = pickResponse(createConversationResponses, createConversationResponseIndex);
            createConversationResponseIndex += 1;
            if (response instanceof Error) {
              throw response;
            }
            return response;
          },
          async archiveConversation(conversationId: string) {
            archiveCalls.push(conversationId);
            const response = pickResponse(archiveConversationResponses, archiveConversationResponseIndex);
            archiveConversationResponseIndex += 1;
            if (response instanceof Error) {
              throw response;
            }
          },
        },
      },
      settings: {
        async get(key: string) {
          if (key === 'max_denials_before_block') {
            return options?.maxDenialsBeforeBlock;
          }
          if (key === 'multiple_approval_flairs_enabled') {
            return options?.multipleApprovalFlairsEnabled;
          }
          if (key === 'auto_archive_pending_modmail_enabled') {
            return options?.pendingModmailAutoArchiveEnabled;
          }
          return undefined;
        },
      },
      redis: {
        async get(key: string) {
          return redisStore.get(key) ?? null;
        },
        async mGet(keys: string[]) {
          return keys.map((key) => redisStore.get(key) ?? null);
        },
        async set(key: string, value: string, options?: { nx?: boolean }) {
          if (options?.nx && redisStore.has(key)) {
            return null;
          }
          redisStore.set(key, value);
          return 'OK';
        },
        async del(...keys: string[]) {
          for (const key of keys) {
            redisStore.delete(key);
            hashStore.delete(key);
            zsetStore.delete(key);
          }
          return keys.length;
        },
        async zAdd(key: string, entry: { member: string; score: number }) {
          ensureZSet(key).set(entry.member, entry.score);
          return 1;
        },
        async zRange(
          key: string,
          start: number,
          stop: number,
          options?: { by?: 'score' | 'rank'; reverse?: boolean; limit?: { offset: number; count: number } }
        ) {
          const zset = ensureZSet(key);
          let entries = Array.from(zset.entries()).map(([member, score]) => ({ member, score }));
          if (options?.by === 'score') {
            entries = entries
              .filter((entry) => entry.score >= start && entry.score <= stop)
              .sort((left, right) => left.score - right.score);
          } else {
            entries = entries.sort((left, right) => {
              return options?.reverse ? right.score - left.score : left.score - right.score;
            });
            const endIndex = stop < 0 ? entries.length : stop + 1;
            entries = entries.slice(Math.max(0, start), Math.max(0, endIndex));
          }
          if (options?.limit) {
            entries = entries.slice(options.limit.offset, options.limit.offset + options.limit.count);
          }
          return entries;
        },
        async zRem(key: string, members: string[]) {
          const zset = ensureZSet(key);
          let removed = 0;
          for (const member of members) {
            if (zset.delete(member)) {
              removed += 1;
            }
          }
          return removed;
        },
        async zCard(key: string) {
          return ensureZSet(key).size;
        },
        async hGetAll(key: string) {
          return Object.fromEntries(ensureHash(key).entries());
        },
        async hGet(key: string, field: string) {
          return ensureHash(key).get(field) ?? null;
        },
        async hSet(key: string, entries: Record<string, string>) {
          const hash = ensureHash(key);
          for (const [field, value] of Object.entries(entries)) {
            hash.set(field, value);
          }
          return Object.keys(entries).length;
        },
        async hDel(key: string, fields: string[]) {
          const hash = ensureHash(key);
          let removed = 0;
          for (const field of fields) {
            if (hash.delete(field)) {
              removed += 1;
            }
          }
          return removed;
        },
      },
    },
    record,
    subredditId,
    getUserByUsernameCalls,
    setUserFlairCalls,
    addModNoteCalls,
    createConversationCalls,
    archiveCalls,
    replyCalls,
    unbanUserCalls,
    redisStore,
    hashStore,
    zsetStore,
    getParsedRecord(recordId = record.id) {
      const payload = redisStore.get(verificationRecordTestKey(subredditId, recordId));
      return payload ? parseRecord(payload) : null;
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

test('normalizeUsername preserves legacy key-compatible normalization', () => {
  assert.equal(normalizeUsername('Example_User'), 'example_user');
  assert.equal(normalizeUsername('u/Example_User'), 'example_user');
  assert.equal(normalizeUsername('/u/Example_User'), '/u/example_user');
  assert.equal(normalizeUsername('/user/Example_User/'), '/user/example_user/');
  assert.equal(
    normalizeUsername('https://www.reddit.com/user/Example_User/about/'),
    'https://www.reddit.com/user/example_user/about/'
  );
});

test('normalizeUsername keeps malformed legacy values stable for lookup keys', () => {
  assert.equal(normalizeUsername(''), '');
  assert.equal(normalizeUsername('   '), '');
  assert.equal(normalizeUsername('r/example'), 'r/example');
  assert.equal(normalizeUsername('https://www.reddit.com/message/compose'), 'https://www.reddit.com/message/compose');
});

test('normalizeUsernameStrict canonicalizes supported user identifiers', () => {
  assert.equal(normalizeUsernameStrict('Example_User'), 'example_user');
  assert.equal(normalizeUsernameStrict('u/Example_User'), 'example_user');
  assert.equal(normalizeUsernameStrict('/u/Example_User'), 'example_user');
  assert.equal(normalizeUsernameStrict('/user/Example_User/'), 'example_user');
  assert.equal(normalizeUsernameStrict('https://www.reddit.com/user/Example_User/about/'), 'example_user');
});

test('normalizeUsernameStrict rejects malformed non-user inputs', () => {
  assert.equal(normalizeUsernameStrict(''), '');
  assert.equal(normalizeUsernameStrict('   '), '');
  assert.equal(normalizeUsernameStrict('https://www.reddit.com/message/compose'), '');
  assert.equal(normalizeUsernameStrict('https://example.com/not-a-user'), '');
});

test('parseRedditUsernameList normalizes usernames and reports invalid tokens', () => {
  const parsed = parseRedditUsernameList(`
    u/Test_User1,
    test_user2
    /user/Test_User3/
    test_user1
    bad token
    https://example.com/nope
  `);

  assert.deepEqual(parsed, {
    usernames: ['test_user1', 'test_user2', 'test_user3'],
    invalidTokens: ['bad token', 'https://example.com/nope'],
    canonicalValue: 'test_user1,test_user2,test_user3',
  });
});

test('splitRedditUsernameListAcrossSettings chunks a canonical list by byte size', () => {
  const chunked = splitRedditUsernameListAcrossSettings(['alpha', 'bravo', 'charlie'], {
    maxChunks: 3,
    maxBytesPerChunk: 13,
  });

  assert.deepEqual(chunked, {
    chunks: ['alpha,bravo', 'charlie'],
    overflow: false,
    overflowedUsernamesCount: 0,
  });
});

test('splitRedditUsernameListAcrossSettings reports overflow when the configured chunk count is exceeded', () => {
  const chunked = splitRedditUsernameListAcrossSettings(['alpha', 'bravo', 'charlie'], {
    maxChunks: 1,
    maxBytesPerChunk: 13,
  });

  assert.deepEqual(chunked, {
    chunks: ['alpha,bravo'],
    overflow: true,
    overflowedUsernamesCount: 1,
  });
});

test('normalizeUsernameForLookup canonicalizes known user formats while preserving legacy malformed values', () => {
  assert.equal(normalizeUsernameForLookup('Example_User'), 'example_user');
  assert.equal(normalizeUsernameForLookup('u/Example_User'), 'example_user');
  assert.equal(normalizeUsernameForLookup('/u/Example_User'), 'example_user');
  assert.equal(normalizeUsernameForLookup('/user/Example_User/'), 'example_user');
  assert.equal(normalizeUsernameForLookup('https://www.reddit.com/user/Example_User/about/'), 'example_user');
  assert.equal(normalizeUsernameForLookup('https://www.reddit.com/message/compose'), 'https://www.reddit.com/message/compose');
});

test('legacy stored usernames remain findable through lookup normalization', () => {
  const legacyStoredProfileUrl = 'https://www.reddit.com/user/Example_User/about/';
  assert.equal(normalizeUsername(legacyStoredProfileUrl), 'https://www.reddit.com/user/example_user/about/');
  assert.equal(normalizeUsernameForLookup(legacyStoredProfileUrl), 'example_user');
  assert.equal(normalizeUsernameForLookup('Example_User'), 'example_user');
});

test('usernameLookupFields includes canonical and common legacy aliases', () => {
  assert.deepEqual(usernameLookupFields('Example_User'), [
    'example_user',
    'u/example_user',
    '/u/example_user',
    '/user/example_user',
    '/user/example_user/',
    'https://www.reddit.com/user/example_user',
    'https://www.reddit.com/user/example_user/',
    'https://www.reddit.com/user/example_user/about/',
  ]);
});

test('normalizeModmailConversationId preserves non-numeric Devvit conversation IDs', () => {
  assert.equal(normalizeModmailConversationId('39to20'), '39to20');
  assert.equal(normalizeModmailConversationId('39t18m'), '39t18m');
  assert.equal(normalizeModmailConversationId('abcdef'), 'abcdef');
  assert.equal(normalizeModmailConversationId('ModmailConversation_3a4i16'), '3a4i16');
  assert.equal(normalizeModmailConversationId('ModmailConversation:3a4i16'), '3a4i16');
});

test('normalizeModmailConversationId rejects blank and whitespace values', () => {
  assert.equal(normalizeModmailConversationId(''), '');
  assert.equal(normalizeModmailConversationId('   '), '');
  assert.equal(normalizeModmailConversationId('\n\t  '), '');
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

test('loadApprovalFlairOptionsForSettings returns only mod-only user flairs in API order with stable labels', async () => {
  const optionsContext = createApprovalFlairOptionsContext({
    flairTemplates: [
      {
        id: 'AAA-111',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
      {
        id: 'BBB-222',
        text: 'Visible to users',
        modOnly: false,
        backgroundColor: '#abcdef',
        textColor: 'dark',
      },
      {
        id: 'CCC-333',
        text: 'Verified',
        modOnly: true,
        backgroundColor: 'transparent',
        textColor: 'dark',
      },
      {
        id: 'DDD-444',
        text: '',
        modOnly: true,
        backgroundColor: '#654321',
        textColor: 'light',
      },
    ],
  });

  const options = await loadApprovalFlairOptionsForSettings(optionsContext.context as never);

  assert.deepEqual(options, [
    {
      id: 'AAA-111',
      text: 'Verified',
      label: 'Verified — AAA-111',
      backgroundColor: '#123456',
      textColor: 'light',
    },
    {
      id: 'CCC-333',
      text: 'Verified',
      label: 'Verified — CCC-333',
      backgroundColor: 'transparent',
      textColor: 'dark',
    },
    {
      id: 'DDD-444',
      text: '',
      label: '(untitled flair) — DDD-444',
      backgroundColor: '#654321',
      textColor: 'light',
    },
  ]);
  assert.equal(optionsContext.getUserFlairTemplatesCallCount(), 1);
});

test('loadApprovalFlairOptionsForSettings keeps unique flair text labels clean', async () => {
  const optionsContext = createApprovalFlairOptionsContext({
    flairTemplates: [
      {
        id: 'XYZ-123',
        text: 'Approved',
        modOnly: true,
        backgroundColor: '#ffffff',
        textColor: 'dark',
      },
    ],
  });

  const options = await loadApprovalFlairOptionsForSettings(optionsContext.context as never);

  assert.equal(options.length, 1);
  assert.equal(options[0].label, 'Approved');
});

test('loadApprovalFlairOptionsForSettings surfaces flair lookup failures', async () => {
  const optionsContext = createApprovalFlairOptionsContext({
    flairTemplates: new Error('flair lookup failed'),
  });

  await assert.rejects(
    async () => await loadApprovalFlairOptionsForSettings(optionsContext.context as never),
    /flair lookup failed/
  );
});

test('refreshConfiguredFlairTemplateCache refreshes additional approval flair metadata from subreddit templates', async () => {
  const saveContext = createFlairSettingsSaveContext({
    flairTemplates: [
      {
        id: 'ABC-123',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
      {
        id: 'DEF-456',
        text: 'Trusted Verified',
        modOnly: true,
        backgroundColor: '#654321',
        textColor: 'dark',
      },
    ],
  });

  const refreshed = await refreshConfiguredFlairTemplateCache(
    saveContext.context as never,
    't5_example',
    'example',
    {
      ...buildRuntimeConfig(),
      flairTemplateId: 'ABC-123',
      additionalApprovalFlairs: [
        { templateId: 'def-456', label: 'Old label', text: 'Old text' },
      ],
      flairTemplateCacheTemplateId: '',
      flairTemplateCacheText: '',
      flairTemplateCacheCheckedAt: 0,
    },
    true
  );

  assert.deepEqual(refreshed.additionalApprovalFlairs, [
    {
      templateId: 'def-456',
      label: 'Trusted Verified',
      text: 'Trusted Verified',
    },
  ]);
  assert.equal(refreshed.flairTemplateCacheText, 'Verified');
  assert.deepEqual(
    JSON.parse(saveContext.hashStore.get(saveContext.configKey)?.get('additional_approval_flairs_json') ?? '[]'),
    [
      {
        templateId: 'def-456',
        label: 'Trusted Verified',
        text: 'Trusted Verified',
      },
    ]
  );
});

test('looksLikeInternalModmailArchiveError matches internal conversation archive failures', () => {
  assert.equal(
    looksLikeInternalModmailArchiveError(
      '2 UNKNOWN: HTTP request failed: {"explanation":"Cannot archive/unarchive internal conversations.","reason":"UNKNOWN_ERROR"}'
    ),
    true
  );
  assert.equal(looksLikeInternalModmailArchiveError('http status 500 Internal Server Error'), false);
});

test('onSaveFlairTemplateValues preserves verificationsEnabled when it is omitted', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      verifications_enabled: 'false',
      required_photo_count: '2',
      flair_template_id: 'OLD-123',
      flair_css_class: 'verified',
    },
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: 'approved',
      requiredPhotoCount: 2,
      photoInstructions: 'Updated instructions',
    },
    saveContext.context as never
  );

  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verifications_enabled'), 'false');
  assert.ok(saveContext.setFieldsCalls.every((entries) => !('verifications_enabled' in entries)));
});

test('onSaveFlairTemplateValues saves verification requirement toggles', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      flair_template_id: 'ABC-123',
    },
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: '',
      requiredPhotoCount: 2,
      verificationRequiredToPost: true,
      verificationRequiredToComment: true,
    },
    saveContext.context as never
  );

  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verification_required_to_post'), 'true');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verification_required_to_comment'), 'true');
});

test('onSaveFlairTemplateValues preserves verification requirement toggles when omitted', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      verification_required_to_post: 'true',
      verification_required_to_comment: 'true',
      flair_template_id: 'OLD-123',
    },
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: '',
      requiredPhotoCount: 2,
    },
    saveContext.context as never
  );

  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verification_required_to_post'), 'true');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verification_required_to_comment'), 'true');
  assert.ok(saveContext.setFieldsCalls.every((entries) => !('verification_required_to_post' in entries)));
  assert.ok(saveContext.setFieldsCalls.every((entries) => !('verification_required_to_comment' in entries)));
});

test('onSaveFlairTemplateValues saves translated photo instructions with the primary instructions', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      flair_template_id: 'ABC-123',
    },
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: '',
      requiredPhotoCount: 2,
      photoInstructionsDefaultLanguage: 'fr',
      photoInstructions: '  Follow the instructions.  ',
      photoInstructionsEs: '  Sigue las instrucciones.  ',
      photoInstructionsFr: '  Suivez les instructions.  ',
      photoInstructionsPtBr: '  Siga as instruções.  ',
    },
    saveContext.context as never
  );

  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('photo_instructions'), 'Follow the instructions.');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('photo_instructions_es'), 'Sigue las instrucciones.');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('photo_instructions_fr'), 'Suivez les instructions.');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('photo_instructions_pt_br'), 'Siga as instruções.');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('photo_instructions_default_language'), 'fr');
});

test('getRuntimeConfig reads translated photo instructions from stored settings', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      photo_instructions: 'Follow the instructions.',
      photo_instructions_es: 'Sigue las instrucciones.',
      photo_instructions_fr: '  Suivez les instructions.  ',
      photo_instructions_pt_br: '  Siga as instruções.  ',
      photo_instructions_default_language: 'pt-br',
    },
  });

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.photoInstructions, 'Follow the instructions.');
  assert.equal(runtimeConfig.photoInstructionsEs, 'Sigue las instrucciones.');
  assert.equal(runtimeConfig.photoInstructionsFr, 'Suivez les instructions.');
  assert.equal(runtimeConfig.photoInstructionsPtBr, 'Siga as instruções.');
  assert.equal(runtimeConfig.photoInstructionsDefaultLanguage, 'pt-br');
});

test('getRuntimeConfig defaults translated photo instructions to empty strings and english default language when unset', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      photo_instructions: 'Follow the instructions.',
    },
  });

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.photoInstructionsEs, '');
  assert.equal(runtimeConfig.photoInstructionsFr, '');
  assert.equal(runtimeConfig.photoInstructionsPtBr, '');
  assert.equal(runtimeConfig.photoInstructionsDefaultLanguage, 'en');
});

test('getRuntimeConfig defaults verification requirement toggles off when unset', async () => {
  const saveContext = createFlairSettingsSaveContext();

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.verificationRequiredToPost, false);
  assert.equal(runtimeConfig.verificationRequiredToComment, false);
});

test('getRuntimeConfig defaults the user advisory score badge install setting on', async () => {
  const saveContext = createFlairSettingsSaveContext();

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.userAdvisoryScoreBadgeEnabled, true);
});

test('getRuntimeConfig reads disabled user advisory score badge install setting', async () => {
  const saveContext = createFlairSettingsSaveContext({
    userAdvisoryScoreBadgeEnabled: false,
  });

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.userAdvisoryScoreBadgeEnabled, false);
});

test('getRuntimeConfig defaults the content creator badge install setting on', async () => {
  const saveContext = createFlairSettingsSaveContext();

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.contentCreatorBadgeEnabled, true);
});

test('getRuntimeConfig reads disabled content creator badge install setting', async () => {
  const saveContext = createFlairSettingsSaveContext({
    contentCreatorBadgeEnabled: false,
  });

  const runtimeConfig = await getRuntimeConfig(saveContext.context as never, 't5_example');

  assert.equal(runtimeConfig.contentCreatorBadgeEnabled, false);
});

test('onSaveFlairTemplateValues still updates verificationsEnabled when explicitly provided', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      verifications_enabled: 'true',
      required_photo_count: '2',
      flair_template_id: 'OLD-123',
    },
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: '',
      verificationsEnabled: false,
      requiredPhotoCount: 2,
      photoInstructions: '',
    },
    saveContext.context as never
  );

  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('verifications_enabled'), 'false');
  assert.ok(saveContext.setFieldsCalls.some((entries) => entries.verifications_enabled === 'false'));
});

test('onSaveFlairTemplateValues reuses a single flair template lookup when template selections change', async () => {
  const saveContext = createFlairSettingsSaveContext({
    multipleApprovalFlairsEnabled: true,
    storedConfig: {
      flair_template_id: 'OLD-123',
      additional_approval_flairs_json: JSON.stringify([{ templateId: 'old-456', label: 'Old', text: 'Old' }]),
    },
    flairTemplates: [
      {
        id: 'ABC-123',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
      {
        id: 'DEF-456',
        text: 'Trusted Verified',
        modOnly: true,
        backgroundColor: '#654321',
        textColor: 'dark',
      },
      {
        id: 'GHI-789',
        text: 'VIP Verified',
        modOnly: true,
        backgroundColor: '#111111',
        textColor: 'light',
      },
    ],
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: 'verified',
      requiredPhotoCount: 2,
      photoInstructions: 'Updated instructions',
      additionalApprovalFlairs: [
        { templateId: 'DEF-456', label: 'Trusted', text: 'Trusted Verified' },
        { templateId: 'GHI-789', label: 'VIP', text: 'VIP Verified' },
      ],
    },
    saveContext.context as never
  );

  assert.equal(saveContext.flairTemplateFetchCount, 1);
});

test('onSaveFlairTemplateValues preserves legacy additional flairs without validating them when multi-flair is disabled', async () => {
  const saveContext = createFlairSettingsSaveContext({
    multipleApprovalFlairsEnabled: false,
    storedConfig: {
      flair_template_id: 'OLD-123',
      flair_template_cache_template_id: 'old-123',
      flair_template_cache_text: 'Old Verified',
      additional_approval_flairs_json: JSON.stringify([
        { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
        { templateId: 'ghi-789', label: 'VIP', text: 'VIP Verified' },
      ]),
    },
    flairTemplates: [
      {
        id: 'ABC-123',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
    ],
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: 'verified',
      requiredPhotoCount: 2,
      photoInstructions: 'Updated instructions',
      additionalApprovalFlairs: [],
    },
    saveContext.context as never
  );

  assert.equal(saveContext.flairTemplateFetchCount, 1);
  assert.deepEqual(
    JSON.parse(saveContext.hashStore.get(saveContext.configKey)?.get('additional_approval_flairs_json') ?? '[]'),
    [
      { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
      { templateId: 'ghi-789', label: 'VIP', text: 'VIP Verified' },
    ]
  );
});

test('onSaveFlairTemplateValues validates saved additional flairs when multi-flair is enabled', async () => {
  const saveContext = createFlairSettingsSaveContext({
    multipleApprovalFlairsEnabled: true,
    storedConfig: {
      flair_template_id: 'OLD-123',
      additional_approval_flairs_json: JSON.stringify([
        { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
      ]),
    },
    flairTemplates: [
      {
        id: 'ABC-123',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
    ],
  });

  await assert.rejects(
    onSaveFlairTemplateValues(
      {
        flairTemplateId: 'ABC-123',
        flairCssClass: 'verified',
        requiredPhotoCount: 2,
        photoInstructions: 'Updated instructions',
        additionalApprovalFlairs: [
          { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
        ],
      },
      saveContext.context as never
    ),
    /Additional flair \(def-456\) is invalid: Flair template ID was not found/
  );
  assert.equal(saveContext.flairTemplateFetchCount, 1);
});

test('onSaveFlairTemplateValues skips flair template lookups when template selections are unchanged', async () => {
  const saveContext = createFlairSettingsSaveContext({
    storedConfig: {
      flair_template_id: 'ABC-123',
      flair_css_class: 'verified',
      flair_template_cache_template_id: 'abc-123',
      flair_template_cache_text: 'Verified',
      flair_template_cache_checked_at: `${Date.now()}`,
      additional_approval_flairs_json: JSON.stringify([{ templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' }]),
    },
    flairTemplates: [
      {
        id: 'ABC-123',
        text: 'Verified',
        modOnly: true,
        backgroundColor: '#123456',
        textColor: 'light',
      },
      {
        id: 'DEF-456',
        text: 'Trusted Verified',
        modOnly: true,
        backgroundColor: '#654321',
        textColor: 'dark',
      },
    ],
  });

  await onSaveFlairTemplateValues(
    {
      flairTemplateId: 'ABC-123',
      flairCssClass: 'approved',
      requiredPhotoCount: 3,
      photoInstructions: 'Updated instructions',
      additionalApprovalFlairs: [
        { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
      ],
    },
    saveContext.context as never
  );

  assert.equal(saveContext.flairTemplateFetchCount, 0);
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('flair_template_cache_text'), 'Verified');
  assert.equal(saveContext.hashStore.get(saveContext.configKey)?.get('flair_template_cache_template_id'), 'abc-123');
});

test('validateMaxDenialsBeforeBlockSetting allows 0 to disable auto-block', () => {
  assert.equal(validateMaxDenialsBeforeBlockSetting(0), undefined);
});

test('normalizeMaxDenialsBeforeBlockSetting preserves 0 and 2+ while rejecting 1', () => {
  assert.equal(normalizeMaxDenialsBeforeBlockSetting(-1), 0);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting('-1'), 0);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting(0), 0);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting('0'), 0);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting(1), 3);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting('1'), 3);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting(2), 2);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting('2'), 2);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting(3), 3);
  assert.equal(normalizeMaxDenialsBeforeBlockSetting('3'), 3);
});

test('validateMaxDenialsBeforeBlockSetting rejects 1', () => {
  assert.equal(
    validateMaxDenialsBeforeBlockSetting(1),
    'Enter 0 to disable auto-block, or a whole number of denials (2 or greater).'
  );
});

test('validateMaxDenialsBeforeBlockSetting accepts numeric strings for install-setting validation', () => {
  assert.equal(validateMaxDenialsBeforeBlockSetting('0'), undefined);
  assert.equal(validateMaxDenialsBeforeBlockSetting('3'), undefined);
  assert.equal(
    validateMaxDenialsBeforeBlockSetting('1'),
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
});

test('getModeratorAccessSnapshot falls back to cached moderator permissions when live permission lookup fails', async () => {
  const redisStore = new Map<string, string>();
  const firstLookupContext = createModeratorLookupContext({
    redisStore,
    permissionResponses: [['access', 'config']],
  });
  const secondLookupContext = createModeratorLookupContext({
    redisStore,
    permissionResponses: [new Error('reddit 500')],
  });

  const first = await getModeratorAccessSnapshot(firstLookupContext.context as never, 'ExampleSub', 'mod_one');
  const second = await getModeratorAccessSnapshot(secondLookupContext.context as never, 'ExampleSub', 'mod_one');

  assert.equal(first.isModerator, true);
  assert.deepEqual(first.permissions, ['access', 'config']);
  assert.equal(second.isModerator, true);
  assert.deepEqual(second.permissions, ['access', 'config']);
  assert.equal(first.state, 'confirmed');
  assert.equal(second.state, 'cached');
  assert.equal(firstLookupContext.permissionCallCount, 1);
  assert.equal(secondLookupContext.permissionCallCount, 1);
});

test('getModeratorAccessSnapshot returns unknown when permission lookup is unavailable', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [new Error('2 UNKNOWN: HTTP request failed with http status 500')],
  });

  const access = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_one');

  assert.equal(access.isModerator, false);
  assert.equal(access.state, 'unknown');
  assert.equal(access.permissionState, 'unknown');
});

test('getModeratorAccessSnapshot returns denied when permission lookup confirms no moderator permissions', async () => {
  const lookupContext = createModeratorLookupContext({
    currentUsername: 'mod_two',
    permissionResponses: [[]],
  });

  const access = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_two');

  assert.equal(access.isModerator, false);
  assert.equal(access.state, 'denied');
});

test('getModeratorAccessSnapshot memoizes repeated lookups within the same request context', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [['access']],
  });

  const first = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_one');
  const second = await getModeratorAccessSnapshot(lookupContext.context as never, 'ExampleSub', 'mod_one');

  assert.equal(first.isModerator, true);
  assert.equal(second.isModerator, true);
  assert.equal(lookupContext.permissionCallCount, 1);
});

test('assertCanReview returns a temporary error when moderator lookup is transiently unavailable', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [new Error('2 UNKNOWN: http request failed with http status 500')],
  });
  const originalConsoleLog = console.log;
  let loggedMessages = 0;
  console.log = () => {
    loggedMessages += 1;
  };

  try {
    await assert.rejects(
      () => assertCanReview(lookupContext.context as never, 'ExampleSub', 'mod_one'),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error & { status?: number }).status, 503);
        assert.equal((error as Error).message, 'Unable to verify moderator access right now. Please retry.');
        return true;
      }
    );
    assert.equal(loggedMessages, 0);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('assertCanReview suppresses noisy logs for Devvit gRPC 500 moderator lookup failures', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [new Error('2 UNKNOWN: grpc invocation failed with status 2; 500 Internal Server Error')],
  });
  const originalConsoleLog = console.log;
  let loggedMessages = 0;
  console.log = () => {
    loggedMessages += 1;
  };

  try {
    await assert.rejects(
      () => assertCanReview(lookupContext.context as never, 'ExampleSub', 'mod_one'),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error & { status?: number }).status, 503);
        assert.equal((error as Error).message, 'Unable to verify moderator access right now. Please retry.');
        return true;
      }
    );
    assert.equal(loggedMessages, 0);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('getHubModeratorUiState returns a visible button for confirmed review moderators', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [['access']],
    pendingCount: 7,
  });

  const state = await getHubModeratorUiState(lookupContext.context as never);

  assert.deepEqual(state, {
    buttonVisible: true,
    isModerator: true,
    canReview: true,
    pendingCount: 7,
  });
  assert.equal(lookupContext.permissionCallCount, 1);
});

test('getHubModeratorUiState keeps the button hidden during moderator lookup backoff', async () => {
  const redisStore = new Map<string, string>([
    ['subreddit:t5_example:moderator-ui:unavailable:t2_mod', '1'],
  ]);
  const lookupContext = createModeratorLookupContext({
    redisStore,
    permissionResponses: [['access']],
    pendingCount: 5,
  });

  const state = await getHubModeratorUiState(lookupContext.context as never);

  assert.deepEqual(state, {
    buttonVisible: false,
    isModerator: false,
    canReview: false,
    pendingCount: 0,
  });
  assert.equal(lookupContext.permissionCallCount, 0);
});

test('getHubModeratorUiState keeps the button hidden when permission lookup is unavailable', async () => {
  const lookupContext = createModeratorLookupContext({
    permissionResponses: [new Error('2 UNKNOWN: HTTP request failed with http status 403')],
    pendingCount: 5,
  });

  const state = await getHubModeratorUiState(lookupContext.context as never);

  assert.deepEqual(state, {
    buttonVisible: false,
    isModerator: false,
    canReview: false,
    pendingCount: 0,
  });
  assert.equal(lookupContext.permissionCallCount, 1);
});

test('loadHubDashboard uses the userId latest pointer when viewer identity is unavailable', async () => {
  const record = buildRecord({
    id: 'verification_approved',
    username: 'dcltw',
    userId: 't2_viewer',
    status: 'approved',
    reviewedAt: '2026-03-11T12:00:00.000Z',
    submittedAt: '2026-03-11T12:00:00.000Z',
  });
  const hubContext = createHubDashboardContext({
    userId: 't2_viewer',
    currentUserResponses: [
      new Error(
        '2 UNKNOWN: HTTP request to URL: https://oauth.reddit.com/user/dcltw/about?raw_json=1 failed with error: Get "https://oauth.reddit.com/user/dcltw/about?raw_json=1": httpbp.ClientError: http status 403 Forbidden'
      ),
    ],
    record,
  });
  hubContext.redisStore.set(userLatestByIdTestKey('t5_example', 't2_viewer'), record.id);

  const dashboard = await loadHubDashboard(hubContext.context as never);

  assert.equal(dashboard.viewerUsername, 'dcltw');
  assert.equal(dashboard.userLatest?.id, record.id);
  assert.equal(dashboard.viewerShouldDisplayVerified, true);
  assert.equal(dashboard.viewerFlairCheckSource, 'viewer-snapshot:unavailable');
  assert.equal(hubContext.currentUserCallCount, 1);
  assert.equal(hubContext.currentUsernameCallCount, 0);
});

test('loadHubDashboard backfills userId pointers from legacy username pointers', async () => {
  const record = buildRecord({
    id: 'verification_pending',
    username: 'legacy_user',
    userId: 't2_legacy',
    status: 'pending',
  });
  const hubContext = createHubDashboardContext({
    userId: 't2_legacy',
    currentUsername: 'legacy_user',
    currentUserResponses: [
      {
        username: 'legacy_user',
        id: 't2_legacy',
      },
    ],
    record,
  });
  hubContext.redisStore.set(userLatestTestKey('t5_example', 'legacy_user'), record.id);
  hubContext.redisStore.set(userPendingTestKey('t5_example', 'legacy_user'), record.id);

  const dashboard = await loadHubDashboard(hubContext.context as never);

  assert.equal(dashboard.userLatest?.id, record.id);
  assert.equal(
    hubContext.redisStore.get(userLatestByIdTestKey('t5_example', 't2_legacy')),
    record.id
  );
  assert.equal(
    hubContext.redisStore.get(userPendingByIdTestKey('t5_example', 't2_legacy')),
    record.id
  );
});

test('loadModDashboard reports total pending count while loading the oldest capped queue records', async () => {
  const modContext = createHubDashboardContext({
    userId: 't2_mod',
    currentUsername: 'mod_one',
    currentUserResponses: [
      {
        username: 'mod_one',
        id: 't2_mod',
      },
    ],
    permissions: ['access'],
    hashValues: {
      flair_template_id: '',
    },
  });
  const subredditId = 't5_example';
  const pendingIndex = pendingIndexTestKey(subredditId);

  for (let index = 0; index < 175; index++) {
    const id = `verification_${String(index).padStart(3, '0')}`;
    const submittedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
    const record = buildRecord({
      id,
      username: `pending_user_${index}`,
      status: 'pending',
      submittedAt,
      subredditId,
      subredditName: 'example',
    });
    modContext.redisStore.set(verificationRecordTestKey(subredditId, id), JSON.stringify(record));
    ensureTestZSet(modContext.zsetStore, pendingIndex).set(id, new Date(submittedAt).getTime());
  }

  const dashboard = await loadModDashboard(modContext.context as never);

  assert.equal(dashboard.pendingCount, 175);
  assert.equal(dashboard.pending.length, 150);
  assert.equal(dashboard.pending[0]?.id, 'verification_000');
  assert.equal(dashboard.pending[149]?.id, 'verification_149');
  assert.equal(dashboard.pending.some((record) => record.id === 'verification_174'), false);
});

test('loadHubDashboard applies global blocks and exposes the developer panel to authorized developers', async () => {
  const record = buildRecord({
    id: 'verification_global_blocked',
    username: 'example_user',
    userId: 't2_viewer',
    status: 'approved',
    reviewedAt: '2026-03-11T12:00:00.000Z',
    submittedAt: '2026-03-11T12:00:00.000Z',
  });
  const hubContext = createHubDashboardContext({
    userId: 't2_viewer',
    currentUsername: 'example_user',
    currentUserResponses: [
      {
        username: 'example_user',
        id: 't2_viewer',
      },
    ],
    record,
    settingsValues: {
      [GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME]: '2',
      [GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[0]]: 'u/example_user',
      [GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[1]]: 'Test_User2',
      developer_ui_usernames: 'Example_User',
    },
  });
  hubContext.redisStore.set(userLatestByIdTestKey('t5_example', 't2_viewer'), record.id);

  const dashboard = await loadHubDashboard(hubContext.context as never);
  const hubState = toHubState(dashboard);

  assert.equal(dashboard.viewerBlocked?.scope, 'global');
  assert.equal(dashboard.viewerBlocked?.reason, 'Blocked by developer');
  assert.equal(dashboard.viewerShouldDisplayVerified, false);
  assert.equal(dashboard.viewerAwaitingFlairPropagation, false);
  assert.deepEqual(hubState.developerPanel, {
    accessGranted: true,
    currentUsernames: ['example_user', 'test_user2'],
    invalidTokens: [],
    canonicalValue: 'example_user,test_user2',
  });
});

test('loadHubDashboard omits the developer panel for non-developers', async () => {
  const hubContext = createHubDashboardContext({
    userId: 't2_plain',
    currentUsername: 'plain_user',
    currentUserResponses: [
      {
        username: 'plain_user',
        id: 't2_plain',
      },
    ],
    settingsValues: {
      [GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME]: '1',
      [GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[0]]: 'blocked_user',
      developer_ui_usernames: 'example_user',
    },
  });

  const dashboard = await loadHubDashboard(hubContext.context as never);
  const hubState = toHubState(dashboard);

  assert.equal(dashboard.developerPanel, undefined);
  assert.equal(hubState.developerPanel, undefined);
});

test('loadHubDashboard respects the active global blocklist chunk count and ignores stale later chunks', async () => {
  const hubContext = createHubDashboardContext({
    userId: 't2_plain',
    currentUsername: 'stale_user',
    currentUserResponses: [
      {
        username: 'stale_user',
        id: 't2_plain',
      },
    ],
    settingsValues: {
      [GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME]: '1',
      [GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[0]]: 'active_user',
      [GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[1]]: 'stale_user',
    },
  });

  const dashboard = await loadHubDashboard(hubContext.context as never);

  assert.equal(dashboard.viewerBlocked, null);
});

test('submitVerification rejects globally blocked usernames', async () => {
  await assert.rejects(
    submitVerification(
      {
        is18Confirmed: true,
        adultOnlySelfPhotosConfirmed: true,
        termsAccepted: true,
        photoOneUrl: 'https://i.redd.it/one.png',
        photoTwoUrl: 'https://i.redd.it/two.png',
        photoThreeUrl: '',
      } as never,
      {
        subredditId: 't5_example',
        subredditName: 'example',
        userId: 't2_viewer',
        reddit: {
          async getCurrentUsername() {
            return 'example_user';
          },
        },
        settings: {
          async get(key: string) {
            if (key === GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME) {
              return '1';
            }
            if (key === GLOBAL_BLOCKED_USERNAME_SETTING_NAMES[0]) {
              return 'u/example_user';
            }
            return undefined;
          },
        },
        redis: {
          async hGetAll() {
            return {};
          },
        },
      } as never
    ),
    /You cannot submit a verification request\./
  );
});

test('submitVerification rejects submissions in the VouchX home subreddit', async () => {
  await assert.rejects(
    submitVerification(
      {
        is18Confirmed: true,
        adultOnlySelfPhotosConfirmed: true,
        termsAccepted: true,
        photoOneUrl: 'https://i.redd.it/one.png',
        photoTwoUrl: 'https://i.redd.it/two.png',
        photoThreeUrl: '',
      } as never,
      {
        subredditId: 't5_vouchx',
        subredditName: 'vouchx',
        userId: 't2_viewer',
        reddit: {
          async getCurrentUsername() {
            return 'example_user';
          },
        },
      } as never
    ),
    /Verification submissions are disabled in r\/vouchx\./
  );
});

test('clearExpiredPendingClaim clears stale claims', () => {
  const staleRecord = buildRecord({
    claimedBy: 'mod_one',
    claimedAt: '2026-03-10T11:00:00.000Z',
  });

  // 25 hours after the claim — past the 24h TTL.
  const cleared = clearExpiredPendingClaim(staleRecord, Date.parse('2026-03-11T12:00:00.000Z'));
  assert.equal(cleared.claimedBy, null);
  assert.equal(cleared.claimedAt, null);
});

test('clearExpiredPendingClaim keeps active claims', () => {
  const activeRecord = buildRecord({
    claimedBy: 'mod_one',
    claimedAt: '2026-03-10T13:00:00.000Z',
  });

  // 23 hours after the claim — still inside the 24h TTL.
  const result = clearExpiredPendingClaim(activeRecord, Date.parse('2026-03-11T12:00:00.000Z'));
  assert.equal(result.claimedBy, 'mod_one');
  assert.equal(result.claimedAt, '2026-03-10T13:00:00.000Z');
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

test('parseRecord preserves legacy pending account details snapshots without total karma', () => {
  const parsed = parseRecord(
    JSON.stringify(
      buildRecord({
        accountDetails: {
          capturedAt: '2026-03-11T12:00:00.000Z',
          accountCreatedAt: '2026-03-01T12:00:00.000Z',
          subredditKarma: 42,
          previousDeniedAttempts: 2,
          banStatus: 'not_banned',
        },
      })
    )
  );

  assert.ok(parsed);
  assert.deepEqual(parsed.accountDetails, {
    capturedAt: '2026-03-11T12:00:00.000Z',
    accountCreatedAt: '2026-03-01T12:00:00.000Z',
    totalKarma: null,
    subredditKarma: 42,
    previousDeniedAttempts: 2,
    banStatus: 'not_banned',
    hasVerifiedEmail: null,
    hasRedditPremium: null,
    isShadowBanned: null,
    recentActivityCount: null,
    socialLinkCount: 0,
    isContentCreator: false,
    creatorLinkTypes: [],
    lastDenial: null,
  });
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
  assert.deepEqual(modState.pending[0].accountDetails, {
    ...accountDetails,
    ...computeUserGrade(accountDetails),
  });
});

test('toModPanelState omits advisory score fields from pending items when disabled', () => {
  const accountDetails = buildPendingAccountDetailsSnapshot({
    isContentCreator: true,
    creatorLinkTypes: ['onlyfans'],
  });
  const modState = toModPanelState(
    buildDashboardData({
      config: { ...buildRuntimeConfig(), userAdvisoryScoreBadgeEnabled: false },
      pendingCount: 1,
      pending: [buildRecord({ accountDetails }) as never],
    })
  );

  assert.equal(modState.pending.length, 1);
  const pendingAccountDetails = modState.pending[0].accountDetails as Record<string, unknown> | null | undefined;
  assert.deepEqual(pendingAccountDetails, accountDetails);
  assert.equal(Object.prototype.hasOwnProperty.call(pendingAccountDetails ?? {}, 'grade'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pendingAccountDetails ?? {}, 'score'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pendingAccountDetails ?? {}, 'reasons'), false);
});

test('toModPanelState omits content creator badge fields from pending items when disabled', () => {
  const accountDetails = buildPendingAccountDetailsSnapshot({
    isContentCreator: true,
    creatorLinkTypes: ['onlyfans'],
  });
  const modState = toModPanelState(
    buildDashboardData({
      config: { ...buildRuntimeConfig(), contentCreatorBadgeEnabled: false },
      pendingCount: 1,
      pending: [buildRecord({ accountDetails }) as never],
    })
  );

  assert.equal(modState.pending.length, 1);
  const pendingAccountDetails = modState.pending[0].accountDetails as Record<string, unknown> | null | undefined;
  assert.equal(Object.prototype.hasOwnProperty.call(pendingAccountDetails ?? {}, 'isContentCreator'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pendingAccountDetails ?? {}, 'creatorLinkTypes'), false);
  assert.equal(pendingAccountDetails?.grade, computeUserGrade(accountDetails).grade);
});

test('collectPendingAccountDetailsSnapshot retries transient lookup failures and stores pending snapshot values', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [
      new Error('temporary user lookup failure'),
      { createdAt: new Date('2026-03-01T12:00:00.000Z'), commentKarma: 100, linkKarma: 50 },
    ],
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
    assert.equal(snapshot.totalKarma, 150);
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

test('collectPendingAccountDetailsSnapshot stores banned status when the user is currently banned', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [{ createdAt: new Date('2026-03-01T12:00:00.000Z'), commentKarma: 7, linkKarma: 8 }],
    karmaResponses: [{ fromComments: 1, fromPosts: 2 }],
    bannedResponses: [[{ username: 'example_user' }]],
    denialCount: '1',
  });

  const snapshot = await collectPendingAccountDetailsSnapshot(
    snapshotContext.context as never,
    't5_example',
    'example',
    'example_user',
    '2026-03-11T12:00:00.000Z'
  );

  assert.equal(snapshot.accountCreatedAt, '2026-03-01T12:00:00.000Z');
  assert.equal(snapshot.totalKarma, 15);
  assert.equal(snapshot.subredditKarma, 3);
  assert.equal(snapshot.previousDeniedAttempts, 1);
  assert.equal(snapshot.banStatus, 'banned');
  assert.equal(snapshotContext.bannedCallCount, 1);
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
    assert.equal(snapshot.totalKarma, null);
    assert.equal(snapshot.subredditKarma, null);
    assert.equal(snapshot.banStatus, 'unknown');
    assert.equal(snapshot.previousDeniedAttempts, 3);
    assert.equal(snapshotContext.userCallCount, 2);
    assert.equal(snapshotContext.bannedCallCount, 2);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('collectPendingAccountDetailsSnapshot captures the most recent denial from user history', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [{ createdAt: new Date('2026-03-01T12:00:00.000Z'), commentKarma: 7, linkKarma: 8 }],
    karmaResponses: [{ fromComments: 1, fromPosts: 2 }],
    bannedResponses: [[]],
    denialCount: '2',
    historyRecords: [
      buildRecord({ id: 'rec-approved-new', status: 'approved', moderator: 'mod_two', reviewedAt: '2026-03-09T12:00:00.000Z' }),
      buildRecord({
        id: 'rec-denied-new',
        status: 'denied',
        moderator: 'mod_one',
        reviewedAt: '2026-03-08T12:00:00.000Z',
        denyReason: 'reason_2',
        denyNotes: 'Photo was blurry',
      }),
      buildRecord({
        id: 'rec-denied-old',
        status: 'denied',
        moderator: 'mod_three',
        reviewedAt: '2026-03-01T12:00:00.000Z',
        denyReason: 'reason_1',
      }),
    ],
  });

  const snapshot = await collectPendingAccountDetailsSnapshot(
    snapshotContext.context as never,
    't5_example',
    'example',
    'example_user',
    '2026-03-11T12:00:00.000Z'
  );

  assert.ok(snapshot.lastDenial);
  assert.equal(snapshot.lastDenial?.deniedAt, '2026-03-08T12:00:00.000Z');
  assert.equal(snapshot.lastDenial?.deniedBy, 'mod_one');
  assert.equal(snapshot.lastDenial?.denyReason, 'reason_2');
  assert.equal(snapshot.lastDenial?.denyNotes, 'Photo was blurry');
});

test('collectPendingAccountDetailsSnapshot stores null last denial when history has no denied records', async () => {
  const snapshotContext = createPendingAccountDetailsContext({
    userResponses: [{ createdAt: new Date('2026-03-01T12:00:00.000Z'), commentKarma: 7, linkKarma: 8 }],
    karmaResponses: [{ fromComments: 1, fromPosts: 2 }],
    bannedResponses: [[]],
    denialCount: null,
    historyRecords: [buildRecord({ id: 'rec-approved', status: 'approved', moderator: 'mod_two' })],
  });

  const snapshot = await collectPendingAccountDetailsSnapshot(
    snapshotContext.context as never,
    't5_example',
    'example',
    'example_user',
    '2026-03-11T12:00:00.000Z'
  );

  assert.equal(snapshot.lastDenial, null);
});

test('parsePendingReviewFlag validates flag payloads and drops malformed notes', () => {
  assert.equal(parsePendingReviewFlag(null), null);
  assert.equal(parsePendingReviewFlag({ flaggedBy: 'mod_one', notes: [] }), null);
  assert.equal(parsePendingReviewFlag({ flaggedAt: '2026-03-11T12:00:00.000Z', notes: [] }), null);

  const parsed = parsePendingReviewFlag({
    flaggedBy: 'Mod_One',
    flaggedAt: '2026-03-11T12:00:00.000Z',
    notes: [
      { author: 'Mod_Two', at: '2026-03-11T13:00:00.000Z', text: ` ${'x'.repeat(400)} ` },
      { author: 'Mod_Three', at: 'not-a-date', text: 'dropped because the timestamp is invalid' },
      { author: 'Mod_Four', at: '2026-03-11T14:00:00.000Z', text: '   ' },
      'garbage',
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed?.flaggedBy, 'Mod_One');
  assert.equal(parsed?.notes.length, 1);
  assert.equal(parsed?.notes[0]?.author, 'Mod_Two');
  assert.equal(parsed?.notes[0]?.text.length, 300);
});

test('parseRecord preserves the 2nd-review flag on pending records', () => {
  const reviewFlag = {
    flaggedBy: 'Mod_One',
    flaggedAt: '2026-03-11T12:00:00.000Z',
    notes: [{ author: 'Mod_Two', at: '2026-03-11T13:00:00.000Z', text: 'Take a second look at photo 2' }],
  };
  const parsed = parseRecord(JSON.stringify(buildRecord({ reviewFlag })));
  assert.ok(parsed);
  assert.deepEqual(parsed.reviewFlag, reviewFlag);

  const withoutFlag = parseRecord(JSON.stringify(buildRecord()));
  assert.ok(withoutFlag);
  assert.equal(withoutFlag.reviewFlag, null);
});

test('setPendingFlagState flags, ignores repeats, threads notes, and unflag clears the thread', async () => {
  const reviewContext = createReviewActionContext();

  const flagged = await setPendingFlagState(
    reviewContext.context as never,
    reviewContext.record.id,
    true,
    '  Check photo 2 against the instructions  '
  );
  assert.equal(flagged.changed, true);
  assert.equal(flagged.item.reviewFlag?.flaggedBy, 'Mod_One');
  assert.equal(flagged.item.reviewFlag?.notes.length, 1);
  assert.equal(flagged.item.reviewFlag?.notes[0]?.text, 'Check photo 2 against the instructions');

  const repeat = await setPendingFlagState(reviewContext.context as never, reviewContext.record.id, true);
  assert.equal(repeat.changed, false);
  assert.equal(repeat.item.reviewFlag?.notes.length, 1);

  const noted = await addPendingFlagNote(
    reviewContext.context as never,
    reviewContext.record.id,
    'Photos look consistent to me'
  );
  assert.equal(noted.item.reviewFlag?.notes.length, 2);
  assert.equal(noted.item.reviewFlag?.notes[1]?.author, 'Mod_One');

  const stored = reviewContext.getParsedRecord();
  assert.equal(stored?.reviewFlag?.notes.length, 2);

  const unflagged = await setPendingFlagState(reviewContext.context as never, reviewContext.record.id, false);
  assert.equal(unflagged.changed, true);
  assert.equal(unflagged.item.reviewFlag, null);
  assert.equal(reviewContext.getParsedRecord()?.reviewFlag, null);

  await assert.rejects(
    addPendingFlagNote(reviewContext.context as never, reviewContext.record.id, 'orphan note'),
    /Flag this request/
  );
});

test('approveVerification and denyVerification clear the 2nd-review flag', async () => {
  const reviewFlag = {
    flaggedBy: 'Mod_Two',
    flaggedAt: '2026-03-11T12:00:00.000Z',
    notes: [{ author: 'Mod_Two', at: '2026-03-11T12:00:00.000Z', text: 'Needs a 2nd opinion' }],
  };

  const approveContext = createReviewActionContext({ recordOverrides: { reviewFlag } });
  const approveResult = await approveVerification(approveContext.context as never, approveContext.record.id);
  assert.equal(approveResult.applied, true);
  assert.equal(approveContext.getParsedRecord()?.reviewFlag, null);

  const denyContext = createReviewActionContext({ recordOverrides: { reviewFlag } });
  const denyResult = await denyVerification(denyContext.context as never, denyContext.record.id, 'reason_1');
  assert.equal(denyResult.applied, true);
  assert.equal(denyContext.getParsedRecord()?.reviewFlag, null);
});

test('getViewerFlairSnapshot resolves flair through the username lookup after confirming the viewer identity', async () => {
  const snapshotContext = createViewerFlairSnapshotContext({
    currentUserResponses: [
      {
        username: 'Ornery_Locksmith_176',
        id: 't2_viewer',
        flair: {
          flairText: 'Ignored current-user flair',
          flairCssClass: 'ignored',
          flairTemplateId: 'zzz999',
        },
      },
    ],
    usernameUserResponses: [
      {
        username: 'Ornery_Locksmith_176',
        id: 't2_viewer',
        flair: {
          flairText: 'Verified',
          flairCssClass: 'verified',
          flairTemplateId: 'abc123',
        },
      },
    ],
  });

  const snapshot = await getViewerFlairSnapshot(
    snapshotContext.context as never,
    'Bulges'
  );

  assert.deepEqual(snapshot, {
    flairText: 'Verified',
    flairCssClass: 'verified',
    flairTemplateId: 'abc123',
    userId: 't2_viewer',
    lookupState: 'confirmed_present',
    error: null,
  });
  assert.equal(snapshotContext.currentUserCallCount, 1);
  assert.equal(snapshotContext.usernameLookupCallCount, 1);
  assert.deepEqual(snapshotContext.usernameLookupCalls, ['ornery_locksmith_176']);
  assert.equal(snapshotContext.flairLookupCallCount, 1);
});

test('getViewerFlairSnapshot retries transient transport errors without logging them', async () => {
  const snapshotContext = createViewerFlairSnapshotContext({
    currentUserResponses: [
      new Error('2 UNKNOWN: HTTP request failed with error: unexpected EOF'),
      {
        username: 'Ornery_Locksmith_176',
        id: 't2_viewer',
      },
    ],
    usernameUserResponses: [
      {
        username: 'Ornery_Locksmith_176',
        id: 't2_viewer',
        flair: {
          flairText: 'Verified',
          flairCssClass: 'verified',
          flairTemplateId: 'abc123',
        },
      },
    ],
  });
  const originalConsoleLog = console.log;
  let consoleLogCallCount = 0;
  console.log = () => {
    consoleLogCallCount += 1;
  };

  try {
    const snapshot = await getViewerFlairSnapshot(
      snapshotContext.context as never,
      'Bulges'
    );

    assert.deepEqual(snapshot, {
      flairText: 'Verified',
      flairCssClass: 'verified',
      flairTemplateId: 'abc123',
      userId: 't2_viewer',
      lookupState: 'confirmed_present',
      error: null,
    });
    assert.equal(snapshotContext.currentUserCallCount, 2);
    assert.equal(snapshotContext.usernameLookupCallCount, 1);
    assert.equal(consoleLogCallCount, 0);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('getViewerFlairSnapshot returns unavailable when the current viewer flair lookup is forbidden', async () => {
  const snapshotContext = createViewerFlairSnapshotContext({
    currentUserResponses: [
      {
        username: 'HLmikemcd',
        id: 't2_viewer',
      },
    ],
    usernameUserResponses: [
      {
        username: 'HLmikemcd',
        id: 't2_viewer',
        flair: new Error(
          '2 UNKNOWN: HTTP request to URL: https://oauth.reddit.com/r/penis/api/flairlist.json?name=HLmikemcd&raw_json=1 failed with error: Get "https://oauth.reddit.com/r/penis/api/flairlist.json?name=HLmikemcd&raw_json=1": httpbp.ClientError: http status 403 Forbidden'
        ),
      },
    ],
  });
  const originalConsoleLog = console.log;
  let consoleLogCallCount = 0;
  console.log = () => {
    consoleLogCallCount += 1;
  };

  try {
    const snapshot = await getViewerFlairSnapshot(snapshotContext.context as never, 'penis');

    assert.deepEqual(snapshot, {
      flairText: '',
      flairCssClass: '',
      flairTemplateId: '',
      userId: 't2_viewer',
      lookupState: 'unavailable',
      error:
        '2 UNKNOWN: HTTP request to URL: https://oauth.reddit.com/r/penis/api/flairlist.json?name=HLmikemcd&raw_json=1 failed with error: Get "https://oauth.reddit.com/r/penis/api/flairlist.json?name=HLmikemcd&raw_json=1": httpbp.ClientError: http status 403 Forbidden',
    });
    assert.equal(snapshotContext.currentUserCallCount, 1);
    assert.equal(snapshotContext.usernameLookupCallCount, 1);
    assert.equal(snapshotContext.flairLookupCallCount, 1);
    assert.equal(consoleLogCallCount, 0);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('checkVerificationFlair matches additional approval flair text when template id is absent', async () => {
  const result = await checkVerificationFlair(
    {} as never,
    'example',
    {
      ...buildRuntimeConfig(),
      flairTemplateId: 'abc-123',
      multipleApprovalFlairsEnabled: true,
      additionalApprovalFlairs: [
        { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
      ],
    },
    {
      flairText: 'Trusted Verified',
      flairCssClass: '',
      flairTemplateId: '',
      userId: 't2_example',
      lookupState: 'confirmed_present',
      error: null,
    }
  );

  assert.deepEqual(result, {
    verified: true,
    configuredTemplateId: 'abc-123',
    detectedTemplateId: 'def-456',
    source: 'viewer-snapshot:additional-text-match',
    error: null,
  });
});

test('checkVerificationFlair preserves unavailable viewer snapshot lookups', async () => {
  const result = await checkVerificationFlair(
    {} as never,
    'example',
    buildRuntimeConfig(),
    {
      flairText: '',
      flairCssClass: '',
      flairTemplateId: '',
      userId: 't2_example',
      lookupState: 'unavailable',
      error: '403 Forbidden',
    }
  );

  assert.deepEqual(result, {
    verified: false,
    configuredTemplateId: 'abc123',
    detectedTemplateId: '',
    source: 'viewer-snapshot:unavailable',
    error: '403 Forbidden',
  });
});

test('searchHistoryRecords treats short username prefixes as unfiltered baseline queries', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    const result = await searchHistoryRecords(reviewContext.context as never, reviewContext.subredditId, {
      username: 'ex',
      offset: 0,
      limit: 25,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, reviewContext.record.id);
    assert.equal(result.items[0]?.username, reviewContext.record.username);
  });
});

test('searchApprovedRecords treats short username prefixes as unfiltered baseline queries', async () => {
  const reviewContext = createReviewActionContext({
    recordOverrides: {
      status: 'approved',
      reviewedAt: '2026-03-12T12:00:00.000Z',
      moderator: 'Mod_One',
    },
  });

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    seedApprovedIndexMembers(reviewContext, [
      {
        id: reviewContext.record.id,
        score: new Date(String(reviewContext.record.reviewedAt || reviewContext.record.submittedAt)).getTime(),
      },
    ]);

    const result = await searchApprovedRecords(reviewContext.context as never, reviewContext.subredditId, {
      username: 'ex',
      offset: 0,
      limit: 25,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, reviewContext.record.id);
    assert.equal(result.items[0]?.username, reviewContext.record.username);
  });
});

test('searchApprovedRecords returns approved photo URLs in unfiltered and prefix searches', async () => {
  const reviewContext = createReviewActionContext();
  seedApprovedRecords(reviewContext, [
    {
      id: 'approved_with_photos',
      username: 'Example_User',
      approvedAt: '2026-03-25T12:00:00.000Z',
      photoOneUrl: 'https://i.redd.it/approved-one.png',
      photoTwoUrl: 'https://i.redd.it/approved-two.png',
      photoThreeUrl: 'https://i.redd.it/approved-three.png',
    },
  ]);

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    const unfiltered = await searchApprovedRecords(reviewContext.context as never, reviewContext.subredditId, {
      offset: 0,
      limit: 25,
    });
    const prefixed = await searchApprovedRecords(reviewContext.context as never, reviewContext.subredditId, {
      username: 'exa',
      offset: 0,
      limit: 25,
    });

    for (const result of [unfiltered, prefixed]) {
      const item = result.items.find((candidate) => candidate.id === 'approved_with_photos');
      assert.equal(item?.photoOneUrl, 'https://i.redd.it/approved-one.png');
      assert.equal(item?.photoTwoUrl, 'https://i.redd.it/approved-two.png');
      assert.equal(item?.photoThreeUrl, 'https://i.redd.it/approved-three.png');
    }
  });
});

test('searchApprovedRecords omits photo URL fields for old scrubbed approved records', async () => {
  const reviewContext = createReviewActionContext();
  seedApprovedRecords(reviewContext, [
    {
      id: 'approved_scrubbed',
      approvedAt: '2026-03-25T12:00:00.000Z',
      photoOneUrl: '',
      photoTwoUrl: '',
      photoThreeUrl: '',
    },
  ]);

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    const result = await searchApprovedRecords(reviewContext.context as never, reviewContext.subredditId, {
      offset: 0,
      limit: 25,
    });
    const item = result.items.find((candidate) => candidate.id === 'approved_scrubbed');

    assert.ok(item);
    assert.equal(item.photoOneUrl, undefined);
    assert.equal(item.photoTwoUrl, undefined);
    assert.equal(item.photoThreeUrl, undefined);
  });
});

test('searchHistoryRecords returns photo URLs only for approved records', async () => {
  const approvedContext = createReviewActionContext({
    recordOverrides: {
      status: 'approved',
      reviewedAt: '2026-03-25T12:00:00.000Z',
      moderator: 'Mod_One',
      photoOneUrl: 'https://i.redd.it/history-approved-one.png',
      photoTwoUrl: 'https://i.redd.it/history-approved-two.png',
      photoThreeUrl: 'https://i.redd.it/history-approved-three.png',
    },
  });
  const deniedContext = createReviewActionContext({
    recordOverrides: {
      status: 'denied',
      reviewedAt: '2026-03-25T12:00:00.000Z',
      moderator: 'Mod_One',
      denyReason: 'reason_1',
      photoOneUrl: 'https://i.redd.it/history-denied-one.png',
    },
  });

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    const approved = await searchHistoryRecords(approvedContext.context as never, approvedContext.subredditId, {
      offset: 0,
      limit: 25,
    });
    const denied = await searchHistoryRecords(deniedContext.context as never, deniedContext.subredditId, {
      offset: 0,
      limit: 25,
    });

    assert.equal(approved.items[0]?.photoOneUrl, 'https://i.redd.it/history-approved-one.png');
    assert.equal(approved.items[0]?.photoTwoUrl, 'https://i.redd.it/history-approved-two.png');
    assert.equal(approved.items[0]?.photoThreeUrl, 'https://i.redd.it/history-approved-three.png');
    assert.equal(denied.items[0]?.photoOneUrl, undefined);
  });
});

test('searchAuditEntries treats short username and actor prefixes as unfiltered baseline queries', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    seedAuditEntries(reviewContext, [
      {
        id: 'audit_short_prefix',
        action: 'approved',
        actor: 'Mod_One',
        at: '2026-03-25T12:00:00.000Z',
      },
    ]);

    const result = await searchAuditEntries(reviewContext.context as never, reviewContext.subredditId, {
      username: 'ex',
      actor: 'mo',
      offset: 0,
      limit: 25,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.id, 'audit_short_prefix');
  });
});

test('searchAuditEntries attaches photo URLs to approved audit entries by verification id', async () => {
  const reviewContext = createReviewActionContext();
  const verificationId = 'removed_after_approval';
  const record = buildRecord({
    id: verificationId,
    subredditId: reviewContext.subredditId,
    subredditName: reviewContext.record.subredditName,
    status: 'removed',
    moderator: 'Mod_One',
    reviewedAt: '2026-03-25T12:00:00.000Z',
    removedAt: '2026-03-26T12:00:00.000Z',
    photoOneUrl: 'https://i.redd.it/audit-one.png',
    photoTwoUrl: 'https://i.redd.it/audit-two.png',
    photoThreeUrl: 'https://i.redd.it/audit-three.png',
  });
  reviewContext.redisStore.set(
    verificationRecordTestKey(reviewContext.subredditId, verificationId),
    JSON.stringify(record)
  );
  seedAuditEntries(reviewContext, [
    {
      id: 'audit_approved_with_photos',
      action: 'approved',
      actor: 'Mod_One',
      at: '2026-03-25T12:00:00.000Z',
      verificationId,
    },
    {
      id: 'audit_denied_with_same_record',
      action: 'denied',
      actor: 'Mod_One',
      at: '2026-03-24T12:00:00.000Z',
      verificationId,
    },
  ]);

  await withFixedNow('2026-03-28T12:00:00.000Z', async () => {
    const approved = await searchAuditEntries(reviewContext.context as never, reviewContext.subredditId, {
      action: 'approved',
      offset: 0,
      limit: 25,
    });
    const denied = await searchAuditEntries(reviewContext.context as never, reviewContext.subredditId, {
      action: 'denied',
      offset: 0,
      limit: 25,
    });

    assert.equal(approved.items[0]?.photoOneUrl, 'https://i.redd.it/audit-one.png');
    assert.equal(approved.items[0]?.photoTwoUrl, 'https://i.redd.it/audit-two.png');
    assert.equal(approved.items[0]?.photoThreeUrl, 'https://i.redd.it/audit-three.png');
    assert.equal(denied.items[0]?.photoOneUrl, undefined);
  });
});

test('withdrawCurrentUserPendingVerification writes a dated mod note and removes pending data', async () => {
  const withdrawIso = '2026-04-01T15:30:00.000Z';
  const reviewContext = createReviewActionContext({ moderatorName: 'example_user' });

  await withFixedNow(withdrawIso, async () => {
    await withdrawCurrentUserPendingVerification(reviewContext.context as never);
  });

  assert.equal(reviewContext.addModNoteCalls.length, 1);
  assert.deepEqual(reviewContext.addModNoteCalls[0], {
    subreddit: 'examplesub',
    user: 'example_user',
    note: `User withdrew pending verification request on: ${new Date(withdrawIso).toLocaleString()}`,
  });
  assert.equal(reviewContext.redisStore.get(verificationRecordTestKey(reviewContext.subredditId, reviewContext.record.id)), undefined);
  assert.equal(
    reviewContext.redisStore.get(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username)),
    undefined
  );
  assert.equal(
    reviewContext.redisStore.get(userLatestTestKey(reviewContext.subredditId, reviewContext.record.username)),
    undefined
  );
  assert.equal(
    ensureTestZSet(reviewContext.zsetStore, pendingIndexTestKey(reviewContext.subredditId)).has(reviewContext.record.id),
    false
  );
  assert.equal(
    ensureTestZSet(reviewContext.zsetStore, historyDateIndexTestKey(reviewContext.subredditId)).has(reviewContext.record.id),
    false
  );
});

test('withdrawCurrentUserPendingVerification still removes pending data when mod note write fails', async () => {
  const reviewContext = createReviewActionContext({
    moderatorName: 'example_user',
    addModNoteResponses: [new Error('mod notes unavailable')],
  });

  await withdrawCurrentUserPendingVerification(reviewContext.context as never);

  assert.equal(reviewContext.addModNoteCalls.length, 1);
  assert.equal(reviewContext.redisStore.get(verificationRecordTestKey(reviewContext.subredditId, reviewContext.record.id)), undefined);
  assert.equal(
    reviewContext.redisStore.get(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username)),
    undefined
  );
});

test('withdrawCurrentUserPendingVerification does not write a mod note without a pending request', async () => {
  const reviewContext = createReviewActionContext({ moderatorName: 'example_user' });
  reviewContext.redisStore.delete(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username));

  await assert.rejects(
    withdrawCurrentUserPendingVerification(reviewContext.context as never),
    /No pending verification request found/
  );

  assert.equal(reviewContext.addModNoteCalls.length, 0);
});

test('shouldViewerDisplayVerifiedState lets manual CSS flair matches override denied and removed, but not pending', () => {
  const manualFlairCheck = {
    verified: true,
    source: 'viewer-css-substring-match',
  };

  assert.equal(
    shouldViewerDisplayVerifiedState(manualFlairCheck, { status: 'denied' } as never, false),
    true
  );
  assert.equal(
    shouldViewerDisplayVerifiedState(manualFlairCheck, { status: 'removed' } as never, false),
    true
  );
  assert.equal(
    shouldViewerDisplayVerifiedState(manualFlairCheck, { status: 'pending' } as never, false),
    false
  );
  assert.equal(
    shouldViewerDisplayVerifiedState(
      { verified: true, source: 'viewer-snapshot:template-match' },
      { status: 'denied' } as never,
      false
    ),
    false
  );
});

test('shouldViewerDisplayVerifiedState keeps approved users verified when flair lookup is unavailable', () => {
  assert.equal(
    shouldViewerDisplayVerifiedState(
      { verified: false, source: 'viewer-snapshot:unavailable' },
      { status: 'approved' } as never,
      false
    ),
    true
  );
});

// 'abc-123' satisfies isLikelyFlairTemplateId: lowercase alphanumeric + hyphen, has digit, has hyphen.
const RECONCILE_TEST_TEMPLATE_ID = 'abc-123';

function buildFlairReconcileFixture({
  lastAppliedFlairTemplateId = null as string | null,
  flairTemplateId = RECONCILE_TEST_TEMPLATE_ID,
  detectedTemplateId = '',
  flairText = '',
  flairCssClass = '',
  lookupState = 'confirmed' as 'confirmed' | 'confirmed_absent' | 'unavailable',
  source = 'viewer-snapshot:no-match',
} = {}) {
  const record = buildRecord({
    status: 'approved',
    lastAppliedFlairTemplateId,
  });
  const config = { ...buildRuntimeConfig(), flairTemplateId, flairCssClass: '' };
  const flairCheck = {
    verified: false,
    configuredTemplateId: flairTemplateId,
    detectedTemplateId,
    source,
    error: null,
  };
  const viewerFlairSnapshot = {
    userId: 't2_abc',
    lookupState,
    flairTemplateId: detectedTemplateId,
    flairText,
    flairCssClass,
    error: null,
  };
  return { record, config, flairCheck, viewerFlairSnapshot };
}

test('shouldReconcileApprovedViewerFlair repairs legacy record (null lastAppliedFlairTemplateId) when flair is completely absent', () => {
  const { record, config, flairCheck, viewerFlairSnapshot } = buildFlairReconcileFixture({
    lastAppliedFlairTemplateId: null,
    detectedTemplateId: '',
    flairText: '',
    flairCssClass: '',
  });
  assert.equal(shouldReconcileApprovedViewerFlair(record as never, config, flairCheck, viewerFlairSnapshot as never), true);
});

test('shouldReconcileApprovedViewerFlair skips legacy record when some flair is present (cannot distinguish intentional from accidental)', () => {
  const withTemplate = buildFlairReconcileFixture({ lastAppliedFlairTemplateId: null, detectedTemplateId: 'flair_other_xyz' });
  assert.equal(
    shouldReconcileApprovedViewerFlair(withTemplate.record as never, withTemplate.config, withTemplate.flairCheck, withTemplate.viewerFlairSnapshot as never),
    false,
  );

  const withText = buildFlairReconcileFixture({ lastAppliedFlairTemplateId: null, flairText: 'Verified' });
  assert.equal(
    shouldReconcileApprovedViewerFlair(withText.record as never, withText.config, withText.flairCheck, withText.viewerFlairSnapshot as never),
    false,
  );

  const withCss = buildFlairReconcileFixture({ lastAppliedFlairTemplateId: null, flairCssClass: 'verified' });
  assert.equal(
    shouldReconcileApprovedViewerFlair(withCss.record as never, withCss.config, withCss.flairCheck, withCss.viewerFlairSnapshot as never),
    false,
  );
});

test('shouldReconcileApprovedViewerFlair skips legacy record when flair snapshot is unavailable', () => {
  const { record, config, flairCheck, viewerFlairSnapshot } = buildFlairReconcileFixture({
    lastAppliedFlairTemplateId: null,
    detectedTemplateId: '',
    flairText: '',
    flairCssClass: '',
    lookupState: 'unavailable',
    source: 'viewer-snapshot:unavailable',
  });
  assert.equal(shouldReconcileApprovedViewerFlair(record as never, config, { ...flairCheck, source: 'viewer-snapshot:unavailable' }, { ...viewerFlairSnapshot, lookupState: 'unavailable' } as never), false);
});

test('shouldReconcileApprovedViewerFlair normal record with known lastAppliedFlairTemplateId still follows existing logic', () => {
  // Flair is correct — no repair needed.
  const correct = buildFlairReconcileFixture({
    lastAppliedFlairTemplateId: RECONCILE_TEST_TEMPLATE_ID,
    detectedTemplateId: RECONCILE_TEST_TEMPLATE_ID,
  });
  assert.equal(shouldReconcileApprovedViewerFlair(correct.record as never, correct.config, correct.flairCheck, correct.viewerFlairSnapshot as never), false);

  // Flair is completely absent — repair needed.
  const absent = buildFlairReconcileFixture({
    lastAppliedFlairTemplateId: RECONCILE_TEST_TEMPLATE_ID,
    detectedTemplateId: '',
    flairText: '',
    flairCssClass: '',
  });
  assert.equal(shouldReconcileApprovedViewerFlair(absent.record as never, absent.config, absent.flairCheck, absent.viewerFlairSnapshot as never), true);
});

test('isViewerAwaitingFlairPropagation is only true for recent approved records that have not confirmed flair yet', async () => {
  await withFixedNow('2026-03-28T12:00:00.000Z', async (nowMs) => {
    const recentApproved = {
      status: 'approved',
      reviewedAt: new Date(nowMs - 30_000).toISOString(),
      submittedAt: new Date(nowMs - 60_000).toISOString(),
    };
    const staleApproved = {
      status: 'approved',
      reviewedAt: new Date(nowMs - 5 * 60_000).toISOString(),
      submittedAt: new Date(nowMs - 6 * 60_000).toISOString(),
    };

    assert.equal(
      isViewerAwaitingFlairPropagation({ verified: false, source: 'viewer-snapshot:no-match' }, recentApproved as never, nowMs),
      true
    );
    assert.equal(
      isViewerAwaitingFlairPropagation({ verified: false, source: 'viewer-snapshot:no-match' }, staleApproved as never, nowMs),
      false
    );
    assert.equal(
      isViewerAwaitingFlairPropagation({ verified: true, source: 'viewer-snapshot:template-match' }, recentApproved as never, nowMs),
      false
    );
    assert.equal(
      isViewerAwaitingFlairPropagation(
        { verified: false, source: 'viewer-snapshot:no-match' },
        {
          status: 'pending',
          reviewedAt: new Date(nowMs - 30_000).toISOString(),
          submittedAt: new Date(nowMs - 60_000).toISOString(),
        } as never,
        nowMs
      ),
      false
    );
  });
});

test('sendUserModmailWithFallback rejects invalid recipients before calling modmail APIs', async () => {
  const modmailContext = createModmailContext();

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Approved',
    body: 'Body',
    username: 'https://www.reddit.com/message/compose',
  });

  assert.deepEqual(result, {
    status: 'failed',
    reason: 'Invalid modmail recipient username.',
  });
  assert.equal(modmailContext.replyCalls.length, 0);
  assert.equal(modmailContext.createConversationCalls.length, 0);
  assert.equal(modmailContext.archiveCalls.length, 0);
});

test('sendUserModmailWithFallback replies using a legacy cached thread alias', async () => {
  const legacyAliasKey = modmailThreadKey('t5_example', 'https://www.reddit.com/user/example_user/about/');
  const modmailContext = createModmailContext({
    initialRedis: {
      [legacyAliasKey]: '39to20',
    },
  });

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Approved',
    body: 'Body',
    username: 'Example_User',
  });

  assert.deepEqual(result, {
    status: 'replied',
    conversationId: '39to20',
  });
  assert.deepEqual(modmailContext.unarchiveCalls, ['39to20']);
  assert.deepEqual(modmailContext.replyCalls, [
    {
      conversationId: '39to20',
      body: 'Body',
      isAuthorHidden: true,
    },
  ]);
  assert.equal(modmailContext.createConversationCalls.length, 0);
  assert.deepEqual(modmailContext.archiveCalls, ['39to20']);
});

test('sendUserModmailWithFallback can leave a pending-status modmail conversation unarchived', async () => {
  const modmailContext = createModmailContext({
    createConversationResponses: [{ conversation: { id: '39to20' } }],
  });

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Pending',
    body: 'Body',
    username: 'Example_User',
    eventId: 'pending:verification_123',
    archiveAfterSend: false,
  });

  assert.deepEqual(result, {
    status: 'created',
    conversationId: '39to20',
  });
  assert.equal(modmailContext.createConversationCalls.length, 1);
  assert.equal(modmailContext.archiveCalls.length, 0);
});

test('sendUserModmailWithFallback clears stale thread keys and falls back to create when reply fails', async () => {
  const threadKeys = Array.from(
    new Set(usernameLookupFields('Example_User').map((field) => modmailThreadKey('t5_example', field)))
  );
  const modmailContext = createModmailContext({
    initialRedis: {
      [threadKeys[0]!]: '39to20',
    },
    replyError: new Error('proto: invalid value for int64 field value: ""'),
    createConversationResponses: [{ conversation: { id: '39t18m' } }],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await sendUserModmailWithFallback(modmailContext.context as never, {
      subredditId: 't5_example',
      subredditName: 'ExampleSub',
      subject: 'Approved',
      body: 'Body',
      username: 'Example_User',
    });

    assert.deepEqual(result, {
      status: 'created',
      conversationId: '39t18m',
    });
    assert.equal(modmailContext.replyCalls.length, 1);
    assert.equal(modmailContext.createConversationCalls.length, 1);
    assert.deepEqual(modmailContext.delCalls[0], threadKeys);
    for (const key of threadKeys) {
      assert.equal(modmailContext.redisStore.get(key), '39t18m');
    }
  } finally {
    console.log = originalConsoleLog;
  }
});

test('sendUserModmailWithFallback falls back to a new conversation for proto int64 reply failures', async () => {
  const threadKeys = Array.from(
    new Set(usernameLookupFields('Example_User').map((field) => modmailThreadKey('t5_example', field)))
  );
  const modmailContext = createModmailContext({
    initialRedis: {
      [threadKeys[0]!]: '3aja2d',
    },
    replyError: new Error(
      '2 UNKNOWN: proto: (line 1:192): invalid value for int64 field value: ""'
    ),
    createConversationResponses: [{ conversation: { id: '39t18m' } }],
  });

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Approved',
    body: 'Body',
    username: 'Example_User',
  });

  assert.deepEqual(result, {
    status: 'created',
    conversationId: '39t18m',
  });
  assert.equal(modmailContext.replyCalls.length, 1);
  assert.equal(modmailContext.createConversationCalls.length, 1);
  assert.deepEqual(modmailContext.delCalls[0], threadKeys);
});

test('sendUserModmailWithFallback preserves cached thread aliases when reply fails transiently', async () => {
  const threadKeys = Array.from(
    new Set(usernameLookupFields('Example_User').map((field) => modmailThreadKey('t5_example', field)))
  );
  const modmailContext = createModmailContext({
    initialRedis: {
      [threadKeys[0]!]: '39to20',
    },
    replyError: new Error('2 UNKNOWN: upstream request missing or timed out'),
  });

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Approved',
    body: 'Body',
    username: 'Example_User',
  });

  assert.deepEqual(result, {
    status: 'failed',
    reason: '2 UNKNOWN: upstream request missing or timed out',
  });
  assert.equal(modmailContext.replyCalls.length, 1);
  assert.equal(modmailContext.createConversationCalls.length, 0);
  assert.equal(modmailContext.delCalls.length, 0);
  assert.equal(modmailContext.redisStore.get(threadKeys[0]!), '39to20');
});

test('sendUserModmailWithFallback purges invalid cached conversation ids before creating a new thread', async () => {
  const invalidThreadKey = modmailThreadKey('t5_example', '/user/example_user/');
  const modmailContext = createModmailContext({
    initialRedis: {
      [invalidThreadKey]: '   ',
    },
    createConversationResponses: [{ conversation: { id: 'abcdef' } }],
  });

  const result = await sendUserModmailWithFallback(modmailContext.context as never, {
    subredditId: 't5_example',
    subredditName: 'ExampleSub',
    subject: 'Approved',
    body: 'Body',
    username: 'Example_User',
  });

  assert.deepEqual(result, {
    status: 'created',
    conversationId: 'abcdef',
  });
  assert.deepEqual(modmailContext.delCalls[0], [invalidThreadKey]);
  assert.equal(modmailContext.createConversationCalls.length, 1);
});

test('sendUserModmailWithFallback retries createConversation with u-prefixed recipient', async () => {
  const modmailContext = createModmailContext({
    createConversationResponses: [
      new Error("HTTP 400 Bad Request ... fields: ['to'] ... reason: 'USER_DOESNT_EXIST'"),
      { conversation: { id: '39to20' } },
    ],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await sendUserModmailWithFallback(modmailContext.context as never, {
      subredditId: 't5_example',
      subredditName: 'ExampleSub',
      subject: 'Approved',
      body: 'Body',
      username: 'Example_User',
    });

    assert.deepEqual(result, {
      status: 'created',
      conversationId: '39to20',
    });
    assert.deepEqual(
      modmailContext.createConversationCalls.map((call) => call.to),
      ['example_user', 'u/example_user']
    );
  } finally {
    console.log = originalConsoleLog;
  }
});

test('archivePendingVerificationModmailReply archives participant replies while the verification is pending', async () => {
  const reviewContext = createReviewActionContext({
    initialRedis: {
      [modmailThreadKey('t5_example', 'Example_User')]: '39to20',
    },
  });

  const result = await archivePendingVerificationModmailReply(reviewContext.context as never, {
    messageAuthor: { id: 't2_target', name: 'Example_User' },
    messageAuthorType: 'participant_user',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: '39to20',
    messageId: 'abc123',
  });

  assert.deepEqual(result, {
    archived: true,
    conversationId: '39to20',
    username: 'example_user',
    verificationId: reviewContext.record.id,
  });
  assert.deepEqual(reviewContext.archiveCalls, ['39to20']);
  assert.equal(
    reviewContext.redisStore.get(pendingModmailConversationTestKey('t5_example', '39to20')),
    reviewContext.record.id
  );
});

test('archivePendingVerificationModmailReply matches Devvit-prefixed trigger conversation IDs to cached threads', async () => {
  const reviewContext = createReviewActionContext({
    initialRedis: {
      [modmailThreadKey('t5_example', 'Example_User')]: '3a4i16',
    },
  });

  const result = await archivePendingVerificationModmailReply(reviewContext.context as never, {
    messageAuthor: { id: 't2_target', name: 'Example_User' },
    messageAuthorType: 'participant_user',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: 'ModmailConversation_3a4i16',
  });

  assert.deepEqual(result, {
    archived: true,
    conversationId: '3a4i16',
    username: 'example_user',
    verificationId: reviewContext.record.id,
  });
  assert.deepEqual(reviewContext.archiveCalls, ['3a4i16']);
});

test('archivePendingVerificationModmailReply skips all reply archives when the install setting is disabled', async () => {
  const reviewContext = createReviewActionContext({
    pendingModmailAutoArchiveEnabled: false,
    initialRedis: {
      [modmailThreadKey('t5_example', 'Example_User')]: '3a4i16',
    },
  });

  const result = await archivePendingVerificationModmailReply(reviewContext.context as never, {
    messageAuthor: { id: 't2_target', name: 'Example_User' },
    messageAuthorType: 'participant_user',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: 'ModmailConversation_3a4i16',
  });

  assert.deepEqual(result, {
    archived: false,
    reason: 'pending modmail auto-archive disabled',
  });
  assert.equal(reviewContext.archiveCalls.length, 0);
});

test('archivePendingVerificationModmailReply resolves sparse trigger payloads from the conversation', async () => {
  const reviewContext = createReviewActionContext({
    initialRedis: {
      [modmailThreadKey('t5_example', 'Example_User')]: '39to22',
    },
    getConversationResponses: [
      {
        conversation: {
          conversationType: 'sr_user',
          subreddit: { id: 'bare_subreddit_id', displayName: 'ExampleSub' },
          participant: { id: 't2_target', name: 'Example_User' },
          messages: {
            m_1: {
              id: 'm_1',
              date: '2026-03-11T12:01:00.000Z',
              author: { id: 't2_target', name: 'Example_User', isMod: false, isAdmin: false },
              participatingAs: 'participant_user',
            },
          },
        },
        user: { id: 't2_target', name: 'Example_User' },
      },
    ],
  });

  const result = await archivePendingVerificationModmailReply(reviewContext.context as never, {
    conversation_id: '39to22',
    message_id: 'm_1',
  });

  assert.equal(result.archived, true);
  assert.deepEqual(reviewContext.archiveCalls, ['39to22']);
});

test('archivePendingVerificationModmailReply falls back from stale withdrawn mappings to the current pending record', async () => {
  const reviewContext = createReviewActionContext({
    initialRedis: {
      [pendingModmailConversationTestKey('t5_example', '39to23')]: 'withdrawn_old_record',
      [modmailThreadKey('t5_example', 'Example_User')]: '39to23',
    },
  });

  const result = await archivePendingVerificationModmailReply(reviewContext.context as never, {
    messageAuthor: { id: 't2_target', name: 'Example_User' },
    messageAuthorType: 'participant_user',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: '39to23',
  });

  assert.deepEqual(result, {
    archived: true,
    conversationId: '39to23',
    username: 'example_user',
    verificationId: reviewContext.record.id,
  });
  assert.equal(
    reviewContext.redisStore.get(pendingModmailConversationTestKey('t5_example', '39to23')),
    reviewContext.record.id
  );
  assert.deepEqual(reviewContext.archiveCalls, ['39to23']);
});

test('archivePendingVerificationModmailReply ignores moderator messages and non-pending records', async () => {
  const approvedContext = createReviewActionContext({
    recordOverrides: { status: 'approved' },
    initialRedis: {
      [pendingModmailConversationTestKey('t5_example', '39to20')]: 'verification_123',
    },
  });

  const approvedResult = await archivePendingVerificationModmailReply(approvedContext.context as never, {
    messageAuthor: { id: 't2_target', name: 'Example_User' },
    messageAuthorType: 'participant_user',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: '39to20',
  });

  assert.equal(approvedResult.archived, false);
  assert.equal(approvedResult.reason, 'verification is no longer pending');
  assert.equal(approvedContext.archiveCalls.length, 0);
  assert.equal(approvedContext.redisStore.get(pendingModmailConversationTestKey('t5_example', '39to20')), undefined);

  const moderatorContext = createReviewActionContext({
    initialRedis: {
      [modmailThreadKey('t5_example', 'Example_User')]: '39to21',
    },
  });

  const moderatorResult = await archivePendingVerificationModmailReply(moderatorContext.context as never, {
    messageAuthor: { id: 't2_mod', name: 'Mod_One' },
    messageAuthorType: 'moderator',
    conversationType: 'sr_user',
    conversationSubreddit: { id: 't5_example', name: 'ExampleSub' },
    conversationId: '39to21',
  });

  assert.equal(moderatorResult.archived, false);
  assert.equal(moderatorResult.reason, 'not a participant user reply');
  assert.equal(moderatorContext.archiveCalls.length, 0);
});

test('getModeratorStats returns empty recent activity while preserving current verified totals', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async (nowMs) => {
    seedApprovedRecords(reviewContext, [
      { id: 'approved_1', approvedAt: new Date(nowMs - 2_000).toISOString(), username: 'approved_one' },
      { id: 'approved_2', approvedAt: new Date(nowMs - 1_000).toISOString(), username: 'approved_two' },
    ]);

    const stats = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');

    assert.deepEqual(stats, {
      range: 'weekly',
      generatedAt: '2026-03-26T12:00:00.000Z',
      summary: {
        currentlyVerified: 2,
        approvals: 0,
        denials: 0,
        reopens: 0,
        activeModerators: 0,
      },
      leaders: {
        topApprover: null,
        topDenier: null,
      },
      moderators: [],
    });
  });
});

test('getModeratorStats aggregates weekly and monthly moderator activity from the audit log', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async (nowMs) => {
    seedApprovedRecords(reviewContext, [
      { id: 'approved_1', approvedAt: new Date(nowMs - 1_000).toISOString(), username: 'approved_one' },
      { id: 'approved_2', approvedAt: new Date(nowMs - 2_000).toISOString(), username: 'approved_two' },
      { id: 'approved_3', approvedAt: new Date(nowMs - 3_000).toISOString(), username: 'approved_three' },
    ]);
    seedAuditEntries(reviewContext, [
      { id: 'audit_approved_1', action: 'approved', actor: 'Mod_One', at: '2026-03-25T12:00:00.000Z' },
      { id: 'audit_approved_2', action: 'approved', actor: 'Mod_One', at: '2026-03-24T12:00:00.000Z' },
      { id: 'audit_denied_1', action: 'denied', actor: 'Mod_Two', at: '2026-03-23T12:00:00.000Z' },
      { id: 'audit_reopened_1', action: 'reopened', actor: 'Mod_Two', at: '2026-03-22T12:00:00.000Z' },
      { id: 'audit_denied_2', action: 'denied', actor: 'Mod_Two', at: '2026-03-18T12:00:00.000Z' },
      { id: 'audit_approved_3', action: 'approved', actor: 'Mod_Three', at: '2026-03-05T12:00:00.000Z' },
    ]);

    const weekly = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.deepEqual(weekly.summary, {
      currentlyVerified: 3,
      approvals: 2,
      denials: 1,
      reopens: 1,
      activeModerators: 2,
    });
    assert.deepEqual(weekly.leaders, {
      topApprover: { moderator: 'mod_one', count: 2 },
      topDenier: { moderator: 'mod_two', count: 1 },
    });
    assert.deepEqual(weekly.moderators, [
      { moderator: 'mod_one', approvals: 2, denials: 0, reopens: 0, totalActions: 2 },
      { moderator: 'mod_two', approvals: 0, denials: 1, reopens: 1, totalActions: 2 },
    ]);

    const monthly = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'monthly');
    assert.deepEqual(monthly.summary, {
      currentlyVerified: 3,
      approvals: 3,
      denials: 2,
      reopens: 1,
      activeModerators: 3,
    });
    assert.deepEqual(monthly.leaders, {
      topApprover: { moderator: 'mod_one', count: 2 },
      topDenier: { moderator: 'mod_two', count: 2 },
    });
    assert.deepEqual(monthly.moderators, [
      { moderator: 'mod_two', approvals: 0, denials: 2, reopens: 1, totalActions: 3 },
      { moderator: 'mod_one', approvals: 2, denials: 0, reopens: 0, totalActions: 2 },
      { moderator: 'mod_three', approvals: 1, denials: 0, reopens: 0, totalActions: 1 },
    ]);
  });
});

test('getModeratorStats breaks ties by moderator name for leader cards and ranked rows', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async () => {
    seedAuditEntries(reviewContext, [
      { id: 'audit_mod_b', action: 'approved', actor: 'Mod_B', at: '2026-03-25T10:00:00.000Z' },
      { id: 'audit_mod_a', action: 'approved', actor: 'Mod_A', at: '2026-03-25T11:00:00.000Z' },
    ]);

    const stats = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');

    assert.deepEqual(stats.leaders.topApprover, { moderator: 'mod_a', count: 1 });
    assert.deepEqual(stats.moderators, [
      { moderator: 'mod_a', approvals: 1, denials: 0, reopens: 0, totalActions: 1 },
      { moderator: 'mod_b', approvals: 1, denials: 0, reopens: 0, totalActions: 1 },
    ]);
  });
});

test('getModeratorStats ignores and cleans stale audit entries', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async (nowMs) => {
    seedAuditEntries(reviewContext, [
      { id: 'audit_valid', action: 'approved', actor: 'Mod_One', at: '2026-03-25T12:00:00.000Z' },
    ]);
    ensureTestZSet(reviewContext.zsetStore, auditDateIndexTestKey(reviewContext.subredditId)).set('audit_missing', nowMs - 500);
    reviewContext.redisStore.set(auditEntryTestKey(reviewContext.subredditId, 'audit_invalid'), 'not json');
    ensureTestZSet(reviewContext.zsetStore, auditDateIndexTestKey(reviewContext.subredditId)).set('audit_invalid', nowMs - 250);

    const stats = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');

    assert.equal(stats.summary.approvals, 1);
    assert.equal(
      ensureTestZSet(reviewContext.zsetStore, auditDateIndexTestKey(reviewContext.subredditId)).has('audit_missing'),
      false
    );
    assert.equal(
      ensureTestZSet(reviewContext.zsetStore, auditDateIndexTestKey(reviewContext.subredditId)).has('audit_invalid'),
      false
    );
  });
});

test('getModeratorStats current verified total follows approval and moderator revocation', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async () => {
    const beforeApproval = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.equal(beforeApproval.summary.currentlyVerified, 0);

    await approveVerification(reviewContext.context as never, reviewContext.record.id);
    const afterApproval = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.equal(afterApproval.summary.currentlyVerified, 1);

    await removeApprovedVerificationByModerator(
      reviewContext.context as never,
      reviewContext.record.id,
      'Verification revoked for testing.'
    );
    const afterRemoval = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.equal(afterRemoval.summary.currentlyVerified, 0);
  });
});

test('getModeratorStats reflects cleanup-style approved index removals after approval', async () => {
  const reviewContext = createReviewActionContext();

  await withFixedNow('2026-03-26T12:00:00.000Z', async () => {
    await approveVerification(reviewContext.context as never, reviewContext.record.id);
    const afterApproval = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.equal(afterApproval.summary.currentlyVerified, 1);

    await reviewContext.context.redis.zRem(approvedIndexTestKey(reviewContext.subredditId), [reviewContext.record.id]);
    const afterCleanup = await getModeratorStats(reviewContext.context as never, reviewContext.subredditId, 'weekly');
    assert.equal(afterCleanup.summary.currentlyVerified, 1);
    assert.equal(
      ensureTestZSet(reviewContext.zsetStore, approvedIndexTestKey(reviewContext.subredditId)).has(reviewContext.record.id),
      true
    );
  });
});

test('removeApprovedVerificationByModerator adds a moderator removal mod note', async () => {
  const reviewContext = createReviewActionContext();

  await approveVerification(reviewContext.context as never, reviewContext.record.id);
  const result = await removeApprovedVerificationByModerator(
    reviewContext.context as never,
    reviewContext.record.id,
    'Verification revoked for testing.'
  );
  const storedRecord = reviewContext.getParsedRecord();
  const latestModNote = reviewContext.addModNoteCalls.at(-1) as
    | { subreddit?: string; user?: string; note?: string }
    | undefined;

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.equal(result.modNote.status, 'success');
  assert.equal(storedRecord?.status, 'removed');
  assert.equal(storedRecord?.photoOneUrl, reviewContext.record.photoOneUrl);
  assert.equal(reviewContext.addModNoteCalls.length, 2);
  assert.deepEqual(latestModNote, {
    subreddit: 'examplesub',
    user: 'example_user',
    note: 'Verification removed by mod: Mod_One. Reason: Verification revoked for testing.',
  });
});

test('approveVerification keeps valid approvals working', async () => {
  const reviewContext = createReviewActionContext({
    recordOverrides: {
      photoOneUrl: 'https://i.redd.it/approval-one.png',
      photoTwoUrl: 'https://i.redd.it/approval-two.png',
      photoThreeUrl: 'https://i.redd.it/approval-three.png',
    },
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.deepEqual(
    {
      flair: result.flair.status,
      modmail: result.modmail.status,
      modNote: result.modNote.status,
    },
    {
      flair: 'success',
      modmail: 'created',
      modNote: 'success',
    }
  );
  assert.equal(storedRecord?.status, 'approved');
  assert.equal(storedRecord?.moderator, 'Mod_One');
  assert.equal(storedRecord?.photoOneUrl, 'https://i.redd.it/approval-one.png');
  assert.equal(storedRecord?.photoTwoUrl, 'https://i.redd.it/approval-two.png');
  assert.equal(storedRecord?.photoThreeUrl, 'https://i.redd.it/approval-three.png');
  assert.equal(reviewContext.setUserFlairCalls.length, 1);
  assert.equal(reviewContext.createConversationCalls.length, 1);
  assert.equal(reviewContext.addModNoteCalls.length, 1);
  assert.equal(reviewContext.redisStore.get(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username)), undefined);
  assert.equal(
    reviewContext.redisStore.get(userLatestTestKey(reviewContext.subredditId, reviewContext.record.username)),
    reviewContext.record.id
  );
});

test('approveVerification applies the selected additional approval flair when multi-flair is enabled', async () => {
  const reviewContext = createReviewActionContext({
    multipleApprovalFlairsEnabled: true,
    initialHashes: {
      [subredditConfigTestKey('t5_example')]: {
        additional_approval_flairs_json: JSON.stringify([
          { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
          { templateId: 'ghi-789', label: 'VIP', text: 'VIP Verified' },
        ]),
      },
    },
  });

  const result = await approveVerification(
    reviewContext.context as never,
    reviewContext.record.id,
    false,
    'ghi-789'
  );
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.equal(reviewContext.setUserFlairCalls.length, 1);
  assert.equal(reviewContext.setUserFlairCalls[0]?.flairTemplateId, 'ghi-789');
  assert.equal(storedRecord?.status, 'approved');
  assert.equal(storedRecord?.lastAppliedFlairTemplateId, 'ghi-789');
});

test('approveVerification requires confirmation before approving a currently banned user', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [[{ username: 'example_user' }]],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);

  assert.equal(result.outcome, 'banned_confirmation_required');
  assert.equal(result.applied, false);
  assert.equal(result.username, reviewContext.record.username);
  assert.equal(reviewContext.getParsedRecord()?.status, 'pending');
  assert.equal(reviewContext.unbanUserCalls.length, 0);
  assert.equal(reviewContext.setUserFlairCalls.length, 0);
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
});

test('approveVerification unbans a banned user after confirmation and then approves normally', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [[{ username: 'example_user' }]],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id, true);

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.deepEqual(reviewContext.unbanUserCalls, [
    { username: 'example_user', subredditName: 'examplesub' },
  ]);
  assert.equal(reviewContext.getParsedRecord()?.status, 'approved');
  assert.equal(reviewContext.setUserFlairCalls.length, 1);
  assert.equal(reviewContext.createConversationCalls.length, 1);
  assert.equal(reviewContext.addModNoteCalls.length, 1);
});

test('approveVerification proceeds without unbanning when the user is no longer banned at confirmation time', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [[{ username: 'example_user' }], []],
  });

  const firstResult = await approveVerification(reviewContext.context as never, reviewContext.record.id);
  const secondResult = await approveVerification(reviewContext.context as never, reviewContext.record.id, true);

  assert.equal(firstResult.outcome, 'banned_confirmation_required');
  assert.equal(secondResult.outcome, 'completed');
  assert.equal(secondResult.applied, true);
  assert.equal(reviewContext.unbanUserCalls.length, 0);
  assert.equal(reviewContext.getParsedRecord()?.status, 'approved');
});

test('approveVerification removes pending records immediately when the account is deleted or suspended', async () => {
  const reviewContext = createReviewActionContext({
    validationResponses: [new Error('that user does not exist')],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'invalid_account_removed');
  assert.equal(result.applied, false);
  assert.equal(storedRecord?.status, 'removed');
  assert.equal(storedRecord?.removedBy, 'Mod_One');
  assert.equal(storedRecord?.moderator, 'Mod_One');
  assert.equal(reviewContext.setUserFlairCalls.length, 0);
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
  assert.equal(reviewContext.redisStore.get(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username)), undefined);
  assert.equal(
    reviewContext.redisStore.get(userLatestTestKey(reviewContext.subredditId, reviewContext.record.username)),
    reviewContext.record.id
  );
  assert.equal(reviewContext.zsetStore.get(pendingIndexTestKey(reviewContext.subredditId))?.size ?? 0, 0);
});

test('denyVerification removes invalid accounts without incrementing denials or blocks', async () => {
  const reviewContext = createReviewActionContext({
    validationResponses: [new Error("that user doesn't exist")],
  });

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'invalid_account_removed');
  assert.equal(result.applied, false);
  assert.equal(storedRecord?.status, 'removed');
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.size ?? 0, 0);
  assert.equal(reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.size ?? 0, 0);
});

test('blockUserForModerator stores the moderator and manual reason with the block', async () => {
  const reviewContext = createReviewActionContext();

  const result = await blockUserForModerator(
    reviewContext.context as never,
    reviewContext.subredditId,
    reviewContext.record.subredditName,
    'Manual_Target',
    'Mod_One',
    'Missing age proof'
  );
  const blockedEntryRaw = reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.get('manual_target');
  const blockedEntry = blockedEntryRaw ? JSON.parse(blockedEntryRaw) : null;

  assert.equal(result.alreadyBlocked, false);
  assert.equal(result.entry.username, 'manual_target');
  assert.equal(result.entry.blockedBy, 'mod_one');
  assert.equal(result.entry.reason, 'Missing age proof');
  assert.equal(blockedEntry?.blockedBy, 'mod_one');
  assert.equal(blockedEntry?.reason, 'Missing age proof');
  assert.equal(reviewContext.getUserByUsernameCalls[0], 'manual_target');
});

test('denyVerification keeps valid denials working and exposes the denied username', async () => {
  const reviewContext = createReviewActionContext();

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.equal(result.username, reviewContext.record.username);
  assert.equal(storedRecord?.status, 'denied');
  assert.equal(reviewContext.addModNoteCalls.length, 1);
  assert.equal(reviewContext.createConversationCalls.length, 1);
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '1');
});

test('denyVerification can manually block during denial without re-validating the user', async () => {
  const reviewContext = createReviewActionContext();

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied', {
    blockUser: true,
  });
  const blockedEntryRaw = reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.get('example_user');
  const blockedEntry = blockedEntryRaw ? JSON.parse(blockedEntryRaw) : null;

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.equal(result.manualBlockOutcome?.status, 'blocked');
  assert.equal(result.manualBlockOutcome?.username, reviewContext.record.username);
  assert.equal(blockedEntry?.username, reviewContext.record.username);
  assert.equal(blockedEntry?.blockedBy, 'mod_one');
  assert.equal(blockedEntry?.reason, 'Blocked during denial: Altered or edited image');
  assert.equal(reviewContext.getUserByUsernameCalls.length, 1);
  assert.equal(reviewContext.getUserByUsernameCalls[0], reviewContext.record.username);
});

test('denyVerification auto-blocks once the configured denial threshold is reached', async () => {
  const reviewContext = createReviewActionContext({
    maxDenialsBeforeBlock: 2,
    initialHashes: {
      [denialCountTestKey('t5_example')]: {
        example_user: '1',
      },
    },
  });

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');
  const blockedEntryRaw = reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.get('example_user');
  const blockedEntry = blockedEntryRaw ? JSON.parse(blockedEntryRaw) : null;

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, true);
  assert.equal(result.denialCount, 2);
  assert.equal(result.userBlocked, true);
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '2');
  assert.equal(blockedEntry?.username, reviewContext.record.username);
  assert.equal(blockedEntry?.deniedCount, 2);
  assert.equal(blockedEntry?.blockedBy, 'mod_one');
  assert.equal(blockedEntry?.reason, 'Reached 2 denials');
});

test('denyVerification still auto-blocks when denial modmail archive is skipped', async () => {
  const reviewContext = createReviewActionContext({
    maxDenialsBeforeBlock: 2,
    initialHashes: {
      [denialCountTestKey('t5_example')]: {
        example_user: '1',
      },
    },
    archiveConversationResponses: [
      new Error(
        'http status 400 Bad Request: {"explanation":"Cannot archive/unarchive internal conversations.","message":"Bad Request","reason":"UNKNOWN_ERROR"}'
      ),
    ],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');

    assert.equal(result.outcome, 'completed');
    assert.equal(result.applied, true);
    assert.equal(result.denialCount, 2);
    assert.equal(result.userBlocked, true);
    assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '2');
    assert.ok(reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.has('example_user'));
  } finally {
    console.log = originalConsoleLog;
  }
});

test('repairMissingAutoBlockForUser recreates a missing block from the stored denial count', async () => {
  const reviewContext = createReviewActionContext({
    maxDenialsBeforeBlock: 2,
    initialHashes: {
      [denialCountTestKey('t5_example')]: {
        example_user: '5',
      },
    },
  });

  const repaired = await repairMissingAutoBlockForUser(
    reviewContext.context as never,
    reviewContext.subredditId,
    reviewContext.record.username,
    {
      ...buildRuntimeConfig(),
      maxDenialsBeforeBlock: 2,
    }
  );

  assert.equal(repaired?.username, 'example_user');
  assert.equal(repaired?.deniedCount, 5);
  assert.equal(repaired?.reason, 'Reached 5 denials');
  assert.ok(reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.has('example_user'));
});

test('approveVerification leaves the record pending when user validation has a transient failure', async () => {
  const reviewContext = createReviewActionContext({
    validationResponses: [new Error('2 UNKNOWN: HTTP request failed with error: unexpected EOF')],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'validation_retry');
  assert.equal(result.applied, false);
  assert.equal(storedRecord?.status, 'pending');
  assert.equal(reviewContext.setUserFlairCalls.length, 0);
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
});

test('approveVerification leaves the record pending when live ban lookup has a transient failure', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [new Error('2 UNKNOWN: HTTP request failed with error: unexpected EOF')],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);

  assert.equal(result.outcome, 'validation_retry');
  assert.equal(result.applied, false);
  assert.equal(reviewContext.getParsedRecord()?.status, 'pending');
  assert.equal(reviewContext.unbanUserCalls.length, 0);
  assert.equal(reviewContext.setUserFlairCalls.length, 0);
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
});

test('denyVerification leaves the record pending when user validation has a transient failure', async () => {
  const reviewContext = createReviewActionContext({
    validationResponses: [new Error('2 UNKNOWN: HTTP request failed with error: unexpected EOF')],
  });

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');
  const storedRecord = reviewContext.getParsedRecord();

  assert.equal(result.outcome, 'validation_retry');
  assert.equal(result.applied, false);
  assert.equal(storedRecord?.status, 'pending');
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.size ?? 0, 0);
});

test('normalizeBatchReviewVerificationIds dedupes, drops empty IDs, and caps accepted IDs', () => {
  const normalized = normalizeBatchReviewVerificationIds(['one', ' ', 'one', 'two', null, 'three'], 2);

  assert.deepEqual(normalized.ids, ['one', 'two']);
  assert.equal(normalized.duplicateOrEmptyCount, 3);
  assert.equal(normalized.truncatedCount, 1);
});

test('buildBatchReviewToast summarizes partial batch outcomes', () => {
  const toast = buildBatchReviewToast({
    action: 'approve',
    requestedCount: 11,
    acceptedCount: 10,
    duplicateOrEmptyCount: 1,
    truncatedCount: 0,
    terminalVerificationIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    counts: {
      completed: 8,
      failed: 1,
      validation_retry: 0,
      invalid_account_removed: 0,
      banned_confirmation_required: 1,
    },
    items: [],
  });

  assert.equal(toast.text, 'Approved 8; 1 needs individual banned-user confirmation; 1 failed; 1 skipped.');
  assert.equal(toast.tone, 'error');
});

test('batchReviewVerifications approves selected records with one shared approval flair', async () => {
  const reviewContext = createReviewActionContext({
    multipleApprovalFlairsEnabled: true,
    initialHashes: {
      [subredditConfigTestKey('t5_example')]: {
        additional_approval_flairs_json: JSON.stringify([
          { templateId: 'def-456', label: 'Trusted', text: 'Trusted Verified' },
          { templateId: 'ghi-789', label: 'VIP', text: 'VIP Verified' },
        ]),
      },
    },
  });
  const secondRecord = buildRecord({
    id: 'verification_pending_2',
    username: 'second_user',
    userId: 't2_second',
    subredditId: reviewContext.subredditId,
    subredditName: reviewContext.record.subredditName,
    submittedAt: '2026-03-11T16:00:00.000Z',
  });
  reviewContext.redisStore.set(
    verificationRecordTestKey(reviewContext.subredditId, secondRecord.id),
    JSON.stringify(secondRecord)
  );
  reviewContext.redisStore.set(userPendingTestKey(reviewContext.subredditId, secondRecord.username), secondRecord.id);
  reviewContext.redisStore.set(userLatestTestKey(reviewContext.subredditId, secondRecord.username), secondRecord.id);
  ensureTestZSet(reviewContext.zsetStore, pendingIndexTestKey(reviewContext.subredditId)).set(
    secondRecord.id,
    new Date(secondRecord.submittedAt).getTime()
  );

  const result = await batchReviewVerifications(reviewContext.context as never, {
    action: 'approve',
    verificationIds: [reviewContext.record.id, secondRecord.id],
    selectedFlairTemplateId: 'ghi-789',
  });

  assert.equal(result.counts.completed, 2);
  assert.deepEqual(result.terminalVerificationIds.sort(), [reviewContext.record.id, secondRecord.id].sort());
  assert.equal(reviewContext.getParsedRecord(reviewContext.record.id)?.status, 'approved');
  assert.equal(reviewContext.getParsedRecord(secondRecord.id)?.status, 'approved');
  assert.equal(reviewContext.setUserFlairCalls.length, 2);
  assert.deepEqual(
    reviewContext.setUserFlairCalls.map((call) => call.flairTemplateId),
    ['ghi-789', 'ghi-789']
  );
});

test('batchReviewVerifications denies selected records with one shared reason and notes', async () => {
  const reviewContext = createReviewActionContext();
  const secondRecord = buildRecord({
    id: 'verification_pending_2',
    username: 'second_user',
    userId: 't2_second',
    subredditId: reviewContext.subredditId,
    subredditName: reviewContext.record.subredditName,
    submittedAt: '2026-03-11T16:00:00.000Z',
  });
  reviewContext.redisStore.set(
    verificationRecordTestKey(reviewContext.subredditId, secondRecord.id),
    JSON.stringify(secondRecord)
  );
  reviewContext.redisStore.set(userPendingTestKey(reviewContext.subredditId, secondRecord.username), secondRecord.id);
  reviewContext.redisStore.set(userLatestTestKey(reviewContext.subredditId, secondRecord.username), secondRecord.id);
  ensureTestZSet(reviewContext.zsetStore, pendingIndexTestKey(reviewContext.subredditId)).set(
    secondRecord.id,
    new Date(secondRecord.submittedAt).getTime()
  );

  const result = await batchReviewVerifications(reviewContext.context as never, {
    action: 'deny',
    verificationIds: [reviewContext.record.id, secondRecord.id],
    reason: 'reason_2',
    moderatorNotes: 'Shared denial note',
  });

  assert.equal(result.counts.completed, 2);
  assert.deepEqual(result.terminalVerificationIds.sort(), [reviewContext.record.id, secondRecord.id].sort());
  assert.equal(reviewContext.getParsedRecord(reviewContext.record.id)?.denyReason, 'reason_2');
  assert.equal(reviewContext.getParsedRecord(secondRecord.id)?.denyReason, 'reason_2');
  assert.equal(reviewContext.getParsedRecord(reviewContext.record.id)?.denyNotes, 'Shared denial note');
  assert.equal(reviewContext.getParsedRecord(secondRecord.id)?.denyNotes, 'Shared denial note');
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '1');
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('second_user'), '1');
});

test('batchReviewVerifications removes terminal denials even when side effects fail', async () => {
  const reviewContext = createReviewActionContext({
    createConversationResponses: [new Error('modmail unavailable')],
  });

  const result = await batchReviewVerifications(reviewContext.context as never, {
    action: 'deny',
    verificationIds: [reviewContext.record.id],
    reason: 'reason_1',
  });

  assert.equal(result.counts.failed, 1);
  assert.deepEqual(result.terminalVerificationIds, [reviewContext.record.id]);
  assert.equal(reviewContext.getParsedRecord()?.status, 'denied');
});

test('approveVerification clears reopened metadata when an invalid reopened review is removed', async () => {
  const reviewContext = createReviewActionContext({
    recordOverrides: {
      id: 'reopened_1',
      parentVerificationId: 'denied_1',
      submittedAt: '2026-03-11T15:00:00.000Z',
    },
    validationResponses: [new Error('account suspended')],
  });

  const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);

  assert.equal(result.outcome, 'invalid_account_removed');
  assert.equal(reviewContext.getParsedRecord()?.status, 'removed');
  assert.equal(
    reviewContext.redisStore.get(reopenedChildByDeniedTestKey(reviewContext.subredditId, 'denied_1')),
    undefined
  );
  assert.equal(
    reviewContext.redisStore.get(reopenedStateByDeniedTestKey(reviewContext.subredditId, 'denied_1')),
    undefined
  );
  assert.equal(
    reviewContext.redisStore.get(reopenedAuditByReopenedTestKey(reviewContext.subredditId, reviewContext.record.id)),
    undefined
  );
});

test('approveVerification removes the record when flair lookup later reports the account is gone', async () => {
  const reviewContext = createReviewActionContext({
    setUserFlairResponses: [new Error("that user doesn't exist")],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);

    assert.equal(result.outcome, 'invalid_account_removed');
    assert.equal(result.applied, false);
    assert.equal(reviewContext.getParsedRecord()?.status, 'removed');
    assert.ok(reviewContext.setUserFlairCalls.length >= 1);
    assert.equal(reviewContext.createConversationCalls.length, 0);
    assert.equal(reviewContext.addModNoteCalls.length, 0);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('approveVerification keeps the approval when modmail fails after a valid preflight', async () => {
  const reviewContext = createReviewActionContext({
    createConversationResponses: [new Error("that user doesn't exist")],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await approveVerification(reviewContext.context as never, reviewContext.record.id);

    assert.equal(result.outcome, 'completed');
    assert.equal(result.applied, true);
    assert.equal(result.modmail.status, 'failed');
    assert.equal(reviewContext.getParsedRecord()?.status, 'approved');
    assert.equal(reviewContext.addModNoteCalls.length, 1);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('approveVerification keeps the approval outcome behavior after unbanning when modmail fails', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [[{ username: 'example_user' }]],
    createConversationResponses: [new Error("that user doesn't exist")],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await approveVerification(reviewContext.context as never, reviewContext.record.id, true);

    assert.equal(result.outcome, 'completed');
    assert.equal(result.applied, true);
    assert.equal(result.modmail.status, 'failed');
    assert.deepEqual(reviewContext.unbanUserCalls, [
      { username: 'example_user', subredditName: 'examplesub' },
    ]);
    assert.equal(reviewContext.getParsedRecord()?.status, 'approved');
    assert.equal(reviewContext.addModNoteCalls.length, 1);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('approveVerification aborts when unban fails after confirmation', async () => {
  const reviewContext = createReviewActionContext({
    bannedResponses: [[{ username: 'example_user' }]],
    unbanResponses: [new Error('permission denied')],
  });

  await assert.rejects(
    approveVerification(reviewContext.context as never, reviewContext.record.id, true),
    /Unable to unban u\/example_user\./
  );
  assert.equal(reviewContext.getParsedRecord()?.status, 'pending');
  assert.deepEqual(reviewContext.unbanUserCalls, [
    { username: 'example_user', subredditName: 'examplesub' },
  ]);
  assert.equal(reviewContext.setUserFlairCalls.length, 0);
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
});

test('denyVerification keeps the denial when modmail fails after a valid preflight', async () => {
  const reviewContext = createReviewActionContext({
    createConversationResponses: [new Error("that user doesn't exist")],
  });
  const originalConsoleLog = console.log;
  console.log = () => {};

  try {
    const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied');

    assert.equal(result.outcome, 'completed');
    assert.equal(result.applied, true);
    assert.equal(result.modmail.status, 'failed');
    assert.equal(reviewContext.getParsedRecord()?.status, 'denied');
    assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '1');
  } finally {
    console.log = originalConsoleLog;
  }
});

test('denyVerification reports already denied records as a no-op', async () => {
  const reviewContext = createReviewActionContext({
    recordOverrides: {
      status: 'denied',
      moderator: 'Another_Mod',
      reviewedAt: '2026-03-12T12:00:00.000Z',
      denyReason: 'reason_1',
    },
  });

  const result = await denyVerification(reviewContext.context as never, reviewContext.record.id, 'reason_1', 'Denied again');

  assert.equal(result.outcome, 'completed');
  assert.equal(result.applied, false);
  assert.equal(result.modmail.status, 'skipped');
  assert.equal(reviewContext.createConversationCalls.length, 0);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.size ?? 0, 0);
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
    verificationRequiredToPost: false,
    verificationRequiredToComment: false,
    photoInstructions: 'Follow the instructions.',
    photoInstructionsEs: 'Sigue las instrucciones.',
    photoInstructionsFr: 'Suivez les instructions.',
    photoInstructionsPtBr: 'Siga as instruções.',
    photoInstructionsDefaultLanguage: 'en',
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

test('toHubState preserves viewerAwaitingFlairPropagation for hub rendering', () => {
  const hubState = toHubState(
    buildDashboardData({
      viewerAwaitingFlairPropagation: true,
    })
  );

  assert.equal(hubState.viewerAwaitingFlairPropagation, true);
});

test('onModeratorPurgeUserData writes an audit entry after manually purging the audit log', async () => {
  const reviewContext = createReviewActionContext();
  const toastCalls: unknown[] = [];
  seedAuditEntries(reviewContext, [
    {
      id: 'audit_before_1',
      action: 'approved',
      actor: 'Mod_One',
      at: '2026-03-25T12:00:00.000Z',
    },
    {
      id: 'audit_before_2',
      action: 'denied',
      actor: 'Mod_Two',
      at: '2026-03-24T12:00:00.000Z',
    },
  ]);

  const purgeContext = {
    ...reviewContext.context,
    settings: {
      async get(key: string) {
        if (key === 'mod_menu_audit_purge_days') {
          return 0;
        }
        return reviewContext.context.settings.get(key);
      },
    },
    ui: {
      showToast(payload: unknown) {
        toastCalls.push(payload);
      },
    },
  };

  await onModeratorPurgeUserData(
    {
      values: {
        username: '',
        confirmationText: 'confirm',
      },
    } as never,
    purgeContext as never
  );

  const auditEntries = await searchAuditEntries(purgeContext as never, reviewContext.subredditId, {
    offset: 0,
    limit: 25,
  });

  assert.equal(auditEntries.items.length, 1);
  assert.equal(auditEntries.items[0]?.action, 'audit_purged');
  assert.match(auditEntries.items[0]?.line ?? '', /Audit log purged by u\/mod_one/i);
  assert.match(auditEntries.items[0]?.line ?? '', /Purged 2 audit log entries/i);
  assert.equal(toastCalls.length, 1);
  assert.deepEqual(toastCalls[0], {
    text: 'Purged 2 audit log entries for r/examplesub.',
    appearance: 'success',
  });
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
  assert.equal(schedulerContext.setCalls.length, 2);
  assert.equal(schedulerContext.getCalls.length, 2);
  assert.equal(schedulerContext.delCalls.length, 1);
  assert.equal(schedulerContext.currentLockValue, null);
  assert.equal(schedulerContext.markerValue, '1');
});

test('ensureUserValidationSchedule skips scheduler work when the presence marker is warm', async () => {
  const schedulerContext = createSchedulerRegistrationContext({
    initialMarkerValue: '1',
  });

  await ensureUserValidationSchedule(
    schedulerContext.context as never,
    'T5_Example',
    '/r/ExampleSub/'
  );

  assert.equal(schedulerContext.listJobsCalls.length, 0);
  assert.equal(schedulerContext.runJobCalls.length, 0);
  assert.equal(schedulerContext.getCalls.length, 1);
  assert.equal(schedulerContext.delCalls.length, 0);
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
  assert.equal(schedulerContext.getCalls.length, 2);
  assert.equal(schedulerContext.delCalls.length, 1);
  assert.equal(schedulerContext.currentLockValue, null);
  assert.equal(schedulerContext.markerValue, '1');
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
  assert.equal(schedulerContext.getCalls.length, 1);
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
  assert.equal(schedulerContext.getCalls.length, 2);
  assert.equal(schedulerContext.delCalls.length, 0);
  assert.equal(schedulerContext.currentLockValue, 'newer-schedule-lock-token');
});

test('computeUserGrade flags shadowbanned accounts as spam risk', () => {
  const result = computeUserGrade(buildPendingAccountDetailsSnapshot({ isShadowBanned: true }));
  assert.equal(result.grade, 'spam_risk');
  assert.ok(result.score >= 100);
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes('shadowbanned')));
});

test('computeUserGrade flags subreddit-banned accounts as spam risk', () => {
  const result = computeUserGrade(
    buildPendingAccountDetailsSnapshot({ previousDeniedAttempts: 0, banStatus: 'banned' })
  );
  assert.equal(result.grade, 'spam_risk');
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes('banned')));
});

test('computeUserGrade marks aged, verified, premium accounts as trusted', () => {
  const result = computeUserGrade(
    buildPendingAccountDetailsSnapshot({
      accountCreatedAt: '2024-03-11T12:00:00.000Z',
      previousDeniedAttempts: 0,
      totalKarma: 5000,
      subredditKarma: 200,
      recentActivityCount: 50,
      hasVerifiedEmail: true,
      hasRedditPremium: true,
    })
  );
  assert.equal(result.grade, 'trusted');
  assert.ok(result.score <= 0);
});

test('computeUserGrade marks new low-karma inactive accounts as low engagement', () => {
  const result = computeUserGrade(
    buildPendingAccountDetailsSnapshot({
      accountCreatedAt: '2026-03-08T12:00:00.000Z',
      previousDeniedAttempts: 0,
      totalKarma: 0,
      subredditKarma: 0,
      recentActivityCount: 0,
      hasVerifiedEmail: false,
      hasRedditPremium: false,
    })
  );
  assert.equal(result.grade, 'low_engagement');
});

test('computeUserGrade returns normal for mildly weak signals', () => {
  const result = computeUserGrade(
    buildPendingAccountDetailsSnapshot({
      accountCreatedAt: '2025-12-01T12:00:00.000Z',
      previousDeniedAttempts: 0,
      totalKarma: 100,
      subredditKarma: 0,
      recentActivityCount: 10,
      hasVerifiedEmail: false,
      hasRedditPremium: false,
    })
  );
  assert.equal(result.grade, 'normal');
});

test('computeUserGrade ignores content-creator status', () => {
  const base = buildPendingAccountDetailsSnapshot({ previousDeniedAttempts: 0 });
  const withoutCreator = computeUserGrade({ ...base, isContentCreator: false, creatorLinkTypes: [] });
  const withCreator = computeUserGrade({
    ...base,
    isContentCreator: true,
    creatorLinkTypes: ['ONLYFANS'],
  });
  assert.equal(withCreator.score, withoutCreator.score);
  assert.equal(withCreator.grade, withoutCreator.grade);
});

test('detectContentCreator flags explicit creator link types', () => {
  const result = detectContentCreator([
    { type: 'INSTAGRAM', outboundUrl: 'https://instagram.com/example' },
    { type: 'ONLYFANS', outboundUrl: 'https://onlyfans.com/example' },
  ]);
  assert.equal(result.socialLinkCount, 2);
  assert.equal(result.isContentCreator, true);
  assert.ok(result.creatorLinkTypes.includes('ONLYFANS'));
});

test('detectContentCreator matches creator domains on custom links', () => {
  const result = detectContentCreator([
    { type: 'CUSTOM', outboundUrl: 'https://fansly.com/example' },
    { type: 'CUSTOM', outboundUrl: 'https://manyvids.com/Profile/example' },
  ]);
  assert.equal(result.isContentCreator, true);
  assert.ok(result.creatorLinkTypes.includes('FANSLY'));
  assert.ok(result.creatorLinkTypes.includes('MANYVIDS'));
});

test('detectContentCreator does not flag non-creator links', () => {
  const result = detectContentCreator([
    { type: 'TWITTER', outboundUrl: 'https://twitter.com/example' },
    { type: 'CUSTOM', outboundUrl: 'https://example.com/portfolio' },
  ]);
  assert.equal(result.socialLinkCount, 2);
  assert.equal(result.isContentCreator, false);
  assert.deepEqual(result.creatorLinkTypes, []);
});

test('detectContentCreator handles missing or malformed input', () => {
  assert.deepEqual(detectContentCreator(undefined), {
    socialLinkCount: 0,
    isContentCreator: false,
    creatorLinkTypes: [],
  });
  const result = detectContentCreator([null, 'bad', { type: 'CUSTOM' }]);
  assert.equal(result.socialLinkCount, 3);
  assert.equal(result.isContentCreator, false);
});

test('extractModmailUserSignals reads shadowban and recent activity', () => {
  const result = extractModmailUserSignals({
    isShadowBanned: true,
    recentComments: { c1: {}, c2: {} },
    recentPosts: { p1: {} },
  });
  assert.equal(result.isShadowBanned, true);
  assert.equal(result.recentActivityCount, 3);
});

test('extractModmailUserSignals returns nulls when data is absent', () => {
  assert.deepEqual(extractModmailUserSignals(undefined), {
    isShadowBanned: null,
    recentActivityCount: null,
  });
  assert.deepEqual(extractModmailUserSignals({}), {
    isShadowBanned: null,
    recentActivityCount: null,
  });
});

test('parsePendingAccountDetailsSnapshot defaults new fields for legacy records', () => {
  const parsed = parsePendingAccountDetailsSnapshot({
    capturedAt: '2026-03-11T12:00:00.000Z',
    accountCreatedAt: '2026-03-01T12:00:00.000Z',
    totalKarma: 10,
    subredditKarma: 1,
    previousDeniedAttempts: 0,
    banStatus: 'not_banned',
  });
  assert.ok(parsed);
  assert.equal(parsed?.hasVerifiedEmail, null);
  assert.equal(parsed?.isShadowBanned, null);
  assert.equal(parsed?.recentActivityCount, null);
  assert.equal(parsed?.socialLinkCount, 0);
  assert.equal(parsed?.isContentCreator, false);
  assert.deepEqual(parsed?.creatorLinkTypes, []);
  assert.equal(parsed?.lastDenial, null);
});

test('parsePendingLastDenialSnapshot validates and truncates stored denial context', () => {
  assert.equal(parsePendingLastDenialSnapshot(null), null);
  assert.equal(parsePendingLastDenialSnapshot({ deniedBy: 'mod_one' }), null);

  const parsed = parsePendingLastDenialSnapshot({
    deniedAt: '2026-03-10T12:00:00.000Z',
    deniedBy: ' mod_one ',
    denyReason: 'reason_2',
    denyNotes: ` ${'n'.repeat(400)} `,
  });
  assert.ok(parsed);
  assert.equal(parsed?.deniedAt, '2026-03-10T12:00:00.000Z');
  assert.equal(parsed?.deniedBy, 'mod_one');
  assert.equal(parsed?.denyReason, 'reason_2');
  assert.equal(parsed?.denyNotes?.length, 300);

  const invalidReason = parsePendingLastDenialSnapshot({
    deniedAt: '2026-03-10T12:00:00.000Z',
    denyReason: 'reason_99',
    denyNotes: '   ',
  });
  assert.equal(invalidReason?.denyReason, null);
  assert.equal(invalidReason?.deniedBy, null);
  assert.equal(invalidReason?.denyNotes, null);
});

test('computeUserGrade ignores prior denied attempts', () => {
  const base = buildPendingAccountDetailsSnapshot({ isShadowBanned: false, banStatus: 'not_banned' as const });
  const noDenials = computeUserGrade({ ...base, previousDeniedAttempts: 0 });
  const manyDenials = computeUserGrade({ ...base, previousDeniedAttempts: 5 });
  assert.equal(manyDenials.score, noDenials.score);
  assert.equal(manyDenials.grade, noDenials.grade);
  assert.ok(!manyDenials.reasons.some((reason) => reason.toLowerCase().includes('denied')));
});

test('computeUserGrade keeps hard-risk override despite positive signals', () => {
  const result = computeUserGrade(
    buildPendingAccountDetailsSnapshot({
      previousDeniedAttempts: 0,
      isShadowBanned: true,
      accountCreatedAt: '2024-03-11T12:00:00.000Z',
      totalKarma: 9000,
      subredditKarma: 500,
      recentActivityCount: 80,
      hasVerifiedEmail: true,
      hasRedditPremium: true,
    })
  );
  assert.equal(result.grade, 'spam_risk');
  assert.deepEqual(result.reasons, ['Account is shadowbanned']);
});

test('autoDenyShadowbannedSubmission denies without counting toward the block threshold', async () => {
  const reviewContext = createReviewActionContext({
    maxDenialsBeforeBlock: 2,
    initialHashes: {
      [denialCountTestKey('t5_example')]: {
        example_user: '1',
      },
    },
  });

  const result = await autoDenyShadowbannedSubmission(
    reviewContext.context as never,
    reviewContext.subredditId,
    'ExampleSub',
    reviewContext.record.id,
    { ...buildRuntimeConfig(), maxDenialsBeforeBlock: 2 }
  );

  assert.ok(result);
  assert.equal(result?.outcome, 'completed');
  assert.equal(result?.applied, true);
  assert.equal(result?.userBlocked, false);

  const storedRecord = reviewContext.getParsedRecord();
  assert.equal(storedRecord?.status, 'denied');
  assert.equal(storedRecord?.moderator, 'VouchX (auto)');
  assert.equal(storedRecord?.denyReason, null);
  // Denial count is not incremented and the user is not auto-blocked.
  assert.equal(reviewContext.hashStore.get(denialCountTestKey(reviewContext.subredditId))?.get('example_user'), '1');
  assert.ok(!reviewContext.hashStore.get(blockedUsersTestKey(reviewContext.subredditId))?.has('example_user'));
  assert.ok(
    reviewContext.addModNoteCalls.some((call) => String(call.note ?? '').toLowerCase().includes('shadowbanned'))
  );
  // The user-facing modmail explains the shadowban and links to the appeal page.
  const denialModmail = reviewContext.createConversationCalls.find((call) =>
    String(call.body ?? '').toLowerCase().includes('shadowbanned')
  );
  assert.ok(denialModmail, 'expected a shadowban denial modmail to be sent');
  assert.ok(String(denialModmail?.body ?? '').includes('reddit.com/appeals'));
});

test('autoDenyShadowbannedSubmission is a no-op when the record is no longer pending', async () => {
  const reviewContext = createReviewActionContext({
    recordOverrides: { status: 'denied', reviewedAt: '2026-03-11T12:30:00.000Z' },
  });

  const result = await autoDenyShadowbannedSubmission(
    reviewContext.context as never,
    reviewContext.subredditId,
    'ExampleSub',
    reviewContext.record.id,
    buildRuntimeConfig()
  );

  assert.equal(result, null);
  assert.equal(reviewContext.addModNoteCalls.length, 0);
});
