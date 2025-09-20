import { pool } from "../config/database.js";

export type ReviewRow = {
  idReview: number;
  targetIdUser: number;
  authorIdUser: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewWithAuthor = ReviewRow & {
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
};

export type RatingSummary = {
  idUser: number;
  avgRating: number | null;
  ratingsCount: number;
};

export type CommentRow = {
  idComment: number;
  targetIdUser: number;
  authorIdUser: number;
  body: string;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CommentWithAuthor = CommentRow & {
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
};

export type ReportRow = {
  idReport: number;
  reportedIdUser: number;
  reporterIdUser: number;
  reasonCode: string;
  description: string | null;
  status: "open" | "reviewing" | "resolved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
};

export function one<T>(rows: T[], err: string): T {
  const row = rows[0];
  if (!row) throw new Error(err);
  return row;
}

/* -------------------- REVIEWS -------------------- */

export async function upsertReviewRepo(
  targetIdUser: number,
  authorIdUser: number,
  rating: number,
  comment: string | null
): Promise<ReviewRow> {
  const SQL = `
    INSERT INTO "Feedback"."Review"
      ("targetIdUser","authorIdUser",rating,comment)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT ("targetIdUser","authorIdUser")
    DO UPDATE SET rating = EXCLUDED.rating,
                  comment = EXCLUDED.comment,
                  "updatedAt" = now()
    RETURNING *;
  `;
  const { rows } = await pool.query<ReviewRow>(SQL, [
    targetIdUser,
    authorIdUser,
    rating,
    comment,
  ]);
  return one(rows, "upsert_review_failed");
}

export async function listReviewsRepo(
  targetIdUser: number,
  limit = 20,
  offset = 0
): Promise<ReviewWithAuthor[]> {
  const SQL = `
    SELECT
      r.*,
      up."displayName" AS "authorDisplayName",
      up."avatarUrl"   AS "authorAvatarUrl"
    FROM "Feedback"."Review" r
    LEFT JOIN "Directory"."UserProfile" up
      ON up."idUser" = r."authorIdUser"
    WHERE r."targetIdUser" = $1
    ORDER BY r."createdAt" DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await pool.query<ReviewWithAuthor>(SQL, [
    targetIdUser,
    limit,
    offset,
  ]);
  return rows;
}

export async function getRatingSummaryRepo(
  idUser: number
): Promise<RatingSummary | null> {
  // Usa la vista si existe; si no, calcula inline
  const SQL = `
    SELECT
      $1::int AS "idUser",
      ROUND(AVG(r.rating)::numeric, 2) AS "avgRating",
      COUNT(*)::int AS "ratingsCount"
    FROM "Feedback"."Review" r
    WHERE r."targetIdUser" = $1;
  `;
  const { rows } = await pool.query<RatingSummary>(SQL, [idUser]);
  const row = rows[0];
  if (!row) return { idUser, avgRating: null, ratingsCount: 0 };
  return row;
}

/* -------------------- COMMENTS -------------------- */

export async function createCommentRepo(
  targetIdUser: number,
  authorIdUser: number,
  body: string,
  parentId: number | null
): Promise<CommentRow> {
  const SQL = `
    INSERT INTO "Feedback"."Comment"
      ("targetIdUser","authorIdUser",body,"parentId")
    VALUES ($1,$2,$3,$4)
    RETURNING *;
  `;
  const { rows } = await pool.query<CommentRow>(SQL, [
    targetIdUser,
    authorIdUser,
    body,
    parentId,
  ]);
  return one(rows, "create_comment_failed");
}

export async function listCommentsRepo(
  targetIdUser: number,
  limit = 20,
  offset = 0
): Promise<CommentWithAuthor[]> {
  const SQL = `
    SELECT
      c.*,
      up."displayName" AS "authorDisplayName",
      up."avatarUrl"   AS "authorAvatarUrl"
    FROM "Feedback"."Comment" c
    LEFT JOIN "Directory"."UserProfile" up
      ON up."idUser" = c."authorIdUser"
    WHERE c."targetIdUser" = $1
    ORDER BY c."createdAt" DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await pool.query<CommentWithAuthor>(SQL, [
    targetIdUser,
    limit,
    offset,
  ]);
  return rows;
}

/* -------------------- REPORTS -------------------- */

export async function createReportRepo(
  reportedIdUser: number,
  reporterIdUser: number,
  reasonCode: string,
  description: string | null
): Promise<ReportRow> {
  const SQL = `
    INSERT INTO "Feedback"."Report"
      ("reportedIdUser","reporterIdUser","reasonCode",description)
    VALUES ($1,$2,$3,$4)
    RETURNING *;
  `;
  const { rows } = await pool.query<ReportRow>(SQL, [
    reportedIdUser,
    reporterIdUser,
    reasonCode,
    description,
  ]);
  return one(rows, "create_report_failed");
}
