import { Link } from 'react-router-dom'
import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { useContenido } from '../lib/contenido.ts'

export default function Secciones() {
  const c = useContenido()
  return (
    <Pagina ruta="/secciones" titulo="Secciones" entradilla="Cada sección agrupa a las educandas por edades, con actividades pensadas para su etapa.">
      <div style={{ display: 'grid', gap: '1rem' }}>
        {c.secciones.map(s => (
          <article key={s.id} id={s.id} className="tarjeta" style={{ scrollMarginTop: '80px' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {s.emoji && <span className="emoji" aria-hidden="true">{s.emoji}</span>}
              <div>
                <h2>{s.nombre}</h2>
                <p className="suave">{[s.rama, s.edades].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <Texto>{s.texto}</Texto>
          </article>
        ))}
      </div>
      <p><Link to="/unete" className="boton">Cómo apuntarse</Link></p>
    </Pagina>
  )
}
