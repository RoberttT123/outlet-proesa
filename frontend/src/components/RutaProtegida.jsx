import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RutaProtegida({ children, requiereAdmin = false }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (requiereAdmin && !usuario.es_admin) {
    return <Navigate to="/pedido" replace />
  }

  if (!requiereAdmin && usuario.es_admin) {
    // Un admin que intenta entrar a la vista de empleado va a su panel
    return <Navigate to="/admin/inicio" replace />
  }

  return children
}

const styles = {
  loadingScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#F5F4F0',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #E0E0E0',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
