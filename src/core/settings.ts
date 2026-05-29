import type { Devvit } from '@devvit/public-api';
import type {
  ApprovalFlairConfig,
  DenyReason,
  DenyReasonConfig,
  FlairTemplateFormValues,
  ModmailTemplatesFormValues,
  RuntimeConfig,
  ThemeSettingsValues,
  UserFlairTemplateSummary,
} from './types.ts';
import {
  CONFIG_FIELD,
  DEFAULT_APPROVE_BODY,
  DEFAULT_APPROVE_HEADER,
  DEFAULT_DENY_HEADER,
  DEFAULT_FLAIR_TEXT,
  DEFAULT_GENERIC_DENY_REASON_TEMPLATE,
  DEFAULT_MAX_DENIALS_BEFORE_BLOCK,
  DEFAULT_MODMAIL_SUBJECT,
  DEFAULT_PENDING_BODY,
  DEFAULT_PENDING_TURNAROUND_DAYS,
  DEFAULT_REMOVAL_BODY,
  DEFAULT_REMOVAL_HEADER,
  DEFAULT_REQUIRED_PHOTO_COUNT,
  DENY_REASON_INSTALL_SETTINGS,
  DENY_REASON_TEMPLATE_CONFIG_FIELD,
  INSTALL_SETTING_AUTO_DENY_SHADOWBANNED_ENABLED,
  INSTALL_SETTING_AUTO_FLAIR_RECONCILE_ENABLED,
  INSTALL_SETTING_CONTENT_CREATOR_BADGE_ENABLED,
  INSTALL_SETTING_MAX_DENIALS_BEFORE_BLOCK,
  INSTALL_SETTING_MULTIPLE_APPROVAL_FLAIRS_ENABLED,
  INSTALL_SETTING_SHOW_PHOTO_INSTRUCTIONS_BEFORE_SUBMIT,
  INSTALL_SETTING_USER_ADVISORY_SCORE_BADGE_ENABLED,
  INSTALL_SETTING_VERIFICATIONS_DISABLED_MESSAGE,
  LEGACY_CONFIG_FIELD,
  LEGACY_DEFAULT_APPROVE_BODY,
  MAX_DENY_REASON_LABEL_LENGTH,
  MAX_VERIFICATIONS_DISABLED_MESSAGE_LENGTH,
  MIN_MAX_DENIALS_BEFORE_BLOCK,
  SUBMISSION_PHOTO_ALLOWED_HOSTS,
  VERIFICATIONS_DISABLED_MESSAGE,
} from './constants.ts';
import {
  approvalFlairTemplateIdsMatch,
  listUserFlairTemplatesForSubreddit,
  normalizeApprovalFlairConfig,
  normalizeTemplateId,
  parseAdditionalApprovalFlairs,
  refreshConfiguredFlairTemplateCache,
  serializeAdditionalApprovalFlairs,
  validateFlairTemplateId,
  validateFlairTemplateIdAgainstTemplates,
} from './flair.ts';
import { subredditConfigKey } from './keys.ts';
import { assertCanAccessModeratorSettingsTab } from './moderator-access.ts';
import { firstNonEmpty, getCurrentSubredditNameCompat, sanitizeSubredditId } from './normalize.ts';
import { normalizeHexColor, parseThemePreset } from './theme.ts';

export function parseDenyReason(value: string | undefined | null): DenyReason | null {
  if (!value) {
    return null;
  }
  return DENY_REASON_INSTALL_SETTINGS.some((setting) => setting.id === value) ? (value as DenyReason) : null;
}

export function formatDenyReasonSlotLabel(reason: DenyReason): string {
  return `Reason ${reason.replace('reason_', '')}`;
}

export function normalizeDenyReasonLabel(value: string | undefined | null): string {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, MAX_DENY_REASON_LABEL_LENGTH);
}

export async function getConfiguredDenyReasons(
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

export function getConfiguredDenyReason(
  config: Pick<RuntimeConfig, 'denyReasons'>,
  reason: DenyReason | null | undefined
): DenyReasonConfig | null {
  if (!reason) {
    return null;
  }
  return Array.isArray(config.denyReasons) ? config.denyReasons.find((item) => item.id === reason) ?? null : null;
}

export function getDenyReasonDisplayLabel(config: Pick<RuntimeConfig, 'denyReasons'>, reason: DenyReason): string {
  const configured = getConfiguredDenyReason(config, reason);
  return configured?.label.trim() || formatDenyReasonSlotLabel(reason);
}

export async function onSaveFlairTemplateValues(
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
    ...(values.verificationRequiredToPost === undefined
      ? {}
      : { [CONFIG_FIELD.verificationRequiredToPost]: `${values.verificationRequiredToPost === true}` }),
    ...(values.verificationRequiredToComment === undefined
      ? {}
      : { [CONFIG_FIELD.verificationRequiredToComment]: `${values.verificationRequiredToComment === true}` }),
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
    verificationRequiredToPost:
      values.verificationRequiredToPost === undefined
        ? existingConfig.verificationRequiredToPost
        : values.verificationRequiredToPost === true,
    verificationRequiredToComment:
      values.verificationRequiredToComment === undefined
        ? existingConfig.verificationRequiredToComment
        : values.verificationRequiredToComment === true,
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

export async function onSaveModmailTemplatesValues(
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

export async function onSaveThemeValues(values: ThemeSettingsValues, context: Devvit.Context): Promise<void> {
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

export async function getRuntimeConfig(context: Devvit.Context, subredditId: string): Promise<RuntimeConfig> {
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
  const rawUserAdvisoryScoreBadgeEnabled = await context.settings.get<boolean | string>(
    INSTALL_SETTING_USER_ADVISORY_SCORE_BADGE_ENABLED
  );
  const rawContentCreatorBadgeEnabled = await context.settings.get<boolean | string>(
    INSTALL_SETTING_CONTENT_CREATOR_BADGE_ENABLED
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
  const userAdvisoryScoreBadgeEnabled =
    typeof rawUserAdvisoryScoreBadgeEnabled === 'boolean'
      ? rawUserAdvisoryScoreBadgeEnabled
      : parseBooleanString(rawUserAdvisoryScoreBadgeEnabled, true);
  const contentCreatorBadgeEnabled =
    typeof rawContentCreatorBadgeEnabled === 'boolean'
      ? rawContentCreatorBadgeEnabled
      : parseBooleanString(rawContentCreatorBadgeEnabled, true);
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
    verificationRequiredToPost: parseBooleanString(stored[CONFIG_FIELD.verificationRequiredToPost], false),
    verificationRequiredToComment: parseBooleanString(stored[CONFIG_FIELD.verificationRequiredToComment], false),
    autoFlairReconcileEnabled,
    autoDenyShadowbannedEnabled,
    maxDenialsBeforeBlock,
    userAdvisoryScoreBadgeEnabled,
    contentCreatorBadgeEnabled,
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

export function parseBooleanString(value: string | undefined, fallback: boolean): boolean {
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

export function parsePositiveInt(value: string | undefined, fallback: number): number | null {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export function normalizeMaxDenialsBeforeBlockSetting(value: number | string | undefined | null): number {
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

export function validateMaxDenialsBeforeBlockSetting(value: unknown): string | undefined {
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

export function parseNonNegativeInt(value: string | undefined | null, fallback: number | null): number | null {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function parseRequiredPhotoCount(value: unknown, fallback: number): number {
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

export function normalizePhotoInput(value: unknown): string | null {
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

export function normalizeSubmittedPhotoUrl(value: unknown): string | null {
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

export function normalizeInstallSettingMessage(
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

export function normalizeOptionalSettingText(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

export function normalizePhotoInstructionLanguage(value: string | undefined | null): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'es' || normalized === 'fr' || normalized === 'pt-br' ? normalized : 'en';
}

export function formatPendingTurnaroundDays(days: number): string {
  const normalizedDays = Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0;
  return `${normalizedDays} ${normalizedDays === 1 ? 'day' : 'days'}`;
}
