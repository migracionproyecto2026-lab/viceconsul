const express = require('express')
const router = express.Router()
const { prisma } = require('../lib/db')
const { requireAdmin } = require('../lib/auth')
const { sendAppointmentConfirmation, sendCancellationEmail, sendNoShowEmail } = require('../lib/email')
const bcrypt = require('bcryptjs')

router.use(requireAdmin)

// ── Helpers ────────────────────────────────────────────────────────────────
function getCitaEmail(cita) {
  return cita.citizen?.email || cita.emailExterno || null
}
function getCitaNombre(cita) {
  if (cita.citizen) return `${cita.citizen.nombre} ${cita.citizen.apellido}`
  return cita.nombreExterno || 'Ciudadano'
}

async function logActividad({ tipo, citaId, ciudadanoEmail, mensajeCiudadano, notaInterna, datos, realizadoPor }) {
  return prisma.activityLog.create({
    data: { tipo, citaId, ciudadanoEmail, mensajeCiudadano, notaInterna, datos, realizadoPor },
  })
}

function getNombreAdmin(session) {
  return session?.nombre || session?.email || 'Desconocido'
}

// Orden de prioridad de estados para la lista de citas
const STATUS_ORDER = { pendiente: 0, confirmada: 1, en_proceso: 2, asistencia_tarde: 3, completada: 4, cancelada: 5, inasistencia: 5 }
function sortCitas(citas) {
  return citas.sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 9
    const sb = STATUS_ORDER[b.status] ?? 9
    if (sa !== sb) return sa - sb
    if (a.fecha && b.fecha && a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    return (a.hora || '').localeCompare(b.hora || '')
  })
}

// ── STATS ──────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const adminUser = await prisma.adminUser.findUnique({ where: { id: req.session.sub } })
    const lastRead = adminUser?.buzonLastRead || new Date(0)

    const [totalCiudadanos, ciudadanosVerificados, citasPendientes, citasHoy, citasSemana, docPendientes, logsSinLeer, citasSinCuenta] =
      await Promise.all([
        prisma.citizen.count(),
        prisma.citizen.count({ where: { verified: true } }),
        prisma.appointment.count({ where: { status: 'pendiente' } }),
        prisma.appointment.count({ where: { fecha: today } }),
        prisma.appointment.count({ where: { fecha: { gte: weekStartStr } } }),
        prisma.appointment.count({ where: { NOT: { documentosPendientes: null }, status: { notIn: ['cancelada', 'completada'] } } }),
        prisma.activityLog.count({ where: { createdAt: { gt: lastRead } } }),
        prisma.appointment.count({ where: { citizenId: null, status: { notIn: ['cancelada', 'completada'] } } }),
      ])

    res.json({ totalCiudadanos, ciudadanosVerificados, citasPendientes, citasHoy, citasSemana, docPendientes, logsSinLeer, citasSinCuenta })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── CITAS ──────────────────────────────────────────────────────────────────
router.get('/citas', async (req, res) => {
  try {
    const { fecha, status, mes, fechaDesde, fechaHasta } = req.query
    const where = {}
    if (fecha) where.fecha = fecha
    if (status) where.status = status
    if (mes) where.fecha = { startsWith: mes }
    if (fechaDesde && fechaHasta) where.fecha = { gte: fechaDesde, lte: fechaHasta }
    else if (fechaDesde) where.fecha = { gte: fechaDesde }
    else if (fechaHasta) where.fecha = { lte: fechaHasta }

    const citas = await prisma.appointment.findMany({
      where,
      include: { citizen: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } } },
    })
    res.json(sortCitas(citas))
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/citas', async (req, res) => {
  try {
    const { citizenId, nombreExterno, emailExterno, telefonoExterno, fecha, hora, tramite, notas } = req.body
    if (!hora || !tramite) return res.status(400).json({ error: 'Hora y trámite son obligatorios' })

    if (fecha) {
      const dia = new Date(fecha + 'T12:00:00').getDay()
      if (dia === 0 || dia === 6) return res.status(400).json({ error: 'Solo se pueden agendar citas de lunes a viernes.' })
    }

    if (fecha && hora) {
      const ocupada = await prisma.appointment.findFirst({
        where: { fecha, hora, status: { notIn: ['cancelada', 'inasistencia'] } }
      })
      if (ocupada) return res.status(409).json({ error: `Ya existe una cita a las ${hora} el ${fecha}. Elige otra hora.` })
    }

    const cita = await prisma.appointment.create({
      data: {
        citizenId: citizenId ? parseInt(citizenId) : null,
        nombreExterno: nombreExterno || null,
        emailExterno: emailExterno || null,
        telefonoExterno: telefonoExterno || null,
        fecha: fecha || null,
        hora, tramite, notas,
      },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    await logActividad({ tipo: 'creacion', citaId: cita.id, ciudadanoEmail: getCitaEmail(cita), notaInterna: `Cita creada: ${tramite}${fecha ? ' el ' + fecha + ' a las ' + hora : ''}`, realizadoPor: getNombreAdmin(req.session) })

    const email = getCitaEmail(cita)
    if (email) await sendAppointmentConfirmation(email, getCitaNombre(cita), cita).catch(console.error)

    res.json(cita)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/citas/:id', async (req, res) => {
  try {
    const { status, notas, fecha, hora, tramite, documentosPendientes } = req.body
    const id = parseInt(req.params.id)
    const prev = await prisma.appointment.findUnique({ where: { id }, include: { citizen: true } })
    if (!prev) return res.status(404).json({ error: 'Cita no encontrada' })

    // Verificar conflicto de horario si se cambia fecha u hora
    const newFecha = fecha !== undefined ? fecha : prev.fecha
    const newHora  = hora  !== undefined ? hora  : prev.hora
    if (newFecha && newHora && (fecha !== undefined || hora !== undefined)) {
      if (newFecha !== prev.fecha || newHora !== prev.hora) {
        const ocupada = await prisma.appointment.findFirst({
          where: { fecha: newFecha, hora: newHora, status: { notIn: ['cancelada', 'inasistencia'] }, NOT: { id } }
        })
        if (ocupada) return res.status(409).json({ error: `Ya existe una cita a las ${newHora} el ${newFecha}. Elige otro horario.` })
      }
    }

    const data = {}
    if (status !== undefined) data.status = status
    if (notas !== undefined) data.notas = notas
    if (fecha !== undefined) data.fecha = fecha
    if (hora !== undefined) data.hora = hora
    if (tramite !== undefined) data.tramite = tramite
    if (documentosPendientes !== undefined) data.documentosPendientes = documentosPendientes

    const cita = await prisma.appointment.update({
      where: { id },
      data,
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    if (status === 'inasistencia' && status !== prev.status) {
      const email = getCitaEmail(cita)
      if (email) await sendNoShowEmail(email, getCitaNombre(cita), cita).catch(console.error)
      await logActividad({ tipo: 'inasistencia', citaId: cita.id, ciudadanoEmail: getCitaEmail(cita), notaInterna: 'Inasistencia registrada', realizadoPor: getNombreAdmin(req.session) })
    }

    res.json(cita)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/citas/:id/cancelar', async (req, res) => {
  try {
    const { mensajeCiudadano, notaInterna } = req.body
    const id = parseInt(req.params.id)
    const cita = await prisma.appointment.findUnique({
      where: { id },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    if (cita.status === 'cancelada') return res.status(400).json({ error: 'La cita ya está cancelada' })

    await prisma.appointment.update({ where: { id }, data: { status: 'cancelada' } })

    const email = getCitaEmail(cita)
    if (email) await sendCancellationEmail(email, getCitaNombre(cita), cita, mensajeCiudadano).catch(console.error)

    const log = await logActividad({
      tipo: 'cancelacion', citaId: id, ciudadanoEmail: email, mensajeCiudadano, notaInterna,
      datos: JSON.stringify({ tramite: cita.tramite, fecha: cita.fecha, hora: cita.hora }),
      realizadoPor: getNombreAdmin(req.session),
    })
    res.json({ ok: true, log })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/citas/:id/reagendar', async (req, res) => {
  try {
    const { nuevaFecha, nuevaHora, liberarPlaza, motivoNoLiberar, notaInterna } = req.body
    const id = parseInt(req.params.id)
    const cita = await prisma.appointment.findUnique({
      where: { id },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })

    if (!liberarPlaza && motivoNoLiberar && cita.fecha) {
      await prisma.blockedDate.upsert({
        where: { fecha: `${cita.fecha}_${cita.hora}` },
        update: { motivo: motivoNoLiberar },
        create: { fecha: `${cita.fecha}_${cita.hora}`, motivo: motivoNoLiberar },
      }).catch(() => {})
    }

    const citaActualizada = await prisma.appointment.update({
      where: { id },
      data: { fecha: nuevaFecha, hora: nuevaHora, status: 'pendiente' },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    await logActividad({
      tipo: 'reagendamiento', citaId: id, ciudadanoEmail: getCitaEmail(cita), notaInterna,
      datos: JSON.stringify({ de: { fecha: cita.fecha, hora: cita.hora }, a: { fecha: nuevaFecha, hora: nuevaHora }, liberarPlaza, motivoNoLiberar }),
      realizadoPor: getNombreAdmin(req.session),
    })

    const email = getCitaEmail(citaActualizada)
    if (email) await sendAppointmentConfirmation(email, getCitaNombre(citaActualizada), citaActualizada).catch(console.error)

    res.json({ ok: true, cita: citaActualizada })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── REGISTRO INCOMPLETO (citas con documentos pendientes) ──────────────────
router.get('/registro-incompleto', async (req, res) => {
  try {
    const citas = await prisma.appointment.findMany({
      where: { NOT: { documentosPendientes: null }, status: { notIn: ['cancelada', 'completada'] } },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(citas)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Tildar un documento como recibido (lo elimina del arreglo pendiente)
router.patch('/registro-incompleto/:id/doc', async (req, res) => {
  try {
    const { docIdx } = req.body
    if (docIdx === undefined) return res.status(400).json({ error: 'docIdx requerido' })
    const cita = await prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    const docs = JSON.parse(cita.documentosPendientes || '[]')
    const docNombre = docs[parseInt(docIdx)]
    if (!docNombre) return res.status(400).json({ error: 'Documento no encontrado en el índice indicado' })
    docs.splice(parseInt(docIdx), 1)
    const newDocs = docs.length ? JSON.stringify(docs) : null
    await prisma.appointment.update({ where: { id: parseInt(req.params.id) }, data: { documentosPendientes: newDocs } })
    await logActividad({ tipo: 'documento_recibido', citaId: parseInt(req.params.id), notaInterna: `Documento recibido: ${docNombre}`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true, docsRestantes: docs })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Finalizar una cita de registro incompleto (pasa a completada)
router.post('/registro-incompleto/:id/finalizar', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const cita = await prisma.appointment.findUnique({ where: { id } })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    await prisma.appointment.update({ where: { id }, data: { status: 'completada' } })
    await logActividad({ tipo: 'registro_finalizado', citaId: id, notaInterna: 'Cita finalizada desde Registro Incompleto', realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── BITÁCORA ───────────────────────────────────────────────────────────────
router.get('/bitacora', async (req, res) => {
  try {
    const { tipo, limit = 50 } = req.query
    const where = tipo ? { tipo } : {}
    const logs = await prisma.activityLog.findMany({
      where,
      include: { cita: { select: { tramite: true, fecha: true, hora: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })
    res.json(logs)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/bitacora/leer-todo', async (req, res) => {
  try {
    await prisma.adminUser.update({ where: { id: req.session.sub }, data: { buzonLastRead: new Date() } })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── CIUDADANOS ─────────────────────────────────────────────────────────────
router.get('/ciudadanos', async (req, res) => {
  try {
    const search = req.query.q || ''
    const page = parseInt(req.query.page || '1')
    const limit = 20
    const where = search
      ? { OR: [{ nombre: { contains: search } }, { apellido: { contains: search } }, { email: { contains: search } }, { cedula: { contains: search } }] }
      : {}
    const [ciudadanos, total] = await Promise.all([
      prisma.citizen.findMany({ where, select: { id: true, nombre: true, apellido: true, email: true, telefono: true, cedula: true, tipoDocumento: true, verified: true, esInvitado: true, createdAt: true, _count: { select: { citas: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.citizen.count({ where }),
    ])
    res.json({ ciudadanos, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/ciudadanos/buscar', async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json(null)
    let citizen = null
    if (q.includes('@')) {
      citizen = await prisma.citizen.findUnique({ where: { email: q } })
    } else if (/^\d+$/.test(q)) {
      // número: busca por cédula primero, luego por ID
      citizen = await prisma.citizen.findFirst({ where: { cedula: q } })
        || await prisma.citizen.findUnique({ where: { id: parseInt(q) } }).catch(() => null)
    } else {
      // texto: busca por nombre o apellido
      citizen = await prisma.citizen.findFirst({
        where: { OR: [{ nombre: { contains: q } }, { apellido: { contains: q } }] },
        orderBy: { createdAt: 'desc' },
      })
    }
    if (!citizen) return res.json(null)
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/ciudadanos/:id', async (req, res) => {
  try {
    const citizen = await prisma.citizen.findUnique({ where: { id: parseInt(req.params.id) }, include: { citas: { orderBy: { createdAt: 'desc' }, take: 20 } } })
    if (!citizen) return res.status(404).json({ error: 'Ciudadano no encontrado' })
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/ciudadanos/:id', async (req, res) => {
  try {
    const { nombre, apellido, telefono, cedula, tipoDocumento, verified } = req.body
    const citizen = await prisma.citizen.update({ where: { id: parseInt(req.params.id) }, data: { nombre, apellido, telefono, cedula, tipoDocumento, verified } })
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── BANNERS ────────────────────────────────────────────────────────────────
router.get('/banners', async (req, res) => {
  try { res.json(await prisma.banner.findMany({ orderBy: { orden: 'asc' } })) }
  catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.post('/banners', async (req, res) => {
  try {
    const { categoria, titulo, cuerpo, activo, orden } = req.body
    if (!titulo || !cuerpo) return res.status(400).json({ error: 'Título y cuerpo son obligatorios' })
    res.json(await prisma.banner.create({ data: { categoria: categoria || null, titulo, cuerpo, activo: activo ?? true, orden: orden ?? 0 } }))
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.put('/banners/:id', async (req, res) => {
  try {
    const { categoria, titulo, cuerpo, activo, orden } = req.body
    res.json(await prisma.banner.update({ where: { id: parseInt(req.params.id) }, data: { categoria: categoria ?? undefined, titulo, cuerpo, activo, orden } }))
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.delete('/banners/:id', async (req, res) => {
  try { await prisma.banner.delete({ where: { id: parseInt(req.params.id) } }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── FECHAS BLOQUEADAS ──────────────────────────────────────────────────────
router.get('/fechas-bloqueadas', async (req, res) => {
  try { res.json(await prisma.blockedDate.findMany({ orderBy: { fecha: 'asc' } })) }
  catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.post('/fechas-bloqueadas', async (req, res) => {
  try {
    const { fecha, motivo } = req.body
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' })
    res.json(await prisma.blockedDate.upsert({ where: { fecha }, update: { motivo }, create: { fecha, motivo } }))
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.delete('/fechas-bloqueadas', async (req, res) => {
  try { await prisma.blockedDate.delete({ where: { fecha: req.body.fecha } }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── USUARIOS (solo superadmin) ─────────────────────────────────────────────
function requireSuperadmin(req, res, next) {
  if (req.session?.role !== 'superadmin') return res.status(403).json({ error: 'No autorizado' })
  next()
}

router.get('/usuarios', requireSuperadmin, async (req, res) => {
  try {
    const usuarios = await prisma.adminUser.findMany({ select: { id: true, nombre: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
    res.json(usuarios)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/usuarios', requireSuperadmin, async (req, res) => {
  try {
    const { nombre, email, password, role } = req.body
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' })
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.adminUser.create({ data: { nombre, email, password: hashed, role: role || 'asistente' } })
    res.json({ id: user.id, nombre: user.nombre, email: user.email, role: user.role, createdAt: user.createdAt })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/usuarios/:id', requireSuperadmin, async (req, res) => {
  try {
    const { nombre, email, role, password } = req.body
    const data = {}
    if (nombre) data.nombre = nombre
    if (email) data.email = email
    if (role) data.role = role
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
      data.password = await bcrypt.hash(password, 12)
    }
    const user = await prisma.adminUser.update({ where: { id: parseInt(req.params.id) }, data })
    res.json({ id: user.id, nombre: user.nombre, email: user.email, role: user.role })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.delete('/usuarios/:id', requireSuperadmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.sub) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
    await prisma.adminUser.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

module.exports = router
