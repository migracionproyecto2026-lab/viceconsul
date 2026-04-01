import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const status = searchParams.get('status')
  const mes = searchParams.get('mes') // YYYY-MM

  const where = {}
  if (fecha) where.fecha = fecha
  if (status) where.status = status
  if (mes) where.fecha = { startsWith: mes }

  const citas = await prisma.appointment.findMany({
    where,
    include: {
      citizen: {
        select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
      },
    },
    orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
  })

  return NextResponse.json(citas)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { citizenId, fecha, hora, tramite, notas } = await request.json()
  if (!citizenId || !fecha || !hora || !tramite) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const cita = await prisma.appointment.create({
    data: { citizenId: parseInt(citizenId), fecha, hora, tramite, notas },
    include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
  })

  return NextResponse.json(cita)
}
