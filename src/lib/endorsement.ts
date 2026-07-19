import { db } from "./db";

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
function rnd(n: number) { let s = ""; for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }

/** A short, human-quotable, unique reference like WZ-7Q2K9F for public citation. */
export async function uniqueRefCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = `WZ-${rnd(6)}`;
    const clash = await db.endorsement.findUnique({ where: { refCode: code } });
    if (!clash) return code;
  }
  return `WZ-${rnd(6)}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}
