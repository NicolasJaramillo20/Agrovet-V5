import pg from 'pg'

const { Pool } = pg
const configuredConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
const connectionString = configuredConnectionString?.replace(
  /([?&])sslmode=require(?=(&|$))/i,
  '$1sslmode=verify-full',
)
const configured = Boolean(connectionString || process.env.POSTGRES_HOST)
const status = { configured, connected: false, error: null }
const pool = configured
  ? new Pool(connectionString
    ? { connectionString }
    : {
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DATABASE || 'agrovet',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        connectionTimeoutMillis: 5000,
      })
  : null

export async function initializePostgres() {
  if (!pool) return status
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id BIGSERIAL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        correo VARCHAR(254) NOT NULL UNIQUE,
        telefono VARCHAR(40) NOT NULL DEFAULT '',
        direccion VARCHAR(240) NOT NULL DEFAULT '',
        fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id BIGSERIAL PRIMARY KEY,
        nombre_producto VARCHAR(160) NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        imagen TEXT NOT NULL DEFAULT '',
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sitios_interes (
        id BIGSERIAL PRIMARY KEY,
        id_usuario VARCHAR(24) NOT NULL,
        nombre VARCHAR(120) NOT NULL,
        descripcion VARCHAR(1000) NOT NULL DEFAULT '',
        categoria VARCHAR(80) NOT NULL DEFAULT 'Otro',
        direccion VARCHAR(240) NOT NULL DEFAULT '',
        latitud DOUBLE PRECISION NOT NULL CHECK (latitud BETWEEN -90 AND 90),
        longitud DOUBLE PRECISION NOT NULL CHECK (longitud BETWEEN -180 AND 180),
        fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS sitios_interes_usuario_fecha_idx ON sitios_interes (id_usuario, fecha_registro DESC)')
    await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mongo_id VARCHAR(24)')
    await pool.query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS mongo_id VARCHAR(24)')
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS clientes_mongo_id_unique ON clientes (mongo_id)')
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS productos_mongo_id_unique ON productos (mongo_id)')
    status.connected = true
    status.error = null
    console.log('PostgreSQL conectado; tablas clientes, productos y sitios de interés verificadas.')
  } catch (error) {
    status.connected = false
    status.error = error.message
    console.error(`PostgreSQL no disponible: ${error.message}`)
  }
  return status
}

export function getPostgresPool() {
  if (!pool || !status.connected) {
    const error = new Error(status.error || 'PostgreSQL no está configurado. Revisa las variables POSTGRES_* del backend.')
    error.status = 503
    throw error
  }
  return pool
}

export function getPostgresStatus() {
  return { ...status }
}

export async function closePostgres() {
  if (pool) await pool.end()
}
