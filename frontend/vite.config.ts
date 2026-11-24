import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' || /annotation that Rollup cannot interpret/.test(warning.message)) return
        warn(warning)
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          web3: ['wagmi', 'viem', '@tanstack/react-query'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
