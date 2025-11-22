// components/FallingNotes.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { FallingNotesProps, MIDINote } from '../types/midi';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FallingNotes: React.FC<FallingNotesProps> = ({ 
  notes = [], 
  currentTime = 0, 
  speed = 1, 
  onSeek,
  keyboardWidth = screenWidth
}) => {
  // 定義鋼琴鍵盤配置（與 PianoKeyboard 保持一致）A0-C8
  const totalWhiteKeys = 52;
  const whiteKeyWidth = keyboardWidth / totalWhiteKeys;
  const keyHeight = whiteKeyWidth * 4; // 與鋼琴鍵盤高度一致
  const fallingAreaHeight = 400; // 音符下降區域高度
  const lookAheadTime = 3; // 提前顯示多少秒的音符
  const fallSpeed = fallingAreaHeight / lookAheadTime; // 像素/秒
  const delayOffset = 0.5; // 延遲半秒，讓音符更晚下落
  
  // 將音符名稱映射到鋼琴鍵位置
  const getNoteKeyIndex = (noteName: string): number => {
    // 移除音符名稱中的數字，獲取音符和升降號
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return -1;
    
    const [, note, octaveStr] = match;
    const octave = parseInt(octaveStr);
    
    // 定義從C開始的白鍵序列
    const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackNotes: { [key: string]: number } = {
      'C#': 0.6, 'D#': 1.6, 'F#': 3.6, 'G#': 4.6, 'A#': 5.6
    };
    
    let keyIndex = 0;
    
    // 處理 A0 和 B0（前兩個鍵）
    if (octave === 0) {
      if (note === 'A') return 0;
      if (note === 'A#') return 0.6;
      if (note === 'B') return 1;
      return -1; // 其他 octave 0 的音符不在鍵盤範圍內
    }
    
    // 從 C1 開始計算（A0, B0 佔了前2個白鍵位置）
    const baseOctave = 1;
    const offset = 2; // A0 和 B0
    
    if (note.includes('#')) {
      // 黑鍵
      const whiteKeyOffset = blackNotes[note];
      if (whiteKeyOffset === undefined) return -1;
      keyIndex = offset + (octave - baseOctave) * 7 + whiteKeyOffset;
    } else {
      // 白鍵
      const noteIndex = whiteNotes.indexOf(note);
      if (noteIndex === -1) return -1;
      keyIndex = offset + (octave - baseOctave) * 7 + noteIndex;
    }
    
    return keyIndex;
  };

  // 計算音符在畫面中的位置
  const getNoteVisualPosition = (note: MIDINote): {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  } | null => {
    const keyIndex = getNoteKeyIndex(note.note);
    if (keyIndex < 0 || keyIndex >= totalWhiteKeys) {
      return null; // 音符超出鍵盤範圍
    }
    
    // 計算音符的高度（根據持續時間）
    const noteHeight = Math.max(note.duration * fallSpeed, 10); // 最小高度10像素
    
    // 計算音符的垂直位置
    // 修正：讓底部固定對齊擊打線，頂部向上延伸
    // 當 currentTime === note.startTime 時，音符底部應該正好在擊打線上
    // 音符從上方落下，所以當 currentTime < note.startTime 時，音符在上方
    const timeUntilNoteHit = (note.startTime + delayOffset) - currentTime;
    
    // 如果音符還沒到達擊打線（timeUntilNoteHit > 0），它在上方
    // 如果音符已經過了擊打線（timeUntilNoteHit < 0），它在下方（應該消失）
    const distanceAboveHitLine = timeUntilNoteHit * fallSpeed;
    
    // y 座標：擊打線位置 - 音符高度 - 音符距離擊打線的距離
    // 這樣底部會固定在擊打線上，頂部向上延伸
    const y = fallingAreaHeight - noteHeight - distanceAboveHitLine;
    
    // 計算音符的寬度和X位置
    const isBlackKey = note.note.includes('#');
    const x = keyIndex * whiteKeyWidth;
    const width = isBlackKey ? whiteKeyWidth * 0.6 : whiteKeyWidth;
    
    // 檢查音符是否在可見的垂直範圍內
    const visible = (y + noteHeight > 0) && (y < fallingAreaHeight + 50);
    
    return { x, y, width, height: noteHeight, visible };
  };

  return (
    <View style={[styles.container, { height: fallingAreaHeight }]}>
      <Svg width={keyboardWidth} height={fallingAreaHeight} style={styles.svg}>
        {/* 定義漸層，用於音符的陰影效果 */}
        <Defs>
          <LinearGradient id="noteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#2196F3" stopOpacity="0.3" />
            <Stop offset="5%" stopColor="#2196F3" stopOpacity="0.8" />
            <Stop offset="95%" stopColor="#2196F3" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#1976D2" stopOpacity="0.3" />
          </LinearGradient>
          <LinearGradient id="blackNoteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#444" stopOpacity="0.3" />
            <Stop offset="5%" stopColor="#444" stopOpacity="0.8" />
            <Stop offset="95%" stopColor="#444" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#222" stopOpacity="0.3" />
          </LinearGradient>
          <LinearGradient id="activeNoteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#4CAF50" stopOpacity="0.3" />
            <Stop offset="5%" stopColor="#4CAF50" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#4CAF50" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#66BB6A" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>
        
        {notes.map((noteData, index) => {
          const position = getNoteVisualPosition(noteData);
          
          if (!position || !position.visible) return null;
          
          // 檢查音符是否正在被彈奏（音符底部接近或到達擊打線）
          const noteBottom = position.y + position.height;
          const isActive = noteBottom >= fallingAreaHeight - 10 && 
                          noteBottom <= fallingAreaHeight + 30;
          
          const isBlackKey = noteData.note.includes('#');
          
          // 選擇漸層
          const gradientId = isActive ? 'activeNoteGradient' : 
                            (isBlackKey ? 'blackNoteGradient' : 'noteGradient');
          
          return (
            <Rect
              key={`note-${index}-${noteData.note}-${noteData.startTime}`}
              x={position.x}
              y={position.y}
              width={position.width}
              height={position.height}
              fill={`url(#${gradientId})`}
              rx={4}
              ry={4}
              stroke={isActive ? '#66BB6A' : (isBlackKey ? '#000' : '#1565C0')}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      
      {/* 擊打線（鍵盤頂部位置） */}
      <View style={styles.hitLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hitLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FF3B30',
    zIndex: 1,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});

export default FallingNotes;
