import type { Breadcrumb, ErrorEvent } from '@sentry/vue';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent } from './sentry';

describe('Sentry privacy filters (ADR-012)', () => {
  it('drops console and UI breadcrumbs, which can carry item names from aria-labels', () => {
    const click: Breadcrumb = { category: 'ui.click', message: 'button[aria-label="Editar Vómito a las 09:00"]' };
    expect(scrubBreadcrumb(click)).toBeNull();
    expect(scrubBreadcrumb({ category: 'console', message: 'registro' })).toBeNull();
  });

  it('keeps navigation breadcrumbs without query strings', () => {
    const navigation: Breadcrumb = { category: 'navigation', data: { from: '/a?x=1', to: '/b?nota=dolor' } };
    expect(scrubBreadcrumb(navigation)?.data).toMatchObject({ from: '/a', to: '/b' });
  });

  it('removes request bodies, extra data and every user field except the opaque id', () => {
    const event = {
      request: { url: 'https://app.test/api/x?q=1', method: 'PUT', data: '{"notes":"dolor"}' },
      user: { id: 'uuid-1', email: 'a@b.test' },
      extra: { note: 'dolor' },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);
    expect(scrubbed.request).toEqual({ url: 'https://app.test/api/x', method: 'PUT' });
    expect(scrubbed.user).toEqual({ id: 'uuid-1' });
    expect(scrubbed.extra).toBeUndefined();
  });
});
