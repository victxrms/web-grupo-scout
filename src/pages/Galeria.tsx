import { useState } from 'react'
import Pagina from '../components/Pagina.tsx'
import { urlSegura, useContenido } from '../lib/contenido.ts'

const TANDA = 30

export default function Galeria() {
  const c = useContenido()
  const fotos = c.galeria.map(urlSegura).filter((u): u is string => u !== null)
  const [vistas, setVistas] = useState(TANDA)

  return (
    <Pagina ruta="/galeria" titulo="Galería" entradilla={`Momentos del ${c.grupo.nombre}.`}>
      {fotos.length === 0 ? (
        <p className="suave">Todavía no hay fotos.</p>
      ) : (
        <>
          <div className="galeria">
            {fotos.slice(0, vistas).map(f => <img key={f} src={f} alt="" loading="lazy" />)}
          </div>
          {vistas < fotos.length && (
            <p style={{ textAlign: 'center' }}>
              <button type="button" className="boton boton--sec" onClick={() => setVistas(v => v + TANDA)}>
                Ver más fotos ({fotos.length - vistas} más)
              </button>
            </p>
          )}
        </>
      )}
    </Pagina>
  )
}
