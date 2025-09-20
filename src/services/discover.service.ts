import {
  recommendEventsRepo,
  recommendEventsFallbackRepo,
  DiscoverItem,
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
