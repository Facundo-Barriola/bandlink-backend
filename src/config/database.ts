import { Pool } from "pg";
import { ENV } from "./env.js";
import { PoolClient } from "pg";

export const pool = new Pool({
  host: ENV.PGHOST,
  port: ENV.PGPORT,
  user: ENV.PGUSER,
  password: ENV.PGPASSWORD,
  database: ENV.PGDATABASE,
});

export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T>{
    const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
} 

pool.on("connect", () => console.log("✅ Conectado a PostgreSQL"));
pool.on("error", (err) => console.error("❌ PG pool error", err));
