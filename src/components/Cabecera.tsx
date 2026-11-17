import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { avisoVigente, urlSegura, useContenido } from '../lib/contenido.ts'
import { PAGINAS } from '../lib/paginas.ts'
import { enLinea } from './Texto.tsx'

export default function Cabecera() {
  const c = useContenido()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  const menu = PAGINAS.filter(p => p.visible(c) && !p.soloPie)

  useEffect(() => { setAbierto(false) }, [pathname])
  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [abierto])

  return (
    <>
      <AvisoDestacado />
      <header className="cabecera">
        <div className="contenedor cabecera__in">
          <Link to="/" className="marca" aria-label={`${c.grupo.nombre}, ir al inicio`}>
            {urlSegura(c.apariencia.logo) && <img src={urlSegura(c.apariencia.logo)!} alt="" width={36} height={36} />}
            <span>{c.grupo.nombreCorto || c.grupo.nombre}</span>
          </Link>
          <button
            type="button" className="boton boton--sec boton--peq menu__boton"
            aria-expanded={abierto} aria-controls="menu-principal" onClick={() => setAbierto(a => !a)}
          >
            {abierto ? 'Cerrar' : 'Menú'}
          </button>
          <nav aria-label="Navegación principal">
            <ul id="menu-principal" className={`menu${abierto ? ' menu--abierto' : ''}`}>
              {menu.map(p => (
                <li key={p.ruta}>
                  <Link to={p.ruta} aria-current={pathname === p.ruta ? 'page' : undefined}>{p.menu}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  )
}

function AvisoDestacado() {
  const c = useContenido()
  const [cerrado, setCerrado] = useState(false)
  if (cerrado || !avisoVigente(c)) return null
  const enlace = urlSegura(c.aviso.enlace)
  return (
    <div className="aviso-destacado" role="region" aria-label="Aviso">
      <div className="contenedor">
        <span>{enLinea(c.aviso.texto)}</span>
        {enlace && (
          <a href={enlace} {...(!enlace.startsWith('/') && { target: '_blank', rel: 'noopener noreferrer' })}>
            {c.aviso.textoEnlace || 'Más información'} →
          </a>
        )}
        <button type="button" onClick={() => setCerrado(true)} aria-label="Cerrar aviso">✕</button>
      </div>
    </div>
  )
}
