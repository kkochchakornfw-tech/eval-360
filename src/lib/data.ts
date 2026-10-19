import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoreGroupWithQuestions,
  CoreQuestion,
  DirectoryEntry,
  EvalCycle,
  JobItem,
  StaffGroup,
} from "@/types/database";

type Client = SupabaseClient;

/** PostgREST caps responses (1000 rows by default): page through everything. */
export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export async function getCycles(supabase: Client): Promise<EvalCycle[]> {
  const { data, error } = await supabase
    .from("eval_cycles")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EvalCycle[];
}

/** The cycle marked current, or the newest one as a fallback. */
export async function getCurrentCycle(supabase: Client): Promise<EvalCycle | null> {
  const cycles = await getCycles(supabase);
  return cycles.find((c) => c.is_current) ?? cycles[0] ?? null;
}

export async function getStaffGroups(supabase: Client): Promise<StaffGroup[]> {
  const { data } = await supabase.from("staff_groups").select("*").order("sort_order").order("id");
  return (data ?? []) as StaffGroup[];
}

export async function getDirectory(supabase: Client): Promise<DirectoryEntry[]> {
  const { data } = await supabase.from("directory").select("*").order("full_name");
  return (data ?? []) as DirectoryEntry[];
}

export async function getCoreStructure(
  supabase: Client,
  cycleId: number,
): Promise<CoreGroupWithQuestions[]> {
  const { data: groups } = await supabase
    .from("core_groups")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("sort_order")
    .order("id");
  const list = (groups ?? []) as CoreGroupWithQuestions[];
  if (list.length === 0) return [];
  const { data: questions } = await supabase
    .from("core_questions")
    .select("*")
    .in(
      "group_id",
      list.map((g) => g.id),
    )
    .order("sort_order")
    .order("id");
  const qs = (questions ?? []) as CoreQuestion[];
  return list.map((g) => ({ ...g, questions: qs.filter((q) => q.group_id === g.id) }));
}

export async function getJobItems(
  supabase: Client,
  cycleId: number,
  staffGroupId?: number | null,
): Promise<JobItem[]> {
  let q = supabase.from("job_items").select("*").eq("cycle_id", cycleId);
  if (staffGroupId != null) q = q.eq("staff_group_id", staffGroupId);
  const { data } = await q.order("sort_order").order("id");
  return (data ?? []) as JobItem[];
}
