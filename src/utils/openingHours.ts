// utils/openingHours.ts
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

export type DayKey = "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun";
export type OpeningValue = string | string[] | Record<string, any> | null;
export type Interval = { startMin: number; endMin: number };

const DAYS_ORDER: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_ALIASES: Record<string, DayKey> = {
  mon:"mon", monday:"mon", lunes:"mon", lun:"mon",
  tue:"tue", tuesday:"tue", martes:"tue", mar:"tue",
  wed:"wed", wednesday:"wed", miercoles:"wed", "miércoles":"wed", mie:"wed", "mié":"wed",
  thu:"thu", thursday:"thu", jueves:"thu", jue:"thu",
  fri:"fri", friday:"fri", viernes:"fri", vie:"fri",
  sat:"sat", saturday:"sat", sabado:"sat", "sábado":"sat", sab:"sat",
  sun:"sun", sunday:"sun", domingo:"sun", dom:"sun",
};

function parseHHmm(s: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh<0 || hh>23 || mm<0 || mm>59) return null;
  return hh*60 + mm;
}
function makeInterval(a?: string, b?: string) {
  const start = a ? parseHHmm(a) : null;
  const end   = b ? parseHHmm(b) : null;
  if (start==null || end==null) return null;
  return { startMin: start, endMin: end };
}

function collectPairs(val: any): Array<{ start: string; end: string }> {
  const out: Array<{start:string; end:string}> = [];
  if (val == null || val === "" || val === false) return out;

  const pushStr = (s: string) => {
    const [a,b] = String(s).split("-").map(x => x?.trim());
    if (a && b) out.push({ start:a, end:b });
  };
  const pushObj = (o: any) => {
    const a = o?.start ?? o?.from ?? o?.since ?? o?.desde;
    const b = o?.end   ?? o?.to   ?? o?.until ?? o?.hasta;
    if (a && b) out.push({ start:String(a), end:String(b) });
  };
  const pushTuple = (t: any[]) => {
    const a = t?.[0]; const b = t?.[1];
    if (typeof a === "string" && typeof b === "string") out.push({ start:a, end:b });
  };

  if (typeof val === "string") {
    pushStr(val);
  } else if (Array.isArray(val)) {
    val.forEach(item => {
      if (typeof item === "string")       pushStr(item);
      else if (Array.isArray(item))       pushTuple(item);
      else if (typeof item === "object")  pushObj(item);
    });
  } else if (typeof val === "object") {
    if (("start" in val) || ("from" in val) || ("desde" in val)) pushObj(val);
    else Object.values(val).forEach(v => {
      if (typeof v === "string")      pushStr(v);
      else if (Array.isArray(v))      pushTuple(v as any[]);
      else if (typeof v === "object") pushObj(v);
    });
  }
  return out;
}

export function normalizeOpeningHours(raw: Record<string, OpeningValue> | null | undefined) {
  const norm: Record<DayKey, Interval[]> = { mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[] };
  if (!raw) return norm;

  const push = (day: DayKey, iv: Interval) => {
    if (iv.endMin > iv.startMin) {
      norm[day].push(iv);
    } else if (iv.endMin < iv.startMin) {
      // cruza medianoche -> split
      norm[day].push({ startMin: iv.startMin, endMin: 24*60 });
      const nextIdx = DAYS_ORDER.indexOf(day) + 1;
      const next = DAYS_ORDER[nextIdx % 7];
      if (next) {
        norm[next].push({ startMin: 0, endMin: iv.endMin });
      }
    } else {
      // 24h
      norm[day].push({ startMin: 0, endMin: 24*60 });
    }
  };

  for (const [k,v] of Object.entries(raw)) {
    const day = DAY_ALIASES[k.toLowerCase()];
    if (!day) continue;
    const pairs = collectPairs(v);
    pairs.forEach(({start,end}) => {
      const iv = makeInterval(start, end);
      if (iv) push(day, iv);
    });
  }

  // ordenar + merge
  for (const d of DAYS_ORDER) {
    const arr = norm[d].sort((a,b)=>a.startMin-b.startMin);
    const merged: Interval[] = [];
    for (const iv of arr) {
      const last = merged[merged.length-1];
      if (last && iv.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, iv.endMin);
      } else merged.push({...iv});
    }
    norm[d] = merged;
  }
  return norm;
}

// ---------- validación en TZ ----------
const ISO_DAY_TO_KEY: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"]; // 1..7 -> 0..6

function dayKeyInTZ(isoZ: string | Date, tz: string): DayKey {
  const i = Number(formatInTimeZone(isoZ, tz, "i")); // 1..7 (Mon..Sun)
  return ISO_DAY_TO_KEY[i-1] ?? "mon";
}
function minutesInTZ(isoZ: string | Date, tz: string): number {
  const h = Number(formatInTimeZone(isoZ, tz, "H"));
  const m = Number(formatInTimeZone(isoZ, tz, "m"));
  return h*60 + m;
}
/** UTC del inicio del día siguiente (respecto al instante 'cursor' en TZ) */
function endOfLocalDayAsUTC(cursor: string | Date, tz: string): Date {
  const ymd = formatInTimeZone(cursor, tz, "yyyy-MM-dd");
  // Construyo el “día siguiente 00:00” como string local y lo paso a UTC
  const nextLocalMidnight = new Date(`${ymd}T00:00:00`);
  nextLocalMidnight.setDate(nextLocalMidnight.getDate() + 1);
  return zonedTimeToUtc(
    `${nextLocalMidnight.getFullYear()}-${String(nextLocalMidnight.getMonth()+1).padStart(2,"0")}-${String(nextLocalMidnight.getDate()).padStart(2,"0")}T00:00:00`,
    tz
  );
}

export function isWithinOpeningHoursZoned(
  startIsoZ: string,
  endIsoZ: string,
  norm: Record<DayKey, Interval[]>,
  tz = "America/Argentina/Buenos_Aires"
): boolean {
  const start = new Date(startIsoZ);
  const end   = new Date(endIsoZ);
  if (isNaN(+start) || isNaN(+end) || end <= start) return false;

  let cursor = start;
  while (cursor < end) {
    const segEndUtc = new Date(Math.min(end.getTime(), endOfLocalDayAsUTC(cursor, tz).getTime()));
    const dk = dayKeyInTZ(cursor, tz);
    const minutesStart = minutesInTZ(cursor, tz);
    const minutesEnd   = segEndUtc.getTime() === endOfLocalDayAsUTC(cursor, tz).getTime()
      ? 24*60
      : minutesInTZ(segEndUtc, tz);

    const covered = (norm[dk] || []).some(iv => minutesStart >= iv.startMin && minutesEnd <= iv.endMin);
    if (!covered) return false;

    cursor = segEndUtc;
  }
  return true;
}
