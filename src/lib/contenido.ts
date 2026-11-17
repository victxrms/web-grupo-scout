// Contenido editable de la web (textos, secciones, documentos, fotos...).
//
// Vive en UN documento de Firestore (web/contenido, campo «datos» con el JSON)
// que se edita desde Kraal → Editar la web. src/contenido/inicial.json es el
// contenido de partida: se usa hasta que alguien guarda desde el editor y
// para rellenar campos que falten (p. ej. tras actualizar la plantilla).
//
// Las páginas públicas lo leen con una petición web normal (API REST de
// Firestore), sin cargar la librería de Firebase: así cargan rápido.

import { createContext, useContext } from 'react'
import inicial from '../contenido/inicial.json' with { type: 'json' }

export interface Seccion {
  /** Identificador corto sin espacios (manada, tropa...). Se usa en los enlaces. */
  id: string
  nombre: string
  rama: string
  edades: string
  emoji: string
  texto: string
}

export interface Enlace {
  titulo: string
  descripcion: string
  url: string
  /** Aviso corto opcional (p. ej. «Solo para mayores de 12 años»). */
  nota: string
}

export interface Herramienta {
  emoji: string
  titulo: string
  texto: string
  url: string
}

export interface Persona {
  nombre: string
  cargo: string
}

export interface Contenido {
  grupo: {
    nombre: string
    nombreCorto: string
    lema: string
    ciudad: string
    provincia: string
    email: string
    /** Número para WhatsApp con prefijo y sin «+» ni espacios: 34600111222. Vacío = sin WhatsApp. */
    whatsapp: string
    /** Teléfono tal como se enseña: «600 111 222». */
    telefono: string
    /** El teléfono solo atiende WhatsApp (no llamadas). */
    soloWhatsapp: boolean
    sede: string
    direccion: string
    codigoPostal: string
    mapsUrl: string
    fichaInscripcionUrl: string
    federacion: { nombre: string; url: string }[]
    redes: { instagram: string; youtube: string; facebook: string; tiktok: string }
  }
  apariencia: {
    /** Color principal en hexadecimal (#2F5D50). */
    colorPrincipal: string
    logo: string
    fotosPortada: string[]
  }
  inicio: { titulo: string; presentacion: string }
  secciones: Seccion[]
  unete: {
    intro: string
    pasos: { titulo: string; texto: string }[]
    notaEdades: string
    voluntariado: string
  }
  documentos: Enlace[]
  galeria: string[]
  lugares: { mapaUrl: string; texto: string }
  herramientas: Herramienta[]
  equipo: { intro: string; personas: Persona[] }
  aviso: { activo: boolean; texto: string; enlace: string; textoEnlace: string; hasta: string }
  paginas: {
    galeria: boolean
    documentos: boolean
    lugares: boolean
    herramientas: boolean
    equipo: boolean
    patrullometro: boolean
  }
}

export const CONTENIDO_INICIAL = inicial as Contenido

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Mezcla lo guardado con el contenido de partida: lo que falte o tenga otro
 * tipo se toma de `base`. Así la web no se rompe si el documento está
 * incompleto o es de una versión anterior de la plantilla.
 */
export function completar<T>(guardado: unknown, base: T): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(guardado)) return base
    const modelo = base.length > 0 ? vacio(base[0]) : CONTENIDO_MODELOS.get(base)
    return (modelo === undefined ? guardado : guardado.map(x => completar(x, modelo))) as T
  }
  if (esObjeto(base)) {
    const g = esObjeto(guardado) ? guardado : {}
    const r: Record<string, unknown> = {}
    for (const k of Object.keys(base)) r[k] = completar(g[k], (base as Record<string, unknown>)[k])
    return r as T
  }
  return (typeof guardado === typeof base ? guardado : base) as T
}

/** Misma forma que `x` pero en blanco: textos vacíos, listas vacías, false, 0. */
export function vacio<T>(x: T): T {
  if (Array.isArray(x)) return [] as T
  if (esObjeto(x)) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, vacio(v)])) as T
  return (typeof x === 'string' ? '' : typeof x === 'number' ? 0 : typeof x === 'boolean' ? false : x) as T
}

// Modelo de los elementos de las listas que en el contenido inicial están vacías.
const CONTENIDO_MODELOS = new Map<unknown, unknown>([
  [CONTENIDO_INICIAL.documentos, { titulo: '', descripcion: '', url: '', nota: '' }],
  [CONTENIDO_INICIAL.galeria, ''],
  [CONTENIDO_INICIAL.herramientas, { emoji: '', titulo: '', texto: '', url: '' }],
  [CONTENIDO_INICIAL.equipo.personas, { nombre: '', cargo: '' }],
  [CONTENIDO_INICIAL.apariencia.fotosPortada, ''],
])

/** Convierte el texto guardado en contenido válido (o null si no se puede leer). */
export function leerJson(texto: unknown): Contenido | null {
  if (typeof texto !== 'string' || !texto) return null
  try {
    return completar(JSON.parse(texto), CONTENIDO_INICIAL)
  } catch {
    return null
  }
}

/** Lee el contenido publicado (sin la librería de Firebase). Null si aún no hay. */
export async function leerContenidoPublicado(proyecto: string, clave: string): Promise<Contenido | null> {
  if (!proyecto || !clave) return null
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/web/contenido?key=${clave}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore respondió ${res.status}`)
  const doc = (await res.json()) as { fields?: { datos?: { stringValue?: string } } }
  return leerJson(doc.fields?.datos?.stringValue)
}

export const ContextoContenido = createContext<Contenido>(CONTENIDO_INICIAL)

export const useContenido = () => useContext(ContextoContenido)

// ─── Ayudas para las páginas ────────────────────────────────────────────────

/** Enlace de WhatsApp con un mensaje ya escrito (null si el grupo no tiene WhatsApp). */
export function enlaceWhatsapp(c: Contenido, mensaje: string): string | null {
  const n = c.grupo.whatsapp.replace(/\D/g, '')
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : null
}

export const enlaceCorreo = (c: Contenido, asunto: string) =>
  `mailto:${c.grupo.email}?subject=${encodeURIComponent(asunto)}`

/** ¿Se enseña el aviso? (activo, con texto y sin caducar). */
export function avisoVigente(c: Contenido, hoy = new Date()): boolean {
  const a = c.aviso
  if (!a.activo || !a.texto.trim()) return false
  if (!a.hasta) return true
  return hoy < new Date(`${a.hasta}T23:59:59`)
}

/** Solo URLs seguras para enlaces e imágenes: http(s), mailto, tel o rutas de la propia web. */
export function urlSegura(url: string): string | null {
  const u = url.trim()
  if (!u) return null
  if (u.startsWith('/') && !u.startsWith('//')) return u
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : null
}

/** Color hexadecimal válido o el de partida. */
export function colorValido(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : CONTENIDO_INICIAL.apariencia.colorPrincipal
}
