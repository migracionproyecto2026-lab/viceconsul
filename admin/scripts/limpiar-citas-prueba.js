// Limpia datos de prueba de Appointment, manteniendo solo las citas reales.
// Uso:
//   node scripts/limpiar-citas-prueba.js            (dry-run: solo lista qué borraría)
//   node scripts/limpiar-citas-prueba.js --apply    (ejecuta el borrado)
//
// Criterio de preservación:
//   - Pedro Luis Becerra Bustamante (plbb2003@gmail.com), 2026-06-16, 11:30,
//     Conservación de nacionalidad, status=pendiente.
//   - Cualquier cita de Orlando Scott creada el día de hoy
//     (createdAt entre 00:00 y 23:59 de la fecha de ejecución).
//
// Efectos cuando se ejecuta con --apply:
//   - Borra todas las Appointment salvo las preservadas.
//   - Borra ActivityLogs cuyo citaId apunta a una cita borrada.
//   - Borra Valijas que queden sin citas dentro.
//   - NO toca Citizens (sus citas se desvinculan; el ciudadano se conserva).
//   - NO resetea Counter (los seriales emitidos siguen consumidos, intencional).

const { prisma } = require('../lib/db')

const PEDRO_EMAIL = 'plbb2003@gmail.com'
const PEDRO = { fecha: '2026-06-16', hora: '11:30', tramite: 'Conservación de nacionalidad' }

function esPedroPreservada(cita, emailCita) {
  if ((emailCita || '').toLowerCase() !== PEDRO_EMAIL.toLowerCase()) return false
  return cita.fecha === PEDRO.fecha && cita.hora === PEDRO.hora && cita.tramite === PEDRO.tramite
}

function esOrlandoPreservada(cita) {
  const nombreReg = (cita.citizen ? `${cita.citizen.nombre} ${cita.citizen.apellido}` : (cita.nombreExterno || '')).trim().toLowerCase()
  if (!nombreReg.includes('orlando') || !nombreReg.includes('scott')) return false
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
  const creada = new Date(cita.createdAt)
  return creada >= hoy && creada < manana
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(apply ? '⚠️  MODO REAL (--apply): se borrarán datos.' : '🔍 DRY-RUN: no se borrará nada. Use --apply para ejecutar.')

  const todas = await prisma.appointment.findMany({
    include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
  })
  console.log(`\nTotal de citas en BD: ${todas.length}`)

  const preservar = []
  const borrar = []
  for (const c of todas) {
    const email = c.citizen?.email || c.emailExterno || null
    const motivo = esPedroPreservada(c, email) ? 'pedro-pendiente'
                 : esOrlandoPreservada(c) ? 'orlando-hoy'
                 : null
    if (motivo) preservar.push({ id: c.id, serial: c.serial, email, fecha: c.fecha, hora: c.hora, tramite: c.tramite, status: c.status, motivo })
    else borrar.push({ id: c.id, serial: c.serial, email, fecha: c.fecha, hora: c.hora, tramite: c.tramite, status: c.status })
  }

  console.log(`\n✅ A PRESERVAR (${preservar.length}):`)
  preservar.forEach(c => console.log(`   - [${c.motivo}] ${c.serial || '(sin ticket)'} | ${c.fecha} ${c.hora} | ${c.tramite} | ${c.status} | ${c.email}`))

  console.log(`\n🗑️  A BORRAR (${borrar.length}):`)
  borrar.forEach(c => console.log(`   - ${c.serial || '(sin ticket)'} | ${c.fecha || 's/f'} ${c.hora} | ${c.tramite} | ${c.status} | ${c.email || '(sin email)'}`))

  if (!apply) {
    console.log('\n(Dry-run terminó. Re-ejecute con --apply para borrar.)')
    return
  }

  if (preservar.length === 0) {
    console.error('\n❌ ABORTO: no se encontró ninguna cita que coincida con los criterios de preservación. Revise los datos.')
    process.exit(1)
  }

  const idsBorrar = borrar.map(c => c.id)
  const logsBorrados = await prisma.activityLog.deleteMany({ where: { citaId: { in: idsBorrar } } })
  console.log(`\nActivityLogs borrados: ${logsBorrados.count}`)
  const citasBorradas = await prisma.appointment.deleteMany({ where: { id: { in: idsBorrar } } })
  console.log(`Citas borradas: ${citasBorradas.count}`)
  const valijasVacias = await prisma.valija.findMany({ where: { citas: { none: {} } }, select: { id: true, serial: true } })
  if (valijasVacias.length) {
    await prisma.valija.deleteMany({ where: { id: { in: valijasVacias.map(v => v.id) } } })
    console.log(`Valijas vacías borradas: ${valijasVacias.length} (${valijasVacias.map(v => v.serial).join(', ')})`)
  } else {
    console.log('No quedaron valijas vacías.')
  }
  console.log('\n✔️  Limpieza completada.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
