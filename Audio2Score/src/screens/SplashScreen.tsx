// screens/SplashScreen.tsx
// 啟動畫面 - 顯示音頻系統初始化進度
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ProgressBar } from '../components/ProgressBar';
import AudioManager from '../utils/AudioManager';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';

interface SplashScreenProps {
  onInitComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onInitComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('準備初始化...');
  const initStarted = useRef(false); // 防止 React Strict Mode 下重複執行

  useEffect(() => {
    if (!initStarted.current) {
        initStarted.current = true;
        initializeApp();
    }
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Splash: 開始初始化...');
      
      // 1. 綁定進度監聽
      AudioManager.setOnInitProgress((prog) => {
        // 四捨五入避免小數點過多
        const cleanProg = Math.round(prog);
        setProgress(cleanProg);
        
        if (cleanProg < 20) setStatus('初始化音頻引擎...');
        else if (cleanProg < 50) setStatus(`正在載入鋼琴音色 (${cleanProg}%)`);
        else if (cleanProg < 90) setStatus(`正在載入鋼琴音色 (${cleanProg}%)`);
        else setStatus('即將完成...');
      });

      // 2. 設定一個較長的超時保護 (60秒)，避免無限卡死
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ 初始化耗時過長，強制進入');
        onInitComplete();
      }, 60000); 

      // 3. 執行初始化 (這會觸發真正的下載)
      await AudioManager.initialize();
      
      // 4. 完成
      clearTimeout(timeoutId);
      setStatus('載入完成！');
      
      // 給予一點緩衝時間讓用戶看到 100%
      setTimeout(() => {
          onInitComplete();
      }, 500);

    } catch (error) {
      console.error('❌ Splash 初始化錯誤:', error);
      setStatus('初始化發生錯誤，嘗試進入...');
      setTimeout(onInitComplete, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎵 Audio2Score</Text>
        <Text style={styles.subtitle}>正在準備您的鋼琴音色...</Text>
        
        <View style={styles.progressContainer}>
           {/* 如果你有 ProgressBar 組件 */}
          <ProgressBar 
            progress={progress}
            label={status}
            showPercentage={true}
            color={COLORS.primary}
            height={10}
          />
        </View>
        
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        
        {/* 如果載入真的很久，可以顯示文字安撫用戶 */}
        {progress > 0 && progress < 100 && (
            <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
                初次載入 88 個高音質音檔可能需要一點時間
            </Text>
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
    fontSize: 32, // 或使用你的 FONT_SIZES.xxl
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary || '#666',
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    marginVertical: 20,
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;
