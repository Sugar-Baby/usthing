/**
 * HKUST palette — deep blue (#0444C4) + gold (#CC9900).
 *
 * The visual language mirrors `rouste`, the author's previous course planner:
 * blue-tinted neutrals, soft surface cards, and small badge colours for
 * course metadata.
 */
const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#F4F6FA",
  neutral300: "#E4E8EF",
  neutral400: "#ADB5BD",
  neutral500: "#6C757D",
  neutral600: "#495057",
  neutral700: "#343A40",
  neutral800: "#212529",
  neutral900: "#000000",

  primary100: "#E9EFFC",
  primary200: "#C7D7F6",
  primary300: "#8FAEEF",
  primary400: "#3A6BC7",
  primary500: "#0444C4",
  primary600: "#0333A0",

  secondary100: "#FFF6D6",
  secondary200: "#FFEBA6",
  secondary300: "#FFDD70",
  secondary400: "#E6B800",
  secondary500: "#CC9900",
  secondary600: "#B38600",

  accent100: "#FFF6D6",
  accent200: "#FFEBA6",
  accent300: "#FFDD70",
  accent400: "#E6B800",
  accent500: "#CC9900",

  success100: "#E7F5EC",
  success500: "#2E7D32",

  warning100: "#FFF3E0",
  warning600: "#AE6A00",

  danger100: "#FCE9E7",
  danger500: "#C03403",

  overlay20: "rgba(4, 68, 196, 0.1)",
  overlay50: "rgba(33, 37, 41, 0.5)",
} as const

export const colors = {
  /**
   * The palette is available to use, but prefer using the name.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette,
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  /**
   * The default text color in many components.
   */
  text: palette.neutral800,
  /**
   * Secondary text information.
   */
  textDim: palette.neutral600,
  /**
   * The default color of the screen background.
   */
  background: palette.neutral200,
  /**
   * The default border color.
   */
  border: palette.neutral300,
  /**
   * The main tinting color.
   */
  tint: palette.primary500,
  /**
   * The inactive tinting color.
   */
  tintInactive: palette.neutral300,
  /**
   * A subtle color used for lines.
   */
  separator: palette.neutral300,
  /**
   * Error messages.
   */
  error: palette.danger500,
  /**
   * Error Background.
   */
  errorBackground: palette.danger100,

  // --- HKUST semantic tokens (rouste's design language) -------------------
  /** Brand blue — course codes, active buttons, links. */
  primary: palette.primary500,
  /** Soft blue tint — badges, selected rows, highlights. */
  primaryLight: palette.primary100,
  primaryDark: palette.primary600,
  primaryBorder: palette.primary200,
  /** Brand gold — accents, Common Core. */
  secondary: palette.secondary500,
  secondaryLight: palette.secondary100,
  secondaryBorder: palette.secondary300,
  secondaryDark: palette.secondary600,
  /** Card background. */
  surface: palette.neutral100,
  /** Subtle background used inside cards and headers. */
  surfaceVariant: palette.neutral200,
  textMuted: palette.neutral500,
  textSecondary: palette.neutral600,
  success: palette.success500,
  successLight: palette.success100,
  warning: palette.warning600,
  warningLight: palette.warning100,
  danger: palette.danger500,
  dangerLight: palette.danger100,
} as const
