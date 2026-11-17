// Asistencia y cuotas: /kraal/asistencia
//
// - Solo para personas con acceso al Kraal (lo protege firestore.rules).
// - Ningún nombre de educando está en el código: todo llega de Firestore
//   después de iniciar sesión.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import PasarLista, { type SeccionOpcion } from '../components/asistencia/PasarLista.tsx'
import Resumen from '../components/asistencia/Resumen.tsx'
import Listado from '../components/asistencia/Listado.tsx'
import { Aviso } from '../components/asistencia/ui.tsx'
import '../components/asistencia/asistencia.css'
import { fechaLocal, idRegistro } from '../lib/asistencia/normalizar.ts'
import { useContenido } from '../lib/contenido.ts'
import { salir } from '../lib/sesion.ts'
import { cargarTodo, type DatosAsistencia, type Reunion } from '../lib/asistencia/datos.ts'
import { inicioRonda, type Registro } from '../lib/asistencia/cuotas.ts'

type Pestana = 'lista' | 'resumen' | 'listado'

// ─── Panel ───────────────────────────────────────────────────────────────────

/**
 * Orden de las secciones: el de la web (Editar la web → Secciones) y luego
 * alfabético. En el Excel pueden venir por nombre (manada) o por rama (lobatos).
 */
function ordenSeccion(clave: string, web: { id: string; rama: string }[]): number {
  const i = web.findIndex(s => [s.id, s.rama.toLowerCase()].filter(Boolean).some(k => clave === k || clave.startsWith(`${k}-`)))
  return i === -1 ? 99 : i
}

export default function Asistencia({ usuario, admin }: { usuario: User; admin: boolean }) {
  const { secciones: seccionesWeb } = useContenido()
  const [datos, setDatos] = useState<DatosAsistencia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('lista')
  const [pendiente, setPendiente] = useState(false)
  /** Se está mostrando la copia del dispositivo mientras llega lo último. */
  const [actualizando, setActualizando] = useState(false)
  // Solo se trabaja con la ronda actual (desde el 1 de septiembre).
  const [desde] = useState(() => inicioRonda(fechaLocal()))

  const cargar = useCallback(async () => {
    setError(null)
    setActualizando(true)
    try {
      // Primero lo guardado en el dispositivo (al momento), luego lo del servidor.
      const copia = await cargarTodo(desde, 'cache').catch(() => null)
      if (copia) setDatos(d => d ?? copia)
      setDatos(await cargarTodo(desde))
    } catch (e) {
      console.error(e)
      const code = (e as { code?: string }).code
      setError(code === 'permission-denied'
        ? 'Tu cuenta no tiene permiso para ver estos datos. Si acabas de recibir la cuenta, avisa a quien administra la web.'
        : 'No se han podido cargar los datos. Comprueba la conexión.')
    } finally {
      setActualizando(false)
    }
  }, [desde])

  useEffect(() => { cargar() }, [cargar])

  // Aviso al salir con cambios sin guardar: cerrar/recargar pestaña…
  useEffect(() => {
    if (!pendiente) return
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    // …y enlaces internos de la web (menú, pie), que no recargan la página.
    const clic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]')
      if (a && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) {
        e.preventDefault(); e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', antes)
    document.addEventListener('click', clic, true)
    return () => { window.removeEventListener('beforeunload', antes); document.removeEventListener('click', clic, true) }
  }, [pendiente])

  const secciones = useMemo<SeccionOpcion[]>(() => {
    const m = new Map<string, string>()
    for (const e of datos?.educandos ?? []) if (e.activo) m.set(e.seccionClave, e.seccion)
    return [...m].map(([clave, nombre]) => ({ clave, nombre }))
      .sort((a, b) => ordenSeccion(a.clave, seccionesWeb) - ordenSeccion(b.clave, seccionesWeb) || a.nombre.localeCompare(b.nombre, 'es'))
  }, [datos?.educandos, seccionesWeb])

  // Tras guardar, se actualizan los datos en memoria sin volver a descargarlo todo.
  const alGuardar = useCallback((c: { reunion: Reunion; escritos: Registro[]; borrados: string[] } | { borrada: string }) => {
    setDatos(d => {
      if (!d) return d
      if ('borrada' in c) {
        return { ...d, reuniones: d.reuniones.filter(r => r.id !== c.borrada), registros: d.registros.filter(r => r.reunionId !== c.borrada) }
      }
      const fuera = new Set([...c.borrados, ...c.escritos.map(r => idRegistro(r.reunionId, r.educandoId))])
      return {
        ...d,
        reuniones: [...d.reuniones.filter(r => r.id !== c.reunion.id), c.reunion],
        registros: [...d.registros.filter(r => !fuera.has(idRegistro(r.reunionId, r.educandoId))), ...c.escritos],
      }
    })
  }, [])

  const pestanas: { id: Pestana; titulo: string }[] = [
    { id: 'lista', titulo: 'Pasar lista' },
    { id: 'resumen', titulo: 'Resumen' },
    ...(admin ? [{ id: 'listado' as const, titulo: 'Ajustes' }] : []),
  ]
  const cambiarPestana = (p: Pestana) => {
    if (p === pestana) return
    if (pendiente && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return
    setPendiente(false)
    setPestana(p)
  }
  // Pestañas accesibles: flechas izquierda/derecha para moverse.
  const teclaPestana = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length
    cambiarPestana(pestanas[j].id)
    document.getElementById(`tab-${pestanas[j].id}`)?.focus()
  }

  return (
    <div className="asis">
      <div className="asis-top">
        <h1>Asistencia y cuotas</h1>
        <div className="asis-user">
          <span>{usuario.email}{admin && ' · admin'}</span>
          <button type="button" className="asis-btn asis-btn--sec asis-btn--peq"
            onClick={() => { if (!pendiente || window.confirm('Tienes cambios sin guardar. ¿Salir?')) salir() }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="asis-tabs" role="tablist" aria-label="Apartados">
        {pestanas.map((p, i) => (
          <button key={p.id} id={`tab-${p.id}`} type="button" role="tab" className="asis-tab"
            aria-selected={pestana === p.id} aria-controls={`panel-${p.id}`} tabIndex={pestana === p.id ? 0 : -1}
            onClick={() => cambiarPestana(p.id)} onKeyDown={e => teclaPestana(e, i)}>
            {p.titulo}
          </button>
        ))}
      </div>

      {error && (
        <Aviso tipo="error">
          {error}{' '}
          <button type="button" className="asis-btn asis-btn--sec asis-btn--peq" onClick={cargar} style={{ marginLeft: '0.5rem' }}>Reintentar</button>
        </Aviso>
      )}
      {!datos && !error && <p className="asis-muted" role="status">Cargando datos…</p>}

      {datos && (
        <div id={`panel-${pestana}`} role="tabpanel" aria-labelledby={`tab-${pestana}`}>
          {pestana === 'lista' && (
            <PasarLista
              datos={datos} uid={usuario.uid} correo={usuario.email ?? ''} secciones={secciones}
              desde={desde} actualizando={actualizando}
              alCambiarPendiente={setPendiente} alGuardar={alGuardar} alRecargar={cargar}
            />
          )}
          {pestana === 'resumen' && <Resumen datos={datos} secciones={secciones} desde={desde} />}
          {pestana === 'listado' && admin && <Listado datos={datos} secciones={secciones} desde={desde} alActualizar={cargar} />}
        </div>
      )}
    </div>
  )
}
