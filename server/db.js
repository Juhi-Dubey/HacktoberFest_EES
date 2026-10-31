import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const HASH_REGEX = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;

function hashSync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function migratePasswords(db) {
  let changed = false;
  for (const user of db.users) {
    if (user.password && !HASH_REGEX.test(user.password)) {
      user.password = hashSync(user.password);
      changed = true;
    }
  }
  if (changed) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
  return db;
}

function load() {
  if (!fs.existsSync(DB_FILE)) return { users: [], submissions: [] };
  const raw = { users: [], submissions: [], ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  return migratePasswords(raw);
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function addSubmission(submission) {
  const db = load();
  const row = { id: db.submissions.length + 1, createdAt: new Date().toISOString(), ...submission };
  db.submissions.push(row);
  save(db);
  return row;
}

export function listSubmissions({ slug, username } = {}) {
  return load().submissions.filter(
    (s) => (!slug || s.slug === slug) && (!username || s.username === username)
  );
}

export function addUser({ username, email, password }) {
  const db = load();
  const storedPassword = (password && !HASH_REGEX.test(password)) ? hashSync(password) : password;
  const user = {
    id: db.users.length + 1,
    createdAt: new Date().toISOString(),
    username,
    ...(email ? { email } : {}),
    password: storedPassword,
  };
  db.users.push(user);
  save(db);
  return user;
}

export function findUser(identifier) {
  if (!identifier) return null;
  const norm = String(identifier).trim().toLowerCase();
  return load().users.find(
    (u) => u.username.toLowerCase() === norm || (u.email && u.email.toLowerCase() === norm)
  );
}
