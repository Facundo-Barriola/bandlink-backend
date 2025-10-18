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

export type BandDiscoverItem = {
  idBand: number;
  idSearch: number;
  bandName: string;
  title: string;
  description: string | null;
  idInstrument: number | null;
  instrumentName: string | null;
  genres: string[];
  createdAt: string;
  dist_km: number | null;
  genre_score: number;
  proximity_score: number;
  recency_score: number;
  popularity_score: number;
  score: number;
};

export type StudioDiscoverItem = {
  idUser: number;
  displayName: string;
  avatarUrl: string | null;
  lat: number | null;
  lon: number | null;
  dist_km: number | null;
  rating_avg: number | null;
  rating_cnt: number;
  rating_score: number;
  proximity_score: number;
  score: number;
};

export type DiscoverMusicianItem = {
  idUser: number;
  idMusician: number;
  displayName: string;
  avatarUrl: string | null;
  dist_km: number | null;
  genre_matches: number;
  my_genres_cnt: number;
  their_genres_cnt: number;
  inst_matches: number;
  my_inst_cnt: number;
  their_inst_cnt: number;
  genre_score: number;      // 0..1
  instrument_score: number; // 0..1
  proximity_score: number;  // 0..1
  score: number;            // ponderado
};

const SQL_MUSICIANS = `
WITH
me AS (
  SELECT
    up."idUser",
    up."idUserProfile",
    COALESCE(up.latitude::float8, uc.latitude::float8)   AS u_lat,
    COALESCE(up.longitude::float8, uc.longitude::float8) AS u_lon
  FROM "Directory"."UserProfile" up
  LEFT JOIN "Address"."Address" ua ON ua."idAddress" = up."idAddress"
  LEFT JOIN "Address"."City"    uc ON uc."idCity"     = ua."idCity"
  WHERE up."idUser" = $1
),
my_musician AS (
  SELECT m."idMusician"
  FROM "Directory"."Musician" m
  JOIN me ON me."idUserProfile" = m."idUserProfile"
),
my_genres AS (SELECT mg."idGenre" FROM "Directory"."MusicianGenre" mg JOIN my_musician mm ON mm."idMusician"=mg."idMusician"),
my_inst   AS (SELECT mi."idInstrument" FROM "Directory"."MusicianInstrument" mi JOIN my_musician mm ON mm."idMusician"=mi."idMusician"),
my_genres_cnt AS (SELECT COUNT(*)::float8 AS c FROM my_genres),
my_inst_cnt   AS (SELECT COUNT(*)::float8 AS c FROM my_inst),

candidates AS (
  SELECT
    up."idUser",
    m2."idMusician",
    up."displayName",
    up."avatarUrl",
    up.latitude::float8 AS lat,
    up.longitude::float8 AS lon
  FROM "Directory"."Musician" m2
  JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m2."idUserProfile"
  WHERE up."idUser" <> $1
),

cand_genres AS (
  SELECT c."idMusician", COUNT(*)::float8 AS their_genres_cnt
  FROM "Directory"."MusicianGenre" mg2
  JOIN candidates c ON c."idMusician" = mg2."idMusician"
  GROUP BY c."idMusician"
),
cand_inst AS (
  SELECT c."idMusician", COUNT(*)::float8 AS their_inst_cnt
  FROM "Directory"."MusicianInstrument" mi2
  JOIN candidates c ON c."idMusician" = mi2."idMusician"
  GROUP BY c."idMusician"
),
genre_match AS (
  SELECT c."idMusician", COUNT(*)::float8 AS genre_matches
  FROM "Directory"."MusicianGenre" mg2
  JOIN my_genres g USING ("idGenre")
  JOIN candidates c ON c."idMusician" = mg2."idMusician"
  GROUP BY c."idMusician"
),
inst_match AS (
  SELECT c."idMusician", COUNT(*)::float8 AS inst_matches
  FROM "Directory"."MusicianInstrument" mi2
  JOIN my_inst i USING ("idInstrument")
  JOIN candidates c ON c."idMusician" = mi2."idMusician"
  GROUP BY c."idMusician"
),

scored AS (
  SELECT
    c.*,
    COALESCE(gm.genre_matches, 0) AS genre_matches,
    COALESCE(ci.their_genres_cnt, 0) AS their_genres_cnt,
    COALESCE(im.inst_matches, 0)  AS inst_matches,
    COALESCE(ii.their_inst_cnt, 0) AS their_inst_cnt,
    (SELECT c FROM my_genres_cnt) AS my_genres_cnt,
    (SELECT c FROM my_inst_cnt)   AS my_inst_cnt
  FROM candidates c
  LEFT JOIN genre_match gm ON gm."idMusician" = c."idMusician"
  LEFT JOIN cand_genres  ci ON ci."idMusician" = c."idMusician"
  LEFT JOIN inst_match   im ON im."idMusician" = c."idMusician"
  LEFT JOIN cand_inst    ii ON ii."idMusician" = c."idMusician"
),
with_loc AS (
  SELECT
    s.*,
    me.u_lat, me.u_lon
  FROM scored s
  LEFT JOIN me ON TRUE
),
final AS (
  SELECT
    w.*,
    CASE
      WHEN w.u_lat IS NOT NULL AND w.u_lon IS NOT NULL AND w.lat IS NOT NULL AND w.lon IS NOT NULL
      THEN 6371 * 2 * asin(
        sqrt(
          pow(sin(((w.lat - w.u_lat) * pi()/180)/2),2) +
          cos(w.u_lat*pi()/180) * cos(w.lat*pi()/180) *
          pow(sin(((w.lon - w.u_lon) * pi()/180)/2),2)
        )
      )
      ELSE NULL
    END AS dist_km
  FROM with_loc w
)
SELECT
  "idUser","idMusician","displayName","avatarUrl",
  dist_km,
  genre_matches, my_genres_cnt, their_genres_cnt,
  inst_matches,  my_inst_cnt,   their_inst_cnt,
  CASE
    WHEN my_genres_cnt > 0 THEN LEAST(1.0, genre_matches / my_genres_cnt)
    ELSE 0.3
  END AS genre_score,
  CASE
    WHEN my_inst_cnt > 0 THEN LEAST(1.0, inst_matches / my_inst_cnt)
    ELSE 0.2
  END AS instrument_score,
  CASE
    WHEN dist_km IS NOT NULL THEN GREATEST(0, 1 - dist_km/50.0)
    ELSE 0.4
  END AS proximity_score,
  ROUND( (0.5*
            CASE WHEN my_genres_cnt > 0 THEN LEAST(1.0, genre_matches / my_genres_cnt) ELSE 0.3 END
        + 0.3*
            CASE WHEN my_inst_cnt > 0 THEN LEAST(1.0, inst_matches / my_inst_cnt) ELSE 0.2 END
        + 0.2*
            CASE WHEN dist_km IS NOT NULL THEN GREATEST(0, 1 - dist_km/50.0) ELSE 0.4 END
       )::numeric, 4)::float8 AS score
FROM final
ORDER BY score DESC, genre_matches DESC
LIMIT $2;
`;

const SQL_STUDIOS = `
WITH
u AS (
  SELECT
    up."idUser",
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

studios AS (
  SELECT
    up."idUser", up."displayName", up."avatarUrl",
    up.latitude::float8 AS lat, up.longitude::float8 AS lon,
    a."idCity", c."idProvince", p."idCountry"
  FROM "Directory"."UserProfile" up
  JOIN "Security"."User" u2 ON u2."idUser" = up."idUser"
  LEFT JOIN "Address"."Address" a ON a."idAddress" = up."idAddress"
  LEFT JOIN "Address"."City"    c ON c."idCity"     = a."idCity"
  LEFT JOIN "Address"."Province" p ON p."idProvince" = c."idProvince"
  WHERE u2."idUserGroup" = 3
),

rating AS (
  SELECT "targetIdUser" AS idUser,
         AVG("rating")::float8 AS rating_avg,
         COUNT(*)::int         AS rating_cnt
  FROM "Feedback"."Review"
  GROUP BY "targetIdUser"
),

scored AS (
  SELECT
    s.*,
    r.rating_avg, COALESCE(r.rating_cnt, 0) AS rating_cnt,
    CASE
      WHEN uo.u_lat IS NOT NULL AND uo.u_lon IS NOT NULL
       AND s.lat IS NOT NULL AND s.lon IS NOT NULL
      THEN 6371 * 2 * asin(
        sqrt(
          pow(sin( ((s.lat - uo.u_lat) * pi()/180.0) / 2 ), 2) +
          cos(uo.u_lat * pi()/180.0) * cos(s.lat * pi()/180.0) *
          pow(sin( ((s.lon - uo.u_lon) * pi()/180.0) / 2 ), 2)
        )
      )
      ELSE NULL
    END AS dist_km,
    CASE
      WHEN r.rating_avg IS NULL THEN 0
      ELSE (r.rating_avg/5.0) * 0.7 + (LEAST(r.rating_cnt, 20)/20.0) * 0.3
    END AS rating_score,
    CASE
      WHEN (uo.u_lat IS NOT NULL AND uo.u_lon IS NOT NULL AND s.lat IS NOT NULL AND s.lon IS NOT NULL)
       THEN GREATEST(0, 1 - (6371 * 2 * asin(
              sqrt(
                pow(sin( ((s.lat - uo.u_lat) * pi()/180.0) / 2 ), 2) +
                cos(uo.u_lat * pi()/180.0) * cos(s.lat * pi()/180.0) *
                pow(sin( ((s.lon - uo.u_lon) * pi()/180.0) / 2 ), 2)
              )
            ))/50.0)
      WHEN uo.u_idCity     IS NOT NULL AND s."idCity"     = uo.u_idCity     THEN 1.0
      WHEN uo.u_idProvince IS NOT NULL AND s."idProvince" = uo.u_idProvince THEN 0.7
      WHEN uo.u_idCountry  IS NOT NULL AND s."idCountry"  = uo.u_idCountry  THEN 0.5
      ELSE 0.2
    END AS proximity_score
  FROM studios s
  LEFT JOIN rating r ON r.idUser = s."idUser"
  LEFT JOIN u_one uo ON TRUE
)
SELECT
  "idUser", "displayName", "avatarUrl", lat, lon, dist_km,
  rating_avg, rating_cnt, rating_score, proximity_score,
  ROUND((0.6*rating_score + 0.4*proximity_score)::numeric, 4)::float8 AS score
FROM scored
ORDER BY score DESC, COALESCE(dist_km, 9999) ASC
LIMIT $2;
`;

const SQL_STUDIOS_FALLBACK = `
SELECT
  up."idUser", up."displayName", up."avatarUrl",
  up.latitude::float8 AS lat, up.longitude::float8 AS lon,
  NULL::float8 AS dist_km,
  NULL::float8 AS rating_avg,
  0::int      AS rating_cnt,
  0.0::float8 AS rating_score,
  0.2::float8 AS proximity_score,
  0.2::float8 AS score
FROM "Directory"."UserProfile" up
JOIN "Security"."User" u2 ON u2."idUser" = up."idUser"
WHERE u2."idUserGroup" = 3
ORDER BY up."createdAt" DESC
LIMIT $1;
`;

const SQL_BANDS = `
WITH
u AS (
  SELECT
    up."idUser",
    up."idUserProfile",
    COALESCE(up.latitude::float8, uc.latitude::float8)   AS u_lat,
    COALESCE(up.longitude::float8, uc.longitude::float8) AS u_lon
  FROM "Directory"."UserProfile" up
  LEFT JOIN "Address"."Address"  ua ON ua."idAddress" = up."idAddress"
  LEFT JOIN "Address"."City"     uc ON uc."idCity"     = ua."idCity"
  WHERE up."idUser" = $1
),
u_one AS (SELECT * FROM u LIMIT 1),

my_instruments AS (
  SELECT mi."idInstrument"
  FROM "Directory"."Musician" m
  JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
  JOIN "Directory"."MusicianInstrument" mi ON mi."idMusician" = m."idMusician"
  WHERE up."idUser" = $1
),

-- ubicamos a la banda por la ubicación de alguno de sus admins (si tiene)
admin_loc AS (
  SELECT
    bm."idBand",
    up."idUser",
    COALESCE(up.latitude::float8, uc.latitude::float8)   AS b_lat,
    COALESCE(up.longitude::float8, uc.longitude::float8) AS b_lon
  FROM "Directory"."BandMember" bm
  JOIN "Directory"."Musician"       m  ON m."idMusician"     = bm."idMusician"
  JOIN "Directory"."UserProfile"   up  ON up."idUserProfile" = m."idUserProfile"
  LEFT JOIN "Address"."Address"     ua  ON ua."idAddress"    = up."idAddress"
  LEFT JOIN "Address"."City"        uc  ON uc."idCity"       = ua."idCity"
  WHERE bm."isAdmin" = TRUE AND bm."leftAt" IS NULL
),

actives AS (
  SELECT s."idSearch", s."idBand", s.title, s."idInstrument", s."createdAt"
  FROM "Directory"."BandMusicianSearch" s
  WHERE s."isActive" = TRUE
),

joined AS (
  SELECT
    a."idSearch",
    a."idBand",
    b."name"                                AS "bandName",
    a.title,
    a."idInstrument",
    i."instrumentName"                      AS "instrumentName",
    a."createdAt",
    al.b_lat, al.b_lon
  FROM actives a
  JOIN "Directory"."Band" b               ON b."idBand" = a."idBand"
  LEFT JOIN "Directory"."Instrument" i    ON i."idInstrument" = a."idInstrument"
  LEFT JOIN LATERAL (
    SELECT * FROM admin_loc al WHERE al."idBand" = a."idBand" LIMIT 1
  ) al ON TRUE
),

scored AS (
  SELECT
    j.*,
    CASE
      WHEN u.u_lat IS NOT NULL AND u.u_lon IS NOT NULL
       AND j.b_lat IS NOT NULL AND j.b_lon IS NOT NULL
      THEN
        6371 * 2 * asin(
          sqrt(
            pow(sin(((j.b_lat - u.u_lat) * pi()/180)/2),2) +
            cos(u.u_lat*pi()/180) * cos(j.b_lat*pi()/180) *
            pow(sin(((j.b_lon - u.u_lon) * pi()/180)/2),2)
          )
        )
      ELSE NULL
    END AS dist_km,

    CASE
      WHEN j."idInstrument" IS NOT NULL
        THEN CASE
               WHEN EXISTS (
                 SELECT 1 FROM my_instruments mi
                 WHERE mi."idInstrument" = j."idInstrument"
               ) THEN 1.0 ELSE 0.0
             END
      ELSE 0.2
    END AS instrument_match,

    -- cuanto más nueva, mayor score (0..1 aprox. en últimas ~2 semanas)
    GREATEST(0, 1 - (DATE_PART('day', now() - j."createdAt") / 14.0)) AS recency_score
  FROM joined j
  LEFT JOIN u_one u ON TRUE
),

final AS (
  SELECT
    s.*,
    CASE
      WHEN s.dist_km IS NOT NULL THEN GREATEST(0, 1 - s.dist_km/50.0)
      ELSE 0.4
    END AS proximity_score
  FROM scored s
)

SELECT
  "idSearch","idBand","bandName",title,"idInstrument","instrumentName","createdAt",
  dist_km, instrument_match, recency_score, proximity_score,
  ROUND( (0.5*instrument_match + 0.3*proximity_score + 0.2*recency_score)::numeric, 4 )::float8 AS score
FROM final
ORDER BY score DESC, "createdAt" DESC
LIMIT $2;
`;

const SQL_BANDS_FALLBACK = `
SELECT
  s."idSearch",
  s."idBand",
  b."name"                      AS "bandName",
  s.title,
  s."idInstrument",
  i."instrumentName"            AS "instrumentName",
  s."createdAt",
  NULL::float8                  AS dist_km,
  COALESCE((CASE WHEN s."idInstrument" IS NULL THEN 0.2 ELSE 0.5 END), 0.2)::float8 AS instrument_match,
  GREATEST(0, 1 - (DATE_PART('day', now() - s."createdAt") / 14.0))                 AS recency_score,
  0.4::float8                   AS proximity_score,
  ROUND( (0.5*COALESCE((CASE WHEN s."idInstrument" IS NULL THEN 0.2 ELSE 0.5 END),0.2)
        + 0.3*0.4
        + 0.2*GREATEST(0, 1 - (DATE_PART('day', now() - s."createdAt") / 14.0))
  )::numeric, 4 )::float8 AS score
FROM "Directory"."BandMusicianSearch" s
JOIN "Directory"."Band" b            ON b."idBand" = s."idBand"
LEFT JOIN "Directory"."Instrument" i ON i."idInstrument" = s."idInstrument"
WHERE s."isActive" = TRUE
ORDER BY score DESC, s."createdAt" DESC
LIMIT $1;
`;

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

export async function recommendBandsRepo(idUser: number, limit = 12) {
  const { rows } = await pool.query<BandDiscoverItem>(SQL_BANDS, [idUser, limit]);
  return rows;
}
export async function recommendBandsFallbackRepo(limit = 12) {
  const { rows } = await pool.query<BandDiscoverItem>(SQL_BANDS_FALLBACK, [limit]);
  return rows;
}

export async function recommendStudiosRepo(idUser: number, limit = 9) {
  const { rows } = await pool.query<StudioDiscoverItem>(SQL_STUDIOS, [idUser, limit]);
  return rows;
}
export async function recommendStudiosFallbackRepo(limit = 9) {
  const { rows } = await pool.query<StudioDiscoverItem>(SQL_STUDIOS_FALLBACK, [limit]);
  return rows;
}

export async function recommendMusiciansRepo(idUser:number, limit=12): Promise<DiscoverMusicianItem[]> {
  const { rows } = await pool.query<DiscoverMusicianItem>(SQL_MUSICIANS, [idUser, limit]);
  return rows;
}