import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { setAuthCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
    }

    // Intentar como admin primero
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (admin) {
      const valid = await bcrypt.compare(password, admin.password)
      if (!valid) {
        return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
      }

      await setAuthCookie({
        sub: admin.id,
        role: admin.role,
        email: admin.email,
        nombre: admin.nombre,
      })

      return NextResponse.json({
        user: { id: admin.id, nombre: admin.nombre, email: admin.email, role: admin.role },
        redirect: '/admin',
      })
    }

    // Intentar como ciudadano
    const citizen = await prisma.citizen.findUnique({ where: { email } })
    if (!citizen) {
      return NextResponse.json({ error: 'No existe cuenta con ese correo' }, { status: 404 })
    }

    const valid = await bcrypt.compare(password, citizen.password)
    if (!valid) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }

    if (!citizen.verified) {
      return NextResponse.json(
        { error: 'Cuenta no verificada. Revisa tu correo.', needsVerify: true, email },
        { status: 403 }
      )
    }

    await setAuthCookie({
      sub: citizen.id,
      role: 'citizen',
      email: citizen.email,
      nombre: citizen.nombre,
    })

    return NextResponse.json({
      user: { id: citizen.id, nombre: citizen.nombre, email: citizen.email, role: 'citizen' },
      redirect: '/dashboard',
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
