// Exportación a CSV (resumen y detalle de una ronda). Lógica pura: la usan
// la página y las pruebas (tests/asistencia).

import {
  TOTALES_CERO, estadoDeuda, eurosCampo, inicioRonda, totalesPorEducando, trimestre, type Registro,
} from './cuotas.ts'
import { nombreCompleto, type EducandoGuardado } from './listado.ts'
import { compararEs } from './normalizar.ts'

type Celda = string | number

/**
 * CSV que Excel en español abre bien: separador «;» y BOM para las tildes.
 * Las celdas de texto que empiezan por = + - @ se neutralizan (inyección de
 * fórmulas), salvo los importes ("-1,50"), que son números.
 */
export function csv(filas: Celda[][]): string {
  const celda = (v: Celda) => {
    let s = String(v)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) s = `'${s}`
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n')
}

export function descargarCsv(nombre: string, filas: Celda[][]) {
  const url = URL.createObjectURL(new Blob([csv(filas)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Inicios de ronda ("AAAA-09-01") desde la de `primeraFecha` hasta la de `hoy`, la más reciente primero. */
export function rondasDesde(primeraFecha: string | null, hoy: string): string[] {
  const actual = Number(inicioRonda(hoy).slice(0, 4))
  const primera = primeraFecha ? Math.min(Number(inicioRonda(primeraFecha).slice(0, 4)), actual) : actual
  const rondas: string[] = []
  for (let a = actual; a >= primera; a--) rondas.push(`${a}-09-01`)
  return rondas
}

const nombreDe = (e: EducandoGuardado | undefined, id: string) =>
  e ? nombreCompleto(e) + (e.activo ? '' : ' (baja)') : id

/** Una fila por educando con movimientos en la ronda: asistencias, recogido y deuda. */
export function filasResumen(educandos: EducandoGuardado[], registros: Registro[]): Celda[][] {
  const porId = new Map(educandos.map(e => [e.id, e]))
  const totales = totalesPorEducando(registros)
  const filas = [...totales.keys()]
    .map(id => ({ id, e: porId.get(id), t: totales.get(id) ?? TOTALES_CERO }))
    .sort((a, b) => compararEs(a.e?.seccion ?? '', b.e?.seccion ?? '') || compararEs(nombreDe(a.e, a.id), nombreDe(b.e, b.id)))
  return [
    ['Nombre', 'Sección', 'Reuniones asistidas', 'Cuota (€)', 'Recogido (€)', 'Debe (€, negativo = a favor)', 'Estado'],
    ...filas.map(({ id, e, t }) => [
      nombreDe(e, id), e?.seccion ?? '', t.asistencias, eurosCampo(t.cargado), eurosCampo(t.pagado), eurosCampo(t.deuda), estadoDeuda(t.deuda).texto,
    ]),
  ]
}

/** Una fila por educando y reunión: lo que se apuntó ese día. */
export function filasDetalle(
  educandos: EducandoGuardado[],
  reuniones: { id: string; seccion: string }[],
  registros: Registro[],
): Celda[][] {
  const porId = new Map(educandos.map(e => [e.id, e]))
  const seccion = new Map(reuniones.map(r => [r.id, r.seccion]))
  const filas = [...registros].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || compararEs(a.seccionClave, b.seccionClave)
    || compararEs(nombreDe(porId.get(a.educandoId), a.educandoId), nombreDe(porId.get(b.educandoId), b.educandoId)))
  // Cuota trimestral: solo cuenta en la primera reunión del trimestre (como en el resumen).
  const trimestres = new Map<string, number>()
  const cuotaDelDia = (r: Registro) => {
    if (!r.asistio) return 0
    if (!r.trimestral) return r.cargo
    const clave = `${r.educandoId}|${r.seccionClave}|${trimestre(r.fecha)}`
    const antes = trimestres.get(clave) ?? 0
    trimestres.set(clave, Math.max(antes, r.cargo))
    return Math.max(0, r.cargo - antes)
  }
  return [
    ['Fecha', 'Sección', 'Nombre', 'Asistió', 'Cuota (€)', 'Recogido (€)'],
    ...filas.map(r => [
      r.fecha, seccion.get(r.reunionId) || r.seccionClave, nombreDe(porId.get(r.educandoId), r.educandoId),
      r.asistio ? 'Sí' : 'No', eurosCampo(cuotaDelDia(r)), eurosCampo(r.pagado),
    ]),
  ]
}
