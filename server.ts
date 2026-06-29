// server.ts
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { ExpressPeerServer } from 'peer';

async function startServer() {
  const app = express();
  
  // Доверяем заголовкам прокси-сервера Hugging Face
  app.set('trust proxy', true);

  const server = http.createServer(app);
  
  // Определяем порт (Hugging Face автоматически передает его в переменной процесса)
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Настройка PeerJS-сервера с поддержкой проксирования
  const peerServer = ExpressPeerServer(server, {
    path: '/',
    allow_discovery: true,
    proxied: true, // Включает корректную работу за реверс-прокси
  });

  // Логирование подключений клиентов к сигнальному серверу
  peerServer.on('connection', (client) => {
    console.log(`Peer connected: ${client.getId()}`);
  });

  peerServer.on('disconnect', (client) => {
    console.log(`Peer disconnected: ${client.getId()}`);
  });

  app.use('/peerjs', peerServer);
  
app.get('/api/ice-servers', async (req, res) => {
  try {
    // Чтение данных из переменных окружения Hugging Face
    const ident = process.env.XIRSYS_IDENT;
    const secret = process.env.XIRSYS_SECRET;
    const channel = process.env.XIRSYS_CHANNEL;
    
    // Если переменные не настроены на хостинге, пишем предупреждение и отдаем резервные STUN
    if (!ident || !secret || !channel) {
      console.warn('Xirsys environment variables are missing. Using fallback STUN servers.');
      return res.json([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]);
    }

    const auth = Buffer.from(`${ident}:${secret}`).toString('base64');
    
    const response = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format: 'urls' })
    });
    
    if (!response.ok) {
      throw new Error(`Xirsys API returned status ${response.status}`);
    }
    
    const data: any = await response.json();
    res.json(data.v.iceServers);
  } catch (err) {
    console.error('Failed to fetch Xirsys ICE servers:', err);
    res.json([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]);
  }
});


  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Раздача статического контента в зависимости от окружения
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
        // Заглушка, если фронтенд развернут отдельно на GitHub Pages
        res.send('Saboteur PeerJS Server is running. Frontend is hosted on GitHub Pages.');
      }
    });
  }

  // Запуск сервера на прослушивание порта
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});