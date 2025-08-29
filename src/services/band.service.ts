import {
  BandRepository,
  CreateBandInput,
  UpdateBandInput,
  CreateBandResult,
  UpdateBandResult,
  DeleteBandResult,
  GetBandResult,
} from "../repositories/band.repository.js";

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