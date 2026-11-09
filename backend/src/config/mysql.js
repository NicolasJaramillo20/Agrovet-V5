import mysql from 'mysql2/promise'

const configured = Boolean(process.env.MYSQL_URL || process.env.MYSQL_HOST)
const status = { configured, connected: false, error: null }
const pool = configured
  ? mysql.createPool(process.env.MYSQL_URL
    ? process.env.MYSQL_URL
    : {
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        database: process.env.MYSQL_DATABASE || 'agrovet',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        connectionLimit: 5,
        waitForConnections: true,
        decimalNumbers: true,
      })
  : null

export async function initializeMysql() {
  if (!pool) return status
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facturas (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        id_usuario VARCHAR(64) NOT NULL,
        total DECIMAL(12, 2) NOT NULL,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(24) NOT NULL DEFAULT 'pagada',
        INDEX idx_facturas_usuario (id_usuario)
      ) ENGINE=InnoDB
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS detalle_factura (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        id_factura BIGINT UNSIGNED NOT NULL,
        id_producto VARCHAR(64) NOT NULL,
        nombre_producto VARCHAR(160) NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(12, 2) NOT NULL,
        CONSTRAINT fk_detalle_factura FOREIGN KEY (id_factura)
          REFERENCES facturas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `)
    status.connected = true
    status.error = null
    console.log('MySQL conectado; tablas facturas y detalle_factura verificadas.')
  } catch (error) {
    status.connected = false
    status.error = error.message
    console.error(`MySQL no disponible: ${error.message}`)
  }
  return status
}

export function getMysqlPool() {
  if (!pool || !status.connected) {
    const error = new Error(status.error || 'MySQL no está configurado. Revisa las variables MYSQL_* del backend.')
    error.status = 503
    throw error
  }
  return pool
}

export function getMysqlStatus() {
  return { ...status }
}

export async function createInvoice({ userId, total, items }) {
  const connection = await getMysqlPool().getConnection()
  try {
    await connection.beginTransaction()
    const [invoiceResult] = await connection.execute(
      'INSERT INTO facturas (id_usuario, total) VALUES (?, ?)',
      [String(userId), total],
    )
    const invoiceId = invoiceResult.insertId
    for (const item of items) {
      await connection.execute(
        `INSERT INTO detalle_factura
          (id_factura, id_producto, nombre_producto, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, String(item.id_producto), item.nombre_producto, item.cantidad, item.precio],
      )
    }
    await connection.commit()
    return { id: invoiceId, id_usuario: String(userId), total, items }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function listInvoices() {
  const [rows] = await getMysqlPool().query(`
    SELECT f.id, f.id_usuario, f.total, f.fecha, f.estado,
      COALESCE(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id_producto', d.id_producto,
            'nombre_producto', d.nombre_producto,
            'cantidad', d.cantidad,
            'precio', d.precio_unitario
          )
        ),
        JSON_ARRAY()
      ) AS items
    FROM facturas f
    LEFT JOIN detalle_factura d ON d.id_factura = f.id
    GROUP BY f.id
    ORDER BY f.fecha DESC
    LIMIT 200
  `)
  return rows.map((row) => {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items
    return {
      ...row,
      total: Number(row.total),
      fecha: row.fecha,
      items: items?.filter((item) => item.id_producto !== null) || [],
    }
  })
}

export async function closeMysql() {
  if (pool) await pool.end()
}
