require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const banners = [
  { titulo: 'Jornada de Pasaportes — Abril 2026', cuerpo: 'Del 7 al 11 de abril atenderemos solicitudes de renovación y emisión de pasaportes con cita previa. Traiga original y copia de su documento de identidad vigente.', orden: 1 },
  { titulo: 'Cierre por Semana Santa', cuerpo: 'El Viceconsulado permanecerá cerrado del 14 al 18 de abril con motivo de Semana Santa. Las citas programadas para esas fechas serán reagendadas. Disculpe los inconvenientes.', orden: 2 },
]

async function main() {
  for (const b of banners) {
    const rows = await p.$queryRawUnsafe(`SELECT id FROM Banner WHERE titulo = ?`, b.titulo)
    if (rows.length) {
      await p.$executeRawUnsafe(`UPDATE Banner SET activo = 1, orden = ?, cuerpo = ? WHERE titulo = ?`, b.orden, b.cuerpo, b.titulo)
      console.log(`✔ Actualizado: ${b.titulo}`)
    } else {
      await p.$executeRawUnsafe(`INSERT INTO Banner (titulo, cuerpo, activo, orden, createdAt) VALUES (?, ?, 1, ?, datetime('now'))`, b.titulo, b.cuerpo, b.orden)
      console.log(`✔ Creado: ${b.titulo}`)
    }
  }
  console.log('\nBanners de prueba listos.')
  await p.$disconnect()
}

main().catch(err => { console.error(err.message); process.exit(1) })
