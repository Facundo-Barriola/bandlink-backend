import { google } from "googleapis";
import { pool } from "../../config/database.js";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function getOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrlForUser(idUser: number) {
  const oauth2 = getOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar",
  ];

  const stateRaw = JSON.stringify({ idUser, nonce: crypto.randomBytes(8).toString("hex") });
  const state = Buffer.from(stateRaw).toString("base64url");

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return tokens; 
}

// Persistir tokens
export async function saveTokensForUser(idUser: number, tokens: any) {
  const accessToken = tokens.access_token ?? null;
  const refreshToken = tokens.refresh_token ?? null;
  const expiryDate = tokens.expiry_date ?? null;

  const sql = `
    INSERT INTO "Integration"."GoogleTokens" ("idUser","accessToken","refreshToken","expiryDate")
    VALUES ($1,$2,$3,$4)
    ON CONFLICT ("idUser")
    DO UPDATE SET "accessToken" = EXCLUDED."accessToken",
                  "refreshToken"= COALESCE(EXCLUDED."refreshToken","Integration"."GoogleTokens"."refreshToken"),
                  "expiryDate"  = EXCLUDED."expiryDate"
    RETURNING *`;
  await pool.query(sql, [idUser, accessToken, refreshToken, expiryDate]);
}

// Cargar tokens para un user
export async function getTokensForUser(idUser: number) {
  const { rows } = await pool.query(
    `SELECT "accessToken","refreshToken","expiryDate" FROM "Integration"."GoogleTokens" WHERE "idUser" = $1`,
    [idUser]
  );
  return rows[0] ?? null;
}

export function calendarClientWithTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}) {
  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: tokens.accessToken ?? null,
    refresh_token: tokens.refreshToken ?? null,
    expiry_date: tokens.expiryDate ?? null,
  });
  return {
    auth: oauth2,
    calendar: google.calendar({ version: "v3", auth: oauth2 }),
  };
}
