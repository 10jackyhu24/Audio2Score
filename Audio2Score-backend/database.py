"""
資料庫連線和管理 - Audio2Score Backend
"""
import asyncpg
from typing import Optional
from config import settings

class Database:
    """資料庫管理類別"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """建立資料庫連線池"""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                print(f"⏳ 嘗試連線資料庫... (第 {retry_count + 1}/{max_retries} 次)")
                
                self.pool = await asyncpg.create_pool(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    database=settings.DB_NAME,
                    min_size=1,
                    max_size=10,
                    command_timeout=60
                )
                
                # 測試連線
                async with self.pool.acquire() as conn:
                    result = await conn.fetchval("SELECT NOW()")
                    print(f"✅ 資料庫連線成功，當前時間: {result}")
                
                return
                
            except Exception as e:
                retry_count += 1
                print(f"❌ 資料庫連線失敗 (第 {retry_count} 次): {e}")
                
                if retry_count >= max_retries:
                    print("❌ 所有重試都失敗了，程式將繼續執行但資料庫功能可能無法使用")
                    print("💡 請檢查:")
                    print("   1. PostgreSQL 是否正在運行")
                    print("   2. .env 檔案中的資料庫設定是否正確")
                    print("   3. 資料庫是否已建立")
                    return
                
                # 等待後重試
                import asyncio
                await asyncio.sleep(3)
    
    async def disconnect(self):
        """關閉資料庫連線池"""
        if self.pool:
            await self.pool.close()
            print("✅ 資料庫連線已關閉")
    
    def get_pool(self) -> Optional[asyncpg.Pool]:
        """取得資料庫連線池"""
        return self.pool

# 全域資料庫實例
database = Database()

async def init_db():
    """初始化資料庫表格"""
    pool = database.get_pool()
    if not pool:
        print("⚠️  資料庫未連線，跳過表格初始化")
        return
    
    try:
        async with pool.acquire() as conn:
            # 建立 users 表格
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 建立索引
            await conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
            ''')
            await conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
            ''')
            
            print("✅ 資料庫表格初始化完成")
            
    except Exception as e:
        print(f"❌ 資料庫初始化失敗: {e}")
