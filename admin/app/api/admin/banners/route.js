import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const banners = await prisma.banner.findMany({ orderBy: { orden: 'asc' } })
  return NextResponse.json(banners)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { titulo, cuerpo, activo, orden } = await request.json()
  if (!titulo || !cuerpo) {
    return NextResponse.json({ error: 'Título y cuerpo son obligatorios' }, { status: 400 })
  }

  const banner = await prisma.banner.create({
    data: { titulo, cuerpo, activo: activo ?? true, orden: orden ?? 0 },
  })

  return NextResponse.json(banner)
}
