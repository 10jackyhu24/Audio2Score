import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import Slider from '@react-native-community/slider';
import PianoKeyboard from './PianoKeyboard';
import FallingNotes from './FallingNotes';
import AudioManager from '../utils/AudioManager';
import { MIDIParser } from '../utils/midiParser';
import { MIDIViewerProps, MIDIData } from '../types/midi';
import { usePlayback } from '../context/PlaybackContext';

export interface MIDIViewerHandle {
  stopPlayback: () => void;
  getCurrentVolume: () => number;
}

const MIDIViewer = forwardRef<MIDIViewerHandle, MIDIViewerProps>((props, ref) => {
  const {
    midiFilePath,
    midiUrl,
    midiData,
    autoPlay = false,
    speed = 1,
    onLoadComplete,
    onPlaybackEnd,
    showControls = true,
    height = 500,
    authToken,
    playerId = 'default-midi-viewer',
  } = props;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [notes, setNotes] = useState<MIDIData['notes']>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [keyboardWidth, setKeyboardWidth] = useState<number>(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const [volume, setVolume] = useState<number>(0.5); // 預設音量 50%
  const playedNotesRef = useRef<Set<string>>(new Set()); // 追蹤已播放的音符（使用唯一ID）

  // 獲取播放控制 context
  const { registerPlayer, unregisterPlayer, notifyPlaybackStart } = usePlayback();

  // 暴露方法給父組件
  useImperativeHandle(ref, () => ({
    stopPlayback: () => {
      console.log('🛑 [MIDIViewer] 收到停止播放指令');
      handleStop();
    },
    getCurrentVolume: () => volume,
  }));

  // 註冊播放器到全局控制
  useEffect(() => {
    registerPlayer(playerId, () => {
      // 當其他播放器開始播放時，此回調會被調用
      if (isPlaying) {
        console.log(`🛑 [MIDIViewer ${playerId}] 被其他播放器中斷`);
        handleStop();
      }
    });

    return () => {
      unregisterPlayer(playerId);
    };
  }, [playerId, isPlaying]);

  // 初始化時同步音量（從 AudioManager 獲取當前音量）
  useEffect(() => {
    const currentVolume = AudioManager.getVolume();
    setVolume(currentVolume);
    console.log(`🔊 [MIDIViewer] 初始化音量: ${(currentVolume * 100).toFixed(0)}%`);
  }, []);

  // 加載 MIDI 文件
  useEffect(() => {
    if (midiFilePath || midiUrl || midiData) {
      loadMIDI();
    }
  }, [midiFilePath, midiUrl, midiData]);

  // 自動播放
  useEffect(() => {
    if (autoPlay && notes.length > 0 && !isPlaying) {
      handlePlayPause();
    }
  }, [autoPlay, notes]);

  // 組件卸載時停止播放
  useEffect(() => {
    return () => {
      console.log('🔄 [MIDIViewer] 組件卸載，停止所有播放');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      AudioManager.stopAll();
    };
  }, []);

  const loadMIDI = async (): Promise<void> => {
    try {
      setIsLoading(true);
      let parsedData: MIDIData | null = null;

      if (midiData) {
        // 直接使用傳入的 MIDI 資料
        parsedData = midiData;
      } else if (midiFilePath) {
        // 從本機檔案路徑載入
        parsedData = await MIDIParser.parseMidiFile(midiFilePath);
      } else if (midiUrl) {
        // 從 URL 載入
        parsedData = await MIDIParser.parseMidiUrl(midiUrl, authToken || undefined);
      }

      if (parsedData && parsedData.notes) {
        setNotes(parsedData.notes);
        setDuration(parsedData.duration || 0);
        setCurrentTime(0);
        
        onLoadComplete && onLoadComplete(parsedData);
        console.log('MIDI 載入成功，音符數量:', parsedData.notes.length);
      }
    } catch (error) {
      console.error('載入 MIDI 失敗:', error);
      Alert.alert('錯誤', '無法載入 MIDI 檔案');
    } finally {
      setIsLoading(false);
    }
  };

  const animate = (): void => {
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const adjustedTime = elapsed * speed;
    
    setCurrentTime(adjustedTime);

    // 檢測當前應該播放的音符（增加容錯範圍以提前觸發）
    const triggerWindow = 0.05; // 50ms 容錯窗口
    const currentActiveNotes = notes
      .filter(note => 
        adjustedTime >= note.startTime - triggerWindow && 
        adjustedTime <= note.startTime + note.duration + triggerWindow
      )
      .map(note => note.note);

    setActiveNotes(currentActiveNotes);

    // 播放新激活的音符（只在音符剛開始時觸發）
    notes.forEach((note, index) => {
      // 為每個音符創建唯一ID（音符名稱 + 開始時間 + 索引）
      const noteId = `${note.note}-${note.startTime}-${index}`;
      
      const justStarted = adjustedTime >= note.startTime - triggerWindow && 
                         adjustedTime < note.startTime + 0.1;
      
      // 檢查這個音符是否還沒有被播放過
      if (justStarted && !playedNotesRef.current.has(noteId)) {
        AudioManager.playNote(note.note, note.duration);
        playedNotesRef.current.add(noteId); // 標記為已播放
      }
    });

    // 檢查是否播放結束
    if (adjustedTime >= duration && duration > 0) {
      handleStop();
      onPlaybackEnd && onPlaybackEnd();
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const handlePlayPause = (): void => {
    if (notes.length === 0) {
      Alert.alert('提示', '請先加載 MIDI 文件');
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      // 通知其他播放器停止
      console.log(`▶️ [MIDIViewer ${playerId}] 開始播放，通知其他播放器停止`);
      notifyPlaybackStart(playerId);
      
      setIsPlaying(true);
      startTimeRef.current = Date.now() - (currentTime * 1000) / speed;
      
      // 清除當前時間之前的已播放音符記錄
      const currentPlayedNotes = new Set<string>();
      notes.forEach((note, index) => {
        const noteId = `${note.note}-${note.startTime}-${index}`;
        // 只保留已經過去的音符記錄
        if (note.startTime < currentTime) {
          currentPlayedNotes.add(noteId);
        }
      });
      playedNotesRef.current = currentPlayedNotes;
      
      animate();
    }
  };

  const handleStop = (): void => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveNotes([]);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    AudioManager.stopAll();
    // 清空已播放音符記錄
    playedNotesRef.current.clear();
  };

  const handleReset = (): void => {
    handleStop();
  };

  const handleNotePress = (noteName: string): void => {
    AudioManager.playNote(noteName);
  };

  const handleSeek = (time: number): void => {
    if (isPlaying) {
      handleStop();
    }
    setCurrentTime(time);
    
    // 清除已播放音符記錄，重新標記已過去的音符
    const currentPlayedNotes = new Set<string>();
    notes.forEach((note, index) => {
      const noteId = `${note.note}-${note.startTime}-${index}`;
      // 標記已經過去的音符為已播放
      if (note.startTime < time) {
        currentPlayedNotes.add(noteId);
      }
    });
    playedNotesRef.current = currentPlayedNotes;
  };

  const handleKeyboardLayout = (width: number): void => {
    setKeyboardWidth(width);
  };

  const handleVolumeChange = (newVolume: number): void => {
    setVolume(newVolume);
    AudioManager.setVolume(newVolume);
  };

  // 記錄拖動前的播放狀態
  const wasPlayingBeforeDragRef = useRef<boolean>(false);

  // 進度條拖動開始
  const handleProgressDragStart = (): void => {
    wasPlayingBeforeDragRef.current = isPlaying;
    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  };

  // 進度條值變化
  const handleProgressChange = (value: number): void => {
    setCurrentTime(value);
    
    // 清除已播放音符記錄，重新標記已過去的音符
    const currentPlayedNotes = new Set<string>();
    notes.forEach((note, index) => {
      const noteId = `${note.note}-${note.startTime}-${index}`;
      if (note.startTime < value) {
        currentPlayedNotes.add(noteId);
      }
    });
    playedNotesRef.current = currentPlayedNotes;
  };

  // 進度條拖動結束
  const handleProgressDragEnd = (): void => {
    if (wasPlayingBeforeDragRef.current) {
      // 如果拖動前正在播放，則恢復播放
      setIsPlaying(true);
      startTimeRef.current = Date.now() - (currentTime * 1000) / speed;
      animate();
    }
  };

  // 格式化時間顯示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* 加載指示器 */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加載 MIDI 文件中...</Text>
        </View>
      )}

      {/* 控制面板 - 移到頂部 */}
      {showControls && (
        <>
          <View style={styles.controlPanel}>
            <TouchableOpacity 
              style={[styles.controlButton, isPlaying && styles.pauseButton]}
              onPress={handlePlayPause}
              disabled={isLoading}
            >
              <Text style={styles.controlText}>
                {isPlaying ? '⏸️ 暫停' : '▶️ 播放'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={handleReset}
              disabled={isLoading}
            >
              <Text style={styles.controlText}>⏹️ 停止</Text>
            </TouchableOpacity>
            
            {/* 音量控制 */}
            <View style={styles.volumeControl}>
              <Text style={styles.volumeIcon}>🔊</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={(e: any) => handleVolumeChange(parseInt(e.target.value) / 100)}
                  style={{
                    flex: 1,
                    height: '6px',
                    cursor: 'pointer',
                    accentColor: '#007AFF',
                  }}
                />
              ) : (
                <Slider
                  style={styles.volumeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  value={volume}
                  onSlidingComplete={handleVolumeChange}
                  onValueChange={setVolume}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#dee2e6"
                  thumbTintColor="#007AFF"
                />
              )}
              <Text style={styles.volumeText}>{Math.round(volume * 100)}%</Text>
            </View>
            
            {/* 時間顯示 */}
            <Text style={styles.timeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
          
          {/* 進度條 */}
          <View style={styles.progressContainer}>
            <Slider
              style={styles.progressSlider}
              minimumValue={0}
              maximumValue={duration > 0 ? duration : 100}
              value={currentTime}
              onSlidingStart={handleProgressDragStart}
              onValueChange={handleProgressChange}
              onSlidingComplete={handleProgressDragEnd}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#dee2e6"
              thumbTintColor="#007AFF"
            />
          </View>
        </>
      )}

      {/* 音符掉落區域 */}
      <View style={styles.fallingArea}>
        <FallingNotes 
          notes={notes}
          currentTime={currentTime}
          speed={speed}
          onSeek={handleSeek}
          keyboardWidth={keyboardWidth}
        />
      </View>

      {/* 鋼琴鍵盤 */}
      <PianoKeyboard 
        onNotePress={handleNotePress}
        activeNotes={activeNotes}
        onLayout={handleKeyboardLayout}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fallingArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  controlPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e9ecef',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  controlButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  controlText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 180,
    maxWidth: 280,
  },
  volumeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
    marginLeft: 6,
  },
  timeText: {
    marginLeft: 'auto',
    color: '#495057',
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e9ecef',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  progressSlider: {
    width: '100%',
    height: 40,
  },
});

export default MIDIViewer;
