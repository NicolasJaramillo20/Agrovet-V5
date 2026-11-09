import { Router } from 'express'
import Cita from '../models/Appointment.js'
import Mascota from '../models/Pet.js'
import { adminOnly, protect } from '../middleware/auth.js'
import { parseAppointmentInput } from '../utils/appointment-input.js'

const router = Router()
router.use(protect)
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.rol === 'admin' && req.query.all === 'true' ? {} : { id_usuario: req.user._id }
    res.json(await Cita.find(filter).populate('id_mascota', 'nombre_mascota especie').populate('id_usuario', 'nombre correo').sort({ fecha: 1 }))
  } catch (error) { next(error) }
})
router.post('/', async (req, res, next) => {
  try {
    const result = parseAppointmentInput(req.body)
    if (result.error) return res.status(400).json({ message: result.error })
    const appointmentData = result.values
    const pet = await Mascota.findOne({ _id: appointmentData.id_mascota, id_usuario: req.user._id })
    if (!pet) return res.status(400).json({ message: 'Selecciona una mascota registrada en tu cuenta.' })
    if (appointmentData.fecha < new Date(new Date().toDateString())) return res.status(400).json({ message: 'La cita debe ser para una fecha futura.' })
    const overlap = await Cita.exists({ fecha: appointmentData.fecha, hora: appointmentData.hora, estado: { $in: ['pendiente', 'confirmada'] } })
    if (overlap) return res.status(409).json({ message: 'Ese horario ya está reservado. Selecciona otra hora.' })
    return res.status(201).json(await Cita.create({ ...appointmentData, id_usuario: req.user._id }))
  } catch (error) { next(error) }
})
router.patch('/:id/status', adminOnly, async (req, res, next) => {
  try {
    const allowed = ['pendiente', 'confirmada', 'completada', 'cancelada']
    if (!allowed.includes(req.body.estado)) return res.status(400).json({ message: 'Estado de cita no válido.' })
    const appointment = await Cita.findByIdAndUpdate(req.params.id, { estado: req.body.estado }, { new: true, runValidators: true })
    if (!appointment) return res.status(404).json({ message: 'Cita no encontrada.' })
    return res.json(appointment)
  } catch (error) { next(error) }
})
export default router
