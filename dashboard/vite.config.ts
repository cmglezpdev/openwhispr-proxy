import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, repositoryRoot, 'PORT');
  return {
    base: '/dashboard/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dashboard-trailing-slash',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const url = new URL(request.url ?? '/', 'http://localhost');
            if (url.pathname === '/dashboard') {
              response.writeHead(307, {
                Location: `/dashboard/${url.search}`,
              });
              response.end();
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      proxy: {
        '/dashboard/api': {
          target: `http://127.0.0.1:${process.env.PORT || env.PORT || '8080'}`,
        },
      },
    },
  };
});
