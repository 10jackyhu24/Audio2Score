// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { SPACING, FONT_SIZES } from '../constants/theme';

export const SettingsScreen = () => {
  const { logout } = useAuth();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { scale, setScale } = useFontSize();

  const fontOptions = [
    { label: '小', value: 0.9 },
    { label: '中', value: 1.0 },
    { label: '大', value: 1.1 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View
        style={[
          styles.card,
          { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' },
        ]}
      >
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDarkMode ? 'white' : '#222',
              fontSize: FONT_SIZES.lg * scale,
            },
          ]}
        >
          外觀
        </Text>

        <View style={styles.row}>
          <View style={styles.rowTextGroup}>
            <Text
              style={[
                styles.label,
                {
                  color: isDarkMode ? 'white' : '#222',
                  fontSize: FONT_SIZES.md * scale,
                },
              ]}
            >
              深色模式
            </Text>
            <Text
              style={[
                styles.labelHint,
                {
                  color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#666',
                  fontSize: 12 * scale,
                },
              ]}
            >
              在昏暗環境中讓畫面更舒適
            </Text>
          </View>
          <Switch value={isDarkMode} onValueChange={toggleTheme} />
        </View>
      </View>

      {/* 文字大小 */}
      <View
        style={[
          styles.card,
          { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' },
        ]}
      > 
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDarkMode ? 'white' : '#222',
              fontSize: FONT_SIZES.lg * scale,
            },
          ]}
        >
          文字大小
        </Text>

        <Text
          style={[
            styles.labelHint,
            {
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#666',
              fontSize: 12 * scale,
              marginBottom: SPACING.sm,
            },
          ]}
        >
          調整整體文字比例
        </Text>

        <View style={styles.fontRow}>
          {fontOptions.map(option => {
            const active = scale === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.fontButton,
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setScale(option.value)}
              >
                <Text
                  style={[
                    styles.fontButtonText,
                    {
                      color: active
                        ? 'white'
                        : isDarkMode
                        ? 'white'
                        : '#222',
                      fontSize: FONT_SIZES.md * option.value,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 帳號 */}
      <View
        style={[
          styles.card,
          { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' },
        ]}
      >
        <Text
          style={[
            styles.sectionTitle,
            {
              color: isDarkMode ? 'white' : '#222',
              fontSize: FONT_SIZES.lg * scale,
            },
          ]}
        >
          帳號
        </Text>

        <Text
          style={[
            styles.labelHint,
            {
              color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#666',
              fontSize: 12 * scale,
              marginBottom: SPACING.sm,
            },
          ]}
        >
          登出後可以使用其他帳號重新登入
        </Text>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            { borderColor: colors.primary },
          ]}
          onPress={logout}
        >
          <Text
            style={[
              styles.logoutText,
              {
                color: colors.primary,
                fontSize: FONT_SIZES.md * scale,
              },
            ]}
          >
            登出
          </Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  header: {
    fontWeight: '700',
    marginBottom: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: { fontWeight: '600', marginBottom: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
  },
  rowTextGroup: { flex: 1, paddingRight: SPACING.md },
  label: { fontWeight: '500', marginBottom: 2 },
  labelHint: { fontWeight: '400' },
  card: {
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  fontRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  fontButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  fontButtonText: { fontWeight: '500' },
  logoutButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
  },
  logoutText: { fontWeight: '600' },
  footerNote: { textAlign: 'center', marginTop: SPACING.md },
});

export default SettingsScreen;
