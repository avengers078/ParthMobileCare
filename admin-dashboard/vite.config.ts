import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Parth Mobile Care Admin Dashboard - Vite Configuration (Dark Navy Mode Enabled)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
});

