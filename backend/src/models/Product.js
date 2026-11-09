import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  nombre_producto: { type: String, required: true, trim: true, maxlength: 120 },
  descripcion: { type: String, trim: true, maxlength: 1000, default: '' },
  precio: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  imagen: { type: String, trim: true, default: '' },
  activo: { type: Boolean, default: true },
  fecha_registro: { type: Date, default: Date.now },
}, { timestamps: true })

export default mongoose.model('Producto', productSchema)
