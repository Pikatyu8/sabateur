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
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_peer = require("peer");
async function startServer() {
  const app = (0, import_express.default)();
  app.set("trust proxy", true);
  const server = import_http.default.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  const peerServer = (0, import_peer.ExpressPeerServer)(server, {
    path: "/",
    allow_discovery: true,
    proxied: true
    // Включает корректную работу за реверс-прокси
  });
  peerServer.on("connection", (client) => {
    console.log(`Peer connected: ${client.getId()}`);
  });
  peerServer.on("disconnect", (client) => {
    console.log(`Peer disconnected: ${client.getId()}`);
  });
  app.use("/peerjs", peerServer);
  app.get("/api/ice-servers", async (req, res) => {
    try {
      const ident = process.env.XIRSYS_IDENT;
      const secret = process.env.XIRSYS_SECRET;
      const channel = process.env.XIRSYS_CHANNEL;
      if (!ident || !secret || !channel) {
        console.warn("Xirsys environment variables are missing. Using fallback STUN servers.");
        return res.json([
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]);
      }
      const auth = Buffer.from(`${ident}:${secret}`).toString("base64");
      const response = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
        method: "PUT",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ format: "urls" })
      });
      if (!response.ok) {
        throw new Error(`Xirsys API returned status ${response.status}`);
      }
      const data = await response.json();
      res.json(data.v.iceServers);
    } catch (err) {
      console.error("Failed to fetch Xirsys ICE servers:", err);
      res.json([
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" }
      ]);
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send("Saboteur PeerJS Server is running. Frontend is hosted on GitHub Pages.");
      }
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
//# sourceMappingURL=server.cjs.map
