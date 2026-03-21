import { Devvit, fetchDevvitWeb, type FormOnSubmitEvent } from '@devvit/public-api';

import {
  USER_VALIDATION_JOB_NAME,
  ensureUserValidationSchedule,
  errorText,
  onModeratorPurgeUserData,
  reconcileApprovedUsersForRetention,
  sanitizeSubredditId,
  sanitizeSubredditName,
  type AuditRetentionJobData,
  type CreatePostValues,
  type PurgeUserDataFormValues,
} from './core.js';

type RemoveVerificationPostFormValues = {
  confirmationText?: string;
};

async function onCreateVerificationPost(
  event: FormOnSubmitEvent<CreatePostValues>,
  context: Devvit.Context
): Promise<void> {
  try {
    const response = await fetchDevvitWeb(context, '/api/admin/create-post', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        postTitle: event.values.postTitle?.trim() || 'Photo Verification Hub',
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      postUrl?: string;
      toast?: { text?: string };
    };

    if (!response.ok) {
      context.ui.showToast(payload.error ?? 'Failed to create the verification post.');
      return;
    }

    context.ui.showToast({
      text: payload.toast?.text ?? 'Created NSFW verification post.',
      appearance: 'success',
    });
    if (payload.postUrl) {
      context.ui.navigateTo(payload.postUrl);
    }
  } catch (error) {
    context.ui.showToast(`Failed to create the verification post: ${errorText(error)}`);
  }
}

async function onRemoveVerificationPost(
  event: FormOnSubmitEvent<RemoveVerificationPostFormValues>,
  context: Devvit.Context
): Promise<void> {
  if (String(event.values.confirmationText ?? '').trim().toLowerCase() !== 'remove') {
    context.ui.showToast('Removal cancelled. Type "remove" to confirm.');
    return;
  }

  if (!context.postId) {
    context.ui.showToast('No post context available for removal.');
    return;
  }

  try {
    const post = await context.reddit.getPostById(context.postId);
    await post.remove(false);
    context.ui.showToast({
      text: 'Removed verification hub post.',
      appearance: 'success',
    });
  } catch (error) {
    context.ui.showToast(`Failed to remove post: ${errorText(error)}`);
  }
}

const createVerificationPostForm = Devvit.createForm(
  {
    title: 'Create verification hub post',
    description: 'Creates the verification hub post and marks it NSFW.',
    fields: [
      {
        type: 'string',
        name: 'postTitle',
        label: 'Post title',
        required: true,
        defaultValue: 'Photo Verification Hub',
      },
    ],
    acceptLabel: 'Create NSFW verification post',
    cancelLabel: 'Cancel',
  },
  onCreateVerificationPost
);

const purgeUserDataForm = Devvit.createForm(
  {
    title: 'Purge Audit Log',
    description:
      'Removes audit log entries using your install setting for this subreddit. Set purge days to 0 to purge all entries.',
    fields: [
      {
        type: 'string',
        name: 'confirmationText',
        label: 'Type "confirm" to purge the audit log.',
        required: true,
      },
    ],
    acceptLabel: 'Purge Audit Log',
    cancelLabel: 'Cancel',
  },
  onModeratorPurgeUserData
);

const removeVerificationPostForm = Devvit.createForm(
  {
    title: 'Remove verification hub post',
    description: 'Removes this app-created verification post from the subreddit.',
    fields: [
      {
        type: 'string',
        name: 'confirmationText',
        label: 'Type "remove" to confirm',
        required: true,
      },
    ],
    acceptLabel: 'Remove post',
    cancelLabel: 'Cancel',
  },
  onRemoveVerificationPost
);

Devvit.addMenuItem({
  label: 'Create Verification Hub (VouchX)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: (_, context) => {
    context.ui.showForm(createVerificationPostForm);
  },
});

Devvit.addMenuItem({
  label: 'Purge Audit Log',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: (_, context) => {
    context.ui.showForm(purgeUserDataForm);
  },
});

Devvit.addMenuItem({
  label: 'Remove Verification Hub Post',
  description: 'Removes this verification post from the subreddit.',
  location: 'post',
  postFilter: 'currentApp',
  forUserType: 'moderator',
  onPress: (_, context) => {
    context.ui.showForm(removeVerificationPostForm);
  },
});

Devvit.addSchedulerJob<AuditRetentionJobData>({
  name: USER_VALIDATION_JOB_NAME,
  onRun: async (event, context) => {
    const subredditId = sanitizeSubredditId(event.data?.subredditId ?? '');
    const subredditName = sanitizeSubredditName(event.data?.subredditName ?? '');
    if (!subredditId || !subredditName) {
      return;
    }

    try {
      const summary = await reconcileApprovedUsersForRetention(context, subredditId, subredditName);
      if (!summary.skipped) {
        console.log(
          `[user-validation] r/${subredditName}: approved_processed=${summary.processed} approved_validated=${summary.validated} approved_purged=${summary.purged} approved_retries=${summary.retried} non_approved_processed=${summary.nonApprovedProcessed} non_approved_validated=${summary.nonApprovedValidated} non_approved_purged=${summary.nonApprovedPurged} non_approved_retries=${summary.nonApprovedRetried} audit_purged=${summary.auditPurged} stale_index_entries_purged=${summary.staleIndexEntriesPurged}`
        );
      }
    } catch (error) {
      console.log(`[user-validation] Failed reconciliation for r/${subredditName}: ${errorText(error)}`);
    }
  },
});

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    const subredditId = sanitizeSubredditId(event.subreddit?.id ?? '');
    const subredditName = sanitizeSubredditName(event.subreddit?.name ?? '');
    if (!subredditId || !subredditName) {
      return;
    }

    try {
      await ensureUserValidationSchedule(context, subredditId, subredditName);
    } catch {
      return;
    }
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (event, context) => {
    const subredditId = sanitizeSubredditId(event.subreddit?.id ?? '');
    const subredditName = sanitizeSubredditName(event.subreddit?.name ?? '');
    if (!subredditId || !subredditName) {
      return;
    }

    try {
      await ensureUserValidationSchedule(context, subredditId, subredditName);
    } catch {
      return;
    }
  },
});

export default Devvit;
