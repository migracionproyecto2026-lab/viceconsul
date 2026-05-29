// Genera PDF "Guía breve" desde entregable/presentacion-6paginas.html
// Uso: node admin/scripts/gen-pdf-guia.js
// Requiere playwright (disponible en video-tutorial-kit/node_modules).
const path = require('path')
const projectRoot = path.resolve(__dirname, '..', '..')
const { chromium } = require(path.join(projectRoot, 'video-tutorial-kit', 'node_modules', 'playwright'))

async function genPDF(srcHtml, outPdf, margin) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const fileUrl = 'file:///' + srcHtml.replace(/\\/g, '/')
  await page.goto(fileUrl, { waitUntil: 'networkidle' })
  await page.pdf({ path: outPdf, format: 'A4', printBackground: true, margin })
  await browser.close()
  console.log('PDF generado:', outPdf)
}

;(async () => {
  // Guía breve (6 páginas)
  await genPDF(
    path.join(projectRoot, 'entregable', 'presentacion-6paginas.html'),
    path.join(projectRoot, 'entregable', 'Guia-Breve-Viceconsulado.pdf'),
    { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  )
  // Stack, seguridad y costos (2 páginas)
  await genPDF(
    path.join(projectRoot, 'entregable', 'stack-y-costos-2paginas.html'),
    path.join(projectRoot, 'entregable', 'Stack-Seguridad-Costos.pdf'),
    { top: '14mm', bottom: '14mm', left: '13mm', right: '13mm' },
  )
})().catch(e => { console.error(e); process.exit(1) })
