// Public API barrel for the VouchX server. Re-exports the core modules in
// src/core/*. The Express server (src/index.ts) imports everything from here.

export {
  blockUserForModerator,
  repairMissingAutoBlockForUser,
  unblockUserForModerator,
} from './core/blocking.ts';
export {
  DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS,
  DENY_REASON_INSTALL_SETTINGS,
  INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED,
  INSTALL_SETTING_CONTENT_CREATOR_BADGE_ENABLED,
  INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS,
  INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED,
  INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT,
  INSTALL_SETTING_USER_ADVISORY_SCORE_BADGE_ENABLED,
  INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE,
  MAX_BATCH_REVIEW_ITEMS,
  MAX_DENY_REASON_LABEL_LENGTH,
  MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH,
  USER_VALIDATION_CRON,
  USER_VALIDATION_JOB_NAME,
} from './core/constants.ts';
export {
  buildSubmitVerificationForm,
  deleteVerificationDataFormDefinition,
  loadHubDashboard,
  loadModDashboard,
  toHubState,
  toModPanelState,
  toPublicHubConfig,
} from './core/dashboard.ts';
export {
  checkVerificationFlair,
  getViewerFlairSnapshot,
  isViewerAwaitingFlairPropagation,
  loadApprovalFlairOptionsForSettings,
  refreshConfiguredFlairTemplateCache,
  shouldReconcileApprovedViewerFlair,
  shouldViewerDisplayVerifiedState,
  validateFlairTemplateId,
  validateFlairTemplateIdForSubreddit,
} from './core/flair.ts';
export {
  clearExpiredPendingClaim,
  releaseRedisLockIfOwned,
  setPendingClaimState,
  withRedisLock,
} from './core/locks.ts';
export {
  assertCanReview,
  cachePositiveModeratorUiState,
  getCurrentModeratorPermissionList,
  getHubModeratorUiState,
  getModeratorAccessSnapshot,
  getModeratorMembershipError,
  moderatorPermissionLookupNeedsRetry,
} from './core/moderator-access.ts';
export {
  archivePendingVerificationModmailReply,
  extractModmailUserSignals,
  looksLikeInternalModmailArchiveError,
  sendUserModmailWithFallback,
} from './core/modmail.ts';
export {
  errorText,
  getCurrentSubredditNameCompat,
  normalizeModmailConversationId,
  normalizeUsername,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernameLookupFields,
} from './core/normalize.ts';
export {
  deleteCurrentUserVerificationData,
  onModeratorPurgeUserData,
  withdrawCurrentUserPendingVerification,
} from './core/purge.ts';
export {
  parseRecord,
} from './core/records.ts';
export {
  ensureUserValidationSchedule,
  getModMenuAuditPurgeMinAgeDays,
  purgeAuditLogOlderThanDays,
  reconcileApprovedUsersForRetention,
} from './core/retention.ts';
export {
  approveVerification,
  autoDenyShadowbannedSubmission,
  batchReviewVerifications,
  buildBatchReviewToast,
  cancelReopenedVerification,
  denyVerification,
  normalizeBatchReviewVerificationIds,
  removeApprovedVerificationByModerator,
  reopenDeniedVerification,
} from './core/review-actions.ts';
export {
  getModeratorStats,
  searchApprovedRecords,
  searchAuditEntries,
  searchHistoryRecords,
} from './core/search.ts';
export {
  getRuntimeConfig,
  normalizeMaxDenialsBeforeBlockSetting,
  normalizeSubmittedPhotoUrl,
  onSaveFlairTemplateValues,
  onSaveModmailTemplatesValues,
  onSaveThemeValues,
  parseDenyReason,
  validateMaxDenialsBeforeBlockSetting,
} from './core/settings.ts';
export {
  collectPendingAccountDetailsSnapshot,
  computeUserGrade,
  detectContentCreator,
  parsePendingAccountDetailsSnapshot,
  submitVerification,
} from './core/submission.ts';
export {
  THEME_PRESETS,
  resolveThemePalette,
} from './core/theme.ts';
export type {
  ApprovalFlairOption,
  ApprovedSearchResponsePayload,
  AuditRetentionJobData,
  AuditSearchResponsePayload,
  CreatePostValues,
  DeleteDataConfirmValues,
  DeleteDataResult,
  DenyReason,
  FlairTemplateValidationState,
  HubModeratorUiState,
  HubStatePayload,
  ModPanelStatePayload,
  PendingAccountDetailsSnapshot,
  PendingModmailArchiveResult,
  PendingModmailReplyEvent,
  PublicHubConfig,
  PurgeUserDataFormValues,
  RuntimeConfig,
  SubmitVerificationResult,
  SubmitVerificationValues,
  ThemePalette,
  ThemePresetName,
  UpdateNoticeState,
} from './core/types.ts';
export {
  buildModeratorUpdateNotice,
  dismissModeratorUpdateNotice,
} from './core/update-notice.ts';
