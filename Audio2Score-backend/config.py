"""
配置管理 - Audio2Score Backend
"""
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

class Settings:
    """應用程式設定"""
    
    # 資料庫設定
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "audio2score")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    
    # JWT 設定
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-this")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_DAYS: int = int(os.getenv("JWT_EXPIRATION_DAYS", "7"))
    
    # 伺服器設定
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "3000"))
    
    @property
    def database_url(self) -> str:
        """取得資料庫連線字串"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

# 全域設定實例
settings = Settings()
