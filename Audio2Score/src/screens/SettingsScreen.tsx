import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';

export const SettingsScreen = () => {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useThemeMode();
  const { fontSize, setFontSize } = useFontSize();

  const themedStyles = theme === 'light' ? styles.light : styles.dark;

  return (
    <View style={[styles.container, themedStyles]}>
      <Text style={[styles.title, themedStyles]}>設定</Text>

      {/* Theme Toggle */}
      <View style={styles.settingRow}>
        <Text style={[styles.label, themedStyles]}>深色模式</Text>
        <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
      </View>

      {/* Font Size Selector */}
      <View style={styles.settingRow}>
        <Text style={[styles.label, themedStyles]}>文字大小: {fontSize}</Text>
      </View>

      <View style={styles.fontButtons}>
        <TouchableOpacity
          style={styles.fontButton}
          onPress={() => setFontSize('small')}
        >
          <Text style={styles.fontButtonText}>小</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fontButton}
          onPress={() => setFontSize('medium')}
        >
          <Text style={styles.fontButtonText}>中</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fontButton}
          onPress={() => setFontSize('large')}
        >
          <Text style={styles.fontButtonText}>大</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>登出</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 25,
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  label: {
    fontSize: 18,
  },

  fontButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },

  fontButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },

  fontButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#ff3b30',
    padding: 12,
    borderRadius: 8,
  },

  logoutText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },

  // Light / dark styles
  light: {
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  dark: {
    backgroundColor: '#111111',
    color: '#FFFFFF',
  },
});
