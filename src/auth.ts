import { timingSafeEqual } from 'node:crypto';

export function safeEqual(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hasBearerToken(header: string | undefined, token: string): boolean {
  return safeEqual(header ?? '', `Bearer ${token}`);
}

export function hasBasicPassword(header: string | undefined, password: string): boolean {
  if (!header?.startsWith('Basic ')) return false;
  const credentials = Buffer.from(header.slice('Basic '.length), 'base64').toString();
  return safeEqual(credentials.slice(credentials.indexOf(':') + 1), password);
}
