import { Pool, PoolClient } from "pg";
import { pool } from "../config/database.js";

export type NewEventDTO = {
  name: string;
  description?: string | null;
  visibility?: "public" | "private";
  capacityMax?: number | null;

  idAddress: number

  startsAtIso: string;
  endsAtIso?: string | null;
};

export type EventWithAddress = {
  idEvent: number;
  name: string;
  description: string | null;
  visibility: "public" | "private" | string;
  capacityMax: number | null;
  idAddress: number | null;
  startsAt: string;
  endsAt: string | null;
  address: {
    idAddress: number;
    street?: string | null;
    streetNum?: number | null;
  } | null;
};

export type UpdateEventDTO = Partial<NewEventDTO>;


export async function listEvents(limit = 20, offset = 0) {
  const { rows } = await pool.query(
    `SELECT e."idEvent", e.name, e.description, e.visibility, e."capacityMax",
            e."startsAt", e."endsAt",
            e."idUser",
            e."idAddress", e.latitude, e.longitude,
            e."createdAt", e."updatedAt"
     FROM "Directory"."Event" e
     ORDER BY e."startsAt" DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getById(idEvent: number) {
  const { rows } = await pool.query(
    `SELECT e."idEvent", e.name, e.description, e.visibility, e."capacityMax",
              e."startsAt", e."endsAt",
              e."idUser",
              e."idAddress", e.latitude, e.longitude,
              e."createdAt", e."updatedAt"
       FROM "Directory"."Event" e
       WHERE e."idEvent" = $1
       LIMIT 1`,
    [idEvent]
  );
  return rows[0] || null;
}

export async function createEventTx(client: PoolClient, idUser: number, payload: NewEventDTO) {
  if (!payload.name?.trim()) throw new Error("name_required");
  if (!payload.startsAtIso) throw new Error("starts_required");

  const starts = new Date(payload.startsAtIso);
  if (isNaN(starts.getTime())) throw new Error("invalid_startsAt");

  const ends = payload.endsAtIso ? new Date(payload.endsAtIso) : null;
  if (payload.endsAtIso && isNaN(ends!.getTime())) throw new Error("invalid_endsAt");
  if (ends && ends <= starts) throw new Error("ends_before_starts");

  const { rows } = await client.query(
    `INSERT INTO "Directory"."Event"
     ("idUser","visibility","name","description","capacityMax",
      "idAddress","latitude","longitude","startsAt","endsAt","createdAt","updatedAt")
     VALUES
     ($1,COALESCE($2,'public'),$3,$4,$5,
      $6,$7,$8,$9,$10, now(), now())
     RETURNING "idEvent"`,
    [
      idUser,
      payload.visibility ?? "public",
      payload.name.trim(),
      payload.description ?? null,
      payload.capacityMax ?? null,
      payload.idAddress,           // <- viene del service
      null,                        // latitude
      null,                        // longitude
      starts.toISOString().replace("Z", ""),
      ends ? ends.toISOString().replace("Z", "") : null,
    ]
  );

  return rows[0].idEvent as number;
}

export async function updateEventTx(
  client: PoolClient,
  idEvent: number,
  idUser: number,
  payload: UpdateEventDTO
) {
  const setParts: string[] = [];
  const vals: any[] = [];
  let i = 1;
  const add = (frag: string, v: any) => {
    setParts.push(`${frag} $${i++}`);
    vals.push(v);
  };

  if (payload.name !== undefined) add(`"name" =`, payload.name?.trim() || null);
  if (payload.description !== undefined) add(`"description" =`, payload.description ?? null);
  if (payload.visibility !== undefined) add(`visibility =`, payload.visibility);
  if (payload.capacityMax !== undefined) add(`"capacityMax" =`, payload.capacityMax ?? null);
  if (payload.idAddress !== undefined) add(`"idAddress" =`, payload.idAddress);
  if (payload.startsAtIso !== undefined) add(`"startsAt" =`, payload.startsAtIso?.replace("Z", ""));
  if (payload.endsAtIso !== undefined) add(`"endsAt" =`, payload.endsAtIso ? payload.endsAtIso.replace("Z", "") : null);

  add(`"updatedAt" =`, new Date().toISOString().replace("Z", ""));

  if (!setParts.length) return;

  const sql = `
    UPDATE "Directory"."Event"
    SET ${setParts.join(", ")}
    WHERE "idEvent" = $${i} AND "idUser" = $${i + 1}
  `;
  vals.push(idEvent, idUser);

  const { rowCount } = await client.query(sql, vals);
  if (!rowCount) throw new Error("forbidden_or_not_found");
}

export async function deleteEvent(idEvent: number, idUser: number) {
  const { rowCount } = await pool.query(
    `DELETE FROM "Directory"."Event" WHERE "idEvent" = $1 AND "idUser" = $2`,
    [idEvent, idUser]
  );
  if (!rowCount) throw new Error("forbidden_or_not_found");
}

export async function upsertUserInvite(idEvent: number, idUser: number): Promise<boolean> {
  const sql = `
      INSERT INTO "Directory"."EventInviteUser"
        ("idEvent","idUser","status","invitedAt","respondedAt")
      VALUES ($1,$2,'pending', now(), NULL)
      ON CONFLICT ("idEvent","idUser") DO UPDATE
        SET "status"='pending', "invitedAt"=now(), "respondedAt"=NULL
      RETURNING xmax = 0 AS inserted;  -- true si fue insert nuevo
    `;
  const { rows } = await pool.query(sql, [idEvent, idUser]);
  return !!rows[0]?.inserted;
}

export async function upsertBandInvite(idEvent: number, idBand: number): Promise<boolean> {
  const sql = `
      INSERT INTO "Directory"."EventInviteBand"
        ("idEvent","idBand","status","invitedAt","respondedAt")
      VALUES ($1,$2,'pending', now(), NULL)
      ON CONFLICT ("idEvent","idBand") DO UPDATE
        SET "status"='pending', "invitedAt"=now(), "respondedAt"=NULL
      RETURNING xmax = 0 AS inserted;
    `;
  const { rows } = await pool.query(sql, [idEvent, idBand]);
  return !!rows[0]?.inserted;
}

export async function getMyEventsList(idUser: number, limit = 50, offset = 0): Promise<EventWithAddress[]> {
  const SQL = `
      SELECT
        e."idEvent",
        e."name",
        e."description",
        e."visibility",
        e."capacityMax",
        e."idAddress",
        e."startsAt",
        e."endsAt",
        COALESCE(json_build_object(
          'idAddress',  a."idAddress",
          'street',     a."street",
          'streetNum',  a."streetNum"
        ), NULL) AS "address"
      FROM "Directory"."Event" e
      LEFT JOIN "Address"."Address" a   
        ON a."idAddress" = e."idAddress"
      WHERE e."idUser" = $1
      ORDER BY e."startsAt" DESC
      LIMIT $2 OFFSET $3;
    `
  const { rows } = await pool.query<EventWithAddress>(SQL, [idUser, limit, offset]);
  return rows;
}

export type EventHit = {
  idEvent: number;
  idUser: number;
  name: string;
};

export async function getEventsByName(name: string, limit = 8): Promise<EventHit[]> {
  const sql = `SELECT * FROM "Directory"."fn_get_events_by_name"($1,$2);`;
  const { rows } = await pool.query<EventHit>(sql, [name, limit]);
  return rows;
}

export async function updateLocation(idEvent: number, latitude: number, longitude: number) {
  const sql = `
    UPDATE "Directory"."Event"
    SET "latitude" = $1,
        "longitude" = $2,
        "updatedAt" = NOW()
    WHERE "idEvent" = $3
    RETURNING "idEvent", "latitude", "longitude";
  `;
  const { rows } = await pool.query(sql, [latitude, longitude, idEvent]);
  return rows[0] ?? null;
}

export async function getAttendingEventIdsByUser(idUser: number) {
  const sql = `
    SELECT DISTINCT ea."idEvent"
    FROM "Directory"."EventAttendee" ea
    WHERE ea."idUser" = $1
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows.map(r => Number(r.idEvent)).filter(n => Number.isFinite(n));
}