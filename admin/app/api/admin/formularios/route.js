import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request) {
  const { tramite, datos, citizenId } = await request.json()
  if (!tramite || !datos) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const form = await prisma.formSubmission.create({
    data: {
      tramite,
      datos,
      citizenId: citizenId ? parseInt(citizenId) : null,
    },
  })

  return NextResponse.json(form)
}

export async function GET() {
  const { getSession } = await import('@/lib/auth')
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formularios = await prisma.formSubmission.findMany({
    include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(formularios)
}
