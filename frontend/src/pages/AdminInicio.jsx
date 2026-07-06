import { useState, useEffect } from 'react'
import { adminApi } from '../api/client'
import AdminLayout from '../components/AdminLayout'
import api from '../api/client'

export default function AdminInicio() {
  const [regionales, setRegionales]             = useState([])
  const [cargando, setCargando]                 = useState(true)
  const [regionalSubida, setRegionalSubida]     = useState('')
  const [regionalesUpload, setRegionalesUpload] = useState([])
  const [subiendo, setSubiendo]                 = useState(false)
  const [msgExcel, setMsgExcel]                 = useState(null)

  // Catálogo visualización
  const [regionalVista, setRegionalVista]       = useState('')
  const [catalogo, setCatalogo]                 = useState(null)
  const [cargandoCat, setCargandoCat]           = useState(false)
  const [filtroCat, setFiltroCat]               = useState('')
  const [porPaginaCat, setPorPaginaCat]         = useState(10)
  const [paginaCat, setPaginaCat]               = useState(1)

  const cargarRegionales = () => {
    adminApi.listarRegionales()
      .then(({ data }) => setRegionales(data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarRegionales()
    api.get('/admin/inventario/regionales')
      .then(({ data }) => {
        setRegionalesUpload(data)
        if (data.length > 0) {
          setRegionalSubida(data[0].nombre)
          setRegionalVista(data[0].nombre)
        }
      })
      .catch(() => {})
  }, [])

  // Cargar catálogo cuando cambia la regional de vista
  useEffect(() => {
    if (!regionalVista) return
    setCargandoCat(true)
    setCatalogo(null)
    api.get(`/admin/inventario/catalogo/${encodeURIComponent(regionalVista)}`)
      .then(({ data }) => setCatalogo(data))
      .catch(() => setCatalogo([]))
      .finally(() => setCargandoCat(false))
  }, [regionalVista])

  const toggleRegional = async (nombre, activo) => {
    await adminApi.actualizarRegional(nombre, !activo)
    setRegionales((prev) =>
      prev.map((r) => (r.nombre === nombre ? { ...r, outlet_activo: !activo } : r))
    )
  }

  const accionTodas = async (activar) => {
    if (activar) await adminApi.activarTodas()
    else await adminApi.cerrarTodas()
    setRegionales((prev) => prev.map((r) => ({ ...r, outlet_activo: activar })))
  }

  const handleExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!regionalSubida) {
      setMsgExcel({ tipo: 'error', texto: '❌ Selecciona una regional antes de subir el archivo.' })
      return
    }
    setSubiendo(true)
    setMsgExcel(null)
    const form = new FormData()
    form.append('archivo', file)
    form.append('regional', regionalSubida)
    try {
      const { data } = await adminApi.subirExcel(form)
      setMsgExcel({ tipo: 'ok', texto: `✅ ${data.mensaje}` })
      // Refrescar catálogo si la regional de vista coincide con la subida
      if (regionalVista === regionalSubida) {
        setCargandoCat(true)
        api.get(`/admin/inventario/catalogo/${encodeURIComponent(regionalVista)}`)
          .then(({ data }) => setCatalogo(data))
          .catch(() => setCatalogo([]))
          .finally(() => setCargandoCat(false))
      }
    } catch (err) {
      setMsgExcel({ tipo: 'error', texto: `❌ ${err.response?.data?.detail || 'Error al subir el archivo'}` })
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  // Filtrar catálogo
  // Resetear página al cambiar filtro o regional
  const handleFiltroCat = (val) => { setFiltroCat(val); setPaginaCat(1) }
  const handleRegionalVista = (val) => { setRegionalVista(val); setPaginaCat(1); setFiltroCat('') }

  const catalogoFiltrado = (catalogo || []).filter((p) => {
    if (!filtroCat.trim()) return true
    const q = filtroCat.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
  })

  // Paginación del catálogo
  const OPCIONES_PAG_CAT  = [10, 20, 30, 50]
  const totalPagCat       = Math.max(1, Math.ceil(catalogoFiltrado.length / porPaginaCat))
  const paginaCatActual   = Math.min(paginaCat, totalPagCat)
  const inicioCat         = (paginaCatActual - 1) * porPaginaCat
  const catalogoPaginado  = catalogoFiltrado.slice(inicioCat, inicioCat + porPaginaCat)

  // Stats del catálogo
  const statsAgotado  = (catalogo || []).filter((p) => p.stock <= 0).length
  const statsBajo     = (catalogo || []).filter((p) => p.stock > 0 && p.stock <= 5).length
  const statsOk       = (catalogo || []).filter((p) => p.stock > 5).length

  const activas   = regionales.filter((r) => r.outlet_activo).length
  const inactivas = regionales.length - activas

  return (
    <AdminLayout titulo="Panel de Control" subtitulo="Inventario y control de acceso por regional">

      {/* ══ CARGA DE CATÁLOGO ══════════════════════════════════════════════ */}
      <SectionTitle>📂 Actualizar Catálogo Maestro</SectionTitle>
      <div style={s.uploadBox}>
        <p style={s.uploadDesc}>
          Selecciona la regional y sube el Excel. El catálogo anterior de esa regional será{' '}
          <strong>reemplazado completamente</strong> por los nuevos datos.
        </p>
        <div style={s.uploadRow}>
          <div style={s.uploadField}>
            <label style={s.fieldLabel}>Regional</label>
            <select value={regionalSubida} onChange={(e) => setRegionalSubida(e.target.value)} style={s.select}>
              {regionalesUpload.map((r) => (
                <option key={r.id} value={r.nombre}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div style={s.uploadField}>
            <label style={s.fieldLabel}>Archivo Excel</label>
            <label style={{ ...s.uploadLabel, opacity: subiendo ? 0.6 : 1, cursor: subiendo ? 'not-allowed' : 'pointer' }}>
              {subiendo ? '⏳ Subiendo...' : '📁 Seleccionar archivo .xlsx'}
              <input type="file" accept=".xlsx" onChange={handleExcel} disabled={subiendo} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {regionalSubida && (
          <div style={s.previewAlert}>
            ⚠️ Se borrarán <strong>todos los productos actuales</strong> de <strong>{regionalSubida}</strong> y se cargarán los del nuevo Excel.
          </div>
        )}
        {msgExcel && (
          <div style={msgExcel.tipo === 'ok' ? s.msgOk : s.msgError}>{msgExcel.texto}</div>
        )}
      </div>

      {/* ══ VISUALIZACIÓN DEL CATÁLOGO ════════════════════════════════════ */}
      <SectionTitle>🔍 Catálogo por Regional</SectionTitle>

      {/* Selector de regional para visualizar */}
      <div style={s.vistaHeader}>
        <div style={s.uploadField}>
          <label style={s.fieldLabel}>Ver catálogo de:</label>
          <select value={regionalVista} onChange={(e) => handleRegionalVista(e.target.value)} style={s.select}>
            {regionalesUpload.map((r) => (
              <option key={r.id} value={r.nombre}>{r.nombre}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o código SKU..."
          value={filtroCat}
          onChange={(e) => setFiltroCat(e.target.value)}
          style={s.searchInput}
        />
      </div>

      {/* Stats rápidos */}
      {catalogo !== null && (
        <div style={s.statsRow}>
          <StatChip label="Total" value={catalogo.length} color="#1A1A2E" bg="#F0F4FF" />
          <StatChip label="✅ Disponible" value={statsOk} color="#065F46" bg="#D1FAE5" />
          <StatChip label="⚠️ Stock bajo (≤5)" value={statsBajo} color="#854D0E" bg="#FEF9C3" />
          <StatChip label="❌ Agotado" value={statsAgotado} color="#991B1B" bg="#FEE2E2" />
        </div>
      )}

      {/* Leyenda */}
      <div style={s.leyenda}>
        <span style={{ ...s.leyendaItem, background: '#FEE2E2' }}>■ Agotado (stock = 0)</span>
        <span style={{ ...s.leyendaItem, background: '#FEF9C3' }}>■ Stock bajo (1–5 ud.)</span>
        <span style={{ ...s.leyendaItem, background: '#FFFFFF' }}>■ Disponible (&gt;5 ud.)</span>
      </div>

      {/* Tabla */}
      {cargandoCat ? (
        <div style={s.loadingCat}>
          <div style={s.spinner} />
          <span style={{ color: '#888', fontSize: '0.85rem', marginLeft: '0.75rem' }}>Cargando catálogo...</span>
        </div>
      ) : catalogo === null ? null : catalogoFiltrado.length === 0 ? (
        <p style={{ color: '#888', fontSize: '0.88rem' }}>
          {filtroCat ? 'Sin resultados para la búsqueda.' : `No hay productos cargados para ${regionalVista}.`}
        </p>
      ) : (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Código', 'Nombre', 'Línea', 'Empresa', 'Precio', 'Stock', 'Estado'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogoPaginado.map((p) => {
                const rowStyle = p.stock <= 0
                  ? s.rowAgotado
                  : p.stock <= 5
                  ? s.rowBajo
                  : {}
                return (
                  <tr key={p.id} style={rowStyle}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.codigo}</td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{p.nombre}</td>
                    <td style={s.td}>{p.linea || '—'}</td>
                    <td style={s.td}>{p.empresa || '—'}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace' }}>Bs {Number(p.precio_unitario).toFixed(2)}</td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 700,
                      color: p.stock <= 0 ? '#991B1B' : p.stock <= 5 ? '#854D0E' : '#065F46' }}>
                      {p.stock}
                    </td>
                    <td style={s.td}>
                      {p.stock <= 0
                        ? <Badge text="❌ Agotado"   bg="#FEE2E2" color="#991B1B" />
                        : p.stock <= 5
                        ? <Badge text={`⚠️ ${p.stock} ud.`} bg="#FEF9C3" color="#854D0E" />
                        : <Badge text="✅ Ok"        bg="#D1FAE5" color="#065F46" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={s.tableFooter}>
            <span>
              Mostrando {inicioCat + 1}–{Math.min(inicioCat + porPaginaCat, catalogoFiltrado.length)} de {catalogoFiltrado.length} productos · {regionalVista}
            </span>
            <div style={s.paginaBtns}>
              <button onClick={() => setPaginaCat(1)} disabled={paginaCatActual === 1} style={s.pagBtn}>«</button>
              <button onClick={() => setPaginaCat((p) => Math.max(1, p - 1))} disabled={paginaCatActual === 1} style={s.pagBtn}>‹</button>
              {Array.from({ length: Math.min(5, totalPagCat) }, (_, i) => {
                let num
                if (totalPagCat <= 5) num = i + 1
                else if (paginaCatActual <= 3) num = i + 1
                else if (paginaCatActual >= totalPagCat - 2) num = totalPagCat - 4 + i
                else num = paginaCatActual - 2 + i
                return (
                  <button key={num} onClick={() => setPaginaCat(num)}
                    style={num === paginaCatActual ? s.pagBtnActivo : s.pagBtn}>
                    {num}
                  </button>
                )
              })}
              <button onClick={() => setPaginaCat((p) => Math.min(totalPagCat, p + 1))} disabled={paginaCatActual === totalPagCat} style={s.pagBtn}>›</button>
              <button onClick={() => setPaginaCat(totalPagCat)} disabled={paginaCatActual === totalPagCat} style={s.pagBtn}>»</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONTROL DE OUTLET POR REGIONAL ════════════════════════════════ */}
      <SectionTitle>🔒 Control de Acceso por Regional</SectionTitle>
      <div style={s.resumenRow}>
        <MetricCard label="Regionales Activas"  value={activas}           color="#2DC653" />
        <MetricCard label="Regionales Cerradas" value={inactivas}         color="#E63946" />
        <MetricCard label="Total Regionales"    value={regionales.length} color="#1A1A2E" />
      </div>
      <div style={s.accionesRow}>
        <button onClick={() => accionTodas(true)}  style={s.btnActivarTodas}>✅ Activar todas</button>
        <button onClick={() => accionTodas(false)} style={s.btnCerrarTodas}>🔒 Cerrar todas</button>
      </div>
      {cargando ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>Cargando regionales...</p>
      ) : (
        <div style={s.grid}>
          {regionales.map((r) => (
            <div key={r.nombre} style={{ ...s.regionalCard, borderLeftColor: r.outlet_activo ? '#2DC653' : '#E63946' }}>
              <div>
                <div style={s.regionalNombre}>📍 {r.nombre}</div>
                <div style={r.outlet_activo ? s.estadoOk : s.estadoOff}>
                  {r.outlet_activo ? '✅ Activo' : '🔒 Cerrado'}
                </div>
              </div>
              <button
                onClick={() => toggleRegional(r.nombre, r.outlet_activo)}
                style={r.outlet_activo ? s.btnCerrar : s.btnAbrir}
              >
                {r.outlet_activo ? '🔒 Cerrar' : '✅ Activar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

function SectionTitle({ children }) {
  return <h3 style={s.sectionTitle}>{children}</h3>
}
function Badge({ text, bg, color }) {
  return (
    <span style={{ background: bg, color, fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
      {text}
    </span>
  )
}
function StatChip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '0.5rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.68rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</span>
    </div>
  )
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
    letterSpacing: 1.5, color: '#888', margin: '1.75rem 0 0.75rem',
    paddingBottom: '0.4rem', borderBottom: '2px solid #EBEBEB',
  },
  uploadBox: {
    background: 'white', borderRadius: 12, padding: '1.25rem 1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem',
  },
  uploadDesc: { color: '#555', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 },
  uploadRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' },
  uploadField: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  fieldLabel: { fontSize: '0.8rem', fontWeight: 600, color: '#444' },
  select: { padding: '0.55rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem', minWidth: 180, background: 'white' },
  uploadLabel: {
    display: 'inline-block', padding: '0.6rem 1.25rem',
    background: '#1A1A2E', color: 'white', borderRadius: 8,
    fontSize: '0.88rem', fontWeight: 600,
  },
  previewAlert: {
    marginTop: '0.85rem', background: '#FEF9C3', color: '#854D0E',
    padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.83rem', border: '1px solid #FDE68A',
  },
  msgOk: { marginTop: '0.75rem', background: '#D1FAE5', color: '#065F46', padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.85rem' },
  msgError: { marginTop: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.85rem' },

  vistaHeader: { display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.85rem' },
  searchInput: { flex: 1, minWidth: 220, padding: '0.55rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem' },
  statsRow: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  leyenda: { display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  leyendaItem: { fontSize: '0.75rem', color: '#555', padding: '3px 10px', borderRadius: 6, border: '1px solid #E0E0E0' },

  tableWrapper: { borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '0.5rem' },
  paginaBtns: { display: 'flex', gap: '0.3rem' },
  pagBtn: {
    width: 30, height: 30, border: '1px solid #DDD', background: 'white',
    borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#555',
  },
  pagBtnActivo: {
    width: 30, height: 30, border: '1px solid #E63946', background: '#E63946',
    borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'white', fontWeight: 700,
  },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.83rem' },
  th: { padding: '0.6rem 0.85rem', background: '#F8F9FF', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', color: '#555', borderBottom: '2px solid #EBEBEB' },
  td: { padding: '0.5rem 0.85rem', borderBottom: '1px solid #F0F0F0' },
  rowAgotado: { background: '#FFF0F0' },
  rowBajo:    { background: '#FFFBEB' },
  tableFooter: { background: '#F8F9FF', padding: '0.5rem 0.85rem', fontSize: '0.78rem', color: '#888', borderTop: '1px solid #EBEBEB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' },
  loadingCat: { display: 'flex', alignItems: 'center', padding: '2rem 0' },
  spinner: { width: 24, height: 24, border: '3px solid #E0E0E0', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  resumenRow: { display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '1rem' },
  metricCard: { flex: 1, minWidth: 120, background: 'white', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #ccc' },
  metricLabel: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888' },
  metricValue: { fontSize: '1.8rem', fontWeight: 700, marginTop: 4 },
  accionesRow: { display: 'flex', gap: '0.75rem', marginBottom: '1rem' },
  btnActivarTodas: { padding: '0.55rem 1.1rem', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  btnCerrarTodas:  { padding: '0.55rem 1.1rem', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' },
  regionalCard: { background: 'white', borderRadius: 12, padding: '1rem 1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  regionalNombre: { fontWeight: 600, color: '#1A1A2E', fontSize: '0.92rem' },
  estadoOk:  { display: 'inline-block', marginTop: 4, fontSize: '0.75rem', fontWeight: 600, background: '#D1FAE5', color: '#065F46', padding: '2px 10px', borderRadius: 20 },
  estadoOff: { display: 'inline-block', marginTop: 4, fontSize: '0.75rem', fontWeight: 600, background: '#FEE2E2', color: '#991B1B', padding: '2px 10px', borderRadius: 20 },
  btnCerrar: { padding: '0.45rem 0.9rem', background: '#E63946', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnAbrir:  { padding: '0.45rem 0.9rem', background: '#2DC653', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
}