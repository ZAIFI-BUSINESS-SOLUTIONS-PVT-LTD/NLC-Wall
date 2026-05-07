from pydantic import BaseModel, field_validator
from typing import Optional
import time


class SubmitRequest(BaseModel):
    name: str
    signature: Optional[str] = None  # base64 PNG

    @field_validator("name")
    @classmethod
    def name_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 60:
            raise ValueError("Name too long (max 60 characters)")
        return v

    @field_validator("signature")
    @classmethod
    def signature_size_limit(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 200_000:
            raise ValueError("Signature image too large (max ~150KB)")
        return v


class Signature(BaseModel):
    id: str
    name: str
    signature: Optional[str] = None
    timestamp: int  # unix milliseconds


class SubmitResponse(BaseModel):
    id: str
    timestamp: int


class HealthResponse(BaseModel):
    status: str
    count: int


class ThemeBody(BaseModel):
    theme: str
