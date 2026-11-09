import './config/load-env.js'
import app from './app.js'
import { connectDatabase } from './config/database.js'
import { ensureAdmin } from './utils/ensureAdmin.js'
import { initializePostgres } from './config/postgres.js'
import { initializeMysql } from './config/mysql.js'
import { syncExistingMongoRecords } from './config/relational-sync.js'

const port = process.env.PORT || 5000

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe configurarse con al menos 32 caracteres.')
  }
  await connectDatabase()
  await ensureAdmin()
  await Promise.all([initializePostgres(), initializeMysql()])
  try {
    const synced = await syncExistingMongoRecords()
    if (synced.products || synced.customers) {
      console.log(`Registros de MongoDB sincronizados con PostgreSQL: ${synced.products} productos y ${synced.customers} clientes.`)
    }
  } catch (error) {
    console.error(`No se pudo completar la sincronización inicial con PostgreSQL: ${error.message}`)
  }
  app.listen(port, () => console.log(`AgroVet API disponible en http://localhost:${port}`))
} catch (error) {
  console.error('No fue posible iniciar AgroVet:', error.message)
  process.exit(1)
}
