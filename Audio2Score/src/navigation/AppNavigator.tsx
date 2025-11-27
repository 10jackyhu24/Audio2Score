// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { MidiPlayerScreen } from '../screens/MidiPlayerScreen';
import { useAuth } from '../context/AuthContext';
import TabNavigator from './TabNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {/* 🔹 Main tab navigation after login */}
            <Stack.Screen
              name="MainTabs"
              component={TabNavigator}
              options={{ headerShown: false }}
            />

            {/* 🔹 New MIDI player screen (pushed on top of tabs) */}
            <Stack.Screen
              name="MidiPlayer"
              component={MidiPlayerScreen}
              options={{
                headerShown: true,
                title: 'MIDI 播放',
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                headerShown: true,
                headerTitle: '註冊',
                headerBackTitle: '返回',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
