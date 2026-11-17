import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    // La librería de Firebase pesa, pero solo se descarga en el Kraal.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // En el build del prerenderizado (SSR) las dependencias son externas
      // y no se pueden agrupar en chunks.
      output: isSsrBuild
        ? {}
        : {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-firebase': ['firebase/app', 'firebase/firestore'],
            },
          },
    },
  },
}))
