import "dotenv/config";
const r = await fetch("https://api.mercadopago.com/users/me", {
  headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
});
console.log("status:", r.status);
console.log(await r.json());