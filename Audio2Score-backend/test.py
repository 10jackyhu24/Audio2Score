"""
測試 API 的簡單腳本
"""
import requests
import json

BASE_URL = "http://127.0.0.1:3000"

def test_health():
    """測試健康檢查"""
    print("\n" + "=" * 50)
    print("測試健康檢查")
    print("=" * 50)
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"狀態碼: {response.status_code}")
        print(f"回應:\n{json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return False

def test_register(username="testuser", email="test@example.com", password="password123"):
    """測試註冊"""
    print("\n" + "=" * 50)
    print("測試註冊")
    print("=" * 50)
    try:
        data = {
            "username": username,
            "email": email,
            "password": password
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=data, timeout=5)
        print(f"狀態碼: {response.status_code}")
        print(f"回應:\n{json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code in [200, 201]
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return False

def test_login(email="test@example.com", password="password123"):
    """測試登入"""
    print("\n" + "=" * 50)
    print("測試登入")
    print("=" * 50)
    try:
        data = {
            "email": email,
            "password": password
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=data, timeout=5)
        print(f"狀態碼: {response.status_code}")
        result = response.json()
        print(f"回應:\n{json.dumps(result, indent=2, ensure_ascii=False)}")
        
        if response.status_code == 200 and "token" in result:
            token = result["token"]
            print(f"\n✅ Token: {token[:50]}...")
            return token
        return None
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return None

def test_me(token):
    """測試取得使用者資訊"""
    print("\n" + "=" * 50)
    print("測試取得使用者資訊")
    print("=" * 50)
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=5)
        print(f"狀態碼: {response.status_code}")
        print(f"回應:\n{json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        return False

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  Audio2Score API 測試")
    print("=" * 50)
    
    # 測試健康檢查
    if not test_health():
        print("\n❌ 伺服器未運行！")
        print("請先啟動伺服器: python main.py")
        exit(1)
    
    print("\n✅ 伺服器正在運行")
    
    # 測試註冊
    test_register()
    
    # 測試登入
    token = test_login()
    
    # 測試取得使用者資訊
    if token:
        test_me(token)
    
    print("\n" + "=" * 50)
    print("  測試完成！")
    print("=" * 50 + "\n")
