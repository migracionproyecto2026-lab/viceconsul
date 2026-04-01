import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || (session.role !== 'asistente' && session.role !== 'consul')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const [
    totalCiudadanos,
    ciudadanosVerificados,
    citasPendientes,
    citasHoy,
    citasSemana,
    formulariosPendientes,
  ] = await Promise.all([
    prisma.citizen.count(),
    prisma.citizen.count({ where: { verified: true } }),
    prisma.appointment.count({ where: { status: 'pendiente' } }),
    prisma.appointment.count({ where: { fecha: today } }),
    prisma.appointment.count({ where: { fecha: { gte: weekStartStr } } }),
    prisma.formSubmission.count({ where: { status: 'pendiente' } }),
  ])

  return NextResponse.json({
    totalCiudadanos,
    ciudadanosVerificados,
    citasPendientes,
    citasHoy,
    citasSemana,
    formulariosPendientes,
  })
}
