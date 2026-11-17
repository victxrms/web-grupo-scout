import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { urlSegura, useContenido } from '../lib/contenido.ts'

export default function Documentos() {
  const c = useContenido()
  return (
    <Pagina ruta="/documentos" titulo="Documentos" entradilla="Documentación para las familias del grupo.">
      {c.documentos.length === 0 ? (
        <p className="suave">Todavía no hay documentos.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {c.documentos.map((d, i) => {
            const url = urlSegura(d.url)
            return (
              <article key={i} className="tarjeta" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <h2 style={{ fontSize: '1.1rem' }}>{d.titulo}</h2>
                  {d.descripcion && <Texto className="suave">{d.descripcion}</Texto>}
                  {d.nota && <p className="nota">⚠ {d.nota}</p>}
                </div>
                {url && (
                  <a className="boton boton--sec" href={url} target="_blank" rel="noopener noreferrer">
                    Abrir<span className="sr-only"> {d.titulo}</span>
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </Pagina>
  )
}
