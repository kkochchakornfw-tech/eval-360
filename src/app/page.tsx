import { redirect } from "next/navigation";
import { homeFor, requireProfile } from "@/lib/session";

/** Home: send each person to their landing page. */
export default async function Home() {
  const profile = await requireProfile();
  redirect(homeFor(profile));
}
