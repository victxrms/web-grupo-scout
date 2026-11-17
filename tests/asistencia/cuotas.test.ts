// Pruebas de la lógica de cuotas. Ejecutar con:  npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarPlan, cuotaDeSeccion, deudaConReunion, estadoDeuda, euros, inicioRonda, nombreRonda, parsearEuros, planGuardado,
  totalesPorEducando, trimestre, type CuotaSeccion, type Entrada, type Registro,
} from '../../src/lib/asistencia/cuotas.ts'
import { idReunion } from '../../src/lib/asistencia/normalizar.ts'

const TROPA: CuotaSeccion = { importe: 150, trimestral: false }
const CLAN: CuotaSeccion = { importe: 500, trimestral: true }

// Simula la base de datos: guarda reuniones igual que lo hace la página.
function crearAlmacen() {
  let almacen = new Map<string, Registro>()
  return {
    guardar(seccionClave: string, fecha: string, entradas: Entrada[], cuota: CuotaSeccion) {
      const reunion = { id: idReunion(seccionClave, fecha), seccionClave, fecha }
      almacen = aplicarPlan(almacen, planGuardado(reunion, entradas, almacen.values(), cuota))
    },
    totales(educandoId: string) {
      return totalesPorEducando(almacen.values()).get(educandoId) ?? { asistencias: 0, cargado: 0, pagado: 0, deuda: 0 }
    },
    get tamano() { return almacen.size },
  }
}
const vino = (educandoId: string, pagado: number): Entrada => ({ educandoId, asistio: true, pagado })
const noVino = (educandoId: string, pagado = 0): Entrada => ({ educandoId, asistio: false, pagado })

test('1. Asiste y paga la cuota (1,50 €) → al día', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 150)], TROPA)
  assert.deepEqual(db.totales('ana'), { asistencias: 1, cargado: 150, pagado: 150, deuda: 0 })
  assert.equal(estadoDeuda(0).tipo, 'al-dia')
})

test('2. Asiste y no paga → debe 1,50 €; la siguiente paga 3 € → al día', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 0)], TROPA)
  assert.equal(db.totales('ana').deuda, 150)
  assert.match(estadoDeuda(150).texto, /^Debe 1,50\s€$/)
  db.guardar('tropa', '2025-10-11', [vino('ana', 300)], TROPA)
  assert.deepEqual(db.totales('ana'), { asistencias: 2, cargado: 300, pagado: 300, deuda: 0 })
})

test('3. No asiste → no debe nada (y no se guarda nada)', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [noVino('ana')], TROPA)
  assert.equal(db.totales('ana').deuda, 0)
  assert.equal(db.tamano, 0)
})

test('4. Paga de más → saldo a favor', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 500)], TROPA)
  assert.equal(db.totales('ana').deuda, -350)
  const e = estadoDeuda(-350)
  assert.equal(e.tipo, 'a-favor')
  assert.match(e.texto, /^3,50\s€ a favor$/)
})

test('5. Paga atrasado un día que no viene → la deuda se reduce', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 0)], TROPA)
  db.guardar('tropa', '2025-10-11', [vino('ana', 0)], TROPA)
  db.guardar('tropa', '2025-10-18', [noVino('ana', 150)], TROPA)
  assert.deepEqual(db.totales('ana'), { asistencias: 2, cargado: 300, pagado: 150, deuda: 150 })
})

test('6. Editar una reunión ya guardada recalcula bien y no duplica', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 150), vino('luis', 0), noVino('eva')], TROPA)
  db.guardar('tropa', '2025-10-04', [noVino('ana'), vino('luis', 150), vino('eva', 300)], TROPA)
  assert.equal(db.totales('ana').deuda, 0)
  assert.equal(db.totales('luis').deuda, 0)
  assert.equal(db.totales('eva').deuda, -150)
  const antes = db.tamano
  db.guardar('tropa', '2025-10-04', [noVino('ana'), vino('luis', 150), vino('eva', 300)], TROPA)
  assert.equal(db.tamano, antes)
})

test('7. Cuota trimestral: un solo cargo por trimestre aunque venga a varias reuniones', () => {
  const db = crearAlmacen()
  db.guardar('rovers', '2025-10-04', [vino('leo', 500)], CLAN)
  db.guardar('rovers', '2025-10-11', [vino('leo', 0)], CLAN)
  db.guardar('rovers', '2025-12-13', [vino('leo', 0)], CLAN)
  assert.deepEqual(db.totales('leo'), { asistencias: 3, cargado: 500, pagado: 500, deuda: 0 })
  // Enero: trimestre nuevo → vuelve a tocar pagar.
  db.guardar('rovers', '2026-01-17', [vino('leo', 0)], CLAN)
  assert.equal(db.totales('leo').deuda, 500)
})

test('8. Trimestral: si se borra la primera reunión del trimestre, el cargo sigue', () => {
  const db = crearAlmacen()
  db.guardar('rovers', '2025-10-04', [vino('leo', 0)], CLAN)
  db.guardar('rovers', '2025-10-11', [vino('leo', 0)], CLAN)
  db.guardar('rovers', '2025-10-04', [noVino('leo')], CLAN) // "no vino" ese día
  assert.equal(db.totales('leo').deuda, 500)
})

test('9. Si cambia el importe, lo ya apuntado no se recalcula', () => {
  const db = crearAlmacen()
  db.guardar('tropa', '2025-10-04', [vino('ana', 0)], TROPA)
  const subida = { importe: 200, trimestral: false }
  db.guardar('tropa', '2025-10-11', [vino('ana', 0)], subida)
  assert.equal(db.totales('ana').cargado, 350)
  // Volver a guardar la reunión vieja con el importe nuevo mantiene su cuota.
  db.guardar('tropa', '2025-10-04', [vino('ana', 150)], subida)
  assert.equal(db.totales('ana').cargado, 350)
})

test('Trimestres de la ronda', () => {
  assert.equal(trimestre('2025-09-01'), '2025-T1')
  assert.equal(trimestre('2025-12-31'), '2025-T1')
  assert.equal(trimestre('2026-01-01'), '2025-T2')
  assert.equal(trimestre('2026-03-31'), '2025-T2')
  assert.equal(trimestre('2026-04-01'), '2025-T3')
  assert.equal(trimestre('2026-08-31'), '2025-T3')
})

test('Inicio de la ronda (lo que se descarga)', () => {
  assert.equal(inicioRonda('2026-09-01'), '2026-09-01')
  assert.equal(inicioRonda('2026-11-17'), '2026-09-01')
  assert.equal(inicioRonda('2027-08-31'), '2026-09-01')
  assert.equal(nombreRonda('2026-09-01'), '2026-27')
  assert.equal(nombreRonda('2099-09-01'), '2099-00')
})

test('Lo que se propone cobrar al marcar "Ha venido"', () => {
  const reunion = { id: 'rovers_2025-10-11', seccionClave: 'rovers', fecha: '2025-10-11' }
  const previos: Registro[] = [
    { reunionId: 'rovers_2025-10-04', educandoId: 'leo', seccionClave: 'rovers', fecha: '2025-10-04', asistio: true, pagado: 0, cargo: 500, trimestral: true },
  ]
  // Ya se le cargó el trimestre: venir otra vez no suma nada.
  assert.equal(deudaConReunion(previos, reunion, vino('leo', 0), CLAN), 500)
  // Sin reuniones previas en el trimestre: suma la cuota trimestral.
  assert.equal(deudaConReunion([], reunion, vino('leo', 0), CLAN), 500)
  assert.equal(deudaConReunion([], reunion, vino('leo', 500), CLAN), 0)
})

test('Cuotas: mandan las guardadas en Ajustes; sin cuota, 0', () => {
  assert.deepEqual(cuotaDeSeccion('scouts', { scouts: { importe: 200, trimestral: false } }), { importe: 200, trimestral: false })
  assert.deepEqual(cuotaDeSeccion('otra', {}), { importe: 0, trimestral: false })
})

test('Importes en euros: lectura y formato', () => {
  assert.equal(parsearEuros('1,5'), 150)
  assert.equal(parsearEuros('1.50'), 150)
  assert.equal(parsearEuros(' 2 '), 200)
  assert.equal(parsearEuros('0'), 0)
  assert.equal(parsearEuros('0,10'), 10)
  for (const malo of ['', '-1', '1,555', 'abc', '1e2', '10000', null, undefined]) {
    assert.equal(parsearEuros(malo), null, String(malo))
  }
  assert.match(euros(150), /^1,50\s€$/)
  const r = { id: 'tropa_2025-10-04', seccionClave: 'tropa', fecha: '2025-10-04' }
  assert.throws(() => planGuardado(r, [vino('ana', -1)], [], TROPA))
  assert.throws(() => planGuardado(r, [vino('ana', 1.5)], [], TROPA))
})
