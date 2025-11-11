"""
更新前端的 ngrok URL
"""
import re
import os

def update_ngrok_url():
    """更新前端 authService.ts 和 RecordScreen.tsx 中的 ngrok URL"""
    
    # 取得新的 ngrok URL
    print("=" * 50)
    print("  更新前端 ngrok URL")
    print("=" * 50)
    print()
    
    new_url = input("請輸入新的 ngrok HTTPS URL: ").strip()
    
    # 驗證 URL 格式
    if not new_url.startswith("https://") or "ngrok" not in new_url:
        print("❌ 錯誤: 必須是 ngrok 的 HTTPS URL")
        print("   格式應該像: https://xxxx.ngrok-free.app")
        return False
    
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 要更新的檔案列表
    files_to_update = [
        {
            "path": os.path.join(base_path, "Audio2Score", "src", "services", "authService.ts"),
            "name": "authService.ts"
        },
        {
            "path": os.path.join(base_path, "Audio2Score", "src", "screens", "RecordScreen.tsx"),
            "name": "RecordScreen.tsx"
        }
    ]
    
    success_count = 0
    
    for file_info in files_to_update:
        file_path = file_info["path"]
        file_name = file_info["name"]
        
        if not os.path.exists(file_path):
            print(f"⚠️  找不到檔案: {file_name}")
            continue
        
        # 讀取檔案
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 替換 ngrok URL
            pattern = r"(const NGROK_URL = ')[^']*(')"
            new_content = re.sub(pattern, f"\\1{new_url}\\2", content)
            
            # 檢查是否有變更
            if content == new_content:
                print(f"ℹ️  {file_name} 已經是最新的 URL")
            else:
                # 寫回檔案
                with open(file_path, 'w', encoding='utf-8', newline='') as f:
                    f.write(new_content)
                print(f"✅ 成功更新 {file_name}")
                success_count += 1
            
        except Exception as e:
            print(f"❌ 更新 {file_name} 失敗: {e}")
    
    if success_count > 0:
        print()
        print(f"✅ 總共更新了 {success_count} 個檔案")
        print(f"🌐 新的 ngrok URL: {new_url}")
        print()
        print("⚠️  重要：前端需要重新載入才能使用新的 URL")
        print("   在 Expo 視窗按 'r' 重新載入，或搖動手機重新載入")
    
    return success_count > 0

if __name__ == "__main__":
    success = update_ngrok_url()
    print()
    if not success:
        print("請檢查錯誤訊息並重試")
    # input("按 Enter 鍵退出...")
