import { BrowserRouter } from 'react-router-dom'
import { lazy, useCallback, useEffect, useState } from 'react'
import AppShell, { type RouteDef } from './AppShell.tsx'
import { CONTENIDO_INICIAL, leerContenidoPublicado, leerJson, type Contenido } from './lib/contenido.ts'
import { ContextoActualizarContenido } from './lib/contenido-editor.ts'
import { firebaseConfigurado } from './lib/configurado.ts'
import SinConfigurar from './components/SinConfigurar.tsx'

const Inicio = lazy(() => import('./pages/Inicio.tsx'))
const Unete = lazy(() => import('./pages/Unete.tsx'))
const Secciones = lazy(() => import('./pages/Secciones.tsx'))
const Galeria = lazy(() => import('./pages/Galeria.tsx'))
const Documentos = lazy(() => import('./pages/Documentos.tsx'))
const Lugares = lazy(() => import('./pages/Lugares.tsx'))
const Herramientas = lazy(() => import('./pages/Herramientas.tsx'))
const Equipo = lazy(() => import('./pages/Equipo.tsx'))
const Patrullometro = lazy(() => import('./pages/Patrullometro.tsx'))
const Kraal = lazy(() => import('./kraal/Kraal.tsx'))
const NoEncontrada = lazy(() => import('./pages/NoEncontrada.tsx'))

// Si añades una página pública, añádela también en src/lib/paginas.ts
// y en src/entry-server.tsx (para que se prerenderice).
const routes: RouteDef[] = [
  { path: '/', element: <Inicio /> },
  { path: '/unete', element: <Unete /> },
  { path: '/secciones', element: <Secciones /> },
  { path: '/galeria', element: <Galeria /> },
  { path: '/documentos', element: <Documentos /> },
  { path: '/lugares', element: <Lugares /> },
  { path: '/herramientas', element: <Herramientas /> },
  { path: '/equipo', element: <Equipo /> },
  { path: '/patrullometro', element: <Patrullometro /> },
  {
    path: '/kraal/*',
    element: firebaseConfigurado
      ? <Kraal />
      : <section className="pagina"><div className="contenedor"><h1>Kraal</h1><SinConfigurar que="El Kraal" /></div></section>,
  },
  { path: '*', element: <NoEncontrada /> },
]

/** Contenido con el que se generó esta página (lo mete scripts/prerender.mjs). */
function contenidoDelHtml(): Contenido {
  return leerJson(document.getElementById('contenido-inicial')?.textContent) ?? CONTENIDO_INICIAL
}

export default function App() {
  const [contenido, setContenido] = useState(contenidoDelHtml)

  // Lo último publicado desde el editor (puede ser más nuevo que el HTML).
  useEffect(() => {
    leerContenidoPublicado(import.meta.env.VITE_FIREBASE_PROJECT_ID, import.meta.env.VITE_FIREBASE_API_KEY)
      .then(c => { if (c) setContenido(c) })
      .catch(e => console.warn('No se ha podido leer el contenido publicado:', e))
  }, [])

  const actualizar = useCallback((c: Contenido) => setContenido(c), [])

  return (
    <BrowserRouter>
      <ContextoActualizarContenido.Provider value={actualizar}>
        <AppShell routes={routes} contenido={contenido} />
      </ContextoActualizarContenido.Provider>
    </BrowserRouter>
  )
}
