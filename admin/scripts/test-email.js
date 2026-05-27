// Prueba de envío de correos por Gmail.
// Uso:  node scripts/test-email.js destinatario@correo.com [tipo]
//   tipo: all (default) | verificacion | confirmacion | recordatorio | cancelacion | inasistencia
require('dotenv').config()
const email = require('../lib/email')

const to = process.argv[2]
const tipo = (process.argv[3] || 'all').toLowerCase()

if (!to) {
  console.error('Falta destinatario.  node scripts/test-email.js tu@correo.com [tipo]')
  process.exit(1)
}
if (!process.env.GMAIL_PASS) {
  console.warn('\n⚠️  GMAIL_PASS vacío → modo consola (no envía de verdad). Configúralo para probar envío real.\n')
}

const cita = { tramite: 'Inscripción de Matrimonio', fecha: '2026-06-15', hora: '09:30' }
const nombre = 'Christian Bracconi'

const pruebas = {
  verificacion: () => email.sendVerificationEmail(to, nombre, '482913'),
  recibida: () => email.sendAppointmentReceived(to, nombre, cita),
  confirmacion: () => email.sendAppointmentConfirmation(to, nombre, cita),
  recordatorio: () => email.sendAppointmentReminder(to, nombre, cita),
  cancelacion: () => email.sendCancellationEmail(to, nombre, cita, 'La sede permanecerá cerrada por jornada de pasaportes. Le contactaremos para reagendar.'),
  inasistencia: () => email.sendNoShowEmail(to, nombre, cita),
}

;(async () => {
  const lista = tipo === 'all' ? Object.keys(pruebas) : [tipo]
  for (const t of lista) {
    if (!pruebas[t]) { console.error(`Tipo desconocido: ${t}`); continue }
    try {
      await pruebas[t]()
      console.log(`✓ ${t} → ${to}`)
    } catch (err) {
      console.error(`✗ ${t} falló:`, err.message)
    }
  }
  console.log('\nListo.')
  process.exit(0)
})()
