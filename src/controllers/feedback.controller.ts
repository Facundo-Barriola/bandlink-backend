import type { Request, Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import {
  upsertReviewSvc,
  listReviewsSvc,
  getRatingSummarySvc,
  createCommentSvc,
  listCommentsSvc,
  createReportSvc,
} from "../services/feedback.service.js";

/*  POST /feedback/reviews  */
export async function upsertReviewController(req: AuthRequest, res: Response) {
  try {
    const authorIdUser = req.user?.idUser;
    if (!authorIdUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { targetIdUser, rating, comment } = req.body || {};
    const data = await upsertReviewSvc({
      authorIdUser,
      targetIdUser: Number(targetIdUser),
      rating: Number(rating),
      comment: comment ?? null,
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    const code = ["invalid_user", "self_review_not_allowed", "invalid_rating"].includes(err.message) ? 400 : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}

/*  GET /feedback/reviews?targetIdUser=..&limit=&offset=  */
export async function listReviewsController(req: Request, res: Response) {
  try {
    const targetIdUser = Number(req.query.targetIdUser);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!Number.isFinite(targetIdUser))
      return res.status(400).json({ ok: false, error: "invalid_user" });

    const data = await listReviewsSvc(targetIdUser, limit, offset);
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/*  GET /feedback/summary/:idUser  */
export async function getRatingSummaryController(req: Request, res: Response) {
  try {
    const idUser = Number(req.params.idUser);
    if (!Number.isFinite(idUser))
      return res.status(400).json({ ok: false, error: "invalid_user" });

    const data = await getRatingSummarySvc(idUser);
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/*  POST /feedback/comments  */
export async function createCommentController(req: AuthRequest, res: Response) {
  try {
    const authorIdUser = req.user?.idUser;
    if (!authorIdUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { targetIdUser, body, parentId } = req.body || {};
    const data = await createCommentSvc({
      authorIdUser,
      targetIdUser: Number(targetIdUser),
      body: String(body ?? ""),
      parentId: parentId == null ? null : Number(parentId),
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    const code = ["invalid_user", "empty_body"].includes(err.message) ? 400 : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}

/*  GET /feedback/comments?targetIdUser=..&limit=&offset=  */
export async function listCommentsController(req: Request, res: Response) {
  try {
    const targetIdUser = Number(req.query.targetIdUser);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!Number.isFinite(targetIdUser))
      return res.status(400).json({ ok: false, error: "invalid_user" });

    const data = await listCommentsSvc(targetIdUser, limit, offset);
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/*  POST /feedback/reports  */
export async function createReportController(req: AuthRequest, res: Response) {
  try {
    const reporterIdUser = req.user?.idUser;
    if (!reporterIdUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { reportedIdUser, reasonCode, description } = req.body || {};
    const data = await createReportSvc({
      reporterIdUser,
      reportedIdUser: Number(reportedIdUser),
      reasonCode: String(reasonCode ?? ""),
      description: description ?? null,
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    const code = ["invalid_user", "self_report_not_allowed", "invalid_reason"].includes(err.message) ? 400 : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}
