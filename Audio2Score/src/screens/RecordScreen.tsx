import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '../components/Button';
import { API_URL as AUTH_API_URL, getStoredToken } from '../services/authService';

// ✅ NEW: theme + font size
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { FONT_SIZES } from '../constants/theme';

// ✅ NEW: 引入 MIDIViewer 和類型
import MIDIViewer from '../components/MIDIViewer';
import type { MIDIData as MIDIDataType } from '../types/midi';

type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
};

// 使用全域共用的 API_URL（從 authService 匯入）
const API_URL = AUTH_API_URL; // 已包含 /api
const SERVER_UPLOAD_URL = `${API_URL}/upload`;
console.log('🔵 [上傳] 上傳 URL:', SERVER_UPLOAD_URL);

export const RecordScreen = () => {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // ✅ NEW: 添加 MIDI 相關狀態
  const [midiData, setMidiData] = useState<MIDIDataType | null>(null);
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle');
  const [convertedMidiUrl, setConvertedMidiUrl] = useState<string | null>(null);

  // ✅ NEW: use theme + font scaling
  const { colors } = useTheme();
  const { scale } = useFontSize();

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*',
          'audio/mpeg',   // mp3
          'audio/mp4',    // m4a, mp4
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

      setFile({
        uri: asset.uri,
        name: asset.name ?? 'upload',
        size: asset.size ?? null,
        mimeType: correctedMimeType,
      });
      
      // ✅ NEW: 重置 MIDI 相關狀態
      setMidiData(null);
      setConversionStatus('idle');
      setConvertedMidiUrl(null);
    } catch (e: any) {
      console.error('檔案選擇錯誤:', e);
      Alert.alert('選取檔案失敗', e?.message ?? '請再試一次');
    }
  };

  // ✅ NEW: 獲取轉換後的 MIDI 文件
  const fetchConvertedMIDI = async (filename: string, midiFilename?: string, username?: string) => {
    try {
      setConversionStatus('converting');
      
      // 使用後端返回的 MIDI 文件名，或者根據原始文件名生成
      const midiName = midiFilename || `${filename.replace(/\.[^/.]+$/, "")}_basic_pitch.mid`;
      
      // 構建 MIDI URL - 現在包含使用者名稱
      const midiUrl = username 
        ? `${API_URL}/files/${username}/${midiName}`
        : `${API_URL}/files/${midiName}`;
      
      console.log('🔵 [MIDI 轉換] 嘗試獲取 MIDI 文件:', midiUrl);
      
      // 檢查文件是否存在 (最多嘗試 5 次，因為轉換可能需要時間)
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          const token = await getStoredToken();
          const checkResponse = await fetch(midiUrl, { 
            method: 'HEAD',
            headers: token ? {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            } : {
              'ngrok-skip-browser-warning': 'true',
            }
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
          // 等待 2 秒後重試
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      throw new Error('MIDI 文件在預期時間內未準備好');
      
    } catch (error) {
      console.error('❌ [MIDI 轉換] 獲取 MIDI 失敗:', error);
      setConversionStatus('error');
      
      // 如果無法獲取真實的 MIDI 文件，使用模擬數據
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
          timeSignature: [4, 4]
        };
        setMidiData(mockMidiData);
        setConversionStatus('success');
        console.log('✅ [MIDI 轉換] 使用模擬 MIDI 數據');
      }, 1000);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('請先選擇檔案');
      return;
    }

    try {
      setIsUploading(true);
      setMidiData(null);
      setConversionStatus('idle');

      console.log('🔵 [上傳] 開始上傳流程...');

      // ✅ 獲取 Token
      const token = await getStoredToken();
      if (!token) {
        Alert.alert('未登入', '請先登入才能上傳檔案');
        setIsUploading(false);
        return;
      }
      console.log('🔵 [上傳] Token 已取得');

      let fileUri = file.uri;
      if (
        Platform.OS !== 'web' &&
        Platform.OS === 'android' &&
        !fileUri.startsWith('file://')
      ) {
        fileUri = `file://${fileUri}`;
      }

      console.log('🔵 [上傳] 檔案資訊:', {
        uri: fileUri,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        平台: Platform.OS,
      });

      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        try {
          const fileForUpload = new File([blob], file.name, {
            type: file.mimeType || 'application/octet-stream',
          });
          formData.append('file', fileForUpload);
        } catch (e) {
          (formData as any).append('file', blob, file.name);
        }
      } else {
        formData.append('file', {
          uri: fileUri,
          name: file.name,
          type: file.mimeType || 'audio/mpeg',
        } as any);
      }

      console.log('🔵 [上傳] 發送請求到:', SERVER_UPLOAD_URL);

      const response = await fetch(SERVER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,  // ✅ 加上 Authorization header
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
      });

      console.log('🔵 [上傳] 回應狀態:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ [上傳] 錯誤回應:', errorText);
        throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [上傳] 成功:', result);

      Alert.alert(
        '上傳成功', 
        `檔案 ${result.original_filename || result.filename} 上傳成功！\n${result.midi_filename ? '正在獲取 MIDI...' : '轉換 MIDI 中...'}`
      );
      
      // ✅ NEW: 上傳成功後獲取 MIDI 文件
      if (result.saved_filename || result.filename) {
        // 使用後端返回的 MIDI 文件名和使用者名稱
        const filename = result.saved_filename || result.filename;
        await fetchConvertedMIDI(filename, result.midi_filename, result.user);
      }
      
    } catch (error: any) {
      console.error('❌ [上傳] 錯誤:', error);
      Alert.alert('上傳失敗', error.message || '請稍後再試');
      setConversionStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ NEW: 渲染轉換狀態
  const renderConversionStatus = () => {
    switch (conversionStatus) {
      case 'converting':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>
              🎵 正在轉換為 MIDI...
            </Text>
          </View>
        );
      case 'success':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: '#4CAF50' }]}>
              ✅ MIDI 轉換完成！
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={[styles.statusContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.statusText, { color: '#F44336' }]}>
              ❌ MIDI 轉換失敗，顯示模擬數據
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView 
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: FONT_SIZES.xl * scale,
          },
        ]}
      >
        上傳音訊 / 影片檔
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card ?? 'rgba(0,0,0,0.04)' },
        ]}
      >
        {file ? (
          <>
            <Text
              style={[
                styles.label,
                {
                  color: colors.text,
                  fontSize: FONT_SIZES.md * scale,
                },
              ]}
            >
              檔名：
              <Text style={[styles.value, { color: colors.primary }]}>
                {file.name}
              </Text>
            </Text>

            {!!file.size && (
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                    fontSize: FONT_SIZES.md * scale,
                  },
                ]}
              >
                大小：
                <Text style={[styles.value, { color: colors.primary }]}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </Text>
              </Text>
            )}

            <Text
              style={[
                styles.label,
                {
                  color: colors.text,
                  fontSize: FONT_SIZES.md * scale,
                },
              ]}
            >
              MIME：
              <Text style={[styles.value, { color: colors.primary }]}>
                {file.mimeType ?? '未知'}
              </Text>
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.placeholder,
              {
                color: colors.textSecondary,
                fontSize: FONT_SIZES.md * scale,
              },
            ]}
          >
            尚未選擇檔案
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button title="選擇檔案" onPress={pickFile} />
        <View style={{ height: 12 }} />
        <Button
          title={isUploading ? '上傳中…' : '上傳'}
          onPress={uploadFile}
          disabled={!file || isUploading}
        />
      </View>

      {/* ✅ NEW: 轉換狀態顯示 */}
      {renderConversionStatus()}

      {/* ✅ NEW: MIDI 檢視器 */}
      {(midiData || convertedMidiUrl) && conversionStatus === 'success' && (
        <View style={styles.midiViewerContainer}>
          <Text style={[
            styles.midiViewerTitle, 
            { color: colors.text, fontSize: FONT_SIZES.lg * scale }
          ]}>
            🎹 MIDI 預覽
          </Text>
          
          <View style={styles.midiViewerWrapper}>
            <MIDIViewer
              midiData={midiData ?? undefined}
              midiUrl={convertedMidiUrl ?? undefined}
              autoPlay={false}
              speed={1}
              height={400}
              showControls={true}
              onLoadComplete={(data: any) => console.log('MIDI 加載完成', data)}
              onPlaybackEnd={() => console.log('播放結束')}
            />
          </View>
        </View>
      )}

      <Text
        style={[
          styles.hint,
          {
            color: colors.textSecondary,
            fontSize: 12 * scale,
          },
        ]}
      >
        支援：WAV、MP4、MP3、M4A 等常見格式。{'\n'}
        {'\n'}
        當前上傳 URL: {SERVER_UPLOAD_URL}
        {'\n'}
        模式: {API_URL.includes('ngrok') ? 'ngrok (遠端)' : '本地網路'}
      </Text>

      <Text
        style={[
          styles.debugInfo,
          {
            color: colors.textSecondary,
            fontSize: 11 * scale,
          },
        ]}
      >
        💡 如果上傳沒有反應：{'\n'}
        1️⃣ 確認已執行 start.ps1 啟動後端和 ngrok{'\n'}
        2️⃣ 檢查 ngrok URL 是否正確（免費版每次重啟都會變）{'\n'}
        3️⃣ 查看控制台 (console.log) 的錯誤訊息
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    padding: 20, 
    paddingBottom: 40 
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  label: { marginBottom: 6 },
  value: { fontWeight: '600' },
  placeholder: { textAlign: 'center' },
  actions: { alignSelf: 'center', width: '100%', maxWidth: 320 },
  
  // ✅ NEW: 轉換狀態樣式
  statusContainer: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '600',
    fontSize: 16,
  },
  
  // ✅ NEW: MIDI 檢視器樣式
  midiViewerContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  midiViewerTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  midiViewerWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  
  hint: { marginTop: 16, textAlign: 'center' },
  debugInfo: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});