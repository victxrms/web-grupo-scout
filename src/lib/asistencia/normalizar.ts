// Normalización de textos del listado de educandos.
// Sin dependencias de Firebase ni del navegador: se usa también en las pruebas.

/** Quita espacios sobrantes y caracteres invisibles/de control. */
export function limpiarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F​-‍﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Clave para comparar textos sin que importen mayúsculas, tildes ni espacios:
 * "  Tropa  Atenas", "tropa atenas" y "TROPA ATÉNAS" dan la misma clave.
 */
export function claveTexto(valor: unknown): string {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Versión de la clave apta para identificadores: solo a-z, 0-9 y guiones. */
export function slug(valor: unknown, max = 80): string {
  return claveTexto(valor)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** Patrones que también comprueban las reglas de Firestore (firestore.rules). */
export const PATRON_ID_EDUCANDO = /^[a-z0-9-]{1,100}$/
export const PATRON_CLAVE_SECCION = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const PATRON_FECHA = /^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/

/**
 * Clave de un nombre que solo lleva iniciales en los apellidos.
 * Une las letras sueltas seguidas para que estas formas den lo mismo:
 *   "Ana G.P." · "Ana G. P." · "ana gp" · "Ana G-P"  →  "ana-gp"
 * (Sin esto, una corrección de formato en el Excel crearía una persona nueva.)
 */
export function claveNombre(valor: unknown, max = 90): string {
  const trozos = claveTexto(valor).split(/[^a-z0-9]+/).filter(Boolean)
  const unidos: string[] = []
  let anteriorEraInicial = false
  for (const t of trozos) {
    const inicial = t.length === 1 && /[a-z]/.test(t)
    if (inicial && anteriorEraInicial) unidos[unidos.length - 1] += t // g + p → gp
    else unidos.push(t)
    anteriorEraInicial = inicial
  }
  return unidos.join('-').slice(0, max).replace(/-+$/g, '')
}

/**
 * ID estable de un educando.
 * - Si el Excel tiene columna de ID: "x-<id>".
 * - Si no: "n-<nombre y apellidos normalizados>".
 * La sección NO forma parte del ID a propósito: así un cambio de sección
 * conserva todo el histórico de asistencias y pagos.
 */
export function idEducando(idExcel: string, nombre: string, apellidos: string): string {
  if (idExcel) return `x-${slug(idExcel, 90)}`
  return `n-${claveNombre(`${nombre} ${apellidos}`)}`
}

/** ID de la reunión: única por (sección, fecha). */
export const idReunion = (seccionClave: string, fecha: string) => `${seccionClave}_${fecha}`

/** ID del registro de un educando en una reunión. */
export const idRegistro = (reunionId: string, educandoId: string) => `${reunionId}__${educandoId}`

/** Fecha local (no UTC) en formato AAAA-MM-DD. */
export function fechaLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** ¿Es una fecha real con formato AAAA-MM-DD? (rechaza 2025-02-31) */
export function esFechaValida(fecha: string): boolean {
  if (!PATRON_FECHA.test(fecha)) return false
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
}

/** "2025-10-04" → "sáb. 4 oct. 2025" */
export function fechaLegible(fecha: string): string {
  if (!esFechaValida(fecha)) return fecha
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Orden alfabético en español (ñ, tildes). */
export const compararEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })
