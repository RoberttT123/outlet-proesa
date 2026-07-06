import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { adminApi } from '../api/client'
import AdminLayout from '../components/AdminLayout'

const OPCIONES_POR_PAGINA = [10, 20, 30, 50]

export default function AdminDashboard() {
  const [metricas, setMetricas]   = useState(null)
  const [historial, setHistorial] = useState(null)
  const [filtros, setFiltros]     = useState({ empresa: '', regional: '', busqueda: '' })
  const [porPagina, setPorPagina] = useState(10)
  const [pagina, setPagina]       = useState(1)

  useEffect(() => {
    adminApi.metricas().then(({ data }) => setMetricas(data)).catch(() => {})
    adminApi.historialCompleto().then(({ data }) => setHistorial(data)).catch(() => setHistorial([]))
  }, [])

  const setFiltro = (key, val) => {
    setFiltros((prev) => ({ ...prev, [key]: val }))
    setPagina(1) // Resetear a página 1 al cambiar filtros
  }

  // Opciones únicas para filtros
  const empresas   = useMemo(() => [...new Set((historial || []).map((r) => r.empresa_empleado).filter(Boolean))].sort(), [historial])
  const regionales = useMemo(() => [...new Set((historial || []).map((r) => r.regional).filter(Boolean))].sort(), [historial])

  // Historial filtrado completo
  const historialFiltrado = useMemo(() => {
    if (!historial) return []
    let data = historial
    if (filtros.empresa)  data = data.filter((r) => r.empresa_empleado === filtros.empresa)
    if (filtros.regional) data = data.filter((r) => r.regional === filtros.regional)
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase()
      data = data.filter(
        (r) =>
          (r.nombre_empleado || '').toLowerCase().includes(q) ||
          (r.nombre_producto || '').toLowerCase().includes(q) ||
          (r.cod_empleado || '').toLowerCase().includes(q)
      )
    }
    return data
  }, [historial, filtros])

  // Paginación
  const totalPaginas  = Math.max(1, Math.ceil(historialFiltrado.length / porPagina))
  const paginaActual  = Math.min(pagina, totalPaginas)
  const inicio        = (paginaActual - 1) * porPagina
  const historialPag  = historialFiltrado.slice(inicio, inicio + porPagina)
  const facturacionFiltrada = useMemo(
    () => historialFiltrado.reduce((acc, r) => acc + (r.subtotal || 0), 0),
    [historialFiltrado]
  )

  // Top 10 productos
  const topProductos = useMemo(() => {
    const mapa = {}
    historialFiltrado.forEach((r) => {
      mapa[r.nombre_producto] = (mapa[r.nombre_producto] || 0) + (r.cantidad || 0)
    })
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [historialFiltrado])

  // Exportar a Excel
  const exportarExcel = () => {
    if (!historialFiltrado.length) return

    const cols = [
      'Fecha', 'Cód. Empleado', 'Nombre Empleado', 'Empresa',
      'Regional', 'Nombre Producto', 'Código Producto',
      'Línea', 'Precio Unitario', 'Cantidad', 'Subtotal', 'Estado',
    ]
    const filas = historialFiltrado.map((r) => ({
      'Fecha':             r.fecha_pedido ? r.fecha_pedido.slice(0, 16).replace('T', ' ') : '',
      'Cód. Empleado':     r.cod_empleado || '',
      'Nombre Empleado':   r.nombre_empleado || '',
      'Empresa':           r.empresa_empleado || '',
      'Regional':          r.regional || '',
      'Nombre Producto':   r.nombre_producto || '',
      'Código Producto':   r.codigo_producto || '',
      'Línea':             r.linea || '',
      'Precio Unitario':   Number(r.precio_unitario || 0),
      'Cantidad':          Number(r.cantidad || 0),
      'Subtotal':          Number(r.subtotal || 0),
      'Estado':            r.estado || '',
    }))

    const ws = XLSX.utils.json_to_sheet(filas, { header: cols })

    // Ancho de columnas automático
    const colWidths = cols.map((c) => ({
      wch: Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length)) + 2,
    }))
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    const nombreHoja = filtros.regional
      ? `Pedidos ${filtros.regional}`
      : 'Pedidos Consolidado'
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)

    const fecha = new Date().toISOString().slice(0, 10)
    const sufijo = filtros.regional ? `_${filtros.regional.replace(/ /g, '_')}` : ''
    XLSX.writeFile(wb, `Reporte_PROESA${sufijo}_${fecha}.xlsx`)
  }

  return (
    <AdminLayout titulo="Dashboard" subtitulo="Análisis operativo en tiempo real">

      {/* ══ MÉTRICAS ══════════════════════════════════════════════════════ */}
      <SectionTitle>Resumen General</SectionTitle>
      <div style={s.metricasRow}>
        <MetricCard label="Pedidos"          value={metricas?.n_pedidos ?? '…'}        color="#3B82F6" />
        <MetricCard label="Empleados"        value={metricas?.n_empleados ?? '…'}      color="#2DC653" />
        <MetricCard label="Unidades"         value={metricas ? `${metricas.unidades_total.toLocaleString()} ud.` : '…'} color="#1A1A2E" />
        <MetricCard label="Facturación"      value={metricas ? `Bs ${metricas.facturacion.toLocaleString('es-BO', { minimumFractionDigits: 2 })}` : '…'} color="#F4A261" />
        <MetricCard label="Stock Crítico"    value={metricas ? `${metricas.productos_criticos} SKU` : '…'} color="#E63946" />
      </div>

      {/* ══ FILTROS ═══════════════════════════════════════════════════════ */}
      <SectionTitle>🔍 Filtros</SectionTitle>
      <div style={s.filtrosRow}>
        <div style={s.filtroGrupo}>
          <label style={s.filtroLabel}>Empresa</label>
          <select value={filtros.empresa} onChange={(e) => setFiltro('empresa', e.target.value)} style={s.select}>
            <option value="">Todas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div style={s.filtroGrupo}>
          <label style={s.filtroLabel}>Regional</label>
          <select value={filtros.regional} onChange={(e) => setFiltro('regional', e.target.value)} style={s.select}>
            <option value="">Todas</option>
            {regionales.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ ...s.filtroGrupo, flex: 2 }}>
          <label style={s.filtroLabel}>Buscar</label>
          <input
            type="text"
            placeholder="Empleado, producto o código..."
            value={filtros.busqueda}
            onChange={(e) => setFiltro('busqueda', e.target.value)}
            style={s.searchInput}
          />
        </div>
        {(filtros.empresa || filtros.regional || filtros.busqueda) && (
          <button
            onClick={() => { setFiltros({ empresa: '', regional: '', busqueda: '' }); setPagina(1) }}
            style={s.clearBtn}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ══ HISTORIAL + PAGINACIÓN ════════════════════════════════════════ */}
      <div style={s.historialHeader}>
        <div>
          <SectionTitle>📋 Historial de Pedidos</SectionTitle>
          <p style={s.caption}>
            {historialFiltrado.length.toLocaleString()} registros
            {filtros.regional ? ` · ${filtros.regional}` : ''}
            {' · '}Bs {facturacionFiltrada.toFixed(2)} total
          </p>
        </div>
        <div style={s.headerActions}>
          {/* Selector de por página */}
          <div style={s.filtroGrupo}>
            <label style={s.filtroLabel}>Mostrar</label>
            <select
              value={porPagina}
              onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }}
              style={{ ...s.select, minWidth: 80 }}
            >
              {OPCIONES_POR_PAGINA.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {/* Exportar Excel */}
          <button
            onClick={exportarExcel}
            disabled={!historialFiltrado.length}
            style={{ ...s.exportBtn, opacity: historialFiltrado.length ? 1 : 0.5 }}
          >
            📥 Exportar Excel ({historialFiltrado.length})
          </button>
        </div>
      </div>

      {historial === null ? (
        <div style={s.loadingRow}><div style={s.spinner} /><span style={s.loadingText}>Cargando...</span></div>
      ) : historialFiltrado.length === 0 ? (
        <p style={s.emptyMsg}>Sin resultados para los filtros actuales.</p>
      ) : (
        <>
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Fecha', 'Empleado', 'Empresa', 'Regional', 'Producto', 'Cant.', 'P. Unit.', 'Subtotal', 'Estado'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historialPag.map((r, i) => (
                  <tr key={i} style={i % 2 !== 0 ? s.trAlt : {}}>
                    <td style={s.td}>{r.fecha_pedido ? r.fecha_pedido.slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500 }}>{r.nombre_empleado}</div>
                      <div style={{ fontSize: '0.72rem', color: '#999' }}>{r.cod_empleado}</div>
                    </td>
                    <td style={s.td}>{r.empresa_empleado}</td>
                    <td style={s.td}>
                      <span style={s.regionalBadge}>{r.regional}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500 }}>{r.nombre_producto}</div>
                      <div style={{ fontSize: '0.72rem', color: '#999', fontFamily: 'monospace' }}>{r.codigo_producto}</div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 600 }}>{r.cantidad}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace' }}>Bs {Number(r.precio_unitario || 0).toFixed(2)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: '#E63946', fontFamily: 'monospace' }}>
                      Bs {Number(r.subtotal || 0).toFixed(2)}
                    </td>
                    <td style={s.td}>
                      <span style={s.estadoBadge}>{r.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={s.paginacion}>
            <span style={s.paginaInfo}>
              Mostrando {inicio + 1}–{Math.min(inicio + porPagina, historialFiltrado.length)} de {historialFiltrado.length}
            </span>
            <div style={s.paginaBtns}>
              <button
                onClick={() => setPagina(1)}
                disabled={paginaActual === 1}
                style={s.pagBtn}
                title="Primera página"
              >«</button>
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                style={s.pagBtn}
              >‹</button>

              {/* Números de página */}
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let num
                if (totalPaginas <= 5) {
                  num = i + 1
                } else if (paginaActual <= 3) {
                  num = i + 1
                } else if (paginaActual >= totalPaginas - 2) {
                  num = totalPaginas - 4 + i
                } else {
                  num = paginaActual - 2 + i
                }
                return (
                  <button
                    key={num}
                    onClick={() => setPagina(num)}
                    style={num === paginaActual ? s.pagBtnActivo : s.pagBtn}
                  >
                    {num}
                  </button>
                )
              })}

              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                style={s.pagBtn}
              >›</button>
              <button
                onClick={() => setPagina(totalPaginas)}
                disabled={paginaActual === totalPaginas}
                style={s.pagBtn}
                title="Última página"
              >»</button>
            </div>
          </div>
        </>
      )}

      {/* ══ TOP PRODUCTOS ═════════════════════════════════════════════════ */}
      {topProductos.length > 0 && (
        <>
          <SectionTitle>📈 Top 10 Productos Más Solicitados</SectionTitle>
          <div style={s.barChart}>
            {topProductos.map(([nombre, cant]) => {
              const max = topProductos[0][1]
              return (
                <div key={nombre} style={s.barRow}>
                  <div style={s.barLabel} title={nombre}>
                    {nombre.length > 38 ? nombre.slice(0, 38) + '…' : nombre}
                  </div>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${(cant / max) * 100}%` }} />
                  </div>
                  <div style={s.barVal}>{cant} ud.</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </AdminLayout>
  )
}

function SectionTitle({ children }) {
  return <h3 style={s.sectionTitle}>{children}</h3>
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ ...s.metricCard, borderLeftColor: color }}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color }}>{value}</div>
    </div>
  )
}

const s = {
  sectionTitle: {
    fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 1.5, color: '#888', margin: '1.5rem 0 0.5rem',
    paddingBottom: '0.4rem', borderBottom: '2px solid #EBEBEB',
  },
  metricasRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' },
  metricCard: {
    flex: 1, minWidth: 130, background: 'white', borderRadius: 12,
    padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #ccc',
  },
  metricLabel: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888' },
  metricValue: { fontSize: '1.35rem', fontWeight: 700, marginTop: 4 },

  filtrosRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' },
  filtroGrupo: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  filtroLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#555' },
  select: { padding: '0.5rem 0.75rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.85rem', background: 'white', minWidth: 150 },
  searchInput: { padding: '0.5rem 0.75rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.85rem', minWidth: 220 },
  clearBtn: {
    alignSelf: 'flex-end', padding: '0.5rem 0.9rem', background: '#F5F5F5',
    border: '1px solid #DDD', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', color: '#666',
  },

  historialHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' },
  headerActions: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' },
  exportBtn: {
    padding: '0.55rem 1.1rem', background: '#1A1A2E', color: 'white',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    alignSelf: 'flex-end',
  },
  caption: { fontSize: '0.8rem', color: '#888', margin: '0 0 0.75rem' },

  tableWrapper: { borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.82rem', minWidth: 800 },
  th: { padding: '0.65rem 0.75rem', background: '#F8F9FF', textAlign: 'left', fontWeight: 700, fontSize: '0.74rem', color: '#555', borderBottom: '2px solid #EBEBEB', whiteSpace: 'nowrap' },
  td: { padding: '0.55rem 0.75rem', borderBottom: '1px solid #F4F4F4', verticalAlign: 'middle' },
  trAlt: { background: '#FAFAFA' },
  regionalBadge: { fontSize: '0.72rem', fontWeight: 600, background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: 20 },
  estadoBadge: { fontSize: '0.72rem', fontWeight: 600, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20 },

  paginacion: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 0.25rem', flexWrap: 'wrap', gap: '0.5rem',
  },
  paginaInfo: { fontSize: '0.82rem', color: '#888' },
  paginaBtns: { display: 'flex', gap: '0.3rem' },
  pagBtn: {
    width: 34, height: 34, border: '1px solid #DDD', background: 'white',
    borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#555',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pagBtnActivo: {
    width: 34, height: 34, border: '1px solid #E63946', background: '#E63946',
    borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: 'white', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  loadingRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' },
  spinner: { width: 24, height: 24, border: '3px solid #E0E0E0', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: '0.85rem', color: '#888' },
  emptyMsg: { color: '#888', fontSize: '0.88rem', padding: '1rem 0' },

  barChart: { background: 'white', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' },
  barRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' },
  barLabel: { width: 270, fontSize: '0.82rem', color: '#1A1A2E', overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 0 },
  barTrack: { flex: 1, height: 10, background: '#F0F0F0', borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', background: '#E63946', borderRadius: 6, transition: 'width 0.4s ease' },
  barVal: { width: 65, fontSize: '0.78rem', color: '#666', textAlign: 'right', flexShrink: 0 },
}