// Personas con acceso al Kraal (solo administradoras).
import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  ADMIN_INICIAL, guardarDominio, guardarMiembro, leerDominio, listarMiembros, quitarMiembro, type Miembro, type Rol,
} from '../lib/sesion.ts'
import { normalizarCorreo, normalizarDominio, PATRON_CORREO } from '../lib/roles.ts'

export default function Personas({ usuario }: { usuario: User }) {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null)
  const [dominio, setDominio] = useState('')
  const [nuevo, setNuevo] = useState<Miembro>({ correo: '', nombre: '', rol: 'scouter' })
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([listarMiembros(), leerDominio()])
      setMiembros(m); setDominio(d)
    } catch (e) {
      console.error(e)
      setMensaje({ tipo: 'error', texto: 'No se ha podido cargar la lista. Comprueba la conexión.' })
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const intentar = async (accion: () => Promise<unknown>, ok: string) => {
    setMensaje(null)
    try {
      await accion()
      await cargar()
      setMensaje({ tipo: 'ok', texto: ok })
    } catch (e) {
      console.error(e)
      setMensaje({ tipo: 'error', texto: 'No se ha podido guardar. Comprueba la conexión.' })
    }
  }

  const anadir = (e: React.FormEvent) => {
    e.preventDefault()
    const correo = normalizarCorreo(nuevo.correo)
    if (!PATRON_CORREO.test(correo)) return setMensaje({ tipo: 'error', texto: 'Escribe un correo válido.' })
    intentar(async () => { await guardarMiembro({ ...nuevo, correo }); setNuevo({ correo: '', nombre: '', rol: 'scouter' }) }, `Añadida ${correo} ✓`)
  }

  const yo = normalizarCorreo(usuario.email ?? '')

  return (
    <>
      <h1>Personas con acceso</h1>
      <p className="entradilla">
        Para entrar al Kraal hace falta una cuenta de Google. Las <strong>scouters</strong> pueden pasar lista y cambiar
        puntos; las <strong>administradoras</strong> además editan la web, las cuotas, el listado de educandos y esta lista.
      </p>

      <form className="tarjeta formulario" onSubmit={anadir}>
        <h2>Añadir persona</h2>
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="m-correo">Correo de Google</label>
            <input id="m-correo" type="email" className="entrada" value={nuevo.correo} onChange={e => setNuevo({ ...nuevo, correo: e.target.value })} required />
          </div>
          <div className="campo">
            <label htmlFor="m-nombre">Nombre (opcional)</label>
            <input id="m-nombre" className="entrada" maxLength={80} value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="m-rol">Permisos</label>
            <select id="m-rol" className="selector" value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
              <option value="scouter">Scouter</option>
              <option value="admin">Administradora</option>
            </select>
          </div>
        </div>
        <div><button type="submit" className="boton">Añadir</button></div>
      </form>

      {mensaje && <p className={`mensaje mensaje--${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}

      <h2>Con acceso</h2>
      {ADMIN_INICIAL && (
        <p className="suave">
          <strong>{ADMIN_INICIAL}</strong> es la administradora inicial: siempre tiene acceso (se cambia con <code>npm run configurar</code>).
        </p>
      )}
      {!miembros ? <p className="suave" role="status">Cargando…</p> : miembros.length === 0 ? (
        <p className="suave">Todavía no has añadido a nadie.</p>
      ) : (
        <ul className="tarjeta filas" style={{ padding: '0.25rem 1.25rem' }}>
          {miembros.map(m => (
            <li key={m.correo} style={{ alignItems: 'center' }}>
              <span style={{ flex: '1 1 220px' }}>
                <strong>{m.correo}</strong>{m.nombre && <span className="suave"> · {m.nombre}</span>}
              </span>
              <select className="selector" style={{ width: 'auto' }} aria-label={`Permisos de ${m.correo}`} value={m.rol}
                onChange={e => intentar(() => guardarMiembro({ ...m, rol: e.target.value as Rol }), `Permisos de ${m.correo} cambiados ✓`)}>
                <option value="scouter">Scouter</option>
                <option value="admin">Administradora</option>
              </select>
              <button type="button" className="boton boton--peligro boton--peq" onClick={() => {
                const aviso = m.correo === yo ? '¿Quitarte a ti misma? Perderás el acceso.' : `¿Quitar el acceso a ${m.correo}?`
                if (window.confirm(aviso)) intentar(() => quitarMiembro(m.correo), `${m.correo} ya no tiene acceso.`)
              }}>Quitar</button>
            </li>
          ))}
        </ul>
      )}

      <form className="tarjeta formulario" onSubmit={e => {
        e.preventDefault()
        const d = normalizarDominio(dominio)
        if (dominio.trim() && !d) return setMensaje({ tipo: 'error', texto: 'Escribe solo el dominio, por ejemplo migrupo.org.' })
        intentar(() => guardarDominio(d), d ? `Todas las cuentas @${d} pueden entrar como scouters ✓` : 'Dominio quitado ✓')
      }}>
        <h2>Dominio del grupo (opcional)</h2>
        <p className="suave">
          Si el grupo tiene Google Workspace (correos @migrupo.org), cualquier cuenta de ese dominio podrá entrar como scouter
          sin añadirla una a una. Déjalo vacío si usáis cuentas de Gmail.
        </p>
        <div className="botones" style={{ alignItems: 'end' }}>
          <div className="campo" style={{ flex: '1 1 220px' }}>
            <label htmlFor="m-dominio">Dominio</label>
            <input id="m-dominio" className="entrada" placeholder="migrupo.org" value={dominio} onChange={e => setDominio(e.target.value)} />
          </div>
          <button type="submit" className="boton boton--sec">Guardar dominio</button>
        </div>
      </form>
    </>
  )
}
