# -*- coding: utf-8 -*-
"""
PUNTO DE ENTRADA - OUTLET PROESA API
-----------------------------------------
FastAPI sirviendo:
  - /api/*           → endpoints REST consumidos por React
  - /assets/*, /*     → build estático de Vite/React (en producción)

Desarrollo: corre este server (uvicorn) en :8000 y el dev server de
Vite por separado en :5173 con proxy a /api.

Producción: `npm run build` en frontend/, copiar dist/ a backend/static/,
y este mismo server sirve todo en un solo puerto.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.routers import auth, catalogo, pedidos, admin, inventario, productos

settings = get_settings()

app = FastAPI(title="Outlet PROESA API", version="2.0.0")

# ── CORS (solo necesario en desarrollo, con Vite en otro puerto) ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,   # imprescindible para que las cookies viajen
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(catalogo.router)
app.include_router(pedidos.router)
app.include_router(admin.router)
app.include_router(inventario.router)
app.include_router(productos.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Outlet PROESA API"}
@app.get("/")
def read_root():
    return {"message": "API de Outlet Proesa corriendo exitosamente"}

# ══════════════════════════════════════════════════════════════════════════════
# SERVIR BUILD DE REACT (producción)
# Solo se activa si existe backend/static/ (generado con `npm run build`)
# ══════════════════════════════════════════════════════════════════════════════
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def servir_spa(full_path: str):
        """Catch-all: cualquier ruta no-API devuelve index.html (React Router lo resuelve)."""
        index_path = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index_path)