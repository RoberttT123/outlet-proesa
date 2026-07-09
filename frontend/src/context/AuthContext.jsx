import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, guardarToken, obtenerToken, eliminarToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Al montar: si hay token en localStorage, verificar que sigue válido
  const verificarSesion = useCallback(async () => {
    const token = obtenerToken()
    if (!token) {
      setCargando(false)
      return
    }
    try {
      const { data } = await authApi.me()
      setUsuario(data)
    } catch {
      // Token expirado o inválido — limpiar
      eliminarToken()
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    verificarSesion()

    // Si el interceptor detecta 401, cerrar sesión local
    const handleExpirada = () => {
      eliminarToken()
      setUsuario(null)
    }
    window.addEventListener('sesion-expirada', handleExpirada)
    return () => window.removeEventListener('sesion-expirada', handleExpirada)
  }, [verificarSesion])

  const login = async (codigo, carnet) => {
    const { data } = await authApi.login(codigo, carnet)
    // Guardar token en localStorage — funciona en WhatsApp y cualquier browser
    guardarToken(data.access_token)
    setUsuario(data.usuario)
    return data.usuario
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      eliminarToken()
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