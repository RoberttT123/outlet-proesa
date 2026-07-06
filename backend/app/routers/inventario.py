# -*- coding: utf-8 -*-
"""
ROUTER: INVENTARIO - OUTLET PROESA API
-------------------------------------------
Subida del Excel mensual por regional:
  - El admin selecciona la regional antes de subir
  - Se borran TODOS los productos de esa regional
  - Se insertan los nuevos desde el Excel
"""

import re
import io
import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status

from app.core.config import get_supabase
from app.core.security import requerir_admin

router = APIRouter(prefix="/api/admin/inventario", tags=["admin"])


def _parsear_precio(val) -> float:
    try:
        s = str(val).upper().replace("BS", "").replace(" ", "").strip()
        if not s or s in ("NAN", "NONE", ""):
            return 0.0
        if re.match(r'^\d{1,3}(\.\d{3})+(,\d+)?$', s):
            s = s.replace(".", "").replace(",", ".")
        elif "," in s and "." not in s:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
        return float(s)
    except Exception:
        return 0.0


def _parsear_stock(val) -> int:
    try:
        s = str(val).strip().replace(",", "")
        # Quitar separador de miles si tiene 3 decimales
        if "." in s and len(s.split(".")[1]) == 3:
            s = s.replace(".", "")
        # Quitar .0 que Excel agrega
        if s.endswith(".0"):
            s = s[:-2]
        return max(0, int(float(s)))
    except Exception:
        return 0


def _limpiar_codigo(val: object) -> str:
    """Limpia códigos numéricos que Excel convierte a float (110177.0 → 110177)."""
    s = str(val).strip()
    return s[:-2] if s.endswith(".0") else s


def _col(df: pd.DataFrame, *palabras: str) -> str | None:
    """Busca la primera columna cuyo nombre contenga alguna de las palabras clave."""
    for palabra in palabras:
        for c in df.columns:
            if palabra in c.lower():
                return c
    return None


@router.get("/regionales")
def listar_regionales_para_upload(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = sb.table("regionales").select("id, nombre").order("nombre").execute()
        return resp.data or []
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/subir-excel")
async def subir_excel(
    archivo: UploadFile = File(...),
    regional: str = Form(...),
    sesion: dict = Depends(requerir_admin),
):
    if not (archivo.filename or "").endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se aceptan archivos .xlsx",
        )

    contenido = await archivo.read()
    try:
        df = pd.read_excel(
            io.BytesIO(contenido),
            sheet_name="Inventario",
            dtype=str,
        )
        df.columns = df.columns.str.strip()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error leyendo la hoja 'Inventario' del Excel: {e}",
        )

    # Detectar columnas de forma segura (retornan str | None)
    col_linea   = _col(df, "línea", "linea")
    col_codigo  = _col(df, "código", "codigo")
    col_nombre  = _col(df, "nombre")
    col_stock   = _col(df, "stock")
    col_precio  = _col(df, "precio")
    col_empresa = _col(df, "empresa")

    if not all([col_codigo, col_nombre, col_stock, col_precio]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El Excel no tiene las columnas esperadas (Código, Nombre, Stock, Precio).",
        )

    # A partir de aquí sabemos que no son None — las casteamos para Pylance
    col_codigo  = str(col_codigo)
    col_nombre  = str(col_nombre)
    col_stock   = str(col_stock)
    col_precio  = str(col_precio)

    sb = get_supabase()

    # 1. Obtener regional_id
    try:
        reg_resp = (
            sb.table("regionales")
            .select("id")
            .eq("nombre", regional)
            .single()
            .execute()
        )
        regional_id = reg_resp.data["id"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regional '{regional}' no encontrada en la base de datos.",
        )

    # 2. Sincronizar empresas y líneas
    if col_empresa:
        for emp in df[col_empresa].dropna().unique().tolist():
            sb.table("empresas").upsert(
                {"nombre": str(emp).strip()}, on_conflict="nombre"
            ).execute()

    emp_resp = sb.table("empresas").select("id, nombre").execute()
    mapa_emp = {r["nombre"]: r["id"] for r in (emp_resp.data or [])}

    if col_linea:
        for lin in df[col_linea].dropna().unique().tolist():
            sb.table("lineas").upsert(
                {"nombre": str(lin).strip()}, on_conflict="nombre"
            ).execute()

    lin_resp = sb.table("lineas").select("id, nombre").execute()
    mapa_lin = {r["nombre"]: r["id"] for r in (lin_resp.data or [])}

    # 3. Preparar filas
    filas: list[dict] = []
    for _, row in df.iterrows():
        val_cod = row.get(col_codigo)
        val_nom = row.get(col_nombre)
        if val_cod is None or val_nom is None:
            continue

        codigo = _limpiar_codigo(val_cod) if pd.notna(val_cod) else ""
        nombre = str(val_nom).strip()        if pd.notna(val_nom) else ""
        if not codigo or not nombre:
            continue

        fila: dict = {
            "codigo":          codigo,
            "nombre":          nombre,
            "stock":           _parsear_stock(row.get(col_stock, 0)),
            "precio_unitario": _parsear_precio(row.get(col_precio, 0)),
            "regional_id":     regional_id,
            "activo":          True,
        }

        if col_linea:
            val_lin = row.get(col_linea)
            if val_lin is not None and pd.notna(val_lin):
                fila["linea_id"] = mapa_lin.get(str(val_lin).strip())

        if col_empresa:
            val_emp = row.get(col_empresa)
            if val_emp is not None and pd.notna(val_emp):
                fila["empresa_id"] = mapa_emp.get(str(val_emp).strip())

        filas.append(fila)

    if not filas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontraron productos válidos en el Excel.",
        )

    # 4. Borrar catálogo anterior de esta regional
    try:
        sb.table("catalogo_campana").delete().eq("regional_id", regional_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error borrando catálogo anterior de '{regional}': {e}",
        )

    # 5. Insertar en lotes de 500
    try:
        BATCH = 500
        for i in range(0, len(filas), BATCH):
            sb.table("catalogo_campana").upsert(
                filas[i:i + BATCH],
                on_conflict="codigo,regional_id",
            ).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error insertando productos: {e}",
        )

    return {
        "mensaje":  f"{len(filas)} productos cargados para '{regional}'. Catálogo anterior eliminado.",
        "total":    len(filas),
        "regional": regional,
    }


@router.get("/catalogo/{regional}")
def catalogo_por_regional(regional: str, sesion: dict = Depends(requerir_admin)):
    """Devuelve todos los productos (incluyendo agotados) de una regional específica."""
    sb = get_supabase()

    try:
        reg_resp = (
            sb.table("regionales")
            .select("id")
            .eq("nombre", regional)
            .single()
            .execute()
        )
        regional_id: str | None = reg_resp.data["id"] if reg_resp.data else None
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regional '{regional}' no encontrada.",
        )

    try:
        query = (
            sb.table("catalogo_campana")
            .select("id, codigo, nombre, stock, precio_unitario, "
                    "lineas(nombre), empresas(nombre)")
            .order("nombre")
        )
        if regional_id is not None:
            query = query.eq("regional_id", regional_id)

        resp = query.execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return [
        {
            "id":              p["id"],
            "codigo":          p["codigo"],
            "nombre":          p["nombre"],
            "stock":           int(p["stock"]),
            "precio_unitario": float(p["precio_unitario"]),
            "linea":           p["lineas"]["nombre"]   if p.get("lineas")   else None,
            "empresa":         p["empresas"]["nombre"] if p.get("empresas") else None,
        }
        for p in (resp.data or [])
    ]