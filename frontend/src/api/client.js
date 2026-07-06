import axios from 'axios'

// withCredentials: true es CRÍTICO — sin esto el navegador no envía
// la cookie de sesión HttpOnly en las peticiones, y todo el backend
// respondería 401 aunque el login haya sido exitoso.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor: si cualquier request devuelve 401, la sesión expiró o no existe.
// Disparamos un evento global para que el AuthContext reaccione y redirija al login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
  login: (codigo, carnet) => api.post('/auth/login', { codigo, carnet }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

// ==============================================================================
// CATÁLOGO (empleado)
// ==============================================================================
export const catalogoApi = {
  listarProductos: () => api.get('/catalogo/productos'),
  estadoOutlet: () => api.get('/catalogo/estado-outlet'),
}

// ==============================================================================
// PEDIDOS (empleado)
// ==============================================================================
export const pedidosApi = {
  crear: (items) => api.post('/pedidos', { items }),
  historial: () => api.get('/pedidos/historial'),
}

// ==============================================================================
// ADMIN
// ==============================================================================
export const adminApi = {
  listarRegionales: () => api.get('/admin/regionales'),
  actualizarRegional: (nombre, activo) =>
    api.patch(`/admin/regionales/${encodeURIComponent(nombre)}`, { activo }),
  activarTodas: () => api.post('/admin/regionales/activar-todas'),
  cerrarTodas: () => api.post('/admin/regionales/cerrar-todas'),
  metricas: () => api.get('/admin/dashboard/metricas'),
  historialCompleto: () => api.get('/admin/dashboard/historial'),
  catalogoCompleto: () => api.get('/admin/catalogo'),
  subirExcel: (formData) =>
    api.post('/admin/inventario/subir-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ==============================================================================
// PRODUCTOS PERMANENTES (admin)
// ==============================================================================
export const productosApi = {
  listar:           ()              => api.get('/admin/productos'),
  crear:            (data)          => api.post('/admin/productos', data),
  actualizar:       (id, data)      => api.patch(`/admin/productos/${id}`, data),
  actualizarImagen: (id, data)      => api.patch(`/admin/productos/${id}/imagen`, data),
  eliminarImagen:   (id)            => api.delete(`/admin/productos/${id}/imagen`),
  eliminar:         (id)            => api.delete(`/admin/productos/${id}`),
  cloudinaryConfig: ()              => api.get('/admin/productos/cloudinary-config'),
}