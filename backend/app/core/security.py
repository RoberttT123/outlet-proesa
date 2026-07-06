# -*- coding: utf-8 -*-
"""
SESIONES POR COOKIE FIRMADA - OUTLET PROESA API
--------------------------------------------------
Usa itsdangerous para firmar el contenido de la sesión dentro de una
cookie HttpOnly. No requiere tabla de sesiones en Supabase: el server
solo verifica la firma y la expiración.
"""

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Request, HTTPException, status
from app.core.config import get_settings

settings = get_settings()
_serializer = URLSafeTimedSerializer(settings.SESSION_SECRET, salt="outlet-proesa-session")


def crear_token_sesion(payload: dict) -> str:
    """Firma el payload de sesión (cod_emp, nombre, es_admin, regional, empresa)."""
    return _serializer.dumps(payload)


def leer_token_sesion(token: str) -> dict | None:
    """Verifica firma y expiración. Retorna None si es inválida o venció."""
    try:
        return _serializer.loads(token, max_age=settings.SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def obtener_sesion_actual(request: Request) -> dict:
    """
    Dependency de FastAPI: extrae y valida la sesión desde la cookie.
    Lanza 401 si no hay sesión válida.
    """
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado.")

    sesion = leer_token_sesion(token)
    if sesion is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida o expirada.")

    return sesion


def requerir_admin(request: Request) -> dict:
    """Dependency: exige sesión válida Y rol admin."""
    sesion = obtener_sesion_actual(request)
    if not sesion.get("es_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a administradores.")
    return sesion
