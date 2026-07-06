import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CarritoProvider } from './context/CarritoContext'
import { RutaProtegida } from './components/RutaProtegida'

import Login          from './pages/Login'
import Pedido         from './pages/Pedido'
import AdminInicio    from './pages/AdminInicio'
import AdminDashboard  from './pages/AdminDashboard'
import AdminProductos  from './pages/AdminProductos'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CarritoProvider>
          <Routes>
            {/* Pública */}
            <Route path="/login" element={<Login />} />

            {/* Empleado */}
            <Route
              path="/pedido"
              element={
                <RutaProtegida>
                  <Pedido />
                </RutaProtegida>
              }
            />

            {/* Admin */}
            <Route
              path="/admin/inicio"
              element={
                <RutaProtegida requiereAdmin>
                  <AdminInicio />
                </RutaProtegida>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RutaProtegida requiereAdmin>
                  <AdminDashboard />
                </RutaProtegida>
              }
            />
            <Route
              path="/admin/productos"
              element={
                <RutaProtegida requiereAdmin>
                  <AdminProductos />
                </RutaProtegida>
              }
            />

            {/* Raíz: redirige al login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </CarritoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}