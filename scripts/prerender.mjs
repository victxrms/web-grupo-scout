/**
 * Prerenderizado tras el build.
 *
 * Genera dist/<ruta>/index.html de cada página con su contenido ya en el HTML
 * y su título y descripción, para buscadores y redes sociales. El contenido
 * es el publicado desde el editor (se descarga de Firestore); si no hay
 * conexión o aún no se ha publicado nada, se usa src/contenido/inicial.json.
 *
 * También genera dist/404.html y, si está VITE_URL_WEB, dist/sitemap.xml.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

// Variables de .env (en GitHub Actions llegan ya como variables de entorno).
if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf-8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const dist = 'dist'
const SITE = (process.env.VITE_URL_WEB ?? '').replace(/\/+$/, '')
const plantilla = readFileSync(join(dist, 'index.html'), 'utf-8')
const { render, PAGINAS, PAGINAS_PRIVADAS, completar, CONTENIDO_INICIAL } =
  await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href)

async function contenidoPublicado() {
  const proyecto = process.env.VITE_FIREBASE_PROJECT_ID
  const clave = process.env.VITE_FIREBASE_API_KEY
  if (!proyecto || !clave) return null
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/web/contenido?key=${clave}`)
    if (!res.ok) return null
    const doc = await res.json()
    return JSON.parse(doc.fields?.datos?.stringValue ?? 'null')
  } catch {
    return null
  }
}

const publicado = await contenidoPublicado()
const c = completar(publicado, CONTENIDO_INICIAL)
console.log(publicado ? 'Contenido: el publicado desde el editor.' : 'Contenido: src/contenido/inicial.json (aún no hay nada publicado).')

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const absoluta = u => (!u ? '' : /^https?:/.test(u) ? u : SITE && u.startsWith('/') ? SITE + u : '')
// JSON dentro de <script>: sin «<» para que no pueda cerrar la etiqueta.
const json = JSON.stringify(c).replace(/</g, '\\u003c')

function pagina(ruta, titulo, descripcion, indexable) {
  const url = SITE ? `${SITE}${ruta === '/' || ruta === '/404' ? '/' : ruta}` : ''
  const imagen = absoluta(c.apariencia.fotosPortada[0] || c.apariencia.logo)
  const cuerpo = render(ruta === '/404' ? '/pagina-no-encontrada' : ruta, c)
  let html = plantilla
    .replace(/(<title>)[^<]*(<\/title>)/, `$1${esc(titulo)}$2`)
    .replace(/(name="description" content=")[^"]*"/, `$1${esc(descripcion)}"`)
    .replace(/(property="og:site_name" content=")[^"]*"/, `$1${esc(c.grupo.nombre)}"`)
    .replace(/(property="og:title" content=")[^"]*"/, `$1${esc(titulo)}"`)
    .replace(/(property="og:description" content=")[^"]*"/, `$1${esc(descripcion)}"`)
    .replace(/(name="theme-color" content=")[^"]*"/, `$1${esc(c.apariencia.colorPrincipal)}"`)
    .replace(/(rel="icon" href=")[^"]*"/, `$1${esc(c.apariencia.logo || '/logo.svg')}"`)
    .replace('<div id="root"></div>', () =>
      `<div id="root">${cuerpo}</div>\n    <script id="contenido-inicial" type="application/json">${json}</script>`)
  html = url
    ? html.replace(/(rel="canonical" href=")[^"]*"/, `$1${url}"`).replace(/(property="og:url" content=")[^"]*"/, `$1${url}"`)
    : html.replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<meta property="og:url"[^>]*>/, '')
  html = imagen
    ? html.replace(/(property="og:image" content=")[^"]*"/, `$1${esc(imagen)}"`)
    : html.replace(/\s*<meta property="og:image"[^>]*>/, '')
  if (!indexable) html = html.replace('</title>', '</title>\n    <meta name="robots" content="noindex, nofollow">')
  if (!html.includes('<div id="root"><')) throw new Error(`No se pudo prerenderizar ${ruta}`)
  return html
}

function escribir(ruta, html) {
  if (ruta === '/404') return writeFileSync(join(dist, '404.html'), html, 'utf-8')
  const dir = join(dist, ruta)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html, 'utf-8')
}

console.log('Prerenderizando páginas...')
// Todas, también las desactivadas: si alguien las activa en el editor
// funcionan al momento (y mientras tanto dicen «no encontrada»).
for (const p of PAGINAS) {
  escribir(p.ruta, pagina(p.ruta, p.titulo(c), p.descripcion(c), p.visible(c)))
  console.log(`  ✓ ${p.ruta}${p.visible(c) ? '' : ' (desactivada)'}`)
}
for (const p of PAGINAS_PRIVADAS) {
  escribir(p.ruta, pagina(p.ruta, p.titulo(c), '', false))
  console.log(`  ✓ ${p.ruta}`)
}

if (SITE) {
  const hoy = new Date().toISOString().slice(0, 10)
  const urls = PAGINAS.filter(p => p.visible(c)).map(p => `  <url><loc>${SITE}${p.ruta}</loc><lastmod>${hoy}</lastmod></url>`)
  writeFileSync(join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 'utf-8')
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nDisallow: /kraal\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf-8')
  console.log('  ✓ sitemap.xml')
} else {
  console.log('  (sin VITE_URL_WEB: no se genera sitemap.xml)')
}

rmSync('dist-ssr', { recursive: true, force: true })
console.log('Hecho.')
