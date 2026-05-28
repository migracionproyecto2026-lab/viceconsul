// Crea (o actualiza) el usuario de DEMO con acceso a todos los módulos
// EXCEPTO la gestión de usuarios (rol = asistente).
//
// Uso (recomendado, conecta al Mongo de producción vía Railway):
//   railway run -s viceconsul node admin/scripts/crear-demo-user.js <password>
// Uso local (si tienes DATABASE_URL puesto en admin/.env apuntando a producción):
//   node admin/scripts/crear-demo-user.js <password>
//
// Idempotente: si el usuario existe, actualiza la contraseña y los permisos.

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { prisma } = require('../lib/db')

const EMAIL = 'demo@maec.com'
const NOMBRE = 'Usuario Demo'
const ROL = 'asistente'
const CARGO = 'Demo institucional — acceso de gestión sin administración de usuarios'
// Todos los módulos visibles, menos 'usuarios' (que sólo ve superadmin)
const PERMISOS = ['dashboard', 'citas', 'buzon', 'ciudadanos', 'banners', 'fechas_bloqueadas', 'crm', 'valijas']

async function main() {
  const password = process.argv[2] || process.env.DEMO_PASSWORD
  if (!password || password.length < 8) {
    console.error('Falta password (mínimo 8 chars).')
    console.error('Uso: node admin/scripts/crear-demo-user.js <password>')
    process.exit(1)
  }
  const hashed = await bcrypt.hash(password, 12)
  const u = await prisma.adminUser.upsert({
    where: { email: EMAIL },
    update: { password: hashed, role: ROL, cargo: CARGO, permisos: PERMISOS, nombre: NOMBRE },
    create: { email: EMAIL, password: hashed, role: ROL, cargo: CARGO, permisos: PERMISOS, nombre: NOMBRE },
  })
  console.log('\n✓ Usuario demo listo')
  console.log('  Email:    ' + u.email)
  console.log('  Rol:      ' + u.role + ' (sin acceso al módulo Usuarios)')
  console.log('  Módulos:  ' + PERMISOS.join(', '))
  console.log('\nEntra en https://admin.viceconsulado-nuevaesparta.com/ con ese correo y la contraseña que diste.\n')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
