import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist/preload',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    lib: { entry: 'src/preload/index.ts', formats: ['cjs'], fileName: () => 'preload.cjs' },
    rollupOptions: { external: ['electron', /^node:/] },
  },
});
