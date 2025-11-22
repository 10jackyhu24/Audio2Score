// components/PianoKeyboard.tsx
import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { PianoKeyboardProps } from '../types/midi';

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ 
  onNotePress, 
  activeNotes = [] 
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 定義完整的鋼琴鍵盤範圍（A0 到 C8）
  // 為了更好的顯示，我們使用 A2 到 C7
  const whiteKeyWidth = 40;
  const blackKeyWidth = 24;
  
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
  const renderPianoKeys = () => {
    const allWhiteKeys: React.ReactElement[] = [];
    const allBlackKeys: React.ReactElement[] = [];
    
    // 定義音符序列（從A開始）
    const noteSequence = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let whiteKeyIndex = 0;
    // 從 A0 開始，到 C7 結束
    const startOctave = 0;
    const endOctave = 7;
    
    for (let octave = startOctave; octave <= endOctave; octave++) {
      // 如果是最後一個八度，只顯示到 C
      const notesToRender = (octave === endOctave) ? ['A', 'B', 'C'] : noteSequence;

      notesToRender.forEach((note) => {
        const fullNote = `${note}${octave}`;
        
        // 渲染白鍵
        allWhiteKeys.push(
          <TouchableOpacity
            key={`white-${fullNote}`}
            style={[
              styles.whiteKey,
              { width: whiteKeyWidth },
              isNoteActive(fullNote) && styles.activeWhiteKey
            ]}
            onPress={() => playNote(fullNote)}
            activeOpacity={0.7}
          >
            <Text style={styles.keyLabel}>{note}</Text>
          </TouchableOpacity>
        );

        // 渲染黑鍵（E和B後面沒有黑鍵，最後一個八度只有C所以不需要黑鍵）
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
                  width: blackKeyWidth 
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
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.keyboard}>
          <View style={styles.whiteKeysContainer}>
            {whiteKeys}
          </View>
          <View style={styles.blackKeysContainer}>
            {blackKeys}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 150,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  scrollContent: {
    paddingHorizontal: 10,
  },
  keyboard: {
    height: '100%',
    position: 'relative',
  },
  whiteKeysContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  blackKeysContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    pointerEvents: 'box-none',
  },
  whiteKey: {
    height: '100%',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  blackKey: {
    position: 'absolute',
    height: '100%',
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
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
});

export default PianoKeyboard;
