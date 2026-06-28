import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ExpressPeerServer } from 'peer';

async function startServer() {
  const app = express();
  
  // 1. Указываем Express доверять заголовкам прокси-сервера Hugging Face
  app.set('trust proxy', true); 
  
  const server = http.createServer(app);

  // Set up PeerJS server
  const peerServer = ExpressPeerServer(server, {
    path: '/',
    allow_discovery: true,
    proxied: true, // 2. Указываем PeerJS, что мы работаем за реверс-прокси
  });

  peerServer.on('connection', (client) => {
    console.log(`Peer connected: ${client.getId()}`);
  });

  peerServer.on('disconnect', (client) => {
    console.log(`Peer disconnected: ${client.getId()}`);
  });

  app.use('/peerjs', peerServer);

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Если фронтенд не скомпилирован в контейнере, отдаем простое текстовое сообщение
        res.send('Saboteur PeerJS Server is running. Frontend is hosted on GitHub Pages.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
