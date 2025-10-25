import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';

export const HomeScreen = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>歡迎回來！</Text>
      <Text style={styles.username}>@{user?.username}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="登出" onPress={logout} variant="outline" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  username: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  email: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
});