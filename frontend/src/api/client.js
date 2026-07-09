import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const TOKEN_KEY = 'outlet_proesa_token'

// Helpers para localStorage
export const guardarToken  = (token) => localStorage.setItem(TOKEN_KEY, token)
export const obtenerToken  = ()      => localStorage.getItem(TOKEN_KEY)
export const eliminarToken = ()      => localStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de request: agrega el JWT en cada petición automáticamente
api.interceptors.request.use((config) => {
  const token = obtenerToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Interceptor de response: si 401, sesión expirada
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      eliminarToken()
      window.dispatchEvent(new CustomEvent('sesion-expirada'))
    }
    return Promise.reject(error)
  }
)

export default api

// ==============================================================================
// AUTH
// ==============================================================================
export const authApi = {
  login:  (codigo, carnet) => api.post('/auth/login', { codigo, carnet }),
  logout: ()               => api.post('/auth/logout'),
  me:     ()               => api.get('/auth/me'),
}

// ==============================================================================
// CATÁLOGO (empleado)
// ==============================================================================
export const catalogoApi = {
  listarProductos: () => api.get('/catalogo/productos'),
  estadoOutlet:    () => api.get('/catalogo/estado-outlet'),
}

// ==============================================================================
// PEDIDOS (empleado)
// ==============================================================================
export const pedidosApi = {
  crear:    (items) => api.post('/pedidos', { items }),
  historial: ()     => api.get('/pedidos/historial'),
}

// ==============================================================================
// ADMIN
// ==============================================================================
export const adminApi = {
  listarRegionales:    ()              => api.get('/admin/regionales'),
  actualizarRegional:  (nombre, activo) =>
    api.patch(`/admin/regionales/${encodeURIComponent(nombre)}`, { activo }),
  activarTodas:        ()              => api.post('/admin/regionales/activar-todas'),
  cerrarTodas:         ()              => api.post('/admin/regionales/cerrar-todas'),
  metricas:            ()              => api.get('/admin/dashboard/metricas'),
  historialCompleto:   ()              => api.get('/admin/dashboard/historial'),
  catalogoCompleto:    ()              => api.get('/admin/catalogo'),
  subirExcel:          (formData)      =>
    api.post('/admin/inventario/subir-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ==============================================================================
// PRODUCTOS PERMANENTES (admin)
// ==============================================================================
export const productosApi = {
  listar:           ()         => api.get('/admin/productos'),
  crear:            (data)     => api.post('/admin/productos', data),
  actualizar:       (id, data) => api.patch(`/admin/productos/${id}`, data),
  actualizarImagen: (id, data) => api.patch(`/admin/productos/${id}/imagen`, data),
  eliminarImagen:   (id)       => api.delete(`/admin/productos/${id}/imagen`),
  eliminar:         (id)       => api.delete(`/admin/productos/${id}`),
  cloudinaryConfig: ()         => api.get('/admin/productos/cloudinary-config'),
  listarLineas:     ()         => api.get('/admin/productos/lineas'),
}