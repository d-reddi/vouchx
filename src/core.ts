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
