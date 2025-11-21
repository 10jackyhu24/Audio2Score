"""
API 路由 - Audio2Score Backend
處理使用者註冊、登入等功能
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, status, Request, Depends, Header, File, UploadFile
from typing import Optional
import datetime
from pathlib import Path
import shutil
from music_conversion_tool import music_tool

# Debug: 檢查 runtime 中的 `datetime` 是否被 shadow（啟動時會印出，測試後請移除）
print("DEBUG: routes module loaded. datetime ->", datetime, type(datetime), "has timezone:", hasattr(datetime, 'timezone'))

from fastapi.responses import JSONResponse

from models import UserCreate, UserLogin, UserWithToken, UserResponse
from auth import get_password_hash, verify_password, create_access_token, verify_token
from database import database

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# 安全檔案名稱處理
def sanitize_filename(filename: str) -> str:
    """清理檔案名稱，移除不安全字元"""
    # 只允許字母、數字、下劃線、點號、破折號
    import re
    filename = re.sub(r'[^\w\.\-]', '_', filename)
    # 限制長度
    filename = filename[:100]
    return filename

def get_user_upload_dir(username: str, create_if_not_exists: bool = True) -> Path:
    """取得使用者專屬的上傳目錄"""
    # 清理使用者名稱
    safe_username = sanitize_filename(username)
    
    # 基礎上傳目錄
    base_uploads_dir = Path(__file__).resolve().parent / "uploads"
    
    # 使用者專屬目錄
    user_upload_dir = base_uploads_dir / safe_username
    
    if create_if_not_exists:
        user_upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 設定目錄權限（在 Unix 系統上）
        if hasattr(os, 'chmod'):
            try:
                os.chmod(user_upload_dir, 0o755)  # rwxr-xr-x
            except Exception:
                pass  # 在 Windows 上忽略權限設定錯誤
    
    return user_upload_dir

def cleanup_old_files(user_upload_dir: Path, max_age_hours: int = 24):
    """清理超過指定時間的舊檔案"""
    try:
        current_time = datetime.datetime.now().timestamp()
        max_age_seconds = max_age_hours * 3600
        
        for file_path in user_upload_dir.glob('*'):
            if file_path.is_file():
                file_age = current_time - file_path.stat().st_mtime
                if file_age > max_age_seconds:
                    try:
                        file_path.unlink()
                        print(f"🔄 清理舊檔案: {file_path.name}")
                    except Exception as e:
                        print(f"⚠️ 清理檔案失敗 {file_path.name}: {e}")
    except Exception as e:
        print(f"⚠️ 清理舊檔案時發生錯誤: {e}")

async def get_current_user_from_token(authorization: Optional[str] = Header(None)):
    """從 Token 取得當前使用者（依賴注入）"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供認證 Token"
        )
    
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    user_id = payload.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的 Token"
        )
    
    pool = database.get_pool()
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="資料庫連線失敗"
        )
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, username, email, created_at FROM users WHERE id = $1",
            user_id
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="使用者不存在"
            )
        
        return user

@router.post("/register", response_model=UserWithToken, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, request: Request):
    """
    註冊新使用者
    
    - **username**: 使用者名稱（3-50字元）
    - **email**: 電子郵件
    - **password**: 密碼（至少6個字元）
    """
    print("=" * 60)
    print("🔵🔵🔵 [後端] register 函數被呼叫")
    print(f"🔵 [後端] user 物件: {user}")
    print(f"🔵 [後端] user.username: {user.username}")
    print(f"🔵 [後端] user.email: {user.email}")
    print(f"🔵 [後端] user.password: {user.password}")
    print(f"🔵 [後端] user.password 長度: {len(user.password)}")
    print(f"🔵 [後端] user.password 型態: {type(user.password)}")
    print("=" * 60)
    
    try:
        print("🟢 [後端] 收到註冊請求")
        print(f"🟢 [後端] 請求來源: {request.client.host if request.client else '未知'}")
        print(f"🟢 [後端] 註冊資料: username={user.username}, email={user.email}, password={user.password}")
        
        pool = database.get_pool()
        if not pool:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="資料庫連線失敗"
            )
        
        async with pool.acquire() as conn:
            # 檢查使用者是否已存在
            existing_user = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1 OR username = $2",
                user.email, user.username
            )
            
            if existing_user:
                print("❌ [後端] 使用者名稱或信箱已被使用")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="使用者名稱或信箱已被使用"
                )
            
            # 加密密碼
            password_hash = get_password_hash(user.password)
            
            # 新增使用者
            new_user = await conn.fetchrow(
                """
                INSERT INTO users (username, email, password_hash, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, username, email, created_at
                """,
                user.username, user.email, password_hash, datetime.datetime.utcnow(), datetime.datetime.utcnow()
            )
            
            # 建立使用者專屬目錄
            user_upload_dir = get_user_upload_dir(new_user["username"])
            print(f"✅ 建立使用者目錄: {user_upload_dir}")
            
            # 建立 Token
            token = create_access_token(
                data={"id": new_user["id"], "username": new_user["username"]}
            )
            
            print(f"✅ 新使用者註冊: {user.username} ({user.email})")
            
            return {
                "message": "註冊成功",
                "user": {
                    "id": new_user["id"],
                    "username": new_user["username"],
                    "email": new_user["email"],
                    "created_at": new_user["created_at"]
                },
                "token": token
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌❌❌ 註冊錯誤 ❌❌❌")
        print(f"錯誤訊息: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"伺服器錯誤: {str(e)}"
        )

@router.post("/login", response_model=UserWithToken)
async def login(credentials: UserLogin, request: Request):
    """
    使用者登入
    
    - **email**: 電子郵件
    - **password**: 密碼
    """
    print("=" * 60)
    print("🔵🔵🔵 [後端] login 函數被呼叫")
    print(f"🔵 [後端] credentials 物件: {credentials}")
    print(f"🔵 [後端] credentials.email: {credentials.email}")
    print(f"🔵 [後端] credentials.password: {credentials.password}")
    print(f"🔵 [後端] credentials.password 長度: {len(credentials.password)}")
    print(f"🔵 [後端] credentials.password 型態: {type(credentials.password)}")
    print("=" * 60)
    
    try:
        print("🟢 [後端] 收到登入請求")
        print(f"🟢 [後端] 請求來源: {request.client.host if request.client else '未知'}")
        print(f"🟢 [後端] 登入資料: email={credentials.email}, password={credentials.password}, type={type(credentials.password)}")
        
        pool = database.get_pool()
        if not pool:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="資料庫連線失敗"
            )
        
        async with pool.acquire() as conn:
            # 查詢使用者
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1",
                credentials.email
            )
            
            if not user:
                print("❌ [後端] 帳號不存在")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="帳號或密碼錯誤"
                )
            
            # 驗證密碼
            if not verify_password(credentials.password, user["password_hash"]):
                print("❌ [後端] 密碼錯誤")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="帳號或密碼錯誤"
                )
            
            # 建立 Token
            token = create_access_token(
                data={"id": user["id"], "username": user["username"]}
            )
            
            print(f"✅ 使用者登入: {user['username']} ({user['email']})")
            
            return {
                "message": "登入成功",
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "created_at": user["created_at"]
                },
                "token": token
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌❌❌ 登入錯誤 ❌❌❌")
        print(f"錯誤訊息: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"伺服器錯誤: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user(user = Depends(get_current_user_from_token)):
    """
    取得目前登入使用者資訊
    
    需要在 Header 中提供 Authorization: Bearer <token>
    """
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"]
    }

# 創建專門處理上傳的路由
upload_router = APIRouter(prefix="/api", tags=["File Upload"])

@upload_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user = Depends(get_current_user_from_token)
):
    """
    處理文件上傳 - 安全版本，每個使用者有獨立目錄
    """
    try:
        print("🔵 [上傳] 開始處理檔案上傳...")
        print(f"🔵 [上傳] 使用者: {user['username']} (ID: {user['id']})")
        print("REQ-DEBUG datetime ->", datetime, type(datetime), "has timezone:", hasattr(datetime, 'timezone'))

        # 基本檢查
        if not file.filename:
            return JSONResponse(
                status_code=400,
                content={"error": "沒有收到檔案"}
            )

        # 安全檢查：檔案大小限制 (50MB)
        max_file_size = 50 * 1024 * 1024  # 50MB
        file_size = 0
        
        # 讀取並檢查檔案內容
        contents = await file.read()
        file_size = len(contents)
        
        if file_size > max_file_size:
            return JSONResponse(
                status_code=400,
                content={"error": f"檔案大小超過限制 (最大 {max_file_size//1024//1024}MB)"}
            )
        
        if file_size == 0:
            return JSONResponse(
                status_code=400,
                content={"error": "檔案為空"}
            )

        # 清理檔案名稱
        safe_filename = sanitize_filename(file.filename)
        
        # 取得使用者專屬目錄
        user_upload_dir = get_user_upload_dir(user['username'])
        
        # 清理舊檔案（保留最近24小時的檔案）
        cleanup_old_files(user_upload_dir, max_age_hours=24)
        
        # 產生唯一檔案名稱避免衝突
        file_extension = Path(safe_filename).suffix
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        file_path = user_upload_dir / unique_filename
        
        # 儲存上傳的檔案
        with open(file_path, "wb") as f:
            f.write(contents)
        
        print(f"✅ [上傳] 收到檔案: {safe_filename} -> {unique_filename}, 大小: {file_size} bytes")
        print(f"✅ [上傳] 儲存路徑: {file_path}")

        # 轉換為 MIDI
        print(f"✅ 開始預測處理檔案: {unique_filename}")
        
        try:
            # 轉換檔案
            music_tool.wav_to_midi(str(file_path), str(user_upload_dir))
            
            # 檢查是否成功產生 MIDI 檔案
            midi_filename = f"{Path(unique_filename).stem}_basic_pitch.mid"
            midi_file_path = user_upload_dir / midi_filename
            
            if midi_file_path.exists():
                print(f"✅ MIDI 轉換成功: {midi_filename}")
                
                # 回傳轉換結果
                return {
                    "status": "success",
                    "message": "檔案轉換成功",
                    "original_filename": safe_filename,
                    "saved_filename": unique_filename,
                    "midi_filename": midi_filename,
                    "size": file_size,
                    "content_type": file.content_type,
                    "upload_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "user": user['username']
                }
            else:
                print("❌ MIDI 檔案未產生")
                return JSONResponse(
                    status_code=500,
                    content={"error": "MIDI 轉換失敗，未產生輸出檔案"}
                )
                
        except Exception as conversion_error:
            print(f"❌ 轉換過程錯誤: {conversion_error}")
            # 如果轉換失敗，刪除上傳的檔案
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as cleanup_error:
                print(f"⚠️ 清理失敗檔案時發生錯誤: {cleanup_error}")
            
            return JSONResponse(
                status_code=500,
                content={"error": f"檔案轉換失敗: {str(conversion_error)}"}
            )

    except Exception as e:
        # 印出完整 traceback 到 server 日誌，避免只回傳簡短錯誤
        import traceback
        print(f"❌ [上傳] 錯誤: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500, 
            content={"error": f"伺服器錯誤: {str(e)}"}
        )

@upload_router.get("/files")
async def get_user_files(user = Depends(get_current_user_from_token)):
    """取得使用者的檔案列表"""
    try:
        user_upload_dir = get_user_upload_dir(user['username'], create_if_not_exists=False)
        
        if not user_upload_dir.exists():
            return {"files": []}
        
        files = []
        for file_path in user_upload_dir.glob('*'):
            if file_path.is_file():
                files.append({
                    "filename": file_path.name,
                    "size": file_path.stat().st_size,
                    "modified": datetime.datetime.fromtimestamp(
                        file_path.stat().st_mtime
                    ).isoformat(),
                    "is_midi": file_path.suffix.lower() == '.mid'
                })
        
        return {"files": sorted(files, key=lambda x: x["modified"], reverse=True)}
    
    except Exception as e:
        print(f"❌ 取得檔案列表錯誤: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"取得檔案列表失敗: {str(e)}"}
        )

@upload_router.delete("/files/{filename}")
async def delete_user_file(
    filename: str,
    user = Depends(get_current_user_from_token)
):
    """刪除使用者檔案"""
    try:
        # 安全檢查：確保檔案名稱合法
        safe_filename = sanitize_filename(filename)
        
        user_upload_dir = get_user_upload_dir(user['username'], create_if_not_exists=False)
        file_path = user_upload_dir / safe_filename
        
        # 額外安全檢查：確保檔案在使用者目錄內
        if not file_path.resolve().parent.samefile(user_upload_dir.resolve()):
            return JSONResponse(
                status_code=400,
                content={"error": "無效的檔案路徑"}
            )
        
        if not file_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "檔案不存在"}
            )
        
        file_path.unlink()
        
        print(f"✅ 刪除檔案: {user['username']}/{safe_filename}")
        return {"status": "success", "message": "檔案刪除成功"}
    
    except Exception as e:
        print(f"❌ 刪除檔案錯誤: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"刪除檔案失敗: {str(e)}"}
        )