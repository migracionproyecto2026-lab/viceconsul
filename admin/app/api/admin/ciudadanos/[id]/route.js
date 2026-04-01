import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const citizen = await prisma.citizen.findUnique({
    where: { id: parseInt(params.id) },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      cedula: true,
      tipoDocumento: true,
      esInvitado: true,
      verified: true,
      createdAt: true,
      citas: {
        orderBy: { fecha: 'desc' },
        take: 10,
      },
      formularios: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!citizen) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Buscar posibles duplicados por nombre completo (misma persona, distinto documento)
  const duplicados = await prisma.citizen.findMany({
    where: {
      AND: [
        { nombre: citizen.nombre },
        { apellido: citizen.apellido },
        { id: { not: citizen.id } },
      ],
    },
    select: { id: true, nombre: true, apellido: true, email: true, cedula: true, tipoDocumento: true, verified: true },
  })

  return NextResponse.json({ ...citizen, duplicados })
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { nombre, apellido, email, telefono, cedula, tipoDocumento, verificar } = await request.json()

  const data = {}
  if (nombre !== undefined) data.nombre = nombre.trim()
  if (apellido !== undefined) data.apellido = apellido.trim()
  if (email !== undefined) data.email = email.trim()
  if (telefono !== undefined) data.telefono = telefono.trim() || null
  if (cedula !== undefined) data.cedula = cedula.trim() || null
  if (tipoDocumento !== undefined) data.tipoDocumento = tipoDocumento || null
  if (verificar === true) data.verified = true

  try {
    const citizen = await prisma.citizen.update({
      where: { id: parseInt(params.id) },
      data,
    })
    return NextResponse.json(citizen)
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Ese correo ya está en uso por otro ciudadano' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
