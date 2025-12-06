// src/screens/HomeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

export const HomeScreen = () => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { scale } = useFontSize();

  return (
    <ImageBackground
      source={require('../../assets/background-music.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View
        style={[
          styles.overlay,
          { backgroundColor: 'rgba(0, 0, 0, 0.45)' }, // can tweak for dark/light later
        ]}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.greetingCard}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontSize: FONT_SIZES.xxl * scale,
                },
              ]}
            >
              歡迎回來！
            </Text>

            <View style={styles.userInfoRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {user?.username?.[0]?.toUpperCase() || 'A'}
                </Text>
              </View>
              <View>
                <Text style={styles.username}>@{user?.username}</Text>
                <Text style={styles.email}>{user?.email}</Text>
              </View>
            </View>
          </View>

          {/* ─── Project intro ──────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.subtitle}>🎵 關於此專案</Text>
            <Text style={styles.bodyText}>
              這個應用程式使用人工智慧將音訊轉換成樂譜。
              您可以上傳或錄製旋律，系統會分析音高、節奏及音符，
              並自動生成可視化的樂譜。
            </Text>
            <Text style={styles.bodyText}>
              透過結合深度學習與音訊處理，我們希望讓音樂創作與學習變得
              更直覺、更快速，也更有趣。
            </Text>
          </View>

          {/* ─── Why we do this ─────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🧠 為什麼我們要做這個？</Text>
            <Text style={styles.bodyText}>
              許多音樂學習者與創作者在靈感出現時，往往只有錄音檔，
              沒有時間將它們轉成樂譜。
            </Text>
            <Text style={styles.bodyText}>
              我們希望：
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• 快速把靈感轉成可視化的譜面</Text>
              <Text style={styles.bulletItem}>• 協助教學與分析，減少手動轉譜時間</Text>
              <Text style={styles.bulletItem}>• 讓 AI 更貼近音樂教育與創作實際需求</Text>
            </View>
          </View>

          {/* ─── How to use ─────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🪄 如何使用</Text>
            <View style={styles.stepRow}>
              <Text style={styles.stepBadge}>1</Text>
              <Text style={styles.stepText}>
                前往 <Text style={styles.highlight}>Record</Text> 頁面，上傳或錄製音訊（支援 WAV、MP3、MP4）。
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepBadge}>2</Text>
              <Text style={styles.stepText}>
                等待系統分析音高與節奏，產生對應的 MIDI 與樂譜資料。
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepBadge}>3</Text>
              <Text style={styles.stepText}>
                在 <Text style={styles.highlight}>MIDI 播放</Text> 或 <Text style={styles.highlight}>Library</Text> 中
                檢視、播放並管理轉譜結果。
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepBadge}>4</Text>
              <Text style={styles.stepText}>
                將生成的樂譜用於練習、創作或教學分享。
              </Text>
            </View>
          </View>

          {/* ─── Logout button ──────────────────────────────── */}
          <View style={styles.buttonContainer}>
            <Button title="登出" onPress={logout} variant="outline" />
          </View>
        </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.60)', // darker transparent overlay
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl * 1.5,
  },

  // Greeting card
  greetingCard: {
    backgroundColor: 'rgba(15, 15, 30, 0.85)',
    borderRadius: 18,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  welcomeLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: 'white',
    marginBottom: SPACING.md,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },
  username: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '600',
  },
  email: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Generic cards
  card: {
    backgroundColor: 'rgba(20, 20, 40, 0.85)',
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: SPACING.sm,
  },
  bodyText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#87CEFA',
    marginBottom: SPACING.sm,
  },
  bulletList: {
    marginTop: SPACING.xs,
  },
  bulletItem: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    marginVertical: 2,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#2b2b2b',
    fontWeight: '700',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
  },
  highlight: {
    color: '#FFB347',
    fontWeight: '700',
  },

  buttonContainer: {
    marginTop: SPACING.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
});
