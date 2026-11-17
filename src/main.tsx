import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos.css'
import App from './App.tsx'

// El HTML llega prerenderizado (scripts/prerender.mjs) para buscadores y para
// que se vea contenido antes de cargar el JavaScript; aquí React lo sustituye
// por la aplicación interactiva.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
