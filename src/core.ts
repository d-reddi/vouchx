import type { Devvit, FormOnSubmitEvent } from '@devvit/public-api';
import {
  GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME,
  GLOBAL_BLOCKED_USERNAME_SETTING_NAMES,
  mergeParsedRedditUsernameLists,
  normalizeLooseRedditUsername,
  normalizeStrictRedditUsername,
  parseRedditUsernameList,
  type ParsedRedditUsernameList,
} from './shared/global-usernames.ts';
import type {
  VerificationStatus,
  DenyReason,
  AuditAction,
  DenyReasonConfig,
  PublicDenyReasonConfig,
  DenyReasonSlotDefinition,
  BlockScope,
  BlockedUserEntry,
  DeveloperPanelPayload,
  UserGrade,
  UserGradeResult,
  PendingAccountDetailsSnapshot,
  VerificationRecord,
  AuditLogEntry,
  RuntimeConfig,
  ApprovalFlairConfig,
  ThemePresetName,
  ThemeTokens,
  ThemePalette,
  UserSnapshot,
  ViewerIdentityState,
  ViewerIdentitySnapshot,
  DashboardData,
  FlairVerificationCheck,
  ViewerFlairLookupState,
  ViewerFlairSnapshot,
  ModeratorLookupState,
  ModeratorPermissionState,
  ModeratorAccessSnapshot,
  HubModeratorUiState,
  SubmitVerificationValues,
  SubmitVerificationFormData,
  CreatePostValues,
  PurgeUserDataFormValues,
  AuditRetentionJobData,
  RetentionReconcileSummary,
  ValidationCheckResult,
  RedisContext,
  RedditRedisContext,
  SchedulerContext,
  ReviewActionKind,
  ActionOutcome,
  FlairStepResult,
  ModmailUserSignals,
  ModmailStepResult,
  PendingModmailReplyEvent,
  PendingModmailArchiveResult,
  ModNoteStepResult,
  ManualBlockOutcome,
  ActionResult,
  BatchReviewAction,
  BatchReviewItemStatus,
  NormalizedBatchReviewIds,
  BatchReviewItemResult,
  BatchReviewResult,
  BatchReviewToast,
  DeleteDataResult,
  PurgeUserDataResult,
  DeleteDataConfirmValues,
  FlairTemplateFormValues,
  ModmailTemplatesFormData,
  ModmailTemplatesFormValues,
  ThemeSettingsValues,
  FlairTemplateValidationState,
  ApprovalFlairOption,
  UserFlairTemplateSummary,
  FlairApplyResult,
  StorageUsage,
  PendingPanelItem,
  PendingAccountDetailsDisplay,
  SearchPhotoLinkFields,
  ApprovedSearchPanelItem,
  ApprovedSearchResponsePayload,
  AuditSearchPanelItem,
  AuditSearchResponsePayload,
  ModeratorStatsRange,
  ModeratorStatsLeader,
  ModeratorStatsModeratorRow,
  ModeratorStatsPayload,
  AuditWindowCandidate,
  HistorySearchPanelItem,
  HistorySearchResponsePayload,
  ModPanelStatePayload,
  UpdateNoticeState,
  PublicHubConfig,
  HubStatePayload,
  ReleaseMetadata,
  SubmitVerificationResult,
  ParsedVersion,
  ContentCreatorDetection,
  RgbColor,
} from './core/types.ts';
import {
  assertClaimAllowsAction,
  clearExpiredPendingClaim,
  pendingClaimChanged,
  createRedisLockToken,
  releaseRedisLockIfOwned,
  withRedisLock,
  withVerificationActionLock,
  setPendingClaimState,
} from './core/locks.ts';
import {
  moderatorAccessRequestMemoSymbol,
  viewerIdentityRequestMemoSymbol,
  getViewerIdentityRequestMemo,
  getViewerIdentitySnapshot,
  getModeratorAccessRequestMemo,
  getModeratorAccessSnapshot,
  assertCanReview,
  getSettingsTabRequiresConfigAccess,
  getCurrentModeratorPermissionList,
  getCurrentModeratorPermissionSnapshot,
  assertCanAccessModeratorSettingsTab,
  createStatusError,
  getModeratorMembershipError,
  moderatorPermissionLookupNeedsRetry,
  getModeratorReviewAccessError,
  hasManageUsersPermissionInList,
  hasConfigAccessPermissionInList,
  hasAllModeratorPermissionInList,
  normalizeModeratorPermissions,
  getModeratorCacheSubredditId,
  cacheModeratorPermissions,
  getCachedModeratorPermissions,
  cachePositiveModeratorUiState,
  hasCachedPositiveModeratorUiState,
  setModeratorUiUnavailableBackoff,
  hasModeratorUiUnavailableBackoff,
  logModeratorLookupFailureWithCooldown,
  getHubModeratorUiState,
} from './core/moderator-access.ts';
import {
  createGlobalBlockedUserEntry,
  getStoredDenialCount,
  listBlockedUsers,
  getBlockedUser,
  isUserBlocked,
  repairMissingAutoBlockForUser,
  incrementDenialCount,
  setBlockedUser,
  unblockUserForModerator,
  blockUserForModerator,
  setManualBlockedUserEntry,
  parseBlockedUserEntry,
} from './core/blocking.ts';
import {
  getRecordUserId,
  setUserPendingPointer,
  setUserLatestPointer,
  deleteUserPendingPointers,
  deleteUserLatestPointers,
  clearUserPendingPointersIfMatch,
  backfillUserRecordPointers,
  getLatestRecordForUserId,
  findLatestExistingRecordIdForUser,
  removeRecordIdsFromGlobalIndexes,
  sweepStaleRecordIndexEntries,
  estimateSubredditStorageUsage,
  emptyStorageUsage,
  mGetStringValuesInChunks,
  utf8ByteLength,
  appendAuditLog,
  getLatestRecordForUser,
  getLatestRecordForCurrentViewer,
  getRecord,
  getApprovedRecordRetentionAnchorMs,
  getHistoryRecordAnchorMs,
  setRecord,
  parseRecord,
  parseAuditEntry,
  approvedPrefixFromUsername,
  addApprovedPrefixIndexEntry,
  removeApprovedPrefixIndexEntry,
  removeApprovedPrefixIndexEntries,
  asAuditAction,
  formatAuditEntry,
} from './core/records.ts';
import {
  listPendingVerifications,
  toSearchPhotoLinkFields,
  toApprovedSearchPanelItem,
  searchHistoryRecords,
  searchApprovedRecords,
  normalizeModeratorStatsRange,
  moderatorStatsLookbackDays,
  moderatorStatsActorKey,
  loadAuditWindowCandidates,
  searchAuditEntries,
  getModeratorStats,
  countCurrentlyVerifiedRecords,
  parseSearchBoundaryMs,
} from './core/search.ts';
import {
  emptyViewerFlairSnapshot,
  getViewerFlairSnapshot,
  extractFieldString,
  extractTemplateId,
  normalizeTemplateId,
  normalizeApprovalFlairConfig,
  approvalFlairTemplateIdsMatch,
  parseAdditionalApprovalFlairs,
  serializeAdditionalApprovalFlairs,
  configuredApprovalTemplateIds,
  buildApprovalFlairOptionLabel,
  listUserFlairTemplatesForSubreddit,
  refreshAdditionalApprovalFlairConfigsFromTemplates,
  loadApprovalFlairOptionsForSettings,
  validateFlairTemplateIdForSubreddit,
  validateFlairTemplateIdAgainstTemplates,
  refreshConfiguredFlairTemplateCache,
  shouldReconcileApprovedViewerFlair,
  isViewerFlairReconcileDue,
  normalizeCssClass,
  cssClassMatchesSubstring,
  isManualFlairCheckSource,
  normalizeUsernamePrefixFilter,
  shouldViewerDisplayVerifiedState,
  isViewerAwaitingFlairPropagation,
  checkVerificationFlair,
  validateFlairTemplateId,
  isLikelyFlairTemplateId,
  logViewerFlairLookupFailureWithCooldown,
} from './core/flair.ts';
import {
  sendShadowbanAutoDenyModmail,
  addShadowbanAutoDenyModNote,
  sendApprovalModmail,
  addApprovalModNote,
  addPendingSubmissionModNote,
  addPendingWithdrawalModNote,
  addDenialModNote,
  addSelfRemovalModNote,
  addModeratorRemovalModNote,
  sendModeratorRemovalModmail,
  sendDenialModmail,
  sendPendingSubmissionModmail,
  rememberPendingModmailConversation,
  extractModmailUserSignals,
  attachModmailUserSignals,
  sendUserModmailWithFallback,
  archiveModmailConversationBestEffort,
  archivePendingVerificationModmailReply,
  getAutoArchivePendingModmailEnabled,
  resolveModmailParticipantReplyIdentity,
  getMostRecentModmailMessage,
  normalizeModmailPayloadToken,
  normalizeTriggerSubredditId,
  findPendingRecordForModmailReply,
  buildModmailSubject,
  prependRenderedModmailHeader,
  prependModmailHeader,
  normalizeDenialNotes,
  formatDenialNotesForModmail,
  templateIncludesDenialNotesPlaceholder,
  normalizeDenialNotesTemplateBlocks,
  collapseBlankLines,
  renderDenialTemplateText,
  renderDenialModmailBody,
  fillTemplate,
  normalizePlaceholderKey,
  looksLikeInternalModmailArchiveError,
} from './core/modmail.ts';
import {
  DEFAULT_THEME_PRESET,
  THEME_PRESETS,
  parseThemePreset,
  normalizeHexColor,
  hexToRgbColor,
  rgbColorToHex,
  mixHexColors,
  relativeLuminance,
  deriveCustomThemeTokens,
  deriveCustomThemePalette,
  resolveThemePalette,
} from './core/theme.ts';
import {
  makeVerificationId,
  subredditScopePrefix,
  verificationRecordKey,
  pendingIndexKey,
  approvedIndexKey,
  approvedPrefixIndexKey,
  historyDateIndexKey,
  historyByUserIndexKey,
  historyByModeratorIndexKey,
  userPendingKey,
  userLatestKey,
  blockedUsersKey,
  denialCountKey,
  auditDateIndexKey,
  auditEntryKey,
  subredditConfigKey,
  validationDueIndexKey,
  validationHardExpireIndexKey,
  validationRunLockKey,
  validationScheduleLockKey,
  validationSchedulePresentKey,
  verificationActionLockKey,
  validationBackfillCursorKey,
  validationNonApprovedCursorKey,
  validationNonApprovedFailureCountKey,
  staleRecordIndexSweepCursorKey,
  modmailThreadByUserKey,
  modmailThreadByUserEntryKey,
  pendingModmailConversationKey,
  reopenedChildByDeniedKey,
  reopenedStateByDeniedKey,
  reopenedAuditByReopenedKey,
  modmailDedupeKey,
  modmailLockKey,
  moderatorPermissionCacheKey,
  moderatorLookupLogCooldownKey,
  moderatorUiPositiveCacheKey,
  moderatorUiUnavailableBackoffKey,
  recentViewerFlairRemovalSuppressionKey,
  updateNoticeDismissalKey,
} from './core/keys.ts';
import {
  sanitizeSubredditId,
  sanitizeSubredditName,
  normalizeUserId,
  normalizeUsername,
  normalizeUsernameStrict,
  normalizeUsernameForLookup,
  primaryUsernameLookupField,
  usernameLookupFields,
  normalizeModmailConversationId,
  maskUsernameForLog,
  normalizeUsernameKey,
  usernamesEqual,
  addDaysIso,
  firstNonEmpty,
  parseVersion,
  compareVersions,
  parseTimestampMs,
  getFiniteTimestampMs,
  errorText,
  formatTimestamp,
  normalizeOptionalIsoTimestamp,
  normalizeOptionalWholeNumber,
  normalizeNonNegativeWholeNumber,
  normalizeOptionalBoolean,
} from './core/normalize.ts';
import {
  MAX_BATCH_REVIEW_ITEMS,
  BATCH_REVIEW_CONCURRENCY,
  APP_KEY_PREFIX,
  SUBREDDIT_KEY_PREFIX,
  MAX_PENDING_TO_LOAD,
  SELF_DELETE_INDEX_SCAN_LIMIT,
  MIN_MAX_DENIALS_BEFORE_BLOCK,
  DEFAULT_MAX_DENIALS_BEFORE_BLOCK,
  VALIDATION_CHECK_INTERVAL_DAYS,
  VALIDATION_HARD_EXPIRY_DAYS,
  VALIDATION_BATCH_SIZE,
  NON_APPROVED_VALIDATION_BATCH_SIZE,
  NON_APPROVED_VALIDATION_SCAN_MULTIPLIER,
  STALE_RECORD_INDEX_SWEEP_BATCH_SIZE,
  UPDATE_NOTICE_DISMISS_TTL_DAYS,
  APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER,
  MILLIS_PER_DAY,
  HISTORY_RETENTION_DAYS,
  AUDIT_RETENTION_DAYS,
  VERIFIED_RECORD_RETENTION_DAYS,
  VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS,
  FLAIR_TEMPLATE_CACHE_REFRESH_INTERVAL_MS,
  VIEWER_FLAIR_RECONCILE_INTERVAL_MS,
  DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS,
  INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS,
  INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE,
  INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED,
  INSTALL_SETTING_AUTO_ARCHIVE_PENDING_MODMAIL_ENABLED,
  INSTALL_SETTING_AUTO_DENY_SHADOWBANNED_ENABLED,
  INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED,
  INSTALL_SETTING_MAX_DENIALS_BEFORE_BLOCK,
  INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT,
  INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS,
  GLOBAL_SETTING_LATEST_RELEASE_VERSION,
  GLOBAL_SETTING_LATEST_RELEASE_TITLE,
  GLOBAL_SETTING_LATEST_RELEASE_NOTES,
  GLOBAL_SETTING_LATEST_RELEASE_LINK,
  GLOBAL_SETTING_LATEST_RELEASE_SEVERITY,
  GLOBAL_SETTING_DEVELOPER_UI_USERNAMES,
  MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH,
  MAX_DENY_REASON_LABEL_LENGTH,
  PENDING_CLAIM_TTL_MS,
  VERIFICATION_ACTION_LOCK_TTL_MS,
  SUBMISSION_PHOTO_ALLOWED_HOSTS,
  MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER,
  MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER,
  DEFAULT_GENERIC_DENY_REASON_TEMPLATE,
  MODMAIL_DENIAL_NOTES_PREFIX,
  DENIAL_NOTES_PLACEHOLDER_KEY,
  LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY,
  DENIAL_NOTES_BLOCK_MARKER,
  DENY_REASON_INSTALL_SETTINGS,
  MODMAIL_DEDUPE_TTL_SECONDS,
  MODERATOR_PERMISSION_CACHE_TTL_MS,
  MODERATOR_LOOKUP_LOG_COOLDOWN_MS,
  MODERATOR_UI_POSITIVE_CACHE_TTL_MS,
  MODERATOR_UI_UNAVAILABLE_BACKOFF_MS,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  USER_VALIDATION_SCHEDULE_LOCK_TTL_MS,
  USER_VALIDATION_SCHEDULE_PRESENT_TTL_MS,
  VIEWER_FLAIR_REMOVAL_SUPPRESSION_TTL_MS,
  VIEWER_FLAIR_PROPAGATION_WINDOW_MS,
  STORAGE_METER_CAP_BYTES,
  BLOCKED_SUBMISSION_MESSAGE,
  VERIFICATIONS_DISABLED_MESSAGE,
  DEFAULT_FLAIR_TEXT,
  DEFAULT_REQUIRED_PHOTO_COUNT,
  DEFAULT_PENDING_TURNAROUND_DAYS,
  DEFAULT_MODMAIL_SUBJECT,
  DEFAULT_PENDING_BODY,
  DEFAULT_APPROVE_HEADER,
  DEFAULT_REMOVAL_HEADER,
  LEGACY_DEFAULT_APPROVE_BODY,
  DEFAULT_APPROVE_BODY,
  DEFAULT_DENY_HEADER,
  DEFAULT_REMOVAL_BODY,
  CONFIG_FIELD,
  DENY_REASON_TEMPLATE_CONFIG_FIELD,
  LEGACY_CONFIG_FIELD,
} from './core/constants.ts';
































































// Persisted snapshot plus the advisory grade computed on display. The grade is derived
// (never stored in Redis) so it always reflects the current scoring logic.


























function parseDenyReason(value: string | undefined | null): DenyReason | null {
  if (!value) {
    return null;
  }
  return DENY_REASON_INSTALL_SETTINGS.some((setting) => setting.id === value) ? (value as DenyReason) : null;
}

function formatDenyReasonSlotLabel(reason: DenyReason): string {
  return `Reason ${reason.replace('reason_', '')}`;
}

function normalizeDenyReasonLabel(value: string | undefined | null): string {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, MAX_DENY_REASON_LABEL_LENGTH);
}

async function getConfiguredDenyReasons(
  context: Pick<Devvit.Context, 'settings'>,
  stored: Record<string, string>
): Promise<DenyReasonConfig[]> {
  return await Promise.all(
    DENY_REASON_INSTALL_SETTINGS.map(async (setting) => {
      const rawLabel = await context.settings.get<string>(setting.labelSettingName);
      const label = normalizeDenyReasonLabel(
        rawLabel === undefined || rawLabel === null ? setting.defaultLabel : String(rawLabel)
      );
      const templateSource = firstNonEmpty(stored[setting.templateConfigFieldName]) ?? setting.defaultTemplate;
      return {
        id: setting.id,
        label,
        template: templateSource.trim() || DEFAULT_GENERIC_DENY_REASON_TEMPLATE,
        enabled: label.length > 0,
      };
    })
  );
}

function getConfiguredDenyReason(
  config: Pick<RuntimeConfig, 'denyReasons'>,
  reason: DenyReason | null | undefined
): DenyReasonConfig | null {
  if (!reason) {
    return null;
  }
  return Array.isArray(config.denyReasons) ? config.denyReasons.find((item) => item.id === reason) ?? null : null;
}

function getDenyReasonDisplayLabel(config: Pick<RuntimeConfig, 'denyReasons'>, reason: DenyReason): string {
  const configured = getConfiguredDenyReason(config, reason);
  return configured?.label.trim() || formatDenyReasonSlotLabel(reason);
}

function buildSubmitVerificationForm(data: { [key: string]: any }) {
  const formData = data as SubmitVerificationFormData;
  const requiredPhotoCount = parseRequiredPhotoCount(formData.requiredPhotoCount, DEFAULT_REQUIRED_PHOTO_COUNT);
  const photoFields = [
    {
      type: 'image' as const,
      name: 'photoOneUrl',
      label: 'Photo 1',
      required: true,
      helpText: 'Upload your first verification photo.',
    },
  ];

  if (requiredPhotoCount >= 2) {
    photoFields.push({
      type: 'image' as const,
      name: 'photoTwoUrl',
      label: 'Photo 2',
      required: true,
      helpText: 'Upload your second verification photo.',
    });
  }

  if (requiredPhotoCount >= 3) {
    photoFields.push({
      type: 'image' as const,
      name: 'photoThreeUrl',
      label: 'Photo 3',
      required: true,
      helpText: 'Upload your third verification photo.',
    });
  }

  return {
    title: 'Submit verification photos',
    description: `Upload ${requiredPhotoCount} verification photo${
      requiredPhotoCount === 1 ? '' : 's'
    } for moderator review. Press submit below to submit.`,
    fields: [...photoFields],
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  };
}

const deleteVerificationDataFormDefinition = {
  title: 'Remove my verification',
  description: "This removes your verification. If you want to be verified again later you will need to submit a new request.",
  fields: [
    {
      type: 'boolean' as const,
      name: 'confirmDelete',
      label: 'I understand that my verified status will be removed.',
    },
  ],
  acceptLabel: 'Remove verification',
  cancelLabel: 'Cancel',
};

function toModPanelState(dashboard: DashboardData): ModPanelStatePayload {
  return {
    viewerUsername: dashboard.viewerUsername,
    subredditName: dashboard.subredditName,
    canOpenInstallSettings: dashboard.canOpenInstallSettings,
    hasConfigAccess: dashboard.hasConfigAccess,
    canAccessSettingsTab: dashboard.canAccessSettingsTab,
    flairTemplateValidation: dashboard.flairTemplateValidation,
    pendingCount: dashboard.pendingCount,
    pending: dashboard.pending.map((record) => toPendingPanelItem(record)),
    approved: dashboard.approved,
    approvedHasMore: dashboard.approvedHasMore,
    auditLog: dashboard.auditLog,
    auditHasMore: dashboard.auditHasMore,
    blocked: dashboard.blocked,
    storage: dashboard.storage,
    config: dashboard.config,
    resolvedTheme: resolveThemePalette(dashboard.config),
    themePresets: THEME_PRESETS,
  };
}

function toPublicHubConfig(config: RuntimeConfig): PublicHubConfig {
  return {
    verificationsEnabled: config.verificationsEnabled,
    verificationsDisabledMessage: config.verificationsDisabledMessage,
    photoInstructions: config.photoInstructions,
    photoInstructionsEs: config.photoInstructionsEs,
    photoInstructionsFr: config.photoInstructionsFr,
    photoInstructionsPtBr: config.photoInstructionsPtBr,
    photoInstructionsDefaultLanguage: config.photoInstructionsDefaultLanguage,
    showPhotoInstructionsBeforeSubmit: config.showPhotoInstructionsBeforeSubmit,
    pendingTurnaroundDays: config.pendingTurnaroundDays,
    denyReasons: config.denyReasons.map((reason) => ({
      id: reason.id,
      label: reason.label,
      enabled: reason.enabled,
    })),
  };
}

function toHubState(dashboard: DashboardData): HubStatePayload {
  const state: HubStatePayload = {
    viewerUsername: dashboard.viewerUsername,
    subredditName: dashboard.subredditName,
    isModerator: dashboard.isModerator,
    canReview: dashboard.canReview,
    requiresInitialSetup: dashboard.requiresInitialSetup,
    config: toPublicHubConfig(dashboard.config),
    viewerShouldDisplayVerified: dashboard.viewerShouldDisplayVerified,
    viewerAwaitingFlairPropagation: dashboard.viewerAwaitingFlairPropagation,
    viewerVerifiedByFlair: dashboard.viewerVerifiedByFlair,
    viewerFlairCheckSource: dashboard.viewerFlairCheckSource,
    viewerBlocked: dashboard.viewerBlocked,
    userLatest: dashboard.userLatest,
    pendingCount: dashboard.pendingCount,
    resolvedTheme: resolveThemePalette(dashboard.config),
    themePresets: THEME_PRESETS,
  };
  if (dashboard.developerPanel) {
    state.developerPanel = dashboard.developerPanel;
  }
  return state;
}

function toPendingPanelItem(record: VerificationRecord): PendingPanelItem {
  const normalizedRecord = clearExpiredPendingClaim(record);
  return {
    id: normalizedRecord.id,
    username: normalizedRecord.username,
    submittedAt: normalizedRecord.submittedAt,
    acknowledgedAt: normalizedRecord.ageAcknowledgedAt,
    photoOneUrl: normalizedRecord.photoOneUrl,
    photoTwoUrl: normalizedRecord.photoTwoUrl,
    photoThreeUrl: normalizedRecord.photoThreeUrl ?? '',
    claimedBy: normalizedRecord.claimedBy ?? null,
    claimedAt: normalizedRecord.claimedAt ?? null,
    parentVerificationId: normalizedRecord.parentVerificationId ?? null,
    isResubmission: Boolean(normalizedRecord.isResubmission),
    accountDetails: normalizedRecord.accountDetails
      ? { ...normalizedRecord.accountDetails, ...computeUserGrade(normalizedRecord.accountDetails) }
      : null,
  };
}

function normalizeUpdateNoticeText(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? normalized : null;
}

function normalizeUpdateNoticeUrl(value: unknown): string | null {
  const normalized = normalizeUpdateNoticeText(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeReleaseSeverity(value: unknown): 'critical' | 'normal' | null {
  const normalized = normalizeUpdateNoticeText(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }
  if (normalized === 'critical') {
    return 'critical';
  }
  if (normalized === 'normal') {
    return 'normal';
  }
  return null;
}




async function readLatestReleaseMetadata(context: Pick<Devvit.Context, 'settings'>): Promise<ReleaseMetadata | null> {
  const [rawVersion, rawSeverity, rawTitle, rawNotes, rawLink] = await Promise.all([
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_VERSION),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_SEVERITY),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_TITLE),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_NOTES),
    context.settings.get<string>(GLOBAL_SETTING_LATEST_RELEASE_LINK),
  ]);
  const parsedVersion = parseVersion(rawVersion);
  if (!parsedVersion) {
    return null;
  }
  const normalizedSeverity = normalizeReleaseSeverity(rawSeverity);
  return {
    version: parsedVersion.normalized,
    critical: normalizedSeverity === 'critical',
    title: normalizeUpdateNoticeText(rawTitle),
    notes: normalizeUpdateNoticeText(rawNotes),
    linkUrl: normalizeUpdateNoticeUrl(rawLink),
  };
}

async function readGlobalUsernameSetting(
  context: Pick<Devvit.Context, 'settings'>,
  settingName: string
): Promise<ParsedRedditUsernameList> {
  return parseRedditUsernameList(await context.settings.get<string>(settingName));
}

async function readMergedGlobalUsernameSettings(
  context: Pick<Devvit.Context, 'settings'>,
  settingNames: readonly string[]
): Promise<ParsedRedditUsernameList> {
  const rawChunkCount = await context.settings.get<string>(GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME);
  const parsedChunkCount = Number.parseInt(String(rawChunkCount ?? '').trim(), 10);
  const activeSettingNames =
    Number.isFinite(parsedChunkCount) && parsedChunkCount >= 0
      ? settingNames.slice(0, Math.min(settingNames.length, parsedChunkCount))
      : settingNames;
  return mergeParsedRedditUsernameLists(
    await Promise.all(activeSettingNames.map((settingName) => readGlobalUsernameSetting(context, settingName)))
  );
}


async function buildModeratorUpdateNotice(
  context: Pick<Devvit.Context, 'settings' | 'redis'> & { subredditId?: string | null; appVersion?: string | null },
  moderator: string
): Promise<UpdateNoticeState | null> {
  try {
    const installedVersion = parseVersion(context.appVersion);
    const latestRelease = await readLatestReleaseMetadata(context);
    const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
    if (!installedVersion || !latestRelease || !subredditId) {
      return null;
    }
    const latestVersion = parseVersion(latestRelease.version);
    if (!latestVersion || compareVersions(latestVersion, installedVersion) <= 0) {
      return null;
    }
    const dismissalKey = updateNoticeDismissalKey(subredditId, moderator, latestRelease.version);
    const dismissedAt = (await context.redis.get(dismissalKey)) ?? null;
    if (!latestRelease.critical) {
      if (dismissedAt) {
        return null;
      }
    }
    return {
      targetVersion: latestRelease.version,
      critical: latestRelease.critical,
      title: latestRelease.title,
      notes: latestRelease.notes,
      linkUrl: latestRelease.linkUrl,
    };
  } catch (error) {
    console.log(`Update notice lookup failed: ${errorText(error)}`);
    return null;
  }
}

async function dismissModeratorUpdateNotice(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  moderator: string,
  targetVersion: string
): Promise<void> {
  const parsedVersion = parseVersion(targetVersion);
  const subredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
  if (!parsedVersion || !subredditId) {
    throw new Error('Missing update notice version.');
  }
  await context.redis.set(
    updateNoticeDismissalKey(subredditId, moderator, parsedVersion.normalized),
    new Date().toISOString(),
    {
      expiration: new Date(Date.now() + UPDATE_NOTICE_DISMISS_TTL_DAYS * MILLIS_PER_DAY),
    }
  );
}




function normalizePendingBanStatus(value: unknown): PendingAccountDetailsSnapshot['banStatus'] {
  return value === 'banned' || value === 'not_banned' || value === 'unknown' ? value : 'unknown';
}

function parsePendingAccountDetailsSnapshot(value: unknown): PendingAccountDetailsSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as {
    capturedAt?: unknown;
    accountCreatedAt?: unknown;
    totalKarma?: unknown;
    subredditKarma?: unknown;
    previousDeniedAttempts?: unknown;
    banStatus?: unknown;
    hasVerifiedEmail?: unknown;
    hasRedditPremium?: unknown;
    isShadowBanned?: unknown;
    recentActivityCount?: unknown;
    socialLinkCount?: unknown;
    isContentCreator?: unknown;
    creatorLinkTypes?: unknown;
  };

  const capturedAt = normalizeOptionalIsoTimestamp(parsed.capturedAt);
  if (!capturedAt) {
    return null;
  }

  return {
    capturedAt,
    accountCreatedAt: normalizeOptionalIsoTimestamp(parsed.accountCreatedAt),
    totalKarma: normalizeOptionalWholeNumber(parsed.totalKarma),
    subredditKarma: normalizeOptionalWholeNumber(parsed.subredditKarma),
    previousDeniedAttempts: normalizeNonNegativeWholeNumber(parsed.previousDeniedAttempts),
    banStatus: normalizePendingBanStatus(parsed.banStatus),
    hasVerifiedEmail: normalizeOptionalBoolean(parsed.hasVerifiedEmail),
    hasRedditPremium: normalizeOptionalBoolean(parsed.hasRedditPremium),
    isShadowBanned: normalizeOptionalBoolean(parsed.isShadowBanned),
    recentActivityCount: normalizeOptionalWholeNumber(parsed.recentActivityCount),
    socialLinkCount: normalizeNonNegativeWholeNumber(parsed.socialLinkCount),
    isContentCreator: parsed.isContentCreator === true,
    creatorLinkTypes: normalizeCreatorLinkTypeList(parsed.creatorLinkTypes),
  };
}


function normalizeCreatorLinkTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      seen.add(entry.trim());
    }
  }
  return Array.from(seen);
}

// Advisory user-scoring weights. Developer-tunable constants (not moderator-configurable),
// consistent with the other VouchX retention/threshold constants.
//
// Prior denied attempts are intentionally NOT part of the grade: a denial reflects submission
// quality (e.g. a bad photo), already drives the separate auto-block counter, and is shown to
// moderators as its own stat. Folding it in double-counted it and mislabeled aged/verified
// accounts as low-history. Shadowban / subreddit-ban are hard-risk overrides that classify as
// Spam Risk regardless of positive signals, so good history cannot dilute a genuine risk signal.
const SCORE_HARD_RISK = 100;
const SCORE_ACCOUNT_UNDER_7_DAYS = 20;
const SCORE_ACCOUNT_UNDER_30_DAYS = 10;
const SCORE_ACCOUNT_OVER_1_YEAR = -10;
const SCORE_ZERO_TOTAL_KARMA = 15;
const SCORE_ZERO_SUBREDDIT_KARMA = 5;
const SCORE_NO_RECENT_ACTIVITY = 15;
const SCORE_LOW_RECENT_ACTIVITY = 5;
const SCORE_VERIFIED_EMAIL = -5;
const SCORE_REDDIT_PREMIUM = -10;
const GRADE_LOW_ENGAGEMENT_THRESHOLD = 20;
const GRADE_TRUSTED_THRESHOLD = 0;

function accountAgeDaysFromSnapshot(snapshot: PendingAccountDetailsSnapshot): number | null {
  if (!snapshot.accountCreatedAt) {
    return null;
  }
  const createdMs = new Date(snapshot.accountCreatedAt).getTime();
  const referenceMs = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(createdMs) || !Number.isFinite(referenceMs)) {
    return null;
  }
  return (referenceMs - createdMs) / MILLIS_PER_DAY;
}

// Pure, deterministic advisory grade. Two intentional exclusions:
//   - Content-creator status: surfaces as a separate informational badge, never affects the grade.
//   - Prior denied attempts: shown as its own stat, never affects the grade (see weight comments).
// Hard-risk signals (shadowban, subreddit ban) short-circuit to Spam Risk so that positive
// history signals can never offset a genuine risk signal.
function computeUserGrade(snapshot: PendingAccountDetailsSnapshot): UserGradeResult {
  const riskReasons: string[] = [];
  if (snapshot.isShadowBanned === true) {
    riskReasons.push('Account is shadowbanned');
  }
  if (snapshot.banStatus === 'banned') {
    riskReasons.push('Currently banned in this subreddit');
  }
  if (riskReasons.length > 0) {
    return { grade: 'spam_risk', score: SCORE_HARD_RISK, reasons: riskReasons };
  }

  let score = 0;
  const reasons: string[] = [];

  const ageDays = accountAgeDaysFromSnapshot(snapshot);
  if (ageDays !== null) {
    if (ageDays < 7) {
      score += SCORE_ACCOUNT_UNDER_7_DAYS;
      reasons.push('Account less than 7 days old');
    } else if (ageDays < 30) {
      score += SCORE_ACCOUNT_UNDER_30_DAYS;
      reasons.push('Account less than 30 days old');
    } else if (ageDays > 365) {
      score += SCORE_ACCOUNT_OVER_1_YEAR;
      reasons.push('Account over 1 year old');
    }
  }

  if (snapshot.totalKarma !== null && snapshot.totalKarma <= 0) {
    score += SCORE_ZERO_TOTAL_KARMA;
    reasons.push('Zero or negative total karma');
  }
  if (snapshot.subredditKarma !== null && snapshot.subredditKarma <= 0) {
    score += SCORE_ZERO_SUBREDDIT_KARMA;
    reasons.push('No karma in this subreddit');
  }

  if (snapshot.recentActivityCount !== null) {
    if (snapshot.recentActivityCount === 0) {
      score += SCORE_NO_RECENT_ACTIVITY;
      reasons.push('No recent posts or comments');
    } else if (snapshot.recentActivityCount <= 2) {
      score += SCORE_LOW_RECENT_ACTIVITY;
      reasons.push('Very little recent activity');
    }
  }

  if (snapshot.hasVerifiedEmail === true) {
    score += SCORE_VERIFIED_EMAIL;
    reasons.push('Verified email');
  }
  if (snapshot.hasRedditPremium === true) {
    score += SCORE_REDDIT_PREMIUM;
    reasons.push('Has Reddit Premium');
  }

  let grade: UserGrade;
  if (score >= GRADE_LOW_ENGAGEMENT_THRESHOLD) {
    grade = 'low_engagement';
  } else if (score <= GRADE_TRUSTED_THRESHOLD) {
    grade = 'trusted';
  } else {
    grade = 'normal';
  }

  return { grade, score, reasons };
}

// Known monetization / adult content-creator platforms. Explicit social-link types plus
// domain matches for links Reddit reports as CUSTOM (Fansly, ManyVids, etc. have no enum type).
const CREATOR_SOCIAL_LINK_TYPES = new Set([
  'ONLYFANS',
  'PATREON',
  'KOFI',
  'CASH_APP',
  'BUY_ME_A_COFFEE',
]);

const CREATOR_LINK_DOMAINS: { label: string; domain: string }[] = [
  { label: 'ONLYFANS', domain: 'onlyfans.com' },
  { label: 'FANSLY', domain: 'fansly.com' },
  { label: 'MANYVIDS', domain: 'manyvids.com' },
  { label: 'FANVUE', domain: 'fanvue.com' },
  { label: 'JUSTFORFANS', domain: 'justfor.fans' },
  { label: 'LOYALFANS', domain: 'loyalfans.com' },
  { label: 'FANCENTRO', domain: 'fancentro.com' },
  { label: 'FANHOUSE', domain: 'fanhouse.app' },
  { label: 'ADMIREME', domain: 'admireme.vip' },
  { label: 'AVNSTARS', domain: 'avnstars.com' },
  { label: 'CLIPS4SALE', domain: 'clips4sale.com' },
];


function detectContentCreator(rawLinks: unknown): ContentCreatorDetection {
  const links = Array.isArray(rawLinks) ? rawLinks : [];
  const creatorLinkTypes = new Set<string>();

  for (const link of links) {
    if (!link || typeof link !== 'object') {
      continue;
    }
    const entry = link as { type?: unknown; outboundUrl?: unknown };
    const type = typeof entry.type === 'string' ? entry.type.toUpperCase() : '';
    if (CREATOR_SOCIAL_LINK_TYPES.has(type)) {
      creatorLinkTypes.add(type);
    }
    const url = typeof entry.outboundUrl === 'string' ? entry.outboundUrl.toLowerCase() : '';
    if (url) {
      for (const { label, domain } of CREATOR_LINK_DOMAINS) {
        if (url.includes(domain)) {
          creatorLinkTypes.add(label);
        }
      }
    }
  }

  return {
    socialLinkCount: links.length,
    isContentCreator: creatorLinkTypes.size > 0,
    creatorLinkTypes: Array.from(creatorLinkTypes),
  };
}

function normalizeSubredditKarmaValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as {
    total?: unknown;
    karma?: unknown;
    totalKarma?: unknown;
    fromComments?: unknown;
    fromPosts?: unknown;
    commentKarma?: unknown;
    postKarma?: unknown;
    linkKarma?: unknown;
  };

  const directTotal = normalizeOptionalWholeNumber(parsed.total ?? parsed.karma ?? parsed.totalKarma);
  if (directTotal !== null) {
    return directTotal;
  }

  const commentKarma = normalizeOptionalWholeNumber(parsed.commentKarma ?? parsed.fromComments);
  const postKarma = normalizeOptionalWholeNumber(parsed.postKarma ?? parsed.linkKarma ?? parsed.fromPosts);
  if (commentKarma === null && postKarma === null) {
    return null;
  }

  return (commentKarma ?? 0) + (postKarma ?? 0);
}


async function withSingleRetry<T>(label: string, fallbackValue: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!looksLikeTransientRedditTransportError(errorText(error))) {
      console.log(`${label} failed on first attempt: ${errorText(error)}`);
    }
  }

  try {
    return await fn();
  } catch (error) {
    console.log(`${label} failed on retry: ${errorText(error)}`);
    return fallbackValue;
  }
}

async function lookupCurrentSubredditBanStatus(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditName: string,
  username: string
): Promise<PendingAccountDetailsSnapshot['banStatus']> {
  const redditClient = context.reddit as Devvit.Context['reddit'] & {
    getBannedUsers?: (options: {
      subredditName?: string;
      username?: string;
      limit?: number;
      pageSize?: number;
    }) => { all: () => Promise<unknown[]> };
  };
  const normalizedUsername = normalizeUsernameStrict(username);
  if (typeof redditClient.getBannedUsers !== 'function' || !normalizedUsername) {
    return 'unknown';
  }
  const bannedUsers = await redditClient
    .getBannedUsers({
      subredditName: sanitizeSubredditName(subredditName),
      username: normalizedUsername,
      limit: 1,
      pageSize: 1,
    })
    .all();
  return bannedUsers.length > 0 ? 'banned' : 'not_banned';
}

async function collectPendingAccountDetailsSnapshot(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  username: string,
  capturedAt: string
): Promise<PendingAccountDetailsSnapshot> {
  const normalizedUsername = normalizeUsernameStrict(username);
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);

  const emptyUserSnapshot = {
    accountCreatedAt: null as string | null,
    totalKarma: null as number | null,
    subredditKarma: null as number | null,
    hasVerifiedEmail: null as boolean | null,
    hasRedditPremium: null as boolean | null,
    socialLinkCount: 0,
    isContentCreator: false,
    creatorLinkTypes: [] as string[],
  };

  const userSnapshotTask = withSingleRetry(
    `Pending account details user snapshot lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}`,
    emptyUserSnapshot,
    async () => {
      if (!normalizedUsername) {
        return emptyUserSnapshot;
      }
      const user = await context.reddit.getUserByUsername(normalizedUsername);
      if (!user) {
        return emptyUserSnapshot;
      }
      const userWithExtras = user as typeof user & {
        getUserKarmaFromCurrentSubreddit?: () => Promise<unknown>;
        getSocialLinks?: () => Promise<unknown>;
        hasVerifiedEmail?: unknown;
        hasRedditPremium?: unknown;
      };
      const rawKarma =
        typeof userWithExtras.getUserKarmaFromCurrentSubreddit === 'function'
          ? await userWithExtras.getUserKarmaFromCurrentSubreddit()
          : null;
      let creatorDetection: ContentCreatorDetection = {
        socialLinkCount: 0,
        isContentCreator: false,
        creatorLinkTypes: [],
      };
      if (typeof userWithExtras.getSocialLinks === 'function') {
        try {
          creatorDetection = detectContentCreator(await userWithExtras.getSocialLinks());
        } catch (error) {
          console.log(
            `Pending account details social link lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errorText(error)}`
          );
        }
      }
      return {
        accountCreatedAt: normalizeOptionalIsoTimestamp(user.createdAt),
        totalKarma: normalizeSubredditKarmaValue(user),
        subredditKarma: normalizeSubredditKarmaValue(rawKarma),
        hasVerifiedEmail: normalizeOptionalBoolean(userWithExtras.hasVerifiedEmail),
        hasRedditPremium: normalizeOptionalBoolean(userWithExtras.hasRedditPremium),
        socialLinkCount: creatorDetection.socialLinkCount,
        isContentCreator: creatorDetection.isContentCreator,
        creatorLinkTypes: creatorDetection.creatorLinkTypes,
      };
    }
  );

  const banStatusTask = withSingleRetry(
    `Pending account details ban lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}`,
    'unknown' as const,
    async () => await lookupCurrentSubredditBanStatus(context, sanitizedSubreddit, username)
  );

  const [userSnapshot, banStatus, previousDeniedAttempts] = await Promise.all([
    userSnapshotTask,
    banStatusTask,
    getStoredDenialCount(context, subredditId, username),
  ]);

  return {
    capturedAt,
    accountCreatedAt: userSnapshot.accountCreatedAt,
    totalKarma: userSnapshot.totalKarma,
    subredditKarma: userSnapshot.subredditKarma,
    previousDeniedAttempts,
    banStatus,
    hasVerifiedEmail: userSnapshot.hasVerifiedEmail,
    hasRedditPremium: userSnapshot.hasRedditPremium,
    isShadowBanned: null,
    recentActivityCount: null,
    socialLinkCount: userSnapshot.socialLinkCount,
    isContentCreator: userSnapshot.isContentCreator,
    creatorLinkTypes: userSnapshot.creatorLinkTypes,
  };
}

async function submitVerification(
  values: SubmitVerificationValues,
  context: Devvit.Context
): Promise<SubmitVerificationResult> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be logged in to submit.');
  }

  if (!values.is18Confirmed) {
    throw new Error('Submission failed. You must confirm that you are at least 18 years old.');
  }
  if (!values.adultOnlySelfPhotosConfirmed) {
    throw new Error(
      'Submission failed. You must confirm that the uploaded photos are of you and do not depict anyone under the age of 18.'
    );
  }
  if (!values.termsAccepted) {
    throw new Error('Submission failed. You must read and accept the Terms and Conditions of the VouchX app.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  const config = await getRuntimeConfig(context, subredditId);
  if (!config.verificationsEnabled) {
    throw new Error(config.verificationsDisabledMessage);
  }
  const globalBlockedUsernames = await readMergedGlobalUsernameSettings(context, GLOBAL_BLOCKED_USERNAME_SETTING_NAMES);
  if (createGlobalBlockedUserEntry(globalBlockedUsernames, username)) {
    throw new Error(BLOCKED_SUBMISSION_MESSAGE);
  }

  const rawPhotoOneUrl = normalizePhotoInput((values as { photoOneUrl?: unknown }).photoOneUrl);
  const rawPhotoTwoUrl = normalizePhotoInput((values as { photoTwoUrl?: unknown }).photoTwoUrl);
  const rawPhotoThreeUrl = normalizePhotoInput((values as { photoThreeUrl?: unknown }).photoThreeUrl);
  const photoOneUrl = normalizeSubmittedPhotoUrl(rawPhotoOneUrl);
  const photoTwoUrl = normalizeSubmittedPhotoUrl(rawPhotoTwoUrl);
  const photoThreeUrl = normalizeSubmittedPhotoUrl(rawPhotoThreeUrl);
  const requiredPhotoCount = parseRequiredPhotoCount(config.requiredPhotoCount, DEFAULT_REQUIRED_PHOTO_COUNT);

  const invalidPhotoProvided = [
    [rawPhotoOneUrl, photoOneUrl],
    [rawPhotoTwoUrl, photoTwoUrl],
    [rawPhotoThreeUrl, photoThreeUrl],
  ].some(([rawPhotoUrl, normalizedPhotoUrl]) => Boolean(rawPhotoUrl) && !normalizedPhotoUrl);
  if (invalidPhotoProvided) {
    throw new Error('Submission failed. Upload photos using Reddit-hosted media URLs.');
  }

  const requiredPhotos = [photoOneUrl];
  if (requiredPhotoCount >= 2) {
    requiredPhotos.push(photoTwoUrl);
  }
  if (requiredPhotoCount >= 3) {
    requiredPhotos.push(photoThreeUrl);
  }

  if (requiredPhotos.some((photo) => !photo)) {
    throw new Error(
      `${requiredPhotoCount} photo${requiredPhotoCount === 1 ? '' : 's'} ${
        requiredPhotoCount === 1 ? 'is' : 'are'
      } required.`
    );
  }

  const blocked = await repairMissingAutoBlockForUser(context, subredditId, username, config);
  if (blocked) {
    throw new Error(BLOCKED_SUBMISSION_MESSAGE);
  }

  const normalizedUsername = normalizeUsername(username);
  const priorLatestRecord = await getLatestRecordForUser(context, subredditId, normalizedUsername);
  const isResubmission = Boolean(priorLatestRecord && priorLatestRecord.status !== 'pending');
  const userId = context.userId;
  const now = new Date();
  await removeAllVerificationRecordsForUser(context, subredditId, normalizedUsername);

  const verificationId = makeVerificationId(now);
  const acknowledgedAt = now.toISOString();
  const accountDetails = await collectPendingAccountDetailsSnapshot(
    context,
    subredditId,
    subredditName,
    username,
    acknowledgedAt
  );

  const record: VerificationRecord = {
    id: verificationId,
    username,
    userId: userId ?? '',
    subredditId,
    subredditName,
    ageAcknowledgedAt: acknowledgedAt,
    submittedAt: acknowledgedAt,
    photoOneUrl: photoOneUrl ?? '',
    photoTwoUrl: photoTwoUrl ?? '',
    photoThreeUrl: photoThreeUrl ?? '',
    status: 'pending',
    moderator: null,
    reviewedAt: null,
    denyReason: null,
    denyNotes: null,
    claimedBy: null,
    claimedAt: null,
    parentVerificationId: null,
    isResubmission,
    accountDetails,
    removedAt: null,
    removedBy: null,
    lastValidatedAt: null,
    nextValidationAt: null,
    hardExpireAt: null,
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
    lastTtlBumpAt: null,
    lastFlairReconcileAt: null,
  };

  await setRecord(context, subredditId, record);
  await context.redis.zAdd(pendingIndexKey(subredditId), { member: verificationId, score: now.getTime() });
  await context.redis.zAdd(historyDateIndexKey(subredditId), {
    member: verificationId,
    score: now.getTime(),
  });
  await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizedUsername), {
    member: verificationId,
    score: now.getTime(),
  });
  await setUserPendingPointer(context, subredditId, normalizedUsername, userId, verificationId);
  await setUserLatestPointer(context, subredditId, normalizedUsername, userId, verificationId);

  await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);
  const pendingModmail = await sendPendingSubmissionModmail(context, record, config);
  await enrichPendingAccountDetailsFromModmail(context, subredditId, verificationId, pendingModmail.userData);

  if (config.autoDenyShadowbannedEnabled && pendingModmail.userData?.isShadowBanned === true) {
    try {
      const autoDenyResult = await autoDenyShadowbannedSubmission(
        context,
        subredditId,
        subredditName,
        verificationId,
        config
      );
      if (autoDenyResult) {
        // Auto-denied: skip the pending-submission mod note so it does not contradict the denial.
        return { pendingModmail };
      }
    } catch (error) {
      console.log(
        `Auto-deny of shadowbanned submission failed for ${verificationId}: ${errorText(error)}`
      );
    }
  }

  try {
    await addPendingSubmissionModNote(context, record);
  } catch (error) {
    console.log(
      `Pending submission mod note write failed for r/${sanitizeSubredditName(subredditName)} u/${maskUsernameForLog(username)}: ${errorText(error)}`
    );
  }
  return { pendingModmail };
}

// Folds modmail-only signals (shadowban, recent activity) into the pending snapshot after the
// submission modmail is sent. Guarded: re-reads the record and writes only if it is still pending,
// so a concurrent withdrawal/removal cannot be resurrected by this enrichment write.
async function enrichPendingAccountDetailsFromModmail(
  context: Devvit.Context,
  subredditId: string,
  verificationId: string,
  userData: ModmailUserSignals | undefined
): Promise<void> {
  if (!userData || (userData.isShadowBanned === null && userData.recentActivityCount === null)) {
    return;
  }
  try {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record || record.status !== 'pending' || !record.accountDetails) {
      return;
    }
    const updatedRecord: VerificationRecord = {
      ...record,
      accountDetails: {
        ...record.accountDetails,
        isShadowBanned: userData.isShadowBanned ?? record.accountDetails.isShadowBanned,
        recentActivityCount: userData.recentActivityCount ?? record.accountDetails.recentActivityCount,
      },
    };
    await setRecord(context, subredditId, updatedRecord);
  } catch (error) {
    console.log(`Pending account details modmail enrichment failed for ${verificationId}: ${errorText(error)}`);
  }
}

async function onModeratorPurgeUserData(
  event: FormOnSubmitEvent<PurgeUserDataFormValues>,
  context: Devvit.Context
): Promise<void> {
  try {
    const moderator = await context.reddit.getCurrentUsername();
    if (!moderator) {
      throw new Error('You must be logged in as a moderator.');
    }

    const subredditName = await getCurrentSubredditNameCompat(context);
    const subredditId = sanitizeSubredditId(context.subredditId);
    await assertCanReview(context, subredditName, moderator);

    const confirmationText = event.values.confirmationText?.trim().toLowerCase();
    if (confirmationText !== 'confirm') {
      context.ui.showToast('You must type "confirm" to complete purge.');
      return;
    }

    const purgeMinAgeDays = await getModMenuAuditPurgeMinAgeDays(context);
    const deletedAuditCount = await purgeAuditLogOlderThanDays(context, subredditId, purgeMinAgeDays);

    const emptyStateDescription =
      purgeMinAgeDays <= 0 ? 'No audit log entries found' : `No audit log entries older than ${purgeMinAgeDays} days found`;
    const auditPurgeNotes =
      deletedAuditCount > 0
        ? purgeMinAgeDays <= 0
          ? `Purged ${deletedAuditCount} audit log entr${deletedAuditCount === 1 ? 'y' : 'ies'} for r/${subredditName}.`
          : `Purged ${deletedAuditCount} audit log entr${deletedAuditCount === 1 ? 'y' : 'ies'} older than ${purgeMinAgeDays} days for r/${subredditName}.`
        : `${emptyStateDescription} for r/${subredditName}.`;

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName,
        username: moderator,
        actor: moderator,
        action: 'audit_purged',
        notes: auditPurgeNotes,
      });
    } catch (error) {
      console.log(`Audit log write failed (audit_purged): ${errorText(error)}`);
    }

    context.ui.showToast({
      text: auditPurgeNotes,
      appearance: 'success',
    });
  } catch (error) {
    context.ui.showToast(`Failed to purge audit log: ${errorText(error)}`);
  }
}

async function withdrawCurrentUserPendingVerification(context: Devvit.Context): Promise<void> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be logged in to withdraw a pending request.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const normalizedUsername = normalizeUsername(username);
  const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
  if (!pendingId) {
    throw new Error('No pending verification request found.');
  }

  const record = await getRecord(context, subredditId, pendingId);
  if (!record || !usernamesEqual(record.username, normalizedUsername) || record.status !== 'pending') {
    await deleteUserPendingPointers(context, subredditId, normalizedUsername, context.userId);
    throw new Error('No pending verification request found.');
  }

  const withdrawnAt = new Date(Date.now()).toISOString();
  const currentSubredditName = await getCurrentSubredditNameCompat(context);

  await purgeUserVerificationData(
    context,
    subredditId,
    currentSubredditName || sanitizeSubredditName(record.subredditName),
    record.username,
    {
      removeFlair: true,
      removeAuditEntries: true,
      clearModerationRecords: false,
    }
  );

  try {
    await addPendingWithdrawalModNote(context, record, withdrawnAt);
  } catch (error) {
    console.log(
      `Pending withdrawal mod note write failed for r/${sanitizeSubredditName(record.subredditName)} u/${maskUsernameForLog(record.username)}: ${errorText(error)}`
    );
  }
}

async function deleteCurrentUserVerificationData(context: Devvit.Context): Promise<DeleteDataResult> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    throw new Error('You must be logged in to delete your data.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditHint = await getCurrentSubredditNameCompat(context);
  const result = await purgeUserVerificationData(context, subredditId, subredditHint, username, {
    removeFlair: true,
    removeAuditEntries: true,
    clearModerationRecords: false,
  });

  if (result.deletedCount > 0 || result.flairRemovedFrom.includes(subredditHint)) {
    try {
      await addSelfRemovalModNote(context, subredditHint, username);
    } catch (error) {
      console.log(
        `Self-removal mod note write failed for r/${subredditHint} u/${maskUsernameForLog(username)}: ${errorText(error)}`
      );
    }
  }

  await suppressViewerVerifiedStateAfterSelfRemoval(context, subredditId, username);

  return {
    deletedCount: result.deletedCount,
    flairRemovedFrom: result.flairRemovedFrom,
    flairRemovalFailedFor: result.flairRemovalFailedFor,
  };
}

async function suppressViewerVerifiedStateAfterSelfRemoval(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  username: string
): Promise<void> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedSubredditId || !normalizedUsername) {
    return;
  }

  try {
    await context.redis.set(
      recentViewerFlairRemovalSuppressionKey(normalizedSubredditId, normalizedUsername),
      '1',
      {
        expiration: new Date(Date.now() + VIEWER_FLAIR_REMOVAL_SUPPRESSION_TTL_MS),
      }
    );
  } catch {
    // Best-effort suppression only.
  }
}

async function shouldSuppressViewerVerifiedState(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  username: string,
  userLatest: VerificationRecord | null
): Promise<boolean> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedSubredditId || !normalizedUsername || userLatest?.status === 'approved') {
    return false;
  }

  try {
    return Boolean(
      await context.redis.get(recentViewerFlairRemovalSuppressionKey(normalizedSubredditId, normalizedUsername))
    );
  } catch {
    return false;
  }
}

async function purgeUserVerificationData(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string,
  username: string,
  options: {
    removeFlair: boolean;
    removeAuditEntries: boolean;
    clearModerationRecords: boolean;
  }
): Promise<PurgeUserDataResult> {
  const normalizedUsername = normalizeUsernameKey(username);
  if (!normalizedUsername) {
    throw new Error('A valid username is required.');
  }

  const candidateRecordIds = new Set<string>();
  const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
  const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
  if (pendingId) {
    candidateRecordIds.add(pendingId);
  }
  if (latestId) {
    candidateRecordIds.add(latestId);
  }

  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
  });
  for (const entry of historyEntries) {
    candidateRecordIds.add(entry.member);
  }
  const fallbackIndexRecordIds = await findRecordIdsForUserFromModerationIndexes(context, subredditId, normalizedUsername);
  for (const recordId of fallbackIndexRecordIds) {
    candidateRecordIds.add(recordId);
  }

  const candidateIds = Array.from(candidateRecordIds);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const recordsToDelete: string[] = [];
  const recordsById = new Map<string, VerificationRecord>();
  const userIdsToClear = new Set<string>();
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || !usernamesEqual(parsed.username, normalizedUsername)) {
      continue;
    }
    recordsToDelete.push(recordId);
    recordsById.set(recordId, parsed);
    if (getRecordUserId(parsed)) {
      userIdsToClear.add(getRecordUserId(parsed));
    }
  }

  if (recordsToDelete.length > 0) {
    await context.redis.zRem(pendingIndexKey(subredditId), recordsToDelete);
    await context.redis.zRem(approvedIndexKey(subredditId), recordsToDelete);
    await removeApprovedPrefixIndexEntries(
      context,
      subredditId,
      recordsToDelete
        .map((recordId) => {
          const record = recordsById.get(recordId);
          if (!record || record.status !== 'approved') {
            return null;
          }
          return { recordId, username: record.username };
        })
        .filter((entry): entry is { recordId: string; username: string } => entry !== null)
    );
    await context.redis.zRem(historyDateIndexKey(subredditId), recordsToDelete);
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), recordsToDelete);
    await removeValidationTrackingForRecordIds(context, subredditId, recordsToDelete);
    for (const recordId of recordsToDelete) {
      const record = recordsById.get(recordId);
      if (record?.moderator) {
        await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizeUsername(record.moderator)), [recordId]);
      }
    }
    await context.redis.del(...recordsToDelete.map((recordId) => verificationRecordKey(subredditId, recordId)));
  }

  const reopenMetaKeysToDelete = new Set<string>();
  for (const record of recordsById.values()) {
    reopenMetaKeysToDelete.add(reopenedAuditByReopenedKey(subredditId, record.id));
    if (record.status === 'denied') {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, record.id));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, record.id));
    }
    if (record.parentVerificationId?.trim()) {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, record.parentVerificationId.trim()));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, record.parentVerificationId.trim()));
    }
  }
  if (reopenMetaKeysToDelete.size > 0) {
    await context.redis.del(...Array.from(reopenMetaKeysToDelete));
  }

  await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
  await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
  for (const userId of userIdsToClear) {
    await context.redis.del(userPendingKeyById(subredditId, userId), userLatestKeyById(subredditId, userId));
  }
  await context.redis.del(modmailThreadByUserEntryKey(subredditId, normalizedUsername));

  const legacyUserKeys = Array.from(new Set([normalizedUsername, `u/${normalizedUsername}`]));
  const removedBlockCount = options.clearModerationRecords
    ? await context.redis.hDel(blockedUsersKey(subredditId), legacyUserKeys)
    : 0;
  const removedDenialCount = options.clearModerationRecords
    ? await context.redis.hDel(denialCountKey(subredditId), legacyUserKeys)
    : 0;

  let purgedAuditCount = 0;
  if (options.removeAuditEntries) {
    const auditMembers = await context.redis.zRange(auditDateIndexKey(subredditId), 0, -1, { by: 'rank' });
    if (auditMembers.length > 0) {
      const auditIds = auditMembers.map((entry) => entry.member);
      const auditPayloads = await mGetStringValuesInChunks(
        context,
        auditIds.map((auditId) => auditEntryKey(subredditId, auditId))
      );
      const staleAuditIds = new Set<string>();
      const auditIdsToDelete = new Set<string>();
      const recordIdSet = new Set(recordsToDelete);

      for (let index = 0; index < auditPayloads.length; index++) {
        const payload = auditPayloads[index];
        const auditId = auditIds[index];
        if (!payload) {
          staleAuditIds.add(auditId);
          continue;
        }
        const parsed = parseAuditEntry(payload);
        if (!parsed) {
          staleAuditIds.add(auditId);
          continue;
        }
        if (
          usernamesEqual(parsed.username, normalizedUsername) ||
          usernamesEqual(parsed.actor, normalizedUsername) ||
          (parsed.verificationId ? recordIdSet.has(parsed.verificationId) : false)
        ) {
          auditIdsToDelete.add(auditId);
        }
      }

      const staleIds = Array.from(staleAuditIds);
      if (staleIds.length > 0) {
        await context.redis.zRem(auditDateIndexKey(subredditId), staleIds);
      }

      const deleteIds = Array.from(auditIdsToDelete);
      if (deleteIds.length > 0) {
        await context.redis.zRem(auditDateIndexKey(subredditId), deleteIds);
        await context.redis.del(...deleteIds.map((auditId) => auditEntryKey(subredditId, auditId)));
        purgedAuditCount = deleteIds.length;
      }
    }
  }

  const flairRemovedFrom: string[] = [];
  const flairRemovalFailedFor: string[] = [];
  if (options.removeFlair) {
    const removed = await removeUserFlairWithFallbacks(context, subredditName, username);
    if (removed) {
      flairRemovedFrom.push(subredditName);
    } else {
      flairRemovalFailedFor.push(subredditName);
    }
  }

  return {
    deletedCount: recordsToDelete.length,
    flairRemovedFrom,
    flairRemovalFailedFor,
    purgedAuditCount,
    removedBlockCount,
    removedDenialCount,
    touchedSubreddits: [subredditName],
  };
}

async function findRecordIdsForUserFromModerationIndexes(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<string[]> {
  const candidateIds = new Set<string>();
  const indexTargets: Array<{ key: string; reverse: boolean }> = [
    { key: pendingIndexKey(subredditId), reverse: true },
    { key: approvedIndexKey(subredditId), reverse: true },
  ];

  for (const target of indexTargets) {
    const members = await context.redis.zRange(target.key, 0, SELF_DELETE_INDEX_SCAN_LIMIT - 1, {
      by: 'rank',
      reverse: target.reverse,
    });
    if (members.length === 0) {
      continue;
    }
    for (const member of members) {
      candidateIds.add(member.member);
    }
  }

  const ids = Array.from(candidateIds);
  if (ids.length === 0) {
    return [];
  }

  const payloads = await mGetStringValuesInChunks(
    context,
    ids.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const matches: string[] = [];
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed) {
      continue;
    }
    if (usernamesEqual(parsed.username, normalizedUsername)) {
      matches.push(ids[index]);
    }
  }

  return matches;
}

async function removeUserFlairWithFallbacks(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditName: string,
  username: string
): Promise<boolean> {
  const rawSubreddit = subredditName.trim();
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const subredditAttempts = Array.from(
    new Set(
      [sanitizedSubreddit, rawSubreddit, rawSubreddit.replace(/^\/?r\//i, '')].map((value) => value.trim()).filter(Boolean)
    )
  );
  const rawUsername = username.trim();
  const rawUsernameNoPrefix = rawUsername.replace(/^u\//i, '');
  const normalizedUsername = normalizeUsername(username).replace(/^u\//i, '');
  const strictUsername = normalizeUsernameStrict(username);
  const usernameAttempts = Array.from(
    new Set([
      rawUsernameNoPrefix,
      rawUsername,
      normalizedUsername,
      strictUsername,
      `u/${rawUsernameNoPrefix}`,
      normalizedUsername ? `u/${normalizedUsername}` : '',
      strictUsername ? `u/${strictUsername}` : '',
    ])
  ).filter((value) => value.trim());
  const errors: string[] = [];
  const verificationUsername = strictUsername || normalizedUsername || rawUsernameNoPrefix;

  for (const subredditAttempt of subredditAttempts) {
    for (const usernameAttempt of usernameAttempts) {
      try {
        await context.reddit.removeUserFlair(subredditAttempt, usernameAttempt);
        if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
          return true;
        }
      } catch (removeError) {
        try {
          await context.reddit.setUserFlair({
            subredditName: subredditAttempt,
            username: usernameAttempt,
            flairTemplateId: '',
            text: '',
            cssClass: '',
          });
          if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
            return true;
          }
        } catch (setError) {
          try {
            await context.reddit.setUserFlairBatch(subredditAttempt, [{ username: usernameAttempt, text: '', cssClass: '' }]);
            if (await isUserFlairCleared(context, subredditAttempt, verificationUsername)) {
              return true;
            }
          } catch (batchError) {
            errors.push(
              `${subredditAttempt}/${usernameAttempt}: remove=${errorText(removeError)} set=${errorText(setError)} batch=${errorText(batchError)}`
            );
          }
        }
      }
    }
  }

  console.log(`Flair removal failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errors.join(' | ')}`);
  return false;
}

async function isUserFlairCleared(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditName: string,
  username: string
): Promise<boolean> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!sanitizedSubreddit || !normalizedUsername) {
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const user = await context.reddit.getUserByUsername(normalizedUsername);
      if (!user) {
        return false;
      }
      const flair = await user.getUserFlairBySubreddit(sanitizedSubreddit);
      if (!flair) {
        return true;
      }
      const flairTemplateId = normalizeTemplateId(extractTemplateId(flair));
      const flairText = String(flair.flairText ?? '').trim();
      const flairCssClass = String(flair.flairCssClass ?? '').trim();
      if (!flairTemplateId && !flairText && !flairCssClass) {
        return true;
      }
    } catch (error) {
      console.log(
        `Flair removal verification failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errorText(error)}`
      );
      return false;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return false;
}










async function preflightReviewTargetAccount(
  context: Pick<Devvit.Context, 'reddit'>,
  record: VerificationRecord
): Promise<ValidationCheckResult> {
  return await validateVerificationUserState(context, record);
}

function buildValidationRetryActionResult(reason: string): ActionResult {
  return {
    outcome: 'validation_retry',
    applied: false,
    outcomeReason: reason,
    flair: { status: 'skipped', reason: 'User validation could not be confirmed.' },
    modmail: { status: 'skipped', reason: 'User validation could not be confirmed.' },
    modNote: { status: 'skipped', reason: 'User validation could not be confirmed.' },
  };
}

function buildBannedApprovalConfirmationActionResult(username: string): ActionResult {
  return {
    outcome: 'banned_confirmation_required',
    applied: false,
    username,
    flair: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
    modmail: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
    modNote: { status: 'skipped', reason: 'Approval confirmation required before unbanning.' },
  };
}

async function removeReviewTargetForInvalidAccount(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  moderator: string,
  actionKind: ReviewActionKind,
  validationReason: string
): Promise<ActionResult> {
  const now = new Date().toISOString();
  const normalizedUsername = normalizeUsername(record.username);
  const updatedRecord: VerificationRecord = {
    ...record,
    status: 'removed',
    moderator,
    reviewedAt: now,
    claimedBy: null,
    claimedAt: null,
    removedAt: now,
    removedBy: moderator,
    lastValidatedAt: null,
    nextValidationAt: null,
    hardExpireAt: null,
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
    lastFlairReconcileAt: null,
  };

  await setRecord(context, subredditId, updatedRecord);
  const historyAnchorMs = getHistoryRecordAnchorMs(updatedRecord);
  await context.redis.zRem(pendingIndexKey(subredditId), [record.id]);
  await context.redis.zRem(approvedIndexKey(subredditId), [record.id]);
  await removeApprovedPrefixIndexEntry(context, subredditId, record.id, record.username);
  await context.redis.zAdd(historyDateIndexKey(subredditId), {
    member: record.id,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizedUsername), {
    member: record.id,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
    member: record.id,
    score: historyAnchorMs,
  });
  await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);

  await clearUserPendingPointersIfMatch(context, subredditId, normalizedUsername, record.userId, record.id);
  await setUserLatestPointer(context, subredditId, normalizedUsername, record.userId, record.id);

  const cleanupKeys = new Set<string>([reopenedAuditByReopenedKey(subredditId, record.id)]);
  const parentVerificationId = record.parentVerificationId?.trim() ?? '';
  if (parentVerificationId) {
    cleanupKeys.add(reopenedChildByDeniedKey(subredditId, parentVerificationId));
    cleanupKeys.add(reopenedStateByDeniedKey(subredditId, parentVerificationId));
  }
  const modmailThreadKeys = Array.from(
    new Set(usernameLookupFields(record.username).map((field) => modmailThreadByUserEntryKey(subredditId, field)))
  );
  modmailThreadKeys.forEach((key) => cleanupKeys.add(key));
  if (cleanupKeys.size > 0) {
    await context.redis.del(...Array.from(cleanupKeys));
  }

  try {
    const reviewLabel = actionKind === 'approval' ? 'approval' : 'denial';
    await appendAuditLog(context, {
      subredditId,
      subredditName: sanitizeSubredditName(record.subredditName),
      username: record.username,
      actor: moderator,
      action: 'removed_by_mod',
      verificationId: record.id,
      notes: `Skipped ${reviewLabel} because the user account no longer exists or is suspended (${validationReason}). No review side effects were sent.`,
    });
  } catch (error) {
    console.log(`Audit log write failed (invalid-account cleanup): ${errorText(error)}`);
  }

  return {
    outcome: 'invalid_account_removed',
    applied: false,
    outcomeReason: validationReason,
    flair: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
    modmail: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
    modNote: { status: 'skipped', reason: 'User no longer exists or is suspended.' },
  };
}

async function approveVerification(
  context: Devvit.Context,
  verificationId: string,
  confirmBannedApproval = false,
  selectedFlairTemplateId?: string
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'approved') {
      return {
        outcome: 'completed',
        applied: false,
        flair: { status: 'skipped', reason: 'already approved' },
        modmail: { status: 'skipped', reason: 'already approved' },
        modNote: { status: 'skipped', reason: 'already approved' },
      };
    }

    if (record.status !== 'pending') {
      throw new Error('Verification is no longer pending.');
    }
    assertClaimAllowsAction(record, moderator);
    const parentDeniedId = record.parentVerificationId?.trim() ?? '';

    const validation = await preflightReviewTargetAccount(context, record);
    if (validation.outcome === 'deleted_or_suspended') {
      return await removeReviewTargetForInvalidAccount(
        context,
        subredditId,
        record,
        moderator,
        'approval',
        validation.reason
      );
    }
    if (validation.outcome === 'retry') {
      return buildValidationRetryActionResult(validation.reason);
    }

    let banStatus: PendingAccountDetailsSnapshot['banStatus'];
    try {
      banStatus = await lookupCurrentSubredditBanStatus(context, subredditName, record.username);
    } catch (error) {
      return buildValidationRetryActionResult(`User ban status could not be confirmed. ${errorText(error)}`);
    }
    if (banStatus === 'unknown') {
      return buildValidationRetryActionResult('User ban status could not be confirmed.');
    }
    if (banStatus === 'banned') {
      if (!confirmBannedApproval) {
        return buildBannedApprovalConfirmationActionResult(record.username);
      }
      const normalizedUsername = normalizeUsernameStrict(record.username);
      const redditClient = context.reddit as Devvit.Context['reddit'] & {
        unbanUser?: (username: string, subredditName: string) => Promise<void>;
      };
      if (!normalizedUsername || typeof redditClient.unbanUser !== 'function') {
        throw new Error('Unable to unban the user before approval.');
      }
      try {
        await redditClient.unbanUser(normalizedUsername, sanitizeSubredditName(record.subredditName));
      } catch (error) {
        throw new Error(`Unable to unban u/${normalizedUsername}. ${errorText(error)}`);
      }
    }

    const config = await getRuntimeConfig(context, subredditId);
    const configuredTemplateIds = configuredApprovalTemplateIds(config);
    const selectedTemplateId = normalizeTemplateId(selectedFlairTemplateId ?? '');
    const templateIdForApproval =
      config.multipleApprovalFlairsEnabled && selectedTemplateId && configuredTemplateIds.includes(selectedTemplateId)
        ? selectedTemplateId
        : normalizeTemplateId(config.flairTemplateId);
    const flairResult = await applyApprovalFlairWithFallbacks(context, record, config, templateIdForApproval);
    const flair: FlairStepResult = flairResult.applied
      ? { status: 'success' }
      : { status: 'failed', reason: flairResult.error ?? 'unknown error' };
    if (!flairResult.applied) {
      if (looksLikeDeletedOrSuspendedError((flairResult.error ?? '').toLowerCase())) {
        return await removeReviewTargetForInvalidAccount(
          context,
          subredditId,
          record,
          moderator,
          'approval',
          flairResult.error ?? 'user no longer exists or is suspended'
        );
      }
      return {
        outcome: 'completed',
        applied: false,
        flair,
        modmail: { status: 'skipped', reason: 'flair not applied' },
        modNote: { status: 'skipped', reason: 'flair not applied' },
      };
    }

    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'approved',
      moderator,
      reviewedAt: new Date().toISOString(),
      denyReason: null,
      denyNotes: null,
      claimedBy: null,
      claimedAt: null,
      parentVerificationId: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: new Date().toISOString(),
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastTtlBumpAt: Date.now(),
      lastAppliedFlairTemplateId: normalizeTemplateId(flairResult.appliedTemplateId ?? templateIdForApproval),
      lastFlairReconcileAt: null,
    };
    const validationScheduledRecord = applyValidationSchedule(reviewedRecord, Date.now());

    await setRecord(context, subredditId, validationScheduledRecord);
    await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
    const approvedAtMs = new Date(reviewedRecord.reviewedAt ?? reviewedRecord.submittedAt).getTime() || Date.now();
    const historyAnchorMs = getHistoryRecordAnchorMs(validationScheduledRecord, approvedAtMs);
    await context.redis.zAdd(approvedIndexKey(subredditId), {
      member: verificationId,
      score: approvedAtMs,
    });
    await addApprovedPrefixIndexEntry(context, subredditId, verificationId, validationScheduledRecord.username, approvedAtMs);
    await context.redis.zAdd(historyDateIndexKey(subredditId), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(record.username)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await deleteUserPendingPointers(context, subredditId, record.username, record.userId);
    await setUserLatestPointer(context, subredditId, record.username, record.userId, verificationId);
    await upsertValidationTracking(context, subredditId, validationScheduledRecord);
    if (parentDeniedId) {
      await removeSupersededDeniedRecord(context, subredditId, parentDeniedId, record.username);
      try {
        await unblockUserForModerator(context, subredditId, subredditName, record.username, moderator);
      } catch (error) {
        console.log(`Auto-unblock on reopened approval failed: ${errorText(error)}`);
      }
    }

    await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);

    const [modmail, modNote] = await Promise.all([
      sendApprovalModmail(context, subredditId, validationScheduledRecord),
      (async (): Promise<ModNoteStepResult> => {
        try {
          await addApprovalModNote(context, validationScheduledRecord, moderator);
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', reason: errorText(error) };
        }
      })(),
    ]);

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(validationScheduledRecord.subredditName),
        username: validationScheduledRecord.username,
        actor: moderator,
        action: 'approved',
        verificationId: validationScheduledRecord.id,
        notes: [
          flair.status === 'success' ? 'Flair applied.' : `Flair failed: ${flair.reason ?? 'unknown error'}`,
          modmail.status === 'failed'
            ? `Modmail failed: ${modmail.reason ?? 'unknown error'}`
            : modmail.status === 'replied'
              ? 'Replied in existing modmail thread.'
              : modmail.status === 'created'
                ? 'Created new modmail thread.'
                : 'Modmail skipped.',
          modNote.status === 'success' ? 'Mod note added.' : `Mod note failed: ${modNote.reason ?? 'unknown error'}`,
        ].join(' '),
      });
    } catch (error) {
      console.log(`Audit log write failed (approved): ${errorText(error)}`);
    }

    return {
      outcome: 'completed',
      applied: true,
      flair,
      modmail,
      modNote,
    };
  });
}

async function removeSupersededDeniedRecord(
  context: RedisContext,
  subredditId: string,
  deniedId: string,
  fallbackUsername: string
): Promise<void> {
  const normalizedDeniedId = deniedId.trim();
  if (!normalizedDeniedId) {
    return;
  }

  const deniedRecord = await getRecord(context, subredditId, normalizedDeniedId);
  const normalizedUsername = normalizeUsername(deniedRecord?.username ?? fallbackUsername);
  const normalizedModerator = normalizeUsername(deniedRecord?.moderator ?? '');

  await context.redis.zRem(pendingIndexKey(subredditId), [normalizedDeniedId]);
  await context.redis.zRem(approvedIndexKey(subredditId), [normalizedDeniedId]);
  await removeApprovedPrefixIndexEntry(context, subredditId, normalizedDeniedId, deniedRecord?.username ?? fallbackUsername);
  await context.redis.zRem(historyDateIndexKey(subredditId), [normalizedDeniedId]);
  if (normalizedUsername) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), [normalizedDeniedId]);
  }
  if (normalizedModerator) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), [normalizedDeniedId]);
  }
  await removeValidationTrackingForRecordIds(context, subredditId, [normalizedDeniedId]);
  await context.redis.del(verificationRecordKey(subredditId, normalizedDeniedId));
  await context.redis.del(reopenedChildByDeniedKey(subredditId, normalizedDeniedId));
  await context.redis.del(reopenedStateByDeniedKey(subredditId, normalizedDeniedId));
}

async function applyApprovalFlairWithFallbacks(
  context: Devvit.Context,
  record: VerificationRecord,
  config: RuntimeConfig,
  preferredTemplateId?: string
): Promise<FlairApplyResult> {
  const rawSubreddit = record.subredditName.trim();
  const sanitizedSubreddit = sanitizeSubredditName(record.subredditName);
  const subredditAttempts = Array.from(
    new Set(
      [sanitizedSubreddit, rawSubreddit, rawSubreddit.replace(/^\/?r\//i, '')].map((value) => value.trim()).filter(Boolean)
    )
  );
  const rawUsername = record.username.trim();
  const rawUsernameNoPrefix = rawUsername.replace(/^u\//i, '');
  const normalizedUsername = normalizeUsername(record.username).replace(/^u\//i, '');
  const strictUsername = normalizeUsernameStrict(record.username);
  const usernameAttempts = Array.from(
    new Set([
      rawUsernameNoPrefix,
      rawUsername,
      normalizedUsername,
      strictUsername,
      `u/${rawUsernameNoPrefix}`,
      normalizedUsername ? `u/${normalizedUsername}` : '',
      strictUsername ? `u/${strictUsername}` : '',
    ])
  ).filter((value) => value.trim());
  const configuredTemplateId = normalizeTemplateId(preferredTemplateId ?? config.flairTemplateId);
  if (!configuredTemplateId) {
    return { applied: false, error: 'Missing flair template ID.' };
  }
  if (!isLikelyFlairTemplateId(configuredTemplateId)) {
    return { applied: false, error: 'Configured flair template ID format is invalid.' };
  }

  const attempts: Array<{ flairTemplateId: string }> = [{ flairTemplateId: configuredTemplateId }];

  let lastError: string | undefined;
  const errorLines: string[] = [];
  for (const subredditAttempt of subredditAttempts) {
    for (const usernameAttempt of usernameAttempts) {
      for (const attempt of attempts) {
        try {
          await context.reddit.setUserFlair({
            subredditName: subredditAttempt,
            username: usernameAttempt,
            flairTemplateId: attempt.flairTemplateId,
          });
          return { applied: true, appliedTemplateId: normalizeTemplateId(attempt.flairTemplateId) };
        } catch (error) {
          lastError = errorText(error);
          errorLines.push(`${subredditAttempt}/${usernameAttempt}/template-only=${lastError}`);
        }
      }
    }
  }

  if (errorLines.length > 0) {
    console.log(
      `Approve flair apply failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(record.username)}: ${errorLines.join(' | ')}`
    );
  }
  return { applied: false, error: lastError };
}

async function denyVerification(
  context: Devvit.Context,
  verificationId: string,
  reason: DenyReason,
  moderatorNotes?: string,
  options?: { blockUser?: boolean }
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const config = await getRuntimeConfig(context, subredditId);
    const configuredReason = getConfiguredDenyReason(config, reason);
    if (!configuredReason?.enabled) {
      throw new Error('Selected denial reason is not enabled for this subreddit.');
    }

    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'denied') {
      return {
        outcome: 'completed',
        applied: false,
        flair: { status: 'skipped', reason: 'not applicable' },
        modmail: { status: 'skipped', reason: 'already denied' },
        modNote: { status: 'skipped', reason: 'already denied' },
      };
    }

    if (record.status !== 'pending') {
      throw new Error('Verification is no longer pending.');
    }
    assertClaimAllowsAction(record, moderator);

    const validation = await preflightReviewTargetAccount(context, record);
    if (validation.outcome === 'deleted_or_suspended') {
      return await removeReviewTargetForInvalidAccount(
        context,
        subredditId,
        record,
        moderator,
        'denial',
        validation.reason
      );
    }
    if (validation.outcome === 'retry') {
      return buildValidationRetryActionResult(validation.reason);
    }

    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'denied',
      moderator,
      reviewedAt: new Date().toISOString(),
      denyReason: reason,
      denyNotes: moderatorNotes ?? null,
      claimedBy: null,
      claimedAt: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };

    const denyReasonLabel = getDenyReasonDisplayLabel(config, reason);
    return await finalizeDeniedVerification(context, subredditId, subredditName, reviewedRecord, config, {
      actor: moderator,
      denyReasonLabel,
      auditReasonNote: denyReasonLabel,
      moderatorNotes,
      blockUser: options?.blockUser,
      sendModmail: () => sendDenialModmail(context, subredditId, reviewedRecord, config),
      addModNote: () => addDenialModNote(context, reviewedRecord, moderator, config),
    });
  });
}

// Shared persistence + side effects for a denial, used by both moderator-initiated denials and
// the automated shadowban auto-deny path. The caller builds `reviewedRecord` (status 'denied',
// moderator/actor, denyReason) and supplies the modmail + mod-note senders; this function performs
// the record write, index updates, denial-count increment, block-at-threshold, and audit logging.
async function finalizeDeniedVerification(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  reviewedRecord: VerificationRecord,
  config: RuntimeConfig,
  params: {
    actor: string;
    denyReasonLabel: string;
    auditReasonNote: string;
    moderatorNotes?: string;
    blockUser?: boolean;
    countTowardBlock?: boolean;
    sendModmail: () => Promise<ModmailStepResult>;
    addModNote: () => Promise<void>;
  }
): Promise<ActionResult> {
  const { actor, denyReasonLabel, auditReasonNote, moderatorNotes } = params;
  // Moderator denials count toward the auto-block threshold; automated denials (e.g. shadowban)
  // deliberately do not, so a Reddit-level shadowban does not silently push a user toward a block.
  const countTowardBlock = params.countTowardBlock !== false;
  const verificationId = reviewedRecord.id;

  await setRecord(context, subredditId, reviewedRecord);
  const historyAnchorMs = getHistoryRecordAnchorMs(reviewedRecord);
  await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
  await context.redis.zRem(approvedIndexKey(subredditId), [verificationId]);
  await removeApprovedPrefixIndexEntry(context, subredditId, verificationId, reviewedRecord.username);
  await context.redis.zAdd(historyDateIndexKey(subredditId), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(reviewedRecord.username)), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(actor)), {
    member: verificationId,
    score: historyAnchorMs,
  });
  await deleteUserPendingPointers(context, subredditId, reviewedRecord.username, reviewedRecord.userId);
  await setUserLatestPointer(context, subredditId, reviewedRecord.username, reviewedRecord.userId, verificationId);
  await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

  await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);

  const [modmail, modNote] = await Promise.all([
    params.sendModmail(),
    (async (): Promise<ModNoteStepResult> => {
      try {
        await params.addModNote();
        return { status: 'success' };
      } catch (error) {
        return { status: 'failed', reason: errorText(error) };
      }
    })(),
  ]);

  const denialCount = countTowardBlock
    ? await incrementDenialCount(context, subredditId, reviewedRecord.username)
    : await getStoredDenialCount(context, subredditId, reviewedRecord.username);
  let userBlocked = false;
  let manualBlockOutcome: ManualBlockOutcome | undefined;
  if (countTowardBlock && config.maxDenialsBeforeBlock > 0 && denialCount >= config.maxDenialsBeforeBlock) {
    const blockedEntry: BlockedUserEntry = {
      username: normalizeUsernameForLookup(reviewedRecord.username),
      blockedAt: new Date().toISOString(),
      deniedCount: denialCount,
      reason: `Reached ${denialCount} denials`,
      scope: 'subreddit',
    };
    const wasAlreadyBlocked = await isUserBlocked(context, subredditId, reviewedRecord.username);
    await setBlockedUser(context, subredditId, blockedEntry);
    userBlocked = true;
    if (!wasAlreadyBlocked) {
      try {
        await appendAuditLog(context, {
          subredditId,
          subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
          username: reviewedRecord.username,
          actor,
          action: 'blocked',
          verificationId: reviewedRecord.id,
          notes: blockedEntry.reason,
        });
      } catch (error) {
        console.log(`Audit log write failed (blocked): ${errorText(error)}`);
      }
    }
  }
  if (countTowardBlock && params.blockUser && !userBlocked) {
    try {
      const blockResult = await setManualBlockedUserEntry(
        context,
        subredditId,
        subredditName,
        normalizeUsernameStrict(reviewedRecord.username),
        actor,
        denialCount,
        false
      );
      manualBlockOutcome = {
        status: blockResult.alreadyBlocked ? 'already_blocked' : 'blocked',
        username: blockResult.entry.username,
      };
    } catch (error) {
      manualBlockOutcome = {
        status: 'failed',
        reason: errorText(error),
      };
    }
  }

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
      username: reviewedRecord.username,
      actor,
      action: 'denied',
      verificationId: reviewedRecord.id,
      notes: `${auditReasonNote}${moderatorNotes ? ` | ${moderatorNotes}` : ''}${
        userBlocked ? ` | Auto-blocked after ${denialCount} denials` : ''
      }${
        manualBlockOutcome?.status === 'blocked'
          ? ' | Blocked by moderator during denial.'
          : manualBlockOutcome?.status === 'already_blocked'
            ? ' | User was already blocked.'
            : manualBlockOutcome?.status === 'failed'
              ? ` | Block request failed: ${manualBlockOutcome.reason ?? 'unknown error'}`
              : ''
      }`,
    });
  } catch (error) {
    console.log(`Audit log write failed (denied): ${errorText(error)}`);
  }

  return {
    outcome: 'completed',
    applied: true,
    username: reviewedRecord.username,
    denyReasonLabel,
    flair: { status: 'skipped', reason: 'not applicable' },
    modmail,
    modNote,
    userBlocked,
    denialCount,
    manualBlockOutcome,
  };
}

// Automated denial of a just-submitted verification when Reddit reports the account as
// shadowbanned and the moderator has opted in. Re-reads the record inside the action lock and
// only acts while it is still pending, so a concurrent withdrawal cannot be resurrected. The
// denial does not count toward the auto-block threshold, and the user-facing modmail explains the
// shadowban and links to Reddit's appeal page.
const AUTO_DENY_SYSTEM_ACTOR = 'VouchX (auto)';
// Reddit's official appeal page for account actions. Shadowbans are applied by Reddit admins,
// not by the subreddit, so users must appeal to Reddit directly.
const SHADOWBAN_APPEAL_URL = 'https://www.reddit.com/appeals';

async function autoDenyShadowbannedSubmission(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  verificationId: string,
  config: RuntimeConfig
): Promise<ActionResult | null> {
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record || record.status !== 'pending') {
      return null;
    }
    const reviewedRecord: VerificationRecord = {
      ...record,
      status: 'denied',
      moderator: AUTO_DENY_SYSTEM_ACTOR,
      reviewedAt: new Date().toISOString(),
      denyReason: null,
      denyNotes: 'Account is shadowbanned',
      claimedBy: null,
      claimedAt: null,
      accountDetails: null,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };
    return await finalizeDeniedVerification(context, subredditId, subredditName, reviewedRecord, config, {
      actor: AUTO_DENY_SYSTEM_ACTOR,
      denyReasonLabel: 'Shadowbanned account',
      auditReasonNote: 'Auto-denied — account is shadowbanned',
      moderatorNotes: undefined,
      blockUser: false,
      countTowardBlock: false,
      sendModmail: () => sendShadowbanAutoDenyModmail(context, subredditId, reviewedRecord, config),
      addModNote: () => addShadowbanAutoDenyModNote(context, reviewedRecord),
    });
  });
}



function normalizeBatchReviewVerificationIds(
  values: unknown,
  maxItems = MAX_BATCH_REVIEW_ITEMS
): NormalizedBatchReviewIds {
  const rawValues = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  let duplicateOrEmptyCount = 0;

  for (const value of rawValues) {
    const id = String(value ?? '').trim();
    if (!id || seen.has(id)) {
      duplicateOrEmptyCount += 1;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  const limit = Math.max(0, Math.floor(maxItems));
  return {
    ids: ids.slice(0, limit),
    duplicateOrEmptyCount,
    truncatedCount: Math.max(0, ids.length - limit),
  };
}

function emptyBatchReviewCounts(): Record<BatchReviewItemStatus, number> {
  return {
    completed: 0,
    failed: 0,
    validation_retry: 0,
    invalid_account_removed: 0,
    banned_confirmation_required: 0,
  };
}

function classifyBatchReviewItem(action: BatchReviewAction, verificationId: string, result: ActionResult): BatchReviewItemResult {
  if (result.outcome === 'validation_retry') {
    return {
      verificationId,
      status: 'validation_retry',
      terminal: false,
      username: result.username,
      message: result.outcomeReason,
    };
  }
  if (result.outcome === 'banned_confirmation_required') {
    return {
      verificationId,
      status: 'banned_confirmation_required',
      terminal: false,
      username: result.username,
      message: 'Approval requires individual banned-user confirmation.',
    };
  }
  if (result.outcome === 'invalid_account_removed') {
    return {
      verificationId,
      status: 'invalid_account_removed',
      terminal: true,
      username: result.username,
      message: result.outcomeReason,
    };
  }

  const failedApproval =
    action === 'approve' &&
    (!result.applied || result.flair.status === 'failed' || result.modmail.status === 'failed' || result.modNote.status === 'failed');
  const failedDenial = action === 'deny' && (result.modmail.status === 'failed' || result.modNote.status === 'failed');
  if (failedApproval || failedDenial) {
    return {
      verificationId,
      status: 'failed',
      terminal: result.applied,
      username: result.username,
      message:
        result.flair.reason ??
        result.modmail.reason ??
        result.modNote.reason ??
        (action === 'approve' ? 'Approval did not complete.' : 'Denial completed with issues.'),
    };
  }

  return {
    verificationId,
    status: 'completed',
    terminal: true,
    username: result.username,
  };
}

async function batchReviewVerifications(
  context: Devvit.Context,
  input: {
    action: BatchReviewAction;
    verificationIds: unknown;
    selectedFlairTemplateId?: string;
    reason?: DenyReason | null;
    moderatorNotes?: string;
  }
): Promise<BatchReviewResult> {
  const normalized = normalizeBatchReviewVerificationIds(input.verificationIds);
  if (normalized.ids.length === 0) {
    throw new Error('Select at least one verification to review.');
  }
  if (input.action !== 'approve' && input.action !== 'deny') {
    throw new Error('Select a valid batch action.');
  }
  if (input.action === 'deny' && !input.reason) {
    throw new Error('Select a valid denial reason.');
  }

  const counts = emptyBatchReviewCounts();
  const items: BatchReviewItemResult[] = new Array(normalized.ids.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= normalized.ids.length) {
        return;
      }

      const verificationId = normalized.ids[index]!;
      try {
        const result =
          input.action === 'approve'
            ? await approveVerification(context, verificationId, false, input.selectedFlairTemplateId)
            : await denyVerification(context, verificationId, input.reason!, input.moderatorNotes ?? '');
        items[index] = classifyBatchReviewItem(input.action, verificationId, result);
      } catch (error) {
        items[index] = {
          verificationId,
          status: 'failed',
          terminal: false,
          message: errorText(error),
        };
      }
    }
  }

  const workerCount = Math.min(BATCH_REVIEW_CONCURRENCY, normalized.ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const completedItems = items.filter(Boolean);
  for (const item of completedItems) {
    counts[item.status] += 1;
  }

  return {
    action: input.action,
    requestedCount: Array.isArray(input.verificationIds) ? input.verificationIds.length : 0,
    acceptedCount: normalized.ids.length,
    duplicateOrEmptyCount: normalized.duplicateOrEmptyCount,
    truncatedCount: normalized.truncatedCount,
    terminalVerificationIds: completedItems.filter((item) => item.terminal).map((item) => item.verificationId),
    counts,
    items: completedItems,
  };
}

function pluralizeBatchCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildBatchReviewToast(result: BatchReviewResult): BatchReviewToast {
  const parts: string[] = [];
  const actionLabel = result.action === 'approve' ? 'Approved' : 'Denied';
  if (result.counts.completed > 0) {
    parts.push(`${actionLabel} ${result.counts.completed}`);
  }
  if (result.counts.invalid_account_removed > 0) {
    parts.push(`${pluralizeBatchCount(result.counts.invalid_account_removed, 'invalid account')} removed`);
  }
  if (result.counts.banned_confirmation_required > 0) {
    parts.push(
      `${result.counts.banned_confirmation_required} ${
        result.counts.banned_confirmation_required === 1 ? 'needs' : 'need'
      } individual banned-user confirmation`
    );
  }
  if (result.counts.validation_retry > 0) {
    parts.push(`${result.counts.validation_retry} need retry`);
  }
  if (result.counts.failed > 0) {
    parts.push(`${result.counts.failed} failed`);
  }
  const skipped = result.duplicateOrEmptyCount + result.truncatedCount;
  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }

  const text = parts.length > 0 ? parts.join('; ') + '.' : 'No selected verifications were changed.';
  const tone = result.counts.failed > 0 || result.counts.validation_retry > 0 ? 'error' : result.counts.completed > 0 ? 'success' : 'info';
  return { text, tone };
}

async function reopenDeniedVerification(
  context: Devvit.Context,
  verificationId: string
): Promise<{ reopenedId: string; username: string; pendingItem: PendingPanelItem; deniedId: string }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const deniedRecord = await getRecord(context, subredditId, verificationId);
    if (!deniedRecord) {
      throw new Error('Verification not found.');
    }
    if (deniedRecord.status !== 'denied') {
      throw new Error('Only denied verifications can be reopened.');
    }

    const primaryPhoto = normalizePhotoInput(deniedRecord.photoOneUrl);
    if (!primaryPhoto) {
      throw new Error('Cannot reopen this denied case because its photos are unavailable. Ask the user to resubmit.');
    }

    const normalizedUsername = normalizeUsername(deniedRecord.username);
    const existingPendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
    if (existingPendingId) {
      const existingPendingRecord = await getRecord(context, subredditId, existingPendingId);
      if (existingPendingRecord?.status === 'pending') {
        throw new Error(`u/${deniedRecord.username} already has a pending verification.`);
      }
      await deleteUserPendingPointers(context, subredditId, normalizedUsername, deniedRecord.userId);
    }

    const now = new Date();
    const reopenedAt = now.toISOString();
    const accountDetails = await collectPendingAccountDetailsSnapshot(
      context,
      subredditId,
      subredditName,
      deniedRecord.username,
      reopenedAt
    );
    const reopenedId = makeVerificationId(now);
    const reopenedRecord: VerificationRecord = {
      ...deniedRecord,
      id: reopenedId,
      status: 'pending',
      moderator: null,
      reviewedAt: null,
      denyReason: null,
      denyNotes: null,
      claimedBy: null,
      claimedAt: null,
      submittedAt: reopenedAt,
      parentVerificationId: deniedRecord.id,
      accountDetails,
      removedAt: null,
      removedBy: null,
      lastValidatedAt: null,
      nextValidationAt: null,
      hardExpireAt: null,
      validationFailureCount: 0,
      terminalValidationFailureCount: 0,
      lastFlairReconcileAt: null,
    };

    await setRecord(context, subredditId, reopenedRecord);
    await context.redis.zAdd(pendingIndexKey(subredditId), { member: reopenedId, score: now.getTime() });
    await context.redis.zAdd(historyDateIndexKey(subredditId), { member: reopenedId, score: now.getTime() });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizedUsername), { member: reopenedId, score: now.getTime() });
    await setUserPendingPointer(context, subredditId, normalizedUsername, reopenedRecord.userId, reopenedId);
    await setUserLatestPointer(context, subredditId, normalizedUsername, reopenedRecord.userId, reopenedId);
    await context.redis.set(reopenedChildByDeniedKey(subredditId, deniedRecord.id), reopenedId);
    await context.redis.set(reopenedStateByDeniedKey(subredditId, deniedRecord.id), 'open');

    try {
      const auditId = await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(reopenedRecord.subredditName),
        username: reopenedRecord.username,
        actor: moderator,
        action: 'reopened',
        verificationId: reopenedId,
        notes: 'Moved denied case back to pending re-review.',
      });
      await context.redis.set(reopenedAuditByReopenedKey(subredditId, reopenedId), auditId);
    } catch (error) {
      console.log(`Audit log write failed (reopened): ${errorText(error)}`);
    }

    return {
      reopenedId,
      username: reopenedRecord.username,
      pendingItem: toPendingPanelItem(reopenedRecord),
      deniedId: deniedRecord.id,
    };
  });
}

async function cancelReopenedVerification(
  context: Devvit.Context,
  verificationId: string
): Promise<{ username: string; deniedId: string }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const reopenedRecord = await getRecord(context, subredditId, verificationId);
    if (!reopenedRecord) {
      throw new Error('Verification not found.');
    }
    if (reopenedRecord.status !== 'pending' || !reopenedRecord.parentVerificationId?.trim()) {
      throw new Error('Only pending re-review cases can be canceled.');
    }
    assertClaimAllowsAction(reopenedRecord, moderator);

    const normalizedUsername = normalizeUsername(reopenedRecord.username);
    const parentVerificationId = reopenedRecord.parentVerificationId.trim();
    const parentRecord = await getRecord(context, subredditId, parentVerificationId);

    await context.redis.del(verificationRecordKey(subredditId, verificationId));
    await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
    await context.redis.zRem(historyDateIndexKey(subredditId), [verificationId]);
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), [verificationId]);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    await clearUserPendingPointersIfMatch(context, subredditId, normalizedUsername, reopenedRecord.userId, verificationId);

    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId === verificationId) {
      if (
        parentRecord &&
        usernamesEqual(parentRecord.username, reopenedRecord.username) &&
        parentRecord.id === parentVerificationId
      ) {
        await setUserLatestPointer(context, subredditId, normalizedUsername, parentRecord.userId, parentVerificationId);
      } else {
        const fallbackLatestId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
        if (fallbackLatestId) {
          const fallbackLatestRecord = await getRecord(context, subredditId, fallbackLatestId);
          if (fallbackLatestRecord) {
            await setUserLatestPointer(
              context,
              subredditId,
              normalizedUsername,
              fallbackLatestRecord.userId,
              fallbackLatestId
            );
          } else {
            await deleteUserLatestPointers(context, subredditId, normalizedUsername, reopenedRecord.userId);
          }
        } else {
          await deleteUserLatestPointers(context, subredditId, normalizedUsername, reopenedRecord.userId);
        }
      }
    }

    const reopenedLinkKey = reopenedChildByDeniedKey(subredditId, parentVerificationId);
    const mappedChildId = await context.redis.get(reopenedLinkKey);
    if (!mappedChildId || mappedChildId === verificationId) {
      await context.redis.del(reopenedLinkKey);
    }
    await context.redis.set(reopenedStateByDeniedKey(subredditId, parentVerificationId), 'cancelled');

    const reopenedAuditKey = reopenedAuditByReopenedKey(subredditId, verificationId);
    const reopenedAuditId = await context.redis.get(reopenedAuditKey);
    if (reopenedAuditId) {
      await context.redis.zRem(auditDateIndexKey(subredditId), [reopenedAuditId]);
      await context.redis.del(auditEntryKey(subredditId, reopenedAuditId));
      await context.redis.del(reopenedAuditKey);
    }

    return { username: reopenedRecord.username, deniedId: parentVerificationId };
  });
}

async function removeApprovedVerificationByModerator(
  context: Devvit.Context,
  verificationId: string,
  removalReason: string
): Promise<ActionResult> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const currentSubreddit = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, currentSubreddit, moderator);
  return await withVerificationActionLock(context, subredditId, verificationId, async () => {
    const record = await getRecord(context, subredditId, verificationId);
    if (!record) {
      throw new Error('Verification not found.');
    }

    if (record.status === 'removed') {
      return {
        outcome: 'completed',
        applied: false,
        flair: { status: 'skipped', reason: 'already removed' },
        modmail: { status: 'skipped', reason: 'already removed' },
        modNote: { status: 'skipped', reason: 'not applicable' },
      };
    }

    if (record.status !== 'approved') {
      throw new Error('Only approved verifications can be removed.');
    }

    const normalizedReason = removalReason.trim();
    if (!normalizedReason) {
      throw new Error('Removal reason is required.');
    }

    const flairRemoved = await removeUserFlairWithFallbacks(context, sanitizeSubredditName(record.subredditName), record.username);
    const flair: FlairStepResult = flairRemoved
      ? { status: 'success' }
      : { status: 'failed', reason: 'Unable to remove flair through fallback methods.' };

    const now = new Date().toISOString();
    const updatedRecord: VerificationRecord = {
      ...record,
      status: 'removed',
      removedAt: now,
      removedBy: moderator,
    };

    await setRecord(context, subredditId, updatedRecord);
    const historyAnchorMs = getHistoryRecordAnchorMs(updatedRecord);
    await context.redis.zRem(approvedIndexKey(subredditId), [verificationId]);
    await removeApprovedPrefixIndexEntry(context, subredditId, verificationId, record.username);
    await context.redis.zAdd(historyDateIndexKey(subredditId), { member: verificationId, score: historyAnchorMs });
    await context.redis.zAdd(historyByUserIndexKey(subredditId, normalizeUsername(record.username)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await context.redis.zAdd(historyByModeratorIndexKey(subredditId, normalizeUsername(moderator)), {
      member: verificationId,
      score: historyAnchorMs,
    });
    await setUserLatestPointer(context, subredditId, record.username, record.userId, verificationId);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    const [modmail, modNote] = await Promise.all([
      sendModeratorRemovalModmail(context, subredditId, updatedRecord, normalizedReason),
      (async (): Promise<ModNoteStepResult> => {
        try {
          await addModeratorRemovalModNote(context, updatedRecord, moderator, normalizedReason);
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', reason: errorText(error) };
        }
      })(),
    ]);

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(record.subredditName),
        username: record.username,
        actor: moderator,
        action: 'removed_by_mod',
        verificationId,
        notes: `${flairRemoved ? 'Flair removed.' : 'Flair removal failed.'} Reason: ${normalizedReason}${
          modmail.status === 'failed'
            ? ` | Removal modmail failed: ${modmail.reason ?? 'unknown error'}`
            : modmail.status === 'replied'
              ? ' | Removal modmail replied in existing thread.'
              : modmail.status === 'created'
                ? ' | Removal modmail created.'
                : ' | Removal modmail skipped.'
        }`,
      });
    } catch (error) {
      console.log(`Audit log write failed (removed_by_mod): ${errorText(error)}`);
    }

    return {
      outcome: 'completed',
      applied: true,
      flair,
      modmail,
      modNote,
    };
  });
}












// Normalizes the ConversationUserData embedded in modmail create/reply responses into the
// two signals we score on. isShadowBanned is only reported by modmail (not the User object).

// Attaches modmail user signals to a send result only when at least one signal is present,
// keeping the result minimal when the response carries no embedded user data.










async function loadDashboardData(
  context: Devvit.Context,
  options: {
    includeModData: boolean;
  }
): Promise<DashboardData> {
  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  const viewerIdentity = await getViewerIdentitySnapshot(context);
  let moderatorAccess: ModeratorAccessSnapshot = {
    state: 'denied',
    permissionState: 'unknown',
    isModerator: false,
    permissions: [],
  };
  if (options.includeModData && viewerIdentity.state === 'confirmed' && viewerIdentity.username) {
    moderatorAccess = await getModeratorAccessSnapshot(context, subredditName, viewerIdentity.username);
  }

  const isModeratorUser = options.includeModData ? moderatorAccess.isModerator : false;
  const moderatorPermissions = options.includeModData ? moderatorAccess.permissions : [];
  const canManageUsers = options.includeModData ? hasManageUsersPermissionInList(moderatorPermissions) : false;
  const settingsTabRequiresConfigAccess = await getSettingsTabRequiresConfigAccess(context);
  const canOpenInstallSettings = options.includeModData ? hasAllModeratorPermissionInList(moderatorPermissions) : false;
  const hasConfigAccess = options.includeModData ? hasConfigAccessPermissionInList(moderatorPermissions) : false;
  const canReviewUser = options.includeModData ? isModeratorUser && canManageUsers : false;
  const canAccessSettingsTab = canReviewUser && (!settingsTabRequiresConfigAccess || hasConfigAccess);
  let config = await getRuntimeConfig(context, subredditId);
  let flairTemplateValidation = validateFlairTemplateId(config.flairTemplateId);
  if (options.includeModData && viewerIdentity.state === 'confirmed' && config.flairTemplateId.trim()) {
    config = await refreshConfiguredFlairTemplateCache(context, subredditId, subredditName, config);
  }
  if (canReviewUser && options.includeModData) {
    flairTemplateValidation = await validateFlairTemplateIdForSubreddit(context, subredditName, config.flairTemplateId);
  }
  const requiresInitialSetup = !config.flairTemplateId.trim();
  const [globalBlockedUsernames, developerUiUsernames] = await Promise.all([
    readMergedGlobalUsernameSettings(context, GLOBAL_BLOCKED_USERNAME_SETTING_NAMES),
    readGlobalUsernameSetting(context, GLOBAL_SETTING_DEVELOPER_UI_USERNAMES),
  ]);

  let userLatest = await getLatestRecordForCurrentViewer(context, subredditId, viewerIdentity);
  const viewerLookupUsername = viewerIdentity.username ?? userLatest?.username ?? null;
  if (viewerLookupUsername && userLatest) {
    userLatest = await bumpViewerVerifiedRecordRetention(context, subredditId, viewerLookupUsername, userLatest);
  }
  const viewerNormalizedUsername = normalizeUsernameStrict(viewerIdentity.username ?? '');
  const developerPanel =
    viewerNormalizedUsername && developerUiUsernames.usernames.includes(viewerNormalizedUsername)
      ? {
          accessGranted: true as const,
          currentUsernames: [...globalBlockedUsernames.usernames],
          invalidTokens: [...globalBlockedUsernames.invalidTokens],
          canonicalValue: globalBlockedUsernames.canonicalValue,
        }
      : undefined;
  const viewerBlocked =
    viewerLookupUsername
      ? createGlobalBlockedUserEntry(globalBlockedUsernames, viewerLookupUsername) ??
        (await repairMissingAutoBlockForUser(context, subredditId, viewerLookupUsername, config))
      : null;
  const pending = canReviewUser && options.includeModData ? await listPendingVerifications(context, subredditId) : [];
  const pendingCount = canReviewUser
    ? options.includeModData
      ? pending.length
      : await context.redis.zCard(pendingIndexKey(subredditId))
    : 0;
  const defaultSearchFromAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const defaultSearchToAt = new Date().toISOString();
  const approvedSearch = canReviewUser && options.includeModData
    ? await searchApprovedRecords(context, subredditId, {
        fromDate: defaultSearchFromAt,
        toDate: defaultSearchToAt,
        offset: 0,
        limit: 25,
      })
    : { items: [], hasMore: false };
  const approved = approvedSearch.items;
  const blocked = canReviewUser && options.includeModData ? await listBlockedUsers(context, subredditId) : [];
  const auditSearch = canReviewUser && options.includeModData
    ? await searchAuditEntries(context, subredditId, {
        fromDate: defaultSearchFromAt,
        toDate: defaultSearchToAt,
        offset: 0,
        limit: 25,
      })
    : { items: [], hasMore: false };
  const auditLog = auditSearch.items;
  const storage = canReviewUser && options.includeModData ? await estimateSubredditStorageUsage(context, subredditId) : emptyStorageUsage();
  const viewerSnapshot =
    viewerIdentity.state === 'confirmed' ? await getViewerSnapshot(context) : { accountAgeDays: null, totalKarma: null };
  let viewerFlairSnapshot =
    viewerIdentity.state === 'confirmed'
      ? await getViewerFlairSnapshot(context, subredditName)
      : emptyViewerFlairSnapshot(
          viewerIdentity.userId || context.userId,
          viewerIdentity.state === 'unavailable' ? 'unavailable' : 'confirmed_absent',
          viewerIdentity.state === 'unavailable' ? viewerIdentity.error : null
        );
  let flairCheck =
    viewerIdentity.state === 'confirmed'
      ? await checkVerificationFlair(context, subredditName, config, viewerFlairSnapshot)
      : viewerIdentity.state === 'unavailable'
        ? {
            verified: false,
            configuredTemplateId: normalizeTemplateId(config.flairTemplateId),
            detectedTemplateId: '',
            source: 'viewer-snapshot:unavailable',
            error: viewerIdentity.error ?? 'Viewer identity unavailable.',
          }
        : {
            verified: false,
            configuredTemplateId: '',
            detectedTemplateId: '',
            source: 'no-viewer',
            error: null,
          };

  if (
    config.autoFlairReconcileEnabled &&
    viewerBlocked?.scope !== 'global' &&
    viewerLookupUsername &&
    userLatest &&
    isViewerFlairReconcileDue(userLatest, Date.now()) &&
    shouldReconcileApprovedViewerFlair(userLatest, config, flairCheck, viewerFlairSnapshot)
  ) {
    const reconcileAttemptedAt = Date.now();
    const stampedUserLatest: VerificationRecord = {
      ...userLatest,
      lastFlairReconcileAt: reconcileAttemptedAt,
    };
    try {
      await setRecord(context, subredditId, stampedUserLatest);
      userLatest = stampedUserLatest;
    } catch (error) {
      console.log(
        `Viewer flair reconcile timestamp update failed for r/${subredditName} u/${maskUsernameForLog(viewerLookupUsername)}: ${errorText(error)}`
      );
    }
    const previousAppliedTemplateId = normalizeTemplateId(userLatest.lastAppliedFlairTemplateId ?? '');
    const configuredTemplateIds = configuredApprovalTemplateIds(config);
    const configuredTemplateId = normalizeTemplateId(config.flairTemplateId);
    const desiredTemplateId =
      previousAppliedTemplateId && configuredTemplateIds.includes(previousAppliedTemplateId)
        ? previousAppliedTemplateId
        : configuredTemplateId;
    const detectedTemplateIdBeforeReconcile = normalizeTemplateId(
      viewerFlairSnapshot.flairTemplateId || flairCheck.detectedTemplateId
    );
    if (
      previousAppliedTemplateId &&
      desiredTemplateId &&
      previousAppliedTemplateId !== desiredTemplateId &&
      detectedTemplateIdBeforeReconcile === previousAppliedTemplateId
    ) {
      const cleared = await removeUserFlairWithFallbacks(context, subredditName, viewerLookupUsername);
      if (!cleared) {
        console.log(
          `Viewer stale flair clear before reconcile failed for r/${subredditName} u/${maskUsernameForLog(viewerLookupUsername)}`
        );
      }
    }
    const reconcileResult = await applyApprovalFlairWithFallbacks(context, userLatest, config, desiredTemplateId);
    if (reconcileResult.applied) {
      viewerFlairSnapshot = await getViewerFlairSnapshot(context, subredditName);
      flairCheck = await checkVerificationFlair(context, subredditName, config, viewerFlairSnapshot);
      const updatedTemplateId = normalizeTemplateId(reconcileResult.appliedTemplateId ?? desiredTemplateId);
      const detectedTemplateAfterReconcile = normalizeTemplateId(
        viewerFlairSnapshot.flairTemplateId || flairCheck.detectedTemplateId
      );
      const reconcileConfirmed = Boolean(
        flairCheck.verified &&
          detectedTemplateAfterReconcile &&
          configuredTemplateIds.includes(detectedTemplateAfterReconcile)
      );
      if (updatedTemplateId && reconcileConfirmed) {
        try {
          const refreshedUserLatest: VerificationRecord = {
            ...userLatest,
            lastAppliedFlairTemplateId: updatedTemplateId,
            lastFlairReconcileAt: reconcileAttemptedAt,
          };
          await setRecord(context, subredditId, refreshedUserLatest);
          userLatest = refreshedUserLatest;
        } catch (error) {
          console.log(
            `Viewer flair reconcile record update failed for r/${subredditName} u/${maskUsernameForLog(viewerLookupUsername)}: ${errorText(error)}`
          );
        }
      } else if (updatedTemplateId) {
        console.log(
          `Viewer flair reconcile did not confirm updated template for r/${subredditName} u/${maskUsernameForLog(viewerLookupUsername)}; preserving prior record template ID`
        );
      }
    } else if (reconcileResult.error) {
      console.log(
        `Viewer flair reconcile failed for r/${subredditName} u/${maskUsernameForLog(viewerLookupUsername)}: ${reconcileResult.error}`
      );
    }
  }

  const viewerVerifiedSuppressed = Boolean(
    viewerLookupUsername && (await shouldSuppressViewerVerifiedState(context, subredditId, viewerLookupUsername, userLatest))
  );
  const viewerShouldDisplayVerified =
    viewerBlocked?.scope === 'global'
      ? false
      : shouldViewerDisplayVerifiedState(flairCheck, userLatest, viewerVerifiedSuppressed);
  const viewerAwaitingFlairPropagation =
    viewerBlocked?.scope === 'global' ? false : isViewerAwaitingFlairPropagation(flairCheck, userLatest);

  return {
    viewerUsername: viewerLookupUsername,
    subredditName,
    moderatorAccess,
    isModerator: isModeratorUser,
    canReview: canReviewUser,
    canManageUsers,
    canOpenInstallSettings,
    hasConfigAccess,
    canAccessSettingsTab,
    flairTemplateValidation,
    requiresInitialSetup,
    config,
    viewerSnapshot,
    viewerShouldDisplayVerified,
    viewerAwaitingFlairPropagation,
    viewerVerifiedByFlair: flairCheck.verified,
    viewerFlairConfiguredTemplateId: flairCheck.configuredTemplateId,
    viewerFlairDetectedTemplateId: flairCheck.detectedTemplateId,
    viewerFlairCheckSource: flairCheck.source,
    viewerFlairCheckError: flairCheck.error,
    viewerCurrentFlairText: viewerFlairSnapshot.flairText,
    viewerCurrentFlairCssClass: viewerFlairSnapshot.flairCssClass,
    userLatest,
    viewerBlocked,
    developerPanel,
    pendingCount,
    pending,
    approved,
    blocked,
    auditLog,
    storage,
    approvedHasMore: Boolean(approvedSearch.hasMore),
    auditHasMore: Boolean(auditSearch.hasMore),
  };
}

async function loadHubDashboard(context: Devvit.Context): Promise<DashboardData> {
  return await loadDashboardData(context, { includeModData: false });
}

async function loadModDashboard(context: Devvit.Context): Promise<DashboardData> {
  return await loadDashboardData(context, { includeModData: true });
}

async function getViewerSnapshot(context: Devvit.Context): Promise<UserSnapshot> {
  const emptySnapshot = { accountAgeDays: null, totalKarma: null };
  const viewerIdentity = await getViewerIdentitySnapshot(context);
  const user = viewerIdentity.user;
  if (!user) {
    return emptySnapshot;
  }
  try {
    const createdAt = user.createdAt;
    const ageMs = Date.now() - createdAt.getTime();
    const accountAgeDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
    const totalKarma = (user.commentKarma ?? 0) + (user.linkKarma ?? 0);
    return { accountAgeDays, totalKarma };
  } catch (error) {
    const message = errorText(error);
    if (!looksLikeTransientRedditTransportError(message)) {
      console.log(`Viewer snapshot lookup failed: ${message}`);
    }
    return emptySnapshot;
  }
}


























function dedupeNonEmpty(values: string[]): string[] {
  const deduped: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (!deduped.includes(trimmed)) {
      deduped.push(trimmed);
    }
  }
  return deduped;
}























async function removeAllVerificationRecordsForUser(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<void> {
  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
  });
  const recordIds = Array.from(new Set(historyEntries.map((entry) => entry.member)));
  if (recordIds.length === 0) {
    await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
    await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
    return;
  }

  const payloads = await mGetStringValuesInChunks(
    context,
    recordIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const byModerator = new Map<string, string[]>();
  const approvedPrefixEntries: Array<{ recordId: string; username: string }> = [];
  const reopenMetaKeysToDelete = new Set<string>();
  const userIdsToClear = new Set<string>();
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = recordIds[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed) {
      continue;
    }
    if (getRecordUserId(parsed)) {
      userIdsToClear.add(getRecordUserId(parsed));
    }
    if (parsed.moderator) {
      const normalizedModerator = normalizeUsername(parsed.moderator);
      const ids = byModerator.get(normalizedModerator) ?? [];
      ids.push(recordId);
      byModerator.set(normalizedModerator, ids);
    }
    if (parsed.status === 'approved') {
      approvedPrefixEntries.push({ recordId, username: parsed.username });
    }
    reopenMetaKeysToDelete.add(reopenedAuditByReopenedKey(subredditId, recordId));
    if (parsed.status === 'denied') {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, recordId));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, recordId));
    }
    if (parsed.parentVerificationId?.trim()) {
      reopenMetaKeysToDelete.add(reopenedChildByDeniedKey(subredditId, parsed.parentVerificationId.trim()));
      reopenMetaKeysToDelete.add(reopenedStateByDeniedKey(subredditId, parsed.parentVerificationId.trim()));
    }
  }

  if (recordIds.length > 0) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), recordIds);
    await context.redis.zRem(historyDateIndexKey(subredditId), recordIds);
    await context.redis.zRem(pendingIndexKey(subredditId), recordIds);
    await context.redis.zRem(approvedIndexKey(subredditId), recordIds);
    await removeApprovedPrefixIndexEntries(context, subredditId, approvedPrefixEntries);
    await removeValidationTrackingForRecordIds(context, subredditId, recordIds);
    await context.redis.del(...recordIds.map((recordId) => verificationRecordKey(subredditId, recordId)));
  }

  for (const [normalizedModerator, ids] of byModerator.entries()) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), ids);
  }
  if (reopenMetaKeysToDelete.size > 0) {
    await context.redis.del(...Array.from(reopenMetaKeysToDelete));
  }

  await deleteUserPendingPointers(context, subredditId, normalizedUsername, '');
  await deleteUserLatestPointers(context, subredditId, normalizedUsername, '');
  for (const userId of userIdsToClear) {
    await context.redis.del(userPendingKeyById(subredditId, userId), userLatestKeyById(subredditId, userId));
  }
}

async function pruneHistoryOlderThanDays(
  context: RedisContext,
  subredditId: string,
  olderThanDays: number
): Promise<number> {
  if (olderThanDays < 1) {
    return 0;
  }

  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const staleCandidates = await context.redis.zRange(historyDateIndexKey(subredditId), 0, cutoffMs, { by: 'score' });
  if (staleCandidates.length === 0) {
    return 0;
  }

  const candidateIds = staleCandidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const missingIds = new Set<string>();
  const recordIdsToDelete = new Set<string>();
  const byUser = new Map<string, string[]>();
  const userIdByUsername = new Map<string, string>();
  const byModerator = new Map<string, string[]>();
  const approvedPrefixEntries: Array<{ recordId: string; username: string }> = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      missingIds.add(recordId);
      continue;
    }

    const parsed = parseRecord(payload);
    if (!parsed) {
      missingIds.add(recordId);
      continue;
    }

    if (
      parsed.status === 'approved' &&
      getApprovedRecordRetentionAnchorMs(parsed, nowMs) + VERIFIED_RECORD_RETENTION_DAYS * MILLIS_PER_DAY > nowMs
    ) {
      continue;
    }

    const normalizedUsername = normalizeUsername(parsed.username);
    const userIds = byUser.get(normalizedUsername) ?? [];
    userIds.push(recordId);
    byUser.set(normalizedUsername, userIds);
    if (getRecordUserId(parsed)) {
      userIdByUsername.set(normalizedUsername, getRecordUserId(parsed));
    }

    if (parsed.moderator) {
      const normalizedModerator = normalizeUsername(parsed.moderator);
      const modIds = byModerator.get(normalizedModerator) ?? [];
      modIds.push(recordId);
      byModerator.set(normalizedModerator, modIds);
    }
    if (parsed.status === 'approved') {
      approvedPrefixEntries.push({ recordId, username: parsed.username });
    }

    recordIdsToDelete.add(recordId);
  }

  const recordDeleteList = Array.from(recordIdsToDelete);
  const idsToRemoveFromDate = Array.from(new Set([...recordDeleteList, ...Array.from(missingIds)]));
  if (idsToRemoveFromDate.length > 0) {
    await context.redis.zRem(historyDateIndexKey(subredditId), idsToRemoveFromDate);
    await removeValidationTrackingForRecordIds(context, subredditId, idsToRemoveFromDate);
  }

  if (recordDeleteList.length === 0) {
    return 0;
  }

  await context.redis.zRem(pendingIndexKey(subredditId), recordDeleteList);
  await context.redis.zRem(approvedIndexKey(subredditId), recordDeleteList);
  await removeApprovedPrefixIndexEntries(context, subredditId, approvedPrefixEntries);
  await removeValidationTrackingForRecordIds(context, subredditId, recordDeleteList);
  await context.redis.del(...recordDeleteList.map((recordId) => verificationRecordKey(subredditId, recordId)));

  for (const [normalizedUsername, deletedIds] of byUser.entries()) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), deletedIds);
    const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
    if (pendingId && deletedIds.includes(pendingId)) {
      await deleteUserPendingPointers(context, subredditId, normalizedUsername, userIdByUsername.get(normalizedUsername) ?? '');
    }
    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId && deletedIds.includes(latestId)) {
      const fallbackLatestId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
      if (fallbackLatestId) {
        const fallbackLatestRecord = await getRecord(context, subredditId, fallbackLatestId);
        if (fallbackLatestRecord) {
          await setUserLatestPointer(
            context,
            subredditId,
            normalizedUsername,
            fallbackLatestRecord.userId,
            fallbackLatestId
          );
        } else {
          await deleteUserLatestPointers(
            context,
            subredditId,
            normalizedUsername,
            userIdByUsername.get(normalizedUsername) ?? ''
          );
        }
      } else {
        await deleteUserLatestPointers(context, subredditId, normalizedUsername, userIdByUsername.get(normalizedUsername) ?? '');
      }
    }
  }

  for (const [normalizedModerator, deletedIds] of byModerator.entries()) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), deletedIds);
  }

  return recordDeleteList.length;
}








































async function onSaveFlairTemplateValues(
  values: FlairTemplateFormValues,
  context: Devvit.Context
): Promise<void> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(context);
  const subredditId = sanitizeSubredditId(context.subredditId);
  await assertCanAccessModeratorSettingsTab(context, subredditName, moderator);

  const existingConfig = await getRuntimeConfig(context, subredditId);
  const requiredPhotoCount =
    values.requiredPhotoCount === undefined
      ? existingConfig.requiredPhotoCount
      : parseRequiredPhotoCount(values.requiredPhotoCount, existingConfig.requiredPhotoCount);
  const photoInstructions = values.photoInstructions?.trim() ?? '';
  const photoInstructionsEs =
    values.photoInstructionsEs === undefined ? existingConfig.photoInstructionsEs : values.photoInstructionsEs.trim();
  const photoInstructionsFr =
    values.photoInstructionsFr === undefined ? existingConfig.photoInstructionsFr : values.photoInstructionsFr.trim();
  const photoInstructionsPtBr =
    values.photoInstructionsPtBr === undefined
      ? existingConfig.photoInstructionsPtBr
      : values.photoInstructionsPtBr.trim();
  const photoInstructionsDefaultLanguage = normalizePhotoInstructionLanguage(
    values.photoInstructionsDefaultLanguage ?? existingConfig.photoInstructionsDefaultLanguage
  );
  const flairTemplateId = values.flairTemplateId?.trim() ?? '';
  const flairTemplateValidation = validateFlairTemplateId(flairTemplateId);
  if (!flairTemplateValidation.isValid) {
    throw new Error(flairTemplateValidation.message);
  }
  const normalizedTemplateId = normalizeTemplateId(flairTemplateId);
  const requestedAdditionalApprovalFlairs = Array.isArray(values.additionalApprovalFlairs)
    ? values.additionalApprovalFlairs
        .map((item) => normalizeApprovalFlairConfig(item))
        .filter((item): item is ApprovalFlairConfig => Boolean(item))
    : [];
  const effectiveAdditionalApprovalFlairs = existingConfig.multipleApprovalFlairsEnabled
    ? requestedAdditionalApprovalFlairs
    : existingConfig.additionalApprovalFlairs;
  const normalizedAdditional = effectiveAdditionalApprovalFlairs
    .map((item) => normalizeApprovalFlairConfig(item))
    .filter((item): item is ApprovalFlairConfig => Boolean(item))
    .filter((item) => item.templateId !== normalizedTemplateId)
    .filter((item, index, all) => all.findIndex((entry) => entry.templateId === item.templateId) === index)
    .slice(0, 2);
  const existingNormalizedTemplateId = normalizeTemplateId(existingConfig.flairTemplateId);
  const templateSelectionChanged =
    existingNormalizedTemplateId !== normalizedTemplateId ||
    !approvalFlairTemplateIdsMatch(existingConfig.additionalApprovalFlairs, normalizedAdditional);
  const cacheFields: Record<string, string> = templateSelectionChanged
    ? {
        [CONFIG_FIELD.flairTemplateCacheTemplateId]: normalizedTemplateId,
        [CONFIG_FIELD.flairTemplateCacheText]: '',
        [CONFIG_FIELD.flairTemplateCacheCheckedAt]: '0',
      }
    : {};

  let flairTemplatesForSave: UserFlairTemplateSummary[] | undefined;
  if (templateSelectionChanged) {
    flairTemplatesForSave = await listUserFlairTemplatesForSubreddit(context, subredditName);
    const templateValidation = validateFlairTemplateIdAgainstTemplates(subredditName, flairTemplateId, flairTemplatesForSave);
    if (!templateValidation.isValid) {
      throw new Error(templateValidation.message);
    }
    if (existingConfig.multipleApprovalFlairsEnabled) {
      for (const option of normalizedAdditional) {
        const validation = validateFlairTemplateIdAgainstTemplates(subredditName, option.templateId, flairTemplatesForSave);
        if (!validation.isValid) {
          throw new Error(`Additional flair (${option.templateId}) is invalid: ${validation.message}`);
        }
      }
    }
  }

  await context.redis.hSet(subredditConfigKey(subredditId), {
    ...(values.verificationsEnabled === undefined
      ? {}
      : { [CONFIG_FIELD.verificationsEnabled]: `${values.verificationsEnabled !== false}` }),
    [CONFIG_FIELD.requiredPhotoCount]: `${requiredPhotoCount}`,
    [CONFIG_FIELD.photoInstructions]: photoInstructions,
    [CONFIG_FIELD.photoInstructionsEs]: photoInstructionsEs,
    [CONFIG_FIELD.photoInstructionsFr]: photoInstructionsFr,
    [CONFIG_FIELD.photoInstructionsPtBr]: photoInstructionsPtBr,
    [CONFIG_FIELD.photoInstructionsDefaultLanguage]: photoInstructionsDefaultLanguage,
    [CONFIG_FIELD.flairTemplateId]: flairTemplateId,
    [CONFIG_FIELD.flairCssClass]: values.flairCssClass?.trim() ?? '',
    [CONFIG_FIELD.additionalApprovalFlairs]: serializeAdditionalApprovalFlairs(normalizedAdditional),
    ...cacheFields,
  });

  const refreshedConfig: RuntimeConfig = {
    ...existingConfig,
    verificationsEnabled: values.verificationsEnabled === undefined ? existingConfig.verificationsEnabled : values.verificationsEnabled !== false,
    requiredPhotoCount,
    photoInstructions,
    photoInstructionsEs,
    photoInstructionsFr,
    photoInstructionsPtBr,
    photoInstructionsDefaultLanguage,
    flairTemplateId,
    flairCssClass: values.flairCssClass?.trim() ?? '',
    additionalApprovalFlairs: normalizedAdditional,
    flairTemplateCacheTemplateId: templateSelectionChanged ? normalizedTemplateId : existingConfig.flairTemplateCacheTemplateId,
    flairTemplateCacheText: templateSelectionChanged ? '' : existingConfig.flairTemplateCacheText,
    flairTemplateCacheCheckedAt: templateSelectionChanged ? 0 : existingConfig.flairTemplateCacheCheckedAt,
  };

  if (templateSelectionChanged) {
    await refreshConfiguredFlairTemplateCache(
      context,
      subredditId,
      subredditName,
      refreshedConfig,
      true,
      flairTemplatesForSave
    );
  }
}

async function onSaveModmailTemplatesValues(
  values: ModmailTemplatesFormValues,
  context: Devvit.Context
): Promise<void> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(context);
  const subredditId = sanitizeSubredditId(context.subredditId);
  await assertCanAccessModeratorSettingsTab(context, subredditName, moderator);

  const pendingTurnaroundDays = parsePositiveInt(values.pendingTurnaroundDays, DEFAULT_PENDING_TURNAROUND_DAYS);
  const modmailSubject = values.modmailSubject?.trim();
  const pendingBody = values.pendingBody?.trim();
  const alwaysIncludeDenialNotesInModmail = values.alwaysIncludeDenialNotesInModmail === true;
  const approveHeader = values.approveHeader?.trim();
  const approveBody = values.approveBody?.trim();
  const denyHeader = values.denyHeader?.trim();
  const denyReasonTemplates = values.denyReasonTemplates ?? {};
  const removeHeader = values.removeHeader?.trim();
  const removeBody = values.removeBody?.trim();
  const existingConfig = await getRuntimeConfig(context, subredditId);
  const denyReasonTemplateValues = Object.fromEntries(
    existingConfig.denyReasons.map((reason) => {
      const submittedValue = typeof denyReasonTemplates[reason.id] === 'string' ? denyReasonTemplates[reason.id] : undefined;
      const nextTemplate = submittedValue === undefined ? reason.template : submittedValue.trim();
      return [reason.id, nextTemplate];
    })
  ) as Record<DenyReason, string>;

  if (
    pendingTurnaroundDays === null ||
    !modmailSubject ||
    !pendingBody ||
    !approveHeader ||
    !approveBody ||
    !denyHeader ||
    !removeHeader ||
    !removeBody
  ) {
    throw new Error('All modmail fields are required.');
  }

  for (const reason of existingConfig.denyReasons) {
    if (reason.enabled && !denyReasonTemplateValues[reason.id]) {
      throw new Error(`Denial template is required for ${reason.label}.`);
    }
  }

  await context.redis.hSet(subredditConfigKey(subredditId), {
    [CONFIG_FIELD.pendingTurnaroundDays]: `${pendingTurnaroundDays}`,
    [CONFIG_FIELD.modmailSubject]: modmailSubject,
    [CONFIG_FIELD.pendingBody]: pendingBody,
    [CONFIG_FIELD.alwaysIncludeDenialNotesInModmail]: `${alwaysIncludeDenialNotesInModmail}`,
    [CONFIG_FIELD.approveHeader]: approveHeader,
    [CONFIG_FIELD.approveBody]: approveBody,
    [CONFIG_FIELD.denyHeader]: denyHeader,
    [CONFIG_FIELD.removeHeader]: removeHeader,
    [CONFIG_FIELD.removeBody]: removeBody,
    ...Object.fromEntries(
      Object.entries(denyReasonTemplateValues).map(([reasonId, template]) => [
        DENY_REASON_TEMPLATE_CONFIG_FIELD[reasonId as DenyReason],
        template,
      ])
    ),
  });
}

async function onSaveThemeValues(values: ThemeSettingsValues, context: Devvit.Context): Promise<void> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(context);
  const subredditId = sanitizeSubredditId(context.subredditId);
  await assertCanAccessModeratorSettingsTab(context, subredditName, moderator);

  const preset = parseThemePreset(values.themePreset);
  const useCustomColors = values.useCustomColors === true;
  const customPrimary = normalizeHexColor(values.customPrimary ?? '');
  const customAccent = normalizeHexColor(values.customAccent ?? '');
  const customBackground = normalizeHexColor(values.customBackground ?? '');

  if (useCustomColors && (!customPrimary || !customAccent || !customBackground)) {
    throw new Error('Custom colors must be valid hex values for primary, secondary, and background.');
  }

  await context.redis.hSet(subredditConfigKey(subredditId), {
    [CONFIG_FIELD.themePreset]: preset,
    [CONFIG_FIELD.useCustomColors]: `${useCustomColors}`,
    [CONFIG_FIELD.customPrimary]: customPrimary ?? '',
    [CONFIG_FIELD.customAccent]: customAccent ?? '',
    [CONFIG_FIELD.customBackground]: customBackground ?? '',
  });
}

async function getRuntimeConfig(context: Devvit.Context, subredditId: string): Promise<RuntimeConfig> {
  const key = subredditConfigKey(subredditId);
  const stored = await context.redis.hGetAll(key);
  const rawVerificationsDisabledMessage = await context.settings.get<string>(INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE);
  const rawAutoFlairReconcileEnabled = await context.settings.get<boolean | string>(
    INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED
  );
  const rawAutoDenyShadowbannedEnabled = await context.settings.get<boolean | string>(
    INSTALL_SETTING_AUTO_DENY_SHADOWBANNED_ENABLED
  );
  const rawMultipleApprovalFlairsEnabled = await context.settings.get<boolean | string>(
    INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED
  );
  const rawMaxDenialsBeforeBlock = await context.settings.get<number | string>(INSTALL_SETTING_MAX_DENIALS_BEFORE_BLOCK);
  const rawShowPhotoInstructionsBeforeSubmit = await context.settings.get<boolean | string>(
    INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT
  );
  const verificationsDisabledMessage = normalizeInstallSettingMessage(
    rawVerificationsDisabledMessage,
    VERIFICATIONS_DISABLED_MESSAGE,
    MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH
  );
  const autoFlairReconcileEnabled =
    typeof rawAutoFlairReconcileEnabled === 'boolean'
      ? rawAutoFlairReconcileEnabled
      : parseBooleanString(rawAutoFlairReconcileEnabled, true);
  const autoDenyShadowbannedEnabled =
    typeof rawAutoDenyShadowbannedEnabled === 'boolean'
      ? rawAutoDenyShadowbannedEnabled
      : parseBooleanString(rawAutoDenyShadowbannedEnabled, false);
  const multipleApprovalFlairsEnabled =
    typeof rawMultipleApprovalFlairsEnabled === 'boolean'
      ? rawMultipleApprovalFlairsEnabled
      : parseBooleanString(rawMultipleApprovalFlairsEnabled, false);
  const maxDenialsBeforeBlock = normalizeMaxDenialsBeforeBlockSetting(rawMaxDenialsBeforeBlock);
  const showPhotoInstructionsBeforeSubmit =
    typeof rawShowPhotoInstructionsBeforeSubmit === 'boolean'
      ? rawShowPhotoInstructionsBeforeSubmit
      : parseBooleanString(rawShowPhotoInstructionsBeforeSubmit, false);
  const photoInstructionsEs = normalizeOptionalSettingText(stored[CONFIG_FIELD.photoInstructionsEs]);
  const photoInstructionsFr = normalizeOptionalSettingText(stored[CONFIG_FIELD.photoInstructionsFr]);
  const photoInstructionsPtBr = normalizeOptionalSettingText(stored[CONFIG_FIELD.photoInstructionsPtBr]);
  const photoInstructionsDefaultLanguage = normalizePhotoInstructionLanguage(
    stored[CONFIG_FIELD.photoInstructionsDefaultLanguage]
  );
  const pendingTurnaroundRaw = firstNonEmpty(stored[CONFIG_FIELD.pendingTurnaroundDays]);
  const pendingTurnaroundDays = parsePositiveInt(pendingTurnaroundRaw, DEFAULT_PENDING_TURNAROUND_DAYS);
  const approveBodyRaw = firstNonEmpty(stored[CONFIG_FIELD.approveBody]) ?? DEFAULT_APPROVE_BODY;
  const approveBody = approveBodyRaw.trim() === LEGACY_DEFAULT_APPROVE_BODY ? DEFAULT_APPROVE_BODY : approveBodyRaw;
  const requiredPhotoCount = parseRequiredPhotoCount(stored[CONFIG_FIELD.requiredPhotoCount], DEFAULT_REQUIRED_PHOTO_COUNT);
  const themePreset = parseThemePreset(stored[CONFIG_FIELD.themePreset]);
  const customPrimary = normalizeHexColor(stored[CONFIG_FIELD.customPrimary] ?? '') ?? '';
  const customAccent = normalizeHexColor(stored[CONFIG_FIELD.customAccent] ?? '') ?? '';
  const customBackground = normalizeHexColor(stored[CONFIG_FIELD.customBackground] ?? '') ?? '';
  const flairTemplateCacheTemplateId = normalizeTemplateId(stored[CONFIG_FIELD.flairTemplateCacheTemplateId] ?? '');
  const flairTemplateCacheText = (stored[CONFIG_FIELD.flairTemplateCacheText] ?? '').trim();
  const flairTemplateCacheCheckedAt = parseNonNegativeInt(stored[CONFIG_FIELD.flairTemplateCacheCheckedAt], 0) ?? 0;
  const useCustomColors = parseBooleanString(stored[CONFIG_FIELD.useCustomColors], false);
  const denyReasons = await getConfiguredDenyReasons(context, stored);
  const additionalApprovalFlairs = parseAdditionalApprovalFlairs(stored[CONFIG_FIELD.additionalApprovalFlairs]);

  return {
    verificationsEnabled: parseBooleanString(stored[CONFIG_FIELD.verificationsEnabled], true),
    verificationsDisabledMessage,
    autoFlairReconcileEnabled,
    autoDenyShadowbannedEnabled,
    maxDenialsBeforeBlock,
    requiredPhotoCount,
    photoInstructions: normalizeOptionalSettingText(stored[CONFIG_FIELD.photoInstructions]),
    photoInstructionsEs,
    photoInstructionsFr,
    photoInstructionsPtBr,
    photoInstructionsDefaultLanguage,
    showPhotoInstructionsBeforeSubmit,
    denyReasons,
    pendingTurnaroundDays: pendingTurnaroundDays ?? DEFAULT_PENDING_TURNAROUND_DAYS,
    modmailSubject:
      firstNonEmpty(stored[CONFIG_FIELD.modmailSubject], stored[LEGACY_CONFIG_FIELD.pendingSubject]) ??
      DEFAULT_MODMAIL_SUBJECT,
    pendingBody: firstNonEmpty(stored[CONFIG_FIELD.pendingBody]) ?? DEFAULT_PENDING_BODY,
    alwaysIncludeDenialNotesInModmail: parseBooleanString(
      stored[CONFIG_FIELD.alwaysIncludeDenialNotesInModmail],
      false
    ),
    flairText: firstNonEmpty(stored[CONFIG_FIELD.flairText]) ?? DEFAULT_FLAIR_TEXT,
    flairTemplateId: firstNonEmpty(stored[CONFIG_FIELD.flairTemplateId]) ?? '',
    flairCssClass: firstNonEmpty(stored[CONFIG_FIELD.flairCssClass]) ?? '',
    multipleApprovalFlairsEnabled,
    additionalApprovalFlairs,
    flairTemplateCacheTemplateId,
    flairTemplateCacheText,
    flairTemplateCacheCheckedAt,
    approveHeader:
      firstNonEmpty(stored[CONFIG_FIELD.approveHeader], stored[LEGACY_CONFIG_FIELD.approveSubject]) ??
      DEFAULT_APPROVE_HEADER,
    approveBody,
    denyHeader:
      firstNonEmpty(stored[CONFIG_FIELD.denyHeader], stored[LEGACY_CONFIG_FIELD.denySubject]) ?? DEFAULT_DENY_HEADER,
    removeHeader:
      firstNonEmpty(stored[CONFIG_FIELD.removeHeader], stored[LEGACY_CONFIG_FIELD.removeSubject]) ??
      DEFAULT_REMOVAL_HEADER,
    removeBody: firstNonEmpty(stored[CONFIG_FIELD.removeBody]) ?? DEFAULT_REMOVAL_BODY,
    themePreset,
    useCustomColors,
    customPrimary,
    customAccent,
    customBackground,
  };
}

function parseBooleanString(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

async function getModMenuAuditPurgeMinAgeDays(
  context: Pick<Devvit.Context, 'settings'>
): Promise<number> {
  const rawValue = await context.settings.get<number | string>(INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS);
  return typeof rawValue === 'number'
    ? Number.isFinite(rawValue)
      ? Math.max(0, Math.floor(rawValue))
      : DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS
    : typeof rawValue === 'string'
      ? parseNonNegativeInt(rawValue, DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS) ??
        DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS
      : DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS;
}

function parsePositiveInt(value: string | undefined, fallback: number): number | null {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function normalizeMaxDenialsBeforeBlockSetting(value: number | string | undefined | null): number {
  const parsed =
    typeof value === 'number'
      ? Number.isFinite(value) && Number.isInteger(value)
        ? value
        : null
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : null;
  if (parsed === null || !Number.isFinite(parsed)) {
    return DEFAULT_MAX_DENIALS_BEFORE_BLOCK;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed === 0 || parsed >= MIN_MAX_DENIALS_BEFORE_BLOCK) {
    return parsed;
  }
  return DEFAULT_MAX_DENIALS_BEFORE_BLOCK;
}

function validateMaxDenialsBeforeBlockSetting(value: unknown): string | undefined {
  if (value === undefined) {
    return;
  }
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed === 1
  ) {
    return `Enter 0 to disable auto-block, or a whole number of denials (${MIN_MAX_DENIALS_BEFORE_BLOCK} or greater).`;
  }
}

function parseNonNegativeInt(value: string | undefined | null, fallback: number | null): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseRequiredPhotoCount(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  if (normalized < 1 || normalized > 3) {
    return fallback;
  }

  return normalized;
}

function normalizePhotoInput(value: unknown): string | null {
  const normalizeCandidate = (candidate: unknown): string | null => {
    if (typeof candidate !== 'string') {
      return null;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }
    const lowered = trimmed.toLowerCase();
    if (
      lowered === 'null' ||
      lowered === 'undefined' ||
      lowered === '{}' ||
      lowered === '[]' ||
      lowered === '[object object]'
    ) {
      return null;
    }
    return trimmed;
  };

  const direct = normalizeCandidate(value);
  if (direct) {
    return direct;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as { url?: unknown; mediaUrl?: unknown; value?: unknown };
  return (
    normalizeCandidate(candidate.url) ??
    normalizeCandidate(candidate.mediaUrl) ??
    normalizeCandidate(candidate.value) ??
    null
  );
}

function normalizeSubmittedPhotoUrl(value: unknown): string | null {
  const normalized = normalizePhotoInput(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.trim().toLowerCase();
    if (parsed.protocol !== 'https:' || !SUBMISSION_PHOTO_ALLOWED_HOSTS.has(hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}















function userPendingKeyById(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:user-id:${normalizeUserId(userId)}:pending`;
}

function userLatestKeyById(subredditId: string, userId: string): string {
  return `${subredditScopePrefix(subredditId)}:user-id:${normalizeUserId(userId)}:latest`;
}

































async function getCurrentSubredditNameCompat(
  context: Pick<Devvit.Context, 'reddit'> & { subredditName?: string | null }
): Promise<string> {
  const contextSubredditName = sanitizeSubredditName(typeof context.subredditName === 'string' ? context.subredditName : '');
  if (contextSubredditName) {
    return contextSubredditName;
  }

  const redditClient = context.reddit as Devvit.Context['reddit'] & {
    getCurrentSubredditName?: () => Promise<string>;
    getCurrentSubreddit: () => Promise<{ name?: string | null }>;
  };

  if (typeof redditClient.getCurrentSubredditName === 'function') {
    const subredditName = sanitizeSubredditName(await redditClient.getCurrentSubredditName());
    if (subredditName) {
      return subredditName;
    }
  }

  const subreddit = await redditClient.getCurrentSubreddit();
  return sanitizeSubredditName(typeof subreddit?.name === 'string' ? subreddit.name : '');
}


























function isApprovedRetentionBumpDue(record: VerificationRecord, nowMs = Date.now()): boolean {
  if (record.status !== 'approved') {
    return false;
  }
  const lastTtlBumpAt =
    typeof record.lastTtlBumpAt === 'number' && Number.isFinite(record.lastTtlBumpAt)
      ? Math.max(0, Math.floor(record.lastTtlBumpAt))
      : 0;
  if (lastTtlBumpAt > 0 && nowMs - lastTtlBumpAt < VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS) {
    return false;
  }
  return true;
}


async function bumpViewerVerifiedRecordRetention(
  context: RedisContext,
  subredditId: string,
  viewerUsername: string,
  record: VerificationRecord
): Promise<VerificationRecord> {
  if (record.status !== 'approved' || !usernamesEqual(record.username, viewerUsername)) {
    return record;
  }
  const nowMs = Date.now();
  if (!isApprovedRetentionBumpDue(record, nowMs)) {
    return record;
  }
  const bumpedRecord: VerificationRecord = {
    ...record,
    lastTtlBumpAt: nowMs,
  };
  try {
    await setRecord(context, subredditId, bumpedRecord);
    return bumpedRecord;
  } catch (error) {
    console.log(
      `Drive-by retention bump failed for r/${sanitizeSubredditId(subredditId)} u/${maskUsernameForLog(viewerUsername)}: ${errorText(error)}`
    );
    return record;
  }
}

function applyValidationSchedule(record: VerificationRecord, nowMs: number): VerificationRecord {
  return {
    ...record,
    lastValidatedAt: new Date(nowMs).toISOString(),
    nextValidationAt: addDaysIso(VALIDATION_CHECK_INTERVAL_DAYS, nowMs),
    hardExpireAt: addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, nowMs),
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
  };
}

function initializeValidationScheduleFromRecord(record: VerificationRecord, fallbackNowMs: number): VerificationRecord {
  const reviewedMs = record.reviewedAt ? new Date(record.reviewedAt).getTime() : Number.NaN;
  const submittedMs = new Date(record.submittedAt).getTime();
  const baseMs = Number.isFinite(reviewedMs)
    ? reviewedMs
    : Number.isFinite(submittedMs)
      ? submittedMs
      : fallbackNowMs;
  return {
    ...record,
    lastValidatedAt: new Date(baseMs).toISOString(),
    nextValidationAt: addDaysIso(VALIDATION_CHECK_INTERVAL_DAYS, baseMs),
    hardExpireAt: addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, baseMs),
    validationFailureCount: 0,
    terminalValidationFailureCount: 0,
  };
}

async function upsertValidationTracking(
  context: RedisContext,
  subredditId: string,
  record: VerificationRecord
): Promise<void> {
  if (record.status !== 'approved' || !record.nextValidationAt || !record.hardExpireAt) {
    await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);
    return;
  }

  const dueMs = new Date(record.nextValidationAt).getTime();
  const hardExpireMs = new Date(record.hardExpireAt).getTime();
  if (!Number.isFinite(dueMs) || !Number.isFinite(hardExpireMs)) {
    await removeValidationTrackingForRecordIds(context, subredditId, [record.id]);
    return;
  }

  await context.redis.zAdd(validationDueIndexKey(subredditId), { member: record.id, score: dueMs });
  await context.redis.zAdd(validationHardExpireIndexKey(subredditId), { member: record.id, score: hardExpireMs });
}

async function removeValidationTrackingForRecordIds(
  context: RedisContext,
  subredditId: string,
  recordIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(recordIds.filter((recordId) => recordId.trim().length > 0)));
  if (uniqueIds.length === 0) {
    return;
  }
  await context.redis.zRem(validationDueIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(validationHardExpireIndexKey(subredditId), uniqueIds);
}

async function backfillValidationTracking(
  context: RedisContext,
  subredditId: string,
  batchSize: number
): Promise<void> {
  const cursorRaw = await context.redis.get(validationBackfillCursorKey(subredditId));
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const members = await context.redis.zRange(approvedIndexKey(subredditId), cursor, cursor + batchSize - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) {
    await context.redis.del(validationBackfillCursorKey(subredditId));
    return;
  }

  const recordIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    recordIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const nowMs = Date.now();

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = recordIds[index];
    if (!payload) {
      await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
      continue;
    }
    const record = parseRecord(payload);
    if (!record || record.status !== 'approved') {
      await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
      continue;
    }
    if (record.nextValidationAt && record.hardExpireAt) {
      await upsertValidationTracking(context, subredditId, record);
      continue;
    }
    const initializedRecord = initializeValidationScheduleFromRecord(record, nowMs);
    await setRecord(context, subredditId, initializedRecord);
    await upsertValidationTracking(context, subredditId, initializedRecord);
  }

  await context.redis.set(validationBackfillCursorKey(subredditId), `${cursor + members.length}`);
}



























function normalizeInstallSettingMessage(
  value: string | undefined | null,
  fallback: string,
  maxLength: number
): string {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function normalizeOptionalSettingText(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

function normalizePhotoInstructionLanguage(value: string | undefined | null): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'es' || normalized === 'fr' || normalized === 'pt-br' ? normalized : 'en';
}

function formatPendingTurnaroundDays(days: number): string {
  const normalizedDays = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;
  return `${normalizedDays} ${normalizedDays === 1 ? 'day' : 'days'}`;
}




async function ensureUserValidationSchedule(
  context: SchedulerContext,
  subredditId: string,
  subredditName: string
): Promise<void> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedSubreddit = sanitizeSubredditName(subredditName);
  if (!normalizedSubredditId || !normalizedSubreddit) {
    return;
  }

  const lockKey = validationScheduleLockKey(normalizedSubredditId);
  const presenceKey = validationSchedulePresentKey(normalizedSubredditId);
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  try {
    try {
      if (await context.redis.get(presenceKey)) {
        return;
      }
    } catch {
      // Continue without the presence marker if Redis read-through fails.
    }

    const lock = await context.redis.set(lockKey, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + USER_VALIDATION_SCHEDULE_LOCK_TTL_MS),
    });
    if (lock !== 'OK') {
      return;
    }
    lockAcquired = true;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const jobs = await context.scheduler.listJobs();
        const alreadyScheduled = jobs.some((job) => {
          if (job.name !== USER_VALIDATION_JOB_NAME) {
            return false;
          }
          const jobData = (job.data ?? {}) as Partial<AuditRetentionJobData>;
          return sanitizeSubredditId(jobData.subredditId ?? '') === normalizedSubredditId;
        });

        if (!alreadyScheduled) {
          await context.scheduler.runJob({
            name: USER_VALIDATION_JOB_NAME,
            cron: USER_VALIDATION_CRON,
            data: {
              subredditId: normalizedSubredditId,
              subredditName: normalizedSubreddit,
            },
          });
        }

        try {
          await context.redis.set(presenceKey, '1', {
            expiration: new Date(Date.now() + USER_VALIDATION_SCHEDULE_PRESENT_TTL_MS),
          });
        } catch {
          // Best-effort marker only.
        }
        return;
      } catch (error) {
        if (attempt < 1 && looksLikeTransientRedditTransportError(errorText(error))) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.log(`[user-validation] Failed to schedule validation for r/${normalizedSubreddit}: ${errorText(error)}`);
  } finally {
    if (lockAcquired) {
      await releaseRedisLockIfOwned(context, lockKey, lockToken);
    }
  }
}

async function reconcileApprovedUsersForRetention(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string
): Promise<RetentionReconcileSummary> {
  const lockKey = validationRunLockKey(subredditId);
  const lockToken = createRedisLockToken();
  const lock = await context.redis.set(lockKey, lockToken, {
    nx: true,
    expiration: new Date(Date.now() + 5 * 60 * 1000),
  });
  if (lock !== 'OK') {
    return {
      processed: 0,
      validated: 0,
      purged: 0,
      retried: 0,
      nonApprovedProcessed: 0,
      nonApprovedValidated: 0,
      nonApprovedPurged: 0,
      nonApprovedRetried: 0,
      auditPurged: 0,
      staleIndexEntriesPurged: 0,
      skipped: true,
    };
  }

  try {
    const staleIndexEntriesPurged = await sweepStaleRecordIndexEntries(context, subredditId);
    await backfillValidationTracking(context, subredditId, VALIDATION_BATCH_SIZE);
    const nowMs = Date.now();
    const hardExpired = await context.redis.zRange(validationHardExpireIndexKey(subredditId), 0, nowMs, {
      by: 'score',
      limit: { offset: 0, count: VALIDATION_BATCH_SIZE },
    });
    const due = await context.redis.zRange(validationDueIndexKey(subredditId), 0, nowMs, {
      by: 'score',
      limit: { offset: 0, count: VALIDATION_BATCH_SIZE },
    });
    const candidateIds = Array.from(
      new Set([...hardExpired.map((entry) => entry.member), ...due.map((entry) => entry.member)])
    ).slice(0, VALIDATION_BATCH_SIZE);

    let processed = 0;
    let validated = 0;
    let purged = 0;
    let retried = 0;

    for (const recordId of candidateIds) {
      const record = await getRecord(context, subredditId, recordId);
      if (!record || record.status !== 'approved') {
        await removeValidationTrackingForRecordIds(context, subredditId, [recordId]);
        continue;
      }

      processed += 1;
      const check = await validateVerificationUserState(context, record);
      if (check.outcome === 'valid') {
        const refreshedRecord = applyValidationSchedule(
          {
            ...record,
            validationFailureCount: 0,
            terminalValidationFailureCount: 0,
          },
          nowMs
        );
        await setRecord(context, subredditId, refreshedRecord);
        await upsertValidationTracking(context, subredditId, refreshedRecord);
        validated += 1;
        continue;
      }

      if (check.outcome === 'deleted_or_suspended') {
        const terminalFailures = (record.terminalValidationFailureCount ?? 0) + 1;
        if (terminalFailures < 2) {
          const confirmRecord: VerificationRecord = {
            ...record,
            terminalValidationFailureCount: terminalFailures,
            nextValidationAt: addDaysIso(1, nowMs),
            hardExpireAt:
              typeof record.hardExpireAt === 'string' && Number.isFinite(new Date(record.hardExpireAt).getTime())
                ? record.hardExpireAt
                : addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, nowMs),
          };
          await setRecord(context, subredditId, confirmRecord);
          await upsertValidationTracking(context, subredditId, confirmRecord);
          retried += 1;
          continue;
        }
        await purgeUserVerificationData(context, subredditId, subredditName, record.username, {
          removeFlair: false,
          removeAuditEntries: true,
          clearModerationRecords: true,
        });
        purged += 1;
        continue;
      }

      const currentFailures = (record.validationFailureCount ?? 0) + 1;
      const retryRecord: VerificationRecord = {
        ...record,
        validationFailureCount: currentFailures,
        terminalValidationFailureCount: 0,
        nextValidationAt: addDaysIso(1, nowMs),
        hardExpireAt:
          typeof record.hardExpireAt === 'string' && Number.isFinite(new Date(record.hardExpireAt).getTime())
            ? record.hardExpireAt
            : addDaysIso(VALIDATION_HARD_EXPIRY_DAYS, nowMs),
      };
      await setRecord(context, subredditId, retryRecord);
      await upsertValidationTracking(context, subredditId, retryRecord);
      retried += 1;
    }

    const nonApprovedSummary = await reconcileNonApprovedUsersForRetention(context, subredditId, subredditName);
    const auditPurged = await purgeAuditLogOlderThanDays(context, subredditId, AUDIT_RETENTION_DAYS);

    return {
      processed,
      validated,
      purged,
      retried,
      nonApprovedProcessed: nonApprovedSummary.processed,
      nonApprovedValidated: nonApprovedSummary.validated,
      nonApprovedPurged: nonApprovedSummary.purged,
      nonApprovedRetried: nonApprovedSummary.retried,
      auditPurged,
      staleIndexEntriesPurged,
      skipped: false,
    };
  } finally {
    await releaseRedisLockIfOwned(context, lockKey, lockToken);
  }
}

async function reconcileNonApprovedUsersForRetention(
  context: RedditRedisContext,
  subredditId: string,
  subredditName: string
): Promise<{ processed: number; validated: number; purged: number; retried: number }> {
  const cursorRaw = await context.redis.get(validationNonApprovedCursorKey(subredditId));
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const count = NON_APPROVED_VALIDATION_BATCH_SIZE * NON_APPROVED_VALIDATION_SCAN_MULTIPLIER;
  const members = await context.redis.zRange(historyDateIndexKey(subredditId), cursor, cursor + count - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) {
    await context.redis.del(validationNonApprovedCursorKey(subredditId));
    return { processed: 0, validated: 0, purged: 0, retried: 0 };
  }

  const candidateIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const seenUsernames = new Set<string>();
  const usernamesToCheck: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || parsed.status === 'approved') {
      continue;
    }
    const normalizedUsername = normalizeUsername(parsed.username).replace(/^u\//i, '');
    if (!normalizedUsername || seenUsernames.has(normalizedUsername)) {
      continue;
    }
    seenUsernames.add(normalizedUsername);
    usernamesToCheck.push(parsed.username);
    if (usernamesToCheck.length >= NON_APPROVED_VALIDATION_BATCH_SIZE) {
      break;
    }
  }

  const failureHashKey = validationNonApprovedFailureCountKey(subredditId);
  let processed = 0;
  let validated = 0;
  let purged = 0;
  let retried = 0;

  for (const username of usernamesToCheck) {
    processed += 1;
    const normalizedUsername = normalizeUsername(username).replace(/^u\//i, '');
    if (!normalizedUsername) {
      continue;
    }

    const check = await validateUsernameState(context, normalizedUsername);
    if (check.outcome === 'valid') {
      validated += 1;
      await context.redis.hDel(failureHashKey, [normalizedUsername, `u/${normalizedUsername}`]);
      continue;
    }
    if (check.outcome === 'retry') {
      retried += 1;
      continue;
    }

    const currentFailuresRaw = await context.redis.hGet(failureHashKey, normalizedUsername);
    const currentFailures = Number.parseInt(currentFailuresRaw ?? '0', 10);
    const nextFailures = Number.isFinite(currentFailures) ? currentFailures + 1 : 1;

    if (nextFailures < 2) {
      await context.redis.hSet(failureHashKey, { [normalizedUsername]: `${nextFailures}` });
      retried += 1;
      continue;
    }

    await context.redis.hDel(failureHashKey, [normalizedUsername, `u/${normalizedUsername}`]);
    await purgeUserVerificationData(context, subredditId, subredditName, normalizedUsername, {
      removeFlair: false,
      removeAuditEntries: true,
      clearModerationRecords: true,
    });
    purged += 1;
  }

  const nextCursor = cursor + members.length;
  const totalRecords = await context.redis.zCard(historyDateIndexKey(subredditId));
  if (nextCursor >= totalRecords) {
    await context.redis.del(validationNonApprovedCursorKey(subredditId));
  } else {
    await context.redis.set(validationNonApprovedCursorKey(subredditId), `${nextCursor}`);
  }

  return { processed, validated, purged, retried };
}

async function validateVerificationUserState(
  context: Pick<Devvit.Context, 'reddit'>,
  record: VerificationRecord
): Promise<ValidationCheckResult> {
  return validateUsernameState(context, record.username);
}

async function validateUsernameState(context: Pick<Devvit.Context, 'reddit'>, username: string): Promise<ValidationCheckResult> {
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    return { outcome: 'deleted_or_suspended', reason: 'empty username' };
  }

  try {
    const user = await context.reddit.getUserByUsername(normalizedUsername);
    if (!user) {
      return { outcome: 'deleted_or_suspended', reason: 'lookup returned null user' };
    }
    const maybeSuspended = Boolean((user as unknown as { isSuspended?: boolean }).isSuspended);
    if (maybeSuspended) {
      return { outcome: 'deleted_or_suspended', reason: 'account suspended' };
    }
    return { outcome: 'valid' };
  } catch (error) {
    const message = errorText(error).toLowerCase();
    if (looksLikeDeletedOrSuspendedError(message)) {
      return { outcome: 'deleted_or_suspended', reason: message };
    }
    return { outcome: 'retry', reason: message };
  }
}

function looksLikeDeletedOrSuspendedError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes('user_doesnt_exist')) {
    return true;
  }
  if (normalized.includes('does not exist') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes("doesn't exist") && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('doesnt exist') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('unknown user')) {
    return true;
  }
  if (normalized.includes('not found') && normalized.includes('user')) {
    return true;
  }
  if (normalized.includes('account deleted') || normalized.includes('account is deleted')) {
    return true;
  }
  if (normalized.includes('account suspended') || normalized.includes('user is suspended')) {
    return true;
  }
  return false;
}


function looksLikeTransientRedditTransportError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('unknown internal error') ||
    (normalized.includes('http request') && /http status 5\d\d\b/.test(normalized)) ||
    (normalized.includes('grpc invocation failed') && /\b5\d\d\b/.test(normalized)) ||
    /\b5\d\d\s+internal server error\b/.test(normalized) ||
    normalized.includes('unexpected eof') ||
    normalized.includes('i/o timeout') ||
    normalized.includes('read tcp') ||
    normalized.includes('write tcp') ||
    normalized.includes('upstream request missing or timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('socket hang up') ||
    normalized.includes('econnreset') ||
    normalized.includes('connection reset')
  );
}

async function purgeAuditLogOlderThanDays(
  context: RedisContext,
  subredditId: string,
  retentionDays: number
): Promise<number> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  if (!normalizedSubredditId) {
    return 0;
  }

  const staleCandidates =
    retentionDays <= 0
      ? await context.redis.zRange(auditDateIndexKey(normalizedSubredditId), 0, -1, { by: 'rank' })
      : await context.redis.zRange(
          auditDateIndexKey(normalizedSubredditId),
          0,
          Date.now() - retentionDays * 24 * 60 * 60 * 1000,
          { by: 'score' }
        );
  if (staleCandidates.length === 0) {
    return 0;
  }

  const candidateIds = staleCandidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((auditId) => auditEntryKey(normalizedSubredditId, auditId))
  );
  const missingOrInvalidIds: string[] = [];
  const idsToDelete: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const auditId = candidateIds[index];
    if (!payload) {
      missingOrInvalidIds.push(auditId);
      continue;
    }

    const parsed = parseAuditEntry(payload);
    if (!parsed) {
      missingOrInvalidIds.push(auditId);
      continue;
    }

    if (!parsed.subredditId || sanitizeSubredditId(parsed.subredditId) === normalizedSubredditId) {
      idsToDelete.push(auditId);
    }
  }

  const idsToRemoveFromSet = Array.from(new Set([...missingOrInvalidIds, ...idsToDelete]));
  if (idsToRemoveFromSet.length > 0) {
    await context.redis.zRem(auditDateIndexKey(normalizedSubredditId), idsToRemoveFromSet);
  }

  if (idsToDelete.length > 0) {
    await context.redis.del(...idsToDelete.map((auditId) => auditEntryKey(normalizedSubredditId, auditId)));
  }

  return idsToDelete.length;
}

export {
  assertCanReview,
  DENY_REASON_INSTALL_SETTINGS,
  DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS,
  INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED,
  INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED,
  INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS,
  INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT,
  INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE,
  MAX_DENY_REASON_LABEL_LENGTH,
  MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH,
  THEME_PRESETS,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
  MAX_BATCH_REVIEW_ITEMS,
  buildSubmitVerificationForm,
  deleteVerificationDataFormDefinition,
  toModPanelState,
  toHubState,
  submitVerification,
  onModeratorPurgeUserData,
  withdrawCurrentUserPendingVerification,
  deleteCurrentUserVerificationData,
  approveVerification,
  denyVerification,
  autoDenyShadowbannedSubmission,
  batchReviewVerifications,
  buildBatchReviewToast,
  normalizeBatchReviewVerificationIds,
  setPendingClaimState,
  reopenDeniedVerification,
  cancelReopenedVerification,
  removeApprovedVerificationByModerator,
  loadHubDashboard,
  loadModDashboard,
  getHubModeratorUiState,
  getRuntimeConfig,
  cachePositiveModeratorUiState,
  searchHistoryRecords,
  searchApprovedRecords,
  searchAuditEntries,
  getModeratorStats,
  getCurrentModeratorPermissionList,
  getModeratorAccessSnapshot,
  unblockUserForModerator,
  blockUserForModerator,
  repairMissingAutoBlockForUser,
  onSaveFlairTemplateValues,
  onSaveModmailTemplatesValues,
  onSaveThemeValues,
  getModMenuAuditPurgeMinAgeDays,
  ensureUserValidationSchedule,
  reconcileApprovedUsersForRetention,
  purgeAuditLogOlderThanDays,
  sanitizeSubredditId,
  sanitizeSubredditName,
  getCurrentSubredditNameCompat,
  parseDenyReason,
  parseRecord,
  errorText,
  validateFlairTemplateId,
  validateFlairTemplateIdForSubreddit,
  normalizeMaxDenialsBeforeBlockSetting,
  validateMaxDenialsBeforeBlockSetting,
  resolveThemePalette,
  clearExpiredPendingClaim,
  collectPendingAccountDetailsSnapshot,
  computeUserGrade,
  detectContentCreator,
  extractModmailUserSignals,
  parsePendingAccountDetailsSnapshot,
  buildModeratorUpdateNotice,
  dismissModeratorUpdateNotice,
  getViewerFlairSnapshot,
  checkVerificationFlair,
  shouldViewerDisplayVerifiedState,
  isViewerAwaitingFlairPropagation,
  refreshConfiguredFlairTemplateCache,
  loadApprovalFlairOptionsForSettings,
  getModeratorMembershipError,
  moderatorPermissionLookupNeedsRetry,
  looksLikeInternalModmailArchiveError,
  archivePendingVerificationModmailReply,
  sendUserModmailWithFallback,
  normalizeModmailConversationId,
  normalizeSubmittedPhotoUrl,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  usernameLookupFields,
  toPublicHubConfig,
  releaseRedisLockIfOwned,
  withRedisLock,
};

export type {
  ApprovedSearchResponsePayload,
  AuditRetentionJobData,
  AuditSearchResponsePayload,
  PendingModmailArchiveResult,
  PendingModmailReplyEvent,
  CreatePostValues,
  DeleteDataConfirmValues,
  DeleteDataResult,
  DenyReason,
  FlairTemplateValidationState,
  HubStatePayload,
  ModPanelStatePayload,
  ApprovalFlairOption,
  PendingAccountDetailsSnapshot,
  PublicHubConfig,
  PurgeUserDataFormValues,
  RuntimeConfig,
  SubmitVerificationResult,
  SubmitVerificationValues,
  HubModeratorUiState,
  ThemePalette,
  ThemePresetName,
  UpdateNoticeState,
};

// @core-reexport-start (managed: internal symbols imported by submodules)
export {
  SHADOWBAN_APPEAL_URL,
  addApprovedPrefixIndexEntry,
  asAuditAction,
  assertCanAccessModeratorSettingsTab,
  dedupeNonEmpty,
  formatAuditEntry,
  formatPendingTurnaroundDays,
  getConfiguredDenyReason,
  getDenyReasonDisplayLabel,
  getRecord,
  getViewerIdentitySnapshot,
  logModeratorLookupFailureWithCooldown,
  looksLikeDeletedOrSuspendedError,
  looksLikeTransientRedditTransportError,
  mGetStringValuesInChunks,
  parseAuditEntry,
  parseBooleanString,
  pendingClaimChanged,
  removeApprovedPrefixIndexEntries,
  removeValidationTrackingForRecordIds,
  setRecord,
  toPendingPanelItem,
  userLatestKeyById,
  userPendingKeyById,
};
// @core-reexport-end
