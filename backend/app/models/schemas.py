# -*- coding: utf-8 -*-
"""
SCHEMAS PYDANTIC - OUTLET PROESA API
---------------------------------------
Modelos de entrada/salida para cada endpoint.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    codigo: str = Field(..., min_length=3, max_length=20)
    carnet: str = Field(..., min_length=1, max_length=30)


class SesionResponse(BaseModel):
    cod_emp: str
    nombre: str
    empresa: str
    regional: str
    es_admin: bool


# ══════════════════════════════════════════════════════════════════════════════
# PRODUCTOS / CATÁLOGO
# ══════════════════════════════════════════════════════════════════════════════
class ProductoOut(BaseModel):
    id: str
    codigo: str
    nombre: str
    linea: Optional[str] = None
    empresa: Optional[str] = None
    precio_unitario: float
    stock: int
    cloudinary_url: Optional[str] = None
    estado_stock: str


# ══════════════════════════════════════════════════════════════════════════════
# CARRITO / PEDIDOS
# ══════════════════════════════════════════════════════════════════════════════
class ItemCarrito(BaseModel):
    codigo_producto: str
    producto: str
    cantidad: int = Field(..., gt=0)
    precio_unitario: float
    linea: Optional[str] = ""
    empresa: Optional[str] = ""


class CrearPedidoRequest(BaseModel):
    items: list[ItemCarrito]


class ProductoSinStock(BaseModel):
    producto: str
    codigo: str
    pedido: int
    disponible: int


class CrearPedidoResponse(BaseModel):
    exito: bool
    mensaje: str
    sin_stock: list[ProductoSinStock] = []


class PedidoHistorialItem(BaseModel):
    fecha: Optional[str] = None
    nombre_producto: str
    codigo_producto: str
    linea: Optional[str] = None
    empresa: Optional[str] = None
    precio_unitario: float
    cantidad: int
    subtotal: float
    estado: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN — REGIONALES
# ══════════════════════════════════════════════════════════════════════════════
class RegionalOut(BaseModel):
    nombre: str
    outlet_activo: bool


class ActualizarRegionalRequest(BaseModel):
    activo: bool


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN — DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
class MetricasDashboard(BaseModel):
    n_pedidos: int
    n_empleados: int
    unidades_total: int
    facturacion: float
    productos_criticos: int


class EmpleadoOut(BaseModel):
    codigo: str
    nombre: str
    carnet: Optional[str] = None
    empresa: Optional[str] = None
    regional: Optional[str] = None
    activo: bool
    es_admin: bool
