const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const rawWsUrl = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '');
const rawPublicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
const defaultWsOrigin =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:8080/ws';

export const API_BASE_URL = rawApiUrl || defaultOrigin;
export const WS_BASE_URL = rawWsUrl || defaultWsOrigin;

export function buildJoinInviteUrl(gameCode) {
  const base = rawPublicAppUrl || window.location.origin;
  return `${base}/join?code=${encodeURIComponent(gameCode)}`;
}
