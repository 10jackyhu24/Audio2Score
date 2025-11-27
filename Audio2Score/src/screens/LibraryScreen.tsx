import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const LibraryScreen = () => (
  <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>Library Screen</Text>
  </View>
  </SafeAreaView>
);
