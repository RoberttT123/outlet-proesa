# -*- coding: utf-8 -*-
"""
CONFIGURACIÓN CENTRAL - OUTLET PROESA API
-------------------------------------------
Carga variables de entorno y expone el cliente de Supabase como singleton.
"""

import os
from functools import lru_cache
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


class Settings:
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")

    SESSION_SECRET: str = os.environ.get("SESSION_SECRET", "cambia-esto-en-produccion")
    SESSION_COOKIE_NAME: str = "outlet_session"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 12   # 12 horas

    CORS_ORIGINS: list = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

    CLOUDINARY_CLOUD_NAME: str = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str    = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.environ.get("CLOUDINARY_API_SECRET", "")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


@lru_cache()
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL o SUPABASE_KEY no configurados en .env")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)