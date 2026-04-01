import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { setAuthCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const citizen = await prisma.citizen.findUnique({ where: { email } })

    if (!citizen) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (citizen.verified) {
      return NextResponse.json({ error: 'Cuenta ya verificada' }, { status: 400 })
    }

    if (citizen.verifyCode !== code) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 400 })
    }

    if (!citizen.verifyExpiry || new Date() > citizen.verifyExpiry) {
      return NextResponse.json({ error: 'El código ha expirado. Solicita uno nuevo.' }, { status: 400 })
    }

    await prisma.citizen.update({
      where: { id: citizen.id },
      data: { verified: true, verifyCode: null, verifyExpiry: null },
    })

    await setAuthCookie({
      sub: citizen.id,
      role: 'citizen',
      email: citizen.email,
      nombre: citizen.nombre,
    })

    return NextResponse.json({
      message: 'Cuenta verificada exitosamente',
      user: { id: citizen.id, nombre: citizen.nombre, email: citizen.email, role: 'citizen' },
    })
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// Reenviar código
export async function PUT(request) {
  try {
    const { email } = await request.json()
    const citizen = await prisma.citizen.findUnique({ where: { email } })

    if (!citizen || citizen.verified) {
      return NextResponse.json({ error: 'No se puede reenviar el código' }, { status: 400 })
    }

    const { sendVerificationEmail } = await import('@/lib/email')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.citizen.update({
      where: { id: citizen.id },
      data: { verifyCode: code, verifyExpiry: expiry },
    })

    await sendVerificationEmail(email, citizen.nombre, code)
    return NextResponse.json({ message: 'Código reenviado' })
  } catch (err) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
