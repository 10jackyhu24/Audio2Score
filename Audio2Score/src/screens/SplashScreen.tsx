// screens/SplashScreen.tsx
// 啟動畫面 - 顯示音頻系統初始化進度
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ProgressBar } from '../components/ProgressBar';
import AudioManager from '../utils/AudioManager';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

interface SplashScreenProps {
  onInitComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onInitComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在初始化音頻系統...');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 設置進度回調
      AudioManager.setOnInitProgress((prog) => {
        setProgress(prog);
        
        if (prog < 20) {
          setStatus('正在初始化音頻系統...');
        } else if (prog < 40) {
          setStatus('正在配置音頻環境...');
        } else if (prog < 50) {
          setStatus('正在載入音頻資源...');
        } else if (prog < 90) {
          const poolProgress = Math.round(((prog - 40) / 50) * 20);
          setStatus(`音頻池載入中... (${poolProgress}/20)`);
        } else {
          setStatus('準備就緒！');
        }
      });

      // 初始化 AudioManager
      await AudioManager.initialize();
      
      // 等待一小段時間讓用戶看到 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onInitComplete();
    } catch (error) {
      console.error('初始化失敗:', error);
      // 即使失敗也繼續
      setProgress(100);
      setStatus('初始化完成（部分功能可能不可用）');
      setTimeout(onInitComplete, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎵 Audio2Score</Text>
        <Text style={styles.subtitle}>AI 音樂轉譜系統</Text>
        
        <View style={styles.progressContainer}>
          <ProgressBar 
            progress={progress}
            label={status}
            showPercentage={true}
            color={COLORS.primary}
            height={10}
          />
        </View>
        
        {progress < 100 && (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxl * 1.5,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  progressContainer: {
    width: '100%',
    marginVertical: SPACING.lg,
  },
  loader: {
    marginTop: SPACING.md,
  },
});

export default SplashScreen;
