import { createContext, useContext } from 'react'
import type { Contenido } from './contenido.ts'

/** El editor lo usa para que la web muestre al momento lo que se acaba de guardar. */
export const ContextoActualizarContenido = createContext<(c: Contenido) => void>(() => {})

export const useActualizarContenido = () => useContext(ContextoActualizarContenido)
