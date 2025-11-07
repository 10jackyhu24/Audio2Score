"""
認證相關功能 - Audio2Score Backend
包含密碼加密和 JWT Token 處理
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, status
from config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼
    
    Args:
        plain_password: 明文密碼
        hashed_password: 加密後的密碼
    
    Returns:
        bool: 密碼是否正確
    """
    # 將字串轉換為 bytes
    password_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
    
    return bcrypt.checkpw(password_bytes, hash_bytes)

def get_password_hash(password: str) -> str:
    """
    加密密碼
    
    Args:
        password: 明文密碼
    
    Returns:
        str: 加密後的密碼
    """
    # 將字串轉換為 bytes 並加密
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    
    # 返回字串格式
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    建立 JWT Token
    
    Args:
        data: 要編碼的資料
        expires_delta: 過期時間
    
    Returns:
        str: JWT Token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.JWT_EXPIRATION_DAYS)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt

def verify_token(token: str) -> dict:
    """
    驗證 JWT Token
    
    Args:
        token: JWT Token
    
    Returns:
        dict: 解碼後的資料
    
    Raises:
        HTTPException: Token 無效時拋出
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的認證憑證",
            headers={"WWW-Authenticate": "Bearer"},
        )
