var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_ws = require("ws");
var import_path = __toESM(require("path"), 1);
var app = (0, import_express.default)();
var server = import_http.default.createServer(app);
var wss = new import_ws.WebSocketServer({ server });
var rooms = {};
wss.on("connection", (ws) => {
  let sessionRoomId = null;
  let sessionPlayerId = null;
  ws.on("message", (messageData) => {
    try {
      const data = JSON.parse(messageData.toString());
      switch (data.type) {
        case "JOIN_ROOM": {
          const { roomId, isHost, playerId, playerName } = data;
          sessionRoomId = roomId;
          sessionPlayerId = playerId;
          if (!rooms[roomId]) {
            rooms[roomId] = { guests: {} };
          }
          const session = { socket: ws, playerId, playerName, isHost };
          if (isHost) {
            rooms[roomId].host = session;
          } else {
            rooms[roomId].guests[playerId] = session;
            const hostSession = rooms[roomId].host;
            if (hostSession && hostSession.socket.readyState === import_ws.WebSocket.OPEN) {
              hostSession.socket.send(JSON.stringify({
                type: "GUEST_JOINED",
                payload: { playerId, playerName }
              }));
            }
          }
          break;
        }
        case "CLIENT_ACTION": {
          const { roomId, senderId, action } = data;
          const room = rooms[roomId];
          if (room && room.host && room.host.socket.readyState === import_ws.WebSocket.OPEN) {
            room.host.socket.send(JSON.stringify({
              type: "CLIENT_ACTION",
              payload: { senderId, action }
            }));
          }
          break;
        }
        case "STATE_UPDATE": {
          const { roomId, targetId, state } = data;
          const room = rooms[roomId];
          if (room) {
            const guest = room.guests[targetId];
            if (guest && guest.socket.readyState === import_ws.WebSocket.OPEN) {
              guest.socket.send(JSON.stringify({
                type: "STATE_UPDATE",
                payload: state
              }));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 WS \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F:", err);
    }
  });
  ws.on("close", () => {
    if (sessionRoomId && sessionPlayerId) {
      const room = rooms[sessionRoomId];
      if (room) {
        if (room.host && room.host.playerId === sessionPlayerId) {
          delete rooms[sessionRoomId];
        } else if (room.guests[sessionPlayerId]) {
          delete room.guests[sessionPlayerId];
          if (room.host && room.host.socket.readyState === import_ws.WebSocket.OPEN) {
            room.host.socket.send(JSON.stringify({
              type: "GUEST_LEFT",
              payload: { playerId: sessionPlayerId }
            }));
          }
        }
      }
    }
  });
});
var publicPath = import_path.default.join(__dirname, "../dist");
app.use(import_express.default.static(publicPath));
app.get("*", (req, res) => {
  res.sendFile(import_path.default.join(publicPath, "index.html"));
});
var PORT = process.env.PORT || 3e3;
server.listen(PORT, () => {
  console.log(`\u0421\u0435\u0440\u0432\u0435\u0440 \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u043D\u0430 \u043F\u043E\u0440\u0442\u0443 ${PORT}`);
});
//# sourceMappingURL=server.cjs.map
