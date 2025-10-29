import { User, LoginCredentials, RegisterCredentials } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 🔧 重要：修改這個 IP 為你的電腦 IP（使用 ipconfig 查看）
const COMPUTER_IP = '192.168.0.14'; // 你的電腦區域網路 IP

// 根據平台設定 API URL
const getApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api'; // Android 模擬器
  }
  
  // iOS 和其他平台
  // 如果是在模擬器中，使用 localhost；實體設備使用電腦 IP
  return `http://${COMPUTER_IP}:3000/api`;
};

const API_URL = getApiUrl();

// 模擬 API 延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const login = async (credentials: LoginCredentials): Promise<User> => {
  try {
    // 🔍 調試日誌：顯示 API URL 和請求資料
    console.log('🔵 [登入] API URL:', API_URL);
    console.log('🔵 [登入] 完整 URL:', `${API_URL}/auth/login`);
    console.log('🔵 [登入] 請求資料:', { email: credentials.email });

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('🔵 [登入] 回應狀態:', response.status);
    console.log('🔵 [登入] 回應 OK?:', response.ok);

    const data = await response.json();
    console.log('🔵 [登入] 回應資料:', data);

    if (!response.ok) {
      console.log('❌ [登入] 失敗:', data.error || '登入失敗');
      throw new Error(data.error || '登入失敗');
    }

    // 儲存 token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
      console.log('✅ [登入] Token 已儲存');
    }

    console.log('✅ [登入] 成功!');
    return {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      token: data.token,
    };
  } catch (error) {
    console.log('❌ [登入] 發生錯誤:', error);
    if (error instanceof Error) {
      console.log('❌ [登入] 錯誤訊息:', error.message);
      console.log('❌ [登入] 錯誤類型:', error.name);
      throw error;
    }
    throw new Error('網路錯誤，請檢查您的連線');
  }
};

export const register = async (credentials: RegisterCredentials): Promise<User> => {
  try {
    // 🔍 調試日誌：顯示 API URL 和請求資料
    console.log('🔵 [註冊] API URL:', API_URL);
    console.log('🔵 [註冊] 完整 URL:', `${API_URL}/auth/register`);
    console.log('🔵 [註冊] 請求資料:', { 
      username: credentials.username, 
      email: credentials.email,
      // 不顯示密碼
    });

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('🔵 [註冊] 回應狀態:', response.status);
    console.log('🔵 [註冊] 回應 OK?:', response.ok);

    const data = await response.json();
    console.log('🔵 [註冊] 回應資料:', data);

    if (!response.ok) {
      console.log('❌ [註冊] 失敗:', data.error || '註冊失敗');
      throw new Error(data.error || '註冊失敗');
    }

    // 儲存 token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
      console.log('✅ [註冊] Token 已儲存');
    }

    console.log('✅ [註冊] 成功!');
    return {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      token: data.token,
    };
  } catch (error) {
    console.log('❌ [註冊] 發生錯誤:', error);
    if (error instanceof Error) {
      console.log('❌ [註冊] 錯誤訊息:', error.message);
      console.log('❌ [註冊] 錯誤類型:', error.name);
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