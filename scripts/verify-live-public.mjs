import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
  const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
}));
assert.ok(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY, 'Supabase public environment values are required');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

for (const table of ['project_likes', 'project_comments', 'space_posts', 'space_likes', 'space_comments']) {
  const result = await db.from(table).select('*', { count: 'exact', head: true });
  assert.equal(result.error, null, `${table}: public read should be available`);
}
const admins = await db.from('admins').select('user_id', { head: true });
assert.ok(admins.error, 'anonymous visitors must not read admin membership');

const fake = '00000000-0000-4000-8000-000000000001';
const write = await db.from('space_posts').insert({ user_id: fake, display_name: 'QA', title: 'should not exist', body: 'anonymous write must fail' });
assert.ok(write.error, 'anonymous visitors must not create posts');
const report = await db.from('reports').insert({ user_id: fake, target_type: 'space_post', target_id: fake, reason: 'other' });
assert.ok(report.error, 'anonymous visitors must not create reports');
console.log('Passed: live public reads, hidden admin membership, and rejected anonymous writes/reports.');
