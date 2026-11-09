import { Router } from 'express'
import { getPostgresPool, getPostgresStatus } from '../config/postgres.js'
import { getMysqlPool, getMysqlStatus, listInvoices } from '../config/mysql.js'
import { adminOnly, protect } from '../middleware/auth.js'

const router = Router()
router.use(protect, adminOnly)

const text = (value) => typeof value === 'string' ? value.trim() : null
const validId = (value) => /^\d+$/.test(value)

router.get('/customers', async (_req, res, next) => {
  try {
    const { rows } = await getPostgresPool().query('SELECT * FROM clientes ORDER BY id DESC')
    return res.json(rows)
  } catch (error) { return next(error) }
})

router.post('/customers', async (req, res, next) => {
  try {
    const nombre = text(req.body.nombre)
    const correo = text(req.body.correo)?.toLowerCase()
    if (!nombre || !correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ message: 'Nombre y correo válido son obligatorios.' })
    }
    const { rows } = await getPostgresPool().query(
      'INSERT INTO clientes (nombre, correo, telefono, direccion) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, correo, text(req.body.telefono) || '', text(req.body.direccion) || ''],
    )
    return res.status(201).json(rows[0])
  } catch (error) { return next(error) }
})

router.put('/customers/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Identificador de cliente no válido.' })
    const pool = getPostgresPool()
    const existing = await pool.query('SELECT mongo_id FROM clientes WHERE id = $1', [req.params.id])
    if (!existing.rows[0]) return res.status(404).json({ message: 'Cliente no encontrado.' })
    if (existing.rows[0].mongo_id) {
      return res.status(409).json({ message: 'Este cliente se sincroniza desde MongoDB; edítalo desde la gestión de usuarios.' })
    }
    const nombre = text(req.body.nombre)
    const correo = text(req.body.correo)?.toLowerCase()
    if (!nombre || !correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ message: 'Nombre y correo válido son obligatorios.' })
    }
    const { rows } = await pool.query(
      `UPDATE clientes SET nombre = $1, correo = $2, telefono = $3, direccion = $4
       WHERE id = $5 RETURNING *`,
      [nombre, correo, text(req.body.telefono) || '', text(req.body.direccion) || '', req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: 'Cliente no encontrado.' })
    return res.json(rows[0])
  } catch (error) { return next(error) }
})

router.delete('/customers/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Identificador de cliente no válido.' })
    const pool = getPostgresPool()
    const existing = await pool.query('SELECT mongo_id FROM clientes WHERE id = $1', [req.params.id])
    if (!existing.rows[0]) return res.status(404).json({ message: 'Cliente no encontrado.' })
    if (existing.rows[0].mongo_id) {
      return res.status(409).json({ message: 'Este cliente se sincroniza desde MongoDB; elimínalo desde la gestión de usuarios.' })
    }
    const result = await pool.query('DELETE FROM clientes WHERE id = $1', [req.params.id])
    if (!result.rowCount) return res.status(404).json({ message: 'Cliente no encontrado.' })
    return res.json({ message: 'Cliente eliminado.' })
  } catch (error) { return next(error) }
})

router.get('/products', async (_req, res, next) => {
  try {
    const { rows } = await getPostgresPool().query('SELECT * FROM productos ORDER BY id DESC')
    return res.json(rows)
  } catch (error) { return next(error) }
})

router.post('/products', async (req, res, next) => {
  try {
    const nombre = text(req.body.nombre_producto)
    const precio = Number(req.body.precio)
    const stock = Number(req.body.stock)
    if (!nombre || !Number.isFinite(precio) || precio < 0 || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ message: 'Nombre, precio válido y stock entero no negativo son obligatorios.' })
    }
    const { rows } = await getPostgresPool().query(
      `INSERT INTO productos (nombre_producto, descripcion, precio, stock, imagen, activo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, text(req.body.descripcion) || '', precio, stock, text(req.body.imagen) || '', req.body.activo !== false && req.body.activo !== 'false'],
    )
    return res.status(201).json(rows[0])
  } catch (error) { return next(error) }
})

router.put('/products/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Identificador de producto no válido.' })
    const pool = getPostgresPool()
    const existing = await pool.query('SELECT mongo_id FROM productos WHERE id = $1', [req.params.id])
    if (!existing.rows[0]) return res.status(404).json({ message: 'Producto no encontrado.' })
    if (existing.rows[0].mongo_id) {
      return res.status(409).json({ message: 'Este producto se sincroniza desde MongoDB; edítalo desde el catálogo de productos.' })
    }
    const nombre = text(req.body.nombre_producto)
    const precio = Number(req.body.precio)
    const stock = Number(req.body.stock)
    if (!nombre || !Number.isFinite(precio) || precio < 0 || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ message: 'Nombre, precio válido y stock entero no negativo son obligatorios.' })
    }
    const { rows } = await pool.query(
      `UPDATE productos SET nombre_producto = $1, descripcion = $2, precio = $3,
       stock = $4, imagen = $5, activo = $6 WHERE id = $7 RETURNING *`,
      [nombre, text(req.body.descripcion) || '', precio, stock, text(req.body.imagen) || '', req.body.activo !== false && req.body.activo !== 'false', req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: 'Producto no encontrado.' })
    return res.json(rows[0])
  } catch (error) { return next(error) }
})

router.delete('/products/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Identificador de producto no válido.' })
    const pool = getPostgresPool()
    const existing = await pool.query('SELECT mongo_id FROM productos WHERE id = $1', [req.params.id])
    if (!existing.rows[0]) return res.status(404).json({ message: 'Producto no encontrado.' })
    if (existing.rows[0].mongo_id) {
      return res.status(409).json({ message: 'Este producto se sincroniza desde MongoDB; elimínalo desde el catálogo de productos.' })
    }
    const result = await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id])
    if (!result.rowCount) return res.status(404).json({ message: 'Producto no encontrado.' })
    return res.json({ message: 'Producto eliminado.' })
  } catch (error) { return next(error) }
})

router.get('/invoices', async (_req, res, next) => {
  try {
    return res.json(await listInvoices())
  } catch (error) { return next(error) }
})

router.get('/status', (_req, res) => {
  return res.json({ postgresql: getPostgresStatus(), mysql: getMysqlStatus() })
})

export default router
