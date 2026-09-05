import { describe, expect, it } from 'vitest';
import type { WebViewConfig } from '../types';
import { PROFILE_MODES, resolveActiveSource } from './streamProfile';

function baseConfig(overrides: Partial<WebViewConfig> = {}): WebViewConfig {
  return {
    mode: 'rtsp',
    url: 'rtsp://fallback.example.com/stream',
    basicAuthUser: undefined,
    basicAuthPass: undefined,
    rtspTransport: 'tcp',
    ...overrides,
  };
}

describe('resolveActiveSource', () => {
  it('falls back to cfg.url + cfg.rtspTransport when profiles is absent', () => {
    const cfg = baseConfig();
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://fallback.example.com/stream',
      transport: 'tcp',
    });
  });

  it('falls back to cfg.url + cfg.rtspTransport when profiles is empty', () => {
    const cfg = baseConfig({ profiles: [] });
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://fallback.example.com/stream',
      transport: 'tcp',
    });
  });

  it('resolves to the profile matching activeProfileId', () => {
    const cfg = baseConfig({
      profiles: [
        { id: 'p1', label: 'Main', url: 'rtsp://p1.example.com', rtspTransport: 'udp' },
        { id: 'p2', label: 'Backup', url: 'rtsp://p2.example.com', rtspTransport: 'tcp' },
      ],
      activeProfileId: 'p2',
    });
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://p2.example.com',
      transport: 'tcp',
    });
  });

  it('resolves to the first profile when activeProfileId is absent', () => {
    const cfg = baseConfig({
      profiles: [
        { id: 'p1', label: 'Main', url: 'rtsp://p1.example.com', rtspTransport: 'udp' },
        { id: 'p2', label: 'Backup', url: 'rtsp://p2.example.com', rtspTransport: 'tcp' },
      ],
    });
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://p1.example.com',
      transport: 'udp',
    });
  });

  it('falls back to the first remaining profile when activeProfileId points at a deleted profile', () => {
    const cfg = baseConfig({
      profiles: [
        { id: 'p1', label: 'Main', url: 'rtsp://p1.example.com', rtspTransport: 'udp' },
        { id: 'p2', label: 'Backup', url: 'rtsp://p2.example.com', rtspTransport: 'tcp' },
      ],
      activeProfileId: 'deleted-id',
    });
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://p1.example.com',
      transport: 'udp',
    });
  });

  it('yields transport: undefined for a profile with no rtspTransport', () => {
    const cfg = baseConfig({
      profiles: [{ id: 'p1', label: 'Main', url: 'rtsp://p1.example.com' }],
      activeProfileId: 'p1',
    });
    expect(resolveActiveSource(cfg)).toEqual({
      url: 'rtsp://p1.example.com',
      transport: undefined,
    });
  });
});

describe('PROFILE_MODES', () => {
  it('excludes "iframe"', () => {
    expect(PROFILE_MODES).not.toContain('iframe');
  });
});
