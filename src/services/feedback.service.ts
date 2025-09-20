import {
  upsertReviewRepo,
  listReviewsRepo,
  getRatingSummaryRepo,
  createCommentRepo,
  listCommentsRepo,
  createReportRepo,
  ReviewWithAuthor,
  CommentWithAuthor,
  ReviewRow,
  CommentRow,
  ReportRow,
  RatingSummary,
} from "../repositories/feedback.repository.js";

/* -------------------- REVIEWS -------------------- */

export async function upsertReviewSvc(params: {
  authorIdUser: number;
  targetIdUser: number;
  rating: number;
  comment?: string | null;
}): Promise<ReviewRow> {
  const { authorIdUser, targetIdUser, rating } = params;
  if (!Number.isFinite(authorIdUser) || !Number.isFinite(targetIdUser)) {
    throw new Error("invalid_user");
  }
  if (authorIdUser === targetIdUser) throw new Error("self_review_not_allowed");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5)
    throw new Error("invalid_rating");

  return upsertReviewRepo(
    targetIdUser,
    authorIdUser,
    Math.round(rating),
    params.comment ?? null
  );
}

export async function listReviewsSvc(
  targetIdUser: number,
  limit = 20,
  offset = 0
): Promise<{ items: ReviewWithAuthor[]; summary: RatingSummary }> {
  const [items, summary] = await Promise.all([
    listReviewsRepo(targetIdUser, limit, offset),
    getRatingSummaryRepo(targetIdUser),
  ]);
  return { items, summary: summary ?? { idUser: targetIdUser, avgRating: null, ratingsCount: 0 } };
}

export async function getRatingSummarySvc(
  idUser: number
): Promise<RatingSummary> {
  return (await getRatingSummaryRepo(idUser)) ?? {
    idUser,
    avgRating: null,
    ratingsCount: 0,
  };
}

/* -------------------- COMMENTS -------------------- */

export async function createCommentSvc(params: {
  authorIdUser: number;
  targetIdUser: number;
  body: string;
  parentId?: number | null;
}): Promise<CommentRow> {
  const { authorIdUser, targetIdUser, body } = params;
  if (!Number.isFinite(authorIdUser) || !Number.isFinite(targetIdUser)) {
    throw new Error("invalid_user");
  }
  if (!body || !body.trim()) throw new Error("empty_body");

  return createCommentRepo(
    targetIdUser,
    authorIdUser,
    body.trim(),
    params.parentId ?? null
  );
}

export async function listCommentsSvc(
  targetIdUser: number,
  limit = 20,
  offset = 0
): Promise<{ items: CommentWithAuthor[] }> {
  const items = await listCommentsRepo(targetIdUser, limit, offset);
  return { items };
}

/* -------------------- REPORTS -------------------- */

export async function createReportSvc(params: {
  reporterIdUser: number;
  reportedIdUser: number;
  reasonCode: string;
  description?: string | null;
}): Promise<ReportRow> {
  const { reporterIdUser, reportedIdUser, reasonCode } = params;
  if (!Number.isFinite(reporterIdUser) || !Number.isFinite(reportedIdUser)) {
    throw new Error("invalid_user");
  }
  if (reporterIdUser === reportedIdUser)
    throw new Error("self_report_not_allowed");
  if (!reasonCode || !reasonCode.trim()) throw new Error("invalid_reason");

  return createReportRepo(
    reportedIdUser,
    reporterIdUser,
    reasonCode.trim(),
    params.description ?? null
  );
}
