/**
 * Where CRG is, and how the plugin addresses it.
 *
 * The host, port, and scheme are settings rather than constants, so the
 * same build talks to a scoreboard on this machine or one across the
 * hall without a change to the code.
 */

/**
 * Connection settings, held in the plugin's global settings.
 *
 * Global means one address serves every key, rather than the scoreboard
 * being configured on each one.
 */
export type ConnectionSettings = {
  url?: string;
};

/** The addresses one set of connection settings resolves to. */
export type Connection = {
  readonly origin: string;
  readonly webSocketUrl: string;
};

export const DEFAULT_HOST = 'localhost';

export const DEFAULT_PORT = 8000;

/** Shown in the property inspector, and used when the field is empty. */
export const DEFAULT_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

/** How the plugin names itself in CRG's list of connected clients. */
export const CLIENT_SOURCE = 'Stream Deck plugin';

/** A host name, an IPv4 address, or an IPv6 address in brackets. */
const HOST_PATTERN = /^(?:\[[0-9a-f:]+\]|[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)$/i;

export class SettingsError extends Error {}

/**
 * Reads a host from a setting.
 *
 * A pasted address such as 'http://scoreboard:8000/' is trimmed back to
 * its host rather than refused, because that is what a person who
 * pastes one means.
 */
export function normalizeHost(value: string | undefined): string {
  const trimmed = (value ?? '').trim();

  if (trimmed === '') {
    return DEFAULT_HOST;
  }

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = withoutScheme.split('/')[0]?.split('?')[0]?.replace(/:\d+$/, '') ?? '';

  if (!HOST_PATTERN.test(host)) {
    throw new SettingsError(`'${trimmed}' is not a host name or address`);
  }

  return host;
}

/** Reads a port from a setting. */
export function normalizePort(value: number | string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SettingsError(`'${value}' is not a port number`);
  }

  return port;
}

/**
 * Reads a CRG address into its parts.
 *
 * A scoreboard is one address to the person typing it, so the setting
 * is one field. A missing scheme is read as plain HTTP, and a missing
 * port as CRG's own.
 */
export function parseUrl(value: string | undefined): { host: string; port: number; secure: boolean } {
  const trimmed = (value ?? '').trim();

  if (trimmed === '') {
    return { host: DEFAULT_HOST, port: DEFAULT_PORT, secure: false };
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;

  try {
    parsed = new URL(withScheme);
  } catch {
    throw new SettingsError(`'${trimmed}' is not a CRG address`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SettingsError(`'${trimmed}' must start with http:// or https://`);
  }

  const secure = parsed.protocol === 'https:';

  return {
    host: normalizeHost(parsed.hostname),
    port: parsed.port === '' ? (secure ? 443 : DEFAULT_PORT) : normalizePort(parsed.port),
    secure
  };
}

/** Turns connection settings into the addresses the client opens. */
export function resolveConnection(settings: ConnectionSettings): Connection {
  const { host, port, secure } = parseUrl(settings.url);

  const origin = `${secure ? 'https' : 'http'}://${host}:${port}`;
  const query = `?source=${encodeURIComponent(CLIENT_SOURCE)}&platform=${encodeURIComponent(process.platform)}`;

  return {
    origin,
    webSocketUrl: `${secure ? 'wss' : 'ws'}://${host}:${port}/WS/${query}`
  };
}
