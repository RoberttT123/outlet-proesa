import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Al montar la app, intenta restaurar sesión desde la cookie existente
  const verificarSesion = useCallback(async () => {
    try {
      const { data } = await authApi.me()
      setUsuario(data)
    } catch {
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    verificarSesion()

    // Si cualquier request de la API devuelve 401, cerramos sesión local
    const handleExpirada = () => setUsuario(null)
    window.addEventListener('sesion-expirada', handleExpirada)
    return () => window.removeEventListener('sesion-expirada', handleExpirada)
  }, [verificarSesion])

  const login = async (codigo, carnet) => {
    const { data } = await authApi.login(codigo, carnet)
    setUsuario(data)
    return data
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUsuario(null)
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
