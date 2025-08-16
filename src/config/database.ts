import { Pool } from "pg";
import { ENV } from "./env.js";

export const pool = new Pool({
  host: ENV.PGHOST,
  port: ENV.PGPORT,
  user: ENV.PGUSER,
  password: ENV.PGPASSWORD,
  database: ENV.PGDATABASE,
});

pool.on("connect", () => console.log("✅ Conectado a PostgreSQL"));
pool.on("error", (err) => console.error("❌ PG pool error", err));
