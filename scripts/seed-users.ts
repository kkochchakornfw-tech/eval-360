/**
 * Load the roster from scripts/users.csv (copy scripts/users.template.csv).
 * The `email` column is the person's Google address: they sign in with "เข้าสู่ระบบด้วย Google" and
 * the profile is linked on first sign-in. No account or password is created here.
 * Usage: npm run seed:users
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. Safe to re-run:
 * people already on the roster (same name) are kept; a missing Google address is filled in.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

config({ path: ".env.local" });

const rowSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).or(z.literal("")),
  full_name: z.string().trim().min(1),
  role: z.enum(["head", "staff"]),
  group: z.string().trim(),
  counts_in_score: z.enum(["true", "false"]).default("true"),
});

function parseCsv(text: string): Record<string, string>[] {
  const [header, ...lines] = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const cols = header.split(",").map((c) => c.trim());
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
  });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: groups, error: gErr } = await admin.from("staff_groups").select("id,name");
  if (gErr) throw gErr;
  const groupId = new Map((groups ?? []).map((g) => [g.name, g.id as number]));
  if (groupId.size === 0) {
    throw new Error("ยังไม่มีกลุ่มพนักงานในฐานข้อมูล กรุณารัน supabase/seed.sql ก่อน แล้วรันสคริปต์นี้ใหม่");
  }

  const rows = parseCsv(readFileSync(path.resolve("scripts/users.csv"), "utf8"));
  const { data: existing, error: eErr } = await admin
    .from("profiles")
    .select("id,full_name,google_email");
  if (eErr) throw eErr;
  const byName = new Map((existing ?? []).map((p) => [p.full_name as string, p]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const [i, raw] of rows.entries()) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`row ${i + 2}: ${parsed.error.issues[0]?.message}`);
      skipped++;
      continue;
    }
    const r = parsed.data;
    if (r.role === "staff" && !groupId.has(r.group)) {
      console.error(`row ${i + 2}: unknown group "${r.group}"`);
      skipped++;
      continue;
    }

    const known = byName.get(r.full_name);
    if (known) {
      if (r.email && !known.google_email) {
        const { error } = await admin.from("profiles").update({ google_email: r.email }).eq("id", known.id);
        if (error) console.error(`${r.full_name}: ${error.message}`);
        else {
          console.log(`set Google email for ${r.full_name}`);
          updated++;
        }
      } else {
        skipped++;
      }
      continue;
    }

    const { error } = await admin.from("profiles").insert({
      full_name: r.full_name,
      google_email: r.email || null,
      role: r.role,
      staff_group_id: r.role === "staff" ? groupId.get(r.group) : null,
      counts_in_score: r.counts_in_score === "true",
      has_account: false,
    });
    if (error) {
      console.error(`${r.full_name}: ${error.message}`);
      skipped++;
    } else {
      console.log(`added ${r.full_name}`);
      added++;
    }
  }
  console.log(`done: ${added} added, ${updated} updated, ${skipped} skipped`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
