import mongoose from 'mongoose'

const petSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nombre_mascota: { type: String, required: true, trim: true, maxlength: 80 },
  especie: { type: String, required: true, enum: ['Bovino', 'Equino', 'Porcino', 'Avícola', 'Canino', 'Felino', 'Ovino', 'Caprino', 'Otro'] },
  raza: { type: String, trim: true, default: '' },
  edad: { type: Number, min: 0, default: 0 },
  peso: { type: Number, min: 0, default: 0 },
  sexo: { type: String, enum: ['Macho', 'Hembra', 'No especificado'], default: 'No especificado' },
  observaciones: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true })

export default mongoose.model('Mascota', petSchema)
