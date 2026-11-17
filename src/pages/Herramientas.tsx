import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { urlSegura, useContenido } from '../lib/contenido.ts'

export default function Herramientas() {
  const c = useContenido()
  return (
    <Pagina ruta="/herramientas" titulo="Herramientas" entradilla="Guías prácticas para preparar cada salida.">
      {c.herramientas.length === 0 ? (
        <p className="suave">Todavía no hay guías.</p>
      ) : (
        <div className="rejilla">
          {c.herramientas.map((h, i) => {
            const url = urlSegura(h.url)
            return (
              <article key={i} className="tarjeta">
                {h.emoji && <span className="emoji" aria-hidden="true">{h.emoji}</span>}
                <h2 style={{ fontSize: '1.1rem' }}>{h.titulo}</h2>
                <Texto className="suave">{h.texto}</Texto>
                {url && <a href={url} target="_blank" rel="noopener noreferrer">Abrir la guía<span className="sr-only"> {h.titulo}</span> →</a>}
              </article>
            )
          })}
        </div>
      )}
    </Pagina>
  )
}
