/**
 * crear-superadmin.js
 * Crea (o actualiza) el usuario superadmin del sistema.
 * Uso: node scripts/crear-superadmin.js
 *
 * Solo hace falta ejecutarlo UNA vez.
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { prisma } = require('../lib/db')

const EMAIL    = 'admin@espaciosigo.com'  // ← cambia si quieres otro correo
const PASSWORD = 'Admin2026!'             // ← cambia esta contraseña antes de ejecutar
const NOMBRE   = 'Espaciosigo'

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12)

  const user = await prisma.adminUser.upsert({
    where:  { email: EMAIL },
    update: { password: hash, role: 'superadmin', nombre: NOMBRE },
    create: { email: EMAIL, password: hash, role: 'superadmin', nombre: NOMBRE },
  })

  console.log('\n✅ Usuario superadmin listo:')
  console.log('   Correo     :', user.email)
  console.log('   Nombre     :', user.nombre)
  console.log('   Rol        :', user.role)
  console.log('   Contraseña :', PASSWORD)
  console.log('\nGuarda esta contraseña en un lugar seguro y cámbiala desde el panel después del primer acceso.\n')
}

main()
  .catch(err => { console.error('Error:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
