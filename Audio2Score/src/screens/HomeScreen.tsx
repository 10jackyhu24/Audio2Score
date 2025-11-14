import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

export const HomeScreen = () => {
  const { user, logout } = useAuth();
  const { theme } = useThemeMode();
  const { fontSize } = useFontSize();

  const isDark = theme === 'dark';

  // Scale factor based on font size selection
  const scale =
    fontSize === 'small' ? 0.9 :
    fontSize === 'large' ? 1.2 :
    1.0;

  return (
    <ImageBackground
      source={require('../../assets/background-music.png')}
      style={styles.background}
      resizeMode="center"
    >
      <View style={[
        styles.overlay,
        isDark ? styles.overlayDark : styles.overlayLight
      ]}>
        {/* Title + user info */}
        <Text
          style={[
            styles.title,
            {
              fontSize: FONT_SIZES.xxl * scale,
              color: isDark ? 'white' : '#111',
            },
          ]}
        >
          歡迎回來！
        </Text>

        <Text
          style={[
            styles.username,
            {
              fontSize: FONT_SIZES.xl * scale,
              color: COLORS.primary,
            },
          ]}
        >
          @{user?.username}
        </Text>

        <Text
          style={[
            styles.email,
            {
              fontSize: FONT_SIZES.md * scale,
              color: isDark ? COLORS.textSecondary : '#444',
            },
          ]}
        >
          {user?.email}
        </Text>

        {/* Intro / about project */}
        <View style={[
          styles.introContainer,
          isDark ? styles.introDark : styles.introLight
        ]}>
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: FONT_SIZES.lg * scale,
                color: '#FFD700',
              },
            ]}
          >
            🎵 關於此專案
          </Text>

          <Text
            style={[
              styles.introText,
              {
                fontSize: FONT_SIZES.md * scale,
                color: isDark ? 'white' : '#222',
              },
            ]}
          >
            這個應用程式使用人工智慧將音訊轉換成樂譜。
            您可以上傳或錄製旋律，系統會分析音高、節奏及音符，
            並自動生成可視化的樂譜。這項技術結合了深度學習與音訊處理，
            讓音樂創作與學習更輕鬆。
          </Text>
        </View>

        {/* TODO: you can add "How to use" / steps section here later, using same font scaling */}

        <View style={styles.buttonContainer}>
          <Button title="登出" onPress={logout} variant="outline" />
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  username: {
    marginBottom: SPACING.sm,
  },
  email: {
    marginBottom: SPACING.lg,
  },
  introContainer: {
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: '90%',
  },
  introDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  introLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  subtitle: {
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  introText: {
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
});
