import type { Devvit } from '@devvit/public-api';
import type {
  ModmailStepResult,
  ModmailUserSignals,
  PendingModmailArchiveResult,
  PendingModmailReplyEvent,
  RedisContext,
  RuntimeConfig,
  VerificationRecord,
} from './types.ts';
import {
  DEFAULT_GENERIC_DENY_REASON_TEMPLATE,
  DEFAULT_MODMAIL_SUBJECT,
  DENIAL_NOTES_BLOCK_MARKER,
  DENIAL_NOTES_PLACEHOLDER_KEY,
  INSTALL_SETTING_AUTO_ARCHIVE_PENDING_MODMAIL_ENABLED,
  LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY,
  MODMAIL_DEDUPE_TTL_SECONDS,
  MODMAIL_DENIAL_NOTES_PREFIX,
} from './constants.ts';
import {
  modmailDedupeKey,
  modmailLockKey,
  modmailThreadByUserEntryKey,
  pendingModmailConversationKey,
  userPendingKey,
  userPendingKeyById,
} from './keys.ts';
import {
  dedupeNonEmpty,
  errorText,
  firstNonEmpty,
  formatTimestamp,
  looksLikeTransientRedditTransportError,
  normalizeModmailConversationId,
  normalizeOptionalBoolean,
  normalizeUserId,
  normalizeUsernameForLookup,
  normalizeUsernameStrict,
  sanitizeSubredditId,
  sanitizeSubredditName,
  usernameLookupFields,
  usernamesEqual,
} from './normalize.ts';
import { SHADOWBAN_APPEAL_URL } from './review-actions.ts';
import {
  formatPendingTurnaroundDays,
  getConfiguredDenyReason,
  getDenyReasonDisplayLabel,
  getRuntimeConfig,
  parseBooleanString,
  parseDenyReason,
} from './settings.ts';
import { getRecord } from './records.ts';

/**
 * Sends a standalone moderator notification to a subreddit's own modmail inbox.
 * Unlike the user-facing modmail helpers above it originates from the app (not a
 * user conversation), surfaces in the modmail "Notifications" section, and does
 * not touch the per-user dedupe/thread bookkeeping. Used by the developer
 * modmail-broadcast feature.
 */
export async function sendModNotification(
  context: Pick<Devvit.Context, 'reddit'>,
  subredditId: string,
  subject: string,
  bodyMarkdown: string
): Promise<ModmailStepResult> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  if (!normalizedSubredditId) {
    return { status: 'failed', reason: 'Missing subreddit id for mod notification.' };
  }
  const trimmedSubject = subject.trim();
  const trimmedBody = bodyMarkdown.trim();
  if (!trimmedSubject || !trimmedBody) {
    return { status: 'failed', reason: 'Mod notification requires a subject and body.' };
  }
  try {
    const conversationId = await context.reddit.modMail.createModNotification({
      subject: trimmedSubject,
      bodyMarkdown: trimmedBody,
      subredditId: normalizedSubredditId,
    });
    return { status: 'created', conversationId: normalizeModmailConversationId(conversationId) ?? undefined };
  } catch (error) {
    return { status: 'failed', reason: errorText(error) };
  }
}

export async function sendShadowbanAutoDenyModmail(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  config: RuntimeConfig
): Promise<ModmailStepResult> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const values = {
    username: record.username,
    mod: '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: '',
    denial_notes: '',
    days: formatPendingTurnaroundDays(config.pendingTurnaroundDays),
    today: formatTemplateToday(),
  };
  const subject = buildModmailSubject(config.modmailSubject, values);
  const body = [
    `Thanks for your verification request to r/${subredditName}.`,
    '',
    'We are unable to approve it because your Reddit account appears to be **shadowbanned**. ' +
      'A shadowban is applied by Reddit’s admins, not by this community, and it prevents us from ' +
      'verifying your account activity.',
    '',
    `You can appeal this directly to Reddit at ${SHADOWBAN_APPEAL_URL}. Once the shadowban is lifted, ` +
      'you are welcome to submit a new verification request.',
  ].join('\n');

  return await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `deny:${record.id}`,
  });
}

export async function addShadowbanAutoDenyModNote(context: Devvit.Context, record: VerificationRecord): Promise<void> {
  await context.reddit.addModNote({
    subreddit: sanitizeSubredditName(record.subredditName),
    user: record.username,
    note: 'Verification auto-denied by VouchX: account is shadowbanned.',
  });
}

export async function sendApprovalModmail(
  context: Devvit.Context,
  subredditId: string,
  record: VerificationRecord,
  config: RuntimeConfig
): Promise<ModmailStepResult> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const values = {
    username: record.username,
    mod: record.moderator ?? '',
    subreddit: subredditName,
    date_submitted: formatTimestamp(record.submittedAt),
    reason: '',
    days: formatPendingTurnaroundDays(config.pendingTurnaroundDays),
    today: formatTemplateToday(),
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

export async function addApprovalModNote(
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

export async function addPendingSubmissionModNote(context: Devvit.Context, record: VerificationRecord): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  const acknowledgedAt = formatTimestamp(record.ageAcknowledgedAt || record.submittedAt);
  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: `Verification request submitted. Terms accepted and 18+ confirmation recorded on: ${acknowledgedAt}`,
  });
}

export async function addPendingWithdrawalModNote(
  context: Devvit.Context,
  record: VerificationRecord,
  withdrawnAt: string
): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: `User withdrew pending verification request on: ${formatTimestamp(withdrawnAt)}`,
  });
}

export async function addDenialModNote(
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

export async function addSelfRemovalModNote(
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

export async function addModeratorRemovalModNote(
  context: Devvit.Context,
  record: VerificationRecord,
  moderatorName: string,
  removalReason: string
): Promise<void> {
  const subredditName = sanitizeSubredditName(record.subredditName);
  await context.reddit.addModNote({
    subreddit: subredditName,
    user: record.username,
    note: `Verification removed by mod: ${moderatorName}. Reason: ${removalReason}`,
  });
}

export async function sendModeratorRemovalModmail(
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
    today: formatTemplateToday(),
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

export async function sendDenialModmail(
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
    today: formatTemplateToday(),
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

export async function sendPendingSubmissionModmail(
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
    today: formatTemplateToday(),
  };
  const subject = buildModmailSubject(resolvedConfig.modmailSubject, values);
  const acknowledgementAt = formatTimestamp(record.ageAcknowledgedAt || record.submittedAt);
  const auditFooter = `Terms accepted and 18+ confirmation recorded on: ${acknowledgementAt}`;
  const body = `${fillTemplate(resolvedConfig.pendingBody, values).trimEnd()}\n\n${auditFooter}`;
  const autoArchiveEnabled = await getAutoArchivePendingModmailEnabled(context);
  const result = await sendUserModmailWithFallback(context, {
    subredditId,
    subredditName,
    subject,
    body,
    username: record.username,
    eventId: `pending:${record.id}`,
    archiveAfterSend: autoArchiveEnabled,
  });
  if (result.conversationId) {
    await rememberPendingModmailConversation(context, subredditId, result.conversationId, record.id);
  }
  return result;
}

export async function rememberPendingModmailConversation(
  context: RedisContext,
  subredditId: string,
  conversationId: string,
  verificationId: string
): Promise<void> {
  const normalizedConversationId = normalizeModmailConversationId(conversationId);
  if (!sanitizeSubredditId(subredditId) || !normalizedConversationId || !verificationId.trim()) {
    return;
  }
  await context.redis.set(pendingModmailConversationKey(subredditId, normalizedConversationId), verificationId.trim());
}

export function extractModmailUserSignals(user: unknown): ModmailUserSignals {
  if (!user || typeof user !== 'object') {
    return { isShadowBanned: null, recentActivityCount: null };
  }
  const data = user as { isShadowBanned?: unknown; recentComments?: unknown; recentPosts?: unknown };
  const countEntries = (value: unknown): number | null =>
    value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length : null;
  const commentCount = countEntries(data.recentComments);
  const postCount = countEntries(data.recentPosts);
  const recentActivityCount =
    commentCount === null && postCount === null ? null : (commentCount ?? 0) + (postCount ?? 0);
  return {
    isShadowBanned: normalizeOptionalBoolean(data.isShadowBanned),
    recentActivityCount,
  };
}

export function attachModmailUserSignals(result: ModmailStepResult, user: unknown): ModmailStepResult {
  const signals = extractModmailUserSignals(user);
  if (signals.isShadowBanned === null && signals.recentActivityCount === null) {
    return result;
  }
  return { ...result, userData: signals };
}

export async function sendUserModmailWithFallback(
  context: Devvit.Context,
  input: {
    subredditId: string;
    subredditName: string;
    subject: string;
    body: string;
    username: string;
    eventId?: string;
    archiveAfterSend?: boolean;
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
  const archiveAfterSend = input.archiveAfterSend !== false;
  const lockKey = eventId ? modmailLockKey(subredditId, eventId) : null;
  const dedupeKey = eventId ? modmailDedupeKey(subredditId, eventId) : null;
  const userThreadKeys = Array.from(
    new Set(usernameLookupFields(username).map((field) => modmailThreadByUserEntryKey(subredditId, field)))
  );
  const recipients = Array.from(new Set([normalizedUser, `u/${normalizedUser}`]));
  const maxSendAttempts = 3;
  let sendAttempts = 0;
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
        sendAttempts += 1;
        const replyResponse = await context.reddit.modMail.reply({
          conversationId: existingConversationId,
          body,
          isAuthorHidden: true,
        });
        if (dedupeKey) {
          await context.redis.set(dedupeKey, existingConversationId, {
            expiration: new Date(Date.now() + MODMAIL_DEDUPE_TTL_SECONDS * 1000),
          });
        }
        if (archiveAfterSend) {
          await archiveModmailConversationBestEffort(context, subredditName, username, existingConversationId);
        }
        return attachModmailUserSignals(
          { status: 'replied', conversationId: existingConversationId },
          (replyResponse as { user?: unknown } | null | undefined)?.user
        );
      } catch (error) {
        const replyErrorMessage = errorText(error);
        if (looksLikeTransientRedditTransportError(replyErrorMessage)) {
          return {
            status: 'failed',
            reason: replyErrorMessage,
          };
        }
        if (userThreadKeys.length > 0) {
          await context.redis.del(...userThreadKeys);
        }
      }
    }

    let lastError: string | undefined;
    for (const to of recipients) {
      if (sendAttempts >= maxSendAttempts) {
        break;
      }
      sendAttempts += 1;
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
        if (archiveAfterSend) {
          await archiveModmailConversationBestEffort(context, subredditName, username, conversationId);
        }
        return attachModmailUserSignals(
          { status: 'created', conversationId },
          (response as { user?: unknown } | null | undefined)?.user
        );
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

export async function archiveModmailConversationBestEffort(
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

export async function archivePendingVerificationModmailReply(
  context: Devvit.Context,
  event: PendingModmailReplyEvent
): Promise<PendingModmailArchiveResult> {
  if (!(await getAutoArchivePendingModmailEnabled(context))) {
    return { archived: false, reason: 'pending modmail auto-archive disabled' };
  }

  const conversationId = normalizeModmailConversationId(firstNonEmpty(event.conversationId, event.conversation_id));
  if (!conversationId) {
    return { archived: false, reason: 'missing conversation id' };
  }

  if (event.isAutoGenerated || event.is_auto_generated) {
    return { archived: false, reason: 'auto-generated modmail', conversationId };
  }

  const identity = await resolveModmailParticipantReplyIdentity(context, event, conversationId);
  if (!identity.username) {
    return {
      archived: false,
      reason: identity.reason,
      conversationId,
    };
  }

  const username = identity.username;
  const subredditId = sanitizeSubredditId(identity.subredditId);
  if (!subredditId) {
    return { archived: false, reason: 'missing subreddit id', conversationId, username };
  }

  const pendingRecord = await findPendingRecordForModmailReply(context, subredditId, username, identity.userId, conversationId);
  if (!pendingRecord.record) {
    return {
      archived: false,
      reason: pendingRecord.reason,
      conversationId,
      username,
      verificationId: pendingRecord.verificationId,
    };
  }

  try {
    await context.reddit.modMail.archiveConversation(conversationId);
    await rememberPendingModmailConversation(context, subredditId, conversationId, pendingRecord.record.id);
    return {
      archived: true,
      conversationId,
      username: pendingRecord.record.username,
      verificationId: pendingRecord.record.id,
    };
  } catch (error) {
    const message = errorText(error);
    if (looksLikeInternalModmailArchiveError(message)) {
      return {
        archived: false,
        reason: 'internal modmail conversation',
        conversationId,
        username: pendingRecord.record.username,
        verificationId: pendingRecord.record.id,
      };
    }
    return {
      archived: false,
      reason: message,
      conversationId,
      username: pendingRecord.record.username,
      verificationId: pendingRecord.record.id,
    };
  }
}

export async function getAutoArchivePendingModmailEnabled(
  context: Pick<Devvit.Context, 'settings'>
): Promise<boolean> {
  const raw = await context.settings.get<boolean | string>(INSTALL_SETTING_AUTO_ARCHIVE_PENDING_MODMAIL_ENABLED);
  return typeof raw === 'boolean' ? raw : parseBooleanString(raw, true);
}

export async function resolveModmailParticipantReplyIdentity(
  context: Devvit.Context,
  event: PendingModmailReplyEvent,
  conversationId: string
): Promise<{ username: string; userId: string; subredditId: string; reason: string }> {
  const eventAuthor = event.messageAuthor ?? event.message_author;
  const eventAuthorType = normalizeModmailPayloadToken(firstNonEmpty(event.messageAuthorType, event.message_author_type));
  const eventConversationType = normalizeModmailPayloadToken(firstNonEmpty(event.conversationType, event.conversation_type));
  if (eventConversationType && eventConversationType !== 'sr_user') {
    return { username: '', userId: '', subredditId: '', reason: 'not a user conversation' };
  }
  if (eventAuthorType === 'moderator' || eventAuthorType === 'participant_sr') {
    return { username: '', userId: '', subredditId: '', reason: 'not a participant user reply' };
  }

  const eventUsername = normalizeUsernameForLookup(eventAuthor?.name ?? '');
  const eventUserId = normalizeUserId(eventAuthor?.id);
  const eventSubredditId = normalizeTriggerSubredditId(
    context,
    firstNonEmpty(
      event.conversationSubreddit?.id,
      event.conversation_subreddit?.id,
      event.destinationSubreddit?.id,
      event.destination_subreddit?.id
    )
  );
  if (eventAuthorType === 'participant_user' && eventUsername && eventSubredditId) {
    return {
      username: eventUsername,
      userId: eventUserId,
      subredditId: eventSubredditId,
      reason: 'trigger participant user',
    };
  }

  const redditClient = context.reddit as Devvit.Context['reddit'] & {
    modMail?: Devvit.Context['reddit']['modMail'] & {
      getConversation?: (params: { conversationId: string; markRead?: boolean }) => Promise<{
        conversation?: {
          conversationType?: string;
          subreddit?: { id?: string; displayName?: string };
          participant?: { id?: number | string; name?: string; isMod?: boolean; isAdmin?: boolean };
          messages?: Record<
            string,
            {
              id?: string;
              author?: { id?: number | string; name?: string; isMod?: boolean; isAdmin?: boolean };
              participatingAs?: string;
            }
          >;
        };
        user?: { id?: string; name?: string };
      }>;
    };
  };
  const getConversation = redditClient.modMail?.getConversation;
  if (typeof getConversation !== 'function') {
    return {
      username: eventUsername,
      userId: eventUserId,
      subredditId: eventSubredditId,
      reason: eventUsername ? 'missing subreddit id' : 'missing message author',
    };
  }

  try {
    const response = await getConversation.call(redditClient.modMail, { conversationId, markRead: false });
    const conversation = response.conversation;
    const conversationType = normalizeModmailPayloadToken(conversation?.conversationType ?? eventConversationType);
    if (conversationType && conversationType !== 'sr_user') {
      return { username: '', userId: '', subredditId: '', reason: 'not a user conversation' };
    }

    const messageId = firstNonEmpty(event.messageId, event.message_id);
    const message = messageId ? conversation?.messages?.[messageId] : getMostRecentModmailMessage(conversation?.messages);
    const messageAuthor = message?.author;
    const messageParticipatingAs = normalizeModmailPayloadToken(message?.participatingAs);
    if (messageAuthor?.isMod || messageAuthor?.isAdmin || messageParticipatingAs === 'moderator') {
      return { username: '', userId: '', subredditId: '', reason: 'not a participant user reply' };
    }

    const fetchedUsername =
      normalizeUsernameForLookup(messageAuthor?.name ?? '') ||
      normalizeUsernameForLookup(response.user?.name ?? '') ||
      normalizeUsernameForLookup(conversation?.participant?.name ?? '') ||
      eventUsername;
    const fetchedUserId =
      normalizeUserId(messageAuthor?.id == null ? '' : String(messageAuthor.id)) ||
      normalizeUserId(response.user?.id) ||
      normalizeUserId(conversation?.participant?.id == null ? '' : String(conversation.participant.id)) ||
      eventUserId;
    const fetchedSubredditId = normalizeTriggerSubredditId(
      context,
      firstNonEmpty(conversation?.subreddit?.id, eventSubredditId)
    );

    if (!fetchedUsername) {
      return { username: '', userId: '', subredditId: fetchedSubredditId, reason: 'missing message author' };
    }
    return {
      username: fetchedUsername,
      userId: fetchedUserId,
      subredditId: fetchedSubredditId,
      reason: 'fetched participant user',
    };
  } catch (error) {
    return {
      username: eventUsername,
      userId: eventUserId,
      subredditId: eventSubredditId,
      reason: eventUsername ? `conversation lookup failed: ${errorText(error)}` : 'missing message author',
    };
  }
}

export function getMostRecentModmailMessage(
  messages: Record<
    string,
    {
      id?: string;
      date?: string;
      author?: { id?: number | string; name?: string; isMod?: boolean; isAdmin?: boolean };
      participatingAs?: string;
    }
  > | null | undefined
) {
  const entries = Object.values(messages ?? {});
  return entries.sort((left, right) => {
    const leftMs = new Date(left.date ?? '').getTime() || 0;
    const rightMs = new Date(right.date ?? '').getTime() || 0;
    return rightMs - leftMs;
  })[0];
}

export function normalizeModmailPayloadToken(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function normalizeTriggerSubredditId(context: { subredditId?: string | null }, value: string | null | undefined): string {
  const contextSubredditId = sanitizeSubredditId(typeof context.subredditId === 'string' ? context.subredditId : '');
  const eventSubredditId = sanitizeSubredditId(typeof value === 'string' ? value : '');
  if (eventSubredditId.startsWith('t5_')) {
    return eventSubredditId;
  }
  if (contextSubredditId.startsWith('t5_')) {
    return contextSubredditId;
  }
  return eventSubredditId || contextSubredditId;
}

export async function findPendingRecordForModmailReply(
  context: RedisContext,
  subredditId: string,
  username: string,
  userId: string | null | undefined,
  conversationId: string
): Promise<{ record: VerificationRecord | null; reason: string; verificationId?: string }> {
  const normalizedSubredditId = sanitizeSubredditId(subredditId);
  const normalizedConversationId = normalizeModmailConversationId(conversationId);
  if (!normalizedSubredditId || !normalizedConversationId) {
    return { record: null, reason: 'missing lookup scope' };
  }

  let staleTrackedReason = '';
  let staleTrackedVerificationId = '';
  const trackedVerificationId = await context.redis.get(
    pendingModmailConversationKey(normalizedSubredditId, normalizedConversationId)
  );
  if (trackedVerificationId) {
    const trackedRecord = await getRecord(context, normalizedSubredditId, trackedVerificationId);
    if (trackedRecord?.status === 'pending' && usernamesEqual(trackedRecord.username, username)) {
      return { record: trackedRecord, reason: 'tracked pending thread', verificationId: trackedRecord.id };
    }
    await context.redis.del(pendingModmailConversationKey(normalizedSubredditId, normalizedConversationId));
    staleTrackedReason = trackedRecord ? 'verification is no longer pending' : 'tracked verification was not found';
    staleTrackedVerificationId = trackedVerificationId;
  }

  const threadKeys = Array.from(
    new Set(usernameLookupFields(username).map((field) => modmailThreadByUserEntryKey(normalizedSubredditId, field)))
  );
  let isTrackedUserConversation = false;
  const invalidThreadKeys: string[] = [];
  for (const threadKey of threadKeys) {
    const cachedConversationIdRaw = await context.redis.get(threadKey);
    const cachedConversationId = normalizeModmailConversationId(cachedConversationIdRaw);
    if (cachedConversationIdRaw && !cachedConversationId) {
      invalidThreadKeys.push(threadKey);
      continue;
    }
    if (cachedConversationId === normalizedConversationId) {
      isTrackedUserConversation = true;
      break;
    }
  }
  if (invalidThreadKeys.length > 0) {
    await context.redis.del(...invalidThreadKeys);
  }
  if (!isTrackedUserConversation) {
    return {
      record: null,
      reason: staleTrackedReason || 'conversation is not tracked for a pending verification user',
      verificationId: staleTrackedVerificationId || undefined,
    };
  }

  const pendingIds = dedupeNonEmpty([
    (await context.redis.get(userPendingKey(normalizedSubredditId, username))) ?? '',
    userId ? (await context.redis.get(userPendingKeyById(normalizedSubredditId, userId))) ?? '' : '',
  ]);
  for (const pendingId of pendingIds) {
    const record = await getRecord(context, normalizedSubredditId, pendingId);
    if (record?.status === 'pending' && usernamesEqual(record.username, username)) {
      await rememberPendingModmailConversation(context, normalizedSubredditId, normalizedConversationId, record.id);
      return { record, reason: 'cached pending thread', verificationId: record.id };
    }
  }

  return {
    record: null,
    reason: pendingIds.length > 0 ? 'verification is no longer pending' : 'no pending verification for user',
    verificationId: pendingIds[0],
  };
}

export function buildModmailSubject(template: string, values: Record<string, string>): string {
  const fallback = fillTemplate(DEFAULT_MODMAIL_SUBJECT, values).trim();
  const subject = fillTemplate(template, values).trim();
  return (subject || fallback || 'Verification update').replace(/\s+/g, ' ').slice(0, 100);
}

export function prependRenderedModmailHeader(body: string, header: string): string {
  const normalizedHeader = header.replace(/\s+/g, ' ').trim();
  if (!normalizedHeader) {
    return body;
  }
  return `---\n\n**${normalizedHeader}**\n\n${body}`;
}

export function prependModmailHeader(body: string, headerTemplate: string, values: Record<string, string>): string {
  const header = fillTemplate(headerTemplate, values);
  if (!header) {
    return body;
  }
  return prependRenderedModmailHeader(body, header);
}

export function normalizeDenialNotes(notes: string | null | undefined): string {
  return String(notes ?? '').trim();
}

export function formatDenialNotesForModmail(notes: string): string {
  return notes ? `${MODMAIL_DENIAL_NOTES_PREFIX} ${notes}` : '';
}

export function templateIncludesDenialNotesPlaceholder(template: string): boolean {
  const placeholderPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const match of template.matchAll(placeholderPattern)) {
    const { key } = parseTemplatePlaceholder(match[1] ?? '');
    if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
      return true;
    }
  }
  return false;
}

export function normalizeDenialNotesTemplateBlocks(template: string): string {
  return template
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const placeholderOnlyMatch = trimmed.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
      if (placeholderOnlyMatch) {
        const { key } = parseTemplatePlaceholder(placeholderOnlyMatch[1] ?? '');
        if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
          return DENIAL_NOTES_BLOCK_MARKER;
        }
      }

      const prefixedPlaceholderMatch = trimmed.match(/^(moderator\s+notes?|reason)\s*:\s*\{\{\s*([^{}]+?)\s*\}\}$/i);
      if (prefixedPlaceholderMatch) {
        const { key } = parseTemplatePlaceholder(prefixedPlaceholderMatch[2] ?? '');
        if (key === DENIAL_NOTES_PLACEHOLDER_KEY || key === LEGACY_DENIAL_NOTES_PLACEHOLDER_KEY) {
          return DENIAL_NOTES_BLOCK_MARKER;
        }
      }

      return line;
    })
    .join('\n');
}

export function collapseBlankLines(text: string): string {
  return text.replace(/\n(?:[ \t]*\n){2,}/g, '\n\n');
}

export function renderDenialTemplateText(template: string, values: Record<string, string>, moderatorNotes: string): string {
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

export function renderDenialModmailBody(
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

export function fillTemplate(template: string, values: Record<string, string>): string {
  const normalizedMap = new Map<string, string>();
  for (const [rawKey, value] of Object.entries(values)) {
    normalizedMap.set(normalizePlaceholderKey(rawKey), value);
  }
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, rawKey: string) => {
    const { key, uppercase } = parseTemplatePlaceholder(rawKey);
    const replacement = normalizedMap.get(key) ?? '';
    return uppercase ? replacement.toLocaleUpperCase() : replacement;
  });
}

function formatTemplateToday(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.now()));
}

function parseTemplatePlaceholder(rawKey: string): { key: string; uppercase: boolean } {
  const normalizedRawKey = rawKey.trim();
  const capsMatch = normalizedRawKey.match(/^caps\s*:\s*(.+)$/i);
  return {
    key: normalizePlaceholderKey(capsMatch?.[1] ?? normalizedRawKey),
    uppercase: Boolean(capsMatch),
  };
}

export function normalizePlaceholderKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/\s+/g, '_');
}

export function looksLikeInternalModmailArchiveError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('cannot archive/unarchive internal conversations') ||
    (normalized.includes('archive') && normalized.includes('internal conversation'))
  );
}
