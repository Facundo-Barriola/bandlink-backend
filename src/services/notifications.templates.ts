export type BLNotificationType =
  | "band_invite"
  | "band_invite_accepted"
  | "band_invite_rejected"
  | "connection_request"
  | "connection_accepted"
  | "user_review_received";

export function linkToBand(idBand: number) {
  return { url: `/bands/${idBand}`, idBand };
}
export function linkToUser(idUser: number) {
  return { url: `/users/${idUser}`, idUser };
}
export function linkToReview(idUser: number) {
  return { url: `/users/${idUser}#reviews`, idUser };
}
