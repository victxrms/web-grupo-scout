// Texto escrito en el editor, con un formato mínimo y seguro:
//   - una línea en blanco separa párrafos
//   - **negrita**
//   - [texto del enlace](https://...)
// No se interpreta HTML: lo que se escriba se enseña tal cual.
import { Fragment, type ReactNode } from 'react'
import { urlSegura } from '../lib/contenido.ts'

const PATRON = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

export function enLinea(texto: string): ReactNode[] {
  const partes: ReactNode[] = []
  let ultimo = 0
  for (const m of texto.matchAll(PATRON)) {
    if (m.index! > ultimo) partes.push(texto.slice(ultimo, m.index))
    if (m[1] !== undefined) {
      partes.push(<strong key={m.index}>{m[1]}</strong>)
    } else {
      const url = urlSegura(m[3])
      const externo = url !== null && !url.startsWith('/')
      partes.push(url
        ? <a key={m.index} href={url} {...(externo && { target: '_blank', rel: 'noopener noreferrer' })}>{m[2]}</a>
        : m[0])
    }
    ultimo = m.index! + m[0].length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

export default function Texto({ children, className }: { children: string; className?: string }) {
  const parrafos = children.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <div className={['texto', className].filter(Boolean).join(' ')}>
      {parrafos.map((p, i) => (
        <p key={i}>{p.split('\n').map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(l)}</Fragment>)}</p>
      ))}
    </div>
  )
}
