const API_URL = import.meta.env.VITE_API_URL || ''

export async function api(path, { token, ...options } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('No fue posible conectar con AgroVet. Verifica que el servidor esté en ejecución.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.message || (response.status === 502 || response.status === 503
      ? 'El backend no está disponible. Inicia el servidor en localhost:5000.'
      : 'No se pudo completar la solicitud.')
    throw new Error(message)
  }
  return data
}
