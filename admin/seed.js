require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const users = [
    { nombre: 'Carlos',    email: 'consul@consulado.es',    password: 'Consul2026!',    role: 'consul' },
    { nombre: 'Elizabeth', email: 'asistente@consulado.es', password: 'Asistente2026!', role: 'asistente' },
  ]

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12)
    await prisma.adminUser.upsert({
      where: { email: u.email },
      update: {},
      create: { nombre: u.nombre, email: u.email, password: hashed, role: u.role },
    })
    console.log(`✓ ${u.role}: ${u.email} / ${u.password}`)
  }
}

main()
  .then(() => { console.log('\nListo. Ya puedes iniciar sesión.'); prisma.$disconnect() })
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
