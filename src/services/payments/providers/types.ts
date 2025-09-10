export type CreatePaymentForBookingParams = {
  idBooking: number;
  idUser: number;
  email?: string | null;
};

export type CreatePaymentResult =
  | { ok: true; provider: "mp"; preferenceId: string; initPoint: string }
  | { ok: true; provider: "stripe"; clientSecret: string }
  | { ok: false; error: string };

export interface PaymentProvider {
  createPaymentForBooking(p: CreatePaymentForBookingParams): Promise<CreatePaymentResult>;
  handleWebhook?(rawBody: Buffer, signature: string | undefined): Promise<void>;
}
