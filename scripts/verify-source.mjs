import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const checks = [];
const pass = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(name);
};
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    entry.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const i18n = read('frontend/src/lib/i18n.ts');
const prefs = read('frontend/src/providers/PreferencesProvider.tsx');
const app = read('frontend/src/App.tsx');
const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
const api = read('frontend/src/lib/api.ts');
const routes = read('backend/src/routes/index.ts');
const docsRouter = read('backend/src/modules/documents/router.ts');
const frontendFiles = walk(path.join(root, 'frontend/src'));
const backendFiles = walk(path.join(root, 'backend/src'));
const frontendSource = frontendFiles.filter(f => /\.(ts|tsx)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');

pass('English/Dari/Pashto language codes', /'en'\s*\|\s*'da'\s*\|\s*'ps'/.test(i18n));
pass('RTL support for Dari and Pashto', /dir:\s*'rtl'/.test(i18n) && /root\.dir\s*=/.test(prefs));
pass('Persistent theme support', /hms-theme/.test(prefs) && /classList\.toggle\('dark'/.test(prefs));
pass('Persistent language support', /hms-language/.test(prefs));
pass('Refresh-token retry flow', /refreshPromise/.test(api) && /auth\/refresh/.test(api) && /_retry/.test(api));
pass('Receptionist has dedicated route', /receptionist\/dashboard/.test(app));
const appPaths = new Set(Array.from(app.matchAll(/<Route\s+path="([^"]+)"/g), match => match[1]));
const navigationPaths = Array.from(sidebar.matchAll(/href:\s*'([^']+)'/g), match => match[1]);
pass('Every sidebar destination has an application route', navigationPaths.every(route => appPaths.has(route)));
pass('User Management has direct and legacy-compatible routes', appPaths.has('/admin/users') && appPaths.has('/admin/user-management'));
pass('Authenticated document PDF route', /\/:id\/pdf/.test(docsRouter));
pass('All core API modules are mounted', ['auth','users','audit-logs','appointments','billing','lab','pharmacy','inventory','documents','analytics','settings'].every(x => routes.includes(`'/${x}'`) || (x === 'auth' && routes.includes("'/auth'"))));
pass('No obsolete frontend JSX files', frontendFiles.every(f => !f.endsWith('.jsx')));
pass('No known dead dashboard API references', !/(\/billing\/revenue-mtd|\/pharmacy\/dispensing|['"]\/inventory['"])/.test(frontendSource));
pass('No legacy backend JS implementation', backendFiles.every(f => !f.endsWith('.js')));
pass('Bootstrap admin does not force a route-blocking password change', /forcePasswordChange:\s*false/.test(read('backend/src/scripts/create-admin.ts')));
pass('Existing admin recovery workflow is available', /recover-admin/.test(read('backend/package.json')) && fs.existsSync(path.join(root, 'backend/src/scripts/recover-admin.ts')));

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`\n${checks.length - failures.length}/${checks.length} source-contract checks passed.`);
if (failures.length) process.exit(1);
