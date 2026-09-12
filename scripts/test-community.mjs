import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;`);
for (const name of ['0001_community', '0002_accounts_and_editing', '0003_explicit_api_grants']) {
  // PGlite already provides gen_random_uuid; Supabase's pgcrypto extension is not needed here.
  await db.exec(readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replace('create extension if not exists pgcrypto;', ''));
}
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
await db.query('insert into auth.users values ($1),($2),($3)', [owner, other, admin]);
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
  await asUser(other);
  const report = '44444444-4444-4444-8444-444444444444';
  await db.query('insert into reports(id,user_id,target_type,target_id,reason) values ($1,$2,$3,$4,$5)', [report, other, 'space_post', post, 'spam']);
  await assert.rejects(db.query('select moderate_report($1,$2)', [report, 'hide']), /Admin access required/);
  await asUser(admin); await db.query('select moderate_report($1,$2)', [report, 'hide']);
  assert.equal((await db.query('select status from reports where id=$1', [report])).rows[0].status, 'resolved');
  await db.query('delete from space_posts where id=$1', [post]);
  assert.equal((await db.query('select id from space_comments where id=$1', [reply])).rows.length, 0);
  console.log('Passed: SQL migrations, owner editing, other-user rejection, anonymous rejection, admin editing, visibility, reports and cascading deletion.');
} finally { await db.close(); }
