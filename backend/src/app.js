import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.routes.js'
import productRoutes from './routes/product.routes.js'
import petRoutes from './routes/pet.routes.js'
import appointmentRoutes from './routes/appointment.routes.js'
import adminRoutes from './routes/admin.routes.js'
import orderRoutes from './routes/order.routes.js'
import relationalRoutes from './routes/relational.routes.js'
import siteRoutes from './routes/site.routes.js'
import { errorHandler, notFound } from './middleware/errors.js'

const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/pets', petRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/relational', relationalRoutes)
app.use('/api/sites', siteRoutes)
app.use('/api/admin', adminRoutes)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
const frontendDirectory = resolve(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)))
if (existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory))
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next()
    res.sendFile(resolve(frontendDirectory, 'index.html'))
  })
}
app.use(notFound)
app.use(errorHandler)

export default app
