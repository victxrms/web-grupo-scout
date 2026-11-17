import { Link } from 'react-router-dom'
import Pagina from '../components/Pagina.tsx'
import Texto from '../components/Texto.tsx'
import { enlaceCorreo, enlaceWhatsapp, urlSegura, useContenido } from '../lib/contenido.ts'

export default function Unete() {
  const c = useContenido()
  const g = c.grupo
  const waApuntarse = enlaceWhatsapp(c, `¡Hola! Me gustaría apuntar a mi peque al ${g.nombre}.`)
  const waVoluntaria = enlaceWhatsapp(c, `¡Hola! Me gustaría colaborar como voluntaria en el ${g.nombre}.`)
  const ficha = urlSegura(g.fichaInscripcionUrl)
  const maps = urlSegura(g.mapsUrl)

  return (
    <Pagina ruta="/unete" titulo={`Únete al ${g.nombre}`} entradilla={<Texto>{c.unete.intro}</Texto>}>
      <div className="botones">
        {waApuntarse && <a className="boton" href={waApuntarse} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
        {g.email && <a className={waApuntarse ? 'boton boton--sec' : 'boton'} href={enlaceCorreo(c, 'Quiero apuntar a mi peque al grupo')}>Enviar un correo</a>}
        {ficha && <a className="boton boton--sec" href={ficha} target="_blank" rel="noopener noreferrer">Ficha de inscripción</a>}
      </div>
      {waApuntarse && g.soloWhatsapp && <p className="suave">El teléfono {g.telefono} solo atiende mensajes de WhatsApp, no llamadas.</p>}

      {c.unete.pasos.length > 0 && (
        <>
          <h2>Cómo apuntarse</h2>
          <ol className="pasos">
            {c.unete.pasos.map((p, i) => (
              <li key={i} className="tarjeta" style={{ marginTop: 0 }}>
                <div>
                  <h3><span className="sr-only">Paso {i + 1}: </span>{p.titulo}</h3>
                  <Texto>{p.texto}</Texto>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {c.secciones.length > 0 && (
        <>
          <h2>¿En qué sección entraría?</h2>
          <div className="tarjeta">
            <ul className="filas">
              {c.secciones.map(s => (
                <li key={s.id}>
                  <strong style={{ minWidth: '8.5rem' }}>{s.edades}</strong>
                  <span><Link to={`/secciones#${s.id}`}>{s.nombre}</Link>{s.rama && <span className="suave"> · {s.rama}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
          {c.unete.notaEdades && <p className="suave">{c.unete.notaEdades}</p>}
        </>
      )}

      {(g.sede || g.direccion) && (
        <>
          <h2>Dónde estamos</h2>
          <div className="tarjeta">
            <p>
              {g.sede && <strong>{g.sede}</strong>}
              {g.sede && g.direccion && ': '}
              {[g.direccion, [g.codigoPostal, g.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
              {g.provincia && ` (${g.provincia})`}
            </p>
            {maps && <a className="boton boton--sec" href={maps} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
          </div>
        </>
      )}

      {c.unete.voluntariado && (
        <>
          <h2>¿Quieres ser voluntaria?</h2>
          <div className="tarjeta">
            <Texto>{c.unete.voluntariado}</Texto>
            <div className="botones">
              {g.email && <a className="boton boton--sec" href={enlaceCorreo(c, 'Quiero colaborar como voluntaria')}>Enviar un correo</a>}
              {waVoluntaria && <a className="boton boton--sec" href={waVoluntaria} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
            </div>
          </div>
        </>
      )}
    </Pagina>
  )
}
