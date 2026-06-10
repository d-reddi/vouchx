import type { Devvit } from '@devvit/public-api';
import type { PendingPanelItem, PendingReviewFlag, PendingReviewFlagNote, VerificationRecord } from './types.ts';
import { MAX_REVIEW_FLAG_NOTES, MAX_REVIEW_FLAG_NOTE_LENGTH, REVIEW_FLAG_FORCE_UNLOCK_AFTER_MS } from './constants.ts';
import { toPendingPanelItem } from './dashboard.ts';
import { withVerificationActionLock } from './locks.ts';
import { assertCanReview } from './moderator-access.ts';
import {
  getCurrentSubredditNameCompat,
  normalizeOptionalIsoTimestamp,
  parseTimestampMs,
  sanitizeSubredditId,
  usernamesEqual,
} from './normalize.ts';
import { getRecord, setRecord } from './records.ts';
import { getRuntimeConfig } from './settings.ts';

export function normalizeReviewFlagNoteText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, MAX_REVIEW_FLAG_NOTE_LENGTH);
}

export function parsePendingReviewFlagNote(value: unknown): PendingReviewFlagNote | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const parsed = value as { author?: unknown; at?: unknown; text?: unknown };
  const at = normalizeOptionalIsoTimestamp(parsed.at);
  const text = normalizeReviewFlagNoteText(parsed.text);
  if (!at || !text) {
    return null;
  }
  return {
    author: typeof parsed.author === 'string' && parsed.author.trim() ? parsed.author.trim() : 'unknown',
    at,
    text,
  };
}

export function parsePendingReviewFlag(value: unknown): PendingReviewFlag | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const parsed = value as { flaggedBy?: unknown; flaggedAt?: unknown; notes?: unknown };
  const flaggedAt = normalizeOptionalIsoTimestamp(parsed.flaggedAt);
  const flaggedBy = typeof parsed.flaggedBy === 'string' && parsed.flaggedBy.trim() ? parsed.flaggedBy.trim() : '';
  if (!flaggedAt || !flaggedBy) {
    return null;
  }
  const notes = (Array.isArray(parsed.notes) ? parsed.notes : [])
    .map((note) => parsePendingReviewFlagNote(note))
    .filter((note): note is PendingReviewFlagNote => note !== null)
    .slice(0, MAX_REVIEW_FLAG_NOTES);
  return { flaggedBy, flaggedAt, notes };
}

async function loadPendingRecordForFlagAction(
  context: Devvit.Context,
  verificationId: string
): Promise<{ subredditId: string; moderator: string; record: VerificationRecord }> {
  const moderator = await context.reddit.getCurrentUsername();
  if (!moderator) {
    throw new Error('You must be logged in as a moderator.');
  }

  const subredditId = sanitizeSubredditId(context.subredditId);
  const subredditName = await getCurrentSubredditNameCompat(context);
  await assertCanReview(context, subredditName, moderator);

  const record = await getRecord(context, subredditId, verificationId);
  if (!record) {
    throw new Error('Verification not found.');
  }
  if (record.status !== 'pending') {
    throw new Error('Verification is no longer pending.');
  }
  return { subredditId, moderator, record };
}

export async function setPendingFlagState(
  context: Devvit.Context,
  verificationId: string,
  shouldFlag: boolean,
  initialNote?: string
): Promise<{ item: PendingPanelItem; changed: boolean; username: string }> {
  return await withVerificationActionLock(context, sanitizeSubredditId(context.subredditId), verificationId, async () => {
    const { subredditId, moderator, record } = await loadPendingRecordForFlagAction(context, verificationId);

    let updatedRecord = record;
    let changed = false;
    if (shouldFlag && !record.reviewFlag) {
      const now = new Date().toISOString();
      const noteText = normalizeReviewFlagNoteText(initialNote);
      const notes: PendingReviewFlagNote[] = noteText ? [{ author: moderator, at: now, text: noteText }] : [];
      updatedRecord = {
        ...record,
        reviewFlag: { flaggedBy: moderator, flaggedAt: now, notes },
      };
      changed = true;
    } else if (!shouldFlag && record.reviewFlag) {
      // Unflagging discards the note thread: notes live only as long as the flag.
      updatedRecord = { ...record, reviewFlag: null };
      changed = true;
    }

    if (changed) {
      await setRecord(context, subredditId, updatedRecord);
    }

    const config = await getRuntimeConfig(context, subredditId);
    return { item: toPendingPanelItem(updatedRecord, config), changed, username: updatedRecord.username };
  });
}

export async function addPendingFlagNote(
  context: Devvit.Context,
  verificationId: string,
  noteText: string
): Promise<{ item: PendingPanelItem; username: string }> {
  return await withVerificationActionLock(context, sanitizeSubredditId(context.subredditId), verificationId, async () => {
    const { subredditId, moderator, record } = await loadPendingRecordForFlagAction(context, verificationId);

    if (!record.reviewFlag) {
      throw new Error('Flag this request for 2nd review before adding notes.');
    }
    const normalizedText = normalizeReviewFlagNoteText(noteText);
    if (!normalizedText) {
      throw new Error('Enter a note before posting.');
    }
    if (record.reviewFlag.notes.length >= MAX_REVIEW_FLAG_NOTES) {
      throw new Error(`This request already has the maximum of ${MAX_REVIEW_FLAG_NOTES} notes.`);
    }

    const note: PendingReviewFlagNote = {
      author: moderator,
      at: new Date().toISOString(),
      text: normalizedText,
    };
    const updatedRecord: VerificationRecord = {
      ...record,
      reviewFlag: {
        ...record.reviewFlag,
        notes: [...record.reviewFlag.notes, note],
      },
    };
    await setRecord(context, subredditId, updatedRecord);

    const config = await getRuntimeConfig(context, subredditId);
    return { item: toPendingPanelItem(updatedRecord, config), username: updatedRecord.username };
  });
}
