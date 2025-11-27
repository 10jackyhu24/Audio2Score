// src/screens/MidiPlayerScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MidiPlayerScreen = () => {
  return (
    <View style={styles.container}>
      <Text>MIDI 播放頁面（之後接上 MIDIViewer）</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MidiPlayerScreen;
