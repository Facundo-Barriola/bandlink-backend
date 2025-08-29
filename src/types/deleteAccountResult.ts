export type DeleteAccountResult = {
  ok: boolean;
  deleted_user: number;
  deleted_events: number;
  had_musician: boolean;
  had_studio: boolean;
  studio_rooms: number;
  studio_equipments: number;
  studio_amenities: number;
};
