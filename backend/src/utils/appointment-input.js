export function parseAppointmentInput(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Los datos de la cita no son válidos.' }
  }

  const { id_mascota, fecha, hora, servicio } = body
  const observaciones = body.observaciones === undefined ? '' : body.observaciones

  if (typeof id_mascota !== 'string' || !/^[a-f\d]{24}$/i.test(id_mascota)) {
    return { error: 'Selecciona una mascota válida.' }
  }
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { error: 'La fecha de la cita no es válida.' }
  }

  const [year, month, day] = fecha.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: 'La fecha de la cita no es válida.' }
  }
  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return { error: 'La cita debe ser para una fecha futura.' }
  }

  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return { error: 'La hora de la cita no es válida.' }
  }
  if (typeof servicio !== 'string' || !servicio.trim() || servicio.trim().length > 120) {
    return { error: 'El servicio es obligatorio y no debe superar 120 caracteres.' }
  }
  if (typeof observaciones !== 'string' || observaciones.length > 1000) {
    return { error: 'Las observaciones no deben superar 1000 caracteres.' }
  }

  return {
    values: {
      id_mascota,
      fecha: date,
      hora,
      servicio: servicio.trim(),
      observaciones: observaciones.trim(),
      estado: 'pendiente',
    },
  }
}
