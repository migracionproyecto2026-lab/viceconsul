const nodemailer = require('nodemailer')

const FROM = `"Viceconsulado Honorario de España" <${process.env.GMAIL_USER}>`

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  })
}

function header(titulo) {
  return `<div style="background:#AA151B;padding:20px 24px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-family:Georgia,serif;font-size:1.1rem;">${titulo}</h2>
    <p style="color:rgba(255,255,255,.8);font-size:.82rem;margin:4px 0 0;">Viceconsulado Honorario de España · Porlamar, Nueva Esparta</p>
  </div>`
}
function footer() {
  return `<div style="padding:14px;text-align:center;color:#999;font-size:.75rem;font-family:Arial,sans-serif;">
    Este es un correo automático. Para consultas responda a <a href="mailto:${process.env.GMAIL_USER}" style="color:#AA151B;">${process.env.GMAIL_USER}</a>
  </div>`
}
function wrap(inner) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">${inner}</div>`
}

// ── Verificación de cuenta ─────────────────────────────────────────────────
async function sendVerificationEmail(to, nombre, code) {
  if (!process.env.GMAIL_PASS) { console.log(`\n[DEV] Código verificación para ${to}: ${code}\n`); return true }
  await getTransporter().sendMail({
    from: FROM, to,
    subject: 'Código de verificación — Viceconsulado Nueva Esparta',
    html: wrap(`${header('Verificación de cuenta')}
      <div style="padding:28px 24px;background:#fff;">
        <p style="font-size:15px;">Hola <strong>${nombre}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#AA151B;">${code}</span>
        </div>
        <p style="color:#666;font-size:13px;">Expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>
      </div>${footer()}`),
  })
  return true
}

// ── Confirmación de cita ───────────────────────────────────────────────────
async function sendAppointmentConfirmation(to, nombre, cita) {
  if (!process.env.GMAIL_PASS) { console.log(`\n[DEV] Confirmación de cita para ${to}`); return true }
  await getTransporter().sendMail({
    from: FROM, to,
    subject: `Cita confirmada: ${cita.tramite} — ${cita.fecha}`,
    html: wrap(`${header('Su cita ha sido confirmada')}
      <div style="padding:28px 24px;background:#fff;">
        <p>Estimado/a <strong>${nombre}</strong>,</p>
        <p>Su cita en el Viceconsulado Honorario de España ha sido registrada:</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;width:35%;">Trámite</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.tramite}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Fecha</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.fecha}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Hora</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.hora}</td></tr>
        </table>
        <p style="color:#555;font-size:13px;">Por favor llegue <strong>10 minutos antes</strong> con todos sus documentos.</p>
        <p style="color:#555;font-size:13px;">Dirección: Porlamar, Nueva Esparta, Venezuela.</p>
      </div>${footer()}`),
  })
  return true
}

// ── Recordatorio 1 hora antes ──────────────────────────────────────────────
async function sendAppointmentReminder(to, nombre, cita) {
  if (!process.env.GMAIL_PASS) { console.log(`\n[DEV] Recordatorio para ${to} — cita en ~1h`); return true }
  await getTransporter().sendMail({
    from: FROM, to,
    subject: `Recordatorio: su cita es hoy a las ${cita.hora}`,
    html: wrap(`${header('Recordatorio de cita')}
      <div style="padding:28px 24px;background:#fff;">
        <p>Estimado/a <strong>${nombre}</strong>,</p>
        <p>Le recordamos que tiene una cita programada para <strong>hoy</strong>:</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;width:35%;">Trámite</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.tramite}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Hora</td><td style="padding:8px 12px;border:1px solid #e8e5df;font-size:1.1rem;font-weight:bold;color:#AA151B;">${cita.hora}</td></tr>
        </table>
        <p style="color:#555;font-size:13px;">Recuerde traer todos los documentos requeridos para su trámite.</p>
      </div>${footer()}`),
  })
  return true
}

// ── Cancelación de cita ────────────────────────────────────────────────────
async function sendCancellationEmail(to, nombre, cita, mensajeCiudadano) {
  if (!process.env.GMAIL_PASS) { console.log(`\n[DEV] Cancelación para ${to}: ${mensajeCiudadano}`); return true }
  await getTransporter().sendMail({
    from: FROM, to,
    subject: `Cancelación de cita: ${cita.tramite} — ${cita.fecha}`,
    html: wrap(`${header('Cancelación de su cita')}
      <div style="padding:28px 24px;background:#fff;">
        <p>Estimado/a <strong>${nombre}</strong>,</p>
        <p>Le informamos que su cita ha sido cancelada:</p>
        <table style="width:100%;margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;width:35%;">Trámite</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.tramite}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Fecha</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.fecha}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Hora</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.hora}</td></tr>
        </table>
        ${mensajeCiudadano ? `<div style="background:#fef9f9;border-left:4px solid #AA151B;padding:14px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <p style="margin:0;font-size:14px;color:#333;">${mensajeCiudadano}</p>
        </div>` : ''}
        <p style="color:#555;font-size:13px;">Si desea agendar una nueva cita, puede hacerlo a través de nuestra página web o contactándonos directamente.</p>
      </div>${footer()}`),
  })
  return true
}

// ── Inasistencia ───────────────────────────────────────────────────────────
async function sendNoShowEmail(to, nombre, cita) {
  if (!process.env.GMAIL_PASS) { console.log(`\n[DEV] Inasistencia para ${to}`); return true }
  await getTransporter().sendMail({
    from: FROM, to,
    subject: `Inasistencia registrada — ${cita.tramite}`,
    html: wrap(`${header('Registro de inasistencia')}
      <div style="padding:28px 24px;background:#fff;">
        <p>Estimado/a <strong>${nombre}</strong>,</p>
        <p>Hemos registrado su inasistencia a la siguiente cita:</p>
        <table style="width:100%;margin:16px 0;border-collapse:collapse;">
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;width:35%;">Trámite</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.tramite}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Fecha</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.fecha}</td></tr>
          <tr><td style="padding:8px 12px;background:#fafaf7;border:1px solid #e8e5df;font-weight:600;">Hora</td><td style="padding:8px 12px;border:1px solid #e8e5df;">${cita.hora}</td></tr>
        </table>
        <p style="color:#555;font-size:13px;">Si esto fue un error o desea reagendar, contáctenos a la brevedad posible.</p>
      </div>${footer()}`),
  })
  return true
}

module.exports = {
  sendVerificationEmail,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendCancellationEmail,
  sendNoShowEmail,
}
