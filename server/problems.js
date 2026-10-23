// Reads problems from the /problems folder at the repo root.
// Each problem is a folder: statement.md, meta.json and tests/N.in + tests/N.out
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROBLEMS_DIR = path.join(__dirname, '..', 'problems');

function readMeta(slug) {
  const meta = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, slug, 'meta.json'), 'utf8'));
  return { slug, ...meta };
}

function readTests(slug) {
  const dir = path.join(PROBLEMS_DIR, slug, 'tests');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.in'))
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((f) => ({
      input: fs.readFileSync(path.join(dir, f), 'utf8'),
      output: fs.readFileSync(path.join(dir, f.replace(/\.in$/, '.out')), 'utf8'),
    }));
}

export function listProblems() {
  return fs
    .readdirSync(PROBLEMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readMeta(d.name))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function getProblem(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  if (!fs.existsSync(path.join(PROBLEMS_DIR, slug))) return null;
  return {
    ...readMeta(slug),
    statement: fs.readFileSync(path.join(PROBLEMS_DIR, slug, 'statement.md'), 'utf8'),
    tests: readTests(slug),
  };
}
