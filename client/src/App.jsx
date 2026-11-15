import React, { useEffect, useRef, useState } from 'react';
import { WS_BASE_URL } from './config';
import HostView from './HostView';
import DisplayView from './DisplayView';
import JoinView from './JoinView';

export function useGameSocket({ gameCode, role, hostSecret, sessionToken }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!gameCode) return undefined;
    let closedByUser = false;
    let retryTimer;
    function connect() {
      const ws = new WebSocket(WS_BASE_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setAuthError(null);
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameCode, role, hostSecret, sessionToken }));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE') {
          setClockOffsetMs(msg.payload.game.serverNow - Date.now());
          setState(msg.payload);
        } else if (msg.type === 'AUTH_ERROR') setAuthError(msg.error);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUser) retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      closedByUser = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [gameCode, role, hostSecret, sessionToken]);

  const send = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...payload, gameCode }));
    }
  };
  return { state, connected, authError, clockOffsetMs, send };
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/join';
  if (path === '/host') return <HostView />;
  if (path === '/display') return <DisplayView useGameSocket={useGameSocket} />;
  return <JoinView useGameSocket={useGameSocket} />;
}
