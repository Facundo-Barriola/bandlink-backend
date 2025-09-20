// src/routes/presence.ts (Express + TS)
import { Router, Request, Response } from "express";
import { AuthRequest } from "../types/authRequest.js";

type Presence = {
  idUser: number;
  displayName?: string;
  lat: number;
  lon: number;
  updatedAt: number; // epoch ms
};

const router = Router();

// Memoria (dev). En prod: Redis con TTL, o tabla con PostGIS.
const online = new Map<number, Presence>();
const TTL_MS = 2 * 60 * 1000;

// Limpieza periódica
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of online) if (now - p.updatedAt > TTL_MS) online.delete(id);
}, 30 * 1000);

// helper
function haversineKm(a: {lat:number,lon:number}, b: {lat:number,lon:number}) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLon = (b.lon - a.lon) * Math.PI/180;
  const s1 = Math.sin(dLat/2), s2 = Math.sin(dLon/2);
  const c1 = Math.cos(a.lat * Math.PI/180), c2 = Math.cos(b.lat * Math.PI/180);
  const av = s1*s1 + c1*c2*s2*s2;
  return 2 * R * Math.asin(Math.sqrt(av));
}
// Limpieza
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of online) if (now - p.updatedAt > TTL_MS) online.delete(id);
}, 30_000);

const REQUIRE_AUTH = false;
router.post("/presence", (req, res) => {
  try {
     const idUser = Number(req.body.idUser);
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { lat, lon, displayName } = req.body || {};
    if (typeof lat !== "number" || typeof lon !== "number") {
      return res.status(400).json({ ok: false, error: "bad_coords" });
    }
    online.set(idUser, { idUser, displayName, lat, lon, updatedAt: Date.now() });
    res.json({ ok: true });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// GET /presence/near?lat=&lon=&radiusKm=
router.get("/presence/near", async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  const radiusKm = Number(req.query.radiusKm ?? 5);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ ok:false, error:"bad_query" });
  }
  const now = Date.now();
  const results = [];
  for (const p of online.values()) {
    if (now - p.updatedAt > TTL_MS) continue;
    if (haversineKm({lat,lon},{lat:p.lat,lon:p.lon}) <= radiusKm) {
      results.push({ idUser: p.idUser, displayName: p.displayName, lat: p.lat, lon: p.lon, updatedAt: p.updatedAt });
    }
  }
  res.json({ ok:true, data: results });
});

export default router;
