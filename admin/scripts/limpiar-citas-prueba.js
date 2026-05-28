// Limpia datos de prueba de Appointment, manteniendo solo las 2 citas reales de Pedro Luis.
// Uso:
//   node scripts/limpiar-citas-prueba.js            (dry-run: solo lista qué borraría)
//   node scripts/limpiar-citas-prueba.js --apply    (ejecuta el borrado)
//
// Criterio de preservación (email del ciudadano + fecha de la cita):
//   - plbb2003@gmail.com · 2026-06-15 · 11:30 · Alta consular
//   - plbb2003@gmail.com · 2026-06-16 · 11:30 · Conservación de nacionalidad
//
// Efectos cuando se ejecuta con --apply:
//   - Borra todas las Appointment salvo las preservadas.
//   - Borra ActivityLogs cuyo citaId apunta a una cita borrada.
//   - Borra Valijas que queden sin citas dentro.
//   - NO toca Citizens (sus citas se desvinculan; el ciudadano se conserva).
//   - NO resetea Counter (los seriales emitidos siguen consumidos, intencional).

const { prisma } = require('../lib/db')

const PRESERVAR_EMAIL = 'plbb2003@gmail.com'
const PRESERVAR = [
  { fecha: '2026-06-15', hora: '11:30', tramite: 'Alta consular' },
  { fecha: '2026-06-16', hora: '11:30', tramite: 'Conservación de nacionalidad' },
]

function esPreservada(cita, emailCita) {
  if ((emailCita || '').toLowerCase() !== PRESERVAR_EMAIL.toLowerCase()) return false
  return PRESERVAR.some(p => p.fecha === cita.fecha && p.hora === cita.hora && p.tramite === cita.tramite)
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(apply ? '⚠️  MODO REAL (--apply): se borrarán datos.' : '🔍 DRY-RUN: no se borrará nada. Use --apply para ejecutar.')

  const todas = await prisma.appointment.findMany({
    include: { citizen: { select: { email: true } } },
  })
  console.log(`\nTotal de citas en BD: ${todas.length}`)

  const preservar = []
  const borrar = []
  for (const c of todas) {
    const email = c.citizen?.email || c.emailExterno || null
    if (esPreservada(c, email)) preservar.push({ id: c.id, email, fecha: c.fecha, hora: c.hora, tramite: c.tramite, serial: c.serial })
    else borrar.push({ id: c.id, email, fecha: c.fecha, hora: c.hora, tramite: c.tramite, status: c.status, serial: c.serial })
  }

  console.log(`\n✅ A PRESERVAR (${preservar.length}):`)
  preservar.forEach(c => console.log(`   - ${c.serial || '(sin folio)'} | ${c.fecha} ${c.hora} | ${c.tramite} | ${c.email}`))

  console.log(`\n🗑️  A BORRAR (${borrar.length}):`)
  borrar.forEach(c => console.log(`   - ${c.serial || '(sin folio)'} | ${c.fecha || 's/f'} ${c.hora} | ${c.tramite} | ${c.status} | ${c.email || '(sin email)'}`))

  if (!apply) {
    console.log('\n(Dry-run terminó. Re-ejecute con --apply para borrar.)')
    return
  }

  if (preservar.length !== PRESERVAR.length) {
    console.error(`\n❌ ABORTO: se esperaban ${PRESERVAR.length} citas a preservar y se encontraron ${preservar.length}. Revise los datos antes de borrar.`)
    process.exit(1)
  }

  const idsBorrar = borrar.map(c => c.id)

  // 1) Borrar ActivityLogs ligados a citas a borrar
  const logsBorrados = await prisma.activityLog.deleteMany({ where: { citaId: { in: idsBorrar } } })
  console.log(`\nActivityLogs borrados: ${logsBorrados.count}`)

  // 2) Borrar Appointments
  const citasBorradas = await prisma.appointment.deleteMany({ where: { id: { in: idsBorrar } } })
  console.log(`Citas borradas: ${citasBorradas.count}`)

  // 3) Borrar Valijas que quedaron sin citas
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
