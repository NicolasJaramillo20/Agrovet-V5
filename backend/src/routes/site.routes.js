import { Router } from 'express'
import { getPostgresPool } from '../config/postgres.js'
import { protect } from '../middleware/auth.js'

const router = Router()
router.use(protect)

const text = (value) => typeof value === 'string' ? value.trim() : null
const coordinate = (value, min, max) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}
const siteFields = (body) => {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const nombre = text(source.nombre)
  const descripcion = text(source.descripcion) || ''
  const categoria = text(source.categoria)
  const direccion = text(source.direccion) || ''
  const latitud = coordinate(source.latitud, -90, 90)
  const longitud = coordinate(source.longitud, -180, 180)

  if (!nombre || nombre.length > 120) {
    return { error: 'El nombre del sitio es obligatorio y no debe superar 120 caracteres.' }
  }
  if (descripcion.length > 1000) {
    return { error: 'La descripción no debe superar 1000 caracteres.' }
  }
  if (!categoria || categoria.length > 80) {
    return { error: 'La categoría es obligatoria y no debe superar 80 caracteres.' }
  }
  if (direccion.length > 240) {
    return { error: 'La dirección no debe superar 240 caracteres.' }
  }
  if (latitud === null || longitud === null) {
    return { error: 'Selecciona en el mapa o ingresa coordenadas válidas (latitud -90 a 90, longitud -180 a 180).' }
  }

  return { values: { nombre, descripcion, categoria, direccion, latitud, longitud } }
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await getPostgresPool().query(
      `SELECT id, nombre, descripcion, categoria, direccion, latitud, longitud, fecha_registro
       FROM sitios_interes WHERE id_usuario = $1 ORDER BY fecha_registro DESC, id DESC`,
      [req.user._id.toString()],
    )
    return res.json(rows)
  } catch (error) {
    return next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const result = siteFields(req.body)
    if (result.error) return res.status(400).json({ message: result.error })
    const { nombre, descripcion, categoria, direccion, latitud, longitud } = result.values
    const { rows } = await getPostgresPool().query(
      `INSERT INTO sitios_interes
        (id_usuario, nombre, descripcion, categoria, direccion, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, descripcion, categoria, direccion, latitud, longitud, fecha_registro`,
      [req.user._id.toString(), nombre, descripcion, categoria, direccion, latitud, longitud],
    )
    return res.status(201).json(rows[0])
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Identificador de sitio no válido.' })
    const result = siteFields(req.body)
    if (result.error) return res.status(400).json({ message: result.error })
    const { nombre, descripcion, categoria, direccion, latitud, longitud } = result.values
    const { rows } = await getPostgresPool().query(
      `UPDATE sitios_interes
       SET nombre = $1, descripcion = $2, categoria = $3, direccion = $4, latitud = $5, longitud = $6
       WHERE id = $7 AND id_usuario = $8
       RETURNING id, nombre, descripcion, categoria, direccion, latitud, longitud, fecha_registro`,
      [nombre, descripcion, categoria, direccion, latitud, longitud, req.params.id, req.user._id.toString()],
    )
    if (!rows[0]) return res.status(404).json({ message: 'Sitio de interés no encontrado.' })
    return res.json(rows[0])
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Identificador de sitio no válido.' })
    const result = await getPostgresPool().query(
      'DELETE FROM sitios_interes WHERE id = $1 AND id_usuario = $2',
      [req.params.id, req.user._id.toString()],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Sitio de interés no encontrado.' })
    return res.json({ message: 'Sitio de interés eliminado.' })
  } catch (error) {
    return next(error)
  }
})

export default router
