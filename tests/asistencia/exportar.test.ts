// Pruebas de la exportación de rondas. Ejecutar con:  npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csv, filasDetalle, filasResumen, rondasDesde } from '../../src/lib/asistencia/exportar.ts'
import type { Registro } from '../../src/lib/asistencia/cuotas.ts'
import type { EducandoGuardado } from '../../src/lib/asistencia/listado.ts'

const leo: EducandoGuardado = { id: 'leo', nombre: 'Leo', apellidos: 'G. P.', seccion: 'Clan', seccionClave: 'clan', idExcel: '', activo: false }
const reg = (fecha: string, asistio: boolean, pagado: number): Registro => ({
  reunionId: `clan_${fecha}`, educandoId: 'leo', seccionClave: 'clan', fecha, asistio, pagado, cargo: asistio ? 500 : 0, trimestral: true,
})

test('Rondas disponibles: de la actual a la más antigua', () => {
  assert.deepEqual(rondasDesde('2024-10-05', '2026-11-17'), ['2026-09-01', '2025-09-01', '2024-09-01'])
  assert.deepEqual(rondasDesde('2026-09-20', '2026-11-17'), ['2026-09-01'])
  assert.deepEqual(rondasDesde(null, '2027-03-01'), ['2026-09-01'])
})

test('CSV: «;», BOM, comillas y fórmulas neutralizadas; importes negativos intactos', () => {
  const s = csv([['=SUMA(A1)', '-1,50', 'a;b', 'di "hola"', 3]])
  assert.equal(s, '﻿\'=SUMA(A1);-1,50;"a;b";"di ""hola""";3')
})

test('Resumen y detalle: la cuota trimestral cuenta una vez y las bajas se marcan', () => {
  const registros = [reg('2025-10-11', true, 0), reg('2025-10-04', true, 500), reg('2025-10-18', false, 0)]
  const resumen = filasResumen([leo], registros)
  assert.deepEqual(resumen[1], ['Leo G. P. (baja)', 'Clan', 2, '5,00', '5,00', '0,00', 'Al día'])
  const detalle = filasDetalle([leo], [{ id: 'clan_2025-10-04', seccion: 'Clan' }], registros)
  assert.deepEqual(detalle.slice(1).map(f => [f[0], f[1], f[4], f[5]]), [
    ['2025-10-04', 'Clan', '5,00', '5,00'],
    ['2025-10-11', 'clan', '0,00', '0,00'],
    ['2025-10-18', 'clan', '0,00', '0,00'],
  ])
})
