"""
資料模型 - Audio2Score Backend
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    """使用者基本資料"""
    username: str = Field(..., min_length=3, max_length=50, description="使用者名稱")
    email: EmailStr = Field(..., description="電子郵件")

class UserCreate(UserBase):
    """註冊使用者資料"""
    password: str = Field(..., min_length=6, description="密碼（至少6個字元）")

class UserLogin(BaseModel):
    """登入資料"""
    email: EmailStr = Field(..., description="電子郵件")
    password: str = Field(..., description="密碼")

class UserResponse(UserBase):
    """使用者回應資料"""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserWithToken(BaseModel):
    """使用者資料與 Token"""
    user: UserResponse
    token: str
    message: str

class Token(BaseModel):
    """Token 資料"""
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """Token 解碼資料"""
    id: Optional[int] = None
    username: Optional[str] = None
