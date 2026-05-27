// Genera un HTML de preview por cada plantilla de correo + un índice.
// Uso:  node scripts/preview-emails.js   →  abre scripts/preview/index.html
const fs = require('fs')
const path = require('path')
const { renderEmail } = require('../lib/email')

const cita = { tramite: 'Inscripción de Matrimonio', fecha: '2026-06-15', hora: '09:30' }
const nombre = 'María González'

const muestras = {
  verificacion: { nombre, code: '482913' },
  recibida: { nombre, cita },
  confirmacion: { nombre, cita },
  recordatorio: { nombre, cita },
  cancelacion: { nombre, cita, mensajeCiudadano: 'La sede permanecerá cerrada por jornada de pasaportes. Le contactaremos para reagendar.' },
  inasistencia: { nombre, cita },
}

const outDir = path.join(__dirname, 'preview')
fs.mkdirSync(outDir, { recursive: true })

const links = []
for (const [tipo, data] of Object.entries(muestras)) {
  const { subject, html } = renderEmail(tipo, data)
  const file = `${tipo}.html`
  fs.writeFileSync(path.join(outDir, file), html, 'utf8')
  links.push(`<li><a href="${file}" target="preview"><strong>${tipo}</strong></a> — <span style="color:#666;">${subject}</span></li>`)
  console.log(`✓ ${file}`)
}

const index = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Previews de correos — Viceconsulado</title>
<style>body{font-family:Arial,sans-serif;margin:0;display:flex;height:100vh}
nav{width:320px;background:#faf8f3;border-right:1px solid #ece7db;padding:20px;overflow:auto}
nav h2{font-family:Georgia,serif;color:#AA151B;font-size:17px}
nav li{margin:10px 0;line-height:1.4} iframe{flex:1;border:0}</style></head>
<body><nav><h2>Correos del Viceconsulado</h2><ol>${links.join('')}</ol>
<p style="color:#999;font-size:12px;margin-top:20px">Click para previsualizar. Cada plantilla comparte logo/cabecera/pie; el contenido cambia por tipo.</p></nav>
<iframe name="preview" src="confirmacion.html"></iframe></body></html>`
fs.writeFileSync(path.join(outDir, 'index.html'), index, 'utf8')
console.log(`\nAbre: ${path.join(outDir, 'index.html')}`)
