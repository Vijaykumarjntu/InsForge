import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tailwindcss from '@tailwindcss/vite';

const dashboardSrcPath = path.resolve(__dirname, 'src');

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      '#app': path.resolve(dashboardSrcPath, 'app'),
      '#assets': path.resolve(dashboardSrcPath, 'assets'),
      '#components': path.resolve(dashboardSrcPath, 'components'),
      '#features': path.resolve(dashboardSrcPath, 'features'),
      '#layout': path.resolve(dashboardSrcPath, 'layout'),
      '#lib': path.resolve(dashboardSrcPath, 'lib'),
      '#navigation': path.resolve(dashboardSrcPath, 'navigation'),
      '#router': path.resolve(dashboardSrcPath, 'router'),
      '#types': path.resolve(dashboardSrcPath, 'types'),
      '@insforge/shared-schemas': path.resolve(__dirname, '../shared-schemas/src'),
      '@insforge/ui': path.resolve(__dirname, '../ui/src'),
    },
  },
  build: {
    // lib: {
    //   entry: path.resolve(__dirname, 'src/index.ts'),
    //   formats: ['es'],
    //   fileName: () => 'index.js',
    // },
    // cssCodeSplit: false,
    // rollupOptions: {
    //   external: ['react', 'react-dom'],
    //   output: {
    //     assetFileNames: (assetInfo) =>
    //       assetInfo.name?.endsWith('.css') ? 'styles.css' : 'assets/[name]-[hash][extname]',
    //   },
    // },
    // lib: {
    //   entry: path.resolve(__dirname, 'src/index.ts'),
    //   formats: ['es'],
    // },
    // cssCodeSplit: true, // Allow features to split their own CSS chunks
    // rollupOptions: {
    //   external: ['react', 'react-dom'],
    //   output: {
    //     // This preserves the internal directory structure in the dist folder
    //     preserveModules: true,
    //     preserveModulesRoot: 'src',
    //     entryFileNames: '[name].js',
    //     assetFileNames: 'assets/[name]-[hash][extname]',
    //   },
    // },
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    cssCodeSplit: true,
    rollupOptions: {
      // Pinpoint and externalize all third-party and workspace monorepo modules
      external: (id) => 
        /node_modules/.test(id) || 
        id.startsWith('@insforge/') || 
        id.startsWith('react') || 
        id.startsWith('lucide-react'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
