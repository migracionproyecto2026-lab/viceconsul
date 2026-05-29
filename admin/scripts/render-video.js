// Renderiza a MP4 frame por frame un HTML con motor de timeline custom
// que expone `window.__seek(t)` / `window.__play()` (formato usado por las
// piezas en `Viceconsulado _ Video/`, generadas por una IA de video).
//
// Uso:
//   node admin/scripts/render-video.js                          # usa defaults
//   node admin/scripts/render-video.js --src="<carpeta>"        # cambia origen
//   node admin/scripts/render-video.js --out=<archivo.mp4>      # nombre salida
//   node admin/scripts/render-video.js --duration=56.5 --fps=30 # timing
//   node admin/scripts/render-video.js --width=1080 --height=1920
//   node admin/scripts/render-video.js --entry="Video.html"     # archivo raíz
//   node admin/scripts/render-video.js --hideBar=true           # oculta PlaybackBar (default true)
//   node admin/scripts/render-video.js --keepFrames=true        # no borra PNGs intermedios
//
// El proceso:
//   1. Levanta servidor estático local en el directorio fuente.
//   2. Abre el HTML en Chromium headless al viewport indicado.
//   3. Inyecta CSS que oculta la PlaybackBar del Stage y desescala el canvas.
//   4. Para cada t en [0, duration] a `fps`: window.__seek(t) + screenshot del canvas.
//   5. Ensambla los PNGs con ffmpeg (libx264, CRF 18, yuv420p, +faststart).

const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

const projectRoot = path.resolve(__dirname, '..', '..')

// ── Parseo de flags --key=value (defaults para el video actual) ────────────
const args = {}
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m) args[m[1]] = m[2] === undefined ? true : m[2]
}
const SRC_DIR = path.resolve(args.src || path.join(projectRoot, 'Viceconsulado _ Video'))
const ENTRY = args.entry || autoDetectEntry(SRC_DIR)
const OUT_MP4 = path.resolve(args.out || path.join(projectRoot, 'entregable', 'Viceconsulado-Video.mp4'))
const FPS = parseInt(args.fps || '30', 10)
const DURATION = parseFloat(args.duration || '56.5')
const WIDTH = parseInt(args.width || '1080', 10)
const HEIGHT = parseInt(args.height || '1920', 10)
const HIDE_BAR = args.hideBar !== 'false'
const KEEP_FRAMES = args.keepFrames === 'true' || args.keepFrames === true
const TOTAL_FRAMES = Math.ceil(DURATION * FPS)
const FRAMES_DIR = path.join(path.dirname(OUT_MP4), '.video-frames')

// Detecta el HTML raíz si no se pasa --entry: prefiere "*Video*.html" o el primer .html
function autoDetectEntry(dir) {
  if (!fs.existsSync(dir)) return null
  const htmls = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.html'))
  return htmls.find(f => /video/i.test(f)) || htmls[0] || null
}

const { chromium } = require(path.join(projectRoot, 'video-tutorial-kit', 'node_modules', 'playwright'))
const ffmpegPath = require(path.join(projectRoot, 'video-tutorial-kit', 'node_modules', 'ffmpeg-static'))

// ── Servidor estático mínimo ───────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
}
function arrancarServidor(port = 8765) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0])
      const p = path.join(SRC_DIR, url === '/' ? '/' + ENTRY : url)
      if (!p.startsWith(SRC_DIR)) { res.writeHead(403); return res.end() }
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found: ' + url) }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        res.end(data)
      })
    })
    srv.on('error', reject)
    srv.listen(port, () => resolve(srv))
  })
}

// CSS para ocultar la PlaybackBar y desescalar el canvas al tamaño nativo.
// Diseñado para el layout del Stage en `animations.jsx`: stage flex column,
// con canvas wrapper (flex:1) y PlaybackBar como último hijo.
const CSS_LIMPIO = `
  #root > div {
    background: #0a0a0a !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    display: block !important;
  }
  #root > div > div:first-child {
    flex: none !important;
    display: block !important;
    overflow: visible !important;
  }
  #root > div > div:first-child > div {
    transform: none !important;
    box-shadow: none !important;
    margin: 0 !important;
  }
  #root > div > div:last-child:not(:first-child) {
    display: none !important;
  }
`

async function main() {
  if (!ENTRY) throw new Error('No se encontró HTML de entrada en ' + SRC_DIR)
  console.log(`Origen: ${SRC_DIR}/${ENTRY}`)
  console.log(`Salida: ${OUT_MP4}`)
  console.log(`Dimensiones: ${WIDTH}x${HEIGHT} @ ${FPS}fps · duración ${DURATION}s · ${TOTAL_FRAMES} frames`)

  // Preparar carpeta de frames limpia
  if (fs.existsSync(FRAMES_DIR)) fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
  fs.mkdirSync(FRAMES_DIR, { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MP4), { recursive: true })

  const srv = await arrancarServidor()
  console.log('Servidor estático en http://localhost:8765')

  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()

  console.log('Cargando HTML…')
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => typeof window.__seek === 'function', { timeout: 60000 })

  if (HIDE_BAR) await page.addStyleTag({ content: CSS_LIMPIO })

  await page.evaluate(() => window.__seek(0))
  await page.waitForTimeout(1500)

  // Locator del canvas (div interno del Stage)
  const canvas = HIDE_BAR ? await page.$('#root > div > div:first-child > div') : null
  if (HIDE_BAR && !canvas) throw new Error('No se encontró el div canvas del Stage')

  console.log(`Renderizando ${TOTAL_FRAMES} frames…`)
  const startTs = Date.now()
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const t = i / FPS
    await page.evaluate(t => window.__seek(t), t)
    await page.waitForTimeout(35)
    const filename = path.join(FRAMES_DIR, `f${String(i).padStart(5, '0')}.png`)
    if (HIDE_BAR) await canvas.screenshot({ path: filename, type: 'png' })
    else await page.screenshot({ path: filename, type: 'png' })
    if (i % 30 === 0) {
      const elapsed = ((Date.now() - startTs) / 1000).toFixed(1)
      console.log(`  ${i}/${TOTAL_FRAMES} (${((i / TOTAL_FRAMES) * 100).toFixed(1)}%) — ${elapsed}s`)
    }
  }
  console.log(`Frames listos en ${((Date.now() - startTs) / 1000).toFixed(1)}s`)

  await browser.close()
  srv.close()

  console.log('Ensamblando MP4 con ffmpeg…')
  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(FRAMES_DIR, 'f%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '18',
      '-preset', 'medium',
      '-movflags', '+faststart',
      OUT_MP4,
    ]
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' })
    proc.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code)))
  })

  if (!KEEP_FRAMES) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
    console.log('Frames intermedios eliminados.')
  } else {
    console.log(`Frames intermedios preservados en ${FRAMES_DIR}`)
  }

  console.log(`\n✔ MP4 generado: ${OUT_MP4}`)
  console.log(`  Tamaño: ${(fs.statSync(OUT_MP4).size / (1024 * 1024)).toFixed(2)} MB`)
}

main().catch(e => { console.error(e); process.exit(1) })
