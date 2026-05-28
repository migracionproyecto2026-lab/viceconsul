// Generación de seriales únicos secuenciales por año, atómico vía Counter ($inc Mongo).
// Formato: <PREFIX>-<YEAR>-<NNNN>   ej. VCNE-2026-0001 / VAL-2026-0001
const { prisma } = require('./db')

async function nextSerial(prefix) {
  const year = new Date().getFullYear()
  const name = `${prefix}_${year}`
  const updated = await prisma.counter.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  })
  return `${prefix}-${year}-${String(updated.value).padStart(4, '0')}`
}

module.exports = { nextSerial }
