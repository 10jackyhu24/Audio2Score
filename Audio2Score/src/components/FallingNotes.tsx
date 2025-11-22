// components/FallingNotes.tsx
import React from 'react';
import { View, StyleSheet, Dimensions, TouchableWithoutFeedback, GestureResponderEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { FallingNotesProps } from '../types/midi';

const { width: screenWidth } = Dimensions.get('window');

interface NotePosition {
  x: number;
  y: number;
  duration: number;
  startTime: number;
}

const FallingNotes: React.FC<FallingNotesProps> = ({ 
  notes = [], 
  currentTime = 0, 
  speed = 1, 
  onSeek 
}) => {
  const keyWidth = screenWidth / 7;

  const getNotePosition = (note: string, startTime: number, duration: number): NotePosition => {
    const noteName = note.replace(/[0-9]/g, '');
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackKeys: { [key: string]: number } = {
      'C#': 0.5, 'D#': 1.5, 'F#': 3.5, 'G#': 4.5, 'A#': 5.5
    };
    
    let position = whiteKeys.indexOf(noteName);
    if (position === -1 && blackKeys[noteName] !== undefined) {
      position = blackKeys[noteName];
    }
    
    const x = position * keyWidth;
    const elapsed = currentTime - startTime;
    const y = Math.max(0, (elapsed / duration) * 500);
    
    return { x, y, duration, startTime };
  };

  const handleCanvasPress = (event: GestureResponderEvent): void => {
    if (onSeek) {
      const { locationX, locationY } = event.nativeEvent;
      // 根據點擊位置計算對應的時間
      const clickedTime = (locationY / 500) * 10; // 假設總時長10秒
      onSeek(clickedTime);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleCanvasPress}>
      <View style={styles.container}>
        <Svg width={screenWidth} height={500} style={styles.svg}>
          {notes.map((noteData, index) => {
            const position = getNotePosition(
              noteData.note, 
              noteData.startTime, 
              noteData.duration
            );
            
            if (position.y > 500) return null;
            
            const isActive = currentTime >= noteData.startTime && 
                           currentTime <= noteData.startTime + noteData.duration;
            
            return (
              <Rect
                key={`note-${index}-${noteData.note}`}
                x={position.x}
                y={position.y}
                width={keyWidth}
                height={20}
                fill={isActive ? '#FF6B6B' : (noteData.note.includes('#') ? '#333' : '#666')}
                opacity={0.8}
                rx={4}
              />
            );
          })}
        </Svg>
        
        {/* 當前時間線 */}
        <View 
          style={[
            styles.timeLine,
            { top: (currentTime / 10) * 500 } // 假設總時長10秒
          ]} 
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  timeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    zIndex: 1,
  },
});

export default FallingNotes;
