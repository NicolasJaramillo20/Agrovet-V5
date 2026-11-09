import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAppointmentInput } from '../src/utils/appointment-input.js'

const tomorrow = (now = new Date()) => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('creates an allowlisted appointment and ignores client-controlled ownership and status', () => {
  const result = parseAppointmentInput({
    id_mascota: '507f1f77bcf86cd799439011',
    fecha: tomorrow(),
    hora: '10:30',
    servicio: '  Consulta general  ',
    observaciones: '  Revisar vacunación  ',
    id_usuario: '507f191e810c19729de860ea',
    estado: 'completada',
    $where: 'malicious query',
  })

  assert.equal(result.error, undefined)
  assert.deepEqual(Object.keys(result.values), [
    'id_mascota', 'fecha', 'hora', 'servicio', 'observaciones', 'estado',
  ])
  assert.equal(result.values.estado, 'pendiente')
  assert.equal(result.values.servicio, 'Consulta general')
  assert.equal(result.values.observaciones, 'Revisar vacunación')
})

test('rejects object-valued identifiers instead of passing query operators to MongoDB', () => {
  const result = parseAppointmentInput({
    id_mascota: { $ne: null },
    fecha: tomorrow(),
    hora: '10:30',
    servicio: 'Consulta general',
  })

  assert.match(result.error, /mascota válida/)
})

test('rejects malformed dates, times, services, and observations', () => {
  const valid = {
    id_mascota: '507f1f77bcf86cd799439011',
    fecha: tomorrow(),
    hora: '10:30',
    servicio: 'Consulta general',
    observaciones: '',
  }

  for (const [field, value] of [
    ['fecha', '2026-02-31'],
    ['hora', '25:60'],
    ['servicio', { $ne: '' }],
    ['observaciones', 'x'.repeat(1001)],
  ]) {
    const result = parseAppointmentInput({ ...valid, [field]: value })
    assert.equal(typeof result.error, 'string', `${field} should be rejected`)
  }
})

test('rejects past dates and non-object request bodies', () => {
  const now = new Date(2026, 0, 10, 12)
  assert.match(parseAppointmentInput([], now).error, /datos de la cita/)
  assert.match(parseAppointmentInput({
    id_mascota: '507f1f77bcf86cd799439011',
    fecha: '2026-01-09',
    hora: '10:30',
    servicio: 'Consulta general',
  }, now).error, /fecha futura/)
})
