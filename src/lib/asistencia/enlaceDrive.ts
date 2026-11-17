// Interpreta el enlace de Google Drive del listado de educandos.
// Lógica pura (sin red) para poder probarla.

/** Los IDs de Drive son letras, números, «-» y «_» (normalmente 25-44 caracteres). */
export const PATRON_ID_DRIVE = /^[A-Za-z0-9_-]{10,200}$/

/**
 * Saca el ID del archivo de cualquier enlace habitual de Drive/Sheets:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   https://drive.google.com/open?id=<ID>
 *   https://drive.google.com/uc?id=<ID>&export=download
 * También acepta el ID pegado tal cual. Devuelve null si no es un enlace de Drive.
 */
export function idDeEnlaceDrive(enlace: string): string | null {
  const t = enlace.trim()
  if (PATRON_ID_DRIVE.test(t)) return t

  let url: URL
  try { url = new URL(t) } catch { return null }
  if (url.protocol !== 'https:') return null
  if (!['docs.google.com', 'drive.google.com'].includes(url.hostname)) return null

  const enRuta = /\/d\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1]
  const id = enRuta ?? url.searchParams.get('id')
  return id && PATRON_ID_DRIVE.test(id) ? id : null
}

/** Enlace para abrir el archivo en Drive (para mostrarlo a la administradora). */
export const enlaceDeId = (id: string) => `https://drive.google.com/open?id=${encodeURIComponent(id)}`
