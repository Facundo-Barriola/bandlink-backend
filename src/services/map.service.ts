// src/services/map.service.ts
import { fetchStudiosNear, fetchEventsNear } from "../repositories/map.repository.js";

export type StudioPOI = {
  idUser: number;
  displayName: string;
  lat: number;
  lon: number;
  distanceKm: number;
};

export type EventPOI = {
  idEvent: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export class MapService {
  static async getStudiosNear(opts: {
    lat: number;
    lon: number;
    radiusKm: number;
    limit?: number;
  }): Promise<StudioPOI[]> {
    const { lat, lon, radiusKm, limit = 500 } = opts;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const e = new Error("bad_coords");
      (e as any).status = 400;
      throw e;
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      const e = new Error("bad_radius");
      (e as any).status = 400;
      throw e;
    }

    const rows = await fetchStudiosNear(lat, lon, radiusKm, limit);
    return rows.map((r) => ({
      idUser: r.idUser,
      displayName: r.displayName,
      lat: Number(r.lat),
      lon: Number(r.lon),
      distanceKm: Number(r.distance_km),
    }));
  }
    static async getEventsNear(opts: {
    lat: number;
    lon: number;
    radiusKm: number;
    limit?: number;
  }): Promise<EventPOI[]> {
    const { lat, lon, radiusKm, limit = 500 } = opts;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const e = new Error("bad_coords"); (e as any).status = 400; throw e;
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      const e = new Error("bad_radius"); (e as any).status = 400; throw e;
    }

    const rows = await fetchEventsNear(lat, lon, radiusKm, limit);
    return rows.map(r => ({
      idEvent: r.idEvent,
      name: r.name,
      lat: Number(r.lat),
      lon: Number(r.lon),
      distanceKm: Number(r.distance_km),
      startsAt: r.startsAt ?? null,
      endsAt: r.endsAt ?? null,
    }));
  }
}
