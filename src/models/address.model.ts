export interface Country {
  idCountry: number;
  countryCode: string;
  countryDesc: string;
};

export interface Province {
  idProvince: number;
  idCountry: number;
  provinceCode: string;
  provinceDesc: string;
}

export interface City {
  idCity: number;
  idProvince: number;
  postalCode: string;
  cityDesc: string;
  latitude?: number | null;
  longitude?: number | null;
}