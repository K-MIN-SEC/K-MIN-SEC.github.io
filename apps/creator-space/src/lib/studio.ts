import { supabase, messageOf, ensureCommunityUser } from "./supabase";
const paths: Record<string, string> = {
  work: "works",
  project: "projects",
  teamup: "team-up",
  event: "events",
};
const form = document.querySelector<HTMLFormElement>("[data-editor]")!;
const fields = document.querySelector<HTMLFieldSetElement>(
  "[data-editor-fields]",
)!;
const status = document.querySelector<HTMLElement>("[data-studio-status]")!;
const select = form.elements.namedItem("kind") as HTMLSelectElement;
const params = new URLSearchParams(location.search);
let editing = params.get("id");
let editedKind = params.get("kind") || "work";
if (!paths[editedKind]) editedKind = "work";
const node = (tag: string, text: string) => {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
};
function toggle() {
  document.querySelector<HTMLElement>("[data-entry-fields]")!.hidden =
    select.value === "project";
  document.querySelector<HTMLElement>("[data-project-fields]")!.hidden =
    select.value !== "project";
}
select.value = editedKind;
select.onchange = toggle;
toggle();
function set(name: string, value: unknown) {
  const el = form.elements.namedItem(name);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
    el.value = Array.isArray(value) ? value.join(", ") : String(value ?? "");
}
function option(name: string, id: string, title: string) {
  const el = form.elements.namedItem(name) as HTMLSelectElement;
  const item = document.createElement("option");
  item.value = id;
  item.textContent = title;
  el.append(item);
}
async function load() {
  const user = await ensureCommunityUser();
  const db = supabase!;
  const [
    { data: creator, error: ce },
    entries,
    projects,
    memberships,
    invites,
  ] = await Promise.all([
    db.rpc("is_creator"),
    db
      .from("creator_entries")
      .select("*")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    db
      .from("creator_projects")
      .select("*")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    db
      .from("project_memberships")
      .select("project_id")
      .eq("user_id", user.id)
      .eq("status", "accepted"),
    db
      .from("project_memberships")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);
  for (const error of [
    ce,
    entries.error,
    projects.error,
    memberships.error,
    invites.error,
  ])
    if (error) throw error;
  fields.disabled = !creator;
  status.textContent = creator
    ? "새로 작성하거나 아래 내 작업에서 수정할 글을 선택해 주세요."
    : "프로필 화면에서 Creator 승인을 신청해 주세요. 일반 게시글은 승인 없이 작성할 수 있습니다.";
  for (const p of projects.data || []) option("project_id", p.id, p.title);
  const ids = (memberships.data || [])
    .map((x) => x.project_id)
    .filter((id) => !projects.data?.some((p) => p.id === id));
  if (ids.length) {
    const result = await db
      .from("creator_projects")
      .select("id,title")
      .in("id", ids);
    if (result.error) throw result.error;
    for (const p of result.data || []) option("project_id", p.id, p.title);
  }
  for (const t of entries.data || [])
    if (t.kind === "teamup") option("team_up_id", t.id, t.title);
  const all = [
    ...(entries.data || []),
    ...(projects.data || []).map((p) => ({ ...p, kind: "project" })),
  ];
  const list = document.querySelector<HTMLElement>("[data-my-content]")!;
  list.replaceChildren();
  for (const item of all) {
    const row = node("article", "");
    row.className = "cs-item";
    const link = document.createElement("a");
    link.href = `/${paths[item.kind]}/${item.id}/`;
    link.textContent = item.title;
    const edit = document.createElement("a");
    edit.href = `/studio/?kind=${item.kind}&id=${item.id}`;
    edit.className = "text-link";
    edit.textContent = "수정하기";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "삭제";
    remove.className = "text-link";
    remove.onclick = async () => {
      if (
        !confirm(
          "이 콘텐츠를 삭제할까요? 공개 목록과 참여 이력에서 내려갑니다.",
        )
      )
        return;
      remove.disabled = true;
      try {
        const result = await db.rpc("delete_creator_content", {
          p_id: item.id,
          p_kind: item.kind,
        });
        if (result.error) throw result.error;
        location.assign("/studio/");
      } catch (e) {
        status.textContent = messageOf(e);
        remove.disabled = false;
      }
    };
    row.append(
      link,
      node(
        "small",
        `${item.kind} · ${item.moderation_status === "hidden" ? "운영자 숨김" : item.visibility}`,
      ),
      edit,
      remove,
    );
    list.append(row);
  }
  if (!all.length) list.append(node("p", "아직 저장한 작업이 없습니다."));
  if (editing) {
    const item = all.find((x) => x.id === editing && x.kind === editedKind);
    if (!item) throw new Error("편집할 수 있는 내 작업을 찾지 못했습니다.");
    for (const [key, value] of Object.entries(item)) set(key, value);
    select.disabled = true;
    const view = document.querySelector<HTMLAnchorElement>("[data-view]")!;
    view.href = `/${paths[item.kind]}/${item.id}/`;
    view.hidden = false;
  }
  const box = document.querySelector<HTMLElement>("[data-invitations]")!;
  box.replaceChildren();
  for (const invite of invites.data || []) {
    const row = node("article", "");
    row.className = "cs-item";
    row.append(
      node("h3", invite.role),
      node("p", invite.description || "참여 이력을 확인해 주세요."),
    );
    const link = document.createElement("a");
    link.href = `/projects/${invite.project_id}/`;
    link.textContent = "프로젝트 보기";
    row.append(link);
    for (const [value, label] of [
      ["accepted", "참여 확인"],
      ["rejected", "거절"],
    ]) {
      const btn = document.createElement("button");
      btn.className = "button secondary";
      btn.textContent = label;
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const result = await db.rpc("respond_project_membership", {
            p_membership_id: invite.id,
            p_response: value,
          });
          if (result.error) throw result.error;
          row.replaceChildren(
            node(
              "p",
              value === "accepted"
                ? "참여를 확인했습니다."
                : "요청을 거절했습니다.",
            ),
          );
        } catch (e) {
          status.textContent = messageOf(e);
          btn.disabled = false;
        }
      };
      row.append(btn);
    }
    box.append(row);
  }
  if (!invites.data?.length)
    box.append(node("p", "대기 중인 참여 요청이 없습니다."));
}
form.onsubmit = async (event) => {
  event.preventDefault();
  const button = document.querySelector<HTMLButtonElement>("[data-save]")!;
  button.disabled = true;
  try {
    await ensureCommunityUser();
    const raw = Object.fromEntries(new FormData(form));
    const kind = editing ? editedKind : String(raw.kind);
    const data: Record<string, unknown> = {
      ...raw,
      kind,
      tags: String(raw.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    for (const name of ["cover_url", "video_url", "external_url", "result_url"])
      if (data[name] && !String(data[name]).startsWith("https://"))
        throw new Error(
          "이미지와 영상, 결과물 주소는 https://로 시작해야 합니다.",
        );
    if (data.cover_url && !data.cover_alt)
      throw new Error("대표 이미지 설명을 입력해 주세요.");
    let id = editing;
    if (kind === "project") {
      if (!id) {
        const created = await supabase!.rpc("create_creator_project", {
          p_title: data.title,
          p_summary: data.summary,
          p_category: data.category,
          p_role: data.role_summary,
          p_started_on: data.started_on || null,
          p_ended_on: data.ended_on || null,
          p_status: data.project_status,
          p_visibility: "draft",
          p_result_url: data.result_url || null,
        });
        if (created.error) throw created.error;
        id = created.data;
        editing = id;
        editedKind = "project";
        history.replaceState(null, "", `/studio/?kind=project&id=${id}`);
      }
      const result = await supabase!.rpc("update_creator_project", {
        p_id: id,
        p_data: data,
      });
      if (result.error) throw result.error;
    } else {
      const result = await supabase!.rpc("save_creator_entry", {
        p_data: data,
        p_id: id,
      });
      if (result.error) throw result.error;
      id = result.data;
    }
    location.assign(`/${paths[kind]}/${id}/`);
  } catch (e) {
    status.textContent = messageOf(e);
  } finally {
    button.disabled = false;
  }
};
load().catch((e) => {
  status.textContent = messageOf(e);
});
