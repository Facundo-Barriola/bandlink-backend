// src/repositories/faq.repository.ts
import { pool } from "../config/database.js";

export type FaqRow = {
  idFaq: number;
  question: string;
  answer: string;
  visibleGroups: number | null;
  audienceAll: boolean;
  isPublished: boolean;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
};

export async function listFaqs(groupMask = 0, opts?: { q?: string }) {
  const params: any[] = [];
  let where = `where "isPublished" = true and (
    "audienceAll" = true
    or "visibleGroups" is null
  `;

  // match exacto
  params.push(groupMask);
  where += ` or "visibleGroups" = $${params.length}`;

  // overlap bitmask (si lo usás)
  params.push(groupMask);
  where += ` or ("visibleGroups" & $${params.length}) <> 0 )`;

  if (opts?.q) {
    params.push(`%${opts.q}%`);
    where += ` and (question ilike $${params.length} or answer ilike $${params.length})`;
  }

  const q = `
    select "idFaq","question","answer","visibleGroups","audienceAll","isPublished",
           "sortOrder","createdAt","updatedAt"
      from "Feedback"."Faq"
    ${where}
    order by "sortOrder" asc nulls last, "createdAt" asc, "idFaq" asc
  `;

  const { rows } = await pool.query(q, params);
  return rows as FaqRow[];
}
