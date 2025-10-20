import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { Server } from "socket.io";
import { pool } from "./config/database.js";
import { mountChatNamespace } from "./utils/chat.js"; // tu handler/namespace
import { bindChatIo } from "./services/chat.service.js";

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());
const SOCKETIO_PATH = process.env.SOCKETIO_PATH || "/socket.io";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err instanceof Error ? err.stack : err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[BOOT] Listening on :${PORT}`);
});

async function start() {
  try {
    await pool.query("select 1"); // ping DB

    const httpServer = createServer(app);

    const io = new Server(httpServer, {
      path: SOCKETIO_PATH,
      // IMPORTANTE: habilitar polling y mandar cookies en el handshake
      transports: ["websocket", "polling"],
      cors: {
        origin: CLIENT_ORIGIN,    
        credentials: true,
      },
      serveClient: false,
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
      maxHttpBufferSize: 5 * 1024 * 1024,
    });

    mountChatNamespace(io);
    bindChatIo(io);

    httpServer.listen(PORT, () => {
      console.log(`[BOOT] NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
      console.log(`🚀 API escuchando en http://localhost:${PORT}`);
      console.log(`💬 Socket.IO en ${SOCKETIO_PATH} (origins: ${CLIENT_ORIGIN.join(", ")})`);
    });

    const shutdown = async (signal: NodeJS.Signals) => {
      console.log(`\n🛑 ${signal} recibido: cerrando...`);
      try { io.close(); } catch {}
      httpServer.close(() => console.log("HTTP server cerrado"));
      try { await pool.end(); } catch {}
      process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ No se pudo iniciar el servidor:", err);
    process.exit(1);
  }
}

start();
