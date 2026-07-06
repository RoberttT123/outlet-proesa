# -*- coding: utf-8 -*-
"""
ROUTER: AUTENTICACIÓN - OUTLET PROESA API
---------------------------------------------
Login único para empleados y admin (código + carnet).
Sesión vía cookie HttpOnly firmada, sin tabla de sesiones en BD.
"""

from fastapi import APIRouter, Response, Request, HTTPException, status, Depends

from app.core.config import get_settings, get_supabase
from app.core.security import crear_token_sesion, obtener_sesion_actual
from app.models.schemas import LoginRequest, SesionResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=SesionResponse)
def login(payload: LoginRequest, response: Response):
    sb = get_supabase()
    codigo = payload.codigo.strip().upper()
    carnet = payload.carnet.strip()

    try:
        resp = (
            sb.table("empleados")
            .select(
                "id, codigo, nombre, carnet, activo, es_admin, "
                "empresas(nombre), regionales(nombre)"
            )
            .eq("codigo", codigo)
            .eq("activo", True)
            .single()
            .execute()
        )
        data = resp.data
    except Exception:
        data = None

    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                             detail=f"Código '{codigo}' no registrado en el sistema.")

    carnet_bd = str(data.get("carnet") or "").strip()
    if carnet_bd and carnet != carnet_bd:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="El carnet no coincide. Verifica tus datos.")

    sesion_payload = {
        "cod_emp":  data["codigo"],
        "nombre":   data["nombre"],
        "empresa":  data["empresas"]["nombre"] if data.get("empresas") else "N/A",
        "regional": data["regionales"]["nombre"] if data.get("regionales") else "La Paz",
        "es_admin": bool(data.get("es_admin", False)),
    }

    token = crear_token_sesion(sesion_payload)

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,   # Cambiar a True en producción con HTTPS
        path="/",
    )

    return SesionResponse(
        cod_emp=sesion_payload["cod_emp"],
        nombre=sesion_payload["nombre"],
        empresa=sesion_payload["empresa"],
        regional=sesion_payload["regional"],
        es_admin=sesion_payload["es_admin"],
    )


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"mensaje": "Sesión cerrada."}


@router.get("/me", response_model=SesionResponse)
def quien_soy(sesion: dict = Depends(obtener_sesion_actual)):
    return SesionResponse(
        cod_emp=sesion["cod_emp"],
        nombre=sesion["nombre"],
        empresa=sesion["empresa"],
        regional=sesion["regional"],
        es_admin=sesion["es_admin"],
    )
