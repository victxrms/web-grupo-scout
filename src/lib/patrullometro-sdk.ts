// Vía de respaldo del Patrullómetro: librería de Firebase en tiempo real.
// Solo se descarga si la lectura rápida (patrullometro.ts) es rechazada.
// Cuando App Check deje de ser obligatorio y se compruebe que la vía rápida
// funciona en producción, este fichero se puede borrar.
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { db } from './firebase'
import { ordenar, type Clasificacion } from './patrullometro'
import type { HistorialEntry, Patrulla } from './types'

export function seguirConSdk(alCambiar: (c: Partial<Clasificacion>) => void): () => void {
  const dejarPatrullas = onSnapshot(collection(db, 'patrullas'), snap => {
    const patrullas: Patrulla[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Patrulla, 'id'>) }))
    alCambiar({ patrullas: ordenar(patrullas) })
  })

  const q = query(collection(db, 'historial'), orderBy('fecha', 'desc'), limit(10))
  const dejarHistorial = onSnapshot(q, snap => {
    alCambiar({
      historial: snap.docs.map(d => {
        const h = d.data() as Omit<HistorialEntry, 'id'>
        return { ...h, id: d.id, fecha: h.fecha ? h.fecha.toDate() : null }
      }),
    })
  })

  return () => { dejarPatrullas(); dejarHistorial() }
}
