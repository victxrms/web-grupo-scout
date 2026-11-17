import type { ReactNode } from 'react'
import Seo from './Seo.tsx'
import NoEncontrada from '../pages/NoEncontrada.tsx'
import { useContenido } from '../lib/contenido.ts'
import { PAGINAS } from '../lib/paginas.ts'

/**
 * Estructura de una página pública: título, entradilla y contenido.
 * Si la página está desactivada en el editor, se enseña «no encontrada».
 */
export default function Pagina({ ruta, titulo, entradilla, children }: {
  ruta: string
  titulo: string
  entradilla?: ReactNode
  children: ReactNode
}) {
  const c = useContenido()
  const pagina = PAGINAS.find(p => p.ruta === ruta)
  if (pagina && !pagina.visible(c)) return <NoEncontrada />
  return (
    <section className="pagina">
      <Seo ruta={ruta} />
      <div className="contenedor">
        <h1>{titulo}</h1>
        {entradilla && <div className="entradilla">{entradilla}</div>}
        {children}
      </div>
    </section>
  )
}
