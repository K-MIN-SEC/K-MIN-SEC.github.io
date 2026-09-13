import {notify,flash} from './feedback';
import { supabase, ensureCommunityUser, messageOf } from "./supabase";
const root = document.querySelector<HTMLElement>("[data-detail]")!,
  id = root.dataset.id!,
  kind = root.dataset.kind!;
const get = <T extends HTMLElement = HTMLElement>(name: string) =>
  root.querySelector<T>(`[data-${name}]`)!;
const status = get("detail-status");
const node = (tag: string, text: string) => {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
};
const safe = (s: unknown) => {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};
let target: string | undefined, userId: string | undefined;
let busy=false;
async function run(fn: () => Promise<void>) {
  if(busy)return;busy=true;
  const button=document.activeElement instanceof HTMLButtonElement?document.activeElement:null;
  if(button)button.disabled=true;
  try {
    await fn();
  } catch (e) {
    status.textContent = messageOf(e);notify(messageOf(e),"error");
  } finally {busy=false;if(button)button.disabled=false;}
}
async function comments() {
  const result = await supabase!
    .from("target_comments")
    .select("*")
    .eq("content_target_id", target!)
    .eq("status", "visible")
    .order("created_at")
    .limit(100);
  if (result.error) throw result.error;
  const list = get("comments");
  list.replaceChildren();
  for (const c of result.data || []) {
    const row = node("article", "");
    row.className = "cs-item comment-item";
    const actions=node("div", "");actions.className="comment-actions";
    row.append(node("strong", c.display_name), node("p", c.body));
    if (c.user_id === userId) {
      const edit = node("button", "수정") as HTMLButtonElement;
      edit.className = "text-link";
      edit.onclick = () => {
        const f = document.createElement("form");
        const label = node("label", "댓글 수정");
        const input = document.createElement("textarea");
        input.value = c.body;
        input.minLength = 2;
        input.maxLength = 2000;
        input.required = true;
        label.append(input);
        const save = node("button", "저장");
        const cancel=document.createElement('button');cancel.type='button';cancel.className='text-link';cancel.textContent='취소';cancel.onclick=()=>void run(comments);
        save.className='button secondary';const controls=node('div','');controls.className='comment-actions';controls.append(save,cancel);f.append(label,controls);
        f.onsubmit = (e) => {
          e.preventDefault();
          void run(async () => {
            const r = await supabase!.rpc("write_target_comment", {
              p_target: target,
              p_body: input.value,
              p_comment: c.id,
            });
            if (r.error) throw r.error;
            await comments();notify("댓글을 수정했습니다.");
          });
        };
        row.replaceChildren(f);
      };
      const del = node("button", "삭제") as HTMLButtonElement;
      del.className = "text-link";
      del.onclick = () =>
        void run(async () => {
          if (!confirm("이 댓글을 삭제할까요?")) return;
          const r = await supabase!.rpc("delete_target_comment", {
            p_id: c.id,
          });
          if (r.error) throw r.error;
          await comments();notify("댓글을 삭제했습니다.");
        });
      actions.append(edit, del);
    }
    const report = node("button", "신고") as HTMLButtonElement;
    report.className = "text-link";
    report.onclick = () => void doReport(c.id);
    actions.append(report);row.append(actions);
    list.append(row);
  }
  if (!result.data?.length) list.append(node("p", "첫 댓글을 남겨보세요."));
  const count = await supabase!.rpc("target_like_count", { p_id: target });
  if (count.error) throw count.error;
  get("like").textContent = `♡ 좋아요 ${count.data}`;
}
async function doReport(comment?: string) {
  await run(async () => {
    await ensureCommunityUser();
    const reason = prompt("신고 이유를 입력해 주세요.");
    if (!reason) return;
    const r = await supabase!.rpc("report_content_target", {
      p_target: target,
      p_reason: reason,
      p_comment: comment || null,
    });
    if (r.error) throw r.error;
    status.textContent = "신고를 접수했습니다.";
  });
}
async function load() {
  if (!supabase) throw new Error("서비스 연결을 확인해 주세요.");
  const session = await supabase.auth.getSession();
  userId = session.data.session?.user.id;
  let q = supabase
    .from(kind === "project" ? "creator_projects" : "creator_entries")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null);
  if (kind !== "project") q = q.eq("kind", kind);
  const result = await q.maybeSingle();
  if (result.error) throw result.error;
  const item = result.data;
  if (!item) {
    status.textContent =
      "존재하지 않거나 열람 권한이 없는 콘텐츠입니다. 로그인 후 다시 확인해 주세요.";
    const a = document.createElement("a");
    a.href = "/account/";
    a.textContent = " 로그인하기 →";
    status.append(a);
    return;
  }
  get("title").textContent = item.title;
  get("summary").textContent = item.summary;
  get("body").textContent = item.body || "";
  get("meta").textContent = [
    item.category,
    item.project_status,
    item.starts_on || item.started_on,
    item.ends_on || item.ended_on,
  ]
    .filter(Boolean)
    .join(" · ");
  const cover = get<HTMLImageElement>("cover");
  const source = safe(item.cover_url);
  cover.hidden = !source;
  if (source) {
    cover.src = source;
    cover.alt = item.cover_alt;
  }
  const links = get("links");
  links.replaceChildren();
  for (const [label, value] of [
    ["플레이 영상 보기 ↗", item.video_url],
    ["결과물 / 관련 링크 ↗", item.external_url || item.result_url],
  ]) {
    const url = safe(value);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      links.append(link);
    }
  }
  if (item.project_id) {
    const link = document.createElement("a");
    link.href = `/projects/${item.project_id}/`;
    link.textContent = "연결된 프로젝트 →";
    links.append(link);
  }
  if (item.team_up_id) {
    const link = document.createElement("a");
    link.href = `/team-up/${item.team_up_id}/`;
    link.textContent = "팀원 모집 글 →";
    links.append(link);
  }
  status.textContent =
    item.visibility === "public"
      ? ""
      : item.visibility === "draft"
        ? "비공개 초안입니다."
        : "회원에게 공개된 콘텐츠입니다.";
  get("author-actions").hidden = item.owner_id !== userId;
  get<HTMLButtonElement>("delete").onclick = () =>
    void run(async () => {
      if (!confirm("이 콘텐츠를 삭제할까요?")) return;
      const r = await supabase!.rpc("delete_creator_content", {
        p_id: id,
        p_kind: kind,
      });
      if (r.error) throw r.error;
      flash("작업을 삭제했습니다.");location.assign("/studio/");
    });
  if (kind === "project") {
    get("project-section").hidden = false;
    const ms = await supabase
      .from("project_memberships")
      .select("*")
      .eq("project_id", id)
      .order("created_at");
    if (ms.error) throw ms.error;
    const box = get("memberships");
    box.replaceChildren();
    for (const m of ms.data || []) {
      if (m.status !== "accepted" && item.owner_id !== userId) continue;
      const p = await supabase
        .from("member_profiles")
        .select("display_name,handle")
        .eq("user_id", m.user_id)
        .maybeSingle();
      const row = node("article", "");
      row.className = "cs-item";
      row.append(
        node("strong", `${p.data?.display_name || "참여자"} · ${m.role}`),
        node(
          "small",
          m.status === "accepted"
            ? "참여 확인됨"
            : m.status === "pending"
              ? "확인 대기"
              : "거절됨",
        ),
        node("p", m.description),
      );
      if (p.data) {
        const a = document.createElement("a");
        a.href = `/members/${p.data.handle}/`;
        a.textContent = "프로필 보기 →";
        row.append(a);
      }
      box.append(row);
    }
    const invite = get<HTMLFormElement>("invite");
    invite.hidden = item.owner_id !== userId;
    invite.onsubmit = (e) => {
      e.preventDefault();
      void run(async () => {
        const d = new FormData(invite);
        const r = await supabase!.rpc("invite_project_member", {
          p_project_id: id,
          p_email: d.get("email"),
          p_role: d.get("role"),
          p_description: d.get("description"),
        });
        if (r.error) throw r.error;
        invite.reset();
        status.textContent =
          "참여 확인 요청을 보냈습니다. 상대방의 내 작업 화면에 표시됩니다.";
      });
    };
  }
  const registry = await supabase
    .from("content_targets")
    .select("id")
    .eq("namespace", "SPACE")
    .eq("content_type", kind)
    .eq("external_id", id)
    .maybeSingle();
  if (registry.error) throw registry.error;
  target = registry.data?.id;
  if (target) {
    get("interactions").hidden = false;
    await comments();
  }
  get<HTMLButtonElement>("like").onclick = () =>
    void run(async () => {
      await ensureCommunityUser();
      const r = await supabase!.rpc("toggle_target_reaction", { p_id: target });
      if (r.error) throw r.error;
      await comments();notify("좋아요 상태를 변경했습니다.");
    });
  get<HTMLButtonElement>("report").onclick = () => void doReport();
  get<HTMLFormElement>("comment-form").onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement;
    void run(async () => {
      await ensureCommunityUser();
      const r = await supabase!.rpc("write_target_comment", {
        p_target: target,
        p_body: new FormData(f).get("body"),
      });
      if (r.error) throw r.error;
      f.reset();
      await comments();notify("댓글을 등록했습니다.");
    });
  };
}
void run(load);
