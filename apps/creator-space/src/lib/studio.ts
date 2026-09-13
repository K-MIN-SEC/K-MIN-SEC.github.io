import {flash} from './feedback';
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
const templates:Record<string,{heading:string;guide:string;checklist:string;labels:Record<string,string>;placeholders:Record<string,string>;categories:string[]}>={
 work:{heading:'작품 기록',guide:'완성한 결과물과 제작 과정을 보여주는 개인 포트폴리오입니다.',checklist:'무엇을 만들었는지 → 어떤 부분을 맡았는지 → 제작 과정과 결과 → 시연·결과물 링크',labels:{cover_url:'대표 이미지 주소 (선택)',title:'작품명',summary:'작품 한 줄 소개',category:'작품 분야',body:'작품 소개와 제작 과정',external_url:'작품·시연·자료 링크',video_url:'플레이·시연 영상 주소',project_id:'관련 프로젝트 (선택)'},placeholders:{title:'예: 드로잉 액션 게임 One Stroke',summary:'어떤 작품인지, 핵심 특징은 무엇인지 소개해 주세요.',body:'작품 소개\n\n내가 맡은 역할\n\n제작 과정과 배운 점\n\n결과물과 다음 계획',category:'예: 게임 기획, 3D 아트, 생성형 AI'},categories:['게임 기획','게임 개발','2D 아트','3D 아트','생성형 AI','UI/UX','사운드']},
 project:{heading:'프로젝트 기록',guide:'함께한 목표, 진행 기간과 역할을 기록합니다. 참여자 초대는 프로젝트를 저장한 뒤 할 수 있습니다.',checklist:'프로젝트 목표 → 기간과 진행 상태 → 내 역할 → 참여자 초대·확인 → 결과물',labels:{title:'프로젝트명',summary:'프로젝트 목표와 개요',category:'프로젝트 분야',role_summary:'내가 맡은 역할',started_on:'프로젝트 시작일',ended_on:'프로젝트 종료일 (선택)',result_url:'결과물 링크 (선택)',team_up_id:'연결할 모집 글 (선택)'},placeholders:{title:'예: 2026 여름 게임잼 팀 프로젝트',summary:'팀이 만들려는 결과와 프로젝트의 목표를 소개해 주세요.',category:'예: 게임 개발, 생성형 AI',role_summary:'예: 게임 기획 · 전투 시스템 설계'},categories:['게임 개발','게임잼','졸업작품','생성형 AI','아트','연구·실험']},
 teamup:{heading:'팀원 모집',guide:'어떤 작업을 함께할지, 어떤 동료를 찾는지 구체적으로 알려주세요.',checklist:'프로젝트 소개 → 모집 직군·인원 → 참여 조건·활동 방식 → 예상 기간 → 지원 방법',labels:{title:'모집 제목',summary:'모집 한 줄 소개',category:'모집 직군',body:'모집 내용과 참여 조건',starts_on:'모집 시작일 (선택)',ends_on:'모집 마감일 (선택)',external_url:'지원·연락 링크 (선택)',project_id:'모집 중인 프로젝트 (선택)',cover_url:'모집 대표 이미지 주소 (선택)'},placeholders:{title:'예: 게임잼에 함께할 2D 아티스트를 찾습니다',summary:'만들고 있는 작업과 찾는 팀원을 간단히 소개해 주세요.',category:'예: 게임 기획, 클라이언트 개발, 2D 아트',body:'함께할 프로젝트\n\n모집 직군과 인원\n\n활동 기간·방식 (온라인/오프라인)\n\n참여 조건·보상 여부\n\n지원 방법'},categories:['게임 기획','클라이언트 개발','서버 개발','2D 아트','3D 아트','UI/UX','사운드','AI 개발']},
 event:{heading:'행사 안내',guide:'일정과 참가 방법을 한눈에 확인할 수 있는 행사 안내입니다.',checklist:'행사 소개 → 일정·장소 → 참가 대상·비용 → 프로그램 → 신청 방법',labels:{title:'행사명',summary:'행사 한 줄 소개',category:'행사 유형',body:'프로그램·장소·참가 안내',starts_on:'행사 시작일',ends_on:'행사 종료일 (선택)',external_url:'참가 신청·안내 링크 (선택)',cover_url:'행사 포스터 주소 (선택)'},placeholders:{title:'예: 학과 게임잼 2026',summary:'어떤 행사인지, 누구나 참가할 수 있는지 알려주세요.',category:'예: 게임잼, 전시, 세미나',body:'행사 소개\n\n시간과 장소 (또는 온라인 주소)\n\n참가 대상·비용\n\n프로그램\n\n신청 방법·문의'},categories:['게임잼','전시','세미나','발표회','공모전','스터디','모임']}
};
function toggle() {
  const kind=select.value,t=templates[kind];
  document.querySelector<HTMLElement>('[data-kind-guide]')!.textContent=t.guide;
  document.querySelector<HTMLElement>('[data-kind-heading]')!.textContent=t.heading+' 작성 가이드';
  document.querySelector<HTMLElement>('[data-kind-checklist]')!.textContent=t.checklist;
  const group=(selector:string,visible:boolean)=>{const box=document.querySelector<HTMLElement>(selector)!;box.hidden=!visible;box.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('input,select,textarea,button').forEach(e=>e.disabled=!visible);};
  group('[data-entry-fields]',kind!=='project');group('[data-project-fields]',kind==='project');
  for(const name of ['starts_on','ends_on','video_url','project_id']){const input=form.elements.namedItem(name) as HTMLInputElement;const visible=kind!=='project'&&(name==='video_url'?kind==='work':name==='project_id'?kind!=='event':kind!=='work');input.closest('label')!.hidden=!visible;input.disabled=!visible;}
  for(const [name,label] of Object.entries(t.labels)){const el=form.querySelector<HTMLElement>('[data-field-label="'+name+'"]');if(el)el.textContent=label;}
  for(const [name,text] of Object.entries(t.placeholders))(form.elements.namedItem(name) as HTMLInputElement).placeholder=text;
  const categories=document.getElementById('category-options')!;categories.replaceChildren(...t.categories.map(value=>{const o=document.createElement('option');o.value=value;return o;}));
  const publishing=(form.elements.namedItem('visibility') as HTMLSelectElement).value!=='draft';
  (form.elements.namedItem('starts_on') as HTMLInputElement).required=publishing&&kind==='event';
  (form.elements.namedItem('role_summary') as HTMLInputElement).required=publishing&&kind==='project';
  const body=form.elements.namedItem('body') as HTMLTextAreaElement;body.required=publishing&&(kind==='teamup'||kind==='event');body.minLength=body.required?10:0;
  const tagLabel=form.querySelector<HTMLElement>('#tags-label');
  const tagName=kind==='event'?'행사 태그':kind==='teamup'?'모집 태그':'작품 태그';
  if(tagLabel)tagLabel.textContent=tagName;
  const picker=tagLabel?.closest<HTMLElement>('[data-tag-picker]');
  if(picker){picker.querySelector('[data-selected]')?.setAttribute('aria-label','선택한 '+tagName);picker.querySelector('[data-tag-input]')?.setAttribute('aria-label',tagName+' 직접 추가');const suggestions=kind==='event'?['게임잼','전시','세미나','발표회','공모전','스터디','온라인','오프라인']:kind==='teamup'?['게임 기획','게임 개발','2D 아트','3D 아트','사운드','AI 개발','게임잼','장기 프로젝트']:['게임 기획','게임 개발','액션','퍼즐','생성형 AI','2D','3D','게임잼','Unity'];picker.dataset.suggestions=JSON.stringify(suggestions);picker.dispatchEvent(new Event('tag-suggestions'));}
  form.querySelector<HTMLElement>('[data-media-summary]')!.textContent=kind==='event'?'행사 포스터':kind==='teamup'?'모집 대표 이미지':'대표 이미지·시연 영상';

}
(form.elements.namedItem('visibility') as HTMLSelectElement).addEventListener('change',toggle);
let originalData:Record<string,unknown>={};
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
    {el.value = Array.isArray(value) ? value.join(", ") : String(value ?? "");el.dispatchEvent(new Event("change"));}
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
        flash("작업을 삭제했습니다.");location.assign("/studio/");
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
    originalData=item;for (const [key, value] of Object.entries(item)) set(key, value);toggle();
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
let dirty=false;form.addEventListener('input',()=>dirty=true);window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
form.onsubmit = async (event) => {
  event.preventDefault();
  const button = document.querySelector<HTMLButtonElement>("[data-save]")!;
  button.disabled = true;
  try {
    await ensureCommunityUser();
    const raw = Object.fromEntries(new FormData(form));
    const kind = editing ? editedKind : String(raw.kind);
    const data: Record<string, unknown> = {
      ...(editing?originalData:{}),
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
    const start=String(data[kind==='project'?'started_on':'starts_on']||'');
    const end=String(data[kind==='project'?'ended_on':'ends_on']||'');
    if(start&&end&&end<start)throw new Error('종료일·마감일은 시작일 이후로 선택해 주세요.');
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
    dirty=false;flash(data.visibility==='draft'?'비공개 초안을 저장했습니다.':'작업을 저장했습니다.');location.assign(`/${paths[kind]}/${id}/`);
  } catch (e) {
    status.textContent = messageOf(e);
  } finally {
    button.disabled = false;
  }
};
load().catch((e) => {
  status.textContent = messageOf(e);
});
