import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { RecordScreen } from '../screens/RecordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }: { focused: boolean; size: number }) => {
          // simple icon map
          const name =
            route.name === 'Home' ? 'home' :
            route.name === 'Library' ? 'albums' :
            route.name === 'Record' ? 'mic' :
            'settings';
          return <Ionicons name={focused ? name : `${name}-outline`} size={size} />;
        },
      })}
      initialRouteName="Home"
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      
      
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
