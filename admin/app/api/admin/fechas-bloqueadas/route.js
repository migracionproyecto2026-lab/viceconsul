import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const fechas = await prisma.blockedDate.findMany({ orderBy: { fecha: 'asc' } })
  return NextResponse.json(fechas)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { fecha, motivo } = await request.json()
  if (!fecha) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

  const blocked = await prisma.blockedDate.upsert({
    where: { fecha },
    update: { motivo },
    create: { fecha, motivo },
  })
  return NextResponse.json(blocked)
}

export async function DELETE(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { fecha } = await request.json()
  await prisma.blockedDate.delete({ where: { fecha } })
  return NextResponse.json({ message: 'Fecha desbloqueada' })
}
