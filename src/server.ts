import app from "./app.js";
import { pool } from "./config/database.js";

const PORT = process.env.PORT || 4000;

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
