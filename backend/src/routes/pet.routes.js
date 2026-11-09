import { Router } from 'express'
import Mascota from '../models/Pet.js'
import { protect } from '../middleware/auth.js'

const router = Router()
router.use(protect)
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.rol === 'admin' && req.query.all === 'true' ? {} : { id_usuario: req.user._id }
    res.json(await Mascota.find(filter).populate('id_usuario', 'nombre correo').sort({ createdAt: -1 }))
  } catch (error) { next(error) }
})
router.post('/', async (req, res, next) => {
  try { res.status(201).json(await Mascota.create({ ...req.body, id_usuario: req.user._id })) } catch (error) { next(error) }
})
router.delete('/:id', async (req, res, next) => {
  try {
    const filter = req.user.rol === 'admin' ? { _id: req.params.id } : { _id: req.params.id, id_usuario: req.user._id }
    const pet = await Mascota.findOneAndDelete(filter)
    if (!pet) return res.status(404).json({ message: 'Mascota no encontrada.' })
    return res.json({ message: 'Mascota eliminada.' })
  } catch (error) { next(error) }
})
export default router
