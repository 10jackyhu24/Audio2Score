import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useFontSize } from '../context/FontSizeContext';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { API_URL, getStoredToken } from '../services/authService';
import { useNavigation } from '@react-navigation/native';

type FileRecord = {
  id: number;
  original_filename: string;
  saved_filename: string;
  file_type: string;
  file_size: number;
  wav_filename: string | null;
  midi_filename: string | null;
  is_favorited: boolean;
  upload_date: string;
  created_at: string;
};

type SortType = 'date' | 'name';
type FilterType = 'all' | 'favorites' | 'midi';

export const LibraryScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const { scale } = useFontSize();
  const navigation = useNavigation();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [downloadMenuVisible, setDownloadMenuVisible] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadLibrary();
  }, [sortBy, filterType, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLibrary();
    setRefreshing(false);
  };

  const loadLibrary = async () => {
    try {
      setIsLoading(true);
      const token = await getStoredToken();

      if (!token) {
        Alert.alert('錯誤', '請先登入');
        return;
      }

      const url = `${API_URL}/upload/library?sort_by=${sortBy}&filter_type=${filterType}&search=${encodeURIComponent(
        searchQuery
      )}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        console.error('❌ 載入圖書館失敗');
      }
    } catch (error) {
      console.error('❌ 載入圖書館錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (fileId: number) => {
    try {
      const token = await getStoredToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/upload/library/${fileId}/favorite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFiles((prevFiles) =>
          prevFiles.map((file) =>
            file.id === fileId ? { ...file, is_favorited: data.is_favorited } : file
          )
        );
      }
    } catch (error) {
      console.error('❌ 切換收藏錯誤:', error);
    }
  };

  const downloadFile = async (filename: string | null, fileType: string) => {
    try {
      if (!filename) {
        Alert.alert('提示', `此檔案沒有 ${fileType} 格式`);
        return;
      }

      const fileUrl = `${API_URL}/files/${filename}`;
      console.log('📥 下載文件:', fileUrl);
      await Linking.openURL(fileUrl);
      setDownloadMenuVisible(null);
    } catch (error) {
      console.error('❌ 下載檔案錯誤:', error);
      Alert.alert('錯誤', '下載失敗');
    }
  };

  const playMidiFile = (file: FileRecord) => {
    if (!file.midi_filename) {
      Alert.alert('提示', '此檔案沒有 MIDI 格式');
      return;
    }
    
    const midiUrl = `${API_URL}/files/${file.midi_filename}`;
    console.log('🎵 播放 MIDI:', midiUrl);
    
    // 導覽到 MIDI 播放器頁面
    (navigation as any).navigate('MidiPlayer', { 
      midiUrl,
      filename: file.original_filename 
    });
  };

  const toggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectedForDelete(new Set());
    setDownloadMenuVisible(null);
  };

  const toggleSelectForDelete = (fileId: number) => {
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedForDelete(newSelected);
  };

  const confirmBatchDelete = async () => {
    if (selectedForDelete.size === 0) {
      Alert.alert('提示', '請先選擇要刪除的檔案');
      return;
    }

    Alert.alert(
      '確認刪除',
      `確定要刪除選中的 ${selectedForDelete.size} 個檔案嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getStoredToken();
              if (!token) return;

              // 批次刪除
              const deletePromises = Array.from(selectedForDelete).map(fileId =>
                fetch(`${API_URL}/upload/library/${fileId}`, {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true',
                  },
                })
              );

              await Promise.all(deletePromises);

              // 更新檔案列表
              setFiles(prevFiles => prevFiles.filter(file => !selectedForDelete.has(file.id)));
              setSelectedForDelete(new Set());
              setDeleteMode(false);
              Alert.alert('成功', `已刪除 ${selectedForDelete.size} 個檔案`);
            } catch (error) {
              console.error('❌ 批次刪除錯誤:', error);
              Alert.alert('錯誤', '刪除失敗');
            }
          },
        },
      ]
    );
  };

  const deleteFile = async (fileId: number) => {
    Alert.alert('確認刪除', '確定要刪除此檔案嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getStoredToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/upload/library/${fileId}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true',
              },
            });

            if (response.ok) {
              setFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
              Alert.alert('成功', '檔案已刪除');
            }
          } catch (error) {
            console.error('❌ 刪除檔案錯誤:', error);
          }
        },
      },
    ]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* 搜尋欄 */}
      <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: FONT_SIZES.md * scale }]}
          placeholder="搜尋檔案名稱..."
          placeholderTextColor={isDarkMode ? '#666' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 篩選和排序 */}
      <View style={styles.filterBar}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'all' && !deleteMode && { backgroundColor: colors.primary },
            ]}
            onPress={() => !deleteMode && setFilterType('all')}
            disabled={deleteMode}
          >
            <Text
              style={[
                styles.filterText,
                { 
                  color: filterType === 'all' && !deleteMode ? 'white' : colors.text, 
                  fontSize: FONT_SIZES.sm * scale,
                  opacity: deleteMode ? 0.5 : 1,
                },
              ]}
            >
              全部
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'favorites' && !deleteMode && { backgroundColor: colors.primary },
            ]}
            onPress={() => !deleteMode && setFilterType('favorites')}
            disabled={deleteMode}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: filterType === 'favorites' && !deleteMode ? 'white' : colors.text,
                  fontSize: FONT_SIZES.sm * scale,
                  opacity: deleteMode ? 0.5 : 1,
                },
              ]}
            >
              ⭐ 收藏
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              deleteMode && { backgroundColor: '#e74c3c' },
            ]}
            onPress={toggleDeleteMode}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: deleteMode ? 'white' : colors.text,
                  fontSize: FONT_SIZES.sm * scale,
                },
              ]}
            >
              {deleteMode ? '✕ 取消' : '🗑️ 刪除模式'}
            </Text>
          </TouchableOpacity>
          {deleteMode && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: '#c0392b' },
              ]}
              onPress={confirmBatchDelete}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: 'white',
                    fontSize: FONT_SIZES.sm * scale,
                  },
                ]}
              >
                ✓ 確認刪除
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: isDarkMode ? '#3b3b3b' : 'white' }]}
          onPress={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
        >
          <Text style={[styles.sortText, { color: colors.text, fontSize: FONT_SIZES.sm * scale }]}>
            {sortBy === 'date' ? '時間 ↓' : '名稱'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 檔案列表 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : files.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          <Text style={[styles.emptyText, { color: isDarkMode ? '#666' : '#999' }]}>
            {searchQuery ? '沒有符合的檔案' : '尚無檔案記錄'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.fileList}
          contentContainerStyle={styles.fileListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {files
            .filter(file => !deleteMode || !file.is_favorited)
            .map((file) => (
            <View
              key={file.id}
              style={[styles.fileCard, { backgroundColor: isDarkMode ? '#2b2b2b' : '#f7f7f7' }]}
            >
              <View style={styles.fileHeader}>
                <Text style={styles.fileDate}>{formatDate(file.upload_date)}</Text>
              </View>

              <View style={styles.fileInfo}>
                <TouchableOpacity
                  style={styles.fileIconContainer}
                  onPress={() => deleteMode ? toggleSelectForDelete(file.id) : playMidiFile(file)}
                >
                  {deleteMode ? (
                    <View style={[
                      styles.selectCircle,
                      selectedForDelete.has(file.id) && styles.selectCircleSelected
                    ]}>
                      {selectedForDelete.has(file.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.fileIcon}>🎵</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.fileDetails}>
                  <Text
                    style={[styles.fileName, { color: colors.text, fontSize: FONT_SIZES.md * scale }]}
                    numberOfLines={1}
                  >
                    {file.original_filename}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => toggleFavorite(file.id)} style={styles.favoriteButton}>
                  <Text style={styles.favoriteIcon}>{file.is_favorited ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fileActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.downloadButton]}
                  onPress={() => setDownloadMenuVisible(downloadMenuVisible === file.id ? null : file.id)}
                >
                  <Text style={styles.actionButtonText}>下載 ⬇</Text>
                </TouchableOpacity>
              </View>

              {/* 下載選單 */}
              {downloadMenuVisible === file.id && (
                <View style={[styles.downloadMenu, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
                  {file.wav_filename && (
                    <TouchableOpacity
                      style={styles.downloadMenuItem}
                      onPress={() => downloadFile(file.wav_filename, 'WAV')}
                    >
                      <Text style={[styles.downloadMenuText, { color: '#2ecc71' }]}>💾 下載 WAV</Text>
                    </TouchableOpacity>
                  )}
                  {file.midi_filename && (
                    <TouchableOpacity
                      style={styles.downloadMenuItem}
                      onPress={() => downloadFile(file.midi_filename, 'MIDI')}
                    >
                      <Text style={[styles.downloadMenuText, { color: '#3498db' }]}>🎹 下載 MIDI</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    padding: SPACING.sm,
  },
  clearButton: {
    padding: SPACING.sm,
    fontSize: 16,
    color: '#999',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterText: {
    fontWeight: '600',
  },
  sortButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  sortText: {
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  fileList: {
    flex: 1,
  },
  fileListContent: {
    padding: SPACING.md,
  },
  fileCard: {
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fileHeader: {
    marginBottom: SPACING.sm,
  },
  fileDate: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: '600',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  fileIconContainer: {
    marginRight: SPACING.sm,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontWeight: '600',
  },
  favoriteButton: {
    padding: SPACING.xs,
  },
  favoriteIcon: {
    fontSize: 24,
  },
  fileActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#9b59b6',
  },
  midiButton: {
    backgroundColor: '#3498db',
  },
  wavButton: {
    backgroundColor: '#2ecc71',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  downloadMenu: {
    marginTop: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  downloadMenuItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  downloadMenuText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectCircleSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
