/**
 * Bump version.json and package.json after a successful build.
 *
 * Run by GitHub Actions in .github/workflows/build.yml
 *
 * Usage: node scripts/bump-version.js
 *
 * Expects env vars:
 *   RUN_ID  – GitHub Actions run ID (github.run_id)
 *   GITHUB_REPOSITORY – e.g. "user/repo" (github.repository)
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// ── Options ─────────────────────────────────────────────────────────────
const VERSION_JSON_PATH = path.resolve(__dirname, '..', 'website', 'version.json');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '..', 'package.json');

const runId = process.env.RUN_ID;
const repository = process.env.GITHUB_REPOSITORY || 'chinna480/DoToRApp';

if (!runId) {
  console.error('❌ RUN_ID environment variable is required');
  process.exit(1);
}

// ── Read current version.json ───────────────────────────────────────────
const v = JSON.parse(fs.readFileSync(VERSION_JSON_PATH, 'utf8'));
const [major, minor, patch] = v.version.split('.').map(Number);
const newVer = major + '.' + minor + '.' + (patch + 1);

// ── Build info ──────────────────────────────────────────────────────────
const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
const now = new Date().toISOString().slice(0, 10);

// ── Extract recent commit messages ──────────────────────────────────────
let notes = [];
try {
  const log = execSync('git log --format="%s" -5 --no-merges', { encoding: 'utf8' });
  notes = log
    .trim()
    .split('\n')
    .filter(m => !m.includes('[skip ci]'))
    .map(m => m.replace(/^(feat|fix|chore|refactor|docs): /, ''))
    .map(m => '✨ ' + m);
} catch (e) {
  console.warn('⚠️ Could not read git log:', e.message);
}

if (notes.length === 0) {
  notes.push('🔧 Performance improvements and bug fixes');
}

// ── Write new version.json ──────────────────────────────────────────────
const newVersion = {
  version: newVer,
  versionCode: Number(runId),
  minVersionCode: 1,
  updateUrl: runUrl,
  releaseDate: now,
  releaseNotes: notes,
  forceUpdate: false,
};

fs.writeFileSync(VERSION_JSON_PATH, JSON.stringify(newVersion, null, 2) + '\n');
console.log('✅ version.json updated to ' + newVer);

// ── Bump package.json version ───────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
pkg.version = newVer;
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ package.json version updated to ' + newVer);
