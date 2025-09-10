import "dotenv/config";
import app from "./app.js";
import { pool } from "./config/database.js";

const PORT = process.env.PORT || 4000;

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err instanceof Error ? err.stack : err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
async function start() {
  try {
    await pool.connect(); // test conexión
    app.listen(PORT, () => console.log(`🚀 Auth API corriendo en http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ No se pudo iniciar el servidor:", err);
    process.exit(1);
  }
}

start();
