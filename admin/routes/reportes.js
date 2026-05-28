// Endpoints de Reportería. Todos requieren rol superadmin.
// Por cada reporte: GET /listar (paginado + filtros) y GET /export (XLSX).
// Cada export queda registrado en ActivityLog con entidad=reporte/accion=exportar.

const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const { prisma } = require('../lib/db')
const { auditar } = require('../lib/audit')

// Acceso granular por permiso fino. Superadmin pasa siempre.
// Cada reporte tiene su permiso específico: reporteria_<tipo>.
// El permiso legacy 'reporteria' (genérico) sigue otorgando acceso a los 4
// reportes (cuentas creadas antes de la segmentación).
function tienePermiso(perms, permFino) {
  if (!Array.isArray(perms)) return false
  return perms.includes(permFino) || perms.includes('reporteria')
}

function requirePermiso(permFino) {
  return (req, res, next) => {
    const s = req.session
    if (!s) return res.status(401).json({ error: 'No autenticado' })
    if (s.role === 'superadmin') return next()
    if (Array.isArray(s.permisos) && tienePermiso(s.permisos, permFino)) return next()
    prisma.adminUser.findUnique({ where: { id: s.sub }, select: { permisos: true, role: true } })
      .then(u => {
        if (!u) return res.status(401).json({ error: 'Cuenta no existe' })
        if (u.role === 'superadmin' || tienePermiso(u.permisos, permFino)) {
          req.session.permisos = u.permisos
          return next()
        }
        return res.status(403).json({ error: `Acceso denegado. Falta el permiso "${permFino}".` })
      })
      .catch(err => { console.error(err); res.status(500).json({ error: 'Error del servidor' }) })
  }
}

// ── Helpers comunes ────────────────────────────────────────────────────────
function parsePage(req, def = 50) {
  const page = Math.max(1, parseInt(req.query.page || '1'))
  const limit = Math.min(200, Math.max(10, parseInt(req.query.limit || String(def))))
  return { page, limit, skip: (page - 1) * limit }
}

async function enviarExcel(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  await workbook.xlsx.write(res)
  res.end()
}

function aplicarEstiloHeader(ws) {
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAA151B' } }
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 22
}

function logExport(req, nombreReporte, filtros, filas) {
  return auditar(req, {
    tipo: `export_${nombreReporte}`,
    entidad: 'reporte', accion: 'exportar',
    despues: { nombreReporte, filtros, filas },
    notaInterna: `Exportación XLSX del reporte "${nombreReporte}" — ${filas} fila(s)`,
  })
}

// ── 1. REPORTE CIUDADANOS ──────────────────────────────────────────────────
function whereCiudadanos(q) {
  const where = {}
  if (q.q) {
    where.OR = [
      { nombre: { contains: q.q, mode: 'insensitive' } },
      { apellido: { contains: q.q, mode: 'insensitive' } },
      { email: { contains: q.q, mode: 'insensitive' } },
      { cedula: { contains: q.q, mode: 'insensitive' } },
    ]
  }
  if (q.tipoDocumento) where.tipoDocumento = q.tipoDocumento
  if (q.verified === 'true') where.verified = true
  else if (q.verified === 'false') where.verified = false
  if (q.esInvitado === 'true') where.esInvitado = true
  else if (q.esInvitado === 'false') where.esInvitado = false
  if (q.desde || q.hasta) {
    where.createdAt = {}
    if (q.desde) where.createdAt.gte = new Date(q.desde + 'T00:00:00')
    if (q.hasta) where.createdAt.lte = new Date(q.hasta + 'T23:59:59')
  }
  return where
}

router.get('/ciudadanos', requirePermiso('reporteria_ciudadanos'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req)
    const where = whereCiudadanos(req.query)
    const [ciudadanos, total] = await Promise.all([
      prisma.citizen.findMany({
        where,
        select: { id: true, nombre: true, apellido: true, email: true, telefono: true, cedula: true, tipoDocumento: true, esInvitado: true, verified: true, createdAt: true, _count: { select: { citas: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      prisma.citizen.count({ where }),
    ])
    res.json({ ciudadanos, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/ciudadanos/export', requirePermiso('reporteria_ciudadanos'), async (req, res) => {
  try {
    const where = whereCiudadanos(req.query)
    const data = await prisma.citizen.findMany({
      where,
      include: { citas: { select: { tramite: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    })
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Viceconsulado Honorario de España'
    wb.created = new Date()
    const ws = wb.addWorksheet('Ciudadanos')
    ws.columns = [
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Apellido', key: 'apellido', width: 22 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Teléfono', key: 'telefono', width: 18 },
      { header: 'Tipo doc.', key: 'tipoDocumento', width: 14 },
      { header: 'Nº doc.', key: 'cedula', width: 16 },
      { header: 'Invitado', key: 'esInvitado', width: 10 },
      { header: 'Verificado', key: 'verified', width: 12 },
      { header: 'Fecha registro', key: 'createdAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Total citas', key: 'totalCitas', width: 12 },
      { header: 'Último trámite', key: 'ultimoTramite', width: 26 },
      { header: 'Último estado', key: 'ultimoEstado', width: 16 },
    ]
    data.forEach(c => ws.addRow({
      nombre: c.nombre, apellido: c.apellido, email: c.email, telefono: c.telefono || '',
      tipoDocumento: c.tipoDocumento || '', cedula: c.cedula || '',
      esInvitado: c.esInvitado ? 'Sí' : 'No', verified: c.verified ? 'Sí' : 'No',
      createdAt: c.createdAt,
      totalCitas: c.citas?.length || 0,
      ultimoTramite: c.citas?.[0]?.tramite || '—',
      ultimoEstado: c.citas?.[0]?.status || '—',
    }))
    aplicarEstiloHeader(ws)
    await logExport(req, 'ciudadanos', req.query, data.length)
    await enviarExcel(res, wb, `ciudadanos-${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── 2. REPORTE CITAS ───────────────────────────────────────────────────────
function whereCitas(q) {
  const where = {}
  if (q.status) where.status = q.status
  if (q.origen === 'web' || q.origen === 'admin') where.origen = q.origen
  if (q.tramite) where.tramite = { contains: q.tramite, mode: 'insensitive' }
  if (q.fechaDesde || q.fechaHasta) {
    where.fecha = {}
    if (q.fechaDesde) where.fecha.gte = q.fechaDesde
    if (q.fechaHasta) where.fecha.lte = q.fechaHasta
  }
  if (q.solicitudDesde || q.solicitudHasta) {
    where.createdAt = {}
    if (q.solicitudDesde) where.createdAt.gte = new Date(q.solicitudDesde + 'T00:00:00')
    if (q.solicitudHasta) where.createdAt.lte = new Date(q.solicitudHasta + 'T23:59:59')
  }
  if (q.ciudadano) {
    where.OR = [
      { nombreExterno: { contains: q.ciudadano, mode: 'insensitive' } },
      { emailExterno: { contains: q.ciudadano, mode: 'insensitive' } },
      { citizen: { OR: [
        { nombre: { contains: q.ciudadano, mode: 'insensitive' } },
        { apellido: { contains: q.ciudadano, mode: 'insensitive' } },
        { email: { contains: q.ciudadano, mode: 'insensitive' } },
      ] } },
    ]
  }
  if (q.valijaSerial) where.valija = { serial: { contains: q.valijaSerial, mode: 'insensitive' } }
  return where
}

router.get('/citas', requirePermiso('reporteria_citas'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req)
    const where = whereCitas(req.query)
    const [citas, total, resumen] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: { citizen: { select: { nombre: true, apellido: true, email: true, telefono: true } }, valija: { select: { serial: true, estado: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      prisma.appointment.count({ where }),
      prisma.appointment.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ])
    const resumenObj = {}
    resumen.forEach(r => { resumenObj[r.status] = r._count._all })
    res.json({ citas, total, page, pages: Math.ceil(total / limit), resumen: resumenObj })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/citas/export', requirePermiso('reporteria_citas'), async (req, res) => {
  try {
    const where = whereCitas(req.query)
    const data = await prisma.appointment.findMany({
      where,
      include: { citizen: { select: { nombre: true, apellido: true, email: true, telefono: true } }, valija: { select: { serial: true, estado: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Viceconsulado Honorario de España'
    wb.created = new Date()
    const ws = wb.addWorksheet('Citas')
    ws.columns = [
      { header: 'Ticket', key: 'ticket', width: 18 },
      { header: 'Folio valija', key: 'folio', width: 18 },
      { header: 'Estado valija', key: 'estadoValija', width: 14 },
      { header: 'Estado cita', key: 'status', width: 16 },
      { header: 'Ciudadano', key: 'ciudadano', width: 28 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'telefono', width: 18 },
      { header: 'Trámite', key: 'tramite', width: 32 },
      { header: 'Fecha cita', key: 'fecha', width: 12 },
      { header: 'Hora', key: 'hora', width: 8 },
      { header: 'Origen', key: 'origen', width: 10 },
      { header: 'Fecha solicitud', key: 'solicitud', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Última actualización', key: 'updatedAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    ]
    data.forEach(c => ws.addRow({
      ticket: c.serial || '',
      folio: c.valija?.serial || '',
      estadoValija: c.valija?.estado || '',
      status: c.status,
      ciudadano: c.citizen ? `${c.citizen.nombre} ${c.citizen.apellido}` : (c.nombreExterno || ''),
      email: c.citizen?.email || c.emailExterno || '',
      telefono: c.citizen?.telefono || c.telefonoExterno || '',
      tramite: c.tramite,
      fecha: c.fecha || '',
      hora: c.hora,
      origen: c.origen || 'admin',
      solicitud: c.createdAt,
      updatedAt: c.updatedAt,
    }))
    aplicarEstiloHeader(ws)
    await logExport(req, 'citas', req.query, data.length)
    await enviarExcel(res, wb, `citas-${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── 3. REPORTE MAESTRO DE TRÁMITES ─────────────────────────────────────────
router.get('/maestro', requirePermiso('reporteria_maestro'), async (req, res) => {
  try {
    const where = {}
    if (req.query.activo === 'true') where.activo = true
    else if (req.query.activo === 'false') where.activo = false
    if (req.query.categoria) where.categoria = req.query.categoria
    if (req.query.q) {
      where.OR = [
        { codigo: { contains: req.query.q, mode: 'insensitive' } },
        { nombre: { contains: req.query.q, mode: 'insensitive' } },
      ]
    }
    const tramites = await prisma.tramiteMaestro.findMany({ where, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] })
    // Cruzar con volumetría
    const inicioAno = new Date(new Date().getFullYear(), 0, 1)
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const filas = await Promise.all(tramites.map(async t => {
      const [vol30, volAno] = await Promise.all([
        prisma.appointment.count({ where: { tramite: t.nombre, createdAt: { gte: hace30 } } }),
        prisma.appointment.count({ where: { tramite: t.nombre, createdAt: { gte: inicioAno } } }),
      ])
      return { ...t, volumen30d: vol30, volumenAno: volAno }
    }))
    res.json({ tramites: filas, total: filas.length })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/maestro/export', requirePermiso('reporteria_maestro'), async (req, res) => {
  try {
    const tramites = await prisma.tramiteMaestro.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] })
    const inicioAno = new Date(new Date().getFullYear(), 0, 1)
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const filas = await Promise.all(tramites.map(async t => {
      const [vol30, volAno] = await Promise.all([
        prisma.appointment.count({ where: { tramite: t.nombre, createdAt: { gte: hace30 } } }),
        prisma.appointment.count({ where: { tramite: t.nombre, createdAt: { gte: inicioAno } } }),
      ])
      return { ...t, volumen30d: vol30, volumenAno: volAno }
    }))
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Viceconsulado Honorario de España'
    wb.created = new Date()
    const ws = wb.addWorksheet('Trámites')
    ws.columns = [
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Nombre', key: 'nombre', width: 32 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Requisitos', key: 'requisitos', width: 60 },
      { header: 'Duración (min)', key: 'duracionEstimada', width: 14 },
      { header: 'Activo', key: 'activo', width: 10 },
      { header: 'Volumen 30d', key: 'volumen30d', width: 14 },
      { header: 'Volumen año', key: 'volumenAno', width: 14 },
    ]
    filas.forEach(t => ws.addRow({
      codigo: t.codigo, nombre: t.nombre, categoria: t.categoria || '',
      descripcion: t.descripcion || '',
      requisitos: (t.requisitos || []).join(' · '),
      duracionEstimada: t.duracionEstimada || '',
      activo: t.activo ? 'Sí' : 'No',
      volumen30d: t.volumen30d, volumenAno: t.volumenAno,
    }))
    aplicarEstiloHeader(ws)
    // Hoja paralela con requisitos desnormalizados (uno por fila)
    const ws2 = wb.addWorksheet('Requisitos (desnormalizado)')
    ws2.columns = [
      { header: 'Código trámite', key: 'codigo', width: 14 },
      { header: 'Trámite', key: 'tramite', width: 32 },
      { header: 'Requisito', key: 'requisito', width: 60 },
    ]
    filas.forEach(t => (t.requisitos || []).forEach(r => ws2.addRow({ codigo: t.codigo, tramite: t.nombre, requisito: r })))
    aplicarEstiloHeader(ws2)
    await logExport(req, 'maestro', req.query, filas.length)
    await enviarExcel(res, wb, `maestro-tramites-${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

// ── 4. REPORTE AUDITORÍA (cambios + sesiones) ──────────────────────────────
function whereAuditoria(q) {
  const where = {}
  if (q.entidad) where.entidad = q.entidad
  if (q.accion) where.accion = q.accion
  if (q.realizadoPor) where.realizadoPor = { contains: q.realizadoPor, mode: 'insensitive' }
  if (q.ciudadanoEmail) where.ciudadanoEmail = { contains: q.ciudadanoEmail, mode: 'insensitive' }
  if (q.ip) where.ip = { contains: q.ip }
  if (q.desde || q.hasta) {
    where.createdAt = {}
    if (q.desde) where.createdAt.gte = new Date(q.desde + 'T00:00:00')
    if (q.hasta) where.createdAt.lte = new Date(q.hasta + 'T23:59:59')
  }
  return where
}

router.get('/auditoria', requirePermiso('reporteria_auditoria'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req)
    const where = whereAuditoria(req.query)
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.activityLog.count({ where }),
    ])
    res.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/auditoria/export', requirePermiso('reporteria_auditoria'), async (req, res) => {
  try {
    const where = whereAuditoria(req.query)
    const data = await prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' } })
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Viceconsulado Honorario de España'
    wb.created = new Date()
    const ws = wb.addWorksheet('Auditoría')
    ws.columns = [
      { header: 'Fecha', key: 'createdAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm:ss' } },
      { header: 'Autor', key: 'realizadoPor', width: 22 },
      { header: 'Rol', key: 'rol', width: 14 },
      { header: 'IP', key: 'ip', width: 16 },
      { header: 'Entidad', key: 'entidad', width: 16 },
      { header: 'ID afectado', key: 'entidadId', width: 24 },
      { header: 'Acción', key: 'accion', width: 16 },
      { header: 'Email ciudadano', key: 'ciudadanoEmail', width: 28 },
      { header: 'Nota interna', key: 'notaInterna', width: 50 },
      { header: 'Antes (JSON)', key: 'antes', width: 40 },
      { header: 'Después (JSON)', key: 'despues', width: 40 },
    ]
    data.forEach(l => ws.addRow({
      createdAt: l.createdAt,
      realizadoPor: l.realizadoPor || '',
      rol: '',
      ip: l.ip || '',
      entidad: l.entidad || '',
      entidadId: l.entidadId || '',
      accion: l.accion || l.tipo,
      ciudadanoEmail: l.ciudadanoEmail || '',
      notaInterna: l.notaInterna || '',
      antes: l.antes || '',
      despues: l.despues || '',
    }))
    aplicarEstiloHeader(ws)
    // Hoja paralela con SessionLog
    const sesiones = await prisma.sessionLog.findMany({ orderBy: { createdAt: 'desc' } })
    const ws2 = wb.addWorksheet('Sesiones admin')
    ws2.columns = [
      { header: 'Fecha', key: 'createdAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm:ss' } },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Rol', key: 'role', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'IP', key: 'ip', width: 16 },
      { header: 'User-Agent', key: 'userAgent', width: 40 },
    ]
    sesiones.forEach(s => ws2.addRow({ createdAt: s.createdAt, email: s.email, nombre: s.nombre || '', role: s.role || '', tipo: s.tipo, ip: s.ip || '', userAgent: s.userAgent || '' }))
    aplicarEstiloHeader(ws2)
    await logExport(req, 'auditoria', req.query, data.length)
    await enviarExcel(res, wb, `auditoria-${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

router.get('/auditoria/sesiones', requirePermiso('reporteria_auditoria'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req)
    const where = {}
    if (req.query.email) where.email = { contains: req.query.email, mode: 'insensitive' }
    if (req.query.tipo) where.tipo = req.query.tipo
    if (req.query.desde || req.query.hasta) {
      where.createdAt = {}
      if (req.query.desde) where.createdAt.gte = new Date(req.query.desde + 'T00:00:00')
      if (req.query.hasta) where.createdAt.lte = new Date(req.query.hasta + 'T23:59:59')
    }
    const [sesiones, total] = await Promise.all([
      prisma.sessionLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.sessionLog.count({ where }),
    ])
    res.json({ sesiones, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }) }
})

module.exports = router
