import { pool } from "../config/database.js";
import { isBlocked } from "../repositories/network.repository.js";
type MessageRow = {
  idMessage: number; idConversation: number; authorIdUser: number;
  body: string | null; attachments: any | null; createdAt: string;
  editedAt: string | null; deletedAt: string | null;
};

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
  select c."idConversation", c."type", c."contextId",
         lm.*,
         greatest(coalesce(p."lastReadAt", 'epoch'::timestamptz), 'epoch'::timestamptz) as "lastReadAt",
         coalesce(nu.unread_count,0)::int as "unreadCount"
  from "Chat"."Conversation" c
  join "Chat"."ConversationParticipant" p
    on p."idConversation" = c."idConversation" and p."idUser" = $1
  left join lateral (
      select m."idMessage", m."authorIdUser", m."body", m."attachments",
             m."createdAt"
      from "Chat"."Message" m
      where m."idConversation" = c."idConversation"
      order by m."createdAt" desc
      limit 1
  ) lm on true
  left join lateral (
      select count(*) as unread_count
      from "Chat"."Message" m
      where m."idConversation" = c."idConversation"
        and m."createdAt" > coalesce(p."lastReadAt",'epoch')
        and m."authorIdUser" <> $1
  ) nu on true
  order by lm."createdAt" desc nulls last
  limit $2 offset $3`;
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