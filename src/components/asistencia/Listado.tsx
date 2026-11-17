// Pestaña "Ajustes" (solo administradores):
//  - Actualizar listado: se lee el Excel del enlace de Google Drive (o un
//    archivo del dispositivo), se valida EN EL NAVEGADOR, se enseña qué va a
//    cambiar y, al confirmar, se guardan solo nombre, iniciales/apellidos,
//    sección e ID. El archivo no se copia a ningún sitio.
//  - Cuota de cada sección: importe y si es por reunión o por trimestre
//    (único sitio donde se configura).
//  - Rondas: descargar en CSV la actual o cualquiera de las anteriores.
import { useEffect, useState } from 'react'
import { cuotaDeSeccion, eurosCampo, nombreRonda, parsearEuros, type CuotaSeccion } from '../../lib/asistencia/cuotas.ts'
import { ErrorHoja, leerHoja } from '../../lib/asistencia/excel.ts'
import { descargarCsv, filasDetalle, filasResumen, rondasDesde } from '../../lib/asistencia/exportar.ts'
import {
  compararListado, nombreCompleto, validarFilas,
  type CambiosListado, type EducandoGuardado, type ResultadoListado,
} from '../../lib/asistencia/listado.ts'
import {
  aplicarListado, cargarRonda, descargarDeDrive, guardarCuotas, guardarDriveFileId, permisoDrive, primeraFecha,
  type DatosAsistencia,
} from '../../lib/asistencia/datos.ts'
import { enlaceDeId, idDeEnlaceDrive } from '../../lib/asistencia/enlaceDrive.ts'
import { Aviso } from './ui.tsx'
import type { SeccionOpcion } from './PasarLista.tsx'

export default function Listado({ datos, secciones, desde, alActualizar }: {
  datos: DatosAsistencia
  secciones: SeccionOpcion[]
  /** Inicio de la ronda actual ("AAAA-09-01"). */
  desde: string
  alActualizar: () => Promise<void>
}) {
  const [archivo, setArchivo] = useState<string>('')
  const [resultado, setResultado] = useState<ResultadoListado | null>(null)
  const [cambios, setCambios] = useState<CambiosListado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [cuotas, setCuotas] = useState<Record<string, { importe: string; trimestral: boolean }>>(() =>
    Object.fromEntries(secciones.map(s => {
      const c = cuotaDeSeccion(s.clave, datos.cuotas)
      return [s.clave, { importe: eurosCampo(c.importe), trimestral: c.trimestral }]
    })))
  const [msgCuotas, setMsgCuotas] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [editandoEnlace, setEditandoEnlace] = useState(datos.driveFileId === null)
  const [enlace, setEnlace] = useState('')
  const [msgEnlace, setMsgEnlace] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const empezar = () => { setResultado(null); setCambios(null); setError(null); setOk(null) }

  /** Lee, valida y compara el listado con lo guardado (no guarda nada todavía). */
  const procesar = async (obtener: () => Promise<{ datos: ArrayBuffer; nombre: string }>) => {
    setTrabajando(true)
    try {
      const { datos: bytes, nombre } = await obtener()
      setArchivo(nombre)
      const r = validarFilas(await leerHoja(bytes))
      setResultado(r)
      if (r.ok) setCambios(compararListado(r.educandos, datos.educandos))
    } catch (e) {
      console.error(e)
      const code = (e as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      setError(
        e instanceof ErrorHoja ? e.message
          : code === 'auth/popup-blocked' ? 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes de esta web y vuelve a pulsar.'
          : code === 'auth/user-mismatch' ? 'Has elegido otra cuenta de Google. Usa la misma con la que has entrado.'
          : 'No se ha podido leer el listado. Comprueba la conexión y vuelve a intentarlo.',
      )
    } finally {
      setTrabajando(false)
    }
  }

  const leerDrive = () => {
    if (!datos.driveFileId) return
    const id = datos.driveFileId
    empezar()
    return procesar(async () => {
      const token = await permisoDrive() // primero, para que la ventana de Google salga del clic
      const f = await descargarDeDrive(id, token)
      const cuando = f.modificado ? ` · modificado el ${f.modificado.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}` : ''
      return { datos: f.datos, nombre: `${f.nombre} (Google Drive${cuando})` }
    })
  }

  const elegir = async (input: HTMLInputElement) => {
    const f = input.files?.[0]
    empezar()
    if (!f) return
    await procesar(async () => ({ datos: await f.arrayBuffer(), nombre: f.name }))
    input.value = '' // permite volver a elegir el mismo archivo tras corregirlo
  }

  const guardarEnlace = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = idDeEnlaceDrive(enlace)
    if (!id) {
      setMsgEnlace({ tipo: 'error', texto: 'No parece un enlace de Google Drive. Cópialo desde «Compartir → Copiar enlace».' })
      return
    }
    try {
      await guardarDriveFileId(id)
      await alActualizar()
      setEditandoEnlace(false); setEnlace('')
      setMsgEnlace({ tipo: 'ok', texto: 'Enlace guardado ✓ Ya puedes pulsar «Leer desde Google Drive».' })
    } catch (err) {
      console.error(err)
      setMsgEnlace({ tipo: 'error', texto: 'No se ha podido guardar el enlace.' })
    }
  }

  const aplicar = async () => {
    if (!cambios) return
    const n = cambios.bajas.length
    if (n > 0 && !window.confirm(`${n} ${n === 1 ? 'educando pasará' : 'educandos pasarán'} a baja (no se borra su histórico). ¿Continuar?`)) return
    setTrabajando(true)
    try {
      await aplicarListado(cambios)
      await alActualizar()
      setOk('Listado actualizado ✓')
      setResultado(null); setCambios(null); setArchivo('')
    } catch (e) {
      console.error(e)
      setError('No se ha podido guardar el listado. Comprueba la conexión y que tu cuenta es administradora.')
    } finally {
      setTrabajando(false)
    }
  }

  // Una sección que aparece tras cargar un listado nuevo todavía no está en el estado.
  const filaCuota = (clave: string) => cuotas[clave] ?? (() => {
    const c = cuotaDeSeccion(clave, datos.cuotas)
    return { importe: eurosCampo(c.importe), trimestral: c.trimestral }
  })()

  const cambiarCuota = (clave: string, cambio: Partial<{ importe: string; trimestral: boolean }>) => {
    setCuotas(c => ({ ...c, [clave]: { ...filaCuota(clave), ...cambio } }))
    setMsgCuotas(null)
  }

  const guardarCuotasSecciones = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevas: Record<string, CuotaSeccion> = { ...datos.cuotas }
    for (const s of secciones) {
      const importe = parsearEuros(filaCuota(s.clave).importe)
      if (importe === null) {
        document.getElementById(`cuota-${s.clave}`)?.focus()
        setMsgCuotas({ tipo: 'error', texto: `Revisa la cuota de ${s.nombre}: escribe un importe en euros, por ejemplo 1,50 (0 si no paga cuota).` })
        return
      }
      nuevas[s.clave] = { importe, trimestral: filaCuota(s.clave).trimestral }
    }
    try {
      await guardarCuotas(nuevas)
      await alActualizar()
      setMsgCuotas({ tipo: 'ok', texto: 'Cuotas guardadas ✓ Se aplican a las reuniones que se guarden a partir de ahora; lo ya apuntado no cambia.' })
    } catch (err) {
      console.error(err)
      setMsgCuotas({ tipo: 'error', texto: 'No se han podido guardar las cuotas. Comprueba la conexión y que tu cuenta es administradora.' })
    }
  }

  const activos = datos.educandos.filter(e => e.activo).length
  const hayCambios = cambios && (cambios.altas.length + cambios.reactivados.length + cambios.bajas.length + cambios.cambiosSeccion.length + cambios.otrosCambios.length > 0)

  return (
    <section aria-labelledby="titulo-listado">
      <div className="asis-card">
        <h2 id="titulo-listado">Listado de educandos</h2>
        <p className="asis-muted">
          Ahora mismo hay <strong>{activos}</strong> educandos activos. El listado sale del Excel de Google Drive:
          columnas <strong>Nombre</strong> y <strong>Sección</strong> (opcionales: <strong>Apellidos</strong> o <strong>Iniciales</strong>, e <strong>ID</strong>).
          Se lee en tu dispositivo y solo se guardan esas columnas.
        </p>

        {datos.driveFileId && !editandoEnlace ? (
          <>
            <p style={{ fontSize: '0.92rem' }}>
              Archivo:{' '}
              <a href={enlaceDeId(datos.driveFileId)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primario)', fontWeight: 600 }}>
                abrir en Google Drive
              </a>
              {' · '}
              <button type="button" className="asis-link" onClick={() => { setEditandoEnlace(true); setMsgEnlace(null) }}>cambiar enlace</button>
            </p>
            <button type="button" className="asis-btn" onClick={leerDrive} disabled={trabajando}>
              {trabajando ? 'Leyendo…' : '🔄 Leer desde Google Drive'}
            </button>
            <p className="asis-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              La primera vez Google te pedirá permiso de solo lectura en Drive. La web solo abre este archivo y no guarda tu acceso: lo usa durante la sesión y lo olvida.
            </p>
          </>
        ) : (
          <form onSubmit={guardarEnlace}>
            <label className="asis-label" htmlFor="enlace-drive">Enlace del Excel en Google Drive</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input id="enlace-drive" className="asis-input" style={{ flex: '1 1 260px' }} type="url" inputMode="url"
                placeholder="https://drive.google.com/…" value={enlace}
                onChange={e => { setEnlace(e.target.value); setMsgEnlace(null) }} required />
              <button type="submit" className="asis-btn asis-btn--sec">Guardar enlace</button>
              {datos.driveFileId && (
                <button type="button" className="asis-btn asis-btn--sec" onClick={() => { setEditandoEnlace(false); setMsgEnlace(null) }}>Cancelar</button>
              )}
            </div>
            <p className="asis-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Compártelo <strong>solo con el grupo</strong> (con las scouters o con el dominio del grupo),
              no con «Cualquier persona con el enlace».
            </p>
          </form>
        )}
        {msgEnlace && <div style={{ marginTop: '0.75rem' }}><Aviso tipo={msgEnlace.tipo}>{msgEnlace.texto}</Aviso></div>}

        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>¿Sin acceso a Drive? Sube el archivo desde tu dispositivo</summary>
          <label htmlFor="excel" className="asis-btn asis-btn--sec asis-btn--peq" style={{ marginTop: '0.5rem' }}>
            📄 Elegir archivo (.xlsx o .csv)
          </label>
          <input
            id="excel" type="file" className="sr-only"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={e => elegir(e.currentTarget)} disabled={trabajando}
          />
        </details>
        {archivo && <p className="asis-muted" style={{ marginTop: '0.5rem' }}>Leído: {archivo}</p>}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {resultado && (
        <div className="asis-card">
          <h3>Comprobación del archivo</h3>
          <p className="asis-muted">
            Columnas usadas: «{resultado.columnas.nombre}», «{resultado.columnas.seccion}»
            {resultado.columnas.apellidos.map(a => `, «${a}»`).join('')}
            {resultado.columnas.id ? `, «${resultado.columnas.id}» como identificador` : ' · sin columna de ID: se identifica por nombre e iniciales'}
          </p>
          {resultado.incidencias.filter(i => i.nivel === 'error').length > 0 && (
            <Aviso tipo="error">
              <strong>Hay que corregir el Excel antes de aplicarlo:</strong>
              <ul>{resultado.incidencias.filter(i => i.nivel === 'error').map((i, n) => <li key={n}>{i.mensaje}</li>)}</ul>
            </Aviso>
          )}
          {resultado.incidencias.filter(i => i.nivel === 'aviso').length > 0 && (
            <Aviso tipo="info">
              <ul style={{ marginTop: 0 }}>{resultado.incidencias.filter(i => i.nivel === 'aviso').map((i, n) => <li key={n}>{i.mensaje}</li>)}</ul>
            </Aviso>
          )}

          {cambios && (
            <>
              <h3>Qué va a cambiar</h3>
              {!hayCambios && <p>No hay cambios: el listado ya está al día.</p>}
              <ListaCambios titulo="Altas" items={cambios.altas.map(e => `${nombreCompleto(e)} — ${e.seccion}`)} />
              <ListaCambios titulo="Vuelven (estaban de baja)" items={cambios.reactivados.map(e => `${nombreCompleto(e)} — ${e.seccion}`)} />
              <ListaCambios titulo="Cambios de sección (conservan su histórico)" items={cambios.cambiosSeccion.map(c => `${nombreCompleto(c.despues)}: ${c.antes.seccion} → ${c.despues.seccion}`)} />
              <ListaCambios titulo="Cambios de nombre o de cómo se escribe la sección" items={cambios.otrosCambios.map(e => `${nombreCompleto(e)} — ${e.seccion}`)} />
              <ListaCambios titulo="Bajas (no están en el Excel; se conserva su histórico)" items={cambios.bajas.map(e => `${nombreCompleto(e)} — ${e.seccion}`)} />
              <p className="asis-muted">Sin cambios: {cambios.sinCambios}</p>
              {cambios.bajas.length > 0 && cambios.bajas.length >= activos / 3 && (
                <Aviso tipo="info">⚠ Van a pasar a baja muchos educandos ({cambios.bajas.length} de {activos}). ¿Seguro que es el Excel completo y actualizado?</Aviso>
              )}
              <button type="button" className="asis-btn" onClick={aplicar} disabled={trabajando || !hayCambios}>
                {trabajando ? 'Guardando…' : 'Aplicar cambios'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="asis-card">
        <h2>Cuotas por sección</h2>
        <p className="asis-muted">
          «Por reunión»: se cobra cada reunión a la que viene. «Por trimestre»: un solo pago por trimestre
          (septiembre–diciembre, enero–marzo y abril–agosto) si viene a alguna reunión.
        </p>
        {secciones.length === 0 ? (
          <p className="asis-muted">Aparecerán las secciones cuando haya educandos en el listado.</p>
        ) : (
          <form onSubmit={guardarCuotasSecciones}>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {secciones.map(s => (
                <fieldset key={s.clave} style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
                  <legend className="asis-label" style={{ width: '100%' }}>{s.nombre}</legend>
                  <div className="asis-campo" style={{ maxWidth: 140 }}>
                    <label htmlFor={`cuota-${s.clave}`}>Importe (€)</label>
                    <input id={`cuota-${s.clave}`} className="asis-input" inputMode="decimal" value={filaCuota(s.clave).importe}
                      aria-invalid={parsearEuros(filaCuota(s.clave).importe) === null}
                      onChange={e => cambiarCuota(s.clave, { importe: e.target.value })} />
                  </div>
                  <div className="asis-campo" style={{ maxWidth: 220 }}>
                    <label htmlFor={`modo-${s.clave}`}>Se cobra</label>
                    <select id={`modo-${s.clave}`} className="asis-select" value={filaCuota(s.clave).trimestral ? 'trimestre' : 'reunion'}
                      onChange={e => cambiarCuota(s.clave, { trimestral: e.target.value === 'trimestre' })}>
                      <option value="reunion">Por reunión</option>
                      <option value="trimestre">Por trimestre (un pago)</option>
                    </select>
                  </div>
                </fieldset>
              ))}
            </div>
            <button type="submit" className="asis-btn asis-btn--sec" style={{ marginTop: '1rem' }}>Guardar cuotas</button>
          </form>
        )}
        {msgCuotas && <div style={{ marginTop: '0.75rem' }}><Aviso tipo={msgCuotas.tipo}>{msgCuotas.texto}</Aviso></div>}
      </div>

      <ExportarRondas educandos={datos.educandos} desde={desde} />
    </section>
  )
}

/** Descarga en CSV cualquier ronda (también las cerradas, que la página ya no carga). */
function ExportarRondas({ educandos, desde }: { educandos: EducandoGuardado[]; desde: string }) {
  const [rondas, setRondas] = useState<string[]>([desde])
  const [ronda, setRonda] = useState(desde)
  const [trabajando, setTrabajando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    primeraFecha()
      .then(f => {
        const r = rondasDesde(f, desde)
        setRondas(r)
        setRonda(r[1] ?? r[0]) // por defecto, la última ronda cerrada
      })
      .catch(e => console.error(e))
  }, [desde])

  const exportar = async (tipo: 'resumen' | 'detalle') => {
    setTrabajando(true)
    setMsg(null)
    try {
      const { reuniones, registros } = await cargarRonda(ronda)
      if (registros.length === 0) {
        setMsg({ tipo: 'info', texto: `No hay nada apuntado en la ronda ${nombreRonda(ronda)}.` })
        return
      }
      descargarCsv(`asistencia-${nombreRonda(ronda)}-${tipo}.csv`, tipo === 'resumen'
        ? filasResumen(educandos, registros)
        : filasDetalle(educandos, reuniones, registros))
    } catch (e) {
      console.error(e)
      setMsg({ tipo: 'error', texto: 'No se ha podido descargar la ronda. Comprueba la conexión.' })
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="asis-card">
      <h2>Rondas y exportación</h2>
      <p className="asis-muted">
        Cada ronda va del 1 de septiembre al 31 de agosto. El 1 de septiembre la página pasa sola a la ronda nueva,
        que empieza a cero; lo anterior se queda guardado y se descarga aquí (se abre con Excel).
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="asis-campo" style={{ maxWidth: 220 }}>
          <label htmlFor="exp-ronda">Ronda</label>
          <select id="exp-ronda" className="asis-select" value={ronda} onChange={e => { setRonda(e.target.value); setMsg(null) }}>
            {rondas.map(r => <option key={r} value={r}>{nombreRonda(r)}{r === desde ? ' (actual)' : ''}</option>)}
          </select>
        </div>
        <button type="button" className="asis-btn asis-btn--sec" onClick={() => exportar('resumen')} disabled={trabajando}>
          ⬇ Resumen por educando
        </button>
        <button type="button" className="asis-btn asis-btn--sec" onClick={() => exportar('detalle')} disabled={trabajando}>
          ⬇ Detalle por reunión
        </button>
      </div>
      {msg && <div style={{ marginTop: '0.75rem' }}><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
    </div>
  )
}

function ListaCambios({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <details style={{ marginBottom: '0.5rem' }} open={items.length <= 10}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 32 }}>{titulo}: {items.length}</summary>
      <ul style={{ margin: '0.3rem 0 0.5rem 1.3rem' }}>{items.map(i => <li key={i}>{i}</li>)}</ul>
    </details>
  )
}
