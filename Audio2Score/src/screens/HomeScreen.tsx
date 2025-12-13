// src/screens/HomeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HomeScreen = () => {
  const { user, logout } = useAuth();

  // basic device check
  const isLargeScreen = SCREEN_WIDTH >= 768 || Platform.OS === 'web';

  // choose background image and resize mode based on device
  const backgroundSource = isLargeScreen
    ? require('../../assets/wp5907462.webp')
    : require('../../assets/wp5907462.webp');

  const imageResizeMode: 'cover' | 'contain' = isLargeScreen ? 'cover' : 'cover';

  return (
    <ImageBackground
      source={backgroundSource}
      style={styles.background}
      resizeMode={imageResizeMode}
    >
      <SafeAreaView style={[styles.overlay, isLargeScreen && styles.overlayLarge]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>歡迎回來！</Text>
          <Text style={styles.username}>@{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          {/* ─── Introduction ───────────────────────── */}
          <View style={styles.introContainer}>
            <Text style={styles.subtitle}>🎵 關於此專案</Text>
            <Text style={styles.introText}>
              這個應用程式使用人工智慧將音訊轉換成樂譜。
              您可以上傳或錄製旋律，系統會分析音高、節奏及音符，
              並自動生成可視化的樂譜。這項技術結合了深度學習與音訊處理，
              讓音樂創作與學習更輕鬆。
            </Text>
          </View>

          {/* ─── Why We Do This ─────────────────────── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>🧠 為什麼我們要做這個？</Text>
            <Text style={styles.sectionText}>
              許多音樂學習者與創作者在靈感出現時，往往只有旋律的錄音，
              而沒有時間將它們轉換成樂譜。
              本專案的目標是幫助使用者快速將想法變成可視化的譜面，
              不論是創作、教學或分析，都能節省大量時間。
              同時也讓人工智慧更貼近音樂教育與創作的實際需求。
            </Text>
          </View>

          {/* ─── How to Use ─────────────────────────── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>🪄 如何使用</Text>
            <Text style={styles.sectionText}>
              <Text style={styles.step}>步驟 1：</Text> 前往「Record」頁面並上傳或錄製音訊（支援 WAV、MP4、MP3）。{'\n'}
              <Text style={styles.step}>步驟 2：</Text> 等待系統進行音訊分析，AI 會辨識音高與節奏。{'\n'}
              <Text style={styles.step}>步驟 3：</Text> 查看轉換結果，預覽生成的樂譜。{'\n'}
              <Text style={styles.step}>步驟 4：</Text> 可將樂譜儲存或分享，用於學習或創作。
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button title="登出" onPress={logout} variant="outline" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  // for big screens / web: center & limit width
  overlayLarge: {
    alignSelf: 'center',
    maxWidth: 720,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scroll: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: SPACING.md,
    marginTop: 40,
  },
  username: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  email: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  introContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: '90%',
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  introText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    color: 'white',
    textAlign: 'center',
  },
  sectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: '90%',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#00BFFF',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  sectionText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    color: 'white',
    textAlign: 'left',
  },
  step: {
    fontWeight: 'bold',
    color: '#FFD700',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: SPACING.xl,
  },
});

export default HomeScreen;
