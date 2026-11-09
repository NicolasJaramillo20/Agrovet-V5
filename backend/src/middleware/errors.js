export function notFound(req, res) {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.path}` })
}

export function errorHandler(error, _req, res, _next) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map(({ message }) => message).join('. ') })
  }
  if (error.code === 11000) return res.status(409).json({ message: 'El usuario o correo ya está registrado.' })
  if (error.name === 'CastError') return res.status(400).json({ message: 'Identificador no válido.' })
  if (Number.isInteger(error.status) && (error.status >= 400 && error.status < 500 || error.status === 503)) {
    return res.status(error.status).json({ message: error.message })
  }
  console.error(error)
  return res.status(500).json({ message: 'Ocurrió un error interno. Inténtalo de nuevo.' })
}
