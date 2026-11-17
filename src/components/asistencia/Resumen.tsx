// Pestaña "Resumen": asistencias, dinero recogido y deuda por educando,
// con filtro, buscador, orden por columnas, totales, exportación y
// el histórico de cada educando.
import { Fragment, useMemo, useState } from 'react'
import { TOTALES_CERO, euros, eurosCampo, nombreRonda, totalesPorEducando, type Registro } from '../../lib/asistencia/cuotas.ts'
import type { DatosAsistencia } from '../../lib/asistencia/datos.ts'
import { claveBusqueda, nombreCompleto } from '../../lib/asistencia/listado.ts'
import { claveTexto, compararEs, fechaLegible, fechaLocal } from '../../lib/asistencia/normalizar.ts'
import { estadoDeuda } from '../../lib/asistencia/cuotas.ts'
import { descargarCsv } from '../../lib/asistencia/exportar.ts'
import { EstadoCuotas } from './ui.tsx'
import type { SeccionOpcion } from './PasarLista.tsx'

type Columna = 'nombre' | 'seccion' | 'asistencias' | 'pagado' | 'deuda'
const COLUMNAS: { id: Columna; titulo: string; num?: boolean }[] = [
  { id: 'nombre', titulo: 'Nombre' },
  { id: 'seccion', titulo: 'Sección' },
  { id: 'asistencias', titulo: 'Reuniones asistidas', num: true },
  { id: 'pagado', titulo: 'Recogido', num: true },
  { id: 'deuda', titulo: 'Debe / a favor', num: true },
]

interface FilaResumen {
  id: string
  nombre: string
  seccion: string
  seccionClave: string
  activo: boolean
  asistencias: number
  /** En céntimos. */
  pagado: number
  /** En céntimos. */
  deuda: number
}

export default function Resumen({ datos, secciones, desde }: { datos: DatosAsistencia; secciones: SeccionOpcion[]; desde: string }) {
  const [seccion, setSeccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [conBajas, setConBajas] = useState(false)
  // Orden por defecto: quien más debe, primero.
  const [orden, setOrden] = useState<{ col: Columna; desc: boolean }>({ col: 'deuda', desc: true })
  const [abierto, setAbierto] = useState<string | null>(null)

  const totales = useMemo(() => totalesPorEducando(datos.registros), [datos.registros])
  const porEducando = useMemo(() => {
    const m = new Map<string, Registro[]>()
    for (const r of datos.registros) m.set(r.educandoId, [...(m.get(r.educandoId) ?? []), r])
    return m
  }, [datos.registros])
  const nombreSeccion = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of datos.reuniones) m.set(r.seccionClave, r.seccion)
    for (const e of datos.educandos) m.set(e.seccionClave, e.seccion)
    return m
  }, [datos.reuniones, datos.educandos])

  const filas = useMemo(() => {
    const q = claveTexto(busqueda)
    const lista: FilaResumen[] = datos.educandos
      // Las bajas solo salen si se piden y tienen algún movimiento.
      .filter(e => e.activo || (conBajas && totales.has(e.id)))
      .filter(e => !seccion || e.seccionClave === seccion)
      .filter(e => !q || claveBusqueda(e).includes(q))
      .map(e => ({
        id: e.id,
        nombre: nombreCompleto(e),
        seccion: e.seccion,
        seccionClave: e.seccionClave,
        activo: e.activo,
        asistencias: (totales.get(e.id) ?? TOTALES_CERO).asistencias,
        pagado: (totales.get(e.id) ?? TOTALES_CERO).pagado,
        deuda: (totales.get(e.id) ?? TOTALES_CERO).deuda,
      }))
    const { col, desc } = orden
    lista.sort((a, b) => {
      const c = typeof a[col] === 'number'
        ? (a[col] as number) - (b[col] as number)
        : compararEs(String(a[col]), String(b[col]))
      return (desc ? -c : c) || compararEs(a.nombre, b.nombre)
    })
    return lista
  }, [datos.educandos, totales, seccion, busqueda, conBajas, orden])

  const suma = useMemo(() => ({
    asistencias: filas.reduce((s, f) => s + f.asistencias, 0),
    pagado: filas.reduce((s, f) => s + f.pagado, 0),
    pendientes: filas.reduce((s, f) => s + Math.max(0, f.deuda), 0),
    aFavor: filas.reduce((s, f) => s + Math.max(0, -f.deuda), 0),
  }), [filas])

  const ordenarPor = (col: Columna) =>
    setOrden(o => (o.col === col ? { col, desc: !o.desc } : { col, desc: col !== 'nombre' && col !== 'seccion' }))

  const exportar = () => {
    descargarCsv(`cuotas-${seccion || 'todas'}-${fechaLocal()}.csv`, [
      ['Nombre', 'Sección', 'Reuniones asistidas', 'Recogido (€)', 'Debe (€, negativo = a favor)', 'Estado'],
      ...filas.map(f => [f.nombre + (f.activo ? '' : ' (baja)'), f.seccion, f.asistencias, eurosCampo(f.pagado), eurosCampo(f.deuda), estadoDeuda(f.deuda).texto]),
      ['TOTAL', '', suma.asistencias, eurosCampo(suma.pagado), eurosCampo(suma.pendientes - suma.aFavor), `${euros(suma.pendientes)} pendientes`],
    ])
  }

  return (
    <section aria-labelledby="titulo-resumen">
      <div className="asis-card">
        <h2 id="titulo-resumen">Resumen por educando</h2>
        <p className="asis-muted">Ronda {nombreRonda(desde)}: reuniones desde el {fechaLegible(desde)}.</p>
        <div className="asis-filtros">
          <div className="asis-campo">
            <label htmlFor="res-seccion">Sección</label>
            <select id="res-seccion" className="asis-select" value={seccion} onChange={e => setSeccion(e.target.value)}>
              <option value="">Todas las secciones</option>
              {secciones.map(s => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="asis-campo">
            <label htmlFor="res-buscar">Buscar por nombre</label>
            <input id="res-buscar" type="search" className="asis-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Escribe un nombre…" />
          </div>
        </div>
        <div className="asis-campo asis-solo-movil" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="res-orden">Ordenar por</label>
          <select id="res-orden" className="asis-select" value={`${orden.col}:${orden.desc ? 'desc' : 'asc'}`}
            onChange={e => { const [col, dir] = e.target.value.split(':'); setOrden({ col: col as Columna, desc: dir === 'desc' }) }}>
            <option value="deuda:desc">Quien más debe primero</option>
            <option value="deuda:asc">Quien más saldo a favor tiene primero</option>
            <option value="nombre:asc">Nombre (A-Z)</option>
            <option value="seccion:asc">Sección</option>
            <option value="asistencias:desc">Más reuniones asistidas</option>
            <option value="pagado:desc">Más dinero entregado</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label className="asis-check">
            <input type="checkbox" checked={conBajas} onChange={e => setConBajas(e.target.checked)} />
            Incluir bajas con movimientos
          </label>
          <button type="button" className="asis-btn asis-btn--sec asis-btn--peq" onClick={exportar} disabled={filas.length === 0}>
            ⬇ Exportar a Excel (CSV)
          </button>
        </div>
      </div>

      <p className="asis-muted" aria-live="polite">
        {filas.length} {filas.length === 1 ? 'educando' : 'educandos'}. Pulsa un nombre para ver su histórico.
      </p>

      <div className="asis-tabla-wrap">
        <table className="asis-tabla asis-tabla--tarjetas">
          <caption className="sr-only">Resumen de asistencias y dinero. Ordenado por {COLUMNAS.find(c => c.id === orden.col)?.titulo}, {orden.desc ? 'de mayor a menor' : 'de menor a mayor'}.</caption>
          <thead>
            <tr>
              {COLUMNAS.map(c => (
                <th key={c.id} scope="col" className={c.num ? 'num' : undefined}
                  aria-sort={orden.col === c.id ? (orden.desc ? 'descending' : 'ascending') : 'none'}>
                  <button type="button" className="asis-orden" onClick={() => ordenarPor(c.id)}>
                    {c.titulo}
                    <span aria-hidden="true">{orden.col === c.id ? (orden.desc ? ' ▼' : ' ▲') : ' ↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={5} className="asis-muted">No hay educandos con estos filtros.</td></tr>
            )}
            {filas.map(f => (
              <Fragment key={f.id}>
                <tr>
                  <td>
                    <button type="button" className="asis-link" aria-expanded={abierto === f.id} onClick={() => setAbierto(a => (a === f.id ? null : f.id))}>
                      {f.nombre}
                    </button>
                    {!f.activo && <span className="asis-fila__nota"> (baja)</span>}
                  </td>
                  <td data-label="Sección">{f.seccion}</td>
                  <td className="num" data-label="Reuniones asistidas">{f.asistencias}</td>
                  <td className="num" data-label="Recogido">{euros(f.pagado)}</td>
                  <td className="num" data-label="Debe / a favor"><EstadoCuotas deuda={f.deuda} /></td>
                </tr>
                {abierto === f.id && (
                  <tr className="asis-historial">
                    <td colSpan={5}>
                      <Historial registros={porEducando.get(f.id) ?? []} nombreSeccion={nombreSeccion} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num" data-label="Reuniones asistidas">{suma.asistencias}</td>
                <td className="num" data-label="Recogido">{euros(suma.pagado)}</td>
                <td className="num" data-label="Pendiente">
                  <span>
                    {euros(suma.pendientes)}
                    {suma.aFavor > 0 && <span style={{ display: 'block', fontWeight: 500 }}>y {euros(suma.aFavor)} a favor</span>}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}

function Historial({ registros, nombreSeccion }: { registros: Registro[]; nombreSeccion: Map<string, string> }) {
  if (registros.length === 0) return <p className="asis-muted" style={{ margin: 0 }}>Sin reuniones registradas.</p>
  const ordenados = [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return (
    <ul style={{ listStyle: 'none', display: 'grid', gap: '0.25rem' }} aria-label="Histórico de reuniones">
      {ordenados.map(r => (
        <li key={r.reunionId}>
          <strong>{fechaLegible(r.fecha)}</strong> · {nombreSeccion.get(r.seccionClave) ?? r.seccionClave} ·{' '}
          {r.asistio ? '✓ Vino' : '✗ No vino'} · {euros(r.pagado)} recogidos
          {r.asistio && r.cargo > 0 && ` · cuota ${euros(r.cargo)}${r.trimestral ? ' del trimestre' : ''}`}
        </li>
      ))}
    </ul>
  )
}
