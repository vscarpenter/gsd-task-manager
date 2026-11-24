import { describe, expect, it } from 'vitest';
import { redactPocketBaseHost } from '../../api/client.js';

describe('redactPocketBaseHost', () => {
  it('redacts the hostname from an https URL', () => {
    expect(redactPocketBaseHost('https://api.vinny.io')).toBe(
      'https://[pocketbase-host]'
    );
  });

  it('redacts the hostname and port from an http URL', () => {
    expect(redactPocketBaseHost('http://localhost:8090')).toBe(
      'http://[pocketbase-host]'
    );
  });

  it('returns a stable placeholder if the URL is unparseable', () => {
    expect(redactPocketBaseHost('not a url')).toBe('[pocketbase-host]');
  });
});
