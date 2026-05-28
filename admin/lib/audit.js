// Helper unificado de auditoría. Emite entradas en ActivityLog con shape
// consistente. Captura IP y User-Agent del request. Aplica allowlist por
// entidad para que nunca queden datos sensibles (password, verifyCode, etc.)
// en los campos `antes` / `despues`.

const { prisma } = require('./db')
const { AsyncLocalStorage } = require('node:async_hooks')

// Permite que auditar() obtenga el req actual sin tener que recibirlo en
// cada llamada (útil para refactorizar logActividad sin tocar cada caller).
const reqStore = new AsyncLocalStorage()

// Express middleware: corre el resto del request dentro del contexto.
function withRequestContext(req, res, next) {
  reqStore.run(req, () => next())
}

function currentReq() {
  return reqStore.getStore() || null
}

// Campos que se permiten persistir en antes/despues por entidad.
// Cualquier otro campo se descarta antes de serializar.
const ALLOWLIST = {
  cita: ['serial', 'fecha', 'hora', 'tramite', 'status', 'origen', 'notas', 'documentosPendientes', 'valijaId', 'citizenId', 'nombreExterno', 'emailExterno', 'telefonoExterno', 'cedulaExterno', 'tipoDocumento', 'recordatorioEnviado'],
  ciudadano: ['nombre', 'apellido', 'email', 'telefono', 'cedula', 'tipoDocumento', 'esInvitado', 'verified'],
  usuario_admin: ['nombre', 'email', 'role', 'cargo', 'permisos'],
  banner: ['categoria', 'titulo', 'cuerpo', 'activo', 'orden'],
  valija: ['serial', 'estado', 'fechaEnvio', 'fechaRecepcion', 'notaInterna'],
  fecha_bloqueada: ['fecha', 'motivo'],
  setting: ['clave', 'valor'],
  reporte: ['nombreReporte', 'filtros', 'filas'],
  sesion: ['email', 'role'],
}

// Campos que JAMÁS se loguean aunque vengan en el objeto.
const BLOCKLIST = new Set(['password', 'verifyCode', 'verifyExpiry', 'buzonLastRead'])

function sanitize(obj, entidad) {
  if (!obj || typeof obj !== 'object') return null
  const allow = ALLOWLIST[entidad] || []
  const out = {}
  for (const k of allow) {
    if (BLOCKLIST.has(k)) continue
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return Object.keys(out).length ? out : null
}

function getIp(req) {
  if (!req) return null
  const xff = req.headers?.['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return req.ip || req.connection?.remoteAddress || null
}

function getUserAgent(req) {
  if (!req) return null
  const ua = req.headers?.['user-agent']
  return ua ? String(ua).slice(0, 500) : null
}

function getAutor(req) {
  const s = req?.session
  if (!s) return { id: null, nombre: 'sistema', role: null }
  return { id: s.sub || null, nombre: s.nombre || s.email || 'desconocido', role: s.role || null }
}

/**
 * Registra una entrada de auditoría.
 *
 * @param {Object} req  Express request (puede ser null en tareas de sistema)
 * @param {Object} opts {entidad, entidadId?, accion, antes?, despues?, tipo?, notaInterna?, ciudadanoEmail?, citaId?, datos?, autorOverride?}
 */
async function auditar(reqArg, opts = {}) {
  const req = reqArg || currentReq()
  try {
    const autor = opts.autorOverride || getAutor(req)
    const data = {
      tipo: opts.tipo || `${opts.entidad || 'evento'}_${opts.accion || 'desconocido'}`,
      entidad: opts.entidad || null,
      entidadId: opts.entidadId ? String(opts.entidadId) : null,
      accion: opts.accion || null,
      realizadoPor: autor.nombre,
      realizadoPorId: autor.id,
      ip: getIp(req),
      userAgent: getUserAgent(req),
      citaId: opts.citaId || null,
      ciudadanoEmail: opts.ciudadanoEmail || null,
      mensajeCiudadano: opts.mensajeCiudadano || null,
      notaInterna: opts.notaInterna || null,
      datos: opts.datos ? (typeof opts.datos === 'string' ? opts.datos : JSON.stringify(opts.datos)) : null,
      antes: opts.antes ? JSON.stringify(sanitize(opts.antes, opts.entidad) || opts.antes) : null,
      despues: opts.despues ? JSON.stringify(sanitize(opts.despues, opts.entidad) || opts.despues) : null,
    }
    return await prisma.activityLog.create({ data })
  } catch (err) {
    console.error('[audit] Error al registrar:', err.message)
  }
}

// Registra una entrada SessionLog (vía paralela para sesiones admin).
async function auditarSesionImpl(req, { adminUserId, email, nombre, role, tipo }) {
  try {
    return await prisma.sessionLog.create({
      data: {
        adminUserId: adminUserId || null,
        email,
        nombre: nombre || null,
        role: role || null,
        tipo,
        ip: getIp(req),
        userAgent: getUserAgent(req),
      },
    })
  } catch (err) {
    console.error('[audit] Error al registrar sesión:', err.message)
  }
}

async function auditarSesionWrapped(reqArg, opts) {
  const req = reqArg || currentReq()
  return auditarSesionImpl(req, opts)
}

module.exports = {
  auditar,
  auditarSesion: auditarSesionWrapped,
  sanitize,
  withRequestContext,
  currentReq,
}
