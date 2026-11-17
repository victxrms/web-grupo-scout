import { Link } from 'react-router-dom'
import Seo from '../components/Seo.tsx'

export default function NoEncontrada() {
  return (
    <section className="pagina">
      <Seo ruta="/404" />
      <div className="contenedor">
        <h1>Página no encontrada</h1>
        <p className="entradilla">La página que buscas no existe o se ha movido.</p>
        <p><Link to="/" className="boton">Ir al inicio</Link></p>
      </div>
    </section>
  )
}
