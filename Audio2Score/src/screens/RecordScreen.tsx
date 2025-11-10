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

const SERVER_UPLOAD_URL = 'http://localhost:3000/upload'; 
// ↑ Replace with your backend endpoint (e.g., http://192.168.1.10:3000/upload for device testing)

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

      // Some Android URIs may lack file://
      const uri =
        Platform.OS === 'android' && !file.uri.startsWith('file://')
          ? `file://${file.uri}`
          : file.uri;

      // Option A: multipart/form-data via fetch (most common)
      const form = new FormData();
      form.append('file', {
        uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as any);

      const resp = await fetch(SERVER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          // Let fetch set the correct multipart boundary:
          // 'Content-Type': 'multipart/form-data',
        },
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`上傳失敗 (${resp.status}): ${text}`);
      }

      Alert.alert('上傳成功', '伺服器已收到檔案。');

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
        支援：WAV、MP4、MP3、M4A 等常見格式。若在真機測試，請將 SERVER_UPLOAD_URL 改成電腦的區網 IP。
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
});
