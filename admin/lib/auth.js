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

function setAuthCookie(res, payload, req) {
  const token = signToken(payload)
  // Detectar HTTPS por req.secure (express trust proxy) o x-forwarded-proto
  const isHttps = req && (req.secure || req.headers?.['x-forwarded-proto'] === 'https')
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'strict' : 'lax',
    maxAge: MAX_AGE_SECONDS * 1000,
    path: '/',
  })
  return token
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
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
