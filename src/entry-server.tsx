// Punto de entrada del prerenderizado (solo se usa en `npm run build`).
// Genera el HTML de cada página pública para que buscadores y redes sociales
// vean el contenido sin ejecutar JavaScript.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import AppShell, { type RouteDef } from './AppShell.tsx'
import { completar, CONTENIDO_INICIAL } from './lib/contenido.ts'
import Inicio from './pages/Inicio.tsx'
import Unete from './pages/Unete.tsx'
import Secciones from './pages/Secciones.tsx'
import Galeria from './pages/Galeria.tsx'
import Documentos from './pages/Documentos.tsx'
import Lugares from './pages/Lugares.tsx'
import Herramientas from './pages/Herramientas.tsx'
import Equipo from './pages/Equipo.tsx'
import NoEncontrada from './pages/NoEncontrada.tsx'

// Patrullómetro y Kraal dependen de datos en vivo: solo cabecera y pie.
const routes: RouteDef[] = [
  { path: '/', element: <Inicio /> },
  { path: '/unete', element: <Unete /> },
  { path: '/secciones', element: <Secciones /> },
  { path: '/galeria', element: <Galeria /> },
  { path: '/documentos', element: <Documentos /> },
  { path: '/lugares', element: <Lugares /> },
  { path: '/herramientas', element: <Herramientas /> },
  { path: '/equipo', element: <Equipo /> },
  { path: '/patrullometro', element: null },
  { path: '/kraal/*', element: null },
  { path: '*', element: <NoEncontrada /> },
]

export { PAGINAS, PAGINAS_PRIVADAS } from './lib/paginas.ts'
export { completar, CONTENIDO_INICIAL }

export function render(url: string, contenido: unknown): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppShell routes={routes} contenido={completar(contenido, CONTENIDO_INICIAL)} />
    </StaticRouter>,
  )
}
