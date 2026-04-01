/**
 * seed-banners.js — Inserta los 3 avisos predeterminados
 * Uso: node prisma/seed-banners.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.banner.count()
  if (count > 0) { console.log('Ya existen banners, seed omitido.'); return }

  await prisma.banner.createMany({
    data: [
      {
        categoria: 'Jornada Especial',
        titulo: 'Próxima Jornada de Pasaporte — 18 de Junio de 2026',
        cuerpo: 'Reserve su cita con anticipación.',
        activo: true,
        orden: 0,
      },
      {
        categoria: 'Aviso Importante',
        titulo: 'Todos los trámites requieren cita previa',
        cuerpo: 'Cada cita es personal, individual e intransferible. Si necesita realizar más de un trámite, debe solicitar una cita independiente para cada uno. Algunos trámites como visados, compulsas y homologaciones solo se realizan en el Consulado General en Caracas.',
        activo: true,
        orden: 1,
      },
      {
        categoria: 'Información General',
        titulo: 'Horario de Atención: Lunes a Viernes, 8:00 AM – 12:00 PM',
        cuerpo: 'El Viceconsulado atiende únicamente con cita previa. Para consultas generales puede escribir al correo oficial o contactarnos por WhatsApp en horario laboral.',
        activo: true,
        orden: 2,
      },
    ],
  })
  console.log('✅ 3 banners creados.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
