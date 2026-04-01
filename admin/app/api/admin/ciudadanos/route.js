import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20

  const where = search
    ? {
        OR: [
          { nombre: { contains: search } },
          { apellido: { contains: search } },
          { email: { contains: search } },
          { cedula: { contains: search } },
        ],
      }
    : {}

  const [ciudadanos, total] = await Promise.all([
    prisma.citizen.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        cedula: true,
        tipoDocumento: true,
        verified: true,
        createdAt: true,
        _count: { select: { citas: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.citizen.count({ where }),
  ])

  return NextResponse.json({ ciudadanos, total, page, pages: Math.ceil(total / limit) })
}
