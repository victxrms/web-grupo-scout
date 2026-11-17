import { Routes, Route } from 'react-router-dom'
import { Component, Suspense, type ReactNode } from 'react'
import Cabecera from './components/Cabecera.tsx'
import Pie from './components/Pie.tsx'
import IrArriba from './components/IrArriba.tsx'
import { ContextoContenido, colorValido, type Contenido } from './lib/contenido.ts'

export interface RouteDef {
  path: string
  element: ReactNode
}

/**
 * Estructura común de todas las páginas (cabecera, contenido, pie).
 * La usan el navegador (src/App.tsx) y el prerenderizado (src/entry-server.tsx).
 */
export default function AppShell({ routes, contenido }: { routes: RouteDef[]; contenido: Contenido }) {
  return (
    <ContextoContenido.Provider value={contenido}>
      {/* El color principal elegido en el editor */}
      <style>{`:root{--primario:${colorValido(contenido.apariencia.colorPrincipal)}}`}</style>
      <IrArriba />
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <Cabecera />
      <main id="contenido" tabIndex={-1} style={{ outline: 'none' }}>
        <ErrorDePagina>
          <Suspense fallback={null}>
            <Routes>
              {routes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
            </Routes>
          </Suspense>
        </ErrorDePagina>
      </main>
      <Pie />
    </ContextoContenido.Provider>
  )
}

// Si algo falla al pintar una página (o no se puede descargar), mensaje
// claro en vez de pantalla en blanco.
class ErrorDePagina extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  componentDidCatch(e: unknown) { console.error(e) }
  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <section className="pagina">
        <div className="contenedor">
          <p className="mensaje mensaje--error" role="alert">
            No se ha podido cargar la página.{' '}
            <button type="button" className="boton boton--sec boton--peq" onClick={() => window.location.reload()}>Recargar</button>
          </p>
        </div>
      </section>
    )
  }
}
