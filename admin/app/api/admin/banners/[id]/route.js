import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const data = await request.json()
  const banner = await prisma.banner.update({
    where: { id: parseInt(params.id) },
    data,
  })
  return NextResponse.json(banner)
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  await prisma.banner.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ message: 'Banner eliminado' })
}
