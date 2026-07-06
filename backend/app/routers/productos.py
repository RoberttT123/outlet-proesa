# -*- coding: utf-8 -*-
"""
ROUTER: PRODUCTOS PERMANENTES - OUTLET PROESA API
---------------------------------------------------
CRUD completo de productos que persisten independientemente
de las campañas de inventario por regional.
Cloudinary: la imagen se sube directo desde el frontend.
El backend solo guarda/actualiza el public_id y la URL.
"""

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.core.config import get_supabase, get_settings
from app.core.security import requerir_admin

router   = APIRouter(prefix="/api/admin/productos", tags=["productos"])
settings = get_settings()


# ── Schemas ────────────────────────────────────────────────────────────────────
class ProductoCreate(BaseModel):
    codigo:  str
    nombre:  str
    linea:   Optional[str] = None
    empresa: Optional[str] = None

class ProductoUpdate(BaseModel):
    nombre:  Optional[str]  = None
    linea:   Optional[str]  = None
    empresa: Optional[str]  = None
    activo:  Optional[bool] = None

class ImagenUpdate(BaseModel):
    cloudinary_public_id: str
    cloudinary_url:       str

class CloudinarySignRequest(BaseModel):
    folder: Optional[str] = "outlet_proesa"


# ── Helpers ────────────────────────────────────────────────────────────────────
def _resolver_ids(sb, linea: str | None, empresa: str | None) -> tuple[int | None, int | None]:
    """Obtiene o crea los IDs de línea y empresa."""
    linea_id   = None
    empresa_id = None

    if linea:
        sb.table("lineas").upsert({"nombre": linea.strip()}, on_conflict="nombre").execute()
        r = sb.table("lineas").select("id").eq("nombre", linea.strip()).single().execute()
        linea_id = r.data["id"] if r.data else None

    if empresa:
        sb.table("empresas").upsert({"nombre": empresa.strip()}, on_conflict="nombre").execute()
        r = sb.table("empresas").select("id").eq("nombre", empresa.strip()).single().execute()
        empresa_id = r.data["id"] if r.data else None

    return linea_id, empresa_id


def _formatear(p: dict) -> dict:
    return {
        "id":                   p["id"],
        "codigo":               p["codigo"],
        "nombre":               p["nombre"],
        "stock":                int(p.get("stock", 0)),
        "precio_unitario":      float(p.get("precio_unitario", 0)),
        "linea":                p["lineas"]["nombre"]   if p.get("lineas")   else None,
        "empresa":              p["empresas"]["nombre"] if p.get("empresas") else None,
        "cloudinary_url":       p.get("cloudinary_url"),
        "cloudinary_public_id": p.get("cloudinary_public_id"),
        "activo":               p.get("activo", True),
    }


# ── SIGN para upload directo desde frontend ────────────────────────────────────
@router.get("/cloudinary-config")
def cloudinary_config(sesion: dict = Depends(requerir_admin)):
    """
    Devuelve al frontend el cloud_name y el upload_preset para
    hacer el upload directo (unsigned) sin exponer el API secret.
    """
    return {
        "cloud_name":    settings.CLOUDINARY_CLOUD_NAME,
        "upload_preset": "outlet_proesa",  # nombre del preset unsigned en Cloudinary
    }


# ── LISTAR ─────────────────────────────────────────────────────────────────────
@router.get("")
def listar_productos(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = (
            sb.table("productos")
            .select("id, codigo, nombre, stock, precio_unitario, activo, "
                    "cloudinary_url, cloudinary_public_id, "
                    "lineas(nombre), empresas(nombre)")
            .order("nombre")
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return [_formatear(p) for p in (resp.data or [])]


# ── CREAR ──────────────────────────────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
def crear_producto(payload: ProductoCreate, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    linea_id, empresa_id = _resolver_ids(sb, payload.linea, payload.empresa)

    try:
        resp = (
            sb.table("productos")
            .insert({
                "codigo":     payload.codigo.strip(),
                "nombre":     payload.nombre.strip(),
                "linea_id":   linea_id,
                "empresa_id": empresa_id,
                "activo":     True,
            })
            .select()
            .execute()
        )
    except Exception as e:
        detail = str(e)
        if "duplicate" in detail.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail=f"El código '{payload.codigo}' ya existe.")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    return resp.data[0] if resp.data else {}


# ── ACTUALIZAR ─────────────────────────────────────────────────────────────────
@router.patch("/{producto_id}")
def actualizar_producto(producto_id: str, payload: ProductoUpdate, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    cambios: dict = {}

    if payload.nombre  is not None: cambios["nombre"]  = payload.nombre.strip()
    if payload.activo  is not None: cambios["activo"]  = payload.activo

    if payload.linea is not None or payload.empresa is not None:
        linea_id, empresa_id = _resolver_ids(sb, payload.linea, payload.empresa)
        if payload.linea   is not None: cambios["linea_id"]   = linea_id
        if payload.empresa is not None: cambios["empresa_id"] = empresa_id

    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios.")

    try:
        sb.table("productos").update(cambios).eq("id", producto_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"ok": True}


# ── ACTUALIZAR IMAGEN ──────────────────────────────────────────────────────────
@router.patch("/{producto_id}/imagen")
def actualizar_imagen(producto_id: str, payload: ImagenUpdate, sesion: dict = Depends(requerir_admin)):
    """
    El frontend sube la imagen directo a Cloudinary y luego llama
    a este endpoint para guardar el public_id y la URL en Supabase.
    """
    sb = get_supabase()

    # Si había imagen anterior, eliminarla de Cloudinary
    try:
        prev = sb.table("productos").select("cloudinary_public_id").eq("id", producto_id).single().execute()
        prev_id = prev.data.get("cloudinary_public_id") if prev.data else None
        if prev_id and prev_id != payload.cloudinary_public_id:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
            )
            cloudinary.uploader.destroy(prev_id)
    except Exception:
        pass  # Si falla el borrado de la imagen anterior, continuamos igual

    try:
        sb.table("productos").update({
            "cloudinary_public_id": payload.cloudinary_public_id,
            "cloudinary_url":       payload.cloudinary_url,
        }).eq("id", producto_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"ok": True}


# ── ELIMINAR IMAGEN ────────────────────────────────────────────────────────────
@router.delete("/{producto_id}/imagen")
def eliminar_imagen(producto_id: str, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        prev = sb.table("productos").select("cloudinary_public_id").eq("id", producto_id).single().execute()
        public_id = prev.data.get("cloudinary_public_id") if prev.data else None
        if public_id:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
            )
            cloudinary.uploader.destroy(public_id)
        sb.table("productos").update({
            "cloudinary_public_id": None,
            "cloudinary_url":       None,
        }).eq("id", producto_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return {"ok": True}


# ── ELIMINAR PRODUCTO ──────────────────────────────────────────────────────────
@router.delete("/{producto_id}")
def eliminar_producto(producto_id: str, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        # Eliminar imagen de Cloudinary si existe
        prev = sb.table("productos").select("cloudinary_public_id").eq("id", producto_id).single().execute()
        public_id = prev.data.get("cloudinary_public_id") if prev.data else None
        if public_id:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
            )
            cloudinary.uploader.destroy(public_id)

        sb.table("productos").delete().eq("id", producto_id).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return {"ok": True}