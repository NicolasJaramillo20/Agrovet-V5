import Producto from '../models/Product.js'
import Usuario from '../models/User.js'
import { getPostgresPool, getPostgresStatus } from './postgres.js'

function getSyncPool() {
  const status = getPostgresStatus()
  if (!status.configured) return null
  if (!status.connected) {
    const error = new Error('El cambio se guardó en MongoDB, pero PostgreSQL no está disponible para sincronizarlo.')
    error.status = 503
    throw error
  }
  return getPostgresPool()
}

async function syncProduct(product) {
  const pool = getSyncPool()
  if (!pool) return

  try {
    await pool.query(`
      INSERT INTO productos
        (mongo_id, nombre_producto, descripcion, precio, stock, imagen, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (mongo_id) DO UPDATE SET
        nombre_producto = EXCLUDED.nombre_producto,
        descripcion = EXCLUDED.descripcion,
        precio = EXCLUDED.precio,
        stock = EXCLUDED.stock,
        imagen = EXCLUDED.imagen,
        activo = EXCLUDED.activo,
        fecha_registro = EXCLUDED.fecha_registro
    `, [
      product._id.toString(),
      product.nombre_producto,
      product.descripcion || '',
      product.precio,
      product.stock,
      product.imagen || '',
      product.activo !== false,
      product.fecha_registro,
    ])
  } catch (cause) {
    console.error(`No se pudo sincronizar el producto ${product._id} con PostgreSQL: ${cause.message}`)
    const error = new Error('El producto se guardó en MongoDB, pero no se pudo sincronizar con PostgreSQL.')
    error.status = 503
    throw error
  }
}

async function syncCustomer(user) {
  const pool = getSyncPool()
  if (!pool) return

  if (user.rol !== 'usuario') {
    await pool.query('DELETE FROM clientes WHERE mongo_id = $1', [user._id.toString()])
    return
  }

  const values = [
    user._id.toString(),
    user.nombre,
    user.correo,
    user.telefono || '',
    user.direccion || '',
    user.fecha_registro,
  ]
  try {
    await pool.query(`
      INSERT INTO clientes (mongo_id, nombre, correo, telefono, direccion, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (mongo_id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        correo = EXCLUDED.correo,
        telefono = EXCLUDED.telefono,
        direccion = EXCLUDED.direccion,
        fecha_registro = EXCLUDED.fecha_registro
    `, values)
  } catch (cause) {
    if (cause.code === '23505') {
      try {
        const { rows } = await pool.query(`
          UPDATE clientes
          SET mongo_id = $1, nombre = $2, telefono = $4, direccion = $5, fecha_registro = $6
          WHERE LOWER(correo) = LOWER($3) AND (mongo_id IS NULL OR mongo_id = $1)
          RETURNING id
        `, values)
        if (rows.length) return
      } catch (updateCause) {
        console.error(`No se pudo sincronizar el cliente ${user._id} con PostgreSQL: ${updateCause.message}`)
      }
    } else {
      console.error(`No se pudo sincronizar el cliente ${user._id} con PostgreSQL: ${cause.message}`)
    }
    const error = new Error('El usuario se guardó en MongoDB, pero no se pudo sincronizar con PostgreSQL.')
    error.status = 503
    throw error
  }
}

export async function syncMongoProduct(product) {
  return syncProduct(product)
}

export async function removeMongoProduct(productId) {
  const pool = getSyncPool()
  if (!pool) return
  await pool.query('DELETE FROM productos WHERE mongo_id = $1', [productId.toString()])
}

export async function syncMongoCustomer(user) {
  return syncCustomer(user)
}

export async function removeMongoCustomer(userId) {
  const pool = getSyncPool()
  if (!pool) return
  await pool.query('DELETE FROM clientes WHERE mongo_id = $1', [userId.toString()])
}

export async function syncExistingMongoRecords() {
  const pool = getSyncPool()
  if (!pool) return { products: 0, customers: 0 }

  let products = 0
  const productIds = []
  for await (const product of Producto.find().cursor()) {
    await syncProduct(product)
    productIds.push(product._id.toString())
    products += 1
  }

  let customers = 0
  const customerIds = []
  for await (const user of Usuario.find().cursor()) {
    await syncCustomer(user)
    if (user.rol === 'usuario') {
      customerIds.push(user._id.toString())
      customers += 1
    }
  }

  if (productIds.length) {
    await pool.query('DELETE FROM productos WHERE mongo_id IS NOT NULL AND NOT (mongo_id = ANY($1::VARCHAR[]))', [productIds])
  } else {
    await pool.query('DELETE FROM productos WHERE mongo_id IS NOT NULL')
  }
  if (customerIds.length) {
    await pool.query('DELETE FROM clientes WHERE mongo_id IS NOT NULL AND NOT (mongo_id = ANY($1::VARCHAR[]))', [customerIds])
  } else {
    await pool.query('DELETE FROM clientes WHERE mongo_id IS NOT NULL')
  }

  return { products, customers }
}
