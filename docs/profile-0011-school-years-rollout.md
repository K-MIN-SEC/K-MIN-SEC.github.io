# School-year profiles — migration 0011

## Conflict and migration impact

The database already stores admission, expected graduation and graduation years. Migration 0010 deliberately preserved them while affiliation types were introduced, but the new editor could not update them. Migration 0011 adds a new authenticated RPC and changes no table, RLS policy, existing role or stored row.

The editor enables the three optional year fields only for school profiles. Company, other and no-affiliation saves do not clear historical education data. Public profiles show actual graduation first, otherwise expected graduation. The People archive applies its year filter to actual graduation, or expected graduation when actual graduation is empty.

## Access and validation

`upsert_member_profile_v3` delegates profile and affiliation validation to v2, then updates the authenticated user's education fields only for a school affiliation. Years must be between 2000 and 2100. Expected or actual graduation cannot precede admission. Anonymous execution is revoked. The RPC cannot select another user ID.

## Rollout and rollback

Migration 0011 was applied successfully before the editor deployment on 2026-09-14. Roll back the application if required and keep the additive RPC. Existing v2 remains available to the preceding application version, and no profile data needs to be reversed.

The PGlite suite passed migrations 0001–0011, school-year persistence, invalid sequence rejection, non-school preservation, member ownership and anonymous rejection. The Astro production build also passed. Production browser QA confirmed the stored 2024 admission and 2027 expected-graduation values, school-only visibility, company-mode hiding, a successful v3 save, the 2027 cohort filter and a combined Unity/available filter.
