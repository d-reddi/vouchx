import type { Devvit } from '@devvit/public-api';
import type {
  ApprovalFlairConfig,
  ApprovalFlairOption,
  FlairTemplateValidationState,
  FlairVerificationCheck,
  RuntimeConfig,
  UserFlairTemplateSummary,
  VerificationRecord,
  ViewerFlairLookupState,
  ViewerFlairSnapshot,
} from './types.ts';
import {
  CONFIG_FIELD,
  FLAIR_TEMPLATE_CACHE_REFRESH_INTERVAL_MS,
  MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER,
  MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER,
  VIEWER_FLAIR_PROPAGATION_WINDOW_MS,
  VIEWER_FLAIR_RECONCILE_INTERVAL_MS,
} from './constants.ts';
import { subredditConfigKey } from './keys.ts';
import {
  dedupeNonEmpty,
  errorText,
  getCurrentSubredditNameCompat,
  looksLikeTransientRedditTransportError,
  maskUsernameForLog,
  normalizeUserId,
  normalizeUsernameStrict,
  sanitizeSubredditName,
} from './normalize.ts';
import { assertCanAccessModeratorSettingsTab, getViewerIdentitySnapshot, logModeratorLookupFailureWithCooldown } from './moderator-access.ts';

export function emptyViewerFlairSnapshot(
  userId = '',
  lookupState: ViewerFlairLookupState = 'confirmed_absent',
  error: string | null = null
): ViewerFlairSnapshot {
  return {
    flairText: '',
    flairCssClass: '',
    flairTemplateId: '',
    userId: normalizeUserId(userId),
    lookupState,
    error,
  };
}

export async function getViewerFlairSnapshot(
  context: Devvit.Context,
  subredditName: string
): Promise<ViewerFlairSnapshot> {
  const sanitizedSubreddit = sanitizeSubredditName(subredditName);
  const viewerIdentity = await getViewerIdentitySnapshot(context);
  const emptySnapshot = emptyViewerFlairSnapshot(
    viewerIdentity.userId || context.userId,
    viewerIdentity.state === 'unavailable' || !viewerIdentity.user ? 'unavailable' : 'confirmed_absent',
    viewerIdentity.state === 'unavailable' || !viewerIdentity.user
      ? viewerIdentity.error ?? 'Viewer flair lookup unavailable.'
      : null
  );
  if (viewerIdentity.state !== 'confirmed' || !viewerIdentity.user) {
    return emptySnapshot;
  }

  const lookupUsername = normalizeUsernameStrict(viewerIdentity.username ?? viewerIdentity.user.username ?? '');
  if (!lookupUsername) {
    return emptyViewerFlairSnapshot(
      viewerIdentity.userId || context.userId,
      'unavailable',
      'Viewer flair lookup unavailable.'
    );
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const lookupUser = await context.reddit.getUserByUsername(lookupUsername);
      if (!lookupUser) {
        return emptyViewerFlairSnapshot(
          viewerIdentity.userId || context.userId,
          'unavailable',
          'Viewer flair lookup unavailable.'
        );
      }
      const flair = await lookupUser.getUserFlairBySubreddit(sanitizedSubreddit);
      if (!flair) {
        return emptyViewerFlairSnapshot(lookupUser.id ?? viewerIdentity.user.id ?? viewerIdentity.userId, 'confirmed_absent', null);
      }
      const flairTemplateId = normalizeTemplateId(extractTemplateId(flair));
      return {
        flairText: (flair.flairText ?? '').trim(),
        flairCssClass: (flair.flairCssClass ?? '').trim(),
        flairTemplateId,
        userId: normalizeUserId(lookupUser.id ?? viewerIdentity.user.id ?? viewerIdentity.userId),
        lookupState: 'confirmed_present',
        error: null,
      };
    } catch (error) {
      const message = errorText(error);
      if (attempt < 1 && looksLikeTransientRedditTransportError(message)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      if (!looksLikeTransientRedditTransportError(message)) {
        await logViewerFlairLookupFailureWithCooldown(
          context,
          viewerIdentity.username ?? 'unknown',
          `Viewer flair snapshot lookup failed for r/${subredditName} u/${maskUsernameForLog(viewerIdentity.username ?? 'unknown')}: ${message}`
        );
      }
      return emptyViewerFlairSnapshot(viewerIdentity.userId || context.userId, 'unavailable', message);
    }
  }

  return emptyViewerFlairSnapshot(viewerIdentity.userId || context.userId, 'unavailable', null);
}

export function extractFieldString(value: unknown, keys: string[]): string {
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

export function extractTemplateId(value: unknown): string {
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

export function normalizeTemplateId(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeApprovalFlairConfig(value: Partial<ApprovalFlairConfig> | null | undefined): ApprovalFlairConfig | null {
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

export function approvalFlairTemplateIdsMatch(left: ApprovalFlairConfig[], right: ApprovalFlairConfig[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item.templateId === right[index]?.templateId);
}

export function parseAdditionalApprovalFlairs(value: string | undefined): ApprovalFlairConfig[] {
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

export function serializeAdditionalApprovalFlairs(value: ApprovalFlairConfig[]): string {
  const normalized = Array.isArray(value)
    ? value
        .map((item) => normalizeApprovalFlairConfig(item))
        .filter((item): item is ApprovalFlairConfig => Boolean(item))
    : [];
  return JSON.stringify(normalized);
}

export function configuredApprovalTemplateIds(
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

export function buildApprovalFlairOptionLabel(text: string, templateId: string, duplicateCount: number): string {
  if (!text) {
    return `(untitled flair) — ${templateId}`;
  }
  if (duplicateCount > 1) {
    return `${text} — ${templateId}`;
  }
  return text;
}

export async function listUserFlairTemplatesForSubreddit(
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

export function refreshAdditionalApprovalFlairConfigsFromTemplates(
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

export async function loadApprovalFlairOptionsForSettings(context: Devvit.Context): Promise<ApprovalFlairOption[]> {
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

export async function validateFlairTemplateIdForSubreddit(
  context: Devvit.Context,
  subredditName: string,
  flairTemplateId: string | null | undefined
): Promise<FlairTemplateValidationState> {
  const normalizedSubredditName = sanitizeSubredditName(subredditName);
  try {
    const flairTemplates = await listUserFlairTemplatesForSubreddit(context, normalizedSubredditName);
    return validateFlairTemplateIdAgainstTemplates(normalizedSubredditName, flairTemplateId, flairTemplates);
  } catch (error) {
    console.log(`Flair template validation lookup failed for r/${normalizedSubredditName}: ${errorText(error)}`);
    return {
      isValid: false,
      code: 'lookup_failed',
      message: `Unable to verify the flair template ID in r/${normalizedSubredditName}.`,
    };
  }
}

export function validateFlairTemplateIdAgainstTemplates(
  subredditName: string,
  flairTemplateId: string | null | undefined,
  flairTemplates: UserFlairTemplateSummary[]
): FlairTemplateValidationState {
  const formatValidation = validateFlairTemplateId(flairTemplateId);
  if (!formatValidation.isValid) {
    return formatValidation;
  }

  const normalizedSubredditName = sanitizeSubredditName(subredditName);
  const normalizedTemplateId = normalizeTemplateId(String(flairTemplateId ?? ''));
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
}

export async function refreshConfiguredFlairTemplateCache(
  context: Devvit.Context,
  subredditId: string,
  subredditName: string,
  config: RuntimeConfig,
  forceRefresh = false,
  preloadedFlairTemplates?: UserFlairTemplateSummary[] | null
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

  let flairTemplates = preloadedFlairTemplates ?? null;
  if (preloadedFlairTemplates === undefined) {
    try {
      flairTemplates = await listUserFlairTemplatesForSubreddit(context, subredditName);
    } catch (error) {
      console.log(`Configured flair template text lookup failed for r/${subredditName}: ${errorText(error)}`);
    }
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

export function shouldReconcileApprovedViewerFlair(
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
  if (viewerFlairSnapshot.lookupState === 'unavailable' || flairCheck.source === 'viewer-snapshot:unavailable') {
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

export function isViewerFlairReconcileDue(record: VerificationRecord, nowMs: number): boolean {
  const lastFlairReconcileAt =
    typeof record.lastFlairReconcileAt === 'number' && Number.isFinite(record.lastFlairReconcileAt)
      ? Math.max(0, Math.floor(record.lastFlairReconcileAt))
      : 0;
  if (lastFlairReconcileAt > 0 && nowMs - lastFlairReconcileAt < VIEWER_FLAIR_RECONCILE_INTERVAL_MS) {
    return false;
  }
  return true;
}

export function normalizeCssClass(value: string): string {
  return value.trim().toLowerCase();
}

export function cssClassMatchesSubstring(configuredCssValue: string, detectedCssClass: string): boolean {
  const configured = normalizeCssClass(configuredCssValue);
  const detected = normalizeCssClass(detectedCssClass);
  if (!configured || !detected) {
    return false;
  }
  return detected.includes(configured);
}

export function isManualFlairCheckSource(source: string): boolean {
  return (
    typeof source === 'string' &&
    (source.includes(MANUAL_FLAIR_SOURCE_SUBSTRING_MARKER) || source.includes(MANUAL_FLAIR_SOURCE_LEGACY_WILDCARD_MARKER))
  );
}

export function normalizeUsernamePrefixFilter(
  value: string | undefined | null,
  normalizer: (input: string) => string
): string {
  const normalized = typeof value === 'string' ? normalizer(value) : '';
  return normalized.length > 0 && normalized.length < 3 ? '' : normalized;
}

export function shouldViewerDisplayVerifiedState(
  flairCheck: Pick<FlairVerificationCheck, 'verified' | 'source'>,
  userLatest: Pick<VerificationRecord, 'status'> | null | undefined,
  isSuppressed: boolean
): boolean {
  if (isSuppressed) {
    return false;
  }
  if (userLatest?.status === 'pending') {
    return false;
  }
  if (userLatest?.status === 'approved') {
    return true;
  }
  if (!flairCheck.verified) {
    return false;
  }
  if (
    (userLatest?.status === 'denied' || userLatest?.status === 'removed') &&
    !isManualFlairCheckSource(flairCheck.source)
  ) {
    return false;
  }
  return true;
}

export function isViewerAwaitingFlairPropagation(
  flairCheck: Pick<FlairVerificationCheck, 'verified' | 'source'>,
  userLatest: Pick<VerificationRecord, 'status' | 'reviewedAt' | 'submittedAt'> | null | undefined,
  nowMs = Date.now()
): boolean {
  if (
    flairCheck.verified ||
    flairCheck.source === 'viewer-snapshot:unavailable' ||
    !userLatest ||
    userLatest.status !== 'approved'
  ) {
    return false;
  }
  const approvedAtMs = new Date(String(userLatest.reviewedAt || userLatest.submittedAt || '')).getTime();
  if (!Number.isFinite(approvedAtMs) || approvedAtMs > nowMs) {
    return false;
  }
  return nowMs - approvedAtMs <= VIEWER_FLAIR_PROPAGATION_WINDOW_MS;
}

export async function checkVerificationFlair(
  context: Devvit.Context,
  subredditName: string,
  config: RuntimeConfig,
  viewerFlairSnapshot?: ViewerFlairSnapshot
): Promise<FlairVerificationCheck> {
  const configuredTemplateId = normalizeTemplateId(config.flairTemplateId);
  const configuredTemplateIds = configuredApprovalTemplateIds(config);
  const templateCheckEnabled = Boolean(configuredTemplateId);
  const configuredCssClass = normalizeCssClass(config.flairCssClass);
  const snapshot = viewerFlairSnapshot ?? (await getViewerFlairSnapshot(context, sanitizeSubredditName(subredditName)));
  if (snapshot.lookupState === 'unavailable') {
    return {
      verified: false,
      configuredTemplateId,
      detectedTemplateId: '',
      source: 'viewer-snapshot:unavailable',
      error: snapshot.error ?? 'Viewer flair lookup unavailable.',
    };
  }
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
    source: snapshot.lookupState === 'confirmed_absent' ? 'viewer-snapshot:no-match' : 'viewer-snapshot:template-mismatch',
    error: null,
  };
}

export async function logViewerFlairLookupFailureWithCooldown(
  context: Pick<Devvit.Context, 'redis'> & { subredditId?: string | null },
  username: string,
  message: string
): Promise<void> {
  await logModeratorLookupFailureWithCooldown(context, 'viewer-flair', username, message);
}

export function validateFlairTemplateId(value: string | null | undefined): FlairTemplateValidationState {
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

export function isLikelyFlairTemplateId(value: string): boolean {
  return validateFlairTemplateId(value).isValid;
}
