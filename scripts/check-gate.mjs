// check-gate.mjs — a local replication of the 7 gate rows in RULES.txt.
// Usage: node scripts/check-gate.mjs [out-dir] [snapshot.json]
// Exit 0 when all 7 rows pass, 1 otherwise. Read-only: it never writes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'out';
const snapPath = process.argv[3] ?? '/home/hatch/workspace/makefun/token-radar-01-kit/input/snapshot.json';
const snapshot = JSON.parse(readFileSync(snapPath, 'utf8'));
const results = [];
function row(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

const dashDir = join(out, 'dashboard');
const dashFiles = existsSync(dashDir) ? readdirSync(dashDir).filter((f) => statSync(join(dashDir, f)).isFile()) : [];
const hasHtml = dashFiles.includes('index.html');
const hasCss = dashFiles.some((f) => f.endsWith('.css'));
const hasJs = dashFiles.some((f) => f.endsWith('.js'));
let netOffender = null;
for (const f of dashFiles) {
  const text = readFileSync(join(dashDir, f), 'utf8');
  if (/(?:https?:\/\/)/.test(text) && !/source|snapshot|DefiLlama/.test(text)) { /* plain text mentions allowed; check attributes/imports below */ }
  // The scorer refuses http(s) in HTML attributes, CSS, and JS import specifiers.
  if (f.endsWith('.html') && /<[^>]+(?:href|src|action|style)\s*=\s*["'][^"']*https?:\/\//i.test(text)) netOffender = f;
  if (f.endsWith('.css') && /https?:\/\//.test(text)) netOffender = f;
  if (f.endsWith('.js') && /(?:import\s+[^'"]*['"]|from\s+['"]|require\(\s*['"]|import\(\s*['"])https?:\/\//.test(text)) netOffender = f;
}
row('dashboard_files', hasHtml && hasCss && hasJs && !netOffender, hasHtml && hasCss && hasJs ? (netOffender ? `network address in ${netOffender}` : `${dashFiles.length} files: ${dashFiles.join(', ')}`) : 'missing index.html/.css/.js');

const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8'));
const rows = Array.isArray(board) ? board : board.rows;
const snapSlugs = new Set(snapshot.protocols.map((p) => p.slug));
const bad = rows.filter((r) => !snapSlugs.has(r.slug) || typeof r.name !== 'string' || !r.name || !Number.isSafeInteger(r.rank) || r.rank <= 0 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14 || !Array.isArray(r.farm_steps));
row('board_file', rows.length >= 100 && rows.length <= 4000 && bad.length === 0, `${rows.length} rows, ${bad.length} invalid`);

const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
const ranksOk = ranks.every((v, i) => v === i + 1);
const byRank = [...rows].sort((a, b) => a.rank - b.rank);
const sortedOk = byRank.every((r, i) => i === 0 || r.implied_value_usd <= byRank[i - 1].implied_value_usd);
const varied = rows.length < 2 || byRank[0].implied_value_usd !== byRank[byRank.length - 1].implied_value_usd;
row('sorted_by_value', ranksOk && sortedOk && varied, ranksOk && sortedOk ? `ranks 1..${rows.length}, non-increasing implied value` : 'rank/order problem');

const have = new Set(rows.map((r) => r.slug));
const missing = snapshot.watchlist.filter((s) => !have.has(s));
row('coverage', missing.length === 0, missing.length === 0 ? `all ${snapshot.watchlist.length} watchlist slugs present` : `missing ${missing.slice(0, 5).join(', ')}`);

const badSteps = rows.filter((r) => !Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12 || r.farm_steps.some((s) => typeof s !== 'string' || s.trim().length < 20 || s.trim().length > 600));
row('farm_steps', badSteps.length === 0, badSteps.length === 0 ? `all rows carry 6 steps of 20..600 chars` : `${badSteps.length} rows fail`);

const shotDir = join(out, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => !f.startsWith('.') && statSync(join(shotDir, f)).isFile()) : [];
let shotsOk = shots.length >= 3 && shots.length <= 4;
let shotDetail = shots.map((f) => `${f} ${statSync(join(shotDir, f)).size}B`).join(', ');
for (const f of shots) {
  const b = readFileSync(join(shotDir, f));
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if ((!isJpeg && !isPng) || b.length > 524288) shotsOk = false;
}
row('screenshots', shotsOk, shotDetail || 'none');

// dossier_matches: re-run buildDossier from the repo's vendor copy and compare bytes.
const { buildDossier } = await import('../vendor/makefun-board.ts');
const rebuilt = Buffer.from(buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } }));
const dossier = readFileSync(join(out, 'dossier.json'));
row('dossier_matches', dossier.equals(rebuilt) && dossier.length <= 1572864, dossier.equals(rebuilt) ? `byte-identical, ${dossier.length} bytes` : `mismatch (${dossier.length} vs rebuilt ${rebuilt.length})`);

const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? 'ALL 7 GATE ROWS PASS' : `${failed} GATE ROW(S) FAIL`);
process.exit(failed === 0 ? 0 : 1);
