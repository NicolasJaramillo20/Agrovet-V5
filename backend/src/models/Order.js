import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  items: [{
    id_producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    nombre_producto: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precio: { type: Number, required: true, min: 0 },
  }],
  total: { type: Number, required: true, min: 0 },
  fecha: { type: Date, default: Date.now },
}, { timestamps: true })

export default mongoose.model('Pedido', orderSchema)
