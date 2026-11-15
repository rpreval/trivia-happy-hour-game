import React, { useEffect, useRef, useState } from 'react';
import HostView from './HostView';
import DisplayView from './DisplayView';
import JoinView from './JoinView';

export function useGameSocket({ gameCode, role, hostSecret, teamId }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!gameCode) return undefined;
    let closedByUser = false;
    let retryTimer;
    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameCode, role, hostSecret, teamId }));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATE_UPDATE') {
          setClockOffsetMs(msg.payload.game.serverNow - Date.now());
          setState(msg.payload);
        }
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
  }, [gameCode, role, hostSecret, teamId]);

  const send = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...payload, gameCode }));
    }
  };
  return { state, connected, clockOffsetMs, send };
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/join';
  if (path === '/host') return <HostView useGameSocket={useGameSocket} />;
  if (path === '/display') return <DisplayView useGameSocket={useGameSocket} />;
  return <JoinView useGameSocket={useGameSocket} />;
}
