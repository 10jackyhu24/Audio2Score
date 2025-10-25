import { User, LoginCredentials } from '../types';

// 模擬 API 延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const login = async (credentials: LoginCredentials): Promise<User> => {
  await delay(1500); // 模擬網路請求

  // 模擬驗證（實際應該呼叫後端 API）
  if (credentials.email === 'test@example.com' && credentials.password === 'password123') {
    return {
      id: '1',
      email: credentials.email,
      username: '10jackyhu24',
      token: 'mock-jwt-token-12345',
    };
  }

  throw new Error('帳號或密碼錯誤');
};

// 未來可以加入：
// export const register = async (data: RegisterData): Promise<User> => { ... }
// export const refreshToken = async (): Promise<string> => { ... }
// export const resetPassword = async (email: string): Promise<void> => { ... }