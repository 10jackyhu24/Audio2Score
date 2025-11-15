import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <FontSizeProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </FontSizeProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
