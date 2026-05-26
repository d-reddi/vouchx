import type { Devvit } from '@devvit/public-api';

export type VerificationStatus = 'pending' | 'approved' | 'denied' | 'removed';

export type DenyReason = 'reason_1' | 'reason_2' | 'reason_3' | 'reason_4';

export type AuditAction =
  | 'approved'
  | 'denied'
  | 'reopened'
  | 'removed_by_mod'
  | 'self_removed'
  | 'blocked'
  | 'unblocked'
  | 'audit_purged';

export type DenyReasonConfig = {
  id: DenyReason;
  label: string;
  template: string;
  enabled: boolean;
};

export type PublicDenyReasonConfig = Pick<DenyReasonConfig, 'id' | 'label' | 'enabled'>;

export type DenyReasonSlotDefinition = {
  id: DenyReason;
  labelSettingName: string;
  templateConfigFieldName: string;
  defaultLabel: string;
  defaultTemplate: string;
};

export type BlockScope = 'subreddit' | 'global';

export type BlockedUserEntry = {
  username: string;
  blockedAt: string;
  deniedCount: number;
  reason: string;
  scope?: BlockScope;
};

export type DeveloperPanelPayload = {
  accessGranted: true;
  currentUsernames: string[];
  invalidTokens: string[];
  canonicalValue: string;
};

export type UserGrade = 'trusted' | 'normal' | 'low_engagement' | 'spam_risk';

export type UserGradeResult = {
  grade: UserGrade;
  score: number;
  reasons: string[];
};

export type PendingAccountDetailsSnapshot = {
  capturedAt: string;
  accountCreatedAt: string | null;
  totalKarma: number | null;
  subredditKarma: number | null;
  previousDeniedAttempts: number;
  banStatus: 'banned' | 'not_banned' | 'unknown';
  hasVerifiedEmail: boolean | null;
  hasRedditPremium: boolean | null;
  isShadowBanned: boolean | null;
  recentActivityCount: number | null;
  socialLinkCount: number;
  isContentCreator: boolean;
  creatorLinkTypes: string[];
};

export type VerificationRecord = {
  id: string;
  username: string;
  userId?: string;
  subredditId: string;
  subredditName: string;
  ageAcknowledgedAt: string;
  adultOnlySelfPhotosConfirmedAt?: string | null;
  termsAcceptedAt?: string | null;
  submittedAt: string;
  photoOneUrl: string;
  photoTwoUrl: string;
  photoThreeUrl?: string;
  status: VerificationStatus;
  moderator: string | null;
  reviewedAt: string | null;
  denyReason: DenyReason | null;
  denyNotes: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  parentVerificationId?: string | null;
  isResubmission?: boolean;
  accountDetails?: PendingAccountDetailsSnapshot | null;
  removedAt?: string | null;
  removedBy?: string | null;
  lastValidatedAt?: string | null;
  nextValidationAt?: string | null;
  hardExpireAt?: string | null;
  validationFailureCount?: number;
  terminalValidationFailureCount?: number;
  lastTtlBumpAt?: number | null;
  lastAppliedFlairTemplateId?: string | null;
  lastFlairReconcileAt?: number | null;
};

export type AuditLogEntry = {
  id: string;
  subredditId: string;
  subredditName: string;
  username: string;
  action: AuditAction;
  actor: string;
  at: string;
  verificationId?: string;
  notes?: string;
};

export type RuntimeConfig = {
  verificationsEnabled: boolean;
  verificationsDisabledMessage: string;
  autoFlairReconcileEnabled: boolean;
  autoDenyShadowbannedEnabled: boolean;
  maxDenialsBeforeBlock: number;
  requiredPhotoCount: number;
  photoInstructions: string;
  photoInstructionsEs: string;
  photoInstructionsFr: string;
  photoInstructionsPtBr: string;
  photoInstructionsDefaultLanguage: string;
  showPhotoInstructionsBeforeSubmit: boolean;
  denyReasons: DenyReasonConfig[];
  pendingTurnaroundDays: number;
  modmailSubject: string;
  pendingBody: string;
  alwaysIncludeDenialNotesInModmail: boolean;
  flairText: string;
  flairTemplateId: string;
  flairCssClass: string;
  multipleApprovalFlairsEnabled: boolean;
  additionalApprovalFlairs: ApprovalFlairConfig[];
  flairTemplateCacheTemplateId: string;
  flairTemplateCacheText: string;
  flairTemplateCacheCheckedAt: number;
  approveHeader: string;
  approveBody: string;
  denyHeader: string;
  removeHeader: string;
  removeBody: string;
  themePreset: ThemePresetName;
  useCustomColors: boolean;
  customPrimary: string;
  customAccent: string;
  customBackground: string;
};

export type ApprovalFlairConfig = {
  templateId: string;
  label: string;
  text: string;
};

export type ThemePresetName =
  | 'coastal_light'
  | 'sunset_pop'
  | 'mint_modern'
  | 'classic_news'
  | 'midnight_slate'
  | 'blue_coral'
  | 'desert'
  | 'colorful';

export type ThemeTokens = {
  primary: string;
  accent: string;
  success: string;
  danger: string;
  bg: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
};

export type ThemePalette = {
  light: ThemeTokens;
  dark: ThemeTokens;
};

export type UserSnapshot = {
  accountAgeDays: number | null;
  totalKarma: number | null;
};

export type ViewerIdentityState = 'confirmed' | 'anonymous' | 'unavailable';

export type ViewerIdentitySnapshot = {
  state: ViewerIdentityState;
  userId: string;
  username: string | null;
  user: Awaited<ReturnType<Devvit.Context['reddit']['getCurrentUser']>> | null;
  error: string | null;
};

export type DashboardData = {
  viewerUsername: string | null;
  subredditName: string;
  moderatorAccess: ModeratorAccessSnapshot;
  isModerator: boolean;
  canReview: boolean;
  canManageUsers: boolean;
  canOpenInstallSettings: boolean;
  hasConfigAccess: boolean;
  canAccessSettingsTab: boolean;
  flairTemplateValidation: FlairTemplateValidationState;
  requiresInitialSetup: boolean;
  config: RuntimeConfig;
  viewerSnapshot: UserSnapshot;
  viewerShouldDisplayVerified: boolean;
  viewerAwaitingFlairPropagation: boolean;
  viewerVerifiedByFlair: boolean;
  viewerFlairConfiguredTemplateId: string;
  viewerFlairDetectedTemplateId: string;
  viewerFlairCheckSource: string;
  viewerFlairCheckError: string | null;
  viewerCurrentFlairText: string;
  viewerCurrentFlairCssClass: string;
  userLatest: VerificationRecord | null;
  viewerBlocked: BlockedUserEntry | null;
  developerPanel?: DeveloperPanelPayload;
  pendingCount: number;
  pending: VerificationRecord[];
  approved: ApprovedSearchPanelItem[];
  blocked: BlockedUserEntry[];
  auditLog: AuditSearchPanelItem[];
  storage: StorageUsage;
  approvedHasMore: boolean;
  auditHasMore: boolean;
};

export type FlairVerificationCheck = {
  verified: boolean;
  configuredTemplateId: string;
  detectedTemplateId: string;
  source: string;
  error: string | null;
};

export type ViewerFlairLookupState = 'confirmed_present' | 'confirmed_absent' | 'unavailable';

export type ViewerFlairSnapshot = {
  flairText: string;
  flairCssClass: string;
  flairTemplateId: string;
  userId: string;
  lookupState: ViewerFlairLookupState;
  error: string | null;
};

export type ModeratorLookupState = 'confirmed' | 'cached' | 'denied' | 'unknown';

export type ModeratorPermissionState = 'confirmed' | 'cached' | 'unknown';

export type ModeratorAccessSnapshot = {
  state: ModeratorLookupState;
  permissionState: ModeratorPermissionState;
  isModerator: boolean;
  permissions: string[];
};

export type HubModeratorUiState = {
  buttonVisible: boolean;
  isModerator: boolean;
  canReview: boolean;
  pendingCount: number;
};

export type SubmitVerificationValues = {
  is18Confirmed: boolean;
  adultOnlySelfPhotosConfirmed: boolean;
  termsAccepted: boolean;
  photoOneUrl: string;
  photoTwoUrl: string;
  photoThreeUrl?: string;
};

export type SubmitVerificationFormData = {
  requiredPhotoCount?: number;
};

export type CreatePostValues = {
  postTitle?: string;
};

export type PurgeUserDataFormValues = {
  confirmationText?: string;
};

export type AuditRetentionJobData = {
  subredditId: string;
  subredditName: string;
};

export type RetentionReconcileSummary = {
  processed: number;
  validated: number;
  purged: number;
  retried: number;
  nonApprovedProcessed: number;
  nonApprovedValidated: number;
  nonApprovedPurged: number;
  nonApprovedRetried: number;
  auditPurged: number;
  staleIndexEntriesPurged: number;
  skipped: boolean;
};

export type ValidationCheckResult =
  | { outcome: 'valid' }
  | { outcome: 'deleted_or_suspended'; reason: string }
  | { outcome: 'retry'; reason: string };

export type RedisContext = Pick<Devvit.Context, 'redis'>;

export type RedditRedisContext = Pick<Devvit.Context, 'redis' | 'reddit'>;

export type SchedulerContext = Pick<Devvit.Context, 'redis' | 'scheduler'>;

export type ReviewActionKind = 'approval' | 'denial';

export type ActionOutcome = 'completed' | 'invalid_account_removed' | 'validation_retry' | 'banned_confirmation_required';

export type FlairStepResult = {
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
};

export type ModmailUserSignals = {
  isShadowBanned: boolean | null;
  recentActivityCount: number | null;
};

export type ModmailStepResult = {
  status: 'created' | 'replied' | 'failed' | 'skipped';
  reason?: string;
  conversationId?: string;
  userData?: ModmailUserSignals;
};

export type PendingModmailReplyEvent = {
  messageAuthor?: {
    id?: string;
    name?: string;
  };
  message_author?: {
    id?: string;
    name?: string;
  };
  messageAuthorType?: string;
  message_author_type?: string;
  conversationState?: string;
  conversation_state?: string;
  conversationType?: string;
  conversation_type?: string;
  isAutoGenerated?: boolean;
  is_auto_generated?: boolean;
  conversationSubreddit?: {
    id?: string;
    name?: string;
  };
  conversation_subreddit?: {
    id?: string;
    name?: string;
  };
  destinationSubreddit?: {
    id?: string;
    name?: string;
  };
  destination_subreddit?: {
    id?: string;
    name?: string;
  };
  conversationId?: string;
  conversation_id?: string;
  messageId?: string;
  message_id?: string;
};

export type PendingModmailArchiveResult = {
  archived: boolean;
  reason?: string;
  conversationId?: string;
  username?: string;
  verificationId?: string;
};

export type ModNoteStepResult = {
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
};

export type ManualBlockOutcome = {
  status: 'blocked' | 'already_blocked' | 'failed';
  username?: string;
  reason?: string;
};

export type ActionResult = {
  outcome: ActionOutcome;
  applied: boolean;
  outcomeReason?: string;
  username?: string;
  denyReasonLabel?: string;
  flair: FlairStepResult;
  modmail: ModmailStepResult;
  modNote: ModNoteStepResult;
  userBlocked?: boolean;
  denialCount?: number;
  manualBlockOutcome?: ManualBlockOutcome;
};

export type BatchReviewAction = 'approve' | 'deny';

export type BatchReviewItemStatus =
  | 'completed'
  | 'failed'
  | 'validation_retry'
  | 'invalid_account_removed'
  | 'banned_confirmation_required';

export type NormalizedBatchReviewIds = {
  ids: string[];
  duplicateOrEmptyCount: number;
  truncatedCount: number;
};

export type BatchReviewItemResult = {
  verificationId: string;
  status: BatchReviewItemStatus;
  terminal: boolean;
  username?: string;
  message?: string;
};

export type BatchReviewResult = {
  action: BatchReviewAction;
  requestedCount: number;
  acceptedCount: number;
  duplicateOrEmptyCount: number;
  truncatedCount: number;
  terminalVerificationIds: string[];
  counts: Record<BatchReviewItemStatus, number>;
  items: BatchReviewItemResult[];
};

export type BatchReviewToast = {
  text: string;
  tone: 'success' | 'error' | 'info';
};

export type DeleteDataResult = {
  deletedCount: number;
  flairRemovedFrom: string[];
  flairRemovalFailedFor: string[];
};

export type PurgeUserDataResult = DeleteDataResult & {
  purgedAuditCount: number;
  removedBlockCount: number;
  removedDenialCount: number;
  touchedSubreddits: string[];
};

export type DeleteDataConfirmValues = {
  confirmDelete?: boolean;
};

export type FlairTemplateFormValues = {
  verificationsEnabled?: boolean;
  requiredPhotoCount?: number;
  photoInstructions?: string;
  photoInstructionsEs?: string;
  photoInstructionsFr?: string;
  photoInstructionsPtBr?: string;
  photoInstructionsDefaultLanguage?: string;
  flairTemplateId?: string;
  flairCssClass?: string;
  multipleApprovalFlairsEnabled?: boolean;
  additionalApprovalFlairs?: ApprovalFlairConfig[];
};

export type ModmailTemplatesFormData = {
  pendingTurnaroundDays?: string;
  modmailSubject?: string;
  pendingBody?: string;
  alwaysIncludeDenialNotesInModmail?: boolean;
  approveHeader?: string;
  approveBody?: string;
  denyHeader?: string;
  denyReasonTemplates?: Partial<Record<DenyReason, string>>;
  removeHeader?: string;
  removeBody?: string;
};

export type ModmailTemplatesFormValues = ModmailTemplatesFormData;

export type ThemeSettingsValues = {
  themePreset?: string;
  useCustomColors?: boolean;
  customPrimary?: string;
  customAccent?: string;
  customBackground?: string;
};

export type FlairTemplateValidationState = {
  isValid: boolean;
  code: 'valid' | 'missing' | 'invalid_format' | 'not_found' | 'lookup_failed';
  message: string;
};

export type ApprovalFlairOption = {
  id: string;
  text: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

export type UserFlairTemplateSummary = {
  id: string;
  text: string;
  modOnly: boolean;
  backgroundColor: string;
  textColor: string;
};

export type FlairApplyResult = {
  applied: boolean;
  appliedTemplateId?: string;
  error?: string;
};

export type StorageUsage = {
  estimatedBytes: number;
  capBytes: number;
  percent: number;
  recordCount: number;
  auditCount: number;
  blockedCount: number;
  deniedCountEntries: number;
};

export type PendingPanelItem = {
  id: string;
  username: string;
  submittedAt: string;
  acknowledgedAt: string;
  photoOneUrl: string;
  photoTwoUrl: string;
  photoThreeUrl?: string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  parentVerificationId?: string | null;
  isResubmission?: boolean;
  accountDetails?: PendingAccountDetailsDisplay | null;
};

export type PendingAccountDetailsDisplay = PendingAccountDetailsSnapshot & UserGradeResult;

export type SearchPhotoLinkFields = {
  photoOneUrl?: string;
  photoTwoUrl?: string;
  photoThreeUrl?: string;
};

export type ApprovedSearchPanelItem = SearchPhotoLinkFields & {
  id: string;
  username: string;
  approvedAt: string;
  approvedBy: string;
  acknowledgedAt: string;
};

export type ApprovedSearchResponsePayload = {
  items: ApprovedSearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

export type AuditSearchPanelItem = SearchPhotoLinkFields & {
  id: string;
  username: string;
  actor: string;
  action: AuditAction;
  line: string;
  at: string;
};

export type AuditSearchResponsePayload = {
  items: AuditSearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

export type ModeratorStatsRange = 'weekly' | 'monthly';

export type ModeratorStatsLeader = {
  moderator: string;
  count: number;
};

export type ModeratorStatsModeratorRow = {
  moderator: string;
  approvals: number;
  denials: number;
  reopens: number;
  totalActions: number;
};

export type ModeratorStatsPayload = {
  range: ModeratorStatsRange;
  generatedAt: string;
  summary: {
    currentlyVerified: number;
    approvals: number;
    denials: number;
    reopens: number;
    activeModerators: number;
  };
  leaders: {
    topApprover: ModeratorStatsLeader | null;
    topDenier: ModeratorStatsLeader | null;
  };
  moderators: ModeratorStatsModeratorRow[];
};

export type AuditWindowCandidate = {
  id: string;
  entry: AuditLogEntry | null;
};

export type HistorySearchPanelItem = SearchPhotoLinkFields & {
  id: string;
  username: string;
  status: VerificationStatus;
  submittedAt: string;
  acknowledgedAt: string;
  reviewedAt: string | null;
  moderator: string | null;
  denyReason?: DenyReason | null;
  parentVerificationId?: string | null;
  reopenedChildId?: string | null;
  reopenedState?: 'none' | 'yes' | 'yes_cancelled';
};

export type HistorySearchResponsePayload = {
  items: HistorySearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

export type ModPanelStatePayload = {
  viewerUsername: string | null;
  subredditName: string;
  canOpenInstallSettings: boolean;
  hasConfigAccess: boolean;
  canAccessSettingsTab: boolean;
  flairTemplateValidation: FlairTemplateValidationState;
  pendingCount: number;
  pending: PendingPanelItem[];
  approved: ApprovedSearchPanelItem[];
  approvedHasMore: boolean;
  auditLog: AuditSearchPanelItem[];
  auditHasMore: boolean;
  blocked: BlockedUserEntry[];
  storage: StorageUsage;
  config: RuntimeConfig;
  resolvedTheme: ThemePalette;
  themePresets: Record<ThemePresetName, ThemePalette>;
  updateNotice?: UpdateNoticeState | null;
};

export type UpdateNoticeState = {
  targetVersion: string;
  critical: boolean;
  title: string | null;
  notes: string | null;
  linkUrl: string | null;
};

export type PublicHubConfig = {
  verificationsEnabled: boolean;
  verificationsDisabledMessage: string;
  photoInstructions: string;
  photoInstructionsEs: string;
  photoInstructionsFr: string;
  photoInstructionsPtBr: string;
  photoInstructionsDefaultLanguage: string;
  showPhotoInstructionsBeforeSubmit: boolean;
  pendingTurnaroundDays: number;
  denyReasons: PublicDenyReasonConfig[];
};

export type HubStatePayload = {
  viewerUsername: string | null;
  subredditName: string;
  isModerator: boolean;
  canReview: boolean;
  requiresInitialSetup: boolean;
  config: PublicHubConfig;
  viewerShouldDisplayVerified: boolean;
  viewerAwaitingFlairPropagation: boolean;
  viewerVerifiedByFlair: boolean;
  viewerFlairCheckSource: string;
  viewerBlocked: BlockedUserEntry | null;
  developerPanel?: DeveloperPanelPayload;
  userLatest: VerificationRecord | null;
  pendingCount: number;
  resolvedTheme: ThemePalette;
  themePresets: Record<ThemePresetName, ThemePalette>;
};

export type ReleaseMetadata = {
  version: string;
  critical: boolean;
  title: string | null;
  notes: string | null;
  linkUrl: string | null;
};

export type SubmitVerificationResult = {
  pendingModmail: ModmailStepResult;
};

export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  playtestRevision: number;
  normalized: string;
};

export type ContentCreatorDetection = {
  socialLinkCount: number;
  isContentCreator: boolean;
  creatorLinkTypes: string[];
};

export type RgbColor = { r: number; g: number; b: number };
