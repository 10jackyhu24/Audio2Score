import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';
import { COLORS } from '../constants/theme';

type ThemeColors = typeof COLORS;

type ThemeContextType = {
  colors: ThemeColors;
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// You can tweak these if you want a different dark theme
const lightColors: ThemeColors = COLORS;
const darkColors: ThemeColors = {
  ...COLORS,
  background: '#050816',
  text: '#f5f5f5',
  textSecondary: '#cccccc',
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
