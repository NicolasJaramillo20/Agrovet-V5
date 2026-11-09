import { Router } from 'express'
import mongoose from 'mongoose'
import Pedido from '../models/Order.js'
import Producto from '../models/Product.js'
import { protect } from '../middleware/auth.js'
import { createInvoice, getMysqlStatus } from '../config/mysql.js'
import { syncMongoProduct } from '../config/relational-sync.js'

const router = Router()
router.post('/', protect, async (req, res, next) => {
  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'El carrito está vacío.' })
  const quantities = new Map()
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.id_producto) || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
      return res.status(400).json({ message: 'El carrito contiene productos o cantidades no válidas.' })
    }
    quantities.set(item.id_producto, (quantities.get(item.id_producto) || 0) + item.cantidad)
  }
  const reserved = []
  let order
  try {
    const mysqlStatus = getMysqlStatus()
    if (mysqlStatus.configured && !mysqlStatus.connected) {
      return res.status(503).json({ message: 'MySQL está configurado pero no está disponible; no se procesó la compra.' })
    }
    const products = await Producto.find({ _id: { $in: [...quantities.keys()] }, activo: true })
    if (products.length !== quantities.size) return res.status(409).json({ message: 'Uno o más productos ya no están disponibles.' })
    const byId = new Map(products.map((product) => [product._id.toString(), product]))
    for (const [id, cantidad] of quantities) {
      const product = await Producto.findOneAndUpdate(
        { _id: id, activo: true, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad } }, { new: true },
      )
      if (!product) throw Object.assign(new Error(`Stock insuficiente para ${byId.get(id).nombre_producto}.`), { status: 409 })
      reserved.push({ id, cantidad })
      await syncMongoProduct(product)
    }
    const orderItems = [...quantities].map(([id, cantidad]) => {
      const product = byId.get(id)
      return { id_producto: product._id, nombre_producto: product.nombre_producto, cantidad, precio: product.precio }
    })
    order = await Pedido.create({
      id_usuario: req.user._id,
      items: orderItems,
      total: orderItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
    })
    const invoice = mysqlStatus.connected
      ? await createInvoice({ userId: req.user._id, total: order.total, items: orderItems })
      : null
    return res.status(201).json({
      message: invoice ? 'Compra realizada y factura guardada en MySQL.' : 'Compra realizada; MySQL aún no está configurado para emitir la factura.',
      order,
      invoice,
    })
  } catch (error) {
    if (order) await Pedido.deleteOne({ _id: order._id })
    for (const reservation of reserved) {
      await Producto.updateOne({ _id: reservation.id }, { $inc: { stock: reservation.cantidad } })
      try {
        const product = await Producto.findById(reservation.id)
        if (product) await syncMongoProduct(product)
      } catch (syncError) {
        console.error(`No se pudo revertir la sincronización de stock del producto ${reservation.id}: ${syncError.message}`)
      }
    }
    if (error.status) return res.status(error.status).json({ message: error.message })
    return next(error)
  }
})
export default router
