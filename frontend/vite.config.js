import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  // Source maps загружаются в Sentry только при наличии токена (в CI); в бандл ссылка на них не попадает.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

  return {
    plugins: [
      react(),
      uploadSourceMaps && sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        url: env.SENTRY_URL || undefined,
        release: { name: env.VITE_RELEASE || undefined },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
    ].filter(Boolean),
    build: {
      sourcemap: 'hidden',
    },
    server: {
      port: 5173,
    },
    test: {
      environment: 'node',
    },
  };
});
