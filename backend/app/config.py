# app/config.py
import sys
import subprocess
import json
from typing import Any, List, Optional

# Ensure pydantic-settings is available (you can remove this after pinning in requirements)
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pydantic-settings"])
    from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import Field, AliasChoices, field_validator, model_validator
import urllib.parse


class Settings(BaseSettings):
    # --- App ---
    DEBUG: bool = False

    # --- Database: accept DATABASE_URL or assemble from parts ---
    DATABASE_URL: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    DB_SCHEME: str = Field(default="postgresql+asyncpg", validation_alias=AliasChoices("DB_SCHEME", "db_scheme"))
    DB_HOST: str = Field(default="localhost", validation_alias=AliasChoices("DB_HOST", "db_host"))
    DB_PORT: int = Field(default=5432, validation_alias=AliasChoices("DB_PORT", "port"))
    DB_USER: str = Field(default="postgres", validation_alias=AliasChoices("DB_USER", "db_user"))
    DB_PASSWORD: str = Field(default="", validation_alias=AliasChoices("DB_PASSWORD", "db_password"))
    DB_NAME: str = Field(default="app", validation_alias=AliasChoices("DB_NAME", "db_name"))

    # --- CORS (new) ---
    # Accept JSON (e.g. '["http://localhost:5173"]') OR comma-separated (e.g. http://a.com,http://b.com) OR '*'
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: ["*"],
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins", "ALLOW_ORIGINS", "allow_origins"),
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(
        default=False,
        validation_alias=AliasChoices("CORS_ALLOW_CREDENTIALS", "cors_allow_credentials", "ALLOW_CREDENTIALS", "allow_credentials"),
    )
    CORS_ALLOW_METHODS: List[str] = Field(
        default_factory=lambda: ["*"],
        validation_alias=AliasChoices("CORS_ALLOW_METHODS", "cors_allow_methods", "ALLOW_METHODS", "allow_methods"),
    )
    CORS_ALLOW_HEADERS: List[str] = Field(
        default_factory=lambda: ["*"],
        validation_alias=AliasChoices("CORS_ALLOW_HEADERS", "cors_allow_headers", "ALLOW_HEADERS", "allow_headers"),
    )

    # pydantic-settings config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # ---------- coercion for list-like envs ----------
    @field_validator("CORS_ORIGINS", "CORS_ALLOW_METHODS", "CORS_ALLOW_HEADERS", mode="before")
    @classmethod
    def _coerce_listish(cls, v: Any):
        if v is None or isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            if s == "":
                return []
            if s.startswith("["):
                # JSON array
                try:
                    parsed = json.loads(s)
                    return parsed if isinstance(parsed, list) else [str(parsed)]
                except Exception:
                    # fall back to CSV
                    pass
            # CSV
            return [part.strip() for part in s.split(",") if part.strip()]
        return v

    # ---------- assemble DATABASE_URL if missing ----------
    @model_validator(mode="after")
    def _assemble_db_url(self):
        if self.DATABASE_URL and self.DATABASE_URL.strip():
            return self
        pwd = urllib.parse.quote_plus(self.DB_PASSWORD or "")
        self.DATABASE_URL = f"{self.DB_SCHEME}://{self.DB_USER}:{pwd}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return self


settings = Settings()
