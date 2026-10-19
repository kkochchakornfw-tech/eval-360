/**
 * Row types for the public schema (hand-maintained to match supabase/migrations).
 * Once a Supabase project exists, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.generated.ts
 */
export type UserRole = "head" | "staff";

export interface StaffGroup {
  id: number;
  name: string;
  sort_order: number;
}

export interface Profile {
  id: string;
  /** null while the person has no login yet */
  email: string | null;
  full_name: string;
  role: UserRole;
  staff_group_id: number | null;
  counts_in_score: boolean;
  is_active: boolean;
  /** false = added to the roster but not invited yet (cannot sign in or evaluate) */
  has_account: boolean;
  /** a normal person (role staff) who also sees every page */
  is_admin: boolean;
  /** legacy: account created with a generated PIN (before Google sign-in); no longer used */
  code_login: boolean;
  /** must set a new secret on next sign-in */
  must_change_password: boolean;
  /** Google address this person signs in with (set by a head); null = not set */
  google_email: string | null;
  created_at: string;
}

/** Non-sensitive view readable by every active user */
export interface DirectoryEntry {
  id: string;
  full_name: string;
  staff_group_id: number | null;
  role: UserRole;
}

export interface EvalCycle {
  id: number;
  name: string;
  is_open: boolean;
  is_current: boolean;
  head_weight: number;
  core_weight: number;
  job_weight: number;
  kpi_weight: number;
  created_at: string;
}

export interface CoreGroup {
  id: number;
  cycle_id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface CoreQuestion {
  id: number;
  group_id: number;
  text: string;
  sort_order: number;
}

export interface JobItem {
  id: number;
  cycle_id: number;
  staff_group_id: number;
  text: string;
  weight: number;
  sort_order: number;
}

export interface Evaluation {
  id: number;
  cycle_id: number;
  evaluator_id: string;
  evaluatee_id: string;
  created_at: string;
  updated_at: string;
}

export interface CoreAnswer {
  evaluation_id: number;
  question_id: number;
  score: number;
}

export interface HeadAssessment {
  id: number;
  cycle_id: number;
  assessor_id: string;
  evaluatee_id: string;
  kpi_percent: number;
  updated_at: string;
}

export interface JobAnswer {
  head_assessment_id: number;
  job_item_id: number;
  score: number;
}

export interface CoreGroupWithQuestions extends CoreGroup {
  questions: CoreQuestion[];
}
