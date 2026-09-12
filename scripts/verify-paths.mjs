import { spawnSync } from 'node:child_process';
function run(script, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [script, ...args], { env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Validation failed: ${script} (exit ${result.status})`);
}
try {
  run('node_modules/astro/bin/astro.mjs', ['build'], { ...process.env, SITE_URL: 'https://minsec-test.invalid', BASE_PATH: '/minsec-site/' });
  run('scripts/verify-build.mjs');
} finally {
  // Always leave dist built for the user's own configuration, not the test domain.
  run('node_modules/astro/bin/astro.mjs', ['build']);
  run('scripts/verify-build.mjs');
}
