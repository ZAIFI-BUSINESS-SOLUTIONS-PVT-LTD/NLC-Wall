from pydantic import BaseModel, field_validator
from typing import Optional


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
    is_chief_guest: bool = False


class SubmitResponse(BaseModel):
    id: str
    timestamp: int


class HealthResponse(BaseModel):
    status: str
    count: int
    audience_count: int = 0
    cg_count: int = 0


class ThemeBody(BaseModel):
    theme: str


class UpdateNameBody(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 60:
            raise ValueError("Name too long (max 60 characters)")
        return v


class PledgeBody(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_strip_limit(cls, v: str) -> str:
        return v.strip()[:2000]


class ChiefGuestConfigBody(BaseModel):
    enabled: bool
    retention_mode: str
    retention_until: Optional[int] = None  # unix ms

    @field_validator("retention_mode")
    @classmethod
    def mode_valid(cls, v: str) -> str:
        if v not in ("forever", "until_datetime"):
            raise ValueError("retention_mode must be 'forever' or 'until_datetime'")
        return v


class ChiefGuestMarkBody(BaseModel):
    is_chief_guest: bool
