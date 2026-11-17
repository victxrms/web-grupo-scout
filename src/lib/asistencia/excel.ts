// Lector mínimo de hojas de cálculo (.xlsx y .csv) que funciona EN EL NAVEGADOR.
//
// ¿Por qué no una librería? El paquete "xlsx" de npm está abandonado en una
// versión con vulnerabilidades conocidas. Un .xlsx es un ZIP con XML dentro y
// solo necesitamos el texto de las celdas de la primera hoja, así que basta
// con el descompresor del propio navegador (DecompressionStream).
//
// El archivo NUNCA se sube a ningún servidor: se lee aquí y solo se envían a
// la base de datos nombre, apellidos, sección e ID.

export class ErrorHoja extends Error {}

const MAX_ARCHIVO = 10 * 1024 * 1024 // 10 MB
const MAX_DESCOMPRIMIDO = 60 * 1024 * 1024 // protección contra "zip bombs"
const MAX_COLUMNAS = 60
const MAX_FILAS = 5000

/** Lee la primera hoja de un .xlsx o un .csv y devuelve sus celdas como texto. */
export async function leerHoja(datos: ArrayBuffer): Promise<string[][]> {
  if (datos.byteLength === 0) throw new ErrorHoja('El archivo está vacío.')
  if (datos.byteLength > MAX_ARCHIVO) throw new ErrorHoja('El archivo es demasiado grande (máx. 10 MB).')
  const bytes = new Uint8Array(datos)

  // ZIP ("PK\3\4") → .xlsx
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return leerXlsx(bytes)
  // Formato binario antiguo de Office (.xls)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new ErrorHoja('Es un .xls antiguo o está protegido con contraseña. Ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)» sin contraseña.')
  }
  const texto = new TextDecoder('utf-8').decode(bytes)
  if (texto.includes('\u0000')) throw new ErrorHoja('No reconozco el formato del archivo. Usa un .xlsx o un .csv.')
  return leerCsv(texto)
}

// ─── ZIP ─────────────────────────────────────────────────────────────────────

async function leerZip(bytes: Uint8Array): Promise<Map<string, () => Promise<Uint8Array>>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Fin del directorio central: firma 0x06054b50, buscando desde el final.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd === -1) throw new ErrorHoja('El archivo .xlsx está dañado (no es un ZIP válido).')

  const total = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const archivos = new Map<string, () => Promise<Uint8Array>>()
  let descomprimido = 0

  for (let n = 0; n < total; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new ErrorHoja('El archivo .xlsx está dañado.')
    }
    const flags = dv.getUint16(p + 8, true)
    const metodo = dv.getUint16(p + 10, true)
    const tamComp = dv.getUint32(p + 20, true)
    const tam = dv.getUint32(p + 24, true)
    const lNombre = dv.getUint16(p + 28, true)
    const lExtra = dv.getUint16(p + 30, true)
    const lComent = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + lNombre))
    p += 46 + lNombre + lExtra + lComent

    if (flags & 1) throw new ErrorHoja('El Excel está protegido con contraseña. Quítala y vuelve a intentarlo.')
    if (tamComp === 0xffffffff || tam === 0xffffffff) throw new ErrorHoja('El archivo es demasiado grande.')
    descomprimido += tam
    if (descomprimido > MAX_DESCOMPRIMIDO) throw new ErrorHoja('El archivo es demasiado grande una vez descomprimido.')

    archivos.set(nombre, async () => {
      if (dv.getUint32(local, true) !== 0x04034b50) throw new ErrorHoja('El archivo .xlsx está dañado.')
      const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
      const comprimido = bytes.subarray(inicio, inicio + tamComp)
      if (metodo === 0) return comprimido
      if (metodo !== 8) throw new ErrorHoja('El .xlsx usa una compresión no soportada. Guárdalo de nuevo desde Excel.')
      const flujo = new Blob([comprimido as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return new Uint8Array(await new Response(flujo).arrayBuffer())
    })
  }
  return archivos
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

function decodificarXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'amp') return '&'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    const cp = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
  })
}

/** Texto de un <si> o <is>: une todos los <t>, salvo la guía fonética (<rPh>). */
function textoRico(xml: string): string {
  const sinFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let t = ''
  for (const m of sinFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) t += m[1]
  return decodificarXml(t)
}

const atributo = (attrs: string, nombre: string) =>
  new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`).exec(attrs)?.[1] ?? null

/** "B12" → 1 (columna, desde 0) */
function indiceColumna(ref: string): number {
  const letras = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? ''
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

async function leerXlsx(bytes: Uint8Array): Promise<string[][]> {
  const zip = await leerZip(bytes)
  const texto = async (ruta: string) => {
    const f = zip.get(ruta)
    return f ? new TextDecoder('utf-8').decode(await f()) : null
  }

  // Ruta de la PRIMERA hoja según workbook.xml (+ sus relaciones).
  let rutaHoja: string | null = null
  const libro = await texto('xl/workbook.xml')
  const rels = await texto('xl/_rels/workbook.xml.rels')
  if (libro && rels) {
    const hoja = /<sheet\b([^>]*)\/?>/.exec(libro)
    const rid = hoja ? atributo(hoja[1], 'r:id') : null
    if (rid) {
      for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (atributo(m[1], 'Id') === rid) {
          const destino = atributo(m[1], 'Target') ?? ''
          rutaHoja = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`
        }
      }
    }
  }
  if (!rutaHoja || !zip.has(rutaHoja)) {
    rutaHoja = [...zip.keys()].filter(k => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0] ?? null
  }
  if (!rutaHoja) throw new ErrorHoja('El archivo no parece un Excel (.xlsx): no tiene hojas.')

  const compartidas: string[] = []
  const sst = await texto('xl/sharedStrings.xml')
  if (sst) for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) compartidas.push(textoRico(m[1] ?? ''))

  const hojaXml = (await texto(rutaHoja)) ?? ''
  const datos = /<sheetData\b[^>]*>([\s\S]*)<\/sheetData>/.exec(hojaXml)?.[1] ?? ''

  const filas: string[][] = []
  let filaSiguiente = 0
  for (const mf of datos.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(atributo(mf[1], 'r'))
    const idx = Number.isInteger(r) && r > 0 ? r - 1 : filaSiguiente
    filaSiguiente = idx + 1
    if (idx >= MAX_FILAS) throw new ErrorHoja(`La hoja tiene más de ${MAX_FILAS} filas. ¿Es el archivo correcto?`)

    const fila: string[] = []
    let colSiguiente = 0
    for (const mc of (mf[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = atributo(mc[1], 'r')
      const col = ref ? indiceColumna(ref) : colSiguiente
      colSiguiente = col + 1
      if (col < 0 || col >= MAX_COLUMNAS) continue
      const tipo = atributo(mc[1], 't')
      const cuerpo = mc[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1]
      let valor = ''
      if (tipo === 's') valor = compartidas[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoRico(cuerpo)
      else if (tipo === 'b') valor = v === '1' ? 'VERDADERO' : 'FALSO'
      else if (tipo === 'e') valor = ''
      else valor = v === undefined ? '' : decodificarXml(v)
      fila[col] = valor
    }
    filas[idx] = Array.from(fila, c => c ?? '')
  }
  return Array.from(filas, f => f ?? [])
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** CSV con separador «;», «,» o tabulador (se detecta) y comillas dobles. */
export function leerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primera = t.split(/\r?\n/, 1)[0] ?? ''
  const cuenta = (c: string) => primera.split(c).length - 1
  const sep = [';', ',', '\t'].sort((a, b) => cuenta(b) - cuenta(a))[0]

  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++ }
      else if (c === '"') comillas = false
      else celda += c
    } else if (c === '"' && celda === '') comillas = true
    else if (c === sep) { fila.push(celda); celda = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      fila.push(celda); filas.push(fila); fila = []; celda = ''
      if (filas.length > MAX_FILAS) throw new ErrorHoja(`El archivo tiene más de ${MAX_FILAS} filas.`)
    } else celda += c
  }
  if (celda !== '' || fila.length > 0) { fila.push(celda); filas.push(fila) }
  return filas
}
