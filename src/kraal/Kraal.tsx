// Zona de scouters: /kraal
//
// Se entra con una cuenta de Google. Quién tiene acceso y con qué permisos lo
// decide lib/roles.ts (y, de verdad, firestore.rules).
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import type { User } from 'firebase/auth'
import Seo from '../components/Seo.tsx'
import { entrarConGoogle, observarSesion, rolDe, salir, type Rol } from '../lib/sesion.ts'
import { useContenido } from '../lib/contenido.ts'

const Asistencia = lazy(() => import('./Asistencia.tsx'))
const Puntos = lazy(() => import('./Puntos.tsx'))
const EditorWeb = lazy(() => import('./EditorWeb.tsx'))
const Personas = lazy(() => import('./Personas.tsx'))

export default function Kraal() {
  return (
    <section className="pagina">
      <Seo ruta="/kraal" />
      <div className="contenedor">
        <ErrorDePagina>
          <Puerta />
        </ErrorDePagina>
      </div>
    </section>
  )
}

function Puerta() {
  const [usuario, setUsuario] = useState<User | null | undefined>(undefined)
  const [rol, setRol] = useState<Rol | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  useEffect(() => observarSesion(setUsuario), [])
  useEffect(() => {
    if (!usuario) { setRol(undefined); return }
    setRol(undefined)
    rolDe(usuario).then(setRol).catch(e => {
      console.error(e)
      setError('No se han podido comprobar tus permisos. Comprueba la conexión y recarga la página.')
    })
  }, [usuario])

  const entrar = async () => {
    setError(null); setEntrando(true)
    try {
      await entrarConGoogle()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error(e)
        setError(code === 'auth/unauthorized-domain'
          ? 'Este dominio no está autorizado en Firebase Authentication (ver la guía de instalación).'
          : 'No se ha podido iniciar sesión. Inténtalo de nuevo.')
      }
    } finally {
      setEntrando(false)
    }
  }

  if (usuario === undefined || (usuario && rol === undefined && !error)) {
    return <p className="suave" role="status">Comprobando sesión…</p>
  }

  if (!usuario) {
    return (
      <div className="tarjeta" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Acceso scouters</h1>
        <p className="suave">Entra con tu cuenta de Google. Una administradora tiene que haberte dado acceso.</p>
        {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
        <button type="button" className="boton" onClick={entrar} disabled={entrando} style={{ width: '100%' }}>
          {entrando ? 'Abriendo Google…' : 'Iniciar sesión con Google'}
        </button>
      </div>
    )
  }

  if (!rol) {
    return (
      <div className="tarjeta" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Sin acceso</h1>
        {error
          ? <p className="mensaje mensaje--error" role="alert">{error}</p>
          : <p>La cuenta <strong>{usuario.email}</strong> no tiene acceso al Kraal. Pide a una administradora del grupo que te añada en «Personas con acceso».</p>}
        <button type="button" className="boton boton--sec" onClick={() => salir()}>Entrar con otra cuenta</button>
      </div>
    )
  }

  const admin = rol === 'admin'
  return (
    <Suspense fallback={<p className="suave" role="status">Cargando…</p>}>
      <Routes>
        <Route index element={<Inicio usuario={usuario} admin={admin} />} />
        <Route path="asistencia" element={<Volver><Asistencia usuario={usuario} admin={admin} /></Volver>} />
        <Route path="patrullometro" element={<Volver><Puntos usuario={usuario} admin={admin} /></Volver>} />
        <Route path="web" element={admin ? <Volver><EditorWeb /></Volver> : <SoloAdmin />} />
        <Route path="personas" element={admin ? <Volver><Personas usuario={usuario} /></Volver> : <SoloAdmin />} />
        <Route path="*" element={<SoloAdmin />} />
      </Routes>
    </Suspense>
  )
}

function Inicio({ usuario, admin }: { usuario: User; admin: boolean }) {
  const c = useContenido()
  const opciones = [
    { a: 'asistencia', emoji: '✅', titulo: 'Asistencia y cuotas', texto: 'Pasar lista, dinero recogido y resumen por educando.' },
    ...(c.paginas.patrullometro ? [{ a: 'patrullometro', emoji: '🏆', titulo: 'Patrullómetro', texto: 'Sumar o quitar puntos a las patrullas.' }] : []),
    ...(admin ? [
      { a: 'web', emoji: '✏️', titulo: 'Editar la web', texto: 'Textos, secciones, documentos, fotos, colores y páginas.' },
      { a: 'personas', emoji: '👥', titulo: 'Personas con acceso', texto: 'Quién puede entrar al Kraal y quién es administradora.' },
    ] : []),
  ]
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1>Kraal</h1>
          <p className="suave">{usuario.email}{admin && ' · administradora'}</p>
        </div>
        <button type="button" className="boton boton--sec" onClick={() => salir()}>Cerrar sesión</button>
      </div>
      <div className="rejilla">
        {opciones.map(o => (
          <Link key={o.a} to={o.a} className="tarjeta">
            <span className="emoji" aria-hidden="true">{o.emoji}</span>
            <h2 style={{ fontSize: '1.15rem' }}>{o.titulo}</h2>
            <p className="suave">{o.texto}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

function Volver({ children }: { children: ReactNode }) {
  return (
    <>
      <p><Link to="/kraal">← Kraal</Link></p>
      {children}
    </>
  )
}

function SoloAdmin() {
  return (
    <Volver>
      <p className="mensaje mensaje--info">Esta parte es solo para administradoras.</p>
    </Volver>
  )
}

// Si algo falla al pintar, mensaje claro en vez de pantalla en blanco.
class ErrorDePagina extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  componentDidCatch(e: unknown) { console.error(e) }
  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <p className="mensaje mensaje--error" role="alert">
        Ha ocurrido un error inesperado.{' '}
        <button type="button" className="boton boton--sec boton--peq" onClick={() => window.location.reload()}>Recargar</button>
      </p>
    )
  }
}
