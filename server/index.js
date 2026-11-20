ws.on('close', async () => {
    if (ws.role === 'TEAM' && ws.teamId && ws.gameCode) {
      await pool.query('UPDATE teams SET connected = FALSE WHERE id = $1', [ws.teamId]);
      await broadcastGame(ws.gameCode);
    }
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25_000);

const distPath = process.env.CLIENT_DIST_PATH || new URL('../client/dist', import.meta.url).pathname;
app.use(express.static(distPath));
app.get(['/', '/host', '/display', '/join', '*'], (_req, res) => res.sendFile(`${distPath}/index.html`));

const PORT = Number(process.env.PORT) || 8080;
initDb().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Trivia Happy Hour API & WebSocket server listening on port ${PORT}`);
  });
});

process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  server.close(() => pool.end().then(() => process.exit(0)));
});
