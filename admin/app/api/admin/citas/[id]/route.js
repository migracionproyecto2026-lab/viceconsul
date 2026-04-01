import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendAppointmentConfirmation } from '@/lib/email'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { status, notas, fecha, hora, tramite } = await request.json()
  const validStatuses = ['pendiente', 'confirmada', 'cancelada', 'completada']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const data = {}
  if (status !== undefined) data.status = status
  if (notas !== undefined) data.notas = notas
  if (fecha !== undefined) data.fecha = fecha
  if (hora !== undefined) data.hora = hora
  if (tramite !== undefined) data.tramite = tramite

  const cita = await prisma.appointment.update({
    where: { id: parseInt(params.id) },
    data,
    include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
  })

  // Enviar email al confirmar
  if (status === 'confirmada') {
    await sendAppointmentConfirmation(cita.citizen.email, cita.citizen.nombre, cita)
  }

  return NextResponse.json(cita)
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session || session.role !== 'consul') {
    return NextResponse.json({ error: 'Solo el cónsul puede eliminar citas' }, { status: 403 })
  }

  await prisma.appointment.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ message: 'Cita eliminada' })
}
