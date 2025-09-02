import { Request, Response } from "express";
import {pool} from "../config/database.js";
import { BandService } from "../services/band.service.js";

export async function createBandController(req: Request, res: Response) {
  try {
    const user = (req as any).user; 
    if (!user?.idUser) return res.status(401).json({ ok: false, error: "No autenticado" });

    const { name, description, genres, invites } = req.body ?? {};
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return res.status(400).json({ ok: false, error: "Nombre inválido" });
    }

    const q = `
      SELECT m."idMusician"
      FROM "Directory"."Musician" m
      JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
      WHERE up."idUser" = $1
      LIMIT 1
    `;
    const { rows } = await pool.query<{ idMusician: number }>(q, [user.idUser]);
    const creatorMusicianId = rows[0]?.idMusician ?? null;

    if (!creatorMusicianId) {
      return res.status(400).json({
        ok: false,
        error: "Tu usuario no tiene perfil de músico. Creá tu perfil de músico para poder crear una banda.",
      });
    }

    const idBand = await BandService.createBand({
      name: name.trim(),
      description: description?.trim() || null,
      creatorMusicianId,          
      genres: Array.isArray(genres) ? genres : [],
      members: Array.isArray(invites) ? invites : [],
    });

    return res.status(201).json({ ok: true, data: { idBand } });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}

export async function getBandController(req: Request, res: Response) {
  const idBand = Number(req.params.id);
  if (!Number.isFinite(idBand)) {
    return res.status(400).json({ ok: false, error: "id inválido" });
  }

  try {
    const data = await BandService.getBand(idBand);
    console.log(data);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}

export async function updateBandController(req: Request, res: Response) {
  const idBand = Number(req.params.id);
  if (!Number.isFinite(idBand)) {
    return res.status(400).json({ ok: false, error: "id inválido" });
  }

  try {
    const body = (req.body ?? {}) as any;

    const payload = {
      idBand,
      name: body.name ?? null,
      description: body.description ?? null,
      genres: body.genres === undefined ? undefined : (Array.isArray(body.genres) ? body.genres : []),
      members: body.members === undefined ? undefined : (Array.isArray(body.members) ? body.members : []),
    };

    const data = await BandService.updateBand(payload);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}

export async function deleteBandController(req: Request, res: Response) {
  const idBand = Number(req.params.id);
  console.log(idBand);
  if (!Number.isFinite(idBand)) {
    return res.status(400).json({ ok: false, error: "id inválido" });
  }

  try {
    const data = await BandService.deleteBand(idBand);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}
