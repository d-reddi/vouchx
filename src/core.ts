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
  onModeratorPurgeUserData,
  withdrawCurrentUserPendingVerification,
  deleteCurrentUserVerificationData,
  suppressViewerVerifiedStateAfterSelfRemoval,
  shouldSuppressViewerVerifiedState,
  purgeUserVerificationData,
  findRecordIdsForUserFromModerationIndexes,
  removeUserFlairWithFallbacks,
  isUserFlairCleared,
  removeAllVerificationRecordsForUser,
} from './core/purge.ts';
import {
  preflightReviewTargetAccount,
  buildValidationRetryActionResult,
  buildBannedApprovalConfirmationActionResult,
  removeReviewTargetForInvalidAccount,
  approveVerification,
  removeSupersededDeniedRecord,
  applyApprovalFlairWithFallbacks,
  denyVerification,
  finalizeDeniedVerification,
  AUTO_DENY_SYSTEM_ACTOR,
  SHADOWBAN_APPEAL_URL,
  autoDenyShadowbannedSubmission,
  normalizeBatchReviewVerificationIds,
  emptyBatchReviewCounts,
  classifyBatchReviewItem,
  batchReviewVerifications,
  pluralizeBatchCount,
  buildBatchReviewToast,
  reopenDeniedVerification,
  cancelReopenedVerification,
  removeApprovedVerificationByModerator,
} from './core/review-actions.ts';
import {
  normalizePendingBanStatus,
  parsePendingAccountDetailsSnapshot,
  normalizeCreatorLinkTypeList,
  SCORE_HARD_RISK,
  SCORE_ACCOUNT_UNDER_7_DAYS,
  SCORE_ACCOUNT_UNDER_30_DAYS,
  SCORE_ACCOUNT_OVER_1_YEAR,
  SCORE_ZERO_TOTAL_KARMA,
  SCORE_ZERO_SUBREDDIT_KARMA,
  SCORE_NO_RECENT_ACTIVITY,
  SCORE_LOW_RECENT_ACTIVITY,
  SCORE_VERIFIED_EMAIL,
  SCORE_REDDIT_PREMIUM,
  GRADE_LOW_ENGAGEMENT_THRESHOLD,
  GRADE_TRUSTED_THRESHOLD,
  accountAgeDaysFromSnapshot,
  computeUserGrade,
  CREATOR_SOCIAL_LINK_TYPES,
  CREATOR_LINK_DOMAINS,
  detectContentCreator,
  normalizeSubredditKarmaValue,
  withSingleRetry,
  lookupCurrentSubredditBanStatus,
  collectPendingAccountDetailsSnapshot,
  submitVerification,
  enrichPendingAccountDetailsFromModmail,
} from './core/submission.ts';
import {
  buildSubmitVerificationForm,
  deleteVerificationDataFormDefinition,
  toModPanelState,
  toPublicHubConfig,
  toHubState,
  toPendingPanelItem,
  loadDashboardData,
  loadHubDashboard,
  loadModDashboard,
  getViewerSnapshot,
} from './core/dashboard.ts';
import {
  normalizeUpdateNoticeText,
  normalizeUpdateNoticeUrl,
  normalizeReleaseSeverity,
  readLatestReleaseMetadata,
  buildModeratorUpdateNotice,
  dismissModeratorUpdateNotice,
} from './core/update-notice.ts';
import {
  parseDenyReason,
  formatDenyReasonSlotLabel,
  normalizeDenyReasonLabel,
  getConfiguredDenyReasons,
  getConfiguredDenyReason,
  getDenyReasonDisplayLabel,
  onSaveFlairTemplateValues,
  onSaveModmailTemplatesValues,
  onSaveThemeValues,
  getRuntimeConfig,
  parseBooleanString,
  parsePositiveInt,
  normalizeMaxDenialsBeforeBlockSetting,
  validateMaxDenialsBeforeBlockSetting,
  parseNonNegativeInt,
  parseRequiredPhotoCount,
  normalizePhotoInput,
  normalizeSubmittedPhotoUrl,
  normalizeInstallSettingMessage,
  normalizeOptionalSettingText,
  normalizePhotoInstructionLanguage,
  formatPendingTurnaroundDays,
} from './core/settings.ts';
import {
  pruneHistoryOlderThanDays,
  getModMenuAuditPurgeMinAgeDays,
  isApprovedRetentionBumpDue,
  bumpViewerVerifiedRecordRetention,
  applyValidationSchedule,
  initializeValidationScheduleFromRecord,
  upsertValidationTracking,
  removeValidationTrackingForRecordIds,
  backfillValidationTracking,
  ensureUserValidationSchedule,
  reconcileApprovedUsersForRetention,
  reconcileNonApprovedUsersForRetention,
  validateVerificationUserState,
  validateUsernameState,
  purgeAuditLogOlderThanDays,
} from './core/retention.ts';
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











// Advisory user-scoring weights. Developer-tunable constants (not moderator-configurable),
// consistent with the other VouchX retention/threshold constants.
//
// Prior denied attempts are intentionally NOT part of the grade: a denial reflects submission
// quality (e.g. a bad photo), already drives the separate auto-block counter, and is shown to
// moderators as its own stat. Folding it in double-counted it and mislabeled aged/verified
// accounts as low-history. Shadowban / subreddit-ban are hard-risk overrides that classify as
// Spam Risk regardless of positive signals, so good history cannot dilute a genuine risk signal.


// Pure, deterministic advisory grade. Two intentional exclusions:
//   - Content-creator status: surfaces as a separate informational badge, never affects the grade.
//   - Prior denied attempts: shown as its own stat, never affects the grade (see weight comments).
// Hard-risk signals (shadowban, subreddit ban) short-circuit to Spam Risk so that positive
// history signals can never offset a genuine risk signal.

// Known monetization / adult content-creator platforms. Explicit social-link types plus
// domain matches for links Reddit reports as CUSTOM (Fansly, ManyVids, etc. have no enum type).










// Folds modmail-only signals (shadowban, recent activity) into the pending snapshot after the
// submission modmail is sent. Guarded: re-reads the record and writes only if it is still pending,
// so a concurrent withdrawal/removal cannot be resurrected by this enrichment write.



























// Shared persistence + side effects for a denial, used by both moderator-initiated denials and
// the automated shadowban auto-deny path. The caller builds `reviewedRecord` (status 'denied',
// moderator/actor, denyReason) and supplies the modmail + mod-note senders; this function performs
// the record write, index updates, denial-count increment, block-at-threshold, and audit logging.

// Automated denial of a just-submitted verification when Reddit reports the account as
// shadowbanned and the moderator has opted in. Re-reads the record inside the action lock and
// only acts while it is still pending, so a concurrent withdrawal cannot be resurrected. The
// denial does not count toward the auto-block threshold, and the user-facing modmail explains the
// shadowban and links to Reddit's appeal page.
// Reddit's official appeal page for account actions. Shadowbans are applied by Reddit admins,
// not by the subreddit, so users must appeal to Reddit directly.
























// Normalizes the ConversationUserData embedded in modmail create/reply responses into the
// two signals we score on. isShadowBanned is only reported by modmail (not the User object).

// Attaches modmail user signals to a send result only when at least one signal is present,
// keeping the result minimal when the response carries no embedded user data.







































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
  applyApprovalFlairWithFallbacks,
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
  parseNonNegativeInt,
  pendingClaimChanged,
  purgeUserVerificationData,
  readGlobalUsernameSetting,
  readMergedGlobalUsernameSettings,
  removeAllVerificationRecordsForUser,
  removeApprovedPrefixIndexEntries,
  removeUserFlairWithFallbacks,
  removeValidationTrackingForRecordIds,
  setRecord,
  shouldSuppressViewerVerifiedState,
  toPendingPanelItem,
  userLatestKeyById,
  userPendingKeyById,
};
// @core-reexport-end
