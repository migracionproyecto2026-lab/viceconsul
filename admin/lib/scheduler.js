const { prisma } = require('./db')
const { sendAppointmentReminder, sendNoShowEmail } = require('./email')

// Convierte "HH:MM" a minutos desde medianoche
function toMinutes(hora) {
  const [h, m] = hora.replace(/\s*(a\.m\.|p\.m\.)/i, '').split(':').map(Number)
  return h * 60 + (m || 0)
}

async function runScheduler() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  try {
    // ── Recordatorio 1 hora antes ────────────────────────────────────────
    const proximas = await prisma.appointment.findMany({
      where: {
        fecha: today,
        recordatorioEnviado: false,
        status: { in: ['pendiente', 'confirmada'] },
      },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    for (const cita of proximas) {
      const citaMinutes = toMinutes(cita.hora)
      const diff = citaMinutes - nowMinutes
      if (diff >= 55 && diff <= 65) {
        const email = cita.citizen?.email || cita.emailExterno
        const nombre = cita.citizen ? `${cita.citizen.nombre} ${cita.citizen.apellido}` : cita.nombreExterno || 'Ciudadano'
        if (email) {
          await sendAppointmentReminder(email, nombre, cita).catch(console.error)
          console.log(`[Scheduler] Recordatorio enviado a ${email} para cita a las ${cita.hora}`)
        }
        await prisma.appointment.update({ where: { id: cita.id }, data: { recordatorioEnviado: true } })
      }
    }

    // ── Inasistencia automática (30 min después de la hora) ──────────────
    const pasadas = await prisma.appointment.findMany({
      where: {
        fecha: today,
        status: { in: ['pendiente', 'confirmada'] },
      },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    for (const cita of pasadas) {
      const citaMinutes = toMinutes(cita.hora)
      if (nowMinutes >= citaMinutes + 20) {
        await prisma.appointment.update({ where: { id: cita.id }, data: { status: 'inasistencia' } })
        const email = cita.citizen?.email || cita.emailExterno
        const nombre = cita.citizen ? `${cita.citizen.nombre} ${cita.citizen.apellido}` : cita.nombreExterno || 'Ciudadano'
        if (email) await sendNoShowEmail(email, nombre, cita).catch(console.error)
        await prisma.activityLog.create({
          data: { tipo: 'inasistencia', citaId: cita.id, ciudadanoEmail: email, notaInterna: 'Inasistencia detectada automáticamente. ⚠️ Debe rodarse la plaza.', realizadoPor: 'Sistema automático' },
        })
        console.log(`[Scheduler] Inasistencia registrada: cita #${cita.id}`)
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error:', err.message)
  }
}

function startScheduler() {
  console.log('[Scheduler] Iniciado — recordatorios y control de asistencia activos')
  setInterval(runScheduler, 60 * 1000) // cada minuto
  runScheduler() // ejecutar al arrancar
}

module.exports = { startScheduler }
