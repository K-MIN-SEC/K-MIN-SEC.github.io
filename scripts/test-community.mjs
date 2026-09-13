import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
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
await db.query('insert into auth.users values ($1),($2),($3),($4)', [owner, other, admin, reader]);
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
  assert.equal((await db.query("select count(*)::int count from pg_trigger where tgname='delete_space_object_after_metadata'")).rows[0].count, 0);
  await asUser(null); assert.equal((await db.query('select id from space_posts where id=$1',[post])).rows.length,1);

  // Secret posts stay out of the public feed. A direct shared id reveals only a locked summary.
  await asUser(owner);
  const secret = (await db.query('select public.create_space_post($1,$2,$3,$4,$5) id', ['테스터','비밀 제목','비밀 본문',null,'separate-post-password'])).rows[0].id;
  const secretComment = (await db.query('insert into space_comments(user_id,post_id,display_name,body) values ($1,$2,$3,$4) returning id', [owner,secret,'테스터','비밀 답글'])).rows[0].id;
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
  await asUser(other);
  const report = '44444444-4444-4444-8444-444444444444';
  await db.query('insert into reports(id,user_id,target_type,target_id,reason) values ($1,$2,$3,$4,$5)', [report, other, 'space_post', post, 'spam']);
  await assert.rejects(db.query('select moderate_report($1,$2)', [report, 'hide']), /Admin access required/);
  await asUser(admin); await db.query('select moderate_report($1,$2)', [report, 'hide']);
  assert.equal((await db.query('select status from reports where id=$1', [report])).rows[0].status, 'resolved');
  await db.query('delete from space_posts where id=$1', [post]);
  assert.equal((await db.query('select id from space_comments where id=$1', [reply])).rows.length, 0);
  console.log('Passed: migrations 0001–0005, account permissions, moderation, secret post isolation/unlock/rotation, notices, private file RLS and Storage API cleanup.');
} finally { await db.close(); }
