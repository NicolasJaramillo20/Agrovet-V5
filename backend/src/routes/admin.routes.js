import { Router } from 'express'
import Usuario from '../models/User.js'
import Mascota from '../models/Pet.js'
import Cita from '../models/Appointment.js'
import Producto from '../models/Product.js'
import Pedido from '../models/Order.js'
import { adminOnly, protect } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'
import { removeMongoCustomer, syncMongoCustomer } from '../config/relational-sync.js'
import { getPostgresPool, getPostgresStatus } from '../config/postgres.js'

const router = Router()
router.use(protect, adminOnly)
const safeUser = (user) => ({
  _id: user._id,
  nombre: user.nombre,
  usuario: user.usuario,
  correo: user.correo,
  rol: user.rol,
  telefono: user.telefono,
  direccion: user.direccion,
  fecha_registro: user.fecha_registro,
})
router.post('/users', async (req, res, next) => {
  try {
    const { nombre, usuario, correo, password, telefono = '', direccion = '' } = req.body
    if (
      typeof nombre !== 'string' || !nombre.trim()
      || typeof usuario !== 'string' || usuario.trim().length < 3
      || typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
      || typeof password !== 'string' || password.length < 8
    ) return res.status(400).json({ message: 'Nombre, usuario, correo y contraseña (mínimo 8 caracteres) son obligatorios.' })
    const user = await Usuario.create({
      nombre, usuario, correo, telefono, direccion,
      password: await bcrypt.hash(password, 12),
    })
    await syncMongoCustomer(user)
    return res.status(201).json(safeUser(user))
  } catch (error) { return next(error) }
})
router.get('/stats', async (_req, res, next) => {
  try {
    const [usuarios, mascotas, citasPendientes, productos] = await Promise.all([
      Usuario.countDocuments(), Mascota.countDocuments(),
      Cita.countDocuments({ estado: 'pendiente' }), Producto.countDocuments(),
    ])
    return res.json({ usuarios, mascotas, citasPendientes, productos })
  } catch (error) { next(error) }
})
router.get('/users', async (_req, res, next) => {
  try {
    const users = await Usuario.find().select('-password').sort({ fecha_registro: -1 })
    return res.json(users)
  } catch (error) { next(error) }
})
router.put('/users/:id', async (req, res, next) => {
  try {
    const { nombre, usuario, correo, telefono, direccion } = req.body
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) {
      return res.status(400).json({ message: 'El nombre no es válido.' })
    }
    if (usuario !== undefined && (typeof usuario !== 'string' || usuario.trim().length < 3)) {
      return res.status(400).json({ message: 'El nombre de usuario debe tener al menos 3 caracteres.' })
    }
    if (correo !== undefined && (typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
      return res.status(400).json({ message: 'El correo no es válido.' })
    }
    if (req.body.password !== undefined && (typeof req.body.password !== 'string' || req.body.password.length < 8)) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' })
    }
    const user = await Usuario.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    if (nombre !== undefined) user.nombre = nombre
    if (usuario !== undefined) user.usuario = usuario
    if (correo !== undefined) user.correo = correo
    if (telefono !== undefined) user.telefono = telefono
    if (direccion !== undefined) user.direccion = direccion
    if (req.body.password) user.password = await bcrypt.hash(req.body.password, 12)
    await user.save()
    await syncMongoCustomer(user)
    return res.json(safeUser(user))
  } catch (error) { return next(error) }
})
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    if (!['usuario', 'admin'].includes(req.body.rol)) return res.status(400).json({ message: 'Rol no válido.' })
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'No puedes cambiar tu propio rol.' })
    const user = await Usuario.findByIdAndUpdate(req.params.id, { rol: req.body.rol }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    await syncMongoCustomer(user)
    return res.json(user)
  } catch (error) { next(error) }
})
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' })
    const user = await Usuario.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
    if (getPostgresStatus().connected) {
      await getPostgresPool().query('DELETE FROM sitios_interes WHERE id_usuario = $1', [user._id.toString()])
    }
    await user.deleteOne()
    await Promise.all([
      Mascota.deleteMany({ id_usuario: user._id }),
      Cita.deleteMany({ id_usuario: user._id }),
      Pedido.deleteMany({ id_usuario: user._id }),
    ])
    await removeMongoCustomer(user._id)
    return res.json({ message: 'Usuario eliminado.' })
  } catch (error) { next(error) }
})
export default router
