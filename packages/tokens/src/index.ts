/**
 * Design tokens, read off the Farmer's Choice reference screens.
 * Shared by the mobile app and the admin console so one change moves both.
 */

export const color = {
  // Brand
  green: '#1B7A3E',        // primary actions, active tab, Book / Buy buttons
  greenDark: '#12572B',
  greenSoft: '#E4F1E7',    // selected chips, success banners
  soil: '#8A5A2B',         // secondary — owner/earnings surfaces
  soilSoft: '#F3E9DD',

  // Surfaces (cream, per the screens)
  bg: '#FAF8F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F0E8',

  // Text
  ink: '#1A1F1B',
  inkMuted: '#5E6860',
  inkFaint: '#8C948E',

  line: '#E2E0D6',

  // Semantic — separate from brand green on purpose
  success: '#1B7A3E',
  warning: '#B5730B',
  danger: '#C0392B',
  info: '#2D6DA3',

  star: '#F2A916',
} as const;

/**
 * Deliberately large. The target user is often over 45, outdoors in bright
 * sun, with a cracked screen protector. 14px body text is not readable there.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title:   { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body:    { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  label:   { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  price:   { fontSize: 20, lineHeight: 26, fontWeight: '700' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** 56pt minimum. Android's 48dp guidance assumes a steady indoor tap. */
export const hit = { minTarget: 56, buttonHeight: 56, inputHeight: 56 } as const;

/** Telugu and Devanagari need more vertical room than Latin at the same size. */
export const scriptLineHeightBoost = { te: 1.18, hi: 1.12, en: 1 } as const;
