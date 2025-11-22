// components/MIDIViewer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert 
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
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

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

    // 檢測當前應該播放的音符
    const currentActiveNotes = notes
      .filter(note => 
        adjustedTime >= note.startTime && 
        adjustedTime <= note.startTime + note.duration
      )
      .map(note => note.note);

    setActiveNotes(currentActiveNotes);

    // 播放新激活的音符
    currentActiveNotes.forEach(note => {
      if (!activeNotes.includes(note)) {
        AudioManager.playNote(note);
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

      {/* 音符掉落區域 */}
      <View style={styles.fallingArea}>
        <FallingNotes 
          notes={notes}
          currentTime={currentTime}
          speed={speed}
          onSeek={handleSeek}
        />
        
        {/* 時間顯示 */}
        <View style={styles.timeOverlay}>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* 控制面板 */}
      {showControls && (
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
        </View>
      )}

      {/* 鋼琴鍵盤 */}
      <PianoKeyboard 
        onNotePress={handleNotePress}
        activeNotes={activeNotes}
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
    marginLeft: 'auto',
    paddingHorizontal: 12,
  },
  speedText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  timeOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 6,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MIDIViewer;
