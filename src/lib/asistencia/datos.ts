// Acceso a Firestore para la página de asistencia y cuotas.
//
// Colecciones (todas protegidas por firestore.rules: solo personas con acceso al Kraal):
//   educandos/{id}                  nombre, apellidos, sección, activo  ← sale del Excel
//   reuniones/{seccion_fecha}       una por (sección, fecha)
//   registrosAsistencia/{reunion__educando}  asistió, dinero recogido y cuota que tocaba
//   ajustesAsistencia/general       cuota de cada sección y enlace (ID) del Excel en Drive
//   (quién es administradora: miembros/{correo}, ver lib/sesion.ts)
//
// Las reglas de Firestore validan tipos, rangos e identificadores en el servidor:
// aunque alguien manipule la página, no puede guardar datos con otro formato.

import {
  collection, doc, getDoc, getDocFromCache, getDocs, getDocsFromCache, limit,
  orderBy, query, runTransaction, serverTimestamp, where, writeBatch, type QuerySnapshot,
} from 'firebase/firestore'
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { db } from '../firebase.ts'
import { auth } from '../auth.ts'
import { proveedorGoogle } from '../sesion.ts'
import { PATRON_ID_DRIVE } from './enlaceDrive.ts'
import { ErrorHoja } from './excel.ts'
import { MAX_CENTIMOS, planGuardado, type CuotaSeccion, type Entrada, type Registro } from './cuotas.ts'
import type { EducandoGuardado, EducandoListado, CambiosListado } from './listado.ts'
import {
  PATRON_CLAVE_SECCION, PATRON_FECHA, PATRON_ID_EDUCANDO, idRegistro, idReunion,
} from './normalizar.ts'

export interface Reunion {
  id: string
  seccion: string
  seccionClave: string
  fecha: string
  /** Sube en cada guardado (0 = aún no guardada). Sirve para detectar conflictos. */
  version: number
  /** Quién la guardó por última vez y cuándo. */
  actualizadoPorCorreo: string
  actualizado: Date | null
}

/** Otra persona ha guardado la reunión desde que se abrió en esta pantalla. */
export class ConflictoReunion extends Error {
  constructor(readonly correo: string, readonly cuando: Date | null) {
    super('La reunión ha cambiado desde que se abrió')
  }
}

export interface DatosAsistencia {
  educandos: EducandoGuardado[]
  reuniones: Reunion[]
  registros: Registro[]
  /** Cuotas guardadas por sección (las que falten usan CUOTAS_POR_DEFECTO). */
  cuotas: Record<string, CuotaSeccion>
  /** ID del archivo de Google Drive con el listado (null si aún no se ha configurado). */
  driveFileId: string | null
}

// ─── Lectura ─────────────────────────────────────────────────────────────────
// Se valida lo que llega por si en la base de datos hubiera algo raro
// (p. ej. editado a mano en la consola): mejor ignorarlo que romper la página.

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Educandos, ajustes y las reuniones y registros desde `desde` (inicio de la
 * ronda): así no se descarga cada vez el histórico de años anteriores.
 * Con origen 'cache' se lee la copia guardada en el dispositivo (instantáneo,
 * pero puede no estar al día); sin nada guardado devuelve null.
 */
export async function cargarTodo(desde: string, origen: 'servidor' | 'cache' = 'servidor'): Promise<DatosAsistencia | null> {
  const leer = origen === 'cache' ? getDocsFromCache : getDocs
  const reunionesRonda = query(collection(db, 'reuniones'), where('fecha', '>=', desde))
  const registrosRonda = query(collection(db, 'registrosAsistencia'), where('fecha', '>=', desde))
  const ajustes = doc(db, 'ajustesAsistencia', 'general')
  const [snapE, snapR, snapG, snapA] = await Promise.all([
    leer(collection(db, 'educandos')),
    leer(reunionesRonda),
    leer(registrosRonda),
    origen === 'cache' ? getDocFromCache(ajustes).catch(() => null) : getDoc(ajustes),
  ])
  if (origen === 'cache' && snapE.empty) return null

  const educandos: EducandoGuardado[] = []
  for (const d of snapE.docs) {
    const x = d.data()
    if (!PATRON_ID_EDUCANDO.test(d.id) || typeof x.nombre !== 'string' || typeof x.seccionClave !== 'string') continue
    educandos.push({
      id: d.id,
      nombre: texto(x.nombre, 80),
      apellidos: texto(x.apellidos, 120),
      seccion: texto(x.seccion, 60) || x.seccionClave,
      seccionClave: x.seccionClave,
      idExcel: texto(x.idExcel, 60),
      activo: x.activo !== false,
    })
  }

  const drive = snapA?.data()?.driveFileId
  return {
    educandos, reuniones: leerReuniones(snapR), registros: leerRegistros(snapG),
    cuotas: leerCuotas(snapA?.data()?.cuotas),
    driveFileId: typeof drive === 'string' && PATRON_ID_DRIVE.test(drive) ? drive : null,
  }
}

/** Reuniones y registros de la ronda que empieza en `desde` (para exportarla). */
export async function cargarRonda(desde: string): Promise<{ reuniones: Reunion[]; registros: Registro[] }> {
  const hasta = `${Number(desde.slice(0, 4)) + 1}-09-01`
  const entre = (c: string) => query(collection(db, c), where('fecha', '>=', desde), where('fecha', '<', hasta))
  const [snapR, snapG] = await Promise.all([getDocs(entre('reuniones')), getDocs(entre('registrosAsistencia'))])
  return { reuniones: leerReuniones(snapR), registros: leerRegistros(snapG) }
}

/** Fecha de la reunión más antigua guardada (null si no hay ninguna). */
export async function primeraFecha(): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'reuniones'), orderBy('fecha'), limit(1)))
  const f = snap.docs[0]?.data().fecha
  return typeof f === 'string' && PATRON_FECHA.test(f) ? f : null
}

function leerReuniones(snap: QuerySnapshot): Reunion[] {
  const reuniones: Reunion[] = []
  for (const d of snap.docs) {
    const x = d.data()
    if (typeof x.fecha !== 'string' || typeof x.seccionClave !== 'string') continue
    reuniones.push({ id: d.id, fecha: x.fecha, seccionClave: x.seccionClave, seccion: texto(x.seccion, 60), ...versionDe(x) })
  }
  return reuniones
}

function leerRegistros(snap: QuerySnapshot): Registro[] {
  const registros: Registro[] = []
  for (const d of snap.docs) {
    const x = d.data()
    if (typeof x.educandoId !== 'string' || typeof x.reunionId !== 'string') continue
    if (typeof x.asistio !== 'boolean' || !centimosValidos(x.pagado) || !centimosValidos(x.cargo)) continue
    registros.push({
      reunionId: x.reunionId,
      educandoId: x.educandoId,
      seccionClave: texto(x.seccionClave, 60),
      fecha: texto(x.fecha, 10),
      asistio: x.asistio,
      pagado: x.pagado,
      cargo: x.cargo,
      trimestral: x.trimestral === true,
    })
  }
  return registros
}

function versionDe(x: Record<string, unknown>): Pick<Reunion, 'version' | 'actualizadoPorCorreo' | 'actualizado'> {
  const cuando = x.actualizado as { toDate?: () => Date } | undefined
  return {
    version: Number.isInteger(x.version) ? (x.version as number) : 0,
    actualizadoPorCorreo: texto(x.actualizadoPorCorreo, 120),
    actualizado: typeof cuando?.toDate === 'function' ? cuando.toDate() : null,
  }
}

const centimosValidos = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_CENTIMOS

function leerCuotas(v: unknown): Record<string, CuotaSeccion> {
  const cuotas: Record<string, CuotaSeccion> = {}
  if (!v || typeof v !== 'object') return cuotas
  for (const [clave, c] of Object.entries(v as Record<string, unknown>)) {
    const x = c as { importe?: unknown; trimestral?: unknown } | null
    if (!PATRON_CLAVE_SECCION.test(clave) || !x || !centimosValidos(x.importe)) continue
    cuotas[clave] = { importe: x.importe, trimestral: x.trimestral === true }
  }
  return cuotas
}

// ─── Escritura ───────────────────────────────────────────────────────────────

const MAX_LOTE = 450 // Firestore admite 500 operaciones por lote

/** Registros de una reunión tal como están ahora en la base de datos. */
async function registrosActuales(reunionId: string): Promise<Registro[]> {
  const snap = await getDocs(query(collection(db, 'registrosAsistencia'), where('reunionId', '==', reunionId)))
  return snap.docs.map(d => d.data() as Registro)
}

/**
 * Guarda (o vuelve a guardar) una reunión entera de forma atómica.
 * `versionAbierta` es la versión que se tenía en pantalla: si en la base de
 * datos hay otra, alguien la ha guardado entretanto y se lanza ConflictoReunion
 * sin escribir nada. Con 'sobrescribir', se guarda igualmente y se sustituye
 * lo que guardó la otra persona.
 */
export async function guardarReunion(
  usuario: { uid: string; correo: string },
  seccion: { clave: string; nombre: string },
  fecha: string,
  entradas: Entrada[],
  existentes: Registro[],
  cuota: CuotaSeccion,
  versionAbierta: number | 'sobrescribir',
): Promise<{ reunion: Reunion; escribir: Registro[]; borrar: string[] }> {
  if (!PATRON_CLAVE_SECCION.test(seccion.clave) || !PATRON_FECHA.test(fecha)) throw new Error('Sección o fecha no válidas')
  const reunion = { id: idReunion(seccion.clave, fecha), seccionClave: seccion.clave, fecha }
  // Al sobrescribir se parte de lo que hay ahora, para no dejar registros de la otra persona.
  const base = versionAbierta === 'sobrescribir'
    ? [...existentes.filter(r => r.reunionId !== reunion.id), ...await registrosActuales(reunion.id)]
    : existentes
  const plan = planGuardado(reunion, entradas, base, cuota)
  if (plan.escribir.length + plan.borrar.length + 1 > MAX_LOTE) throw new Error('Demasiados educandos en una sola reunión')

  const ref = doc(db, 'reuniones', reunion.id)
  const version = await runTransaction(db, async tx => {
    const actual = await tx.get(ref)
    const datosActuales = actual.exists() ? versionDe(actual.data()) : null
    const versionActual = datosActuales?.version ?? 0
    if (versionAbierta !== 'sobrescribir' && versionActual !== versionAbierta) {
      throw new ConflictoReunion(datosActuales?.actualizadoPorCorreo ?? '', datosActuales?.actualizado ?? null)
    }
    tx.set(ref, {
      seccion: seccion.nombre.slice(0, 60),
      seccionClave: seccion.clave,
      fecha,
      version: versionActual + 1,
      actualizadoPor: usuario.uid,
      actualizadoPorCorreo: usuario.correo,
      actualizado: serverTimestamp(),
    })
    for (const r of plan.escribir) {
      tx.set(doc(db, 'registrosAsistencia', idRegistro(r.reunionId, r.educandoId)), {
        ...r,
        actualizadoPor: usuario.uid,
        actualizado: serverTimestamp(),
      })
    }
    for (const id of plan.borrar) tx.delete(doc(db, 'registrosAsistencia', id))
    return versionActual + 1
  })
  return {
    reunion: { ...reunion, seccion: seccion.nombre, version, actualizadoPorCorreo: usuario.correo, actualizado: new Date() },
    ...plan,
  }
}

/**
 * Borra una reunión y todos sus registros (p. ej. si se creó con la fecha
 * equivocada). Si alguien la ha guardado desde que se abrió, no borra nada y
 * lanza ConflictoReunion.
 */
export async function borrarReunion(reunionId: string, versionAbierta: number): Promise<void> {
  const registros = await registrosActuales(reunionId)
  const ref = doc(db, 'reuniones', reunionId)
  await runTransaction(db, async tx => {
    const actual = await tx.get(ref)
    const datosActuales = actual.exists() ? versionDe(actual.data()) : null
    if ((datosActuales?.version ?? 0) !== versionAbierta) {
      throw new ConflictoReunion(datosActuales?.actualizadoPorCorreo ?? '', datosActuales?.actualizado ?? null)
    }
    for (const r of registros) tx.delete(doc(db, 'registrosAsistencia', idRegistro(reunionId, r.educandoId)))
    tx.delete(ref)
  })
}

/**
 * Aplica el listado del Excel: altas, reactivaciones, cambios de sección y
 * de nombre. Las bajas NO se borran: se marcan como inactivas para conservar
 * su histórico y su deuda.
 */
export async function aplicarListado(cambios: CambiosListado): Promise<void> {
  const escribir: (EducandoListado & { activo: boolean })[] = [
    ...cambios.altas, ...cambios.reactivados, ...cambios.otrosCambios,
    ...cambios.cambiosSeccion.map(c => c.despues),
  ].map(e => ({ ...e, activo: true }))
  for (const b of cambios.bajas) escribir.push({ ...b, activo: false })

  // Por encima de 450 cambios se divide en varios lotes (en la práctica no pasa).
  for (let i = 0; i < escribir.length; i += MAX_LOTE) {
    const lote = writeBatch(db)
    for (const e of escribir.slice(i, i + MAX_LOTE)) {
      lote.set(doc(db, 'educandos', e.id), {
        nombre: e.nombre,
        apellidos: e.apellidos,
        seccion: e.seccion,
        seccionClave: e.seccionClave,
        idExcel: e.idExcel,
        activo: e.activo,
        actualizado: serverTimestamp(),
      })
    }
    await lote.commit()
  }
}

/** Cuota de cada sección (importe en céntimos y si es por trimestre). */
export async function guardarCuotas(cuotas: Record<string, CuotaSeccion>): Promise<void> {
  for (const [clave, c] of Object.entries(cuotas)) {
    if (!PATRON_CLAVE_SECCION.test(clave) || !centimosValidos(c.importe)) throw new Error(`Cuota no válida: ${clave}`)
  }
  await guardarAjuste({ cuotas })
}

/** Enlace (ID) del Excel del listado en Google Drive (null = quitarlo). */
export async function guardarDriveFileId(id: string | null): Promise<void> {
  if (id !== null && !PATRON_ID_DRIVE.test(id)) throw new Error('ID de Drive no válido')
  await guardarAjuste({ driveFileId: id })
}

async function guardarAjuste(campos: Record<string, unknown>) {
  const lote = writeBatch(db)
  // merge: cambiar un ajuste no borra los demás.
  lote.set(doc(db, 'ajustesAsistencia', 'general'), { ...campos, actualizado: serverTimestamp() }, { merge: true })
  await lote.commit()
}

// ─── Listado desde Google Drive ──────────────────────────────────────────────
//
// Se usa la API de Drive con la sesión de Google de la propia administradora
// (permiso de solo lectura, que se pide al pulsar el botón). Así el archivo
// NO tiene que ser público: basta con que esté compartido con el grupo o
// con esa persona. El token vive solo en memoria (1 hora).

const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.readonly'
const API_DRIVE = 'https://www.googleapis.com/drive/v3/files'
const HOJA_GOOGLE = 'application/vnd.google-apps.spreadsheet'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
let tokenDrive: { valor: string; caduca: number } | null = null

/**
 * Pide (si hace falta) permiso de lectura de Drive. Debe llamarse directamente
 * desde un clic: los navegadores bloquean ventanas emergentes en otro momento.
 */
export async function permisoDrive(): Promise<string> {
  if (tokenDrive && tokenDrive.caduca > Date.now()) return tokenDrive.valor
  const usuario = auth.currentUser
  if (!usuario) throw new ErrorHoja('Tu sesión ha caducado. Vuelve a entrar.')
  const p = proveedorGoogle()
  p.addScope(SCOPE_DRIVE)
  p.setCustomParameters({ login_hint: usuario.email ?? '' })
  // reauthenticate: obliga a usar LA MISMA cuenta con la que se ha entrado.
  const res = await reauthenticateWithPopup(usuario, p)
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken
  if (!token) throw new ErrorHoja('Google no ha dado permiso para leer Drive.')
  tokenDrive = { valor: token, caduca: Date.now() + 50 * 60 * 1000 }
  return token
}

export interface ArchivoDrive {
  nombre: string
  modificado: Date | null
  datos: ArrayBuffer
}

/** Descarga el listado: un .xlsx/.csv subido a Drive o una Hoja de cálculo de Google. */
export async function descargarDeDrive(fileId: string, token: string): Promise<ArchivoDrive> {
  if (!PATRON_ID_DRIVE.test(fileId)) throw new ErrorHoja('El enlace de Drive guardado no es válido.')
  const cab = { Authorization: `Bearer ${token}` }
  const base = `${API_DRIVE}/${encodeURIComponent(fileId)}`

  const meta = await fetch(`${base}?fields=name,mimeType,modifiedTime,size&supportsAllDrives=true`, { headers: cab })
  if (!meta.ok) throw await errorDrive(meta)
  const info = (await meta.json()) as { name?: string; mimeType?: string; modifiedTime?: string; size?: string }

  let url: string
  if (info.mimeType === HOJA_GOOGLE) {
    url = `${base}/export?mimeType=${encodeURIComponent(XLSX)}`
  } else if (info.mimeType?.startsWith('application/vnd.google-apps.')) {
    throw new ErrorHoja('El enlace no es una hoja de cálculo. Comparte el Excel (.xlsx) o una Hoja de cálculo de Google.')
  } else {
    if (Number(info.size) > 10 * 1024 * 1024) throw new ErrorHoja('El archivo de Drive es demasiado grande (máx. 10 MB).')
    url = `${base}?alt=media&supportsAllDrives=true`
  }
  const arch = await fetch(url, { headers: cab })
  if (!arch.ok) throw await errorDrive(arch)
  return {
    nombre: info.name ?? 'Archivo de Drive',
    modificado: info.modifiedTime ? new Date(info.modifiedTime) : null,
    datos: await arch.arrayBuffer(),
  }
}

/** Traduce los errores de la API de Drive a mensajes comprensibles. */
async function errorDrive(r: Response): Promise<ErrorHoja> {
  let motivo = ''
  try {
    const j = (await r.json()) as { error?: { errors?: { reason?: string }[]; status?: string } }
    motivo = j.error?.errors?.[0]?.reason ?? j.error?.status ?? ''
  } catch { /* sin cuerpo JSON */ }
  if (r.status === 401) {
    tokenDrive = null
    return new ErrorHoja('El permiso de Drive ha caducado. Pulsa otra vez «Leer desde Google Drive».')
  }
  if (r.status === 404) return new ErrorHoja('No encuentro el archivo: el enlace no es correcto o tu cuenta no tiene acceso. Compártelo con tu cuenta o con el grupo.')
  if (motivo === 'accessNotConfigured' || motivo === 'SERVICE_DISABLED') {
    return new ErrorHoja('La API de Google Drive no está activada en el proyecto de Firebase. Actívala en Google Cloud Console (ver README).')
  }
  if (r.status === 403) return new ErrorHoja('Google no permite leer el archivo con tu cuenta. Revisa que lo puedes abrir y que no tiene bloqueada la descarga.')
  return new ErrorHoja(`Google Drive ha respondido con un error (${r.status}). Inténtalo de nuevo.`)
}
