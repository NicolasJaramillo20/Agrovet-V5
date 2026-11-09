import { Router } from 'express'
import Producto from '../models/Product.js'
import { adminOnly, protect } from '../middleware/auth.js'
import { removeMongoProduct, syncMongoProduct } from '../config/relational-sync.js'

const router = Router()
router.get('/', (req, res, next) => {
  if (req.query.all !== 'true') return next()
  return protect(req, res, () => adminOnly(req, res, next))
}, async (req, res, next) => {
  try {
    const filter = req.query.all === 'true' ? {} : { activo: true }
    res.json(await Producto.find(filter).sort({ fecha_registro: -1 }))
  } catch (error) { next(error) }
})
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Producto.create(req.body)
    await syncMongoProduct(product)
    return res.status(201).json(product)
  } catch (error) { next(error) }
})
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' })
    await syncMongoProduct(product)
    return res.json(product)
  } catch (error) { next(error) }
})
router.patch('/:id/stock', protect, adminOnly, async (req, res, next) => {
  try {
    const { cantidad } = req.body
    if (!Number.isInteger(cantidad) || cantidad === 0) return res.status(400).json({ message: 'La cantidad debe ser un entero distinto de cero.' })
    const product = await Producto.findOneAndUpdate(
      { _id: req.params.id, ...(cantidad < 0 ? { stock: { $gte: Math.abs(cantidad) } } : {}) },
      { $inc: { stock: cantidad } }, { new: true, runValidators: true },
    )
    if (!product) return res.status(409).json({ message: 'Producto no encontrado o stock insuficiente.' })
    await syncMongoProduct(product)
    return res.json(product)
  } catch (error) { next(error) }
})
router.patch('/:id/active', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Producto.findByIdAndUpdate(req.params.id, { activo: Boolean(req.body.activo) }, { new: true })
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' })
    await syncMongoProduct(product)
    return res.json(product)
  } catch (error) { next(error) }
})
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Producto.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' })
    await removeMongoProduct(product._id)
    return res.json({ message: 'Producto eliminado.' })
  } catch (error) { next(error) }
})
export default router
