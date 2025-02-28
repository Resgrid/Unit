import { colors } from './colors';

// Define semantic tokens for our theme
export const lightTheme = {
  colors: {
    // Background colors
    background: {
      primary: colors.neutral[50],
      secondary: colors.neutral[100],
      tertiary: colors.neutral[200],
    },
    // Text colors
    text: {
      primary: colors.neutral[900],
      secondary: colors.neutral[700],
      tertiary: colors.neutral[600],
      inverse: colors.neutral[50],
      link: colors.primary[500],
      error: colors.error[500],
      success: colors.success[500],
      warning: colors.warning[500],
    },
    // Border colors
    border: {
      light: colors.neutral[200],
      medium: colors.neutral[300],
      dark: colors.neutral[400],
    },
    // Component specific colors
    card: {
      background: colors.neutral[50],
      border: colors.neutral[200],
    },
    button: {
      primary: {
        background: colors.primary[500],
        text: colors.neutral[50],
        pressed: colors.primary[600],
      },
      secondary: {
        background: colors.secondary[500],
        text: colors.neutral[50],
        pressed: colors.secondary[600],
      },
      outline: {
        background: 'transparent',
        text: colors.primary[500],
        border: colors.primary[500],
        pressed: colors.primary[50],
      },
      ghost: {
        background: 'transparent',
        text: colors.primary[500],
        pressed: colors.primary[50],
      },
    },
    input: {
      background: colors.neutral[50],
      border: colors.neutral[300],
      focusBorder: colors.primary[500],
      placeholder: colors.neutral[500],
      text: colors.neutral[900],
    },
    // ... other component specific colors
  },
  // Spacing, typography, etc. can be added here
};

export const darkTheme = {
  colors: {
    // Background colors
    background: {
      primary: colors.neutral[900],
      secondary: colors.neutral[800],
      tertiary: colors.neutral[700],
    },
    // Text colors
    text: {
      primary: colors.neutral[50],
      secondary: colors.neutral[200],
      tertiary: colors.neutral[300],
      inverse: colors.neutral[900],
      link: colors.primary[400],
      error: colors.error[400],
      success: colors.success[400],
      warning: colors.warning[400],
    },
    // Border colors
    border: {
      light: colors.neutral[700],
      medium: colors.neutral[600],
      dark: colors.neutral[500],
    },
    // Component specific colors
    card: {
      background: colors.neutral[800],
      border: colors.neutral[700],
    },
    button: {
      primary: {
        background: colors.primary[500],
        text: colors.neutral[50],
        pressed: colors.primary[600],
      },
      secondary: {
        background: colors.secondary[500],
        text: colors.neutral[50],
        pressed: colors.secondary[600],
      },
      outline: {
        background: 'transparent',
        text: colors.primary[400],
        border: colors.primary[400],
        pressed: colors.primary[900],
      },
      ghost: {
        background: 'transparent',
        text: colors.primary[400],
        pressed: colors.primary[900],
      },
    },
    input: {
      background: colors.neutral[800],
      border: colors.neutral[600],
      focusBorder: colors.primary[500],
      placeholder: colors.neutral[500],
      text: colors.neutral[50],
    },
    // ... other component specific colors
  },
  // Spacing, typography, etc. can be added here
}; 