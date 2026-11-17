import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.tsx'
import Texto from '../components/Texto.tsx'
import { urlSegura, useContenido } from '../lib/contenido.ts'
import { PAGINAS } from '../lib/paginas.ts'

const ACCESOS: Record<string, { emoji: string; texto: string }> = {
  '/secciones': { emoji: '🏕️', texto: 'Qué hace cada sección según la edad.' },
  '/unete': { emoji: '✋', texto: 'Cómo apuntarse y venir a probar.' },
  '/galeria': { emoji: '📷', texto: 'Fotos de actividades y acampadas.' },
  '/documentos': { emoji: '📄', texto: 'Autorizaciones, fichas y documentación.' },
  '/patrullometro': { emoji: '🏆', texto: 'Clasificación de las patrullas.' },
  '/lugares': { emoji: '🗺️', texto: 'Mapa de lugares de acampada.' },
  '/herramientas': { emoji: '🎒', texto: 'Guías para preparar cada salida.' },
  '/equipo': { emoji: '🤝', texto: 'El equipo de scouters.' },
}

export default function Inicio() {
  const c = useContenido()
  // Una foto de portada al azar entre las elegidas en el editor.
  const fotos = c.apariencia.fotosPortada.map(urlSegura).filter((u): u is string => u !== null)
  const [indice] = useState(() => Math.floor(Math.random() * Math.max(fotos.length, 1)))
  const foto = fotos[indice] ?? fotos[0]
  const logo = urlSegura(c.apariencia.logo)
  const accesos = PAGINAS.filter(p => p.visible(c) && ACCESOS[p.ruta])

  return (
    <>
      <Seo ruta="/" />
      <section className="portada">
        {foto && <img className="portada__foto" src={foto} alt="" {...{ fetchpriority: 'high' }} />}
        <div className="portada__velo" />
        <div className="contenedor">
          {logo && <img className="portada__logo" src={logo} alt="" width={72} height={72} />}
          {c.grupo.lema && <p style={{ fontWeight: 600 }}>{c.grupo.lema}</p>}
          <h1>{c.grupo.nombre}{c.grupo.ciudad && <> · {c.grupo.ciudad}</>}</h1>
          <div className="botones">
            <Link to="/unete" className="boton" style={{ background: '#fff', color: '#1c1c1a', borderColor: '#fff' }}>Quiero apuntarme</Link>
            <Link to="/secciones" className="boton boton--sec">Conoce las secciones</Link>
          </div>
        </div>
      </section>

      <section className="pagina">
        <div className="contenedor">
          <h2>{c.inicio.titulo}</h2>
          <Texto className="entradilla">{c.inicio.presentacion}</Texto>
          <h2 className="sr-only">Explora la web</h2>
          <div className="rejilla">
            {accesos.map(p => (
              <Link key={p.ruta} to={p.ruta} className="tarjeta">
                <span className="emoji" aria-hidden="true">{ACCESOS[p.ruta].emoji}</span>
                <h3>{p.menu}</h3>
                <p className="suave">{ACCESOS[p.ruta].texto}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
