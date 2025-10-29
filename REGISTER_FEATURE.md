# Audio2Score 註冊功能

## 已完成的功能

### 前端 (React Native + Expo)

1. **註冊畫面** (`RegisterScreen.tsx`)
   - 使用者名稱輸入 (3-20 字元，只能包含英文、數字和底線)
   - 電子郵件驗證
   - 密碼強度驗證 (至少 6 字元，包含大小寫或字母加數字)
   - 確認密碼驗證
   - 密碼提示說明
   - 完整的表單驗證
   - 載入狀態顯示
   - 錯誤訊息提示

2. **登入畫面更新** (`LoginScreen.tsx`)
   - 添加導航到註冊頁面的按鈕
   - 整合導航功能

3. **認證服務** (`authService.ts`)
   - 實作註冊 API 呼叫
   - 實作登入 API 呼叫
   - Token 儲存功能 (使用 AsyncStorage)
   - 錯誤處理

4. **認證上下文** (`AuthContext.tsx`)
   - 添加 `register` 方法
   - 管理使用者狀態
   - 載入狀態管理

5. **導航配置** (`AppNavigator.tsx`)
   - 添加註冊路由
   - 設定導航堆疊
   - 根據認證狀態切換畫面

6. **類型定義** (`types/index.ts`)
   - `RegisterCredentials` 介面
   - 更新 `AuthContextType` 介面

### 後端 (Node.js + Express + PostgreSQL)

1. **資料庫配置** (`config/database.ts`)
   - PostgreSQL 連線池設定
   - 錯誤處理
   - 連線超時設定
   - 優雅關閉處理

2. **資料庫初始化** (`config/initDatabase.ts`)
   - 自動建立 users 表格
   - 自動建立 audio_files 表格
   - 自動建立 transcriptions 表格
   - 建立資料庫索引

3. **認證控制器** (`controllers/authController.ts`)
   - 註冊功能 (bcrypt 密碼加密)
   - 登入功能 (密碼驗證)
   - 取得使用者資訊
   - JWT token 產生

4. **認證中間件** (`middleware/auth.ts`)
   - JWT token 驗證
   - 受保護路由處理

5. **路由配置** (`routes/auth.ts`)
   - POST `/api/auth/register` - 註冊
   - POST `/api/auth/login` - 登入
   - GET `/api/auth/me` - 取得使用者資訊 (需要 token)

6. **伺服器設定** (`server.ts`)
   - CORS 配置
   - 錯誤處理中間件
   - 資料庫連線測試
   - 健康檢查端點

## 安裝與運行

### 後端設定

1. 安裝依賴：
```bash
cd Audio2Score-backend
npm install
```

2. 設定 PostgreSQL：
   - 確認 PostgreSQL 正在運行
   - 修改 `.env` 文件中的資料庫密碼
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=你的密碼
   DB_NAME=audio2score
   JWT_SECRET=your-secret-key
   PORT=3000
   ```

3. 測試資料庫連線：
```bash
npm run test:db
```

4. 啟動伺服器：
```bash
npm run dev
```

伺服器會在 `http://localhost:3000` 運行

### 前端設定

1. 安裝依賴：
```bash
cd Audio2Score
npm install
```

2. 啟動 Expo 開發伺服器：
```bash
npm start
```

3. 在模擬器或實體裝置上運行：
   - 按 `a` 啟動 Android 模擬器
   - 按 `i` 啟動 iOS 模擬器
   - 掃描 QR code 在實體裝置上運行

## API 端點

### 註冊
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password123"
}
```

### 登入
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123"
}
```

### 取得使用者資訊
```http
GET http://localhost:3000/api/auth/me
Authorization: Bearer <your-token>
```

## 資料庫結構

### users 表格
- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR(50) UNIQUE)
- `email` (VARCHAR(100) UNIQUE)
- `password_hash` (VARCHAR(255))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## 注意事項

1. **安全性**
   - 密碼使用 bcrypt 加密 (10 rounds)
   - JWT token 有效期為 7 天
   - 請更改 `.env` 中的 JWT_SECRET 為隨機字串

2. **驗證規則**
   - 使用者名稱: 3-20 字元，只能包含英文、數字和底線
   - 電子郵件: 必須是有效的 email 格式
   - 密碼: 至少 6 字元，需包含大小寫字母或字母加數字

3. **錯誤處理**
   - 前端顯示友善的錯誤訊息
   - 後端記錄詳細的錯誤資訊
   - 自動重試資料庫連線 (最多 3 次)

## 問題排除

### 資料庫連線失敗
- 檢查 PostgreSQL 服務是否正在運行
- 確認 `.env` 中的資料庫密碼正確
- 檢查 `pg_hba.conf` 是否允許本地連線

### 前端無法連接後端
- 確認後端伺服器正在運行
- 檢查 `authService.ts` 中的 API_URL 設定
- 在實體裝置上，請將 `localhost` 改為電腦的 IP 位址

### AsyncStorage 錯誤
- 運行 `npm install` 安裝依賴
- 如果使用 Expo，運行 `expo install @react-native-async-storage/async-storage`

## 下一步開發

- [ ] 忘記密碼功能
- [ ] Email 驗證
- [ ] 社交媒體登入 (Google, Facebook)
- [ ] 使用者個人資料編輯
- [ ] Token 自動刷新
- [ ] 登出功能實作
