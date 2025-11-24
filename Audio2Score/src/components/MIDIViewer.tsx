// components/MIDIViewer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  PanResponder,
  GestureResponderEvent
} from 'react-native';
import PianoKeyboard from './PianoKeyboard';
import FallingNotes from './FallingNotes';
import AudioManager from '../utils/AudioManager';
import { MIDIParser } from '../utils/midiParser';
import { MIDIViewerProps, MIDIData } from '../types/midi';

const MIDIViewer: React.FC<MIDIViewerProps> = ({ 
  midiFilePath,
  midiUrl,
  midiData,
  autoPlay = false,
  speed = 1,
  onLoadComplete,
  onPlaybackEnd,
  showControls = true,
  height = 500,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [notes, setNotes] = useState<MIDIData['notes']>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [keyboardWidth, setKeyboardWidth] = useState<number>(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressBarRef = useRef<View>(null);
  const [progressBarWidth, setProgressBarWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  const loadMIDI = async (): Promise<void> => {
    try {
      setIsLoading(true);
      let parsedData: MIDIData | null = null;

      if (midiData) {
        // 直接使用傳入的 MIDI 數據
        parsedData = midiData;
      } else if (midiFilePath) {
        // 從本地文件路徑加載
        parsedData = await MIDIParser.parseMidiFile(midiFilePath);
      } else if (midiUrl) {
        // 從 URL 加載
        parsedData = await MIDIParser.parseMidiUrl(midiUrl);
      }

      if (parsedData && parsedData.notes) {
        setNotes(parsedData.notes);
        setDuration(parsedData.duration || 0);
        setCurrentTime(0);
        
        onLoadComplete && onLoadComplete(parsedData);
        console.log('MIDI 加載成功，音符數量:', parsedData.notes.length);
      }
    } catch (error) {
      console.error('加載 MIDI 失敗:', error);
      Alert.alert('錯誤', '無法加載 MIDI 文件');
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
    notes.forEach(note => {
      const justStarted = adjustedTime >= note.startTime - triggerWindow && 
                         adjustedTime < note.startTime + 0.1 &&
                         !activeNotes.includes(note.note);
      if (justStarted) {
        AudioManager.playNote(note.note, note.duration);
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
      setIsPlaying(true);
      startTimeRef.current = Date.now() - (currentTime * 1000) / speed;
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
  };

  const handleKeyboardLayout = (width: number): void => {
    setKeyboardWidth(width);
  };

  const handleProgressBarPress = (event: GestureResponderEvent): void => {
    if (duration === 0) return;
    
    const { locationX } = event.nativeEvent;
    const progressPercent = Math.max(0, Math.min(1, locationX / progressBarWidth));
    const newTime = progressPercent * duration;
    
    setCurrentTime(newTime);
    if (isPlaying) {
      startTimeRef.current = Date.now() - (newTime * 1000) / speed;
    }
  };

  // 創建進度條拖動手勢處理器
  const progressBarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setIsDragging(true);
        if (isPlaying) {
          setIsPlaying(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
        }
        handleProgressBarPress(event);
      },
      onPanResponderMove: (event) => {
        handleProgressBarPress(event);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
    })
  ).current;

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
            
            <View style={styles.speedControl}>
              <Text style={styles.speedText}>速度: {speed}x</Text>
            </View>
            
            {/* 時間顯示 */}
            <Text style={styles.timeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
          
          {/* 進度條 */}
          <View 
            style={styles.progressContainer}
            onLayout={(event) => setProgressBarWidth(event.nativeEvent.layout.width)}
          >
            <View 
              ref={progressBarRef}
              style={styles.progressBarBackground}
              {...progressBarPanResponder.panHandlers}
            >
              {/* 已播放部分 */}
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                ]} 
              />
              {/* 拖動手柄 */}
              <View 
                style={[
                  styles.progressThumb,
                  { left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                ]}
              />
            </View>
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
};

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
  speedControl: {
    paddingHorizontal: 12,
  },
  speedText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
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
  progressBarBackground: {
    height: 6,
    backgroundColor: '#dee2e6',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default MIDIViewer;
