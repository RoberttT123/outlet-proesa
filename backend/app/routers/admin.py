# -*- coding: utf-8 -*-
"""
ROUTER: ADMIN - OUTLET PROESA API
--------------------------------------
Endpoints exclusivos para administradores: control de outlet por regional,
métricas del dashboard, historial consolidado.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_supabase
from app.core.security import requerir_admin
from app.models.schemas import RegionalOut, ActualizarRegionalRequest, MetricasDashboard

router = APIRouter(prefix="/api/admin", tags=["admin"])

REGIONALES_BOLIVIA = [
    "La Paz", "Santa Cruz", "Cochabamba", "Oruro",
    "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando",
]


# ══════════════════════════════════════════════════════════════════════════════
# REGIONALES — CONTROL DE OUTLET
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/regionales", response_model=list[RegionalOut])
def listar_regionales(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = sb.table("regionales").select("nombre, outlet_activo").execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return [RegionalOut(nombre=r["nombre"], outlet_activo=r["outlet_activo"]) for r in (resp.data or [])]


@router.patch("/regionales/{nombre}")
def actualizar_regional(nombre: str, payload: ActualizarRegionalRequest, sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        sb.table("regionales").update({"outlet_activo": payload.activo}).eq("nombre", nombre).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"nombre": nombre, "outlet_activo": payload.activo}


@router.post("/regionales/activar-todas")
def activar_todas(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    for r in REGIONALES_BOLIVIA:
        sb.table("regionales").update({"outlet_activo": True}).eq("nombre", r).execute()
    return {"mensaje": "Todas las regionales activadas."}


@router.post("/regionales/cerrar-todas")
def cerrar_todas(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    for r in REGIONALES_BOLIVIA:
        sb.table("regionales").update({"outlet_activo": False}).eq("nombre", r).execute()
    return {"mensaje": "Todas las regionales cerradas."}


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD — MÉTRICAS Y HISTORIAL
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/dashboard/metricas", response_model=MetricasDashboard)
def metricas_dashboard(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()

    try:
        pedidos_resp = sb.table("v_historial_pedidos").select("*").execute()
        productos_resp = sb.table("productos").select("stock").execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    pedidos = pedidos_resp.data or []
    productos = productos_resp.data or []

    pedido_ids = {p["pedido_id"] for p in pedidos if p.get("pedido_id")}
    empleados  = {p["cod_empleado"] for p in pedidos if p.get("cod_empleado")}
    unidades   = sum(int(p.get("cantidad", 0)) for p in pedidos)
    facturacion = sum(float(p.get("subtotal", 0)) for p in pedidos)
    criticos   = sum(1 for prod in productos if int(prod.get("stock", 0)) < 5)

    return MetricasDashboard(
        n_pedidos=len(pedido_ids) if pedido_ids else len(pedidos),
        n_empleados=len(empleados),
        unidades_total=unidades,
        facturacion=round(facturacion, 2),
        productos_criticos=criticos,
    )


@router.get("/dashboard/historial")
def historial_completo(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = (
            sb.table("v_historial_pedidos")
            .select("*")
            .order("fecha_pedido", desc=True)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return resp.data or []


# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO ADMIN — LISTADO COMPLETO (incluye agotados, a diferencia de empleado)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/catalogo")
def catalogo_completo(sesion: dict = Depends(requerir_admin)):
    sb = get_supabase()
    try:
        resp = (
            sb.table("productos")
            .select("id, codigo, nombre, stock, precio_unitario, activo, "
                     "lineas(nombre), empresas(nombre)")
            .order("nombre")
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    productos = []
    for p in (resp.data or []):
        productos.append({
            "id": p["id"],
            "codigo": p["codigo"],
            "nombre": p["nombre"],
            "linea": p["lineas"]["nombre"] if p.get("lineas") else None,
            "empresa": p["empresas"]["nombre"] if p.get("empresas") else None,
            "stock": p["stock"],
            "precio_unitario": float(p["precio_unitario"]),
            "activo": p["activo"],
        })
    return productos
