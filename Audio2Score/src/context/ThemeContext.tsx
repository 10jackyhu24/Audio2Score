import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';
import { COLORS } from '../constants/theme';

type ThemeColors = typeof COLORS & {
  card: string; // 👈 add card color to types
};

type ThemeContextType = {
  colors: ThemeColors;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ======================
   LIGHT MODE COLORS
   ====================== */
const lightColors: ThemeColors = {
  ...COLORS,
  background: '#FFFFFF',
  text: '#222222',
  textSecondary: '#555555',

  // ⭐ soft light grey card background
  card: '#F2F2F7', // iOS style light card
};

/* ======================
   DARK MODE COLORS
   ====================== */
const darkColors: ThemeColors = {
  ...COLORS,
  background: '#050816',
  text: '#FFFFFF',
  textSecondary: '#CCCCCC',

  // ⭐ soft grey card — not WHITE for dark mode
  card: '#1C1C28',
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const colors = isDarkMode ? darkColors : lightColors;

  const value: ThemeContextType = {
    colors,
    isDarkMode,
    toggleTheme: () => setIsDarkMode(prev => !prev),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
};
