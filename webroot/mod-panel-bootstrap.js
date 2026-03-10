(function () {
  const params = new URLSearchParams(window.location.search);
  const subredditScope = (params.get('subredditId') || 'default').trim().toLowerCase() || 'default';
  const key = `nsfw-verify-theme-snapshot-v1:${subredditScope}`;
  const root = document.documentElement;

  const apply = (tokens) => {
    if (!tokens || typeof tokens !== 'object') return;
    root.style.setProperty('--theme-primary', tokens.primary);
    root.style.setProperty('--theme-primary-strong', tokens.primary);
    root.style.setProperty('--theme-accent', tokens.accent);
    root.style.setProperty('--theme-success', tokens.success);
    root.style.setProperty('--theme-danger', tokens.danger);
    root.style.setProperty('--theme-bg', tokens.bg);
    root.style.setProperty('--theme-surface', tokens.surface);
    root.style.setProperty('--theme-text', tokens.text);
    root.style.setProperty('--theme-muted', tokens.mutedText);
    root.style.setProperty('--theme-border', tokens.border);
  };

  let palette = null;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        palette = parsed.light && parsed.dark ? parsed : { light: parsed, dark: parsed };
      }
    }
  } catch (_error) {
    // Best-effort only.
  }

  if (palette) {
    apply(palette.dark || palette.light);
  }
})();
