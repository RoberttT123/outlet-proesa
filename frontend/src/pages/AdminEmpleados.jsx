import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import AdminLayout from '../components/AdminLayout'

const OPCIONES_PAG  = [10, 20, 30, 50]
const EMPRESAS      = ['PROESA', 'LOGMARK']
const REGIONALES    = [
  'La Paz','Santa Cruz','Cochabamba','Oruro',
  'Potosí','Chuquisaca','Tarija','Beni','Pando',
]

const empleadosApi = {
  listar:      ()         => api.get('/admin/empleados'),
  crear:       (data)     => api.post('/admin/empleados', data),
  actualizar:  (id, data) => api.patch(`/admin/empleados/${id}`, data),
  eliminar:    (id)       => api.delete(`/admin/empleados/${id}`),
}

export default function AdminEmpleados() {
  const [empleados, setEmpleados] = useState(null)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroEmp, setFiltroEmp] = useState('')
  const [filtroReg, setFiltroReg] = useState('')
  const [filtroAct, setFiltroAct] = useState('')
  const [porPagina, setPorPagina] = useState(10)
  const [pagina, setPagina]       = useState(1)
  const [modal, setModal]         = useState(null)   // null | 'crear' | empleado
  const [toast, setToast]         = useState(null)

  useEffect(() => { cargarEmpleados() }, [])

  const cargarEmpleados = () => {
    empleadosApi.listar()
      .then(({ data }) => setEmpleados(data))
      .catch(() => setEmpleados([]))
  }

  const mostrarToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  const handleEliminar = async (e) => {
    if (!confirm(`¿Eliminar a "${e.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await empleadosApi.eliminar(e.id)
      setEmpleados((prev) => prev.filter((x) => x.id !== e.id))
      mostrarToast(`"${e.nombre}" eliminado.`)
    } catch (err) {
      mostrarToast(err.response?.data?.detail || 'Error al eliminar', 'error')
    }
  }

  // Filtrado
  const filtrados = useMemo(() => {
    if (!empleados) return []
    let data = empleados
    if (filtroEmp) data = data.filter((e) => e.empresa === filtroEmp)
    if (filtroReg) data = data.filter((e) => e.regional === filtroReg)
    if (filtroAct !== '') data = data.filter((e) => String(e.activo) === filtroAct)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      data = data.filter((e) =>
        (e.nombre  || '').toLowerCase().includes(q) ||
        (e.codigo  || '').toLowerCase().includes(q) ||
        (e.carnet  || '').toLowerCase().includes(q)
      )
    }
    return data
  }, [empleados, busqueda, filtroEmp, filtroReg, filtroAct])

  const totalPags = Math.max(1, Math.ceil(filtrados.length / porPagina))
  const pagActual = Math.min(pagina, totalPags)
  const inicio    = (pagActual - 1) * porPagina
  const paginados = filtrados.slice(inicio, inicio + porPagina)

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroEmp(''); setFiltroReg(''); setFiltroAct(''); setPagina(1)
  }
  const hayFiltros = busqueda || filtroEmp || filtroReg || filtroAct !== ''

  // Stats
  const totalActivos  = (empleados || []).filter((e) => e.activo).length
  const totalInactivos = (empleados || []).filter((e) => !e.activo).length
  const totalAdmins   = (empleados || []).filter((e) => e.es_admin).length

  return (
    <AdminLayout titulo="Empleados" subtitulo="Gestión del personal habilitado para el outlet">

      {/* ── STATS ── */}
      {empleados && (
        <div style={s.statsRow}>
          <Chip label="Total"     value={(empleados || []).length} color="#1A1A2E" bg="#F0F4FF" />
          <Chip label="Activos"   value={totalActivos}             color="#065F46" bg="#D1FAE5" />
          <Chip label="Inactivos" value={totalInactivos}           color="#991B1B" bg="#FEE2E2" />
          <Chip label="Admins"    value={totalAdmins}              color="#6D28D9" bg="#EDE9FE" />
        </div>
      )}

      {/* ── BARRA SUPERIOR ── */}
      <div style={s.topBar}>
        <div style={s.topLeft}>
          <input
            type="text"
            placeholder="Buscar por nombre, código o carnet..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
            style={s.searchInput}
          />
          <div style={s.filtroGrupo}>
            <label style={s.filtroLabel}>Empresa</label>
            <select value={filtroEmp} onChange={(e) => { setFiltroEmp(e.target.value); setPagina(1) }} style={s.select}>
              <option value="">Todas</option>
              {EMPRESAS.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
            </select>
          </div>
          <div style={s.filtroGrupo}>
            <label style={s.filtroLabel}>Regional</label>
            <select value={filtroReg} onChange={(e) => { setFiltroReg(e.target.value); setPagina(1) }} style={s.select}>
              <option value="">Todas</option>
              {REGIONALES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={s.filtroGrupo}>
            <label style={s.filtroLabel}>Estado</label>
            <select value={filtroAct} onChange={(e) => { setFiltroAct(e.target.value); setPagina(1) }} style={s.select}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <div style={s.filtroGrupo}>
            <label style={s.filtroLabel}>Mostrar</label>
            <select value={porPagina} onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }} style={{ ...s.select, minWidth: 80 }}>
              {OPCIONES_PAG.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={s.clearBtn}>✕ Limpiar</button>
          )}
        </div>
        <button onClick={() => setModal('crear')} style={s.btnNuevo}>
          ➕ Nuevo Empleado
        </button>
      </div>

      {/* ── TABLA ── */}
      {empleados === null ? (
        <Loading />
      ) : filtrados.length === 0 ? (
        <p style={s.emptyMsg}>{hayFiltros ? 'Sin resultados.' : 'No hay empleados cargados.'}</p>
      ) : (
        <>
          <p style={s.caption}>
            Mostrando {inicio + 1}–{Math.min(inicio + porPagina, filtrados.length)} de {filtrados.length} empleados
          </p>
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Código','Nombre','Carnet','Empresa','Regional','Admin','Estado','Acciones'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginados.map((e, i) => (
                  <tr key={e.id} style={i % 2 !== 0 ? s.trAlt : {}}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.78rem', color: '#666' }}>{e.codigo}</td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{e.nombre}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.78rem' }}>{e.carnet || '—'}</td>
                    <td style={s.td}>
                      <span style={e.empresa === 'PROESA' ? s.badgeProesa : s.badgeLogmark}>
                        {e.empresa || '—'}
                      </span>
                    </td>
                    <td style={s.td}>{e.regional || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {e.es_admin ? <span style={s.badgeAdmin}>✓ Admin</span> : <span style={s.badgeNo}>—</span>}
                    </td>
                    <td style={s.td}>
                      <span style={e.activo ? s.badgeActivo : s.badgeInactivo}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.acciones}>
                        <button onClick={() => setModal(e)} style={s.btnEdit} title="Editar">✏️</button>
                        <button onClick={() => handleEliminar(e)} style={s.btnDel} title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={s.paginacion}>
            <span style={s.paginaInfo}>
              {filtrados.length} empleados · página {pagActual} de {totalPags}
            </span>
            <div style={s.paginaBtns}>
              <PagBtn onClick={() => setPagina(1)}              disabled={pagActual === 1}>«</PagBtn>
              <PagBtn onClick={() => setPagina((p) => p - 1)}  disabled={pagActual === 1}>‹</PagBtn>
              {Array.from({ length: Math.min(5, totalPags) }, (_, i) => {
                let num
                if (totalPags <= 5)                 num = i + 1
                else if (pagActual <= 3)              num = i + 1
                else if (pagActual >= totalPags - 2)  num = totalPags - 4 + i
                else                                  num = pagActual - 2 + i
                return <PagBtn key={num} onClick={() => setPagina(num)} activo={num === pagActual}>{num}</PagBtn>
              })}
              <PagBtn onClick={() => setPagina((p) => p + 1)}  disabled={pagActual === totalPags}>›</PagBtn>
              <PagBtn onClick={() => setPagina(totalPags)}      disabled={pagActual === totalPags}>»</PagBtn>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <ModalEmpleado
          empleado={modal === 'crear' ? null : modal}
          onClose={() => setModal(null)}
          onGuardado={(updated) => {
            if (modal === 'crear') cargarEmpleados()
            else setEmpleados((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated } : e))
            mostrarToast(modal === 'crear' ? '✅ Empleado creado.' : '✅ Empleado actualizado.')
            setModal(null)
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {toast && (
        <div style={{ ...s.toast, background: toast.tipo === 'error' ? '#E63946' : '#1A1A2E' }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  )
}

// ==============================================================================
// MODAL
// ==============================================================================
function ModalEmpleado({ empleado, onClose, onGuardado, onError }) {
  const esNuevo = !empleado

  const [form, setForm] = useState({
    codigo:   empleado?.codigo   ?? '',
    nombre:   empleado?.nombre   ?? '',
    carnet:   empleado?.carnet   ?? '',
    empresa:  empleado?.empresa  ?? 'PROESA',
    regional: empleado?.regional ?? 'La Paz',
    es_admin: empleado?.es_admin ?? false,
    activo:   empleado?.activo   ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(esNuevo)

  const setField = (key, val) => { setForm((prev) => ({ ...prev, [key]: val })); setIsDirty(true) }

  const handleGuardar = async () => {
    if (!form.codigo.trim()) { onError('El código es obligatorio.'); return }
    if (!form.nombre.trim()) { onError('El nombre es obligatorio.'); return }

    setLoading(true)
    try {
      const payload = {
        codigo:   form.codigo.trim().toUpperCase(),
        nombre:   form.nombre.trim().toUpperCase(),
        carnet:   form.carnet.trim() || null,
        empresa:  form.empresa,
        regional: form.regional,
        es_admin: form.es_admin,
        activo:   form.activo,
      }

      if (esNuevo) {
        await empleadosApi.crear(payload)
        onGuardado(payload)
      } else {
        await empleadosApi.actualizar(empleado.id, payload)
        onGuardado({ id: empleado.id, ...payload })
      }
    } catch (err) {
      onError(err.response?.data?.detail || 'Error guardando empleado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>{esNuevo ? '➕ Nuevo Empleado' : '✏️ Editar Empleado'}</h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.modalBody}>
          <div style={s.fieldRow}>
            <Field label="Código *" value={form.codigo}
              onChange={(v) => setField('codigo', v.toUpperCase())}
              placeholder="Ej: E0202026" disabled={!esNuevo} />
            <Field label="Carnet" value={form.carnet}
              onChange={(v) => setField('carnet', v)}
              placeholder="Ej: 12345678" />
          </div>

          <Field label="Nombre completo *" value={form.nombre}
            onChange={(v) => setField('nombre', v)}
            placeholder="APELLIDO NOMBRE" />

          <div style={s.fieldRow}>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Empresa *</label>
              <select value={form.empresa} onChange={(e) => setField('empresa', e.target.value)} style={s.selectField}>
                {EMPRESAS.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
              </select>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Regional *</label>
              <select value={form.regional} onChange={(e) => setField('regional', e.target.value)} style={s.selectField}>
                {REGIONALES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={s.checksRow}>
            <label style={s.checkLabel}>
              <input type="checkbox" checked={form.activo}
                onChange={(e) => setField('activo', e.target.checked)} style={{ marginRight: 6 }} />
              Empleado activo
            </label>
            <label style={s.checkLabel}>
              <input type="checkbox" checked={form.es_admin}
                onChange={(e) => setField('es_admin', e.target.checked)} style={{ marginRight: 6 }} />
              Es administrador
            </label>
          </div>
        </div>

        <div style={s.modalFooter}>
          <button onClick={onClose} style={s.btnCancelar}>Cancelar</button>
          <button onClick={handleGuardar} disabled={!isDirty || loading}
            style={{ ...s.btnGuardar, opacity: isDirty && !loading ? 1 : 0.5,
              cursor: isDirty && !loading ? 'pointer' : 'default' }}>
            {loading ? '⏳ Guardando...' : isDirty ? '💾 Guardar' : '✓ Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// AUXILIARES
// ==============================================================================
function Field({ label, value, onChange, placeholder, disabled = false }) {
  return (
    <div style={s.fieldGroup}>
      <label style={s.fieldLabel}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{ ...s.input, background: disabled ? '#F5F5F5' : 'white', color: disabled ? '#999' : '#1A1A2E' }} />
    </div>
  )
}
function Chip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '0.5rem 0.9rem' }}>
      <div style={{ fontSize: '0.68rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
function PagBtn({ onClick, disabled, activo, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={activo ? s.pagBtnActivo : s.pagBtn}>{children}</button>
  )
}
function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
      <div style={s.spinner} />
      <span style={{ fontSize: '0.85rem', color: '#888' }}>Cargando empleados...</span>
    </div>
  )
}

// ==============================================================================
// ESTILOS
// ==============================================================================
const s = {
  statsRow: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' },
  topLeft: { display: 'flex', gap: '0.65rem', alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 },
  searchInput: { flex: 1, minWidth: 220, padding: '0.5rem 0.75rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.85rem' },
  filtroGrupo: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  filtroLabel: { fontSize: '0.72rem', fontWeight: 600, color: '#555' },
  select: { padding: '0.5rem 0.65rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.82rem', background: 'white', minWidth: 120 },
  clearBtn: { alignSelf: 'flex-end', padding: '0.5rem 0.85rem', background: '#F5F5F5', border: '1px solid #DDD', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', color: '#666' },
  btnNuevo: { padding: '0.6rem 1.1rem', background: '#E63946', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', alignSelf: 'flex-end' },
  caption: { fontSize: '0.8rem', color: '#888', margin: '0 0 0.5rem' },
  tableWrapper: { borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.82rem' },
  th: { padding: '0.6rem 0.75rem', background: '#F8F9FF', textAlign: 'left', fontWeight: 700, fontSize: '0.73rem', color: '#555', borderBottom: '2px solid #EBEBEB', whiteSpace: 'nowrap' },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #F4F4F4', verticalAlign: 'middle' },
  trAlt: { background: '#FAFAFA' },
  badgeProesa:  { fontSize: '0.7rem', fontWeight: 700, background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 20 },
  badgeLogmark: { fontSize: '0.7rem', fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20 },
  badgeAdmin:   { fontSize: '0.7rem', fontWeight: 700, background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: 20 },
  badgeNo:      { fontSize: '0.7rem', color: '#CCC' },
  badgeActivo:  { fontSize: '0.7rem', fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20 },
  badgeInactivo:{ fontSize: '0.7rem', fontWeight: 700, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 20 },
  acciones: { display: 'flex', gap: '0.4rem' },
  btnEdit:  { padding: '0.3rem 0.55rem', background: '#EEF2FF', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem' },
  btnDel:   { padding: '0.3rem 0.55rem', background: '#FEE2E2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem' },
  paginacion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.25rem', flexWrap: 'wrap', gap: '0.5rem' },
  paginaInfo: { fontSize: '0.82rem', color: '#888' },
  paginaBtns: { display: 'flex', gap: '0.3rem' },
  pagBtn:       { width: 32, height: 32, border: '1px solid #DDD', background: 'white', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#555' },
  pagBtnActivo: { width: 32, height: 32, border: '1px solid #E63946', background: '#E63946', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'white', fontWeight: 700 },
  emptyMsg: { color: '#888', fontSize: '0.88rem', padding: '1rem 0' },
  spinner: { width: 24, height: 24, border: '3px solid #E0E0E0', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #EBEBEB' },
  modalTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E' },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#888' },
  modalBody: { padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  modalFooter: { padding: '1rem 1.5rem', borderTop: '1px solid #EBEBEB', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  fieldRow: { display: 'flex', gap: '0.75rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 },
  fieldLabel: { fontSize: '0.78rem', fontWeight: 600, color: '#555' },
  input: { padding: '0.6rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' },
  selectField: { padding: '0.6rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem', background: 'white', width: '100%', boxSizing: 'border-box' },
  checksRow: { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  checkLabel: { fontSize: '0.85rem', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  btnCancelar: { padding: '0.6rem 1.25rem', background: '#F5F5F5', border: '1px solid #DDD', borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem', color: '#666' },
  btnGuardar:  { padding: '0.6rem 1.5rem', background: '#E63946', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700 },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 30, fontSize: '0.88rem', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 2000, whiteSpace: 'nowrap' },
}