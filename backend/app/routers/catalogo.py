# -*- coding: utf-8 -*-
"""
ROUTER: CATÁLOGO - OUTLET PROESA API
----------------------------------------
Endpoints consumidos por la vista de empleado.
El catálogo se filtra por la regional del empleado logueado.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_supabase
from app.core.security import obtener_sesion_actual
from app.models.schemas import ProductoOut

router = APIRouter(prefix="/api/catalogo", tags=["catalogo"])


@router.get("/estado-outlet")
def estado_outlet(sesion: dict = Depends(obtener_sesion_actual)):
    """Verifica si el outlet está activo para la regional del empleado logueado."""
    sb = get_supabase()
    regional = sesion["regional"]
    try:
        resp = (
            sb.table("regionales")
            .select("outlet_activo")
            .eq("nombre", regional)
            .single()
            .execute()
        )
        activo = resp.data.get("outlet_activo", True) if resp.data else True
    except Exception:
        activo = True  # Fail-open
    return {"regional": regional, "activo": activo}


@router.get("/productos", response_model=list[ProductoOut])
def listar_productos(sesion: dict = Depends(obtener_sesion_actual)):
    """
    Devuelve solo los productos de la regional del empleado logueado.
    Usa la vista v_catalogo_activo que ya filtra activo=TRUE.
    """
    sb = get_supabase()
    regional = sesion["regional"]

    try:
        # Primero obtener el regional_id
        reg_resp = (
            sb.table("regionales")
            .select("id")
            .eq("nombre", regional)
            .single()
            .execute()
        )
        regional_id = reg_resp.data["id"] if reg_resp.data else None
    except Exception:
        regional_id = None

    try:
        query = (
            sb.table("v_catalogo_activo")
            .select("id, codigo, nombre, linea, empresa, precio_unitario, "
                    "stock, cloudinary_url, estado_stock")
            .order("linea")
            .order("nombre")
        )
        # Filtrar por regional si existe el ID
        if regional_id:
            query = query.eq("regional_id", regional_id)

        resp = query.execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error consultando catálogo: {e}",
        )

    return resp.data or []