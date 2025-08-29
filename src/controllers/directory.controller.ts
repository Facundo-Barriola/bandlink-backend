import { Request, Response } from "express";
import { DirectoryService } from "../services/directory.service.js";
import { LegacyReturn } from "../types/LegacyReturn.js";
import type { AuthRequest } from "../types/authRequest.js";

export async function getInstrumentsController(req: Request, res: Response) {
  const data = await DirectoryService.listInstruments();
  res.json({ ok: true, data });
}

export async function getAmenitiesController(req: Request, res: Response) {
  const data = await DirectoryService.listAmenities();
  res.json({ ok: true, data });
}

export async function getGenresController(req: Request, res: Response) {
  const data = await DirectoryService.listGenres();
  res.json({ ok: true, data });
}

export async function getMusicianProfileController(req: Request, res: Response) {
  const idUser = Number(req.params.id);
  if (!Number.isFinite(idUser)) {
    return res.status(400).json({ ok: false, error: "idUser inválido" });
  }

  try {
    const r = await DirectoryService.getMusicianProfileByUser(idUser);
    if (!r?.legacy?.user) {
      return res.status(404).json({ ok: false, error: "Perfil no encontrado" });
    }

    const payload = {
      userData: r.legacy.user,
      musician: r.legacy.musician,
      bands: r.legacy.bands ?? [],
      eventsCreated: r.legacy.eventsCreated ?? [],
      ...(r.musicianProfile
        ? {
          eventsUpcoming: r.musicianProfile.eventsUpcoming,
          eventsUpcomingCount: r.musicianProfile.eventsUpcomingCount,
          eventsPastCount: r.musicianProfile.eventsPastCount,
        }
        : {}),
    };

    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function updateMusicianProfileController(req: AuthRequest, res: Response) {
  const idUser = req.params.id;
  const routeId = Number(req.params.id)
  console.log("req userId", req.userId);
  if(req.userId == null){
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  if (!Number.isFinite(routeId)) {
    return res.status(400).json({ ok: false, error: "idUser inválido" });
  }
  if (req.userId !== routeId) {
    return res.status(403).json({ ok: false, error: "Forbidden: no podés editar este perfil" });
  }
  const b = (req.body ?? {}) as any;
  const u = b.user ?? {};
  const m = b.musician ?? {};

  const firstDefined = <T>(...vals: T[]) =>
    vals.find(v => v !== undefined);

  const normSkill = (v: any) => {
    if (v == null) return null;
    const t = String(v).toLowerCase();
    if (["intermedio", "intermediate"].includes(t)) return "intermediate";
    if (["principiante", "beginner"].includes(t)) return "beginner";
    if (["avanzado", "advanced"].includes(t)) return "advanced";
    return String(v); // deja tal cual si usás valores libres
  };

  const normDate = (v: any) => {
    if (v == null) return null;
    const s = String(v);
    return s.includes("T") ? s.slice(0, 10) : s;
  };

  const displayName = firstDefined(b.displayName, u.displayName) ?? null;
  const bio = firstDefined(b.bio, u.bio) ?? null;
  const isAvailable = firstDefined(b.isAvailable, m.isAvailable) ?? null;
  const experienceYears = firstDefined(b.experienceYears, m.experienceYears) ?? null;
  const skillLevel = normSkill(firstDefined(b.skillLevel, m.skillLevel));
  const travelRadiusKm = firstDefined(b.travelRadiusKm, m.travelRadiusKm) ?? null;
  const visibility = firstDefined(b.visibility, m.visibility) ?? null;
  const birthDate = normDate(firstDefined(b.birthDate, m.birthDate));
  const instruments = firstDefined(b.instruments, m.instruments);
  const genres = firstDefined(b.genres, m.genres);
  try {
    const result = await DirectoryService.updateMusicianProfile(routeId, displayName, bio, isAvailable,
      experienceYears, skillLevel, travelRadiusKm, visibility,
      birthDate, instruments, genres);
    if (!result) {
      return res.status(404).json({ ok: false, error: "Perfil no se pudo actualizar" });
    }
    return res.json({ ok: true, data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function getMusicianByNameController(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 8, 50);
  const offset = Number(req.query.offset) || 0;

  // géneros como CSV: ?genres=rock,metal
  const genres = typeof req.query.genres === "string"
    ? (req.query.genres as string).split(",").map(s => s.trim()).filter(Boolean)
    : undefined;

  if (q.length < 2) {
    return res.json({ ok: true, data: { items: [], nextOffset: null } });
  }

  try {
    const items = await DirectoryService.searchMusiciansByName(q, genres, limit, offset);
    res.json({
      ok: true,
      data: { items, nextOffset: items.length === limit ? offset + limit : null }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
}

export async function getStudioProfileByIdController(req: Request, res: Response){
  const idUser = Number(req.params.id);
    if (!Number.isFinite(idUser)) {
    return res.status(400).json({ ok: false, error: "idUser inválido" });
  }
  try {
    const r = await DirectoryService.getStudioProfileByUser(idUser);
    if (!r?.userData) {
      return res.status(404).json({ ok: false, error: "Estudio no encontrado" });
    }
    return res.json({
      ok: true,
      data: {
        userData: r.userData,
        studio: r.studio,
        amenities: r.amenities,
        rooms: r.rooms,
        eventsAtStudio: r.eventsAtStudio,
        eventsUpcomingCount: r.eventsUpcomingCount,
        eventsPastCount: r.eventsPastCount,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}