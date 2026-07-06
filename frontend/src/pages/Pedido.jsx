import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCarrito } from '../context/CarritoContext'
import { catalogoApi, pedidosApi } from '../api/client'

export default function Pedido() {
  const { usuario, logout } = useAuth()
  const carrito = useCarrito()

  const [tab, setTab] = useState('catalogo')
  const [outletActivo, setOutletActivo] = useState(true)
  const [verificandoOutlet, setVerificandoOutlet] = useState(true)
  const [productos, setProductos] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [toast, setToast] = useState(null)

  // ── Verificar outlet activo al cargar ───────────────────────────────────────
  useEffect(() => {
    catalogoApi
      .estadoOutlet()
      .then(({ data }) => setOutletActivo(data.activo))
      .catch(() => setOutletActivo(true))
      .finally(() => setVerificandoOutlet(false))
  }, [])

  // ── Cargar catálogo ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!outletActivo) return
    catalogoApi
      .listarProductos()
      .then(({ data }) => setProductos(data))
      .catch(() => setProductos([]))
      .finally(() => setCargandoProductos(false))
  }, [outletActivo])

  const mostrarToast = (mensaje, icono = '🛒') => {
    setToast({ mensaje, icono })
    setTimeout(() => setToast(null), 2800)
  }

  const productosFiltrados = useMemo(() => {
    if (!filtro.trim()) return productos
    const expr = filtro.trim().toLowerCase()
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(expr) || p.codigo.toLowerCase().includes(expr)
    )
  }, [productos, filtro])

  if (verificandoOutlet) {
    return <PantallaCarga />
  }

  if (!outletActivo) {
    return <OutletCerrado regional={usuario.regional} onLogout={logout} />
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerIcon}>🛒</div>
        <div>
          <h2 style={styles.headerTitle}>Tu Pedido</h2>
          <p style={styles.headerSub}>
            👤 {usuario.nombre} · 🔖 {usuario.cod_emp} · 🏢 {usuario.empresa}
          </p>
        </div>
      </header>

      <nav style={styles.tabs}>
        <TabButton activo={tab === 'catalogo'} onClick={() => setTab('catalogo')}>
          📦 Catálogo
        </TabButton>
        <TabButton activo={tab === 'carrito'} onClick={() => setTab('carrito')}>
          🛒 Carrito {carrito.totalUnidades > 0 && `(${carrito.totalUnidades})`}
        </TabButton>
        <TabButton activo={tab === 'historial'} onClick={() => setTab('historial')}>
          📋 Mis Pedidos
        </TabButton>
      </nav>

      <main style={styles.main}>
        {tab === 'catalogo' && (
          <TabCatalogo
            productos={productosFiltrados}
            cargando={cargandoProductos}
            filtro={filtro}
            setFiltro={setFiltro}
            onAgregar={mostrarToast}
          />
        )}
        {tab === 'carrito' && <TabCarrito onIrCatalogo={() => setTab('catalogo')} onToast={mostrarToast} />}
        {tab === 'historial' && <TabHistorial />}
      </main>

      <div style={styles.footer}>
        <button onClick={logout} style={styles.logoutBtn}>
          🚪 Cerrar Sesión
        </button>
      </div>

      {toast && (
        <div style={styles.toast}>
          {toast.icono} {toast.mensaje}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB CATÁLOGO
// ══════════════════════════════════════════════════════════════════════════════
const LIMITE_SIN_BUSQUEDA = 10

function TabCatalogo({ productos, cargando, filtro, setFiltro, onAgregar }) {
  const carrito = useCarrito()
  const [cantidades, setCantidades] = useState({})

  const getCantidad = (codigo) => cantidades[codigo] ?? 1
  const setCantidad = (codigo, val) =>
    setCantidades((prev) => ({ ...prev, [codigo]: Math.max(1, val) }))

  const handleAgregar = (producto) => {
    const cant = getCantidad(producto.codigo)
    if (cant > producto.stock) {
      onAgregar(`Solo hay ${producto.stock} unidades disponibles`, '🚫')
      return
    }
    carrito.agregarItem(producto, cant)
    onAgregar(`'${producto.nombre}' agregado al carrito!`)
  }

  // Sin búsqueda: mostrar solo los primeros 10
  // Con búsqueda: mostrar todos los que coincidan
  const hayFiltro      = filtro.trim().length > 0
  const productosMostrados = hayFiltro ? productos : productos.slice(0, LIMITE_SIN_BUSQUEDA)
  const hayMas         = !hayFiltro && productos.length > LIMITE_SIN_BUSQUEDA

  if (cargando) return <PantallaCarga compacta />

  return (
    <div>
      <h3 style={styles.sectionTitle}>📦 Productos en Promoción</h3>

      {/* Buscador */}
      <div style={styles.searchWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre o código SKU..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={styles.searchInputIcon}
        />
        {filtro && (
          <button onClick={() => setFiltro('')} style={styles.clearSearch}>✕</button>
        )}
      </div>

      {/* Info de resultados */}
      {!hayFiltro ? (
        <p style={styles.caption}>
          Mostrando los primeros {Math.min(LIMITE_SIN_BUSQUEDA, productos.length)} de{' '}
          {productos.length} productos.{' '}
          {hayMas && <span style={styles.captionHint}>Busca para ver más.</span>}
        </p>
      ) : productosMostrados.length === 0 ? (
        <p style={styles.emptyMsg}>🔍 Sin resultados para "<strong>{filtro}</strong>"</p>
      ) : (
        <p style={styles.caption}>{productosMostrados.length} resultado{productosMostrados.length !== 1 ? 's' : ''} para "{filtro}"</p>
      )}

      {/* Grid de productos */}
      <div style={styles.grid}>
        {productosMostrados.map((p) => {
          const bloqueado = p.stock <= 0
          return (
            <div key={p.id} style={{ ...styles.cardProducto, opacity: bloqueado ? 0.7 : 1 }}>

              {/* Imagen */}
              <div style={styles.cardImgWrapper}>
                {p.cloudinary_url ? (
                  <img
                    src={p.cloudinary_url}
                    alt={p.nombre}
                    style={styles.cardImg}
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div style={{
                  ...styles.cardImgPlaceholder,
                  display: p.cloudinary_url ? 'none' : 'flex',
                }}>
                  <span style={{ fontSize: '2rem' }}>📦</span>
                  <span style={styles.sinImagenLabel}>Sin imagen</span>
                </div>
                {/* Badge de stock sobre la imagen */}
                <div style={styles.stockOverlay}>
                  <Badge stock={p.stock} />
                </div>
              </div>

              {/* Info */}
              <div style={styles.cardInfo}>
                <span style={styles.sku}>SKU: {p.codigo}</span>
                <h4 style={styles.prodNombre}>{p.nombre}</h4>
                {p.linea && <span style={styles.lineaTag}>{p.linea}</span>}
                <div style={styles.prodPrecio}>Bs {p.precio_unitario.toFixed(2)}</div>
              </div>

              {/* Acción */}
              {!bloqueado ? (
                <div style={styles.prodActions}>
                  <input
                    type="number"
                    min={1}
                    value={getCantidad(p.codigo)}
                    onChange={(e) => setCantidad(p.codigo, parseInt(e.target.value) || 1)}
                    style={styles.qtyInput}
                  />
                  <button onClick={() => handleAgregar(p)} style={styles.addBtn}>
                    ➕ Solicitar
                  </button>
                </div>
              ) : (
                <button disabled style={styles.disabledBtn}>🚫 No Disponible</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Mensaje si hay más sin buscar */}
      {hayMas && (
        <div style={styles.hayMasBanner}>
          📦 Hay <strong>{productos.length - LIMITE_SIN_BUSQUEDA}</strong> productos más.
          Usa el buscador para encontrarlos.
        </div>
      )}
    </div>
  )
}

function Badge({ stock }) {
  if (stock <= 0) return <span style={{ ...styles.badge, ...styles.badgeOut }}>❌ Agotado</span>
  if (stock <= 5) return <span style={{ ...styles.badge, ...styles.badgeWarn }}>⚠️ {stock} ud.</span>
  return <span style={{ ...styles.badge, ...styles.badgeOk }}>✅ {stock}</span>
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB CARRITO
// ══════════════════════════════════════════════════════════════════════════════
function TabCarrito({ onIrCatalogo, onToast }) {
  const carrito = useCarrito()
  const [enviando, setEnviando] = useState(false)
  const [colision, setColision] = useState(null)

  const handleEnviar = async () => {
    setColision(null)
    setEnviando(true)
    try {
      const { data } = await pedidosApi.crear(carrito.items)
      if (data.exito) {
        carrito.limpiarCarrito()
        onToast('¡Tu pedido fue enviado con éxito!', '🎉')
      } else {
        setColision(data.sin_stock)
      }
    } catch (err) {
      onToast(err.response?.data?.detail || 'Error al procesar el pedido', '❌')
    } finally {
      setEnviando(false)
    }
  }

  if (carrito.items.length === 0) {
    return (
      <div>
        <h3 style={styles.sectionTitle}>🛒 Carrito de Compras</h3>
        <p style={styles.emptyMsg}>
          Tu carrito está vacío.{' '}
          <button onClick={onIrCatalogo} style={styles.linkBtn}>
            Agregar productos
          </button>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 style={styles.sectionTitle}>🛒 Carrito de Compras</h3>

      <div style={styles.cartContainer}>
        {carrito.items.map((item) => (
          <div key={item.codigo_producto} style={styles.cartItem}>
            <div style={styles.cartItemInfo}>
              <div style={styles.cartItemNombre}>{item.producto}</div>
              <div style={styles.cartItemTotal}>Bs {item.subtotal.toFixed(2)}</div>
            </div>
            <input
              type="number"
              min={1}
              value={item.cantidad}
              onChange={(e) =>
                carrito.actualizarCantidad(item.codigo_producto, parseInt(e.target.value) || 1)
              }
              style={styles.qtyInputCart}
            />
            <button onClick={() => carrito.eliminarItem(item.codigo_producto)} style={styles.deleteBtn}>
              🗑️
            </button>
          </div>
        ))}
      </div>

      <div style={styles.totalRow}>
        <span style={styles.totalLabel}>Total:</span>
        <span style={styles.totalMonto}>Bs {carrito.total.toFixed(2)}</span>
      </div>

      <button onClick={handleEnviar} disabled={enviando} style={styles.submitBtn}>
        {enviando ? 'Procesando...' : 'REALIZAR PEDIDO'}
      </button>

      {colision && (
        <div style={styles.alertaStock}>
          <div style={styles.alertaTitulo}>🚫 No se pudo procesar tu pedido</div>
          <ul style={styles.alertaLista}>
            {colision.map((p) => (
              <li key={p.codigo}>
                <b>{p.producto}</b>: pediste <b>{p.pedido} ud.</b> pero el stock bajó a{' '}
                <b>{p.disponible} ud.</b>
              </li>
            ))}
          </ul>
          <div style={styles.alertaSugerencia}>
            💡 Ajusta la cantidad de los productos para poder enviarlos.
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB HISTORIAL
// ══════════════════════════════════════════════════════════════════════════════
function TabHistorial() {
  const [historial, setHistorial] = useState(null)

  useEffect(() => {
    pedidosApi
      .historial()
      .then(({ data }) => setHistorial(data))
      .catch(() => setHistorial([]))
  }, [])

  if (historial === null) return <PantallaCarga compacta />

  if (historial.length === 0) {
    return (
      <div>
        <h3 style={styles.sectionTitle}>📋 Mis Pedidos</h3>
        <p style={styles.emptyMsg}>No se registran transacciones previas en su cuenta.</p>
      </div>
    )
  }

  const totalProductos = historial.length
  const totalBs = historial.reduce((acc, h) => acc + h.subtotal, 0)

  // Agrupar por fecha (solo la parte de fecha, sin hora)
  const grupos = {}
  historial.forEach((h) => {
    const fecha = h.fecha ? h.fecha.split('T')[0] : 'Sin fecha'
    if (!grupos[fecha]) grupos[fecha] = []
    grupos[fecha].push(h)
  })

  return (
    <div>
      <h3 style={styles.sectionTitle}>📋 Mis Pedidos</h3>

      <div style={styles.statsBar}>
        <Stat label="Total pedidos" value={`${totalProductos} productos`} />
        <Stat label="Monto total" value={`Bs ${totalBs.toFixed(2)}`} color="#E63946" />
        <Stat label="Días con pedidos" value={Object.keys(grupos).length} />
      </div>

      {Object.entries(grupos).map(([fecha, items]) => {
        const totalDia = items.reduce((acc, i) => acc + i.subtotal, 0)
        return (
          <details key={fecha} style={styles.expander} open>
            <summary style={styles.expanderSummary}>
              📅 {fecha} · {items.length} producto{items.length !== 1 ? 's' : ''} · Bs{' '}
              {totalDia.toFixed(2)}
            </summary>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Cant.</th>
                  <th style={styles.th}>P. Unit.</th>
                  <th style={styles.th}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{item.nombre_producto}</td>
                    <td style={styles.td}>{item.cantidad} ud.</td>
                    <td style={styles.td}>Bs {item.precio_unitario.toFixed(2)}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#E63946' }}>
                      Bs {item.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )
      })}
    </div>
  )
}

function Stat({ label, value, color = '#1A1A2E' }) {
  return (
    <div>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
    </div>
  )
}

function TabButton({ activo, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...styles.tabBtn, ...(activo ? styles.tabBtnActivo : {}) }}>
      {children}
    </button>
  )
}

function PantallaCarga({ compacta = false }) {
  return (
    <div style={compacta ? styles.loadingCompacta : styles.loadingFull}>
      <div style={styles.spinner} />
    </div>
  )
}

function OutletCerrado({ regional, onLogout }) {
  return (
    <div style={styles.page}>
      <div style={styles.cerradoCard}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <h2 style={styles.cerradoTitle}>Outlet Cerrado</h2>
        <p style={styles.cerradoText}>
          El período de pedidos para <strong>{regional}</strong> ha finalizado.
        </p>
        <p style={styles.cerradoSub}>Consulta con tu supervisor para más información.</p>
        <button onClick={onLogout} style={styles.logoutBtnCerrado}>
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F5F4F0',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    maxWidth: 900,
    margin: '0 auto',
    padding: '1rem 1.5rem',
  },
  header: {
    background: 'white',
    borderRadius: 16,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.25rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    borderTop: '4px solid #E63946',
  },
  headerIcon: { fontSize: '2.2rem' },
  headerTitle: { color: '#1A1A2E', fontSize: '1.4rem', margin: 0 },
  headerSub: { color: '#888', margin: '0.2rem 0 0', fontSize: '0.85rem' },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #e6e6e6',
    marginBottom: '1.25rem',
    overflowX: 'auto',
  },
  tabBtn: {
    padding: '0.6rem 1.1rem',
    border: 'none',
    background: 'transparent',
    color: '#888',
    fontSize: '0.92rem',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '3px solid transparent',
    whiteSpace: 'nowrap',
  },
  tabBtnActivo: { color: '#1A1A2E', fontWeight: 700, borderBottomColor: '#E63946' },
  main: { paddingBottom: '2rem' },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#888',
    margin: '0 0 1rem',
    paddingBottom: '0.4rem',
    borderBottom: '2px solid #EBEBEB',
  },
  searchInput: {
    width: '100%',
    padding: '0.65rem 0.85rem',
    border: '1px solid #DDD',
    borderRadius: 8,
    fontSize: '0.9rem',
    marginBottom: '0.75rem',
    boxSizing: 'border-box',
  },
  caption: { fontSize: '0.82rem', color: '#999', marginBottom: '0.75rem' },
  emptyMsg: { color: '#888', fontSize: '0.9rem' },
  linkBtn: { background: 'none', border: 'none', color: '#E63946', cursor: 'pointer', fontWeight: 600 },
  searchWrapper: {
    position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '0.6rem',
  },
  searchIcon: { position: 'absolute', left: '0.75rem', fontSize: '0.9rem', pointerEvents: 'none' },
  searchInputIcon: {
    width: '100%', padding: '0.65rem 2.5rem 0.65rem 2.25rem',
    border: '1px solid #DDD', borderRadius: 10, fontSize: '0.9rem', boxSizing: 'border-box',
    outline: 'none',
  },
  clearSearch: {
    position: 'absolute', right: '0.75rem', background: 'none', border: 'none',
    cursor: 'pointer', color: '#AAA', fontSize: '0.9rem', padding: '0.25rem',
  },
  captionHint: { color: '#E63946', fontWeight: 600 },
  hayMasBanner: {
    background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
    padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#92400E',
    marginTop: '1rem', textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.85rem',
  },
  cardProducto: {
    background: 'white',
    borderRadius: 14,
    border: '1px solid #EBEBEB',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  cardImgWrapper: {
    position: 'relative', width: '100%', height: 160,
    background: '#F5F5F5', flexShrink: 0, overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardImgPlaceholder: {
    width: '100%', height: '100%', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
    background: '#F8F8F8',
  },
  sinImagenLabel: { fontSize: '0.7rem', color: '#AAA', fontWeight: 500 },
  stockOverlay: {
    position: 'absolute', bottom: '0.5rem', left: '0.5rem',
  },
  cardInfo: { padding: '0.75rem 0.85rem 0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 },
  sku: { fontSize: '0.68rem', color: '#AAA', fontFamily: 'monospace' },
  prodNombre: { margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#1A1A2E', lineHeight: 1.3 },
  lineaTag: { fontSize: '0.7rem', color: '#6366F1', background: '#EEF2FF', padding: '1px 7px', borderRadius: 20, alignSelf: 'flex-start' },
  prodPrecio: { fontSize: '1.05rem', fontWeight: 700, color: '#E63946', marginTop: '0.25rem' },
  prodActions: { display: 'flex', gap: '0.5rem', padding: '0 0.85rem 0.85rem' },
  qtyInput: {
    width: 52, padding: '0.45rem',
    border: '1px solid #DDD', borderRadius: 7, textAlign: 'center', fontSize: '0.88rem',
  },
  addBtn: {
    flex: 1, padding: '0.45rem',
    background: '#1A1A2E', color: 'white',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
  },
  disabledBtn: {
    margin: '0 0.85rem 0.85rem', padding: '0.45rem',
    background: '#EEE', color: '#999',
    border: 'none', borderRadius: 7, cursor: 'not-allowed', fontSize: '0.82rem',
  },
  badge: { fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  badgeOk:   { background: '#D1FAE5', color: '#065F46' },
  badgeWarn: { background: '#FEF9C3', color: '#854D0E' },
  badgeOut:  { background: '#FEE2E2', color: '#991B1B' },
  cartContainer: { background: 'white', borderRadius: 12, padding: '0.5rem 1rem', marginBottom: '1rem' },
  cartItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid #F0F0F0',
  },
  cartItemInfo: { flex: 1 },
  cartItemNombre: { fontSize: '0.9rem', fontWeight: 600, color: '#1A1A2E' },
  cartItemTotal: { fontSize: '0.85rem', color: '#E63946', fontWeight: 700, marginTop: 2 },
  qtyInputCart: { width: 56, padding: '0.4rem', border: '1px solid #DDD', borderRadius: 6, textAlign: 'center' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1rem 0.25rem',
    borderTop: '1px solid #EBEBEB',
  },
  totalLabel: { fontSize: '1.2rem', fontWeight: 700, color: '#1A1A2E' },
  totalMonto: { fontSize: '1.4rem', fontWeight: 700, color: '#1A1A2E' },
  submitBtn: {
    width: '100%',
    padding: '0.85rem',
    background: '#E63946',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  alertaStock: {
    background: '#FFF5F5',
    borderLeft: '4px solid #FF3B30',
    borderRadius: 6,
    padding: '1.1rem',
    marginTop: '1rem',
  },
  alertaTitulo: { color: '#E63946', fontWeight: 600, marginBottom: '0.5rem' },
  alertaLista: { fontSize: '0.88rem', color: '#4A4A4A', paddingLeft: '1.1rem' },
  alertaSugerencia: { fontSize: '0.82rem', color: '#666', borderTop: '1px dashed #F3C6C9', paddingTop: '0.5rem', marginTop: '0.5rem' },
  statsBar: {
    background: '#F8F9FF',
    borderRadius: 10,
    padding: '0.8rem 1.1rem',
    marginBottom: '1rem',
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
  },
  statLabel: { fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 },
  statValue: { fontSize: '1.3rem', fontWeight: 700, marginTop: 2 },
  expander: { background: 'white', borderRadius: 10, marginBottom: '0.6rem', padding: '0.25rem 1rem' },
  expanderSummary: { padding: '0.75rem 0', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: '#1A1A2E' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.75rem' },
  th: { textAlign: 'left', padding: '0.4rem 0', borderBottom: '2px solid #E8E8E8', fontSize: '0.78rem', color: '#888' },
  td: { padding: '0.45rem 0', borderBottom: '1px solid #F4F4F4' },
  footer: { textAlign: 'center', paddingBottom: '2rem' },
  logoutBtn: {
    padding: '0.7rem 1.5rem',
    background: 'white',
    border: '1px solid #DDD',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: '#666',
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1A1A2E',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: 30,
    fontSize: '0.88rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  },
  loadingFull: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  loadingCompacta: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #E0E0E0',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  cerradoCard: {
    background: 'linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)',
    borderRadius: 20,
    padding: '3rem 2.5rem',
    margin: '2rem auto',
    maxWidth: 460,
    textAlign: 'center',
    color: 'white',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  cerradoTitle: { margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 },
  cerradoText: { opacity: 0.85, fontSize: '0.95rem', margin: '0 0 0.5rem' },
  cerradoSub: { opacity: 0.6, fontSize: '0.82rem', margin: '0 0 1.5rem' },
  logoutBtnCerrado: {
    padding: '0.65rem 1.5rem',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'white',
    borderRadius: 10,
    cursor: 'pointer',
  },
}