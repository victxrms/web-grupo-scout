import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { useContenido } from '../lib/contenido.ts'

/** Solo se insertan mapas de Google My Maps / Google Maps (https). */
export function mapaInsertable(url: string): string | null {
  const u = url.trim()
  return /^https:\/\/(www\.)?google\.[a-z.]+\/maps\//.test(u) ? u : null
}

export default function Lugares() {
  const c = useContenido()
  const mapa = mapaInsertable(c.lugares.mapaUrl)
  return (
    <Pagina ruta="/lugares" titulo="Lugares de acampada" entradilla={<Texto>{c.lugares.texto}</Texto>}>
      {mapa
        ? <iframe className="mapa" src={mapa} title={`Mapa de lugares de acampada del ${c.grupo.nombre}`} loading="lazy" />
        : <p className="suave">Todavía no hay mapa.</p>}
    </Pagina>
  )
}
