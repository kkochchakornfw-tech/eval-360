import type { Profile } from "@/types/database";

/** Heads and admins see every page and can use all admin tools. */
export function canAdmin(p: Pick<Profile, "role" | "is_admin">): boolean {
  return p.role === "head" || p.is_admin;
}

/** Shortest allowed secret: PINs for ordinary staff, real passwords for heads and admins. */
export function minSecretLength(p: Pick<Profile, "role" | "is_admin">): number {
  return canAdmin(p) ? 8 : 6;
}
