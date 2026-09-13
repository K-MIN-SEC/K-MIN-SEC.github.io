# Profile affiliations — migration 0010

## Purpose and compatibility

Profiles support no affiliation, school, company and other organizations. The editor changes labels and fields for the selected type. Public and member profile rendering use the same affiliation summary. Admission and graduation dates are no longer editor inputs or public profile content.

`0010_profile_affiliations.sql` adds `affiliation_type`, `affiliation_name` and `affiliation_unit`. Existing school/departments are backfilled once; rerunning does not overwrite a later explicit choice of no affiliation. Historical education fields remain intact.

The new `upsert_member_profile_v2` RPC validates the type and name, updates only the authenticated member's profile and delegates core validation/rate limiting to the existing RPC. Switching to school synchronizes the legacy school/departments; other types preserve historical education values. Existing RLS and staff/CMS rights do not change. No destructive migration is involved.

## Rollout and rollback

Apply 0010 before deploying the new editor. Production SQL execution returned success on 2026-09-13, followed by the Creator Space deployment. The signed-in editor saved the existing school profile successfully and showed save confirmation.

Rollback the application deployment if required, retaining the additive columns and RPC to avoid losing new affiliation data. An old client displays/edits legacy school fields, so it is not a company-affiliation editor; forward-fix is preferred after users begin editing new affiliations. Do not drop columns to roll back the UI.

## Verification

The migrations 0001–0010 PGlite suite passed: school backfill, company persistence, legacy year preservation, invalid/empty/overlong values, no-affiliation clearing, idempotent backfill, anonymous rejection, other-member update rejection and private-profile access restrictions. Existing content/attachment/moderation tests also passed.

Production UI verified company, other and no-affiliation field switching, preservation of the unsaved school draft when switching back, unchanged school-profile save confirmation, and reload persistence. The real account was not saved with fabricated company information. Handle and display-name inputs both measure 50px high and share the same top position.
