# -*- coding: utf-8 -*-
"""
ROUTER: PEDIDOS - OUTLET PROESA API
----------------------------------------
Creación transaccional de pedidos (usa la función PostgreSQL descontar_stock
con SELECT FOR UPDATE) e historial del empleado autenticado.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
import pytz

from app.core.config import get_supabase
from app.core.security import obtener_sesion_actual
from app.models.schemas import (
    CrearPedidoRequest, CrearPedidoResponse, ProductoSinStock,
    PedidoHistorialItem,
)

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


def _rollback_items(sb, descontados: list[dict], mapa_productos: dict):
    for item in descontados:
        producto = mapa_productos.get(item["codigo_producto"])
        if producto:
            try:
                sb.rpc("restaurar_stock", {
                    "p_producto_id": producto["id"],
                    "p_cantidad": item["cantidad"],
                }).execute()
            except Exception:
                pass


@router.post("", response_model=CrearPedidoResponse)
def crear_pedido(payload: CrearPedidoRequest, sesion: dict = Depends(obtener_sesion_actual)):
    sb = get_supabase()
    items = payload.items

    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El carrito está vacío.")

    codigos = [i.codigo_producto.strip() for i in items]

    # 1. Resolver productos y verificar stock disponible
    try:
        prods_resp = (
            sb.table("productos")
            .select("id, codigo, nombre, stock")
            .in_("codigo", codigos)
            .execute()
        )
        mapa_productos = {p["codigo"]: p for p in (prods_resp.data or [])}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                             detail=f"Error leyendo productos: {e}")

    sin_stock = []
    for item in items:
        prod = mapa_productos.get(item.codigo_producto.strip())
        if prod is None:
            continue
        if prod["stock"] < item.cantidad:
            sin_stock.append(ProductoSinStock(
                producto=prod["nombre"], codigo=prod["codigo"],
                pedido=item.cantidad, disponible=prod["stock"],
            ))

    if sin_stock:
        return CrearPedidoResponse(
            exito=False,
            mensaje="Stock insuficiente para uno o más productos.",
            sin_stock=sin_stock,
        )

    # 2. Descontar stock de forma atómica (con rollback si algo falla a mitad)
    descontados = []
    for item in items:
        codigo = item.codigo_producto.strip()
        prod   = mapa_productos.get(codigo)
        if prod is None:
            continue

        try:
            result = sb.rpc("descontar_stock", {
                "p_producto_id": prod["id"],
                "p_cantidad": item.cantidad,
            }).execute()
            respuesta = result.data
        except Exception as e:
            _rollback_items(sb, descontados, mapa_productos)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                 detail=f"Error descontando stock de '{codigo}': {e}")

        if not respuesta or not respuesta.get("exito"):
            _rollback_items(sb, descontados, mapa_productos)
            return CrearPedidoResponse(
                exito=False,
                mensaje=f"Stock insuficiente para '{prod['nombre']}' (alguien más lo reservó antes).",
                sin_stock=[ProductoSinStock(
                    producto=prod["nombre"], codigo=codigo,
                    pedido=item.cantidad,
                    disponible=respuesta.get("disponible", 0) if respuesta else 0,
                )],
            )

        descontados.append({"codigo_producto": codigo, "cantidad": item.cantidad})

    # 3. Crear cabecera del pedido
    tz_bo     = pytz.timezone("America/La_Paz")
    timestamp = datetime.now(tz_bo).isoformat()

    try:
        emp_resp = (
            sb.table("empleados")
            .select("id")
            .eq("codigo", sesion["cod_emp"])
            .single()
            .execute()
        )
        empleado_id = emp_resp.data["id"]

        pedido_resp = (
            sb.table("pedidos")
            .insert({"empleado_id": empleado_id, "estado": "procesado", "created_at": timestamp})
            .execute()
        )
        pedido_id = pedido_resp.data[0]["id"]

        filas_items = []
        for item in items:
            codigo    = item.codigo_producto.strip()
            prod      = mapa_productos.get(codigo)
            if prod is None:
                continue
            subtotal  = round(item.precio_unitario * item.cantidad, 2)
            filas_items.append({
                "pedido_id":        pedido_id,
                "producto_id":      prod["id"],
                "nombre_producto":  item.producto,
                "codigo_producto":  codigo,
                "linea":            item.linea or "",
                "empresa":          item.empresa or "",
                "precio_unitario":  round(item.precio_unitario, 2),
                "cantidad":         item.cantidad,
                "stock_al_pedido":  prod["stock"],
                "descuento":        0,
                "subtotal":         subtotal,
            })

        sb.table("pedido_items").insert(filas_items).execute()

    except Exception as e:
        # Rollback de stock si falla el guardado del pedido
        _rollback_items(sb, descontados, mapa_productos)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                             detail=f"El stock fue restaurado. Error guardando pedido: {e}")

    return CrearPedidoResponse(exito=True, mensaje="Pedido procesado con éxito.", sin_stock=[])


@router.get("/historial", response_model=list[PedidoHistorialItem])
def historial_empleado(sesion: dict = Depends(obtener_sesion_actual)):
    sb = get_supabase()

    try:
        resp = (
            sb.table("v_historial_pedidos")
            .select("fecha_pedido, nombre_producto, codigo_producto, linea, "
                    "empresa_producto, precio_unitario, cantidad, subtotal, estado")
            .eq("cod_empleado", sesion["cod_emp"])
            .order("fecha_pedido", desc=True)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                             detail=f"Error consultando historial: {e}")

    items = []
    for r in (resp.data or []):
        items.append(PedidoHistorialItem(
            fecha=r.get("fecha_pedido"),
            nombre_producto=r.get("nombre_producto", ""),
            codigo_producto=r.get("codigo_producto", ""),
            linea=r.get("linea"),
            empresa=r.get("empresa_producto"),
            precio_unitario=float(r.get("precio_unitario", 0)),
            cantidad=int(r.get("cantidad", 0)),
            subtotal=float(r.get("subtotal", 0)),
            estado=r.get("estado"),
        ))
    return items
