/**
 * Backs up everything the app stores into backups/<date>/*.json (one file per table).
 * Usage: npm run export:data
 * Run it after each evaluation round: a free Supabase project can be paused or removed, and this
 * file is the copy you keep yourself. The output holds names and scores, so it is git-ignored:
 * store it somewhere private. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const TABLES = [
  "staff_groups",
  "eval_cycles",
  "core_groups",
  "core_questions",
  "job_items",
  "profiles",
  "evaluations",
  "core_answers",
  "head_assessments",
  "job_answers",
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const dir = path.resolve("backups", new Date().toISOString().slice(0, 10));
  mkdirSync(dir, { recursive: true });

  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select("*").range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
    console.log(`${table}: ${rows.length} rows`);
  }
  console.log(`\nบันทึกแล้วที่ ${dir}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
