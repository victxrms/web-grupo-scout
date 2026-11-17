import { Link } from 'react-router-dom'
import { enlaceCorreo, enlaceWhatsapp, urlSegura, useContenido } from '../lib/contenido.ts'
import { PAGINAS } from '../lib/paginas.ts'

const REDES = [
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
] as const

export default function Pie() {
  const c = useContenido()
  const g = c.grupo
  const wa = enlaceWhatsapp(c, `¡Hola! Quería información sobre el ${g.nombre}.`)
  const redes = REDES.filter(([k]) => urlSegura(g.redes[k]))
  const federacion = g.federacion.filter(f => f.nombre)

  return (
    <footer className="pie">
      <div className="contenedor">
        <nav aria-label="Mapa del sitio">
          <ul>
            {PAGINAS.filter(p => p.visible(c)).map(p => <li key={p.ruta}><Link to={p.ruta}>{p.menu}</Link></li>)}
            <li><Link to="/kraal">Acceso scouters</Link></li>
          </ul>
        </nav>
        <address style={{ fontStyle: 'normal' }}>
          {(g.sede || g.direccion) && (
            <p>{[g.sede, [g.direccion, [g.codigoPostal, g.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
          )}
          <p>
            {g.email && <a href={enlaceCorreo(c, 'Información sobre el grupo')}>{g.email}</a>}
            {g.email && wa && ' · '}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp {g.telefono}</a>}
          </p>
        </address>
        {redes.length > 0 && (
          <ul aria-label="Redes sociales">
            {redes.map(([k, nombre]) => (
              <li key={k}><a href={urlSegura(g.redes[k])!} target="_blank" rel="noopener noreferrer">{nombre}</a></li>
            ))}
          </ul>
        )}
        <p>
          © {new Date().getFullYear()} {g.nombre}
          {federacion.length > 0 && <> · Miembro de {federacion.map((f, i) => (
            <span key={f.nombre}>
              {i > 0 && ' y '}
              {urlSegura(f.url) ? <a href={urlSegura(f.url)!} target="_blank" rel="noopener noreferrer">{f.nombre}</a> : f.nombre}
            </span>
          ))}</>}
        </p>
      </div>
    </footer>
  )
}
