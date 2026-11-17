// Patrullómetro desde el Kraal: cambiar puntos (scouters) y gestionar las
// patrullas (administradoras). Las reglas están en firestore.rules.

import {
  collection, deleteDoc, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc,
  updateDoc, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.ts'
import { ordenar, type CambioPuntos } from './patrullometro.ts'
import type { Patrulla } from './types.ts'
import { idPatrulla } from './puntos-id.ts'

export function seguirPatrullas(alCambiar: (p: Patrulla[]) => void, alFallar: (e: Error) => void) {
  return onSnapshot(collection(db, 'patrullas'), snap => {
    alCambiar(ordenar(snap.docs.map(d => ({
      id: d.id,
      nombre: String(d.data().nombre ?? d.id),
      emoji: String(d.data().emoji ?? ''),
      puntos: Number(d.data().puntos ?? 0),
    }))))
  }, alFallar)
}

export function seguirHistorial(alCambiar: (h: CambioPuntos[]) => void) {
  return onSnapshot(query(collection(db, 'historial'), orderBy('fecha', 'desc'), limit(10)), snap => {
    alCambiar(snap.docs.map(d => {
      const x = d.data()
      return {
        id: d.id,
        patrulla: String(x.patrulla ?? ''),
        cambio: Number(x.cambio ?? 0),
        motivo: String(x.motivo ?? ''),
        scouter: String(x.scouter ?? ''),
        fecha: x.fecha?.toDate?.() ?? null,
      }
    }))
  })
}

/** Suma (o resta) puntos y lo apunta en el historial, todo a la vez. */
export async function cambiarPuntos(patrulla: string, cambio: number, motivo: string, scouter: string) {
  const lote = writeBatch(db)
  lote.update(doc(db, 'patrullas', patrulla), { puntos: increment(cambio) })
  lote.set(doc(collection(db, 'historial')), {
    patrulla, cambio, motivo: motivo.trim().slice(0, 200), scouter: scouter.trim().slice(0, 60), fecha: serverTimestamp(),
  })
  await lote.commit()
}

export async function crearPatrulla(nombre: string, emoji: string) {
  const id = idPatrulla(nombre)
  if (!id) throw new Error('Nombre no válido')
  await setDoc(doc(db, 'patrullas', id), { nombre: nombre.trim().slice(0, 40), emoji: emoji.trim().slice(0, 8), puntos: 0 })
}

export const editarPatrulla = (id: string, nombre: string, emoji: string) =>
  updateDoc(doc(db, 'patrullas', id), { nombre: nombre.trim().slice(0, 40), emoji: emoji.trim().slice(0, 8) })

export const borrarPatrulla = (id: string) => deleteDoc(doc(db, 'patrullas', id))

/** Pone todas las patrullas a 0 (p. ej. al empezar la ronda). El historial se conserva. */
export async function ponerACero(patrullas: Patrulla[]) {
  const lote = writeBatch(db)
  for (const p of patrullas) lote.update(doc(db, 'patrullas', p.id), { puntos: 0 })
  await lote.commit()
}
