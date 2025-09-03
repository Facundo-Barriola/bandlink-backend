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
  if (req.userId == null) {
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
    return String(v); 
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

export async function getStudioProfileByIdController(req: Request, res: Response) {
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

export async function updateStudioByOwnerController(req: AuthRequest, res: Response) {
  if (req.userId == null) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  const studioId = Number(req.params.id);
  if (!Number.isFinite(studioId)) {
    return res.status(400).json({ ok: false, error: "idStudio inválido" });
  }

  const b = (req.body ?? {}) as any;
  const firstDefined = <T>(...vals: T[]) => vals.find(v => v !== undefined);

  const patch = {
    displayName: firstDefined(b.displayName, b.user?.displayName),
    bio: firstDefined(b.bio, b.user?.bio),
    idAddress: firstDefined(b.idAddress, b.user?.idAddress),
    latitude: firstDefined(b.latitude, b.user?.latitude),
    longitude: firstDefined(b.longitude, b.user?.longitude),

    legalName: firstDefined(b.legalName, b.studio?.legalName),
    phone: firstDefined(b.phone, b.studio?.phone),
    website: firstDefined(b.website, b.studio?.website),
    isVerified: firstDefined(b.isVerified, b.studio?.isVerified),

    openingHours: firstDefined(b.openingHours, b.studio?.openingHours),
    cancellationPolicy: firstDefined(b.cancellationPolicy, b.studio?.cancellationPolicy),

    amenities: firstDefined(b.amenities, b.studio?.amenities),
    rooms: firstDefined(b.rooms, b.studio?.rooms),
  };

    try {
    const result = await DirectoryService.updateStudioByOwner(req.userId, studioId, patch as any);
    if (!result?.ok) {
      const info = (result as any)?.info ?? "update_failed";
      return res.status(400).json({ ok: false, error: info });
    }
    res.json({ ok: true, data: result });
  } catch (e: any) {
    console.error(e);
    const status = e.httpStatus ?? 500;
    res.status(status).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function editStudioRoomByOwnerController(req: AuthRequest, res: Response) {
  if (req.userId == null) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  const roomId = Number(req.params.id);
  if (!Number.isFinite(roomId)) {
    return res.status(400).json({ ok: false, error: "idRoom inválido" });
  }

  const body = (req.body ?? {}) as any;
  const fields = {
    roomName: body.roomName ?? null,
    capacity: body.capacity ?? null,
    hourlyPrice: body.hourlyPrice ?? null,
    notes: body.notes ?? null,
    equipment: body.equipment ?? null, // object/json
  };

  try {
    const data = await DirectoryService.editStudioRoomByOwner(req.userId, roomId, fields);
    res.json({ ok: true, data });
  } catch (e: any) {
    console.error(e);
    const status = e.httpStatus ?? 500;
    res.status(status).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function searchMusiciansAdvancedController(req: Request, res: Response) {
  const rawInstr = req.query.instrumentId;
  const instrNum = rawInstr === undefined || rawInstr === "" ? undefined : Number(rawInstr);
  const instrumentId = Number.isFinite(instrNum!) ? (instrNum as number) : undefined;

  const rawSkill = String(req.query.skillLevel ?? "").toLowerCase();
  const skillLevel = (["beginner","intermediate","advanced","professional"] as const)
    .includes(rawSkill as any) ? (rawSkill as "beginner"|"intermediate"|"advanced"|"professional") : undefined;

  const onlyAvailable = req.query.onlyAvailable === "true";

  const rawMinExp = req.query.minExperienceYears;
  const minExpNum = rawMinExp === undefined || rawMinExp === "" ? undefined : Number(rawMinExp);
  const minExperienceYears = Number.isFinite(minExpNum!) ? (minExpNum as number) : undefined;

  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
  const offset = Number(req.query.offset ?? 0) || 0;

    const params: {
    instrumentId?: number;
    skillLevel?: "beginner" | "intermediate" | "advanced" | "professional";
    onlyAvailable?: boolean;
    minExperienceYears?: number;
    limit?: number;
    offset?: number;
  } = {
    ...(instrumentId !== undefined ? { instrumentId } : {}),
    ...(skillLevel !== undefined ? { skillLevel } : {}),
    ...(onlyAvailable ? { onlyAvailable } : {}), // si es false, omitimos (opcional)
    ...(minExperienceYears !== undefined ? { minExperienceYears } : {}),
    limit,
    offset,
  };

  try {
    const items = await DirectoryService.searchMusiciansByInstrumentAndLevel(params);
    res.json({ ok: true, data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}