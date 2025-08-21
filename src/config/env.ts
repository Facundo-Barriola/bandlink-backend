import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getStringOrDefault(name: string, def: string) {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : def;
}

function getIntOrDefault(name: string, def: number) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getJwtExpiresString(name: string, def: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : def; // ej: "15m", "30d"
}

function getJwtExpires(): string | number {
  const value = process.env.JWT_ACCESS_EXPIRES;
  if (!value) return "15m"; // fallback
  if (/^\d+$/.test(value)) return Number(value); // ej: "604800" => 604800
  return value; // ej: "15m"
}

function getBoolOrDefault(name: string, def: boolean) {
  const v = process.env[name];
  if (!v) return def;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}
export const ENV = {
  PGHOST: required("PGHOST"),
  PGPORT: parseInt(required("PGPORT"), 10),
  PGUSER: required("PGUSER"),
  PGPASSWORD: required("PGPASSWORD"),
  PGDATABASE: required("PGDATABASE"),
  JWT_ACCESS_SECRET: getStringOrDefault("JWT_ACCESS_SECRET", "dev_access_secret"),
  JWT_ACCESS_EXPIRES: getJwtExpires(),
  JWT_REFRESH_SECRET: getStringOrDefault("JWT_REFRESH_SECRET", "dev_refresh_secret"),
  REFRESH_REMEMBER_DAYS: getIntOrDefault("REFRESH_REMEMBER_DAYS", 30),
  REFRESH_DEFAULT_DAYS: getIntOrDefault("REFRESH_DEFAULT_DAYS", 1),
  REFRESH_COOKIE_NAME: getStringOrDefault("REFRESH_COOKIE_NAME", "rt"),
  COOKIE_SECURE: getBoolOrDefault("COOKIE_SECURE", process.env.NODE_ENV === "production"),
  COOKIE_SAMESITE: getStringOrDefault("COOKIE_SAMESITE", "lax"), // 'lax' | 'strict' | 'none'
  COOKIE_PATH: getStringOrDefault("COOKIE_PATH", "/"),
  LEGACY_JWT_SECRET: getStringOrDefault("JWT_SECRET", "default_secret"),
  LEGACY_JWT_EXPIRES: getJwtExpiresString("JWT_EXPIRES", "1h"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV || "development",
};
