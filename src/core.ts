import type { Devvit, FormOnSubmitEvent } from '@devvit/public-api';

type VerificationStatus = 'pending' | 'approved' | 'denied' | 'removed';
type DenyReason = 'reason_1' | 'reason_2' | 'reason_3' | 'reason_4';
type AuditAction = 'approved' | 'denied' | 'reopened' | 'removed_by_mod' | 'self_removed' | 'blocked' | 'unblocked';

type DenyReasonConfig = {
  id: DenyReason;
  label: string;
  template: string;
  enabled: boolean;
};

type PublicDenyReasonConfig = Pick<DenyReasonConfig, 'id' | 'label' | 'enabled'>;

type DenyReasonSlotDefinition = {
  id: DenyReason;
  labelSettingName: string;
  templateConfigFieldName: string;
  defaultLabel: string;
  defaultTemplate: string;
};

type BlockedUserEntry = {
  username: string;
  blockedAt: string;
  deniedCount: number;
  reason: string;
};

type PendingAccountDetailsSnapshot = {
  capturedAt: string;
  accountCreatedAt: string | null;
  totalKarma: number | null;
  subredditKarma: number | null;
  previousDeniedAttempts: number;
  banStatus: 'banned' | 'not_banned' | 'unknown';
};

type VerificationRecord = {
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

type AuditLogEntry = {
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

type RuntimeConfig = {
  verificationsEnabled: boolean;
  verificationsDisabledMessage: string;
  autoFlairReconcileEnabled: boolean;
  maxDenialsBeforeBlock: number;
  requiredPhotoCount: number;
  photoInstructions: string;
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

type ApprovalFlairConfig = {
  templateId: string;
  label: string;
  text: string;
};

type ThemePresetName =
  | 'coastal_light'
  | 'sunset_pop'
  | 'mint_modern'
  | 'classic_news'
  | 'midnight_slate'
  | 'blue_coral'
  | 'desert'
  | 'colorful';

type ThemeTokens = {
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

type ThemePalette = {
  light: ThemeTokens;
  dark: ThemeTokens;
};

type UserSnapshot = {
  accountAgeDays: number | null;
  totalKarma: number | null;
};

type DashboardData = {
  viewerUsername: string | null;
  subredditName: string;
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
  viewerVerifiedByFlair: boolean;
  viewerFlairConfiguredTemplateId: string;
  viewerFlairDetectedTemplateId: string;
  viewerFlairCheckSource: string;
  viewerFlairCheckError: string | null;
  viewerCurrentFlairText: string;
  viewerCurrentFlairCssClass: string;
  userLatest: VerificationRecord | null;
  viewerBlocked: BlockedUserEntry | null;
  pendingCount: number;
  pending: VerificationRecord[];
  approved: ApprovedSearchPanelItem[];
  blocked: BlockedUserEntry[];
  auditLog: AuditSearchPanelItem[];
  storage: StorageUsage;
  approvedHasMore: boolean;
  auditHasMore: boolean;
};

type FlairVerificationCheck = {
  verified: boolean;
  configuredTemplateId: string;
  detectedTemplateId: string;
  source: string;
  error: string | null;
};

type ViewerFlairSnapshot = {
  flairText: string;
  flairCssClass: string;
  flairTemplateId: string;
  userId: string;
};

type ModeratorAccessSnapshot = {
  isModerator: boolean;
  permissions: string[];
};

type SubmitVerificationValues = {
  is18Confirmed: boolean;
  adultOnlySelfPhotosConfirmed: boolean;
  termsAccepted: boolean;
  photoOneUrl: string;
  photoTwoUrl: string;
  photoThreeUrl?: string;
};

type SubmitVerificationFormData = {
  requiredPhotoCount?: number;
};

type CreatePostValues = {
  postTitle?: string;
};

type PurgeUserDataFormValues = {
  confirmationText?: string;
};

type AuditRetentionJobData = {
  subredditId: string;
  subredditName: string;
};

type RetentionReconcileSummary = {
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

type ValidationCheckResult =
  | { outcome: 'valid' }
  | { outcome: 'deleted_or_suspended'; reason: string }
  | { outcome: 'retry'; reason: string };

type RedisContext = Pick<Devvit.Context, 'redis'>;
type RedditRedisContext = Pick<Devvit.Context, 'redis' | 'reddit'>;
type SchedulerContext = Pick<Devvit.Context, 'redis' | 'scheduler'>;
type ReviewActionKind = 'approval' | 'denial';
type ActionOutcome = 'completed' | 'invalid_account_removed' | 'validation_retry' | 'banned_confirmation_required';

type FlairStepResult = {
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
};

type ModmailStepResult = {
  status: 'created' | 'replied' | 'failed' | 'skipped';
  reason?: string;
  conversationId?: string;
};

type ModNoteStepResult = {
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
};

type ActionResult = {
  outcome: ActionOutcome;
  applied: boolean;
  outcomeReason?: string;
  username?: string;
  flair: FlairStepResult;
  modmail: ModmailStepResult;
  modNote: ModNoteStepResult;
  userBlocked?: boolean;
  denialCount?: number;
};

type DeleteDataResult = {
  deletedCount: number;
  flairRemovedFrom: string[];
  flairRemovalFailedFor: string[];
};

type PurgeUserDataResult = DeleteDataResult & {
  purgedAuditCount: number;
  removedBlockCount: number;
  removedDenialCount: number;
  touchedSubreddits: string[];
};

type DeleteDataConfirmValues = {
  confirmDelete?: boolean;
};

type FlairTemplateFormValues = {
  verificationsEnabled?: boolean;
  requiredPhotoCount?: number;
  photoInstructions?: string;
  flairTemplateId?: string;
  flairCssClass?: string;
  multipleApprovalFlairsEnabled?: boolean;
  additionalApprovalFlairs?: ApprovalFlairConfig[];
};

type ModmailTemplatesFormData = {
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

type ModmailTemplatesFormValues = ModmailTemplatesFormData;

type ThemeSettingsValues = {
  themePreset?: string;
  useCustomColors?: boolean;
  customPrimary?: string;
  customAccent?: string;
  customBackground?: string;
};

type FlairTemplateValidationState = {
  isValid: boolean;
  code: 'valid' | 'missing' | 'invalid_format' | 'not_found' | 'lookup_failed';
  message: string;
};

type ApprovalFlairOption = {
  id: string;
  text: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

type UserFlairTemplateSummary = {
  id: string;
  text: string;
  modOnly: boolean;
  backgroundColor: string;
  textColor: string;
};

type FlairApplyResult = {
  applied: boolean;
  appliedTemplateId?: string;
  error?: string;
};

type StorageUsage = {
  estimatedBytes: number;
  capBytes: number;
  percent: number;
  recordCount: number;
  auditCount: number;
  blockedCount: number;
  deniedCountEntries: number;
};

type PendingPanelItem = {
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
  accountDetails?: PendingAccountDetailsSnapshot | null;
};

type ApprovedSearchPanelItem = {
  id: string;
  username: string;
  approvedAt: string;
  approvedBy: string;
  acknowledgedAt: string;
};

type ApprovedSearchResponsePayload = {
  items: ApprovedSearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

type AuditSearchPanelItem = {
  id: string;
  username: string;
  actor: string;
  action: AuditAction;
  line: string;
  at: string;
};

type AuditSearchResponsePayload = {
  items: AuditSearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

type HistorySearchPanelItem = {
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

type HistorySearchResponsePayload = {
  items: HistorySearchPanelItem[];
  offset: number;
  hasMore: boolean;
  requestId: number;
};

type ModPanelStatePayload = {
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

type UpdateNoticeState = {
  targetVersion: string;
  critical: boolean;
  title: string | null;
  notes: string | null;
  linkUrl: string | null;
};

type PublicHubConfig = {
  verificationsEnabled: boolean;
  verificationsDisabledMessage: string;
  photoInstructions: string;
  showPhotoInstructionsBeforeSubmit: boolean;
  pendingTurnaroundDays: number;
  denyReasons: PublicDenyReasonConfig[];
};

type HubStatePayload = {
  viewerUsername: string | null;
  subredditName: string;
  isModerator: boolean;
  canReview: boolean;
  requiresInitialSetup: boolean;
  config: PublicHubConfig;
  viewerVerifiedByFlair: boolean;
  viewerFlairCheckSource: string;
  viewerBlocked: BlockedUserEntry | null;
  userLatest: VerificationRecord | null;
  pendingCount: number;
  resolvedTheme: ThemePalette;
  themePresets: Record<ThemePresetName, ThemePalette>;
};

type ReleaseMetadata = {
  version: string;
  critical: boolean;
  title: string | null;
  notes: string | null;
  linkUrl: string | null;
};

type SubmitVerificationResult = {
  pendingModmail: ModmailStepResult;
};

const APP_KEY_PREFIX = 'photo-verification';
const SUBREDDIT_KEY_PREFIX = 'subreddit';

const MAX_PENDING_TO_LOAD = 150;
const SELF_DELETE_INDEX_SCAN_LIMIT = 1000;
const MIN_MAX_DENIALS_BEFORE_BLOCK = 2;
const DEFAULT_MAX_DENIALS_BEFORE_BLOCK = 3;
const VALIDATION_CHECK_INTERVAL_DAYS = 30;
const VALIDATION_HARD_EXPIRY_DAYS = 45;
const VALIDATION_BATCH_SIZE = 50;
const NON_APPROVED_VALIDATION_BATCH_SIZE = 25;
const NON_APPROVED_VALIDATION_SCAN_MULTIPLIER = 4;
const STALE_RECORD_INDEX_SWEEP_BATCH_SIZE = 200;
const UPDATE_NOTICE_DISMISS_TTL_DAYS = 7;
const APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER = 4;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const HISTORY_RETENTION_DAYS = 45;
const AUDIT_RETENTION_DAYS = 45;
const VERIFIED_RECORD_RETENTION_DAYS = 45;
const VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS = MILLIS_PER_DAY;
const FLAIR_TEMPLATE_CACHE_REFRESH_INTERVAL_MS = MILLIS_PER_DAY;
const VIEWER_FLAIR_RECONCILE_INTERVAL_MS = MILLIS_PER_DAY;
const DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS = 3;
const INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS = 'mod_menu_audit_purge_days';
const INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE = 'verifications_disabled_message';
const INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED = 'auto_flair_reconcile_enabled';
const INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED = 'multiple_approval_flairs_enabled';
const INSTALL_SETTING_MAX_DENIALS_BEFORE_BLOCK = 'max_denials_before_block';
const INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT = 'show_photo_instructions_before_submit';
const INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS = 'settings_tab_requires_config_access';
const GLOBAL_SETTING_LATEST_RELEASE_VERSION = 'play_latest_release_version';
const GLOBAL_SETTING_LATEST_RELEASE_TITLE = 'play_latest_release_title';
const GLOBAL_SETTING_LATEST_RELEASE_NOTES = 'play_latest_release_notes';
const GLOBAL_SETTING_LATEST_RELEASE_LINK = 'play_latest_release_link';
const GLOBAL_SETTING_LATEST_RELEASE_SEVERITY = 'play_latest_release_severity';
const MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH = 200;
const MAX_DENY_REASON_LABEL_LENGTH = 48;
const PENDING_CLAIM_TTL_MS = 15 * 60 * 1000;
const VERIFICATION_ACTION_LOCK_TTL_MS = 45000;
const SUBMISSION_PHOTO_ALLOWED_HOSTS = new Set([
  'i.redd.it',
  'preview.redd.it',
  'i.reddituploads.com',
  'reddit-uploaded-media.s3-accelerate.amazonaws.com',
  'reddit-uploaded-media.s3.amazonaws.com',
]);
const MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER = 'css-substring-match';
const MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER = 'css-wildcard-match';
const DEFAULT_GENERIC_DENY_REASON_TEMPLATE =
  'Hi u/{{username}},\n\nWe could not approve your verification at this time.\n\n{{denial_notes}}\n\nPlease review the instructions and resubmit.\n\nThe moderation team';
const MODMAIL_DENIAL_NOTES_PREFIX = 'Moderator Notes:';
const DENIAL_NOTES_PLACEHOLDER_KEY = 'denial_notes';
const LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY = 'reason';
const DENIAL_NOTES_BLOCK_MARKER = '__vouchx_denial_notes_block__';
const DENY_REASON_INSTALL_SETTINGS: readonly DenyReasonSlotDefinition[] = [
  {
    id: 'reason_1',
    labelSettingName: 'deny_reason_1_label',
    templateConfigFieldName: 'deny_reason_1_template',
    defaultLabel: 'Altered or edited image',
    defaultTemplate:
      'Hi u/{{username}},\n\nWe could not approve your verification because the image appears edited.\n\nYou can resubmit with unedited photos.\n\nThe moderation team',
  },
  {
    id: 'reason_2',
    labelSettingName: 'deny_reason_2_label',
    templateConfigFieldName: 'deny_reason_2_template',
    defaultLabel: 'Unclear image',
    defaultTemplate:
      'Hi u/{{username}},\n\nWe could not approve your verification because the image was unclear.\n\nPlease resubmit with clear, well-lit photos.\n\nThe moderation team',
  },
  {
    id: 'reason_3',
    labelSettingName: 'deny_reason_3_label',
    templateConfigFieldName: 'deny_reason_3_template',
    defaultLabel: 'Did not follow instructions',
    defaultTemplate:
      'Hi u/{{username}},\n\nWe could not approve your verification because the submission did not follow the instructions.\n\nPlease review the instructions and resubmit.\n\nThe moderation team',
  },
  {
    id: 'reason_4',
    labelSettingName: 'deny_reason_4_label',
    templateConfigFieldName: 'deny_reason_4_template',
    defaultLabel: 'Other',
    defaultTemplate:
      'Hi u/{{username}},\n\nWe could not approve your verification at this time.\n\n{{denial_notes}}\n\nPlease review the instructions and resubmit.\n\nThe moderation team',
  },
] as const;
const MODMAIL_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MODERATOR_PERMISSION_CACHE_TTL_MS = 15 * 60 * 1000;
const MODERATOR_ROLE_CACHE_TTL_MS = 15 * 60 * 1000;
const MODERATOR_LOOKUP_LOG_COOLDOWN_MS = 15 * 60 * 1000;
const USER_VALIDATION_CRON = '30 3 * * *';
const USER_VALIDATION_JOB_NAME = `${APP_KEY_PREFIX}:user-validation-reconcile`;
const USER_VALIDATION_SCHEDULE_LOCK_TTL_MS = 15000;
const STORAGE_METER_CAP_BYTES = 500 * 1024 * 1024;
const BLOCKED_SUBMISSION_MESSAGE = "You cannot submit a verification request.";
const VERIFICATIONS_DISABLED_MESSAGE = 'Verifications are temporarily disabled.  Please check back soon.';

const DEFAULT_FLAIR_TEXT = 'Verified';
const DEFAULT_REQUIRED_PHOTO_COUNT = 2;
const DEFAULT_PENDING_TURNAROUND_DAYS = 3;
const DEFAULT_MODMAIL_SUBJECT = 'Verification update from r/{{subreddit}}';
const DEFAULT_PENDING_BODY =
  'Hi u/{{username}},\n\nYour verification is in progress. You can check the verification app for your status, and you will receive a message when a decision has been made.\n\nCurrent estimated turn around time: {{days}}\n\nThe moderation team';
const DEFAULT_APPROVE_HEADER = 'Verification Approved';
const DEFAULT_REMOVAL_HEADER = 'Verification Revoked';
const LEGACY_DEFAULT_APPROVE_BODY =
  'Hi u/{{username}},\n\nYour verification in r/{{subreddit}} was approved and your flair has been updated.\n\nThe moderation team';
const DEFAULT_APPROVE_BODY =
  'Hi u/{{username}},\n\nYour verification was approved and your flair has been updated.\n\nThe moderation team';
const DEFAULT_DENY_HEADER = 'Verification Denied';
const DEFAULT_REMOVAL_BODY =
  'Hi u/{{username}},\n\nYour verification in r/{{subreddit}} was revoked.\n\nReason: {{reason}}\n\nYou can resubmit if you want to be verified again.\n\nThe moderation team';
const DEFAULT_THEME_PRESET: ThemePresetName = 'coastal_light';

const THEME_PRESETS: Record<ThemePresetName, ThemePalette> = {
  coastal_light: {
    light: {
      primary: '#0E91B6',
      accent: '#FF7A45',
      success: '#12805C',
      danger: '#C83E5A',
      bg: '#F3FBFF',
      surface: '#FFFFFF',
      text: '#102533',
      mutedText: '#5C7382',
      border: '#C9DFEB',
    },
    dark: {
      primary: '#23B3DC',
      accent: '#F2A85C',
      success: '#45D6A6',
      danger: '#FF6F86',
      bg: '#04131B',
      surface: '#0A1C27',
      text: '#D7ECF7',
      mutedText: '#9CB9C8',
      border: '#214153',
    },
  },
  sunset_pop: {
    light: {
      primary: '#FF5A36',
      accent: '#2A7FFF',
      success: '#1E9A63',
      danger: '#D43D6D',
      bg: '#FFF4EE',
      surface: '#FFFFFF',
      text: '#2B1D1A',
      mutedText: '#7A615A',
      border: '#F0C8BB',
    },
    dark: {
      primary: '#FF8B6F',
      accent: '#74A6FF',
      success: '#58D49A',
      danger: '#FF83A8',
      bg: '#1A1110',
      surface: '#231916',
      text: '#F6E6DF',
      mutedText: '#C9A89D',
      border: '#4A302A',
    },
  },
  mint_modern: {
    light: {
      primary: '#0FAF9A',
      accent: '#2D6CDF',
      success: '#0D8D66',
      danger: '#C44763',
      bg: '#F1FFFB',
      surface: '#FFFFFF',
      text: '#0E2A28',
      mutedText: '#597B78',
      border: '#C9E7E2',
    },
    dark: {
      primary: '#49D5C4',
      accent: '#74A9FF',
      success: '#58DDB1',
      danger: '#F187A4',
      bg: '#091715',
      surface: '#102321',
      text: '#D8F2EE',
      mutedText: '#96BDB8',
      border: '#28433F',
    },
  },
  classic_news: {
    light: {
      primary: '#1D4D8F',
      accent: '#B7802A',
      success: '#2A7C52',
      danger: '#A3344B',
      bg: '#F8F6F1',
      surface: '#FFFFFF',
      text: '#1F252D',
      mutedText: '#66727F',
      border: '#D4D9DF',
    },
    dark: {
      primary: '#77A8F0',
      accent: '#D5B26A',
      success: '#67BF8F',
      danger: '#DD7F93',
      bg: '#11151B',
      surface: '#1A2028',
      text: '#E0E7EF',
      mutedText: '#A5B1BF',
      border: '#34404E',
    },
  },
  midnight_slate: {
    light: {
      primary: '#2EA8C7',
      accent: '#E58F3F',
      success: '#2BAE78',
      danger: '#D55B73',
      bg: '#EAF3F8',
      surface: '#FFFFFF',
      text: '#182A38',
      mutedText: '#5F7485',
      border: '#C4D5E0',
    },
    dark: {
      primary: '#4BC0DE',
      accent: '#F3B672',
      success: '#61D5A8',
      danger: '#F18DA3',
      bg: '#0D1822',
      surface: '#122532',
      text: '#D7E7F2',
      mutedText: '#96AFBF',
      border: '#2A4355',
    },
  },
  blue_coral: {
    light: {
      primary: '#4F5D75',
      accent: '#EF8354',
      success: '#5B8F7B',
      danger: '#EF8354',
      bg: '#FFFFFF',
      surface: '#F6F7F8',
      text: '#2D3142',
      mutedText: '#5F6673',
      border: '#BFC0C0',
    },
    dark: {
      primary: '#7F8EA9',
      accent: '#EF8354',
      success: '#77B29A',
      danger: '#FF9A74',
      bg: '#1C1F2B',
      surface: '#252A38',
      text: '#EDF0F5',
      mutedText: '#B3BAC7',
      border: '#4F5D75',
    },
  },
  desert: {
    light: {
      primary: '#81968F',
      accent: '#CFB9A5',
      success: '#96BDC6',
      danger: '#C6907F',
      bg: '#F8F2EE',
      surface: '#FFFFFF',
      text: '#3A4442',
      mutedText: '#6F7A78',
      border: '#E9D6EC',
    },
    dark: {
      primary: '#A8C7CF',
      accent: '#D8C4B5',
      success: '#8FB5BF',
      danger: '#D5A392',
      bg: '#202726',
      surface: '#2A3231',
      text: '#EDF1F0',
      mutedText: '#BEC9C6',
      border: '#4F5B58',
    },
  },
  colorful: {
    light: {
      primary: '#17BEBB',
      accent: '#E4572E',
      success: '#76B041',
      danger: '#E4572E',
      bg: '#FFF9EA',
      surface: '#FFFFFF',
      text: '#2E282A',
      mutedText: '#625A5D',
      border: '#FFD86C',
    },
    dark: {
      primary: '#45D5D1',
      accent: '#FF875F',
      success: '#9BD26E',
      danger: '#FF875F',
      bg: '#1D1A1B',
      surface: '#272324',
      text: '#F4EFEF',
      mutedText: '#C6B9B9',
      border: '#4A3F40',
    },
  },
};

const CONFIG_FIELD = {
  verificationsEnabled: 'verifications_enabled',
  requiredPhotoCount: 'required_photo_count',
  photoInstructions: 'photo_instructions',
  pendingTurnaroundDays: 'pending_turnaround_days',
  modmailSubject: 'modmail_subject',
  pendingBody: 'pending_body',
  alwaysIncludeDenialNotesInModmail: 'always_include_denial_notes_in_modmail',
  flairText: 'flair_text',
  flairTemplateId: 'flair_template_id',
  flairCssClass: 'flair_css_class',
  additionalApprovalFlairs: 'additional_approval_flairs_json',
  flairTemplateCacheTemplateId: 'flair_template_cache_template_id',
  flairTemplateCacheText: 'flair_template_cache_text',
  flairTemplateCacheCheckedAt: 'flair_template_cache_checked_at',
  approveHeader: 'approve_header',
  approveBody: 'approve_body',
  denyHeader: 'deny_header',
  removeHeader: 'remove_header',
  removeBody: 'remove_body',
  themePreset: 'theme_preset',
  useCustomColors: 'theme_use_custom_colors',
  customPrimary: 'theme_custom_primary',
  customAccent: 'theme_custom_accent',
  customBackground: 'theme_custom_background',
} as const;

const DENY_REASON_TEMPLATE_CONFIG_FIELD: Record<DenyReason, string> = Object.fromEntries(
  DENY_REASON_INSTALL_SETTINGS.map((setting) => [setting.id, setting.templateConfigFieldName])
) as Record<DenyReason, string>;

const LEGACY_CONFIG_FIELD = {
  pendingSubject: 'pending_subject',
  approveSubject: 'approve_subject',
  denySubject: 'deny_subject',
  removeSubject: 'remove_subject',
} as const;

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
  return {
    viewerUsername: dashboard.viewerUsername,
    subredditName: dashboard.subredditName,
    isModerator: dashboard.isModerator,
    canReview: dashboard.canReview,
    requiresInitialSetup: dashboard.requiresInitialSetup,
    config: toPublicHubConfig(dashboard.config),
    viewerVerifiedByFlair: dashboard.viewerVerifiedByFlair,
    viewerFlairCheckSource: dashboard.viewerFlairCheckSource,
    viewerBlocked: dashboard.viewerBlocked,
    userLatest: dashboard.userLatest,
    pendingCount: dashboard.pendingCount,
    resolvedTheme: resolveThemePalette(dashboard.config),
    themePresets: THEME_PRESETS,
  };
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
    accountDetails: normalizedRecord.accountDetails ?? null,
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

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  playtestRevision: number;
  normalized: string;
};

function parseVersion(value: unknown): ParsedVersion | null {
  const normalized = typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('.');
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }
  if (!parts.every((part) => /^\d+$/.test(part))) {
    return null;
  }
  const [major, minor, patch, playtestRevision = 0] = parts.map((part) => Number(part));
  if (![major, minor, patch, playtestRevision].every((part) => Number.isSafeInteger(part) && part >= 0)) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    playtestRevision,
    normalized: parts.length === 4 ? `${major}.${minor}.${patch}.${playtestRevision}` : `${major}.${minor}.${patch}`,
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }
  return left.playtestRevision - right.playtestRevision;
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

function normalizeOptionalIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsedMs = new Date(value).getTime();
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : null;
}

function normalizeOptionalWholeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function normalizeNonNegativeWholeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
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

async function getStoredDenialCount(context: RedisContext, subredditId: string, username: string): Promise<number> {
  const lookupFields = usernameLookupFields(username);
  if (lookupFields.length === 0) {
    return 0;
  }

  const key = denialCountKey(subredditId);
  const primaryField = primaryUsernameLookupField(username);
  for (const field of lookupFields) {
    const currentRaw = await context.redis.hGet(key, field);
    const current = Number.parseInt(currentRaw ?? '0', 10);
    if (!Number.isFinite(current) || current <= 0) {
      continue;
    }
    if (primaryField && field !== primaryField) {
      await context.redis.hSet(key, { [primaryField]: `${current}` });
    }
    return current;
  }

  return 0;
}

async function withSingleRetry<T>(label: string, fallbackValue: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.log(`${label} failed on first attempt: ${errorText(error)}`);
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

  const userSnapshotTask = withSingleRetry(
    `Pending account details user snapshot lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}`,
    { accountCreatedAt: null, totalKarma: null, subredditKarma: null },
    async () => {
      if (!normalizedUsername) {
        return { accountCreatedAt: null, totalKarma: null, subredditKarma: null };
      }
      const user = await context.reddit.getUserByUsername(normalizedUsername);
      if (!user) {
        return { accountCreatedAt: null, totalKarma: null, subredditKarma: null };
      }
      const userWithKarma = user as typeof user & {
        getUserKarmaFromCurrentSubreddit?: () => Promise<unknown>;
      };
      const rawKarma =
        typeof userWithKarma.getUserKarmaFromCurrentSubreddit === 'function'
          ? await userWithKarma.getUserKarmaFromCurrentSubreddit()
          : null;
      return {
        accountCreatedAt: normalizeOptionalIsoTimestamp(user.createdAt),
        totalKarma: normalizeSubredditKarmaValue(user),
        subredditKarma: normalizeSubredditKarmaValue(rawKarma),
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
  await context.redis.set(userPendingKey(subredditId, normalizedUsername), verificationId);
  await context.redis.set(userLatestKey(subredditId, normalizedUsername), verificationId);

  await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);
  const pendingModmail = await sendPendingSubmissionModmail(context, record, config);
  try {
    await addPendingSubmissionModNote(context, record);
  } catch (error) {
    console.log(
      `Pending submission mod note write failed for r/${sanitizeSubredditName(subredditName)} u/${maskUsernameForLog(username)}: ${errorText(error)}`
    );
  }
  return { pendingModmail };
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

    const ageFilterDescription =
      purgeMinAgeDays <= 0
        ? 'all audit log entries'
        : `audit log entr${deletedAuditCount === 1 ? 'y' : 'ies'} older than ${purgeMinAgeDays} days`;
    const emptyStateDescription =
      purgeMinAgeDays <= 0 ? 'No audit log entries found' : `No audit log entries older than ${purgeMinAgeDays} days found`;

    context.ui.showToast({
      text:
        deletedAuditCount > 0
          ? `Purged ${deletedAuditCount} ${ageFilterDescription} for r/${subredditName}.`
          : `${emptyStateDescription} for r/${subredditName}.`,
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
    await context.redis.del(userPendingKey(subredditId, normalizedUsername));
    throw new Error('No pending verification request found.');
  }

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

  return {
    deletedCount: result.deletedCount,
    flairRemovedFrom: result.flairRemovedFrom,
    flairRemovalFailedFor: result.flairRemovalFailedFor,
  };
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

  await context.redis.del(userPendingKey(subredditId, normalizedUsername));
  await context.redis.del(userLatestKey(subredditId, normalizedUsername));
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

function assertClaimAllowsAction(record: VerificationRecord, moderator: string): void {
  const normalizedRecord = clearExpiredPendingClaim(record);
  const claimedBy = normalizeUsernameForLookup(normalizedRecord.claimedBy ?? '');
  if (!claimedBy) {
    return;
  }
  if (!usernamesEqual(claimedBy, moderator)) {
    throw new Error(`This request is currently claimed by u/${normalizedRecord.claimedBy}.`);
  }
}

function parseTimestampMs(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function clearExpiredPendingClaim(record: VerificationRecord, nowMs = Date.now()): VerificationRecord {
  const claimedBy = normalizeUsernameForLookup(record.claimedBy ?? '');
  const claimedAtMs = parseTimestampMs(record.claimedAt);
  const claimActive =
    Boolean(claimedBy) &&
    Number.isFinite(claimedAtMs) &&
    claimedAtMs > 0 &&
    nowMs - claimedAtMs < PENDING_CLAIM_TTL_MS;

  if (claimActive) {
    return record;
  }

  if (!record.claimedBy && !record.claimedAt) {
    return record;
  }

  return {
    ...record,
    claimedBy: null,
    claimedAt: null,
  };
}

function pendingClaimChanged(left: VerificationRecord, right: VerificationRecord): boolean {
  return (left.claimedBy ?? null) !== (right.claimedBy ?? null) || (left.claimedAt ?? null) !== (right.claimedAt ?? null);
}

function createRedisLockToken(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function releaseRedisLockIfOwned(
  context: Pick<Devvit.Context, 'redis'>,
  key: string,
  lockToken: string
): Promise<void> {
  const currentLockToken = await context.redis.get(key);
  if (currentLockToken === lockToken) {
    await context.redis.del(key);
  }
}

async function withRedisLock<T>(
  context: Pick<Devvit.Context, 'redis'>,
  key: string,
  ttlMs: number,
  failureMessage: string,
  callback: () => Promise<T>
): Promise<T> {
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lock = await context.redis.set(key, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + ttlMs),
    });
    if (lock === 'OK') {
      lockAcquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (!lockAcquired) {
    throw new Error(failureMessage);
  }

  try {
    return await callback();
  } finally {
    await releaseRedisLockIfOwned(context, key, lockToken);
  }
}

async function withVerificationActionLock<T>(
  context: Pick<Devvit.Context, 'redis'>,
  subredditId: string,
  verificationId: string,
  callback: () => Promise<T>
): Promise<T> {
  return withRedisLock(
    context,
    verificationActionLockKey(subredditId, verificationId),
    VERIFICATION_ACTION_LOCK_TTL_MS,
    'Another moderation action is already in progress for this verification. Refresh and try again.',
    callback
  );
}

async function setPendingClaimState(
  context: Devvit.Context,
  verificationId: string,
  shouldClaim: boolean
): Promise<{ item: PendingPanelItem; changed: boolean; pendingCount: number }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);

  const storedRecord = await getRecord(context, subredditId, verificationId);
  if (!storedRecord) {
    throw new Error('Verification not found.');
  }
  let record = clearExpiredPendingClaim(storedRecord);
  if (pendingClaimChanged(storedRecord, record)) {
    await setRecord(context, subredditId, record);
  }
  if (record.status !== 'pending') {
    throw new Error('Verification is no longer pending.');
  }

  const claimedByNormalized = normalizeUsernameForLookup(record.claimedBy ?? '');
  const moderatorNormalized = normalizeUsernameForLookup(moderator);
  let updatedRecord = record;
  let changed = false;

  if (shouldClaim) {
    if (claimedByNormalized && claimedByNormalized !== moderatorNormalized) {
      throw new Error(`This request is currently claimed by u/${record.claimedBy}.`);
    }
    if (claimedByNormalized !== moderatorNormalized) {
      changed = true;
      updatedRecord = {
        ...record,
        claimedBy: moderator,
        claimedAt: new Date().toISOString(),
      };
    }
  } else if (record.claimedBy || record.claimedAt) {
    changed = true;
    updatedRecord = {
      ...record,
      claimedBy: null,
      claimedAt: null,
    };
  }

  if (changed) {
    await setRecord(context, subredditId, updatedRecord);
  }

  const pendingCount = await context.redis.zCard(pendingIndexKey(subredditId));
  return { item: toPendingPanelItem(updatedRecord), changed, pendingCount };
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

  const pendingKey = userPendingKey(subredditId, normalizedUsername);
  const pendingId = await context.redis.get(pendingKey);
  if (pendingId === record.id) {
    await context.redis.del(pendingKey);
  }
  await context.redis.set(userLatestKey(subredditId, normalizedUsername), record.id);

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
      photoOneUrl: '',
      photoTwoUrl: '',
      photoThreeUrl: '',
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
    await context.redis.del(userPendingKey(subredditId, normalizeUsername(record.username)));
    await context.redis.set(userLatestKey(subredditId, normalizeUsername(record.username)), verificationId);
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
  moderatorNotes?: string
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

    await setRecord(context, subredditId, reviewedRecord);
    const historyAnchorMs = getHistoryRecordAnchorMs(reviewedRecord);
    await context.redis.zRem(pendingIndexKey(subredditId), [verificationId]);
    await context.redis.zRem(approvedIndexKey(subredditId), [verificationId]);
    await removeApprovedPrefixIndexEntry(context, subredditId, verificationId, record.username);
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
    await context.redis.del(userPendingKey(subredditId, normalizeUsername(record.username)));
    await context.redis.set(userLatestKey(subredditId, normalizeUsername(record.username)), verificationId);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    await pruneHistoryOlderThanDays(context, subredditId, HISTORY_RETENTION_DAYS);

    const [modmail, modNote] = await Promise.all([
      sendDenialModmail(context, subredditId, reviewedRecord, config),
      (async (): Promise<ModNoteStepResult> => {
        try {
          await addDenialModNote(context, reviewedRecord, moderator, config);
          return { status: 'success' };
        } catch (error) {
          return { status: 'failed', reason: errorText(error) };
        }
      })(),
    ]);

    const denialCount = await incrementDenialCount(context, subredditId, record.username);
    let userBlocked = false;
    if (config.maxDenialsBeforeBlock > 0 && denialCount >= config.maxDenialsBeforeBlock) {
      const blockedEntry: BlockedUserEntry = {
        username: record.username,
        blockedAt: new Date().toISOString(),
        deniedCount: denialCount,
        reason: `Reached ${denialCount} denials`,
      };
      const wasAlreadyBlocked = await isUserBlocked(context, subredditId, record.username);
      await setBlockedUser(context, subredditId, blockedEntry);
      userBlocked = true;
      if (!wasAlreadyBlocked) {
        try {
          await appendAuditLog(context, {
            subredditId,
            subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
            username: reviewedRecord.username,
            actor: moderator,
            action: 'blocked',
            verificationId: reviewedRecord.id,
            notes: blockedEntry.reason,
          });
        } catch (error) {
          console.log(`Audit log write failed (blocked): ${errorText(error)}`);
        }
      }
    }

    try {
      await appendAuditLog(context, {
        subredditId,
        subredditName: sanitizeSubredditName(reviewedRecord.subredditName),
        username: reviewedRecord.username,
        actor: moderator,
        action: 'denied',
        verificationId: reviewedRecord.id,
        notes: `${getDenyReasonDisplayLabel(config, reason)}${moderatorNotes ? ` | ${moderatorNotes}` : ''}${
          userBlocked ? ` | Auto-blocked after ${denialCount} denials` : ''
        }`,
      });
    } catch (error) {
      console.log(`Audit log write failed (denied): ${errorText(error)}`);
    }

    return {
      outcome: 'completed',
      applied: true,
      username: reviewedRecord.username,
      flair: { status: 'skipped', reason: 'not applicable' },
      modmail,
      modNote,
      userBlocked,
      denialCount,
    };
  });
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
      await context.redis.del(userPendingKey(subredditId, normalizedUsername));
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
    await context.redis.set(userPendingKey(subredditId, normalizedUsername), reopenedId);
    await context.redis.set(userLatestKey(subredditId, normalizedUsername), reopenedId);
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

    const pendingId = await context.redis.get(userPendingKey(subredditId, normalizedUsername));
    if (pendingId === verificationId) {
      await context.redis.del(userPendingKey(subredditId, normalizedUsername));
    }

    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId === verificationId) {
      if (
        parentRecord &&
        usernamesEqual(parentRecord.username, reopenedRecord.username) &&
        parentRecord.id === parentVerificationId
      ) {
        await context.redis.set(userLatestKey(subredditId, normalizedUsername), parentVerificationId);
      } else {
        const fallbackLatestId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
        if (fallbackLatestId) {
          await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackLatestId);
        } else {
          await context.redis.del(userLatestKey(subredditId, normalizedUsername));
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
    await context.redis.set(userLatestKey(subredditId, normalizeUsername(record.username)), verificationId);
    await removeValidationTrackingForRecordIds(context, subredditId, [verificationId]);

    const modmail = await sendModeratorRemovalModmail(context, subredditId, updatedRecord, normalizedReason);

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
      modNote: { status: 'skipped', reason: 'not applicable' },
    };
  });
}

async function sendApprovalModmail(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord
): Promise<ModmailStepResult> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const config = await getRuntimeConfig(context, subredditId);
  const values = {
    username: record.username,
    mod: record.moderator ?? '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: '',
    days: formatPendingTurnaroundDays(config.pendingTurnaroundDays),
  };
  const subject = buildModmailSubject(config.modmailSubject, values);
  const body = prependModmailHeader(fillTemplate(config.approveBody, values), config.approveHeader, values);

  return await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `approve:${record.id}`,
  });
}

async function addApprovalModNote(
  context: Devvit.Context,
  record: VerificationRecord,
  moderatorName: string
): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: `Verified. Verifying mod: ${moderatorName}`,
  });
}

async function addPendingSubmissionModNote(context: Devvit.Context, record: VerificationRecord): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const acknowledgedAt = formatTimestamp(record.ageAcknowledgedAt || record.submittedAt);
  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: `Verification request submitted. Terms accepted and 18+ confirmation recorded on: ${acknowledgedAt}`,
  });
}

async function addDenialModNote(
  context: Devvit.Context,
  record: VerificationRecord,
  moderatorName: string,
  config: RuntimeConfig
): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const reason = parseDenyReason(record.denyReason ?? undefined) ?? 'reason_4';
  const label = getDenyReasonDisplayLabel(config, reason);
  const notes = record.denyNotes?.trim();
  const details = notes
    ? `Denied. Verifying mod: ${moderatorName}. Reason: ${label}. Notes: ${notes}`
    : `Denied. Verifying mod: ${moderatorName}. Reason: ${label}.`;

  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: details,
  });
}

async function addSelfRemovalModNote(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<void> {
  await context.reddit.addModNote({
    subreddit: sanitizeSubredditName(subredditName),
    user: username,
    note: 'User self-removed verification',
  });
}

async function sendModeratorRemovalModmail(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  removalReason: string
): Promise<ModmailStepResult> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const config = await getRuntimeConfig(context, subredditId);
  const values = {
    username: record.username,
    mod: record.removedBy ?? record.moderator ?? '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: removalReason,
    days: formatPendingTurnaroundDays(config.pendingTurnaroundDays),
  };
  const subject = buildModmailSubject(config.modmailSubject, values);
  const body = prependModmailHeader(fillTemplate(config.removeBody, values), config.removeHeader, values);

  return await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `removed:${record.id}`,
  });
}

async function sendDenialModmail(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  config: RuntimeConfig
): Promise<ModmailStepResult> {
  const reason = parseDenyReason(record.denyReason ?? undefined) ?? 'reason_4';
  const subredditName = sanitizeSubredditName(record.subredditName);
  const configuredReason = getConfiguredDenyReason(config, reason);
  const template = configuredReason?.template.trim() || DEFAULT_GENERIC_DENY_REASON_TEMPLATE;
  const moderatorNotes = normalizeDenialNotes(record.denyNotes);
  const formattedModeratorNotes = formatDenialNotesForModmail(moderatorNotes);
  const denialNotesAlreadyIncluded =
    templateIncludesDenialNotesPlaceholder(template) || templateIncludesDenialNotesPlaceholder(config.denyHeader);

  const values = {
    username: record.username,
    mod: record.moderator ?? '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: formattedModeratorNotes,
    denial_notes: formattedModeratorNotes,
    days: formatPendingTurnaroundDays(config.pendingTurnaroundDays),
  };
  const subject = buildModmailSubject(config.modmailSubject, values);
  const renderedHeader = renderDenialTemplateText(config.denyHeader, values, moderatorNotes);
  const body = prependRenderedModmailHeader(
    renderDenialModmailBody(
      template,
      values,
      moderatorNotes,
      config.alwaysIncludeDenialNotesInModmail,
      denialNotesAlreadyIncluded
    ),
    renderedHeader
  );

  return await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `deny:${record.id}`,
  });
}

async function sendPendingSubmissionModmail(
  context: Devvit.Context,
  record: VerificationRecord,
  config?: RuntimeConfig
): Promise<ModmailStepResult> {
  const subredditId = sanitizeSubredditId(record.subredditId || context.subredditId);
  const subredditName = sanitizeSubredditName(record.subredditName);
  const resolvedConfig = config ?? (await getRuntimeConfig(context, subredditId));
  const values = {
    username: record.username,
    mod: '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: '',
    days: formatPendingTurnaroundDays(resolvedConfig.pendingTurnaroundDays),
  };
  const subject = buildModmailSubject(resolvedConfig.modmailSubject, values);
  const acknowledgementAt = formatTimestamp(record.ageAcknowledgedAt || record.submittedAt);
  const auditFooter = `Terms accepted and 18+ confirmation recorded on: ${acknowledgementAt}`;
  const body = `${fillTemplate(resolvedConfig.pendingBody, values).trimEnd()}\n\n${auditFooter}`;
  return await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `pending:${record.id}`,
  });
}

async function sendUserModmailWithFallback(
  context: Devvit.Context,
  input: {
    subredditId: string;
    subredditName: string;
    subject: string;
    body: string;
    username: string;
    eventId?: string;
  }
): Promise<ModmailStepResult> {
  const subredditId = sanitizeSubredditId(input.subredditId);
  const subredditName = sanitizeSubredditName(input.subredditName);
  const subject = input.subject;
  const body = input.body;
  const username = input.username;
  const normalizedUser = normalizeUsernameStrict(username);
  if (!normalizedUser) {
    return {
      status: 'failed',
      reason: 'Invalid modmail recipient username.',
    };
  }
  const eventId = input.eventId?.trim() ?? '';
  const lockKey = eventId ? modmailLockKey(subredditId, eventId) : null;
  const dedupeKey = eventId ? modmailDedupeKey(subredditId, eventId) : null;
  const userThreadKeys = Array.from(
    new Set(usernameLookupFields(username).map((field) => modmailThreadByUserEntryKey(subredditId, field)))
  );
  const recipients = Array.from(new Set([normalizedUser, `u/${normalizedUser}`]));
  let lockAcquired = false;

  if (lockKey) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const lock = await context.redis.set(lockKey, '1', {
        nx: true,
        expiration: new Date(Date.now() + 15 * 1000),
      });
      if (lock === 'OK') {
        lockAcquired = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!lockAcquired) {
      return { status: 'failed', reason: 'modmail lock contention' };
    }
  }

  try {
    if (dedupeKey) {
      const dedupeSeenRaw = await context.redis.get(dedupeKey);
      const dedupeConversationId = normalizeModmailConversationId(dedupeSeenRaw);
      if (dedupeConversationId) {
        return {
          status: 'skipped',
          reason: 'already processed',
          conversationId: dedupeConversationId,
        };
      }
      if (dedupeSeenRaw) {
        await context.redis.del(dedupeKey);
      }
    }

    let existingConversationId = '';
    const invalidThreadKeys: string[] = [];
    for (const userThreadKey of userThreadKeys) {
      const existingConversationIdRaw = await context.redis.get(userThreadKey);
      const normalizedConversationId = normalizeModmailConversationId(existingConversationIdRaw);
      if (existingConversationIdRaw && !normalizedConversationId) {
        invalidThreadKeys.push(userThreadKey);
        continue;
      }
      if (normalizedConversationId) {
        existingConversationId = normalizedConversationId;
        break;
      }
    }
    if (invalidThreadKeys.length > 0) {
      await context.redis.del(...invalidThreadKeys);
    }
    if (existingConversationId) {
      try {
        try {
          await context.reddit.modMail.unarchiveConversation(existingConversationId);
        } catch {
          // Ignore if unarchive fails.
        }
        await context.reddit.modMail.reply({
          conversationId: existingConversationId,
          body,
          isAuthorHidden: true,
        });
        if (dedupeKey) {
          await context.redis.set(dedupeKey, existingConversationId, {
            expiration: new Date(Date.now() + MODMAIL_DEDUPE_TTL_SECONDS * 1000),
          });
        }
        await archiveModmailConversationBestEffort(context, subredditName, username, existingConversationId);
        return { status: 'replied', conversationId: existingConversationId };
      } catch (error) {
        void error;
        if (userThreadKeys.length > 0) {
          await context.redis.del(...userThreadKeys);
        }
      }
    }

    let lastError: string | undefined;
    for (const to of recipients) {
      try {
        const response = await context.reddit.modMail.createConversation({
          subredditName,
          subject,
          body,
          to,
          isAuthorHidden: true,
        });
        const conversationId = normalizeModmailConversationId(response.conversation.id);
        if (!conversationId) {
          throw new Error('Modmail conversation created but no conversation ID was returned.');
        }
        await Promise.all(userThreadKeys.map((userThreadKey) => context.redis.set(userThreadKey, conversationId)));
        if (dedupeKey) {
          await context.redis.set(dedupeKey, conversationId, {
            expiration: new Date(Date.now() + MODMAIL_DEDUPE_TTL_SECONDS * 1000),
          });
        }
        await archiveModmailConversationBestEffort(context, subredditName, username, conversationId);
        return { status: 'created', conversationId };
      } catch (error) {
        lastError = errorText(error);
      }
    }

    return {
      status: 'failed',
      reason: lastError ?? 'Unable to send modmail conversation.',
    };
  } finally {
    if (lockAcquired && lockKey) {
      await context.redis.del(lockKey);
    }
  }
}

async function archiveModmailConversationBestEffort(
  context: Devvit.Context,
  _subredditName: string,
  _username: string,
  _conversationId: string
): Promise<void> {
  try {
    await context.reddit.modMail.archiveConversation(_conversationId);
  } catch (error) {
    const message = errorText(error);
    if (looksLikeInternalModmailArchiveError(message)) {
      return;
    }
    void _subredditName;
    void _username;
  }
}

async function loadDashboardData(
  context: Devvit.Context,
  options: {
    includeModData: boolean;
  }
): Promise<DashboardData> {
  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await ensureUserValidationSchedule(context, subredditId, subredditName);
  const viewerUsername = (await context.reddit.getCurrentUsername()) ?? null;
  const moderatorAccess = viewerUsername
    ? await getModeratorAccessSnapshot(context, subredditName, viewerUsername)
    : { isModerator: false, permissions: [] };
  const isModeratorUser = moderatorAccess.isModerator;
  const moderatorPermissions = moderatorAccess.permissions;
  const canManageUsers = hasManageUsersPermissionInList(moderatorPermissions);
  const settingsTabRequiresConfigAccess = await getSettingsTabRequiresConfigAccess(context);
  const canOpenInstallSettings = hasAllModeratorPermissionInList(moderatorPermissions);
  const hasConfigAccess = hasConfigAccessPermissionInList(moderatorPermissions);
  const canReviewUser = isModeratorUser && canManageUsers;
  const canAccessSettingsTab = canReviewUser && (!settingsTabRequiresConfigAccess || hasConfigAccess);
  let config = await getRuntimeConfig(context, subredditId);
  let flairTemplateValidation = validateFlairTemplateId(config.flairTemplateId);
  if (viewerUsername && config.flairTemplateId.trim()) {
    config = await refreshConfiguredFlairTemplateCache(context, subredditId, subredditName, viewerUsername, config);
  }
  if (canReviewUser && options.includeModData) {
    flairTemplateValidation = await validateFlairTemplateIdForSubreddit(context, subredditName, config.flairTemplateId);
  }
  const requiresInitialSetup = !config.flairTemplateId.trim();

  let userLatest = viewerUsername ? await getLatestRecordForUser(context, subredditId, viewerUsername) : null;
  if (viewerUsername && userLatest) {
    userLatest = await bumpViewerVerifiedRecordRetention(context, subredditId, viewerUsername, userLatest);
  }
  const viewerBlocked = viewerUsername ? await repairMissingAutoBlockForUser(context, subredditId, viewerUsername, config) : null;
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
  const viewerSnapshot = viewerUsername ? await getViewerSnapshot(context) : { accountAgeDays: null, totalKarma: null };
  let viewerFlairSnapshot = viewerUsername
    ? await getViewerFlairSnapshot(context, subredditName, viewerUsername)
    : { flairText: '', flairCssClass: '', flairTemplateId: '', userId: '' };
  let flairCheck = viewerUsername
    ? await checkVerificationFlair(context, subredditName, viewerUsername, config, viewerFlairSnapshot)
    : {
        verified: false,
        configuredTemplateId: '',
        detectedTemplateId: '',
        source: 'no-viewer',
        error: null,
      };

  if (
    config.autoFlairReconcileEnabled &&
    viewerUsername &&
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
        `Viewer flair reconcile timestamp update failed for r/${subredditName} u/${maskUsernameForLog(viewerUsername)}: ${errorText(error)}`
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
      const cleared = await removeUserFlairWithFallbacks(context, subredditName, viewerUsername);
      if (!cleared) {
        console.log(
          `Viewer stale flair clear before reconcile failed for r/${subredditName} u/${maskUsernameForLog(viewerUsername)}`
        );
      }
    }
    const reconcileResult = await applyApprovalFlairWithFallbacks(context, userLatest, config, desiredTemplateId);
    if (reconcileResult.applied) {
      viewerFlairSnapshot = await getViewerFlairSnapshot(context, subredditName, viewerUsername);
      flairCheck = await checkVerificationFlair(context, subredditName, viewerUsername, config, viewerFlairSnapshot);
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
            `Viewer flair reconcile record update failed for r/${subredditName} u/${maskUsernameForLog(viewerUsername)}: ${errorText(error)}`
          );
        }
      } else if (updatedTemplateId) {
        console.log(
          `Viewer flair reconcile did not confirm updated template for r/${subredditName} u/${maskUsernameForLog(viewerUsername)}; preserving prior record template ID`
        );
      }
    } else if (reconcileResult.error) {
      console.log(
        `Viewer flair reconcile failed for r/${subredditName} u/${maskUsernameForLog(viewerUsername)}: ${reconcileResult.error}`
      );
    }
  }

  return {
    viewerUsername,
    subredditName,
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
    viewerVerifiedByFlair: flairCheck.verified,
    viewerFlairConfiguredTemplateId: flairCheck.configuredTemplateId,
    viewerFlairDetectedTemplateId: flairCheck.detectedTemplateId,
    viewerFlairCheckSource: flairCheck.source,
    viewerFlairCheckError: flairCheck.error,
    viewerCurrentFlairText: viewerFlairSnapshot.flairText,
    viewerCurrentFlairCssClass: viewerFlairSnapshot.flairCssClass,
    userLatest,
    viewerBlocked,
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

async function loadDashboard(context: Devvit.Context): Promise<DashboardData> {
  return await loadModDashboard(context);
}

async function getViewerSnapshot(context: Devvit.Context): Promise<UserSnapshot> {
  const emptySnapshot = { accountAgeDays: null, totalKarma: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const user = await context.reddit.getCurrentUser();
      if (!user) {
        return emptySnapshot;
      }
      const createdAt = user.createdAt;
      const ageMs = Date.now() - createdAt.getTime();
      const accountAgeDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
      const totalKarma = (user.commentKarma ?? 0) + (user.linkKarma ?? 0);
      return { accountAgeDays, totalKarma };
    } catch (error) {
      const message = errorText(error);
      if (attempt < 1 && looksLikeTransientRedditTransportError(message)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      if (!looksLikeTransientRedditTransportError(message)) {
        console.log(`Viewer snapshot lookup failed: ${message}`);
      }
      return emptySnapshot;
    }
  }

  return emptySnapshot;
}

async function getViewerFlairSnapshot(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<ViewerFlairSnapshot> {
  const emptySnapshot = { flairText: '', flairCssClass: '', flairTemplateId: '', userId: '' };
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const normalizedUsername = normalizeUsernameStrict(username);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let user = await context.reddit.getCurrentUser();
      const currentUsername = typeof user?.username === 'string' ? user.username : '';
      if (!user || (normalizedUsername && currentUsername && !usernamesEqual(currentUsername, normalizedUsername))) {
        user = normalizedUsername ? await context.reddit.getUserByUsername(normalizedUsername) : undefined;
      }
      if (!user) {
        return emptySnapshot;
      }
      const flair = await user.getUserFlairBySubreddit(sanitizedSubreddit);
      if (!flair) {
        return { ...emptySnapshot, userId: user.id ?? '' };
      }
      const flairTemplateId = normalizeTemplateId(extractTemplateId(flair));
      return {
        flairText: (flair.flairText ?? '').trim(),
        flairCssClass: (flair.flairCssClass ?? '').trim(),
        flairTemplateId,
        userId: user.id ?? '',
      };
    } catch (error) {
      const message = errorText(error);
      if (attempt < 1 && looksLikeTransientRedditTransportError(message)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      if (!looksLikeTransientRedditTransportError(message)) {
        console.log(`Viewer flair snapshot lookup failed for r/${subredditName} u/${maskUsernameForLog(username)}: ${message}`);
      }
      return emptySnapshot;
    }
  }

  return emptySnapshot;
}

function extractFieldString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw;
    }
  }
  return '';
}

function extractTemplateId(value: unknown): string {
  const fromKnownKeys = extractFieldString(value, ['flairTemplateId', 'flair_template_id', 'templateId', 'template_id']);
  if (fromKnownKeys) {
    return fromKnownKeys;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  const record = value as Record<string, unknown>;
  for (const [key, raw] of Object.entries(record)) {
    if (
      typeof raw === 'string' &&
      raw.trim() &&
      key.toLowerCase().includes('template') &&
      key.toLowerCase().includes('id')
    ) {
      return raw;
    }
  }
  return '';
}

function normalizeTemplateId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeApprovalFlairConfig(value: Partial<ApprovalFlairConfig> | null | undefined): ApprovalFlairConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const templateId = normalizeTemplateId(String(value.templateId ?? ''));
  if (!templateId) {
    return null;
  }
  return {
    templateId,
    label: String(value.label ?? '').trim(),
    text: String(value.text ?? '').trim(),
  };
}

function parseAdditionalApprovalFlairs(value: string | undefined): ApprovalFlairConfig[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized: ApprovalFlairConfig[] = [];
    for (const item of parsed) {
      const flair = normalizeApprovalFlairConfig(item as Partial<ApprovalFlairConfig>);
      if (!flair) {
        continue;
      }
      if (!normalized.some((existing) => existing.templateId === flair.templateId)) {
        normalized.push(flair);
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

function serializeAdditionalApprovalFlairs(value: ApprovalFlairConfig[]): string {
  const normalized = Array.isArray(value)
    ? value
        .map((item) => normalizeApprovalFlairConfig(item))
        .filter((item): item is ApprovalFlairConfig => Boolean(item))
    : [];
  return JSON.stringify(normalized);
}

function configuredApprovalTemplateIds(
  config: Pick<RuntimeConfig, 'flairTemplateId' | 'additionalApprovalFlairs' | 'multipleApprovalFlairsEnabled'>
): string[] {
  const ids = [
    normalizeTemplateId(config.flairTemplateId),
    ...((Array.isArray(config.additionalApprovalFlairs) ? config.additionalApprovalFlairs : []).map((item) =>
      normalizeTemplateId(item.templateId)
    )),
  ].filter(Boolean);
  return dedupeNonEmpty(ids);
}

function buildApprovalFlairOptionLabel(text: string, templateId: string, duplicateCount: number): string {
  if (!text) {
    return `(untitled flair) — ${templateId}`;
  }
  if (duplicateCount > 1) {
    return `${text} — ${templateId}`;
  }
  return text;
}

async function listUserFlairTemplatesForSubreddit(
  context: Devvit.Context,
  subredditName: string
): Promise<UserFlairTemplateSummary[]> {
  const subreddit = await context.reddit.getSubredditByName(sanitizeSubredditName(subredditName));
  const flairTemplates = await subreddit.getUserFlairTemplates();
  return flairTemplates
    .map((template): UserFlairTemplateSummary | null => {
      const templateId = String(template.id ?? '').trim();
      if (!templateId) {
        return null;
      }
      return {
        id: templateId,
        text: String(template.text ?? '').trim(),
        modOnly: template.modOnly === true,
        backgroundColor: typeof template.backgroundColor === 'string' ? String(template.backgroundColor) : 'transparent',
        textColor: typeof template.textColor === 'string' ? String(template.textColor) : 'dark',
      };
    })
    .filter((template): template is UserFlairTemplateSummary => template !== null);
}

function refreshAdditionalApprovalFlairConfigsFromTemplates(
  configuredFlairs: ApprovalFlairConfig[],
  flairTemplates: UserFlairTemplateSummary[]
): ApprovalFlairConfig[] {
  if (!Array.isArray(configuredFlairs) || configuredFlairs.length === 0) {
    return [];
  }

  const duplicateCounts = new Map<string, number>();
  for (const template of flairTemplates) {
    if (!template.text) {
      continue;
    }
    duplicateCounts.set(template.text, (duplicateCounts.get(template.text) ?? 0) + 1);
  }

  const templatesById = new Map(
    flairTemplates.map((template) => [
      normalizeTemplateId(template.id),
      template,
    ])
  );

  return configuredFlairs
    .map((item) => {
      const normalized = normalizeApprovalFlairConfig(item);
      if (!normalized) {
        return null;
      }
      const matchedTemplate = templatesById.get(normalized.templateId);
      if (!matchedTemplate) {
        return normalized;
      }
      return {
        templateId: normalized.templateId,
        label: buildApprovalFlairOptionLabel(
          matchedTemplate.text,
          matchedTemplate.id,
          duplicateCounts.get(matchedTemplate.text) ?? 0
        ),
        text: matchedTemplate.text,
      };
    })
    .filter((item): item is ApprovalFlairConfig => Boolean(item));
}

async function loadApprovalFlairOptionsForSettings(context: Devvit.Context): Promise<ApprovalFlairOption[]> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanAccessModeratorSettingsTab(context, subredditName, moderator);

  const modOnlyTemplates = (await listUserFlairTemplatesForSubreddit(context, subredditName)).filter(
    (template) => template.modOnly
  );

  const duplicateCounts = new Map<string, number>();
  for (const template of modOnlyTemplates) {
    if (!template.text) {
      continue;
    }
    duplicateCounts.set(template.text, (duplicateCounts.get(template.text) ?? 0) + 1);
  }

  return modOnlyTemplates.map((template) => ({
    id: template.id,
    text: template.text,
    label: buildApprovalFlairOptionLabel(template.text, template.id, duplicateCounts.get(template.text) ?? 0),
    backgroundColor: template.backgroundColor,
    textColor: template.textColor,
  }));
}

async function validateFlairTemplateIdForSubreddit(
  context: Devvit.Context,
  subredditName: string,
  flairTemplateId: string | null | undefined
): Promise<FlairTemplateValidationState> {
  const formatValidation = validateFlairTemplateId(flairTemplateId);
  if (!formatValidation.isValid) {
    return formatValidation;
  }

  const normalizedSubredditName = sanitizeSubredditName(subredditName);
  const normalizedTemplateId = normalizeTemplateId(String(flairTemplateId ?? ''));
  try {
    const flairTemplates = await listUserFlairTemplatesForSubreddit(context, normalizedSubredditName);
    const exists = flairTemplates.some((template) => normalizeTemplateId(template.id) === normalizedTemplateId);
    if (!exists) {
      return {
        isValid: false,
        code: 'not_found',
        message: `Flair template ID was not found in r/${normalizedSubredditName}.`,
      };
    }
    return {
      isValid: true,
      code: 'valid',
      message: 'Flair template ID looks valid.',
    };
  } catch (error) {
    console.log(`Flair template validation lookup failed for r/${normalizedSubredditName}: ${errorText(error)}`);
    return {
      isValid: false,
      code: 'lookup_failed',
      message: `Unable to verify the flair template ID in r/${normalizedSubredditName}.`,
    };
  }
}

async function refreshConfiguredFlairTemplateCache(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  _lookupUsername: string,
  config: RuntimeConfig,
  forceRefresh = false
): Promise<RuntimeConfig> {
  const configuredTemplateId = normalizeTemplateId(config.flairTemplateId);
  if (!configuredTemplateId || !isLikelyFlairTemplateId(configuredTemplateId)) {
    return config;
  }

  const nowMs = Date.now();
  const cachedTemplateId = normalizeTemplateId(config.flairTemplateCacheTemplateId);
  const cacheCheckedAt =
    Number.isFinite(config.flairTemplateCacheCheckedAt) && config.flairTemplateCacheCheckedAt > 0
      ? Math.floor(config.flairTemplateCacheCheckedAt)
      : 0;
  const cacheIsFresh = cacheCheckedAt > 0 && nowMs - cacheCheckedAt < FLAIR_TEMPLATE_CACHE_REFRESH_INTERVAL_MS;
  if (!forceRefresh && cacheIsFresh && cachedTemplateId === configuredTemplateId) {
    return config;
  }

  let flairTemplates: UserFlairTemplateSummary[] | null = null;
  try {
    flairTemplates = await listUserFlairTemplatesForSubreddit(context, subredditName);
  } catch (error) {
    console.log(`Configured flair template text lookup failed for r/${subredditName}: ${errorText(error)}`);
  }

  const cachedTemplateText =
    flairTemplates?.find((template) => normalizeTemplateId(template.id) === configuredTemplateId)?.text?.trim() ??
    (cachedTemplateId === configuredTemplateId ? config.flairTemplateCacheText : '');
  const refreshedAdditionalApprovalFlairs = flairTemplates
    ? refreshAdditionalApprovalFlairConfigsFromTemplates(config.additionalApprovalFlairs, flairTemplates)
    : config.additionalApprovalFlairs;

  await context.redis.hSet(subredditConfigKey(subredditId), {
    [CONFIG_FIELD.additionalApprovalFlairs]: serializeAdditionalApprovalFlairs(refreshedAdditionalApprovalFlairs),
    [CONFIG_FIELD.flairTemplateCacheTemplateId]: configuredTemplateId,
    [CONFIG_FIELD.flairTemplateCacheText]: cachedTemplateText,
    [CONFIG_FIELD.flairTemplateCacheCheckedAt]: `${nowMs}`,
  });

  return {
    ...config,
    additionalApprovalFlairs: refreshedAdditionalApprovalFlairs,
    flairTemplateCacheTemplateId: configuredTemplateId,
    flairTemplateCacheText: cachedTemplateText,
    flairTemplateCacheCheckedAt: nowMs,
  };
}

function shouldReconcileApprovedViewerFlair(
  latestRecord: VerificationRecord,
  config: RuntimeConfig,
  flairCheck: FlairVerificationCheck,
  viewerFlairSnapshot: ViewerFlairSnapshot
): boolean {
  if (latestRecord.status !== 'approved') {
    return false;
  }
  const configuredTemplateIds = configuredApprovalTemplateIds(config);
  const configuredTemplateId = normalizeTemplateId(config.flairTemplateId);
  if (!configuredTemplateId || !isLikelyFlairTemplateId(configuredTemplateId) || configuredTemplateIds.length === 0) {
    return false;
  }
  if (isManualFlairCheckSource(flairCheck.source)) {
    return false;
  }

  const lastAppliedTemplateId = normalizeTemplateId(latestRecord.lastAppliedFlairTemplateId ?? '');
  if (!lastAppliedTemplateId || !isLikelyFlairTemplateId(lastAppliedTemplateId)) {
    return false;
  }

  const detectedTemplateId = normalizeTemplateId(flairCheck.detectedTemplateId || viewerFlairSnapshot.flairTemplateId);
  if (detectedTemplateId && configuredTemplateIds.includes(detectedTemplateId)) {
    return false;
  }
  if (detectedTemplateId) {
    if (detectedTemplateId !== lastAppliedTemplateId) {
      return false;
    }
    return !configuredTemplateIds.includes(detectedTemplateId);
  }

  const detectedText = viewerFlairSnapshot.flairText.trim().toLowerCase();
  const detectedCss = normalizeCssClass(viewerFlairSnapshot.flairCssClass);
  if (!detectedText && !detectedCss) {
    return true;
  }

  return !configuredTemplateIds.includes(lastAppliedTemplateId);
}

function isViewerFlairReconcileDue(record: VerificationRecord, nowMs: number): boolean {
  const lastFlairReconcileAt =
    typeof record.lastFlairReconcileAt === 'number' && Number.isFinite(record.lastFlairReconcileAt)
      ? Math.max(0, Math.floor(record.lastFlairReconcileAt))
      : 0;
  if (lastFlairReconcileAt > 0 && nowMs - lastFlairReconcileAt < VIEWER_FLAIR_RECONCILE_INTERVAL_MS) {
    return false;
  }
  return true;
}

function normalizeCssClass(value: string): string {
  return value.trim().toLowerCase();
}

function cssClassMatchesSubstring(configuredCssValue: string, detectedCssClass: string): boolean {
  const configured = normalizeCssClass(configuredCssValue);
  const detected = normalizeCssClass(detectedCssClass);
  if (!configured || !detected) {
    return false;
  }
  return detected.includes(configured);
}

function isManualFlairCheckSource(source: string): boolean {
  return (
    typeof source === 'string' &&
    (source.includes(MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER) || source.includes(MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER))
  );
}

function normalizeSubredditNameForApi(subredditName: string): string {
  return subredditName.trim().replace(/^\/?r\//i, '').replace(/^\/+/, '').replace(/\/+$/, '');
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

async function checkVerificationFlair(
  context: Devvit.Context,
  subredditName: string,
  username: string,
  config: RuntimeConfig,
  viewerFlairSnapshot?: ViewerFlairSnapshot
): Promise<FlairVerificationCheck> {
  const configuredTemplateId = normalizeTemplateId(config.flairTemplateId);
  const configuredTemplateIds = configuredApprovalTemplateIds(config);
  const templateCheckEnabled = Boolean(configuredTemplateId);
  const configuredCssClass = normalizeCssClass(config.flairCssClass);
  const snapshot =
    viewerFlairSnapshot ?? (await getViewerFlairSnapshot(context, sanitizeSubredditName(subredditName), username));
  const snapshotTemplateId = normalizeTemplateId(snapshot.flairTemplateId);
  const detectedCssClass = normalizeCssClass(snapshot.flairCssClass);
  const cssMatched = configuredCssClass ? cssClassMatchesSubstring(configuredCssClass, detectedCssClass) : false;
  const cachedTemplateText = config.flairTemplateCacheText.trim().toLowerCase();
  const additionalTemplateTextMatches = (Array.isArray(config.additionalApprovalFlairs) ? config.additionalApprovalFlairs : [])
    .map((item) => ({
      templateId: normalizeTemplateId(item.templateId),
      text: String(item.text ?? '').trim().toLowerCase(),
    }))
    .filter((item) => item.templateId && item.text);
  const snapshotText = snapshot.flairText.trim().toLowerCase();

  let detectedTemplateId = snapshotTemplateId;
  let templateSource = snapshotTemplateId ? 'viewer-snapshot' : '';

  if (templateCheckEnabled && snapshotTemplateId && configuredTemplateIds.includes(snapshotTemplateId)) {
    return {
      verified: true,
      configuredTemplateId,
      detectedTemplateId: snapshotTemplateId,
      source: 'viewer-snapshot:template-match',
      error: null,
    };
  }

  if (
    templateCheckEnabled &&
    !snapshotTemplateId &&
    cachedTemplateText &&
    snapshotText &&
    cachedTemplateText === snapshotText
  ) {
    return {
      verified: true,
      configuredTemplateId,
      detectedTemplateId: configuredTemplateId,
      source: 'viewer-snapshot:cached-text-match',
      error: null,
    };
  }

  if (templateCheckEnabled && !snapshotTemplateId && snapshotText) {
    const additionalTextMatch = additionalTemplateTextMatches.find((item) => item.text === snapshotText);
    if (additionalTextMatch) {
      return {
        verified: true,
        configuredTemplateId,
        detectedTemplateId: additionalTextMatch.templateId,
        source: 'viewer-snapshot:additional-text-match',
        error: null,
      };
    }
  }

  if (!configuredTemplateId && !configuredCssClass) {
    return {
      verified: false,
      configuredTemplateId: '',
      detectedTemplateId: '',
      source: 'not-configured',
      error: null,
    };
  }

  if (cssMatched) {
    return {
      verified: true,
      configuredTemplateId,
      detectedTemplateId,
      source: detectedTemplateId
        ? `${templateSource}:${MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER}`
        : `viewer-${MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER}`,
      error: null,
    };
  }

  if (detectedTemplateId) {
    return {
      verified: false,
      configuredTemplateId,
      detectedTemplateId,
      source: templateSource ? `${templateSource}:template-mismatch` : 'template-mismatch',
      error: null,
    };
  }

  return {
    verified: false,
    configuredTemplateId,
    detectedTemplateId: '',
    source: 'viewer-snapshot:no-match',
    error: null,
  };
}

async function listPendingVerifications(context: Devvit.Context, subredditId: string): Promise<VerificationRecord[]> {
  const members = await context.redis.zRange(pendingIndexKey(subredditId), 0, MAX_PENDING_TO_LOAD - 1, {
    by: 'rank',
    reverse: true,
  });

  if (members.length === 0) {
    return [];
  }

  const recordKeys = members.map((member) => verificationRecordKey(subredditId, member.member));
  const payloads = await context.redis.mGet(recordKeys);
  const records: VerificationRecord[] = [];
  const stalePendingIds: string[] = [];
  const claimRecordsToRefresh: VerificationRecord[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      stalePendingIds.push(members[index].member);
      continue;
    }
    const parsed = parseRecord(payload);
    if (parsed && parsed.status === 'pending') {
      if (!parsed.subredditId) {
        parsed.subredditId = subredditId;
      }
      const normalizedRecord = clearExpiredPendingClaim(parsed);
      if (pendingClaimChanged(parsed, normalizedRecord)) {
        claimRecordsToRefresh.push(normalizedRecord);
      }
      records.push(normalizedRecord);
      continue;
    }
    stalePendingIds.push(members[index].member);
  }

  if (claimRecordsToRefresh.length > 0) {
    await Promise.all(claimRecordsToRefresh.map((record) => setRecord(context, subredditId, record)));
  }

  if (stalePendingIds.length > 0) {
    await context.redis.zRem(pendingIndexKey(subredditId), Array.from(new Set(stalePendingIds)));
    await removeValidationTrackingForRecordIds(context, subredditId, stalePendingIds);
  }

  return records;
}

async function searchHistoryRecords(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<HistorySearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = query.username ? normalizeUsernameForLookup(query.username) : '';
  if (usernameFilter.length > 0 && usernameFilter.length < 3) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const baseKey = historyDateIndexKey(subredditId);
  const candidateCount = limit * (usernameFilter ? 8 : 3);

  const candidates = await context.redis.zRange(baseKey, minScore, maxScore, {
    by: 'score',
    reverse: true,
    limit: { offset, count: candidateCount },
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const candidateIds = candidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const items: HistorySearchPanelItem[] = [];
  const staleIds: string[] = [];
  let scannedCount = 0;

  for (let index = 0; index < payloads.length; index++) {
    scannedCount += 1;
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      staleIds.push(recordId);
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed) {
      staleIds.push(recordId);
      continue;
    }
    if (usernameFilter && !normalizeUsernameForLookup(parsed.username).startsWith(usernameFilter)) {
      continue;
    }
    items.push({
      id: parsed.id,
      username: parsed.username,
      status: parsed.status,
      submittedAt: parsed.submittedAt,
      acknowledgedAt: parsed.ageAcknowledgedAt,
      reviewedAt: parsed.reviewedAt ?? null,
      moderator: parsed.moderator ?? null,
      denyReason: parseDenyReason(parsed.denyReason) ?? null,
      parentVerificationId: parsed.parentVerificationId ?? null,
      reopenedChildId: null,
      reopenedState: 'none',
    });
    if (items.length >= limit) {
      break;
    }
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(baseKey, Array.from(new Set(staleIds)));
  }

  const deniedItems = items.filter((item) => item.status === 'denied');
  if (deniedItems.length > 0) {
    const [reopenedChildIds, reopenedStates] = await Promise.all([
      mGetStringValuesInChunks(
        context,
        deniedItems.map((item) => reopenedChildByDeniedKey(subredditId, item.id))
      ),
      mGetStringValuesInChunks(
        context,
        deniedItems.map((item) => reopenedStateByDeniedKey(subredditId, item.id))
      ),
    ]);
    const deniedIndexesByChildId = new Map<string, number>();
    const presentChildIds: string[] = [];
    for (let index = 0; index < deniedItems.length; index++) {
      const childId = reopenedChildIds[index];
      const normalizedChildId = typeof childId === 'string' ? childId.trim() : '';
      deniedItems[index].reopenedChildId = normalizedChildId || null;
      deniedItems[index].reopenedState = normalizedChildId
        ? 'yes'
        : reopenedStates[index] === 'cancelled'
          ? 'yes_cancelled'
          : 'none';
      if (normalizedChildId) {
        deniedIndexesByChildId.set(normalizedChildId, index);
        presentChildIds.push(normalizedChildId);
      }
    }

    if (presentChildIds.length > 0) {
      const childPayloads = await mGetStringValuesInChunks(
        context,
        presentChildIds.map((childId) => verificationRecordKey(subredditId, childId))
      );
      const staleParentIds: string[] = [];
      for (let childIndex = 0; childIndex < childPayloads.length; childIndex++) {
        const payload = childPayloads[childIndex];
        if (payload) {
          continue;
        }
        const childId = presentChildIds[childIndex];
        const deniedIndex = deniedIndexesByChildId.get(childId);
        if (deniedIndex === undefined) {
          continue;
        }
        deniedItems[deniedIndex].reopenedChildId = null;
        if (deniedItems[deniedIndex].reopenedState === 'yes') {
          deniedItems[deniedIndex].reopenedState = 'none';
        }
        staleParentIds.push(deniedItems[deniedIndex].id);
      }
      if (staleParentIds.length > 0) {
        await context.redis.del(...staleParentIds.map((parentId) => reopenedChildByDeniedKey(subredditId, parentId)));
      }
    }
  }

  return {
    items,
    offset: offset + scannedCount,
    hasMore: scannedCount < candidates.length || candidates.length >= candidateCount,
    requestId: 0,
  };
}

async function searchApprovedRecords(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<ApprovedSearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = query.username ? normalizeUsername(query.username) : '';
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }
  if (!usernameFilter) {
    const candidates = await context.redis.zRange(approvedIndexKey(subredditId), minScore, maxScore, {
      by: 'score',
      reverse: true,
      limit: { offset, count: limit * 4 },
    });
    if (candidates.length === 0) {
      return { items: [], offset, hasMore: false, requestId: 0 };
    }

    const candidateIds = candidates.map((entry) => entry.member);
    const payloads = await mGetStringValuesInChunks(
      context,
      candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
    );

    const items: ApprovedSearchPanelItem[] = [];
    const staleIds: string[] = [];
    let scannedCount = 0;
    for (let index = 0; index < payloads.length; index++) {
      scannedCount += 1;
      const payload = payloads[index];
      const recordId = candidateIds[index];
      if (!payload) {
        staleIds.push(recordId);
        continue;
      }
      const parsed = parseRecord(payload);
      if (!parsed || parsed.status !== 'approved') {
        staleIds.push(recordId);
        continue;
      }
      items.push({
        id: parsed.id,
        username: parsed.username,
        approvedAt: parsed.reviewedAt ?? parsed.submittedAt,
        approvedBy: parsed.moderator ?? 'unknown',
        acknowledgedAt: parsed.ageAcknowledgedAt,
      });
      if (items.length >= limit) {
        break;
      }
    }

    if (staleIds.length > 0) {
      await context.redis.zRem(approvedIndexKey(subredditId), Array.from(new Set(staleIds)));
      await removeValidationTrackingForRecordIds(context, subredditId, staleIds);
    }

    return {
      items,
      offset: offset + scannedCount,
      hasMore: scannedCount < candidates.length || candidates.length >= limit * 4,
      requestId: 0,
    };
  }

  if (usernameFilter.length < 3) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const prefix3 = usernameFilter.slice(0, 3);
  const prefixKey = approvedPrefixIndexKey(subredditId, prefix3);
  const candidateCount = limit * APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER;
  const candidates = await context.redis.zRange(prefixKey, minScore, maxScore, {
    by: 'score',
    reverse: true,
    limit: { offset, count: candidateCount + 1 },
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const hasMoreCandidates = candidates.length > candidateCount;
  const candidateWindow = hasMoreCandidates ? candidates.slice(0, candidateCount) : candidates;
  const candidateIds = candidateWindow.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );

  const items: ApprovedSearchPanelItem[] = [];
  const staleIds: string[] = [];
  let matchedCount = 0;
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const recordId = candidateIds[index];
    if (!payload) {
      staleIds.push(recordId);
      continue;
    }
    const parsed = parseRecord(payload);
    if (!parsed || parsed.status !== 'approved') {
      staleIds.push(recordId);
      continue;
    }
    const normalizedUsername = normalizeUsername(parsed.username);
    if (!normalizedUsername.startsWith(usernameFilter)) {
      continue;
    }
    matchedCount += 1;
    if (items.length < limit) {
      items.push({
        id: parsed.id,
        username: parsed.username,
        approvedAt: parsed.reviewedAt ?? parsed.submittedAt,
        approvedBy: parsed.moderator ?? 'unknown',
        acknowledgedAt: parsed.ageAcknowledgedAt,
      });
    }
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(prefixKey, Array.from(new Set(staleIds)));
  }

  return {
    items,
    offset: offset + candidateWindow.length,
    hasMore: matchedCount > limit || hasMoreCandidates,
    requestId: 0,
  };
}

async function searchAuditEntries(
  context: Devvit.Context,
  subredditId: string,
  query: {
    username?: string;
    actor?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }
): Promise<AuditSearchResponsePayload> {
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 25)));
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const usernameFilter = query.username ? normalizeUsernameForLookup(query.username) : '';
  const actorFilter = query.actor ? normalizeUsernameForLookup(query.actor) : '';
  const actionFilter = asAuditAction(query.action);
  if ((usernameFilter.length > 0 && usernameFilter.length < 3) || (actorFilter.length > 0 && actorFilter.length < 3)) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }
  const fromMs = parseSearchBoundaryMs(query.fromDate, false);
  const toMs = parseSearchBoundaryMs(query.toDate, true);
  const minScore = Number.isFinite(fromMs) ? fromMs : 0;
  const maxScore = Number.isFinite(toMs) ? toMs : Date.now();
  if (minScore > maxScore) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const candidates = await context.redis.zRange(auditDateIndexKey(subredditId), minScore, maxScore, {
    by: 'score',
    reverse: true,
    limit: { offset, count: limit * 4 },
  });
  if (candidates.length === 0) {
    return { items: [], offset, hasMore: false, requestId: 0 };
  }

  const candidateIds = candidates.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((auditId) => auditEntryKey(subredditId, auditId))
  );

  const items: AuditSearchPanelItem[] = [];
  const staleIds: string[] = [];
  let scannedCount = 0;
  for (let index = 0; index < payloads.length; index++) {
    scannedCount += 1;
    const payload = payloads[index];
    const auditId = candidateIds[index];
    if (!payload) {
      staleIds.push(auditId);
      continue;
    }
    const parsed = parseAuditEntry(payload);
    if (!parsed) {
      staleIds.push(auditId);
      continue;
    }
    if (usernameFilter && !normalizeUsernameForLookup(parsed.username).startsWith(usernameFilter)) {
      continue;
    }
    if (actorFilter && !normalizeUsernameForLookup(parsed.actor).startsWith(actorFilter)) {
      continue;
    }
    if (actionFilter && parsed.action !== actionFilter) {
      continue;
    }
    items.push({
      id: parsed.id,
      username: parsed.username,
      actor: parsed.actor,
      action: parsed.action,
      line: formatAuditEntry(parsed),
      at: parsed.at,
    });
    if (items.length >= limit) {
      break;
    }
  }

  if (staleIds.length > 0) {
    await context.redis.zRem(auditDateIndexKey(subredditId), Array.from(new Set(staleIds)));
  }

  return {
    items,
    offset: offset + scannedCount,
    hasMore: scannedCount < candidates.length || candidates.length >= limit * 4,
    requestId: 0,
  };
}

async function listBlockedUsers(context: Devvit.Context, subredditId: string): Promise<BlockedUserEntry[]> {
  const blockedMap = await context.redis.hGetAll(blockedUsersKey(subredditId));
  const config = await getRuntimeConfig(context, subredditId);
  const blockedUsers: BlockedUserEntry[] = [];
  const staleUsers: string[] = [];

  for (const [normalizedUsername, payload] of Object.entries(blockedMap)) {
    const parsed = parseBlockedUserEntry(normalizedUsername, payload, config.maxDenialsBeforeBlock);
    if (!parsed) {
      staleUsers.push(normalizedUsername);
      continue;
    }
    blockedUsers.push(parsed);
  }

  if (staleUsers.length > 0) {
    await context.redis.hDel(blockedUsersKey(subredditId), staleUsers);
  }

  blockedUsers.sort((a, b) => {
    const aTime = new Date(a.blockedAt).getTime() || 0;
    const bTime = new Date(b.blockedAt).getTime() || 0;
    return bTime - aTime;
  });

  return blockedUsers;
}

async function getBlockedUser(
  context: Devvit.Context,
  subredditId: string,
  username: string
): Promise<BlockedUserEntry | null> {
  const config = await getRuntimeConfig(context, subredditId);
  const normalizedUsername = normalizeUsername(username);
  const key = blockedUsersKey(subredditId);
  const lookupFields = usernameLookupFields(username);
  const primaryField = primaryUsernameLookupField(username);
  let matchedField = '';
  let payload: string | null = null;
  for (const field of lookupFields) {
    payload = (await context.redis.hGet(key, field)) ?? null;
    if (payload) {
      matchedField = field;
      break;
    }
  }
  if (!payload) {
    return null;
  }
  const parsed = parseBlockedUserEntry(matchedField || normalizedUsername, payload, config.maxDenialsBeforeBlock);
  if (!parsed) {
    if (lookupFields.length > 0) {
      await context.redis.hDel(key, lookupFields);
    }
    return null;
  }
  if (primaryField) {
    await context.redis.hSet(key, { [primaryField]: JSON.stringify(parsed) });
  }
  const staleFields = lookupFields.filter((field) => field !== primaryField);
  if (staleFields.length > 0) {
    await context.redis.hDel(key, staleFields);
  }
  return parsed;
}

async function isUserBlocked(context: Devvit.Context, subredditId: string, username: string): Promise<boolean> {
  return (await getBlockedUser(context, subredditId, username)) !== null;
}

async function repairMissingAutoBlockForUser(
  context: Devvit.Context,
  subredditId: string,
  username: string,
  config: RuntimeConfig
): Promise<BlockedUserEntry | null> {
  const existingBlocked = await getBlockedUser(context, subredditId, username);
  if (existingBlocked) {
    return existingBlocked;
  }
  if (config.maxDenialsBeforeBlock <= 0) {
    return null;
  }

  const deniedCount = await getStoredDenialCount(context, subredditId, username);
  if (deniedCount < config.maxDenialsBeforeBlock) {
    return null;
  }

  const normalizedUsername = normalizeUsernameForLookup(username);
  if (!normalizedUsername) {
    return null;
  }

  const entry: BlockedUserEntry = {
    username: normalizedUsername,
    blockedAt: new Date().toISOString(),
    deniedCount,
    reason: `Reached ${deniedCount} denials`,
  };
  await setBlockedUser(context, subredditId, entry);
  return entry;
}

async function incrementDenialCount(context: Devvit.Context, subredditId: string, username: string): Promise<number> {
  const key = denialCountKey(subredditId);
  const normalizedUsername = normalizeUsername(username);
  const next = (await getStoredDenialCount(context, subredditId, normalizedUsername)) + 1;
  await context.redis.hSet(key, { [normalizedUsername]: `${next}` });
  return next;
}

async function setBlockedUser(context: Devvit.Context, subredditId: string, entry: BlockedUserEntry): Promise<void> {
  await context.redis.hSet(blockedUsersKey(subredditId), {
    [normalizeUsername(entry.username)]: JSON.stringify(entry),
  });
}

async function unblockUserForModerator(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  username: string,
  moderator: string
): Promise<boolean> {
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    return false;
  }
  const blocked = await getBlockedUser(context, subredditId, normalizedUsername);
  if (!blocked) {
    return false;
  }

  const lookupFields = usernameLookupFields(username);
  if (lookupFields.length > 0) {
    await context.redis.hDel(blockedUsersKey(subredditId), lookupFields);
    await context.redis.hDel(denialCountKey(subredditId), lookupFields);
  }

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName,
      username: blocked.username,
      actor: moderator,
      action: 'unblocked',
      notes: `Removed submission block for u/${blocked.username}.`,
    });
  } catch (error) {
    console.log(`Audit log write failed (unblocked): ${errorText(error)}`);
  }

  return true;
}

async function blockUserForModerator(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  username: string,
  moderator: string
): Promise<{ alreadyBlocked: boolean; entry: BlockedUserEntry }> {
  const normalizedUsername = normalizeUsernameStrict(username);
  if (!normalizedUsername) {
    throw new Error('A valid username is required.');
  }

  try {
    const user = await context.reddit.getUserByUsername(normalizedUsername);
    if (!user) {
      throw new Error('User lookup returned no result.');
    }
  } catch (error) {
    const message = errorText(error).toLowerCase();
    if (looksLikeDeletedOrSuspendedError(message)) {
      throw new Error(`u/${normalizedUsername} was not found or is suspended.`);
    }
    throw new Error(`Unable to validate u/${normalizedUsername}. ${errorText(error)}`);
  }

  const existing = await getBlockedUser(context, subredditId, normalizedUsername);
  if (existing) {
    return { alreadyBlocked: true, entry: existing };
  }

  const deniedCount = await getStoredDenialCount(context, subredditId, normalizedUsername);

  const entry: BlockedUserEntry = {
    username: normalizedUsername,
    blockedAt: new Date().toISOString(),
    deniedCount,
    reason: 'Blocked by moderator',
  };

  if (deniedCount > 0) {
    await context.redis.hSet(denialCountKey(subredditId), { [normalizedUsername]: `${deniedCount}` });
  } else {
    await context.redis.hDel(denialCountKey(subredditId), [normalizedUsername, `u/${normalizedUsername}`]);
  }
  await setBlockedUser(context, subredditId, entry);

  try {
    await appendAuditLog(context, {
      subredditId,
      subredditName,
      username: entry.username,
      actor: moderator,
      action: 'blocked',
      notes: 'Manual moderator block.',
    });
  } catch (error) {
    console.log(`Audit log write failed (manual_block): ${errorText(error)}`);
  }

  return { alreadyBlocked: false, entry };
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
    await context.redis.del(userPendingKey(subredditId, normalizedUsername));
    await context.redis.del(userLatestKey(subredditId, normalizedUsername));
    return;
  }

  const payloads = await mGetStringValuesInChunks(
    context,
    recordIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );
  const byModerator = new Map<string, string[]>();
  const approvedPrefixEntries: Array<{ recordId: string; username: string }> = [];
  const reopenMetaKeysToDelete = new Set<string>();
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

  await context.redis.del(userPendingKey(subredditId, normalizedUsername));
  await context.redis.del(userLatestKey(subredditId, normalizedUsername));
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
      await context.redis.del(userPendingKey(subredditId, normalizedUsername));
    }
    const latestId = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
    if (latestId && deletedIds.includes(latestId)) {
      const fallbackLatestId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
      if (fallbackLatestId) {
        await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackLatestId);
      } else {
        await context.redis.del(userLatestKey(subredditId, normalizedUsername));
      }
    }
  }

  for (const [normalizedModerator, deletedIds] of byModerator.entries()) {
    await context.redis.zRem(historyByModeratorIndexKey(subredditId, normalizedModerator), deletedIds);
  }

  return recordDeleteList.length;
}

async function findLatestExistingRecordIdForUser(
  context: RedisContext,
  subredditId: string,
  normalizedUsername: string
): Promise<string | null> {
  const historyEntries = await context.redis.zRange(historyByUserIndexKey(subredditId, normalizedUsername), 0, -1, {
    by: 'rank',
    reverse: true,
  });
  if (historyEntries.length === 0) {
    return null;
  }

  const historyIds = historyEntries.map((entry) => entry.member);
  const payloads = await context.redis.mGet(historyIds.map((id) => verificationRecordKey(subredditId, id)));
  const staleHistoryIds: string[] = [];

  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      staleHistoryIds.push(historyIds[index]);
      continue;
    }
    const parsed = parseRecord(payload);
    if (parsed) {
      return historyIds[index];
    }
    staleHistoryIds.push(historyIds[index]);
  }

  if (staleHistoryIds.length > 0) {
    await context.redis.zRem(historyByUserIndexKey(subredditId, normalizedUsername), staleHistoryIds);
  }

  return null;
}

async function removeRecordIdsFromGlobalIndexes(
  context: RedisContext,
  subredditId: string,
  recordIds: string[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(recordIds.map((recordId) => recordId.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return;
  }

  await context.redis.zRem(historyDateIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(pendingIndexKey(subredditId), uniqueIds);
  await context.redis.zRem(approvedIndexKey(subredditId), uniqueIds);
  await removeValidationTrackingForRecordIds(context, subredditId, uniqueIds);
}

async function sweepStaleRecordIndexEntries(
  context: RedisContext,
  subredditId: string,
  batchSize = STALE_RECORD_INDEX_SWEEP_BATCH_SIZE
): Promise<number> {
  const cursorKey = staleRecordIndexSweepCursorKey(subredditId);
  const cursorRaw = await context.redis.get(cursorKey);
  const cursor = Math.max(0, Number.parseInt(cursorRaw ?? '0', 10) || 0);
  const members = await context.redis.zRange(historyDateIndexKey(subredditId), cursor, cursor + batchSize - 1, {
    by: 'rank',
  });

  if (members.length === 0) {
    await context.redis.del(cursorKey);
    return 0;
  }

  const candidateIds = members.map((entry) => entry.member);
  const payloads = await mGetStringValuesInChunks(
    context,
    candidateIds.map((recordId) => verificationRecordKey(subredditId, recordId))
  );

  const staleIds: string[] = [];
  let liveCount = 0;
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    if (!payload) {
      staleIds.push(candidateIds[index]);
      continue;
    }
    if (!parseRecord(payload)) {
      staleIds.push(candidateIds[index]);
      continue;
    }
    liveCount += 1;
  }

  if (staleIds.length > 0) {
    await removeRecordIdsFromGlobalIndexes(context, subredditId, staleIds);
  }

  const totalRecords = await context.redis.zCard(historyDateIndexKey(subredditId));
  const nextCursor = cursor + liveCount;
  if (nextCursor >= totalRecords) {
    await context.redis.del(cursorKey);
  } else {
    await context.redis.set(cursorKey, `${nextCursor}`);
  }

  return staleIds.length;
}

async function estimateSubredditStorageUsage(
  context: Devvit.Context,
  subredditId: string
): Promise<StorageUsage> {
  await sweepStaleRecordIndexEntries(context, subredditId);
  await purgeAuditLogOlderThanDays(context, subredditId, AUDIT_RETENTION_DAYS);
  const recordCount = await context.redis.zCard(historyDateIndexKey(subredditId));
  const auditCount = await context.redis.zCard(auditDateIndexKey(subredditId));
  const blockedCount = await context.redis.hLen(blockedUsersKey(subredditId));
  const deniedCountEntries = await context.redis.hLen(denialCountKey(subredditId));
  const configMap = await context.redis.hGetAll(subredditConfigKey(subredditId));
  const configBytes = Object.entries(configMap).reduce(
    (sum, [key, value]) => sum + utf8ByteLength(key) + utf8ByteLength(value),
    0
  );

  // Approximation to avoid expensive full scans for large subreddits.
  const estimatedBytes =
    configBytes +
    recordCount * 1100 +
    auditCount * 500 +
    blockedCount * 220 +
    deniedCountEntries * 60;
  const percent = Math.max(0, Math.min(100, Math.round((estimatedBytes / STORAGE_METER_CAP_BYTES) * 1000) / 10));
  return {
    estimatedBytes,
    capBytes: STORAGE_METER_CAP_BYTES,
    percent,
    recordCount,
    auditCount,
    blockedCount,
    deniedCountEntries,
  };
}

function emptyStorageUsage(): StorageUsage {
  return {
    estimatedBytes: 0,
    capBytes: STORAGE_METER_CAP_BYTES,
    percent: 0,
    recordCount: 0,
    auditCount: 0,
    blockedCount: 0,
    deniedCountEntries: 0,
  };
}

async function mGetStringValuesInChunks(
  context: RedisContext,
  keys: string[],
  chunkSize = 250
): Promise<Array<string | null>> {
  if (keys.length === 0) {
    return [];
  }
  const values: Array<string | null> = [];
  for (let index = 0; index < keys.length; index += chunkSize) {
    const chunk = keys.slice(index, index + chunkSize);
    const chunkValues = await context.redis.mGet(chunk);
    values.push(...chunkValues);
  }
  return values;
}

function utf8ByteLength(input: string): number {
  return Buffer.byteLength(input, 'utf8');
}

async function appendAuditLog(
  context: Devvit.Context,
  input: Omit<AuditLogEntry, 'id' | 'at'> & { at?: string }
): Promise<string> {
  const id = makeVerificationId(new Date());
  const entry: AuditLogEntry = {
    id,
    subredditId: sanitizeSubredditId(input.subredditId),
    subredditName: sanitizeSubredditName(input.subredditName),
    username: input.username,
    action: input.action,
    actor: input.actor,
    at: input.at ?? new Date().toISOString(),
    verificationId: input.verificationId,
    notes: input.notes,
  };
  const entryAtMs = getFiniteTimestampMs(entry.at, Date.now());

  await context.redis.set(auditEntryKey(entry.subredditId, id), JSON.stringify(entry), {
    expiration: new Date(entryAtMs + AUDIT_RETENTION_DAYS * MILLIS_PER_DAY),
  });
  await context.redis.zAdd(auditDateIndexKey(entry.subredditId), {
    member: id,
    score: entryAtMs,
  });
  return id;
}

async function getLatestRecordForUser(
  context: Devvit.Context,
  subredditId: string,
  username: string
): Promise<VerificationRecord | null> {
  const normalizedUsername = normalizeUsername(username);
  let id = await context.redis.get(userLatestKey(subredditId, normalizedUsername));
  if (!id) {
    const fallbackId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
    if (!fallbackId) {
      return null;
    }
    id = fallbackId;
    await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackId);
  }

  const record = await getRecord(context, subredditId, id);
  if (!record) {
    await context.redis.del(userLatestKey(subredditId, normalizedUsername));
    await context.redis.del(userPendingKey(subredditId, normalizedUsername));
    const fallbackId = await findLatestExistingRecordIdForUser(context, subredditId, normalizedUsername);
    if (!fallbackId) {
      return null;
    }
    await context.redis.set(userLatestKey(subredditId, normalizedUsername), fallbackId);
    return await getRecord(context, subredditId, fallbackId);
  }

  return record;
}

async function getRecord(context: RedisContext, subredditId: string, verificationId: string): Promise<VerificationRecord | null> {
  const payload = await context.redis.get(verificationRecordKey(subredditId, verificationId));
  if (!payload) {
    return null;
  }
  const parsed = parseRecord(payload);
  if (!parsed) {
    return null;
  }
  if (!parsed.subredditId) {
    parsed.subredditId = subredditId;
  }
  return parsed;
}

function getFiniteTimestampMs(input: string | null | undefined, fallbackMs: number): number {
  const parsedMs = typeof input === 'string' ? new Date(input).getTime() : Number.NaN;
  return Number.isFinite(parsedMs) ? parsedMs : fallbackMs;
}

function getApprovedRecordRetentionAnchorMs(
  record: Pick<VerificationRecord, 'submittedAt' | 'reviewedAt' | 'lastTtlBumpAt'>,
  fallbackMs = Date.now()
): number {
  if (typeof record.lastTtlBumpAt === 'number' && Number.isFinite(record.lastTtlBumpAt)) {
    return Math.max(0, Math.floor(record.lastTtlBumpAt));
  }

  const reviewedMs = getFiniteTimestampMs(record.reviewedAt, Number.NaN);
  if (Number.isFinite(reviewedMs)) {
    return reviewedMs;
  }

  return getFiniteTimestampMs(record.submittedAt, fallbackMs);
}

function getHistoryRecordAnchorMs(
  record: Pick<VerificationRecord, 'status' | 'submittedAt' | 'reviewedAt' | 'removedAt'>,
  fallbackMs = Date.now()
): number {
  if (record.status === 'removed') {
    const removedMs = getFiniteTimestampMs(record.removedAt, Number.NaN);
    if (Number.isFinite(removedMs)) {
      return removedMs;
    }
  }

  if (record.status === 'approved' || record.status === 'denied') {
    const reviewedMs = getFiniteTimestampMs(record.reviewedAt, Number.NaN);
    if (Number.isFinite(reviewedMs)) {
      return reviewedMs;
    }
  }

  return getFiniteTimestampMs(record.submittedAt, fallbackMs);
}

async function setRecord(context: RedisContext, subredditId: string, record: VerificationRecord): Promise<void> {
  const recordToStore: VerificationRecord = {
    ...record,
    subredditId,
  };
  const nowMs = Date.now();
  let expirationMs = nowMs + HISTORY_RETENTION_DAYS * MILLIS_PER_DAY;
  if (recordToStore.status === 'approved') {
    const lastTtlBumpAt = getApprovedRecordRetentionAnchorMs(recordToStore, nowMs);
    recordToStore.lastTtlBumpAt = lastTtlBumpAt;
    expirationMs = lastTtlBumpAt + VERIFIED_RECORD_RETENTION_DAYS * MILLIS_PER_DAY;
  }
  await context.redis.set(verificationRecordKey(subredditId, record.id), JSON.stringify(recordToStore), {
    expiration: new Date(expirationMs),
  });
}

async function getModeratorAccessSnapshot(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<ModeratorAccessSnapshot> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const permissions = await getCurrentModeratorPermissionList(context, sanitizedSubreddit, username);
  if (permissions.length > 0) {
    return {
      isModerator: true,
      permissions,
    };
  }

  const errors: string[] = [];

  try {
    const mods = await context.reddit.getModerators({ subredditName: sanitizedSubreddit, limit: 100 }).all();
    if (mods.some((modUser) => usernamesEqual(modUser.username, username))) {
      await cacheModeratorRole(context, username);
      return {
        isModerator: true,
        permissions,
      };
    }
  } catch (error) {
    errors.push(`broad moderators listing path: ${errorText(error)}`);
  }

  try {
    const mods = await context.reddit
      .getModerators({ subredditName: sanitizedSubreddit, username, limit: 1 })
      .all();
    if (mods.some((modUser) => usernamesEqual(modUser.username, username))) {
      await cacheModeratorRole(context, username);
      return {
        isModerator: true,
        permissions,
      };
    }
  } catch (error) {
    errors.push(`moderators listing path: ${errorText(error)}`);
  }

  if (await getCachedModeratorRole(context, username)) {
    return {
      isModerator: true,
      permissions,
    };
  }

  if (errors.length > 0) {
    await logModeratorLookupFailureWithCooldown(
      context,
      'membership',
      username,
      `Moderator membership lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errors.join(' | ')}`
    );
  }

  return {
    isModerator: false,
    permissions,
  };
}

async function assertCanReview(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<void> {
  const canManageUsers = await hasManageUsersPermission(context, sanitizeSubredditName(subredditName), username);
  if (!canManageUsers) {
    throw new Error('Only moderators with Manage Users permission can review verifications.');
  }
}

async function getSettingsTabRequiresConfigAccess(
  context: Pick<Devvit.Context, 'settings'>
): Promise<boolean> {
  const raw = await context.settings.get<boolean | string>(INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS);
  return typeof raw === 'boolean' ? raw : parseBooleanString(raw, false);
}

async function getCurrentModeratorPermissionList(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<string[]> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const currentUsername = await context.reddit.getCurrentUsername();
  if (!currentUsername || !usernamesEqual(currentUsername, username)) {
    return [];
  }

  try {
    const currentUser = await context.reddit.getCurrentUser();
    if (!currentUser) {
      return await getCachedModeratorPermissions(context, username);
    }
    const permissions = normalizeModeratorPermissions(
      await currentUser.getModPermissionsForSubreddit(sanitizedSubreddit)
    );
    await cacheModeratorPermissions(context, username, permissions);
    return permissions;
  } catch (error) {
    const cachedPermissions = await getCachedModeratorPermissions(context, username);
    if (cachedPermissions.length > 0) {
      return cachedPermissions;
    }
    await logModeratorLookupFailureWithCooldown(
      context,
      'permissions',
      username,
      `Moderator permission lookup failed for r/${sanitizedSubreddit} u/${maskUsernameForLog(username)}: ${errorText(error)}`
    );
    return cachedPermissions;
  }
}

async function assertCanAccessModeratorSettingsTab(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<void> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  await assertCanReview(context, sanitizedSubreddit, username);
  const settingsTabRequiresConfigAccess = await getSettingsTabRequiresConfigAccess(context);
  if (!settingsTabRequiresConfigAccess) {
    return;
  }
  const hasSettingsAccess = await hasConfigAccessPermission(context, sanitizedSubreddit, username);
  if (!hasSettingsAccess) {
    throw new Error('Only moderators with config/settings access can use the Settings tab.');
  }
}

async function hasManageUsersPermission(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<boolean> {
  const permissions = await getCurrentModeratorPermissionList(context, subredditName, username);
  return hasManageUsersPermissionInList(permissions);
}

async function hasConfigAccessPermission(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<boolean> {
  const permissions = await getCurrentModeratorPermissionList(context, subredditName, username);
  return hasConfigAccessPermissionInList(permissions);
}

async function hasAllModeratorPermission(
  context: Devvit.Context,
  subredditName: string,
  username: string
): Promise<boolean> {
  const permissions = await getCurrentModeratorPermissionList(context, subredditName, username);
  return hasAllModeratorPermissionInList(permissions);
}

function hasManageUsersPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all') || normalized.includes('access');
}

function hasConfigAccessPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all') || normalized.includes('config');
}

function hasAllModeratorPermissionInList(permissions: string[]): boolean {
  const normalized = permissions.map((permission) => permission.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.includes('all');
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
  const flairTemplateId = values.flairTemplateId?.trim() ?? '';
  const flairTemplateValidation = await validateFlairTemplateIdForSubreddit(context, subredditName, flairTemplateId);
  if (!flairTemplateValidation.isValid) {
    throw new Error(flairTemplateValidation.message);
  }
  const normalizedTemplateId = normalizeTemplateId(flairTemplateId);
  const additionalApprovalFlairs = Array.isArray(values.additionalApprovalFlairs)
    ? values.additionalApprovalFlairs
        .map((item) => normalizeApprovalFlairConfig(item))
        .filter((item): item is ApprovalFlairConfig => Boolean(item))
    : [];
  const normalizedAdditional = additionalApprovalFlairs
    .filter((item) => item.templateId !== normalizedTemplateId)
    .filter((item, index, all) => all.findIndex((entry) => entry.templateId === item.templateId) === index)
    .slice(0, 2);
  for (const option of normalizedAdditional) {
    const validation = await validateFlairTemplateIdForSubreddit(context, subredditName, option.templateId);
    if (!validation.isValid) {
      throw new Error(`Additional flair (${option.templateId}) is invalid: ${validation.message}`);
    }
  }

  await context.redis.hSet(subredditConfigKey(subredditId), {
    ...(values.verificationsEnabled === undefined
      ? {}
      : { [CONFIG_FIELD.verificationsEnabled]: `${values.verificationsEnabled !== false}` }),
    [CONFIG_FIELD.requiredPhotoCount]: `${requiredPhotoCount}`,
    [CONFIG_FIELD.photoInstructions]: values.photoInstructions?.trim() ?? '',
    [CONFIG_FIELD.flairTemplateId]: flairTemplateId,
    [CONFIG_FIELD.flairCssClass]: values.flairCssClass?.trim() ?? '',
    [CONFIG_FIELD.additionalApprovalFlairs]: serializeAdditionalApprovalFlairs(normalizedAdditional),
    [CONFIG_FIELD.flairTemplateCacheTemplateId]: normalizedTemplateId,
    [CONFIG_FIELD.flairTemplateCacheText]: '',
    [CONFIG_FIELD.flairTemplateCacheCheckedAt]: '0',
  });

  const refreshedConfig = await getRuntimeConfig(context, subredditId);
  await refreshConfiguredFlairTemplateCache(context, subredditId, subredditName, moderator, refreshedConfig, true);
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
  const multipleApprovalFlairsEnabled =
    typeof rawMultipleApprovalFlairsEnabled === 'boolean'
      ? rawMultipleApprovalFlairsEnabled
      : parseBooleanString(rawMultipleApprovalFlairsEnabled, false);
  const maxDenialsBeforeBlock = normalizeMaxDenialsBeforeBlockSetting(rawMaxDenialsBeforeBlock);
  const showPhotoInstructionsBeforeSubmit =
    typeof rawShowPhotoInstructionsBeforeSubmit === 'boolean'
      ? rawShowPhotoInstructionsBeforeSubmit
      : parseBooleanString(rawShowPhotoInstructionsBeforeSubmit, false);
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
    maxDenialsBeforeBlock,
    requiredPhotoCount,
    photoInstructions: stored[CONFIG_FIELD.photoInstructions] ?? '',
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

function parseRecord(payload: string): VerificationRecord | null {
  try {
    const parsed = JSON.parse(payload) as Partial<VerificationRecord>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.username !== 'string' ||
      (parsed.userId !== undefined && typeof parsed.userId !== 'string') ||
      typeof parsed.subredditName !== 'string' ||
      typeof parsed.ageAcknowledgedAt !== 'string' ||
      typeof parsed.submittedAt !== 'string' ||
      typeof parsed.photoOneUrl !== 'string' ||
      typeof parsed.photoTwoUrl !== 'string' ||
      (parsed.photoThreeUrl !== undefined && typeof parsed.photoThreeUrl !== 'string') ||
      (parsed.status !== 'pending' &&
        parsed.status !== 'approved' &&
        parsed.status !== 'denied' &&
        parsed.status !== 'removed')
    ) {
      return null;
    }
    return {
      id: parsed.id,
      username: parsed.username,
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      subredditId:
        typeof parsed.subredditId === 'string' && parsed.subredditId.trim()
          ? sanitizeSubredditId(parsed.subredditId)
          : '',
      subredditName: parsed.subredditName,
      ageAcknowledgedAt: parsed.ageAcknowledgedAt,
      adultOnlySelfPhotosConfirmedAt:
        typeof parsed.adultOnlySelfPhotosConfirmedAt === 'string' ? parsed.adultOnlySelfPhotosConfirmedAt : null,
      termsAcceptedAt: typeof parsed.termsAcceptedAt === 'string' ? parsed.termsAcceptedAt : null,
      submittedAt: parsed.submittedAt,
      photoOneUrl: parsed.photoOneUrl,
      photoTwoUrl: parsed.photoTwoUrl,
      photoThreeUrl: typeof parsed.photoThreeUrl === 'string' ? parsed.photoThreeUrl : '',
      status: parsed.status,
      moderator: typeof parsed.moderator === 'string' ? parsed.moderator : null,
      reviewedAt: typeof parsed.reviewedAt === 'string' ? parsed.reviewedAt : null,
      denyReason: parseDenyReason(typeof parsed.denyReason === 'string' ? parsed.denyReason : undefined),
      denyNotes: typeof parsed.denyNotes === 'string' ? parsed.denyNotes : null,
      claimedBy: typeof parsed.claimedBy === 'string' ? parsed.claimedBy : null,
      claimedAt: typeof parsed.claimedAt === 'string' ? parsed.claimedAt : null,
      parentVerificationId: typeof parsed.parentVerificationId === 'string' ? parsed.parentVerificationId : null,
      isResubmission: parsed.isResubmission === true,
      accountDetails: parsePendingAccountDetailsSnapshot(parsed.accountDetails),
      removedAt: typeof parsed.removedAt === 'string' ? parsed.removedAt : null,
      removedBy: typeof parsed.removedBy === 'string' ? parsed.removedBy : null,
      lastValidatedAt: typeof parsed.lastValidatedAt === 'string' ? parsed.lastValidatedAt : null,
      nextValidationAt: typeof parsed.nextValidationAt === 'string' ? parsed.nextValidationAt : null,
      hardExpireAt: typeof parsed.hardExpireAt === 'string' ? parsed.hardExpireAt : null,
      validationFailureCount:
        typeof parsed.validationFailureCount === 'number' && Number.isFinite(parsed.validationFailureCount)
          ? Math.max(0, Math.floor(parsed.validationFailureCount))
          : 0,
      terminalValidationFailureCount:
        typeof parsed.terminalValidationFailureCount === 'number' &&
        Number.isFinite(parsed.terminalValidationFailureCount)
          ? Math.max(0, Math.floor(parsed.terminalValidationFailureCount))
          : 0,
      lastTtlBumpAt:
        typeof parsed.lastTtlBumpAt === 'number' && Number.isFinite(parsed.lastTtlBumpAt)
          ? Math.max(0, Math.floor(parsed.lastTtlBumpAt))
          : null,
      lastAppliedFlairTemplateId:
        typeof parsed.lastAppliedFlairTemplateId === 'string'
          ? normalizeTemplateId(parsed.lastAppliedFlairTemplateId)
          : null,
      lastFlairReconcileAt:
        typeof parsed.lastFlairReconcileAt === 'number' && Number.isFinite(parsed.lastFlairReconcileAt)
          ? Math.max(0, Math.floor(parsed.lastFlairReconcileAt))
          : null,
    };
  } catch {
    return null;
  }
}

function parseBlockedUserEntry(
  normalizedUsername: string,
  payload: string,
  fallbackDeniedCount: number
): BlockedUserEntry | null {
  try {
    const parsed = JSON.parse(payload) as Partial<BlockedUserEntry>;
    if (!parsed || typeof parsed.blockedAt !== 'string') {
      return null;
    }
    const deniedCountRaw = Number.parseInt(`${parsed.deniedCount ?? ''}`, 10);
    const deniedCount =
      Number.isFinite(deniedCountRaw) && deniedCountRaw >= 0 ? deniedCountRaw : fallbackDeniedCount;
    const username = normalizeUsernameForLookup(parsed.username ?? normalizedUsername);
    if (!username) {
      return null;
    }
    return {
      username,
      blockedAt: parsed.blockedAt,
      deniedCount,
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : deniedCount > 0
            ? `Reached ${deniedCount} denials`
            : 'Blocked by moderator',
    };
  } catch {
    return null;
  }
}

function parseAuditEntry(payload: string): AuditLogEntry | null {
  try {
    const parsed = JSON.parse(payload) as Partial<AuditLogEntry>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.subredditName !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.actor !== 'string' ||
      typeof parsed.at !== 'string' ||
      (parsed.action !== 'approved' &&
        parsed.action !== 'denied' &&
        parsed.action !== 'reopened' &&
        parsed.action !== 'removed_by_mod' &&
        parsed.action !== 'self_removed' &&
        parsed.action !== 'blocked' &&
        parsed.action !== 'unblocked')
    ) {
      return null;
    }
    return {
      id: parsed.id,
      subredditId:
        typeof parsed.subredditId === 'string' && parsed.subredditId.trim()
          ? sanitizeSubredditId(parsed.subredditId)
          : '',
      subredditName: parsed.subredditName,
      username: parsed.username,
      action: parsed.action,
      actor: parsed.actor,
      at: parsed.at,
      verificationId: typeof parsed.verificationId === 'string' ? parsed.verificationId : undefined,
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
    };
  } catch {
    return null;
  }
}

function makeVerificationId(date: Date): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${date.getTime()}-${random}`;
}

function subredditScopePrefix(subredditId: string): string {
  return `${SUBREDDIT_KEY_PREFIX}:${sanitizeSubredditId(subredditId)}`;
}

function verificationRecordKey(subredditId: string, id: string): string {
  return `${subredditScopePrefix(subredditId)}:verification:${id}`;
}

function pendingIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:pending`;
}

function approvedIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:approved`;
}

function approvedPrefixIndexKey(subredditId: string, prefix3: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:approved:prefix3:v1:${normalizeUsername(prefix3).slice(0, 3)}`;
}

function historyDateIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:date`;
}

function historyByUserIndexKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:user:${normalizeUsername(normalizedUsername)}`;
}

function historyByModeratorIndexKey(subredditId: string, normalizedModerator: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:history:mod:${normalizeUsername(normalizedModerator)}`;
}

function userPendingKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:user:${normalizeUsername(normalizedUsername)}:pending`;
}

function userLatestKey(subredditId: string, normalizedUsername: string): string {
  return `${subredditScopePrefix(subredditId)}:user:${normalizeUsername(normalizedUsername)}:latest`;
}

function blockedUsersKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:blocked`;
}

function denialCountKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:denials`;
}

function auditDateIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:audit:date`;
}

function auditEntryKey(subredditId: string, id: string): string {
  return `${subredditScopePrefix(subredditId)}:audit:${id}`;
}

function subredditConfigKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:config`;
}

function validationDueIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:validation:due`;
}

function validationHardExpireIndexKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:idx:validation:hard-expire`;
}

function validationRunLockKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:lock`;
}

function validationScheduleLockKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:schedule-lock`;
}

function verificationActionLockKey(subredditId: string, verificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:verification-action-lock:${verificationId.trim()}`;
}

function validationBackfillCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:backfill-cursor`;
}

function validationNonApprovedCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:non-approved-cursor`;
}

function validationNonApprovedFailureCountKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:validation:non-approved-failures`;
}

function staleRecordIndexSweepCursorKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:cleanup:stale-record-index-cursor`;
}

function modmailThreadByUserKey(subredditId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:thread-by-user`;
}

function modmailThreadByUserEntryKey(subredditId: string, normalizedUsername: string): string {
  return `${modmailThreadByUserKey(subredditId)}:${normalizeUsername(normalizedUsername)}`;
}

function reopenedChildByDeniedKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-by-denied:${deniedVerificationId.trim()}`;
}

function reopenedStateByDeniedKey(subredditId: string, deniedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-state-by-denied:${deniedVerificationId.trim()}`;
}

function reopenedAuditByReopenedKey(subredditId: string, reopenedVerificationId: string): string {
  return `${subredditScopePrefix(subredditId)}:reopened-audit-by-reopened:${reopenedVerificationId.trim()}`;
}

function modmailDedupeKey(subredditId: string, eventId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:dedupe:${eventId}`;
}

function modmailLockKey(subredditId: string, eventId: string): string {
  return `${subredditScopePrefix(subredditId)}:modmail:lock:${eventId}`;
}

function moderatorPermissionCacheKey(subredditId: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:permissions:${normalizeUsername(username)}`;
}

function moderatorRoleCacheKey(subredditId: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:role:${normalizeUsername(username)}`;
}

function moderatorLookupLogCooldownKey(subredditId: string, scope: string, username: string): string {
  return `${subredditScopePrefix(subredditId)}:moderator:lookup-log:${scope}:${normalizeUsername(username) || 'unknown'}`;
}

function updateNoticeDismissalKey(subredditId: string, moderator: string, targetVersion: string): string {
  const normalizedVersion = parseVersion(targetVersion)?.normalized ?? targetVersion.trim().toLowerCase();
  return `${subredditScopePrefix(subredditId)}:moderator:update-dismissed:${normalizeUsername(
    moderator
  )}:${normalizedVersion}`;
}

function sanitizeSubredditId(input: string): string {
  return input.trim().toLowerCase();
}

function sanitizeSubredditName(input: string): string {
  return input.trim().replace(/^\/?r\//i, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
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

function normalizeUsername(input: string): string {
  return input.trim().replace(/^u\//i, '').toLowerCase();
}

function normalizeUsernameStrict(input: string): string {
  let normalized = input.trim();
  if (!normalized) {
    return '';
  }

  if (/^(?:https?:\/\/)?(?:www\.)?reddit\.com\//i.test(normalized)) {
    normalized = normalized.replace(/^(?:https?:\/\/)?(?:www\.)?reddit\.com\//i, '/');
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.trim().toLowerCase();
      if (hostname !== 'reddit.com' && hostname !== 'www.reddit.com') {
        return '';
      }
      normalized = parsed.pathname;
    } catch {
      return '';
    }
  }

  normalized = normalized.split(/[?#]/, 1)[0]?.trim() ?? '';
  normalized = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized.includes('/')) {
    if (!/^(?:u|user)\//i.test(normalized)) {
      return '';
    }
    normalized = normalized.replace(/^(?:u|user)\//i, '');
  }

  const username = normalized.split('/').find((segment) => segment.trim())?.trim() ?? '';
  return /^[A-Za-z0-9_-]+$/.test(username) ? username.toLowerCase() : '';
}

function normalizeUsernameForLookup(input: string): string {
  return normalizeUsernameStrict(input) || normalizeUsername(input);
}

function primaryUsernameLookupField(input: string): string {
  return normalizeUsernameStrict(input) || normalizeUsername(input);
}

function usernameLookupFields(input: string): string[] {
  const compatibility = normalizeUsername(input);
  const strict = normalizeUsernameStrict(input);
  return Array.from(
    new Set(
      [
        compatibility,
        strict,
        strict ? `u/${strict}` : '',
        strict ? `/u/${strict}` : '',
        strict ? `/user/${strict}` : '',
        strict ? `/user/${strict}/` : '',
        strict ? `https://www.reddit.com/user/${strict}` : '',
        strict ? `https://www.reddit.com/user/${strict}/` : '',
        strict ? `https://www.reddit.com/user/${strict}/about/` : '',
      ].filter((value) => typeof value === 'string' && value.trim())
    )
  );
}

function normalizeModmailConversationId(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized;
}

function normalizeModeratorPermissions(permissions: string[]): string[] {
  return dedupeNonEmpty(permissions.map((permission) => String(permission ?? '').trim()));
}

function getModeratorCacheSubredditId(context: { subredditId?: string | null }): string {
  return sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
}

async function cacheModeratorRole(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string
): Promise<void> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return;
  }

  try {
    await context.redis.set(moderatorRoleCacheKey(subredditId, normalizedUsername), '1', {
      expiration: new Date(Date.now() + MODERATOR_ROLE_CACHE_TTL_MS),
    });
  } catch {
    // Best-effort cache only.
  }
}

async function getCachedModeratorRole(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string
): Promise<boolean> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return false;
  }

  try {
    return Boolean(await context.redis.get(moderatorRoleCacheKey(subredditId, normalizedUsername)));
  } catch {
    return false;
  }
}

async function cacheModeratorPermissions(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string,
  permissions: string[]
): Promise<void> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  const normalizedPermissions = normalizeModeratorPermissions(permissions);
  if (!subredditId || !normalizedUsername || normalizedPermissions.length === 0) {
    return;
  }

  try {
    await context.redis.set(
      moderatorPermissionCacheKey(subredditId, normalizedUsername),
      JSON.stringify(normalizedPermissions),
      {
        expiration: new Date(Date.now() + MODERATOR_PERMISSION_CACHE_TTL_MS),
      }
    );
  } catch {
    // Best-effort cache only.
  }

  await cacheModeratorRole(context, normalizedUsername);
}

async function getCachedModeratorPermissions(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string
): Promise<string[]> {
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return [];
  }

  try {
    const payload = await context.redis.get(moderatorPermissionCacheKey(subredditId, normalizedUsername));
    if (!payload) {
      return [];
    }
    const parsed = JSON.parse(payload) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeModeratorPermissions(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [];
  }
}

async function logModeratorLookupFailureWithCooldown(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  scope: string,
  username: string,
  message: string
): Promise<void> {
  if (looksLikeTransientRedditTransportError(message)) {
    return;
  }
  const subredditId = getModeratorCacheSubredditId(context);
  const normalizedUsername = normalizeUsername(username);
  if (!subredditId || !normalizedUsername) {
    return;
  }

  try {
    const shouldLog = await context.redis.set(
      moderatorLookupLogCooldownKey(subredditId, scope, normalizedUsername),
      '1',
      {
        nx: true,
        expiration: new Date(Date.now() + MODERATOR_LOOKUP_LOG_COOLDOWN_MS),
      }
    );
    if (shouldLog !== 'OK') {
      return;
    }
  } catch {
    return;
  }

  console.log(message);
}

function approvedPrefixFromUsername(username: string): string {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    return '';
  }
  return normalized.slice(0, 3);
}

function parseSearchBoundaryMs(value: string | undefined, endOfDay: boolean): number {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return endOfDay ? Date.now() : 0;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`).getTime();
  }
  return new Date(raw).getTime();
}

async function addApprovedPrefixIndexEntry(
  context: RedisContext,
  subredditId: string,
  recordId: string,
  username: string,
  approvedAtMs: number
): Promise<void> {
  const prefix3 = approvedPrefixFromUsername(username);
  if (!prefix3) {
    return;
  }
  await context.redis.zAdd(approvedPrefixIndexKey(subredditId, prefix3), { member: recordId, score: approvedAtMs });
}

async function removeApprovedPrefixIndexEntry(
  context: RedisContext,
  subredditId: string,
  recordId: string,
  username: string
): Promise<void> {
  const prefix3 = approvedPrefixFromUsername(username);
  if (!prefix3) {
    return;
  }
  await context.redis.zRem(approvedPrefixIndexKey(subredditId, prefix3), [recordId]);
}

async function removeApprovedPrefixIndexEntries(
  context: RedisContext,
  subredditId: string,
  entries: Array<{ recordId: string; username: string }>
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const membersByKey = new Map<string, Set<string>>();
  for (const entry of entries) {
    const prefix3 = approvedPrefixFromUsername(entry.username);
    if (!prefix3) {
      continue;
    }
    const key = approvedPrefixIndexKey(subredditId, prefix3);
    const members = membersByKey.get(key) ?? new Set<string>();
    members.add(entry.recordId);
    membersByKey.set(key, members);
  }
  for (const [key, members] of membersByKey.entries()) {
    if (members.size > 0) {
      await context.redis.zRem(key, Array.from(members));
    }
  }
}

function maskUsernameForLog(input: string | null | undefined): string {
  const normalized = normalizeUsernameForLookup(input ?? '');
  if (!normalized) {
    return '<redacted-user>';
  }
  if (normalized.length <= 2) {
    return `${normalized.slice(0, 1)}*`;
  }
  if (normalized.length <= 4) {
    return `${normalized.slice(0, 1)}***`;
  }
  return `${normalized.slice(0, 2)}***${normalized.slice(-1)}`;
}

function normalizeUsernameKey(input: string): string {
  return normalizeUsername(input);
}

function usernamesEqual(left: string, right: string): boolean {
  return normalizeUsernameForLookup(left) === normalizeUsernameForLookup(right);
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

function addDaysIso(days: number, fromMs: number): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
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

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function parseThemePreset(value: string | undefined): ThemePresetName {
  if (!value) {
    return DEFAULT_THEME_PRESET;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized in THEME_PRESETS) {
    return normalized as ThemePresetName;
  }
  return DEFAULT_THEME_PRESET;
}

function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return null;
}

type RgbColor = { r: number; g: number; b: number };

function hexToRgbColor(hex: string): RgbColor | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbColorToHex(color: RgbColor): string {
  const clampToHex = (value: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${clampToHex(color.r)}${clampToHex(color.g)}${clampToHex(color.b)}`;
}

function mixHexColors(colorA: string, colorB: string, weightA: number): string {
  const rgbA = hexToRgbColor(colorA);
  const rgbB = hexToRgbColor(colorB);
  if (!rgbA && !rgbB) {
    return '#000000';
  }
  if (!rgbA) {
    return rgbColorToHex(rgbB!);
  }
  if (!rgbB) {
    return rgbColorToHex(rgbA);
  }
  const weight = Number.isFinite(weightA) ? Math.max(0, Math.min(1, weightA)) : 0.5;
  return rgbColorToHex({
    r: rgbA.r * weight + rgbB.r * (1 - weight),
    g: rgbA.g * weight + rgbB.g * (1 - weight),
    b: rgbA.b * weight + rgbB.b * (1 - weight),
  });
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgbColor(hex);
  if (!rgb) {
    return 0;
  }
  const toLinear = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function deriveCustomThemeTokens(
  baseTokens: ThemeTokens,
  customPrimary: string,
  customAccent: string,
  customBackground: string,
  mode: 'light' | 'dark'
): ThemeTokens {
  const primary = normalizeHexColor(customPrimary);
  const accent = normalizeHexColor(customAccent);
  const background = normalizeHexColor(customBackground);
  if (!primary || !accent || !background) {
    return { ...baseTokens };
  }

  const sourceLuminance = relativeLuminance(background);
  let bg = background;
  if (mode === 'dark') {
    if (sourceLuminance >= 0.55) {
      bg = mixHexColors(background, baseTokens.bg, 0.2);
    } else if (sourceLuminance >= 0.25) {
      bg = mixHexColors(background, baseTokens.bg, 0.55);
    } else {
      bg = mixHexColors(background, baseTokens.bg, 0.72);
    }
  } else if (sourceLuminance <= 0.24) {
    bg = mixHexColors(background, '#f3fbff', 0.65);
  }

  let surface =
    mode === 'dark' ? mixHexColors(bg, baseTokens.surface, 0.72) : mixHexColors(bg, baseTokens.surface, 0.76);
  surface = mixHexColors(surface, accent, 0.94);

  const borderBase = mixHexColors(baseTokens.border, accent, 0.65);
  const border = mode === 'dark' ? mixHexColors(borderBase, bg, 0.78) : mixHexColors(borderBase, bg, 0.7);

  const text = mode === 'dark' ? mixHexColors(baseTokens.text, bg, 0.92) : baseTokens.text;
  const mutedText =
    mode === 'dark' ? mixHexColors(baseTokens.mutedText, bg, 0.82) : mixHexColors(baseTokens.mutedText, bg, 0.86);

  return {
    ...baseTokens,
    primary,
    accent,
    bg,
    surface,
    text,
    mutedText,
    border,
  };
}

function deriveCustomThemePalette(
  preset: ThemePalette,
  customPrimary: string,
  customAccent: string,
  customBackground: string
): ThemePalette {
  const primary = normalizeHexColor(customPrimary);
  const accent = normalizeHexColor(customAccent);
  const background = normalizeHexColor(customBackground);
  if (!primary || !accent || !background) {
    return {
      light: { ...preset.light },
      dark: { ...preset.dark },
    };
  }
  return {
    light: deriveCustomThemeTokens(preset.light, primary, accent, background, 'light'),
    dark: deriveCustomThemeTokens(preset.dark, primary, accent, background, 'dark'),
  };
}

function resolveThemePalette(config: RuntimeConfig): ThemePalette {
  const preset = THEME_PRESETS[parseThemePreset(config.themePreset)];
  const customPrimary = normalizeHexColor(config.customPrimary);
  const customAccent = normalizeHexColor(config.customAccent);
  const customBackground = normalizeHexColor(config.customBackground);
  if (config.useCustomColors && customPrimary && customAccent && customBackground) {
    return deriveCustomThemePalette(preset, customPrimary, customAccent, customBackground);
  }
  if (config.useCustomColors && customPrimary && customAccent) {
    return {
      light: {
        ...preset.light,
        primary: customPrimary,
        accent: customAccent,
      },
      dark: {
        ...preset.dark,
        primary: customPrimary,
        accent: customAccent,
      },
    };
  }
  return {
    light: { ...preset.light },
    dark: { ...preset.dark },
  };
}

function asAuditAction(value: string | undefined): AuditAction | null {
  if (!value) {
    return null;
  }
  return value === 'approved' ||
    value === 'denied' ||
    value === 'reopened' ||
    value === 'removed_by_mod' ||
    value === 'self_removed' ||
    value === 'blocked' ||
    value === 'unblocked'
    ? value
    : null;
}

function validateFlairTemplateId(value: string | null | undefined): FlairTemplateValidationState {
  const normalized = normalizeTemplateId(String(value ?? ''));
  if (!normalized) {
    return {
      isValid: false,
      code: 'missing',
      message: 'Flair template ID is required.',
    };
  }
  if (!/^[a-z0-9-]+$/.test(normalized) || !/\d/.test(normalized) || !normalized.includes('-')) {
    return {
      isValid: false,
      code: 'invalid_format',
      message: 'Flair template ID must include letters or numbers, at least one digit, and a hyphen.',
    };
  }
  return {
    isValid: true,
    code: 'valid',
    message: 'Flair template ID looks valid.',
  };
}

function isLikelyFlairTemplateId(value: string): boolean {
  return validateFlairTemplateId(value).isValid;
}

function buildModmailSubject(template: string, values: Record<string, string>): string {
  const fallback = fillTemplate(DEFAULT_MODMAIL_SUBJECT, values).trim();
  const subject = fillTemplate(template, values).trim();
  return (subject || fallback || 'Verification update').replace(/\s+/g, ' ').slice(0, 100);
}

function prependRenderedModmailHeader(body: string, header: string): string {
  const normalizedHeader = header.replace(/\s+/g, ' ').trim();
  if (!normalizedHeader) {
    return body;
  }
  return `---\n\n**${normalizedHeader}**\n\n${body}`;
}

function prependModmailHeader(body: string, headerTemplate: string, values: Record<string, string>): string {
  const header = fillTemplate(headerTemplate, values);
  if (!header) {
    return body;
  }
  return prependRenderedModmailHeader(body, header);
}

function normalizeDenialNotes(notes: string | null | undefined): string {
  return String(notes ?? '').trim();
}

function formatDenialNotesForModmail(notes: string): string {
  return notes ? `${MODMAIL_DENIAL_NOTES_PREFIX} ${notes}` : '';
}

function templateIncludesDenialNotesPlaceholder(template: string): boolean {
  const placeholderPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const match of template.matchAll(placeholderPattern)) {
    const key = normalizePlaceholderKey(match[1] ?? '');
    if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
      return true;
    }
  }
  return false;
}

function normalizeDenialNotesTemplateBlocks(template: string): string {
  return template
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const placeholderOnlyMatch = trimmed.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
      if (placeholderOnlyMatch) {
        const key = normalizePlaceholderKey(placeholderOnlyMatch[1] ?? '');
        if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
          return DENIAL_NOTES_BLOCK_MARKER;
        }
      }

      const prefixedPlaceholderMatch = trimmed.match(/^(moderator\s+notes?|reason)\s*:\s*\{\{\s*([^{}]+?)\s*\}\}$/i);
      if (prefixedPlaceholderMatch) {
        const key = normalizePlaceholderKey(prefixedPlaceholderMatch[2] ?? '');
        if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
          return DENIAL_NOTES_BLOCK_MARKER;
        }
      }

      return line;
    })
    .join('\n');
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n(?:[ \t]*\n){2,}/g, '\n\n');
}

function renderDenialTemplateText(template: string, values: Record<string, string>, moderatorNotes: string): string {
  const normalizedNotes = normalizeDenialNotes(moderatorNotes);
  const formattedNotes = formatDenialNotesForModmail(normalizedNotes);
  const normalizedTemplate = normalizeDenialNotesTemplateBlocks(template);
  const rendered = fillTemplate(normalizedTemplate, {
    ...values,
    [DENIAL_NOTES_PLACEHOLDER_KEY]: formattedNotes,
    [LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY]: formattedNotes,
  })
    .split(DENIAL_NOTES_BLOCK_MARKER)
    .join(formattedNotes);

  return formattedNotes ? rendered : collapseBlankLines(rendered);
}

function renderDenialModmailBody(
  template: string,
  values: Record<string, string>,
  moderatorNotes: string,
  alwaysIncludeDenialNotesInModmail: boolean,
  denialNotesAlreadyIncluded: boolean
): string {
  const normalizedNotes = normalizeDenialNotes(moderatorNotes);
  const formattedNotes = formatDenialNotesForModmail(normalizedNotes);
  let rendered = renderDenialTemplateText(template, values, moderatorNotes);

  if (alwaysIncludeDenialNotesInModmail && formattedNotes && !denialNotesAlreadyIncluded) {
    rendered = `${rendered.trimEnd()}\n\n${formattedNotes}`;
  }

  return formattedNotes ? rendered : collapseBlankLines(rendered);
}

function fillTemplate(template: string, values: Record<string, string>): string {
  const normalizedMap = new Map<string, string>();
  for (const [rawKey, value] of Object.entries(values)) {
    normalizedMap.set(normalizePlaceholderKey(rawKey), value);
  }
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, rawKey: string) => {
    return normalizedMap.get(normalizePlaceholderKey(rawKey)) ?? '';
  });
}

function normalizePlaceholderKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/\s+/g, '_');
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

function formatPendingTurnaroundDays(days: number): string {
  const normalizedDays = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;
  return `${normalizedDays} ${normalizedDays === 1 ? 'day' : 'days'}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function formatAuditEntry(entry: AuditLogEntry): string {
  const actor = entry.actor ? `u/${entry.actor}` : 'system';
  switch (entry.action) {
    case 'approved':
      return `Approved by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'denied':
      return `Denied by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'reopened':
      return `Reopened by ${actor}`;
    case 'removed_by_mod':
      return `Removed by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'self_removed':
      return `Self-removed${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'blocked':
      return `Blocked by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    case 'unblocked':
      return `Unblocked by ${actor}${entry.notes ? ` | ${entry.notes}` : ''}`;
    default:
      return entry.notes ?? entry.action;
  }
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
  const lockToken = createRedisLockToken();
  let lockAcquired = false;

  try {
    const lock = await context.redis.set(lockKey, lockToken, {
      nx: true,
      expiration: new Date(Date.now() + USER_VALIDATION_SCHEDULE_LOCK_TTL_MS),
    });
    if (lock !== 'OK') {
      return;
    }
    lockAcquired = true;

    const jobs = await context.scheduler.listJobs();
    const alreadyScheduled = jobs.some((job) => {
      if (job.name !== USER_VALIDATION_JOB_NAME) {
        return false;
      }
      const jobData = (job.data ?? {}) as Partial<AuditRetentionJobData>;
      return sanitizeSubredditId(jobData.subredditId ?? '') === normalizedSubredditId;
    });

    if (alreadyScheduled) {
      return;
    }

    await context.scheduler.runJob({
      name: USER_VALIDATION_JOB_NAME,
      cron: USER_VALIDATION_CRON,
      data: {
        subredditId: normalizedSubredditId,
        subredditName: normalizedSubreddit,
      },
    });
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

function looksLikeInternalModmailArchiveError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('cannot archive/unarchive internal conversations') ||
    (normalized.includes('archive') && normalized.includes('internal conversation'))
  );
}

function looksLikeTransientRedditTransportError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('unexpected eof') ||
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
  setPendingClaimState,
  reopenDeniedVerification,
  cancelReopenedVerification,
  removeApprovedVerificationByModerator,
  loadHubDashboard,
  loadModDashboard,
  loadDashboard,
  searchHistoryRecords,
  searchApprovedRecords,
  searchAuditEntries,
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
  buildModeratorUpdateNotice,
  dismissModeratorUpdateNotice,
  getViewerFlairSnapshot,
  checkVerificationFlair,
  refreshConfiguredFlairTemplateCache,
  loadApprovalFlairOptionsForSettings,
  looksLikeInternalModmailArchiveError,
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
  ThemePalette,
  ThemePresetName,
  UpdateNoticeState,
};
