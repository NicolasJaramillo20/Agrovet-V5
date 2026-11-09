import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import Usuario from '../models/User.js'
import { protect } from '../middleware/auth.js'
import { getMailer } from '../utils/mailer.js'
import { syncMongoCustomer } from '../config/relational-sync.js'

const router = Router()
const googleClient = new OAuth2Client()
const recoveryMessage = 'Si existe una cuenta con ese correo, recibirás instrucciones para recuperar tu contraseña.'
const publicUser = (user) => ({
  _id: user._id,
  nombre: user.nombre,
  usuario: user.usuario,
  correo: user.correo,
  rol: user.rol,
  telefono: user.telefono,
  direccion: user.direccion,
  fecha_registro: user.fecha_registro,
})
const issueSession = (user) => ({
  token: jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' }),
  user: publicUser(user),
})

async function uniqueUsername(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'usuario'
  let username = base
  while (await Usuario.exists({ usuario: username })) {
    username = `${base.slice(0, 25)}${crypto.randomBytes(3).toString('hex')}`
  }
  return username
}

router.post('/register', async (req, res, next) => {
  try {
    const { nombre, usuario, correo, password, telefono = '', direccion = '' } = req.body
    if (
      typeof nombre !== 'string' || !nombre.trim()
      || typeof usuario !== 'string' || usuario.trim().length < 3
      || typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
      || typeof password !== 'string'
    ) {
      return res.status(400).json({ message: 'Nombre, usuario, correo y contraseña son obligatorios.' })
    }
    if (telefono !== undefined && typeof telefono !== 'string') return res.status(400).json({ message: 'El teléfono no es válido.' })
    if (direccion !== undefined && typeof direccion !== 'string') return res.status(400).json({ message: 'La dirección no es válida.' })
    if (password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' })
    const exists = await Usuario.findOne({ $or: [{ correo: correo.toLowerCase() }, { usuario: usuario.toLowerCase() }] })
    if (exists) return res.status(409).json({ message: 'Ese correo o nombre de usuario ya está registrado.' })
    const user = await Usuario.create({
      nombre, usuario, correo, telefono, direccion,
      password: await bcrypt.hash(password, 12),
    })
    await syncMongoCustomer(user)
    return res.status(201).json(issueSession(user))
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { identificador, password } = req.body
    if (typeof identificador !== 'string' || !identificador.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Ingresa usuario o correo y contraseña.' })
    }
    const user = await Usuario.findOne({
      $or: [{ correo: identificador.toLowerCase() }, { usuario: identificador.toLowerCase() }],
    }).select('+password')
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' })
    }
    return res.json(issueSession(user))
  } catch (error) {
    next(error)
  }
})

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: 'Google Sign-In no está configurado. Añade GOOGLE_CLIENT_ID al backend y al frontend.' })
    }
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ message: 'La credencial de Google es obligatoria.' })
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const profile = ticket.getPayload()
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.status(401).json({ message: 'La cuenta de Google no tiene un correo verificado.' })
    }
    let user = await Usuario.findOne({ googleId: profile.sub })
    if (!user) {
      user = await Usuario.findOne({ correo: profile.email.toLowerCase() })
      if (user) {
        user.googleId = profile.sub
        await user.save()
      } else {
        user = await Usuario.create({
          nombre: profile.name || profile.email.split('@')[0],
          usuario: await uniqueUsername(profile.email),
          correo: profile.email,
          googleId: profile.sub,
          password: undefined,
        })
      }
    }
    await syncMongoCustomer(user)
    return res.json(issueSession(user))
  } catch (error) {
    next(error)
  }
})

router.post('/password/forgot', async (req, res, next) => {
  try {
    const correo = typeof req.body.correo === 'string' ? req.body.correo.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ message: 'Ingresa un correo válido.' })
    }
    const mailer = getMailer()
    const user = await Usuario.findOne({ correo })
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex')
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000
      await user.save()
      const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
      const resetUrl = new URL('/', baseUrl)
      resetUrl.searchParams.set('reset', resetToken)
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.correo,
        subject: 'Recupera tu contraseña de AgroVet',
        text: `Abre este enlace para crear una nueva contraseña (válido por 15 minutos): ${resetUrl}`,
        html: `<p>Solicitaste cambiar tu contraseña de AgroVet.</p><p><a href="${resetUrl.toString()}">Crear una nueva contraseña</a></p><p>El enlace vence en 15 minutos. Si no solicitaste este cambio, ignora el mensaje.</p>`,
      })
    }
    return res.json({ message: recoveryMessage })
  } catch (error) {
    next(error)
  }
})

router.post('/password/reset', async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (typeof token !== 'string' || token.length !== 64 || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'El enlace o la nueva contraseña no son válidos.' })
    }
    const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
    const user = await Usuario.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires')
    if (!user) return res.status(400).json({ message: 'El enlace de recuperación es inválido o ya venció.' })
    user.password = await bcrypt.hash(password, 12)
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()
    return res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
  } catch (error) {
    next(error)
  }
})

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }))

router.put('/profile', protect, async (req, res, next) => {
  try {
    const { nombre, telefono, direccion, password } = req.body
    if (nombre !== undefined) req.user.nombre = nombre
    if (telefono !== undefined) req.user.telefono = telefono
    if (direccion !== undefined) req.user.direccion = direccion
    if (password) {
      if (password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' })
      req.user.password = await bcrypt.hash(password, 12)
    }
    await req.user.save()
    await syncMongoCustomer(req.user)
    return res.json({ user: publicUser(req.user) })
  } catch (error) {
    next(error)
  }
})

export default router
