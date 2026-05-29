const path = require('path')
const fs = require('fs')
const root = path.resolve(__dirname, '..', '..')
const { chromium } = require(path.join(root, 'video-tutorial-kit', 'node_modules', 'playwright'))

// Área útil del PDF a 96dpi descontando @page margin (Guía 18mm/16mm,
// Stack 14mm/13mm). Para que el diagnóstico sea fiel a lo que cabrá en
// el PDF impreso, simulamos el ancho útil real.
const MARGINS = {
  'presentacion-6paginas.html': { v: 36, h: 32 },   // 18+18 / 16+16 mm
  'stack-y-costos-2paginas.html': { v: 28, h: 26 }, // 14+14 / 13+13 mm
}
const A4_MM = { w: 210, h: 297 }
const MM_PX = 3.7795  // 96 dpi

;(async () => {
  const b = await chromium.launch()

  for (const file of ['presentacion-6paginas.html', 'stack-y-costos-2paginas.html']) {
    const m = MARGINS[file]
    const utilW = Math.round((A4_MM.w - m.h) * MM_PX)
    const utilH = Math.round((A4_MM.h - m.v) * MM_PX)
    const ctx = await b.newContext({ viewport: { width: utilW, height: utilH } })
    const page = await ctx.newPage()
    const fileUrl = 'file:///' + path.join(root, 'entregable', file).replace(/\\/g, '/')
    await page.goto(fileUrl, { waitUntil: 'networkidle' })

    const reporte = await page.evaluate(({ utilH }) => {
      const secs = document.querySelectorAll('section.page')
      return Array.from(secs).map((s, i) => {
        const h = s.scrollHeight
        return { i: i + 1, altoReal: Math.round(h), altoUtil: utilH, exceso: Math.round(h - utilH) }
      })
    }, { utilH })

    console.log(`\n=== ${file} (área útil PDF: ${utilW}×${utilH}px) ===`)
    reporte.forEach(r => {
      const flag = r.exceso > 0 ? `⚠ DESBORDA +${r.exceso}px` : r.exceso < -200 ? `· hueco ${-r.exceso}px` : '✓ ok'
      console.log(`  Pág ${r.i}: ${r.altoReal}px de ${r.altoUtil}px útiles ${flag}`)
    })
    await ctx.close()
  }
  await b.close()
})().catch(e => { console.error(e); process.exit(1) })
