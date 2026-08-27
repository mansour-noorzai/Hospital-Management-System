import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4451', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:4451', ws: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
          if (id.includes('@fortawesome')) return 'icons-vendor';
          if (id.includes('@tanstack') || id.includes('@reduxjs') || id.includes('react-redux')) return 'data-vendor';
          if (id.includes('react-dom') || id.includes('react-router') || /node_modules\/react\//.test(id)) return 'react-vendor';
          return undefined;
        },
      },
    },
  }
})
