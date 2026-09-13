import { supabase, messageOf } from "./supabase";
const root = document.querySelector<HTMLElement>("[data-member-profile]")!;
const get = (key: string) =>
  root.querySelector<HTMLElement>(`[data-member-${key}]`)!;
async function hydrate() {
  if (!supabase) return;
  const session = await supabase.auth.getSession();
  if (!session.data.session) return;
  const db = supabase;
  const result = await db
    .from("member_profiles")
    .select("*")
    .eq("handle", root.dataset.handle!)
    .maybeSingle();
  if (result.error) throw result.error;
  const p = result.data;
  if (!p) return;
  get("name").textContent = p.display_name;
  get("bio").textContent = p.bio;
  get("meta").textContent = [p.school_name, p.department_name, p.primary_role]
    .filter(Boolean)
    .join(" · ");
  get("status").textContent =
    p.visibility === "public" ? "" : "회원에게 공개된 프로필입니다.";
  const [contacts, works, members] = await Promise.all([
    db
      .from("profile_contacts")
      .select("contact_type,contact_value")
      .eq("user_id", p.user_id),
    db
      .from("creator_entries")
      .select("id,title,summary")
      .eq("kind", "work")
      .eq("owner_id", p.user_id)
      .in("visibility", ["public", "members"])
      .is("deleted_at", null),
    db
      .from("project_memberships")
      .select("project_id,role,description")
      .eq("user_id", p.user_id)
      .eq("status", "accepted"),
  ]);
  for (const e of [contacts.error, works.error, members.error]) if (e) throw e;
  get("contacts").replaceChildren();
  for (const c of contacts.data || []) {
    const row = document.createElement("p");
    row.textContent = `${c.contact_type}: ${c.contact_value}`;
    get("contacts").append(row);
  }
  get("works").replaceChildren();
  for (const w of works.data || []) {
    const a = document.createElement("a");
    a.className = "cs-card";
    a.href = `/works/${w.id}/`;
    const h = document.createElement("h3");
    h.textContent = w.title;
    const text = document.createElement("p");
    text.textContent = w.summary;
    a.append(h, text);
    get("works").append(a);
  }
  get("experience").replaceChildren();
  for (const m of members.data || []) {
    const pr = await db
      .from("creator_projects")
      .select("id,title")
      .eq("id", m.project_id)
      .in("visibility", ["public", "members"])
      .is("deleted_at", null)
      .maybeSingle();
    if (pr.error) throw pr.error;
    if (!pr.data) continue;
    const a = document.createElement("a");
    a.className = "cs-item";
    a.href = `/projects/${pr.data.id}/`;
    a.textContent = `${pr.data.title} · ${m.role} · 참여 확인됨`;
    get("experience").append(a);
  }
}
hydrate().catch((e) => (get("status").textContent = messageOf(e)));
