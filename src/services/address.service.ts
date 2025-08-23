import { getCountries, getProvincesByCountryId, getCitiesByProvinceId } from "../repositories/address.repository.js"; 
import { Country, Province, City } from "../models/address.model.js";

function toPositiveInt(id: number | string, field = "id"){
    const n = Number(id);
    if(!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${field}`);
    return n;
}

export class AddressService {
    static async listCountries(): Promise<Country[]> {
        return await getCountries();
    }

    static async listProvincesByCountryId(countryId: number | string): Promise<Province[]> {
        const id = toPositiveInt(countryId, "countryId");
        const provinces = await getProvincesByCountryId(id);
        return provinces.map<Province>(p => ({
            idProvince: p.idProvince,
            idCountry: p.idCountry,
            provinceCode: p.provinceCode,
            provinceDesc: p.provinceDesc
        }));
    }

    static async listCitiesByProvinceId(provinceId: number | string): Promise<City[]> {
        const id = toPositiveInt(provinceId, "provinceId");
        
        return await getCitiesByProvinceId(id);
    }
}