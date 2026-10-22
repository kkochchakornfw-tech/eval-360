# CLAUDE.md — ระบบประเมิน 360 องศา (Eval 360)

ระบบประเมินบุคลากรภายในแผนก ใช้งานได้ทั้งบนมือถือและเว็บ (responsive + PWA)
ต้นแบบเดิมเป็นไฟล์ HTML + localStorage อยู่ที่ `docs/prototype.html` (ใช้อ้างอิง seed data: รายชื่อ, คำถาม Core, ข้อ Job Base และน้ำหนัก)

UI และข้อความทั้งหมดในแอปเป็น **ภาษาไทย** ส่วนโค้ด ชื่อตัวแปร และ comment เป็นภาษาอังกฤษ

---

## 1. Tech stack

- **Next.js (App Router) + TypeScript (strict) + Tailwind CSS**
- **Supabase**: PostgreSQL + Supabase Auth + Row Level Security (region: `ap-southeast-1` Singapore)
  - ใช้ `@supabase/ssr` สำหรับ server/client
  - `SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะใน server (route handler / server action) ห้ามหลุดไป client เด็ดขาด
- **Recharts** สำหรับกราฟ
- **Zod** validate input ทุกจุดที่เขียนข้อมูล
- **Vitest** สำหรับ unit test ฟังก์ชันคำนวณคะแนน
- Font: **IBM Plex Sans Thai** ผ่าน `next/font/google`
- Icons: `lucide-react` (ใช้เท่าที่จำเป็น)
- PWA: manifest + icons ให้ "Add to Home Screen" ได้

Migration ทั้งหมดเก็บใน `supabase/migrations/*.sql` (ใช้ Supabase CLI)

---

## 2. บทบาทและสิทธิ์

| บทบาท | ใคร | ประเมินคนอื่นได้ | ถูกประเมิน | เมนูที่เห็น |
|---|---|---|---|---|
| `head` | ชลิตา ธารสิริโรจน์, น.ส. อุมากร โฮ่สกุล | ได้ทุกคน (Core + Job Base + KPI) | ไม่ | ทุกเมนู |
| `staff` | พนักงานทุกคน (2 กลุ่ม) | ได้ทุกคน ยกเว้นตัวเองและ head (Core เท่านั้น) | ใช่ | เมนู 1 เท่านั้น |

- head แต่ละคนมี flag `counts_in_score`:
  - ชลิตา = `true` (คะแนนที่ให้ถูกนำไปคำนวณ)
  - อุมากร = `false` — เห็นและใช้ได้ทุกหน้าเหมือน head ทุกอย่าง กรอกแบบประเมินได้และระบบบันทึก แต่ **ไม่นำไปคำนวณเลย** (ตัดออกจากการคำนวณ ไม่ใช่นับเป็นคะแนน 0 เพราะจะดึงค่าเฉลี่ยลง)
  - หน้าฟอร์มของ head ที่ `counts_in_score = false` แสดงข้อความเล็ก ๆ ว่า "คะแนนของคุณไม่ถูกนำไปคำนวณ"
  - ตั้งค่า flag นี้ได้ในหน้าตั้งค่าผู้ใช้

- **แอดมิน** = ผู้ดูแลระบบที่ไม่ได้อยู่ในแผนก เก็บเป็น `role = head` + `is_admin = true` + `counts_in_score = false` + ไม่มีกลุ่ม: เห็นและใช้ได้ทุกหน้า แต่ไม่อยู่ในรายชื่อที่ถูกประเมิน ไม่มีคะแนน และคะแนนที่กรอกไม่นับ (`is_head()` ใน RLS คืน true ให้ทั้ง head และแอดมิน) ตั้งได้จากตัวเลือกบทบาท "แอดมิน" ในหน้าตั้งค่า (คอลัมน์ `is_admin` ร่วมกับ role staff ยังรองรับในฐานข้อมูล แต่หน้าจอไม่เปิดให้ตั้ง)
- **เข้าสู่ระบบด้วยชื่อ + PIN** (`code_login`): head สร้างบัญชีให้จากหน้าตั้งค่า (ปุ่ม "สร้างบัญชี" รายคน / ทุกคนที่ยังไม่มี) ระบบสุ่ม PIN ตัวเลข (พนักงาน 6 หลัก, head/แอดมิน 8 หลัก) แสดงครั้งเดียว คัดลอกไปแจกได้ ทุกคนล็อกอินด้วย "เลือกชื่อ + PIN" (ฝั่งเซิร์ฟเวอร์ ไม่ส่งอีเมลไปที่เบราว์เซอร์ และล็อกชื่อ 5 นาทีเมื่อใส่ผิด 5 ครั้ง) และถูกบังคับตั้ง PIN ใหม่ครั้งแรก (`must_change_password`; ตัวเลขล้วน) ลืมรหัส → head กด "สร้างรหัสใหม่ให้"
- คนที่ยังไม่มีบัญชีมีชื่ออยู่ในรายชื่อได้ (`has_account = false`) ถูกประเมินได้ และถูกนับเป็นเพื่อนที่ต้องประเมินด้วย แต่ล็อกอินและประเมินคนอื่นไม่ได้จนกว่า head จะสร้างบัญชี (PIN) ให้
- พนักงานแบ่งเป็น 2 กลุ่ม (`staff_groups`) ค่าเริ่มต้น: "เภสัชกร" และ "เจ้าหน้าที่ห้องยา" (แก้ชื่อได้)
- staff ประเมินข้ามกลุ่มได้ (ทุกคนประเมินทุกคน)
- Job Base แยกชุดคำถามตามกลุ่มของผู้รับการประเมิน
- **การซ่อนเมนูใน UI ไม่ใช่ security** สิทธิ์ทุกอย่างต้องบังคับด้วย RLS ที่ฐานข้อมูล และตรวจซ้ำใน middleware/server

---

## 3. เมนู

1. **ตอบแบบสอบถาม** (staff, head) — เลือกผู้รับการประเมิน → ให้คะแนน Core Competency 1–5 ทุกข้อ
   - แสดงรายชื่อพร้อมสถานะ "ประเมินแล้ว / ยังไม่ประเมิน" ของตัวเอง
   - ถ้าเคยประเมินคนนี้แล้ว ดึงคะแนนเดิมมาให้แก้และบันทึกทับได้ (เฉพาะตอนรอบยังเปิด)
2. **แบบประเมินหัวหน้า** (head) — เลือกพนักงาน → Core Competency + Job Base (ตามกลุ่ม) + KPI (เลือกกรอกเป็นเปอร์เซ็นต์ 0–100 หรือคะแนนเต็ม 5 ระบบแปลงเป็น % ก่อนบันทึก: % = คะแนน / 5 × 100)
3. **ภาพรวมและกราฟ** (head)
   - ตัวกรอง: คะแนนรวม / Core / Job Base / KPI และแยกตามกลุ่ม
   - กราฟแท่งแนวนอน **เรียงจากมากไปน้อยเสมอ** (แนวนอนเพื่อให้ชื่อไทยอ่านได้บนมือถือ)
   - เลื่อนลงมาเป็นตารางคะแนนรายหมวด (รายข้อ) ของแต่ละคน
   - ตารางสรุปท้ายสุด แถวตามลำดับนี้:
     1. Core (เต็ม 5)
     2. Job Base (เต็ม 5)
     3. KPI (เต็ม 5)
     4. Core ตามสัดส่วน (เต็ม 30)
     5. Job Base ตามสัดส่วน (เต็ม 35)
     6. KPI ตามสัดส่วน (เต็ม 35)
     7. **คะแนนรวม (เต็ม 100)**
     8. **คะแนนรวมแปลงเต็ม 5**
   - (ตัวเลข 30/35/35 มาจากการตั้งค่าของรอบ ห้าม hard-code)
   - แสดงความคืบหน้า (ส่วนเดียว สลับด้วย toggle "ความคืบหน้า" / "ยังไม่ได้ประเมินใครเลย" ไม่ต้องเลื่อนหน้ายาว):
     - ตารางความคืบหน้า: เพื่อนประเมินแล้ว/เพื่อนทั้งหมด (เช่น 1/30 = พนักงานที่ active ทุกคนในรายชื่อ ยกเว้นตัวเอง แม้ยังไม่มีบัญชี) และหัวหน้าประเมินแล้วหรือยัง
     - **คลิกที่ชื่อ** → Modal แสดงชื่อพนักงานทุกคน แยกเป็น "ให้คะแนนคนนี้แล้ว" กับ "ยังไม่ได้ให้คะแนนคนนี้" พร้อมจำนวน
     - มุมมอง "ยังไม่ได้ประเมินใครเลย": ชื่อ กลุ่ม และจำนวนที่ประเมินเพื่อนแล้ว
   - การ์ดขวาสุด "ประเมินครบแล้ว" นับคนที่ถูกเพื่อนทุกคนในรายชื่อให้คะแนนครบแล้ว (`peersComplete`) เท่านั้น
   - **กราฟใช้คะแนนที่ปัดแล้ว**: Core ปัดรายข้อ (>= .5 ปัดขึ้น) แล้วค่อยหาค่าเฉลี่ย, คะแนนรวมคำนวณจาก Core ที่ปัดแล้ว; แท่งของคนที่เพื่อนยังประเมินไม่ครบ (หรือหัวหน้ายังไม่ประเมิน) แสดงสีจาง + เครื่องหมาย * (หมวด Core และคะแนนรวม)
   - ตารางรายข้อ: Core แสดงเป็นจำนวนเต็ม (ปัดแล้ว), Job Base แสดงคะแนนดิบที่หัวหน้ากรอก (ไม่คูณ/หารน้ำหนัก); ตารางสรุปท้ายสุดคำนวณจาก Core ที่ปัดเศษรายข้อแล้ว (Core เต็ม 5 / Core ตามสัดส่วน / คะแนนรวม / แปลงเต็ม 5) แสดงทศนิยม 2 ตำแหน่ง
4. **รายงานบุคคล** (head) — เลือกพนักงาน → คะแนนรวมเต็ม 100 ตัวใหญ่ + แยกรายหมวด + รายข้อ
   - คะแนนรวมตัวใหญ่ + แถว Core ในตาราง "แยกรายหมวด" ใช้ Core ที่ปัดเศษรายข้อแล้ว (`core5Rounded`, `corePctRounded`, `total100Rounded`, `total5Rounded`)
   - Core รายข้อ: เพิ่มคอลัมน์ "ปัดเศษ" (ปัดรายข้อเป็นจำนวนเต็ม >= .5 ปัดขึ้น) และที่แถวหัวข้อ B/D/M/S แสดงผลรวมของคะแนนที่ปัดแล้วทั้งหมวด (เช่น รวม 11/15) และค่าเฉลี่ย = ผลรวม / จำนวนข้อ
   - Job Base รายข้อ: แสดง **คะแนนดิบ 1–5** ที่หัวหน้าให้ (ไม่ถ่วงน้ำหนัก) เพราะมีหัวหน้าประเมินคนเดียว
5. **ตั้งค่าระบบ** (head)
   - จัดการผู้ใช้: เพิ่ม (ชื่อ ไม่ต้องใช้อีเมล) / สร้างบัญชี / สร้างรหัสใหม่ให้ / ปิดใช้งาน / แก้ไขชื่อ กลุ่ม บทบาท `counts_in_score`
   - จัดการคำถาม Core Competency (หมวด + ข้อ): เพิ่ม ลบ แก้ไข เรียงลำดับ
   - จัดการ Job Base แยกตามกลุ่ม: เพิ่ม ลบ แก้ไข ข้อความ + น้ำหนัก (แสดงผลรวมน้ำหนัก, เตือนถ้าไม่เท่ากับ 100)
   - น้ำหนักหัวหน้า/พนักงาน (ค่าเริ่มต้น 50/50) — ใส่ช่องเดียว อีกช่องคำนวณเป็น 100 − x
   - สัดส่วนหมวด Core/Job/KPI (ค่าเริ่มต้น 30/35/35) — ต้องรวมได้ 100 ถึงบันทึกได้
   - จัดการรอบประเมิน: สร้างรอบใหม่ (คัดลอกคำถามและน้ำหนักจากรอบล่าสุด), เปิด/ปิดรอบ, เลือกรอบที่ใช้งาน
6. **จัดการข้อมูล** (head) — ตารางผู้ประเมิน → ผู้รับการประเมิน → วันที่บันทึก, ค้นหา/กรองได้, แก้ไข (เปิดฟอร์มพร้อมข้อมูลเดิม) และลบ (มี confirm)
7. **ล็อกอิน** — ดูหัวข้อ 6

---

## 4. กฎการคำนวณคะแนน (สำคัญที่สุด)

เขียนเป็น pure function ใน `src/lib/scoring.ts` ห้ามมี I/O และต้องมี unit test ครบทุกกรณีในหัวข้อนี้
คำนวณด้วยความละเอียดเต็ม ปัดเศษ 2 ตำแหน่งเฉพาะตอนแสดงผล

ตัวแปรจากการตั้งค่าของรอบ:
- `wHead` = น้ำหนักหัวหน้า / 100 (ค่าเริ่มต้น 0.5), `wPeer` = 1 − `wHead`
- `pCore`, `pJob`, `pKpi` = สัดส่วนหมวด (ค่าเริ่มต้น 30, 35, 35 รวม 100)

### 4.1 Core Competency
สำหรับแต่ละข้อคำถาม q ของผู้รับการประเมิน:
- `peerAvg(q)` = ค่าเฉลี่ยคะแนนข้อ q จากพนักงานทุกคนที่ประเมินคนนี้
- `headScore(q)` = คะแนนข้อ q จาก head ที่ `counts_in_score = true` (ถ้ามีมากกว่า 1 คน ใช้ค่าเฉลี่ย)
- การประเมินจาก head ที่ `counts_in_score = false` ถูกตัดออกจากทุกการคำนวณ (Core, Job Base, KPI) และไม่นับใน peerAvg
- `combined(q)` = `peerAvg(q) × wPeer + headScore(q) × wHead`

`core5` = ค่าเฉลี่ย `combined(q)` ของทุกข้อ (เต็ม 5)
`corePct` = `core5 / 5 × pCore`

### 4.2 Job Base (หัวหน้าเท่านั้น)
- แต่ละข้อหัวหน้าให้ 1–5 คูณน้ำหนักของข้อ
- `jobRaw` = Σ (score × weight)
- `jobMax` = 5 × Σ weight (น้ำหนักรวม 100 → เต็ม 500) — คำนวณจากน้ำหนักจริงเสมอ ไม่ hard-code 500
- `job5` = `jobRaw / jobMax × 5`
- `jobPct` = `jobRaw / jobMax × pJob`

### 4.3 KPI (หัวหน้าเท่านั้น)
- หัวหน้ากรอก `kpiPercent` 0–100 (ทศนิยมได้) หรือกรอกเป็นคะแนนเต็ม 5 แล้วแปลง (`kpiPercent = score5 / 5 × 100`); ฐานข้อมูลเก็บเป็น % เสมอ
- `kpi5` = `kpiPercent / 100 × 5`
- `kpiPct` = `kpiPercent / 100 × pKpi`

### 4.4 รวม
- `total100` = `corePct + jobPct + kpiPct`
- `total5` = `total100 / 100 × 5`

### 4.4.1 คะแนนที่ปัดเศษ (สำหรับกราฟและรายงานบุคคล)
- `coreRounded(q)` = `roundHalfUp(combined(q), 0)` (>= .5 ปัดขึ้น), `core5Rounded` = ค่าเฉลี่ยของ `coreRounded` ทุกข้อ
- `total100Rounded` = คำนวณเหมือน `total100` แต่ใช้ `core5Rounded` แทน `core5`
- ใช้เฉพาะการแสดงผลกราฟและคอลัมน์ "ปัดเศษ"; `total100` เดิมยังเป็นค่าเต็มความละเอียด

### 4.5 ข้อมูลยังไม่ครบ → แสดงคะแนนระหว่างทางทันที
คะแนนคำนวณจากข้อมูลเท่าที่มีและอัปเดตเองเมื่อมีคนประเมินเพิ่ม (ไม่ต้องรอหัวหน้า):
- Core: ถ้ามีทั้งพนักงานและ head ที่นับคะแนน → `combined(q) = peerAvg × wPeer + headScore × wHead`; ถ้ามีฝั่งเดียว → ใช้ค่าของฝั่งนั้นตรง ๆ (`corePartial = true`); ถ้ายังไม่มีใครเลย → `null`
- Job Base / KPI: ยังไม่มี head ที่นับคะแนนบันทึก → `null` (ถ้ามีหลายคน ใช้ค่าเฉลี่ย)
- total100 = ผลรวมของหมวดที่มีข้อมูลแล้ว (ถ้าไม่มีหมวดไหนเลยจึงเป็น `null`); total5 = total100 / 100 × 5
- `isComplete` = มี Core (ทั้งสองฝั่ง) + Job Base + KPI ครบ, `availablePoints` = ผลรวมสัดส่วนของหมวดที่มีข้อมูล (เช่น 30 เมื่อมีแต่ Core)
- ฟังก์ชันคืน `null` สำหรับหมวดที่ยังไม่มีข้อมูล, UI แสดง "รอข้อมูล" สีเทา และติดป้าย "คะแนนระหว่างทาง" (แท่งกราฟสีอ่อน + เครื่องหมาย *) เมื่อ `isComplete = false`
- ในกราฟและการเรียงลำดับ คนที่ไม่มีคะแนนเลย (`null`) ไปอยู่ท้ายสุด
- หน้าภาพรวมและรายงานบุคคลรีเฟรชข้อมูลเองทุก 15 วินาที

### 4.6 ตัวอย่างสำหรับ test
คำถาม Core 1 ข้อ, wHead 0.5, สัดส่วน 30/35/35
- พนักงาน 10 คนให้รวม 40 → peerAvg 4.0; หัวหน้าให้ 4 → core5 = 4.00, corePct = 24.00
- Job Base ได้ 400/500 → job5 = 4.00, jobPct = 28.00
- KPI 90% → kpi5 = 4.50, kpiPct = 31.50
- total100 = **83.50**, total5 = **4.175** (แสดง 4.18)

เพิ่ม test: head ที่ `counts_in_score = false` ส่งคะแนนมาแล้วผลต้องไม่เปลี่ยน, มีแค่ head ที่ไม่นับคะแนน → รอข้อมูล, wHead = 0.6, น้ำหนัก Job รวมไม่เท่ากับ 100, ไม่มี peer, ไม่มี head, KPI = 0 และ 100

---

## 5. Data model (PostgreSQL)

```sql
create type user_role as enum ('head', 'staff');

create table staff_groups (
  id serial primary key,
  name text not null,
  sort_order int not null default 0
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  full_name text not null,
  role user_role not null default 'staff',
  staff_group_id int references staff_groups,   -- null สำหรับ head
  counts_in_score boolean not null default true, -- false = คะแนนที่คนนี้ให้ไม่ถูกนำไปคำนวณ
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table eval_cycles (
  id serial primary key,
  name text not null,                     -- เช่น 'ปี 2569 รอบ 1'
  is_open boolean not null default true,
  is_current boolean not null default false,  -- มีได้ทีละ 1 รอบ (partial unique index)
  head_weight numeric not null default 50 check (head_weight between 0 and 100),
  core_weight numeric not null default 30,
  job_weight  numeric not null default 35,
  kpi_weight  numeric not null default 35,
  check (core_weight + job_weight + kpi_weight = 100),
  created_at timestamptz not null default now()
);

-- คำถามผูกกับรอบ เพื่อให้แก้คำถามรอบใหม่แล้วรอบเก่าไม่เพี้ยน
create table core_groups (
  id serial primary key,
  cycle_id int not null references eval_cycles on delete cascade,
  code text not null,           -- B, D, M, S
  name text not null,
  sort_order int not null default 0
);

create table core_questions (
  id serial primary key,
  group_id int not null references core_groups on delete cascade,
  text text not null,
  sort_order int not null default 0
);

create table job_items (
  id serial primary key,
  cycle_id int not null references eval_cycles on delete cascade,
  staff_group_id int not null references staff_groups,
  text text not null,
  weight numeric not null check (weight > 0),
  sort_order int not null default 0
);

-- การประเมิน Core (ทั้ง staff และ head)
create table evaluations (
  id bigserial primary key,
  cycle_id int not null references eval_cycles,
  evaluator_id uuid not null references profiles,
  evaluatee_id uuid not null references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, evaluator_id, evaluatee_id),
  check (evaluator_id <> evaluatee_id)
);

create table core_answers (
  evaluation_id bigint references evaluations on delete cascade,
  question_id int references core_questions on delete cascade,
  score smallint not null check (score between 1 and 5),
  primary key (evaluation_id, question_id)
);

-- Job Base + KPI (head เท่านั้น)
create table head_assessments (
  id bigserial primary key,
  cycle_id int not null references eval_cycles,
  assessor_id uuid not null references profiles,
  evaluatee_id uuid not null references profiles,
  kpi_percent numeric not null check (kpi_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (cycle_id, assessor_id, evaluatee_id)
);

create table job_answers (
  head_assessment_id bigint references head_assessments on delete cascade,
  job_item_id int references job_items on delete cascade,
  score smallint not null check (score between 1 and 5),
  primary key (head_assessment_id, job_item_id)
);
```

การบันทึกแบบประเมิน (evaluation + answers) ต้องเป็น transaction เดียว → ทำเป็น Postgres function (`rpc`) เช่น `submit_evaluation(cycle_id, evaluatee_id, answers jsonb)` และ `submit_head_assessment(...)` ที่ upsert ทั้งหัวและรายการคำตอบ
Trigger: กันไม่ให้ evaluatee เป็น head, กันการเขียนเมื่อรอบปิด (ยกเว้น head ในหน้าจัดการข้อมูล), อัปเดต `updated_at`

---

## 6. Authentication

- **ล็อกอินหลัก = ชื่อ + PIN**: บัญชีสร้างโดยเซิร์ฟเวอร์ (service role `auth.admin.createUser`) ด้วยอีเมลภายใน `<profile-id>@pin.eval360.local` ที่ไม่ส่งเมลจริง
  - trigger `handle_new_user` (migration 0007) ยอมรับการสมัครที่ไม่ใช่ Google เฉพาะกรณีอีเมลลงท้าย `@pin.eval360.local` และมี profile ในรายชื่อ (ยังไม่มีบัญชี) ถือที่อยู่นั้นอยู่แล้ว; การสมัครด้วยอีเมล/รหัสผ่านทั่วไปผ่าน API ถูกปฏิเสธ (กันคนนอกสมัครเอง ซึ่งจำเป็นเพราะ Supabase ต้องเปิด sign-up ไว้ถ้าจะใช้ Google)
  - ทางสำรองสำหรับผู้ดูแลระบบ: ลิงก์ "เข้าด้วยอีเมล (บัญชีผู้ดูแลเดิม)" ใต้ฟอร์ม; หน้า `/reset-password` ใช้ตั้ง PIN ใหม่
  - แอดมินคนแรก: `npm run create:admin -- "ชื่อ"` (แสดง PIN ครั้งเดียว)
- **Google ล็อกอิน (ไม่บังคับ ปิดไว้ก่อน)**: โค้ดยังอยู่ ปุ่มแสดงเมื่อตั้ง `NEXT_PUBLIC_GOOGLE_LOGIN=on` และตั้งค่า Google ตาม README; จับคู่ด้วย `profiles.google_email` (migration 0005) ซึ่ง head กรอกได้ในหน้าแก้ไขผู้ใช้
- ผู้ใช้ที่ `is_active = false` ถูกบล็อกทุกหน้า (และ RLS ไม่คืนข้อมูล)
- Middleware ตรวจ session + role แล้ว redirect ตามสิทธิ์ (staff เข้า URL เมนูอื่นตรง ๆ ต้องถูกเด้งกลับ)

---

## 7. Row Level Security

เปิด RLS ทุกตาราง สร้าง helper (security definer): `is_head()` = role ของ `auth.uid()` เป็น 'head' และ active

นโยบาย:
- `profiles`: ผู้ใช้ที่ active อ่านได้เฉพาะคอลัมน์ที่จำเป็น (id, full_name, staff_group_id, role) — ทำเป็น view `directory` (ไม่เปิดเผยอีเมล); อ่านเต็ม/เขียนได้เฉพาะ head
- `staff_groups`, `eval_cycles`, `core_groups`, `core_questions`: อ่านได้ทุกคนที่ล็อกอิน; เขียนได้เฉพาะ head
- `job_items`: อ่าน/เขียนเฉพาะ head
- `evaluations` / `core_answers`:
  - staff: select/insert/update เฉพาะแถวที่ `evaluator_id = auth.uid()` และรอบเปิดอยู่; ห้ามลบ
  - head: select/insert/update/delete ได้ทั้งหมด
- `head_assessments` / `job_answers`: head เท่านั้น; staff ไม่เห็นเลย
- **staff ต้องไม่มีทางเห็นคะแนนที่คนอื่นให้ หรือคะแนนสรุปของใครเลย รวมถึงของตัวเอง**

เขียน test RLS อย่างน้อย: staff อ่าน evaluations ของคนอื่นไม่ได้, staff อ่าน head_assessments ไม่ได้, staff ประเมินตัวเอง/head ไม่ได้, staff เข้าถึงอีเมลคนอื่นไม่ได้

---

## 8. UI / Design guidelines

เป้าหมาย: **คลีน ใส โทนขาว-น้ำเงิน สไตล์กระจกฝ้า (frosted glass) เงานุ่ม** (ปรับตามแนวที่เจ้าของโปรเจกต์ต้องการ แทนแนว minimalist เดิม)

ทำ:
- พื้นหลังไล่เฉดฟ้าอ่อนจาง ๆ (`#F5F8FF` + radial gradient), การ์ดเป็นกระจกฝ้า (`bg-white/70 backdrop-blur-xl`, ขอบขาว, เงานุ่ม `shadow-glass`), มุมโค้งใหญ่ (`rounded-2xl`)
- ตัวอักษรหลัก `#0F172A`, ตัวรอง `#64748B`, เส้นขอบ `#E1E8F6`
- สี accent **สีเดียว** = น้ำเงิน `#2F5BFF` ใช้กับปุ่มหลัก (มี glow), เมนูที่ active, แท่งกราฟ
- สีสถานะใช้เฉพาะที่จำเป็น: รอข้อมูล = เทา, ลบ = ส้มแดงหม่น
- ฟอนต์ใหญ่อ่านง่าย (scale ใน `tailwind.config.ts`: sm = 15px, base = 16px), ตัวเลขคะแนนใช้ `tabular-nums` ชิดขวาในตาราง
- ปุ่มให้คะแนน 1–5 เป็น segmented control ขนาดใหญ่ (สูง ≥ 44px) แสดงความคืบหน้า (เช่น 7/12 ข้อ) แบบ sticky ด้านล่างพร้อมปุ่มบันทึก
- Navigation: เดสก์ท็อปเป็น sidebar ลอยด้านซ้าย, มือถือเป็น bottom bar แบบกระจก (staff มีเมนูเดียวจึงไม่ต้องแสดง nav)
- ตารางกว้างให้ scroll แนวนอนในกรอบของตัวเอง, คอลัมน์ชื่อ sticky
- Empty state ใช้ `EmptyState` (ไอคอน + ข้อความอธิบาย + ปุ่มนำไปทำขั้นต่อไป) และ skeleton ตอน loading
- Toast แจ้งผลการบันทึก แทน `alert()`

ไม่ทำ:
- gradient ม่วง-น้ำเงินสดเกินจำเป็น, การ์ดซ้อนการ์ด, เงาดำหนัก
- emoji เป็นไอคอนหรือหัวข้อ
- สีพาสเทลหลายสีปนกัน, badge สีรุ้ง
- ข้อความ marketing หรือคำโปรยเกินจำเป็น
- animation ที่ไม่ช่วยอะไร (อนุญาตแค่ transition สั้น ๆ ≤ 150ms)

---

## 9. Seed data

`supabase/seed.sql` สร้างจาก `docs/prototype.html`:
- staff_groups: เภสัชกร, เจ้าหน้าที่ห้องยา
- รอบเริ่มต้น 1 รอบ (เปิด, current, น้ำหนัก 50 / 30-35-35)
- core_groups + core_questions: หมวด B, D, M, S จาก `coreGroups` ในต้นแบบ
- job_items: `jobPharma` → กลุ่มเภสัชกร, `jobStaff` → กลุ่มเจ้าหน้าที่ห้องยา (พร้อมน้ำหนัก)
- ผู้ใช้: สร้างด้วยสคริปต์ `scripts/seed-users.ts` (ใช้ service role, ส่งอีเมลเชิญ) อ่านจาก `scripts/users.csv` (email, full_name, role, group, counts_in_score) ที่ผู้ใช้เติมเอง
  - รายชื่อตั้งต้นจาก `defaultPharmacists`, `defaultStaffs` ในต้นแบบ
  - head: ชลิตา ธารสิริโรจน์ (`counts_in_score = true`), น.ส. อุมากร โฮ่สกุล (`counts_in_score = false`)

---

## 10. ลำดับการพัฒนา

1. Setup โปรเจกต์ + Supabase + migration + RLS + seed
2. `scoring.ts` + unit tests (ต้องผ่านก่อนไปทำหน้าจอ)
3. Auth: ล็อกอิน, เปลี่ยนรหัสผ่าน, middleware ตามบทบาท
4. เมนู 1 และ 2 (ฟอร์มประเมิน)
5. เมนู 5 (ตั้งค่า) และ 6 (จัดการข้อมูล)
6. เมนู 3 (ภาพรวม/กราฟ) และ 4 (รายงานบุคคล)
7. PWA, ทดสอบบนมือถือจริง, RLS tests

## 11. Conventions

- Server Components เป็นหลัก, Client Component เฉพาะที่มี interaction
- เขียนข้อมูลผ่าน server action หรือ rpc เท่านั้น, validate ด้วย Zod ทั้งฝั่ง client และ server
- ห้ามใช้ `any`
- Generate type จาก Supabase (`supabase gen types typescript`) เก็บที่ `src/types/database.ts`
- Commit เล็กและบ่อย ข้อความ commit เป็นภาษาอังกฤษ
