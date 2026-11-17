// Reglas de negocio de asistencia y cuotas.
// Lógica pura (sin Firebase): la usan la página y las pruebas (tests/asistencia).
//
// Todo el dinero va en CÉNTIMOS (enteros) para no arrastrar errores de redondeo.
//
// Cada sección tiene su cuota, que se cambia en «Ajustes»:
//   - por reunión: cada reunión a la que viene el educando suma la cuota.
//   - por trimestre: se cobra UNA vez por cada trimestre en el que venga a
//     alguna reunión, aunque venga a varias.
// En cada registro se guarda la cuota que tocaba ese día («cargo»): si luego
// cambia el importe, lo ya apuntado no se recalcula.
//
//   deuda = lo que le tocaba pagar − lo recogido
//     > 0 → debe;  0 → al día;  < 0 → saldo a favor (pagó por adelantado)

import { idRegistro } from './normalizar.ts'

/** Lo que se guarda por (reunión, educando). */
export interface Registro {
  reunionId: string
  educandoId: string
  seccionClave: string
  fecha: string
  asistio: boolean
  /** Dinero recogido ese día, en céntimos. Puede haber pago aunque no haya venido. */
  pagado: number
  /** Cuota que le tocaba por venir, en céntimos (0 si no vino). */
  cargo: number
  /** La cuota de la sección era por trimestre (no por reunión). */
  trimestral: boolean
}

/** Cuota de una sección. */
export interface CuotaSeccion {
  /** En céntimos. */
  importe: number
  trimestral: boolean
}

/**
 * Cuotas si una administradora no ha puesto otra cosa en «Ajustes». Las claves
 * son las de la sección tal como sale del Excel. Vacío: cada grupo pone las suyas.
 * Ejemplo: { tropa: { importe: 150, trimestral: false } } → 1,50 € por reunión.
 */
export const CUOTAS_POR_DEFECTO: Readonly<Record<string, CuotaSeccion>> = Object.freeze({})

const SIN_CUOTA: CuotaSeccion = Object.freeze({ importe: 0, trimestral: false })

/** Cuota vigente de una sección: la guardada en ajustes o, si no hay, la de por defecto. */
export function cuotaDeSeccion(seccionClave: string, guardadas: Record<string, CuotaSeccion>): CuotaSeccion {
  return guardadas[seccionClave] ?? CUOTAS_POR_DEFECTO[seccionClave] ?? SIN_CUOTA
}

export interface Totales {
  asistencias: number
  /** Lo que le tocaba pagar, en céntimos. */
  cargado: number
  /** Lo recogido, en céntimos. */
  pagado: number
  /** cargado − pagado */
  deuda: number
}

export const TOTALES_CERO: Totales = Object.freeze({ asistencias: 0, cargado: 0, pagado: 0, deuda: 0 })

/** Máximo de un solo pago o cuota: 1000 € (también lo limita firestore.rules). */
export const MAX_CENTIMOS = 100_000

/**
 * Trimestre de la ronda solar al que pertenece una fecha "AAAA-MM-DD":
 * septiembre–diciembre (T1), enero–marzo (T2) y abril–agosto (T3).
 * La clave lleva el año en que empieza la ronda: "2026-T2" es enero–marzo de 2027.
 */
export function trimestre(fecha: string): string {
  const anio = Number(fecha.slice(0, 4))
  const mes = Number(fecha.slice(5, 7))
  if (mes >= 9) return `${anio}-T1`
  return mes <= 3 ? `${anio - 1}-T2` : `${anio - 1}-T3`
}

/** Primer día ("AAAA-09-01") de la ronda solar a la que pertenece una fecha. */
export function inicioRonda(fecha: string): string {
  const anio = Number(fecha.slice(0, 4))
  return Number(fecha.slice(5, 7)) >= 9 ? `${anio}-09-01` : `${anio - 1}-09-01`
}

/** "2026-27" para la ronda que empieza el 1 de septiembre de 2026. */
export const nombreRonda = (inicio: string) => `${inicio.slice(0, 4)}-${String(Number(inicio.slice(0, 4)) + 1).slice(2)}`

/**
 * Totales por educando a partir de todos los registros.
 * Con `excluirReunionId` se ignora una reunión: sirve para saber lo que un
 * educando "traía" antes de la reunión que se está editando.
 */
export function totalesPorEducando(
  registros: Iterable<Registro>,
  excluirReunionId?: string,
): Map<string, Totales> {
  const mapa = new Map<string, Totales>()
  // Cuota trimestral ya cobrada por (educando, sección, trimestre): solo cuenta la mayor.
  const trimestres = new Map<string, number>()
  for (const r of registros) {
    if (excluirReunionId && r.reunionId === excluirReunionId) continue
    const t = mapa.get(r.educandoId) ?? { asistencias: 0, cargado: 0, pagado: 0, deuda: 0 }
    if (r.asistio) {
      t.asistencias += 1
      if (r.trimestral) {
        const clave = `${r.educandoId}|${r.seccionClave}|${trimestre(r.fecha)}`
        const antes = trimestres.get(clave) ?? 0
        if (r.cargo > antes) {
          t.cargado += r.cargo - antes
          trimestres.set(clave, r.cargo)
        }
      } else {
        t.cargado += r.cargo
      }
    }
    t.pagado += r.pagado
    t.deuda = t.cargado - t.pagado
    mapa.set(r.educandoId, t)
  }
  return mapa
}

/** Cuota que se apunta en un registro: la que ya tenía si seguía viniendo; si no, la vigente. */
export function cargoPara(asistio: boolean, cuota: CuotaSeccion, existente?: Registro): number {
  if (!asistio) return 0
  return existente?.asistio ? existente.cargo : cuota.importe
}

export type TipoEstado = 'debe' | 'al-dia' | 'a-favor'

export interface Estado {
  tipo: TipoEstado
  /** Siempre positiva (o 0), en céntimos. */
  cantidad: number
  /** Texto corto e inequívoco: "Debe 3,00 €", "Al día", "1,50 € a favor". */
  texto: string
}

const FORMATO_EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** 150 → "1,50 €" */
export const euros = (centimos: number) => FORMATO_EUROS.format(centimos / 100)

/** 150 → "1,50" (para campos de texto, sin el símbolo). */
export const eurosCampo = (centimos: number) => (centimos / 100).toFixed(2).replace('.', ',')

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function estadoDeuda(deuda: number): Estado {
  if (deuda > 0) return { tipo: 'debe', cantidad: deuda, texto: `Debe ${euros(deuda)}` }
  if (deuda < 0) return { tipo: 'a-favor', cantidad: -deuda, texto: `${euros(-deuda)} a favor` }
  return { tipo: 'al-dia', cantidad: 0, texto: 'Al día' }
}

/**
 * Convierte lo escrito en euros ("1,5", "1.50", "2") a céntimos.
 * Devuelve null si no es un importe válido entre 0 y 1000 €.
 */
export function parsearEuros(valor: unknown): number | null {
  const texto = String(valor ?? '').trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(texto)) return null
  const centimos = Math.round(Number(texto) * 100)
  return centimos >= 0 && centimos <= MAX_CENTIMOS ? centimos : null
}

/** Lo que el scouter marca para un educando en una reunión. */
export interface Entrada {
  educandoId: string
  asistio: boolean
  /** Dinero recogido, en céntimos. */
  pagado: number
}

/**
 * Qué hay que escribir y borrar en la base de datos al guardar una reunión.
 * - Quien vino o pagó algo → se guarda (o se sobrescribe si ya existía).
 * - Quien ni vino ni pagó → no se guarda nada; si existía un registro de
 *   antes (p. ej. se marcó por error), se borra.
 * Como cada registro es único por (reunión, educando), volver a guardar una
 * reunión SUSTITUYE los datos anteriores: los totales se recalculan solos.
 */
export function planGuardado(
  reunion: { id: string; seccionClave: string; fecha: string },
  entradas: Entrada[],
  existentes: Iterable<Registro>,
  cuota: CuotaSeccion,
): { escribir: Registro[]; borrar: string[] } {
  const previos = new Map<string, Registro>()
  for (const r of existentes) if (r.reunionId === reunion.id) previos.set(r.educandoId, r)

  const escribir: Registro[] = []
  const borrar: string[] = []
  for (const e of entradas) {
    if (!Number.isInteger(e.pagado) || e.pagado < 0 || e.pagado > MAX_CENTIMOS) {
      throw new Error(`Importe no válido para ${e.educandoId}: ${e.pagado}`)
    }
    const previo = previos.get(e.educandoId)
    if (e.asistio || e.pagado > 0) {
      escribir.push({
        reunionId: reunion.id,
        educandoId: e.educandoId,
        seccionClave: reunion.seccionClave,
        fecha: reunion.fecha,
        asistio: e.asistio,
        pagado: e.pagado,
        cargo: cargoPara(e.asistio, cuota, previo),
        trimestral: e.asistio && previo?.asistio ? previo.trimestral : cuota.trimestral,
      })
    } else if (previo) {
      borrar.push(idRegistro(reunion.id, e.educandoId))
    }
  }
  return { escribir, borrar }
}

/**
 * Aplica un plan de guardado a un almacén en memoria (Map por ID de registro).
 * Es lo mismo que hace Firestore con el lote de escrituras; se usa en las
 * pruebas y para actualizar la pantalla sin volver a descargar todo.
 */
export function aplicarPlan(
  almacen: Map<string, Registro>,
  plan: { escribir: Registro[]; borrar: string[] },
): Map<string, Registro> {
  const nuevo = new Map(almacen)
  for (const id of plan.borrar) nuevo.delete(id)
  for (const r of plan.escribir) nuevo.set(idRegistro(r.reunionId, r.educandoId), r)
  return nuevo
}

/**
 * Deuda de un educando si en esta reunión se marca `entrada`, partiendo de
 * sus registros SIN esta reunión. Sirve para "Con esta reunión: …" y para
 * proponer cuánto cobrar (lo que esta asistencia añade a la deuda).
 */
export function deudaConReunion(
  registrosPrevios: Registro[],
  reunion: { id: string; seccionClave: string; fecha: string },
  entrada: Entrada,
  cuota: CuotaSeccion,
  existente?: Registro,
): number {
  const { escribir } = planGuardado(reunion, [entrada], existente ? [existente] : [], cuota)
  return (totalesPorEducando([...registrosPrevios, ...escribir]).get(entrada.educandoId) ?? TOTALES_CERO).deuda
}
