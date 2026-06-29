import { connectRealtime, disconnectRealtime } from '@devvit/realtime/client';
import {
  exitExpandedMode,
  navigateTo,
  requestExpandedMode,
  showForm,
  showToast as devvitShowToast,
} from '@devvit/web/client';
import { EffectType } from '@devvit/protos/json/devvit/ui/effects/v1alpha/effect.js';
import { WebViewImmersiveMode } from '@devvit/protos/json/devvit/ui/effects/web_view/v1alpha/immersive_mode.js';
import { emitEffect } from '@devvit/shared-types/client/emit-effect.js';
import {
  GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME,
  buildRedditUsernameListCanonicalValue,
  GLOBAL_BLOCKED_USERNAME_SETTING_NAMES,
  parseRedditUsernameList,
  splitRedditUsernameListAcrossSettings,
} from '../shared/global-usernames.ts';
import { isVouchxHomeSubreddit } from '../shared/subreddits.ts';
import brandVxUrl from './brand-vx.png';
import { HOW_TO_USE_APP_URL, MODERATOR_QUICK_START_URL } from './app-config.js';

const AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const FLAIR_PROPAGATION_REFRESH_INTERVAL_MS = 2500;
const FLAIR_PROPAGATION_MAX_RETRIES = 6;
const TERMS_AND_CONDITIONS_URL = 'https://www.reddit.com/r/vouchx/wiki/terms-and-conditions/';
const PRIVACY_POLICY_URL = 'https://www.reddit.com/r/vouchx/wiki/privacy-policy/';
const PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY = 'vouchx-photo-instructions-launch-v1';
const PHOTO_INSTRUCTIONS_LAUNCH_STATE_TTL_MS = 5 * 60 * 1000;
const PHOTO_INSTRUCTIONS_READ_STATE_PREFIX = 'vouchx-photo-instructions-read-v1:';
const PHOTO_INSTRUCTIONS_READ_TTL_MS = 5 * 60 * 1000;
const SUBMIT_ACKNOWLEDGEMENTS = [
  {
    key: 'is18Confirmed',
    label: 'I am at least 18 years old.',
  },
  {
    key: 'adultOnlySelfPhotosConfirmed',
    label: 'Photos I submit are of me and do not include anyone under 18.',
  },
  {
    key: 'termsAccepted',
    label: 'I have read and accept the VouchX Terms and Conditions.',
  },
];
const MANUAL_SOURCE_MARKERS = ['css-substring-match', 'css-wildcard-match'];
const WORKTREE_LABEL = typeof __VOUCHX_WORKTREE_LABEL__ === 'string' ? __VOUCHX_WORKTREE_LABEL__.trim() : '';
const PHOTO_INSTRUCTION_LANGUAGE_OPTIONS = Object.freeze([
  { id: 'en', label: 'en', configField: 'photoInstructions' },
  { id: 'es', label: 'es', configField: 'photoInstructionsEs' },
  { id: 'fr', label: 'fr', configField: 'photoInstructionsFr' },
  { id: 'pt-br', label: 'pt-BR', configField: 'photoInstructionsPtBr' },
]);
const PHOTO_INSTRUCTION_LANGUAGE_COPY = Object.freeze({
  en: {
    title: 'Photo Requirements',
    subtitle: 'Review these instructions carefully before submitting your photos.',
    scrollHint: 'Scroll Down ↓',
  },
  es: {
    title: 'Requisitos para las fotos',
    subtitle: 'Lea atentamente estas instrucciones antes de enviar sus fotos.',
    scrollHint: 'Desplázate hacia abajo ↓',
  },
  fr: {
    title: 'Exigences relatives aux photos',
    subtitle: 'Veuillez lire attentivement ces instructions avant de soumettre vos photos.',
    scrollHint: 'Défilez vers le bas ↓',
  },
  'pt-br': {
    title: 'Requisitos das fotos',
    subtitle: 'Leia estas instruções com atenção antes de enviar suas fotos.',
    scrollHint: 'Role para baixo ↓',
  },
});

function createShell(root, inline) {
  root.innerHTML = `
    <div class="shell">
      <div data-el="loading" class="loading-screen" role="status" aria-live="polite">
        <div class="loading-intro">
          ${WORKTREE_LABEL ? `<p class="hub-worktree-badge loading-worktree-badge">WT ${escapeHtml(WORKTREE_LABEL)}</p>` : ''}
          <img class="loading-intro-logo" src="${brandVxUrl}" alt="" />
          <p class="loading-intro-brand">VouchX</p>
          <h1>Loading verification hub</h1>
          <div class="loading-bar" aria-hidden="true"><span></span></div>
        </div>
      </div>
      <div data-el="main" class="hub-main hidden">
        <section class="hub-surface">
          <header class="hub-hero">
            <div class="hub-hero-bar">
              <div class="hub-brand">
                <div class="hub-brand-mark">
                  <img
                    data-el="brand-logo"
                    class="hub-brand-logo hidden"
                    src=""
                    alt="VouchX logo"
                  />
                </div>
                <p class="hub-brand-name">VouchX</p>
              </div>
              <div class="hub-hero-actions">
                <div data-el="mod-panel-group" class="hub-mod-action hidden">
                  <button data-el="mod-panel-btn" class="btn-secondary hub-toolbar-btn" type="button">Mod Panel</button>
                  <span data-el="pending-badge" class="badge hub-mod-pip hidden"></span>
                </div>
              </div>
            </div>

            <h1 data-el="command-title" class="hub-headline">Review the instructions, then submit your verification.</h1>
            <p data-el="info-msg" class="info-msg hidden"></p>
            <section data-el="restricted-state" class="hub-state-panel hidden" aria-live="polite">
              <div data-el="restricted-icon" class="hub-state-icon" aria-hidden="true"></div>
              <div class="hub-state-copy">
                <h2 data-el="restricted-title" class="hub-state-title"></h2>
                <p data-el="restricted-summary" class="hub-state-summary"></p>
                <p data-el="restricted-context" class="hub-state-context hidden"></p>
              </div>
            </section>

            <ol data-el="hub-flow" class="hub-flow hub-flow-hub hidden" aria-label="Verification steps">
              <li class="hub-flow-step"><span class="hub-flow-bar"></span><span class="hub-flow-label"><span class="hub-flow-num">1</span>Review instructions</span></li>
              <li class="hub-flow-step"><span class="hub-flow-bar"></span><span class="hub-flow-label"><span class="hub-flow-num">2</span>Submit photos</span></li>
              <li class="hub-flow-step"><span class="hub-flow-bar"></span><span class="hub-flow-label"><span class="hub-flow-num">3</span>Mod review</span></li>
              <li data-el="participation-step" class="hub-flow-step hidden">
                <span class="hub-flow-bar"></span>
                <span class="hub-flow-label">
                  <details data-el="participation-step-help" class="hub-flow-help hub-flow-num-help">
                    <summary class="hub-flow-num hub-flow-num-trigger" aria-label="Explain participation requirement">4</summary>
                    <div data-el="participation-step-tooltip" class="hub-flow-tooltip" role="note"></div>
                  </details>
                  <span data-el="participation-step-label">Participation unlocked</span>
                </span>
              </li>
            </ol>

            <div class="hub-meta">
              <p data-el="meta-username" class="meta"></p>
              <p data-el="meta-subreddit" class="meta"></p>
            </div>

            <div data-el="action-row" class="row hub-action-dock"></div>
          </header>

          <div data-el="developer-panel" class="hub-developer-launch hidden">
            <button data-el="developer-open-btn" class="btn-secondary hub-developer-open-btn" type="button">
              <span class="hub-kicker">Developer Console</span>
            </button>
          </div>

          <div data-el="developer-modal" class="hub-modal hub-developer-modal hidden">
            <div class="hub-modal-card hub-developer-card" role="dialog" aria-modal="true" aria-labelledby="developer-modal-title">
              <div class="hub-developer-modal-head">
                <h2 id="developer-modal-title" class="hub-modal-title">Developer Console</h2>
                <button data-el="developer-close-btn" class="hub-developer-close" type="button" aria-label="Close developer console">&times;</button>
              </div>
              <div class="hub-developer-tabs" role="tablist">
                <button data-el="developer-tab-broadcast" class="hub-developer-tab is-active" type="button" role="tab" aria-selected="true">Broadcast Modmail</button>
                <button data-el="developer-tab-blocklist" class="hub-developer-tab" type="button" role="tab" aria-selected="false">Global Blocklist</button>
              </div>

              <section data-el="developer-broadcast-tab" class="hub-developer-tabpanel" role="tabpanel">
                <div class="hub-developer-copy">
                  <h3>Send a modmail to every installation</h3>
                  <p class="meta">
                    Publishing writes to the broadcast log on r/<span data-el="broadcast-host">vouchx</span>. Each
                    installation polls hourly and delivers the message to its own modmail as a mod notification,
                    self-selecting by app version. Use <code>&#123;&#123;subreddit&#125;&#125;</code> to insert each
                    community's name.
                  </p>
                </div>
                <p data-el="broadcast-host-note" class="hub-developer-warning hidden"></p>
                <p data-el="broadcast-pointer-note" class="hub-developer-warning hidden"></p>
                <div data-el="broadcast-compose" class="hub-developer-stack">
                  <div>
                    <p class="hub-developer-label">Type</p>
                    <div class="hub-broadcast-type" role="radiogroup" aria-label="Broadcast type">
                      <label class="hub-broadcast-type-option">
                        <input data-el="broadcast-type-announcement" type="radio" name="broadcast-type" value="announcement" checked />
                        <span class="hub-broadcast-type-text">
                          <span class="hub-broadcast-type-name">App Announcement</span>
                          <span class="hub-broadcast-type-desc">Opt-out &mdash; subreddits that turned off app announcements won't receive it.</span>
                        </span>
                      </label>
                      <label class="hub-broadcast-type-option">
                        <input data-el="broadcast-type-notification" type="radio" name="broadcast-type" value="notification" />
                        <span class="hub-broadcast-type-text">
                          <span class="hub-broadcast-type-name">Notification</span>
                          <span class="hub-broadcast-type-desc">Always delivered, regardless of a subreddit's announcement setting.</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <p class="hub-developer-label">Subject</p>
                    <input
                      data-el="broadcast-subject"
                      class="hub-developer-input"
                      type="text"
                      maxlength="100"
                      placeholder="Heads up for {{subreddit}}"
                      autocomplete="off"
                      spellcheck="false"
                    />
                  </div>
                  <div>
                    <p class="hub-developer-label">Message &mdash; Markdown supported</p>
                    <div data-el="broadcast-format-toolbar" class="hub-md-toolbar" aria-label="Message formatting">
                      <button class="hub-md-btn" type="button" data-md-action="bold" title="Bold" aria-label="Bold">B</button>
                      <button class="hub-md-btn hub-md-btn-italic" type="button" data-md-action="italic" title="Italic" aria-label="Italic">i</button>
                      <button class="hub-md-btn" type="button" data-md-action="link" title="Link" aria-label="Insert link">Link</button>
                      <button class="hub-md-btn" type="button" data-md-action="quote" title="Quote" aria-label="Quote">Quote</button>
                      <button class="hub-md-btn" type="button" data-md-action="heading-1" title="Heading 1" aria-label="Heading 1">H1</button>
                      <button class="hub-md-btn" type="button" data-md-action="heading-2" title="Heading 2" aria-label="Heading 2">H2</button>
                      <button class="hub-md-btn" type="button" data-md-action="heading-3" title="Heading 3" aria-label="Heading 3">H3</button>
                      <button class="hub-md-btn" type="button" data-md-action="bullet-list" title="Bullet list" aria-label="Bullet list">List</button>
                      <button class="hub-md-btn" type="button" data-md-action="numbered-list" title="Numbered list" aria-label="Numbered list">1. List</button>
                    </div>
                    <textarea
                      data-el="broadcast-body"
                      class="hub-developer-textarea"
                      rows="6"
                      placeholder="Write your announcement..."
                      spellcheck="false"
                    ></textarea>
                    <div class="row">
                      <button data-el="broadcast-insert-token" class="btn-secondary" type="button">Insert {{subreddit}}</button>
                      <button data-el="broadcast-preview-toggle" class="btn-secondary" type="button">Preview</button>
                    </div>
                  </div>
                  <div data-el="broadcast-preview" class="hub-developer-preview hidden">
                    <p class="hub-developer-label">Preview</p>
                    <p data-el="broadcast-preview-subject" class="hub-developer-preview-subject"></p>
                    <div data-el="broadcast-preview-body" class="markdown-body"></div>
                  </div>
                  <div>
                    <p class="hub-developer-label">Only send to installations below version (optional)</p>
                    <input
                      data-el="broadcast-max-version"
                      class="hub-developer-input"
                      type="text"
                      placeholder="e.g. 1.4.0 — leave blank to reach all"
                      autocomplete="off"
                      spellcheck="false"
                    />
                  </div>
                  <div data-el="broadcast-error" class="hub-developer-warning hidden"></div>
                  <div class="row">
                    <button data-el="broadcast-test-btn" class="btn-secondary" type="button">Send test to this subreddit</button>
                    <button data-el="broadcast-send-btn" class="btn-primary" type="button">Publish broadcast</button>
                  </div>
                </div>
                <div class="hub-developer-history">
                  <p class="hub-developer-label">Recent broadcasts</p>
                  <div data-el="broadcast-history-list" class="hub-developer-list"></div>
                  <p data-el="broadcast-history-empty" class="meta hidden">No broadcasts published yet.</p>
                </div>
              </section>

              <section data-el="developer-blocklist-tab" class="hub-developer-tabpanel hidden" role="tabpanel">
                <div class="hub-developer-copy">
                  <h3>Global blocklist</h3>
                  <p class="meta">
                    This editor is read-only for app settings. Add or remove usernames here, then copy the updated value into the Devvit CLI.
                  </p>
                </div>
                <div class="hub-developer-stack">
                  <div>
                    <p class="hub-developer-label">Currently blocked</p>
                    <div data-el="developer-current-list" class="hub-developer-list"></div>
                    <p data-el="developer-empty" class="meta hidden">No usernames are currently blocked app-wide.</p>
                  </div>
                  <div>
                    <p class="hub-developer-label">Add one username</p>
                    <div class="hub-developer-input-row">
                      <input
                        data-el="developer-add-input"
                        class="hub-developer-input"
                        type="text"
                        placeholder="u/example_user"
                        autocomplete="off"
                        spellcheck="false"
                      />
                      <button data-el="developer-add-btn" class="btn-secondary" type="button">Add</button>
                    </div>
                  </div>
                  <div>
                    <p class="hub-developer-label">Add multiple usernames</p>
                    <textarea
                      data-el="developer-bulk-input"
                      class="hub-developer-textarea"
                      rows="4"
                      placeholder="u/test_user1&#10;test_user2, test_user3"
                      spellcheck="false"
                    ></textarea>
                    <div class="row">
                      <button data-el="developer-bulk-btn" class="btn-secondary" type="button">Add Pasted List</button>
                      <button data-el="developer-reset-btn" class="btn-secondary" type="button">Reset to Current</button>
                    </div>
                  </div>
                  <div data-el="developer-invalid" class="hub-developer-warning hidden"></div>
                  <p data-el="developer-draft-status" class="hub-developer-status"></p>
                  <div>
                    <p class="hub-developer-label">Commands to paste into Devvit CLI</p>
                    <textarea
                      data-el="developer-canonical-output"
                      class="hub-developer-textarea hub-developer-output"
                      rows="10"
                      readonly
                    ></textarea>
                    <div class="row">
                      <button data-el="developer-copy-btn" class="btn-primary" type="button">Copy Terminal Commands</button>
                    </div>
                  </div>
                  <div class="hub-developer-instructions">
                    <p class="hub-developer-label">Apply the change</p>
                    <p class="meta">1. Paste the copied commands into your terminal.</p>
                    <p class="meta">2. The populated blocklist chunks are updated first, and the final line updates the active chunk count.</p>
                    <p class="meta">3. Refresh the app to confirm the updated list.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <footer data-el="legal-links" class="legal-links hidden"></footer>
        </section>
      </div>

      <div data-el="submit-warning-modal" class="hub-modal hidden">
        <div class="hub-modal-card">
          <h2>Before You Submit</h2>
          <p class="meta">
            You must agree to each statement below before the upload form will open.
          </p>
          <div data-el="submit-warning-list" class="warning-checklist"></div>
          <div data-el="submit-warning-links" class="legal-links legal-links-modal hidden"></div>
          <div class="row">
            <button data-el="submit-warning-cancel" class="btn-secondary" type="button">Cancel</button>
            <button data-el="submit-warning-continue" class="btn-primary" type="button">Continue to Upload</button>
          </div>
        </div>
      </div>

      <div data-el="photo-instructions-review-modal" class="hub-modal hub-confirmation-modal hidden">
        <div class="hub-modal-card" role="dialog" aria-modal="true" aria-labelledby="photo-instructions-review-title">
          <h2 id="photo-instructions-review-title">Review photo instructions?</h2>
          <p class="meta">
            Make sure your photos follow the community’s verification requirements before submitting.
          </p>
          <label class="warning-check hub-photo-instructions-review-check">
            <input data-el="photo-instructions-review-acknowledgement" type="checkbox" />
            <span>I have reviewed the instructions and my submission follows them.</span>
          </label>
          <div class="row">
            <button data-el="photo-instructions-review-view" class="btn-secondary" type="button">View Instructions</button>
            <button data-el="photo-instructions-review-continue" class="btn-primary" type="button" disabled>Continue to Submit</button>
          </div>
        </div>
      </div>

      <div data-el="photo-instructions-modal" class="hub-modal hidden">
        <div class="hub-modal-card hub-photo-card">
          <ol data-el="photo-instructions-flow" class="hub-flow" aria-label="Verification steps">
            <li class="hub-flow-step is-current">
              <span class="hub-flow-bar"></span>
              <span class="hub-flow-label"><span class="hub-flow-num">1</span>Review instructions</span>
            </li>
            <li class="hub-flow-step">
              <span class="hub-flow-bar"></span>
              <span class="hub-flow-label"><span class="hub-flow-num">2</span>Submit photos</span>
            </li>
            <li class="hub-flow-step">
              <span class="hub-flow-bar"></span>
              <span class="hub-flow-label"><span class="hub-flow-num">3</span>Mod review</span>
            </li>
            <li data-el="photo-instructions-participation-step" class="hub-flow-step hidden">
              <span class="hub-flow-bar"></span>
              <span class="hub-flow-label">
                <details data-el="photo-instructions-participation-step-help" class="hub-flow-help hub-flow-num-help">
                  <summary class="hub-flow-num hub-flow-num-trigger" aria-label="Explain participation requirement">4</summary>
                  <div data-el="photo-instructions-participation-step-tooltip" class="hub-flow-tooltip" role="note"></div>
                </details>
                <span data-el="photo-instructions-participation-step-label">Participation unlocked</span>
              </span>
            </li>
          </ol>
          <p data-el="photo-instructions-eyebrow" class="hub-photo-eyebrow">Step 1 of 3</p>
          <h2 data-el="photo-instructions-title">Photo Requirements</h2>
          <p data-el="photo-instructions-subtitle" class="meta">
            Review these instructions carefully before submitting your photos.
          </p>
          <div
            data-el="photo-instructions-language-toggle"
            class="hub-language-switcher hidden"
            role="group"
            aria-label="Instruction language"
          ></div>
          <div data-el="photo-instructions-scroll-shell" class="hub-scroll-shell" data-scroll-overflow="false" data-scroll-bottom="true">
            <div data-el="photo-instructions-body" class="markdown-body hub-modal-copy"></div>
            <div data-el="photo-instructions-scroll-hint" class="hub-scroll-hint hidden" aria-hidden="true">Scroll Down ↓</div>
          </div>
          <div class="row hub-photo-actions">
            <button data-el="photo-instructions-continue" class="btn-primary hidden" type="button">Continue to Submission</button>
            <button data-el="photo-instructions-close" class="btn-secondary" type="button">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    loadingScreen: root.querySelector('[data-el="loading"]'),
    mainContent: root.querySelector('[data-el="main"]'),
    brandLogo: root.querySelector('[data-el="brand-logo"]'),
    metaUsername: root.querySelector('[data-el="meta-username"]'),
    metaSubreddit: root.querySelector('[data-el="meta-subreddit"]'),
    commandTitle: root.querySelector('[data-el="command-title"]'),
    pendingBadge: root.querySelector('[data-el="pending-badge"]'),
    modPanelBtn: root.querySelector('[data-el="mod-panel-btn"]'),
    modPanelGroup: root.querySelector('[data-el="mod-panel-group"]'),
    infoMsg: root.querySelector('[data-el="info-msg"]'),
    restrictedState: root.querySelector('[data-el="restricted-state"]'),
    restrictedIcon: root.querySelector('[data-el="restricted-icon"]'),
    restrictedTitle: root.querySelector('[data-el="restricted-title"]'),
    restrictedSummary: root.querySelector('[data-el="restricted-summary"]'),
    restrictedContext: root.querySelector('[data-el="restricted-context"]'),
    hubFlow: root.querySelector('[data-el="hub-flow"]'),
    participationStep: root.querySelector('[data-el="participation-step"]'),
    participationStepLabel: root.querySelector('[data-el="participation-step-label"]'),
    participationStepHelp: root.querySelector('[data-el="participation-step-help"]'),
    participationStepTooltip: root.querySelector('[data-el="participation-step-tooltip"]'),
    actionRow: root.querySelector('[data-el="action-row"]'),
    developerPanel: root.querySelector('[data-el="developer-panel"]'),
    developerCurrentList: root.querySelector('[data-el="developer-current-list"]'),
    developerEmpty: root.querySelector('[data-el="developer-empty"]'),
    developerAddInput: root.querySelector('[data-el="developer-add-input"]'),
    developerAddBtn: root.querySelector('[data-el="developer-add-btn"]'),
    developerBulkInput: root.querySelector('[data-el="developer-bulk-input"]'),
    developerBulkBtn: root.querySelector('[data-el="developer-bulk-btn"]'),
    developerResetBtn: root.querySelector('[data-el="developer-reset-btn"]'),
    developerInvalid: root.querySelector('[data-el="developer-invalid"]'),
    developerDraftStatus: root.querySelector('[data-el="developer-draft-status"]'),
    developerCanonicalOutput: root.querySelector('[data-el="developer-canonical-output"]'),
    developerCopyBtn: root.querySelector('[data-el="developer-copy-btn"]'),
    developerOpenBtn: root.querySelector('[data-el="developer-open-btn"]'),
    developerModal: root.querySelector('[data-el="developer-modal"]'),
    developerCloseBtn: root.querySelector('[data-el="developer-close-btn"]'),
    developerTabBroadcast: root.querySelector('[data-el="developer-tab-broadcast"]'),
    developerTabBlocklist: root.querySelector('[data-el="developer-tab-blocklist"]'),
    developerBroadcastTab: root.querySelector('[data-el="developer-broadcast-tab"]'),
    developerBlocklistTab: root.querySelector('[data-el="developer-blocklist-tab"]'),
    broadcastHost: root.querySelector('[data-el="broadcast-host"]'),
    broadcastHostNote: root.querySelector('[data-el="broadcast-host-note"]'),
    broadcastPointerNote: root.querySelector('[data-el="broadcast-pointer-note"]'),
    broadcastCompose: root.querySelector('[data-el="broadcast-compose"]'),
    broadcastTypeAnnouncement: root.querySelector('[data-el="broadcast-type-announcement"]'),
    broadcastTypeNotification: root.querySelector('[data-el="broadcast-type-notification"]'),
    broadcastFormatToolbar: root.querySelector('[data-el="broadcast-format-toolbar"]'),
    broadcastSubject: root.querySelector('[data-el="broadcast-subject"]'),
    broadcastBody: root.querySelector('[data-el="broadcast-body"]'),
    broadcastMaxVersion: root.querySelector('[data-el="broadcast-max-version"]'),
    broadcastInsertToken: root.querySelector('[data-el="broadcast-insert-token"]'),
    broadcastPreviewToggle: root.querySelector('[data-el="broadcast-preview-toggle"]'),
    broadcastPreview: root.querySelector('[data-el="broadcast-preview"]'),
    broadcastPreviewSubject: root.querySelector('[data-el="broadcast-preview-subject"]'),
    broadcastPreviewBody: root.querySelector('[data-el="broadcast-preview-body"]'),
    broadcastError: root.querySelector('[data-el="broadcast-error"]'),
    broadcastTestBtn: root.querySelector('[data-el="broadcast-test-btn"]'),
    broadcastSendBtn: root.querySelector('[data-el="broadcast-send-btn"]'),
    broadcastHistoryList: root.querySelector('[data-el="broadcast-history-list"]'),
    broadcastHistoryEmpty: root.querySelector('[data-el="broadcast-history-empty"]'),
    legalLinks: root.querySelector('[data-el="legal-links"]'),
    submitWarningModal: root.querySelector('[data-el="submit-warning-modal"]'),
    submitWarningList: root.querySelector('[data-el="submit-warning-list"]'),
    submitWarningLinks: root.querySelector('[data-el="submit-warning-links"]'),
    submitWarningCancel: root.querySelector('[data-el="submit-warning-cancel"]'),
    submitWarningContinue: root.querySelector('[data-el="submit-warning-continue"]'),
    photoInstructionsReviewModal: root.querySelector('[data-el="photo-instructions-review-modal"]'),
    photoInstructionsReviewAcknowledgement: root.querySelector(
      '[data-el="photo-instructions-review-acknowledgement"]'
    ),
    photoInstructionsReviewView: root.querySelector('[data-el="photo-instructions-review-view"]'),
    photoInstructionsReviewContinue: root.querySelector('[data-el="photo-instructions-review-continue"]'),
    photoInstructionsModal: root.querySelector('[data-el="photo-instructions-modal"]'),
    photoInstructionsFlow: root.querySelector('[data-el="photo-instructions-flow"]'),
    photoInstructionsEyebrow: root.querySelector('[data-el="photo-instructions-eyebrow"]'),
    photoInstructionsParticipationStep: root.querySelector('[data-el="photo-instructions-participation-step"]'),
    photoInstructionsParticipationStepLabel: root.querySelector(
      '[data-el="photo-instructions-participation-step-label"]'
    ),
    photoInstructionsParticipationStepHelp: root.querySelector('[data-el="photo-instructions-participation-step-help"]'),
    photoInstructionsParticipationStepTooltip: root.querySelector(
      '[data-el="photo-instructions-participation-step-tooltip"]'
    ),
    photoInstructionsTitle: root.querySelector('[data-el="photo-instructions-title"]'),
    photoInstructionsSubtitle: root.querySelector('[data-el="photo-instructions-subtitle"]'),
    photoInstructionsLanguageToggle: root.querySelector('[data-el="photo-instructions-language-toggle"]'),
    photoInstructionsScrollShell: root.querySelector('[data-el="photo-instructions-scroll-shell"]'),
    photoInstructionsBody: root.querySelector('[data-el="photo-instructions-body"]'),
    photoInstructionsScrollHint: root.querySelector('[data-el="photo-instructions-scroll-hint"]'),
    photoInstructionsContinue: root.querySelector('[data-el="photo-instructions-continue"]'),
    photoInstructionsClose: root.querySelector('[data-el="photo-instructions-close"]'),
  };
}

function showToast(text, tone = 'info') {
  devvitShowToast({
    text,
    appearance: tone === 'success' ? 'success' : 'neutral',
  });
}

function sanitizeUserFacingErrorText(message, fallback = 'Request failed. Please retry.') {
  const normalized = typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : '';
  if (!normalized) {
    return fallback;
  }
  const lower = normalized.toLowerCase();
  if (
    lower.includes('<body') ||
    lower.includes('<style') ||
    lower.includes('oauth.reddit.com') ||
    (lower.includes('http status 403') && lower.includes('forbidden'))
  ) {
    return fallback;
  }
  return normalized;
}

async function requestJson(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      typeof payload.error === 'string' && payload.error
        ? sanitizeUserFacingErrorText(payload.error)
        : `Request failed: ${response.status}`;
    throw new Error(errorMessage);
  }
  return payload;
}

function applyTheme(resolvedTheme) {
  if (!resolvedTheme || typeof resolvedTheme !== 'object') {
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tokens = prefersDark ? resolvedTheme.dark : resolvedTheme.light;
  if (!tokens) {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty('--primary', tokens.primary);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--success', tokens.success);
  root.style.setProperty('--danger', tokens.danger);
  root.style.setProperty('--bg', tokens.bg);
  root.style.setProperty('--card', tokens.surface);
  root.style.setProperty('--text', tokens.text);
  root.style.setProperty('--muted', tokens.mutedText);
  root.style.setProperty('--line', tokens.border);
}

function isManualSource(source) {
  return typeof source === 'string' && MANUAL_SOURCE_MARKERS.some((marker) => source.includes(marker));
}

function isAwaitingFlairPropagation(state) {
  return Boolean(state && state.viewerAwaitingFlairPropagation === true);
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatDateLong(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  try {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString();
  }
}

function makeButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeExternalUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function createExternalLink(item, extraClassName = '') {
  const link = document.createElement('a');
  link.className = ['legal-link', extraClassName].filter(Boolean).join(' ');
  if (!item.url) {
    link.classList.add('legal-link-disabled');
  }
  link.href = item.url || '#';
  link.textContent = item.label;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (!item.url) {
      showToast(`${item.label} URL is not configured.`, 'error');
      return;
    }
    navigateTo(item.url);
  });
  return link;
}

async function copyTextToClipboard(value) {
  const text = String(value ?? '');
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'readonly');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  if (!copied) {
    throw new Error('Copy failed. Select the value manually and copy it.');
  }
}

function escapeSingleQuotedShellArg(value) {
  return String(value ?? '').replaceAll("'", "'\"'\"'");
}

function formatDenyReasonSlot(reasonId) {
  const match = String(reasonId || '').match(/^reason_(\d+)$/);
  return match ? `Reason ${match[1]}` : String(reasonId || '').replaceAll('_', ' ');
}

function getDenyReasonLabel(state, reasonId) {
  if (!state || !state.config || !Array.isArray(state.config.denyReasons)) {
    return formatDenyReasonSlot(reasonId);
  }
  const match = state.config.denyReasons.find((item) => item && item.id === reasonId);
  const label = match && typeof match.label === 'string' ? match.label.trim() : '';
  return label || formatDenyReasonSlot(reasonId);
}

function getVerificationRequirementLabel(config) {
  const requiredToPost = config?.verificationRequiredToPost === true;
  const requiredToComment = config?.verificationRequiredToComment === true;
  if (requiredToPost && requiredToComment) {
    return 'Participation unlocked';
  }
  if (requiredToPost) {
    return 'Posting unlocked';
  }
  if (requiredToComment) {
    return 'Commenting unlocked';
  }
  return '';
}

function getVerificationRequirementTooltip(config) {
  const requiredToPost = config?.verificationRequiredToPost === true;
  const requiredToComment = config?.verificationRequiredToComment === true;
  if (requiredToPost && requiredToComment) {
    return 'Verification is required to post and comment in this community.';
  }
  if (requiredToPost) {
    return 'Verification is required to post in this community.';
  }
  if (requiredToComment) {
    return 'Verification is required to comment in this community.';
  }
  return '';
}

function getVerificationRequirementAccessText(config) {
  const requiredToPost = config?.verificationRequiredToPost === true;
  const requiredToComment = config?.verificationRequiredToComment === true;
  if (requiredToPost && requiredToComment) {
    return 'posting and commenting access';
  }
  if (requiredToPost) {
    return 'posting access';
  }
  if (requiredToComment) {
    return 'commenting access';
  }
  return '';
}

function syncVerificationRequirementStep(config, stepRefs) {
  const participationLabel = getVerificationRequirementLabel(config);
  // Step 4 is only relevant when moderators have configured a participation
  // requirement (post / comment unlock). Otherwise it's hidden entirely and the
  // timeline is a clean 3-step journey ending at "Mod review".
  if (stepRefs.step) {
    stepRefs.step.classList.toggle('hidden', !participationLabel);
  }
  if (stepRefs.label) {
    stepRefs.label.textContent = participationLabel || 'Participation unlocked';
  }
  if (stepRefs.tooltip) {
    stepRefs.tooltip.textContent = getVerificationRequirementTooltip(config);
  }
  if (!participationLabel && stepRefs.help?.open) {
    stepRefs.help.open = false;
  }
  return participationLabel;
}

function renderInlineMarkdown(value) {
  const replacements = [];
  const storeReplacement = (html) => {
    const token = `%%MDTOKEN${replacements.length}%%`;
    replacements.push(html);
    return token;
  };

  let source = String(value ?? '');
  source = source.replace(/`([^`]+)`/g, (_match, code) => storeReplacement(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const normalized = normalizeExternalUrl(url);
    if (!normalized) {
      return label;
    }
    return storeReplacement(
      `<a href="${escapeHtml(normalized)}" data-external-url="${escapeHtml(normalized)}">${escapeHtml(label)}</a>`
    );
  });

  let html = escapeHtml(source);
  html = html.replace(/\*\*\*([^*][\s\S]*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[\s(])\*([^*\n][\s\S]*?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[\s(])_([^_\n][\s\S]*?)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

  return html.replace(/%%MDTOKEN(\d+)%%/g, (_match, index) => replacements[Number(index)] ?? '');
}

function renderMarkdown(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) {
    return '<p class="markdown-empty">No photo instructions are available yet.</p>';
  }

  const html = [];
  const lines = source.split('\n');
  let paragraphLines = [];
  let listType = '';

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    html.push(`<p>${renderInlineMarkdown(paragraphLines.join('\n')).replace(/\n/g, '<br />')}</p>`);
    paragraphLines = [];
  };

  const closeList = () => {
    if (!listType) {
      return;
    }
    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = Math.min(6, headingMatch[1].length + 2);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      html.push(`<blockquote><p>${renderInlineMarkdown(quoteMatch[1])}</p></blockquote>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    if (listType) {
      closeList();
    }
    paragraphLines.push(line);
  }

  flushParagraph();
  closeList();
  return html.join('');
}

function formatPendingTurnaroundDays(days) {
  const normalizedDays = Number.isFinite(Number(days)) ? Math.max(0, Math.trunc(Number(days))) : 0;
  return `${normalizedDays} ${normalizedDays === 1 ? 'day' : 'days'}`;
}

function formatRedditUsernameDisplay(username) {
  const normalizedUsername = String(username || '').trim();
  return normalizedUsername ? `u/${normalizedUsername}` : '';
}

function formatLocalTodayDisplay() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

function renderInstructionTemplate(value, state) {
  const replacements = {
    username: formatRedditUsernameDisplay(state?.viewerUsername),
    subreddit: String(state?.subredditName || '').trim(),
    days: formatPendingTurnaroundDays(state?.config?.pendingTurnaroundDays),
    today: formatLocalTodayDisplay(),
  };

  return String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawKey) => {
    const rawPlaceholderKey = String(rawKey || '').trim();
    const capsMatch = rawPlaceholderKey.match(/^caps\s*:\s*(.+)$/i);
    const shouldUppercase = Boolean(capsMatch);
    const normalizedKey = String(capsMatch ? capsMatch[1] : rawPlaceholderKey)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const replacement = replacements[normalizedKey] ?? '';
    return shouldUppercase ? replacement.toLocaleUpperCase() : replacement;
  });
}

function getPhotoInstructionContent(config, language) {
  const option = PHOTO_INSTRUCTION_LANGUAGE_OPTIONS.find((item) => item.id === language);
  if (!option) {
    return '';
  }
  return String(config?.[option.configField] || '').trim();
}

function getAvailablePhotoInstructionLanguages(state) {
  return PHOTO_INSTRUCTION_LANGUAGE_OPTIONS.filter((option) =>
    Boolean(getPhotoInstructionContent(state?.config, option.id))
  );
}

function getDefaultPhotoInstructionLanguage(state) {
  const availableLanguages = getAvailablePhotoInstructionLanguages(state);
  const configuredDefaultLanguage = String(state?.config?.photoInstructionsDefaultLanguage || 'en')
    .trim()
    .toLowerCase();
  if (availableLanguages.some((option) => option.id === configuredDefaultLanguage)) {
    return configuredDefaultLanguage;
  }
  if (availableLanguages.some((option) => option.id === 'en')) {
    return 'en';
  }
  return availableLanguages[0]?.id || 'en';
}

function getPhotoInstructionHeading(language) {
  return PHOTO_INSTRUCTION_LANGUAGE_COPY[language] || PHOTO_INSTRUCTION_LANGUAGE_COPY.en;
}

function hasAnyConfiguredPhotoInstructions(config) {
  return PHOTO_INSTRUCTION_LANGUAGE_OPTIONS.some((option) => Boolean(getPhotoInstructionContent(config, option.id)));
}

function isAndroidWebViewClient() {
  const userAgent = String(navigator.userAgent || '');
  return /android/i.test(userAgent) && (/;\s*wv\)/i.test(userAgent) || /version\/4\.0/i.test(userAgent));
}

function forceExitExpandedView(event) {
  if (!(event instanceof MouseEvent) || !event.isTrusted || event.type !== 'click') {
    throw new Error('Back to Hub requires a trusted click event.');
  }
  emitEffect({
    type: EffectType.EFFECT_WEB_VIEW,
    immersiveMode: {
      immersiveMode: WebViewImmersiveMode.INLINE_MODE,
    },
  });
}

function buildInternalNavigationUrl(targetPath) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(String(targetPath || './hub.html'), currentUrl);
  const mergedParams = new URLSearchParams(currentUrl.search);
  for (const [key, value] of new URLSearchParams(targetUrl.search)) {
    mergedParams.set(key, value);
  }
  targetUrl.search = mergedParams.toString();
  return targetUrl.toString();
}

function normalizeStorageKeyPart(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function persistPhotoInstructionsLaunchMode(mode) {
  try {
    window.localStorage.setItem(
      PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY,
      JSON.stringify({
        mode: mode === 'submit' ? 'submit' : 'view',
        recordedAt: Date.now(),
      })
    );
  } catch (_error) {
    // Best effort only. If storage is unavailable, the dedicated entry defaults to view mode.
  }
}

export function consumePhotoInstructionsLaunchMode() {
  let parsed = null;
  try {
    const raw = window.localStorage.getItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    if (!raw) {
      return 'view';
    }
    window.localStorage.removeItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    parsed = JSON.parse(raw);
  } catch (_error) {
    try {
      window.localStorage.removeItem(PHOTO_INSTRUCTIONS_LAUNCH_STATE_KEY);
    } catch (_removeError) {
      // Ignore cleanup failures.
    }
    return 'view';
  }

  const recordedAt = Number(parsed?.recordedAt || 0);
  if (!recordedAt || Math.abs(Date.now() - recordedAt) > PHOTO_INSTRUCTIONS_LAUNCH_STATE_TTL_MS) {
    return 'view';
  }
  return parsed?.mode === 'submit' ? 'submit' : 'view';
}

export function mountHub(options = {}) {
  const {
    rootId = 'app-root',
    inline = false,
    photoInstructionsOnly = false,
    photoInstructionsLaunchMode = 'view',
  } = options;
  const root = document.getElementById(rootId);
  if (!root) {
    return;
  }

  const refs = createShell(root, inline);
  let hubState = null;
  let hubForms = null;
  let modPanelPath = './mod-panel.html';
  let isBusy = false;
  let moderatorUiRequestInFlight = false;
  let autoRefreshTimerId = 0;
  let realtimeChannel = '';
  let realtimeConnectedChannel = '';
  let realtimeLiveChannel = '';
  let realtimeReconnectTimerId = 0;
  let realtimeRefreshInFlight = false;
  let realtimeRefreshQueued = false;
  let flairPropagationRefreshTimerId = 0;
  let flairPropagationRefreshAttempts = 0;
  let flairPropagationRefreshKey = '';
  let developerPanelDraft = null;
  let photoInstructionsOnlyHandled = false;
  let photoInstructionsReviewPromptOpen = false;
  const howToUseUrl = normalizeExternalUrl(HOW_TO_USE_APP_URL);
  const moderatorQuickStartUrl = normalizeExternalUrl(MODERATOR_QUICK_START_URL);
  const legalLinks = [
    { label: 'Terms and Conditions', url: normalizeExternalUrl(TERMS_AND_CONDITIONS_URL) },
    { label: 'Privacy Policy', url: normalizeExternalUrl(PRIVACY_POLICY_URL) },
    ...(howToUseUrl ? [{ label: 'How to use this app', url: howToUseUrl }] : []),
  ];
  const submitWarningLinks = legalLinks.filter((item) => item.label !== 'How to use this app');

  if (refs.brandLogo) {
    refs.brandLogo.src = brandVxUrl;
    refs.brandLogo.addEventListener('load', () => {
      refs.brandLogo.classList.remove('hidden');
    });
    refs.brandLogo.addEventListener('error', () => {
      refs.brandLogo.classList.add('hidden');
    });
  }

  if (refs.legalLinks) {
    refs.legalLinks.classList.remove('hidden');
    for (const item of legalLinks) {
      refs.legalLinks.appendChild(createExternalLink(item));
    }
  }

  if (refs.submitWarningList) {
    for (const acknowledgement of SUBMIT_ACKNOWLEDGEMENTS) {
      const label = document.createElement('label');
      label.className = 'warning-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.ackKey = acknowledgement.key;
      const text = document.createElement('span');
      text.textContent = acknowledgement.label;
      label.appendChild(input);
      label.appendChild(text);
      refs.submitWarningList.appendChild(label);
    }
  }

  if (refs.submitWarningLinks) {
    refs.submitWarningLinks.classList.remove('hidden');
    for (const item of submitWarningLinks) {
      refs.submitWarningLinks.appendChild(createExternalLink(item));
    }
  }

  if (refs.photoInstructionsBody) {
    refs.photoInstructionsBody.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const link = event.target.closest('a[data-external-url]');
      if (!link) {
        return;
      }
      event.preventDefault();
      const url = String(link.getAttribute('data-external-url') || '').trim();
      if (!url) {
        return;
      }
      navigateTo(url);
    });
  }

  function buildPhotoInstructionsReadStateKey() {
    return `${PHOTO_INSTRUCTIONS_READ_STATE_PREFIX}${normalizeStorageKeyPart(
      hubState?.subredditName,
      'unknown-subreddit'
    )}:${normalizeStorageKeyPart(hubState?.viewerUsername, 'unknown-user')}`;
  }

  function hasRecentPhotoInstructionsRead() {
    if (!hubState?.viewerUsername || !hubState?.subredditName) {
      return false;
    }
    const storageKey = buildPhotoInstructionsReadStateKey();
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return false;
      }
      parsed = JSON.parse(raw);
    } catch (_error) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (_removeError) {
        // Ignore cleanup failures.
      }
      return false;
    }

    const acknowledgedAt = Number(parsed?.acknowledgedAt || 0);
    if (!acknowledgedAt || Date.now() - acknowledgedAt > PHOTO_INSTRUCTIONS_READ_TTL_MS) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (_removeError) {
        // Ignore cleanup failures.
      }
      return false;
    }
    return true;
  }

  function markPhotoInstructionsRead() {
    if (!hubState?.viewerUsername || !hubState?.subredditName) {
      return;
    }
    try {
      window.localStorage.setItem(
        buildPhotoInstructionsReadStateKey(),
        JSON.stringify({
          acknowledgedAt: Date.now(),
        })
      );
    } catch (_error) {
      // Best effort only.
    }
  }

  function shouldUseAndroidPhotoInstructionsStep() {
    return photoInstructionsOnly || isAndroidWebViewClient();
  }

  function setPhotoInstructionsPresentation(isOpen) {
    const useAndroidPhotoInstructionsStep = shouldUseAndroidPhotoInstructionsStep();
    if (refs.photoInstructionsModal) {
      refs.photoInstructionsModal.classList.toggle('hub-photo-instructions-step', useAndroidPhotoInstructionsStep);
    }
    document.body.classList.toggle(
      'hub-photo-instructions-step-open',
      useAndroidPhotoInstructionsStep && isOpen
    );
  }

  function updatePhotoInstructionsScrollAffordance() {
    if (!refs.photoInstructionsBody || !refs.photoInstructionsScrollShell) {
      return;
    }
    const scrollTarget = shouldUseAndroidPhotoInstructionsStep()
      ? refs.photoInstructionsModal
      : refs.photoInstructionsBody;
    if (!scrollTarget) {
      return;
    }
    const overflow = scrollTarget.scrollHeight - scrollTarget.clientHeight > 8;
    const atBottom =
      scrollTarget.scrollTop + scrollTarget.clientHeight >=
      scrollTarget.scrollHeight - 6;
    const nearTop = scrollTarget.scrollTop <= 10;
    refs.photoInstructionsScrollShell.dataset.scrollOverflow = overflow ? 'true' : 'false';
    refs.photoInstructionsScrollShell.dataset.scrollBottom = atBottom ? 'true' : 'false';
    if (refs.photoInstructionsScrollHint) {
      refs.photoInstructionsScrollHint.classList.toggle(
        'hidden',
        !overflow || !nearTop
      );
    }
  }

  function renderPhotoInstructionsLanguageSwitcher(availableLanguages, activeLanguage, onSelect) {
    if (!refs.photoInstructionsLanguageToggle) {
      return;
    }
    refs.photoInstructionsLanguageToggle.innerHTML = '';
    refs.photoInstructionsLanguageToggle.classList.toggle('hidden', availableLanguages.length <= 1);
    if (availableLanguages.length <= 1) {
      return;
    }

    for (const [index, option] of availableLanguages.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hub-language-switcher-btn';
      button.textContent = option.label;
      button.setAttribute('aria-pressed', option.id === activeLanguage ? 'true' : 'false');
      if (option.id === activeLanguage) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', () => {
        if (option.id !== activeLanguage) {
          onSelect(option.id);
        }
      });
      refs.photoInstructionsLanguageToggle.appendChild(button);

      if (index < availableLanguages.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'hub-language-switcher-separator';
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = '|';
        refs.photoInstructionsLanguageToggle.appendChild(separator);
      }
    }
  }

  if (refs.photoInstructionsBody) {
    refs.photoInstructionsBody.addEventListener('scroll', () => {
      updatePhotoInstructionsScrollAffordance();
    });
  }

  if (refs.photoInstructionsModal) {
    refs.photoInstructionsModal.addEventListener('scroll', () => {
      updatePhotoInstructionsScrollAffordance();
    });
  }

  window.addEventListener('resize', () => {
    if (refs.photoInstructionsModal && !refs.photoInstructionsModal.classList.contains('hidden')) {
      updatePhotoInstructionsScrollAffordance();
    }
  });

  function setBusy(next) {
    isBusy = Boolean(next);
    for (const button of root.querySelectorAll('button')) {
      button.disabled = isBusy;
    }
    if (!isBusy && realtimeRefreshQueued && !realtimeRefreshInFlight) {
      realtimeRefreshQueued = false;
      void refreshFromRealtimeSignal();
    }
  }

  function scheduleRealtimeReconnect(channel) {
    if (!channel || channel !== realtimeChannel || realtimeReconnectTimerId) {
      return;
    }
    realtimeReconnectTimerId = window.setTimeout(() => {
      realtimeReconnectTimerId = 0;
      if (channel === realtimeChannel && realtimeConnectedChannel !== channel) {
        connectToRealtimeChannel(channel);
      }
    }, 1500);
  }

  function closeRealtimeSubscription() {
    if (realtimeReconnectTimerId) {
      window.clearTimeout(realtimeReconnectTimerId);
      realtimeReconnectTimerId = 0;
    }
    const connectedChannel = realtimeConnectedChannel;
    realtimeChannel = '';
    realtimeConnectedChannel = '';
    realtimeLiveChannel = '';
    if (connectedChannel) {
      disconnectRealtime(connectedChannel);
    }
  }

  function connectToRealtimeChannel(channel) {
    if (!channel || realtimeConnectedChannel === channel) {
      return;
    }
    try {
      connectRealtime({
        channel,
        onConnect(connectedChannel) {
          if (channel !== realtimeChannel) {
            disconnectRealtime(connectedChannel);
            return;
          }
          realtimeConnectedChannel = connectedChannel;
          realtimeLiveChannel = connectedChannel;
        },
        onDisconnect(disconnectedChannel) {
          if (disconnectedChannel === realtimeConnectedChannel) {
            realtimeConnectedChannel = '';
          }
          if (disconnectedChannel === realtimeLiveChannel) {
            realtimeLiveChannel = '';
          }
          if (disconnectedChannel === realtimeChannel) {
            scheduleRealtimeReconnect(disconnectedChannel);
          }
        },
        onMessage(message) {
          if (!message || typeof message !== 'object' || message.type !== 'refresh') {
            return;
          }
          void refreshFromRealtimeSignal();
        },
      });
      realtimeConnectedChannel = channel;
    } catch (error) {
      console.log(`Realtime subscribe failed: ${error instanceof Error ? error.message : String(error)}`);
      scheduleRealtimeReconnect(channel);
    }
  }

  function syncRealtimeSubscription(nextChannel) {
    const normalized = String(nextChannel || '').trim();
    if (!normalized) {
      closeRealtimeSubscription();
      return;
    }
    if (realtimeReconnectTimerId) {
      window.clearTimeout(realtimeReconnectTimerId);
      realtimeReconnectTimerId = 0;
    }
    if (normalized === realtimeChannel && realtimeConnectedChannel === normalized) {
      return;
    }
    const previousChannel = realtimeConnectedChannel;
    realtimeChannel = normalized;
    realtimeConnectedChannel = '';
    realtimeLiveChannel = '';
    if (previousChannel) {
      disconnectRealtime(previousChannel);
    }
    connectToRealtimeChannel(normalized);
  }

  function clearFlairPropagationRefresh(options = {}) {
    if (flairPropagationRefreshTimerId) {
      window.clearTimeout(flairPropagationRefreshTimerId);
      flairPropagationRefreshTimerId = 0;
    }
    if (options.reset === true) {
      flairPropagationRefreshAttempts = 0;
      flairPropagationRefreshKey = '';
    }
  }

  function syncFlairPropagationRefresh() {
    if (!isAwaitingFlairPropagation(hubState)) {
      clearFlairPropagationRefresh({ reset: true });
      return;
    }

    const nextKey = [
      String(hubState.viewerUsername || ''),
      String(hubState.userLatest?.id || ''),
      String(hubState.userLatest?.reviewedAt || hubState.userLatest?.submittedAt || ''),
    ].join(':');

    if (nextKey !== flairPropagationRefreshKey) {
      flairPropagationRefreshKey = nextKey;
      flairPropagationRefreshAttempts = 0;
      clearFlairPropagationRefresh();
    }

    if (flairPropagationRefreshTimerId || flairPropagationRefreshAttempts >= FLAIR_PROPAGATION_MAX_RETRIES) {
      return;
    }

    flairPropagationRefreshTimerId = window.setTimeout(async () => {
      flairPropagationRefreshTimerId = 0;
      if (!isAwaitingFlairPropagation(hubState)) {
        return;
      }
      if (document.hidden || isBusy) {
        syncFlairPropagationRefresh();
        return;
      }
      flairPropagationRefreshAttempts += 1;
      try {
        applyPayload(await requestJson('/api/hub/state'));
      } catch (error) {
        console.log(`Approval propagation refresh failed: ${error instanceof Error ? error.message : String(error)}`);
        if (isAwaitingFlairPropagation(hubState)) {
          syncFlairPropagationRefresh();
        }
      }
    }, FLAIR_PROPAGATION_REFRESH_INTERVAL_MS);
  }

  async function refreshFromRealtimeSignal() {
    if (!realtimeChannel) {
      return;
    }
    if (isBusy) {
      realtimeRefreshQueued = true;
      return;
    }
    if (realtimeRefreshInFlight) {
      realtimeRefreshQueued = true;
      return;
    }
    realtimeRefreshInFlight = true;
    try {
      applyPayload(await requestJson('/api/hub/state'));
    } catch (error) {
      console.log(`Realtime refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      realtimeRefreshInFlight = false;
      if (realtimeRefreshQueued && !isBusy) {
        realtimeRefreshQueued = false;
        void refreshFromRealtimeSignal();
      }
    }
  }

  async function performAction(path, body = {}, options = {}) {
    const { refreshOnError = null } = options;
    setBusy(true);
    try {
      applyPayload(await requestJson(path, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(message, 'error');
      if (typeof refreshOnError === 'function' && refreshOnError(message)) {
        await refreshState({ silent: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function openSubmitForm(triggerEvent = null) {
    if (!hubForms?.submit) {
      return;
    }
    const shouldShowPhotoInstructionsFirst = Boolean(
      hubState?.config?.showPhotoInstructionsBeforeSubmit && hasAnyConfiguredPhotoInstructions(hubState?.config)
    );
    if (shouldShowPhotoInstructionsFirst) {
      if (shouldUseAndroidPhotoInstructionsStep() && !photoInstructionsOnly) {
        if (!hasRecentPhotoInstructionsRead()) {
          markPhotoInstructionsRead();
          persistPhotoInstructionsLaunchMode('submit');
          if (inline && triggerEvent instanceof MouseEvent) {
            try {
              requestExpandedMode(triggerEvent, 'photoInstructions');
              return;
            } catch (error) {
              showToast(error instanceof Error ? error.message : String(error), 'error');
            }
          }
          window.location.replace(buildInternalNavigationUrl('./photo-instructions.html'));
          return;
        }
        const continueToSubmission = await requestRecentPhotoInstructionsReview();
        if (!continueToSubmission) {
          return;
        }
      } else {
        const continueToSubmission = await requestPhotoInstructionsReview({ requireContinue: true });
        if (!continueToSubmission) {
          return;
        }
      }
    }
    const acknowledgements = await requestSubmitAcknowledgements();
    if (!acknowledgements) {
      return;
    }
    const result = await showForm(hubForms.submit);
    if (!result || result.action !== 'SUBMITTED') {
      return;
    }
    await performAction('/api/hub/submit', {
      ...result.values,
      ...acknowledgements,
    });
  }

  async function openDeleteForm() {
    if (!hubForms?.removeVerification) {
      return;
    }
    const result = await showForm(hubForms.removeVerification);
    if (!result || result.action !== 'SUBMITTED') {
      return;
    }
    await performAction('/api/hub/delete', result.values);
  }

  function requestSubmitAcknowledgements() {
    return new Promise((resolve) => {
      if (
        !refs.submitWarningModal ||
        !refs.submitWarningCancel ||
        !refs.submitWarningContinue ||
        !refs.submitWarningList
      ) {
        resolve(null);
        return;
      }

      const inputs = Array.from(refs.submitWarningList.querySelectorAll('input[type="checkbox"][data-ack-key]'));
      for (const input of inputs) {
        input.checked = false;
      }

      const close = (result) => {
        refs.submitWarningModal.classList.add('hidden');
        refs.submitWarningCancel.removeEventListener('click', onCancel);
        refs.submitWarningContinue.removeEventListener('click', onContinue);
        refs.submitWarningModal.removeEventListener('click', onBackdrop);
        refs.submitWarningContinue.disabled = false;
        refs.submitWarningContinue.title = '';
        resolve(result);
      };

      const onCancel = () => {
        close(null);
      };

      const onContinue = () => {
        const acknowledgementValues = {};
        for (const input of inputs) {
          acknowledgementValues[input.dataset.ackKey] = input.checked;
        }
        if (Object.values(acknowledgementValues).some((value) => !value)) {
          showToast('You must agree to each submission statement before continuing.', 'error');
          return;
        }
        close(acknowledgementValues);
      };

      const onBackdrop = (event) => {
        if (event.target === refs.submitWarningModal) {
          close(null);
        }
      };

      refs.submitWarningCancel.addEventListener('click', onCancel);
      refs.submitWarningContinue.addEventListener('click', onContinue);
      refs.submitWarningModal.addEventListener('click', onBackdrop);
      refs.submitWarningModal.classList.remove('hidden');
      const demoMode = isVouchxHomeSubreddit(hubState?.subredditName ?? '');
      if (demoMode) {
        refs.submitWarningContinue.disabled = true;
        refs.submitWarningContinue.title = 'Verification submissions are disabled in r/vouchx. This subreddit is for demonstration purposes only.';
      }
    });
  }

  function requestRecentPhotoInstructionsReview() {
    return new Promise((resolve) => {
      if (
        photoInstructionsReviewPromptOpen ||
        !refs.photoInstructionsReviewModal ||
        !refs.photoInstructionsReviewAcknowledgement ||
        !refs.photoInstructionsReviewView ||
        !refs.photoInstructionsReviewContinue
      ) {
        resolve(false);
        return;
      }

      photoInstructionsReviewPromptOpen = true;
      refs.photoInstructionsReviewAcknowledgement.checked = false;
      refs.photoInstructionsReviewContinue.disabled = true;

      const close = (continueToSubmission) => {
        refs.photoInstructionsReviewModal.classList.add('hidden');
        refs.photoInstructionsReviewAcknowledgement.removeEventListener('change', onAcknowledgementChange);
        refs.photoInstructionsReviewView.removeEventListener('click', onViewInstructions);
        refs.photoInstructionsReviewContinue.removeEventListener('click', onContinueToSubmit);
        refs.photoInstructionsReviewModal.removeEventListener('click', onBackdrop);
        refs.photoInstructionsReviewAcknowledgement.checked = false;
        refs.photoInstructionsReviewContinue.disabled = true;
        photoInstructionsReviewPromptOpen = false;
        resolve(continueToSubmission);
      };

      const onAcknowledgementChange = () => {
        refs.photoInstructionsReviewContinue.disabled = !refs.photoInstructionsReviewAcknowledgement.checked;
      };

      const onViewInstructions = (event) => {
        markPhotoInstructionsRead();
        close(false);
        openPhotoInstructionsModal(event);
      };

      const onContinueToSubmit = () => {
        if (!refs.photoInstructionsReviewAcknowledgement.checked) {
          return;
        }
        close(true);
      };

      const onBackdrop = (event) => {
        if (event.target === refs.photoInstructionsReviewModal) {
          close(false);
        }
      };

      refs.photoInstructionsReviewAcknowledgement.addEventListener('change', onAcknowledgementChange);
      refs.photoInstructionsReviewView.addEventListener('click', onViewInstructions);
      refs.photoInstructionsReviewContinue.addEventListener('click', onContinueToSubmit);
      refs.photoInstructionsReviewModal.addEventListener('click', onBackdrop);
      refs.photoInstructionsReviewModal.classList.remove('hidden');
    });
  }

  function requestPhotoInstructionsReview(options = {}) {
    const { requireContinue = false, dedicatedView = false } = options;
    return new Promise((resolve) => {
      if (
        !refs.photoInstructionsModal ||
        !refs.photoInstructionsBody ||
        !refs.photoInstructionsClose ||
        !refs.photoInstructionsContinue
      ) {
        resolve(false);
        return;
      }

      const availableLanguages = getAvailablePhotoInstructionLanguages(hubState);
      let selectedLanguage = getDefaultPhotoInstructionLanguage(hubState);
      const renderPhotoInstructionsContent = () => {
        renderPhotoInstructionsFlow(hubState);
        const source = getPhotoInstructionContent(hubState?.config, selectedLanguage);
        const heading = getPhotoInstructionHeading(selectedLanguage);
        if (refs.photoInstructionsTitle) {
          refs.photoInstructionsTitle.textContent = heading.title;
        }
        if (refs.photoInstructionsSubtitle) {
          refs.photoInstructionsSubtitle.textContent = heading.subtitle;
        }
        if (refs.photoInstructionsScrollHint) {
          refs.photoInstructionsScrollHint.textContent = heading.scrollHint;
        }
        refs.photoInstructionsBody.innerHTML = renderMarkdown(renderInstructionTemplate(source, hubState));
        refs.photoInstructionsBody.scrollTop = 0;
        refs.photoInstructionsModal.scrollTop = 0;
        renderPhotoInstructionsLanguageSwitcher(availableLanguages, selectedLanguage, (nextLanguage) => {
          selectedLanguage = nextLanguage;
          renderPhotoInstructionsContent();
          window.requestAnimationFrame(() => {
            updatePhotoInstructionsScrollAffordance();
          });
        });
      };

      renderPhotoInstructionsContent();
      const hideCloseButton = dedicatedView && requireContinue;
      refs.photoInstructionsContinue.classList.toggle('hidden', !requireContinue);
      refs.photoInstructionsClose.classList.toggle('hidden', hideCloseButton);
      refs.photoInstructionsClose.textContent = dedicatedView ? 'Back to Hub' : 'Close';
      setPhotoInstructionsPresentation(true);

      const close = (result, event = null) => {
        if (dedicatedView && event instanceof MouseEvent) {
          try {
            exitExpandedMode(event);
            resolve(result);
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.toLowerCase().includes('already inlined')) {
              showToast(message, 'error');
            }
            try {
              forceExitExpandedView(event);
              resolve(result);
              return;
            } catch (fallbackError) {
              showToast(fallbackError instanceof Error ? fallbackError.message : String(fallbackError), 'error');
            }
          }
        }
        refs.photoInstructionsModal.classList.add('hidden');
        setPhotoInstructionsPresentation(false);
        refs.photoInstructionsClose.removeEventListener('click', onClose);
        refs.photoInstructionsContinue.removeEventListener('click', onContinue);
        refs.photoInstructionsModal.removeEventListener('click', onBackdrop);
        refs.photoInstructionsContinue.classList.add('hidden');
        refs.photoInstructionsClose.classList.remove('hidden');
        refs.photoInstructionsClose.textContent = 'Close';
        if (refs.photoInstructionsLanguageToggle) {
          refs.photoInstructionsLanguageToggle.innerHTML = '';
          refs.photoInstructionsLanguageToggle.classList.add('hidden');
        }
        if (dedicatedView) {
          window.location.replace(buildInternalNavigationUrl('./hub.html'));
        }
        resolve(result);
      };

      const onClose = (event) => {
        close(requireContinue ? false : true, event);
      };

      const onContinue = (event) => {
        close(true, event);
      };

      const onBackdrop = (event) => {
        if (shouldUseAndroidPhotoInstructionsStep()) {
          return;
        }
        if (event.target === refs.photoInstructionsModal) {
          close(requireContinue ? false : true);
        }
      };

      refs.photoInstructionsClose.addEventListener('click', onClose);
      refs.photoInstructionsContinue.addEventListener('click', onContinue);
      refs.photoInstructionsModal.addEventListener('click', onBackdrop);
      refs.photoInstructionsModal.classList.remove('hidden');
      // Wait until the modal is visible so overflow measurements reflect the final layout.
      window.requestAnimationFrame(() => {
        updatePhotoInstructionsScrollAffordance();
      });
    });
  }

  function openPhotoInstructionsModal(event) {
    if (shouldUseAndroidPhotoInstructionsStep() && !photoInstructionsOnly) {
      persistPhotoInstructionsLaunchMode('view');
      if (inline) {
        try {
          if (event instanceof MouseEvent) {
            requestExpandedMode(event, 'photoInstructions');
            return;
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), 'error');
        }
      }
      window.location.replace(buildInternalNavigationUrl('./photo-instructions.html'));
      return;
    }
    void requestPhotoInstructionsReview();
  }

  function createDeveloperPanelDraft(panel) {
    const currentUsernames = Array.isArray(panel?.currentUsernames)
      ? panel.currentUsernames.filter((username) => typeof username === 'string' && username.trim())
      : [];
    return {
      sourceCanonicalValue: String(panel?.canonicalValue || ''),
      sourceInvalidTokens: Array.isArray(panel?.invalidTokens)
        ? panel.invalidTokens.filter((token) => typeof token === 'string' && token.trim())
        : [],
      usernames: parseRedditUsernameList(buildRedditUsernameListCanonicalValue(currentUsernames)).usernames,
      latestInvalidTokens: [],
    };
  }

  function syncDeveloperPanelDraft() {
    if (!hubState?.developerPanel) {
      developerPanelDraft = null;
      return;
    }

    const nextSourceCanonicalValue = String(hubState.developerPanel.canonicalValue || '');
    if (!developerPanelDraft || developerPanelDraft.sourceCanonicalValue !== nextSourceCanonicalValue) {
      developerPanelDraft = createDeveloperPanelDraft(hubState.developerPanel);
      if (refs.developerAddInput) {
        refs.developerAddInput.value = '';
      }
      if (refs.developerBulkInput) {
        refs.developerBulkInput.value = '';
      }
      return;
    }

    developerPanelDraft.sourceInvalidTokens = Array.isArray(hubState.developerPanel.invalidTokens)
      ? hubState.developerPanel.invalidTokens.filter((token) => typeof token === 'string' && token.trim())
      : [];
  }

  function updateDeveloperPanelDraft(nextUsernames, invalidTokens = []) {
    if (!developerPanelDraft) {
      return;
    }
    const parsed = parseRedditUsernameList(buildRedditUsernameListCanonicalValue(nextUsernames));
    developerPanelDraft.usernames = parsed.usernames;
    developerPanelDraft.latestInvalidTokens = invalidTokens.filter((token) => typeof token === 'string' && token.trim());
  }

  function getDeveloperDraftCanonicalValue() {
    return buildRedditUsernameListCanonicalValue(developerPanelDraft?.usernames ?? []);
  }

  function getDeveloperChunkPlan() {
    return splitRedditUsernameListAcrossSettings(developerPanelDraft?.usernames ?? [], {
      maxChunks: GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length,
    });
  }

  function getDeveloperTerminalSnippet() {
    const chunkPlan = getDeveloperChunkPlan();
    if (chunkPlan.overflow) {
      return '';
    }
    const activeChunkCount = chunkPlan.chunks.filter(Boolean).length;
    const commands = [];
    for (const [index, settingName] of GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.entries()) {
      const chunkValue = chunkPlan.chunks[index] ?? '';
      if (!chunkValue) {
        continue;
      }
      commands.push(`printf '%s\\n' '${escapeSingleQuotedShellArg(chunkValue)}' | npx devvit settings set ${settingName}`);
    }
    commands.push(
      `printf '%s\\n' '${escapeSingleQuotedShellArg(String(activeChunkCount))}' | npx devvit settings set ${GLOBAL_BLOCKED_USERNAME_CHUNK_COUNT_SETTING_NAME}`
    );
    return commands.join('\n');
  }

  function isDeveloperDraftDirty() {
    return Boolean(developerPanelDraft) && getDeveloperDraftCanonicalValue() !== developerPanelDraft.sourceCanonicalValue;
  }

  function mergeDeveloperDraftUsernames(rawInput) {
    if (!developerPanelDraft) {
      return;
    }
    const parsedInput = parseRedditUsernameList(rawInput);
    if (parsedInput.usernames.length === 0 && parsedInput.invalidTokens.length === 0) {
      showToast('Enter at least one Reddit username first.', 'error');
      return;
    }
    const merged = parseRedditUsernameList(
      buildRedditUsernameListCanonicalValue([...developerPanelDraft.usernames, ...parsedInput.usernames])
    );
    updateDeveloperPanelDraft(merged.usernames, parsedInput.invalidTokens);
    renderDeveloperPanel();
  }

  function renderDeveloperPanel() {
    if (!refs.developerPanel) {
      return;
    }

    const panel = hubState?.developerPanel;
    refs.developerPanel.classList.toggle('hidden', !panel);
    if (!panel) {
      return;
    }

    syncDeveloperPanelDraft();

    const usernames = developerPanelDraft?.usernames ?? [];
    refs.developerCurrentList.innerHTML = '';
    refs.developerEmpty.classList.toggle('hidden', usernames.length > 0);
    for (const username of usernames) {
      const row = document.createElement('div');
      row.className = 'hub-developer-row';

      const label = document.createElement('span');
      label.className = 'hub-developer-chip';
      label.textContent = `u/${username}`;

      const removeButton = makeButton('Remove', 'btn-secondary hub-developer-remove', () => {
        if (!developerPanelDraft) {
          return;
        }
        updateDeveloperPanelDraft(
          developerPanelDraft.usernames.filter((candidate) => candidate !== username),
          []
        );
        renderDeveloperPanel();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      refs.developerCurrentList.appendChild(row);
    }

    const warningLines = [];
    const chunkPlan = getDeveloperChunkPlan();
    if ((developerPanelDraft?.sourceInvalidTokens?.length ?? 0) > 0) {
      warningLines.push(
        `Ignored in current blocklist settings: ${developerPanelDraft.sourceInvalidTokens.map((token) => `"${token}"`).join(', ')}`
      );
    }
    if ((developerPanelDraft?.latestInvalidTokens?.length ?? 0) > 0) {
      warningLines.push(
        `Ignored in latest edit: ${developerPanelDraft.latestInvalidTokens.map((token) => `"${token}"`).join(', ')}`
      );
    }
    if (chunkPlan.overflow) {
      warningLines.push(
        `This draft exceeds the ${GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length} configured global blocklist settings. Remove ${chunkPlan.overflowedUsernamesCount} username${chunkPlan.overflowedUsernamesCount === 1 ? '' : 's'} or add more setting chunks in the app config.`
      );
    }
    refs.developerInvalid.innerHTML = warningLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
    refs.developerInvalid.classList.toggle('hidden', warningLines.length === 0);

    const draftDirty = isDeveloperDraftDirty();
    const nonEmptyChunkCount = chunkPlan.chunks.filter(Boolean).length;
    refs.developerDraftStatus.textContent = draftDirty
      ? chunkPlan.overflow
        ? `Unsaved draft. This list does not fit within ${GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length} settings.`
        : `Unsaved draft. This list will use ${nonEmptyChunkCount} of ${GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length} settings.`
      : `Draft matches the current global setting and uses ${nonEmptyChunkCount} of ${GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length} settings.`;
    refs.developerDraftStatus.classList.toggle('is-dirty', draftDirty);

    refs.developerCanonicalOutput.value = chunkPlan.overflow
      ? `This draft is too large for the ${GLOBAL_BLOCKED_USERNAME_SETTING_NAMES.length} configured global blocklist settings.`
      : getDeveloperTerminalSnippet();
    if (refs.developerCopyBtn) {
      refs.developerCopyBtn.disabled = chunkPlan.overflow;
    }
  }

  function resetDeveloperPanelDraft() {
    if (!hubState?.developerPanel) {
      return;
    }
    developerPanelDraft = createDeveloperPanelDraft(hubState.developerPanel);
    if (refs.developerAddInput) {
      refs.developerAddInput.value = '';
    }
    if (refs.developerBulkInput) {
      refs.developerBulkInput.value = '';
    }
    renderDeveloperPanel();
  }

  if (refs.developerAddBtn) {
    refs.developerAddBtn.addEventListener('click', () => {
      mergeDeveloperDraftUsernames(refs.developerAddInput?.value ?? '');
      if (refs.developerAddInput) {
        refs.developerAddInput.value = '';
      }
    });
  }

  if (refs.developerAddInput) {
    refs.developerAddInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      mergeDeveloperDraftUsernames(refs.developerAddInput?.value ?? '');
      refs.developerAddInput.value = '';
    });
  }

  if (refs.developerBulkBtn) {
    refs.developerBulkBtn.addEventListener('click', () => {
      mergeDeveloperDraftUsernames(refs.developerBulkInput?.value ?? '');
      if (refs.developerBulkInput) {
        refs.developerBulkInput.value = '';
      }
    });
  }

  if (refs.developerResetBtn) {
    refs.developerResetBtn.addEventListener('click', () => {
      resetDeveloperPanelDraft();
    });
  }

  if (refs.developerCopyBtn) {
    refs.developerCopyBtn.addEventListener('click', async () => {
      try {
        await copyTextToClipboard(getDeveloperTerminalSnippet());
        showToast('Copied terminal commands.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), 'error');
      }
    });
  }

  // ----- Developer console modal: modmail broadcast -----
  let broadcastState = null;
  let broadcastStateLoading = false;
  let broadcastBusy = false;

  function resolveBroadcastPreviewText(text) {
    const subredditName = String(hubState?.subredditName || '').trim();
    const replacement = subredditName ? `r/${subredditName}` : 'this subreddit';
    return String(text ?? '').replace(/\{\{\s*subreddit\s*\}\}/gi, replacement);
  }

  function setDeveloperTab(tab) {
    const isBroadcast = tab !== 'blocklist';
    if (refs.developerTabBroadcast) {
      refs.developerTabBroadcast.classList.toggle('is-active', isBroadcast);
      refs.developerTabBroadcast.setAttribute('aria-selected', isBroadcast ? 'true' : 'false');
    }
    if (refs.developerTabBlocklist) {
      refs.developerTabBlocklist.classList.toggle('is-active', !isBroadcast);
      refs.developerTabBlocklist.setAttribute('aria-selected', !isBroadcast ? 'true' : 'false');
    }
    if (refs.developerBroadcastTab) {
      refs.developerBroadcastTab.classList.toggle('hidden', !isBroadcast);
    }
    if (refs.developerBlocklistTab) {
      refs.developerBlocklistTab.classList.toggle('hidden', isBroadcast);
    }
  }

  function setBroadcastError(message) {
    if (!refs.broadcastError) {
      return;
    }
    refs.broadcastError.textContent = message || '';
    refs.broadcastError.classList.toggle('hidden', !message);
  }

  function renderBroadcastPreview() {
    if (!refs.broadcastPreview || refs.broadcastPreview.classList.contains('hidden')) {
      return;
    }
    const subject = resolveBroadcastPreviewText(refs.broadcastSubject?.value ?? '');
    const body = resolveBroadcastPreviewText(refs.broadcastBody?.value ?? '');
    if (refs.broadcastPreviewSubject) {
      refs.broadcastPreviewSubject.textContent = subject.trim() || '(no subject)';
    }
    if (refs.broadcastPreviewBody) {
      refs.broadcastPreviewBody.innerHTML = body.trim()
        ? renderMarkdown(body)
        : '<p class="markdown-empty">Nothing to preview yet.</p>';
    }
  }

  function formatBroadcastTimestamp(iso) {
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) {
      return '';
    }
    try {
      return new Date(ms).toLocaleString();
    } catch (error) {
      void error;
      return new Date(ms).toISOString();
    }
  }

  function renderBroadcastHistory() {
    if (!refs.broadcastHistoryList) {
      return;
    }
    const history = Array.isArray(broadcastState?.history) ? broadcastState.history : [];
    const canManage = Boolean(broadcastState?.canPublish);
    refs.broadcastHistoryList.innerHTML = '';
    if (refs.broadcastHistoryEmpty) {
      refs.broadcastHistoryEmpty.classList.toggle('hidden', history.length > 0);
    }
    for (const item of history) {
      const row = document.createElement('div');
      row.className = 'hub-developer-history-row';
      if (item.revoked) {
        row.classList.add('is-revoked');
      }

      const info = document.createElement('div');
      info.className = 'hub-developer-history-info';
      const subjectLine = document.createElement('p');
      subjectLine.className = 'hub-developer-history-subject';
      subjectLine.textContent = item.subject || '(no subject)';
      const metaLine = document.createElement('p');
      metaLine.className = 'meta';
      const bits = [];
      bits.push(item.type === 'notification' ? 'Notification' : 'Announcement');
      const stamp = formatBroadcastTimestamp(item.createdAt);
      if (stamp) {
        bits.push(stamp);
      }
      bits.push(item.maxVersion ? `below v${item.maxVersion}` : 'all installations');
      if (item.authoredBy) {
        bits.push(`by u/${item.authoredBy}`);
      }
      if (item.revoked) {
        bits.push('revoked');
      }
      metaLine.textContent = bits.join(' · ');
      info.appendChild(subjectLine);
      info.appendChild(metaLine);
      row.appendChild(info);

      if (canManage && !item.revoked) {
        row.appendChild(
          makeButton('Revoke', 'btn-secondary hub-developer-history-revoke', () => {
            void revokeBroadcastEntry(item.id);
          })
        );
      }
      refs.broadcastHistoryList.appendChild(row);
    }
  }

  function renderBroadcastState() {
    const canPublish = Boolean(broadcastState?.canPublish);
    const pointerConfigured = Boolean(broadcastState?.pointerConfigured);
    const host = String(broadcastState?.hostSubreddit || 'vouchx');
    if (refs.broadcastHost) {
      refs.broadcastHost.textContent = host;
    }
    if (refs.broadcastHostNote) {
      refs.broadcastHostNote.classList.toggle('hidden', canPublish);
      if (!canPublish) {
        refs.broadcastHostNote.textContent = `Composing and publishing are only available from the r/${host} hub. You can still review recent broadcasts here.`;
      }
    }
    if (refs.broadcastPointerNote) {
      const showPointerNote = canPublish && !pointerConfigured;
      refs.broadcastPointerNote.classList.toggle('hidden', !showPointerNote);
      if (showPointerNote) {
        refs.broadcastPointerNote.textContent =
          'No broadcast page is configured yet. Set the broadcast_wiki_page global setting via the Devvit CLI before publishing.';
      }
    }
    const disabled = !canPublish || !pointerConfigured || broadcastBusy;
    const controls = [
      refs.broadcastSubject,
      refs.broadcastBody,
      refs.broadcastMaxVersion,
      refs.broadcastInsertToken,
      refs.broadcastTypeAnnouncement,
      refs.broadcastTypeNotification,
      refs.broadcastTestBtn,
      refs.broadcastSendBtn,
    ];
    if (refs.broadcastFormatToolbar) {
      controls.push(...refs.broadcastFormatToolbar.querySelectorAll('button'));
    }
    for (const control of controls) {
      if (control) {
        control.disabled = disabled;
      }
    }
    renderBroadcastHistory();
  }

  async function loadBroadcastState() {
    if (broadcastStateLoading) {
      return;
    }
    broadcastStateLoading = true;
    try {
      const payload = await requestJson('/api/dev/broadcast/state', {});
      broadcastState = payload?.state ?? null;
    } catch (error) {
      broadcastState = null;
      showToast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      broadcastStateLoading = false;
      renderBroadcastState();
    }
  }

  function getBroadcastInput() {
    return {
      subject: refs.broadcastSubject?.value ?? '',
      body: refs.broadcastBody?.value ?? '',
      type: refs.broadcastTypeNotification?.checked ? 'notification' : 'announcement',
      maxVersion: (refs.broadcastMaxVersion?.value ?? '').trim() || null,
    };
  }

  async function submitBroadcast(path, body, { clearOnSuccess } = {}) {
    if (broadcastBusy) {
      return;
    }
    setBroadcastError('');
    broadcastBusy = true;
    renderBroadcastState();
    try {
      const payload = await requestJson(path, body);
      if (payload?.state) {
        broadcastState = payload.state;
      }
      if (payload?.toast?.text) {
        showToast(payload.toast.text, payload.toast.tone || 'success');
      }
      if (clearOnSuccess) {
        if (refs.broadcastSubject) {
          refs.broadcastSubject.value = '';
        }
        if (refs.broadcastBody) {
          refs.broadcastBody.value = '';
        }
        if (refs.broadcastMaxVersion) {
          refs.broadcastMaxVersion.value = '';
        }
        if (refs.broadcastTypeAnnouncement) {
          refs.broadcastTypeAnnouncement.checked = true;
        }
        renderBroadcastPreview();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBroadcastError(message);
      showToast(message, 'error');
    } finally {
      broadcastBusy = false;
      renderBroadcastState();
    }
  }

  async function revokeBroadcastEntry(id) {
    if (!id || broadcastBusy) {
      return;
    }
    await submitBroadcast('/api/dev/broadcast/revoke', { id });
  }

  // --- Broadcast message markdown toolbar (mirrors the mod panel helpers) ---
  function broadcastBodyRange() {
    const field = refs.broadcastBody;
    const length = field ? String(field.value || '').length : 0;
    let start = length;
    let end = length;
    if (field && typeof field.selectionStart === 'number' && typeof field.selectionEnd === 'number') {
      start = Math.max(0, Math.min(field.selectionStart, length));
      end = Math.max(start, Math.min(field.selectionEnd, length));
    }
    return { start, end };
  }

  function replaceBroadcastBodyRange(start, end, replacement, selStart, selEnd) {
    const field = refs.broadcastBody;
    if (!field) {
      return;
    }
    const value = String(field.value || '');
    const boundedStart = Math.max(0, Math.min(start, value.length));
    const boundedEnd = Math.max(boundedStart, Math.min(end, value.length));
    field.value = value.slice(0, boundedStart) + replacement + value.slice(boundedEnd);
    field.focus();
    try {
      field.setSelectionRange(boundedStart + selStart, boundedStart + selEnd);
    } catch (error) {
      void error;
    }
    renderBroadcastPreview();
  }

  function insertBroadcastToken(token) {
    const { start, end } = broadcastBodyRange();
    replaceBroadcastBodyRange(start, end, token, token.length, token.length);
  }

  function wrapBroadcastSelection(prefix, suffix, fallbackText) {
    const field = refs.broadcastBody;
    if (!field) {
      return;
    }
    const value = String(field.value || '');
    const { start, end } = broadcastBodyRange();
    const selected = value.slice(start, end);
    const bodyText = selected || fallbackText;
    const replacement = `${prefix}${bodyText}${suffix}`;
    if (selected) {
      replaceBroadcastBodyRange(start, end, replacement, replacement.length, replacement.length);
    } else {
      replaceBroadcastBodyRange(start, end, replacement, prefix.length, prefix.length + bodyText.length);
    }
  }

  function broadcastLinePrefix(prefix, fallbackText, formatLine) {
    const field = refs.broadcastBody;
    if (!field) {
      return;
    }
    const value = String(field.value || '');
    if (!value) {
      const replacement = `${prefix}${fallbackText}`;
      replaceBroadcastBodyRange(0, 0, replacement, prefix.length, replacement.length);
      return;
    }
    const { start, end } = broadcastBodyRange();
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf('\n', end > start ? end - 1 : end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const slice = value.slice(lineStart, lineEnd);
    const formatted = slice
      ? slice.split('\n').map((line) => (line ? formatLine(line) : line)).join('\n')
      : `${prefix}${fallbackText}`;
    replaceBroadcastBodyRange(lineStart, lineEnd, formatted, formatted.length, formatted.length);
  }

  function insertBroadcastBlock(fallbackText, formatLine) {
    const field = refs.broadcastBody;
    if (!field) {
      return;
    }
    const value = String(field.value || '');
    const { start, end } = broadcastBodyRange();
    const selected = value.slice(start, end);
    const source = selected || fallbackText;
    const block = source.split('\n').map((line) => (line.trim() ? formatLine(line) : line)).join('\n');
    const before = value.slice(0, start);
    const leading = before && !before.endsWith('\n') ? '\n\n' : '';
    const replacement = `${leading}${block}`;
    replaceBroadcastBodyRange(start, end, replacement, replacement.length, replacement.length);
  }

  function insertBroadcastLink() {
    const field = refs.broadcastBody;
    if (!field) {
      return;
    }
    const value = String(field.value || '');
    const { start, end } = broadcastBodyRange();
    const label = value.slice(start, end) || 'link text';
    const urlPlaceholder = 'https://';
    const replacement = `[${label}](${urlPlaceholder})`;
    const urlStart = `[${label}](`.length;
    replaceBroadcastBodyRange(start, end, replacement, urlStart, urlStart + urlPlaceholder.length);
  }

  function applyBroadcastFormat(action) {
    if (action === 'bold') {
      wrapBroadcastSelection('**', '**', 'bold text');
    } else if (action === 'italic') {
      wrapBroadcastSelection('*', '*', 'italic text');
    } else if (action === 'quote') {
      broadcastLinePrefix('> ', 'Quote', (line) => (line.startsWith('>') ? line : `> ${line}`));
    } else if (action === 'heading-1' || action === 'heading-2' || action === 'heading-3') {
      const marker = action === 'heading-1' ? '#' : action === 'heading-2' ? '##' : '###';
      broadcastLinePrefix(`${marker} `, 'Heading', (line) => `${marker} ${line.replace(/^#{1,3}\s+/, '')}`);
    } else if (action === 'bullet-list') {
      insertBroadcastBlock('Item\nItem', (line) => `- ${line}`);
    } else if (action === 'numbered-list') {
      let index = 0;
      insertBroadcastBlock('Item\nItem', (line) => {
        index += 1;
        return `${index}. ${line}`;
      });
    } else if (action === 'link') {
      insertBroadcastLink();
    }
  }

  function openDeveloperModal() {
    if (!refs.developerModal) {
      return;
    }
    setDeveloperTab('broadcast');
    setBroadcastError('');
    refs.developerModal.classList.remove('hidden');
    document.body.classList.add('hub-developer-modal-open');
    void loadBroadcastState();
  }

  function closeDeveloperModal() {
    if (!refs.developerModal) {
      return;
    }
    refs.developerModal.classList.add('hidden');
    document.body.classList.remove('hub-developer-modal-open');
  }

  if (refs.developerOpenBtn) {
    refs.developerOpenBtn.addEventListener('click', openDeveloperModal);
  }
  if (refs.developerCloseBtn) {
    refs.developerCloseBtn.addEventListener('click', closeDeveloperModal);
  }
  if (refs.developerModal) {
    refs.developerModal.addEventListener('click', (event) => {
      if (event.target === refs.developerModal) {
        closeDeveloperModal();
      }
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && refs.developerModal && !refs.developerModal.classList.contains('hidden')) {
      closeDeveloperModal();
    }
  });
  if (refs.developerTabBroadcast) {
    refs.developerTabBroadcast.addEventListener('click', () => setDeveloperTab('broadcast'));
  }
  if (refs.developerTabBlocklist) {
    refs.developerTabBlocklist.addEventListener('click', () => setDeveloperTab('blocklist'));
  }
  if (refs.broadcastInsertToken) {
    refs.broadcastInsertToken.addEventListener('click', () => {
      insertBroadcastToken('{{subreddit}}');
      renderBroadcastPreview();
    });
  }
  if (refs.broadcastFormatToolbar) {
    // preventDefault on pointerdown keeps the textarea's selection/focus when a
    // toolbar button is pressed, so formatting applies to the selected text.
    refs.broadcastFormatToolbar.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-md-action]')) {
        event.preventDefault();
      }
    });
    refs.broadcastFormatToolbar.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-md-action]') : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return;
      }
      event.preventDefault();
      applyBroadcastFormat(String(button.dataset.mdAction || ''));
    });
  }
  if (refs.broadcastPreviewToggle) {
    refs.broadcastPreviewToggle.addEventListener('click', () => {
      if (!refs.broadcastPreview) {
        return;
      }
      const willShow = refs.broadcastPreview.classList.contains('hidden');
      refs.broadcastPreview.classList.toggle('hidden', !willShow);
      refs.broadcastPreviewToggle.textContent = willShow ? 'Hide preview' : 'Preview';
      renderBroadcastPreview();
    });
  }
  if (refs.broadcastBody) {
    refs.broadcastBody.addEventListener('input', renderBroadcastPreview);
  }
  if (refs.broadcastSubject) {
    refs.broadcastSubject.addEventListener('input', renderBroadcastPreview);
  }
  if (refs.broadcastTestBtn) {
    refs.broadcastTestBtn.addEventListener('click', () => {
      void submitBroadcast('/api/dev/broadcast/test', getBroadcastInput());
    });
  }
  if (refs.broadcastSendBtn) {
    refs.broadcastSendBtn.addEventListener('click', () => {
      void submitBroadcast('/api/dev/broadcast', getBroadcastInput(), { clearOnSuccess: true });
    });
  }

  function renderHubFlow(state, { isVerified, isRestricted, awaitingFlairPropagation }) {
    const flow = refs.hubFlow;
    if (!flow) {
      return;
    }
    const steps = flow.querySelectorAll('.hub-flow-step');
    if (steps.length < 3) {
      flow.classList.add('hidden');
      return;
    }
    const participationLabel = syncVerificationRequirementStep(state.config, {
      step: refs.participationStep,
      label: refs.participationStepLabel,
      help: refs.participationStepHelp,
      tooltip: refs.participationStepTooltip,
    });
    const hasOutcomeStep = Boolean(participationLabel);

    // Hide the flow entirely when there's no actionable verification journey
    // (restricted, blocked, disabled at the subreddit level, initial setup, etc).
    if (
      isRestricted ||
      state.requiresInitialSetup ||
      !state.config.verificationsEnabled
    ) {
      flow.classList.add('hidden');
      return;
    }

    const status = state.userLatest?.status;
    let stepStates;
    if (isVerified || awaitingFlairPropagation) {
      // Completed journey — every step done, outcome lit up as the reward.
      stepStates = ['done', 'done', 'done', 'outcome-achieved'];
    } else if (status === 'pending') {
      // Photos in, awaiting moderator decision.
      stepStates = ['done', 'done', 'waiting', 'outcome-locked'];
    } else if (status === 'denied') {
      // Failed at the review step; next action is to resubmit (step 2 → current).
      stepStates = ['done', 'current', 'failed', 'outcome-locked'];
    } else if (status === 'removed') {
      // Was verified, now removed — reset journey, outcome locked again.
      stepStates = ['done', 'current', 'locked', 'outcome-locked'];
    } else {
      // First visit / nothing submitted yet.
      stepStates = ['current', 'locked', 'locked', 'outcome-locked'];
    }

    flow.classList.remove('hidden');
    flow.classList.toggle('hub-flow-complete', isVerified || awaitingFlairPropagation);
    const stateClassList = [
      'is-done',
      'is-current',
      'is-waiting',
      'is-failed',
      'is-locked',
      'is-outcome',
      'is-outcome-achieved',
    ];
    steps.forEach((step, index) => {
      stateClassList.forEach((cls) => step.classList.remove(cls));
      // Skip styling the participation step if the moderators haven't enabled
      // a participation requirement — it's hidden by syncVerificationRequirementStep.
      if (index === 3 && !hasOutcomeStep) {
        return;
      }
      const stepState = stepStates[index];
      switch (stepState) {
        case 'done':
          step.classList.add('is-done');
          break;
        case 'current':
          step.classList.add('is-current');
          break;
        case 'waiting':
          step.classList.add('is-current', 'is-waiting');
          break;
        case 'failed':
          step.classList.add('is-failed');
          break;
        case 'locked':
          step.classList.add('is-locked');
          break;
        case 'outcome-locked':
          step.classList.add('is-outcome', 'is-locked');
          break;
        case 'outcome-achieved':
          step.classList.add('is-outcome', 'is-done', 'is-outcome-achieved');
          break;
        default:
          break;
      }
    });
  }

  function renderPhotoInstructionsFlow(state) {
    const flow = refs.photoInstructionsFlow;
    if (!flow) {
      return;
    }
    const steps = flow.querySelectorAll('.hub-flow-step');
    if (steps.length < 3) {
      return;
    }
    const participationLabel = syncVerificationRequirementStep(state?.config, {
      step: refs.photoInstructionsParticipationStep,
      label: refs.photoInstructionsParticipationStepLabel,
      help: refs.photoInstructionsParticipationStepHelp,
      tooltip: refs.photoInstructionsParticipationStepTooltip,
    });
    if (refs.photoInstructionsEyebrow) {
      refs.photoInstructionsEyebrow.textContent = `Step 1 of ${participationLabel ? '4' : '3'}`;
    }
    steps.forEach((step, index) => {
      step.classList.toggle('is-done', false);
      step.classList.toggle('is-current', index === 0);
      step.classList.toggle('is-waiting', false);
    });
  }

  function getRestrictedHubStateView(state, { isVerified, isRestricted, isGlobalRestriction }) {
    if (!state || isVerified) {
      return null;
    }

    const subredditLabel = state.subredditName ? `r/${state.subredditName}` : 'this community';

    if (isRestricted && isGlobalRestriction) {
      return {
        kind: 'global-blocked',
        title: 'Your access to VouchX is restricted.',
        summary:
          "VouchX helps subreddits manage photo verification requests. This account can't access VouchX across communities that use the app due to a developer-level restriction.",
        context:
          'This restriction may be related to the VouchX Terms and Conditions. It does not, by itself, control whether you can post or comment on Reddit. Subreddit rules, flair requirements, moderator actions, or bans may still apply.',
        actions: [],
      };
    }

    if (isRestricted) {
      const subredditRestrictionKind =
        String(state.viewerBlocked?.reason || '').toLowerCase().includes('blocked by moderator')
          ? 'subreddit-blocked'
          : 'subreddit-restricted';
      return {
        kind: subredditRestrictionKind,
        title: `Verification is unavailable in ${subredditLabel}.`,
        summary:
          'This account is blocked by the moderation team from submitting verification through VouchX in this subreddit.',
        context:
          "This only affects VouchX verification here. Posting or commenting may still depend on the subreddit's rules, flair requirements, moderator actions, or bans.",
        actions: [],
      };
    }

    if (!state.config.verificationsEnabled) {
      const disabledMessage = String(state.config.verificationsDisabledMessage || '').trim();
      return {
        kind: 'disabled',
        title: 'Verification is currently unavailable.',
        summary: 'Submissions have been temporarily disabled by the moderators.',
        context: disabledMessage || 'Please check back later for updates from the moderation team.',
        actions: [],
      };
    }

    return null;
  }

  function renderRestrictedHubState(view) {
    const panel = refs.restrictedState;
    if (!panel) {
      return;
    }

    panel.classList.toggle('hidden', !view);
    panel.dataset.state = view?.kind || '';
    refs.restrictedIcon.className = view ? `hub-state-icon hub-state-icon-${view.kind}` : 'hub-state-icon';
    refs.restrictedTitle.textContent = view?.title || '';
    refs.restrictedSummary.textContent = view?.summary || '';
    refs.restrictedContext.textContent = view?.context || '';
    refs.restrictedContext.classList.toggle('hidden', !view?.context);
  }

  function appendRestrictedHubActions(view) {
    if (!view) {
      return;
    }

    if (view.actions.includes('requirements')) {
      refs.actionRow.appendChild(
        makeButton('View Requirements', 'btn-secondary', (event) => {
          openPhotoInstructionsModal(event);
        })
      );
    }

    if (view.actions.includes('learn-more') && view.learnMoreUrl) {
      refs.actionRow.appendChild(
        makeButton('Learn More', 'btn-secondary', () => {
          navigateTo(view.learnMoreUrl);
        })
      );
    }
  }

  function renderState(state) {
    if (!state) {
      return;
    }

    const isVerified = Boolean(
      state.viewerShouldDisplayVerified === undefined ? state.viewerVerifiedByFlair : state.viewerShouldDisplayVerified
    );
    const awaitingFlairPropagation = isAwaitingFlairPropagation(state) && !isVerified;
    const isRestricted = Boolean(state.viewerBlocked && !isVerified);
    const isGlobalRestriction = state.viewerBlocked?.scope === 'global';
    const submissionsDisabledForHomeSubreddit = isVouchxHomeSubreddit(state.subredditName);
    const restrictedView = getRestrictedHubStateView(state, { isVerified, isRestricted, isGlobalRestriction });

    applyTheme(state.resolvedTheme);
    refs.metaUsername.textContent = state.viewerUsername
      ? `Username: ${formatRedditUsernameDisplay(state.viewerUsername)}`
      : 'Username: not signed in';
    refs.metaSubreddit.textContent = state.subredditName ? `Subreddit: r/${state.subredditName}` : '';

    refs.pendingBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount || 0);
    refs.pendingBadge.classList.toggle('hidden', !(state.canReview && state.pendingCount > 0));
    if (refs.modPanelGroup) {
      refs.modPanelGroup.classList.toggle('hidden', !state.canReview);
    }

    const subredditLabel = state.subredditName ? `r/${state.subredditName}` : 'this community';
    let commandTitle = `Get verified in ${subredditLabel}`;
    let infoText = 'Review the photo requirements, then submit your verification for moderator review.';
    if (!isVerified && !isRestricted && !state.config.verificationsEnabled) {
      commandTitle = 'Verifications are currently unavailable';
      infoText = String(state.config.verificationsDisabledMessage || '').trim() || 'Verifications are temporarily disabled. Please check back soon.';
    } else if (
      submissionsDisabledForHomeSubreddit &&
      !isVerified &&
      !isRestricted &&
      !awaitingFlairPropagation &&
      !state.requiresInitialSetup &&
      !(state.userLatest && state.userLatest.status === 'pending')
    ) {
      infoText = 'This is the VouchX home subreddit. Verification submissions are disabled here — this subreddit is for demonstration purposes only.';
    } else if (awaitingFlairPropagation) {
      commandTitle = 'Approval syncing';
      infoText = 'Your approval was recorded. Verified flair is still syncing and should update shortly.';
    } else if (!isVerified && !isRestricted && state.userLatest?.status === 'pending') {
      commandTitle = state.userLatest.parentVerificationId ? 'Pending moderator re-review' : 'Pending moderator review';
      infoText = state.userLatest.parentVerificationId
        ? 'Your verification is being reviewed again by the moderators.'
        : 'Your verification is pending moderator review.';
    } else if (!isVerified && isRestricted) {
      commandTitle = isGlobalRestriction
        ? 'Your access to the VouchX app is restricted.'
        : 'You are blocked from submitting verification on this subreddit.';
      infoText = isGlobalRestriction
        ? 'As outlined in VouchX Terms and Conditions, the developer may restrict access to this app. This restriction applies across every subreddit using VouchX.'
        : 'This restriction is only for this subreddit and is based on your activity or verification history.';
    } else if (isVerified) {
      commandTitle = isManualSource(state.viewerFlairCheckSource) ? 'Verification detected' : 'Verification complete';
      const approvedOn = formatDateLong(state.userLatest?.reviewedAt);
      infoText = approvedOn ? `Your verification was approved on ${approvedOn}.` : '';
    } else if (state.userLatest?.status === 'denied') {
      commandTitle = 'Denied - Resubmit your photo(s)';
      const parts = [];
      if (state.userLatest.denyReason) {
        parts.push(`Reason: ${getDenyReasonLabel(state, state.userLatest.denyReason)}.`);
      }
      if (state.userLatest.reviewedAt) {
        parts.push(`Reviewed ${formatTimestamp(state.userLatest.reviewedAt)}.`);
      }
      infoText = parts.join('\n');
    } else if (state.userLatest?.status === 'removed') {
      commandTitle = 'Verification removed';
      infoText = state.userLatest.removedAt ? `Removed ${formatTimestamp(state.userLatest.removedAt)}.` : '';
    } else if (state.requiresInitialSetup) {
      commandTitle = state.canReview ? 'Setup required' : 'Coming soon!';
      infoText = state.canReview
        ? 'A primary approval flair is required before members can be verified. Click Complete Setup to configure it in the Mod Panel.'
        : 'Verification is being set up for this community. Check back soon!';
    }

    refs.commandTitle.textContent = commandTitle;
    refs.infoMsg.textContent = infoText;
    refs.commandTitle.classList.toggle('hidden', Boolean(restrictedView));
    refs.infoMsg.classList.toggle('hidden', Boolean(restrictedView) || !infoText);
    renderRestrictedHubState(restrictedView);

    renderHubFlow(state, { isVerified, isRestricted, awaitingFlairPropagation });
    renderPhotoInstructionsFlow(state);

    refs.actionRow.innerHTML = '';
    renderDeveloperPanel();
    appendRestrictedHubActions(restrictedView);
    const submitLabel =
      state.userLatest && (state.userLatest.status === 'denied' || state.userLatest.status === 'removed')
        ? 'Resubmit Verification'
        : 'Submit Verification';

    if (state.requiresInitialSetup && state.canReview) {
      refs.actionRow.appendChild(
        makeButton('Complete Setup', 'btn-secondary', async (event) => {
          if (inline) {
            try {
              if (event instanceof MouseEvent) {
                setModPanelLaunchPending(true);
                await requestExpandedMode(event, 'modPanel');
                modPanelLaunchResetTimerId = window.setTimeout(() => {
                  setModPanelLaunchPending(false);
                }, 2500);
                return;
              }
            } catch (error) {
              setModPanelLaunchPending(false);
              showToast(error instanceof Error ? error.message : String(error), 'error');
            }
          }
          window.location.replace(buildInternalNavigationUrl(modPanelPath || './mod-panel.html'));
        })
      );
    }

    if (
      !isVerified &&
      !isRestricted &&
      !awaitingFlairPropagation &&
      !state.requiresInitialSetup &&
      state.config.verificationsEnabled &&
      !(state.userLatest && state.userLatest.status === 'pending')
    ) {
      refs.actionRow.appendChild(
        makeButton('Photo Requirements', 'btn-secondary', (event) => {
          openPhotoInstructionsModal(event);
        })
      );
      const submitButton = makeButton(submitLabel, 'btn-primary', (event) => {
        void openSubmitForm(event);
      });
      refs.actionRow.appendChild(submitButton);
    }

    if (!isVerified && state.userLatest?.status === 'pending') {
      refs.actionRow.appendChild(
        makeButton('Withdraw Pending Verification', 'btn-secondary', () => {
          void performAction('/api/hub/withdraw', {}, {
            refreshOnError(message) {
              return message.includes('No pending verification request found.');
            },
          });
        })
      );
    }

    if (isVerified || (isGlobalRestriction && state.userLatest?.status === 'approved')) {
      refs.actionRow.appendChild(
        makeButton('Remove verification', 'hub-remove-verification-btn', () => {
          void openDeleteForm();
        })
      );
    }

    refs.actionRow.classList.toggle('hidden', refs.actionRow.childElementCount === 0);
  }

  function applyModeratorUiPayload(payload) {
    if (!payload || !hubState) {
      return;
    }
    hubState = {
      ...hubState,
      isModerator: payload.isModerator === true,
      canReview: payload.canReview === true,
      pendingCount: Number.isFinite(payload.pendingCount) ? payload.pendingCount : hubState.pendingCount,
    };
    renderState(hubState);
  }

  function applyPayload(payload) {
    if (!payload) {
      return;
    }
    syncRealtimeSubscription(payload && typeof payload.realtimeChannel === 'string' ? payload.realtimeChannel : '');
    if (payload.toast?.text) {
      showToast(payload.toast.text, payload.toast.tone || 'info');
    }
    hubState = payload.state ?? hubState;
    hubForms = payload.forms ?? hubForms;
    modPanelPath = typeof payload.modPanelPath === 'string' && payload.modPanelPath ? payload.modPanelPath : modPanelPath;
    if (hubState) {
      refs.loadingScreen.classList.add('hidden');
      if (!photoInstructionsOnly) {
        refs.mainContent.classList.remove('hidden');
      }
      renderState(hubState);
      void refreshModeratorUiState();
      syncFlairPropagationRefresh();
      if (photoInstructionsOnly && !photoInstructionsOnlyHandled) {
        photoInstructionsOnlyHandled = true;
        void requestPhotoInstructionsReview({
          dedicatedView: true,
          requireContinue: photoInstructionsLaunchMode === 'submit',
        });
      }
    }
  }

  async function refreshModeratorUiState() {
    if (!hubState || moderatorUiRequestInFlight) {
      return;
    }
    moderatorUiRequestInFlight = true;
    try {
      applyModeratorUiPayload(await requestJson('/api/hub/moderator-ui'));
    } catch {
      // The hub should stay usable even when moderator UI enrichment is unavailable.
    } finally {
      moderatorUiRequestInFlight = false;
    }
  }

  async function refreshState(options = {}) {
    const { silent = false } = options;
    setBusy(true);
    try {
      applyPayload(await requestJson('/api/hub/state'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!hubState) {
        refs.loadingScreen.textContent = `Unable to load verification state: ${message}`;
      }
      if (!silent) {
        showToast(message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function scheduleAutoRefresh() {
    if (autoRefreshTimerId) {
      window.clearInterval(autoRefreshTimerId);
    }
    autoRefreshTimerId = window.setInterval(() => {
      if (document.hidden || isBusy || (realtimeChannel && realtimeLiveChannel === realtimeChannel)) {
        return;
      }
      void refreshState({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || isBusy) {
      return;
    }
    if (realtimeRefreshQueued && !realtimeRefreshInFlight) {
      realtimeRefreshQueued = false;
      void refreshFromRealtimeSignal();
      return;
    }
    if (!(realtimeChannel && realtimeLiveChannel === realtimeChannel)) {
      void refreshState({ silent: true });
    }
  });

  window.addEventListener('beforeunload', () => {
    clearFlairPropagationRefresh({ reset: true });
    closeRealtimeSubscription();
  });

  let modPanelLaunchResetTimerId = null;

  function setModPanelLaunchPending(isPending) {
    if (!refs.modPanelBtn) {
      return;
    }
    if (modPanelLaunchResetTimerId) {
      window.clearTimeout(modPanelLaunchResetTimerId);
      modPanelLaunchResetTimerId = null;
    }
    refs.modPanelBtn.disabled = isPending;
    refs.modPanelBtn.setAttribute('aria-busy', isPending ? 'true' : 'false');
    refs.modPanelBtn.textContent = isPending ? 'Opening Mod Panel...' : 'Mod Panel';
  }

  refs.modPanelBtn.addEventListener('click', async (event) => {
    if (inline) {
      try {
        if (event instanceof MouseEvent) {
          setModPanelLaunchPending(true);
          await requestExpandedMode(event, 'modPanel');
          modPanelLaunchResetTimerId = window.setTimeout(() => {
            setModPanelLaunchPending(false);
          }, 2500);
          return;
        }
      } catch (error) {
        setModPanelLaunchPending(false);
        showToast(error instanceof Error ? error.message : String(error), 'error');
      }
    }
    window.location.replace(buildInternalNavigationUrl(modPanelPath || './mod-panel.html'));
  });

  scheduleAutoRefresh();
  void refreshState();
}
