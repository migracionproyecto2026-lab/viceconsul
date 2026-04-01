/**
 * seed-demo.js — Datos de demostración para la reunión
 * Ejecutar: node seed-demo.js
 * SOLO para demo local o Railway, NO en producción real
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando limpieza y carga de datos oficiales...\n')

  // Limpiar tablas para evitar duplicados en SQLite
  await prisma.setting.deleteMany({})
  await prisma.banner.deleteMany({})
  await prisma.activityLog.deleteMany({})
  await prisma.appointment.deleteMany({})
  await prisma.citizen.deleteMany({})
  await prisma.adminUser.deleteMany({})
  await prisma.blockedDate.deleteMany({})

  // ── Admin users ─────────────────────────────────────────────────────────
  const admins = [
    { nombre: 'Manuel Leiros',         email: 'consul@maec.es',   password: 'Leiros2026*', role: 'consul'     },
    { nombre: 'Elizabeth Castellanos', email: 'gestor@maec.es',   password: 'beth2026*',   role: 'asistente'  },
    { nombre: 'Administrador',         email: 'admin01@maec.com', password: '12:01:06*',   role: 'superadmin' },
  ]

  for (const a of admins) {
    const hashed = await bcrypt.hash(a.password, 12)
    await prisma.adminUser.create({
      data: { nombre: a.nombre, email: a.email, password: hashed, role: a.role },
    })
    console.log(`✅ Admin: ${a.email} / ${a.password} (${a.role})`)
  }
  console.log('')

  // ── Configuración Centralizada (Settings) ────────────────────────────────
  const settingsData = [
    { clave: 'horario_atencion',  valor: '8:00 AM — 12:00 PM' },
    { clave: 'horario_citas',     valor: '9:00 AM — 11:30 AM (Cita Previa)' },
    { clave: 'viceconsul_nombre', valor: 'D. Manuel Leiros Pampinella' },
    { clave: 'email_oficial',     valor: 'ch.porlamar@maec.es' },
    { clave: 'whatsapp_contacto', valor: '+58 424-8429665' },
    { clave: 'ubicacion_ciudad',  valor: 'Porlamar, Isla de Margarita' },
    { clave: 'ubicacion_estado',  valor: 'Nueva Esparta, Venezuela' },
  ]

  for (const s of settingsData) {
    await prisma.setting.create({ data: s })
  }
  console.log('✅ Configuración central de identidad cargada\n')

  // ── Banners (Avisos Corregidos) ──────────────────────────────────────────
  const bannersData = [
    { 
      titulo: 'Próxima Jornada de Pasaportes', 
      cuerpo: 'El 18 de junio de 2026 se realizará una Jornada Especial de Pasaportes en el Viceconsulado Honorario de España. Reserve su cita con anticipación.', 
      categoria: 'EVENTO',
      activo: true, 
      orden: 1 
    },
    { 
      titulo: 'Aviso Importante — Cita Previa Obligatoria', 
      cuerpo: 'La oficina atiende información general de 8:00 a 12:00. Sin embargo, todos los servicios consulares (Pasaportes, Registro Civil, etc.) se prestan estrictamente con cita previa.', 
      categoria: 'URGENTE',
      activo: true, 
      orden: 2 
    },
    { 
      titulo: 'Cierre por Festividad Nacional — 19 de Abril', 
      cuerpo: 'El Viceconsulado permanecerá cerrado el 19 de abril por festividad nacional. Las citas de esa fecha serán reagendadas. Disculpe las molestias.', 
      categoria: 'INFO',
      activo: true, 
      orden: 3 
    },
  ]
  for (const b of bannersData) {
    await prisma.banner.create({ data: b })
  }
  console.log('✅ Banners dinámicos creados (visibles en Admin y Web)\n')

  // ── Fechas bloqueadas ────────────────────────────────────────────────────
  for (const f of [
    { fecha: '2026-04-19', motivo: 'Festividad nacional — 19 de Abril' },
    { fecha: '2026-04-14', motivo: 'Semana Santa' },
    { fecha: '2026-04-15', motivo: 'Semana Santa' },
  ]) {
    await prisma.blockedDate.create({ data: f })
  }
  console.log('✅ Fechas bloqueadas añadidas\n')

  console.log('════════════════════════════════════════')
  console.log('✅ INSTALACIÓN DE DEMO OFICIAL COMPLETADA')
  console.log('   Accede al admin con:')
  console.log('   Email: consul@maec.es  /  Leiros2026*')
  console.log('   Email: gestor@maec.es  /  beth2026*')
  console.log('════════════════════════════════════════\n')
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
