(function () {
  const params = new URLSearchParams(window.location.search);
  const subredditScope = (params.get('subredditId') || 'default').trim().toLowerCase() || 'default';
  const key = `nsfw-verify-theme-snapshot-v1:${subredditScope}`;
  const root = document.documentElement;

  const apply = (tokens) => {
    if (!tokens || typeof tokens !== 'object') return;
    root.style.setProperty('--primary', tokens.primary);
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--success', tokens.success);
    root.style.setProperty('--danger', tokens.danger);
    root.style.setProperty('--bg', tokens.bg);
    root.style.setProperty('--card', tokens.surface);
    root.style.setProperty('--text', tokens.text);
    root.style.setProperty('--muted', tokens.mutedText);
    root.style.setProperty('--line', tokens.border);
  };

  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const mode = media && media.matches ? 'dark' : 'light';
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

  if (palette && palette[mode]) {
    apply(palette[mode]);
  }
})();
