VOUCHX — PRIVACY POLICY
Effective Date: May 24, 2026

Application: VouchX (the “Application”), a Reddit Devvit application.

This Privacy Policy explains how VouchX (“Application,” “VouchX,” “we,” “us,” or “our”) processes information when users, subreddit moderators, or other Reddit users access or use the Application.

VouchX is a Reddit Devvit moderation workflow tool. It operates on Reddit’s platform and relies on Reddit-controlled infrastructure, Reddit accounts, Reddit permissions, Reddit APIs, Reddit-hosted media, Reddit modmail, Reddit flair, Reddit posts, Reddit comments, and subreddit-specific Application data stores.

This Privacy Policy applies only to data processed by or through VouchX. Your use of Reddit remains governed by Reddit’s own User Agreement, Privacy Policy, Content Policy, Developer Terms, Moderator Code of Conduct, and other Reddit policies.

1. SUMMARY
1.1 VouchX processes limited operational metadata and workflow records necessary to support subreddit verification workflows.

1.2 VouchX may process Reddit usernames, Reddit user IDs when available, subreddit identifiers, moderator identifiers, Reddit-hosted media URLs, verification status, timestamps, workflow records, moderator actions, denial reasons, moderator notes, modmail/template text, flair configuration and status, blocklists, denial counters, audit/history entries, scheduled validation metadata, browser-local UI state, and diagnostic logs.

1.3 VouchX does not independently store image binaries, media files, or full Reddit-hosted user-generated content outside Reddit-controlled infrastructure. The Application stores Reddit-hosted media URL strings or references for workflow purposes.

1.4 VouchX does not use third-party analytics, advertising trackers, AI/LLM services, third-party image-processing services, external webhooks, or external error-reporting services based on the current Application code.

1.5 VouchX does not sell, rent, or share personal information for cross-context behavioral advertising or unrelated commercial marketing.

1.6 Some Application records are stored within subreddit-specific Devvit Redis or similar Reddit-provided storage associated with a particular subreddit installation. The Developer generally does not have direct access to those subreddit-specific records and generally cannot access, export, correct, delete, modify, retrieve, or transfer those records.

2. CATEGORIES OF INFORMATION PROCESSED
2.1 Reddit Account and User Identifiers

The Application may process Reddit usernames, Reddit user IDs when available, viewer usernames, submitter usernames, moderator usernames, and related user identifiers.

These identifiers are used to determine user status, associate submissions with users, display verification status, enforce blocklists, route modmail, apply or check flair, maintain audit/history records, and support moderator review.

2.2 Subreddit Information

The Application may process subreddit names, subreddit IDs, subreddit-specific configuration settings, subreddit-specific workflow records, and subreddit-specific moderation data.

This information is used to operate the Application within the applicable subreddit installation.

2.3 Verification Workflow Information

The Application may process verification record IDs, submission timestamps, review timestamps, verification status, pending status, approval status, denial status, removal status, re-review status, withdrawal status, and related workflow events.

This information is used to manage verification queues, display user status, support moderator review, maintain history, and operate workflow features.

2.4 Submitted Media References

When users submit verification materials, the Application may process Reddit-hosted media URLs or similar URL strings returned through Reddit or Devvit image submission functionality, including fields such as photoOneUrl, photoTwoUrl, and photoThreeUrl.

The Application does not independently store submitted image binaries or media files in Application-controlled external storage. The Application stores media URL strings or references so moderators can review Reddit-hosted submitted materials through the Application’s workflow interface.

2.5 Moderator Review Information

The Application may process moderator usernames, moderator actions, review decisions, approval actions, denial actions, removal actions, claim/assignment information, audit entries, timestamps, and related notes.

This information is used to support moderator workflows, maintain audit/history records, display review context, and troubleshoot workflow issues.

2.6 Denial Reasons, Notes, and Modmail Information

The Application may process denial reason labels, denial notes, moderator notes, modmail templates, modmail subjects, modmail bodies, generated placeholder text, modmail conversation IDs, and modmail deduplication records.

This information is used to notify users about verification workflow outcomes, avoid duplicate modmail handling, and support subreddit-specific moderation processes.

2.7 Flair and Verification Status Information

The Application may process flair template IDs, additional approval flair settings, last-applied flair template IDs, flair reconciliation timestamps, verified/unverified status, and related Reddit flair state.

This information is used to apply, remove, check, or reconcile subreddit flair as part of the applicable subreddit’s verification workflow.

2.8 Account Snapshot Information

For moderator review context, the Application may process limited Reddit account-related information such as account creation date, total karma, subreddit karma, previous denial attempts, subreddit ban status, whether the account has a verified email, whether the account has Reddit Premium, whether the account is shadowbanned, a count of recent posts and comments, the number of linked social/external profiles, and whether any linked profile points to a known content-creator platform, where available through Reddit or Devvit APIs.

From these signals the Application may compute an advisory grade (for example, indicating possible spam risk or limited account history) and may display an informational badge when a known content-creator platform is linked. These are non-binding aids for moderators and do not, by themselves, determine the outcome of any submission. This snapshot is stored only while a submission is pending and is discarded when the submission is reviewed, withdrawn, removed, or otherwise purged under the Application’s retention periods.

This information is used to assist moderators in reviewing pending submissions. The Application does not independently verify a user’s identity, age, consent, legality, authenticity, or trustworthiness.

2.9 Blocklists and Denial Counters

The Application may process subreddit-specific blocked user records, denial counters, and developer-controlled global Application-level blocked usernames.

Subreddit-specific blocklists and denial counters are used for that subreddit’s workflow. Developer-controlled global Application-level blocklists, where used, are intended to restrict access to the Application across installations for abuse-prevention, safety, legal, or integrity reasons.

2.10 Configuration Settings

The Application may process subreddit-specific settings, global settings, developer settings, release notice settings, template settings, photo instruction settings, modmail settings, flair settings, retention settings, display settings, permission settings, and feature settings.

These settings are used to configure and operate the Application.

2.11 Audit, History, and Diagnostic Information

The Application may process audit entries, history records, scheduled-job metadata, validation records, cache records, error logs, diagnostic logs, permission cache entries, update notice state, and related technical records.

This information is used to maintain workflow integrity, troubleshoot issues, operate scheduled jobs, enforce access controls, and support moderator-facing audit/history functionality.

2.12 Browser-Local UI State

The Application may store limited browser-local UI state using localStorage or similar browser storage, such as photo-instruction read state, launch state, and theme snapshot state.

This browser-local information is used only for user-interface behavior and is stored locally in the user’s browser. It is not used by the Developer for advertising or unrelated tracking.

3. INFORMATION VOUCHX DOES NOT PROCESS INDEPENDENTLY
3.1 The Application does not independently store image binaries or media files in an external Application database.

3.2 The Application does not transmit submitted images to third-party image-processing services.

3.3 The Application does not use third-party analytics, advertising trackers, AI/LLM services, third-party error-reporting tools, or external webhooks based on the current Application code.

3.4 The Application does not independently verify identity, age, consent, authenticity, legality, safety, or trustworthiness.

3.5 The Application does not conduct background checks.

3.6 The Application does not act as an age-verification service, identity-verification service, credentialing service, legal-review service, or law-enforcement service.

4. SOURCES OF INFORMATION
4.1 Information may be received from:

(a) Reddit users who access or submit materials through the Application;

(b) subreddit moderators who install, configure, or operate the Application;

(c) Reddit and Devvit APIs;

(d) Reddit-hosted media and Reddit-controlled systems;

(e) subreddit-specific Application data stores;

(f) moderator actions within the Application;

(g) user actions within the Application;

(h) Application settings and configuration fields;

(i) scheduled jobs and automated workflow processes; and

(j) browser-local storage used for limited UI state.

5. HOW INFORMATION IS USED
5.1 The Application uses information to:

(a) operate subreddit verification workflows;

(b) display user verification status;

(c) route submitted materials to moderators for review;

(d) allow moderators to approve, deny, remove, revoke, block, unblock, or otherwise manage verification workflow records;

(e) support subreddit-specific rules and configuration;

(f) apply, remove, check, or reconcile Reddit flair;

(g) generate modmail messages, moderator notes, and workflow notifications;

(h) maintain audit, history, and statistics records;

(i) enforce configuration requirements and access controls;

(j) detect misuse, abuse, spam, evasion, or prohibited conduct;

(k) operate blocklists and denial counters;

(l) run scheduled validation, retention, cleanup, and reconciliation jobs;

(m) troubleshoot bugs, errors, and performance issues;

(n) maintain Application integrity and security;

(o) comply with legal obligations; and

(p) protect the rights, safety, security, and legal interests of users, moderators, Reddit, the Developer, and third parties.

6. WHERE INFORMATION IS STORED
6.1 Subreddit-Specific Devvit Storage

Certain Application records may be stored in Devvit Redis or similar Reddit-provided storage associated with a specific subreddit installation of the Application. These records may include verification records, workflow indexes, user pointers, subreddit configuration, subreddit blocklists, denial counters, audit/history records, modmail cache records, validation records, and scheduled-job metadata.

6.2 Reddit-Controlled Systems

Reddit controls Reddit accounts, Reddit-hosted media, posts, comments, modmail, mod notes, user flair, subreddit permissions, platform logs, moderation tools, reporting systems, content removal systems, and other Reddit platform data.

6.3 Devvit Settings

Certain settings may be stored in Devvit settings, including subreddit-specific settings and developer-controlled global settings. Global settings may include release notice metadata, developer UI allowlists, and global Application-level blocked username lists.

6.4 Browser Storage

The Application may use browser-local storage for limited UI state, such as whether photo instructions were recently shown or whether a theme snapshot was cached. Browser-local storage is controlled by the user’s browser.

6.5 Diagnostic Logs

The Application may generate runtime logs, error logs, and diagnostic output through Reddit or Devvit logging systems. Exact log retention, access, and deletion behavior may be controlled by Reddit or Devvit.

7. REDDIT-CONTROLLED DATA
7.1 VouchX operates on Reddit’s platform. Reddit controls Reddit-hosted content and many platform-level records, including accounts, posts, comments, media, modmail, mod notes, flair, reports, platform logs, and enforcement decisions.

7.2 Requests concerning Reddit-hosted content, Reddit account data, Reddit posts, Reddit comments, Reddit messages, Reddit modmail, Reddit-controlled records, Reddit-hosted media, or Reddit platform data should be directed to Reddit through Reddit’s applicable account, privacy, data-request, reporting, copyright, or content-removal processes.

7.3 For convenience, Reddit’s general support request form is currently available at:
https://support.reddithelp.com/hc/en-us/requests/new

7.4 Reddit’s copyright-related help resources are currently available at:
https://support.reddithelp.com/hc/en-us/sections/21596664069268-Copyright

7.5 These links are provided for convenience only. Reddit may change, replace, or remove these processes or links at any time.

8. SUBREDDIT-SPECIFIC APPLICATION DATA
8.1 The Application may store certain records within subreddit-specific Application data stores associated with a particular subreddit installation.

8.2 Subreddit-specific Application records may include verification records, workflow status, media URL references, audit/history records, configuration settings, blocklists, denial counters, modmail cache records, validation records, and other workflow metadata.

8.3 The Developer generally does not have direct access to subreddit-specific Application records and generally cannot access, export, correct, delete, modify, retrieve, or transfer records maintained within a specific subreddit installation of the Application.

8.4 Requests concerning subreddit-specific moderation decisions, verification status, subreddit workflow records, subreddit queues, subreddit audit history, subreddit configuration, subreddit blocklists, denial counters, or subreddit-specific Application records should be directed to the moderators of the applicable subreddit, subject to Reddit’s policies, subreddit rules, moderator access, and moderator discretion.

8.5 The Developer does not control subreddit moderation decisions, subreddit rules, moderator communications, subreddit verification standards, subreddit-specific Application records, or subreddit-specific data-retention decisions except to the limited extent expressly made available through Application functionality and within the Developer’s technical control.

9. DEVELOPER-CONTROLLED DATA
9.1 The Developer may control limited global Application-level settings or safeguards where technically available, including global Application-level blocklists, release notice settings, developer UI allowlists, or other platform-permitted global controls.

9.2 Global Application-level blocklists may be used to restrict a specific user’s access to the Application across installations for abuse-prevention, safety, legal, platform-compliance, or integrity reasons.

9.3 The Developer may respond to requests concerning data, settings, safeguards, or records actually controlled by the Developer, if any, where technically feasible and legally required.

9.4 The Developer does not guarantee the ability to access, export, correct, delete, modify, retrieve, or transfer subreddit-specific records.

10. SHARING AND DISCLOSURE
10.1 The Application does not sell, rent, or share personal information with third parties for cross-context behavioral advertising, unrelated commercial marketing, or unrelated commercial exploitation.

10.2 Information may be displayed to subreddit moderators through the Application’s moderator interface where necessary for verification workflow review, moderation, audit, history, configuration, or troubleshooting.

10.3 Information may be displayed to users through the Application where necessary to show their own verification status, submission status, denial status, removal status, available actions, or related workflow information.

10.4 Information may be transmitted to Reddit or processed through Reddit and Devvit systems as necessary to operate the Application, including through Reddit APIs for modmail, flair, moderation notes, subreddit permissions, posts, user information, media display, and related functionality.

10.5 Information may be disclosed to Reddit pursuant to Reddit’s platform agreements, technical requirements, policies, app review processes, legal obligations, or enforcement processes.

10.6 Information may be disclosed to law enforcement, courts, regulators, or other authorities where required by law, subpoena, court order, legal process, or where reasonably necessary to protect rights, safety, security, or legal interests.

10.7 Information may be disclosed where reasonably necessary to investigate, prevent, or address suspected misuse, abuse, prohibited content, security incidents, legal violations, platform violations, or threats to users, moderators, Reddit, the Developer, or third parties.

11. RETENTION
11.1 Retention periods may vary depending on Application settings, Reddit-controlled systems, subreddit-specific data stores, moderator configuration, technical constraints, operational needs, legal requirements, platform behavior, or integrity concerns.

11.2 Verification records and audit entries are generally subject to Application retention periods. Current Application retention periods are ninety (90) days for verified records and forty-five (45) days for pending, denied, removed, withdrawn, and audit records, subject to operational behavior, scheduled cleanup, technical constraints, and exceptions.

11.3 Approved verification records may have a sliding retention period that may be extended when the user interacts with or loads the Application, subject to current Application behavior and technical constraints.

11.4 Certain records may have shorter retention periods, including deduplication records, locks, permission caches, update notice state, browser-local instruction state, and other temporary technical records.

11.5 Certain records may not have an explicit Application-level time-to-live in current code, including some subreddit configuration settings, subreddit blocklists, denial counters, modmail thread cache records, Devvit settings, global settings, and Reddit-controlled records.

11.6 User self-deletion or withdrawal functionality, where available, may delete or remove certain current-subreddit verification records, indexes, pointers, or audit entries, but may not remove subreddit moderation records such as blocklist entries, denial counters, modmail records, mod notes, flair, Reddit-hosted media, Reddit-controlled content, or records outside the current subreddit installation.

11.7 Moderator actions may revoke, remove, cancel, purge, or alter certain workflow records where Application functionality permits, but moderators may not have the ability to delete every associated record or Reddit-controlled item.

11.8 The Developer may lack the ability to access, alter, or delete records stored within a specific subreddit installation.

11.9 Retention periods described in this Privacy Policy or in the Application are operational targets only and are not contractual guarantees.

11.10 App uninstall behavior, including whether uninstalling the Application deletes subreddit-specific Application data, is controlled by Reddit or Devvit and may not be within the Developer’s control.

12. DELETION, ACCESS, AND CORRECTION REQUESTS
12.1 Requests concerning Reddit-hosted content, Reddit account data, Reddit posts, Reddit comments, Reddit messages, Reddit modmail, Reddit-controlled records, Reddit-hosted media, or Reddit platform data should be directed to Reddit.

12.2 Requests concerning subreddit-specific moderation decisions, verification status, workflow records, queues, audit history, configuration, blocklists, denial counters, or subreddit-specific Application records should be directed to the moderators of the applicable subreddit.

12.3 Requests concerning global Application-level records actually controlled by the Developer, such as a global Application-level blocklist where applicable, may be directed to the Developer through r/VouchX or another contact method designated by the Developer.

12.4 The Developer may respond to requests concerning data actually controlled by the Developer where technically feasible and legally required.

12.5 The Developer generally cannot access, export, correct, delete, modify, retrieve, or transfer subreddit-specific Application records maintained within a specific subreddit installation.

12.6 The Developer may redirect a requester to Reddit, the applicable subreddit moderators, or another appropriate channel if the request concerns information outside the Developer’s control.

13. SUBMISSION CONFIRMATIONS
13.1 Before submitting verification materials, users are required to confirm certain submission requirements through the Application.

13.2 Current Application submission confirmations include that the user is at least eighteen (18) years old, that submitted photos are of the user and do not include anyone under eighteen (18), and that the user has read and accepted the VouchX Terms of Service and Privacy Policy.

13.3 The Application displays links to the VouchX Terms of Service and Privacy Policy in the submission flow.

13.4 The Application records submission confirmations as part of the verification submission record. Current Application records may include an age acknowledgment timestamp, submission timestamp, username, user ID where available, subreddit ID, subreddit name, and related workflow metadata.

13.5 Because the Application requires the submission confirmations to be completed before a verification submission can be created, the submission record reflects that the required confirmations were completed at or before the time of submission. 

13.6 Additional rules concerning age, consent, prohibited content, user representations, and submitted materials are set forth in the VouchX Terms of Service.

14. SECURITY
14.1 The Application uses Reddit and Devvit platform infrastructure, permissions, and APIs to operate.

14.2 Access to moderator-facing functionality is restricted through Reddit identity, subreddit permissions, Application permissions, and Application access-control checks.

14.3 Certain settings or moderator interfaces may be restricted to moderators with specific Reddit permissions, depending on subreddit configuration and Application settings.

14.4 No method of transmission, storage, or platform operation is completely secure. The Developer does not guarantee that information processed through the Application will be uninterrupted, secure, error-free, or immune from unauthorized access, platform failure, or technical defects.

15. INTERNATIONAL USERS
15.1 The Application is operated through Reddit and Devvit and may be accessed by users in different jurisdictions.

15.2 By using the Application, you acknowledge that information may be processed through Reddit-controlled systems, Devvit infrastructure, and Application data stores that may be subject to United States law or other applicable laws.

15.3 The Developer makes no representation that the Application is appropriate or available for use in any particular jurisdiction.

16. CHANGES TO THIS PRIVACY POLICY
16.1 The Developer may update this Privacy Policy from time to time.

16.2 Updated versions may be posted in r/VouchX, on the Application listing, in Application documentation, on the applicable Reddit wiki page, or through another reasonable method then available to the Developer.

16.3 The Developer does not guarantee that Reddit or the Application will provide direct, individualized, or in-Application notice to every user.

16.4 Continued use of the Application after an updated Privacy Policy is posted constitutes acceptance of the updated Privacy Policy to the extent permitted by applicable law.

16.5 Users who do not agree to the updated Privacy Policy must not submit materials through, install, configure, access, or otherwise use the Application.

17. CONTACT
17.1 Unless the Developer designates another contact method, privacy-related questions concerning VouchX may be sent through Modmail at r/VouchX.

17.2 Requests concerning Reddit-controlled data should be directed to Reddit.

17.3 Requests concerning subreddit-specific Application records or moderation decisions should be directed to the moderators of the applicable subreddit.

17.4 Requests concerning global Application-level records actually controlled by the Developer may be directed to the Developer through r/VouchX or another designated contact method.