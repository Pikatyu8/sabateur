// server.ts
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ClientSession {
  socket: WebSocket;
  playerId: string;
  playerName: string;
  isHost: boolean;
}

interface Room {
  host?: ClientSession;
  guests: Record<string, ClientSession>; // playerId -> session
}

const rooms: Record<string, Room> = {};

wss.on('connection', (ws) => {
  let sessionRoomId: string | null = null;
  let sessionPlayerId: string | null = null;

  ws.on('message', (messageData) => {
    try {
      const data = JSON.parse(messageData.toString());
      
      switch (data.type) {
        case 'JOIN_ROOM': {
          const { roomId, isHost, playerId, playerName } = data;
          sessionRoomId = roomId;
          sessionPlayerId = playerId;

          if (!rooms[roomId]) {
            rooms[roomId] = { guests: {} };
          }

          const session: ClientSession = { socket: ws, playerId, playerName, isHost };

          if (isHost) {
            rooms[roomId].host = session;
          } else {
            rooms[roomId].guests[playerId] = session;
            
            // Оповещаем Хоста, что подключился новый гость
            const hostSession = rooms[roomId].host;
            if (hostSession && hostSession.socket.readyState === WebSocket.OPEN) {
              hostSession.socket.send(JSON.stringify({
                type: 'GUEST_JOINED',
                payload: { playerId, playerName }
              }));
            }
          }
          break;
        }

        case 'CLIENT_ACTION': {
          const { roomId, senderId, action } = data;
          const room = rooms[roomId];
          if (room && room.host && room.host.socket.readyState === WebSocket.OPEN) {
            room.host.socket.send(JSON.stringify({
              type: 'CLIENT_ACTION',
              payload: { senderId, action }
            }));
          }
          break;
        }

        case 'STATE_UPDATE': {
          const { roomId, targetId, state } = data;
          const room = rooms[roomId];
          if (room) {
            const guest = room.guests[targetId];
            if (guest && guest.socket.readyState === WebSocket.OPEN) {
              guest.socket.send(JSON.stringify({
                type: 'STATE_UPDATE',
                payload: state
              }));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Ошибка обработки WS сообщения:', err);
    }
  });

  ws.on('close', () => {
    if (sessionRoomId && sessionPlayerId) {
      const room = rooms[sessionRoomId];
      if (room) {
        if (room.host && room.host.playerId === sessionPlayerId) {
          // Если отключился хост — комната закрывается
          delete rooms[sessionRoomId];
        } else if (room.guests[sessionPlayerId]) {
          delete room.guests[sessionPlayerId];
          // Оповещаем хоста об отключении гостя
          if (room.host && room.host.socket.readyState === WebSocket.OPEN) {
            room.host.socket.send(JSON.stringify({
              type: 'GUEST_LEFT',
              payload: { playerId: sessionPlayerId }
            }));
          }
        }
      }
    }
  });
});

// Отдаем статические файлы фронтенда
const publicPath = path.join(__dirname, '../dist');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});