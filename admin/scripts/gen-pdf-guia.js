// Genera PDF "Guía breve" desde entregable/presentacion-6paginas.html
// Uso: node admin/scripts/gen-pdf-guia.js
// Requiere playwright (disponible en video-tutorial-kit/node_modules).
const path = require('path')
const projectRoot = path.resolve(__dirname, '..', '..')
const { chromium } = require(path.join(projectRoot, 'video-tutorial-kit', 'node_modules', 'playwright'))

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const src = path.join(projectRoot, 'entregable', 'presentacion-6paginas.html')
  const fileUrl = 'file:///' + src.replace(/\\/g, '/')
  await page.goto(fileUrl, { waitUntil: 'networkidle' })
  const out = path.join(projectRoot, 'entregable', 'Guia-Breve-Viceconsulado.pdf')
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  })
  await browser.close()
  console.log('PDF generado:', out)
})().catch(e => { console.error(e); process.exit(1) })
