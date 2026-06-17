import type {
  DenyReason,
  DenyReasonSlotDefinition,
} from './types.ts';

export const MAX_BATCH_REVIEW_ITEMS = 25;

export const BATCH_REVIEW_CONCURRENCY = 3;

export const APP_KEY_PREFIX = 'photo-verification';

export const SUBREDDIT_KEY_PREFIX = 'subreddit';

export const MAX_PENDING_TO_LOAD = 150;

export const SELF_DELETE_INDEX_SCAN_LIMIT = 1000;

export const MIN_MAX_DENIALS_BEFORE_BLOCK = 2;

export const DEFAULT_MAX_DENIALS_BEFORE_BLOCK = 3;

export const VALIDATION_CHECK_INTERVAL_DAYS = 30;

export const VALIDATION_HARD_EXPIRY_DAYS = 45;

export const VALIDATION_BATCH_SIZE = 50;

export const NON_APPROVED_VALIDATION_BATCH_SIZE = 25;

export const NON_APPROVED_VALIDATION_SCAN_MULTIPLIER = 4;

export const STALE_RECORD_INDEX_SWEEP_BATCH_SIZE = 200;

export const UPDATE_NOTICE_DISMISS_TTL_DAYS = 7;

// Keep feature-education completion records longer than we keep old feature
// packs active in code, so a retired pack naturally ages out of Redis after
// slow-updating communities have had time to catch up.
export const FEATURE_EDUCATION_COMPLETION_TTL_DAYS = 540;

export const APPROVED_PREFIX_SEARCH_OVERFETCH_MULTIPLIER = 4;

export const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export const HISTORY_RETENTION_DAYS = 45;

export const AUDIT_RETENTION_DAYS = 45;

// Retention window agreed to in the original ToC. Used as the fallback for records
// that pre-date the retentionDays field and must not be silently extended.
export const LEGACY_VERIFIED_RECORD_RETENTION_DAYS = 90;

// Retention window for records approved under the current policy.
export const VERIFIED_RECORD_RETENTION_DAYS = 180;

export const VERIFIED_RECORD_TTL_BUMP_INTERVAL_MS = MILLIS_PER_DAY;

export const FLAIR_TEMPLATE_CACHE_REFRESH_INTERVAL_MS = MILLIS_PER_DAY;

export const VIEWER_FLAIR_RECONCILE_INTERVAL_MS = MILLIS_PER_DAY;

export const DEFAULT_MOD_MENU_AUDIT_PURGE_MIN_AGE_DAYS = 3;

export const INSTALL_SETTING_MOD_MENU_AUDIT_PURGE_DAYS = 'mod_menu_audit_purge_days';

export const INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE = 'verifications_disabled_message';

export const INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED = 'auto_flair_reconcile_enabled';

export const INSTALL_SETTING_AUTO_ARCHIVE_PENDING_MODMAIL_ENABLED = 'auto_archive_pending_modmail_enabled';

export const INSTALL_SETTING_AUTO_DENY_SHADOWBANNED_ENABLED = 'auto_deny_shadowbanned_enabled';

export const INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED = 'multiple_approval_flairs_enabled';

export const INSTALL_SETTING_USER_ADVISORY_SCORE_BADGE_ENABLED = 'user_advisory_score_badge_enabled';

export const INSTALL_SETTING_CONTENT_CREATOR_BADGE_ENABLED = 'content_creator_badge_enabled';

export const INSTALL_SETTING_MAX_DENIALS_BEFORE_BLOCK = 'max_denials_before_block';

export const INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT = 'show_photo_instructions_before_submit';

export const INSTALL_SETTING_SETTINGS_TAB_REQUIRES_CONFIG_ACCESS = 'settings_tab_requires_config_access';

export const GLOBAL_SETTING_LATEST_RELEASE_VERSION = 'latest_release_version';

export const GLOBAL_SETTING_LATEST_RELEASE_TITLE = 'latest_release_title';

export const GLOBAL_SETTING_LATEST_RELEASE_NOTES = 'latest_release_notes';

export const GLOBAL_SETTING_LATEST_RELEASE_LINK = 'latest_release_link';

export const GLOBAL_SETTING_LATEST_RELEASE_SEVERITY = 'latest_release_severity';

export const GLOBAL_SETTING_DEVELOPER_UI_USERNAMES = 'developer_ui_usernames';

export const MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH = 200;

// Bounds for the previous-denial context captured in the pending account snapshot.
export const MAX_PENDING_LAST_DENIAL_NOTES_LENGTH = 300;

export const PENDING_LAST_DENIAL_HISTORY_SCAN_LIMIT = 25;

// Bounds for peer-review notes stored on a pending verification record.
export const MAX_REVIEW_FLAG_NOTE_LENGTH = 300;

export const MAX_REVIEW_FLAG_NOTES = 20;

// Pending index scores are normally submission timestamps. Flagged records receive
// a large negative offset so they sort above the normal queue while preserving
// flagged-at order.
export const REVIEW_FLAG_PENDING_INDEX_SCORE_OFFSET_MS = 8_000_000_000_000_000;

export const MAX_DENY_REASON_LABEL_LENGTH = 48;

export const PENDING_CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

export const VERIFICATION_ACTION_LOCK_TTL_MS = 45000;

export const SUBMISSION_PHOTO_ALLOWED_HOSTS = new Set([
  'i.redd.it',
  'preview.redd.it',
  'i.reddituploads.com',
  'reddit-uploaded-media.s3-accelerate.amazonaws.com',
  'reddit-uploaded-media.s3.amazonaws.com',
]);

export const MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER = 'css-substring-match';

export const MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER = 'css-wildcard-match';

export const DEFAULT_GENERIC_DENY_REASON_TEMPLATE =
  'Hi u/{{username}},\n\nWe could not approve your verification at this time.\n\n{{denial_notes}}\n\nPlease review the instructions and resubmit.\n\nThe moderation team';

export const MODMAIL_DENIAL_NOTES_PREFIX = 'Moderator Notes:';

export const DENIAL_NOTES_PLACEHOLDER_KEY = 'denial_notes';

export const LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY = 'reason';

export const DENIAL_NOTES_BLOCK_MARKER = '__vouchx_denial_notes_block__';

export const DENY_REASON_INSTALL_SETTINGS: readonly DenyReasonSlotDefinition[] = [
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

export const MODMAIL_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

export const MODERATOR_PERMISSION_CACHE_TTL_MS = 15 * 60 * 1000;

export const MODERATOR_LOOKUP_LOG_COOLDOWN_MS = 15 * 60 * 1000;

export const MODERATOR_UI_POSITIVE_CACHE_TTL_MS = 30 * 60 * 1000;

export const MODERATOR_UI_UNAVAILABLE_BACKOFF_MS = 60 * 1000;

export const USER_VALIDATION_CRON = '30 3 * * *';

export const USER_VALIDATION_JOB_NAME = `${APP_KEY_PREFIX}:user-validation-reconcile`;

export const USER_VALIDATION_SCHEDULE_LOCK_TTL_MS = 15000;

export const USER_VALIDATION_SCHEDULE_PRESENT_TTL_MS = 60 * 60 * 1000;

export const VIEWER_FLAIR_REMOVAL_SUPPRESSION_TTL_MS = 2 * 60 * 1000;

export const VIEWER_FLAIR_PROPAGATION_WINDOW_MS = 90 * 1000;

export const STORAGE_METER_CAP_BYTES = 500 * 1024 * 1024;

export const BLOCKED_SUBMISSION_MESSAGE = "You cannot submit a verification request.";

export const VERIFICATIONS_DISABLED_MESSAGE = 'Verifications are temporarily disabled.  Please check back soon.';

export const DEFAULT_FLAIR_TEXT = 'Verified';

export const DEFAULT_REQUIRED_PHOTO_COUNT = 2;

export const DEFAULT_PENDING_TURNAROUND_DAYS = 3;

export const DEFAULT_MODMAIL_SUBJECT = 'Verification update from r/{{subreddit}}';

export const DEFAULT_PENDING_BODY =
  'Hi u/{{username}},\n\nYour verification is in progress. You can check the verification app for your status, and you will receive a message when a decision has been made.\n\nCurrent estimated turn around time: {{days}}\n\nThe moderation team';

export const DEFAULT_APPROVE_HEADER = 'Verification Approved';

export const DEFAULT_REMOVAL_HEADER = 'Verification Revoked';

export const LEGACY_DEFAULT_APPROVE_BODY =
  'Hi u/{{username}},\n\nYour verification in r/{{subreddit}} was approved and your flair has been updated.\n\nThe moderation team';

export const DEFAULT_APPROVE_BODY =
  'Hi u/{{username}},\n\nYour verification was approved and your flair has been updated.\n\nThe moderation team';

export const DEFAULT_DENY_HEADER = 'Verification Denied';

export const DEFAULT_REMOVAL_BODY =
  'Hi u/{{username}},\n\nYour verification in r/{{subreddit}} was revoked.\n\nReason: {{reason}}\n\nYou can resubmit if you want to be verified again.\n\nThe moderation team';

export const CONFIG_FIELD = {
  verificationsEnabled: 'verifications_enabled',
  verificationRequiredToPost: 'verification_required_to_post',
  verificationRequiredToComment: 'verification_required_to_comment',
  requiredPhotoCount: 'required_photo_count',
  photoInstructions: 'photo_instructions',
  photoInstructionsEs: 'photo_instructions_es',
  photoInstructionsFr: 'photo_instructions_fr',
  photoInstructionsPtBr: 'photo_instructions_pt_br',
  photoInstructionsDefaultLanguage: 'photo_instructions_default_language',
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

export const DENY_REASON_TEMPLATE_CONFIG_FIELD: Record<DenyReason, string> = Object.fromEntries(
  DENY_REASON_INSTALL_SETTINGS.map((setting) => [setting.id, setting.templateConfigFieldName])
) as Record<DenyReason, string>;

export const LEGACY_CONFIG_FIELD = {
  pendingSubject: 'pending_subject',
  approveSubject: 'approve_subject',
  denySubject: 'deny_subject',
  removeSubject: 'remove_subject',
} as const;
