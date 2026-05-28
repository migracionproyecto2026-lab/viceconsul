// Reglas de disponibilidad de fechas para agendar citas.
//
// Reglas (en orden, todas deben cumplirse):
//   1. Solo lunes a viernes (sábados y domingos jamás disponibles).
//   2. No se permite el día presente ni fechas pasadas (siempre se agenda
//      al menos al día siguiente).
//   3. La fecha no puede estar en BlockedDate.
//   4. La semana en curso (lunes-viernes de la semana actual) está disponible.
//   5. La semana siguiente está disponible SOLO de martes a viernes (lunes no).
//   6. Más allá de la semana siguiente, la semana entera (L-V) está disponible
//      ÚNICAMENTE si su lunes figura en SemanaHabilitada.

// Devuelve la fecha YYYY-MM-DD del lunes de la semana de la fecha dada.
function lunesDeSemana(date) {
  const d = new Date(date); d.setHours(12, 0, 0, 0)
  const dow = d.getDay() // 0=dom, 1=lun, ..., 6=sab
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function hoyIso() { return new Date().toISOString().split('T')[0] }

function mananaIso() {
  const m = new Date(); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() + 1)
  return m.toISOString().split('T')[0]
}

// fechaIso: 'YYYY-MM-DD'
// bloqueadas: array de strings YYYY-MM-DD (no contempla franjas con hora)
// semanasHabilitadas: array de strings YYYY-MM-DD (lunes)
// Devuelve: { ok: boolean, motivo?: string }
function evaluarFecha(fechaIso, bloqueadas, semanasHabilitadas) {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return { ok: false, motivo: 'Formato de fecha inválido' }
  const fd = new Date(fechaIso + 'T12:00:00')
  const dow = fd.getDay()
  if (dow === 0 || dow === 6) return { ok: false, motivo: 'Sábados y domingos no son días hábiles' }
  if (fechaIso < mananaIso()) return { ok: false, motivo: 'Solo se agenda a partir de mañana' }
  if (Array.isArray(bloqueadas) && bloqueadas.includes(fechaIso)) return { ok: false, motivo: 'Fecha bloqueada' }

  const lunesFecha = lunesDeSemana(fd)
  const lunesActual = lunesDeSemana(new Date())
  // Días entre el lunes de hoy y el lunes de la fecha
  const dEnSemanas = Math.round((new Date(lunesFecha + 'T12:00:00') - new Date(lunesActual + 'T12:00:00')) / (7 * 24 * 60 * 60 * 1000))

  if (dEnSemanas < 0) return { ok: false, motivo: 'Semana ya transcurrida' }
  if (dEnSemanas === 0) return { ok: true }   // semana en curso, completa L-V
  if (dEnSemanas === 1) {
    // Semana siguiente: martes a viernes (lunes NO)
    if (dow === 1) return { ok: false, motivo: 'Los lunes de la semana entrante no están disponibles' }
    return { ok: true }
  }
  // Semana 2+ adelante: requiere habilitación explícita por su lunes
  if (Array.isArray(semanasHabilitadas) && semanasHabilitadas.includes(lunesFecha)) return { ok: true }
  return { ok: false, motivo: 'Semana no habilitada. Pide al viceconsulado que habilite esa semana.' }
}

module.exports = { evaluarFecha, lunesDeSemana, hoyIso, mananaIso }
