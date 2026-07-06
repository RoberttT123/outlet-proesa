import { createContext, useContext, useState, useMemo } from 'react'

const CarritoContext = createContext(null)

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([])

  const agregarItem = (producto, cantidad) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.codigo_producto === producto.codigo)
      if (existente) {
        const nuevaCant = existente.cantidad + cantidad
        return prev.map((i) =>
          i.codigo_producto === producto.codigo
            ? { ...i, cantidad: nuevaCant, subtotal: nuevaCant * i.precio_unitario }
            : i
        )
      }
      return [
        ...prev,
        {
          codigo_producto: producto.codigo,
          producto: producto.nombre,
          cantidad,
          precio_unitario: producto.precio_unitario,
          subtotal: producto.precio_unitario * cantidad,
          linea: producto.linea || '',
          empresa: producto.empresa || '',
          stock_disponible: producto.stock,
        },
      ]
    })
  }

  const actualizarCantidad = (codigo, nuevaCantidad) => {
    setItems((prev) =>
      prev.map((i) =>
        i.codigo_producto === codigo
          ? { ...i, cantidad: nuevaCantidad, subtotal: nuevaCantidad * i.precio_unitario }
          : i
      )
    )
  }

  const eliminarItem = (codigo) => {
    setItems((prev) => prev.filter((i) => i.codigo_producto !== codigo))
  }

  const limpiarCarrito = () => setItems([])

  const total = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items])
  const totalUnidades = useMemo(() => items.reduce((acc, i) => acc + i.cantidad, 0), [items])

  return (
    <CarritoContext.Provider
      value={{ items, agregarItem, actualizarCantidad, eliminarItem, limpiarCarrito, total, totalUnidades }}
    >
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider')
  return ctx
}
