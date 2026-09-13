import { createClient } from "@supabase/supabase-js";
export function publicDB() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL,
    key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("서비스 연결값을 설정해 주세요.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export const kinds = {
  work: { label: "Works", path: "works" },
  project: { label: "Projects", path: "projects" },
  teamup: { label: "Team Up", path: "team-up" },
  event: { label: "Events", path: "events" },
} as const;
export type Kind = keyof typeof kinds;
export function safeURL(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
export const uuid = (s: string | undefined) =>
  Boolean(
    s &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    ),
  );
