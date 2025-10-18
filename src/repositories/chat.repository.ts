import { pool } from "../config/database.js";
import { isBlocked } from "../repositories/network.repository.js";
import { PoolClient } from "pg";
type MessageRow = {
  idMessage: number; idConversation: number; authorIdUser: number;
  body: string | null; attachments: any | null; createdAt: string;
  editedAt: string | null; deletedAt: string | null;
};

type FindOrCreateByBookingArgs = {
  idBooking: number;
  idRoom: number;
  bookingUserId: number;
};

export async function findOrCreateBookingConversation(
  client: PoolClient,
  { idBooking, idRoom, bookingUserId }: FindOrCreateByBookingArgs
) {
  // 1) Resolver dueño de la sala
  const ownerRes = await client.query<{ studioUserId: number }>(
    `
    select up."idUser" as "studioUserId"
      from "Directory"."StudioRoom" r
      join "Directory"."Studio" s on s."idStudio" = r."idStudio"
      join "Directory"."UserProfile" up on up."idUserProfile" = s."idUserProfile"
     where r."idRoom" = $1
    `,
    [idRoom]
  );
  const studioUserId = ownerRes.rows[0]?.studioUserId;
  if (!studioUserId) throw new Error("No se pudo resolver el usuario dueño de la sala");

  // 2) Crear conversación (o recuperar si ya existe)
  let idConversation: number | undefined;

  try {
    const ins = await client.query<{ idConversation: number }>(
      `
      insert into "Chat"."Conversation"("type","contextId","createdBy")
      values ('booking',$1,$2)
      returning "idConversation"
      `,
      [idBooking, bookingUserId]
    );
    idConversation = ins.rows[0]?.idConversation;
  } catch (e: any) {
    // 23505 = unique_violation -> otra transacción ya la creó
    if (e?.code !== "23505") throw e;

    const sel = await client.query<{ idConversation: number }>(
      `select "idConversation" 
         from "Chat"."Conversation"
        where "type"='booking' and "contextId"=$1`,
      [idBooking]
    );
    idConversation = sel.rows[0]?.idConversation;
  }

  if (!idConversation) {
    throw new Error("No se pudo crear/recuperar la conversación (booking)");
  }

  // 3) Asegurar participantes
  await client.query(
    `
    insert into "Chat"."ConversationParticipant"("idConversation","idUser","role")
    values ($1,$2,'member'),($1,$3,'member')
    on conflict ("idConversation","idUser") do nothing
    `,
    [idConversation, bookingUserId, studioUserId]
  );

  // 4) (Opcional) mensaje inicial
  // await client.query(`insert into "Chat"."Message"("idConversation","authorIdUser","body")
  // values ($1,$2,$3)`, [idConversation, bookingUserId, "¡Hola! Acabo de reservar la sala."]);

  return { idConversation, studioUserId };
}

export async function findDMConversation(userA: number, userB: number) {
  if (await isBlocked(userA, userB)) {
    throw Object.assign(new Error("No disponible"), { httpStatus: 403 });
  }
  const q = `
    select c."idConversation"
    from "Chat"."Conversation" c
    join "Chat"."ConversationParticipant" p1 using ("idConversation")
    join "Chat"."ConversationParticipant" p2 using ("idConversation")
    where c."type" = 'dm'
    and (
    (p1."idUser" = $1 and p2."idUser" = $2) or
    (p1."idUser" = $2 and p2."idUser" = $1)
    )
    limit 1`;
  const { rows } = await pool.query(q, [userA, userB]);
  return rows[0]?.idConversation as number | undefined;
}
export async function markReadReceipts(idConversation: number, idUser: number, until: Date) {
  const q = `
    insert into "Chat"."MessageReceipt"("idMessage","idUser","readAt")
    select m."idMessage", $2, $3
      from "Chat"."Message" m
     where m."idConversation" = $1
       and m."authorIdUser" <> $2
       and m."createdAt" <= $3
    on conflict ("idMessage","idUser")
    do update set "readAt" = excluded."readAt"`;
  await pool.query(q, [idConversation, idUser, until]);
}

export async function createDMConversation(userA: number, userB: number, createdBy = userA) {
  const a = Math.min(userA, userB);
  const b = Math.max(userA, userB);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const ins = await client.query(
      `
      insert into "Chat"."Conversation"("type","contextId","createdBy","dmUserMin","dmUserMax")
      values ('dm', null, $1, $2, $3)
      on conflict ("dmUserMin","dmUserMax") where "type"='dm'
      do update set "createdBy" = "Chat"."Conversation"."createdBy"
      returning "idConversation"
      `,
      [createdBy, a, b]
    );
    const idConversation = ins.rows[0].idConversation as number;

    await client.query(
      `insert into "Chat"."ConversationParticipant"("idConversation","idUser","role")
       values ($1,$2,'member'),($1,$3,'member')
       on conflict do nothing`,
      [idConversation, a, b]
    );

    await client.query("commit");
    return idConversation;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function listInbox(userId: number, limit = 30, offset = 0) {
  // último mensaje + no leídos por conv
  const q = `
  select
    c."idConversation",
    c."type",
    c."contextId",
    lm."idMessage",
    lm."authorIdUser",
    lm."body",
    lm."attachments",
    lm."createdAt",
    greatest(coalesce(p."lastReadAt", 'epoch'::timestamptz), 'epoch'::timestamptz) as "lastReadAt",
    coalesce(nu.unread_count,0)::int as "unreadCount",
    part."participants",
    part."otherUserIds"
  from "Chat"."Conversation" c
  join "Chat"."ConversationParticipant" p
    on p."idConversation" = c."idConversation" and p."idUser" = $1

  -- último mensaje
  left join lateral (
      select m."idMessage", m."authorIdUser", m."body", m."attachments", m."createdAt"
      from "Chat"."Message" m
      where m."idConversation" = c."idConversation"
      order by m."createdAt" desc
      limit 1
  ) lm on true

  -- cantidad de no leídos
  left join lateral (
      select count(*) as unread_count
      from "Chat"."Message" m
      where m."idConversation" = c."idConversation"
        and m."createdAt" > coalesce(p."lastReadAt",'epoch')
        and m."authorIdUser" <> $1
  ) nu on true

  -- participantes y otros (excepto el logueado)
  left join lateral (
      select
        array_agg(cp."idUser")                                         as "participants",
        array_remove(array_agg( case when cp."idUser" <> $1 then cp."idUser" end ), null) as "otherUserIds"
      from "Chat"."ConversationParticipant" cp
      where cp."idConversation" = c."idConversation"
  ) part on true

  order by lm."createdAt" desc nulls last
  limit $2 offset $3
  `;
  const { rows } = await pool.query(q, [userId, limit, offset]);
  return rows;
}

export async function listMessages(idConversation: number, limit = 50, before?: string) {
  const params: any[] = [idConversation];
  let where = `where "idConversation" = $1`;
  if (before) { params.push(before); where += ` and "createdAt" < $2`; }
  params.push(limit);

  const q = `
select "idConversation","idMessage","authorIdUser","body","attachments","createdAt","editedAt","deletedAt"
  from "Chat"."Message"
 ${where}
 order by "createdAt" desc, "idMessage" desc
 limit $${params.length}`;
  const { rows } = await pool.query(q, params);
  return rows as MessageRow[];
}

export async function insertMessage(
  idConversation: number, authorIdUser: number,
  body: string | null, attachments: any | null
) {
  const q = `
    insert into "Chat"."Message"("idConversation","authorIdUser","body","attachments")
    values ($1,$2,$3,$4)
    returning *`;
  const { rows } = await pool.query(q, [idConversation, authorIdUser, body, attachments]);
  return rows[0] as MessageRow;
}

export async function isParticipant(idConversation: number, idUser: number) {
  const q = `select 1 from "Chat"."ConversationParticipant" where "idConversation"=$1 and "idUser"=$2`;
  const { rows } = await pool.query(q, [idConversation, idUser]);
  return !!rows[0];
}

export async function markRead(idConversation: number, idUser: number, readAt = new Date()) {
  const q = `
    update "Chat"."ConversationParticipant"
       set "lastReadAt" = $3
     where "idConversation" = $1 and "idUser" = $2`;
  await pool.query(q, [idConversation, idUser, readAt]);
}

export async function upsertReceipt(messageId: number, userId: number, field: "deliveredAt" | "readAt") {
  const q = `
    insert into "Chat"."MessageReceipt"("idMessage","idUser","${field}")
    values ($1,$2, now())
    on conflict ("idMessage","idUser")
    do update set "${field}" = excluded."${field}"`;
  await pool.query(q, [messageId, userId]);
}


export async function getParticipants(idConversation: number) {
  const q = `
    select "idUser"
    from "Chat"."ConversationParticipant"
    where "idConversation" = $1`;
  const { rows } = await pool.query(q, [idConversation]);
  return rows.map(r => Number(r.idUser));
}

export async function removeParticipant(idConversation: number, idUser: number) {
  await pool.query(
    `delete from "Chat"."ConversationParticipant"
      where "idConversation" = $1 and "idUser" = $2`,
    [idConversation, idUser]
  );
}

export async function countParticipants(idConversation: number): Promise<number> {
  const { rows } = await pool.query(
    `select count(*)::int as c
       from "Chat"."ConversationParticipant"
      where "idConversation" = $1`,
    [idConversation]
  );
  return Number(rows[0]?.c ?? 0);
}

/**
 * Borra en cascada (recibos → mensajes → participantes → conversación).
 * Usá transacción por seguridad ante FK.
 */
export async function deleteConversationCascade(idConversation: number) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query(
      `delete from "Chat"."MessageReceipt" r
        using "Chat"."Message" m
        where r."idMessage" = m."idMessage"
          and m."idConversation" = $1`,
      [idConversation]
    );

    await client.query(
      `delete from "Chat"."Message"
        where "idConversation" = $1`,
      [idConversation]
    );

    await client.query(
      `delete from "Chat"."ConversationParticipant"
        where "idConversation" = $1`,
      [idConversation]
    );

    await client.query(
      `delete from "Chat"."Conversation"
        where "idConversation" = $1`,
      [idConversation]
    );

    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}