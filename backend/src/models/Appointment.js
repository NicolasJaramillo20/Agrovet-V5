import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  id_mascota: { type: mongoose.Schema.Types.ObjectId, ref: 'Mascota', required: true },
  servicio: { type: String, required: true, trim: true, maxlength: 120 },
  fecha: { type: Date, required: true },
  hora: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  estado: { type: String, enum: ['pendiente', 'confirmada', 'completada', 'cancelada'], default: 'pendiente' },
  observaciones: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true })

export default mongoose.model('Cita', appointmentSchema)
