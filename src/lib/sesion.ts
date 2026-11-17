// Inicio de sesión del Kraal (cuenta de Google) y permisos de cada persona.

import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth'
import {
  clearIndexedDbPersistence, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, terminate,
} from 'firebase/firestore'
import { auth } from './auth.ts'
import { db } from './firebase.ts'
import { normalizarCorreo, normalizarDominio, rolDeCuenta, type Rol } from './roles.ts'

export type { Rol }

/** Administradora inicial: la pone `npm run configurar` (y la misma en firestore.rules). */
export const ADMIN_INICIAL = normalizarCorreo(import.meta.env.VITE_ADMIN_INICIAL ?? '')

export function proveedorGoogle() {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

export async function entrarConGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, proveedorGoogle())
  } catch (e) {
    const code = (e as { code?: string }).code
    // Algunos móviles bloquean las ventanas emergentes: se usa redirección.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, proveedorGoogle())
      return
    }
    throw e
  }
}

/**
 * Cierra la sesión y borra del dispositivo la copia local de los datos
 * (nombres de educandos y pagos). Después se recarga la página: tras borrar
 * la copia, esta conexión con Firestore ya no se puede usar.
 */
export async function salir() {
  await signOut(auth)
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch (e) {
    console.warn('No se ha podido borrar la copia local:', e)
  }
  window.location.reload()
}

export const observarSesion = (alCambiar: (u: User | null) => void) => onAuthStateChanged(auth, alCambiar)

/** Dominio del grupo guardado en web/acceso ('' si no hay). */
export async function leerDominio(): Promise<string> {
  const snap = await getDoc(doc(db, 'web', 'acceso'))
  return normalizarDominio(String(snap.data()?.dominio ?? ''))
}

export async function rolDe(u: User): Promise<Rol | null> {
  const cuenta = { email: u.email, verificado: u.emailVerified, google: u.providerData.some(p => p.providerId === 'google.com') }
  if (!cuenta.email) return null
  const [miembro, dominio] = await Promise.all([
    getDoc(doc(db, 'miembros', normalizarCorreo(cuenta.email))).then(s => (s.exists() ? (s.data() as { rol: unknown }) : null)),
    leerDominio().catch(() => ''),
  ])
  return rolDeCuenta(cuenta, { adminInicial: ADMIN_INICIAL, miembro, dominio })
}

// ─── Personas con acceso (solo administradoras) ─────────────────────────────

export interface Miembro {
  correo: string
  nombre: string
  rol: Rol
}

export async function listarMiembros(): Promise<Miembro[]> {
  const snap = await getDocs(collection(db, 'miembros'))
  return snap.docs
    .map(d => ({ correo: d.id, nombre: String(d.data().nombre ?? ''), rol: d.data().rol === 'admin' ? 'admin' as const : 'scouter' as const }))
    .sort((a, b) => a.correo.localeCompare(b.correo))
}

export async function guardarMiembro(m: Miembro) {
  await setDoc(doc(db, 'miembros', normalizarCorreo(m.correo)), {
    nombre: m.nombre.trim().slice(0, 80), rol: m.rol, actualizado: serverTimestamp(),
  })
}

export const quitarMiembro = (correo: string) => deleteDoc(doc(db, 'miembros', normalizarCorreo(correo)))

export async function guardarDominio(dominio: string) {
  await setDoc(doc(db, 'web', 'acceso'), { dominio: normalizarDominio(dominio), actualizado: serverTimestamp() })
}
