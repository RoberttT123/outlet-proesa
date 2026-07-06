import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminLayout({ children, titulo, subtitulo }) {
  const { usuario, logout } = useAuth()

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogo}>
          <div style={styles.logoIcon}>📦</div>
          <div>
            <div style={styles.logoTitle}>Outlet PROESA</div>
            <div style={styles.logoSub}>SISTEMA DE PEDIDOS</div>
          </div>
        </div>

        <div style={styles.adminInfo}>
          <div style={styles.adminNombre}>👤 {usuario?.nombre}</div>
          <div style={styles.adminCod}>🔖 {usuario?.cod_emp}</div>
        </div>

        <div style={styles.navLabel}>NAVEGACIÓN</div>
        <NavItem to="/admin/inicio"     icon="📦" label="Panel de Control" />
        <NavItem to="/admin/dashboard"  icon="📊" label="Dashboard" />
        <NavItem to="/admin/productos"  icon="🏷️"  label="Productos" />

        <div style={styles.divider} />

        <button onClick={logout} style={styles.logoutBtn}>
          🚪 Cerrar Sesión
        </button>

        <div style={styles.versionTag}>
          Outlet PROESA · v2.0<br />Trade Marketing
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.pageHeader}>
          <h1 style={styles.heroTitle}>{titulo}</h1>
          {subtitulo && <p style={styles.heroSub}>{subtitulo}</p>}
        </header>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.navItem,
        ...(isActive ? styles.navItemActive : {}),
      })}
    >
      {icon} {label}
    </NavLink>
  )
}

const styles = {
  root: { display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, sans-serif" },
  sidebar: {
    width: 240, background: '#0F0F1E', display: 'flex', flexDirection: 'column',
    padding: '0 0 1rem', position: 'fixed', top: 0, left: 0, bottom: 0,
    overflowY: 'auto', zIndex: 100,
  },
  sidebarLogo: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '1.25rem 1.1rem 1rem', borderBottom: '1px solid #1A1A32', marginBottom: '0.5rem',
  },
  logoIcon: { fontSize: '2rem' },
  logoTitle: { color: '#FFFFFF', fontWeight: 700, fontSize: '0.95rem' },
  logoSub: { color: '#3A4A6A', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginTop: 2 },
  adminInfo: { padding: '0.5rem 1.1rem 0.75rem' },
  adminNombre: { color: '#E0E6F0', fontSize: '0.82rem', fontWeight: 600 },
  adminCod: { color: '#556080', fontSize: '0.72rem', marginTop: 2 },
  navLabel: { fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, color: '#2A3560', padding: '0.75rem 1.1rem 0.35rem' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.55rem 0.9rem', margin: '2px 12px', borderRadius: 9,
    textDecoration: 'none', color: '#9AA3BA', fontSize: '0.875rem',
    fontWeight: 500, borderLeft: '3px solid transparent',
  },
  navItemActive: { background: 'rgba(230,57,70,0.12)', borderLeftColor: '#E63946', color: '#FF7A84', fontWeight: 700 },
  divider: { borderTop: '1px solid #1A1A32', margin: '0.75rem 0' },
  logoutBtn: {
    margin: '0 12px', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)',
    border: '1px solid #252540', color: '#8899BB', borderRadius: 8,
    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, textAlign: 'left',
  },
  versionTag: { margin: '1.5rem 1.1rem 0', color: '#1E2440', fontSize: '0.62rem', lineHeight: 1.7, borderTop: '1px solid #141425', paddingTop: '0.75rem' },
  main: { marginLeft: 240, flex: 1, background: '#F5F4F0', minHeight: '100vh' },
  pageHeader: { background: 'linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)', padding: '1.5rem 2rem' },
  heroTitle: { color: '#FFFFFF', fontSize: '1.6rem', fontWeight: 700, margin: 0 },
  heroSub: { color: '#A8B2C8', fontSize: '0.88rem', margin: '0.25rem 0 0' },
  content: { padding: '1.5rem 2rem' },
}