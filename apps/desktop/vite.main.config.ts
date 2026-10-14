import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist/main',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    lib: { entry: 'src/main/index.ts', formats: ['es'], fileName: 'main' },
    rollupOptions: { external: ['electron', /^node:/] },
  },
});
