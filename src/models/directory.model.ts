import { OpeningHours } from "../types/openingHours.js";
import { StudioRoomEquipment } from "../types/studioRoomEquipment.js";

export interface Amenity{
    idAmenity:number;
    amenityName:string;
}

export interface Genre {
    idGenre:number;
    genreName:string;
}

export interface Instrument {
    idInstrument:number;
    instrumentName:string;
}

export interface Muscian{
    idMusician:number;
    idUserProfile:number;
    experienceLevel:number;
    skillLevel:string;
    isAvailable:boolean;
    travelRadiusKm:number;
    visibility:string;
    birthDate:Date | null;
}

export interface UserProfile{
    idUserProfile:number;
    idUser:number;
    displayName:string;
    bio:string;
    avatarUrl?:string | null;
    idAddress?:number | null;
    latitude?:number | null;
    longitude?:number | null;
}
export interface Studio{
    idStudio:number;
    idUserProfile:number;
    legalName:string;
    phone:number | null;
    website:string | null;
    isVerified:boolean;
    openingHours:OpeningHours|null;
    cancelationPolicy:string | null;
}

export interface Room{
    idRoom:number;
    idStudio:number;
    roomName:string;
    capacity:number;
    hourlyPrice:number;
    notes:string | null;
}

export interface RoomEquipment{
    idRoom:number;
    roomEquipment:StudioRoomEquipment;
}