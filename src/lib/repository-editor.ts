import { parse, stringify } from "yaml";
import { supabase, messageOf } from "./supabase";
import { cmsConfig } from "./cms-config";
import { projectSchema, playSchema, unique } from "./content-schemas";
import { youtubeEmbed } from "./media";
import { z } from "astro/zod";
const root = document.querySelector<HTMLElement>("[data-repository-editor]");
if (root) {
  const status = root.querySelector<HTMLElement>("[data-repo-status]")!,
    workspace = root.querySelector<HTMLElement>("[data-repo-workspace]")!,
    form = root.querySelector<HTMLFormElement>("[data-repo-form]")!,
    fields = root.querySelector<HTMLElement>("[data-repo-fields]")!;
  const repo = "K-MIN-SEC/K-MIN-SEC.github.io";
  const prefix = `https://api.github.com/repos/${repo}`;
  let token = sessionStorage.getItem("minsec-cms-token") || "",
    tab = "projects",
    sha = "",
    path = "",
    items: Record<string, any>[] = [],
    current = -1,
    doc: Record<string, any> = {},
    dirty = false,
    busy = false;
  type Field = {
    name: string;
    label: string;
    widget: string;
    required?: boolean;
    default?: any;
    fields?: Field[];
    options?: Array<string | { label: string; value: string }>;
    pattern?: string[];
    hint?: string;
  };
  let readFields: () => Record<string, any> = () => ({});
  const el = (tag: string, text = "") => {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  };
  const encode = (text: string) => {
    let binary = "";
    for (const x of new TextEncoder().encode(text))
      binary += String.fromCharCode(x);
    return btoa(binary);
  };
  const decode = (text: string) =>
    new TextDecoder().decode(
      Uint8Array.from(atob(text.replace(/\s/g, "")), (x) => x.charCodeAt(0)),
    );
  async function api(resource: string, method = "GET", body?: unknown) {
    const response = await fetch(
      resource.startsWith("https://api.github.com/")
        ? resource
        : `${prefix}${resource}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!response.ok) {
      if (response.status === 409)
        throw new Error(
          "다른 곳에서 먼저 수정했습니다. 입력 내용을 따로 복사한 뒤 목록을 다시 열어 최신 내용을 불러와 주세요.",
        );
      if (response.status === 401 || response.status === 403)
        throw new Error(
          "GitHub 편집 권한이 없거나 만료됐습니다. 편집 권한으로 다시 로그인해 주세요.",
        );
      throw new Error(
        `GitHub 요청 실패 (${response.status}). 잠시 뒤 다시 시도해 주세요.`,
      );
    }
    return response.status === 204 ? null : response.json();
  }
  function definition(): Field[] {
    const collections = cmsConfig.collections as any[];
    if (tab === "projects" || tab === "play")
      return collections[0].files.find((f: any) => f.name === tab).fields[0]
        .fields;
    if (tab === "site") return collections[2].files[0].fields;
    return [
      {
        name: "slug",
        label: "글 주소 (영문·숫자·하이픈)",
        widget: "string",
        pattern: ["^[a-z0-9]+(-[a-z0-9]+)*$"],
      },
      ...collections[1].fields,
    ];
  }
  function defaultData(defs: Field[]): Record<string, any> {
    return Object.fromEntries(
      defs.map((f) => [
        f.name,
        f.default ??
          (f.widget === "list"
            ? []
            : f.widget === "boolean"
              ? false
              : f.widget === "select"
                ? typeof f.options?.[0] === "string"
                  ? f.options[0]
                  : ((f.options?.[0] as any)?.value ?? "")
                : f.widget === "datetime"
                  ? new Date().toISOString().slice(0, 10)
                  : ""),
      ]),
    );
  }
  function controls(
    container: HTMLElement,
    defs: Field[],
    data: Record<string, any>,
  ): () => Record<string, any> {
    const readers: Record<string, () => unknown> = {};
    for (const f of defs) {
      if (f.widget === "list" && f.fields) {
        const box = document.createElement("fieldset");
        box.append(el("legend", f.label));
        const list = el("div");
        let values: Record<string, any>[] = structuredClone(data[f.name] || []),
          getters: (() => Record<string, any>)[] = [];
        const snapshot = () => getters.map((g) => g());
        const render = () => {
          list.replaceChildren();
          getters = [];
          values.forEach((value, index) => {
            const row = el("div");
            row.className = "repo-nested-item";
            getters.push(controls(row, f.fields!, value));
            const actions = el("div");
            actions.className = "repo-array-actions";
            for (const [label, delta] of [
              ["위로", -1],
              ["아래로", 1],
              ["항목 삭제", 0],
            ] as const) {
              const b = el("button", label) as HTMLButtonElement;
              b.type = "button";
              b.className = "text-link";
              b.onclick = () => {
                values = snapshot();
                if (delta === 0) values.splice(index, 1);
                else if (index + delta >= 0 && index + delta < values.length)
                  [values[index], values[index + delta]] = [
                    values[index + delta],
                    values[index],
                  ];
                dirty = true;
                render();
              };
              actions.append(b);
            }
            row.append(actions);
            list.append(row);
          });
        };
        render();
        const add = el("button", `+ ${f.label} 추가`) as HTMLButtonElement;
        add.type = "button";
        add.className = "button secondary";
        add.onclick = () => {
          values = snapshot();
          values.push(defaultData(f.fields!));
          dirty = true;
          render();
        };
        box.append(list, add);
        container.append(box);
        readers[f.name] = snapshot;
        continue;
      }
      const label = document.createElement("label");
      label.append(el("span", f.label));
      let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (f.widget === "text" || f.widget === "markdown") {
        input = document.createElement("textarea");
        input.rows = f.widget === "markdown" ? 20 : 5;
      } else if (f.widget === "select") {
        input = document.createElement("select");
        for (const o of f.options || []) {
          const op = document.createElement("option");
          op.value = typeof o === "string" ? o : o.value;
          op.textContent = typeof o === "string" ? o : o.label;
          input.append(op);
        }
      } else {
        input = document.createElement("input");
        input.type =
          f.widget === "boolean"
            ? "checkbox"
            : f.widget === "datetime"
              ? "date"
              : "text";
        if (f.pattern) input.pattern = f.pattern[0];
      }
      input.required =
        f.required !== false && f.widget !== "boolean" && f.widget !== "list";
      input.value =
        f.widget === "list"
          ? (data[f.name] || []).join(", ")
          : String(data[f.name] ?? f.default ?? "");
      if (input instanceof HTMLInputElement && f.widget === "boolean")
        input.checked = Boolean(data[f.name] ?? f.default);
      input.oninput = () => (dirty = true);
      label.append(input);
      if (f.hint) label.append(el("small", f.hint));
      readers[f.name] = () =>
        f.widget === "boolean"
          ? (input as HTMLInputElement).checked
          : f.widget === "list"
            ? input.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
            : input.value;
      if (f.widget === "image" || f.widget === "file") {
        const file = document.createElement("input");
        file.type = "file";
        file.accept =
          f.widget === "image"
            ? ".png,.jpg,.jpeg,.webp,.gif"
            : ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.hwp,.hwpx,.docx,.xlsx,.ods,.mp4,.webm";
        label.append(file);
        file.onchange = async () => {
          const selected = file.files?.[0];
          if (!selected) return;
          file.disabled = true;
          try {
            if (selected.size > 10 * 1024 * 1024)
              throw new Error(
                "10MB 이하 파일을 선택해 주세요. 큰 영상은 YouTube 주소를 넣어주세요.",
              );
            const ext = selected.name.toLowerCase().split(".").pop()!;
            if (
              !(
                f.widget === "image"
                  ? ["png", "jpg", "jpeg", "webp", "gif"]
                  : [
                      "png",
                      "jpg",
                      "jpeg",
                      "webp",
                      "gif",
                      "pdf",
                      "txt",
                      "hwp",
                      "hwpx",
                      "docx",
                      "xlsx",
                      "ods",
                      "mp4",
                      "webm",
                    ]
              ).includes(ext)
            )
              throw new Error("허용되지 않은 파일입니다.");
            const dest = `public/uploads/${crypto.randomUUID()}.${ext}`;
            const b64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve(String(reader.result).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(selected);
            });
            await api(`/contents/${dest}`, "PUT", {
              message: `Upload ${selected.name}`,
              content: b64,
              branch: "main",
            });
            input.value = `/uploads/${dest.split("/").pop()}`;
            dirty = true;
            status.textContent =
              "파일을 업로드했습니다. 편집 내용을 저장하면 대표 이미지·영상에 연결됩니다.";
          } catch (e) {
            status.textContent = messageOf(e);
          } finally {
            file.disabled = false;
          }
        };
      }
      container.append(label);
    }
    return () =>
      Object.fromEntries(
        Object.entries(readers).map(([key, read]) => [key, read()]),
      );
  }
  function render(data: Record<string, any>) {
    doc = structuredClone(data);
    fields.replaceChildren();
    readFields = controls(fields, definition(), doc);
    root!.querySelector<HTMLElement>("[data-repo-heading]")!.textContent =
      data.title || "새 항목";
    form.hidden = false;
    dirty = false;
  }
  function list() {
    const box = root!.querySelector<HTMLElement>("[data-repo-list]")!;
    box.replaceChildren();
    items.forEach((item, index) => {
      const b = el(
        "button",
        item.title || item.name || `항목 ${index + 1}`,
      ) as HTMLButtonElement;
      b.type = "button";
      b.onclick = () =>
        void guard(async () => {
          if (!discard()) return;
          if (tab === "devlog") {
            await loadMarkdown(item.path);
          } else {
            current = index;
            render(item);
          }
        });
      box.append(b);
    });
  }
  function discard() {
    return !dirty || confirm("저장하지 않은 변경이 있습니다. 이동할까요?");
  }
  async function guard(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      status.textContent = messageOf(e);
    } finally {
      busy = false;
    }
  }
  async function loadMarkdown(file: string) {
    const r = await api(`/contents/${file}?ref=main`);
    sha = r.sha;
    path = file;
    const text = decode(r.content);
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) throw new Error("Markdown의 메타데이터 형식을 확인해 주세요.");
    const meta = parse(match[1]);
    render({
      ...meta,
      date: String(meta.date).slice(0, 10),
      slug: file.split("/").pop()!.replace(/\.md$/, ""),
      body: match[2],
    });
  }
  async function load(next: string) {
    if (!discard()) return;
    tab = next;
    current = -1;
    sha = "";
    path = "";
    form.hidden = true;
    root!.querySelectorAll<HTMLElement>("[data-repo-tab]").forEach((b) => {
      if (b.dataset.repoTab === tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    root!.querySelector<HTMLButtonElement>("[data-repo-new]")!.hidden =
      tab === "site";
    root!.querySelector<HTMLButtonElement>("[data-repo-delete]")!.hidden =
      tab === "site";
    if (tab === "devlog") {
      const rows = await api("/contents/src/content/devlog?ref=main");
      items = rows.filter(
        (r: any) => r.type === "file" && r.name.endsWith(".md"),
      );
      list();
      const requested = new URLSearchParams(location.search).get("post");
      if (requested && /^[a-z0-9-]+$/.test(requested)) {
        const item = items.find((x) => x.name === `${requested}.md`);
        if (item) await loadMarkdown(item.path);
      }
    } else {
      path = tab === "site" ? "src/data/site.json" : `src/data/${tab}.json`;
      const r = await api(`/contents/${path}?ref=main`);
      sha = r.sha;
      const data = JSON.parse(decode(r.content));
      if (tab === "site") {
        items = [];
        list();
        render(data);
      } else {
        items = data.items;
        list();
        if (items.length) {
          current = 0;
          render(items[0]);
        }
      }
    }
    status.textContent =
      "편집할 내용을 선택해 주세요. 저장 후 배포가 끝나면 공개 사이트에 반영됩니다.";
  }
  root
    .querySelectorAll<HTMLButtonElement>("[data-repo-tab]")
    .forEach(
      (b) => (b.onclick = () => void guard(() => load(b.dataset.repoTab!))),
    );
  root.querySelector<HTMLButtonElement>("[data-repo-new]")!.onclick = () => {
    if (busy || !discard()) return;
    current = -1;
    if (tab === "devlog") {
      path = "";
      sha = "";
    }
    render(defaultData(definition()));
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    void guard(async () => {
      const data = { ...doc, ...readFields() };
      let text = "";
      let destination = path;
      if (tab === "projects" || tab === "play") {
        const schema = tab === "projects" ? projectSchema : playSchema;
        const item = schema.parse(data);
        const next = structuredClone(items);
        if (current < 0) next.push(item);
        else next[current] = item;
        const valid = unique(z.array(schema).parse(next), tab);
        if (tab === "projects")
          for (const entry of valid as z.infer<typeof projectSchema>[])
            for (const video of entry.videos)
              if (video.type === "youtube") youtubeEmbed(video.src);
        text = JSON.stringify({ items: valid }, null, 2) + "\n";
      } else if (tab === "devlog") {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug))
          throw new Error("글 주소는 영문 소문자·숫자·하이픈을 사용해 주세요.");
        destination = `src/content/devlog/${data.slug}.md`;
        if (path && destination !== path)
          throw new Error(
            "기존 글의 주소는 유지해 주세요. 다른 주소로 쓰려면 새 글을 작성하세요.",
          );
        if (
          !data.title ||
          !data.description ||
          !data.category ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
          Number.isNaN(Date.parse(data.date))
        )
          throw new Error("제목·요약·분류·날짜를 확인해 주세요.");
        const { slug, body, ...meta } = data;
        text = `---\n${stringify(meta)}---\n\n${body || ""}\n`;
      } else {
        z.object({
          name: z.string().min(1),
          brand: z.string().min(1),
          email: z.email(),
          school: z.string(),
          major: z.string(),
          classYear: z.string(),
        }).parse(data);
        text = JSON.stringify(data, null, 2) + "\n";
      }
      await api(`/contents/${destination}`, "PUT", {
        message: `Update MINSEC ${tab}`,
        content: encode(text),
        branch: "main",
        ...(sha ? { sha } : {}),
      });
      dirty = false;
      await load(tab);
      status.textContent =
        "저장했습니다! GitHub에서 자동 배포 중입니다. 위 배포 상태에서 완료를 확인할 수 있습니다.";
    });
  };
  root.querySelector<HTMLButtonElement>("[data-repo-delete]")!.onclick = () =>
    void guard(async () => {
      if (
        !confirm("선택한 항목을 삭제하고 배포할까요? GitHub 기록에는 남습니다.")
      )
        return;
      if (tab === "devlog") {
        if (!path || !sha) throw new Error("삭제할 기존 글을 선택해 주세요.");
        await api(`/contents/${path}`, "DELETE", {
          message: "Delete MINSEC Devlog",
          sha,
          branch: "main",
        });
      } else {
        if (current < 0) throw new Error("삭제할 기존 항목을 선택해 주세요.");
        const next = items.filter((_, i) => i !== current);
        await api(`/contents/${path}`, "PUT", {
          message: `Delete MINSEC ${tab} item`,
          sha,
          branch: "main",
          content: encode(JSON.stringify({ items: next }, null, 2) + "\n"),
        });
      }
      dirty = false;
      await load(tab);
      status.textContent = "삭제 내용을 저장하고 배포를 시작했습니다.";
    });
  root.querySelector<HTMLButtonElement>("[data-repo-login]")!.onclick = () =>
    void guard(async () => {
      if (!supabase) throw new Error("계정 연결값이 없습니다.");
      sessionStorage.setItem("minsec-cms-return", String(Date.now()));
      const r = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "public_repo",
          redirectTo: new URL(
            import.meta.env.BASE_URL + "account/",
            location.origin,
          ).href,
        },
      });
      if (r.error) {
        sessionStorage.removeItem("minsec-cms-return");
        throw r.error;
      }
    });
  root.querySelector<HTMLButtonElement>("[data-repo-logout]")!.onclick = () => {
    sessionStorage.removeItem("minsec-cms-token");
    token = "";
    location.reload();
  };
  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });
  supabase?.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      sessionStorage.removeItem("minsec-cms-token");
      token = "";
      workspace.hidden = true;
    }
  });
  void guard(async () => {
    if (!token) {
      status.textContent =
        "GitHub 편집 권한으로 로그인하면 작성·수정할 수 있습니다.";
      return;
    }
    const repository = await api("");
    if (!repository.permissions?.push)
      throw new Error(
        "이 저장소의 GitHub 쓰기 권한이 필요합니다. 커뮤니티 운영 권한과는 별개입니다.",
      );
    workspace.hidden = false;
    root!.querySelector<HTMLButtonElement>("[data-repo-logout]")!.hidden =
      false;
    const requested = new URLSearchParams(location.search).get("collection");
    await load(
      requested && ["projects", "play", "devlog", "site"].includes(requested)
        ? requested
        : "projects",
    );
  });
}
