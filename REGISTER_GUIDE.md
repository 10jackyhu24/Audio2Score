# Audio2Score 前端註冊功能使用指南

## 📱 已完成的註冊介面功能

### ✅ 功能清單

1. **完整的註冊畫面**
   - 使用者名稱輸入框
   - 電子郵件輸入框
   - 密碼輸入框
   - 確認密碼輸入框
   - 密碼強度提示
   - 即時表單驗證
   - 錯誤訊息顯示

2. **表單驗證規則**
   - 使用者名稱: 3-20 字元，只能包含英文、數字和底線
   - 電子郵件: 有效的 email 格式
   - 密碼: 至少 6 字元，包含大小寫字母或字母加數字
   - 確認密碼: 必須與密碼相同

3. **UI/UX 設計**
   - 美觀的卡片式設計
   - 響應式布局
   - 載入動畫
   - 錯誤提示
   - 密碼強度說明

4. **導航功能**
   - 從登入頁面導航到註冊頁面
   - 從註冊頁面返回登入頁面
   - 註冊成功後自動登入並導航到首頁

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd Audio2Score
npm install
```

### 2. 啟動開發伺服器

```bash
npm start
```

### 3. 運行應用

- **Android 模擬器**: 按 `a`
- **iOS 模擬器**: 按 `i`
- **Web 瀏覽器**: 按 `w`
- **實體裝置**: 掃描 QR code

## 📝 使用流程

### 註冊新使用者

1. 在登入頁面點擊「註冊新帳號」按鈕
2. 填寫註冊表單：
   - 輸入使用者名稱 (例如: jackyhu)
   - 輸入電子郵件 (例如: jackyhu@example.com)
   - 輸入密碼 (例如: Password123)
   - 再次輸入密碼確認
3. 點擊「註冊」按鈕
4. 等待註冊處理
5. 註冊成功後會自動登入並進入首頁

### 登入現有使用者

1. 在登入頁面輸入：
   - 電子郵件
   - 密碼
2. 點擊「登入」按鈕
3. 登入成功後進入首頁

## 🎨 界面截圖說明

### 登入頁面
- 標題: "Audio2Score"
- 副標題: "登入您的帳戶"
- 輸入框: 電子郵件、密碼
- 按鈕: "登入"、"註冊新帳號"

### 註冊頁面
- 標題: "建立新帳號"
- 副標題: "加入 Audio2Score"
- 輸入框: 使用者名稱、電子郵件、密碼、確認密碼
- 密碼提示框
- 按鈕: "註冊"
- 連結: "已經有帳號？立即登入"

## 🔧 設定 API 連線

### 在實體裝置上測試

如果您使用實體裝置測試，需要修改 API URL：

1. 找到您電腦的 IP 位址：
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. 建立環境配置文件 `src/config/env.ts`:
   ```typescript
   export const API_CONFIG = {
     BASE_URL: 'http://YOUR_IP_ADDRESS:3000/api', // 替換為您的 IP
   };
   ```

3. 更新 `src/services/authService.ts`:
   ```typescript
   import { API_CONFIG } from '../config/env';
   const API_URL = API_CONFIG.BASE_URL;
   ```

## 📦 相關文件

- **RegisterScreen.tsx**: 註冊畫面組件
- **LoginScreen.tsx**: 登入畫面組件（已更新）
- **AuthContext.tsx**: 認證狀態管理
- **authService.ts**: API 呼叫服務
- **AppNavigator.tsx**: 導航配置
- **types/index.ts**: TypeScript 類型定義

## 🐛 常見問題

### 1. AsyncStorage 模組找不到
```bash
npm install @react-native-async-storage/async-storage
```

### 2. 無法連接到後端 API
- 確認後端伺服器正在運行 (http://localhost:3000)
- 檢查防火牆設定
- 在 Android 模擬器上，使用 `10.0.2.2` 而不是 `localhost`

### 3. 註冊按鈕無反應
- 檢查所有欄位是否填寫完整
- 查看是否有驗證錯誤訊息
- 開啟開發者工具查看錯誤訊息

### 4. 密碼驗證失敗
- 確認密碼至少 6 個字元
- 確認包含大小寫字母或字母加數字
- 確認兩次輸入的密碼相同

## 🎯 測試建議

### 測試案例 1: 成功註冊
- 使用者名稱: testuser
- 電子郵件: test@example.com
- 密碼: Password123
- 預期結果: 註冊成功，自動登入

### 測試案例 2: 重複註冊
- 使用相同的電子郵件再次註冊
- 預期結果: 顯示「使用者名稱或信箱已被使用」錯誤

### 測試案例 3: 密碼不一致
- 密碼: Password123
- 確認密碼: Password456
- 預期結果: 顯示「兩次輸入的密碼不一致」錯誤

### 測試案例 4: 弱密碼
- 密碼: 123456
- 預期結果: 顯示「密碼需要包含大小寫字母或字母加數字」錯誤

## 📱 在不同平台上運行

### Android
```bash
npm start
# 按 'a' 啟動 Android 模擬器
```

### iOS (僅限 Mac)
```bash
npm start
# 按 'i' 啟動 iOS 模擬器
```

### Web
```bash
npm start
# 按 'w' 在瀏覽器中打開
```

## 🔐 安全性說明

1. **密碼加密**: 密碼在後端使用 bcrypt 加密儲存
2. **Token 管理**: JWT token 儲存在 AsyncStorage
3. **HTTPS**: 生產環境建議使用 HTTPS
4. **輸入驗證**: 前後端都有完整的輸入驗證

## 📚 延伸學習

- [React Navigation 文檔](https://reactnavigation.org/)
- [Expo 文檔](https://docs.expo.dev/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [JWT 認證](https://jwt.io/introduction)

## 💡 下一步

前端註冊功能已完成！您現在可以：
1. 測試註冊和登入流程
2. 自訂 UI 樣式和主題
3. 添加更多驗證規則
4. 實作忘記密碼功能
5. 添加社交媒體登入
