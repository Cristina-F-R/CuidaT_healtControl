import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import type { AppConfig } from '../../config/env.js';

// ADR-012: health data is special-category data (GDPR Art. 9). Database driver messages can contain
// the failing row (for example the notes of a log), so exception values are dropped before sending.
let enabled = false;

export function scrubServerEvent(event: ErrorEvent): ErrorEvent {
  event.request = undefined;
  event.extra = undefined;
  event.breadcrumbs = undefined;
  event.message = undefined;
  event.user = undefined;
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({ ...value, value: undefined }));
  }
  return event;
}

export function initErrorReporting(config: AppConfig): void {
  if (!config.sentryDsn) {
    return;
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0.1,
    beforeSend: scrubServerEvent,
    beforeSendTransaction(transaction) {
      transaction.request = undefined;
      transaction.user = undefined;
      transaction.extra = undefined;
      return transaction;
    },
  });
  enabled = true;
}

export function reportUnexpectedError(error: unknown): void {
  if (enabled) {
    Sentry.captureException(error);
  }
}
