/** ¿Se ha configurado Firebase? (`npm run configurar` crea el archivo .env) */
export const firebaseConfigurado = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)
