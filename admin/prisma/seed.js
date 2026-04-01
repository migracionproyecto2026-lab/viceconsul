import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creando usuarios admin...')
  const hash = async (pw) => bcrypt.hash(pw, 12)

  const elizabeth = await prisma.adminUser.upsert({
    where: { email: 'elizabeth@viceconsulado.local' },
    update: {},
    create: {
      nombre: 'Elizabeth Castellanos',
      email: 'elizabeth@viceconsulado.local',
      password: await hash('Admin2026!'),
      role: 'asistente',
    },
  })

  const consul = await prisma.adminUser.upsert({
    where: { email: 'consul@viceconsulado.local' },
    update: {},
    create: {
      nombre: 'Manuel Leiros',
      email: 'consul@viceconsulado.local',
      password: await hash('Consul2026!'),
      role: 'consul',
    },
  })

  await prisma.banner.deleteMany()
  await prisma.banner.createMany({
    data: [
      { titulo: 'Atención por cita previa', cuerpo: 'Todos los trámites se realizan únicamente con cita previa. Reserve su cita con anticipación.', activo: true, orden: 0 },
      { titulo: 'Horario de atención', cuerpo: 'Lunes a viernes de 9:00 a 13:00.', activo: true, orden: 1 },
    ],
  })

  console.log('\n✓ Usuarios creados:')
  console.log(`  Asistente: ${elizabeth.email}  /  Clave: Admin2026!`)
  console.log(`  Consul:    ${consul.email}  /  Clave: Consul2026!`)
  console.log('\n  Cambia estas contraseñas después del primer login.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
