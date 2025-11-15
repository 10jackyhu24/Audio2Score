import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '../components/Button';
import { API_URL as AUTH_API_URL } from '../services/authService';

// ✅ NEW: theme + font size
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { FONT_SIZES } from '../constants/theme';

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
    } catch (e: any) {
      console.error('檔案選擇錯誤:', e);
      Alert.alert('選取檔案失敗', e?.message ?? '請再試一次');
    }
  };

  const uploadFile = async () => {
    if (!file) {
      Alert.alert('請先選擇檔案');
      return;
    }

    try {
      setIsUploading(true);

      console.log('🔵 [上傳] 開始上傳流程...');

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

      Alert.alert('上傳成功', `檔案 ${result.filename} 上傳成功！`);
    } catch (error: any) {
      console.error('❌ [上傳] 錯誤:', error);
      Alert.alert('上傳失敗', error.message || '請稍後再試');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background }, // ✅ theme background
      ]}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
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
  hint: { marginTop: 16, textAlign: 'center' },
  debugInfo: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
