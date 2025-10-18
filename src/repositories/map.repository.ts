import { pool } from "../config/database.js";

export type StudioNearRow = {
  idUser: number;
  displayName: string;
  lat: number;
  lon: number;
  distance_km: number;
};

export type EventNearRow = {
  idEvent: number;
  name: string;
  lat: number;
  lon: number;
  distance_km: number;
  startsAt: string | null;
  endsAt: string | null;
};

export async function fetchEventsNear(
  lat: number,
  lon: number,
  radiusKm: number,
  limit = 500
): Promise<EventNearRow[]> {
  const sql = `
    SELECT *
    FROM (
      SELECT
        e."idEvent"                                AS "idEvent",
        e."name"                                   AS "name",
        e.latitude::double precision               AS lat,
        e.longitude::double precision              AS lon,
        e."startsAt"                               AS "startsAt",
        e."endsAt"                                 AS "endsAt",
        2 * 6371 * ASIN(
          SQRT(
            POWER(SIN(((e.latitude::double precision * pi()/180) - ($1 * pi()/180)) / 2), 2) +
            COS($1 * pi()/180) * COS(e.latitude::double precision * pi()/180) *
            POWER(SIN(((e.longitude::double precision * pi()/180) - ($2 * pi()/180)) / 2), 2)
          )
        ) AS distance_km
      FROM "Directory"."Event" e
      WHERE
        e.visibility = 'public'                        -- opcional, pero útil
        AND e.latitude  IS NOT NULL
        AND e.longitude IS NOT NULL
    ) q
    WHERE q.distance_km <= $3
    ORDER BY q.distance_km ASC
    LIMIT $4;
  `;
  const values = [lat, lon, radiusKm, Math.min(limit, 1000)];
  const { rows } = await pool.query(sql, values);
  return rows as EventNearRow[];
}

/**
 * Devuelve salas (UserGroup=3) con lat/lon dentro del radio, ordenadas por distancia.
 * Haversine en SQL (sin PostGIS).
 */
export async function fetchStudiosNear(
  lat: number,
  lon: number,
  radiusKm: number,
  limit = 500
): Promise<StudioNearRow[]> {
  const sql = `
    SELECT *
    FROM (
      SELECT
        up."idUser"                                  AS "idUser",
        up."displayName"                             AS "displayName",
        up.latitude::double precision                AS lat,
        up.longitude::double precision               AS lon,
        2 * 6371 * ASIN(
          SQRT(
            POWER(SIN(((up.latitude::double precision * pi()/180) - ($1 * pi()/180)) / 2), 2) +
            COS($1 * pi()/180) * COS(up.latitude::double precision * pi()/180) *
            POWER(SIN(((up.longitude::double precision * pi()/180) - ($2 * pi()/180)) / 2), 2)
          )
        ) AS distance_km
      FROM "Directory"."UserProfile" up
      JOIN "Security"."User" u ON u."idUser" = up."idUser"
      WHERE
        u."idUserGroup" = 3
        AND up.latitude  IS NOT NULL
        AND up.longitude IS NOT NULL
    ) q
    WHERE q.distance_km <= $3
    ORDER BY q.distance_km ASC
    LIMIT $4;
  `;

  const values = [lat, lon, radiusKm, Math.min(limit, 1000)];
  const { rows } = await pool.query(sql, values);
  return rows as StudioNearRow[];
}