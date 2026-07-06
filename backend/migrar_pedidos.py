#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MIGRACIÓN DE PEDIDOS - Google Sheets → Supabase
-------------------------------------------------
Lee el Excel exportado de Sheets y lo importa a Supabase
manteniendo la estructura de pedidos + pedido_items.

Uso:
  pip install supabase pandas openpyxl python-dotenv pytz
  python migrar_pedidos.py
"""

import os
import re
import sys
import pandas as pd
import pytz
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("❌ Instala supabase-py: pip install supabase")
    sys.exit(1)

# ── Configuración ──────────────────────────────────────────────────────────────
EXCEL_PATH   = "pedidos.xlsx"     # Ruta al Excel exportado de Sheets
SHEET_NAME   = "Pedidos"          # Nombre de la hoja
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
TZ_BO        = pytz.timezone("America/La_Paz")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL y SUPABASE_KEY deben estar en el .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def _parsear_fecha(s: str) -> str:
    """Convierte 'DD/MM/YYYY HH:MM:SS' a ISO 8601 con timezone Bolivia."""
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(str(s).strip(), fmt)
            return TZ_BO.localize(dt).isoformat()
        except Exception:
            pass
    # Si no parsea, usar ahora
    return datetime.now(TZ_BO).isoformat()


def _parsear_precio(val) -> float:
    try:
        s = str(val).replace(",", ".").strip()
        return round(float(s), 2)
    except Exception:
        return 0.0


def _parsear_int(val) -> int:
    try:
        return int(float(str(val).strip()))
    except Exception:
        return 0


def main():
    print(f"📂 Leyendo {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, dtype=str)
    df.columns = df.columns.str.strip()
    df = df.fillna("")

    print(f"✅ {len(df)} items encontrados")

    # ── Cargar mapa de empleados (codigo → UUID) ───────────────────────────────
    print("\n👥 Cargando empleados desde Supabase...")
    emp_resp = sb.table("empleados").select("id, codigo, empresa_id, regional_id").execute()
    mapa_emp = {r["codigo"]: r for r in (emp_resp.data or [])}
    print(f"   {len(mapa_emp)} empleados en BD")

    # ── Agrupar por empleado + fecha (= un pedido) ─────────────────────────────
    df["_grupo"] = df["Cod. Empleado"].str.strip() + "|" + df["Fecha Registro"].str.strip()
    grupos = list(df.groupby("_grupo", sort=False))
    print(f"\n📦 {len(grupos)} pedidos a migrar ({len(df)} items totales)")

    ok_pedidos = 0
    ok_items   = 0
    err_pedidos = []

    for grupo_key, grupo_df in grupos:
        cod_emp   = grupo_df.iloc[0]["Cod. Empleado"].strip()
        fecha_str = grupo_df.iloc[0]["Fecha Registro"].strip()
        nombre_emp = grupo_df.iloc[0]["Nombre Empleado"].strip()

        emp = mapa_emp.get(cod_emp)
        if emp is None:
            err_pedidos.append(f"  ⚠️  Empleado '{cod_emp}' ({nombre_emp}) no encontrado en BD — pedido omitido")
            continue

        fecha_iso = _parsear_fecha(fecha_str)

        # Calcular total del pedido
        total = sum(
            _parsear_precio(r["Monto Uni"]) * _parsear_int(r["Cantidad"])
            for _, r in grupo_df.iterrows()
        )

        # 1. Crear cabecera del pedido
        try:
            ped_resp = (
                sb.table("pedidos")
                .insert({
                    "empleado_id": emp["id"],
                    "estado":      "procesado",
                    "total":       round(total, 2),
                    "created_at":  fecha_iso,
                    "updated_at":  fecha_iso,
                })
                .execute()
            )
            pedido_id = ped_resp.data[0]["id"]
        except Exception as e:
            err_pedidos.append(f"  ❌ Error creando pedido de '{cod_emp}' ({fecha_str}): {e}")
            continue

        # 2. Insertar items del pedido
        items = []
        for _, row in grupo_df.iterrows():
            precio   = _parsear_precio(row["Monto Uni"])
            cantidad = _parsear_int(row["Cantidad"])
            subtotal = round(precio * cantidad, 2)
            items.append({
                "pedido_id":        pedido_id,
                "producto_id":      None,   # sin referencia a producto (histórico)
                "nombre_producto":  row["Nombre Producto"].strip(),
                "codigo_producto":  row["Código Producto"].strip(),
                "linea":            row["Línea"].strip(),
                "empresa":          row["Empresa"].strip(),
                "precio_unitario":  precio,
                "cantidad":         cantidad,
                "stock_al_pedido":  _parsear_int(row.get("Stock Actual", 0)),
                "descuento":        _parsear_precio(row.get("Descuento", 0)),
                "subtotal":         subtotal,
            })

        try:
            sb.table("pedido_items").insert(items).execute()
            ok_pedidos += 1
            ok_items   += len(items)
            print(f"  ✅ {cod_emp} | {fecha_str} | {len(items)} items | Bs {total:.2f}")
        except Exception as e:
            # Rollback: borrar el pedido si fallaron los items
            try:
                sb.table("pedidos").delete().eq("id", pedido_id).execute()
            except Exception:
                pass
            err_pedidos.append(f"  ❌ Error insertando items de '{cod_emp}' ({fecha_str}): {e}")

    # ── Resumen ────────────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"✅ Pedidos migrados:  {ok_pedidos}/{len(grupos)}")
    print(f"✅ Items migrados:    {ok_items}/{len(df)}")

    if err_pedidos:
        print(f"\n⚠️  Errores ({len(err_pedidos)}):")
        for e in err_pedidos:
            print(e)
    else:
        print("\n🎉 Migración completada sin errores.")


if __name__ == "__main__":
    main()