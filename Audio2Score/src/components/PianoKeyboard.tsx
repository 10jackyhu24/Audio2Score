// components/PianoKeyboard.tsx
import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, LayoutChangeEvent, Dimensions } from 'react-native';
import { PianoKeyboardProps } from '../types/midi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ 
  onNotePress, 
  activeNotes = [],
  onLayout
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState<number>(SCREEN_WIDTH);
  
  // 定義完整的鋼琴鍵盤範圍 A0 到 C8
  // A0-C8: 從A0開始(3個白鍵A,B) + 7個完整八度(7*7=49) + C8(1個白鍵) = 52個白鍵
  const totalWhiteKeys = 52;
  const whiteKeyWidth = containerWidth / totalWhiteKeys;
  const blackKeyWidth = whiteKeyWidth * 0.6;
  const keyHeight = whiteKeyWidth * 4; // 白鍵高度為寬度的4倍，保持比例
  
  const playNote = (noteName: string): void => {
    onNotePress && onNotePress(noteName);
  };

  const isNoteActive = (noteName: string): boolean => {
    return activeNotes.some(note => note === noteName);
  };

  // 判斷一個音符是否有對應的黑鍵（E和B沒有黑鍵）
  const hasBlackKey = (note: string): boolean => {
    return !['E', 'B'].includes(note);
  };

  // 生成完整的鋼琴鍵盤
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      onLayout && onLayout(width);
    }
  };

  const renderPianoKeys = () => {
    const allWhiteKeys: React.ReactElement[] = [];
    const allBlackKeys: React.ReactElement[] = [];
    
    let whiteKeyIndex = 0;
    
    // 先渲染 A0 和 B0
    const octave0Notes = ['A', 'B'];
    octave0Notes.forEach((note) => {
      const fullNote = `${note}0`;
      
      allWhiteKeys.push(
        <TouchableOpacity
          key={`white-${fullNote}`}
          style={[
            styles.whiteKey,
            { width: whiteKeyWidth, height: keyHeight },
            isNoteActive(fullNote) && styles.activeWhiteKey
          ]}
          onPress={() => playNote(fullNote)}
          activeOpacity={0.7}
        >
          <Text style={[styles.keyLabel, { fontSize: whiteKeyWidth * 0.2 }]}>{note}</Text>
        </TouchableOpacity>
      );

      // A0 後面有黑鍵 A#0
      if (note === 'A') {
        const blackNote = `${note}#0`;
        const blackKeyLeft = (whiteKeyIndex + 1) * whiteKeyWidth - blackKeyWidth / 2;
        
        allBlackKeys.push(
          <TouchableOpacity
            key={`black-${blackNote}`}
            style={[
              styles.blackKey,
              { 
                left: blackKeyLeft,
                width: blackKeyWidth,
                height: keyHeight * 0.6
              },
              isNoteActive(blackNote) && styles.activeBlackKey
            ]}
            onPress={() => playNote(blackNote)}
            activeOpacity={0.7}
          />
        );
      }

      whiteKeyIndex++;
    });
    
    // 渲染 C1 到 C8
    const noteSequence = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const startOctave = 1;
    const endOctave = 8;
    
    for (let octave = startOctave; octave <= endOctave; octave++) {
      // 如果是最後一個八度（C8），只顯示 C
      const notesToRender = (octave === endOctave) ? ['C'] : noteSequence;

      notesToRender.forEach((note) => {
        const fullNote = `${note}${octave}`;
        
        // 渲染白鍵
        allWhiteKeys.push(
          <TouchableOpacity
            key={`white-${fullNote}`}
            style={[
              styles.whiteKey,
              { width: whiteKeyWidth, height: keyHeight },
              isNoteActive(fullNote) && styles.activeWhiteKey
            ]}
            onPress={() => playNote(fullNote)}
            activeOpacity={0.7}
          >
            <Text style={[styles.keyLabel, { fontSize: whiteKeyWidth * 0.2 }]}>{note}</Text>
          </TouchableOpacity>
        );

        // 渲染黑鍵（E和B後面沒有黑鍵，C8不需要黑鍵）
        if (hasBlackKey(note) && !(octave === endOctave && note === 'C')) {
          const blackNote = `${note}#${octave}`;
          const blackKeyLeft = (whiteKeyIndex + 1) * whiteKeyWidth - blackKeyWidth / 2;
          
          allBlackKeys.push(
            <TouchableOpacity
              key={`black-${blackNote}`}
              style={[
                styles.blackKey,
                { 
                  left: blackKeyLeft,
                  width: blackKeyWidth,
                  height: keyHeight * 0.6
                },
                isNoteActive(blackNote) && styles.activeBlackKey
              ]}
              onPress={() => playNote(blackNote)}
              activeOpacity={0.7}
            />
          );
        }

        whiteKeyIndex++;
      });
    }

    return { whiteKeys: allWhiteKeys, blackKeys: allBlackKeys };
  };

  const { whiteKeys, blackKeys } = renderPianoKeys();

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <View style={styles.keyboard}>
        <View style={styles.whiteKeysContainer}>
          {whiteKeys}
        </View>
        <View style={styles.blackKeysContainer}>
          {blackKeys}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 10,
  },
  keyboard: {
    position: 'relative',
    width: '100%',
  },
  whiteKeysContainer: {
    flexDirection: 'row',
  },
  blackKeysContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  whiteKey: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  blackKey: {
    position: 'absolute',
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 10,
  },
  activeWhiteKey: {
    backgroundColor: '#4CAF50',
  },
  activeBlackKey: {
    backgroundColor: '#66BB6A',
  },
  keyLabel: {
    color: '#666',
    fontWeight: '500',
  },
});

export default PianoKeyboard;
