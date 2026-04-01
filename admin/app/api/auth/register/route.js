import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request) {
  try {
    const { nombre, apellido, email, password, telefono, cedula } = await request.json()

    if (!nombre || !apellido || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const existing = await prisma.citizen.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const code = generateCode()
    const expiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

    const citizen = await prisma.citizen.create({
      data: {
        nombre,
        apellido,
        email,
        password: hashed,
        telefono: telefono || null,
        cedula: cedula || null,
        verifyCode: code,
        verifyExpiry: expiry,
      },
    })

    await sendVerificationEmail(email, nombre, code)

    return NextResponse.json({
      message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.',
      email,
    })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
