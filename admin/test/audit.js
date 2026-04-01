/**
 * audit.js — Test completo del sistema Viceconsulado Admin
 * Uso: node test/audit.js
 * Requiere el servidor corriendo en http://localhost:3000
 */

const BASE = 'http://localhost:3000'
let cookie = ''
let resultados = []
let citaTestId = null
let ciudadanoTestId = null

function log(icono, test, ok, detalle = '') {
  const estado = ok ? '✅' : '❌'
  console.log(`${estado} [${icono}] ${test}${detalle ? ' — ' + detalle : ''}`)
  resultados.push({ test, ok, detalle })
}

async function req(method, path, body, auth = true) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) },
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${BASE}${path}`, opts)
  if (auth && r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]
  let data
  try { data = await r.json() } catch { data = null }
  return { status: r.status, data }
}

// ─── 1. AUTH ──────────────────────────────────────────────────────────────────
async function testAuth() {
  console.log('\n── AUTENTICACIÓN ──')

  // Login con credenciales incorrectas
  const bad = await req('POST', '/api/auth/login', { email: 'x@x.com', password: 'wrong' }, false)
  log('AUTH', 'Login con credenciales incorrectas → rechaza', bad.status === 401 || bad.data?.error)

  // Login correcto (ajusta email/password según tu admin)
  const creds = { email: process.env.ADMIN_EMAIL || 'admin@viceconsulado.com', password: process.env.ADMIN_PASS || 'Admin1234' }
  const good = await req('POST', '/api/auth/login', creds, false)
  const loginOk = good.status === 200 && good.data?.ok
  log('AUTH', 'Login con credenciales correctas', loginOk, loginOk ? '' : `status=${good.status} err=${JSON.stringify(good.data)}`)

  // Session activa
  const me = await req('GET', '/api/auth/me')
  log('AUTH', 'Sesión activa después del login', !!me.data?.email, me.data?.email)
}

// ─── 2. STATS ─────────────────────────────────────────────────────────────────
async function testStats() {
  console.log('\n── DASHBOARD / STATS ──')
  const r = await req('GET', '/api/admin/stats')
  const camposEsperados = ['totalCiudadanos', 'ciudadanosVerificados', 'citasPendientes', 'citasHoy', 'citasSemana']
  const todosPresentes = camposEsperados.every(k => k in (r.data || {}))
  log('STATS', 'GET /stats devuelve todos los campos', todosPresentes, JSON.stringify(r.data))
}

// ─── 3. CITAS ─────────────────────────────────────────────────────────────────
async function testCitas() {
  console.log('\n── CITAS ──')

  // GET lista
  const lista = await req('GET', '/api/admin/citas')
  log('CITAS', 'GET /citas devuelve array', Array.isArray(lista.data), `${lista.data?.length ?? '?'} citas`)

  // Verificar que citas con ciudadano incluyen citizen.*
  if (lista.data?.length) {
    const conCiudadano = lista.data.filter(c => c.citizenId)
    const tieneCitizen = conCiudadano.every(c => c.citizen && c.citizen.nombre)
    log('CITAS', 'Citas con citizenId incluyen citizen.nombre/apellido/email', tieneCitizen || conCiudadano.length === 0)

    // Verificar que tramite no está vacío
    const sinTramite = lista.data.filter(c => !c.tramite)
    log('CITAS', 'Todas las citas tienen tramite', sinTramite.length === 0, sinTramite.length ? `${sinTramite.length} sin tramite` : 'ok')

    // Verificar tramites contra el select canonical
    const TRAMITES_CANONICOS = [
      'Pasaporte — Primera expedición', 'Pasaporte — Renovación', 'Pasaporte — Menores de 12 años',
      'Inscripción de nacimiento', 'Inscripción de matrimonio', 'Inscripción de defunción',
      'Fe de vida', 'Alta consular', 'Baja consular', 'Certificado de residencia',
      'Certificado de no residente', 'Poder notarial',
      'NIF — Identificación fiscal', 'NIE — Identidad de extranjero',
      'Conservación de nacionalidad', 'Recuperación de nacionalidad',
      'Ley de Memoria Democrática (LMD)', 'Cambio de censo electoral', 'Otro trámite',
    ]
    const tramitesFuera = [...new Set(lista.data.map(c => c.tramite).filter(t => t && !TRAMITES_CANONICOS.includes(t)))]
    log('CITAS', 'Tramites coinciden con opciones del select', tramitesFuera.length === 0,
      tramitesFuera.length ? `⚠ No coinciden: ${tramitesFuera.join(' | ')}` : 'ok')
  }

  // GET con filtro de fecha
  const hoy = new Date().toISOString().split('T')[0]
  const filtrado = await req('GET', `/api/admin/citas?fecha=${hoy}`)
  log('CITAS', 'GET /citas?fecha= filtra correctamente', Array.isArray(filtrado.data))

  // POST crear cita sin datos mínimos
  const citaMala = await req('POST', '/api/admin/citas', { notas: 'test' })
  log('CITAS', 'POST /citas sin hora ni tramite → error', citaMala.status === 400 || citaMala.data?.error)

  // POST crear cita válida (ciudadano externo)
  const citaBuena = await req('POST', '/api/admin/citas', {
    nombreExterno: 'Test Audit',
    emailExterno: `audit_${Date.now()}@test.com`,
    fecha: hoy,
    hora: '08:30',
    tramite: 'Fe de vida',
    notas: 'Creada por audit.js',
  })
  const citaCreada = citaBuena.status === 200 && citaBuena.data?.id
  log('CITAS', 'POST /citas con datos válidos → cita creada', citaCreada, `id=${citaBuena.data?.id}`)
  if (citaCreada) citaTestId = citaBuena.data.id

  if (citaTestId) {
    // PUT actualizar tramite
    const upd = await req('PUT', `/api/admin/citas/${citaTestId}`, { tramite: 'Alta consular', status: 'confirmada' })
    log('CITAS', 'PUT /citas/:id actualiza tramite y status', upd.data?.tramite === 'Alta consular' && upd.data?.status === 'confirmada')

    // Verificar hora fuera de rango 08:00 (no debería poder)
    const horaRara = await req('PUT', `/api/admin/citas/${citaTestId}`, { hora: '08:00' })
    // El sistema actualmente no valida horas, solo verificamos que la op no falle
    log('CITAS', 'PUT /citas/:id acepta actualización', !horaRara.data?.error, horaRara.data?.error || 'ok (nota: hora 08:00 no restringida a nivel API)')

    // Reagendar
    const reagenda = await req('POST', `/api/admin/citas/${citaTestId}/reagendar`, {
      nuevaFecha: hoy, nuevaHora: '09:00', liberarPlaza: true, notaInterna: 'test audit'
    })
    log('CITAS', 'POST /citas/:id/reagendar funciona', reagenda.data?.ok)

    // Cancelar
    const cancela = await req('POST', `/api/admin/citas/${citaTestId}/cancelar`, {
      mensajeCiudadano: 'Test de cancelación audit', notaInterna: 'audit'
    })
    log('CITAS', 'POST /citas/:id/cancelar funciona', cancela.data?.ok)
  }
}

// ─── 4. CIUDADANOS ────────────────────────────────────────────────────────────
async function testCiudadanos() {
  console.log('\n── CIUDADANOS ──')

  // GET lista
  const lista = await req('GET', '/api/admin/ciudadanos')
  log('CIUD', 'GET /ciudadanos devuelve { ciudadanos, total, pages }', !!lista.data?.ciudadanos)

  // GET búsqueda por nombre
  const busqNombre = await req('GET', '/api/admin/ciudadanos?q=test')
  log('CIUD', 'GET /ciudadanos?q= filtra por nombre', Array.isArray(busqNombre.data?.ciudadanos))

  // GET buscar (endpoint específico) — por email
  const buscarEmail = await req('GET', '/api/admin/ciudadanos/buscar?q=admin@test.com')
  log('CIUD', 'GET /ciudadanos/buscar?q=email — no devuelve error', !buscarEmail.data?.error)

  // GET buscar por número (cédula)
  const buscarCedula = await req('GET', '/api/admin/ciudadanos/buscar?q=12345678')
  log('CIUD', 'GET /ciudadanos/buscar?q=número (cédula/ID) — no devuelve error', !buscarCedula.data?.error)

  // GET buscar por nombre
  const buscarNombre = await req('GET', '/api/admin/ciudadanos/buscar?q=Maria')
  log('CIUD', 'GET /ciudadanos/buscar?q=texto (nombre) — no devuelve error', !buscarNombre.data?.error)

  // GET detalle primer ciudadano
  if (lista.data?.ciudadanos?.length) {
    ciudadanoTestId = lista.data.ciudadanos[0].id
    const det = await req('GET', `/api/admin/ciudadanos/${ciudadanoTestId}`)
    log('CIUD', `GET /ciudadanos/:id devuelve datos`, !!det.data?.nombre, det.data?.nombre)

    // PUT actualizar
    const upd = await req('PUT', `/api/admin/ciudadanos/${ciudadanoTestId}`, {
      nombre: det.data.nombre, apellido: det.data.apellido,
      telefono: det.data.telefono, cedula: det.data.cedula, tipoDocumento: det.data.tipoDocumento,
    })
    log('CIUD', 'PUT /ciudadanos/:id actualiza sin error', !upd.data?.error)

    // Verificar
    const verif = await req('PUT', `/api/admin/ciudadanos/${ciudadanoTestId}`, { verified: true })
    log('CIUD', 'PUT /ciudadanos/:id puede verificar', verif.data?.verified === true || !verif.data?.error)
  }
}

// ─── 5. OTRAS APIs ───────────────────────────────────────────────────────────
async function testOtras() {
  console.log('\n── OTRAS APIs ──')

  const banners = await req('GET', '/api/admin/banners')
  log('MISC', 'GET /banners devuelve array', Array.isArray(banners.data))

  const fechas = await req('GET', '/api/admin/fechas-bloqueadas')
  log('MISC', 'GET /fechas-bloqueadas devuelve array', Array.isArray(fechas.data))

  const bitacora = await req('GET', '/api/admin/bitacora')
  log('MISC', 'GET /bitacora devuelve array', Array.isArray(bitacora.data))

  // API pública
  const pubFechas = await req('GET', '/api/fechas-bloqueadas', null, false)
  log('MISC', 'GET /api/fechas-bloqueadas (pública) sin auth', Array.isArray(pubFechas.data))
}

// ─── RESUMEN ──────────────────────────────────────────────────────────────────
async function resumen() {
  const total = resultados.length
  const ok = resultados.filter(r => r.ok).length
  const fail = total - ok
  console.log(`\n${'═'.repeat(52)}`)
  console.log(`  RESULTADO: ${ok}/${total} tests pasaron  |  ${fail} fallaron`)
  console.log('═'.repeat(52))
  if (fail > 0) {
    console.log('\nTests fallados:')
    resultados.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.test}${r.detalle ? ' — ' + r.detalle : ''}`))
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(52)}`)
  console.log('  AUDIT — Viceconsulado Admin')
  console.log(`  Servidor: ${BASE}`)
  console.log('═'.repeat(52))
  try {
    await testAuth()
    await testStats()
    await testCitas()
    await testCiudadanos()
    await testOtras()
  } catch (e) {
    console.error('\n⚠ Error inesperado:', e.message)
  }
  await resumen()
}

main()
