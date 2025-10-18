// services/account.service.ts
import type { PoolClient } from "pg";
import { withTransaction } from "../config/database.js";
import { insertNewUserWithGroupTx, deleteAccountByUserId } from "../repositories/user.repository.js";
import { createMusicianProfileTx, createStudioProfileTx } from "../repositories/directory.repository.js";
import { hashPassword } from "../utils/crypto.js";
import { CreateMusicianParams } from "../types/createMusicianParams.js";
import { CreateStudioParams } from "../types/createStudioParams.js";
import { DeleteAccountResult } from "../types/deleteAccountResult.js";
import { AddressService } from "./address.service.js";

type Role = "musico" | "sala" | "estandar";
const groupIdFor = (role: Role) => (role === "musico" ? 2 : role === "sala" ? 3 : 4);

export type RegisterFullInput = {
    email: string;
    password: string;
    role: Role;
    profile: {
        displayName: string;
        bio?: string | null;
        idAddress?: number | null;
        latitude?: number | null;
        longitude?: number | null;
        address?: {
            street: string;
            streetNum: number;
            addressDesc?: string | null;
            provinceName?: string | null;
            municipioName?: string | null;
            barrioName?: string | null;
        };
    };
    musician?: CreateMusicianParams | null;
    studio?: CreateStudioParams | null;
};

export class AccountService {
    static async registerFull(input: RegisterFullInput) {
        const idUserGroup = groupIdFor(input.role);
        const pwdHash = await hashPassword(input.password);

        return withTransaction(async (client: PoolClient) => {
            // 1) User
            const idUser = await insertNewUserWithGroupTx(client, input.email, pwdHash, idUserGroup);
            console.log("Paso insertnewuser", idUser);
            // 2) Perfil según rol (NO crear UserProfile aparte: lo hace la función SQL)
            if (input.role === "musico") {
                const m: Partial<CreateMusicianParams> = input.musician ?? {};
                const r = await createMusicianProfileTx(client, {
                    idUser: idUser,
                    displayName: input.profile.displayName,
                    bio: input.profile.bio ?? null,
                    idAddress: input.profile.idAddress ?? null,
                    latitude: input.profile.latitude ?? null,
                    longitude: input.profile.longitude ?? null,

                    experienceYears: m.experienceYears ?? null,
                    skillLevel: m.skillLevel ?? "intermediate",
                    isAvailable: m.isAvailable ?? true,
                    travelRadiusKm: m.travelRadiusKm ?? 10,
                    visibility: m.visibility ?? "city",
                    birthDate: m.birthDate ?? null,

                    instruments: m.instruments ?? [],   // [] permitido
                    genres: m.genres ?? [],
                });

                return { idUser, idUserProfile: r.idUserProfile, idMusician: r.idMusician };
            }

            if (input.role === "sala") {
                const s: Partial<CreateStudioParams> = input.studio ?? {};
                let idAddress =
                    input.profile.idAddress ??
                    s.idAddress ??
                    null;
                const addrBlock = input.profile.address ?? s.address ?? null;

                if (!idAddress && addrBlock) {
                    const { street, streetNum, addressDesc, provinceName, municipioName, barrioName } = addrBlock;
                    if (!street?.trim() || !Number.isFinite(Number(streetNum))) {
                        throw new Error("Faltan datos para crear la dirección");
                    }
                    // crea dentro de la MISMA transacción
                    idAddress = await AddressService.createAddress(client, {
                        street: street.trim(),
                        streetNum: Number(streetNum),
                        addressDesc: addressDesc ?? null,
                        provinceName: provinceName ?? null,
                        municipioName: municipioName ?? null,
                        barrioName: barrioName ?? null,
                    });
                    // opcional: log
                    console.log("Address creada idAddress=", idAddress);
                }
                const r = await createStudioProfileTx(client, {
                    idUser,
                    displayName: input.profile.displayName,
                    bio: input.profile.bio ?? null,
                    idAddress,
                    latitude: input.profile.latitude ?? null,
                    longitude: input.profile.longitude ?? null,

                    legalName: s.legalName ?? null,
                    phone: s.phone ?? null,
                    website: s.website ?? null,
                    isVerified: s.isVerified ?? false,
                    openingHours: s.openingHours ?? null,
                    cancellationPolicy: s.cancellationPolicy ?? null,

                    amenities: s.amenities ?? [],
                    rooms: (s.rooms ?? []).map(rm => ({
                        roomName: rm.roomName,
                        capacity: rm.capacity ?? null,
                        hourlyPrice: rm.hourlyPrice,
                        notes: rm.notes ?? null,
                        equipment: rm.equipment ?? [],
                    })),
                });

                return { idUser, idUserProfile: r.idUserProfile, idStudio: r.idStudio };
            }

            // estándar
            return { idUser };
        });
    }

    static async deleteAccount(userId: number): Promise<DeleteAccountResult> {
        if (!Number.isInteger(userId) || userId <= 0) {
            const e = new Error("userId inválido");
            (e as any).status = 400;
            throw e;
        }
        const result = await deleteAccountByUserId(userId);

        if (!result.ok || result.deleted_user !== 1) {
            const e = new Error("No se pudo borrar la cuenta");
            (e as any).status = 409;
            (e as any).details = result;
            throw e;
        }

        return result;
    }
}

