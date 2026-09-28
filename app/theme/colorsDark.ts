/**
 * Dark counterpart of the HKUST palette. Keys mirror `colors.ts` exactly —
 * the theme type is the union of both, so any key added to one must exist
 * in the other.
 */
const palette = {
  neutral100: "#0E1626",
  neutral200: "#070C16",
  neutral300: "#1E2A40",
  neutral400: "#39476A",
  neutral500: "#8A97AF",
  neutral600: "#A9B4C8",
  neutral700: "#C9D2E0",
  neutral800: "#E8EDF5",
  neutral900: "#FFFFFF",

  primary100: "#132347",
  primary200: "#1D3468",
  primary300: "#2C4C97",
  primary400: "#4A78D0",
  primary500: "#6E9BF0",
  primary600: "#9CBBF6",

  secondary100: "#3A2E00",
  secondary200: "#5C4A00",
  secondary300: "#8A6F00",
  secondary400: "#B89400",
  secondary500: "#E6B800",
  secondary600: "#FFDD70",

  accent100: "#3A2E00",
  accent200: "#5C4A00",
  accent300: "#8A6F00",
  accent400: "#B89400",
  accent500: "#E6B800",

  success100: "#12301B",
  success500: "#6FCF87",

  warning100: "#3A2A08",
  warning600: "#F0A93B",

  danger100: "#3A1710",
  danger500: "#F0806A",

  overlay20: "rgba(110, 155, 240, 0.14)",
  overlay50: "rgba(0, 0, 0, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral200,
  border: palette.neutral300,
  tint: palette.primary500,
  tintInactive: palette.neutral400,
  separator: palette.neutral300,
  error: palette.danger500,
  errorBackground: palette.danger100,

  primary: palette.primary500,
  primaryLight: palette.primary100,
  primaryDark: palette.primary600,
  primaryBorder: palette.primary200,
  secondary: palette.secondary500,
  secondaryLight: palette.secondary100,
  secondaryBorder: palette.secondary300,
  secondaryDark: palette.secondary600,
  surface: palette.neutral100,
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
