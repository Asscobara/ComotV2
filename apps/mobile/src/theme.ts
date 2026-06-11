// ComOt design tokens — approved Direction 2 "Clean Ledger" (docs/DESIGN_PROPOSALS.md)

export const colors = {
  bg: '#FFFFFF',
  bgSoft: '#F8F9FB',
  surface: '#FFFFFF',
  ink: '#0F172A',
  inkSoft: '#475569',
  inkFaint: '#94A3B8',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF2FF',
  periwinkle: '#C7D2FE',
  border: '#E2E8F0',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  white: '#FFFFFF',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.ink },
  heading: { fontSize: 20, fontWeight: '800' as const, color: colors.ink },
  body: { fontSize: 16, color: colors.ink },
  label: { fontSize: 14, fontWeight: '700' as const, color: colors.inkSoft },
  caption: { fontSize: 13, color: colors.inkSoft },
};
