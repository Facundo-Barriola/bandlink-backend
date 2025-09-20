import { pool } from "../config/database.js";

export type DiscoverItem = {
    idEvent: number;
    name: string;
    description: string | null;
    visibility: string;
    capacityMax: number | null;
    idAddress: number | null;
    startsAt: string;
    endsAt: string | null;
    dist_km: number | null;
    genre_score: number;
    proximity_score: number;
    recency_score: number;
    popularity_score: number;
    score: number;
};

const SQL_RECOMMEND = `
WITH
u AS (
  SELECT
    up."idUser",
    up."idUserProfile",
    COALESCE(up.latitude::float8, uc.latitude::float8)   AS u_lat,
    COALESCE(up.longitude::float8, uc.longitude::float8) AS u_lon,
    ua."idCity"                                          AS u_idCity,
    uc."idProvince"                                      AS u_idProvince,
    pv."idCountry"                                       AS u_idCountry
  FROM "Directory"."UserProfile" up
  LEFT JOIN "Address"."Address"  ua ON ua."idAddress" = up."idAddress"
  LEFT JOIN "Address"."City"     uc ON uc."idCity"     = ua."idCity"
  LEFT JOIN "Address"."Province" pv ON pv."idProvince" = uc."idProvince"
  WHERE up."idUser" = $1
),
u_one AS (SELECT * FROM u LIMIT 1),

user_genres AS (
  SELECT mg."idGenre"
  FROM "Directory"."Musician" m
  JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
  JOIN "Directory"."MusicianGenre" mg ON mg."idMusician" = m."idMusician"
  WHERE up."idUser" = $1
),
user_genre_count AS (SELECT COUNT(*)::float8 AS cnt FROM user_genres),

candidates AS (
  SELECT e.*
  FROM "Directory"."Event" e
  WHERE e."visibility" = 'public'
    AND e."startsAt" >= now()
    AND e."startsAt" <  (now() + ($2 || ' days')::interval)
    AND e."idUser" <> $1
),

ev_loc AS (
  SELECT
    e."idEvent", e."name", e."description", e."visibility", e."capacityMax",
    e."idAddress", e."startsAt", e."endsAt",
    COALESCE(e.latitude::float8, ec.latitude::float8)   AS ev_lat,
    COALESCE(e.longitude::float8, ec.longitude::float8) AS ev_lon,
    ea."idCity"                                         AS ev_idCity,
    ec."idProvince"                                     AS ev_idProvince,
    ep."idCountry"                                      AS ev_idCountry
  FROM candidates e
  LEFT JOIN "Address"."Address"  ea ON ea."idAddress" = e."idAddress"
  LEFT JOIN "Address"."City"     ec ON ec."idCity"     = ea."idCity"
  LEFT JOIN "Address"."Province" ep ON ep."idProvince" = ec."idProvince"
),

event_genres AS (
  SELECT epb."idEvent", bg."idGenre"
  FROM "Directory"."EventPerformerBand" epb
  JOIN "Directory"."BandGenre" bg ON bg."idBand" = epb."idBand"
  UNION
  SELECT e."idEvent", mg2."idGenre"
  FROM candidates e
  JOIN "Directory"."UserProfile" up2 ON up2."idUser" = e."idUser"
  JOIN "Directory"."Musician"    m2  ON m2."idUserProfile" = up2."idUserProfile"
  JOIN "Directory"."MusicianGenre" mg2 ON mg2."idMusician" = m2."idMusician"
),

event_genre_match AS (
  SELECT eg."idEvent", COUNT(*)::float8 AS matches
  FROM event_genres eg
  JOIN user_genres ug USING ("idGenre")
  GROUP BY eg."idEvent"
),

pop AS (
  SELECT "idEvent", COUNT(*)::float8 AS attendees_cnt
  FROM "Directory"."EventAttendee"
  GROUP BY "idEvent"
),

scored AS (
  SELECT
    l.*,

    CASE
      WHEN u.u_lat IS NOT NULL AND u.u_lon IS NOT NULL
       AND l.ev_lat IS NOT NULL AND l.ev_lon IS NOT NULL
      THEN
        6371 * 2 * asin(
          sqrt(
            pow(sin( ((l.ev_lat - u.u_lat) * pi()/180.0) / 2 ), 2) +
            cos(u.u_lat * pi()/180.0) * cos(l.ev_lat * pi()/180.0) *
            pow(sin( ((l.ev_lon - u.u_lon) * pi()/180.0) / 2 ), 2)
          )
        )
      ELSE NULL
    END AS dist_km,

    COALESCE(egm.matches / NULLIF((SELECT cnt FROM user_genre_count), 0), 0) AS genre_score,

    GREATEST(0, 1 - (DATE_PART('day', l."startsAt" - now()) / 30.0)) AS recency_score,

    LEAST(1.0, COALESCE(p.attendees_cnt, 0) / 50.0) AS popularity_score,

    CASE
      WHEN (u.u_lat IS NOT NULL AND u.u_lon IS NOT NULL
            AND l.ev_lat IS NOT NULL AND l.ev_lon IS NOT NULL) THEN NULL
      WHEN u.u_idCity     IS NOT NULL AND l.ev_idCity     = u.u_idCity     THEN 1.0
      WHEN u.u_idProvince IS NOT NULL AND l.ev_idProvince = u.u_idProvince THEN 0.7
      WHEN u.u_idCountry  IS NOT NULL AND l.ev_idCountry  = u.u_idCountry  THEN 0.5
      ELSE 0.2
    END AS proximity_fallback

  FROM ev_loc l
  LEFT JOIN u_one u ON TRUE
  LEFT JOIN event_genre_match egm ON egm."idEvent" = l."idEvent"
  LEFT JOIN pop               p   ON p."idEvent"   = l."idEvent"
),

final AS (
  SELECT
    s.*,
    CASE
      WHEN s.dist_km IS NOT NULL THEN GREATEST(0, 1 - s.dist_km/50.0)
      ELSE s.proximity_fallback
    END AS proximity_score
  FROM scored s
)

SELECT
  "idEvent", "name", "description", "visibility", "capacityMax",
  "idAddress", "startsAt", "endsAt",
  dist_km, genre_score, proximity_score, recency_score, popularity_score,
(
  ROUND(
    (
      0.45*genre_score +
      0.25*proximity_score +
      0.20*recency_score +
      0.10*popularity_score
    )::numeric
  , 4)
)::float8 AS score
FROM final
ORDER BY score DESC, "startsAt" ASC
LIMIT $3;
`;

const SQL_FALLBACK = `
SELECT
  e."idEvent", e."name", e."description", e."visibility",
  e."capacityMax", e."idAddress", e."startsAt", e."endsAt",
  NULL::float8 AS dist_km,
  0.0::float8  AS genre_score,
  0.2::float8  AS proximity_score,
  GREATEST(0, 1 - (DATE_PART('day', e."startsAt" - now()) / 30.0)) AS recency_score,
  LEAST(1.0, COALESCE(att.cntx,0) / 50.0) AS popularity_score,
(
  ROUND(
    (
      0.25*0.2 +
      0.20*GREATEST(0, 1 - (DATE_PART('day', e."startsAt" - now()) / 30.0)) +
      0.10*LEAST(1.0, COALESCE(att.cntx,0) / 50.0)
    )::numeric
  , 4)
)::float8 AS score
FROM "Directory"."Event" e
LEFT JOIN (
  SELECT "idEvent", COUNT(*)::float AS cntx
  FROM "Directory"."EventAttendee"
  GROUP BY "idEvent"
) att USING("idEvent")
WHERE e."visibility" = 'public'
  AND e."startsAt" >= now()
ORDER BY score DESC, e."startsAt" ASC
LIMIT $1;
`;

export async function recommendEventsRepo(
    idUser: number,
    daysAhead = 60,
    limit = 20
): Promise<DiscoverItem[]> {
    const { rows } = await pool.query<DiscoverItem>(SQL_RECOMMEND, [idUser, daysAhead, limit]);
    return rows;
}

export async function recommendEventsFallbackRepo(
    limit = 20
): Promise<DiscoverItem[]> {
    const { rows } = await pool.query<DiscoverItem>(SQL_FALLBACK, [limit]);
    return rows;
}
