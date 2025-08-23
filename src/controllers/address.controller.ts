import { Request, Response } from 'express';
import {AddressService} from '../services/address.service.js';

export async function getCountriesController(req: Request, res: Response) {
  const data = await AddressService.listCountries();
  res.json({ ok: true, data });
}

export async function getProvincesController(req: Request, res: Response) {
  const { countryId } = req.params;
  const data = await AddressService.listProvincesByCountryId(Number(countryId));
  res.json({ ok: true, data });
}

export async function getCitiesController(req: Request, res: Response) {
  const { provinceId } = req.params;
  const data = await AddressService.listCitiesByProvinceId(Number(provinceId));
  res.json({ ok: true, data });
}