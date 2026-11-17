// Pestaña "Pasar lista": el scouter elige sección y fecha, marca quién ha
// venido y cuánto dinero ha entregado cada educando, y guarda.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_CENTIMOS, TOTALES_CERO, cuotaDeSeccion, deudaConReunion, euros, eurosCampo, parsearEuros, plural,
  totalesPorEducando, type Registro,
} from '../../lib/asistencia/cuotas.ts'
import {
  ConflictoReunion, borrarReunion, guardarReunion, type DatosAsistencia, type Reunion,
} from '../../lib/asistencia/datos.ts'
import { nombreCompleto } from '../../lib/asistencia/listado.ts'
import { compararEs, esFechaValida, fechaLegible, fechaLocal, idReunion } from '../../lib/asistencia/normalizar.ts'
import { Aviso, EstadoCuotas } from './ui.tsx'

interface Fila {
  asistio: boolean
  /** Texto del campo en euros, p. ej. "1,50" (se valida al guardar). */
  pagado: string
  /** El scouter ha cambiado el importe a mano: no se le pisa al marcar/desmarcar. */
  tocado: boolean
}
type Formulario = Record<string, Fila>

const CLAVE_SECCION_LOCAL = 'asistencia:seccion'
const leerLocal = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

export interface SeccionOpcion { clave: string; nombre: string }

/** "maria@migrupo.org" → "maria"; la hora si es de hoy, si no también la fecha. */
function quienYCuando(correo: string, cuando: Date | null): string {
  const quien = correo ? correo.split('@')[0] : 'otra persona'
  if (!cuando) return quien
  const hoy = cuando.toDateString() === new Date().toDateString()
  const hora = cuando.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${quien} (${hoy ? `a las ${hora}` : `el ${cuando.toLocaleDateString('es-ES')} a las ${hora}`})`
}

export default function PasarLista({
  datos, uid, correo, secciones, desde, actualizando, alCambiarPendiente, alGuardar, alRecargar,
}: {
  datos: DatosAsistencia
  uid: string
  correo: string
  secciones: SeccionOpcion[]
  /** Inicio de la ronda ("AAAA-09-01"): solo se cargan reuniones desde ahí. */
  desde: string
  /** Se ve la copia del dispositivo mientras llega lo último: aún no se puede editar. */
  actualizando: boolean
  /** Avisa a la página de si hay cambios sin guardar. */
  alCambiarPendiente: (pendiente: boolean) => void
  /** Tras guardar o borrar: la página actualiza sus datos en memoria. */
  alGuardar: (cambio: { reunion: Reunion; escritos: Registro[]; borrados: string[] } | { borrada: string }) => void
  /** Vuelve a descargar todo (p. ej. para ver lo que guardó otra persona). */
  alRecargar: () => Promise<void>
}) {
  const [seccionClave, setSeccionClave] = useState(() => {
    const guardada = leerLocal(CLAVE_SECCION_LOCAL)
    return secciones.some(s => s.clave === guardada) ? guardada! : secciones[0]?.clave ?? ''
  })
  const [fecha, setFecha] = useState(fechaLocal())
  const [form, setForm] = useState<Formulario>({})
  const [inicial, setInicial] = useState<Formulario>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null)
  /** Otra persona guardó (o borró) esta reunión mientras estaba abierta aquí. */
  const [conflicto, setConflicto] = useState<{ quien: string; borrando: boolean } | null>(null)
  const mensajeRef = useRef<HTMLDivElement>(null)

  const seccion = secciones.find(s => s.clave === seccionClave)
  const fechaAntigua = esFechaValida(fecha) && fecha < desde
  const fechaOk = esFechaValida(fecha) && !fechaAntigua
  const reunionId = seccion && fechaOk ? idReunion(seccion.clave, fecha) : ''
  const guardada = datos.reuniones.find(r => r.id === reunionId)
  const yaGuardada = guardada !== undefined
  /** Versión de la reunión que se tiene en pantalla (0 = nueva). */
  const versionAbierta = guardada?.version ?? 0
  const cuota = cuotaDeSeccion(seccionClave, datos.cuotas)
  // Lo que suman o restan los botones − / +: la cuota de la sección (o 0,50 € si no tiene).
  const paso = cuota.importe > 0 ? cuota.importe : 50

  // Registros de ESTA reunión, por educando.
  const registrosReunion = useMemo(() => {
    const m = new Map<string, Registro>()
    for (const r of datos.registros) if (r.reunionId === reunionId) m.set(r.educandoId, r)
    return m
  }, [datos.registros, reunionId])

  // Lo que cada educando "trae" de antes, sin contar esta reunión.
  const previos = useMemo(() => totalesPorEducando(datos.registros, reunionId), [datos.registros, reunionId])
  const registrosPrevios = useMemo(() => {
    const m = new Map<string, Registro[]>()
    for (const r of datos.registros) {
      if (r.reunionId !== reunionId) m.set(r.educandoId, [...(m.get(r.educandoId) ?? []), r])
    }
    return m
  }, [datos.registros, reunionId])

  /** Deuda del educando si en esta reunión se marca (asistio, pagado). */
  const deudaCon = useCallback((id: string, asistio: boolean, pagado: number) =>
    deudaConReunion(
      registrosPrevios.get(id) ?? [], { id: reunionId, seccionClave, fecha },
      { educandoId: id, asistio, pagado }, cuota, registrosReunion.get(id),
    ), [registrosPrevios, reunionId, seccionClave, fecha, cuota, registrosReunion])

  /**
   * Importe que se propone al marcar "Ha venido": lo que esta reunión le
   * suma a la deuda (la cuota por reunión, o la trimestral si aún no se le
   * había cobrado este trimestre). Si no ha venido, 0.
   */
  const sugerido = useCallback((id: string, asistio: boolean) => {
    if (!asistio) return 0
    const previa = previos.get(id)?.deuda ?? 0
    return Math.max(0, deudaCon(id, true, 0) - previa)
  }, [previos, deudaCon])

  // Educandos de la sección + quien ya figure en esta reunión aunque ya no
  // esté en la sección (cambio de sección o baja), para poder corregirlo.
  const lista = useMemo(() => {
    const ids = new Set(registrosReunion.keys())
    return datos.educandos
      .filter(e => (e.activo && e.seccionClave === seccionClave) || ids.has(e.id))
      .sort((a, b) => compararEs(nombreCompleto(a), nombreCompleto(b)))
  }, [datos.educandos, registrosReunion, seccionClave])

  // Rellena el formulario al cambiar de sección/fecha o tras guardar.
  useEffect(() => {
    const f: Formulario = {}
    for (const e of lista) {
      const r = registrosReunion.get(e.id)
      f[e.id] = r
        ? { asistio: r.asistio, pagado: eurosCampo(r.pagado), tocado: r.pagado !== sugerido(e.id, r.asistio) }
        : { asistio: false, pagado: eurosCampo(0), tocado: false }
    }
    setForm(f)
    setInicial(f)
    setConflicto(null)
    // Solo al cambiar de reunión o tras guardar: no al recalcular la sugerencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, registrosReunion])

  const pendiente = useMemo(
    () => Object.keys(form).some(id => form[id].asistio !== inicial[id]?.asistio || parsearEuros(form[id].pagado) !== parsearEuros(inicial[id]?.pagado)),
    [form, inicial],
  )
  useEffect(() => { alCambiarPendiente(pendiente) }, [pendiente, alCambiarPendiente])

  const confirmarDescartar = () => !pendiente || window.confirm('Tienes cambios sin guardar en esta reunión. ¿Descartarlos?')

  const cambiarSeccion = (clave: string) => {
    if (!confirmarDescartar()) return
    setSeccionClave(clave)
    guardarLocal(CLAVE_SECCION_LOCAL, clave)
    setMensaje(null)
  }
  const cambiarFecha = (f: string) => {
    if (!confirmarDescartar()) return
    setFecha(f)
    setMensaje(null)
  }

  const actualizar = (id: string, cambio: (f: Fila) => Fila) => {
    setForm(prev => ({ ...prev, [id]: cambio(prev[id]) }))
    setMensaje(null)
  }

  const marcarVino = (id: string, asistio: boolean) =>
    actualizar(id, f => ({ ...f, asistio, pagado: f.tocado ? f.pagado : eurosCampo(sugerido(id, asistio)) }))

  const ponerPagado = (id: string, valor: string) =>
    actualizar(id, f => ({ ...f, pagado: valor.replace(/[^\d.,]/g, '').slice(0, 7), tocado: true }))

  const sumarPagado = (id: string, delta: number) =>
    actualizar(id, f => {
      const n = Math.min(MAX_CENTIMOS, Math.max(0, (parsearEuros(f.pagado) ?? 0) + delta))
      return { ...f, pagado: eurosCampo(n), tocado: true }
    })

  /** Marca a todos como presentes o, si ya lo están, los desmarca a todos. */
  const alternarTodos = () => {
    const marcar = !todosVinieron
    for (const e of lista) if (Boolean(form[e.id]?.asistio) !== marcar) marcarVino(e.id, marcar)
  }

  const mostrar = (tipo: 'ok' | 'error' | 'info', texto: string) => {
    setMensaje({ tipo, texto })
    // Lleva el foco al mensaje para que lo lea también un lector de pantalla.
    setTimeout(() => mensajeRef.current?.focus(), 0)
  }

  const guardar = async (sobrescribir = false) => {
    if (!seccion || !fechaOk) return mostrar('error', 'Elige una sección y una fecha válidas.')
    const invalido = lista.find(e => parsearEuros(form[e.id]?.pagado) === null)
    if (invalido) {
      document.getElementById(`pagado-${invalido.id}`)?.focus()
      return mostrar('error', `Revisa el dinero de ${nombreCompleto(invalido)}: escribe un importe en euros, por ejemplo 1,50.`)
    }
    setGuardando(true)
    try {
      const entradas = lista.map(e => ({ educandoId: e.id, asistio: form[e.id].asistio, pagado: parsearEuros(form[e.id].pagado)! }))
      const plan = await guardarReunion(
        { uid, correo }, seccion, fecha, entradas, datos.registros, cuota, sobrescribir ? 'sobrescribir' : versionAbierta,
      )
      setConflicto(null)
      alGuardar({ reunion: plan.reunion, escritos: plan.escribir, borrados: plan.borrar })
      const vinieron = entradas.filter(e => e.asistio).length
      const recogido = entradas.reduce((s, e) => s + e.pagado, 0)
      mostrar('ok', `Guardado ✓ ${fechaLegible(fecha)}: ${plural(vinieron, 'asistente', 'asistentes')}, ${euros(recogido)} recogidos.`)
    } catch (e) {
      if (e instanceof ConflictoReunion) {
        setMensaje(null)
        setConflicto({ quien: quienYCuando(e.correo, e.cuando), borrando: false })
        setTimeout(() => mensajeRef.current?.focus(), 0)
        return
      }
      console.error(e)
      mostrar('error', 'No se ha podido guardar. Comprueba la conexión e inténtalo de nuevo; tus marcas siguen en pantalla.')
    } finally {
      setGuardando(false)
    }
  }

  /** Descarta lo de esta pantalla y carga lo que guardó la otra persona. */
  const verSusCambios = async () => {
    setGuardando(true)
    try {
      await alRecargar()
      mostrar('info', 'Se han cargado los cambios de la otra persona. Revisa la lista antes de volver a guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!yaGuardada) return
    if (!window.confirm(`¿Borrar la reunión de ${seccion?.nombre} del ${fechaLegible(fecha)}? Se perderán sus asistencias y pagos.`)) return
    setGuardando(true)
    try {
      await borrarReunion(reunionId, versionAbierta)
      alGuardar({ borrada: reunionId })
      mostrar('ok', 'Reunión borrada.')
    } catch (e) {
      if (e instanceof ConflictoReunion) {
        setMensaje(null)
        setConflicto({ quien: quienYCuando(e.correo, e.cuando), borrando: true })
        setTimeout(() => mensajeRef.current?.focus(), 0)
        return
      }
      console.error(e)
      mostrar('error', 'No se ha podido borrar la reunión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Reuniones ya guardadas de la sección (las 8 más recientes) para saltar a ellas.
  const recientes = useMemo(
    () => datos.reuniones.filter(r => r.seccionClave === seccionClave).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8),
    [datos.reuniones, seccionClave],
  )

  if (secciones.length === 0) {
    return <Aviso tipo="info">Todavía no hay educandos. Una persona administradora tiene que cargar el Excel en la pestaña «Ajustes».</Aviso>
  }

  const presentes = lista.filter(e => form[e.id]?.asistio).length
  const todosVinieron = lista.length > 0 && presentes === lista.length
  const recogidoHoy = lista.reduce((s, e) => s + (parsearEuros(form[e.id]?.pagado) ?? 0), 0)

  return (
    <section aria-labelledby="titulo-lista">
      <h2 id="titulo-lista" className="sr-only">Pasar lista</h2>

      <div className="asis-card">
        <div className="asis-campos">
          <div className="asis-campo">
            <label htmlFor="sel-seccion">Sección</label>
            <select id="sel-seccion" className="asis-select" value={seccionClave} onChange={e => cambiarSeccion(e.target.value)}>
              {secciones.map(s => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="asis-campo">
            <label htmlFor="sel-fecha">Fecha de la reunión</label>
            <input
              id="sel-fecha" type="date" className="asis-input" value={fecha} min={desde} required
              aria-invalid={!fechaOk} aria-describedby="estado-reunion"
              onChange={e => cambiarFecha(e.target.value)}
            />
          </div>
        </div>
        <p id="estado-reunion" className="asis-muted" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          {fechaAntigua
            ? `Solo se puede pasar lista de esta ronda (desde el ${fechaLegible(desde)}).`
            : !fechaOk
            ? 'Elige una fecha válida.'
            : yaGuardada
              ? <>✎ Esta reunión ya está guardada: estás <strong>editándola</strong>.
                {guardada.actualizadoPorCorreo && <> Último guardado: {quienYCuando(guardada.actualizadoPorCorreo, guardada.actualizado)}.</>}</>
              : <>Reunión nueva del <strong>{fechaLegible(fecha)}</strong>.</>}
          <br />
          Cuota de {seccion?.nombre}:{' '}
          {cuota.importe > 0
            ? <strong>{euros(cuota.importe)} {cuota.trimestral ? 'por trimestre (un solo pago)' : 'por reunión'}</strong>
            : 'sin cuota'}
        </p>
        {recientes.length > 0 && (
          <div className="asis-chips" role="group" aria-label="Reuniones guardadas recientes">
            {recientes.map(r => (
              <button key={r.id} type="button" className="asis-chip" aria-pressed={r.fecha === fecha} onClick={() => cambiarFecha(r.fecha)}>
                {fechaLegible(r.fecha)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={mensajeRef} tabIndex={-1} style={{ outline: 'none' }}>
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
        {conflicto && (
          <Aviso tipo="error">
            <strong>⚠ {conflicto.quien} ha {conflicto.borrando ? 'cambiado' : 'guardado'} esta reunión mientras la tenías abierta.</strong>{' '}
            {conflicto.borrando
              ? 'No se ha borrado nada.'
              : 'No se ha guardado nada: tus marcas siguen en pantalla.'}
            <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              <button type="button" className="asis-btn asis-btn--sec asis-btn--peq" onClick={verSusCambios} disabled={guardando}>
                Ver sus cambios (descarta los tuyos)
              </button>
              {!conflicto.borrando && (
                <button type="button" className="asis-btn asis-btn--peligro asis-btn--peq" onClick={() => guardar(true)} disabled={guardando}>
                  Guardar igualmente (sustituye lo suyo)
                </button>
              )}
            </span>
          </Aviso>
        )}
      </div>

      {lista.length === 0 ? (
        <Aviso tipo="info">No hay educandos en esta sección.</Aviso>
      ) : (
        <>
          {/* Mientras llega lo último del servidor, se ve la lista pero no se edita:
              si no, al llegar los datos se perderían los cambios. */}
          <fieldset className="asis-fieldset" disabled={actualizando}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <p className="asis-muted" style={{ margin: 0 }}>
                {plural(lista.length, 'educando', 'educandos')}{actualizando && ' · actualizando…'}
              </p>
              <button type="button" className="asis-btn asis-btn--sec asis-btn--peq" onClick={alternarTodos}>
                {todosVinieron ? 'Desmarcar a todos' : 'Marcar a todos como presentes'}
              </button>
            </div>

            <ul className="asis-lista">
              {lista.map(e => {
                const f = form[e.id] ?? { asistio: false, pagado: eurosCampo(0), tocado: false }
                const previa = (previos.get(e.id) ?? TOTALES_CERO).deuda
                const n = parsearEuros(f.pagado)
                const tras = n === null ? null : deudaCon(e.id, f.asistio, n)
                const nota = !e.activo ? 'de baja' : e.seccionClave !== seccionClave ? `ahora en ${e.seccion}` : null
                const idNombre = `nombre-${e.id}`
                return (
                  <li key={e.id} className={`asis-fila${f.asistio ? ' asis-fila--vino' : ''}`} aria-labelledby={idNombre}>
                    <div className="asis-fila__cab">
                      <span id={idNombre} className="asis-fila__nombre">
                        {nombreCompleto(e)} {nota && <span className="asis-fila__nota">({nota})</span>}
                      </span>
                      <EstadoCuotas deuda={previa} prefijo="Antes de esta reunión:" />
                    </div>
                    <div className="asis-fila__controles">
                      <label className="asis-vino">
                        <input type="checkbox" checked={f.asistio} onChange={ev => marcarVino(e.id, ev.target.checked)} aria-describedby={idNombre} />
                        Ha venido
                      </label>
                      <div className="asis-cuotas" role="group" aria-labelledby={`lbl-pagado-${e.id} ${idNombre}`}>
                        <label id={`lbl-pagado-${e.id}`} htmlFor={`pagado-${e.id}`} className="asis-cuotas__label">Dinero recogido hoy (€)</label>
                        <button type="button" className="asis-paso" onClick={() => sumarPagado(e.id, -paso)} disabled={(n ?? 0) <= 0} aria-label={`${euros(paso)} menos para ${nombreCompleto(e)}`}>−</button>
                        <input
                          id={`pagado-${e.id}`} className="asis-num asis-num--euros" type="text" inputMode="decimal"
                          autoComplete="off" value={f.pagado} aria-invalid={n === null}
                          onChange={ev => ponerPagado(e.id, ev.target.value)}
                          onFocus={ev => ev.target.select()}
                        />
                        <button type="button" className="asis-paso" onClick={() => sumarPagado(e.id, paso)} disabled={(n ?? 0) >= MAX_CENTIMOS} aria-label={`${euros(paso)} más para ${nombreCompleto(e)}`}>+</button>
                      </div>
                    </div>
                    {tras !== null && (f.asistio || n! > 0 || previa !== 0) && (
                      <p className="asis-fila__tras" aria-live="polite">
                        Con esta reunión: <EstadoCuotas deuda={tras} />
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </fieldset>

          {yaGuardada && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button type="button" className="asis-btn asis-btn--peligro asis-btn--peq" onClick={borrar} disabled={guardando || actualizando}>
                Borrar esta reunión
              </button>
            </div>
          )}
        </>
      )}

      {/* Barra fija inferior: siempre a mano en el móvil */}
      <div className="asis-barra">
        <div className="asis-barra__in">
          <p className="asis-barra__info" aria-live="polite" style={{ margin: 0 }}>
            <strong>{presentes}</strong>/{lista.length} presentes · <strong>{euros(recogidoHoy)}</strong> recogidos hoy
            {pendiente && <><br /><span style={{ color: 'var(--aviso)', fontWeight: 700 }}>● Cambios sin guardar</span></>}
          </p>
          <button type="button" className="asis-btn" onClick={() => guardar()} disabled={guardando || actualizando || !fechaOk || lista.length === 0 || (!pendiente && yaGuardada)}>
            {guardando ? 'Guardando…' : actualizando ? 'Actualizando…' : !pendiente && yaGuardada ? 'Guardado ✓' : 'Guardar'}
          </button>
        </div>
      </div>
    </section>
  )
}
