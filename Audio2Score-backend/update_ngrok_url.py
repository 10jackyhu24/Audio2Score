"""
更新前端的 ngrok URL
"""
import re
import os

def update_ngrok_url():
    """更新前端 authService.ts 中的 ngrok URL"""
    
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
    
    # 前端 authService.ts 的路徑
    frontend_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "Audio2Score",
        "src",
        "services",
        "authService.ts"
    )
    
    if not os.path.exists(frontend_path):
        print(f"❌ 找不到前端檔案: {frontend_path}")
        return False
    
    # 讀取檔案
    try:
        with open(frontend_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 替換 ngrok URL
        pattern = r"(const NGROK_URL = ')[^']*(')"
        replacement = f"\\1{new_url}\\2"
        new_content = re.sub(pattern, replacement, content)
        
        # 寫回檔案
        with open(frontend_path, 'w', encoding='utf-8', newline='') as f:
            f.write(new_content)
        
        print(f"✅ 成功更新 ngrok URL: {new_url}")
        print()
        print("下一步:")
        print("  1. 在前端視窗按 Ctrl+C 停止")
        print("  2. 重新執行: npm start")
        print("  3. 掃描 QR Code 測試")
        return True
        
    except Exception as e:
        print(f"❌ 更新失敗: {e}")
        return False

if __name__ == "__main__":
    update_ngrok_url()
    print()
    # input("按 Enter 鍵退出...")
