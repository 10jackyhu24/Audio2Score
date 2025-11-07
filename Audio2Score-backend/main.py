"""
FastAPI 主程式 - Audio2Score Backend
支援前端連接和資料庫操作
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import uvicorn
import sys
import os
from contextlib import asynccontextmanager
import logging

# 使用 uvicorn 的 logger
logger = logging.getLogger("uvicorn.error")

# 將當前目錄加入 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from database import database, init_db
from routes import router as auth_router

# Lifespan 事件處理器
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    print("=" * 50)
    print("🚀 Audio2Score Backend 啟動中...")
    print("=" * 50)
    await database.connect()
    await init_db()
    print("✅ 應用程式初始化完成")
    print("=" * 50)
    yield
    # Shutdown code
    print("🛑 Audio2Score Backend 停止中...")
    await database.disconnect()

# 建立 FastAPI 應用程式
app = FastAPI(
    title="Audio2Score API",
    description="Audio2Score 後端 API - Python FastAPI 版本",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 設定（支援 ngrok 和前端）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開發環境允許所有來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 請求日誌中間件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # 使用 logger 替代 print，確保輸出會顯示在 uvicorn logs
    client = None
    try:
        client = request.client.host if request.client else "unknown"
    except Exception:
        client = "unknown"

    logger.info(f"{datetime.now().isoformat()} - {request.method} {request.url.path} - from {client}")

    # 記錄來源
    origin = request.headers.get("origin", "無來源")
    if "ngrok" in origin:
        logger.info(f"🌐 ngrok 請求來自: {origin}")

    response = await call_next(request)

    # 記錄回應狀態
    try:
        logger.info(f"{datetime.now().isoformat()} - Response {response.status_code} for {request.method} {request.url.path}")
    except Exception:
        logger.info(f"Response sent for {request.method} {request.url.path}")

    return response

# 註冊路由
app.include_router(auth_router)

# 根路徑
@app.get("/")
async def root():
    """根路徑"""
    return {
        "message": "Audio2Score API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# 健康檢查
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    try:
        pool = database.get_pool()
        if pool:
            async with pool.acquire() as conn:
                result = await conn.fetchval("SELECT NOW()")
                return {
                    "status": "ok",
                    "timestamp": datetime.now().isoformat(),
                    "database": "connected",
                    "dbTime": result.isoformat() if result else None
                }
        else:
            return {
                "status": "warning",
                "timestamp": datetime.now().isoformat(),
                "database": "disconnected",
                "message": "資料庫未連線，但伺服器正常運行"
            }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "timestamp": datetime.now().isoformat(),
                "database": "error",
                "error": str(e)
            }
        )

# 404 處理
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "找不到該路徑"}
    )

# 全域錯誤處理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ 伺服器錯誤: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "內部伺服器錯誤",
            "message": str(exc) if settings.ENVIRONMENT == "development" else "請稍後再試"
        }
    )

# 主程式入口
if __name__ == "__main__":
    print("=" * 50)
    print("  Audio2Score Backend (Python FastAPI)")
    print("=" * 50)
    print(f"🚀 伺服器啟動於 http://0.0.0.0:{settings.PORT}")
    print(f"📝 本地存取: http://127.0.0.1:{settings.PORT}")
    print(f"📝 API 文件: http://127.0.0.1:{settings.PORT}/docs")
    print(f"📝 健康檢查: http://127.0.0.1:{settings.PORT}/health")
    print(f"📝 API 端點:")
    print(f"   POST http://127.0.0.1:{settings.PORT}/api/auth/register")
    print(f"   POST http://127.0.0.1:{settings.PORT}/api/auth/login")
    print(f"   GET  http://127.0.0.1:{settings.PORT}/api/auth/me")
    print("=" * 50)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # 改為 0.0.0.0 以支援外部連線（ngrok）
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
