// src/screens/RecordScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '../components/Button';
import { API_URL as AUTH_API_URL, getStoredToken } from '../services/authService';
import AudioManager from '../utils/AudioManager';

// theme + font size
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { FONT_SIZES, SPACING } from '../constants/theme';

// MIDIViewer and types
import MIDIViewer, { MIDIViewerHandle } from '../components/MIDIViewer';
import type { MIDIData as MIDIDataType } from '../types/midi';
import { ProgressBar } from '../components/ProgressBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
};

// Model type
type ModelInfo = {
  name: string;
  path: string;
  is_pretrained: boolean;
};

// Using global API_URL (from authService)
const API_URL = AUTH_API_URL; // includes /api
const SERVER_UPLOAD_URL = `${API_URL}/upload`;
console.log('🔵 [上傳] 上傳 URL:', SERVER_UPLOAD_URL);

export const RecordScreen = () => {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // model-related state
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // MIDI related state
  const [midiData, setMidiData] = useState<MIDIDataType | null>(null);
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle');
  const [convertedMidiUrl, setConvertedMidiUrl] = useState<string | null>(null);

  // upload & conversion progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [midiLoadProgress, setMidiLoadProgress] = useState(0);

  // theme + font scaling
  const { colors, isDarkMode } = useTheme();
  const { scale } = useFontSize();

  // MIDIViewer ref & volume
  const midiViewerRef = useRef<MIDIViewerHandle>(null);
  const userVolumeRef = useRef<number>(0.5);
  const playerId = 'record-screen';

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  const fetchAvailableModels = async () => {
    try {
      setIsLoadingModels(true);
      const response = await fetch(`${API_URL}/upload/models`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        if (data.models && data.models.length > 0) {
          setSelectedModel(data.models[0].path);
        }
        console.log('✅ [模型] 載入模型列表:', data.models);
      } else {
        console.warn('⚠️ [模型] 無法載入模型列表');
      }
    } catch (error) {
      console.error('❌ [模型] 載入模型列表錯誤:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Save to library
  const saveToLibrary = async (uploadResult: any) => {
    try {
      const token = await getStoredToken();
      if (!token) return;

      const username = uploadResult.user;
      const wavPath = uploadResult.saved_filename ? `${username}/${uploadResult.saved_filename}` : null;
      const midiPath = uploadResult.midi_filename ? `${username}/${uploadResult.midi_filename}` : null;

      const libraryData = {
        original_filename: uploadResult.original_filename || file?.name,
        saved_filename: uploadResult.saved_filename || uploadResult.filename,
        file_type: file?.mimeType || 'audio/mpeg',
        file_size: file?.size || 0,
        wav_filename: wavPath,
        midi_filename: midiPath,
      };

      const response = await fetch(`${API_URL}/upload/library/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(libraryData),
      });

      if (response.ok) {
        console.log('✅ 已保存到圖書館');
      } else {
        console.warn('⚠️ 保存到圖書館失敗');
      }
    } catch (error) {
      console.error('❌ 保存到圖書館錯誤:', error);
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*',
          'audio/mpeg',
          'audio/mp4',
          'audio/wav',
          'audio/x-wav',
          'audio/aac',
          'audio/flac',
          'audio/ogg',
          'video/*',
          'video/mp4',
          'video/quicktime',
          '*/*',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset) return;

      console.log('🔵 [檔案選擇] 檔案資訊:', {
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        uri: asset.uri,
      });

      let correctedMimeType = asset.mimeType;
      if (!correctedMimeType || correctedMimeType === 'text/plain') {
        const extension = asset.name?.split('.').pop()?.toLowerCase();
        const mimeMap: { [key: string]: string } = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          m4a: 'audio/mp4',
          mp4: 'audio/mp4',
          aac: 'audio/aac',
          flac: 'audio/flac',
          ogg: 'audio/ogg',
        };
        const ext = extension ?? '';
        correctedMimeType = mimeMap[ext] || 'application/octet-stream';
        console.log('🔵 [檔案選擇] 修正 MIME 類型:', {
          原始類型: asset.mimeType,
          副檔名: extension,
          修正類型: correctedMimeType,
        });
      }

      console.log('🛑 [RecordScreen] 選擇新檔案，停止之前的音訊播放');
      if (midiViewerRef.current) {
        const currentVolume = midiViewerRef.current.getCurrentVolume();
        userVolumeRef.current = currentVolume;
        console.log(`💾 [RecordScreen] 保存用戶音量設置: ${(currentVolume * 100).toFixed(0)}%`);
        midiViewerRef.current.stopPlayback();
      }
      AudioManager.stopAll();

      setFile({
        uri: asset.uri,
        name: asset.name ?? 'upload',
        size: asset.size ?? null,
        mimeType: correctedMimeType,
      });

      setMidiData(null);
      setConversionStatus('idle');
      setConvertedMidiUrl(null);
      setUploadProgress(0);
      setConversionProgress(0);
      setMidiLoadProgress(0);
    } catch (e: any) {
      console.error('檔案選擇錯誤:', e);
      Alert.alert('選取檔案失敗', e?.message ?? '請再試一次');
    }
  };

  // Fetch converted MIDI
  const fetchConvertedMIDI = async (filename: string, midiFilename?: string, username?: string) => {
    try {
      setConversionStatus('converting');
      setConversionProgress(0);

      const midiName = midiFilename || `${filename.replace(/\.[^/.]+$/, '')}_basic_pitch.mid`;

      const midiUrl = username
        ? `${API_URL}/files/${username}/${midiName}`
        : `${API_URL}/files/${midiName}`;

      console.log('🔵 [MIDI 轉換] 嘗試獲取 MIDI 文件:', midiUrl);

      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          setConversionProgress(((attempts + 1) / maxAttempts) * 100);

          const token = await getStoredToken();
          const checkResponse = await fetch(midiUrl, {
            method: 'HEAD',
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                  'ngrok-skip-browser-warning': 'true',
                }
              : {
                  'ngrok-skip-browser-warning': 'true',
                },
          });

          if (checkResponse.ok) {
            setConvertedMidiUrl(midiUrl);
            setConversionStatus('success');
            console.log('✅ [MIDI 轉換] MIDI 文件可用:', midiUrl);
            return;
          }
        } catch (error) {
          console.log(`⏳ [MIDI 轉換] 嘗試 ${attempts + 1}/${maxAttempts} - 文件尚未準備好`);
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      throw new Error('MIDI 文件在預期時間內未準備好');
    } catch (error) {
      console.error('❌ [MIDI 轉換] 獲取 MIDI 失敗:', error);
      setConversionStatus('error');

      console.log('🔵 [MIDI 轉換] 使用模擬數據作為後備方案');
      setTimeout(() => {
        const mockMidiData: MIDIDataType = {
          notes: [
            { note: 'C4', startTime: 0, duration: 1, velocity: 80 },
            { note: 'E4', startTime: 0.5, duration: 1, velocity: 90 },
            { note: 'G4', startTime: 1, duration: 1, velocity: 85 },
            { note: 'C5', startTime: 1.5, duration: 1, velocity: 95 },
            { note: 'E5', startTime: 2, duration: 1, velocity: 88 },
            { note: 'G5', startTime: 2.5, duration: 1, velocity: 92 },
            { note: 'A4', startTime: 3, duration: 0.5, velocity: 75 },
            { note: 'B4', startTime: 3.5, duration: 0.5, velocity: 78 },
            { note: 'C5', startTime: 4, duration: 2, velocity: 100 },
          ],
          duration: 6,
          tempo: 120,
          timeSignature: [4, 4],
        };
        setMidiData(mockMidiData);
        setConversionStatus('success');
        console.log('✅ [MIDI 轉換] 使用模擬 MIDI 數據');
      }, 1000);
    }
  };

  // Web upload with progress (XHR)
  const uploadWithProgress = (
    url: string,
    formData: FormData,
    token: string,
    onProgress: (progress: number) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = e.loaded / e.total;
          onProgress(progress);
          console.log(`📤 上傳進度: ${(progress * 100).toFixed(1)}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            console.log('✅ [上傳] 成功:', result);

            Alert.alert('上傳成功', `檔案 ${result.original_filename || result.filename} 上傳成功！`);
            resolve(result);
          } catch (e) {
            reject(new Error('解析回應失敗'));
          }
        } else {
          reject(new Error(`上傳失敗 (${xhr.status}): ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('網路錯誤'));
      });

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
      xhr.send(formData);
    });
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('請先選擇檔案');
      return;
    }

    try {
      console.log('🛑 [RecordScreen] 開始上傳，停止之前的音訊播放');
      if (midiViewerRef.current) {
        const currentVolume = midiViewerRef.current.getCurrentVolume();
        userVolumeRef.current = currentVolume;
        console.log(`💾 [RecordScreen] 保存用戶音量設置: ${(currentVolume * 100).toFixed(0)}%`);
        midiViewerRef.current.stopPlayback();
      }
      AudioManager.stopAll();

      setIsUploading(true);
      setMidiData(null);
      setConversionStatus('idle');
      setUploadProgress(0);

      console.log('🔵 [上傳] 開始上傳流程...');

      const token = await getStoredToken();
      if (!token) {
        Alert.alert('未登入', '請先登入才能上傳檔案');
        setIsUploading(false);
        return;
      }
      console.log('🔵 [上傳] Token 已取得');
      setUploadProgress(10);

      let fileUri = file.uri;
      if (Platform.OS !== 'web' && Platform.OS === 'android' && !fileUri.startsWith('file://')) {
        fileUri = `file://${fileUri}`;
      }

      console.log('🔵 [上傳] 檔案資訊:', {
        uri: fileUri,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        平台: Platform.OS,
      });
      setUploadProgress(20);

      const formData = new FormData();
      setUploadProgress(15);

      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        setUploadProgress(25);

        try {
          const fileForUpload = new File([blob], file.name, {
            type: file.mimeType || 'application/octet-stream',
          });
          formData.append('file', fileForUpload);
        } catch (e) {
          (formData as any).append('file', blob, file.name);
        }

        if (selectedModel && selectedModel !== 'basic-pitch') {
          formData.append('model_path', selectedModel);
        }

        setUploadProgress(30);

        console.log('🔵 [上傳] 使用 XMLHttpRequest 上傳到:', SERVER_UPLOAD_URL);
        console.log('🔵 [上傳] 使用模型:', selectedModel || 'Basic Pitch (預訓練)');

        const result = await uploadWithProgress(SERVER_UPLOAD_URL, formData, token, (progress) => {
          setUploadProgress(30 + progress * 65);
        });

        setUploadProgress(100);
        console.log('✅ [上傳] 成功:', result);

        await saveToLibrary(result);

        if (result.saved_filename || result.filename) {
          const filename = result.saved_filename || result.filename;
          await fetchConvertedMIDI(filename, result.midi_filename, result.user);
        }
      } else {
        formData.append('file', {
          uri: fileUri,
          name: file.name,
          type: file.mimeType || 'audio/mpeg',
        } as any);

        if (selectedModel && selectedModel !== 'basic-pitch') {
          formData.append('model_path', selectedModel);
        }

        setUploadProgress(30);

        console.log('🔵 [上傳] 發送請求到:', SERVER_UPLOAD_URL);
        console.log('🔵 [上傳] 使用模型:', selectedModel || 'Basic Pitch (預訓練)');

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev < 85) return prev + 3;
            return prev;
          });
        }, 150);

        const response = await fetch(SERVER_UPLOAD_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(90);

        console.log('🔵 [上傳] 回應狀態:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('❌ [上傳] 錯誤回應:', errorText);
          throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        setUploadProgress(100);
        console.log('✅ [上傳] 成功:', result);

        Alert.alert('上傳成功', `檔案 ${result.original_filename || result.filename} 上傳成功！`);

        await saveToLibrary(result);

        if (result.saved_filename || result.filename) {
          const filename = result.saved_filename || result.filename;
          await fetchConvertedMIDI(filename, result.midi_filename, result.user);
        }
      }
    } catch (error: any) {
      console.error('❌ [上傳] 錯誤:', error);
      Alert.alert('上傳失敗', error.message || '請稍後再試');
      setConversionStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const renderConversionStatus = () => {
    switch (conversionStatus) {
      case 'converting':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>🎵 正在轉換為 MIDI...</Text>
            <ProgressBar
              progress={conversionProgress}
              label="MIDI 轉換進度"
              showPercentage={true}
              color={colors.primary}
            />
            {midiLoadProgress > 0 && midiLoadProgress < 100 && (
              <ProgressBar
                progress={midiLoadProgress}
                label="MIDI 加載進度"
                showPercentage={true}
                color="#4CAF50"
              />
            )}
          </View>
        );
      case 'success':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: '#4CAF50' }]}>✅ MIDI 轉換完成！</Text>
            <ProgressBar progress={100} label="完成" showPercentage={false} color="#4CAF50" />
          </View>
        );
      case 'error':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: '#F44336' }]}>❌ MIDI 轉換失敗，顯示模擬數據</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const isLargeScreen = SCREEN_WIDTH >= 768 || Platform.OS === 'web';

  return (
    <ImageBackground
      source={require('../../assets/wp5907462.webp')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backdrop} />

      <SafeAreaView style={[styles.overlay, isLargeScreen && styles.overlayLarge]} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.title,
              {
                color: 'white',
                fontSize: FONT_SIZES.xl * scale,
              },
            ]}
          >
            上傳音訊 / 影片檔
          </Text>

          <View style={[styles.card, { backgroundColor: isDarkMode ? 'rgba(43,43,43,0.92)' : 'rgba(247,247,247,0.92)' }]}>
            {file ? (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, fontSize: FONT_SIZES.md * scale }]}>
                  檔名：
                  <Text style={[styles.value, { color: colors.primary }]}>{file.name}</Text>
                </Text>

                {!!file.size && (
                  <Text style={[styles.label, { color: colors.textSecondary, fontSize: FONT_SIZES.md * scale }]}>
                    大小：
                    <Text style={[styles.value, { color: colors.primary }]}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </Text>
                )}

                <Text style={[styles.label, { color: colors.textSecondary, fontSize: FONT_SIZES.md * scale }]}>
                  MIME：
                  <Text style={[styles.value, { color: colors.primary }]}>{file.mimeType ?? '未知'}</Text>
                </Text>
              </>
            ) : (
              <Text style={[styles.placeholder, { color: colors.textSecondary, fontSize: FONT_SIZES.md * scale }]}>
                尚未選擇檔案
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Button title="選擇檔案" onPress={pickFile} />

            <View style={{ height: 12 }} />

            <View style={styles.modelSelectorContainer}>
              <Text style={[styles.modelLabel, { color: colors.textSecondary, fontSize: FONT_SIZES.sm * scale }]}>
                選擇轉換模型：
              </Text>

              <TouchableOpacity
                style={[
                  styles.modelSelector,
                  {
                    backgroundColor: isDarkMode ? 'rgba(43,43,43,0.92)' : 'rgba(247,247,247,0.92)',
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => setShowModelPicker(!showModelPicker)}
                disabled={isLoadingModels}
              >
                <Text style={[styles.modelSelectorText, { color: colors.text, fontSize: FONT_SIZES.md * scale }]}>
                  {isLoadingModels
                    ? '載入中...'
                    : availableModels.find((m) => m.path === selectedModel)?.name || '選擇模型'}
                </Text>
                <Text style={[styles.modelSelectorArrow, { color: colors.primary }]}>
                  {showModelPicker ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showModelPicker && (
                <View style={[styles.modelOptions, { backgroundColor: isDarkMode ? '#2b2b2b' : 'rgba(255,255,255,0.95)' }]}>
                  {availableModels.map((model) => (
                    <TouchableOpacity
                      key={model.path}
                      style={[
                        styles.modelOption,
                        selectedModel === model.path && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => {
                        setSelectedModel(model.path);
                        setShowModelPicker(false);
                        console.log('🔵 [模型] 選擇模型:', model.name);
                      }}
                    >
                      <Text
                        style={[
                          styles.modelOptionText,
                          {
                            color: selectedModel === model.path ? colors.primary : colors.text,
                            fontSize: FONT_SIZES.md * scale,
                          },
                        ]}
                      >
                        {selectedModel === model.path && '✓ '}
                        {model.name}
                      </Text>

                      {model.is_pretrained && (
                        <View style={styles.pretrainedBadge}>
                          <Text style={styles.pretrainedBadgeText}>預訓練</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 12 }} />

            <Button title={isUploading ? '上傳中…' : '上傳'} onPress={uploadFile} disabled={!file || isUploading} />
          </View>

          {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
            <View style={[styles.statusContainer, { backgroundColor: isDarkMode ? 'rgba(43,43,43,0.92)' : 'rgba(247,247,247,0.92)' }]}>
              <ProgressBar progress={uploadProgress} label="上傳進度" showPercentage={true} color={colors.primary} />
            </View>
          )}

          {renderConversionStatus()}

          {(midiData || convertedMidiUrl) && conversionStatus === 'success' && (
            <View style={styles.midiViewerContainer}>
              <Text style={[styles.midiViewerTitle, { color: 'white', fontSize: FONT_SIZES.lg * scale }]}>
                🎹 MIDI 預覽
              </Text>

              <View style={[styles.midiViewerWrapper, { backgroundColor: isDarkMode ? 'rgba(43,43,43,0.92)' : 'rgba(247,247,247,0.92)' }]}>
                <MIDIViewer
                  ref={midiViewerRef}
                  playerId={playerId}
                  midiData={midiData ?? undefined}
                  midiUrl={convertedMidiUrl ?? undefined}
                  autoPlay={false}
                  speed={1}
                  height={400}
                  showControls={true}
                  onLoadComplete={(data: any) => {
                    console.log('MIDI 加載完成', data);
                    console.log(`🔊 [RecordScreen] 恢復用戶音量設置: ${(userVolumeRef.current * 100).toFixed(0)}%`);
                    AudioManager.setVolume(userVolumeRef.current);
                  }}
                  onPlaybackEnd={() => console.log('播放結束')}
                />
              </View>
            </View>
          )}

          <Text style={[styles.hint, { color: 'rgba(255,255,255,0.8)', fontSize: 12 * scale }]}>
            支援：WAV、MP4、MP3、M4A 等常見格式。{'\n'}
            {'\n'}
            當前上傳 URL: {SERVER_UPLOAD_URL}
            {'\n'}
            模式: {API_URL.includes('ngrok') ? 'ngrok (遠端)' : '本地網路'}
          </Text>

          <Text style={[styles.debugInfo, { color: 'rgba(255,255,255,0.75)', fontSize: 11 * scale }]}>
            💡 如果上傳沒有反應：{'\n'}
            1️⃣ 確認已執行 start.ps1 啟動後端和 ngrok{'\n'}
            2️⃣ 檢查 ngrok URL 是否正確（免費版每次重啟都會變）{'\n'}
            3️⃣ 查看控制台 (console.log) 的錯誤訊息
          </Text>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  overlay: { flex: 1, width: '100%', padding: SPACING.lg },
  overlayLarge: { alignSelf: 'center', width: '100%', maxWidth: 720, borderRadius: 16, overflow: 'hidden' },

  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  title: { fontWeight: '700', textAlign: 'center', marginBottom: 16 },

  card: { borderRadius: 12, padding: 16, marginBottom: 20 },

  label: { marginBottom: 6 },
  value: { fontWeight: '600' },
  placeholder: { textAlign: 'center' },

  actions: { alignSelf: 'center', width: '100%', maxWidth: 360 },

  modelSelectorContainer: { width: '100%' },
  modelLabel: { marginBottom: 8, fontWeight: '600' },
  modelSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    minHeight: 48,
  },
  modelSelectorText: { flex: 1, fontWeight: '500' },
  modelSelectorArrow: { fontSize: 12, marginLeft: 8 },

  modelOptions: {
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 300,
    overflow: 'scroll',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  modelOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modelOptionText: { flex: 1, fontWeight: '500' },

  pretrainedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  pretrainedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  statusContainer: { borderRadius: 12, padding: 16, marginVertical: 16, alignItems: 'center' },
  statusText: { fontWeight: '600', fontSize: 16, marginBottom: 10, textAlign: 'center' },

  midiViewerContainer: { marginTop: 20, marginBottom: 20 },
  midiViewerTitle: { fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  midiViewerWrapper: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' },

  hint: { marginTop: 16, textAlign: 'center' },
  debugInfo: { marginTop: 12, textAlign: 'center', lineHeight: 16 },
});

export default RecordScreen;
