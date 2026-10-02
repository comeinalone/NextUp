<<<<<<< HEAD
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
=======
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
>>>>>>> origin/control

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
<<<<<<< HEAD
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
=======
      '/api': 'http://localhost:4000',
>>>>>>> origin/control
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});