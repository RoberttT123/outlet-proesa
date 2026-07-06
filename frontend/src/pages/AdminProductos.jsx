import { useState, useEffect, useRef, useMemo } from 'react'
import { productosApi } from '../api/client'
import AdminLayout from '../components/AdminLayout'

const OPCIONES_PAG = [10, 20, 30, 50]

// ==============================================================================
// UPLOAD DIRECTO A CLOUDINARY (unsigned)
// ==============================================================================
async function subirImagenCloudinary(file, cloudName, uploadPreset, onProgress) {
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', uploadPreset)
  form.append('folder', 'outlet_proesa')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText)
      if (xhr.status === 200) resolve(data)
      else reject(new Error(data.error?.message || 'Error subiendo imagen'))
    }
    xhr.onerror = () => reject(new Error('Error de red al subir imagen'))
    xhr.send(form)
  })
}

// ==============================================================================
// COMPONENTE PRINCIPAL
// ==============================================================================
export default function AdminProductos() {
  const [productos, setProductos]         = useState(null)
  const [busqueda, setBusqueda]           = useState('')
  const [porPagina, setPorPagina]         = useState(10)
  const [pagina, setPagina]               = useState(1)
  const [modal, setModal]                 = useState(null)
  const [cloudinaryCfg, setCloudinaryCfg] = useState(null)
  const [toast, setToast]                 = useState(null)

  useEffect(() => {
    cargarProductos()
    productosApi.cloudinaryConfig()
      .then(({ data }) => setCloudinaryCfg(data))
      .catch(() => {})
  }, [])

  const cargarProductos = () => {
    productosApi.listar()
      .then(({ data }) => setProductos(data))
      .catch(() => setProductos([]))
  }

  const mostrarToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  const handleEliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await productosApi.eliminar(p.id)
      setProductos((prev) => prev.filter((x) => x.id !== p.id))
      mostrarToast(`"${p.nombre}" eliminado.`)
    } catch (err) {
      mostrarToast(err.response?.data?.detail || 'Error al eliminar', 'error')
    }
  }

  const filtrados = useMemo(() => {
    if (!productos) return []
    if (!busqueda.trim()) return productos
    const q = busqueda.toLowerCase()
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    )
  }, [productos, busqueda])

  const totalPags = Math.max(1, Math.ceil(filtrados.length / porPagina))
  const pagActual = Math.min(pagina, totalPags)
  const inicio    = (pagActual - 1) * porPagina
  const paginados = filtrados.slice(inicio, inicio + porPagina)

  const handleBusqueda = (v) => { setBusqueda(v); setPagina(1) }

  return (
    <AdminLayout titulo="Productos" subtitulo="Catálogo permanente · Precio y stock se actualizan desde los catálogos de campaña">

      {/* ── INFO BANNER ── */}
      <div style={s.infoBanner}>
        💡 Los productos aquí guardados se vinculan automáticamente al catálogo de campaña por <strong>código</strong>.
        El precio y stock los gestiona el Excel de cada campaña — aquí solo administras la información permanente e imágenes.
      </div>

      {/* ── BARRA SUPERIOR ── */}
      <div style={s.topBar}>
        <div style={s.topLeft}>
          <input
            type="text"
            placeholder="Buscar por nombre o código SKU..."
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            style={s.searchInput}
          />
          <div style={s.fieldGrupo}>
            <label style={s.fieldLabel}>Mostrar</label>
            <select
              value={porPagina}
              onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }}
              style={s.selectSm}
            >
              {OPCIONES_PAG.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => setModal('crear')} style={s.btnNuevo}>
          ➕ Nuevo Producto
        </button>
      </div>

      {/* ── STATS ── */}
      {productos && (
        <div style={s.statsRow}>
          <Chip label="Total"      value={productos.length}                                    color="#1A1A2E" bg="#F0F4FF" />
          <Chip label="Con imagen" value={productos.filter((p) => p.cloudinary_url).length}   color="#065F46" bg="#D1FAE5" />
          <Chip label="Sin imagen" value={productos.filter((p) => !p.cloudinary_url).length}  color="#854D0E" bg="#FEF9C3" />
          <Chip label="Inactivos"  value={productos.filter((p) => !p.activo).length}          color="#991B1B" bg="#FEE2E2" />
        </div>
      )}

      {/* ── TABLA ── */}
      {productos === null ? (
        <Loading />
      ) : filtrados.length === 0 ? (
        <p style={s.emptyMsg}>{busqueda ? 'Sin resultados.' : 'No hay productos cargados aún. Agrega el primero con ➕.'}</p>
      ) : (
        <>
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Imagen', 'Código', 'Nombre', 'Línea', 'Empresa', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginados.map((p, i) => (
                  <tr key={p.id} style={i % 2 !== 0 ? s.trAlt : {}}>
                    <td style={s.td}>
                      {p.cloudinary_url ? (
                        <img src={p.cloudinary_url} alt={p.nombre} style={s.thumbImg}
                          onError={(e) => { e.target.style.display = 'none' }} />
                      ) : (
                        <div style={s.thumbPlaceholder}>📦</div>
                      )}
                    </td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.78rem', color: '#666' }}>{p.codigo}</td>
                    <td style={{ ...s.td, fontWeight: 500, maxWidth: 240 }}>{p.nombre}</td>
                    <td style={s.td}>{p.linea || '—'}</td>
                    <td style={s.td}>{p.empresa || '—'}</td>
                    <td style={s.td}>
                      <span style={p.activo ? s.badgeOk : s.badgeOff}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.acciones}>
                        <button onClick={() => setModal(p)} style={s.btnEdit} title="Editar">✏️</button>
                        <button onClick={() => handleEliminar(p)} style={s.btnDel} title="Eliminar">🗑️</button>
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
              Mostrando {inicio + 1}–{Math.min(inicio + porPagina, filtrados.length)} de {filtrados.length}
            </span>
            <div style={s.paginaBtns}>
              <PagBtn onClick={() => setPagina(1)}              disabled={pagActual === 1}>«</PagBtn>
              <PagBtn onClick={() => setPagina((p) => p - 1)}  disabled={pagActual === 1}>‹</PagBtn>
              {Array.from({ length: Math.min(5, totalPags) }, (_, i) => {
                let num
                if (totalPags <= 5)             num = i + 1
                else if (pagActual <= 3)         num = i + 1
                else if (pagActual >= totalPags - 2) num = totalPags - 4 + i
                else                             num = pagActual - 2 + i
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
        <ModalProducto
          producto={modal === 'crear' ? null : modal}
          cloudinaryCfg={cloudinaryCfg}
          onClose={() => setModal(null)}
          onGuardado={(updated) => {
            if (modal === 'crear') cargarProductos()
            else setProductos((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p))
            mostrarToast(modal === 'crear' ? '✅ Producto creado.' : '✅ Producto actualizado.')
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
// MODAL CREAR / EDITAR
// ==============================================================================
function ModalProducto({ producto, cloudinaryCfg, onClose, onGuardado, onError }) {
  const esNuevo = !producto

  const [form, setForm] = useState({
    codigo:  producto?.codigo  ?? '',
    nombre:  producto?.nombre  ?? '',
    linea:   producto?.linea   ?? '',
    empresa: producto?.empresa ?? '',
    activo:  producto?.activo  ?? true,
  })
  const [imgSrc, setImgSrc]           = useState(producto?.cloudinary_url ?? null)
  const [imgPublicId, setImgPublicId] = useState(producto?.cloudinary_public_id ?? null)
  const [imgProgress, setImgProgress] = useState(0)
  const [imgLoading, setImgLoading]   = useState(false)
  const [loading, setLoading]         = useState(false)
  const [isDirty, setIsDirty]         = useState(esNuevo)
  const fileRef                       = useRef(null)

  const setField = (key, val) => { setForm((prev) => ({ ...prev, [key]: val })); setIsDirty(true) }

  const handleImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !cloudinaryCfg) return
    setImgLoading(true)
    setImgProgress(0)
    try {
      const result = await subirImagenCloudinary(
        file, cloudinaryCfg.cloud_name, cloudinaryCfg.upload_preset, setImgProgress
      )
      setImgSrc(result.secure_url)
      setImgPublicId(result.public_id)
      setIsDirty(true)

      if (!esNuevo && producto?.id) {
        await productosApi.actualizarImagen(producto.id, {
          cloudinary_public_id: result.public_id,
          cloudinary_url:       result.secure_url,
        })
        onGuardado({ id: producto.id, cloudinary_url: result.secure_url, cloudinary_public_id: result.public_id })
      }
    } catch (err) {
      onError(err.message || 'Error subiendo imagen')
    } finally {
      setImgLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleEliminarImagen = async () => {
    if (!producto?.id) { setImgSrc(null); setImgPublicId(null); return }
    try {
      await productosApi.eliminarImagen(producto.id)
      setImgSrc(null)
      setImgPublicId(null)
      onGuardado({ id: producto.id, cloudinary_url: null, cloudinary_public_id: null })
    } catch (err) {
      onError(err.response?.data?.detail || 'Error eliminando imagen')
    }
  }

  const handleGuardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      onError('Código y nombre son obligatorios.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        codigo:  form.codigo.trim(),
        nombre:  form.nombre.trim(),
        linea:   form.linea.trim()   || null,
        empresa: form.empresa.trim() || null,
        activo:  form.activo,
      }

      if (esNuevo) {
        const { data } = await productosApi.crear(payload)
        if (imgSrc && imgPublicId && data?.id) {
          await productosApi.actualizarImagen(data.id, {
            cloudinary_public_id: imgPublicId,
            cloudinary_url:       imgSrc,
          })
        }
        onGuardado(data)
      } else {
        await productosApi.actualizar(producto.id, payload)
        onGuardado({ id: producto.id, ...payload })
      }
    } catch (err) {
      onError(err.response?.data?.detail || 'Error guardando producto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>{esNuevo ? '➕ Nuevo Producto' : '✏️ Editar Producto'}</h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.modalBody}>
          {/* Imagen */}
          <div style={s.imgSection}>
            {imgSrc ? (
              <div style={s.imgPreviewWrapper}>
                <img src={imgSrc} alt="preview" style={s.imgPreview} />
                <button onClick={handleEliminarImagen} style={s.imgDeleteBtn} title="Quitar imagen">✕</button>
              </div>
            ) : (
              <div style={s.imgPlaceholder}>📦</div>
            )}
            <div style={s.imgActions}>
              <p style={s.imgHint}>
                La imagen se vincula automáticamente cuando el código aparece en un catálogo de campaña.
              </p>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={s.btnImagen} disabled={imgLoading}>
                {imgLoading ? `⏳ ${imgProgress}%` : imgSrc ? '📷 Cambiar imagen' : '📷 Agregar imagen'}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }} onChange={handleImagen} />
              {imgLoading && (
                <div style={s.progressBar}>
                  <div style={{ ...s.progressFill, width: `${imgProgress}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Nota informativa */}
          <div style={s.notaBanner}>
            ℹ️ El <strong>precio y stock</strong> se actualizan automáticamente desde el Excel de cada campaña por regional.
          </div>

          {/* Campos */}
          <div style={s.fields}>
            <div style={s.fieldRow}>
              <Field label="Código *" value={form.codigo}
                onChange={(v) => setField('codigo', v)}
                placeholder="Ej: 110177" disabled={!esNuevo} />
              <Field label="Línea" value={form.linea}
                onChange={(v) => setField('linea', v)}
                placeholder="Ej: Limpieza" />
            </div>
            <Field label="Nombre *" value={form.nombre}
              onChange={(v) => setField('nombre', v)}
              placeholder="Nombre completo del producto" />
            <div style={s.fieldRow}>
              <Field label="Empresa" value={form.empresa}
                onChange={(v) => setField('empresa', v)}
                placeholder="Ej: PROESA" />
              <div style={s.checkField}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={form.activo}
                    onChange={(e) => setField('activo', e.target.checked)}
                    style={{ marginRight: 6 }} />
                  Producto activo
                </label>
              </div>
            </div>
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
    <button onClick={onClick} disabled={disabled} style={activo ? s.pagBtnActivo : s.pagBtn}>
      {children}
    </button>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
      <div style={s.spinner} />
      <span style={{ fontSize: '0.85rem', color: '#888' }}>Cargando productos...</span>
    </div>
  )
}

// ==============================================================================
// ESTILOS
// ==============================================================================
const s = {
  infoBanner: {
    background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
    padding: '0.75rem 1rem', color: '#1D4ED8', fontSize: '0.85rem',
    marginBottom: '1.25rem', lineHeight: 1.5,
  },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
  topLeft: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 },
  searchInput: { flex: 1, minWidth: 220, padding: '0.55rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem' },
  fieldGrupo: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  fieldLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#555' },
  selectSm: { padding: '0.5rem 0.75rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.85rem', minWidth: 80 },
  btnNuevo: { padding: '0.6rem 1.25rem', background: '#E63946', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' },
  statsRow: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' },
  tableWrapper: { borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.82rem' },
  th: { padding: '0.65rem 0.75rem', background: '#F8F9FF', textAlign: 'left', fontWeight: 700, fontSize: '0.74rem', color: '#555', borderBottom: '2px solid #EBEBEB', whiteSpace: 'nowrap' },
  td: { padding: '0.55rem 0.75rem', borderBottom: '1px solid #F4F4F4', verticalAlign: 'middle' },
  trAlt: { background: '#FAFAFA' },
  thumbImg: { width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #EEE' },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: 8, background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', border: '1px solid #EEE' },
  badgeOk:  { fontSize: '0.72rem', fontWeight: 600, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20 },
  badgeOff: { fontSize: '0.72rem', fontWeight: 600, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 20 },
  acciones: { display: 'flex', gap: '0.4rem' },
  btnEdit:  { padding: '0.3rem 0.55rem', background: '#EEF2FF', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem' },
  btnDel:   { padding: '0.3rem 0.55rem', background: '#FEE2E2', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem' },
  paginacion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.25rem', flexWrap: 'wrap', gap: '0.5rem' },
  paginaInfo: { fontSize: '0.82rem', color: '#888' },
  paginaBtns: { display: 'flex', gap: '0.3rem' },
  pagBtn:      { width: 32, height: 32, border: '1px solid #DDD', background: 'white', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#555' },
  pagBtnActivo:{ width: 32, height: 32, border: '1px solid #E63946', background: '#E63946', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'white', fontWeight: 700 },
  emptyMsg: { color: '#888', fontSize: '0.88rem', padding: '1rem 0' },
  spinner: { width: 24, height: 24, border: '3px solid #E0E0E0', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #EBEBEB' },
  modalTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E' },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#888', padding: '0.25rem' },
  modalBody: { padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  modalFooter: { padding: '1rem 1.5rem', borderTop: '1px solid #EBEBEB', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
  imgSection: { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  imgPreviewWrapper: { position: 'relative', flexShrink: 0 },
  imgPreview: { width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid #EEE' },
  imgDeleteBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#E63946', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  imgPlaceholder: { width: 90, height: 90, borderRadius: 10, background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', border: '1px dashed #DDD', flexShrink: 0 },
  imgActions: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  imgHint: { fontSize: '0.78rem', color: '#888', margin: 0, lineHeight: 1.4 },
  btnImagen: { padding: '0.6rem 1rem', background: '#F5F5F5', border: '1px dashed #CCC', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#444', fontWeight: 500 },
  progressBar: { height: 6, background: '#EEE', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#E63946', borderRadius: 3, transition: 'width 0.2s' },
  notaBanner: { background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: '#1D4ED8' },
  fields: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  fieldRow: { display: 'flex', gap: '0.75rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 },
  input: { padding: '0.6rem 0.85rem', border: '1px solid #DDD', borderRadius: 8, fontSize: '0.88rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  checkField: { display: 'flex', alignItems: 'flex-end', paddingBottom: '0.1rem' },
  checkLabel: { fontSize: '0.85rem', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  btnCancelar: { padding: '0.6rem 1.25rem', background: '#F5F5F5', border: '1px solid #DDD', borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem', color: '#666' },
  btnGuardar:  { padding: '0.6rem 1.5rem', background: '#E63946', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700, transition: 'opacity 0.15s' },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 30, fontSize: '0.88rem', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 2000, whiteSpace: 'nowrap' },
}