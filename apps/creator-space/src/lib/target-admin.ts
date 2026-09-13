import { supabase, messageOf, ensureCommunityUser } from "./supabase";
const status = document.querySelector<HTMLElement>(
  "[data-target-admin-status]",
)!;
async function load() {
  await ensureCommunityUser();
  const db = supabase!;
  const staff = await db.rpc("is_admin");
  if (staff.error) throw staff.error;
  if (!staff.data) throw new Error("커뮤니티 운영 권한이 필요합니다.");
  const reports = await db
    .from("target_reports")
    .select("*")
    .eq("status", "open")
    .order("created_at");
  if (reports.error) throw reports.error;
  const box = document.querySelector<HTMLElement>("[data-target-reports]")!;
  box.replaceChildren();
  for (const report of reports.data || []) {
    const row = document.createElement("article");
    row.className = "cs-item";
    const text = document.createElement("p");
    text.textContent = report.reason;
    row.append(text);
    const target = await db
      .from("content_targets")
      .select("*")
      .eq("id", report.content_target_id)
      .maybeSingle();
    if (target.data) {
      const routes: Record<string, string> = {
        work: "works",
        project: "projects",
        teamup: "team-up",
        event: "events",
      };
      const path = routes[target.data.content_type];
      if (path) {
        const a = document.createElement("a");
        a.href = `/${path}/${target.data.external_id}/`;
        a.textContent = "신고 대상 보기";
        row.append(a);
      }
    }
    for (const [value, label] of [
      ["hide", "숨김 처리"],
      ["dismiss", "신고 기각"],
    ]) {
      const b = document.createElement("button");
      b.className = "button secondary";
      b.textContent = label;
      b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await db.rpc("resolve_target_report", {
            p_id: report.id,
            p_action: value,
          });
          if (r.error) throw r.error;
          await load();
        } catch (e) {
          status.textContent = messageOf(e);
          b.disabled = false;
        }
      };
      row.append(b);
    }
    box.append(row);
  }
  status.textContent = reports.data?.length
    ? `${reports.data.length}개의 신고를 확인해 주세요.`
    : "처리할 신고가 없습니다.";
  const targets = await db
    .from("content_targets")
    .select("*")
    .in("content_type", ["work", "project", "teamup", "event"])
    .neq("status", "deleted")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (targets.error) throw targets.error;
  const select = document.querySelector<HTMLSelectElement>(
    "[data-target-select]",
  )!;
  select.replaceChildren();
  for (const t of targets.data || []) {
    const r = await db
      .from(
        t.content_type === "project" ? "creator_projects" : "creator_entries",
      )
      .select("title")
      .eq("id", t.external_id)
      .maybeSingle();
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = `${r.data?.title || t.external_id} · ${t.content_type} · ${t.status}`;
    select.append(o);
  }
  const f = document.querySelector<HTMLFormElement>(
    "[data-target-moderation]",
  )!;
  f.querySelector("fieldset")!.disabled = false;
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData(f);
      const r = await db.rpc("moderate_creator_target", {
        p_target: data.get("target"),
        p_action: data.get("action"),
      });
      if (r.error) throw r.error;
      await load();
      status.textContent = "운영 설정을 적용했습니다.";
    } catch (e) {
      status.textContent = messageOf(e);
    }
  };
}
load().catch((e) => (status.textContent = messageOf(e)));
