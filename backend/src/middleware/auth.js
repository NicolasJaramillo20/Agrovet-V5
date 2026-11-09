import jwt from 'jsonwebtoken'
import Usuario from '../models/User.js'

export async function protect(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  if (!token) return res.status(401).json({ message: 'Inicia sesión para continuar.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await Usuario.findById(payload.sub).select('-password')
    if (!user) return res.status(401).json({ message: 'La sesión ya no es válida.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' })
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ message: 'Acceso reservado para administración.' })
  next()
}
