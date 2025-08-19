import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getJwtExpires(): string | number {
  const value = process.env.JWT_EXPIRES;

  if (!value) {
    return "1h"; // valor por defecto
  }

  // Si es numérico, devolver número
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  // Si es string tipo "7d", "1h", etc., devolverlo tal cual
  return value;
}

export const ENV = {
  PGHOST: required("PGHOST"),
  PGPORT: parseInt(required("PGPORT"), 10),
  PGUSER: required("PGUSER"),
  PGPASSWORD: required("PGPASSWORD"),
  PGDATABASE: required("PGDATABASE"),
  JWT_SECRET: process.env.JWT_SECRET || "default_secret",
  JWT_EXPIRES: getJwtExpires(),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV || "development",
};
