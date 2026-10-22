/**
 * RLS / trigger tests against a real Postgres (PGlite, in-process).
 * Supabase's `auth` schema is stubbed just enough to run the migration.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const migrationDir = path.join(root, "supabase/migrations");
const migrations = readdirSync(migrationDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(migrationDir, f), "utf8"));
const seed = readFileSync(path.join(root, "supabase/seed.sql"), "utf8");

const ids = {
  head: "00000000-0000-0000-0000-000000000001",
  headNoCount: "00000000-0000-0000-0000-000000000002",
  s1: "00000000-0000-0000-0000-000000000011",
  s2: "00000000-0000-0000-0000-000000000012",
  s3: "00000000-0000-0000-0000-000000000013",
};

let db: PGlite;

/** Run a query as an authenticated user (RLS applies). */
async function as<T = Record<string, unknown>>(
  uid: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

const allAnswers = (value: number) =>
  JSON.stringify(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, value])));
const allJob = (value: number, items: number[]) =>
  JSON.stringify(Object.fromEntries(items.map((i) => [i, value])));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  for (const m of migrations) await db.exec(m);
  // test fixtures create password users directly; production keeps this off (migration 0006)
  await db.exec("set app.allow_password_signup = 'on'");
  await db.exec(seed);
  const meta = (o: object) => JSON.stringify(o);
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'head@x.th', $6::jsonb), ($2, 'head2@x.th', $7::jsonb),
      ($3, 's1@x.th', $8::jsonb), ($4, 's2@x.th', $9::jsonb), ($5, 's3@x.th', $10::jsonb)`,
    [
      ids.head,
      ids.headNoCount,
      ids.s1,
      ids.s2,
      ids.s3,
      meta({ full_name: "Head A", role: "head" }),
      meta({ full_name: "Head B", role: "head", counts_in_score: false }),
      meta({ full_name: "Staff 1", role: "staff", staff_group_id: "1" }),
      meta({ full_name: "Staff 2", role: "staff", staff_group_id: "1" }),
      meta({ full_name: "Staff 3", role: "staff", staff_group_id: "2" }),
    ],
  );
});

afterAll(async () => {
  await db.close();
});

describe("profiles", () => {
  it("handle_new_user created profiles with metadata", async () => {
    const rows = await db.query<{ counts_in_score: boolean; role: string }>(
      "select role, counts_in_score from profiles where id = $1",
      [ids.headNoCount],
    );
    expect(rows.rows[0]).toEqual({ role: "head", counts_in_score: false });
  });

  it("staff cannot read other people's email (profiles table)", async () => {
    const rows = await as(ids.s1, "select id, email from profiles");
    expect(rows.map((r) => r.id)).toEqual([ids.s1]);
  });

  it("staff can read the directory without email", async () => {
    const rows = await as(ids.s1, "select * from directory");
    expect(rows.length).toBe(5);
    expect(Object.keys(rows[0])).not.toContain("email");
  });

  it("staff cannot update profiles", async () => {
    const rows = await as(ids.s1, "update profiles set role = 'head' where id = $1 returning id", [
      ids.s1,
    ]);
    expect(rows.length).toBe(0);
  });

  it("head reads everything", async () => {
    const rows = await as(ids.head, "select email from profiles");
    expect(rows.length).toBe(5);
  });

  it("anon sees nothing", async () => {
    await db.exec("reset role");
    await db.exec("set role anon");
    await expect(db.query("select * from profiles")).rejects.toThrow();
    await db.exec("reset role");
  });
});

describe("evaluations", () => {
  it("staff submits a core evaluation and can re-submit (overwrite)", async () => {
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s2, allAnswers(4)]);
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s2, allAnswers(3)]);
    const rows = await as(ids.s1, "select score from core_answers");
    expect(rows.length).toBe(12);
    expect(new Set(rows.map((r) => r.score))).toEqual(new Set([3]));
  });

  it("incomplete answers are rejected", async () => {
    await expect(
      as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s3, '{"1":5}']),
    ).rejects.toThrow();
  });

  it("staff cannot read evaluations made by others", async () => {
    await as(ids.s2, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s1, allAnswers(5)]);
    const mine = await as(ids.s1, "select evaluator_id from evaluations");
    expect(mine.every((r) => r.evaluator_id === ids.s1)).toBe(true);
    const answers = await as(ids.s1, "select count(*)::int as n from core_answers");
    expect(answers[0].n).toBe(12); // only own 12 answers, not s2's
    // s1's own evaluatee (s2) never sees what s1 gave
    const seenByS2 = await as(ids.s2, "select evaluator_id from evaluations where evaluatee_id = $1", [
      ids.s2,
    ]);
    expect(seenByS2.length).toBe(0);
  });

  it("staff cannot evaluate themselves", async () => {
    await expect(
      as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s1, allAnswers(5)]),
    ).rejects.toThrow();
  });

  it("staff cannot evaluate a head", async () => {
    await expect(
      as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.head, allAnswers(5)]),
    ).rejects.toThrow(/หัวหน้า/);
  });

  it("staff cannot submit on behalf of someone else", async () => {
    await expect(
      as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb, $3)", [ids.s3, allAnswers(5), ids.s2]),
    ).rejects.toThrow();
  });

  it("staff cannot insert directly as another evaluator", async () => {
    await expect(
      as(
        ids.s1,
        "insert into evaluations (cycle_id, evaluator_id, evaluatee_id) values (1, $1, $2)",
        [ids.s2, ids.s3],
      ),
    ).rejects.toThrow();
  });

  it("staff cannot delete evaluations", async () => {
    const rows = await as(ids.s1, "delete from evaluations returning id");
    expect(rows.length).toBe(0);
    const left = await as(ids.s1, "select id from evaluations");
    expect(left.length).toBeGreaterThan(0);
  });

  it("staff cannot read head_assessments or job_items", async () => {
    expect((await as(ids.s1, "select * from head_assessments")).length).toBe(0);
    expect((await as(ids.s1, "select * from job_items")).length).toBe(0);
    expect((await as(ids.s1, "select * from job_answers")).length).toBe(0);
  });

  it("staff cannot call submit_head_assessment", async () => {
    await expect(
      as(ids.s1, "select submit_head_assessment(1, $1, $2::jsonb, $3::jsonb, 50)", [
        ids.s2,
        allAnswers(5),
        "{}",
      ]),
    ).rejects.toThrow();
  });

  it("staff cannot write when the cycle is closed", async () => {
    await db.exec("update eval_cycles set is_open = false where id = 1");
    await expect(
      as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s2, allAnswers(1)]),
    ).rejects.toThrow();
    await db.exec("update eval_cycles set is_open = true where id = 1");
  });

  it("deactivated users are locked out", async () => {
    await db.exec(`update profiles set is_active = false where id = '${ids.s3}'`);
    expect((await as(ids.s3, "select * from profiles")).length).toBe(0);
    expect((await as(ids.s3, "select * from directory")).length).toBe(0);
    expect((await as(ids.s3, "select * from eval_cycles")).length).toBe(0);
    await db.exec(`update profiles set is_active = true where id = '${ids.s3}'`);
  });
});

describe("head", () => {
  const jobItemsFor = async (group: number) =>
    (
      await db.query<{ id: number }>("select id from job_items where staff_group_id = $1", [group])
    ).rows.map((r) => r.id);

  it("head submits core + job + kpi in one call", async () => {
    const items = await jobItemsFor(1);
    await as(ids.head, "select submit_head_assessment(1, $1, $2::jsonb, $3::jsonb, 87.5)", [
      ids.s1,
      allAnswers(4),
      allJob(5, items),
    ]);
    const a = await as(ids.head, "select kpi_percent from head_assessments");
    expect(Number(a[0].kpi_percent)).toBe(87.5);
    const j = await as(ids.head, "select count(*)::int as n from job_answers");
    expect(j[0].n).toBe(items.length);
  });

  it("head job answers must match the evaluatee's group", async () => {
    const wrong = await jobItemsFor(2);
    await expect(
      as(ids.head, "select submit_head_assessment(1, $1, $2::jsonb, $3::jsonb, 50)", [
        ids.s1,
        allAnswers(4),
        allJob(5, wrong),
      ]),
    ).rejects.toThrow();
  });

  it("head can read all evaluations and edit while the cycle is closed", async () => {
    expect((await as(ids.head, "select * from evaluations")).length).toBeGreaterThan(2);
    await db.exec("update eval_cycles set is_open = false where id = 1");
    await as(ids.head, "select submit_evaluation(1, $1, $2::jsonb, $3)", [
      ids.s2,
      allAnswers(2),
      ids.s1,
    ]);
    await db.exec("update eval_cycles set is_open = true where id = 1");
  });

  it("head can delete a record", async () => {
    await as(ids.head, "select delete_evaluation_record(1, $1, $2)", [ids.s1, ids.s2]);
    const rows = await as(
      ids.head,
      "select * from evaluations where evaluator_id = $1 and evaluatee_id = $2",
      [ids.s1, ids.s2],
    );
    expect(rows.length).toBe(0);
  });

  it("only one cycle can be current", async () => {
    const id = await as<{ create_cycle_from_latest: number }>(
      ids.head,
      "select create_cycle_from_latest('รอบใหม่')",
    );
    const newId = id[0].create_cycle_from_latest;
    const qs = await db.query<{ n: number }>(
      `select count(*)::int as n from core_questions q join core_groups g on g.id = q.group_id
       where g.cycle_id = $1`,
      [newId],
    );
    expect(qs.rows[0].n).toBe(12);
    await db.exec(`update eval_cycles set is_current = true where id = ${newId}`);
    const cur = await db.query<{ n: number }>(
      "select count(*)::int as n from eval_cycles where is_current",
    );
    expect(cur.rows[0].n).toBe(1);
  });
});

describe("pending profiles", () => {
  it("a person without a login can be evaluated, then re-linked on invite", async () => {
    const pending = (
      await db.query<{ id: string }>(
        `insert into profiles (full_name, role, staff_group_id, has_account)
         values ('Pending Person', 'staff', 1, false) returning id`,
      )
    ).rows[0].id;

    // evaluated while the cycle is closed for staff, as a head would fix it later
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [pending, allAnswers(4)]);
    await db.exec("update eval_cycles set is_open = false where id = 1");

    const newAuthId = "00000000-0000-0000-0000-0000000000aa";
    await db.exec(`update profiles set email = 'later@x.th' where id = '${pending}'`);
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data) values ('${newAuthId}', 'later@x.th', '{}')`,
    );
    await db.exec("update eval_cycles set is_open = true where id = 1");

    const profile = await db.query<{ has_account: boolean; full_name: string }>(
      "select has_account, full_name from profiles where id = $1",
      [newAuthId],
    );
    expect(profile.rows[0]).toEqual({ has_account: true, full_name: "Pending Person" });
    const evals = await db.query<{ n: number }>(
      "select count(*)::int as n from evaluations where evaluatee_id = $1",
      [newAuthId],
    );
    expect(evals.rows[0].n).toBe(1);
    const old = await db.query("select 1 from profiles where id = $1", [pending]);
    expect(old.rows.length).toBe(0);
  });
});

describe("delete_person", () => {
  it("head deletes a person and their evaluations; staff cannot", async () => {
    const victim = (
      await db.query<{ id: string }>(
        `insert into profiles (full_name, role, staff_group_id, has_account)
         values ('To Delete', 'staff', 1, false) returning id`,
      )
    ).rows[0].id;
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [victim, allAnswers(3)]);

    await expect(as(ids.s1, "select delete_person($1)", [victim])).rejects.toThrow();
    await expect(as(ids.head, "select delete_person($1)", [ids.head])).rejects.toThrow(/ตัวเอง/);

    await as(ids.head, "select delete_person($1)", [victim]);
    const left = await db.query<{ n: number }>(
      "select (select count(*) from profiles where id = $1)::int + (select count(*) from evaluations where evaluatee_id = $1)::int as n",
      [victim],
    );
    expect(left.rows[0].n).toBe(0);
  });
});

describe("admin flag", () => {
  it("an admin (role staff) sees everything but cannot submit the head assessment", async () => {
    const adminId = "00000000-0000-0000-0000-00000000009b";
    await db.exec(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ('${adminId}', 'admin@x.th', '{"full_name":"Admin Person","role":"staff","staff_group_id":"1"}')`,
    );
    await db.exec(`update profiles set is_admin = true where id = '${adminId}'`);

    // sees everyone's evaluations and e-mails (head-level read)
    expect((await as(adminId, "select * from profiles")).length).toBeGreaterThan(5);
    expect((await as(adminId, "select * from evaluations")).length).toBeGreaterThan(0);

    // can evaluate colleagues like any staff member...
    await as(adminId, "select submit_evaluation(1, $1, $2::jsonb)", [ids.s1, allAnswers(5)]);
    // ...and can be evaluated
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [adminId, allAnswers(4)]);

    // but is not a head
    await expect(
      as(adminId, "select submit_head_assessment(1, $1, $2::jsonb, '{}'::jsonb, 50)", [
        ids.s1,
        allAnswers(5),
      ]),
    ).rejects.toThrow(/ไม่ใช่หัวหน้า/);
  });
});

describe("google sign-in", () => {
  const googleUser = (id: string, email: string) =>
    `insert into auth.users (id, email, raw_app_meta_data) values ('${id}', '${email}', '{"provider":"google"}')`;

  it("re-links a roster profile by google_email and keeps its evaluations", async () => {
    const person = (
      await db.query<{ id: string }>(
        `insert into profiles (full_name, role, staff_group_id, has_account, google_email)
         values ('Google Person', 'staff', 1, false, 'Somchai@Example.com') returning id`,
      )
    ).rows[0].id;
    await as(ids.s1, "select submit_evaluation(1, $1, $2::jsonb)", [person, allAnswers(3)]);

    const gid = "00000000-0000-0000-0000-00000000009d";
    await db.exec(googleUser(gid, "somchai@example.com"));

    const p = await db.query<{ full_name: string; has_account: boolean }>(
      "select full_name, has_account from profiles where id = $1",
      [gid],
    );
    expect(p.rows[0]).toEqual({ full_name: "Google Person", has_account: true });
    const evals = await db.query<{ n: number }>(
      "select count(*)::int as n from evaluations where evaluatee_id = $1",
      [gid],
    );
    expect(evals.rows[0].n).toBe(1);
  });

  it("rejects a google account that is not on the roster", async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int as n from profiles")).rows[0].n;
    await expect(
      db.exec(googleUser("00000000-0000-0000-0000-00000000009c", "stranger@example.com")),
    ).rejects.toThrow();
    const after = (await db.query<{ n: number }>("select count(*)::int as n from profiles")).rows[0].n;
    expect(after).toBe(before);
  });
});

describe("open sign-up is closed", () => {
  it("rejects an email/password sign-up (no profile, no roster takeover)", async () => {
    await db.exec("set app.allow_password_signup = 'off'");
    try {
      const before = (await db.query<{ n: number }>("select count(*)::int as n from profiles")).rows[0].n;
      await expect(
        db.exec(
          "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'stranger2@example.com')",
        ),
      ).rejects.toThrow();
      const after = (await db.query<{ n: number }>("select count(*)::int as n from profiles")).rows[0].n;
      expect(after).toBe(before);
    } finally {
      await db.exec("set app.allow_password_signup = 'on'");
    }
  });
});

describe("PIN accounts under the sign-up gate (migration 0007)", () => {
  const withGate = async (fn: () => Promise<void>) => {
    await db.exec("set app.allow_password_signup = 'off'");
    try {
      await fn();
    } finally {
      await db.exec("set app.allow_password_signup = 'on'");
    }
  };

  it("links a roster profile to the server-created PIN user", async () => {
    const id = (
      await db.query<{ id: string }>(
        `insert into profiles (full_name, role, staff_group_id, has_account)
         values ('Pin Person', 'staff', 1, false) returning id`,
      )
    ).rows[0].id;
    const email = `${id}@pin.eval360.local`;
    await db.exec(`update profiles set email = '${email}' where id = '${id}'`);
    const authId = "00000000-0000-0000-0000-0000000000f1";
    await withGate(async () => {
      await db.exec(`insert into auth.users (id, email) values ('${authId}', '${email}')`);
    });
    const p = await db.query<{ has_account: boolean }>("select has_account from profiles where id = $1", [authId]);
    expect(p.rows[0].has_account).toBe(true);
  });

  it("rejects a pin-domain address that no roster profile carries", async () => {
    await withGate(async () => {
      await expect(
        db.exec(
          "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f2', 'guess@pin.eval360.local')",
        ),
      ).rejects.toThrow();
    });
  });

  it("does not let a stranger take over a roster profile by signing up with its real email", async () => {
    await db.exec(
      `insert into profiles (full_name, role, staff_group_id, has_account, email)
       values ('Real Mail Person', 'staff', 1, false, 'victim@example.com')`,
    );
    await withGate(async () => {
      await expect(
        db.exec(
          "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f3', 'victim@example.com')",
        ),
      ).rejects.toThrow();
    });
    const still = await db.query<{ has_account: boolean }>(
      "select has_account from profiles where email = 'victim@example.com'",
    );
    expect(still.rows[0].has_account).toBe(false);
  });
});
