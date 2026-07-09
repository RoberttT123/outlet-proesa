# -*- coding: utf-8 -*-
"""
SEGURIDAD JWT - OUTLET PROESA API
------------------------------------
Reemplaza sesiones por cookie con JWT en Authorization header.
Funciona en todos los navegadores incluyendo WhatsApp In-App Browser.

Token: JWT firmado con HS256, expira en SESSION_MAX_AGE_SECONDS.
El frontend lo guarda en localStorage y lo envía como:
  Authorization: Bearer <token>
"""

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings

settings   = get_settings()
ALGORITHM  = "HS256"
_bearer    = HTTPBearer(auto_error=False)


def crear_token_jwt(payload: dict) -> str:
    """Crea un JWT firmado con expiración."""
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(
        seconds=settings.SESSION_MAX_AGE_SECONDS
    )
    return jwt.encode(data, settings.SESSION_SECRET, algorithm=ALGORITHM)


def verificar_token_jwt(token: str) -> dict | None:
    """Verifica firma y expiración. Retorna payload o None."""
    try:
        return jwt.decode(token, settings.SESSION_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return None


def obtener_sesion_actual(request: Request) -> dict:
    """
    Dependency de FastAPI: extrae el JWT del header Authorization.
    Acepta también el token en query param ?token= como fallback.
    Lanza 401 si no hay token válido.
    """
    # 1. Buscar en Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization", "")
    token = None

    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    # 2. Fallback: query param (para casos edge)
    if not token:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sesion = verificar_token_jwt(token)
    if sesion is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return sesion


def requerir_admin(request: Request) -> dict:
    """Dependency: exige token válido Y rol admin."""
    sesion = obtener_sesion_actual(request)
    if not sesion.get("es_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores.",
        )
    return sesion