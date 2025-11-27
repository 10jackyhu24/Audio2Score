import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MidiPlayerScreen } from '../screens/MidiPlayerScreen'; // 👈 NEW

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size, color }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'Record') {
            iconName = focused ? 'mic' : 'mic-outline';
          } else if (route.name === 'MidiPlayer') {
            // 👇 use a music-related icon for the MIDI player
            iconName = focused ? 'musical-notes' : 'musical-notes-outline';
          } else {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />

      {/* 👇 NEW TAB */}
      <Tab.Screen
        name="MidiPlayer"
        component={MidiPlayerScreen}
        options={{ title: 'MIDI 播放' }}
      />

      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
