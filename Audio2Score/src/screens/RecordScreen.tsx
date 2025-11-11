import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
// If you have your own Button component, use it; otherwise use Pressable/TouchableOpacity
import { Button } from '../components/Button';

type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
};

// 🌐 使用與 authService 相同的配置
const USE_NGROK = true; // 設為 true 使用 ngrok，false 使用本地網路
const COMPUTER_IP = '192.168.0.14'; // 本地開發時使用（當 USE_NGROK = false）

// ngrok URL - 會被 start.ps1 自動更新
const NGROK_URL = 'https://65e33d2822b6.ngrok-free.app';

// 根據平台設定 API URL
const getApiUrl = () => {
  if (USE_NGROK) {
    console.log('🌐 [上傳] 使用 ngrok 模式');
    return `${NGROK_URL}/api`;
  }
  
  console.log('🏠 [上傳] 使用本地開發模式');
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return `http://${COMPUTER_IP}:3000/api`;
};

const API_URL = getApiUrl();
const SERVER_UPLOAD_URL = `${API_URL}/auth/upload`;
console.log('🔵 [上傳] 上傳 URL:', SERVER_UPLOAD_URL);

export const RecordScreen = () => {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/*',
          'video/*',
          'audio/wav',
          'audio/mpeg',   // mp3
          'audio/mp4',    // m4a
          'video/mp4',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset) return;

      setFile({
        uri: asset.uri,
        name: asset.name ?? 'upload',
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
      });
    } catch (e: any) {
      console.error(e);
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

      // 先測試後端是否可連線
      console.log('🔵 [上傳] 測試後端連線...');
      console.log('🔵 [上傳] 後端 API URL:', API_URL);
      
      try {
        const healthCheck = await fetch(`${API_URL.replace('/api', '')}`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        console.log('🔵 [上傳] 後端連線測試狀態:', healthCheck.status);
        const healthData = await healthCheck.text();
        console.log('🔵 [上傳] 後端回應:', healthData);
      } catch (healthError: any) {
        console.error('❌ [上傳] 後端連線失敗:', healthError.message);
        Alert.alert(
          '後端連線失敗',
          `無法連接到後端伺服器。\n\n錯誤: ${healthError.message}\n\n請確認：\n1. 後端是否已啟動 (執行 start.ps1)\n2. ngrok URL 是否正確\n3. 網路連線是否正常`
        );
        return;
      }

      // Some Android URIs may lack file://
      const uri =
        Platform.OS === 'android' && !file.uri.startsWith('file://')
          ? `file://${file.uri}`
          : file.uri;

      console.log('🔵 [上傳] 準備上傳檔案:');
      console.log('🔵 [上傳] URI:', uri);
      console.log('🔵 [上傳] Name:', file.name);
      console.log('🔵 [上傳] Type:', file.mimeType);
      console.log('🔵 [上傳] Server URL:', SERVER_UPLOAD_URL);

      // Option A: multipart/form-data via fetch (most common)
      const form = new FormData();
      form.append('file', {
        uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as any);

      console.log('🔵 [上傳] FormData 已建立');
      console.log('🔵 [上傳] 開始發送請求...');

      const resp = await fetch(SERVER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          // Let fetch set the correct multipart boundary automatically
          // 'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true',  // 跳過 ngrok 警告頁面
        },
        body: form,
      });

      console.log('🔵 [上傳] 回應狀態:', resp.status);
      console.log('🔵 [上傳] 回應 OK?:', resp.ok);

      if (!resp.ok) {
        const text = await resp.text();
        console.log('❌ [上傳] 錯誤回應:', text);
        throw new Error(`上傳失敗 (${resp.status}): ${text}`);
      }

      const result = await resp.json();
      console.log('✅ [上傳] 成功:', result);
      Alert.alert('上傳成功', `伺服器已收到檔案。\n\n檔名: ${result.filename}\n大小: ${(result.size / 1024 / 1024).toFixed(2)} MB`);

      // Option B (alternative): FileSystem.uploadAsync with progress
      // const uploadRes = await FileSystem.uploadAsync(SERVER_UPLOAD_URL, uri, {
      //   httpMethod: 'POST',
      //   fieldName: 'file',
      //   uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      //   parameters: { note: 'optional extra fields' },
      // });
      // if (uploadRes.status !== 200) throw new Error(uploadRes.body);
      // Alert.alert('上傳成功', uploadRes.body);

    } catch (e: any) {
      console.error(e);
      Alert.alert('上傳失敗', e?.message ?? '請稍後再試');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>上傳音訊 / 影片檔</Text>

      <View style={styles.card}>
        {file ? (
          <>
            <Text style={styles.label}>檔名：<Text style={styles.value}>{file.name}</Text></Text>
            {!!file.size && (
              <Text style={styles.label}>
                大小：<Text style={styles.value}>{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
              </Text>
            )}
            <Text style={styles.label}>MIME：<Text style={styles.value}>{file.mimeType ?? '未知'}</Text></Text>
          </>
        ) : (
          <Text style={styles.placeholder}>尚未選擇檔案</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button title="選擇檔案" onPress={pickFile} />
        <View style={{ height: 12 }} />
        <Button title={isUploading ? '上傳中…' : '上傳'} onPress={uploadFile} disabled={!file || isUploading} />
      </View>

      <Text style={styles.hint}>
        支援：WAV、MP4、MP3、M4A 等常見格式。{'\n'}
        {'\n'}
        當前上傳 URL: {SERVER_UPLOAD_URL}{'\n'}
        模式: {USE_NGROK ? 'ngrok (遠端)' : '本地網路'}
      </Text>
      
      <Text style={styles.debugInfo}>
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
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginBottom: 20,
  },
  label: { fontSize: 16, marginBottom: 6, color: '#333' },
  value: { fontWeight: '600' },
  placeholder: { textAlign: 'center', color: '#777' },
  actions: { alignSelf: 'center', width: '100%', maxWidth: 320 },
  hint: { marginTop: 16, color: '#666', fontSize: 12, textAlign: 'center' },
  debugInfo: { marginTop: 12, color: '#888', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
