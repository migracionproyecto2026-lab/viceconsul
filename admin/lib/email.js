const nodemailer = require('nodemailer')
const { google } = require('googleapis')

const FROM = `"Viceconsulado Honorario de España" <${process.env.GMAIL_USER}>`

// ── Línea gráfica ────────────────────────────────────────────────────────────
const ROJO = '#AA151B'
const ROJO_OSCURO = '#7E0F14'
const ORO = '#C9A227'
const TEXTO = '#2b2b2b'
const GRIS = '#6b6b6b'
const FONDO = '#f1efe9'
const LOGO_URL = 'https://www.viceconsulado-nuevaesparta.com/images/LogoPng.png'
const SITIO_URL = 'https://www.viceconsulado-nuevaesparta.com'
const CONTACTO_EMAIL = 'ch.porlamar@maec.es'          // correo oficial de respuesta (recibe)
const WHATSAPP_TEL = '584248429665'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_TEL}?text=Hola%2C%20necesito%20informaci%C3%B3n%20sobre%20mi%20tr%C3%A1mite`
const WHATSAPP_LOGO = 'https://admin.viceconsulado-nuevaesparta.com/images/whatsapp.png'
const VERDE_WA = '#25D366'

function getTransporter() {
  const port = Number(process.env.SMTP_PORT) || 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = SSL directo; 587 = STARTTLS
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
}

// ── Layout responsive (table-based, compatible con Gmail/Outlook/móvil) ──────
function layout({ titulo, preheader = '', cuerpo }) {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <title>${titulo}</title>
  <style>
    body { margin:0; padding:0; background:${FONDO}; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:${ROJO}; }
    .card { width:100%; max-width:600px; }
    @media only screen and (max-width:620px) {
      .px { padding-left:22px !important; padding-right:22px !important; }
      .h-title { font-size:19px !important; }
      .stack { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" class="card" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);">

          <!-- Marca / logo -->
          <tr>
            <td align="center" style="background:#ffffff;padding:26px 24px 14px;">
              <img src="${LOGO_URL}" alt="Viceconsulado Honorario de España" width="64" style="display:block;height:auto;max-width:64px;">
            </td>
          </tr>

          <!-- Cabecera roja -->
          <tr>
            <td style="background:${ROJO};background:linear-gradient(135deg,${ROJO} 0%,${ROJO_OSCURO} 100%);border-top:3px solid ${ORO};border-bottom:3px solid ${ORO};padding:18px 24px;" class="px" align="center">
              <h1 class="h-title" style="margin:0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:600;letter-spacing:.2px;">${titulo}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,.82);font-family:Arial,Helvetica,sans-serif;font-size:12.5px;">Viceconsulado Honorario de España · Porlamar, Nueva Esparta</p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td class="px" style="padding:30px 34px;color:${TEXTO};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
              ${cuerpo}
            </td>
          </tr>

          <!-- Botón WhatsApp -->
          <tr>
            <td align="center" style="background:#ffffff;padding:6px 24px 26px;" class="px">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="${VERDE_WA}" style="border-radius:9px;">
                    <a href="${WHATSAPP_URL}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:9px;">
                      <img src="${WHATSAPP_LOGO}" width="19" height="19" alt="" style="vertical-align:middle;margin-right:8px;">Información por WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:11px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GRIS};">Para información específica de su trámite</p>
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="background:#faf8f3;border-top:1px solid #ece7db;padding:20px 24px;" class="px" align="center">
              <p style="margin:0 0 6px;font-family:Georgia,serif;color:${ROJO};font-size:13.5px;font-weight:600;">Viceconsulado Honorario de España</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:${GRIS};font-size:12px;line-height:1.55;">
                Porlamar, Nueva Esparta, Venezuela<br>
                Correo automático — para consultas responda a
                <a href="mailto:${CONTACTO_EMAIL}" style="color:${ROJO};text-decoration:none;">${CONTACTO_EMAIL}</a><br>
                <a href="${SITIO_URL}" style="color:${GRIS};text-decoration:underline;">${SITIO_URL.replace('https://','')}</a>
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;color:#a3a097;font-size:11px;">Si no esperaba este mensaje, puede ignorarlo.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Tabla de datos clave (trámite / fecha / hora)
function infoTable(rows) {
  const trs = rows.map(([k, v], i) => `
    <tr>
      <td style="padding:10px 14px;background:#faf8f3;border:1px solid #ece7db;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;font-weight:700;color:${ROJO};width:38%;">${k}</td>
      <td style="padding:10px 14px;border:1px solid #ece7db;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXTO};">${v}</td>
    </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">${trs}</table>`
}

function aviso(texto, color = ORO) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
    <tr><td style="background:#fbf6ec;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:13px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:${TEXTO};">${texto}</td></tr>
  </table>`
}

// ── Plantillas: cada una devuelve { subject, html } ─────────────────────────
const TEMPLATES = {
  verificacion: ({ nombre, code }) => ({
    subject: 'Código de verificación — Viceconsulado Nueva Esparta',
    html: layout({
      titulo: 'Verificación de cuenta',
      preheader: `Su código de verificación es ${code}`,
      cuerpo: `
        <p style="margin:0 0 12px;">Hola <strong>${nombre}</strong>,</p>
        <p style="margin:0 0 4px;">Use este código para verificar su cuenta:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;background:#fbf6ec;border:1px dashed ${ORO};border-radius:10px;padding:14px 26px;font-family:Georgia,serif;font-size:34px;font-weight:bold;letter-spacing:9px;color:${ROJO};">${code}</span>
        </div>
        <p style="margin:0;color:${GRIS};font-size:13px;">Expira en 15 minutos. Si no solicitó esto, ignore este correo.</p>`,
    }),
  }),

  // Al solicitar la cita (status pendiente)
  recibida: ({ nombre, cita }) => ({
    subject: `Solicitud de cita recibida: ${cita.tramite}`,
    html: layout({
      titulo: 'Hemos recibido su solicitud',
      preheader: `${cita.tramite} · ${cita.fecha} · ${cita.hora} — pendiente de confirmación`,
      cuerpo: `
        <p style="margin:0 0 12px;">Estimado/a <strong>${nombre}</strong>,</p>
        <p style="margin:0;">Hemos recibido su solicitud de cita. Queda <strong>pendiente de confirmación</strong> por nuestro personal; recibirá un nuevo correo cuando sea confirmada.</p>
        ${infoTable([['Trámite', cita.tramite], ['Fecha', cita.fecha], ['Hora', cita.hora]])}
        ${aviso('Si necesita modificar o cancelar su solicitud, contáctenos por los medios indicados al pie.')}`,
    }),
  }),

  // Cuando el personal confirma la cita
  confirmacion: ({ nombre, cita }) => ({
    subject: `Cita confirmada: ${cita.tramite} — ${cita.fecha}`,
    html: layout({
      titulo: 'Su cita ha sido confirmada',
      preheader: `${cita.tramite} · ${cita.fecha} · ${cita.hora}`,
      cuerpo: `
        <p style="margin:0 0 12px;">Estimado/a <strong>${nombre}</strong>,</p>
        <p style="margin:0;">Su cita en el Viceconsulado Honorario de España ha sido <strong>confirmada</strong>:</p>
        ${infoTable([['Trámite', cita.tramite], ['Fecha', cita.fecha], ['Hora', cita.hora]])}
        ${aviso('Por favor llegue <strong>10 minutos antes</strong> con todos sus documentos.')}
        <p style="margin:0;color:${GRIS};font-size:13px;">Dirección: Porlamar, Nueva Esparta, Venezuela.</p>`,
    }),
  }),

  recordatorio: ({ nombre, cita }) => ({
    subject: `Recordatorio: su cita es hoy a las ${cita.hora}`,
    html: layout({
      titulo: 'Recordatorio de cita',
      preheader: `Su cita es hoy a las ${cita.hora}`,
      cuerpo: `
        <p style="margin:0 0 12px;">Estimado/a <strong>${nombre}</strong>,</p>
        <p style="margin:0;">Le recordamos que tiene una cita programada para <strong>hoy</strong>:</p>
        ${infoTable([['Trámite', cita.tramite], ['Hora', `<span style="font-size:16px;font-weight:bold;color:${ROJO};">${cita.hora}</span>`]])}
        ${aviso('Recuerde traer todos los documentos requeridos para su trámite.')}`,
    }),
  }),

  cancelacion: ({ nombre, cita, mensajeCiudadano }) => ({
    subject: `Cancelación de cita: ${cita.tramite} — ${cita.fecha}`,
    html: layout({
      titulo: 'Cancelación de su cita',
      preheader: `Su cita del ${cita.fecha} ha sido cancelada`,
      cuerpo: `
        <p style="margin:0 0 12px;">Estimado/a <strong>${nombre}</strong>,</p>
        <p style="margin:0;">Le informamos que su cita ha sido cancelada:</p>
        ${infoTable([['Trámite', cita.tramite], ['Fecha', cita.fecha], ['Hora', cita.hora]])}
        ${mensajeCiudadano ? aviso(mensajeCiudadano, ROJO) : ''}
        <p style="margin:0;color:${GRIS};font-size:13px;">Si desea agendar una nueva cita, puede hacerlo en nuestra página web o contactándonos directamente.</p>`,
    }),
  }),

  inasistencia: ({ nombre, cita }) => ({
    subject: `Inasistencia registrada — ${cita.tramite}`,
    html: layout({
      titulo: 'Registro de inasistencia',
      preheader: `Inasistencia registrada — ${cita.tramite}`,
      cuerpo: `
        <p style="margin:0 0 12px;">Estimado/a <strong>${nombre}</strong>,</p>
        <p style="margin:0;">Hemos registrado su inasistencia a la siguiente cita:</p>
        ${infoTable([['Trámite', cita.tramite], ['Fecha', cita.fecha], ['Hora', cita.hora]])}
        <p style="margin:0;color:${GRIS};font-size:13px;">Si esto fue un error o desea reagendar, contáctenos a la brevedad posible.</p>`,
    }),
  }),
}

// ── Gmail API (HTTPS, port 443) — funciona donde el SMTP está bloqueado (Railway) ─
function gmailApi() {
  const o = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground')
  o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: o })
}
function buildRaw({ from, to, bcc, replyTo, subject, html }) {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    bcc ? `Bcc: ${bcc}` : null,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64'),
  ].filter(Boolean).join('\r\n')
  return Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sendViaGmailApi({ to, subject, html, bcc, replyTo }) {
  const raw = buildRaw({ from: FROM, to, bcc, replyTo, subject, html })
  await gmailApi().users.messages.send({ userId: 'me', requestBody: { raw } })
}
// Verifica credenciales Gmail API sin enviar (devuelve el correo de la cuenta)
async function verifyGmailApi() {
  const r = await gmailApi().users.getProfile({ userId: 'me' })
  return r.data.emailAddress
}

// Prueba la conexión/credenciales SMTP sin enviar correo (timeout corto para no colgar)
async function verifyTransport(opts = {}) {
  const port = opts.port || Number(process.env.SMTP_PORT) || 465
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
  })
  return t.verify()
}

// Render sin enviar (para previews/tests)
function renderEmail(tipo, data) {
  const t = TEMPLATES[tipo]
  if (!t) throw new Error(`Plantilla desconocida: ${tipo}`)
  return t(data)
}

// Envía un correo de un tipo dado.
// Prioridad: Gmail API (HTTPS, funciona en Railway) → SMTP (local) → consola (dev).
async function send(tipo, to, data, devMsg) {
  const { subject, html } = renderEmail(tipo, data)
  const bcc = process.env.GMAIL_USER  // respaldo en la cuenta del consulado
  // 1) Gmail API por HTTPS (producción)
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    await sendViaGmailApi({ to, subject, html, bcc, replyTo: CONTACTO_EMAIL })
    return true
  }
  // 2) SMTP (entorno local donde no esté bloqueado)
  if (process.env.GMAIL_PASS) {
    await getTransporter().sendMail({ from: FROM, to, bcc, replyTo: CONTACTO_EMAIL, subject, html })
    return true
  }
  // 3) Sin credenciales: fallback a consola
  console.log(`\n[DEV] ${devMsg || tipo} para ${to}`)
  return true
}

// ── Wrappers públicos (firmas estables) ─────────────────────────────────────
const sendVerificationEmail = (to, nombre, code) =>
  send('verificacion', to, { nombre, code }, `Código verificación ${code}`)
const sendAppointmentReceived = (to, nombre, cita) =>
  send('recibida', to, { nombre, cita }, 'Solicitud recibida')
const sendAppointmentConfirmation = (to, nombre, cita) =>
  send('confirmacion', to, { nombre, cita }, 'Confirmación de cita')
const sendAppointmentReminder = (to, nombre, cita) =>
  send('recordatorio', to, { nombre, cita }, 'Recordatorio (~1h)')
const sendCancellationEmail = (to, nombre, cita, mensajeCiudadano) =>
  send('cancelacion', to, { nombre, cita, mensajeCiudadano }, 'Cancelación')
const sendNoShowEmail = (to, nombre, cita) =>
  send('inasistencia', to, { nombre, cita }, 'Inasistencia')

module.exports = {
  sendVerificationEmail,
  sendAppointmentReceived,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendCancellationEmail,
  sendNoShowEmail,
  renderEmail,
  verifyTransport,
  verifyGmailApi,
  TEMPLATES,
}
