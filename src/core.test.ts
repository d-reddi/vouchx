import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approveVerification,
  buildModeratorUpdateNotice,
  clearExpiredPendingClaim,
  collectPendingAccountDetailsSnapshot,
  denyVerification,
  dismissModeratorUpdateNotice,
  ensureUserValidationSchedule,
  getCurrentModeratorPermissionList,
  getModeratorAccessSnapshot,
  getViewerFlairSnapshot,
  loadApprovalFlairOptionsForSettings,
  looksLikeInternalModmailArchiveError,
  onSaveFlairTemplateValues,
  sendUserModmailWithFallback,
  normalizeModmailConversationId,
  normalizeMaxDenialsBeforeBlockSetting,
  normalizeSubmittedPhotoUrl,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  parseRecord,
  releaseRedisLockIfOwned,
  repairMissingAutoBlockForUser,
  toModPanelState,
  toPublicHubConfig,
  toHubState,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  validateFlairTemplateId,
  validateMaxDenialsBeforeBlockSetting,
  withRedisLock,
  usernameLookupFields,
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
    totalKarma: 420,
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
  userResponses?: Array<{ createdAt: Date; commentKarma?: number | null; linkKarma?: number | null } | null | Error>;
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
  settingsTabRequiresConfigAccess?: boolean;
}) {
  const hashStore = new Map<string, Map<string, string>>();
  const setFieldsCalls: Array<Record<string, string>> = [];
  const configKey = 'subreddit:t5_example:config';
  const storedConfig = options?.storedConfig ?? {};
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
  };
}

function createViewerFlairSnapshotContext(options?: {
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
  const currentUserResponses = options?.currentUserResponses ?? [];
  const usernameUserResponses = options?.usernameUserResponses ?? [];
  let currentUserCallCount = 0;
  let usernameLookupCallCount = 0;
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
      reddit: {
        async getCurrentUser() {
          const response = currentUserResponses[Math.min(currentUserCallCount, currentUserResponses.length - 1)];
          currentUserCallCount += 1;
          return toMockUser(response, () => {
            flairLookupCallCount += 1;
          });
        },
        async getUserByUsername() {
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
    get usernameLookupCallCount() {
      return usernameLookupCallCount;
    },
    get flairLookupCallCount() {
      return flairLookupCallCount;
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
  maxDenialsBeforeBlock?: number | string;
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
  let validationResponseIndex = 0;
  let bannedResponseIndex = 0;
  let unbanResponseIndex = 0;
  let setUserFlairResponseIndex = 0;
  let addModNoteResponseIndex = 0;
  let createConversationResponseIndex = 0;
  let archiveConversationResponseIndex = 0;

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
  assert.deepEqual(modState.pending[0].accountDetails, accountDetails);
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

test('getViewerFlairSnapshot prefers the current viewer over a username lookup', async () => {
  const snapshotContext = createViewerFlairSnapshotContext({
    currentUserResponses: [
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
    'Bulges',
    'Ornery_Locksmith_176'
  );

  assert.deepEqual(snapshot, {
    flairText: 'Verified',
    flairCssClass: 'verified',
    flairTemplateId: 'abc123',
    userId: 't2_viewer',
  });
  assert.equal(snapshotContext.currentUserCallCount, 1);
  assert.equal(snapshotContext.usernameLookupCallCount, 0);
  assert.equal(snapshotContext.flairLookupCallCount, 1);
});

test('getViewerFlairSnapshot retries transient transport errors without logging them', async () => {
  const snapshotContext = createViewerFlairSnapshotContext({
    currentUserResponses: [
      new Error('2 UNKNOWN: HTTP request failed with error: unexpected EOF'),
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
      'Bulges',
      'Ornery_Locksmith_176'
    );

    assert.deepEqual(snapshot, {
      flairText: 'Verified',
      flairCssClass: 'verified',
      flairTemplateId: 'abc123',
      userId: 't2_viewer',
    });
    assert.equal(snapshotContext.currentUserCallCount, 2);
    assert.equal(snapshotContext.usernameLookupCallCount, 0);
    assert.equal(consoleLogCallCount, 0);
  } finally {
    console.log = originalConsoleLog;
  }
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

test('approveVerification keeps valid approvals working', async () => {
  const reviewContext = createReviewActionContext();

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
  assert.equal(reviewContext.setUserFlairCalls.length, 1);
  assert.equal(reviewContext.createConversationCalls.length, 1);
  assert.equal(reviewContext.addModNoteCalls.length, 1);
  assert.equal(reviewContext.redisStore.get(userPendingTestKey(reviewContext.subredditId, reviewContext.record.username)), undefined);
  assert.equal(
    reviewContext.redisStore.get(userLatestTestKey(reviewContext.subredditId, reviewContext.record.username)),
    reviewContext.record.id
  );
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
