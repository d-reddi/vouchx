import type { Devvit } from '@devvit/public-api';
import type {
  ContentCreatorDetection,
  ModmailUserSignals,
  PendingAccountDetailsSnapshot,
  SubmitVerificationResult,
  SubmitVerificationValues,
  UserGrade,
  UserGradeResult,
  VerificationRecord,
} from './types.ts';
import { GLOBAL_BLOCKED_USERNAME_SETTING_NAMES } from '../shared/global-usernames.ts';
import {
  createGlobalBlockedUserEntry,
  getStoredDenialCount,
  repairMissingAutoBlockForUser,
} from './blocking.ts';
import {
  BLOCKED_SUBMISSION_MESSAGE,
  DEFAULT_REQUIRED_PHOTO_COUNT,
  HISTORY_RETENTION_DAYS,
  MILLIS_PER_DAY,
} from './constants.ts';
import {
  historyByUserIndexKey,
  historyDateIndexKey,
  makeVerificationId,
  pendingIndexKey,
} from './keys.ts';
import {
  addPendingSubmissionModNote,
  sendPendingSubmissionModmail,
} from './modmail.ts';
import {
  errorText,
  maskUsernameForLog,
  normalizeNonNegativeWholeNumber,
  normalizeOptionalBoolean,
  normalizeOptionalIsoTimestamp,
  normalizeOptionalWholeNumber,
  normalizeUsername,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
} from './normalize.ts';
import {
  getLatestRecordForUser,
  getRecord,
  setRecord,
  setUserLatestPointer,
  setUserPendingPointer,
} from './records.ts';
import {
  pruneHistoryOlderThanDays,
} from './retention.ts';
import {
  getRuntimeConfig,
  normalizePhotoInput,
  normalizeSubmittedPhotoUrl,
  parseRequiredPhotoCount,
} from './settings.ts';
import {
  autoDenyShadowbannedSubmission,
  getCurrentSubredditNameCompat,
  looksLikeTransientRedditTransportError,
  readMergedGlobalUsernameSettings,
  removeAllVerificationRecordsForUser,
} from '../core.ts';

export function normalizePendingBanStatus(value: unknown): PendingAccountDetailsSnapshot['banStatus'] {
  return value === 'banned' || value === 'not_banned' || value === 'unknown' ? value : 'unknown';
}

export function parsePendingAccountDetailsSnapshot(value: unknown): PendingAccountDetailsSnapshot | null {
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

export function normalizeCreatorLinkTypeList(value: unknown): string[] {
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

export const SCORE_HARD_RISK = 100;

export const SCORE_ACCOUNT_UNDER_7_DAYS = 20;

export const SCORE_ACCOUNT_UNDER_30_DAYS = 10;

export const SCORE_ACCOUNT_OVER_1_YEAR = -10;

export const SCORE_ZERO_TOTAL_KARMA = 15;

export const SCORE_ZERO_SUBREDDIT_KARMA = 5;

export const SCORE_NO_RECENT_ACTIVITY = 15;

export const SCORE_LOW_RECENT_ACTIVITY = 5;

export const SCORE_VERIFIED_EMAIL = -5;

export const SCORE_REDDIT_PREMIUM = -10;

export const GRADE_LOW_ENGAGEMENT_THRESHOLD = 20;

export const GRADE_TRUSTED_THRESHOLD = 0;

export function accountAgeDaysFromSnapshot(snapshot: PendingAccountDetailsSnapshot): number | null {
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

export function computeUserGrade(snapshot: PendingAccountDetailsSnapshot): UserGradeResult {
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

export const CREATOR_SOCIAL_LINK_TYPES = new Set([
  'ONLYFANS',
  'PATREON',
  'KOFI',
  'CASH_APP',
  'BUY_ME_A_COFFEE',
]);

export const CREATOR_LINK_DOMAINS: { label: string; domain: string }[] = [
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

export function detectContentCreator(rawLinks: unknown): ContentCreatorDetection {
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

export function normalizeSubredditKarmaValue(value: unknown): number | null {
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

export async function withSingleRetry<T>(label: string, fallbackValue: T, fn: () => Promise<T>): Promise<T> {
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

export async function lookupCurrentSubredditBanStatus(
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

export async function collectPendingAccountDetailsSnapshot(
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

export async function submitVerification(
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

export async function enrichPendingAccountDetailsFromModmail(
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
