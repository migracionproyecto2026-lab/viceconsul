const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const COOKIE_NAME = 'auth_token'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 días

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

// Atributos de la cookie. En producción siempre Secure + SameSite=strict.
// El override por env COOKIE_INSECURE=1 sirve solo para entornos de desarrollo
// donde el navegador acceda al panel por http://localhost. Nunca usarlo en prod.
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.COOKIE_INSECURE === '1' ? false : true,
  sameSite: process.env.COOKIE_INSECURE === '1' ? 'lax' : 'strict',
  path: '/',
}

function setAuthCookie(res, payload, req) {
  const token = signToken(payload)
  res.cookie(COOKIE_NAME, token, { ...COOKIE_OPTS, maxAge: MAX_AGE_SECONDS * 1000 })
  return token
}

// clearCookie debe usar los MISMOS atributos que se usaron al setear, o el navegador
// no la marca como borrada. Sin esto, en HTTPS quedaría una cookie "huérfana" sin Secure.
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS)
}

function getSession(req) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return null
  return verifyToken(token)
}

function requireAdmin(req, res, next) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ error: 'No autenticado' })
  if (!['asistente', 'consul', 'superadmin'].includes(session.role)) {
    return res.status(403).json({ error: 'No autorizado' })
  }
  req.session = session
  next()
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, getSession, requireAdmin }
