import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // camera access needs a secure context, so phones on the lan have to
    // reach the dev server over https or through a tunnel
    host: true,
  },
})
