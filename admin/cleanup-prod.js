/**
 * cleanup-prod.js — Limpieza de datos de prueba previo a demo
 * Preserva: Banner (3 anuncios) + AdminUser (3 cuentas oficiales)
 * Elimina:  ActivityLog, Appointment, Citizen
 * Ejecutar: node cleanup-prod.js
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('══════════════════════════════════════════')
  console.log('  Limpieza de BD — Pre-Demo Viceconsulado')
  console.log('══════════════════════════════════════════\n')

  // ── Conteo previo ────────────────────────────────────────────────────────
  const antes = {
    logs:      await p.activityLog.count(),
    citas:     await p.appointment.count(),
    ciudadanos: await p.citizen.count(),
    banners:   await p.banner.count(),
    admins:    await p.adminUser.count(),
  }

  console.log('Estado ANTES:')
  console.log(`  ActivityLog  : ${antes.logs}`)
  console.log(`  Appointment  : ${antes.citas}`)
  console.log(`  Citizen      : ${antes.ciudadanos}`)
  console.log(`  Banner       : ${antes.banners}  ← se preserva`)
  console.log(`  AdminUser    : ${antes.admins}  ← se preserva`)
  console.log('')

  // ── Guardar emails de admins para verificar al final ────────────────────
  const admins = await p.adminUser.findMany({ select: { email: true, nombre: true, role: true } })

  // ── Borrado en orden (FK: logs → citas → ciudadanos) ───────────────────
  const logsD = await p.activityLog.deleteMany({})
  console.log(`✔ ActivityLog   eliminados: ${logsD.count}`)

  const citasD = await p.appointment.deleteMany({})
  console.log(`✔ Appointment   eliminadas: ${citasD.count}`)

  const ciudD = await p.citizen.deleteMany({})
  console.log(`✔ Citizen       eliminados: ${ciudD.count}`)

  // ── Conteo final ─────────────────────────────────────────────────────────
  const despues = {
    logs:       await p.activityLog.count(),
    citas:      await p.appointment.count(),
    ciudadanos: await p.citizen.count(),
    banners:    await p.banner.count(),
    admins:     await p.adminUser.count(),
  }

  console.log('\nEstado DESPUÉS:')
  console.log(`  ActivityLog  : ${despues.logs}`)
  console.log(`  Appointment  : ${despues.citas}`)
  console.log(`  Citizen      : ${despues.ciudadanos}`)
  console.log(`  Banner       : ${despues.banners}  ✓ intactos`)
  console.log(`  AdminUser    : ${despues.admins}  ✓ intactos`)

  console.log('\nAdmins preservados:')
  admins.forEach(a => console.log(`  • ${a.email} (${a.role}) — ${a.nombre}`))

  const totalEliminados = logsD.count + citasD.count + ciudD.count
  console.log(`\n✅ Total registros eliminados: ${totalEliminados}`)
  console.log('   Base de datos lista para la demo.\n')

  await p.$disconnect()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
