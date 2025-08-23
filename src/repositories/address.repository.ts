import { pool } from "../config/database.js";
import {Country, Province, City} from "../models/address.model.js";

const COUNTRY_TABLE = `"Address"."Country"`;
const PROVINCE_TABLE = `"Address"."Province"`;
const CITY_TABLE = `"Address"."City"`;

export async function getCountries(): Promise<Country[]> {
    const { rows } = await pool.query(`SELECT "idCountry","countryCode","countryDesc" FROM ${COUNTRY_TABLE} ORDER BY "countryDesc"`);
    return rows;
}

export async function getProvincesByCountryId(countryId: number | string): Promise<Province[]> {
    const { rows } = await pool.query(
        `SELECT "idProvince","idCountry","provinceCode","provinceDesc" FROM ${PROVINCE_TABLE} WHERE "idCountry" = $1 ORDER BY "provinceDesc"`,
        [Number(countryId)]
    );
    return rows;
}

export async function getCitiesByProvinceId(provinceId: number | string): Promise<City[]> {
    const { rows } = await pool.query(
        `SELECT "idCity","idProvince","postalCode","cityDesc","latitude","longitude" FROM ${CITY_TABLE} WHERE "idProvince" = $1 ORDER BY "cityDesc"`,
        [Number(provinceId)]
    );
    return rows;
}