import { User, LoginCredentials, RegisterCredentials } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 根據平台設定 API URL
// Android 模擬器使用 10.0.2.2，iOS 模擬器和 Web 使用 localhost
const getApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api'; // Android 模擬器
  }
  return 'http://localhost:3000/api'; // iOS 模擬器和 Web
};

const API_URL = getApiUrl();

// 模擬 API 延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const login = async (credentials: LoginCredentials): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '登入失敗');
    }

    // 儲存 token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      token: data.token,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('網路錯誤，請檢查您的連線');
  }
};

export const register = async (credentials: RegisterCredentials): Promise<User> => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '註冊失敗');
    }

    // 儲存 token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      token: data.token,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('網路錯誤，請檢查您的連線');
  }
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.removeItem('authToken');
};

export const getStoredToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('authToken');
};