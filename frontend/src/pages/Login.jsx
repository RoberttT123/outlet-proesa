import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [codigo, setCodigo] = useState('')
  const [carnet, setCarnet] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mostrarCarnet, setMostrarCarnet] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!codigo.trim()) {
      setError('Ingresa tu código de empleado.')
      return
    }
    if (!carnet.trim()) {
      setError('Ingresa tu número de carnet.')
      return
    }

    setCargando(true)
    try {
      const data = await login(codigo.trim().toUpperCase(), carnet.trim())
      navigate(data.es_admin ? '/admin/inicio' : '/pedido', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || 'Error al iniciar sesión. Intenta nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.hero}>
          <img src="/logo_proesa.png" alt="Outlet PROESA" style={styles.heroLogo} />
          <h1 style={styles.heroTitle}>Outlet PROESA</h1>
          <p style={styles.heroSubtitle}>Sistema de Pedidos Internos</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <h2 style={styles.formTitle}>🔑 Acceso al Sistema</h2>

          <label style={styles.label}>Código de Empleado</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Ej: E0202026"
            style={styles.input}
            autoComplete="username"
          />

          <div style={{ position: 'relative' }}>
            <input
              type={mostrarCarnet ? 'text' : 'password'}
              value={carnet}
              onChange={(e) => setCarnet(e.target.value)}
              placeholder="Ingresa tu carnet"
              style={styles.input}
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() => setMostrarCarnet(!mostrarCarnet)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              {mostrarCarnet ? '🙈' : '👁️'}
            </button>
          </div>

          {error && <div style={styles.error}>⚠️ {error}</div>}

          <button type="submit" disabled={cargando} style={styles.button}>
            {cargando ? 'Verificando...' : '🚀 Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100svh',       // clave: dvh en vez de vh para mobile
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F5F4F0',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    padding: '1rem',
    boxSizing: 'border-box',
    overflow: 'hidden',        // evita cualquier scroll accidental
  },
  card: {
    width: '100%',
    maxWidth: 440,
  },
  hero: {
    background: 'linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)',
    borderRadius: 20,
    padding: '1.5rem 1.5rem 1.25rem',   // antes 2.5rem/2rem, ahora más compacto
    textAlign: 'center',
    color: 'white',
    marginBottom: '1rem',               // antes 1.5rem
    boxShadow: '0 10px 30px rgba(15,52,96,0.25)',
  },
  heroLogo: {
    width: 150,          // antes 80
    height: 150,
    objectFit: 'contain',
    marginBottom: '0.15rem',
  },
  heroTitle: { fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0 0.15rem' }, // antes 1.8rem
  heroSubtitle: { opacity: 0.75, fontSize: '0.85rem', margin: 0 },
  form: {
    background: 'white',
    borderRadius: 16,
    padding: '1.25rem 1.5rem',   // antes 1.75rem
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  formTitle: { fontSize: '1rem', fontWeight: 600, color: '#1A1A2E', margin: '0 0 1rem' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#444', marginBottom: '0.3rem' },
  input: {
    width: '100%',
    padding: '0.6rem 0.85rem',
    border: '1px solid #DDD',
    borderRadius: 8,
    fontSize: '0.95rem',
    marginBottom: '0.85rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  error: {
    background: '#FEE2E2',
    color: '#991B1B',
    padding: '0.6rem 0.85rem',
    borderRadius: 8,
    fontSize: '0.85rem',
    marginBottom: '0.85rem',
  },
  button: {
    width: '100%',
    padding: '0.7rem',
    background: '#E63946',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}