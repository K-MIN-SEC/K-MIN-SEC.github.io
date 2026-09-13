import { profileSummary } from "./profile-summary";
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
  get("edit").hidden=p.user_id!==session.data.session.user.id;
  const details=profileSummary(p);
  get("facts").hidden=false;
  get('availability').textContent=details.availability;get('availability').hidden=!details.availability;get('availability').dataset.state=details.availabilityState;
  get('role').textContent=details.role;get('role').hidden=!details.role;
  for(const key of ['interests','tools'] as const){
    const tags=details[key];get(key).replaceChildren();
    for(const tag of tags){const chip=document.createElement('span');chip.className='profile-tag';chip.textContent=tag;get(key).append(chip);}
    if(!tags.length){const empty=document.createElement('p');empty.className='profile-empty';empty.textContent=key==='interests'?'등록한 관심 분야가 없습니다.':'등록한 도구가 없습니다.';get(key).append(empty);}
  }
  get("name").textContent = p.display_name;
  get("bio").textContent = p.bio;get("bio").hidden=!p.bio;
  get("meta").textContent = [details.affiliation,details.schoolYear].filter(Boolean).join(' · ');get("meta").hidden=!details.affiliation&&!details.schoolYear;
  get("status").textContent =
    p.visibility === "public" ? "" : p.visibility === "private" ? "나만 볼 수 있는 비공개 프로필입니다." : "회원에게 공개된 프로필입니다.";
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
  get("contact-section").hidden=!contacts.data?.length;
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
  for(const [key,text] of [['works','표시할 작품이 아직 없습니다.'],['experience','표시할 프로젝트 참여 이력이 아직 없습니다.']]){
    if(!get(key).children.length){const empty=document.createElement('p');empty.className='profile-empty';empty.textContent=text;get(key).append(empty);}
  }
}
hydrate().catch((e) => (get("status").textContent = messageOf(e)));
