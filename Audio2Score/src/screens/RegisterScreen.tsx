import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export const RegisterScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const { register, isLoading } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: {
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    // Username 驗證
    if (!username) {
      newErrors.username = '請輸入使用者名稱';
    } else if (username.length < 3) {
      newErrors.username = '使用者名稱至少需要 3 個字元';
    } else if (username.length > 20) {
      newErrors.username = '使用者名稱不能超過 20 個字元';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = '使用者名稱只能包含英文、數字和底線';
    }

    // Email 驗證
    if (!email) {
      newErrors.email = '請輸入電子郵件';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '請輸入有效的電子郵件';
    }

    // Password 驗證
    if (!password) {
      newErrors.password = '請輸入密碼';
    } else if (password.length < 6) {
      newErrors.password = '密碼至少需要 6 個字元';
    } else if (password.length > 50) {
      newErrors.password = '密碼不能超過 50 個字元';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      newErrors.password = '密碼需要包含大小寫字母或字母加數字';
    }

    // Confirm Password 驗證
    if (!confirmPassword) {
      newErrors.confirmPassword = '請再次輸入密碼';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '兩次輸入的密碼不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      await register({ username, email, password });
      Alert.alert(
        '註冊成功',
        '您的帳號已成功建立！',
        [
          {
            text: '確定',
            onPress: () => {
              // 註冊成功後會自動導航到 Home（由 AppNavigator 處理）
            },
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error?.message || '註冊失敗，請稍後再試';
      Alert.alert('註冊失敗', errorMessage);
    }
  };

  const handleBackToLogin = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>建立新帳號</Text>
          <Text style={styles.subtitle}>加入 Audio2Score</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="使用者名稱"
            placeholder="輸入使用者名稱"
            value={username}
            onChangeText={(text: string) => {
              setUsername(text);
              if (errors.username) setErrors({ ...errors, username: undefined });
            }}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="電子郵件"
            placeholder="example@email.com"
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="密碼"
            placeholder="至少 6 個字元"
            value={password}
            onChangeText={(text: string) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label="確認密碼"
            placeholder="再次輸入密碼"
            value={confirmPassword}
            onChangeText={(text: string) => {
              setConfirmPassword(text);
              if (errors.confirmPassword)
                setErrors({ ...errors, confirmPassword: undefined });
            }}
            error={errors.confirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.passwordHint}>
            <Text style={styles.passwordHintText}>
              • 至少 6 個字元{'\n'}
              • 包含大小寫字母或字母加數字{'\n'}
              • 不能超過 50 個字元
            </Text>
          </View>

          <Button
            title="註冊"
            onPress={handleRegister}
            loading={isLoading}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={handleBackToLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginLinkText}>
              已經有帳號？ <Text style={styles.loginLinkBold}>立即登入</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            註冊即表示您同意我們的服務條款和隱私政策
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  form: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  passwordHint: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  passwordHintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  divider: {
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  loginLinkText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  loginLinkBold: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
