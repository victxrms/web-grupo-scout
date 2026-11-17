import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)

// Sin clave de reCAPTCHA, App Check nunca da token y Firebase Auth se queda
// esperándolo (la ventana de Google no llega a abrirse). Mejor no iniciarlo.
const claveRecaptcha = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (claveRecaptcha) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(claveRecaptcha),
    isTokenAutoRefreshEnabled: true,
  })
} else {
  console.warn('App Check desactivado: falta VITE_RECAPTCHA_SITE_KEY.')
}

// Copia local en el dispositivo (IndexedDB): las páginas muestran al momento lo
// último descargado mientras llega lo nuevo. Si el navegador no la permite
// (p. ej. modo privado), Firestore sigue funcionando solo en memoria.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
