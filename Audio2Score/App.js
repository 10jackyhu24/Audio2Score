import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

export default function App() {
  const [isAudioReady, setIsAudioReady] = useState(false);

  // 顯示 SplashScreen 直到音頻系統初始化完成
  if (!isAudioReady) {
    return <SplashScreen onInitComplete={() => setIsAudioReady(true)} />;
  }

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
