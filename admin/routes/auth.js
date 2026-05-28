const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { prisma } = require('../lib/db')
const { setAuthCookie, clearAuthCookie, getSession } = require('../lib/auth')
const { sendVerificationEmail } = require('../lib/email')
const { auditar, auditarSesion } = require('../lib/audit')

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, cedula } = req.body
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
    }
    const existing = await prisma.citizen.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' })

    const hashed = await bcrypt.hash(password, 12)
    const code = generateCode()
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.citizen.create({
      data: { nombre, apellido, email, password: hashed, telefono: telefono || null, cedula: cedula || null, verifyCode: code, verifyExpiry: expiry },
    })
    await sendVerificationEmail(email, nombre, code)
    res.json({ message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.', email })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' })

    // Mensaje genérico para no permitir enumeración de cuentas
    const GENERIC = { status: 401, error: 'Correo o contraseña incorrectos' }
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (admin) {
      const valid = await bcrypt.compare(password, admin.password)
      if (!valid) {
        await auditarSesion(req, { adminUserId: admin.id, email, nombre: admin.nombre, role: admin.role, tipo: 'login_fail' })
        await auditar(req, { entidad: 'sesion', accion: 'login_fail', ciudadanoEmail: email, notaInterna: 'Login fallido (admin)', autorOverride: { id: null, nombre: 'sistema', role: null } })
        return res.status(GENERIC.status).json({ error: GENERIC.error })
      }
      setAuthCookie(res, { sub: admin.id, role: admin.role, email: admin.email, nombre: admin.nombre }, req)
      await auditarSesion(req, { adminUserId: admin.id, email: admin.email, nombre: admin.nombre, role: admin.role, tipo: 'login_ok' })
      await auditar(req, {
        entidad: 'sesion', entidadId: admin.id, accion: 'login_ok',
        ciudadanoEmail: admin.email, notaInterna: `Login admin: ${admin.email} (${admin.role})`,
        autorOverride: { id: admin.id, nombre: admin.nombre || admin.email, role: admin.role },
      })
      return res.json({ user: { id: admin.id, nombre: admin.nombre, email: admin.email, role: admin.role }, redirect: '/admin' })
    }

    const citizen = await prisma.citizen.findUnique({ where: { email } })
    if (!citizen) {
      await auditarSesion(req, { email, tipo: 'login_fail' })
      return res.status(GENERIC.status).json({ error: GENERIC.error })
    }
    const valid = await bcrypt.compare(password, citizen.password)
    if (!valid) {
      await auditarSesion(req, { email, tipo: 'login_fail' })
      return res.status(GENERIC.status).json({ error: GENERIC.error })
    }
    if (!citizen.verified) return res.status(403).json({ error: 'Cuenta no verificada. Revisa tu correo.', needsVerify: true, email })

    setAuthCookie(res, { sub: citizen.id, role: 'citizen', email: citizen.email, nombre: citizen.nombre }, req)
    res.json({ user: { id: citizen.id, nombre: citizen.nombre, email: citizen.email, role: 'citizen' }, redirect: '/dashboard' })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body
    const citizen = await prisma.citizen.findUnique({ where: { email } })
    if (!citizen) return res.status(404).json({ error: 'Cuenta no encontrada' })
    if (citizen.verified) return res.json({ message: 'Cuenta ya verificada' })
    if (citizen.verifyCode !== code) return res.status(400).json({ error: 'Código incorrecto' })
    if (new Date() > new Date(citizen.verifyExpiry)) return res.status(400).json({ error: 'Código expirado' })

    await prisma.citizen.update({ where: { email }, data: { verified: true, verifyCode: null, verifyExpiry: null } })
    res.json({ message: 'Cuenta verificada correctamente' })
  } catch (err) {
    console.error('Verify error:', err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const session = getSession(req)
  if (session) {
    await auditarSesion(req, { adminUserId: session.sub, email: session.email, nombre: session.nombre, role: session.role, tipo: 'logout' })
    await auditar(req, {
      entidad: 'sesion', entidadId: session.sub, accion: 'logout',
      ciudadanoEmail: session.email, notaInterna: `Logout: ${session.email}`,
    })
  }
  clearAuthCookie(res)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'No autenticado' })
  res.json({ user: session })
})

module.exports = router
