import bcrypt from 'bcryptjs'
import Usuario from '../models/User.js'

export async function ensureAdmin() {
  const correo = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!correo || !password) return
  const existing = await Usuario.findOne({ correo: correo.toLowerCase() })
  if (existing) return
  await Usuario.create({
    nombre: 'Administración AgroVet',
    usuario: correo.split('@')[0],
    correo,
    password: await bcrypt.hash(password, 12),
    rol: 'admin',
  })
  console.log(`Usuario administrador inicial creado para ${correo}`)
}
