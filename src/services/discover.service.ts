import {
  recommendEventsRepo,
  recommendEventsFallbackRepo,
  DiscoverItem,
  recommendStudiosFallbackRepo,
  recommendStudiosRepo,
  recommendMusiciansRepo,
  recommendBandsRepo,
  recommendBandsFallbackRepo,
  StudioDiscoverItem,
  BandDiscoverItem,
  DiscoverMusicianItem
} from "../repositories/discover.repository.js";

export async function discoverEventsSvc(
  idUser: number,
  days: number = 60,
  limit: number = 20
): Promise<DiscoverItem[]> {
  const rich = await recommendEventsRepo(idUser, days, limit);
  if (rich.length > 0) return rich;

  return recommendEventsFallbackRepo(limit);
}

export async function discoverBandsSvc(idUser: number, limit = 12): Promise<BandDiscoverItem[]> {
  try {
    const rich = await recommendBandsRepo(idUser, limit);
    if (rich.length > 0) return rich;
  } catch (e) {
    console.error("[discoverBandsSvc] primary query failed:", e);
  }
  return recommendBandsFallbackRepo(limit);
}

export async function discoverStudiosSvc(idUser: number, limit = 9): Promise<StudioDiscoverItem[]> {
  try {
    const rich = await recommendStudiosRepo(idUser, limit);
    if (rich.length > 0) return rich;
  } catch (e) {
    console.error("[discoverStudiosSvc] primary query failed:", e);
  }
  return recommendStudiosFallbackRepo(limit);
}

export async function discoverMusiciansSvc(idUser:number, limit=12): Promise<DiscoverMusicianItem[]> {
  return recommendMusiciansRepo(idUser, limit);
}