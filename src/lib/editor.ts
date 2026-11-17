// Guardar el contenido de la web desde Kraal → Editar la web.

import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.ts'
import { CONTENIDO_INICIAL, leerJson, type Contenido } from './contenido.ts'

export { problemas } from './validar.ts'

/** Otra administradora ha guardado mientras tenías el editor abierto. */
export class ConflictoContenido extends Error {
  constructor(readonly correo: string) { super('El contenido ha cambiado desde que se abrió') }
}

export async function leerParaEditar(): Promise<{ contenido: Contenido; version: number; correo: string }> {
  const snap = await getDoc(doc(db, 'web', 'contenido'))
  const x = snap.data()
  return {
    contenido: leerJson(x?.datos) ?? CONTENIDO_INICIAL,
    version: Number.isInteger(x?.version) ? x!.version : 0,
    correo: String(x?.actualizadoPor ?? ''),
  }
}

/**
 * Publica el contenido. `version` es la que se cargó al abrir el editor: si
 * en la base de datos hay otra, alguien guardó entretanto y no se escribe
 * nada (salvo con `sobrescribir`). Devuelve la versión nueva.
 */
export async function publicar(c: Contenido, version: number, correo: string, sobrescribir = false): Promise<number> {
  const ref = doc(db, 'web', 'contenido')
  return runTransaction(db, async tx => {
    const actual = await tx.get(ref)
    const enBase = Number.isInteger(actual.data()?.version) ? actual.data()!.version as number : 0
    if (!sobrescribir && enBase !== version) throw new ConflictoContenido(String(actual.data()?.actualizadoPor ?? ''))
    tx.set(ref, { datos: JSON.stringify(c), version: enBase + 1, actualizadoPor: correo, actualizado: serverTimestamp() })
    return enBase + 1
  })
}
