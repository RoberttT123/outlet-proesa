# -*- coding: utf-8 -*-
"""
ROUTER: EMPLEADOS - OUTLET PROESA API
----------------------------------------
CRUD completo de empleados desde el panel admin.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.core.config import get_supabase
from app.core.security import requerir_admin

router = APIRouter(prefix="/api/admin/empleados", tags=["empleados"])


# ── Schemas ────────────────────────────────────────────────────────────────────
class EmpleadoCreate(BaseModel):
    codigo:   str
    nombre:   str
    carnet:   Optional[str] = None
    empresa:  str
    regional: str
    es_admin: bool = False
    activo:   bool = True

class EmpleadoUpdate(BaseModel):
    nombre:   Optional[str]  = None
    carnet:   Optional[str]  = None
    empresa:  Optional[str]  = None
    regional: Optional[str]  = None
    es_admin: Optional[bool] = None
    activo:   Optional[bool] = None


# ── Helper ─────────────────────────────────────────────────────────────────────
def _formatear(e: dict) -> dict:
    return {
        "id":       e["id"],
        "codigo":   e["codigo"],
        "nombre":   e["nombre"],
        "carnet":   e.get("carnet"),
        "empresa":  e["empresas"]["nombre"]   if e.get("empresas")   else None,
        "regional": e["regionales"]["nombre"] if e.get("regionales") else None,
        "es_admin": e.get("es_admin", False),
        "activo":   e.get("activo", True),
    }


# ── LISTAR ─────────────────────────────────────────────────────────────────────
@router.get("")
def listar_empleados(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = (
            sb.table("empleados")
            .select("id, codigo, nombre, carnet, activo, es_admin, "
                    "empresas(nombre), regionales(nombre)")
            .order("nombre")
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return [_formatear(e) for e in (resp.data or [])]


# ── CREAR ──────────────────────────────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
def crear_empleado(payload: EmpleadoCreate, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()

    try:
        emp_resp = sb.table("empresas").select("id").eq("nombre", payload.empresa).single().execute()
        empresa_id = emp_resp.data["id"]
    except Exception:
        raise HTTPException(status_code=404, detail=f"Empresa '{payload.empresa}' no encontrada.")

    try:
        reg_resp = sb.table("regionales").select("id").eq("nombre", payload.regional).single().execute()
        regional_id = reg_resp.data["id"]
    except Exception:
        raise HTTPException(status_code=404, detail=f"Regional '{payload.regional}' no encontrada.")

    try:
        resp = (
            sb.table("empleados")
            .insert({
                "codigo":      payload.codigo.strip().upper(),
                "nombre":      payload.nombre.strip().upper(),
                "carnet":      payload.carnet.strip() if payload.carnet else None,
                "empresa_id":  empresa_id,
                "regional_id": regional_id,
                "es_admin":    payload.es_admin,
                "activo":      payload.activo,
            })
            .select()
            .execute()
        )
    except Exception as e:
        detail = str(e)
        if "duplicate" in detail.lower():
            raise HTTPException(status_code=409, detail=f"El código '{payload.codigo}' ya existe.")
        raise HTTPException(status_code=502, detail=detail)

    return resp.data[0] if resp.data else {}


# ── ACTUALIZAR ─────────────────────────────────────────────────────────────────
@router.patch("/{empleado_id}")
def actualizar_empleado(empleado_id: str, payload: EmpleadoUpdate, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    cambios: dict = {}

    if payload.nombre   is not None: cambios["nombre"]   = payload.nombre.strip().upper()
    if payload.carnet   is not None: cambios["carnet"]   = payload.carnet.strip() or None
    if payload.es_admin is not None: cambios["es_admin"] = payload.es_admin
    if payload.activo   is not None: cambios["activo"]   = payload.activo

    if payload.empresa is not None:
        try:
            r = sb.table("empresas").select("id").eq("nombre", payload.empresa).single().execute()
            cambios["empresa_id"] = r.data["id"]
        except Exception:
            raise HTTPException(status_code=404, detail=f"Empresa '{payload.empresa}' no encontrada.")

    if payload.regional is not None:
        try:
            r = sb.table("regionales").select("id").eq("nombre", payload.regional).single().execute()
            cambios["regional_id"] = r.data["id"]
        except Exception:
            raise HTTPException(status_code=404, detail=f"Regional '{payload.regional}' no encontrada.")

    if not cambios:
        raise HTTPException(status_code=400, detail="Sin cambios.")

    try:
        sb.table("empleados").update(cambios).eq("id", empleado_id).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"ok": True}


# ── ELIMINAR ───────────────────────────────────────────────────────────────────
@router.delete("/{empleado_id}")
def eliminar_empleado(empleado_id: str, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()

    # No permitir eliminarse a sí mismo
    try:
        emp = sb.table("empleados").select("codigo").eq("id", empleado_id).single().execute()
        if emp.data and emp.data["codigo"] == sesion.get("cod_emp"):
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        sb.table("empleados").delete().eq("id", empleado_id).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"ok": True}


# ── CATÁLOGOS DE APOYO ─────────────────────────────────────────────────────────
@router.get("/catalogo/empresas")
def listar_empresas_emp(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    resp = sb.table("empresas").select("id, nombre").order("nombre").execute()
    return resp.data or []


@router.get("/catalogo/regionales")
def listar_regionales_emp(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    resp = sb.table("regionales").select("id, nombre").order("nombre").execute()
    return resp.data or []