// src/screens/MidiPlayerScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import MIDIViewer from '../components/MIDIViewer';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { MIDIData } from '../types/midi';
import { useRoute } from '@react-navigation/native';

export const MidiPlayerScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const { scale } = useFontSize();
  const route = useRoute();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [midiData, setMidiData] = useState<MIDIData | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 从导航参数加载 MIDI
  useEffect(() => {
    const params = route.params as { midiUrl?: string; filename?: string } | undefined;
    if (params?.midiUrl) {
      setSelectedFile(params.midiUrl);
      setFileName(params.filename || 'Library MIDI');
    }
  }, [route.params]);

  const handleLoadComplete = (data: MIDIData) => {
    setMidiData(data);
    console.log('MIDI 加載完成:', data);
  };

  const handlePlaybackEnd = () => {
    console.log('播放結束');
    Alert.alert('提示', '播放結束');
  };

  const handlePickDocument = async () => {
    try {
      setIsUploading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/midi', 'audio/x-midi', '.mid', '.midi'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsUploading(false);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file.uri);
        setFileName(file.name);
        Alert.alert('成功', `已選擇文件：${file.name}`);
      }
      
      setIsUploading(false);
    } catch (error) {
      setIsUploading(false);
      console.error('選擇文件錯誤:', error);
      Alert.alert('錯誤', '選擇文件時發生錯誤，請重試');
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileName(null);
    setMidiData(null);
  };

  const speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1.0 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
  ];

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 標題區域 */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: FONT_SIZES.xxl * scale,
              },
            ]}
          >
            🎹 MIDI 播放器
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#666',
                fontSize: FONT_SIZES.md * scale,
              },
            ]}
          >
            選擇一個 MIDI 文件開始播放
          </Text>
        </View>

        {/* 文件上傳區域 */}
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
                color: colors.text,
                fontSize: FONT_SIZES.lg * scale,
              },
            ]}
          >
            上傳 MIDI 文件
          </Text>
          
          <Text
            style={[
              styles.hint,
              {
                color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#888',
                fontSize: FONT_SIZES.sm * scale,
              },
            ]}
          >
            支援 .mid 和 .midi 格式
          </Text>

          {selectedFile ? (
            <View style={styles.uploadedFileContainer}>
              <View
                style={[
                  styles.uploadedFile,
                  {
                    backgroundColor: isDarkMode ? '#3b3b3b' : 'white',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.fileInfo}>
                  <Text style={styles.fileIcon}>🎵</Text>
                  <Text
                    style={[
                      styles.uploadedFileName,
                      {
                        color: colors.text,
                        fontSize: FONT_SIZES.md * scale,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {fileName || '已選擇文件'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.clearButton,
                    { backgroundColor: isDarkMode ? '#4b4b4b' : '#f0f0f0' },
                  ]}
                  onPress={handleClearFile}
                >
                  <Text
                    style={[
                      styles.clearButtonText,
                      { color: colors.text, fontSize: FONT_SIZES.sm * scale },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.uploadButton,
                {
                  backgroundColor: isDarkMode ? '#3b3b3b' : 'white',
                  borderColor: isDarkMode ? '#4b4b4b' : '#ddd',
                },
              ]}
              onPress={handlePickDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📂</Text>
                  <Text
                    style={[
                      styles.uploadButtonText,
                      {
                        color: colors.text,
                        fontSize: FONT_SIZES.md * scale,
                      },
                    ]}
                  >
                    點擊選擇 MIDI 文件
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 播放速度控制 */}
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
                color: colors.text,
                fontSize: FONT_SIZES.lg * scale,
              },
            ]}
          >
            播放速度
          </Text>
          
          <View style={styles.speedOptions}>
            {speedOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.speedButton,
                  {
                    backgroundColor: playbackSpeed === option.value
                      ? colors.primary
                      : isDarkMode
                      ? '#3b3b3b'
                      : 'white',
                    borderColor: playbackSpeed === option.value
                      ? colors.primary
                      : isDarkMode
                      ? '#4b4b4b'
                      : '#ddd',
                  },
                ]}
                onPress={() => setPlaybackSpeed(option.value)}
              >
                <Text
                  style={[
                    styles.speedText,
                    {
                      color: playbackSpeed === option.value
                        ? 'white'
                        : colors.text,
                      fontSize: FONT_SIZES.sm * scale,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* MIDI 播放器 */}
        {selectedFile ? (
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
                  color: colors.text,
                  fontSize: FONT_SIZES.lg * scale,
                },
              ]}
            >
              播放視圖
            </Text>
            
            <View style={styles.midiViewerContainer}>
              <MIDIViewer
                midiFilePath={selectedFile}
                autoPlay={false}
                speed={playbackSpeed}
                onLoadComplete={handleLoadComplete}
                onPlaybackEnd={handlePlaybackEnd}
                showControls={true}
                height={500}
              />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' },
            ]}
          >
            <View style={styles.emptyState}>
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#999',
                    fontSize: FONT_SIZES.md * scale,
                  },
                ]}
              >
                請選擇一個文件開始播放
              </Text>
            </View>
          </View>
        )}

        {/* 說明區域 */}
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
                color: colors.text,
                fontSize: FONT_SIZES.lg * scale,
              },
            ]}
          >
            ℹ️ 使用說明
          </Text>
          
          <View style={styles.infoList}>
            <Text
              style={[
                styles.infoItem,
                {
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#555',
                  fontSize: FONT_SIZES.sm * scale,
                },
              ]}
            >
              • 點擊上方按鈕上傳 MIDI 文件（支援 .mid 和 .midi 格式）
            </Text>
            <Text
              style={[
                styles.infoItem,
                {
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#555',
                  fontSize: FONT_SIZES.sm * scale,
                },
              ]}
            >
              • 使用播放控制按鈕控制播放、暫停和進度
            </Text>
            <Text
              style={[
                styles.infoItem,
                {
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#555',
                  fontSize: FONT_SIZES.sm * scale,
                },
              ]}
            >
              • 調整播放速度以適應不同的練習需求
            </Text>
            <Text
              style={[
                styles.infoItem,
                {
                  color: isDarkMode ? 'rgba(255,255,255,0.8)' : '#555',
                  fontSize: FONT_SIZES.sm * scale,
                },
              ]}
            >
              • 觀察下落的音符與鋼琴鍵盤互動
            </Text>
          </View>
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
    marginBottom: SPACING.lg,
  },
  title: {
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontWeight: '400',
  },
  card: {
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  hint: {
    fontWeight: '400',
    marginBottom: SPACING.md,
  },
  uploadButton: {
    padding: SPACING.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  uploadButtonText: {
    fontWeight: '500',
  },
  uploadedFileContainer: {
    marginTop: SPACING.sm,
  },
  uploadedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  uploadedFileName: {
    fontWeight: '500',
    flex: 1,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontWeight: '700',
    lineHeight: 20,
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  speedButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 2,
    minWidth: 60,
    alignItems: 'center',
  },
  speedText: {
    fontWeight: '600',
  },
  midiViewerContainer: {
    marginTop: SPACING.sm,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyState: {
    paddingVertical: SPACING.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  infoList: {
    gap: SPACING.sm,
  },
  infoItem: {
    lineHeight: 22,
  },
});

export default MidiPlayerScreen;
