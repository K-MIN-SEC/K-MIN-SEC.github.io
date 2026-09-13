import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key,email text unique);
create schema extensions; create extension pgcrypto with schema extensions;
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,owner_id uuid);
alter table storage.objects enable row level security;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth,storage to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated; grant select,insert,delete on storage.objects to anon,authenticated;`);
for (const name of ['0001_community', '0002_accounts_and_editing', '0003_explicit_api_grants']) {
  // PGlite already provides gen_random_uuid; Supabase's pgcrypto extension is not needed here.
  await db.exec(readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replace('create extension if not exists pgcrypto;', ''));
}
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const reader = '55555555-5555-4555-8555-555555555555';
await db.query('insert into auth.users(id,email) values ($1,$5),($2,$6),($3,$7),($4,$8)', [owner, other, admin, reader, 'owner@example.com', 'other@example.com', 'admin@example.com', 'reader@example.com']);
await db.query('insert into public.admins(user_id) values ($1)', [admin]);
async function asUser(id, anonymous = false) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id ?? '', JSON.stringify({ is_anonymous: anonymous })]);
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
}
const edit = (id, type, body) => db.query('select public.edit_community_content($1,$2,$3,$4,$5,$6)', [type, id, '테스터', body, '수정 제목', 'https://example.com/']);
try {
  await asUser(owner);
  const post = (await db.query('insert into space_posts(user_id,display_name,title,body) values ($1,$2,$3,$4) returning id', [owner, '테스터', '테스트 제목', '테스트 본문'])).rows[0].id;
  const comment = (await db.query('insert into project_comments(user_id,project_id,display_name,body) values ($1,$2,$3,$4) returning id', [owner, 'one-stroke', '테스터', '프로젝트 댓글'])).rows[0].id;
  const reply = (await db.query('insert into space_comments(user_id,post_id,display_name,body) values ($1,$2,$3,$4) returning id', [owner, post, '테스터', 'Space 답글'])).rows[0].id;
  for (const [id, type] of [[post, 'space_post'], [comment, 'project_comment'], [reply, 'space_comment']]) {
    await edit(id, type, '작성자 수정');
    await asUser(other); await assert.rejects(edit(id, type, '다른 사람이 수정'), /Edit access denied/); await asUser(owner);
  }
  await asUser(other);
  const deleted = await db.query('delete from space_posts where id=$1 returning id', [post]); assert.equal(deleted.rows.length, 0);
  await assert.rejects(db.query('select set_community_visibility($1,$2,$3)', ['space_post', post, 'hidden']), /Admin access required/);
  await assert.rejects(db.query('insert into admins(user_id) values ($1)', [other]), /permission denied/);
  await asUser(owner, true);
  await assert.rejects(edit(post, 'space_post', '익명 수정'), /Login required/);
  await assert.rejects(db.query('insert into project_likes(project_id,user_id) values ($1,$2)', ['erase', owner]), /row-level security/);
  await asUser(null);
  assert.equal((await db.query('select id from space_posts')).rows.length, 1);
  await assert.rejects(edit(post, 'space_post', '비회원 수정'), /permission denied/);
  await asUser(admin);
  await edit(post, 'space_post', '관리자 수정');
  await db.query('select set_community_visibility($1,$2,$3)', ['space_post', post, 'hidden']);
  await asUser(null); assert.equal((await db.query('select id from space_posts')).rows.length, 0);
  await asUser(owner); await assert.rejects(edit(post, 'space_post', '숨김 우회'), /Edit access denied/);
  await asUser(admin); await db.query('select set_community_visibility($1,$2,$3)', ['space_post', post, 'visible']);

  // Apply the additive migration after a legacy public post exists.
  await db.exec('reset role');
  await db.exec(readFileSync('supabase/migrations/0004_private_posts_files_notices.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0005_storage_api_cleanup.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0006_security_roles_limits_files.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0007_lock_direct_community_writes.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0008_creator_foundation.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0009_creator_authoring_registry.sql', 'utf8'));
  assert.equal((await db.query("select count(*)::int count from pg_trigger where tgname='delete_space_object_after_metadata'")).rows[0].count, 0);
  await asUser(admin);
  assert.equal((await db.query('select public.is_owner() owner')).rows[0].owner, true);
  await db.query('select public.grant_community_admin($1,$2)', ['other@example.com', 'moderator']);
  await asUser(other);
  assert.equal((await db.query('select public.is_admin() admin')).rows[0].admin, true);
  assert.equal((await db.query('select public.is_owner() owner')).rows[0].owner, false);
  await assert.rejects(db.query('select public.grant_community_admin($1,$2)', ['reader@example.com', 'moderator']), /Owner access required/);
  await asUser(admin); await db.query('select public.revoke_community_admin($1)', [other]);
  await asUser(owner);
  await assert.rejects(db.query('insert into project_comments(user_id,project_id,display_name,body) values ($1,$2,$3,$4)', [owner,'erase','테스터','직접 쓰기 우회']), /permission denied/);
  await asUser(null); assert.equal((await db.query('select id from space_posts where id=$1',[post])).rows.length,1);

  // Creator status is independent from community staff, and project history needs member confirmation.
  await asUser(owner);
  assert.equal((await db.query('select public.is_creator() creator')).rows[0].creator, false);
  await db.query('select public.upsert_member_profile($1,$2)', ['minsec-test','MINSEC Test']);
  await db.query('select public.upsert_profile_contact($1,$2,$3)', ['email','creator@example.com','public']);
  await db.query('select public.upsert_profile_contact($1,$2,$3)', ['discord','private-handle','private']);
  await db.query('select public.request_creator_access($1)', ['프로젝트 이력을 등록하고 싶습니다.']);
  await asUser(admin);
  assert.equal((await db.query("select count(*)::int count from public.list_creator_approvals() where status='requested'")).rows[0].count, 1);
  await db.query('select public.set_creator_status($1,$2,$3)', ['owner@example.com','approved','테스트 승인']);
  await asUser(owner);
  assert.equal((await db.query('select public.is_creator() creator')).rows[0].creator, true);
  const creatorProject = (await db.query(
    'select public.create_creator_project($1,$2,$3,$4,$5,$6,$7,$8,$9) id',
    ['Project Archive Test','확인된 참여 이력만 공개하는 프로젝트입니다.','Game','Game Design',null,null,'active','public',null]
  )).rows[0].id;
  const invitation = (await db.query('select public.invite_project_member($1,$2,$3,$4) id', [creatorProject,'other@example.com','Client','게임플레이 구현'])).rows[0].id;
  await asUser(null);
  assert.equal((await db.query('select count(*)::int count from project_memberships where project_id=$1',[creatorProject])).rows[0].count,1);
  assert.equal((await db.query('select count(*)::int count from profile_contacts where user_id=$1',[owner])).rows[0].count,0);
  await asUser(other);
  await db.query('select public.upsert_member_profile($1,$2)', ['other-test','Other Test']);
  assert.equal((await db.query('select count(*)::int count from profile_contacts where user_id=$1',[owner])).rows[0].count,1);
  assert.equal((await db.query('select status from project_memberships where id=$1',[invitation])).rows[0].status,'pending');
  await db.query('select public.respond_project_membership($1,$2)', [invitation,'accepted']);
  await asUser(null);
  assert.equal((await db.query('select count(*)::int count from project_memberships where project_id=$1',[creatorProject])).rows[0].count,2);
  await asUser(admin); await db.query('select public.grant_community_admin($1,$2)', ['other@example.com','moderator']);
  await asUser(other);
  assert.equal((await db.query('select public.is_admin() admin, public.is_creator() creator')).rows[0].creator,false);
  await assert.rejects(db.query('select public.create_creator_project($1,$2,$3)', ['Unauthorized','운영자라도 Creator 승인이 없으면 만들 수 없습니다.','Game']), /Creator approval required/);
  await assert.rejects(db.query('select public.set_creator_status($1,$2,$3)', ['reader@example.com','approved','']), /Owner access required/);

  // Secret posts stay out of the public feed. A direct shared id reveals only a locked summary.
  await asUser(owner);
  const secret = (await db.query('select public.create_space_post($1,$2,$3,$4,$5) id', ['테스터','비밀 제목','비밀 본문',null,'separate-post-password'])).rows[0].id;
  const secretComment = (await db.query('select public.create_space_comment($1,$2,$3) id', [secret,'테스터','비밀 답글'])).rows[0].id;
  await assert.rejects(db.query('select public.reserve_space_attachment($1,$2)',[secret,'unsafe.zip']), /문서만 첨부/);
  const objectPath = (await db.query('select public.reserve_space_attachment($1,$2) path',[secret,'secret.pdf'])).rows[0].path;
  await db.query('insert into storage.objects(bucket_id,name,owner_id) values ($1,$2,$3)',['space-files',objectPath,owner]);
  await asUser(null);
  assert.equal((await db.query('select id from public.list_space_posts(0,null) where id=$1',[secret])).rows.length,0);
  const locked = (await db.query('select title from public.list_space_posts(0,$1)',[secret])).rows[0]; assert.equal(locked.title,'비밀글');
  assert.equal((await db.query('select id from space_posts where id=$1',[secret])).rows.length,0);
  assert.equal((await db.query('select id from space_comments where id=$1',[secretComment])).rows.length,0);
  assert.equal((await db.query('select object_path from space_attachments where post_id=$1',[secret])).rows.length,0);
  assert.equal((await db.query('select name from storage.objects where name=$1',[objectPath])).rows.length,0);
  await asUser(reader);
  assert.equal((await db.query('select public.unlock_space_post($1,$2) ok',[secret,'wrong-password'])).rows[0].ok,false);
  assert.equal((await db.query('select public.unlock_space_post($1,$2) ok',[secret,'separate-post-password'])).rows[0].ok,true);
  assert.equal((await db.query('select body from space_posts where id=$1',[secret])).rows[0].body,'비밀 본문');
  assert.equal((await db.query('select body from space_comments where id=$1',[secretComment])).rows[0].body,'비밀 답글');
  assert.equal((await db.query('select name from storage.objects where name=$1',[objectPath])).rows[0].name,objectPath);
  await assert.rejects(db.query('select password_hash from private.space_passwords'), /permission denied/);
  await asUser(owner); await db.query('select public.set_space_password($1,$2)',[secret,'rotated-post-password']);
  await asUser(reader); assert.equal((await db.query('select id from space_posts where id=$1',[secret])).rows.length,0);
  await asUser(admin); assert.equal((await db.query('select body from space_posts where id=$1',[secret])).rows[0].body,'비밀 본문');
  await assert.rejects(db.query('select public.set_space_notice($1,true)',[secret]), /비밀글은 공지/);
  await db.query('select public.set_space_password($1,null)',[secret]); await db.query('select public.set_space_notice($1,true)',[secret]);
  assert.equal((await db.query('select is_notice from space_posts where id=$1',[secret])).rows[0].is_notice,true);
  // The browser removes the object through the Storage API, then removes metadata before deleting the post.
  await db.query('delete from storage.objects where name=$1',[objectPath]);
  await db.query('select public.remove_space_attachment($1)',[objectPath]);
  await db.query('delete from space_posts where id=$1',[secret]);
  assert.equal((await db.query('select name from storage.objects where name=$1',[objectPath])).rows.length,0);
  await asUser(reader);
  const report = (await db.query('select public.create_community_report($1,$2,$3) id', ['space_post', post, 'spam'])).rows[0].id;
  await assert.rejects(db.query('select moderate_report($1,$2)', [report, 'hide']), /Admin access required/);
  await asUser(admin); await db.query('select moderate_report($1,$2)', [report, 'hide']);
  assert.equal((await db.query('select status from reports where id=$1', [report])).rows[0].status, 'resolved');
  await db.query('delete from space_posts where id=$1', [post]);
  assert.equal((await db.query('select id from space_comments where id=$1', [reply])).rows.length, 0);
  await asUser(owner);
  const workData={kind:'work',title:'Registry Work',summary:'원문 권한과 수정 권한을 함께 검사하는 테스트입니다.',body:'작성자 본문',visibility:'public',category:'Game'};
  const work=(await db.query('select public.save_creator_entry($1) id',[workData])).rows[0].id;
  const workTarget=(await db.query("select id from content_targets where content_type='work' and external_id=$1",[work])).rows[0].id;
  await asUser(reader);
  await assert.rejects(db.query('select public.save_creator_entry($1,$2)',[workData,work]),/Author access required/);
  await assert.rejects(db.query('insert into creator_entries(owner_id,kind,title,summary) values($1,$2,$3,$4)',[reader,'work','우회 시도','권한을 우회하는 직접 쓰기입니다.']),/permission denied/);
  const rc=(await db.query('select public.write_target_comment($1,$2) id',[workTarget,'권한 있는 댓글입니다.'])).rows[0].id;
  await db.query('select public.toggle_target_reaction($1)',[workTarget]);
  await assert.rejects(db.query('select public.write_target_comment($1,$2)',[crypto.randomUUID(),'존재하지 않는 원문']),/Content access denied/);
  await asUser(owner);
  await assert.rejects(db.query('select public.write_target_comment($1,$2,$3)',[workTarget,'다른 사람 댓글 수정',rc]),/Comment edit access denied/);
  await db.query('select public.save_creator_entry($1,$2)',[{...workData,visibility:'draft'},work]);
  await asUser(reader);
  assert.equal((await db.query('select id from target_comments where id=$1',[rc])).rows.length,0);
  assert.equal((await db.query('select public.target_like_count($1) count',[workTarget])).rows[0].count,0);
  await assert.rejects(db.query('select public.toggle_target_reaction($1)',[workTarget]),/Content access denied/);
  await asUser(owner);await db.query('select public.save_creator_entry($1,$2)',[workData,work]);
  await asUser(reader);
  const rr=(await db.query('select public.report_content_target($1,$2,$3) id',[workTarget,'부적절한 댓글 신고',rc])).rows[0].id;
  await asUser(admin);await db.query('select public.resolve_target_report($1,$2)',[rr,'hide']);
  await asUser(reader);assert.equal((await db.query('select id from target_comments where id=$1',[rc])).rows.length,0);
  await asUser(owner);await db.query('select public.delete_creator_content($1,$2)',[work,'work']);
  await asUser(null);assert.equal((await db.query('select id from content_targets where id=$1',[workTarget])).rows.length,0);
  await asUser(admin);await db.exec('reset role');
  assert.equal((await db.query('select status from content_targets where id=$1',[workTarget])).rows[0].status,'deleted');
  console.log('Passed: migrations 0001–0009, Creator authoring ownership, registry existence/access, confirmed history, profile privacy, secret posts, private files and moderation.');
} finally { await db.close(); }
