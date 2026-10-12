import * as Sentry from '@sentry/vue';
import type { Breadcrumb, ErrorEvent } from '@sentry/vue';
import type { App } from 'vue';

// ADR-012: health data is special-category data (GDPR Art. 9), so nothing user-entered may reach Sentry.
let enabled = false;

function stripQuery(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = { url: stripQuery(event.request.url), method: event.request.method };
  }
  event.user = event.user?.id ? { id: event.user.id } : undefined;
  event.extra = undefined;
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output and UI breadcrumbs go out: UI breadcrumbs describe clicked elements by their
  // aria-label, which holds item names, times and dates (ADR-012, OWASP A09).
  if (breadcrumb.category === 'console' || breadcrumb.category?.startsWith('ui')) {
    return null;
  }
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr' || breadcrumb.category === 'navigation') {
    const data = breadcrumb.data ?? {};
    return {
      ...breadcrumb,
      data: {
        method: data['method'],
        status_code: data['status_code'],
        url: typeof data['url'] === 'string' ? stripQuery(data['url']) : undefined,
        to: typeof data['to'] === 'string' ? stripQuery(data['to']) : undefined,
        from: typeof data['from'] === 'string' ? stripQuery(data['from']) : undefined,
      },
    };
  }
  return breadcrumb;
}

export function initSentry(app: App): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    app,
    dsn,
    // Errors are reported explicitly from app.config.errorHandler (main.ts).
    attachErrorHandler: false,
    // Sentry 11 replaced `sendDefaultPii` with granular switches: collect nothing user-related.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  enabled = true;
}

export function reportError(error: unknown): void {
  if (enabled) {
    Sentry.captureException(error);
  }
}
