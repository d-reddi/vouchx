import type { Devvit } from '@devvit/public-api';
import type {
  DashboardData,
  HubStatePayload,
  ModPanelStatePayload,
  ModeratorAccessSnapshot,
  PendingPanelItem,
  PublicHubConfig,
  RuntimeConfig,
  SubmitVerificationFormData,
  UserSnapshot,
  VerificationRecord,
} from './types.ts';
import { GLOBAL_BLOCKED_USERNAME_SETTING_NAMES } from '../shared/global-usernames.ts';
import {
  createGlobalBlockedUserEntry,
  listBlockedUsers,
  repairMissingAutoBlockForUser,
} from './blocking.ts';
import {
  DEFAULT_REQUIRED_PHOTO_COUNT,
  GLOBAL_SETTING_DEVELOPER_UI_USERNAMES,
} from './constants.ts';
import {
  checkVerificationFlair,
  configuredApprovalTemplateIds,
  emptyViewerFlairSnapshot,
  getViewerFlairSnapshot,
  isViewerAwaitingFlairPropagation,
  isViewerFlairReconcileDue,
  normalizeTemplateId,
  refreshConfiguredFlairTemplateCache,
  shouldReconcileApprovedViewerFlair,
  shouldViewerDisplayVerifiedState,
  validateFlairTemplateId,
  validateFlairTemplateIdForSubreddit,
} from './flair.ts';
import {
  pendingIndexKey,
} from './keys.ts';
import {
  clearExpiredPendingClaim,
} from './locks.ts';
import {
  getModeratorAccessSnapshot,
  getSettingsTabRequiresConfigAccess,
  getViewerIdentitySnapshot,
  hasAllModeratorPermissionInList,
  hasConfigAccessPermissionInList,
  hasManageUsersPermissionInList,
} from './moderator-access.ts';
import {
  errorText,
  maskUsernameForLog,
  normalizeUsernameStrict,
  sanitizeSubredditId,
} from './normalize.ts';
import {
  emptyStorageUsage,
  estimateSubredditStorageUsage,
  getLatestRecordForCurrentViewer,
  setRecord,
} from './records.ts';
import {
  bumpViewerVerifiedRecordRetention,
} from './retention.ts';
import {
  listPendingVerifications,
  searchApprovedRecords,
  searchAuditEntries,
} from './search.ts';
import {
  getRuntimeConfig,
  parseRequiredPhotoCount,
} from './settings.ts';
import {
  THEME_PRESETS,
  resolveThemePalette,
} from './theme.ts';
import {
  applyApprovalFlairWithFallbacks,
  computeUserGrade,
  getCurrentSubredditNameCompat,
  looksLikeTransientRedditTransportError,
  readGlobalUsernameSetting,
  readMergedGlobalUsernameSettings,
  removeUserFlairWithFallbacks,
  shouldSuppressViewerVerifiedState,
} from '../core.ts';

export function buildSubmitVerificationForm(data: { [key: string]: any }) {
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

export const deleteVerificationDataFormDefinition = {
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

export function toModPanelState(dashboard: DashboardData): ModPanelStatePayload {
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

export function toPublicHubConfig(config: RuntimeConfig): PublicHubConfig {
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

export function toHubState(dashboard: DashboardData): HubStatePayload {
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

export function toPendingPanelItem(record: VerificationRecord): PendingPanelItem {
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

export async function loadDashboardData(
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

export async function loadHubDashboard(context: Devvit.Context): Promise<DashboardData> {
  return await loadDashboardData(context, { includeModData: false });
}

export async function loadModDashboard(context: Devvit.Context): Promise<DashboardData> {
  return await loadDashboardData(context, { includeModData: true });
}

export async function getViewerSnapshot(context: Devvit.Context): Promise<UserSnapshot> {
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
