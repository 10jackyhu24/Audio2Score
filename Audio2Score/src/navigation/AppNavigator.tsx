// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useAuth } from '../context/AuthContext';
import TabNavigator from './TabNavigator'; // make sure this path is correct

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { user } = useAuth(); // user should be truthy after login

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // changed from "Home" so when logged in, go to the TABS
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: true, headerTitle: '註冊', headerBackTitle: '返回' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
