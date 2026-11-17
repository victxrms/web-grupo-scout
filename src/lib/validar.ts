// Comprobaciones del contenido antes de publicarlo (lógica pura, con pruebas).

import { colorValido, urlSegura, type Contenido } from './contenido.ts'

/** Firestore admite documentos de hasta 1 MiB: se deja margen. */
export const MAX_BYTES = 900_000

/** Problemas que impiden guardar (vacío si todo está bien). */
export function problemas(c: Contenido): string[] {
  const p: string[] = []
  if (!c.grupo.nombre.trim()) p.push('General: falta el nombre del grupo.')
  if (c.grupo.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.grupo.email.trim())) p.push('General: el correo no es válido.')
  if (c.grupo.whatsapp && !/^\d{8,15}$/.test(c.grupo.whatsapp.replace(/[\s+]/g, ''))) {
    p.push('General: el WhatsApp debe ser el número con prefijo de país, sin espacios (34600111222).')
  }
  if (colorValido(c.apariencia.colorPrincipal) !== c.apariencia.colorPrincipal.trim()) p.push('Apariencia: el color debe ser como #2F5D50.')
  const ids = new Set<string>()
  c.secciones.forEach((s, i) => {
    if (!s.nombre.trim()) p.push(`Secciones: la nº ${i + 1} no tiene nombre.`)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) p.push(`Secciones: el identificador de «${s.nombre || i + 1}» solo puede llevar minúsculas, números y guiones.`)
    if (ids.has(s.id)) p.push(`Secciones: el identificador «${s.id}» está repetido.`)
    ids.add(s.id)
  })
  const urls: [string, string][] = [
    ['General: enlace de Google Maps', c.grupo.mapsUrl],
    ['General: ficha de inscripción', c.grupo.fichaInscripcionUrl],
    ['Apariencia: logo', c.apariencia.logo],
    ['Aviso: enlace', c.aviso.enlace],
    ...Object.entries(c.grupo.redes).map(([k, v]) => [`General: ${k}`, v] as [string, string]),
    ...c.documentos.map(d => [`Documentos: «${d.titulo}»`, d.url] as [string, string]),
    ...c.herramientas.map(h => [`Herramientas: «${h.titulo}»`, h.url] as [string, string]),
    ...c.galeria.map((u, i) => [`Galería: foto nº ${i + 1}`, u] as [string, string]),
    ...c.apariencia.fotosPortada.map((u, i) => [`Apariencia: foto de portada nº ${i + 1}`, u] as [string, string]),
  ]
  for (const [donde, url] of urls) {
    if (url.trim() && !urlSegura(url)) p.push(`${donde}: el enlace debe empezar por https:// (o / para archivos de la web).`)
  }
  if (c.aviso.hasta && !/^\d{4}-\d{2}-\d{2}$/.test(c.aviso.hasta)) p.push('Aviso: la fecha no es válida.')
  if (new TextEncoder().encode(JSON.stringify(c)).length > MAX_BYTES) p.push('Hay demasiado contenido (más de 900 KB). Quita fotos de la galería o textos largos.')
  return p
}
