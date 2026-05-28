const express = require('express')
const router = express.Router()
const { prisma } = require('../lib/db')
const { requireAdmin } = require('../lib/auth')
const { sendAppointmentReceived, sendAppointmentConfirmation, sendCancellationEmail, sendNoShowEmail, sendInRevisionEmail, sendValijaSentEmail, sendReagendamiento, renderEmail } = require('../lib/email')
const { nextSerial: __nextSerial } = require('../lib/serial')
const { auditar } = require('../lib/audit')
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

// Wrapper compatible con las llamadas antiguas; usa auditar() por debajo
// para llenar también entidad/accion/ip/userAgent/antes/despues.
async function logActividad({ tipo, citaId, ciudadanoEmail, mensajeCiudadano, notaInterna, datos, realizadoPor, entidad, entidadId, accion, antes, despues }) {
  return auditar(null, {
    tipo, citaId, ciudadanoEmail, mensajeCiudadano, notaInterna, datos,
    entidad, entidadId, accion, antes, despues,
    autorOverride: realizadoPor ? { id: null, nombre: realizadoPor, role: null } : undefined,
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
    const { fecha, status, mes, fechaDesde, fechaHasta, origen } = req.query
    const page = Math.max(1, parseInt(req.query.page || '1'))
    const limit = 20
    const where = {}
    if (fecha) where.fecha = fecha
    if (status) where.status = status
    if (mes) where.fecha = { startsWith: mes }
    if (fechaDesde && fechaHasta) where.fecha = { gte: fechaDesde, lte: fechaHasta }
    else if (fechaDesde) where.fecha = { gte: fechaDesde }
    else if (fechaHasta) where.fecha = { lte: fechaHasta }
    if (origen === 'web' || origen === 'admin') where.origen = origen

    const [citas, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { citizen: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } }, valija: { select: { id: true, serial: true, estado: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ])
    res.json({ citas, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/citas', async (req, res) => {
  try {
    const { citizenId, nombreExterno, emailExterno, telefonoExterno, fecha, hora, tramite, notas } = req.body
    if (!hora || !tramite) return res.status(400).json({ error: 'Hora y trámite son obligatorios' })

    if (fecha) {
      const fd = new Date(fecha + 'T12:00:00')
      const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
      if (fd <= hoy) return res.status(400).json({ error: 'La fecha debe ser posterior al día de hoy.' })
      const dia = fd.getDay()
      if (dia === 0 || dia === 6) return res.status(400).json({ error: 'Solo se pueden agendar citas de lunes a viernes.' })
    }

    if (fecha && hora) {
      const ocupada = await prisma.appointment.findFirst({
        where: { fecha, hora, status: { notIn: ['cancelada', 'inasistencia'] } }
      })
      if (ocupada) return res.status(409).json({ error: `Ya existe una cita a las ${hora} el ${fecha}. Elige otra hora.` })
    }

    const { nextSerial } = require('../lib/serial')
    const serial = await nextSerial('VCNE')
    const cita = await prisma.appointment.create({
      data: {
        serial,
        citizenId: citizenId || null,
        nombreExterno: nombreExterno || null,
        emailExterno: emailExterno || null,
        telefonoExterno: telefonoExterno || null,
        fecha: fecha || null,
        hora, tramite, notas,
        origen: 'admin',
      },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })

    await logActividad({ tipo: 'creacion', entidad: 'cita', entidadId: cita.id, accion: 'crear', despues: cita, citaId: cita.id, ciudadanoEmail: getCitaEmail(cita), notaInterna: `Cita creada: ${tramite}${fecha ? ' el ' + fecha + ' a las ' + hora : ''}`, realizadoPor: getNombreAdmin(req.session) })

    const email = getCitaEmail(cita)
    if (email) sendAppointmentReceived(email, getCitaNombre(cita), cita).catch(console.error) // fire-and-forget

    res.json(cita)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/citas/:id', async (req, res) => {
  try {
    const { status, notas, fecha, hora, tramite, documentosPendientes } = req.body
    const id = req.params.id
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

    // Auditoría + correos según cambio de status (fire-and-forget en correos, no bloquean)
    if (status && status !== prev.status) {
      const email = getCitaEmail(cita)
      await logActividad({
        tipo: `status_${status}`, entidad: 'cita', entidadId: cita.id, accion: 'cambio_estado',
        antes: { status: prev.status }, despues: { status },
        citaId: cita.id, ciudadanoEmail: email,
        notaInterna: `Estado: ${prev.status} → ${status}`,
        realizadoPor: getNombreAdmin(req.session),
      })
      if (email && status === 'confirmada') sendAppointmentConfirmation(email, getCitaNombre(cita), cita).catch(console.error)
      if (status === 'inasistencia' && email) sendNoShowEmail(email, getCitaNombre(cita), cita).catch(console.error)
    }

    res.json(cita)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Ticket/correo de una cita renderizado como HTML (para ver dentro del panel)
const STATUS_TO_TEMPLATE = {
  pendiente: 'recibida', confirmada: 'confirmacion', completada: 'confirmacion',
  en_proceso: 'confirmacion', asistencia_tarde: 'confirmacion',
  cancelada: 'cancelacion', inasistencia: 'inasistencia',
}
router.get('/citas/:id/ticket', async (req, res) => {
  try {
    const cita = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })
    if (!cita) return res.status(404).send('Cita no encontrada')
    const tipo = STATUS_TO_TEMPLATE[cita.status] || 'recibida'
    const data = {
      nombre: getCitaNombre(cita),
      cita: { tramite: cita.tramite, fecha: cita.fecha || 'Por confirmar', hora: cita.hora },
    }
    const { html } = renderEmail(tipo, data)
    res.set('Content-Type', 'text/html; charset=utf-8').send(html)
  } catch (err) { console.error(err); res.status(500).send('Error del servidor') }
})

router.post('/citas/:id/cancelar', async (req, res) => {
  try {
    const { mensajeCiudadano, notaInterna } = req.body
    const id = req.params.id
    const cita = await prisma.appointment.findUnique({
      where: { id },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    if (cita.status === 'cancelada') return res.status(400).json({ error: 'La cita ya está cancelada' })

    await prisma.appointment.update({ where: { id }, data: { status: 'cancelada' } })

    const email = getCitaEmail(cita)
    if (email) sendCancellationEmail(email, getCitaNombre(cita), cita, mensajeCiudadano).catch(console.error) // fire-and-forget

    const log = await logActividad({
      tipo: 'cancelacion', entidad: 'cita', entidadId: id, accion: 'cambio_estado',
      antes: { status: cita.status }, despues: { status: 'cancelada' },
      citaId: id, ciudadanoEmail: email, mensajeCiudadano, notaInterna,
      datos: JSON.stringify({ tramite: cita.tramite, fecha: cita.fecha, hora: cita.hora }),
      realizadoPor: getNombreAdmin(req.session),
    })
    res.json({ ok: true, log })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/citas/:id/reagendar', async (req, res) => {
  try {
    const { nuevaFecha, nuevaHora, liberarPlaza, motivoNoLiberar, notaInterna } = req.body
    const id = req.params.id

    if (!nuevaFecha || !nuevaHora) return res.status(400).json({ error: 'Nueva fecha y nueva hora son obligatorias.' })
    const fd = new Date(nuevaFecha + 'T12:00:00')
    const hoyDt = new Date(); hoyDt.setHours(12, 0, 0, 0)
    if (fd <= hoyDt) return res.status(400).json({ error: 'La nueva fecha debe ser posterior al día de hoy.' })
    const dia = fd.getDay()
    if (dia === 0 || dia === 6) return res.status(400).json({ error: 'Solo se pueden agendar citas de lunes a viernes.' })

    const cita = await prisma.appointment.findUnique({
      where: { id },
      include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
    })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })

    // Conflicto de horario: no permitir colisión con otra cita activa
    const ocupada = await prisma.appointment.findFirst({
      where: { fecha: nuevaFecha, hora: nuevaHora, status: { notIn: ['cancelada', 'inasistencia'] }, NOT: { id } },
    })
    if (ocupada) return res.status(409).json({ error: `Ya existe una cita a las ${nuevaHora} el ${nuevaFecha}. Elige otro horario.` })

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
      tipo: 'reagendamiento', entidad: 'cita', entidadId: id, accion: 'editar',
      antes: { fecha: cita.fecha, hora: cita.hora, status: cita.status },
      despues: { fecha: nuevaFecha, hora: nuevaHora, status: 'pendiente' },
      citaId: id, ciudadanoEmail: getCitaEmail(cita), notaInterna,
      datos: JSON.stringify({ de: { fecha: cita.fecha, hora: cita.hora }, a: { fecha: nuevaFecha, hora: nuevaHora }, liberarPlaza, motivoNoLiberar }),
      realizadoPor: getNombreAdmin(req.session),
    })

    const email = getCitaEmail(citaActualizada)
    if (email) sendReagendamiento(email, getCitaNombre(citaActualizada), citaActualizada, cita.fecha, cita.hora, notaInterna).catch(console.error) // fire-and-forget

    res.json({ ok: true, cita: citaActualizada })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Borrado definitivo de una cita (irreversible). Solo superadmin.
// Borra ActivityLogs asociados y la propia Appointment. La valija no se toca:
// si era la única cita dentro, queda vacía y puede borrarse luego desde su módulo.
router.delete('/citas/:id', async (req, res) => {
  try {
    if (req.session?.role !== 'superadmin') return res.status(403).json({ error: 'Solo el superadministrador puede eliminar citas.' })
    const id = req.params.id
    const cita = await prisma.appointment.findUnique({ where: { id }, include: { citizen: { select: { email: true } } } })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    await prisma.activityLog.deleteMany({ where: { citaId: id } })
    await prisma.appointment.delete({ where: { id } })
    // Log fuera de la relación (citaId ya no existe): se registra como nota suelta
    await logActividad({
      tipo: 'cita_eliminada', entidad: 'cita', entidadId: id, accion: 'eliminar',
      antes: cita,
      ciudadanoEmail: cita.citizen?.email || cita.emailExterno || null,
      notaInterna: `Cita eliminada (${cita.serial || 'sin ticket'}) — ${cita.tramite}${cita.fecha ? ' del ' + cita.fecha + ' ' + cita.hora : ''}`,
      realizadoPor: getNombreAdmin(req.session),
    })
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── REGISTRO INCOMPLETO (citas con documentos pendientes) ──────────────────
router.get('/registro-incompleto', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'))
    const limit = 20
    const where = { NOT: { documentosPendientes: null }, status: { notIn: ['cancelada', 'completada'] } }
    const [citas, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { citizen: { select: { nombre: true, apellido: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ])
    res.json({ citas, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Tildar un documento como recibido (lo elimina del arreglo pendiente)
router.patch('/registro-incompleto/:id/doc', async (req, res) => {
  try {
    const { docIdx } = req.body
    if (docIdx === undefined) return res.status(400).json({ error: 'docIdx requerido' })
    const cita = await prisma.appointment.findUnique({ where: { id: req.params.id } })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    const docs = JSON.parse(cita.documentosPendientes || '[]')
    const docNombre = docs[parseInt(docIdx)]
    if (!docNombre) return res.status(400).json({ error: 'Documento no encontrado en el índice indicado' })
    docs.splice(parseInt(docIdx), 1)
    const newDocs = docs.length ? JSON.stringify(docs) : null
    await prisma.appointment.update({ where: { id: req.params.id }, data: { documentosPendientes: newDocs } })
    await logActividad({ tipo: 'documento_recibido', entidad: 'cita', entidadId: req.params.id, accion: 'editar', citaId: req.params.id, notaInterna: `Documento recibido: ${docNombre}`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true, docsRestantes: docs })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Finalizar una cita de registro incompleto (pasa a completada)
router.post('/registro-incompleto/:id/finalizar', async (req, res) => {
  try {
    const id = req.params.id
    const cita = await prisma.appointment.findUnique({ where: { id } })
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
    await prisma.appointment.update({ where: { id }, data: { status: 'completada' } })
    await logActividad({ tipo: 'registro_finalizado', entidad: 'cita', entidadId: id, accion: 'cambio_estado', antes: { status: cita.status }, despues: { status: 'completada' }, citaId: id, notaInterna: 'Cita finalizada desde Registro Incompleto', realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── BITÁCORA ───────────────────────────────────────────────────────────────
router.get('/bitacora', async (req, res) => {
  try {
    const { tipo } = req.query
    const page = Math.max(1, parseInt(req.query.page || '1'))
    const limit = 20
    const where = tipo ? { tipo } : {}
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { cita: { select: { tramite: true, fecha: true, hora: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ])
    res.json({ logs, total, page, pages: Math.ceil(total / limit) })
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
    const q = (req.query.q || '').trim()
    if (!q) return res.json(null)
    // Coincidencia exacta por correo si parece email; si no, búsqueda parcial en cédula/correo/nombre/apellido.
    let citizen = null
    if (q.includes('@')) {
      citizen = await prisma.citizen.findUnique({ where: { email: q } })
        || await prisma.citizen.findFirst({ where: { email: { contains: q } } })
    } else {
      citizen = await prisma.citizen.findFirst({
        where: { OR: [
          { cedula: { contains: q } },
          { nombre: { contains: q } },
          { apellido: { contains: q } },
          { email: { contains: q } },
        ] },
        orderBy: { createdAt: 'desc' },
      })
    }
    if (!citizen) return res.json(null)
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/ciudadanos/:id', async (req, res) => {
  try {
    const citizen = await prisma.citizen.findUnique({ where: { id: req.params.id }, include: { citas: { include: { valija: { select: { serial: true, estado: true } } }, orderBy: { createdAt: 'desc' }, take: 20 } } })
    if (!citizen) return res.status(404).json({ error: 'Ciudadano no encontrado' })
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/ciudadanos/:id', async (req, res) => {
  try {
    const { nombre, apellido, telefono, cedula, tipoDocumento, verified } = req.body
    const prev = await prisma.citizen.findUnique({ where: { id: req.params.id } })
    if (!prev) return res.status(404).json({ error: 'Ciudadano no encontrado' })
    const citizen = await prisma.citizen.update({ where: { id: req.params.id }, data: { nombre, apellido, telefono, cedula, tipoDocumento, verified } })
    await logActividad({
      tipo: 'ciudadano_editado', entidad: 'ciudadano', entidadId: req.params.id, accion: 'editar',
      antes: prev, despues: citizen,
      ciudadanoEmail: citizen.email,
      notaInterna: `Ciudadano editado: ${citizen.nombre} ${citizen.apellido}`,
      realizadoPor: getNombreAdmin(req.session),
    })
    const { password, verifyCode, verifyExpiry, ...safe } = citizen
    res.json(safe)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// Borrado definitivo de un ciudadano (irreversible). Solo superadmin.
// Por defecto bloquea si tiene citas asociadas. Con ?force=true cascada:
// borra todas sus citas (y sus ActivityLogs) + el ciudadano.
router.delete('/ciudadanos/:id', async (req, res) => {
  try {
    if (req.session?.role !== 'superadmin') return res.status(403).json({ error: 'Solo el superadministrador puede eliminar ciudadanos.' })
    const id = req.params.id
    const force = req.query.force === 'true'
    const citizen = await prisma.citizen.findUnique({ where: { id }, include: { _count: { select: { citas: true } } } })
    if (!citizen) return res.status(404).json({ error: 'Ciudadano no encontrado' })
    const totalCitas = citizen._count?.citas || 0
    if (totalCitas > 0 && !force) {
      return res.status(409).json({ error: `Este ciudadano tiene ${totalCitas} cita(s) asociada(s). Para eliminarlo igualmente y borrar todas sus citas, repita la operación confirmando.`, totalCitas })
    }
    if (totalCitas > 0) {
      const citas = await prisma.appointment.findMany({ where: { citizenId: id }, select: { id: true } })
      const citaIds = citas.map(c => c.id)
      await prisma.activityLog.deleteMany({ where: { citaId: { in: citaIds } } })
      await prisma.appointment.deleteMany({ where: { id: { in: citaIds } } })
    }
    await prisma.citizen.delete({ where: { id } })
    await logActividad({
      tipo: 'ciudadano_eliminado', entidad: 'ciudadano', entidadId: id, accion: 'eliminar',
      antes: { nombre: citizen.nombre, apellido: citizen.apellido, email: citizen.email },
      ciudadanoEmail: citizen.email,
      notaInterna: `Ciudadano eliminado: ${citizen.nombre} ${citizen.apellido} (${citizen.email})${totalCitas ? ' — con ' + totalCitas + ' cita(s) en cascada' : ''}`,
      realizadoPor: getNombreAdmin(req.session),
    })
    res.json({ ok: true, citasBorradas: totalCitas })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
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
    const banner = await prisma.banner.create({ data: { categoria: categoria || null, titulo, cuerpo, activo: activo ?? true, orden: orden ?? 0 } })
    await logActividad({ tipo: 'banner_creado', entidad: 'banner', entidadId: banner.id, accion: 'crear', despues: banner, notaInterna: `Banner creado: ${titulo}`, realizadoPor: getNombreAdmin(req.session) })
    res.json(banner)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.put('/banners/:id', async (req, res) => {
  try {
    const { categoria, titulo, cuerpo, activo, orden } = req.body
    const prev = await prisma.banner.findUnique({ where: { id: req.params.id } })
    if (!prev) return res.status(404).json({ error: 'Banner no encontrado' })
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: { categoria: categoria ?? undefined, titulo, cuerpo, activo, orden } })
    await logActividad({ tipo: 'banner_editado', entidad: 'banner', entidadId: banner.id, accion: 'editar', antes: prev, despues: banner, notaInterna: `Banner editado: ${banner.titulo}`, realizadoPor: getNombreAdmin(req.session) })
    res.json(banner)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.delete('/banners/:id', async (req, res) => {
  try {
    const prev = await prisma.banner.findUnique({ where: { id: req.params.id } })
    if (!prev) return res.status(404).json({ error: 'Banner no encontrado' })
    await prisma.banner.delete({ where: { id: req.params.id } })
    await logActividad({ tipo: 'banner_eliminado', entidad: 'banner', entidadId: req.params.id, accion: 'eliminar', antes: prev, notaInterna: `Banner eliminado: ${prev.titulo}`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true })
  }
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
    const fb = await prisma.blockedDate.upsert({ where: { fecha }, update: { motivo }, create: { fecha, motivo } })
    await logActividad({ tipo: 'fecha_bloqueada', entidad: 'fecha_bloqueada', entidadId: fb.id, accion: 'crear', despues: fb, notaInterna: `Fecha bloqueada: ${fecha}${motivo ? ' (' + motivo + ')' : ''}`, realizadoPor: getNombreAdmin(req.session) })
    res.json(fb)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})
router.delete('/fechas-bloqueadas', async (req, res) => {
  try {
    const prev = await prisma.blockedDate.findUnique({ where: { fecha: req.body.fecha } })
    if (!prev) return res.status(404).json({ error: 'Fecha no encontrada' })
    await prisma.blockedDate.delete({ where: { fecha: req.body.fecha } })
    await logActividad({ tipo: 'fecha_desbloqueada', entidad: 'fecha_bloqueada', entidadId: prev.id, accion: 'eliminar', antes: prev, notaInterna: `Fecha desbloqueada: ${prev.fecha}`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true })
  }
  catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── USUARIOS (solo superadmin) ─────────────────────────────────────────────
const MODULOS_VALIDOS = ['dashboard', 'ciudadanos', 'banners', 'fechas_bloqueadas', 'citas', 'usuarios', 'valijas', 'crm', 'buzon', 'reporteria']

function requireSuperadmin(req, res, next) {
  if (req.session?.role !== 'superadmin') return res.status(403).json({ error: 'No autorizado' })
  next()
}

router.get('/usuarios', requireSuperadmin, async (req, res) => {
  try {
    const usuarios = await prisma.adminUser.findMany({
      select: { id: true, nombre: true, email: true, role: true, cargo: true, permisos: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(usuarios)
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.post('/usuarios', requireSuperadmin, async (req, res) => {
  try {
    const { nombre, email, password, role, cargo, permisos } = req.body
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' })
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })
    const hashed = await bcrypt.hash(password, 12)
    const permisosLimpios = Array.isArray(permisos) ? permisos.filter(p => MODULOS_VALIDOS.includes(p)) : []
    const user = await prisma.adminUser.create({
      data: { nombre, email, password: hashed, role: role || 'asistente', cargo: cargo || null, permisos: permisosLimpios },
    })
    // Transacción general (auditoría 360°)
    await logActividad({
      tipo: 'usuario_admin_creado', entidad: 'usuario_admin', entidadId: user.id, accion: 'crear',
      despues: user,
      ciudadanoEmail: user.email,
      notaInterna: `Usuario admin creado: ${user.email} (${user.role})`,
      realizadoPor: getNombreAdmin(req.session),
    })
    // Transacción específica para alta de gestor (dato delicado: acceso operativo)
    if (user.role === 'asistente') {
      await logActividad({
        tipo: 'gestor_alta', entidad: 'usuario_admin', entidadId: user.id, accion: 'alta_gestor',
        despues: { email: user.email, nombre: user.nombre, cargo: user.cargo, permisos: user.permisos },
        ciudadanoEmail: user.email,
        notaInterna: `ALTA DE GESTOR: ${user.nombre} (${user.email}) — ${user.cargo || 'sin cargo'} — Módulos: [${(user.permisos || []).join(', ') || 'ninguno'}]`,
        realizadoPor: getNombreAdmin(req.session),
      })
    }
    res.json({ id: user.id, nombre: user.nombre, email: user.email, role: user.role, cargo: user.cargo, permisos: user.permisos, createdAt: user.createdAt })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.put('/usuarios/:id', requireSuperadmin, async (req, res) => {
  try {
    const { nombre, email, role, cargo, permisos, password } = req.body
    const targetId = req.params.id
    const prev = await prisma.adminUser.findUnique({ where: { id: targetId } })
    if (!prev) return res.status(404).json({ error: 'Usuario no encontrado' })
    const data = {}
    if (nombre) data.nombre = nombre
    if (email) data.email = email
    if (cargo !== undefined) data.cargo = cargo || null
    if (Array.isArray(permisos)) data.permisos = permisos.filter(p => MODULOS_VALIDOS.includes(p))
    if (role) {
      if (targetId === req.session.sub) return res.status(400).json({ error: 'No puedes cambiar el rol de tu propia cuenta' })
      data.role = role
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
      data.password = await bcrypt.hash(password, 12)
    }
    const user = await prisma.adminUser.update({ where: { id: targetId }, data })
    const cambioPermisos = (role && role !== prev.role) || (Array.isArray(permisos) && JSON.stringify(prev.permisos) !== JSON.stringify(user.permisos))
    await logActividad({
      tipo: cambioPermisos ? 'usuario_admin_permisos' : 'usuario_admin_editado',
      entidad: 'usuario_admin', entidadId: targetId,
      accion: cambioPermisos ? 'cambio_permisos' : 'editar',
      antes: prev, despues: user,
      ciudadanoEmail: user.email,
      notaInterna: cambioPermisos
        ? `Permisos/rol modificados para ${user.email}: ${prev.role}→${user.role}; permisos [${prev.permisos.join(',')}]→[${user.permisos.join(',')}]${password ? ' + nueva contraseña' : ''}`
        : `Usuario admin editado: ${user.email}${password ? ' (nueva contraseña)' : ''}`,
      realizadoPor: getNombreAdmin(req.session),
    })
    // Transacciones específicas si cruzaron el umbral de "gestor"
    if (prev.role !== 'asistente' && user.role === 'asistente') {
      await logActividad({
        tipo: 'gestor_alta', entidad: 'usuario_admin', entidadId: targetId, accion: 'alta_gestor',
        antes: { role: prev.role }, despues: { role: user.role, permisos: user.permisos },
        ciudadanoEmail: user.email,
        notaInterna: `ALTA DE GESTOR (por cambio de rol): ${user.nombre} (${user.email}) — ${prev.role}→asistente — Módulos: [${(user.permisos || []).join(', ')}]`,
        realizadoPor: getNombreAdmin(req.session),
      })
    } else if (prev.role === 'asistente' && user.role !== 'asistente') {
      await logActividad({
        tipo: 'gestor_baja', entidad: 'usuario_admin', entidadId: targetId, accion: 'baja_gestor',
        antes: { role: prev.role, permisos: prev.permisos }, despues: { role: user.role },
        ciudadanoEmail: user.email,
        notaInterna: `BAJA DE GESTOR (por cambio de rol): ${user.nombre} (${user.email}) — asistente→${user.role}`,
        realizadoPor: getNombreAdmin(req.session),
      })
    }
    res.json({ id: user.id, nombre: user.nombre, email: user.email, role: user.role, cargo: user.cargo, permisos: user.permisos })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

router.delete('/usuarios/:id', requireSuperadmin, async (req, res) => {
  try {
    if (req.params.id === req.session.sub) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
    const prev = await prisma.adminUser.findUnique({ where: { id: req.params.id } })
    if (!prev) return res.status(404).json({ error: 'Usuario no encontrado' })
    await prisma.adminUser.delete({ where: { id: req.params.id } })
    // Transacción general (auditoría 360°)
    await logActividad({
      tipo: 'usuario_admin_eliminado', entidad: 'usuario_admin', entidadId: req.params.id, accion: 'eliminar',
      antes: prev,
      ciudadanoEmail: prev.email,
      notaInterna: `Usuario admin eliminado: ${prev.email} (${prev.role})`,
      realizadoPor: getNombreAdmin(req.session),
    })
    // Transacción específica para baja de gestor (cierre de acceso operativo)
    if (prev.role === 'asistente') {
      await logActividad({
        tipo: 'gestor_baja', entidad: 'usuario_admin', entidadId: req.params.id, accion: 'baja_gestor',
        antes: { email: prev.email, nombre: prev.nombre, cargo: prev.cargo, permisos: prev.permisos },
        ciudadanoEmail: prev.email,
        notaInterna: `BAJA DE GESTOR: ${prev.nombre} (${prev.email}) — Módulos al momento de la baja: [${(prev.permisos || []).join(', ') || 'ninguno'}]`,
        realizadoPor: getNombreAdmin(req.session),
      })
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: 'Error del servidor' }) }
})

// ── VALIJA DIPLOMÁTICA ─────────────────────────────────────────────────────
// Una valija agrupa varias citas atendidas (status completada) listas para enviar al
// Consulado General. Flujo: abierta → enviada → recibida (al recibir, los ciudadanos
// reciben correo "en revisión").

// Listado paginado
router.get('/valijas', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'))
    const limit = 20
    const estado = req.query.estado || undefined
    const where = estado ? { estado } : {}
    const [valijas, total] = await Promise.all([
      prisma.valija.findMany({
        where,
        include: { _count: { select: { citas: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.valija.count({ where }),
    ])
    res.json({ valijas, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Detalle con citas
router.get('/valijas/:id', async (req, res) => {
  try {
    const valija = await prisma.valija.findUnique({
      where: { id: req.params.id },
      include: { citas: { include: { citizen: { select: { nombre: true, apellido: true, email: true } } }, orderBy: { fecha: 'asc' } } },
    })
    if (!valija) return res.status(404).json({ error: 'Valija no encontrada' })
    res.json(valija)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Cierra el día: agrupa todas las citas COMPLETADAS sin valija en una nueva valija.
// (Opcional ?fecha=YYYY-MM-DD para acotar a un día; por defecto, todas las que falten.)
router.post('/valijas/cerrar-dia', async (req, res) => {
  try {
    const { fecha, notaInterna } = req.body || {}
    const where = { status: 'completada', valijaId: null }
    if (fecha) where.fecha = fecha
    const pendientes = await prisma.appointment.findMany({ where, select: { id: true } })
    if (!pendientes.length) return res.status(400).json({ error: 'No hay citas completadas sin valija para agrupar.' })

    const serial = await __nextSerial('VAL')
    const valija = await prisma.valija.create({
      data: { serial, estado: 'abierta', notaInterna: notaInterna || null },
    })
    await prisma.appointment.updateMany({
      where: { id: { in: pendientes.map(p => p.id) } },
      data: { valijaId: valija.id },
    })
    await logActividad({
      tipo: 'valija_creada', entidad: 'valija', entidadId: valija.id, accion: 'crear',
      despues: { serial, estado: 'abierta', totalCitas: pendientes.length },
      notaInterna: `Valija ${serial} creada con ${pendientes.length} trámite(s)${fecha ? ' del ' + fecha : ''}`,
      realizadoPor: getNombreAdmin(req.session),
    })
    res.json({ ok: true, valija: { ...valija, totalCitas: pendientes.length } })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Marca la valija como ENVIADA (al Consulado General) y notifica a cada ciudadano
router.post('/valijas/:id/enviar', async (req, res) => {
  try {
    const id = req.params.id
    const v = await prisma.valija.findUnique({
      where: { id },
      include: { citas: { include: { citizen: { select: { nombre: true, apellido: true, email: true } } } } },
    })
    if (!v) return res.status(404).json({ error: 'Valija no encontrada' })
    if (v.estado !== 'abierta') return res.status(400).json({ error: `La valija ya está en estado "${v.estado}"` })

    const updated = await prisma.valija.update({ where: { id }, data: { estado: 'enviada', fechaEnvio: new Date() } })

    // Notificación a cada ciudadano con correo (fire-and-forget)
    for (const c of v.citas) {
      const email = getCitaEmail(c)
      if (email) sendValijaSentEmail(email, getCitaNombre(c), { tramite: c.tramite, fecha: c.fecha, hora: c.hora, serial: c.serial }, v.serial).catch(console.error)
    }
    const notificados = v.citas.filter(c => getCitaEmail(c)).length

    await logActividad({ tipo: 'valija_enviada', entidad: 'valija', entidadId: id, accion: 'cambio_estado', antes: { estado: 'abierta' }, despues: { estado: 'enviada' }, notaInterna: `Valija ${v.serial} enviada al Consulado General — notificados ${notificados} ciudadano(s)`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true, valija: updated, notificados })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Marca la valija como RECIBIDA: dispara correo "en revisión" a cada ciudadano
router.post('/valijas/:id/recibir', async (req, res) => {
  try {
    const id = req.params.id
    const v = await prisma.valija.findUnique({
      where: { id },
      include: { citas: { include: { citizen: { select: { nombre: true, apellido: true, email: true } } } } },
    })
    if (!v) return res.status(404).json({ error: 'Valija no encontrada' })
    if (v.estado === 'recibida') return res.status(400).json({ error: 'La valija ya está recibida' })
    if (v.estado !== 'enviada') return res.status(400).json({ error: 'Solo se puede recibir una valija que ya fue enviada' })

    const updated = await prisma.valija.update({ where: { id }, data: { estado: 'recibida', fechaRecepcion: new Date() } })
    // Notificaciones a cada ciudadano (fire-and-forget)
    for (const c of v.citas) {
      const email = getCitaEmail(c)
      if (email) sendInRevisionEmail(email, getCitaNombre(c), { tramite: c.tramite, fecha: c.fecha, hora: c.hora, serial: c.serial }, v.serial).catch(console.error)
    }
    await logActividad({ tipo: 'valija_recibida', entidad: 'valija', entidadId: id, accion: 'cambio_estado', antes: { estado: 'enviada' }, despues: { estado: 'recibida' }, notaInterna: `Valija ${v.serial} recibida en Consulado General — notificados ${v.citas.length} ciudadano(s)`, realizadoPor: getNombreAdmin(req.session) })
    res.json({ ok: true, valija: updated, notificados: v.citas.filter(c => getCitaEmail(c)).length })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// Ticket imprimible de la valija
router.get('/valijas/:id/ticket', async (req, res) => {
  try {
    const v = await prisma.valija.findUnique({
      where: { id: req.params.id },
      include: { citas: { include: { citizen: { select: { nombre: true, apellido: true, email: true } } }, orderBy: { fecha: 'asc' } } },
    })
    if (!v) return res.status(404).send('Valija no encontrada')
    const filas = v.citas.map((c, i) => `
      <tr>
        <td>${i + 1}</td><td>${c.serial || '—'}</td><td>${getCitaNombre(c)}</td>
        <td>${c.tramite}</td><td>${c.fecha || '—'} ${c.hora || ''}</td>
      </tr>`).join('')
    const fmt = d => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
    res.set('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Valija ${v.serial}</title>
<style>
body{font-family:Georgia,serif;color:#222;max-width:780px;margin:24px auto;padding:0 18px}
.brand{border-bottom:4px solid #C9A227;padding-bottom:10px;margin-bottom:18px}
.brand h1{color:#AA151B;margin:0;font-size:22px}
.brand .sub{color:#666;font-size:13px;font-family:Arial,sans-serif}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin:18px 0;font-family:Arial,sans-serif;font-size:14px}
.meta b{color:#AA151B}
table{width:100%;border-collapse:collapse;margin-top:10px;font-family:Arial,sans-serif;font-size:13px}
th,td{border:1px solid #ccc;padding:7px 9px;text-align:left}
th{background:#faf8f3;color:#AA151B}
.estado{display:inline-block;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:bold;color:#fff}
.e-abierta{background:#f59e0b}.e-enviada{background:#3b82f6}.e-recibida{background:#16a34a}
button{background:#AA151B;color:#fff;border:0;padding:9px 18px;border-radius:6px;cursor:pointer;font-family:Georgia,serif}
@media print { button{display:none} }
</style></head><body>
<button onclick="window.print()">Imprimir ticket</button>
<div class="brand">
  <h1>Valija Diplomática · ${v.serial}</h1>
  <div class="sub">Viceconsulado Honorario de España · Porlamar, Nueva Esparta</div>
</div>
<div class="meta">
  <div><b>Estado:</b> <span class="estado e-${v.estado}">${v.estado.toUpperCase()}</span></div>
  <div><b>Trámites en valija:</b> ${v.citas.length}</div>
  <div><b>Creada:</b> ${fmt(v.createdAt)}</div>
  <div><b>Enviada:</b> ${fmt(v.fechaEnvio)}</div>
  <div><b>Recibida:</b> ${fmt(v.fechaRecepcion)}</div>
  <div><b>Nota interna:</b> ${v.notaInterna || '—'}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Folio</th><th>Ciudadano</th><th>Trámite</th><th>Cita</th></tr></thead>
  <tbody>${filas || '<tr><td colspan="5" style="text-align:center;color:#999">Sin trámites</td></tr>'}</tbody>
</table>
<p style="margin-top:20px;font-family:Arial,sans-serif;font-size:11px;color:#888;text-align:center">Documento institucional generado automáticamente.</p>
</body></html>`)
  } catch (err) { console.error(err); res.status(500).send('Error del servidor') }
})

module.exports = router
