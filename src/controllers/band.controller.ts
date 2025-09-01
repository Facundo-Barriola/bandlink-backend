import { Request, Response } from "express";
import { BandService } from "../services/band.service.js";

export async function createBandController(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as any;

    const payload = {
      name: String(body.name ?? "").trim(),
      description: body.description ?? null,
      genres: Array.isArray(body.genres) ? body.genres : [],       // [{ idGenre }]
      members: Array.isArray(body.members) ? body.members : [],    // [{ idMusician, ... }]
    };

    if (!payload.name) {
      return res.status(400).json({ ok: false, error: "name es obligatorio" });
    }

    const data = await BandService.createBand(payload);
    return res.status(201).json({ ok: true, data });
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
    const data = await req.app.locals.bandService.getBand(idBand);
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

    // Importante: undefined = no tocar; null/[] = reemplazar
    const payload = {
      idBand,
      name: body.name ?? null,
      description: body.description ?? null,
      genres: body.genres === undefined ? undefined : (Array.isArray(body.genres) ? body.genres : []),
      members: body.members === undefined ? undefined : (Array.isArray(body.members) ? body.members : []),
    };

    const data = await req.app.locals.bandService.updateBand(payload);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}

export async function deleteBandController(req: Request, res: Response) {
  const idBand = Number(req.params.id);
  if (!Number.isFinite(idBand)) {
    return res.status(400).json({ ok: false, error: "id inválido" });
  }

  try {
    const data = await req.app.locals.bandService.deleteBand(idBand);
    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error(err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ ok: false, error: err.message ?? "Error del servidor", code: err.code });
  }
}
