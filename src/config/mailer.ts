import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

export const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT ?? 587),
  secure: false,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    tls: {
    // ⚠️ Solo en desarrollo para bypassear certificados autofirmados
    rejectUnauthorized: false,
  },
  logger: true, // opcional: logs útiles
  debug: true,
});

export async function sendMail(to: string, subject: string, html: string) {
  if (!SMTP_HOST) {
    console.warn("[MAIL] SMTP no configurado. A continuación el mail simulado:");
    console.log({ to, subject, html });
    return;
  }
  await mailer.sendMail({ from: SMTP_FROM ?? "BandLink <no-reply@bandlink>", to, subject, html });
}
