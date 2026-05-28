require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const path = require('path')

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 3000

// ── Bloquear paths de reconocimiento automático ────────────────────────────
const BLOCKED_PATHS = [/sitemap/i, /xmlrpc/i, /wp-/i, /\.env/i, /\.git/i, /config\.php/i, /shell/i, /etc\/passwd/i, /\.\.\//]
app.use((req, res, next) => {
  const url = decodeURIComponent(req.url).toLowerCase()
  if (BLOCKED_PATHS.some(p => p.test(url))) return res.status(404).end()
  next()
})

// ── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://migracionproyecto2026-lab.github.io',
  'https://viceconsul-production.up.railway.app',
  'https://admin.viceconsulado-nuevaesparta.com',
  'https://www.viceconsulado-nuevaesparta.com',
  'https://viceconsulado-nuevaesparta.com',
  ...(process.env.RAILWAY_PUBLIC_URL ? [process.env.RAILWAY_PUBLIC_URL] : []),
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))

// ── Redirección HTTP → HTTPS (cuando hay proxy delante, sin importar NODE_ENV) ─
// En local sin proxy x-forwarded-proto es undefined → no redirige.
// En Railway/Vercel/etc. con x-forwarded-proto=http → 301 a https.
app.use((req, res, next) => {
  const xfp = req.headers['x-forwarded-proto']
  if (xfp && xfp !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  }
  next()
})

// ── Cabeceras de seguridad (sin dependencias) ───────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  // CSP básica: bloquea inline scripts externos no permitidos
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://admin.viceconsulado-nuevaesparta.com https://api.resend.com; " +
    "frame-ancestors 'self'; base-uri 'self'; form-action 'self';"
  )
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains; preload')
  }
  next()
})

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
// Captura el req actual en AsyncLocalStorage para que la auditoría pueda
// acceder a IP / User-Agent / sesión sin tener que pasar req explícitamente.
const { withRequestContext } = require('./lib/audit')
app.use(withRequestContext)
app.use(express.static(path.join(__dirname, 'public')))
// Servir imágenes
app.use('/images', express.static(path.join(__dirname, 'public/images')))

// ── Rate limiting ──────────────────────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos. Espera 15 minutos.' }, standardHeaders: true, legacyHeaders: false })
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false })
// Endpoints públicos sensibles (solicitud de cita y verificación): límite estricto anti-abuso
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' }, standardHeaders: true, legacyHeaders: false })

// ── Rutas API ──────────────────────────────────────────────────────────────
app.use('/api/auth', loginLimiter, require('./routes/auth'))
app.use('/api/admin', apiLimiter, require('./routes/admin'))
const { requireAdmin } = require('./lib/auth')
app.use('/api/admin/reportes', apiLimiter, requireAdmin, require('./routes/reportes'))

// Ruta pública: configuración centralizada (desde la base de datos)
app.get('/api/config', async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const settings = await prisma.setting.findMany()
    const configMap = {}
    settings.forEach(s => configMap[s.clave] = s.valor)
    res.json(configMap)
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar configuración' })
  }
})

// Ruta pública: banners activos (para la web estática)
app.get('/api/banners', async (req, res) => {

  try {
    const { prisma } = require('./lib/db')
    const banners = await prisma.banner.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } })
    res.json(banners)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// Ruta pública: fechas bloqueadas (para el formulario de citas de la web)
app.get('/api/fechas-bloqueadas', async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const fechas = await prisma.blockedDate.findMany({ orderBy: { fecha: 'asc' } })
    res.json(fechas)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// Ruta pública: semanas hábiles habilitadas (más allá de la semana en curso
// y la siguiente). Devuelve los lunes registrados como YYYY-MM-DD.
app.get('/api/semanas-habilitadas', async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const semanas = await prisma.semanaHabilitada.findMany({ orderBy: { lunes: 'asc' } })
    res.json(semanas)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// Ruta pública: verificar si existe ciudadano por cédula o email
app.get('/api/public/verificar', publicLimiter, async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const { cedula, email } = req.query
    if (!cedula && !email) return res.json({ existe: false })
    const where = []
    if (email) where.push({ email })
    if (cedula) where.push({ cedula })
    const citizen = await prisma.citizen.findFirst({ where: { OR: where }, select: { id: true, nombre: true, apellido: true } })
    res.json({ existe: !!citizen, nombre: citizen ? `${citizen.nombre} ${citizen.apellido}` : null })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// Ruta pública: solicitud de cita desde la web estática
// Validación de inputs comunes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function validarCitaPublica(b) {
  if (!b.tramite || typeof b.tramite !== 'string') return 'El trámite es obligatorio'
  if (b.tramite.length > 200) return 'Trámite demasiado largo'
  if (b.email && (!EMAIL_RE.test(b.email) || b.email.length > 120)) return 'Correo no válido'
  for (const [k, max] of [['nombres', 100], ['apellidos', 100], ['cedula', 30], ['telefono', 30], ['codigoPais', 8], ['tipoDocumento', 40], ['observaciones', 1000]]) {
    if (b[k] && (typeof b[k] !== 'string' || b[k].length > max)) return `Campo ${k} no válido`
  }
  if (b.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) return 'Fecha con formato inválido'
  if (b.hora && !/^\d{2}:\d{2}$/.test(b.hora)) return 'Hora con formato inválido'
  return null
}

app.post('/api/public/cita', publicLimiter, async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const { nombres, apellidos, tipoDocumento, cedula, codigoPais, telefono, email, tramite, fecha, hora, observaciones } = req.body
    const errVal = validarCitaPublica(req.body)
    if (errVal) return res.status(400).json({ error: errVal })

    // Verificar disponibilidad de la fecha contra las reglas de semanas
    if (fecha) {
      const { evaluarFecha } = require('./lib/disponibilidad')
      const [bloqueadas, semanas] = await Promise.all([
        prisma.blockedDate.findMany({ select: { fecha: true } }),
        prisma.semanaHabilitada.findMany({ select: { lunes: true } }),
      ])
      const r = evaluarFecha(fecha, bloqueadas.map(b => b.fecha), semanas.map(s => s.lunes))
      if (!r.ok) return res.status(400).json({ error: r.motivo })
    }

    // Verificar hora ocupada
    if (fecha && hora) {
      const ocupada = await prisma.appointment.findFirst({
        where: { fecha, hora, status: { notIn: ['cancelada', 'inasistencia'] } }
      })
      if (ocupada) return res.status(409).json({ error: `Ya hay una cita a las ${hora} el ${fecha}. Elige otra hora.` })
    }

    const nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ') || null
    const telefonoCompleto = codigoPais && telefono ? `${codigoPais}${telefono}` : (telefono || null)

    // Buscar o crear ciudadano invitado
    let citizenId = null
    if (email || cedula) {
      const where = []
      if (email) where.push({ email })
      if (cedula) where.push({ cedula })
      let citizen = await prisma.citizen.findFirst({ where: { OR: where } })
      if (!citizen && email) {
        const nombre = nombres || (nombreCompleto ? nombreCompleto.split(' ')[0] : 'Sin nombre')
        const apellido = apellidos || (nombreCompleto ? nombreCompleto.split(' ').slice(1).join(' ') : '')
        citizen = await prisma.citizen.create({
          data: { nombre, apellido, email, telefono: telefonoCompleto, cedula: cedula || null, tipoDocumento: tipoDocumento || null, esInvitado: true, verified: false }
        })
      } else if (citizen) {
        // Actualizar datos si cambiaron
        const update = {}
        if (nombres?.trim()) update.nombre = nombres.trim()
        if (apellidos?.trim()) update.apellido = apellidos.trim()
        if (telefonoCompleto && !citizen.telefono) update.telefono = telefonoCompleto
        if (cedula && !citizen.cedula) update.cedula = cedula
        if (tipoDocumento && !citizen.tipoDocumento) update.tipoDocumento = tipoDocumento
        if (Object.keys(update).length) await prisma.citizen.update({ where: { id: citizen.id }, data: update })
      }
      if (citizen) citizenId = citizen.id
    }

    const notas = observaciones || null
    const { nextSerial } = require('./lib/serial')
    const serial = await nextSerial('VCNE')

    const cita = await prisma.appointment.create({
      data: {
        serial,
        citizenId,
        nombreExterno: citizenId ? null : (nombreCompleto || null),
        emailExterno: citizenId ? null : (email || null),
        telefonoExterno: citizenId ? null : (telefonoCompleto || null),
        tipoDocumento: tipoDocumento || null,
        cedulaExterno: cedula || null,
        fecha: fecha || null,
        hora: hora || '08:30',
        tramite,
        notas,
        origen: 'web',
      }
    })

    // Registrar en ActivityLog (Buzón del admin + auditoría 360°)
    const { auditar } = require('./lib/audit')
    await auditar(req, {
      tipo: 'nueva_cita_web',
      entidad: 'cita', entidadId: cita.id, accion: 'crear',
      despues: cita,
      citaId: cita.id,
      ciudadanoEmail: email || null,
      notaInterna: `Cita solicitada desde la web pública: ${tramite}${fecha ? ` para el ${fecha} a las ${hora || '08:30'}` : ''}`,
      autorOverride: { id: null, nombre: 'sistema_web', role: 'web' },
    })

    // Enviar correo de confirmación si hay email
    if (email) {
      const { sendAppointmentReceived } = require('./lib/email')
      const nombreDisplay = nombreCompleto || email
      sendAppointmentReceived(email, nombreDisplay, {
        tramite,
        fecha: fecha || 'Por confirmar',
        hora: hora || '08:30',
      }).catch(err => console.error('[email] Error enviando acuse de solicitud:', err))
    }

    res.json({ ok: true, id: cita.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// ── Setup inicial: crear primer admin si no existe ninguno ─────────────────
app.post('/api/setup', async (req, res) => {
  try {
    const { prisma } = require('./lib/db')
    const bcrypt = require('bcryptjs')
    const count = await prisma.adminUser.count()
    if (count > 0) return res.status(403).json({ error: 'Ya existe un administrador. Setup deshabilitado.' })
    const { nombre, email, password } = req.body
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos' })
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
    const hashed = await bcrypt.hash(password, 12)
    const admin = await prisma.adminUser.create({ data: { nombre, email, password: hashed, role: 'superadmin' } })
    res.json({ ok: true, message: `Admin creado: ${admin.email} (superadmin)` })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// ── Fallback SPA ───────────────────────────────────────────────────────────
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')))

// ── Arrancar ───────────────────────────────────────────────────────────────
const { startScheduler } = require('./lib/scheduler')

app.listen(PORT, () => {
  startScheduler()
  console.log(`\nViceconsulado Admin → http://localhost:${PORT}`)
  console.log(`Panel admin  → http://localhost:${PORT}/admin`)
  console.log(`API          → http://localhost:${PORT}/api/auth/me\n`)
})
