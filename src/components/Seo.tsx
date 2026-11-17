import { useEffect } from 'react'
import { useContenido } from '../lib/contenido.ts'
import { PAGINAS, PAGINAS_PRIVADAS } from '../lib/paginas.ts'

/**
 * Título y descripción de la página actual al navegar dentro de la web.
 * El HTML inicial de cada página ya los trae (scripts/prerender.mjs).
 */
export default function Seo({ ruta }: { ruta: string }) {
  const c = useContenido()
  useEffect(() => {
    const p = PAGINAS.find(x => x.ruta === ruta)
    const privada = PAGINAS_PRIVADAS.find(x => x.ruta === ruta)
    if (p) {
      document.title = p.titulo(c)
      document.querySelector('meta[name="description"]')?.setAttribute('content', p.descripcion(c))
    } else if (privada) {
      document.title = privada.titulo(c)
    }
  }, [ruta, c])
  return null
}
