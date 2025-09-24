import {
  BandRepository,
  CreateBandInput,
  UpdateBandInput,
  CreateBandResult,
  UpdateBandResult,
  DeleteBandResult,
  GetBandResult,
  getMusicianIdByUserId,
  isBandAdmin,
  insertBandSearch,
  listBandSearches,
  deactivateSearch, 
  getAllBandsByAdminId
} from "../repositories/band.repository.js";
  export type PublishSearchDTO = {
  title: string;
  description?: string | null;
  idInstrument?: number | null;
  minSkillLevel?: string | null;
  isRemote?: boolean;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};
export class BandService {

  static async createBand(newBand: CreateBandInput): Promise<CreateBandResult> {
    return BandRepository.createBand(newBand);
  }

  static async updateBand(input: UpdateBandInput): Promise<UpdateBandResult> {
    return BandRepository.updateBand(input);
  }

  static async deleteBand(idBand: number): Promise<DeleteBandResult> {
    return BandRepository.deleteBand(idBand);
  }

  static async getBand(idBand: number): Promise<GetBandResult> {
    return BandRepository.getBand(idBand);
  }

}

export async function publish(userId: number, idBand: number, dto: PublishSearchDTO) {
  const idMusician = await getMusicianIdByUserId(userId);
  if (!idMusician) {
    return { ok: false, info: "no_musician_profile" as const };
  }
  const admin = await isBandAdmin(idBand, idMusician);
  if (!admin) {
    return { ok: false, info: "not_admin" as const };
  }
  if (!dto.title || dto.title.trim().length < 3) {
    return { ok: false, info: "invalid_title" as const };
  }
  const inserted = await insertBandSearch({
    idBand,
    title: dto.title.trim(),
    description: dto.description?.trim() || null,
    idInstrument: dto.idInstrument ?? null,
    minSkillLevel: dto.minSkillLevel ?? null,
    isRemote: Boolean(dto.isRemote),
    idAddress: dto.idAddress ?? null,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
  });

  return { ok: true as const, search: inserted };
}

export async function listByBand(userId: number, idBand: number) {
  const rows = await listBandSearches(idBand);
  return { ok: true as const, items: rows };
}

export async function deactivate(userId: number, idBand: number, idSearch: number) {
  const idMusician = await getMusicianIdByUserId(userId);
  if (!idMusician) return { ok: false, info: "no_musician_profile" as const };

  const admin = await isBandAdmin(idBand, idMusician);
  if (!admin) return { ok: false, info: "not_admin" as const };

  const updated = await deactivateSearch(idSearch, idBand);
  if (!updated) return { ok: false, info: "not_found" as const };

  return { ok: true as const, search: updated };
}

export async function searchBandByName(name: string, limit = 8){
    const foundBands = await BandRepository.getBandsByName(name, limit);
    return foundBands;
}

export async function getAllBandsFromAdmin(idUser: number){
  const bands = await getAllBandsByAdminId(idUser);
  return bands;
}