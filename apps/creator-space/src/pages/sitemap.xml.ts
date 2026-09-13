import type { APIRoute } from "astro";
import { publicDB } from "../lib/server";
const escape = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Math.max(
        0,
        Math.min(1000, Number(url.searchParams.get("page")) || 0),
      ),
      size = 500,
      db = publicDB(),
      origin = import.meta.env.PUBLIC_SITE_URL || url.origin;
    const sources = [
      {
        table: "creator_entries",
        select: "id,kind,updated_at",
        name: "entries",
      },
      { table: "creator_projects", select: "id,updated_at", name: "projects" },
      {
        table: "member_profiles",
        select: "handle,updated_at",
        name: "profiles",
      },
    ];
    const requested = url.searchParams.get("type");
    if (!requested) {
      const maps: string[] = [];
      for (const source of sources) {
        let q = db
          .from(source.table)
          .select("*", { count: "exact", head: true })
          .eq("visibility", "public");
        if (source.name !== "profiles") q = q.is("deleted_at", null);
        if (source.name === "entries") q = q.eq("moderation_status", "visible");
        const r = await q;
        if (r.error) throw r.error;
        for (let n = 0; n < Math.max(1, Math.ceil((r.count || 0) / size)); n++)
          maps.push(`${origin}/sitemap.xml?type=${source.name}&page=${n}`);
      }
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((x) => `<sitemap><loc>${escape(x)}</loc></sitemap>`).join("")}</sitemapindex>`,
        { headers: { "Content-Type": "application/xml" } },
      );
    }
    const source = sources.find((s) => s.name === requested);
    if (!source) return new Response("Not found", { status: 404 });
    let q = db
      .from(source.table)
      .select(source.select)
      .eq("visibility", "public");
    if (requested !== "profiles") q = q.is("deleted_at", null);
    if (requested === "entries") q = q.eq("moderation_status", "visible");
    const r = await q
      .order("updated_at")
      .range(page * size, (page + 1) * size - 1);
    if (r.error) throw r.error;
    const paths: Record<string, string> = {
      work: "works",
      teamup: "team-up",
      event: "events",
    };
    const urls = (r.data as unknown as Record<string, string>[]).map((x) => ({
      path:
        requested === "profiles"
          ? `members/${x.handle}/`
          : requested === "projects"
            ? `projects/${x.id}/`
            : `${paths[x.kind]}/${x.id}/`,
      updated: x.updated_at,
    }));
    if (page === 0 && requested === "profiles")
      for (const path of [
        "",
        "works/",
        "projects/",
        "members/",
        "team-up/",
        "events/",
      ])
        urls.push({ path, updated: "" });
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((x) => `<url><loc>${escape(`${origin}/${x.path}`)}</loc>${x.updated ? `<lastmod>${escape(x.updated)}</lastmod>` : ""}</url>`).join("")}</urlset>`,
      { headers: { "Content-Type": "application/xml" } },
    );
  } catch {
    return new Response("Sitemap temporarily unavailable", { status: 503 });
  }
};
