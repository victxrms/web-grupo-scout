// Quién puede entrar en el Kraal y con qué permisos. Lógica pura (sin
// Firebase) para poder probarla.
//
// OJO: esto solo decide qué se ENSEÑA en pantalla. Lo que protege los datos
// de verdad es firestore.rules, que exige lo mismo en los servidores de Google.
//
//   admin   → todo: editar la web, personas con acceso, ajustes de asistencia...
//   scouter → pasar lista y cambiar puntos del Patrullómetro.
//
// Tiene acceso quien:
//   - es la administradora inicial (VITE_ADMIN_INICIAL, la pone `npm run configurar`),
//   - está en la lista de personas (miembros/{correo}), o
//   - tiene una cuenta del dominio del grupo (si se ha configurado uno), como scouter.

export type Rol = 'admin' | 'scouter'

export interface Cuenta {
  email: string | null
  verificado: boolean
  /** Ha entrado con Google (no con otro método). */
  google: boolean
}

export const normalizarCorreo = (email: string) => email.trim().toLowerCase()

export const PATRON_CORREO = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/

/** Dominio válido («migrupo.org») o '' si no se usa. */
export function normalizarDominio(d: string): string {
  const x = d.trim().toLowerCase().replace(/^@/, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x) ? x : ''
}

export function rolDeCuenta(
  cuenta: Cuenta,
  opciones: { adminInicial: string; miembro: { rol: unknown } | null; dominio: string },
): Rol | null {
  if (!cuenta.email || !cuenta.verificado || !cuenta.google) return null
  const correo = normalizarCorreo(cuenta.email)
  if (opciones.adminInicial && correo === normalizarCorreo(opciones.adminInicial)) return 'admin'
  if (opciones.miembro) return opciones.miembro.rol === 'admin' ? 'admin' : 'scouter'
  const dominio = normalizarDominio(opciones.dominio)
  if (dominio && correo.slice(correo.lastIndexOf('@') + 1) === dominio) return 'scouter'
  return null
}
