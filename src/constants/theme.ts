export const Colors = {
  primary: '#6C63FF',
  primaryLight: '#8B84FF',
  primaryDark: '#4F48CC',

  background: '#1E1E2E',
  surface: '#2A2A3E',
  surfaceLight: '#32324A',
  surfaceBorder: '#3A3A52',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textMuted: '#6B6B80',

  success: '#4CAF82',
  successLight: '#E8F5EE',
  warning: '#F5A623',
  warningLight: '#FFF3E0',
  danger: '#FF5B5B',
  dangerLight: '#FFE8E8',
  info: '#64B5F6',

  tl: '#E53935',
  usd: '#2E7D32',
  eur: '#1565C0',

  categories: {
    fatura: '#FF6B6B',
    abonelik: '#6C63FF',
    kira: '#FFD93D',
    kredi: '#FF8C42',
    diger: '#78909C',
    custom: '#26C6DA',
  },

  gradientPrimary: ['#6C63FF', '#9C27B0'],
  gradientSuccess: ['#4CAF82', '#00BCD4'],
  gradientDanger: ['#FF5B5B', '#FF8C42'],

  tabBar: '#1A1A2E',
  tabBarBorder: '#2A2A3E',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};
