import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  SettingsError,
  normalizeHost,
  normalizePort,
  parseUrl,
  resolveConnection
} from './settings.ts';

describe('normalizeHost', () => {
  it('falls back to the default when it is not set', () => {
    assert.equal(normalizeHost(undefined), DEFAULT_HOST);
    assert.equal(normalizeHost('   '), DEFAULT_HOST);
  });

  it('keeps a host name, an address, and an IPv6 address', () => {
    assert.equal(normalizeHost('scoreboard.local'), 'scoreboard.local');
    assert.equal(normalizeHost('192.168.1.20'), '192.168.1.20');
    assert.equal(normalizeHost('[::1]'), '[::1]');
  });

  it('trims a pasted address back to its host', () => {
    assert.equal(normalizeHost('http://scoreboard:8000/'), 'scoreboard');
    assert.equal(normalizeHost('https://scoreboard.local:8000/nso/sbo/?operator=x'), 'scoreboard.local');
  });

  it('refuses a value that is not a host', () => {
    assert.throws(() => normalizeHost('not a host'), SettingsError);
    assert.throws(() => normalizeHost('-leading-hyphen'), SettingsError);
  });
});

describe('normalizePort', () => {
  it('falls back to the default when it is not set', () => {
    assert.equal(normalizePort(undefined), DEFAULT_PORT);
    assert.equal(normalizePort(''), DEFAULT_PORT);
  });

  it('reads a port given as a number or as text', () => {
    assert.equal(normalizePort(8080), 8080);
    assert.equal(normalizePort('8080'), 8080);
  });

  it('refuses a port outside the range', () => {
    assert.throws(() => normalizePort(0), SettingsError);
    assert.throws(() => normalizePort(65536), SettingsError);
    assert.throws(() => normalizePort(80.5), SettingsError);
  });
});

describe('parseUrl', () => {
  it("falls back to CRG's own address when the field is empty", () => {
    assert.deepEqual(parseUrl(undefined), { host: DEFAULT_HOST, port: DEFAULT_PORT, secure: false });
    assert.deepEqual(parseUrl('   '), { host: DEFAULT_HOST, port: DEFAULT_PORT, secure: false });
  });

  it('reads a full address', () => {
    assert.deepEqual(parseUrl('http://scoreboard.local:8000'), {
      host: 'scoreboard.local',
      port: 8000,
      secure: false
    });
  });

  it('reads an address with no scheme as plain HTTP', () => {
    assert.deepEqual(parseUrl('scoreboard:8000'), { host: 'scoreboard', port: 8000, secure: false });
    assert.deepEqual(parseUrl('192.168.1.20'), { host: '192.168.1.20', port: DEFAULT_PORT, secure: false });
  });

  it('reads TLS from the scheme', () => {
    assert.deepEqual(parseUrl('https://scoreboard:8443'), { host: 'scoreboard', port: 8443, secure: true });
  });

  it("uses the scheme's own port when none is given", () => {
    assert.equal(parseUrl('https://scoreboard').port, 443);
    assert.equal(parseUrl('http://scoreboard').port, DEFAULT_PORT);
  });

  it('ignores a path, because CRG is addressed by origin', () => {
    assert.deepEqual(parseUrl('http://scoreboard:8000/nso/sbo/?operator=x'), {
      host: 'scoreboard',
      port: 8000,
      secure: false
    });
  });

  it('refuses a scheme that is not HTTP', () => {
    assert.throws(() => parseUrl('ws://scoreboard:8000'), SettingsError);
    assert.throws(() => parseUrl('file:///etc/passwd'), SettingsError);
  });

  it('refuses an address it cannot read', () => {
    assert.throws(() => parseUrl('http://not a host:8000'), SettingsError);
    assert.throws(() => parseUrl('http://scoreboard:99999'), SettingsError);
  });
});

describe('resolveConnection', () => {
  it('builds the default addresses', () => {
    const connection = resolveConnection({});

    assert.equal(connection.origin, 'http://localhost:8000');
    assert.ok(connection.webSocketUrl.startsWith('ws://localhost:8000/WS/?source='));
  });

  it('switches both addresses to TLS together', () => {
    const connection = resolveConnection({ url: 'https://scoreboard:8443' });

    assert.equal(connection.origin, 'https://scoreboard:8443');
    assert.ok(connection.webSocketUrl.startsWith('wss://scoreboard:8443/WS/?source='));
  });

  it('names the plugin so it is recognizable in CRG', () => {
    assert.match(resolveConnection({}).webSocketUrl, /source=Stream%20Deck%20plugin/);
  });
});
