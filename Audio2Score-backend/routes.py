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

# Debug: 檢查 runtime 中的 `datetime` 是否被 shadow（啟動時會印出，測試後請移除）
print("DEBUG: routes module loaded. datetime ->", datetime, type(datetime), "has timezone:", hasattr(datetime, 'timezone'))

from fastapi.responses import JSONResponse

from models import UserCreate, UserLogin, UserWithToken, UserResponse
from auth import get_password_hash, verify_password, create_access_token, verify_token
from database import database

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    取得目前登入使用者資訊
    
    需要在 Header 中提供 Authorization: Bearer <token>
    """
    try:
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
            
            return {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "created_at": user["created_at"]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 取得使用者資訊錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"伺服器錯誤: {str(e)}"
        )

# 創建專門處理上傳的路由
upload_router = APIRouter(prefix="/api", tags=["File Upload"])
@upload_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    處理文件上傳 - 簡化版本
    """
    try:
        # Request-time debug to check whether `datetime` got shadowed at runtime
        print("🔵 [上傳] 開始處理檔案上傳...")
        print("REQ-DEBUG datetime ->", datetime, type(datetime), "has timezone:", hasattr(datetime, 'timezone'))

        # 基本檢查
        if not file.filename:
            return {"error": "沒有收到檔案"}

        # 讀取檔案內容
        contents = await file.read()
        file_size = len(contents)
        
        # 儲存上傳的檔案
        uploads_dir = Path(__file__).resolve().parent / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        file_path = uploads_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(contents)
        
        print(f"✅ [上傳] 收到檔案: {file.filename}, 大小: {file_size} bytes")
        
        # 簡單回應
        return {
            "status": "success",
            "message": "檔案接收成功",
            "filename": file.filename,
            "size": file_size,
            "content_type": file.content_type,
            "upload_time": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    except Exception as e:
        # 印出完整 traceback 到 server 日誌，避免只回傳簡短錯誤
        import traceback
        print(f"❌ [上傳] 錯誤: {str(e)}")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
