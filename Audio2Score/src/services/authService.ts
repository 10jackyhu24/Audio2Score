import { User, LoginCredentials, RegisterCredentials } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 🌐 ngrok 配置
const USE_NGROK = true; // 設為 true 使用 ngrok，false 使用本地網路
const COMPUTER_IP = '192.168.0.14'; // 本地開發時使用（當 USE_NGROK = false）

// ngrok URL - 會被 start-all.ps1 自動更新
const NGROK_URL = 'https://easiest-venally-paola.ngrok-free.dev';

// 根據平台設定 API URL
const getApiUrl = () => {
  if (USE_NGROK) {
    console.log('🌐 使用 ngrok 模式');
    return `${NGROK_URL}/api`;
  }
  return `http://${COMPUTER_IP}:3000/api`;
};

export const API_URL = getApiUrl();
console.log('🔵 最終 API URL:', API_URL);

// 模擬 API 延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const login = async (credentials: LoginCredentials): Promise<User> => {
  try {
    // 🔵 調試日誌：顯示 API URL 和請求內容
    console.log('🔵 [登入] API URL:', API_URL);
    console.log('🔵 [登入] 完整 URL:', `${API_URL}/auth/login`);
    console.log('🔵 [登入] credentials 物件:', credentials);
    console.log('🔵 [登入] credentials.email:', credentials.email);
    console.log('🔵 [登入] credentials.password:', credentials.password);
    console.log('🔵 [登入] credentials.password 長度:', credentials.password?.length);
    console.log('🔵 [登入] JSON.stringify(credentials):', JSON.stringify(credentials));

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',  // 跳過 ngrok 警告頁面
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
    throw new Error('網路錯誤，請檢查連線狀態');
  }
};

export const register = async (credentials: RegisterCredentials): Promise<User> => {
  try {
    // 🔵 調試日誌：顯示 API URL 和請求內容
    console.log('🔵 [註冊] API URL:', API_URL);
    console.log('🔵 [註冊] 完整 URL:', `${API_URL}/auth/register`);
    console.log('🔵 [註冊] credentials 物件:', credentials);
    console.log('🔵 [註冊] credentials.username:', credentials.username);
    console.log('🔵 [註冊] credentials.email:', credentials.email);
    console.log('🔵 [註冊] credentials.password:', credentials.password);
    console.log('🔵 [註冊] credentials.password 長度:', credentials.password?.length);
    console.log('🔵 [註冊] JSON.stringify(credentials):', JSON.stringify(credentials));

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',  // 跳過 ngrok 警告頁面
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
    throw new Error('網路錯誤，請檢查連線狀態');
  }
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.removeItem('authToken');
};

export const getStoredToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('authToken');
};
