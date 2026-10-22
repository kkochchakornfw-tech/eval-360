# ระบบประเมิน 360 องศา (Eval 360)

Next.js (App Router) + TypeScript + Tailwind + Supabase. รายละเอียดข้อกำหนดทั้งหมดอยู่ใน `CLAUDE.md`
ต้นแบบเดิมอยู่ที่ `docs/prototype.html`

## ตั้งค่าครั้งแรก

1. สร้างโปรเจกต์ Supabase (region `ap-southeast-1`)
2. **Authentication → Sign In / Providers**: **ปิด** "Allow new users to sign up" (ใช้ชื่อ + PIN อย่างเดียว การสร้างบัญชีทำจากฝั่งเซิร์ฟเวอร์ ไม่ต้องเปิดสมัครเอง) ต้องเปิดเฉพาะเมื่อจะใช้ปุ่ม Google ตามหัวข้อด้านล่าง ซึ่ง migration `0007` กันคนนอกสมัครเองไว้ให้อยู่แล้ว
3. (ไม่บังคับ ตอนนี้ไม่มีการส่งอีเมลเชิญแล้ว) **Authentication → SMTP**: ตั้ง custom SMTP ถ้าจะใช้ลิงก์ตั้งรหัสผ่านทางอีเมลของผู้ดูแลระบบ
4. **Authentication → URL Configuration**: ใส่ Site URL (เช่น `https://your-app.vercel.app`) และเพิ่ม Redirect URLs
   `https://your-app.vercel.app/auth/confirm` และ `https://your-app.vercel.app/auth/callback`
5. รัน migration + seed (Supabase CLI)
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   แล้วรันไฟล์ `supabase/seed.sql` ใน SQL Editor หนึ่งครั้ง (กลุ่มพนักงาน, รอบเริ่มต้น, คำถาม Core, Job Base)
6. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า (`SUPABASE_SERVICE_ROLE_KEY` ใช้ฝั่ง server เท่านั้น)
7. (ไม่บังคับ) **เทมเพลตอีเมล (ภาษาไทย)** — ใน Authentication → Email Templates ให้ลิงก์ชี้มาที่แอป:
   - Invite user: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`
     (ค่า redirect ที่แอปส่งคือ `/auth/confirm?next=/reset-password`)
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
8. **สร้างแอดมินคนแรก** (ยังไม่มีใครเข้าระบบได้ จึงสร้างจากสคริปต์):
   ```bash
   npm run create:admin -- "ชื่อ-สกุล"
   ```
   สคริปต์แสดง PIN 8 หลักครั้งเดียว เข้าหน้า login เลือกชื่อ ใส่ PIN แล้วตั้ง PIN ใหม่
9. เติมรายชื่อผู้ใช้: คัดลอก `scripts/users.template.csv` เป็น `scripts/users.csv` แล้วรัน
   ```bash
   npm run seed:users
   ```
   (เพิ่มรายชื่อโดยยังไม่มีบัญชี รันซ้ำได้) จากนั้นเข้าเมนู ตั้งค่าระบบ → ผู้ใช้ กด **สร้างบัญชีให้ทุกคนที่ยังไม่มี** ระบบแสดง PIN ของแต่ละคนครั้งเดียว คัดลอกไปแจก (ต้องรัน migration ครบถึง `0007` ก่อน)

## ตั้งค่าล็อกอินด้วย Google (ไม่บังคับ)

ตอนนี้ระบบใช้ชื่อ + PIN เป็นหลัก ส่วนนี้ทำเมื่ออยากเปิดปุ่ม Google เพิ่ม: ทำตามขั้นตอนด้านล่าง แล้วตั้ง `NEXT_PUBLIC_GOOGLE_LOGIN=on` ใน `.env.local` / ตัวแปรของเซิร์ฟเวอร์ที่ deploy

ทำครั้งเดียว ใช้เวลาประมาณ 15 นาที ต้องมีบัญชี Google (Gmail ก็ได้) และสิทธิ์เข้า Supabase dashboard ของโปรเจกต์
ก่อนเริ่ม ให้รู้ 2 ค่านี้ไว้:
- **Project ref / URL ของ Supabase** เช่น `https://abcdxyz.supabase.co` (ดูที่ Project Settings → API)
- **URL ของเว็บแอป** เช่น `https://your-app.vercel.app` (ตอนทดสอบในเครื่องคือ `http://localhost:3000`)

### ส่วน A — Google Cloud Console

1. เปิด <https://console.cloud.google.com> แล้วล็อกอินด้วยบัญชี Google
2. กดชื่อโปรเจกต์มุมบนซ้าย → **New Project** → ตั้งชื่อ เช่น `eval-360` → **Create** แล้วเลือกโปรเจกต์นั้น
   - ถ้าล็อกอินด้วยอีเมล `@bdms` แล้วสร้างโปรเจกต์ไม่ได้ (องค์กรจำกัดสิทธิ์) ให้ออกแล้วล็อกอินด้วย Gmail ส่วนตัวแทน ใช้สร้างโปรเจกต์นี้ได้ ไม่เกี่ยวกับบัญชี Supabase
3. เมนูซ้าย **APIs & Services → OAuth consent screen** (หรือ **Google Auth Platform → Branding**)
   - User Type: **External** (ต้องเลือกแบบนี้ เพราะมีทั้งอีเมล `@bdms` และ Gmail ส่วนตัวปนกัน; **Internal** รับได้เฉพาะ `@bdms`)
   - App name: `ระบบประเมิน 360 องศา`, User support email และ Developer contact: อีเมลของคุณ
   - กด **Save and Continue** จนจบ (Scopes ไม่ต้องเพิ่ม ใช้ค่าพื้นฐาน `email`, `profile`, `openid`)
   - ถ้าเลือก External ให้กด **Publish app** (สถานะ In production) ไม่งั้นมีเฉพาะอีเมลที่เพิ่มเป็น Test users เท่านั้นที่เข้าได้
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**, Name: `eval-360-web`
   - **Authorized JavaScript origins** → Add URI: URL ของเว็บแอป (เช่น `https://your-app.vercel.app`) และถ้าจะทดสอบในเครื่องเพิ่ม `http://localhost:3000`
   - **Authorized redirect URIs** → Add URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     (ต้องเป็น URL ของ **Supabase** ตามนี้ ไม่ใช่ URL ของเว็บแอป และห้ามมีเว้นวรรคหรือ `/` ต่อท้าย)
   - กด **Create**
5. หน้าต่างจะแสดง **Client ID** และ **Client secret** ให้คัดลอกเก็บไว้ (อย่าส่งต่อใน LINE/อีเมลสาธารณะ และอย่า commit ลง git)

### ส่วน B — Supabase

1. Supabase dashboard → **Authentication → Sign In / Providers** (บางเวอร์ชันชื่อ **Providers**) → เลือก **Google**
2. เปิดสวิตช์ **Enable Sign in with Google**
3. วาง **Client ID** และ **Client Secret** จากส่วน A ข้อ 5 แล้วกด **Save**
4. คงตัวเลือก **Skip nonce checks** ไว้เป็นปิด (ค่าเริ่มต้น)
5. **Authentication → URL Configuration**
   - **Site URL**: URL ของเว็บแอป (เช่น `https://your-app.vercel.app`)
   - **Redirect URLs**: ต้องมี `https://your-app.vercel.app/auth/callback` (และ `http://localhost:3000/auth/callback` ถ้าทดสอบในเครื่อง)
6. ตรวจว่า **Allow new users to sign up** เปิดอยู่ (ดูข้อ 2 ด้านบน)
7. ถ้ายังไม่ได้รัน migration ล่าสุด ให้รัน `npx supabase db push` เพื่อให้มี `0005_google_login.sql`, `0006_close_open_signup.sql` และ `0007_pin_signup_gate.sql` (ตัวหลังปิดช่องที่คนนอกสมัครด้วยอีเมล/รหัสผ่านผ่าน API ได้ ต้องรันก่อนเปิดให้ใช้งานจริง)

### ส่วน C — ลงทะเบียนอีเมลของแต่ละคนในแอป

1. เข้าแอปด้วยบัญชีแอดมิน/หัวหน้า (ทางสำรอง: ลิงก์ "เข้าด้วยวิธีอื่น" ใต้ปุ่ม Google)
2. เมนู **ตั้งค่าระบบ → ผู้ใช้** → กด **แก้ไข** ที่แต่ละคน → กรอก **อีเมล Google ที่ใช้เข้าสู่ระบบ** → **บันทึก**
   - ต้องเป็นอีเมลเดียวกับบัญชี Google ที่คนนั้นจะกดเข้า (ตัวพิมพ์เล็ก/ใหญ่ไม่มีผล) และห้ามซ้ำกับคนอื่น
3. ให้ทุกคนเปิดเว็บแล้วกด **เข้าสู่ระบบด้วย Google** ครั้งแรกระบบจะผูกบัญชีกับชื่อในรายชื่อให้เอง ประวัติการประเมินเดิมไม่หาย

### ทดสอบ

- เข้าด้วย Gmail ที่ลงทะเบียนไว้ → ต้องเข้าได้และไปหน้าที่ตรงกับบทบาท (หัวหน้า → ภาพรวม, พนักงาน → ตอบแบบสอบถาม)
- เข้าด้วย Gmail ที่ไม่ได้ลงทะเบียน → ต้องเด้งกลับหน้า login พร้อมข้อความ "อีเมล Google นี้ยังไม่ได้รับอนุญาตให้เข้าระบบ"

### แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| Google แจ้ง `redirect_uri_mismatch` | Authorized redirect URI ใน Google Cloud ไม่ตรงกับ `https://<project-ref>.supabase.co/auth/v1/callback` เป๊ะ ๆ |
| Google แจ้ง `access_denied` / "app not verified" | เลือก External แต่ยังไม่ Publish app: กด Publish หรือเพิ่มอีเมลเป็น Test users |
| เด้งกลับ login ด้วยข้อความ "ยังไม่ได้รับอนุญาต" ทั้งที่ลงทะเบียนแล้ว | อีเมลในช่อง Google ของคนนั้นพิมพ์ไม่ตรงกับบัญชีที่กด, หรือบัญชีถูกปิดใช้งาน |
| ล็อกอินแล้วกลับไปหน้า login วนไปมา | Redirect URLs ใน Supabase ไม่มี `/auth/callback` ของเว็บ หรือ Site URL ผิด |
| `Signups not allowed for this instance` | ยังปิด "Allow new users to sign up" อยู่ ให้เปิด (ส่วน B ข้อ 6) |

## พัฒนา

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit test คะแนน + RLS (รันบน Postgres จำลองในหน่วยความจำ ไม่ต้องใช้ Supabase)
npm run lint       # tsc --noEmit
npm run build
```

`src/types/database.ts` เขียนมือให้ตรงกับ migration เมื่อมีโปรเจกต์ Supabase จริงแล้วสามารถ gen type ใหม่ได้ด้วย
`npx supabase gen types typescript --project-id <id>`

## โครงสร้างสำคัญ

| ที่ | หน้าที่ |
|---|---|
| `src/lib/scoring.ts` | สูตรคะแนนทั้งหมด (pure function) — ทดสอบใน `tests/scoring.test.ts` |
| `supabase/migrations/0001_schema.sql` | ตาราง, trigger, RPC `submit_evaluation` / `submit_head_assessment`, RLS |
| `tests/rls.test.ts` | ทดสอบ RLS: staff อ่านคะแนนคนอื่น/head_assessments/อีเมลไม่ได้, ประเมินตัวเองหรือ head ไม่ได้ ฯลฯ |
| `src/middleware.ts` | ตรวจ session, บทบาท, บัญชีที่ปิดใช้งาน |
| `src/app/actions/*` | server actions (validate ด้วย Zod ทุกจุดที่เขียนข้อมูล) |

## หมายเหตุ

- สิทธิ์ทุกอย่างบังคับที่ RLS; การซ่อนเมนูเป็นเพียง UX
- head ที่ `counts_in_score = false` กรอกและบันทึกได้ แต่ถูกตัดออกจากการคำนวณทั้งหมด
- ไอคอน PWA สร้างด้วย `node scripts/make-icons.mjs` (เปลี่ยนเป็นโลโก้จริงได้โดยแทนไฟล์ใน `public/icons/`)
