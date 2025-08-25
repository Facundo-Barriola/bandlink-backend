import type { PoolClient } from "pg";
import { withTransaction } from "../config/database.js";
import { insertNewUserWithGroupTx } from "../repositories/user.repository.js";
import { createUserProfileTx, createMusicianTx, createStudioTx, addStudioAmenitiesTx, addStudioRoomsTx} from "../repositories/directory.repository.js";
import { hashPassword } from "../utils/crypto.js";
import { CreateStudioInput } from "../types/createStudioInput.js";

type Role = "musico" | "sala" | "estandar";
function groupIdFor(role: Role) { return role === "musico" ? 2 : role === "sala" ? 3 : 4; }

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
    };
    musician?: {
        birthDate?: string | null;
        experienceYears?: number | null;
        skillLevel?: "beginner" | "intermediate" | "advanced" | "professional";
        isAvailable?: boolean;
        travelRadiusKm?: number | null;
        visibility?: "city" | "province" | "country" | "global";
        instruments: Array<{ idInstrument: number; isPrimary?: boolean }>;
    };
    studio?: CreateStudioInput | null // luego
};
export class AccountService {
    static async registerFull(input: RegisterFullInput) {
        const idUserGroup = groupIdFor(input.role);
        const pwdHash = await hashPassword(input.password);

        return withTransaction(async (client: PoolClient) => {
            // 1) User (Security)
            const idUser = await insertNewUserWithGroupTx(client, input.email, pwdHash, idUserGroup);
            const profileArgs = {
                idUser,
                displayName: input.profile.displayName,
                bio: input.profile.bio ?? null,
                idAddress: input.profile.idAddress ?? null,
                latitude: input.profile.latitude ?? null,
                longitude: input.profile.longitude ?? null,
            };
            // 2) UserProfile (Directory)
            const idUserProfile = await createUserProfileTx(client, profileArgs);

            // 3) Músico (si corresponde)
            if (input.role === "musico") {
                if (!input.musician?.instruments?.length) {
                    throw new Error("Faltan datos de músico o instrumentos");
                }
                const musicianArgs = {
                    idUserProfile,
                    birthDate: input.musician.birthDate ?? null,
                    experienceYears: input.musician.experienceYears ?? null,
                    skillLevel: input.musician.skillLevel ?? "intermediate",
                    isAvailable: input.musician.isAvailable ?? true,
                    travelRadiusKm: input.musician.travelRadiusKm ?? 10,
                    visibility: input.musician.visibility ?? "city",
                    instruments: input.musician.instruments ?? null,
                }
                const idMusician = await createMusicianTx(client, musicianArgs);
                return { idUser, idUserProfile, idMusician };
            }

            if (input.role === "sala") {
                if (!input.studio) throw new Error("Faltan datos de la sala/estudio.");
                console.log("Estoy dentro del service account");
                const idStudio = await createStudioTx(client, { idUserProfile, studio: input.studio });

                await addStudioAmenitiesTx(client, { idStudio, amenityIds: input.studio.amenities ?? [] });
                console.log("ssss");
                const createdRooms = await addStudioRoomsTx(client, {
                    idStudio,
                    rooms: input.studio.rooms ?? []
                });
                console.log("CreatedRooms:",createdRooms);
                return { idUser, idUserProfile, idStudio, rooms: createdRooms };
            }
            return { idUser, idUserProfile };
        });
    }
}
