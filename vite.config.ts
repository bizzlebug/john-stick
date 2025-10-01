import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths for assets in the build, so it works when hosted in any directory.
  base: './',
  build: {
    // Output the build files to a 'dist' directory.
    outDir: 'dist',
  }
})
