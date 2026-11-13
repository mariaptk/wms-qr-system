import * as Sentry from '@sentry/react';
import { API_URL } from './api.js';

export const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    tracePropagationTargets: [API_URL],
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      // Адреса запросов к API оставляем, тела и заголовки в хлебные крошки не попадают.
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        delete breadcrumb.data?.request_body;
        delete breadcrumb.data?.response_body;
      }
      return breadcrumb;
    },
  });
}

export function setSentryUser(user) {
  if (!sentryEnabled) return;
  Sentry.setUser(user ? { id: user.id, role: user.role } : null);
}

export { Sentry };
