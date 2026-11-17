/** Aviso para quien acaba de descargar la plantilla y aún no ha conectado Firebase. */
export default function SinConfigurar({ que }: { que: string }) {
  return (
    <div className="mensaje mensaje--info" role="status">
      <p><strong>{que} todavía no está conectado a Firebase.</strong></p>
      <p>Ejecuta <code>npm run configurar</code> y sigue la guía de instalación (README.md).</p>
    </div>
  )
}
