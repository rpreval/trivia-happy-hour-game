const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const rawWsUrl = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '');
const rawPublicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

if (import.meta.env.PROD) {
  if (!rawApiUrl.startsWith('https://')) {
    throw new Error('Production build requires VITE_API_URL to start with https://');
  }
  if (!rawWsUrl.startsWith('wss://')) {
    throw new Error('Production build requires VITE_WS_URL to start with wss://');
  }
}

export const API_BASE_URL = rawApiUrl || 'http://localhost:8080';
export const WS_BASE_URL = rawWsUrl || 'ws://localhost:8080/ws';

export function buildJoinInviteUrl(gameCode) {
  const base = rawPublicAppUrl || window.location.origin;
  return `${base}/join?code=${encodeURIComponent(gameCode)}`;
}
