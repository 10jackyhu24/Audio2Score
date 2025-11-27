import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

export default function App() {
  const [isAudioReady, setIsAudioReady] = useState(false);

  useEffect(() => {
    // 解鎖所有方向，讓應用可以跟隨手機方向自動旋轉
    ScreenOrientation.unlockAsync();

    // 監聽方向變化（用於調試）
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      console.log('📱 螢幕方向已改變:', event.orientationInfo.orientation);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

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
