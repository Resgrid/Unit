import { createConfig } from '@gluestack-ui/themed';
import { lightTheme, darkTheme } from './theme';

// Convert our theme to Gluestack format
const gluestackLightTheme = {
  colors: {
    // Map our colors to Gluestack format
    primary50: lightTheme.colors.primary[50],
    primary100: lightTheme.colors.primary[100],
    primary200: lightTheme.colors.primary[200],
    primary300: lightTheme.colors.primary[300],
    primary400: lightTheme.colors.primary[400],
    primary500: lightTheme.colors.primary[500],
    primary600: lightTheme.colors.primary[600],
    primary700: lightTheme.colors.primary[700],
    primary800: lightTheme.colors.primary[800],
    primary900: lightTheme.colors.primary[900],
    
    // ... map other colors similarly
    
    // Background colors
    background: lightTheme.colors.background.primary,
    backgroundLight: lightTheme.colors.background.secondary,
    backgroundDark: lightTheme.colors.background.tertiary,
    
    // Text colors
    text: lightTheme.colors.text.primary,
    textLight: lightTheme.colors.text.secondary,
    textDark: lightTheme.colors.text.tertiary,
    textMuted: lightTheme.colors.text.tertiary,
    
    // Border colors
    border: lightTheme.colors.border.medium,
    borderLight: lightTheme.colors.border.light,
    borderDark: lightTheme.colors.border.dark,
    
    // ... other mappings
  },
  // ... other theme properties
};

const gluestackDarkTheme = {
  colors: {
    // Map our colors to Gluestack format for dark mode
    primary50: darkTheme.colors.primary[50],
    primary100: darkTheme.colors.primary[100],
    primary200: darkTheme.colors.primary[200],
    primary300: darkTheme.colors.primary[300],
    primary400: darkTheme.colors.primary[400],
    primary500: darkTheme.colors.primary[500],
    primary600: darkTheme.colors.primary[600],
    primary700: darkTheme.colors.primary[700],
    primary800: darkTheme.colors.primary[800],
    primary900: darkTheme.colors.primary[900],
    
    // ... map other colors similarly
    
    // Background colors
    background: darkTheme.colors.background.primary,
    backgroundLight: darkTheme.colors.background.secondary,
    backgroundDark: darkTheme.colors.background.tertiary,
    
    // Text colors
    text: darkTheme.colors.text.primary,
    textLight: darkTheme.colors.text.secondary,
    textDark: darkTheme.colors.text.tertiary,
    textMuted: darkTheme.colors.text.tertiary,
    
    // Border colors
    border: darkTheme.colors.border.medium,
    borderLight: darkTheme.colors.border.light,
    borderDark: darkTheme.colors.border.dark,
    
    // ... other mappings
  },
  // ... other theme properties
};

export const config = createConfig({
  light: gluestackLightTheme,
  dark: gluestackDarkTheme,
}); 