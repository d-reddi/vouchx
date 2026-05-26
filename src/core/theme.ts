import type {
  RgbColor,
  RuntimeConfig,
  ThemePalette,
  ThemePresetName,
  ThemeTokens,
} from './types.ts';

export const DEFAULT_THEME_PRESET: ThemePresetName = 'coastal_light';

export const THEME_PRESETS: Record<ThemePresetName, ThemePalette> = {
  coastal_light: {
    light: {
      primary: '#0E91B6',
      accent: '#FF7A45',
      success: '#12805C',
      danger: '#C83E5A',
      bg: '#F3FBFF',
      surface: '#FFFFFF',
      text: '#102533',
      mutedText: '#5C7382',
      border: '#C9DFEB',
    },
    dark: {
      primary: '#23B3DC',
      accent: '#F2A85C',
      success: '#45D6A6',
      danger: '#FF6F86',
      bg: '#04131B',
      surface: '#0A1C27',
      text: '#D7ECF7',
      mutedText: '#9CB9C8',
      border: '#214153',
    },
  },
  sunset_pop: {
    light: {
      primary: '#FF5A36',
      accent: '#2A7FFF',
      success: '#1E9A63',
      danger: '#D43D6D',
      bg: '#FFF4EE',
      surface: '#FFFFFF',
      text: '#2B1D1A',
      mutedText: '#7A615A',
      border: '#F0C8BB',
    },
    dark: {
      primary: '#FF8B6F',
      accent: '#74A6FF',
      success: '#58D49A',
      danger: '#FF83A8',
      bg: '#1A1110',
      surface: '#231916',
      text: '#F6E6DF',
      mutedText: '#C9A89D',
      border: '#4A302A',
    },
  },
  mint_modern: {
    light: {
      primary: '#0FAF9A',
      accent: '#2D6CDF',
      success: '#0D8D66',
      danger: '#C44763',
      bg: '#F1FFFB',
      surface: '#FFFFFF',
      text: '#0E2A28',
      mutedText: '#597B78',
      border: '#C9E7E2',
    },
    dark: {
      primary: '#49D5C4',
      accent: '#74A9FF',
      success: '#58DDB1',
      danger: '#F187A4',
      bg: '#091715',
      surface: '#102321',
      text: '#D8F2EE',
      mutedText: '#96BDB8',
      border: '#28433F',
    },
  },
  classic_news: {
    light: {
      primary: '#1D4D8F',
      accent: '#B7802A',
      success: '#2A7C52',
      danger: '#A3344B',
      bg: '#F8F6F1',
      surface: '#FFFFFF',
      text: '#1F252D',
      mutedText: '#66727F',
      border: '#D4D9DF',
    },
    dark: {
      primary: '#77A8F0',
      accent: '#D5B26A',
      success: '#67BF8F',
      danger: '#DD7F93',
      bg: '#11151B',
      surface: '#1A2028',
      text: '#E0E7EF',
      mutedText: '#A5B1BF',
      border: '#34404E',
    },
  },
  midnight_slate: {
    light: {
      primary: '#2EA8C7',
      accent: '#E58F3F',
      success: '#2BAE78',
      danger: '#D55B73',
      bg: '#EAF3F8',
      surface: '#FFFFFF',
      text: '#182A38',
      mutedText: '#5F7485',
      border: '#C4D5E0',
    },
    dark: {
      primary: '#4BC0DE',
      accent: '#F3B672',
      success: '#61D5A8',
      danger: '#F18DA3',
      bg: '#0D1822',
      surface: '#122532',
      text: '#D7E7F2',
      mutedText: '#96AFBF',
      border: '#2A4355',
    },
  },
  blue_coral: {
    light: {
      primary: '#4F5D75',
      accent: '#EF8354',
      success: '#5B8F7B',
      danger: '#EF8354',
      bg: '#FFFFFF',
      surface: '#F6F7F8',
      text: '#2D3142',
      mutedText: '#5F6673',
      border: '#BFC0C0',
    },
    dark: {
      primary: '#7F8EA9',
      accent: '#EF8354',
      success: '#77B29A',
      danger: '#FF9A74',
      bg: '#1C1F2B',
      surface: '#252A38',
      text: '#EDF0F5',
      mutedText: '#B3BAC7',
      border: '#4F5D75',
    },
  },
  desert: {
    light: {
      primary: '#81968F',
      accent: '#CFB9A5',
      success: '#96BDC6',
      danger: '#C6907F',
      bg: '#F8F2EE',
      surface: '#FFFFFF',
      text: '#3A4442',
      mutedText: '#6F7A78',
      border: '#E9D6EC',
    },
    dark: {
      primary: '#A8C7CF',
      accent: '#D8C4B5',
      success: '#8FB5BF',
      danger: '#D5A392',
      bg: '#202726',
      surface: '#2A3231',
      text: '#EDF1F0',
      mutedText: '#BEC9C6',
      border: '#4F5B58',
    },
  },
  colorful: {
    light: {
      primary: '#17BEBB',
      accent: '#E4572E',
      success: '#76B041',
      danger: '#E4572E',
      bg: '#FFF9EA',
      surface: '#FFFFFF',
      text: '#2E282A',
      mutedText: '#625A5D',
      border: '#FFD86C',
    },
    dark: {
      primary: '#45D5D1',
      accent: '#FF875F',
      success: '#9BD26E',
      danger: '#FF875F',
      bg: '#1D1A1B',
      surface: '#272324',
      text: '#F4EFEF',
      mutedText: '#C6B9B9',
      border: '#4A3F40',
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
