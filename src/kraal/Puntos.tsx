// Patrullómetro en el Kraal: cualquier scouter suma o quita puntos;
// las administradoras crean, renombran y borran patrullas.
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  borrarPatrulla, cambiarPuntos, crearPatrulla, editarPatrulla, ponerACero, seguirHistorial, seguirPatrullas,
} from '../lib/puntos.ts'
import type { CambioPuntos } from '../lib/patrullometro.ts'
import type { Patrulla } from '../lib/types.ts'

const RAPIDOS = [-10, -5, 5, 10, 25]

export default function Puntos({ usuario, admin }: { usuario: User; admin: boolean }) {
  const [patrullas, setPatrullas] = useState<Patrulla[] | null>(null)
  const [historial, setHistorial] = useState<CambioPuntos[]>([])
  const [elegida, setElegida] = useState('')
  const [cambio, setCambio] = useState('10')
  const [motivo, setMotivo] = useState('')
  const [scouter, setScouter] = useState(usuario.displayName?.split(' ')[0] ?? usuario.email?.split('@')[0] ?? '')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => seguirPatrullas(setPatrullas, e => {
    console.error(e)
    setMensaje({ tipo: 'error', texto: 'No se pueden leer las patrullas. Comprueba la conexión.' })
  }), [])
  useEffect(() => seguirHistorial(setHistorial), [])
  useEffect(() => {
    if (patrullas && !patrullas.some(p => p.id === elegida)) setElegida(patrullas[0]?.id ?? '')
  }, [patrullas, elegida])

  const n = Number(cambio)
  const valido = Number.isInteger(n) && n !== 0 && Math.abs(n) <= 1000 && motivo.trim() && scouter.trim() && elegida

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valido) return
    setGuardando(true); setMensaje(null)
    try {
      await cambiarPuntos(elegida, n, motivo, scouter)
      const p = patrullas?.find(x => x.id === elegida)
      setMensaje({ tipo: 'ok', texto: `Guardado ✓ ${n > 0 ? '+' : ''}${n} para ${p?.nombre ?? elegida}.` })
      setMotivo('')
    } catch (err) {
      console.error(err)
      setMensaje({ tipo: 'error', texto: 'No se ha podido guardar. Comprueba la conexión.' })
    } finally {
      setGuardando(false)
    }
  }

  if (!patrullas) return <p className="suave" role="status">Cargando patrullas…</p>

  return (
    <>
      <h1>Patrullómetro</h1>

      {patrullas.length === 0 ? (
        <p className="mensaje mensaje--info">
          Todavía no hay patrullas. {admin ? 'Créalas abajo, en «Patrullas».' : 'Pide a una administradora que las cree.'}
        </p>
      ) : (
        <form className="tarjeta formulario" onSubmit={enviar}>
          <fieldset style={{ border: 0 }}>
            <legend className="etiqueta">Patrulla</legend>
            <div className="botones" style={{ marginTop: '0.4rem' }}>
              {patrullas.map(p => (
                <button key={p.id} type="button" className={p.id === elegida ? 'boton' : 'boton boton--sec'}
                  aria-pressed={p.id === elegida} onClick={() => setElegida(p.id)}>
                  {p.emoji} {p.nombre} · {p.puntos}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="campo">
            <label htmlFor="pt-cambio">Puntos (negativo para quitar)</label>
            <div className="botones">
              <input id="pt-cambio" className="entrada" style={{ maxWidth: 120 }} inputMode="numeric" value={cambio} onChange={e => setCambio(e.target.value)} />
              {RAPIDOS.map(r => (
                <button key={r} type="button" className="boton boton--sec boton--peq" onClick={() => setCambio(String(r))}>{r > 0 ? `+${r}` : r}</button>
              ))}
            </div>
          </div>
          <div className="campo">
            <label htmlFor="pt-motivo">Motivo</label>
            <input id="pt-motivo" className="entrada" maxLength={200} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ganar el gran juego" required />
          </div>
          <div className="campo">
            <label htmlFor="pt-scouter">Quién lo pone</label>
            <input id="pt-scouter" className="entrada" maxLength={60} value={scouter} onChange={e => setScouter(e.target.value)} required />
          </div>
          <div><button type="submit" className="boton" disabled={!valido || guardando}>{guardando ? 'Guardando…' : 'Guardar puntos'}</button></div>
        </form>
      )}
      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}

      {historial.length > 0 && (
        <>
          <h2>Últimos cambios</h2>
          <ul className="tarjeta filas" style={{ padding: '0.25rem 1.25rem' }}>
            {historial.map(h => (
              <li key={h.id}>
                <strong>{patrullas.find(p => p.id === h.patrulla)?.nombre ?? h.patrulla}</strong>
                <strong style={{ color: h.cambio >= 0 ? 'var(--exito)' : 'var(--peligro)' }}>{h.cambio > 0 ? `+${h.cambio}` : h.cambio}</strong>
                <span style={{ flex: 1, minWidth: '10rem' }}>{h.motivo}</span>
                <span className="suave">{h.scouter}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {admin && <GestionPatrullas patrullas={patrullas} />}
    </>
  )
}

function GestionPatrullas({ patrullas }: { patrullas: Patrulla[] }) {
  const [nombre, setNombre] = useState('')
  const [emoji, setEmoji] = useState('')
  const [error, setError] = useState<string | null>(null)

  const intentar = async (accion: () => Promise<unknown>) => {
    setError(null)
    try { await accion() } catch (e) {
      console.error(e)
      setError('No se ha podido guardar el cambio. Comprueba la conexión.')
    }
  }

  return (
    <>
      <h2>Patrullas</h2>
      <div className="tarjeta formulario">
        {patrullas.map(p => <FilaPatrulla key={p.id} patrulla={p} intentar={intentar} />)}
        <form className="botones" style={{ alignItems: 'end' }} onSubmit={e => {
          e.preventDefault()
          if (patrullas.length >= 30) return setError('Máximo 30 patrullas.')
          intentar(async () => { await crearPatrulla(nombre, emoji); setNombre(''); setEmoji('') })
        }}>
          <div className="campo" style={{ maxWidth: 90 }}>
            <label htmlFor="np-emoji">Emoji</label>
            <input id="np-emoji" className="entrada" value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🦅" />
          </div>
          <div className="campo" style={{ flex: '1 1 200px' }}>
            <label htmlFor="np-nombre">Nueva patrulla</label>
            <input id="np-nombre" className="entrada" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} required />
          </div>
          <button type="submit" className="boton boton--sec">Añadir</button>
        </form>
        {patrullas.length > 0 && (
          <div>
            <button type="button" className="boton boton--peligro boton--peq" onClick={() => {
              if (window.confirm('¿Poner todas las patrullas a 0 puntos? El historial se conserva.')) intentar(() => ponerACero(patrullas))
            }}>Poner todas a 0</button>
          </div>
        )}
        {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
      </div>
    </>
  )
}

function FilaPatrulla({ patrulla, intentar }: { patrulla: Patrulla; intentar: (a: () => Promise<unknown>) => void }) {
  const [nombre, setNombre] = useState(patrulla.nombre)
  const [emoji, setEmoji] = useState(patrulla.emoji)
  const cambiado = nombre !== patrulla.nombre || emoji !== patrulla.emoji
  return (
    <div className="botones" style={{ alignItems: 'center' }}>
      <input className="entrada" style={{ maxWidth: 70 }} aria-label={`Emoji de ${patrulla.nombre}`} value={emoji} onChange={e => setEmoji(e.target.value)} />
      <input className="entrada" style={{ flex: '1 1 160px', width: 'auto' }} aria-label={`Nombre de ${patrulla.nombre}`} value={nombre} maxLength={40} onChange={e => setNombre(e.target.value)} />
      <span className="suave">{patrulla.puntos} pts</span>
      <button type="button" className="boton boton--sec boton--peq" disabled={!cambiado || !nombre.trim()} onClick={() => intentar(() => editarPatrulla(patrulla.id, nombre, emoji))}>Guardar</button>
      <button type="button" className="boton boton--peligro boton--peq" onClick={() => {
        if (window.confirm(`¿Borrar la patrulla ${patrulla.nombre}?`)) intentar(() => borrarPatrulla(patrulla.id))
      }}>Borrar</button>
    </div>
  )
}
