import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text
        style={[
          styles.header,
          {
            color: colors.text,
            fontSize: FONT_SIZES.xl * scale,
          },
        ]}
      >
        設定
      </Text>

      {/* 外觀 */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: FONT_SIZES.lg * scale },
          ]}
        >
          外觀
        </Text>

        <View style={styles.row}>
          <Text
            style={[
              styles.label,
              { color: colors.text, fontSize: FONT_SIZES.md * scale },
            ]}
          >
            深色模式
          </Text>
          <Switch value={isDarkMode} onValueChange={toggleTheme} />
        </View>
      </View>

      {/* 文字大小 */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: FONT_SIZES.lg * scale },
          ]}
        >
          文字大小
        </Text>

        <View style={styles.fontRow}>
          {fontOptions.map(option => {
            const active = scale === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.fontButton,
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => setScale(option.value)}
              >
                <Text
                  style={[
                    styles.fontButtonText,
                    {
                      color: active ? 'white' : colors.text,
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

      {/* 登出 */}
      <View style={styles.section}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: FONT_SIZES.lg * scale },
          ]}
        >
          帳號
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
              { color: colors.primary, fontSize: FONT_SIZES.md * scale },
            ]}
          >
            登出
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  header: {
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  label: {
    fontWeight: '400',
  },
  fontRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  fontButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  fontButtonText: {
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  logoutText: {
    fontWeight: '600',
  },
});
