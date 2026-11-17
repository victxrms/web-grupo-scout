/**
 * Asistente de configuración:  npm run configurar
 *
 * Pregunta los datos de vuestro proyecto de Firebase y deja el proyecto listo:
 *   - crea el archivo .env (configuración de la web),
 *   - pone vuestra administradora inicial en firestore.rules,
 *   - apunta .firebaserc y los workflows de GitHub a vuestro proyecto.
 * Se puede ejecutar las veces que haga falta.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { stdin as input, stdout as output } from 'process'

const rl = createInterface({ input, output })
// Se leen las líneas en orden (funciona igual escribiendo que pegando o con «|»).
const lineas = rl[Symbol.asyncIterator]()
async function linea(texto = '') {
  if (texto) output.write(texto)
  const { value, done } = await lineas.next()
  return done ? '' : value
}
const leerEnv = () => Object.fromEntries(
  (existsSync('.env') ? readFileSync('.env', 'utf-8') : '').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]),
)
const actual = leerEnv()

async function preguntar(texto, porDefecto = '', validar = () => true) {
  for (;;) {
    const r = (await linea(`${texto}${porDefecto ? ` [${porDefecto}]` : ''}: `)).trim() || porDefecto
    if (validar(r)) return r
    console.log('  ✗ No parece correcto, prueba otra vez.')
  }
}

console.log(`
╭───────────────────────────────────────────────╮
│  Configurar la web del grupo                  │
╰───────────────────────────────────────────────╯
Antes de seguir necesitas (ver README.md, paso 2):
  1. Un proyecto en https://console.firebase.google.com
  2. Una «app web» registrada en ese proyecto.

En Firebase: ⚙ Configuración del proyecto → General → Tus apps → App web →
«Configuración del SDK» → marca «Configuración». Copia el bloque
\`const firebaseConfig = { ... }\` entero, pégalo aquí y pulsa Intro dos veces.
(Si ya configuraste antes, pulsa Intro dos veces para mantener lo que había.)
`)

let pegado = ''
for (;;) {
  const l = await linea()
  if (!l.trim() && (pegado.includes('}') || !pegado.trim())) break
  pegado += l + '\n'
}
const dato = clave => pegado.match(new RegExp(`${clave}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1]
const firebase = {
  VITE_FIREBASE_API_KEY: dato('apiKey') ?? actual.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: dato('authDomain') ?? actual.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: dato('projectId') ?? actual.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: dato('storageBucket') ?? actual.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: dato('messagingSenderId') ?? actual.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  VITE_FIREBASE_APP_ID: dato('appId') ?? actual.VITE_FIREBASE_APP_ID,
}
const faltan = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'].filter(k => !firebase[k])
if (faltan.length) {
  console.log(`\n✗ No encuentro ${faltan.join(', ')} en lo que has pegado. Vuelve a ejecutar «npm run configurar».`)
  process.exit(1)
}
console.log(`✓ Proyecto de Firebase: ${firebase.VITE_FIREBASE_PROJECT_ID}\n`)

const admin = (await preguntar(
  'Correo de Google de la primera administradora (la tuya)',
  actual.VITE_ADMIN_INICIAL,
  r => /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(r) && !/['"\\]/.test(r),
)).toLowerCase()

const urlWeb = (await preguntar(
  'Dirección de la web (Intro para usar la gratuita de Firebase)',
  actual.VITE_URL_WEB || `https://${firebase.VITE_FIREBASE_PROJECT_ID}.web.app`,
  r => /^https:\/\/[^\s/]+$/.test(r.replace(/\/+$/, '')),
)).replace(/\/+$/, '')

// Con dominio propio, iniciar sesión desde ese dominio evita problemas en
// Safari (iPhone). Ver README, «Dominio propio».
const dominioWeb = new URL(urlWeb).host
if (!dominioWeb.endsWith('.web.app') && !dominioWeb.endsWith('.firebaseapp.com')) {
  const usarlo = await preguntar(`¿Iniciar sesión desde ${dominioWeb}? Recomendado si ya está conectado en Firebase Hosting (s/n)`, 's', r => /^[sn]/i.test(r))
  if (/^s/i.test(usarlo)) firebase.VITE_FIREBASE_AUTH_DOMAIN = dominioWeb
}
rl.close()

// .env
const env = {
  ...firebase,
  VITE_ADMIN_INICIAL: admin,
  VITE_URL_WEB: urlWeb,
  VITE_RECAPTCHA_SITE_KEY: actual.VITE_RECAPTCHA_SITE_KEY ?? '',
}
writeFileSync('.env', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', 'utf-8')
console.log('\n✓ .env creado')

// firestore.rules: administradora inicial
const reglas = readFileSync('firestore.rules', 'utf-8')
const nuevas = reglas.replace(/return correo\(\) == '[^']*'; \/\/ ← admin-inicial/, `return correo() == '${admin}'; // ← admin-inicial`)
if (nuevas === reglas && !reglas.includes(`'${admin}'; // ← admin-inicial`)) {
  console.log('✗ No encuentro la línea «← admin-inicial» en firestore.rules: ¿la has cambiado a mano?')
  process.exit(1)
}
writeFileSync('firestore.rules', nuevas, 'utf-8')
console.log('✓ firestore.rules: administradora inicial', admin)

// .firebaserc y workflows
const proyecto = firebase.VITE_FIREBASE_PROJECT_ID
writeFileSync('.firebaserc', JSON.stringify({ projects: { default: proyecto } }, null, 2) + '\n', 'utf-8')
for (const f of ['.github/workflows/publicar.yml', '.github/workflows/vista-previa.yml']) {
  if (!existsSync(f)) continue
  // El secreto lo crea `firebase init hosting:github` con este nombre.
  const secreto = `FIREBASE_SERVICE_ACCOUNT_${proyecto.toUpperCase().replace(/-/g, '_')}`
  writeFileSync(f, readFileSync(f, 'utf-8')
    .replace(/projectId: .*/, `projectId: ${proyecto}`)
    .replace(/secrets\.FIREBASE_SERVICE_ACCOUNT\w*/, `secrets.${secreto}`), 'utf-8')
}
console.log('✓ .firebaserc y workflows de GitHub apuntan a', proyecto)

console.log(`
Siguientes pasos (detallados en README.md):
  • Publicar las reglas de seguridad:   npm run reglas
  • Probar la web en tu ordenador:      npm run dev
  • En GitHub → Settings → Secrets and variables → Actions, crea estos
    secretos con los valores de tu archivo .env:
      ${Object.keys(env).filter(k => env[k]).join('\n      ')}
`)
