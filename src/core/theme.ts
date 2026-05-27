import type {
  RgbColor,
  RuntimeConfig,
  ThemePalette,
  ThemePresetName,
  ThemeTokens,
} from './types.ts';

export const DEFAULT_THEME_PRESET: ThemePresetName = 'coastal_light';

export const THEME_PRESETS: Record<ThemePresetName, ThemePalette> = {
  // Ocean — clean blue→teal. Versatile default that complements most subs.
  coastal_light: {
    light: {
      primary: '#0E7C9B',
      accent: '#F08A5D',
      success: '#2F9E6E',
      danger: '#D85365',
      bg: '#F7FAFC',
      surface: '#FFFFFF',
      text: '#15232E',
      mutedText: '#5E7384',
      border: '#E2E8ED',
    },
    dark: {
      primary: '#38B6D6',
      accent: '#F2A878',
      success: '#4FCB95',
      danger: '#FF7A8C',
      bg: '#0A141B',
      surface: '#111E27',
      text: '#DDE9F0',
      mutedText: '#93A8B6',
      border: '#243643',
    },
  },
  // Coral — warm coral-red primary with a cool blue accent.
  sunset_pop: {
    light: {
      primary: '#EF6240',
      accent: '#2E7DD1',
      success: '#2F9E6E',
      danger: '#C7314E',
      bg: '#FFF8F5',
      surface: '#FFFFFF',
      text: '#2A1C18',
      mutedText: '#7C655D',
      border: '#F1E1D9',
    },
    dark: {
      primary: '#FF8462',
      accent: '#5FA0EC',
      success: '#4FCB95',
      danger: '#FF6E86',
      bg: '#160F0D',
      surface: '#211714',
      text: '#F6E7E0',
      mutedText: '#C6A99E',
      border: '#3D2A23',
    },
  },
  // Emerald — modern green primary with an indigo accent.
  mint_modern: {
    light: {
      primary: '#0E9F7E',
      accent: '#5B6CE0',
      success: '#16895F',
      danger: '#D14B63',
      bg: '#F5FBF8',
      surface: '#FFFFFF',
      text: '#122722',
      mutedText: '#5C7A70',
      border: '#DDEBE5',
    },
    dark: {
      primary: '#3FD3AC',
      accent: '#8A97F0',
      success: '#45C893',
      danger: '#FF7A92',
      bg: '#08150F',
      surface: '#0F2118',
      text: '#D9F2E8',
      mutedText: '#92B6A8',
      border: '#1F3A2C',
    },
  },
  // Editorial — navy + warm gold. The clean, serious option.
  classic_news: {
    light: {
      primary: '#21487E',
      accent: '#C0892E',
      success: '#2F8A5C',
      danger: '#A8364C',
      bg: '#FAF9F6',
      surface: '#FFFFFF',
      text: '#1C232C',
      mutedText: '#66707C',
      border: '#E5E3DC',
    },
    dark: {
      primary: '#7AA5E8',
      accent: '#DAB063',
      success: '#5FB98A',
      danger: '#E07B90',
      bg: '#0F141A',
      surface: '#181F27',
      text: '#E3E8EF',
      mutedText: '#A2AEBC',
      border: '#2C3742',
    },
  },
  // Indigo — modern violet-blue with an amber accent (distinct from Ocean).
  midnight_slate: {
    light: {
      primary: '#4B53C7',
      accent: '#E08A4A',
      success: '#2F9E6E',
      danger: '#D14063',
      bg: '#F7F8FD',
      surface: '#FFFFFF',
      text: '#1B1E33',
      mutedText: '#686C86',
      border: '#E4E4F1',
    },
    dark: {
      primary: '#8E92ED',
      accent: '#F0AB6B',
      success: '#4FCB95',
      danger: '#FF7896',
      bg: '#0E0F1C',
      surface: '#181A2B',
      text: '#E5E6F5',
      mutedText: '#A4A8C4',
      border: '#2E3050',
    },
  },
  // Slate coral — refined slate-blue primary with a coral accent + clear red.
  blue_coral: {
    light: {
      primary: '#3D5A80',
      accent: '#EE6C4D',
      success: '#4F9C7D',
      danger: '#C23B4B',
      bg: '#FFFFFF',
      surface: '#F7F8FA',
      text: '#28303D',
      mutedText: '#5F6B79',
      border: '#E2E6EB',
    },
    dark: {
      primary: '#7C97C9',
      accent: '#F2856A',
      success: '#6FBE9D',
      danger: '#FF6F86',
      bg: '#161A22',
      surface: '#1F2530',
      text: '#E9EDF3',
      mutedText: '#A8B2BF',
      border: '#313A48',
    },
  },
  // Desert — warm clay primary, gold accent, sage success, clear red.
  desert: {
    light: {
      primary: '#B5683F',
      accent: '#CFA049',
      success: '#5E8C6A',
      danger: '#C0392B',
      bg: '#FBF6F0',
      surface: '#FFFFFF',
      text: '#2E2722',
      mutedText: '#786A5E',
      border: '#ECE1D4',
    },
    dark: {
      primary: '#D98E6E',
      accent: '#DEBE74',
      success: '#84B894',
      danger: '#E5765F',
      bg: '#1A1411',
      surface: '#251C17',
      text: '#F1E7DD',
      mutedText: '#C2AE9C',
      border: '#3E3026',
    },
  },
  // Vibrant — playful teal + amber, lime success, distinct red-orange danger.
  colorful: {
    light: {
      primary: '#1AAFB0',
      accent: '#F4A100',
      success: '#6FAE3E',
      danger: '#E04A33',
      bg: '#FFFDF5',
      surface: '#FFFFFF',
      text: '#2A2722',
      mutedText: '#6B6356',
      border: '#F0E4C4',
    },
    dark: {
      primary: '#45D0D0',
      accent: '#FFC24D',
      success: '#98C95E',
      danger: '#FF6A47',
      bg: '#161512',
      surface: '#20201B',
      text: '#F3EFE6',
      mutedText: '#C3BBA9',
      border: '#3C3A30',
    },
  },
};

export function parseThemePreset(value: string | undefined): ThemePresetName {
  if (!value) {
    return DEFAULT_THEME_PRESET;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized in THEME_PRESETS) {
    return normalized as ThemePresetName;
  }
  return DEFAULT_THEME_PRESET;
}

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return null;
}

export function hexToRgbColor(hex: string): RgbColor | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbColorToHex(color: RgbColor): string {
  const clampToHex = (value: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${clampToHex(color.r)}${clampToHex(color.g)}${clampToHex(color.b)}`;
}

export function mixHexColors(colorA: string, colorB: string, weightA: number): string {
  const rgbA = hexToRgbColor(colorA);
  const rgbB = hexToRgbColor(colorB);
  if (!rgbA && !rgbB) {
    return '#000000';
  }
  if (!rgbA) {
    return rgbColorToHex(rgbB!);
  }
  if (!rgbB) {
    return rgbColorToHex(rgbA);
  }
  const weight = Number.isFinite(weightA) ? Math.max(0, Math.min(1, weightA)) : 0.5;
  return rgbColorToHex({
    r: rgbA.r * weight + rgbB.r * (1 - weight),
    g: rgbA.g * weight + rgbB.g * (1 - weight),
    b: rgbA.b * weight + rgbB.b * (1 - weight),
  });
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgbColor(hex);
  if (!rgb) {
    return 0;
  }
  const toLinear = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function deriveCustomThemeTokens(
  baseTokens: ThemeTokens,
  customPrimary: string,
  customAccent: string,
  customBackground: string,
  mode: 'light' | 'dark'
): ThemeTokens {
  const primary = normalizeHexColor(customPrimary);
  const accent = normalizeHexColor(customAccent);
  const background = normalizeHexColor(customBackground);
  if (!primary || !accent || !background) {
    return { ...baseTokens };
  }

  const sourceLuminance = relativeLuminance(background);
  let bg = background;
  if (mode === 'dark') {
    if (sourceLuminance >= 0.55) {
      bg = mixHexColors(background, baseTokens.bg, 0.2);
    } else if (sourceLuminance >= 0.25) {
      bg = mixHexColors(background, baseTokens.bg, 0.55);
    } else {
      bg = mixHexColors(background, baseTokens.bg, 0.72);
    }
  } else if (sourceLuminance <= 0.24) {
    bg = mixHexColors(background, '#f3fbff', 0.65);
  }

  let surface =
    mode === 'dark' ? mixHexColors(bg, baseTokens.surface, 0.72) : mixHexColors(bg, baseTokens.surface, 0.76);
  surface = mixHexColors(surface, accent, 0.94);

  const borderBase = mixHexColors(baseTokens.border, accent, 0.65);
  const border = mode === 'dark' ? mixHexColors(borderBase, bg, 0.78) : mixHexColors(borderBase, bg, 0.7);

  const text = mode === 'dark' ? mixHexColors(baseTokens.text, bg, 0.92) : baseTokens.text;
  const mutedText =
    mode === 'dark' ? mixHexColors(baseTokens.mutedText, bg, 0.82) : mixHexColors(baseTokens.mutedText, bg, 0.86);

  return {
    ...baseTokens,
    primary,
    accent,
    bg,
    surface,
    text,
    mutedText,
    border,
  };
}

export function deriveCustomThemePalette(
  preset: ThemePalette,
  customPrimary: string,
  customAccent: string,
  customBackground: string
): ThemePalette {
  const primary = normalizeHexColor(customPrimary);
  const accent = normalizeHexColor(customAccent);
  const background = normalizeHexColor(customBackground);
  if (!primary || !accent || !background) {
    return {
      light: { ...preset.light },
      dark: { ...preset.dark },
    };
  }
  return {
    light: deriveCustomThemeTokens(preset.light, primary, accent, background, 'light'),
    dark: deriveCustomThemeTokens(preset.dark, primary, accent, background, 'dark'),
  };
}

export function resolveThemePalette(config: RuntimeConfig): ThemePalette {
  const preset = THEME_PRESETS[parseThemePreset(config.themePreset)];
  const customPrimary = normalizeHexColor(config.customPrimary);
  const customAccent = normalizeHexColor(config.customAccent);
  const customBackground = normalizeHexColor(config.customBackground);
  if (config.useCustomColors && customPrimary && customAccent && customBackground) {
    return deriveCustomThemePalette(preset, customPrimary, customAccent, customBackground);
  }
  if (config.useCustomColors && customPrimary && customAccent) {
    return {
      light: {
        ...preset.light,
        primary: customPrimary,
        accent: customAccent,
      },
      dark: {
        ...preset.dark,
        primary: customPrimary,
        accent: customAccent,
      },
    };
  }
  return {
    light: { ...preset.light },
    dark: { ...preset.dark },
  };
}
