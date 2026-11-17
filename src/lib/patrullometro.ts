// Lectura pública del Patrullómetro.
//
// Los puntos se piden a Firestore con una petición web normal (su API REST),
// sin cargar la librería de Firebase ni reCAPTCHA en la página pública: así
// carga casi al instante. Se vuelve a consultar cada 30 segundos.
//
// Para que esta vía funcione, App Check NO debe estar en modo obligatorio
// ("enforced") para Firestore en la consola de Firebase. Mientras lo esté,
// la petición se rechaza y la página recurre sola al método anterior
// (librería de Firebase en tiempo real, ver patrullometro-sdk.ts).

import type { Patrulla } from './types'

export interface CambioPuntos {
  id: string
  patrulla: string
  cambio: number
  motivo: string
  scouter: string
  fecha: Date | null
}

export interface Clasificacion {
  patrullas: Patrulla[]
  historial: CambioPuntos[]
}

const PROJECT = import.meta.env.VITE_FIREBASE_PROJECT_ID as string
const KEY = import.meta.env.VITE_FIREBASE_API_KEY as string
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

export const INTERVALO_MS = 30_000

// Firestore devuelve cada campo envuelto en su tipo: { stringValue: 'x' }, { integerValue: '12' }...
type Campo = { stringValue?: string; integerValue?: string; doubleValue?: number; timestampValue?: string }
type Documento = { name: string; fields?: Record<string, Campo> }

const texto = (c?: Campo) => c?.stringValue ?? ''
const numero = (c?: Campo) => Number(c?.integerValue ?? c?.doubleValue ?? 0)
const idDe = (doc: Documento) => doc.name.split('/').pop() ?? doc.name

export function ordenar(patrullas: Patrulla[]): Patrulla[] {
  return [...patrullas].sort((a, b) => b.puntos - a.puntos)
}

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Firestore respondió ${res.status}`)
  return res.json()
}

export async function leerClasificacion(): Promise<Clasificacion> {
  const [resPatrullas, resHistorial] = await Promise.all([
    pedir(`${BASE}/patrullas?key=${KEY}`),
    pedir(`${BASE}:runQuery?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'historial' }],
          orderBy: [{ field: { fieldPath: 'fecha' }, direction: 'DESCENDING' }],
          limit: 10,
        },
      }),
    }),
  ])

  const patrullas: Patrulla[] = ((resPatrullas.documents ?? []) as Documento[]).map(doc => ({
    id: idDe(doc),
    nombre: texto(doc.fields?.nombre),
    emoji: texto(doc.fields?.emoji),
    puntos: numero(doc.fields?.puntos),
  }))

  const historial: CambioPuntos[] = (resHistorial as { document?: Documento }[])
    .filter(r => r.document)
    .map(({ document }) => {
      const f = document!.fields
      const fecha = f?.fecha?.timestampValue
      return {
        id: idDe(document!),
        patrulla: texto(f?.patrulla),
        cambio: numero(f?.cambio),
        motivo: texto(f?.motivo),
        scouter: texto(f?.scouter),
        fecha: fecha ? new Date(fecha) : null,
      }
    })

  return { patrullas: ordenar(patrullas), historial }
}

/**
 * Mantiene la clasificación al día y llama a `alCambiar` con cada lectura.
 * Devuelve una función para dejar de actualizar.
 */
export function seguirClasificacion(alCambiar: (c: Partial<Clasificacion>) => void): () => void {
  let activo = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelarSdk: (() => void) | undefined

  const programar = () => {
    clearTimeout(timer)
    // Con la pestaña en segundo plano no se consulta: se retoma al volver.
    if (activo && !document.hidden) timer = setTimeout(consultar, INTERVALO_MS)
  }

  const consultar = async () => {
    try {
      const datos = await leerClasificacion()
      if (activo) alCambiar(datos)
      programar()
    } catch {
      // La vía rápida no está disponible (p. ej. App Check obligatorio):
      // se usa el método anterior, que carga la librería de Firebase.
      if (!activo || cancelarSdk) return
      try {
        const { seguirConSdk } = await import('./patrullometro-sdk')
        if (activo) cancelarSdk = seguirConSdk(alCambiar)
      } catch {
        programar() // sin conexión: se reintenta más tarde
      }
    }
  }

  const alVolver = () => {
    if (!document.hidden && !cancelarSdk) consultar()
  }
  document.addEventListener('visibilitychange', alVolver)
  consultar()

  return () => {
    activo = false
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', alVolver)
    cancelarSdk?.()
  }
}
