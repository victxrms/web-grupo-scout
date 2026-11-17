import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { useContenido } from '../lib/contenido.ts'

export default function Equipo() {
  const c = useContenido()
  return (
    <Pagina ruta="/equipo" titulo="Kraal" entradilla={<Texto>{c.equipo.intro}</Texto>}>
      {c.equipo.personas.length > 0 && (
        <div className="rejilla">
          {c.equipo.personas.map((p, i) => (
            <article key={i} className="tarjeta">
              <h2 style={{ fontSize: '1.1rem' }}>{p.nombre}</h2>
              {p.cargo && <p className="suave">{p.cargo}</p>}
            </article>
          ))}
        </div>
      )}
    </Pagina>
  )
}
