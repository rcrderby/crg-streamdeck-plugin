import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  SettingsError,
  normalizeHost,
  normalizePort,
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

describe('resolveConnection', () => {
  it('builds the default addresses', () => {
    const connection = resolveConnection({});

    assert.equal(connection.origin, 'http://localhost:8000');
    assert.ok(connection.webSocketUrl.startsWith('ws://localhost:8000/WS/?source='));
  });

  it('switches both addresses to TLS together', () => {
    const connection = resolveConnection({ host: 'scoreboard', port: 8443, secure: true });

    assert.equal(connection.origin, 'https://scoreboard:8443');
    assert.ok(connection.webSocketUrl.startsWith('wss://scoreboard:8443/WS/?source='));
  });

  it('names the plugin so it is recognizable in CRG', () => {
    assert.match(resolveConnection({}).webSocketUrl, /source=Stream%20Deck%20plugin/);
  });
});
