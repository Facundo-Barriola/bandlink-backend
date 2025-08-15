import {Pool} from "pg";
import dotenv from "dotenv";

dotenv.config();
export const pool = new Pool({
  user: process.env.PGUSER,       
  host: process.env.PGHOST,        
  database: process.env.PGDATABASE,  
  password: process.env.PGPASSWORD,    
  port: Number(process.env.PGPORT),         
});

pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL"))
  .catch(err => console.error("❌ Error al conectar a PostgreSQL:", err));