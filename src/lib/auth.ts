// Autenticación del Kraal (Firebase Authentication, cuenta de Google).
// Va en un fichero aparte para que solo se descargue al entrar en /kraal.
import { getAuth } from 'firebase/auth'
import { app } from './firebase.ts'

export const auth = getAuth(app)
